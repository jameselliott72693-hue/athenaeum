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

  return { decodeEntities, escapeText, sanitizeParagraph, plainModern, nightFromLocation, nightUrl };
});
