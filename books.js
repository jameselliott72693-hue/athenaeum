(function (root, factory) {
  const stemApi = (typeof module === "object" && module.exports && typeof require === "function")
    ? require("./stem.js")
    : root.AthenaeumStem;
  const api = factory(stemApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumBooks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Stem) {
  const K1 = 1.2;
  const B = 0.75;
  const library = { indexes: {}, texts: {} };

  function wordIn(blob, word) {
    return new RegExp("\\b" + String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(String(blob || ""));
  }

  function subjectTopics(text, rel) {
    const found = [];
    const lexicon = (rel && rel.lexicon) || {};
    Object.keys(lexicon).forEach((topic) => {
      if ((lexicon[topic] || []).some((key) => wordIn(text, key))) found.push(topic);
    });
    return found;
  }

  function topicsIn(text, rel) {
    return subjectTopics(text, rel);
  }

  function tierOf(score, rel) {
    if (score >= rel.highMin) return "high";
    if (score <= rel.lowMax) return "low";
    return "mid";
  }

  function queryPlan(query, rel) {
    const primary = {};
    (Stem.tokenize(query) || []).forEach((term) => { primary[term] = 1; });
    const topics = subjectTopics(query, rel);
    const extra = {};
    const lexicon = (rel && rel.lexicon) || {};
    topics.forEach((topic) => {
      (lexicon[topic] || []).forEach((key) => {
        (Stem.tokenize(key) || []).forEach((term) => {
          if (!primary[term]) extra[term] = 0.35;
        });
      });
    });
    return { primary, extra, topics };
  }

  function bm25(index, plan) {
    const N = index.N || 0;
    const avgdl = index.avgdl || 1;
    const acc = new Map();
    function add(term, weight) {
      const post = index.postings && index.postings[term];
      if (!post || !weight) return;
      const df = post.length;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      post.forEach((pair) => {
        const pi = pair[0];
        const tf = pair[1];
        const len = (index.dl && index.dl[pi]) || 1;
        const denom = tf + K1 * (1 - B + B * len / avgdl);
        const inc = idf * ((tf * (K1 + 1)) / denom) * weight;
        acc.set(pi, (acc.get(pi) || 0) + inc);
      });
    }
    Object.keys(plan.primary).forEach((term) => add(term, plan.primary[term]));
    Object.keys(plan.extra).forEach((term) => add(term, plan.extra[term]));
    return acc;
  }

  function passageScore(bm, hitTopics, rel) {
    const weight = (rel && rel.topicWeight) || 4;
    return hitTopics.length * weight + Math.min(12, bm * 2);
  }

  function rank(index, texts, query, rel, limit) {
    if (!index || !query || String(query).trim().length < 3) return [];
    const plan = queryPlan(query, rel);
    if (!Object.keys(plan.primary).length && !Object.keys(plan.extra).length) return [];
    const raw = bm25(index, plan);
    const ranked = [...raw.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, Math.max(limit * 4, 24));
    const rows = [];
    ranked.forEach((pair) => {
      const pi = pair[0];
      const bm = pair[1];
      const passage = index.passages[pi];
      const book = index.books[passage.book];
      const file = texts[passage.book] || "";
      const claim = file.slice(passage.start, passage.end);
      if (!claim) return;
      const found = topicsIn(claim, rel);
      const hitTopics = found.filter((topic) => plan.topics.includes(topic));
      const score = passageScore(bm, hitTopics, rel);
      if (score <= 0) return;
      rows.push({
        pi,
        bm,
        score,
        hitTopics,
        entry: {
          fromText: true,
          verbatim: true,
          press: "qualifies",
          topics: found,
          claim,
          bears: "",
          work: book.title,
          loc: passage.loc,
          url: book.url,
          passageId: passage.id,
          bookId: book.id,
          thinkerId: index.thinkerId
        }
      });
    });
    rows.sort((a, b) => b.score - a.score || a.entry.passageId.localeCompare(b.entry.passageId));
    return rows.slice(0, limit);
  }

  function mergeScore(card, passageRows, rel) {
    if (!card || card.idle) return card;
    const passageMatches = (passageRows || []).filter((row) => row && row.entry && row.score > 0).map((row) => ({
      entry: row.entry,
      score: row.score,
      lexical: [],
      hitTopics: row.hitTopics || [],
      fromText: true
    }));
    const matches = (card.matches || []).concat(passageMatches).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const af = a.entry && a.entry.fromText ? 1 : 0;
      const bf = b.entry && b.entry.fromText ? 1 : 0;
      if (af !== bf) return af - bf;
      return String((a.entry && a.entry.loc) || "").localeCompare(String((b.entry && b.entry.loc) || ""));
    });
    const extra = passageMatches.map((row) => row.score).sort((a, b) => b - a).slice(0, 2).reduce((n, score) => n + score, 0);
    const score = card.score + extra;
    return {
      idle: false,
      score,
      speaks: score >= rel.speakMin && matches.length > 0,
      tier: tierOf(score, rel),
      hits: matches.length,
      matches,
      topics: card.topics || []
    };
  }

  function textsOf(index) {
    if (!index) return [];
    return index.books.map((book) => library.texts[book.file] || "");
  }

  function ready(id) {
    const index = library.indexes[id];
    if (index === null) return true;
    if (!index) return false;
    return index.books.every((book) => library.texts[book.file] != null);
  }

  async function catalog(fetchFn) {
    if (library.manifest) return library.manifest;
    const res = await fetchFn("data/books/manifest.json");
    library.manifest = res.ok ? await res.json() : { books: [] };
    library.searchable = new Set((library.manifest.books || []).map((book) => book.thinkerId));
    return library.manifest;
  }

  async function ensure(ids, fetchImpl) {
    const fetchFn = fetchImpl || (typeof fetch === "function" ? fetch : null);
    await catalog(fetchFn);
    const wanted = [...new Set(ids || [])];
    wanted.forEach((id) => {
      if (!library.searchable.has(id)) library.indexes[id] = null;
    });
    await Promise.all(wanted.filter((id) => library.searchable.has(id)).map(async (id) => {
      if (Object.prototype.hasOwnProperty.call(library.indexes, id)) return;
      const res = await fetchFn(`data/books/index/${id}.json`);
      if (!res.ok) {
        library.indexes[id] = null;
        return;
      }
      const index = await res.json();
      library.indexes[id] = index;
      await Promise.all(index.books.map(async (book) => {
        if (library.texts[book.file] != null) return;
        const textRes = await fetchFn(book.file);
        library.texts[book.file] = textRes.ok ? await textRes.text() : "";
      }));
    }));
  }

  function rankedEntries(id, query, rel, limit) {
    const index = library.indexes[id];
    if (!index) return [];
    return rank(index, textsOf(index), query, rel, limit || 8);
  }

  function contextOf(id, passageId) {
    const index = library.indexes[id];
    if (!index) return [];
    const pi = index.passages.findIndex((passage) => passage.id === passageId);
    if (pi < 0) return [];
    const bookIndex = index.passages[pi].book;
    const texts = textsOf(index);
    const neighbors = [];
    for (let i = pi - 1; i >= 0 && neighbors.length < 1; i -= 1) {
      if (index.passages[i].book === bookIndex) neighbors.unshift(i);
    }
    neighbors.push(pi);
    for (let i = pi + 1; i < index.passages.length && neighbors.length < 3; i += 1) {
      if (index.passages[i].book === bookIndex) neighbors.push(i);
    }
    return neighbors.map((i) => {
      const passage = index.passages[i];
      return {
        loc: passage.loc,
        text: texts[bookIndex].slice(passage.start, passage.end),
        current: i === pi,
        passageId: passage.id
      };
    });
  }

  function readThinker(root, thinkerId) {
    const fs = require("fs");
    const path = require("path");
    const file = path.join(root, "data", "books", "index", thinkerId + ".json");
    if (!fs.existsSync(file)) return null;
    const index = JSON.parse(fs.readFileSync(file, "utf8"));
    const texts = index.books.map((book) => fs.readFileSync(path.join(root, book.file), "utf8"));
    return { index, texts };
  }

  function install(id, index, texts) {
    library.indexes[id] = index;
    if (index && index.books) {
      index.books.forEach((book, i) => { library.texts[book.file] = texts[i]; });
    }
  }

  return {
    rank,
    mergeScore,
    ensure,
    ready,
    rankedEntries,
    contextOf,
    readThinker,
    install,
    subjectTopics,
    library
  };
});
