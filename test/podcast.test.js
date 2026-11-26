const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const podcast = require("../scripts/build-podcast.js");

const root = path.join(__dirname, "..");
const forbidden = ["Greens", "boro"].join("");
const excluded = ["2026-10-27", "2026-10-28"];
const feedPath = path.join(root, "docket/podcast.xml");
const feedUrl = "https://jameselliott72693-hue.github.io/athenaeum/docket/podcast.xml";

function decode(text) {
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1]] = decode(match[2]);
  return attrs;
}

function parseXml(xml) {
  let i = 0;
  if (!xml.startsWith("<?xml")) throw new Error("missing xml declaration");
  const prolog = xml.indexOf("?>");
  if (prolog < 0) throw new Error("unclosed xml declaration");
  i = prolog + 2;
  function skipWs() {
    while (i < xml.length && /\s/.test(xml[i])) i += 1;
  }
  function parseNodes() {
    const nodes = [];
    while (i < xml.length) {
      skipWs();
      if (i >= xml.length || xml.startsWith("</", i)) break;
      if (xml.startsWith("<!--", i)) {
        const end = xml.indexOf("-->", i);
        if (end < 0) throw new Error("unclosed comment");
        i = end + 3;
        continue;
      }
      if (xml.startsWith("<![CDATA[", i)) {
        const end = xml.indexOf("]]>", i);
        if (end < 0) throw new Error("unclosed cdata");
        nodes.push({ type: "text", text: xml.slice(i + 9, end) });
        i = end + 3;
        continue;
      }
      if (xml[i] !== "<") {
        const next = xml.indexOf("<", i);
        if (next < 0) throw new Error("trailing text");
        nodes.push({ type: "text", text: decode(xml.slice(i, next)) });
        i = next;
        continue;
      }
      const close = xml.indexOf(">", i);
      if (close < 0) throw new Error("unclosed tag");
      let raw = xml.slice(i + 1, close).trim();
      i = close + 1;
      const self = raw.endsWith("/");
      if (self) raw = raw.slice(0, -1).trim();
      const nameMatch = /^([A-Za-z_:][\w:.-]*)/.exec(raw);
      if (!nameMatch) throw new Error("bad tag");
      const node = { type: "el", name: nameMatch[1], attrs: parseAttrs(raw.slice(nameMatch[1].length)), children: [] };
      if (!self) {
        node.children = parseNodes();
        skipWs();
        const endTag = `</${node.name}>`;
        if (!xml.startsWith(endTag, i)) throw new Error(`expected ${endTag}`);
        i += endTag.length;
      }
      nodes.push(node);
    }
    return nodes;
  }
  skipWs();
  const roots = parseNodes().filter((node) => node.type === "el");
  skipWs();
  if (i !== xml.length) throw new Error("trailing markup");
  if (roots.length !== 1) throw new Error("expected one root");
  return roots[0];
}

function elements(node, name) {
  return (node.children || []).filter((child) => child.type === "el" && child.name === name);
}

function child(node, name) {
  const found = elements(node, name);
  assert.strictEqual(found.length, 1, name);
  return found[0];
}

function textOf(node) {
  return (node.children || []).filter((child) => child.type === "text").map((child) => child.text).join("").trim();
}

function which(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch (err) {
    return false;
  }
}

function pscSeconds(value) {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{3})$/.exec(value);
  assert.ok(match, value);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

assert.strictEqual(
  podcast.uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
  "2ed6657d-e927-568b-95e1-2665a8aea6a2"
);

const id = Buffer.from("intro\0");
const times = Buffer.alloc(16);
times.writeUInt32BE(0, 0);
times.writeUInt32BE(1500, 4);
times.writeUInt32BE(0xffffffff, 8);
times.writeUInt32BE(0xffffffff, 12);
const body = Buffer.concat([id, times]);
const frame = Buffer.concat([
  Buffer.from("CHAP"),
  Buffer.from([(body.length >> 21) & 0x7f, (body.length >> 14) & 0x7f, (body.length >> 7) & 0x7f, body.length & 0x7f]),
  Buffer.from([0, 0]),
  body
]);
const tag = Buffer.concat([
  Buffer.from([0x49, 0x44, 0x33, 4, 0, 0]),
  Buffer.from([(frame.length >> 21) & 0x7f, (frame.length >> 14) & 0x7f, (frame.length >> 7) & 0x7f, frame.length & 0x7f]),
  frame
]);
assert.deepStrictEqual(podcast.id3Chapters(tag), [{ id: "intro", startSeconds: 0 }]);

const segments = [
  { id: "intro", weight: 10 },
  { id: "p1", weight: 90 }
];
const written = podcast.planStarts({
  date: "2026-01-01",
  audio_chapters: [{ id: "intro", start: 0 }, { id: "p1", start: 12.5 }]
}, segments, 100, [{ id: "other", startSeconds: 0 }, { id: "other-2", startSeconds: 40 }]);
assert.strictEqual(written.source, "audio_chapters");
assert.deepStrictEqual(written.starts, [0, 12.5]);
const fromId3 = podcast.planStarts({ date: "2026-01-01" }, segments, 100, [
  { id: "a", startSeconds: 0 },
  { id: "b", startSeconds: 40 }
]);
assert.strictEqual(fromId3.source, "id3");
assert.deepStrictEqual(fromId3.starts, [0, 40]);
const fromText = podcast.planStarts({ date: "2026-01-01" }, segments, 100, []);
assert.strictEqual(fromText.source, "text");
assert.deepStrictEqual(fromText.starts, podcast.chapterStarts(100, [10, 90]));
assert.throws(() => podcast.planStarts({ date: "2026-01-01", audio_chapters: [{ id: "intro", start: 0 }] }, segments, 100, []));

const episodes = podcast.collect(root);
const rendered = podcast.render(episodes);
const feed = fs.readFileSync(feedPath, "utf8");
assert.strictEqual(feed, rendered.xml);
rendered.chapters.forEach((chapter) => {
  assert.strictEqual(fs.readFileSync(path.join(root, chapter.file), "utf8"), chapter.text);
});

if (which("xmllint")) execFileSync("xmllint", ["--noout", feedPath], { stdio: "pipe" });
const rss = parseXml(feed);
assert.strictEqual(rss.name, "rss");
assert.strictEqual(rss.attrs.version, "2.0");
assert.strictEqual(rss.attrs["xmlns:itunes"], "http://www.itunes.com/dtds/podcast-1.0.dtd");
assert.strictEqual(rss.attrs["xmlns:podcast"], "https://podcastindex.org/namespace/1.0");
assert.strictEqual(rss.attrs["xmlns:psc"], "http://podlove.org/simple-chapters");
assert.strictEqual(rss.attrs["xmlns:atom"], "http://www.w3.org/2005/Atom");
const channel = child(rss, "channel");
assert.strictEqual(textOf(child(channel, "title")), "The Athenaeum");
assert.strictEqual(textOf(child(channel, "link")), "https://jameselliott72693-hue.github.io/athenaeum/");
assert.ok(textOf(child(channel, "description")).length > 0);
assert.strictEqual(textOf(child(channel, "language")), "en");
assert.strictEqual(textOf(child(channel, "itunes:author")), "The Athenaeum");
assert.strictEqual(textOf(child(channel, "itunes:explicit")), "false");
assert.strictEqual(child(channel, "itunes:image").attrs.href, "https://jameselliott72693-hue.github.io/athenaeum/icon-192.png");
assert.strictEqual(child(channel, "itunes:category").attrs.text, "Society & Culture");
const self = child(channel, "atom:link");
assert.strictEqual(self.attrs.href, feedUrl);
assert.strictEqual(self.attrs.rel, "self");
assert.strictEqual(self.attrs.type, "application/rss+xml");
assert.strictEqual(textOf(child(channel, "podcast:guid")), podcast.uuidv5(feedUrl, podcast.PODCAST_NAMESPACE));

const items = elements(channel, "item");
assert.strictEqual(items.length, episodes.length);
assert.ok(items.length > 0);
const chapterNames = fs.readdirSync(path.join(root, "docket/audio")).filter((name) => name.endsWith(".chapters.json"));
assert.deepStrictEqual(chapterNames.sort(), episodes.map((episode) => `${episode.date}.chapters.json`).sort());

const listed = [];
["index.json", "archive.json"].forEach((name) => {
  const data = JSON.parse(fs.readFileSync(path.join(root, "docket", name), "utf8"));
  (data.nights || []).forEach((night) => {
    if (!night || !night.audio || excluded.includes(night.date)) return;
    const audio = path.join(root, "docket", String(night.audio).replace(/^docket\//, ""));
    if (fs.existsSync(audio)) listed.push(night.date);
  });
});
assert.deepStrictEqual(episodes.map((episode) => episode.date), listed);
assert.ok(!listed.includes("2026-10-22"));
assert.ok(!listed.includes("2026-10-23"));
excluded.forEach((date) => {
  assert.ok(podcast.EXCLUDED_DATES.has(date));
  assert.ok(!feed.includes(date), date);
  assert.ok(!listed.includes(date), date);
});

const probe = which("ffprobe");
items.forEach((item, index) => {
  const episode = episodes[index];
  const enclosure = child(item, "enclosure");
  const audioPath = path.join(root, "docket/audio", episode.filename);
  assert.ok(fs.existsSync(audioPath), episode.filename);
  const bytes = fs.statSync(audioPath).size;
  assert.strictEqual(Number(enclosure.attrs.length), bytes);
  assert.strictEqual(episode.bytes, bytes);
  assert.strictEqual(enclosure.attrs.type, "audio/mpeg");
  assert.strictEqual(enclosure.attrs.url, `https://jameselliott72693-hue.github.io/athenaeum/docket/audio/${episode.filename}`);
  const measured = podcast.measureMp3(fs.readFileSync(audioPath));
  assert.strictEqual(textOf(child(item, "itunes:duration")), podcast.itunesDuration(measured.seconds));
  assert.ok(measured.seconds > 0);
  if (probe) {
    const reported = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath], { encoding: "utf8" }).trim());
    assert.ok(Math.abs(reported - measured.seconds) < 0.001, episode.date);
  }
  const edition = JSON.parse(fs.readFileSync(path.join(root, "docket", `${episode.date}.json`), "utf8"));
  const sittings = podcast.shortSittings(edition);
  assert.ok(sittings.length > 0, episode.date);
  const summary = textOf(child(item, "itunes:summary"));
  const description = textOf(child(item, "description"));
  sittings.forEach((sitting) => {
    assert.ok(summary.includes(sitting.headline), sitting.id);
    assert.ok(summary.includes(sitting.question), sitting.id);
    assert.ok(description.includes(sitting.headline), sitting.id);
    assert.ok(description.includes(sitting.question), sitting.id);
  });
  const remote = child(item, "podcast:chapters");
  assert.strictEqual(remote.attrs.type, "application/json+chapters");
  assert.strictEqual(remote.attrs.url, `https://jameselliott72693-hue.github.io/athenaeum/docket/audio/${episode.date}.chapters.json`);
  const chapterFile = path.join(root, "docket/audio", `${episode.date}.chapters.json`);
  const chapters = JSON.parse(fs.readFileSync(chapterFile, "utf8"));
  assert.strictEqual(chapters.version, "1.2.0");
  assert.ok(Array.isArray(chapters.chapters));
  assert.strictEqual(chapters.chapters[0].title, "Intro");
  assert.strictEqual(chapters.chapters[0].startTime, 0);
  assert.strictEqual(chapters.chapters.length, sittings.length + 1);
  const weights = [Math.max(1, podcast.introText(edition).length)].concat(
    sittings.map((sitting) => Math.max(1, podcast.sittingText(sitting).length))
  );
  assert.deepStrictEqual(podcast.id3Chapters(fs.readFileSync(audioPath)), []);
  assert.ok(edition.audio_chapters == null);
  const expected = podcast.chapterStarts(measured.seconds, weights);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  chapters.chapters.forEach((chapter, chapterIndex) => {
    assert.strictEqual(chapter.startTime, expected[chapterIndex]);
    assert.strictEqual(typeof chapter.title, "string");
    assert.ok(chapter.title.length > 0);
    assert.ok(chapter.startTime >= 0 && chapter.startTime < measured.seconds);
    if (chapterIndex) {
      assert.ok(chapter.startTime > chapters.chapters[chapterIndex - 1].startTime);
      assert.ok(chapter.title.includes(sittings[chapterIndex - 1].headline), chapter.title);
      assert.ok(chapter.title.includes(sittings[chapterIndex - 1].question), chapter.title);
    }
    const next = chapterIndex + 1 < chapters.chapters.length ? chapters.chapters[chapterIndex + 1].startTime : measured.seconds;
    const span = next - chapter.startTime;
    assert.ok(Math.abs(span - (weights[chapterIndex] / total) * measured.seconds) < 0.05, episode.date);
    assert.ok(!JSON.stringify(chapter).includes(forbidden));
  });
  const psc = child(item, "psc:chapters");
  assert.strictEqual(psc.attrs.version, "1.2");
  const markers = elements(psc, "psc:chapter");
  assert.strictEqual(markers.length, chapters.chapters.length);
  markers.forEach((marker, markerIndex) => {
    assert.ok(Math.abs(pscSeconds(marker.attrs.start) - chapters.chapters[markerIndex].startTime) < 0.001);
    assert.strictEqual(marker.attrs.title, chapters.chapters[markerIndex].title);
  });
  assert.ok(!summary.includes(forbidden));
  assert.ok(!description.includes(forbidden));
});

assert.ok(!feed.includes(forbidden));
["scripts/build-podcast.js", "docket.html", "index.html", "docket.js", "docket-page.js", "styles.css", "README.md", "build_sittings.md"].forEach((file) => {
  assert.ok(!fs.readFileSync(path.join(root, file), "utf8").includes(forbidden), file);
});
const alternate = '<link rel="alternate" type="application/rss+xml" title="The Athenaeum Podcast" href="docket/podcast.xml" />';
assert.ok(fs.readFileSync(path.join(root, "docket.html"), "utf8").includes(alternate));
assert.ok(fs.readFileSync(path.join(root, "index.html"), "utf8").includes(alternate));
const docketHtml = fs.readFileSync(path.join(root, "docket.html"), "utf8");
assert.ok(docketHtml.includes("Podcast RSS"));
assert.ok(docketHtml.includes("Copy feed"));
assert.ok(docketHtml.includes(`data-feed="${feedUrl}"`));
const player = require("../docket.js").audioHtml("audio/2026-11-08.mp3");
assert.ok(player.includes("<audio"));
assert.ok(player.includes('src="docket/audio/2026-11-08.mp3"'));
assert.ok(player.includes("Podcast RSS"));
assert.ok(player.includes('href="docket/podcast.xml"'));

console.log("podcast tests passed", items.length, "episodes");
