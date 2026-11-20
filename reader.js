(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumReader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 1;
  const STORAGE_KEY = "athenaeum.reader";
  const UNSORTED = "unsorted";
  const COLORS = [
    { id: "amber", label: "Amber" },
    { id: "rose", label: "Rose" },
    { id: "sage", label: "Sage" },
    { id: "sky", label: "Sky" },
    { id: "lilac", label: "Lilac" }
  ];
  const COLOR_IDS = COLORS.map((row) => row.id);
  const SORTS = [
    { id: "manual", label: "Manual order" },
    { id: "name", label: "Name" },
    { id: "saved", label: "Date saved" },
    { id: "night", label: "Night date" },
    { id: "thinker", label: "Thinker" }
  ];
  const SORT_IDS = SORTS.map((row) => row.id);
  const KINDS = {
    verbatim: "Verbatim quotation",
    paraphrase: "Paraphrase",
    passage: "Passage"
  };

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
      else {
        out += text[i];
        i += 1;
      }
    }
    return out;
  }

  function clip(value, max) {
    if (typeof value !== "string") value = value == null ? "" : String(value);
    const text = stripHidden(value).replace(/\u0000/g, "").trim();
    if (text.length <= max) return text;
    return text.slice(0, max);
  }

  function exactText(value) {
    if (typeof value !== "string") return "";
    if (!value.trim()) return "";
    return value;
  }

  function safeId(value) {
    const text = typeof value === "string" ? value : "";
    return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : "";
  }

  function colorId(value) {
    return COLOR_IDS.indexOf(value) >= 0 ? value : "";
  }

  function kindOf(value) {
    return Object.prototype.hasOwnProperty.call(KINDS, value) ? value : "passage";
  }

  function sortId(value, fallback) {
    return SORT_IDS.indexOf(value) >= 0 ? value : fallback;
  }

  function emojiOf(value) {
    const text = stripHidden(typeof value === "string" ? value : "").replace(/[<>&]/g, "").trim();
    if (!text) return "";
    return Array.from(text).slice(0, 4).join("");
  }

  function dateOf(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }

  function iso(value) {
    if (typeof value !== "string" || !value) return "";
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "";
    return new Date(time).toISOString();
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function httpUrl(url) {
    const text = typeof url === "string" ? url.trim() : "";
    return /^https?:\/\/\S+$/.test(text) ? text : "";
  }

  function safeHref(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 500) return "";
    if (!/^(?:index|docket|saved|archive)\.html(?:\?[^#\s]*)?(?:#[A-Za-z0-9_-]*)?$/.test(text)) return "";
    return text;
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

  function newId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return String(prefix + "-" + time + "-" + rand).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  }

  function unsortedFolder() {
    return {
      id: UNSORTED,
      name: "Unsorted",
      color: "",
      emoji: "",
      order: 0,
      createdAt: "1970-01-01T00:00:00.000Z"
    };
  }

  function emptyState() {
    return { version: VERSION, folders: [unsortedFolder()], items: [], sort: { folders: "manual", items: "saved" } };
  }

  function nextOrder(rows) {
    return rows.reduce((max, row) => Math.max(max, num(row.order)), -1) + 1;
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const folders = [];
    const seenFolders = new Set();
    (Array.isArray(source.folders) ? source.folders : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = safeId(row.id);
      if (!id || seenFolders.has(id)) return;
      seenFolders.add(id);
      folders.push({
        id,
        name: id === UNSORTED ? "Unsorted" : (clip(row.name, 80) || "Folder"),
        color: colorId(row.color),
        emoji: emojiOf(row.emoji),
        order: num(row.order),
        createdAt: iso(row.createdAt) || "1970-01-01T00:00:00.000Z"
      });
    });
    if (!seenFolders.has(UNSORTED)) folders.unshift(unsortedFolder());
    const folderIds = new Set(folders.map((folder) => folder.id));
    const items = [];
    const seenItems = new Set();
    (Array.isArray(source.items) ? source.items : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = safeId(row.id);
      const text = exactText(row.text);
      if (!id || !text || seenItems.has(id)) return;
      seenItems.add(id);
      items.push({
        id,
        text,
        note: clip(row.note, 2000),
        color: colorId(row.color),
        kind: kindOf(row.kind),
        speaker: clip(row.speaker, 200),
        work: clip(row.work, 400),
        citation: clip(row.citation, 400),
        edition: clip(row.edition, 300),
        sourceUrl: httpUrl(row.sourceUrl),
        night: dateOf(row.night),
        sittingTitle: clip(row.sittingTitle, 400),
        sittingId: clip(row.sittingId, 120),
        href: safeHref(row.href),
        place: safeHref(row.place),
        block: clip(row.block, 240),
        start: Math.max(0, num(row.start)),
        savedAt: iso(row.savedAt) || "1970-01-01T00:00:00.000Z",
        folderId: folderIds.has(row.folderId) ? row.folderId : UNSORTED,
        order: num(row.order)
      });
    });
    const sortSource = source.sort && typeof source.sort === "object" ? source.sort : {};
    return {
      version: VERSION,
      folders,
      items,
      sort: {
        folders: sortId(sortSource.folders, "manual"),
        items: sortId(sortSource.items, "saved")
      }
    };
  }

  function load(storage) {
    try {
      if (!storage || typeof storage.getItem !== "function") {
        return { state: emptyState(), available: false, error: "unavailable" };
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (raw == null || raw === "") return { state: emptyState(), available: true };
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return { state: emptyState(), available: true, error: "unreadable" };
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { state: emptyState(), available: true, error: "unreadable" };
      }
      if (parsed.version !== VERSION) {
        return { state: emptyState(), available: true, error: "version", blocked: true };
      }
      return { state: normalize(parsed), available: true };
    } catch (err) {
      return { state: emptyState(), available: false, error: "unavailable" };
    }
  }

  function save(storage, state) {
    try {
      if (!storage || typeof storage.setItem !== "function") return { ok: false, available: false };
      storage.setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
      return { ok: true, available: true };
    } catch (err) {
      return { ok: false, available: false };
    }
  }

  function addItem(state, input) {
    const base = normalize(state);
    const source = input && typeof input === "object" ? input : {};
    const text = exactText(source.text);
    if (!text) return { state: base, item: null, error: "empty" };
    const id = safeId(source.id) || newId("hl");
    if (base.items.some((item) => item.id === id)) return { state: base, item: null, error: "duplicate" };
    const folderId = base.folders.some((folder) => folder.id === source.folderId) ? source.folderId : UNSORTED;
    const item = {
      id,
      text,
      note: clip(source.note, 2000),
      color: colorId(source.color) || "amber",
      kind: kindOf(source.kind),
      speaker: clip(source.speaker, 200),
      work: clip(source.work, 400),
      citation: clip(source.citation, 400),
      edition: clip(source.edition, 300),
      sourceUrl: httpUrl(source.sourceUrl),
      night: dateOf(source.night),
      sittingTitle: clip(source.sittingTitle, 400),
      sittingId: clip(source.sittingId, 120),
      href: safeHref(source.href),
      place: safeHref(source.place),
      block: clip(source.block, 240),
      start: Math.max(0, num(source.start)),
      savedAt: iso(source.savedAt) || new Date().toISOString(),
      folderId,
      order: nextOrder(base.items.filter((row) => row.folderId === folderId))
    };
    base.items.push(item);
    return { state: base, item };
  }

  function updateItem(state, id, patch) {
    const base = normalize(state);
    const item = base.items.find((row) => row.id === id);
    if (!item) return { state: base, item: null, error: "missing" };
    const source = patch && typeof patch === "object" ? patch : {};
    if (Object.prototype.hasOwnProperty.call(source, "note")) item.note = clip(source.note, 2000);
    if (Object.prototype.hasOwnProperty.call(source, "color")) item.color = colorId(source.color) || "amber";
    if (Object.prototype.hasOwnProperty.call(source, "folderId") && base.folders.some((folder) => folder.id === source.folderId)) {
      if (item.folderId !== source.folderId) {
        item.folderId = source.folderId;
        item.order = nextOrder(base.items.filter((row) => row.folderId === source.folderId && row.id !== item.id));
      }
    }
    if (Object.prototype.hasOwnProperty.call(source, "href")) item.href = safeHref(source.href);
    return { state: base, item };
  }

  function removeItem(state, id) {
    const base = normalize(state);
    const before = base.items.length;
    base.items = base.items.filter((item) => item.id !== id);
    return { state: base, removed: base.items.length !== before };
  }

  function createFolder(state, input) {
    const base = normalize(state);
    const source = input && typeof input === "object" ? input : {};
    const name = clip(source.name, 80);
    if (!name) return { state: base, folder: null, error: "empty" };
    const id = safeId(source.id) || newId("folder");
    if (id === UNSORTED || base.folders.some((folder) => folder.id === id)) {
      return { state: base, folder: null, error: "duplicate" };
    }
    const folder = {
      id,
      name,
      color: colorId(source.color),
      emoji: emojiOf(source.emoji),
      order: nextOrder(base.folders),
      createdAt: iso(source.createdAt) || new Date().toISOString()
    };
    base.folders.push(folder);
    return { state: base, folder };
  }

  function renameFolder(state, id, name) {
    const base = normalize(state);
    if (id === UNSORTED) return { state: base, folder: base.folders.find((folder) => folder.id === UNSORTED), error: "locked" };
    const folder = base.folders.find((row) => row.id === id);
    if (!folder) return { state: base, folder: null, error: "missing" };
    const next = clip(name, 80);
    if (!next) return { state: base, folder, error: "empty" };
    folder.name = next;
    return { state: base, folder };
  }

  function labelFolder(state, id, input) {
    const base = normalize(state);
    const folder = base.folders.find((row) => row.id === id);
    if (!folder) return { state: base, folder: null, error: "missing" };
    const source = input && typeof input === "object" ? input : {};
    if (Object.prototype.hasOwnProperty.call(source, "color")) folder.color = colorId(source.color);
    if (Object.prototype.hasOwnProperty.call(source, "emoji")) folder.emoji = emojiOf(source.emoji);
    return { state: base, folder };
  }

  function deleteFolder(state, id) {
    const base = normalize(state);
    if (!id || id === UNSORTED) return { state: base, error: "locked" };
    const folder = base.folders.find((row) => row.id === id);
    if (!folder) return { state: base, error: "missing" };
    base.items.forEach((item) => {
      if (item.folderId !== id) return;
      item.folderId = UNSORTED;
      item.order = nextOrder(base.items.filter((row) => row.folderId === UNSORTED && row !== item));
    });
    base.folders = base.folders.filter((row) => row.id !== id);
    return { state: base, removed: true };
  }

  function moveItem(state, id, folderId) {
    return updateItem(state, id, { folderId });
  }

  function reorderList(rows, id, beforeId) {
    const current = rows.find((row) => row.id === id);
    if (!current) return rows;
    const rest = rows.filter((row) => row.id !== id);
    let index = rest.length;
    if (beforeId) {
      const at = rest.findIndex((row) => row.id === beforeId);
      if (at >= 0) index = at;
    }
    rest.splice(index, 0, current);
    rest.forEach((row, i) => { row.order = i; });
    return rest;
  }

  function reorder(state, input) {
    const base = normalize(state);
    const source = input && typeof input === "object" ? input : {};
    if (source.type === "folder") {
      const ordered = base.folders.slice().sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
      base.folders = reorderList(ordered, source.id, source.beforeId);
      return { state: base };
    }
    const item = base.items.find((row) => row.id === source.id);
    if (!item) return { state: base, error: "missing" };
    if (source.folderId && base.folders.some((folder) => folder.id === source.folderId)) item.folderId = source.folderId;
    const siblings = base.items.filter((row) => row.folderId === item.folderId);
    const ordered = siblings.slice().sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
    reorderList(ordered, item.id, source.beforeId);
    return { state: base };
  }

  function orderIds(state, type, ids, folderId) {
  const base = normalize(state);
  const list = Array.isArray(ids) ? ids : [];
  if (type === "folder") {
    list.forEach((id, index) => {
      const folder = base.folders.find((row) => row.id === id);
      if (folder) folder.order = index;
    });
    base.sort.folders = "manual";
    return { state: base };
  }
  list.forEach((id, index) => {
    const item = base.items.find((row) => row.id === id);
    if (!item) return;
    if (folderId && base.folders.some((folder) => folder.id === folderId)) item.folderId = folderId;
    item.order = index;
  });
  base.sort.items = "manual";
  return { state: base };
}

function setSort(state, which, value) {
    const base = normalize(state);
    if (which === "folders") base.sort.folders = sortId(value, base.sort.folders);
    if (which === "items") base.sort.items = sortId(value, base.sort.items);
    return { state: base };
  }

  function compareText(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function compareItems(sort, a, b) {
    if (sort === "name") {
      const byName = compareText((a.sittingTitle || a.text).toLowerCase(), (b.sittingTitle || b.text).toLowerCase());
      if (byName) return byName;
    } else if (sort === "saved") {
      if (a.savedAt !== b.savedAt) return a.savedAt < b.savedAt ? 1 : -1;
    } else if (sort === "night") {
      if (a.night !== b.night) {
        if (!a.night) return 1;
        if (!b.night) return -1;
        return a.night < b.night ? 1 : -1;
      }
    } else if (sort === "thinker") {
      const as = (a.speaker || "").toLowerCase();
      const bs = (b.speaker || "").toLowerCase();
      if (as !== bs) {
        if (!as) return 1;
        if (!bs) return -1;
        return compareText(as, bs);
      }
    }
    if (a.order !== b.order) return a.order - b.order;
    return compareText(a.id, b.id);
  }

  function folderNight(folder, items) {
    const nights = items.filter((item) => item.folderId === folder.id && item.night).map((item) => item.night).sort();
    return nights.length ? nights[nights.length - 1] : "";
  }

  function folderThinker(folder, items) {
    const names = items.filter((item) => item.folderId === folder.id && item.speaker).map((item) => item.speaker.toLowerCase()).sort();
    return names[0] || "";
  }

  function compareFolders(sort, items, a, b) {
    if (sort === "name") {
      const byName = compareText(a.name.toLowerCase(), b.name.toLowerCase());
      if (byName) return byName;
    } else if (sort === "saved") {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    } else if (sort === "night") {
      const an = folderNight(a, items);
      const bn = folderNight(b, items);
      if (an !== bn) {
        if (!an) return 1;
        if (!bn) return -1;
        return an < bn ? 1 : -1;
      }
    } else if (sort === "thinker") {
      const an = folderThinker(a, items);
      const bn = folderThinker(b, items);
      if (an !== bn) {
        if (!an) return 1;
        if (!bn) return -1;
        return compareText(an, bn);
      }
    }
    if (a.order !== b.order) return a.order - b.order;
    return compareText(a.id, b.id);
  }

  function matchesQuery(item, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const hay = [item.text, item.note, item.speaker, item.work, item.citation, item.sittingTitle, item.night, item.edition, kindLabel(item.kind)].join("\n").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function view(state, query) {
    const base = normalize(state);
    const q = String(query || "").trim();
    const folders = base.folders.slice().sort((a, b) => compareFolders(base.sort.folders, base.items, a, b));
    return {
      sort: base.sort,
      folders: folders.map((folder) => {
        const items = base.items.filter((item) => item.folderId === folder.id && matchesQuery(item, q)).sort((a, b) => compareItems(base.sort.items, a, b));
        return { folder, items };
      }).filter((group) => !q || group.items.length)
    };
  }

  function kindLabel(kind) {
    return KINDS[kindOf(kind)];
  }

  function locate(plain, text, hint) {
    const body = String(plain == null ? "" : plain);
    const needle = typeof text === "string" ? text : "";
    if (!needle) return null;
    const from = Number.isFinite(hint) && hint >= 0 && hint < body.length ? hint : 0;
    let at = body.indexOf(needle, from);
    if (at < 0) at = body.indexOf(needle);
    if (at < 0) return null;
    return { start: at, end: at + needle.length };
  }

  function quoteLines(text) {
    return String(text).split("\n").map((line) => "> " + line).join("\n");
  }

  function itemRecord(item) {
    const lines = [kindLabel(item.kind)];
    if (item.kind === "paraphrase") lines.push("Labeled paraphrase, not a quotation.");
    lines.push(item.text);
    if (item.speaker) lines.push("Speaker: " + item.speaker);
    if (item.work) lines.push("Work: " + item.work);
    if (item.citation) lines.push("Citation: " + item.citation);
    if (item.edition) lines.push("Edition: " + item.edition);
    if (item.sourceUrl) lines.push("Source: " + item.sourceUrl);
    if (item.night) lines.push("Night: " + item.night);
    if (item.sittingTitle) lines.push("Sitting: " + item.sittingTitle);
    lines.push("Saved: " + item.savedAt);
    if (item.note) lines.push("Note: " + item.note);
    if (item.href) lines.push("Link: " + item.href);
    return lines;
  }

  function exportText(state) {
    const groups = view(state, "");
    const lines = ["Saved highlights", ""];
    groups.folders.forEach((group) => {
      const mark = group.folder.emoji ? group.folder.emoji + " " : "";
      lines.push(mark + group.folder.name);
      if (!group.items.length) lines.push("(empty)");
      group.items.forEach((item) => {
        lines.push("");
        itemRecord(item).forEach((line) => lines.push(line));
      });
      lines.push("");
    });
    return lines.join("\n").replace(/\n+$/, "\n");
  }

  function exportMarkdown(state) {
    const groups = view(state, "");
    const lines = ["# Saved highlights", ""];
    groups.folders.forEach((group) => {
      const mark = group.folder.emoji ? group.folder.emoji + " " : "";
      lines.push("## " + mark + group.folder.name, "");
      if (!group.items.length) lines.push("No passages in this folder.", "");
      group.items.forEach((item) => {
        lines.push("### " + kindLabel(item.kind));
        if (item.kind === "paraphrase") lines.push("", "Labeled paraphrase, not a quotation.");
        lines.push("", quoteLines(item.text), "");
        if (item.speaker) lines.push(item.speaker);
        if (item.work || item.citation) {
          const cite = [item.work, item.citation].filter(Boolean).join(", ");
          lines.push(cite);
        }
        if (item.edition) lines.push("Edition: " + item.edition);
        if (item.night) lines.push("Night: " + item.night);
        if (item.sittingTitle) lines.push("Sitting: " + item.sittingTitle);
        lines.push("Saved: " + item.savedAt);
        if (item.note) lines.push("", "Note: " + item.note);
        if (item.href) lines.push("", "[Open this spot](" + item.href + ")");
        lines.push("");
      });
    });
    return lines.join("\n").replace(/\n+$/, "\n");
  }

  function exportJson(state) {
    return JSON.stringify(normalize(state), null, 2);
  }

  function importLibrary(state, data) {
    const base = normalize(state);
    let parsed = data;
    if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        return { state: base, error: "unreadable", added: { folders: 0, items: 0 } };
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: base, error: "unreadable", added: { folders: 0, items: 0 } };
    }
    if (parsed.version !== VERSION) {
      return { state: base, error: "version", added: { folders: 0, items: 0 } };
    }
    const incoming = normalize(parsed);
    let folders = 0;
    let items = 0;
    incoming.folders.forEach((folder) => {
      if (folder.id === UNSORTED) {
        const current = base.folders.find((row) => row.id === UNSORTED);
        if (current) {
          current.color = folder.color;
          current.emoji = folder.emoji;
        }
        return;
      }
      if (base.folders.some((row) => row.id === folder.id)) return;
      base.folders.push(folder);
      folders += 1;
    });
    const have = new Set(base.items.map((item) => item.id));
    incoming.items.forEach((item) => {
      if (have.has(item.id)) return;
      if (!base.folders.some((folder) => folder.id === item.folderId)) item.folderId = UNSORTED;
      base.items.push(item);
      have.add(item.id);
      items += 1;
    });
    return { state: base, added: { folders, items } };
  }

  function findByBlock(state, block, text) {
    const base = normalize(state);
    return base.items.find((item) => item.block === block && item.text === text) || null;
  }

  function colorChoices(selected, name) {
    const current = colorId(selected) || "amber";
    return COLORS.map((color) => {
      const checked = color.id === current ? " checked" : "";
      return `<label class="reader-swatch reader-swatch-${color.id}"><input type="radio" name="${escapeAttr(name)}" value="${color.id}"${checked} /><span>${escapeText(color.label)}</span></label>`;
    }).join("");
  }

  function folderOptions(state, selected) {
    return normalize(state).folders.slice().sort((a, b) => a.order - b.order).map((folder) => {
      const mark = folder.emoji ? folder.emoji + " " : "";
      const on = folder.id === selected ? " selected" : "";
      return `<option value="${escapeAttr(folder.id)}"${on}>${escapeText(mark + folder.name)}</option>`;
    }).join("");
  }

  function libraryHtml(state, query) {
    const groups = view(state, query);
    if (!groups.folders.length) return `<p class="empty">Nothing saved matches that search.</p>`;
    return groups.folders.map((group, folderIndex) => {
      const folder = group.folder;
      const mark = folder.emoji
        ? `<span class="reader-folder-emoji" aria-hidden="true">${escapeText(folder.emoji)}</span>`
        : `<span class="reader-folder-dot reader-swatch-${folder.color || "amber"}" aria-hidden="true"></span>`;
      const items = group.items.length
        ? group.items.map((item, itemIndex) => itemHtml(state, item, itemIndex, group.items.length)).join("")
        : `<p class="empty">Nothing in this folder yet.</p>`;
      const locked = folder.id === UNSORTED;
      return `<section class="reader-folder reader-folder-${escapeAttr(folder.color || "amber")}" data-folder="${escapeAttr(folder.id)}">
        <header class="reader-folder-head">
          ${mark}
          <h3>${escapeText(folder.name)}</h3>
          <div class="reader-folder-actions">
            ${locked ? "" : `<button type="button" data-rename="${escapeAttr(folder.id)}">Rename</button>`}
            <button type="button" data-label="${escapeAttr(folder.id)}">Label</button>
            ${locked ? "" : `<button type="button" data-delete-folder="${escapeAttr(folder.id)}">Delete</button>`}
            <button type="button" data-move-folder="up" data-folder-id="${escapeAttr(folder.id)}"${folderIndex === 0 ? " disabled" : ""}>Move up</button>
            <button type="button" data-move-folder="down" data-folder-id="${escapeAttr(folder.id)}"${folderIndex === groups.folders.length - 1 ? " disabled" : ""}>Move down</button>
            <button type="button" class="reader-handle" data-drag="${escapeAttr(folder.id)}" data-drag-type="folder" aria-label="Drag to reorder ${escapeAttr(folder.name)}">Drag</button>
          </div>
        </header>
        <div class="reader-items">${items}</div>
      </section>`;
    }).join("");
  }

  function itemHtml(state, item, index, count) {
    const meta = [item.speaker, item.work, item.citation].filter(Boolean).join(" · ");
    const when = [item.night, item.sittingTitle].filter(Boolean).join(" · ");
    const edition = item.edition ? `<p class="meta">Edition: ${escapeText(item.edition)}</p>` : "";
    const note = item.note ? `<p class="reader-note">${escapeText(item.note)}</p>` : "";
    const link = item.href ? `<p><a class="tap-target" href="${escapeAttr(item.href)}">Open this spot</a></p>` : "";
    const paraphrase = item.kind === "paraphrase" ? `<p class="note-flag">Paraphrase, not a quotation.</p>` : "";
    return `<article class="reader-item reader-hl-${escapeAttr(item.color || "amber")}" data-item="${escapeAttr(item.id)}" id="saved-${escapeAttr(item.id)}">
      <p class="kicker">${escapeText(kindLabel(item.kind))}</p>
      ${paraphrase}
      <blockquote class="reader-text">${escapeText(item.text)}</blockquote>
      ${meta ? `<p class="meta">${escapeText(meta)}</p>` : ""}
      ${when ? `<p class="meta">${escapeText(when)}</p>` : ""}
      ${edition}
      <p class="meta">Saved ${escapeText(item.savedAt.slice(0, 10))}</p>
      ${note}
      ${link}
      <div class="reader-item-actions">
        <label class="field" for="move-${escapeAttr(item.id)}">Folder</label>
        <select id="move-${escapeAttr(item.id)}" data-move-item="${escapeAttr(item.id)}">${folderOptions(state, item.folderId)}</select>
        <button type="button" data-move-item-order="up" data-item-id="${escapeAttr(item.id)}"${index === 0 ? " disabled" : ""}>Move up</button>
        <button type="button" data-move-item-order="down" data-item-id="${escapeAttr(item.id)}"${index === count - 1 ? " disabled" : ""}>Move down</button>
        <button type="button" class="reader-handle" data-drag="${escapeAttr(item.id)}" data-drag-type="item" aria-label="Drag to reorder this passage">Drag</button>
        <button type="button" data-remove="${escapeAttr(item.id)}">Remove</button>
      </div>
      <details class="reader-edit">
        <summary>Color and note</summary>
        <fieldset class="reader-colors"><legend>Highlight color</legend>${colorChoices(item.color, "color-" + item.id)}</fieldset>
        <label class="field" for="note-${escapeAttr(item.id)}">Note</label>
        <textarea id="note-${escapeAttr(item.id)}" data-note="${escapeAttr(item.id)}" maxlength="2000">${escapeText(item.note)}</textarea>
        <button type="button" data-save-item="${escapeAttr(item.id)}">Save changes</button>
      </details>
    </article>`;
  }

  return {
    VERSION, STORAGE_KEY, UNSORTED, COLORS, SORTS, KINDS,
    emptyState, normalize, load, save, addItem, updateItem, removeItem,
    createFolder, renameFolder, labelFolder, deleteFolder, moveItem, reorder, orderIds, setSort,
    view, kindLabel, locate, exportText, exportMarkdown, exportJson, importLibrary, findByBlock,
    escapeText, escapeAttr, safeHref, exactText, libraryHtml, colorChoices, folderOptions
  };
});
