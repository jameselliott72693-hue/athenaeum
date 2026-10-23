(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumLines = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function startYear(years) {
    const text = String(years || "");
    const century = text.match(/(\d+)(?:st|nd|rd|th)\s+century/i);
    let year = null;
    if (century) year = Number(century[1]) * 100 - 50;
    else {
      const found = text.match(/(\d{1,4})/);
      year = found ? Number(found[1]) : null;
    }
    if (year == null) return 0;
    if (/BC|BCE/i.test(text)) return -year;
    return year;
  }

  function order(thinkers) {
    return (thinkers || []).slice().sort((a, b) => startYear(a.years) - startYear(b.years) || String(a.name).localeCompare(String(b.name)));
  }

  function edgesFor(catalog, tableId) {
    return ((catalog && catalog.edges) || []).filter((edge) => edge.tableId === tableId);
  }

  function edgesAmong(catalog, ids) {
    const have = new Set(ids || []);
    const seen = new Set();
    return ((catalog && catalog.edges) || []).filter((edge) => {
      if (!have.has(edge.from) || !have.has(edge.to)) return false;
      const key = `${edge.from}>${edge.to}:${edge.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function layout(ids) {
    const cols = ids.length > 6 ? 3 : 2;
    const colW = 160;
    const rowH = 64;
    return ids.map((id, index) => ({
      id,
      x: 16 + (index % cols) * colW,
      y: 22 + Math.floor(index / cols) * rowH
    }));
  }

  function frame(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      width: Math.max(280, Math.max(...xs, 0) + 150),
      height: Math.max(48, Math.max(...ys, 0) + 28)
    };
  }

  return { startYear, order, edgesFor, edgesAmong, layout, frame };
});
