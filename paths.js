(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumPaths = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const KEY = "athenaeum.paths";

  function paragraphContaining(text, needle) {
    if (!text || !needle) return null;
    const parts = String(text).split(/\n\n/);
    return parts.find((part) => part.indexOf(needle) !== -1) || null;
  }

  function pathForTable(catalog, tableId) {
    const paths = (catalog && catalog.paths) || [];
    return paths.find((path) => path.tableId === tableId) || null;
  }

  function blank() {
    return { read: {}, current: {} };
  }

  function loadProgress(storage) {
    try {
      const raw = storage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== "object") return blank();
      return {
        read: data.read && typeof data.read === "object" ? data.read : {},
        current: data.current && typeof data.current === "object" ? data.current : {}
      };
    } catch (err) {
      return blank();
    }
  }

  function saveProgress(storage, progress) {
    const next = {
      v: 1,
      read: (progress && progress.read) || {},
      current: (progress && progress.current) || {}
    };
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function isRead(progress, pathId, stopId) {
    return !!(progress && progress.read && progress.read[pathId] && progress.read[pathId][stopId]);
  }

  function markRead(progress, pathId, stopId) {
    const read = Object.assign({}, (progress && progress.read) || {});
    read[pathId] = Object.assign({}, read[pathId] || {}, { [stopId]: true });
    const current = Object.assign({}, (progress && progress.current) || {}, { [pathId]: stopId });
    return { read, current };
  }

  function setCurrent(progress, pathId, stopId) {
    const current = Object.assign({}, (progress && progress.current) || {}, { [pathId]: stopId });
    return { read: (progress && progress.read) || {}, current };
  }

  return { KEY, paragraphContaining, pathForTable, loadProgress, saveProgress, isRead, markRead, setCurrent };
});
