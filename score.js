(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Athenaeum = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STOP = new Set("a an the of to and or in on for with by from that this it is be as at into over than not no its his her their our your should would could may might must will shall about against under between what who when where which how ever they them take ask whether have has been was were are into".split(" "));
  const GENERIC = new Set("importance shared society social people human moral compass good life man men city state thing things make made public order common just only really very more most such into from with this that have been".split(" "));

  function wordsOf(text) {
    return [...new Set(String(text || "").toLowerCase().match(/[a-z]{4,}/g) || [])].filter((w) => !STOP.has(w));
  }

  function distinctive(text) {
    return wordsOf(text).filter((w) => !GENERIC.has(w));
  }

  function wordIn(blob, word) {
    return new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(String(blob || "").toLowerCase());
  }

  function subjectTopics(text, rel) {
    const found = [];
    const lexicon = (rel && rel.lexicon) || {};
    Object.keys(lexicon).forEach((topic) => {
      const keys = lexicon[topic] || [];
      if (keys.some((key) => wordIn(text, key))) found.push(topic);
    });
    return found;
  }

  function scoreEntry(entry, text, rel) {
    const blob = `${entry.claim || ""} ${entry.bears || ""}`;
    const lexical = distinctive(text).filter((w) => wordIn(blob, w));
    const wanted = subjectTopics(text, rel);
    const hitTopics = (entry.topics || []).filter((t) => wanted.includes(t));
    const score = hitTopics.length * rel.topicWeight + lexical.length * rel.lexicalWeight;
    return { score, hitTopics, lexical };
  }

  function tierOf(score, rel) {
    if (score >= rel.highMin) return "high";
    if (score <= rel.lowMax) return "low";
    return "mid";
  }

  function scoreThinker(thinker, text, rel) {
    const idle = String(text || "").trim().length < 3;
    if (idle) {
      return { idle: true, score: 0, speaks: false, tier: null, hits: 0, matches: [], topics: [] };
    }
    const scored = (thinker.entries || []).map((entry) => ({ entry, ...scoreEntry(entry, text, rel) }));
    scored.sort((a, b) => b.score - a.score || b.lexical.length - a.lexical.length || Number(!!b.entry.verbatim) - Number(!!a.entry.verbatim));
    const matches = scored.filter((s) => s.score > 0);
    const score = matches.reduce((n, s) => n + s.score, 0);
    return {
      idle: false,
      score,
      speaks: score >= rel.speakMin && matches.length > 0,
      tier: tierOf(score, rel),
      hits: matches.length,
      matches,
      topics: subjectTopics(text, rel)
    };
  }

  function shuffle(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  }

  function memberOf(thinker, tableId) {
    if (Array.isArray(thinker.tables) && thinker.tables.length) return thinker.tables.includes(tableId);
    return thinker.tableId === tableId;
  }

  function chooseRandom(opts) {
    const tables = opts.tables || [];
    const thinkers = opts.thinkers || [];
    const rng = opts.rng || Math.random;
    const rel = opts.relevance;
    const poolTables = opts.traditionId === "any" ? tables.slice() : tables.filter((t) => t.id === opts.traditionId);
    if (!poolTables.length) return { ok: false, message: "Choose a tradition." };
    const table = poolTables[Math.floor(rng() * poolTables.length)];
    const limits = table.limits;
    let size = Number(opts.size);
    if (!Number.isFinite(size)) size = limits.defaultCount;
    size = Math.round(size);
    if (size < limits.min || size > limits.hardMax) {
      return { ok: false, message: `Choose a panel from ${limits.min} to ${limits.hardMax}.` };
    }
    let pool = thinkers.filter((t) => memberOf(t, table.id));
    if (opts.onlyRelevant) {
      if (String(opts.subject || "").trim().length < 3) {
        return { ok: false, message: "Enter a subject before limiting the draw to chairs who have written on it." };
      }
      pool = pool.filter((t) => scoreThinker(t, opts.subject, rel).speaks);
    }
    if (pool.length < limits.min) {
      return {
        ok: false,
        message: opts.onlyRelevant
          ? `Fewer than ${limits.min} chairs in ${table.name} have written on this. Leave the limit off, or change the subject.`
          : `${table.name} does not have ${limits.min} chairs.`
      };
    }
    const count = Math.min(size, pool.length);
    const ids = shuffle(pool.map((t) => t.id), rng).slice(0, count);
    const note = count < size
      ? `${table.name} has ${pool.length} chairs for this draw, so the panel is ${count}, not ${size}.`
      : "";
    return { ok: true, ids, table, note };
  }

  return { wordsOf, subjectTopics, scoreEntry, scoreThinker, tierOf, chooseRandom, shuffle, memberOf };
});
