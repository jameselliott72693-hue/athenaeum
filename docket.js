(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumDocket = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function decodeEntities(text) {
    return String(text || "")
      .replace(/&amp;/g, "&")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function escapeText(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizeParagraph(html, quotes) {
    const allowed = new Set((quotes || [])
      .filter((quote) => quote && quote.verified === true && quote.text)
      .map((quote) => quote.text));
    const src = String(html || "");
    const re = /<q class="vq">([\s\S]*?)<\/q>|<span class="cite">([\s\S]*?)<\/span>/g;
    let out = "";
    let last = 0;
    let match;
    while ((match = re.exec(src))) {
      out += escapeText(decodeEntities(src.slice(last, match.index).replace(/<[^>]*>/g, "")));
      if (match[1] != null) {
        const text = decodeEntities(match[1]);
        out += allowed.has(text) ? `<q class="vq">${escapeText(text)}</q>` : escapeText(text);
      } else {
        out += `<span class="cite">${escapeText(decodeEntities(match[2]))}</span>`;
      }
      last = match.index + match[0].length;
    }
    out += escapeText(decodeEntities(src.slice(last).replace(/<[^>]*>/g, "")));
    return out;
  }

  function plainModern(text) {
    return String(text || "").replace(/[“”"]/g, "").trim();
  }

  function nightFromLocation(location, nights) {
    const list = nights || [];
    const params = new URLSearchParams(location.search || "");
    const query = params.get("night");
    const hash = String(location.hash || "").replace(/^#/, "");
    const hashed = hash.indexOf("night=") === 0 ? decodeURIComponent(hash.slice(6)) : "";
    const wanted = query || hashed;
    if (wanted && list.some((night) => night.date === wanted)) return wanted;
    return list[0] ? list[0].date : "";
  }

  function nightUrl(date) {
    return `docket.html?night=${encodeURIComponent(date)}`;
  }

  function placeUrl(date, hash) {
    const fragment = String(hash || "");
    if (fragment.indexOf("#") !== 0 || fragment.indexOf("#night=") === 0) return nightUrl(date);
    return nightUrl(date) + fragment;
  }

  function escapeAttr(text) {
    return escapeText(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function httpUrl(url) {
    const text = String(url == null ? "" : url);
    return /^https?:\/\/\S+$/.test(text) ? text : "";
  }

  function sideLabel(label, fallback) {
    const text = label == null ? "" : String(label).trim();
    return text || fallback;
  }

  function noteParts(note, links) {
    const text = note == null ? "" : String(note);
    if (!text.trim()) return [];
    const parts = [];
    let rest = text;
    (links || []).forEach((link) => {
      const name = link && link.name != null ? String(link.name) : "";
      const url = httpUrl(link && link.url);
      if (!name || !url) return;
      const at = rest.indexOf(name);
      if (at < 0) {
        parts.push({ text: name, url });
        return;
      }
      if (at > 0) parts.push({ text: rest.slice(0, at) });
      parts.push({ text: name, url });
      rest = rest.slice(at + name.length);
    });
    if (rest) parts.push({ text: rest });
    return parts;
  }

  function externalLink(url, text) {
    const href = httpUrl(url);
    if (!href) return escapeText(text);
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeText(text)}</a>`;
  }

  function noteHtml(note, links) {
    const parts = noteParts(note, links);
    if (!parts.length) return "";
    const body = parts.map((part) => (part.url ? externalLink(part.url, part.text) : escapeText(part.text))).join("");
    return `<p class="report-note">${body}</p>`;
  }

  function reportStoryHtml(story, sectionName, sittingReady) {
    const item = story || {};
    const id = String(item.id || "");
    const anchor = /^[a-z]+-\d+$/.test(id) ? ` id="story-${escapeAttr(id)}"` : "";
    const sources = (item.sources || []).filter((source) => source && source.name && httpUrl(source.url));
    const sourceHtml = sources.length
      ? `<p class="kicker">Sources</p><ul class="report-sources">${sources.map((source) => `<li>${externalLink(source.url, source.name)}</li>`).join("")}</ul>`
      : "";
    const sittingId = sittingReady && item.sitting_id && /^[A-Za-z0-9-]+$/.test(String(item.sitting_id))
      ? String(item.sitting_id)
      : "";
    const sittingLink = sittingId
      ? `<p class="report-jump"><a href="#sitting-${escapeAttr(sittingId)}">The sitting</a></p>`
      : "";
    const thinkers = item.thinkers_note
      ? `<p class="why-chairs">${escapeText(item.thinkers_note)}</p>`
      : "";
    return `<article class="report-story"${anchor}>
      <p class="kicker">${escapeText(sectionName)} · ${escapeText(item.number)}</p>
      <h4>${escapeText(item.headline)}</h4>
      <p>${escapeText(item.summary)}</p>
      ${sourceHtml}
      <div class="report-sides">
        <div class="report-side"><p class="kicker">${escapeText(sideLabel(item.side_a_label, "One side"))}</p><p>${escapeText(item.side_a)}</p></div>
        <div class="report-side"><p class="kicker">${escapeText(sideLabel(item.side_b_label, "The other side"))}</p><p>${escapeText(item.side_b)}</p></div>
      </div>
      <p class="kicker">The question underneath</p>
      <p class="docket-question">${escapeText(item.question_underneath)}</p>
      ${thinkers}
      ${sittingLink}
    </article>`;
  }

  function reportHtml(report, sittingIds) {
    if (!report) return "";
    const ready = new Set(sittingIds || []);
    const sections = (report.sections || []).map((section) => {
      const stories = (section.stories || []).map((story) => reportStoryHtml(story, section.name, ready.has(story.sitting_id))).join("");
      return `<section class="report-section"><h3>${escapeText(section.name)}</h3><div class="report-stories">${stories}</div></section>`;
    }).join("");
    return `<section class="news-report" id="news-report" aria-labelledby="news-report-heading">
      <p class="kicker">${escapeText(report.title || "")}</p>
      <h2 id="news-report-heading">The news report</h2>
      ${sections}
      ${noteHtml(report.note, report.note_links)}
    </section>`;
  }

  function storyIdForSitting(report, sittingId) {
    if (!report || sittingId == null) return "";
    const sections = report.sections || [];
    for (let i = 0; i < sections.length; i++) {
      const stories = sections[i].stories || [];
      for (let j = 0; j < stories.length; j++) {
        if (stories[j].sitting_id === sittingId && /^[a-z]+-\d+$/.test(String(stories[j].id || ""))) return stories[j].id;
      }
    }
    return "";
  }

  return {
    decodeEntities, escapeText, escapeAttr, sanitizeParagraph, plainModern, nightFromLocation, nightUrl, placeUrl,
    httpUrl, sideLabel, noteParts, reportStoryHtml, reportHtml, storyIdForSitting
  };
});
