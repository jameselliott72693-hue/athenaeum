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

  function nightQuery(location) {
    const params = new URLSearchParams(location.search || "");
    const query = params.get("night");
    if (query) return query;
    const hash = String(location.hash || "").replace(/^#/, "");
    if (hash.indexOf("night=") === 0) return decodeURIComponent(hash.slice(6));
    return "";
  }

  function nightFromLocation(location, nights) {
    const list = nights || [];
    const wanted = nightQuery(location);
    if (wanted && list.some((night) => night.date === wanted)) return wanted;
    if (wanted) return "";
    return list[0] ? list[0].date : "";
  }

  function portraitPath(portrait) {
    const text = String(portrait == null ? "" : portrait).trim();
    const fromAssets = /^assets\/([A-Za-z0-9._-]+)$/.exec(text);
    if (fromAssets) return "images/" + fromAssets[1];
    if (/^images\/[A-Za-z0-9._-]+$/.test(text)) return text;
    return "";
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

  function externalLink(url, text, className) {
    const href = httpUrl(url);
    if (!href) return escapeText(text);
    const cls = className ? ` class="${escapeAttr(className)}"` : "";
    return `<a${cls} href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeText(text)}</a>`;
  }

  function sourceItemHtml(source) {
    const item = source || {};
    const name = item.name == null ? "" : String(item.name);
    if (!name || !httpUrl(item.url)) return "";
    const archived = httpUrl(item.archived);
    const extra = archived
      ? ` <a class="tap-target source-archived" href="${escapeAttr(archived)}" target="_blank" rel="noopener">archived</a>`
      : "";
    return `<li>${externalLink(item.url, name, "tap-target")}${extra}</li>`;
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
    const sourceItems = (item.sources || []).map(sourceItemHtml).filter(Boolean);
    const sourceHtml = sourceItems.length
      ? `<p class="kicker">Sources</p><ul class="report-sources">${sourceItems.join("")}</ul>`
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

  const READ_STORAGE_KEY = "athenaeum:docket:read";

  function readState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    Object.keys(raw).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const value = raw[key];
      if (value === true || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim())) {
        out[key] = value;
      }
    });
    return out;
  }

  function parseReadState(text) {
    if (text == null || text === "") return {};
    try {
      return readState(JSON.parse(text));
    } catch (err) {
      return {};
    }
  }

  function isNightRead(map, date) {
    if (!map || !date) return false;
    const value = map[date];
    return value === true || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && String(value).trim() !== "");
  }

  function withNightRead(map, date, read, now) {
    const next = {};
    Object.keys(map || {}).forEach((key) => { next[key] = map[key]; });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return next;
    if (read) next[date] = now || new Date().toISOString();
    else delete next[date];
    return next;
  }

  function unreadCount(nights, map) {
    return (nights || []).filter((night) => night && night.date && !isNightRead(map, night.date)).length;
  }

  function unreadHint(nights, map) {
    const count = unreadCount(nights, map);
    if (count === 0) return "All nights read";
    if (count === 1) return "1 night unread";
    return count + " nights unread";
  }

  function nightMenuLabel(night, map) {
    const name = (night && (night.label || night.date)) || "";
    return (isNightRead(map, night && night.date) ? "✓ Read, " : "● Unread, ") + name;
  }

  function loadReadMap(storage) {
    try {
      if (!storage || typeof storage.getItem !== "function") return {};
      return parseReadState(storage.getItem(READ_STORAGE_KEY));
    } catch (err) {
      return {};
    }
  }

  function saveReadMap(storage, map) {
    try {
      if (!storage || typeof storage.setItem !== "function") return false;
      storage.setItem(READ_STORAGE_KEY, JSON.stringify(map || {}));
      return true;
    } catch (err) {
      return false;
    }
  }

  function distinctChairs(chairs) {
    const seen = new Set();
    const names = [];
    (chairs || []).forEach((name) => {
      const clean = String(name || "").trim();
      const key = clean.toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      names.push(clean);
    });
    return names;
  }

  function discussionsFromNight(date, night) {
    return ((night && night.sittings) || []).map((sitting) => ({
      id: `${date}/${sitting && sitting.id}`,
      agreed: (sitting && sitting.briefing && sitting.briefing.agreed) || "",
      question: (sitting && sitting.question) || "",
      chairs: ((sitting && sitting.chairs) || []).map((chair) => chair && chair.name)
    }));
  }

  function agreementTallies(discussions, topicsOf) {
    const list = [];
    const seen = new Set();
    (discussions || []).forEach((item) => {
      if (!item || item.id == null || String(item.id) === "") return;
      const id = String(item.id);
      if (seen.has(id)) return;
      const agreed = String(item.agreed || "").trim();
      if (!agreed || distinctChairs(item.chairs).length < 2) return;
      seen.add(id);
      const raw = typeof topicsOf === "function" ? topicsOf(`${item.question || ""} ${agreed}`) : [];
      const topics = [...new Set((raw || []).map((topic) => String(topic || "")).filter(Boolean))];
      list.push({ id, topics });
    });
    const counts = {};
    list.forEach((row) => {
      row.topics.forEach((topic) => { counts[topic] = (counts[topic] || 0) + 1; });
    });
    return list.map((row) => {
      let subject = "";
      row.topics.forEach((topic) => {
        if (!subject) {
          subject = topic;
          return;
        }
        const best = counts[subject];
        const next = counts[topic];
        if (next < best || (next === best && topic < subject)) subject = topic;
      });
      return { id: row.id, subject, count: subject ? counts[subject] : 1 };
    });
  }

  function agreementLabel(row) {
    if (!row) return "";
    const count = Number(row.count);
    const n = Number.isFinite(count) ? count : 0;
    const subject = String(row.subject || "").trim();
    if (subject) return `${n === 1 ? "discussion" : "discussions"} where thinkers agreed on ${subject}`;
    const opening = n === 1 ? "discussion records this agreement" : "discussions record this agreement";
    return `${opening}. No listed subject ties it to another`;
  }

  function clipText(text, max) {
    const value = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    const limit = max || 180;
    if (value.length <= limit) return value;
    return value.slice(0, limit - 1).trim() + "…";
  }

  function searchHay(value) {
    return String(value == null ? "" : value).toLowerCase();
  }

  function searchNights(records, query) {
    const q = searchHay(query).trim();
    if (q.length < 2) return [];
    const results = [];
    const seen = new Set();
    function push(row) {
      const key = [row.kind, row.date, row.sittingId || "", row.storyId || "", row.title || "", row.excerpt || ""].join("\0");
      if (seen.has(key)) return;
      seen.add(key);
      results.push(row);
    }
    (records || []).forEach((record) => {
      if (!record || !record.date) return;
      const date = String(record.date);
      const label = record.label || date;
      const night = record.night;
      ((night && night.sittings) || []).forEach((sitting) => {
        const sittingId = sitting && sitting.id && /^[A-Za-z0-9-]+$/.test(String(sitting.id)) ? String(sitting.id) : "";
        const href = placeUrl(date, sittingId ? `#sitting-${sittingId}` : "");
        (sitting.chairs || []).forEach((chair) => {
          const name = chair && chair.name ? String(chair.name).trim() : "";
          if (!name || !searchHay(name).includes(q)) return;
          push({
            kind: "thinker",
            date,
            label,
            sittingId,
            title: name,
            excerpt: (sitting.headline || sitting.question || ""),
            href
          });
        });
        (sitting.quotes || []).forEach((quote) => {
          if (!quote || quote.verified !== true) return;
          const hay = searchHay(`${quote.text || ""} ${quote.work || ""}`);
          if (!hay.includes(q)) return;
          push({
            kind: "quotation",
            date,
            label,
            sittingId,
            title: quote.work || "Quotation",
            excerpt: quote.text || "",
            href
          });
        });
      });
      (((record.report && record.report.sections) || [])).forEach((section) => {
        ((section && section.stories) || []).forEach((story) => {
          const hay = searchHay(`${story.headline || ""} ${story.summary || ""}`);
          if (!hay.includes(q)) return;
          const sittingId = story.sitting_id && /^[A-Za-z0-9-]+$/.test(String(story.sitting_id)) ? String(story.sitting_id) : "";
          const storyId = /^[a-z]+-\d+$/.test(String(story.id || "")) ? String(story.id) : "";
          const hash = sittingId ? `#sitting-${sittingId}` : (storyId ? `#story-${storyId}` : "");
          push({
            kind: "story",
            date,
            label,
            sittingId,
            storyId,
            title: story.headline || "Story",
            excerpt: story.summary || "",
            href: placeUrl(date, hash)
          });
        });
      });
    });
    return results.slice(0, 40);
  }

  function isArchivedNight(entry) {
    return !!(entry && entry.archived === true);
  }

  function liveNights(nights, archiveNights) {
    const archived = new Set((archiveNights || []).map((night) => night && night.date).filter(Boolean));
    return (nights || []).filter((night) => night && night.date && !isArchivedNight(night) && !archived.has(night.date));
  }

  function archivedNights(indexNights, archiveNights) {
    const seen = new Set();
    const out = [];
    function add(night) {
      if (!night || !night.date || seen.has(night.date)) return;
      seen.add(night.date);
      out.push(night);
    }
    (archiveNights || []).forEach(add);
    (indexNights || []).filter(isArchivedNight).forEach(add);
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }

  function openableNights(indexNights, archiveNights) {
    const seen = new Set();
    const out = [];
    function add(night) {
      if (!night || !night.date || seen.has(night.date)) return;
      seen.add(night.date);
      out.push(night);
    }
    liveNights(indexNights, archiveNights).forEach(add);
    archivedNights(indexNights, archiveNights).forEach(add);
    return out;
  }

  function archiveListHtml(nights) {
    const rows = (nights || []).filter((night) => night && night.date);
    if (!rows.length) return `<p class="hint">No nights are in the archive.</p>`;
    return `<ul class="archive-list">${rows.map((night) => `<li><a class="tap-target" href="${escapeAttr(nightUrl(night.date))}">${escapeText(night.label || night.date)}</a></li>`).join("")}</ul>`;
  }

  function chairKey(name) {
    return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function nameTokens(name) {
    const full = String(name || "").trim().replace(/\s+/g, " ");
    if (!full) return [];
    const titles = new Set(["pope", "saint", "st", "dr"]);
    const stop = new Set(["jr", "sr", "ii", "iii", "iv", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "of", "the", "de", "van", "von", "la"]);
    const significant = full.split(" ").filter((part) => {
      const key = part.toLowerCase().replace(/\./g, "");
      return !stop.has(key) && !titles.has(key) && key.length >= 3;
    });
    const tokens = [full];
    if (significant.length) tokens.push(significant[significant.length - 1]);
    return tokens;
  }

  function splitGroups(split, names) {
    const catalog = distinctChairs(names).map((name) => ({ name, tokens: nameTokens(name) }));
    const tokenCounts = {};
    catalog.forEach((entry) => {
      entry.tokens.forEach((token) => {
        const key = token.toLowerCase();
        tokenCounts[key] = (tokenCounts[key] || 0) + 1;
      });
    });
    const usable = catalog.map((entry) => ({
      name: entry.name,
      tokens: entry.tokens.filter((token, index) => index === 0 || tokenCounts[token.toLowerCase()] === 1)
    }));
    return String(split || "").split(";").map((clause) => {
      const found = [];
      usable.forEach((entry) => {
        const hit = entry.tokens.some((token) => {
          const re = new RegExp(`(?:^|[^A-Za-zÀ-ÿ])${escapeRegExp(token)}(?![A-Za-zÀ-ÿ])`, "i");
          return re.test(clause);
        });
        if (hit) found.push(entry.name);
      });
      return found;
    }).filter((group) => group.length);
  }

  function chairUrl(name) {
    return `docket.html?chair=${encodeURIComponent(String(name || "").trim())}`;
  }

  function chairQuery(location) {
    const params = new URLSearchParams((location && location.search) || "");
    const value = params.get("chair");
    return value ? value.trim() : "";
  }

  function bumpPair(table, aName, bName) {
    const a = chairKey(aName);
    const b = chairKey(bName);
    if (!a || !b || a === b) return;
    table[a] = table[a] || {};
    if (!table[a][b]) table[a][b] = { name: bName, count: 0 };
    table[a][b].count += 1;
    table[a][b].name = bName;
  }

  function chairRelations(appearances, agreementRows) {
    const agreedIds = new Set((agreementRows || []).map((row) => (row && row.id != null ? String(row.id) : "")).filter(Boolean));
    const agree = {};
    const disagree = {};
    (appearances || []).forEach((item) => {
      if (!item || !agreedIds.has(String(item.id))) return;
      const names = distinctChairs(item.chairs);
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          bumpPair(agree, names[i], names[j]);
          bumpPair(agree, names[j], names[i]);
        }
      }
      const groups = splitGroups(item.split, names);
      const seen = {};
      groups.forEach((group) => {
        group.forEach((name) => {
          const key = chairKey(name);
          seen[key] = (seen[key] || 0) + 1;
        });
      });
      const clean = groups.map((group) => group.filter((name) => seen[chairKey(name)] === 1));
      for (let i = 0; i < clean.length; i++) {
        for (let j = i + 1; j < clean.length; j++) {
          clean[i].forEach((left) => {
            clean[j].forEach((right) => {
              bumpPair(disagree, left, right);
              bumpPair(disagree, right, left);
            });
          });
        }
      }
    });
    return { agree, disagree };
  }

  function topRelations(map, name, limit) {
    const row = (map && map[chairKey(name)]) || {};
    return Object.keys(row).map((key) => row[key]).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.name).localeCompare(String(b.name));
    }).slice(0, limit || 5);
  }

  function quoteSourceUrl(quote) {
    if (!quote || quote.verified !== true) return "";
    const exact = httpUrl(quote.passage_url);
    if (exact) return exact;
    return httpUrl(quote.source_url);
  }

  function quoteCitationHtml(quote) {
    if (!quote || quote.verified !== true) return "";
    const body = `<span class="cite-work">${escapeText(quote.work)}</span><span class="loc">, ${escapeText(quote.location)}</span>`;
    const href = quoteSourceUrl(quote);
    const archived = httpUrl(quote && quote.archived);
    const arch = archived
      ? ` <a class="tap-target source-archived" href="${escapeAttr(archived)}" target="_blank" rel="noopener">archived</a>`
      : "";
    if (!href) return `<li>${body}${arch}</li>`;
    return `<li><a class="tap-target original-link" href="${escapeAttr(href)}" target="_blank" rel="noopener">${body}<span class="original-label">Read in the original</span></a>${arch}</li>`;
  }

  function chairPage(name, records, agreementRows) {
    const key = chairKey(name);
    if (!key) return null;
    const sittings = [];
    const quotes = [];
    const appearances = [];
    const profile = { name: "", rosterId: "", years: "", tradition: "" };
    (records || []).forEach((record) => {
      const night = record && record.night;
      if (!record || !record.date || !night) return;
      (night.sittings || []).forEach((sitting) => {
        const chairs = sitting.chairs || [];
        appearances.push({
          id: `${record.date}/${sitting.id}`,
          chairs: chairs.map((chair) => chair && chair.name),
          split: (sitting.briefing && sitting.briefing.split) || ""
        });
        const match = chairs.find((chair) => chairKey(chair && chair.name) === key);
        if (!match) return;
        if (!profile.name) profile.name = String(match.name).trim();
        if (!profile.rosterId && match.roster_id) profile.rosterId = String(match.roster_id);
        if (!profile.years && match.years) profile.years = String(match.years);
        if (!profile.tradition && match.tradition) profile.tradition = String(match.tradition);
        const sittingId = sitting.id && /^[A-Za-z0-9-]+$/.test(String(sitting.id)) ? String(sitting.id) : "";
        const href = placeUrl(record.date, sittingId ? `#sitting-${sittingId}` : "");
        sittings.push({
          date: record.date,
          label: record.label || night.date_long || record.date,
          id: sittingId,
          section: sitting.section || "",
          headline: sitting.headline || sitting.question || "",
          href
        });
        if (match.paraphrase_only) return;
        (match.quotes || []).forEach((quote) => {
          if (!quote || quote.verified !== true) return;
          quotes.push(Object.assign({}, quote, {
            label: record.label || night.date_long || record.date,
            href
          }));
        });
      });
    });
    if (!profile.name) return null;
    const relations = chairRelations(appearances, agreementRows);
    return {
      name: profile.name,
      rosterId: profile.rosterId,
      years: profile.years,
      tradition: profile.tradition,
      sittings,
      quotes,
      agrees: topRelations(relations.agree, profile.name, 5),
      disagrees: topRelations(relations.disagree, profile.name, 5)
    };
  }

  function relationListHtml(rows, kind) {
    if (!rows || !rows.length) return "";
    return `<ul class="chair-relations">${rows.map((row) => {
      const count = Number(row.count) || 0;
      const label = kind === "agree"
        ? `${count} shared agreement${count === 1 ? "" : "s"}`
        : `${count} split${count === 1 ? "" : "s"}`;
      return `<li><a class="tap-target" href="${escapeAttr(chairUrl(row.name))}">${escapeText(row.name)}</a> <span class="meta">${escapeText(label)}</span></li>`;
    }).join("")}</ul>`;
  }

  function chairPageHtml(page) {
    if (!page) {
      return `<h2>Not on a live night</h2><p class="err" role="alert">This chair has no sitting on the live nights.</p>`;
    }
    const meta = [page.tradition, page.years].filter(Boolean).join(" · ");
    const shelf = page.rosterId
      ? `<p class="hint"><a class="shelf-link tap-target" href="index.html#thinker=${escapeAttr(page.rosterId)}">On the shelf</a></p>`
      : "";
    const sittingList = page.sittings.length
      ? `<ul class="chair-sittings">${page.sittings.map((sitting) => `<li><a class="tap-target" href="${escapeAttr(sitting.href)}"><span class="kicker">${escapeText(sitting.label)}${sitting.section ? ` · ${escapeText(sitting.section)}` : ""}</span><strong>${escapeText(sitting.headline || sitting.id)}</strong></a></li>`).join("")}</ul>`
      : `<p class="hint">No sittings on the live nights.</p>`;
    const quoteList = page.quotes.length
      ? `<ol class="chair-quotes">${page.quotes.map((quote) => {
          const cite = quoteCitationHtml(quote);
          return `<li class="chair-quote"><q class="vq">${escapeText(quote.text)}</q><p class="meta"><a class="tap-target" href="${escapeAttr(quote.href)}">${escapeText(quote.label || "")}</a></p>${cite ? `<ol class="cites">${cite}</ol>` : ""}</li>`;
        }).join("")}</ol>`
      : `<p class="hint">No verified quotation on the live nights.</p>`;
    const agrees = relationListHtml(page.agrees, "agree") || `<p class="hint">No other chair shares a recorded agreement on the live nights.</p>`;
    const disagrees = relationListHtml(page.disagrees, "disagree") || `<p class="hint">No recorded split on those agreements names another chair.</p>`;
    return `<h2>${escapeText(page.name)}</h2>
      ${meta ? `<p class="kicker">${escapeText(meta)}</p>` : ""}
      ${shelf}
      <section class="chair-block"><h3>Sittings</h3>${sittingList}</section>
      <section class="chair-block"><h3>Verified quotations</h3>${quoteList}</section>
      <section class="chair-block"><h3>Agrees most often with</h3>${agrees}</section>
      <section class="chair-block"><h3>Disagrees most often with</h3>${disagrees}</section>`;
  }

  function searchKindLabel(kind) {
    if (kind === "thinker") return "Thinker";
    if (kind === "story") return "Story";
    return "Quotation";
  }

  function searchResultHtml(results) {
    const rows = results || [];
    if (!rows.length) return "";
    return `<ul class="docket-search-results">${rows.map((row) => `<li><a href="${escapeAttr(row.href)}"><span class="kicker">${escapeText(searchKindLabel(row.kind))} · ${escapeText(row.label || row.date)}</span><strong>${escapeText(row.title)}</strong><span class="meta">${escapeText(clipText(row.excerpt, 180))}</span></a></li>`).join("")}</ul>`;
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
    decodeEntities, escapeText, escapeAttr, sanitizeParagraph, plainModern, nightQuery, nightFromLocation, portraitPath, nightUrl, placeUrl,
    httpUrl, sideLabel, noteParts, externalLink, sourceItemHtml, reportStoryHtml, reportHtml, storyIdForSitting,
    READ_STORAGE_KEY, parseReadState, isNightRead, withNightRead, unreadCount, unreadHint, nightMenuLabel, loadReadMap, saveReadMap,
    distinctChairs, discussionsFromNight, agreementTallies, agreementLabel,
    clipText, searchNights, searchResultHtml,
    chairKey, splitGroups, chairUrl, chairQuery, chairRelations, topRelations, chairPage, chairPageHtml, quoteSourceUrl, quoteCitationHtml,
    isArchivedNight, liveNights, archivedNights, openableNights, archiveListHtml
  };
});
