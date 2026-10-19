(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumStem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STOP = new Set("a an the of to and or in on for with by from that this it is be as at into over than not no its his her their our your should would could may might must will shall about against under between what who when where which how ever they them take ask whether have has been was were are you we he she i my me our but if so do did does done than then there here such only also can cannot upon these those those very much many more most other another each both few all any some one two three four five six seven eight nine ten".split(" "));

  function stem(word) {
    let w = String(word || "").toLowerCase();
    if (w.length < 3) return w;
    w = w.replace(/'s$/, "").replace(/s$/, function (all, offset, src) {
      return src.length > 4 ? "" : all;
    });
    w = w.replace(/(ational|tional|enci|anci|izer|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti)$/, function (m) {
      if (m === "ational" || m === "tional" || m === "ation") return "ate";
      if (m === "enci" || m === "anci") return "ence";
      if (m === "izer") return "ize";
      if (m === "ator") return "ate";
      if (m === "alism" || m === "aliti") return "al";
      if (m === "iveness" || m === "iviti") return "ive";
      if (m === "fulness") return "ful";
      if (m === "ousness") return "ous";
      if (m === "biliti") return "ble";
      return m;
    });
    w = w.replace(/(icate|ative|alize|iciti|ical|ful|ness)$/, function (m) {
      if (m === "icate" || m === "iciti") return "ic";
      if (m === "ative") return "";
      if (m === "alize") return "al";
      if (m === "ical") return "ic";
      if (m === "ful" || m === "ness") return "";
      return m;
    });
    w = w.replace(/(ing|edly|edly|edly)$/, "");
    if (w.length > 5) w = w.replace(/(ed|ly|es|er)$/, "");
    if (w.length > 4 && w.endsWith("y")) w = w.slice(0, -1) + "i";
    return w.length >= 2 ? w : word.toLowerCase();
  }

  function tokenize(text) {
    const raw = String(text || "").toLowerCase().match(/[a-z]{3,}/g) || [];
    const out = [];
    raw.forEach((word) => {
      if (STOP.has(word)) return;
      const stemmed = stem(word);
      if (stemmed && stemmed.length >= 2 && !STOP.has(stemmed)) out.push(stemmed);
    });
    return out;
  }

  return { stem, tokenize, STOP };
});
