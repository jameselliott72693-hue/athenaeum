(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumEncounters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const TYPES = ["film", "song", "poem"];
  const TYPE_LABELS = { film: "Films", song: "Songs", poem: "Poems" };
  const THEMES = [
    { id: "justice", label: "Justice", blurb: "What is owed, who may judge, and whether a procedure can be fair." },
    { id: "mortality", label: "Mortality", blurb: "Death, grief, and what a finite life asks of the living." },
    { id: "freedom-order", label: "Freedom and order", blurb: "Liberty against the peace that hems it in." },
    { id: "faith-doubt", label: "Faith and doubt", blurb: "Belief, unbelief, and the God a person can or cannot answer." },
    { id: "duty", label: "Duty", blurb: "What office, family, or a vow requires when it costs." },
    { id: "love", label: "Love", blurb: "Attachment, marriage, friendship, and the claims of the heart." },
    { id: "truth", label: "Truth and lying", blurb: "What may be said, what is hidden, and whether a lie can serve a good." },
    { id: "power", label: "Power and corruption", blurb: "Rule, force, and the way power bends the people who hold it." },
    { id: "mercy", label: "Mercy", blurb: "Forgiveness, sparing, and whether punishment is the last word." },
    { id: "good-life", label: "The good life", blurb: "What a life is for, beyond winning or being safe." },
    { id: "dignity", label: "Human dignity", blurb: "The worth of a person that no office and no market invented." },
    { id: "exile", label: "Exile and home", blurb: "Leaving, belonging, and the place a person is trying to reach." },
    { id: "conscience", label: "Conscience", blurb: "The private refusal that will not sign what the room has agreed." }
  ];
  const THEME_IDS = THEMES.map((theme) => theme.id);
  const RULES = [
    { id: "mercy", re: /\b(mercy|merciful|forgiv\w*|repent\w*|compassion|charity|grace|heal(?:ing|ed|s)?|kindness)\b/gi },
    { id: "mortality", re: /\b(death|die|dying|dead|mortal\w*|finitude|grief|mourn\w*|murder\w*|killing|killed)\b/gi },
    { id: "faith-doubt", re: /\b(faith|god'?s|god|church|christ|worship|prayer|religion|religious|sacred|believer|pastor|communion|creed|secular|devotion|bless\w*|idolatry|scripture|soul)\b/gi },
    { id: "freedom-order", re: /\b(liberty|liberties|freedom|free speech|free expression|order|censor\w*|speech|unsayable|offen[cs]\w*|incitement|protest|dissent|plural\w*|tolerat\w*|expression|preach\w*)\b/gi },
    { id: "justice", re: /\b(justice|injustice|unjust|punish\w*|guilt\w*|innocen\w*|verdict|trial|accountab\w*|restitution|fairness|fair|legitimate|legitimacy|complicit\w*|presumption|just|law)\b/gi },
    { id: "truth", re: /\b(truth|truths|\btrue\b|lies|lying|falsely|falsehood|deception|deceiv\w*|propaganda)\b/gi },
    { id: "power", re: /\b(power|corrupt\w*|ruler|kingship|executive|\bwar\b|\bforce\b|tyrant|tyranny)\b/gi },
    { id: "dignity", re: /\b(dignity|human life|personhood|vulnerable|persecut\w*|minorit\w*|desecrat\w*|recognition|children|child)\b/gi },
    { id: "exile", re: /\b(exile|refugee|stranger|homeland|belong\w*|hospitality|immigrant|border|one people|makes a people)\b/gi },
    { id: "conscience", re: /\b(conscience|integrity|whistle)\b/gi },
    { id: "duty", re: /\b(duty|duties|\bowe[sd]?\b|obligation|responsib\w*|\boffice\b|command|servant|shepherd|parents|parental|formation)\b/gi },
    { id: "love", re: /\b(love|marriage|beloved|spouse|family|families)\b/gi },
    { id: "good-life", re: /\b(good life|flourishing|virtue|good man|adulthood|happiness|stewardship|what is art|education)\b/gi }
  ];

  function hiddenWord() {
    return String.fromCharCode(71, 114, 101, 101, 110, 115, 98, 111, 114, 111);
  }

  function stripHidden(value) {
    const word = hiddenWord();
    const lower = word.toLowerCase();
    const text = String(value == null ? "" : value);
    let out = "";
    let i = 0;
    while (i < text.length) {
      if (text.slice(i, i + word.length).toLowerCase() === lower) i += word.length;
      else { out += text[i]; i += 1; }
    }
    return out;
  }

  function escapeText(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(text) {
    return escapeText(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function httpUrl(url) {
    const text = typeof url === "string" ? url.trim() : "";
    return /^https?:\/\/\S+$/.test(text) ? text : "";
  }

  function themeById(id) {
    return THEMES.find((theme) => theme.id === id) || null;
  }

  function knownThemes(value, max) {
    const list = Array.isArray(value) ? value : [];
    const out = [];
    list.forEach((id) => {
      if (typeof id !== "string" || THEME_IDS.indexOf(id) < 0 || out.indexOf(id) >= 0) return;
      out.push(id);
    });
    return out.slice(0, max);
  }

  function cleanThemes(value) {
    return knownThemes(value, 3);
  }

  function scoreText(text) {
    const body = String(text || "");
    const scores = {};
    RULES.forEach((rule) => {
      rule.re.lastIndex = 0;
      const found = body.match(rule.re);
      if (found && found.length) scores[rule.id] = found.length;
    });
    return THEME_IDS
      .filter((id) => scores[id])
      .sort((a, b) => scores[b] - scores[a] || THEME_IDS.indexOf(a) - THEME_IDS.indexOf(b));
  }

  const FALLBACK = [
    { id: "justice", re: /\b(election|vote|votes|voters|ballot|polls|mandate|owned|taking|accusations|accusation|violence|evil)\b/i },
    { id: "truth", re: /\b(art|artist|artistic|authored|audience|reason|premises|machine|intention|poison|whitewash|joke|satire)\b/i },
    { id: "power", re: /\b(expertise|authority|violence|security|profit|crisis|stampeded|system)\b/i },
    { id: "duty", re: /\b(expertise|leadership|reckoning|steadiness|renew|memory|remembering|private life|public)\b/i },
    { id: "freedom-order", re: /\b(disagreement|common life|majority|communities|neutral|heritage)\b/i },
    { id: "dignity", re: /\b(identity|person|someone|heritage|contempt|weak|memory)\b/i },
    { id: "faith-doubt", re: /\b(gospel|christian|witness|spiritual|text)\b/i },
    { id: "mercy", re: /\b(rehabilitation|peace|weak)\b/i },
    { id: "conscience", re: /\b(conscientious|principle|prudence|private self)\b/i },
    { id: "good-life", re: /\b(art|artistic|excellence|human work)\b/i }
  ];

  function scoreFallback(text) {
    const body = String(text || "");
    const scores = {};
    FALLBACK.forEach((rule) => {
      if (rule.re.test(body)) scores[rule.id] = (scores[rule.id] || 0) + 1;
      rule.re.lastIndex = 0;
    });
    return THEME_IDS
      .filter((id) => scores[id])
      .sort((a, b) => scores[b] - scores[a] || THEME_IDS.indexOf(a) - THEME_IDS.indexOf(b));
  }

  function inferThemes(text) {
    const primary = scoreText(text);
    if (primary.length) return primary.slice(0, 3);
    return scoreFallback(text).slice(0, 3);
  }

  function themesForSitting(sitting, date, map) {
    const own = cleanThemes(sitting && sitting.themes);
    if (own.length) return own;
    const key = date && sitting && sitting.id ? `${date}/${sitting.id}` : "";
    const table = map && map.sittings && typeof map.sittings === "object" ? map.sittings : {};
    const mapped = key ? cleanThemes(table[key]) : [];
    if (mapped.length) return mapped;
    return inferThemes(sitting && (sitting.question || sitting.headline || ""));
  }

  function themesForTable(tableId, subject, map) {
    const inferred = inferThemes(subject);
    if (inferred.length) return inferred;
    const tables = map && map.tables && typeof map.tables === "object" ? map.tables : {};
    return cleanThemes(tables[tableId]);
  }

  function workOk(work) {
    if (!work || typeof work !== "object") return false;
    if (typeof work.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(work.id)) return false;
    if (TYPES.indexOf(work.type) < 0) return false;
    if (typeof work.title !== "string" || !work.title.trim()) return false;
    if (typeof work.creator !== "string" || !work.creator.trim()) return false;
    if (!Number.isInteger(work.year)) return false;
    if (typeof work.why !== "string" || !work.why.trim()) return false;
    if (!Array.isArray(work.themes) || !work.themes.length) return false;
    if (!work.themes.every((id) => THEME_IDS.indexOf(id) >= 0)) return false;
    if (!httpUrl(work.url)) return false;
    return true;
  }

  function normalizeCatalog(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const works = [];
    const seen = new Set();
    (Array.isArray(source.works) ? source.works : []).forEach((row) => {
      if (!workOk(row) || seen.has(row.id)) return;
      seen.add(row.id);
      const work = {
        id: row.id,
        type: row.type,
        title: stripHidden(row.title).trim(),
        creator: stripHidden(row.creator).trim(),
        year: row.year,
        why: stripHidden(row.why).trim(),
        themes: knownThemes(row.themes, 4),
        url: httpUrl(row.url)
      };
      if (!work.themes.length) return;
      if (row.type === "film" && typeof row.rating === "string" && row.rating.trim()) {
        work.rating = stripHidden(row.rating).trim();
      }
      if (row.type === "poem" && row.publicDomain === true && typeof row.text === "string" && row.text.trim() && httpUrl(row.sourceUrl)) {
        work.publicDomain = true;
        work.text = row.text.replace(/\r\n/g, "\n");
        work.sourceUrl = httpUrl(row.sourceUrl);
        work.sourceEdition = stripHidden(row.sourceEdition || "").trim();
      }
      works.push(work);
    });
    return { version: VERSION, themes: THEMES, works };
  }

  function worksFor(catalog, themeIds, type, limit) {
    const wanted = new Set(cleanThemes(themeIds).length ? cleanThemes(themeIds) : (Array.isArray(themeIds) ? themeIds : []));
    const works = (catalog && catalog.works) || [];
    const ranked = works.filter((work) => {
      if (type && work.type !== type) return false;
      return work.themes.some((id) => wanted.has(id));
    }).map((work) => ({
      work,
      score: work.themes.filter((id) => wanted.has(id)).length
    }));
    ranked.sort((a, b) => b.score - a.score || a.work.year - b.work.year || (a.work.id < b.work.id ? -1 : 1));
    const max = Number.isFinite(limit) ? limit : ranked.length;
    return ranked.slice(0, max).map((row) => row.work);
  }

  function externalLink(url, label) {
    const href = httpUrl(url);
    if (!href) return "";
    return `<a class="tap-target" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`;
  }

  function poemBlock(work) {
    if (work.type !== "poem" || work.publicDomain !== true || !work.text) return "";
    const edition = work.sourceEdition ? `<p class="meta">${escapeText(work.sourceEdition)}</p>` : "";
    return `<details class="poem-read">
      <summary>Read the poem</summary>
      <pre class="poem-text">${escapeText(work.text)}</pre>
      ${edition}
      <p>${externalLink(work.sourceUrl, "Source edition")}</p>
    </details>`;
  }

  function cardHtml(work, scope) {
    const bits = [work.creator, String(work.year)];
    if (work.type === "film" && work.rating) bits.push(work.rating);
    const kind = work.type === "film" ? "Film" : work.type === "song" ? "Song" : "Poem";
    const domId = scope ? `enc-${scope}-${work.id}` : `work-${work.id}`;
    return `<article class="encounter-card" id="${escapeAttr(domId)}">
      <p class="kicker">${kind}</p>
      <h4>${escapeText(work.title)}</h4>
      <p class="meta">${escapeText(bits.join(" · "))}</p>
      <p>${escapeText(work.why)}</p>
      <p>${externalLink(work.url, "Open a source")}</p>
      ${poemBlock(work)}
      <button type="button" data-encounter-save="${escapeAttr(work.id)}" aria-pressed="false">Save</button>
    </article>`;
  }

  function panelHtml(options) {
    const opts = options || {};
    const themes = cleanThemes(opts.themes);
    const catalog = opts.catalog;
    if (!themes.length || !catalog || !(catalog.works || []).length) return "";
    const scope = String(opts.scope || "panel").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "panel";
    const limit = Number.isFinite(opts.limit) ? opts.limit : 3;
    const chips = themes.map((id) => {
      const theme = themeById(id);
      return `<a class="tap-target encounter-theme" href="encounters.html#theme-${escapeAttr(id)}">${escapeText(theme ? theme.label : id)}</a>`;
    }).join("");
    const tabs = TYPES.map((type, index) => {
      const selected = index === 0;
      return `<button type="button" role="tab" id="enc-${scope}-tab-${type}" aria-controls="enc-${scope}-panel-${type}" aria-selected="${selected ? "true" : "false"}" tabindex="${selected ? "0" : "-1"}" data-encounter-tab="${type}">${TYPE_LABELS[type]}</button>`;
    }).join("");
    const panels = TYPES.map((type, index) => {
      const works = worksFor(catalog, themes, type, limit);
      const body = works.length
        ? works.map((work) => cardHtml(work, scope)).join("")
        : `<p class="empty">No ${TYPE_LABELS[type].toLowerCase()} in this set.</p>`;
      const more = `<p><a class="tap-target" href="encounters.html#theme-${escapeAttr(themes[0])}">Browse the catalog</a></p>`;
      return `<div role="tabpanel" id="enc-${scope}-panel-${type}" aria-labelledby="enc-${scope}-tab-${type}" data-encounter-panel="${type}"${index === 0 ? "" : " hidden"}>${body}${more}</div>`;
    }).join("");
    const heading = opts.heading || "Films, songs, and poems";
    const ctx = opts.context || {};
    return `<section class="encounter-panel" aria-labelledby="enc-${scope}-heading" data-encounter-scope="${escapeAttr(scope)}" data-encounter-night="${escapeAttr(ctx.night || "")}" data-encounter-sitting="${escapeAttr(ctx.sittingId || "")}" data-encounter-question="${escapeAttr(ctx.sittingTitle || "")}" data-encounter-place="${escapeAttr(ctx.place || "")}">
      <p class="kicker">Further encounters</p>
      <h3 id="enc-${scope}-heading">${escapeText(heading)}</h3>
      <p class="hint">Works that take up the same question. The note is the room's, not a line from the work. A public-domain poem may be opened here. A song or a later poem stays at the link.</p>
      <div class="encounter-themes">${chips}</div>
      <div class="encounter-tabs" role="tablist" aria-label="Films, songs, and poems">${tabs}</div>
      ${panels}
    </section>`;
  }

  function savePayload(work, context) {
    const row = workOk(work) ? work : null;
    if (!row) return null;
    const ctx = context && typeof context === "object" ? context : {};
    const place = typeof ctx.place === "string" ? ctx.place : "";
    return {
      text: row.why,
      kind: row.type,
      speaker: row.creator,
      work: row.title,
      citation: String(row.year),
      edition: row.rating || "",
      sourceUrl: row.url,
      night: ctx.night || "",
      sittingTitle: ctx.sittingTitle || "",
      sittingId: ctx.sittingId || "",
      place,
      href: `encounters.html#work-${row.id}`,
      block: `encounter:${row.id}`,
      note: ""
    };
  }

  return {
    VERSION, TYPES, TYPE_LABELS, THEMES, THEME_IDS,
    themeById, cleanThemes, inferThemes, themesForSitting, themesForTable,
    normalizeCatalog, workOk, worksFor, panelHtml, cardHtml, savePayload,
    escapeText, escapeAttr, httpUrl, stripHidden
  };
});
