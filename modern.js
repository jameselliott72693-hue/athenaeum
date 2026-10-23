(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumModern = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LEAD = /^A summary, not a quotation\.\s*/i;
  const SWAPS = [
    [/\bthou\b/gi, "you"],
    [/\bthee\b/gi, "you"],
    [/\bye\b/gi, "you"],
    [/\bthy\b/gi, "your"],
    [/\bhath\b/gi, "has"],
    [/\bdoth\b/gi, "does"],
    [/\bunto\b/gi, "to"],
    [/\bwhilst\b/gi, "while"],
    [/\bamongst\b/gi, "among"]
  ];

  function plain(text) {
    return String(text || "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”«»]/g, "")
      .replace(/"/g, "")
      .replace(/(^|[^A-Za-z0-9])'|'(?![A-Za-z0-9])/g, "$1")
      .replace(/;--/g, ",")
      .replace(/--/g, ",")
      .replace(/[—–]/g, ",")
      .replace(/\u2026/g, ". ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function swapArchaic(text) {
    let out = text;
    SWAPS.forEach(([pattern, word]) => {
      out = out.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word));
    });
    return out;
  }

  function tidySentence(sentence) {
    const mark = /[!?]$/.test(sentence) ? sentence.slice(-1) : ".";
    let t = String(sentence || "").replace(/[.!?]+$/, "").replace(/^[,\s;:]+/, "").replace(/[,\s;:]+$/, "").trim();
    if (!t) return "";
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t + mark;
  }

  function isAbbreviation(buf) {
    return /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|No|Vol|Bk|ch|cf|e\.g|i\.e)\.$/i.test(buf);
  }

  function splitSentences(text) {
    const clean = text.trim();
    if (!clean) return [];
    const parts = [];
    let buf = "";
    for (let i = 0; i < clean.length; i += 1) {
      const ch = clean[i];
      buf += ch;
      if (ch !== "." && ch !== "!" && ch !== "?") continue;
      const next = clean[i + 1];
      if (next != null && !/\s/.test(next)) continue;
      if (ch === "." && isAbbreviation(buf)) continue;
      if (ch === "." && /\d\.$/.test(buf) && /\d/.test(clean[i + 2] || "")) continue;
      const sentence = buf.trim();
      if (sentence) parts.push(sentence);
      buf = "";
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  }

  function pieces(text) {
    const clean = swapArchaic(plain(String(text || "").replace(LEAD, "")));
    return splitSentences(clean).map(tidySentence).filter(Boolean);
  }

  function keyOf(sentence) {
    return sentence.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function take(list, picked, seen, limit) {
    list.forEach((sentence) => {
      if (picked.length >= limit) return;
      const key = keyOf(sentence);
      if (!key || seen.has(key)) return;
      seen.add(key);
      picked.push(sentence);
    });
  }

  function compose(claim, bears) {
    const claimParts = pieces(claim);
    const bearParts = pieces(bears);
    const picked = [];
    const seen = new Set();
    take(claimParts, picked, seen, 2);
    take(bearParts, picked, seen, 3);
    if (!picked.length) take(claimParts, picked, seen, 3);
    return picked.slice(0, 3).join(" ").replace(/[“”"]/g, "").trim();
  }

  function forEntry(entry) {
    if (!entry) return "";
    const stored = entry.modern != null ? String(entry.modern).trim() : "";
    if (stored) return stored;
    return compose(entry.claim, entry.bears);
  }

  function forTurn(turn) {
    if (!turn || turn.kind === "abstain" || turn.kind === "silence" || turn.kind === "moderator") return "";
    const supplied = turn.modern != null ? String(turn.modern).trim() : "";
    if (supplied) return supplied;
    const picked = [];
    const seen = new Set();
    (turn.cards || []).forEach((card) => {
      splitSentences(forEntry(card)).forEach((sentence) => {
        if (picked.length >= 3) return;
        const done = tidySentence(sentence);
        const key = keyOf(done);
        if (!key || seen.has(key)) return;
        seen.add(key);
        picked.push(done);
      });
    });
    return picked.slice(0, 3).join(" ").replace(/[“”"]/g, "").trim();
  }

  return { compose, forEntry, forTurn };
});
