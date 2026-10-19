(function (root) {
  const DB_NAME = "athenaeum";
  const VERSION = 1;
  const STORES = ["sittings", "seatings", "bookmarks"];

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function withStore(name, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const pending = fn(tx.objectStore(name));
      tx.oncomplete = () => { Promise.resolve(pending).then(resolve, reject); };
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    }));
  }

  function all(name) {
    return withStore(name, "readonly", (store) => request(store.getAll()));
  }

  function put(name, record) {
    return withStore(name, "readwrite", (store) => request(store.put(record)));
  }

  function remove(name, id) {
    return withStore(name, "readwrite", (store) => request(store.delete(id)));
  }

  async function dump() {
    const [sittings, seatings, bookmarks] = await Promise.all(STORES.map(all));
    return { version: 1, sittings, seatings, bookmarks };
  }

  async function merge(data) {
    const added = { sittings: 0, seatings: 0, bookmarks: 0 };
    for (const name of STORES) {
      const rows = Array.isArray(data && data[name]) ? data[name] : [];
      const have = new Set((await all(name)).map((row) => row.id));
      for (const row of rows) {
        if (!row || !row.id || have.has(row.id)) continue;
        await put(name, row);
        added[name] += 1;
      }
    }
    return added;
  }

  root.AthenaeumStore = { all, put, remove, dump, merge };
})(window);
