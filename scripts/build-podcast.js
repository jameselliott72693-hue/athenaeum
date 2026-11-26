#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = "https://jameselliott72693-hue.github.io/athenaeum/";
const FEED_PATH = "docket/podcast.xml";
const FEED_URL = BASE + FEED_PATH;
const PODCAST_NAMESPACE = "ead4c236-bf58-58c6-a2c6-a6b28d128cb6";
const EXCLUDED_DATES = new Set(["2026-10-27", "2026-10-28"]);

const BITRATE = {
  1: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
  },
  2: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
  }
};

function uuidv5(name, namespace) {
  const ns = Buffer.from(String(namespace).replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error("uuid namespace must be 16 bytes");
  const hash = crypto.createHash("sha1").update(ns).update(String(name), "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function xmlText(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlAttr(text) {
  return xmlText(text).replace(/"/g, "&quot;");
}

function piece(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && typeof value.text === "string") return value.text.trim();
  return "";
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function introText(edition) {
  const why = edition.short_edition && piece(edition.short_edition.why);
  return [piece(edition.title), piece(edition.date_long), piece(edition.subtitle), why].filter(Boolean).join("\n");
}

function sittingText(sitting) {
  const parts = [piece(sitting.headline), piece(sitting.question), piece(sitting.setup)];
  const moderator = sitting.moderator || {};
  parts.push(piece(moderator.opening));
  (sitting.chairs || []).forEach((chair) => {
    (chair.turn || []).forEach((turn) => parts.push(piece(turn)));
  });
  parts.push(piece(moderator.closing));
  return parts.filter(Boolean).join("\n");
}

function shortSittings(edition) {
  const sittings = Array.isArray(edition.sittings) ? edition.sittings : [];
  const byId = new Map(sittings.map((sitting) => [sitting.id, sitting]));
  const picks = edition.short_edition && Array.isArray(edition.short_edition.picks) ? edition.short_edition.picks : null;
  if (picks && picks.length) {
    const missing = picks.filter((id) => !byId.has(id));
    if (missing.length) throw new Error(`${edition.date} short edition names missing sittings: ${missing.join(", ")}`);
    return picks.map((id) => byId.get(id));
  }
  return sittings.filter((sitting) => sitting && sitting.in_short_edition);
}

function readId3Size(buf) {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return 0;
  const version = buf[3];
  const flags = buf[5];
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  let total = 10 + size;
  if (flags & 0x10) total += 10;
  if (version !== 3 && version !== 4) return total;
  if (flags & 0x80) return total;
  return total;
}

function parseFrameHeader(buf, offset) {
  if (offset + 4 > buf.length) return null;
  const b1 = buf[offset + 1];
  const b2 = buf[offset + 2];
  const b3 = buf[offset + 3];
  if (buf[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const versionBits = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  if (versionBits === 1 || layerBits === 0) return null;
  const version = versionBits === 3 ? 1 : 2;
  const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;
  const bitrateIndex = (b2 >> 4) & 0xf;
  const sampleIndex = (b2 >> 2) & 3;
  const padding = (b2 >> 1) & 1;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return null;
  const rates = version === 1 ? [44100, 48000, 32000] : versionBits === 0 ? [11025, 12000, 8000] : [22050, 24000, 16000];
  const sampleRate = rates[sampleIndex];
  const family = version === 1 ? BITRATE[1] : BITRATE[2];
  const bitrate = family[layer][bitrateIndex] * 1000;
  if (!bitrate || !sampleRate) return null;
  let length;
  if (layer === 1) length = Math.floor((12 * bitrate) / sampleRate + padding) * 4;
  else if (layer === 3 && version !== 1) length = Math.floor((72 * bitrate) / sampleRate) + padding;
  else length = Math.floor((144 * bitrate) / sampleRate) + padding;
  if (length < 4 || offset + length > buf.length) return null;
  const samples = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  return {
    length,
    samples,
    sampleRate,
    version,
    layer,
    channelMode: (b3 >> 6) & 3
  };
}

function xingFrameCount(buf, offset, frame) {
  const mono = frame.channelMode === 3;
  const side = frame.version === 1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const start = offset + 4 + side;
  if (start + 12 > offset + frame.length || start + 12 > buf.length) return null;
  const tag = buf.toString("latin1", start, start + 4);
  if (tag !== "Xing" && tag !== "Info") return null;
  const flags = buf.readUInt32BE(start + 4);
  if ((flags & 1) === 0) return null;
  const frames = buf.readUInt32BE(start + 8);
  return frames > 0 ? frames : null;
}

function measureMp3(buf) {
  const audioAt = readId3Size(buf);
  let offset = audioAt;
  let frames = 0;
  let samples = 0;
  let sampleRate = 0;
  let first = null;
  while (offset + 4 <= buf.length) {
    const frame = parseFrameHeader(buf, offset);
    if (!frame) {
      if (frames === 0) {
        offset += 1;
        continue;
      }
      break;
    }
    if (!first) first = { offset, frame };
    if (sampleRate && frame.sampleRate !== sampleRate) {
      throw new Error("MP3 changes sample rate; refusing to guess a duration");
    }
    sampleRate = frame.sampleRate;
    samples += frame.samples;
    frames += 1;
    offset += frame.length;
  }
  if (!frames || !sampleRate || !first) throw new Error("MP3 has no audio frames");
  const xingFrames = xingFrameCount(buf, first.offset, first.frame);
  // The Xing/Info frame count is the duration players read. A scan can land on
  // one extra header inside VBR padding; more than two frames of disagreement
  // means the file was not actually measured.
  if (xingFrames != null && Math.abs(frames - xingFrames) > 2) {
    throw new Error(`MP3 frame count ${frames} does not match its Xing header ${xingFrames}`);
  }
  const usedFrames = xingFrames == null ? frames : xingFrames;
  const seconds = xingFrames == null ? samples / sampleRate : (usedFrames * first.frame.samples) / sampleRate;
  return { seconds, frames: usedFrames, scannedFrames: frames, sampleRate, xingFrames, bytes: buf.length };
}

function readSynchsafe(buf, offset) {
  return ((buf[offset] & 0x7f) << 21) | ((buf[offset + 1] & 0x7f) << 14) | ((buf[offset + 2] & 0x7f) << 7) | (buf[offset + 3] & 0x7f);
}

function id3Chapters(buf) {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return [];
  const version = buf[3];
  const flags = buf[5];
  if ((version !== 3 && version !== 4) || (flags & 0x80)) return [];
  let offset = 10;
  const tagEnd = Math.min(buf.length, 10 + readSynchsafe(buf, 6));
  if (flags & 0x40) {
    if (offset + 4 > tagEnd) return [];
    const ext = version === 4 ? readSynchsafe(buf, offset) : buf.readUInt32BE(offset);
    offset += ext;
  }
  const chapters = [];
  while (offset + 10 <= tagEnd) {
    const id = buf.toString("latin1", offset, offset + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? readSynchsafe(buf, offset + 4) : buf.readUInt32BE(offset + 4);
    const frameFlags = buf.readUInt16BE(offset + 8);
    const bodyAt = offset + 10;
    offset = bodyAt + size;
    if (bodyAt + size > tagEnd) break;
    if (id !== "CHAP" || (frameFlags & 0x00c0)) continue;
    let cursor = bodyAt;
    while (cursor < bodyAt + size && buf[cursor] !== 0) cursor += 1;
    if (cursor >= bodyAt + size) continue;
    const elementId = buf.toString("utf8", bodyAt, cursor);
    cursor += 1;
    if (cursor + 16 > bodyAt + size) continue;
    chapters.push({ id: elementId, startSeconds: buf.readUInt32BE(cursor) / 1000 });
  }
  return chapters;
}

function explicitCues(edition, segments) {
  if (edition.audio_chapters == null) return null;
  if (!Array.isArray(edition.audio_chapters)) throw new Error(`${edition.date} audio_chapters is not a list`);
  const byId = new Map();
  edition.audio_chapters.forEach((row) => {
    if (!row || row.id == null || !Number.isFinite(Number(row.start))) {
      throw new Error(`${edition.date} audio_chapters entries need an id and a start time in seconds`);
    }
    byId.set(String(row.id), Number(row.start));
  });
  const missing = segments.filter((segment) => !byId.has(segment.id));
  if (missing.length) throw new Error(`${edition.date} audio_chapters is missing ${missing.map((segment) => segment.id).join(", ")}`);
  return segments.map((segment) => ({ id: segment.id, startSeconds: byId.get(segment.id) }));
}

function secondsFromMs(ms) {
  return Number((ms / 1000).toFixed(3));
}

function chapterStarts(duration, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("audio duration is not usable");
  if (!total) throw new Error("chapter weights are empty");
  const ms = Math.round(duration * 1000);
  let used = 0;
  const starts = weights.map((weight, index) => {
    const startMs = index === 0 ? 0 : Math.round((used / total) * ms);
    used += weight;
    return secondsFromMs(startMs);
  });
  for (let i = 1; i < starts.length; i += 1) {
    if (starts[i] <= starts[i - 1]) starts[i] = secondsFromMs(Math.round(starts[i - 1] * 1000) + 1);
    if (!(starts[i] < duration)) throw new Error("chapter times do not fit the measured audio");
  }
  return starts;
}

function cueStarts(cues, duration, label) {
  const starts = cues.map((cue) => secondsFromMs(Math.round(cue.startSeconds * 1000)));
  if (starts[0] !== 0) throw new Error(`${label} chapters do not start at 0`);
  for (let i = 1; i < starts.length; i += 1) {
    if (!(starts[i] > starts[i - 1])) throw new Error(`${label} chapters are not in order`);
    if (!(starts[i] < duration)) throw new Error(`${label} has a chapter past the end of the audio`);
  }
  return starts;
}

function planStarts(edition, segments, duration, id3) {
  const written = explicitCues(edition, segments);
  if (written) return { source: "audio_chapters", starts: cueStarts(written, duration, edition.date) };
  if (id3.length) {
    if (id3.length !== segments.length) {
      throw new Error(`${edition.date} MP3 has ${id3.length} chapter frames for ${segments.length} parts`);
    }
    return { source: "id3", starts: cueStarts(id3, duration, edition.date) };
  }
  return {
    source: "text",
    starts: chapterStarts(duration, segments.map((segment) => segment.weight))
  };
}

function pscTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${String(milli).padStart(3, "0")}`;
}

function itunesDuration(seconds) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

function rfc822(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  return `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`;
}

function publicationDate(edition) {
  if (edition.generated && !Number.isNaN(Date.parse(edition.generated))) return new Date(edition.generated);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(edition.date || "");
  if (!match) throw new Error(`${edition.date || "edition"} has no publication date`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function nightUrl(date, sittingId) {
  const page = `${BASE}docket.html?night=${encodeURIComponent(date)}`;
  return sittingId ? `${page}#sitting-${encodeURIComponent(sittingId)}` : page;
}

function audioUrl(filename) {
  return `${BASE}docket/audio/${encodeURIComponent(filename)}`;
}

function chapterTitle(sitting, index) {
  const headline = oneLine(piece(sitting.headline) || sitting.id);
  const question = oneLine(piece(sitting.question));
  return question ? `${index}. ${headline} — ${question}` : `${index}. ${headline}`;
}

function summaryText(edition, sittings) {
  const lines = [];
  if (piece(edition.date_long)) lines.push(piece(edition.date_long));
  if (piece(edition.subtitle)) lines.push(piece(edition.subtitle));
  const why = edition.short_edition && piece(edition.short_edition.why);
  if (why) lines.push(why);
  lines.push("Short edition:");
  sittings.forEach((sitting, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${oneLine(piece(sitting.headline) || sitting.id)}`);
    const question = oneLine(piece(sitting.question));
    if (question) lines.push(question);
  });
  return lines.join("\n");
}

function descriptionHtml(edition, sittings) {
  const blocks = [];
  if (piece(edition.date_long)) blocks.push(`<p>${xmlText(piece(edition.date_long))}</p>`);
  if (piece(edition.subtitle)) blocks.push(`<p>${xmlText(piece(edition.subtitle))}</p>`);
  const why = edition.short_edition && piece(edition.short_edition.why);
  if (why) blocks.push(`<p>${xmlText(why)}</p>`);
  blocks.push("<p>Short edition:</p>");
  if (sittings.length) {
    const items = sittings.map((sitting) => {
      const headline = oneLine(piece(sitting.headline) || sitting.id);
      const question = oneLine(piece(sitting.question));
      const body = question
        ? `<strong>${xmlText(headline)}</strong><br/>${xmlText(question)}`
        : `<strong>${xmlText(headline)}</strong>`;
      return `<li>${body}</li>`;
    }).join("");
    blocks.push(`<ol>${items}</ol>`);
  }
  return blocks.join("");
}

function listedNights(root) {
  const out = [];
  const seen = new Set();
  ["index.json", "archive.json"].forEach((name) => {
    const file = path.join(root, "docket", name);
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    (data.nights || []).forEach((night) => {
      if (!night || !night.date || seen.has(night.date)) return;
      seen.add(night.date);
      out.push(night);
    });
  });
  return out;
}

function resolveAudio(root, night) {
  const rel = String(night.audio || "").trim();
  if (!rel || rel.includes("..") || rel.includes("\\")) return "";
  const under = rel.startsWith("docket/") ? rel : path.join("docket", rel);
  const abs = path.resolve(root, under);
  const audioDir = path.resolve(root, "docket", "audio");
  if (abs !== audioDir && !abs.startsWith(audioDir + path.sep)) return "";
  if (!fs.existsSync(abs)) return "";
  return abs;
}

function segmentsFor(edition) {
  const intro = introText(edition);
  const segments = [{
    id: "intro",
    title: "Intro",
    url: nightUrl(edition.date),
    weight: Math.max(1, intro.length)
  }];
  shortSittings(edition).forEach((sitting, index) => {
    segments.push({
      id: sitting.id,
      title: chapterTitle(sitting, index + 1),
      url: nightUrl(edition.date, sitting.id),
      weight: Math.max(1, sittingText(sitting).length)
    });
  });
  return segments;
}

function collect(root) {
  const base = root || ROOT;
  const episodes = [];
  listedNights(base).forEach((night) => {
    if (!night.audio) return;
    if (EXCLUDED_DATES.has(night.date)) {
      console.error(`skip ${night.date}: that night is not in the feed`);
      return;
    }
    const audioPath = resolveAudio(base, night);
    if (!audioPath) {
      console.error(`skip ${night.date}: named audio file is not in the repo`);
      return;
    }
    if (!night.file) {
      console.error(`skip ${night.date}: no sittings file`);
      return;
    }
    const editionPath = path.join(base, "docket", night.file);
    if (!fs.existsSync(editionPath)) {
      console.error(`skip ${night.date}: sittings file is missing`);
      return;
    }
    const edition = JSON.parse(fs.readFileSync(editionPath, "utf8"));
    if (edition.date !== night.date) {
      console.error(`skip ${night.date}: sittings file is dated ${edition.date}`);
      return;
    }
    const buf = fs.readFileSync(audioPath);
    const measured = measureMp3(buf);
    if (measured.bytes !== buf.length) throw new Error(`${night.date} byte length mismatch`);
    const segments = segmentsFor(edition);
    const planned = planStarts(edition, segments, measured.seconds, id3Chapters(buf));
    const sittings = shortSittings(edition);
    const filename = path.basename(audioPath);
    episodes.push({
      date: night.date,
      title: piece(edition.date_long) || piece(night.label) || night.date,
      page: nightUrl(night.date),
      pubDate: rfc822(publicationDate(edition)),
      summary: summaryText(edition, sittings),
      description: descriptionHtml(edition, sittings),
      seconds: measured.seconds,
      duration: itunesDuration(measured.seconds),
      bytes: buf.length,
      filename,
      enclosure: audioUrl(filename),
      chaptersUrl: audioUrl(`${night.date}.chapters.json`),
      chapterSource: planned.source,
      chapters: segments.map((segment, index) => ({
        startTime: planned.starts[index],
        title: segment.title,
        url: segment.url
      }))
    });
  });
  return episodes;
}

function render(episodes) {
  const list = episodes || [];
  const newest = list[0] ? list[0].pubDate : rfc822(new Date(0));
  const channel = [
    `    <title>The Athenaeum</title>`,
    `    <link>${xmlText(BASE)}</link>`,
    `    <atom:link href="${xmlAttr(FEED_URL)}" rel="self" type="application/rss+xml"/>`,
    `    <description>${xmlText("Audio editions of The Athenaeum. Each episode is one night's short sittings: the questions, and the chairs speaking from the record that was kept.")}</description>`,
    `    <language>en</language>`,
    `    <lastBuildDate>${xmlText(newest)}</lastBuildDate>`,
    `    <generator>scripts/build-podcast.js</generator>`,
    `    <itunes:author>The Athenaeum</itunes:author>`,
    `    <itunes:summary>${xmlText("Audio editions of The Athenaeum. Each episode is one night's short sittings.")}</itunes:summary>`,
    `    <itunes:explicit>false</itunes:explicit>`,
    `    <itunes:type>episodic</itunes:type>`,
    `    <itunes:image href="${xmlAttr(BASE + "icon-192.png")}"/>`,
    `    <itunes:category text="Society &amp; Culture">`,
    `      <itunes:category text="Philosophy"/>`,
    `    </itunes:category>`,
    `    <image>`,
    `      <url>${xmlText(BASE + "icon-192.png")}</url>`,
    `      <title>The Athenaeum</title>`,
    `      <link>${xmlText(BASE)}</link>`,
    `    </image>`,
    `    <podcast:guid>${uuidv5(FEED_URL, PODCAST_NAMESPACE)}</podcast:guid>`
  ];
  list.forEach((episode) => {
    const psc = episode.chapters.map((chapter) => (
      `        <psc:chapter start="${xmlAttr(pscTime(chapter.startTime))}" title="${xmlAttr(chapter.title)}" href="${xmlAttr(chapter.url)}"/>`
    )).join("\n");
    channel.push(
      `    <item>`,
      `      <title>${xmlText(episode.title)}</title>`,
      `      <link>${xmlText(episode.page)}</link>`,
      `      <guid isPermaLink="true">${xmlText(episode.page)}</guid>`,
      `      <pubDate>${xmlText(episode.pubDate)}</pubDate>`,
      `      <description>${xmlText(episode.description)}</description>`,
      `      <itunes:title>${xmlText(episode.title)}</itunes:title>`,
      `      <itunes:summary>${xmlText(episode.summary)}</itunes:summary>`,
      `      <itunes:duration>${xmlText(episode.duration)}</itunes:duration>`,
      `      <itunes:explicit>false</itunes:explicit>`,
      `      <itunes:episodeType>full</itunes:episodeType>`,
      `      <enclosure url="${xmlAttr(episode.enclosure)}" length="${episode.bytes}" type="audio/mpeg"/>`,
      `      <podcast:chapters url="${xmlAttr(episode.chaptersUrl)}" type="application/json+chapters"/>`,
      `      <psc:chapters version="1.2">`,
      psc,
      `      </psc:chapters>`,
      `    </item>`
    );
  });
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:psc="http://podlove.org/simple-chapters" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    channel.join("\n"),
    `  </channel>`,
    `</rss>`,
    ``
  ].join("\n");
  const chapters = list.map((episode) => ({
    date: episode.date,
    file: path.join("docket", "audio", `${episode.date}.chapters.json`),
    text: JSON.stringify({
      version: "1.2.0",
      chapters: episode.chapters.map((chapter) => ({
        startTime: chapter.startTime,
        title: chapter.title,
        url: chapter.url
      }))
    }, null, 2) + "\n"
  }));
  return { xml, chapters };
}

function build(root) {
  const base = root || ROOT;
  const rendered = render(collect(base));
  fs.writeFileSync(path.join(base, FEED_PATH), rendered.xml);
  const kept = new Set();
  rendered.chapters.forEach((chapter) => {
    kept.add(chapter.date);
    fs.writeFileSync(path.join(base, chapter.file), chapter.text);
  });
  const audioDir = path.join(base, "docket", "audio");
  fs.readdirSync(audioDir).forEach((name) => {
    const match = /^(\d{4}-\d{2}-\d{2})\.chapters\.json$/.exec(name);
    if (match && !kept.has(match[1])) fs.unlinkSync(path.join(audioDir, name));
  });
  return rendered.chapters.length;
}

module.exports = {
  BASE,
  FEED_URL,
  PODCAST_NAMESPACE,
  EXCLUDED_DATES,
  uuidv5,
  introText,
  sittingText,
  shortSittings,
  measureMp3,
  id3Chapters,
  chapterStarts,
  planStarts,
  itunesDuration,
  pscTime,
  collect,
  render,
  build
};

if (require.main === module) {
  const count = build();
  console.log(`wrote ${count} episodes to ${FEED_PATH}`);
}
