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
    passage: "Passage",
    film: "Film",
    song: "Song",
    poem: "Poem"
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
    if (!/^(?:index|docket|saved|archive|encounters)\.html(?:\?[^#\s]*)?(?:#[A-Za-z0-9_-]*)?$/.test(text)) return "";
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
    if (item.kind === "film" || item.kind === "song" || item.kind === "poem") lines.push("The room's note, not a quotation.");
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
        if (item.kind === "film" || item.kind === "song" || item.kind === "poem") lines.push("", "The room's note, not a quotation.");
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
    const editionLabel = item.kind === "film" ? "Rating" : "Edition";
    const edition = item.edition ? `<p class="meta">${editionLabel}: ${escapeText(item.edition)}</p>` : "";
    const note = item.note ? `<p class="reader-note">${escapeText(item.note)}</p>` : "";
    const link = item.href ? `<p><a class="tap-target" href="${escapeAttr(item.href)}">Open this spot</a></p>` : "";
    const encounter = item.kind === "film" || item.kind === "song" || item.kind === "poem";
    const paraphrase = item.kind === "paraphrase" ? `<p class="note-flag">Paraphrase, not a quotation.</p>` : "";
    const roomNote = encounter ? `<p class="note-flag">The room's note, not a quotation.</p>` : "";
    const body = encounter
      ? `<p class="reader-note">${escapeText(item.text)}</p>`
      : `<blockquote class="reader-text">${escapeText(item.text)}</blockquote>`;
    const source = item.sourceUrl ? `<p><a class="tap-target" href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open a source</a></p>` : "";
    return `<article class="reader-item reader-hl-${escapeAttr(item.color || "amber")}" data-item="${escapeAttr(item.id)}" id="saved-${escapeAttr(item.id)}">
      <p class="kicker">${escapeText(kindLabel(item.kind))}</p>
      ${paraphrase}
      ${roomNote}
      ${body}
      ${meta ? `<p class="meta">${escapeText(meta)}</p>` : ""}
      ${when ? `<p class="meta">${escapeText(when)}</p>` : ""}
      ${edition}
      <p class="meta">Saved ${escapeText(item.savedAt.slice(0, 10))}</p>
      ${note}
      ${source}
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

  const GROUP_LABELS = {
    folder: "Grouped by bookmark folder.",
    thinker: "Grouped by thinker.",
    source: "Grouped by theme or source."
  };

  const DOCUMENT_CSS = [
    ":root { color-scheme: light; }",
    "* { box-sizing: border-box; }",
    "body { margin: 0; background: #f7f1e6; color: #1c1712; font-family: Palatino, 'Palatino Linotype', Georgia, serif; line-height: 1.5; }",
    ".commonplace-book { max-width: 68ch; margin: 0 auto; padding: 48px 24px 72px; }",
    ".commonplace-title-page { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; text-align: center; padding: 24px 0 48px; }",
    ".commonplace-book.is-empty .commonplace-title-page { min-height: 0; }",
    ".kicker { letter-spacing: 0.16em; text-transform: uppercase; color: #5e4316; font-family: 'Avenir Next', 'Segoe UI', sans-serif; font-size: 12px; font-weight: 600; margin: 0 0 8px; }",
    ".commonplace-title { font-weight: 560; letter-spacing: -0.03em; line-height: 1.05; font-size: 44px; margin: 0 0 12px; }",
    ".commonplace-section-title, .commonplace-contents { font-weight: 560; letter-spacing: -0.03em; line-height: 1.15; font-size: 28px; margin: 0 0 12px; }",
    ".commonplace-epigraph { font-style: italic; font-size: 20px; white-space: pre-wrap; margin: 12px 0; }",
    ".commonplace-meta, .commonplace-cite { color: #4e463c; }",
    "a { color: #1c1712; }",
    ".commonplace-quote { font-size: 21px; line-height: 1.5; white-space: pre-wrap; margin: 8px 0 12px; padding: 0 0 0 14px; border-left: 2px solid #5e4316; }",
    ".commonplace-prose, .commonplace-note { white-space: pre-wrap; overflow-wrap: anywhere; }",
    ".commonplace-speaker { font-size: 18px; margin: 0 0 4px; }",
    ".commonplace-note { margin-top: 8px; }",
    ".commonplace-section { margin-top: 36px; }",
    ".commonplace-entry + .commonplace-entry { margin-top: 28px; }",
    ".note-flag { font-family: 'Avenir Next', 'Segoe UI', sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5e4316; font-weight: 600; }",
    ".commonplace-toc a { text-decoration: underline; text-underline-offset: 3px; }",
    ".commonplace-print-hint { font-family: 'Avenir Next', 'Segoe UI', sans-serif; font-size: 13px; color: #4e463c; }",
    "@page { margin: 0.8in; }",
    "@media print {",
    "  body { background: #fff; }",
    "  .commonplace-book:not(.is-empty) .commonplace-title-page { break-after: page; min-height: 80vh; }",
    "  .commonplace-section { break-before: page; }",
    "  .commonplace-entry { break-inside: avoid; }",
    "  .commonplace-print-hint { display: none; }",
    "  a[href]::after { content: ' (' attr(href) ')'; font-size: 10pt; word-break: break-all; }",
    "  .commonplace-toc a[href]::after { content: none; }",
    "}",
    "@media (max-width: 560px) {",
    "  .commonplace-book { padding: 28px 16px 48px; }",
    "  .commonplace-title { font-size: 32px; }",
    "  .commonplace-quote { font-size: 18px; }",
    "}"
  ].join("\n");

  function oneLine(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function bookTitle(value) {
    return oneLine(clip(value, 120)) || "Commonplace Book";
  }

  function bookEpigraph(value) {
    return clip(value, 500);
  }

  function groupByOf(value) {
    if (value === "thinker") return "thinker";
    if (value === "source" || value === "theme") return "source";
    return "folder";
  }

  function scopeOf(value) {
    return value === "folders" ? "folders" : "all";
  }

  function commonplaceOptions(input) {
    const source = input && typeof input === "object" ? input : {};
    const folderIds = [];
    const seen = new Set();
    (Array.isArray(source.folderIds) ? source.folderIds : []).forEach((id) => {
      const safe = safeId(id);
      if (!safe || seen.has(safe)) return;
      seen.add(safe);
      folderIds.push(safe);
    });
    return {
      scope: scopeOf(source.scope),
      folderIds,
      groupBy: groupByOf(source.groupBy),
      title: bookTitle(source.title),
      epigraph: bookEpigraph(source.epigraph),
      baseUrl: typeof source.baseUrl === "string" ? source.baseUrl : ""
    };
  }

  function emptyMessage(reason) {
    if (reason === "choose") return "Choose at least one folder. The book stays empty until you do.";
    if (reason === "folders") return "Nothing is saved in the folders you chose.";
    return "Nothing is saved in this browser yet.";
  }

  function encounterKind(kind) {
    return kind === "film" || kind === "song" || kind === "poem";
  }

  function sectionMeta(entry, groupBy) {
    const item = entry.item;
    if (groupBy === "thinker") {
      if (!item.speaker) return { key: "thinker:", title: "Without a named thinker", rank: 1, sort: "" };
      return { key: "thinker:" + item.speaker, title: item.speaker, rank: 0, sort: item.speaker.toLowerCase() };
    }
    if (groupBy === "source") {
      if (encounterKind(item.kind)) {
        const order = item.kind === "film" ? "0" : (item.kind === "song" ? "1" : "2");
        return { key: "encounter:" + item.kind, title: "Further encounters · " + kindLabel(item.kind), rank: 2, sort: order };
      }
      if (item.work) return { key: "work:" + item.work, title: item.work, rank: 0, sort: item.work.toLowerCase() };
      if (item.sittingTitle) return { key: "sitting:" + item.sittingTitle, title: item.sittingTitle, rank: 1, sort: item.sittingTitle.toLowerCase() };
      return { key: "source:", title: "Without a named source", rank: 3, sort: "" };
    }
    const folder = entry.folder;
    const mark = folder.emoji ? folder.emoji + " " : "";
    return { key: "folder:" + folder.id, title: mark + folder.name, rank: num(folder.order), sort: folder.id };
  }

  function slug(text) {
    const base = oneLine(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    return base || "section";
  }

  function groupSections(entries, groupBy) {
    const order = [];
    const map = new Map();
    entries.forEach((entry) => {
      const meta = sectionMeta(entry, groupBy);
      let section = map.get(meta.key);
      if (!section) {
        section = { key: meta.key, title: meta.title, rank: meta.rank, sort: meta.sort, entries: [] };
        map.set(meta.key, section);
        order.push(section);
      }
      section.entries.push(entry);
    });
    if (groupBy !== "folder") {
      order.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return compareText(a.sort, b.sort);
      });
    }
    const used = new Set();
    return order.map((section) => {
      const base = slug(section.title);
      let id = base;
      let n = 2;
      while (used.has(id)) {
        id = base + "-" + n;
        n += 1;
      }
      used.add(id);
      return { id: "cb-" + id, title: oneLine(section.title), entries: section.entries };
    });
  }

  function commonplaceBook(state, options) {
    const opts = commonplaceOptions(options);
    const groups = view(state, "");
    const wanted = new Set(opts.folderIds);
    const entries = [];
    groups.folders.forEach((group) => {
      if (opts.scope === "folders" && !wanted.has(group.folder.id)) return;
      group.items.forEach((item) => entries.push({ item, folder: group.folder }));
    });
    let emptyReason = "";
    if (!entries.length) {
      if (opts.scope === "folders" && !opts.folderIds.length) emptyReason = "choose";
      else if (opts.scope === "folders") emptyReason = "folders";
      else emptyReason = "none";
    }
    return {
      title: opts.title,
      epigraph: opts.epigraph,
      scope: opts.scope,
      groupBy: opts.groupBy,
      groupLabel: GROUP_LABELS[opts.groupBy],
      count: entries.length,
      emptyReason,
      message: emptyReason ? emptyMessage(emptyReason) : "",
      sections: emptyReason ? [] : groupSections(entries, opts.groupBy)
    };
  }

  function usableBase(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 500 || !/^https?:\/\/\S+$/.test(text)) return "";
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href;
    } catch (err) {
      return "";
    }
  }

  function resolveLink(href, baseUrl) {
    const external = httpUrl(href);
    if (external) return external;
    const local = safeHref(href);
    if (!local) return "";
    const base = usableBase(baseUrl);
    if (!base) return local;
    try {
      return new URL(local, base).href;
    } catch (err) {
      return local;
    }
  }

  function markdownHref(url) {
    return String(url).replace(/[()\s]/g, (ch) => encodeURIComponent(ch));
  }

  function markdownLabel(value) {
    const text = oneLine(value).replace(/[\[\]]/g, "");
    return text || "Link";
  }

  function plainBlock(value) {
    return String(value == null ? "" : value).split("\n").map((line) => {
      if (/^\s*(?:[#>\-*]|\d+\.)/.test(line)) return " " + line;
      return line;
    }).join("\n");
  }

  function countSentence(count) {
    return (count === 1 ? "1 passage" : count + " passages") + " saved in this browser.";
  }

  function entryMarkdown(entry, groupBy, baseUrl) {
    const item = entry.item;
    const lines = ["### " + kindLabel(item.kind), ""];
    if (item.kind === "paraphrase") lines.push("Labeled paraphrase, not a quotation.", "");
    if (encounterKind(item.kind)) lines.push("The room's note, not a quotation.", "");
    if (item.kind === "verbatim" || item.kind === "passage") lines.push(quoteLines(item.text), "");
    else lines.push(plainBlock(item.text), "");
    if (item.speaker) lines.push(plainBlock(item.speaker), "");
    const cite = [item.work, item.citation].filter(Boolean).join(", ");
    if (cite) lines.push(plainBlock(cite), "");
    const source = resolveLink(item.sourceUrl, baseUrl);
    if (source) lines.push("[Open the source](" + markdownHref(source) + ")", "");
    if (item.edition) lines.push(plainBlock((item.kind === "film" ? "Rating: " : "Edition: ") + item.edition), "");
    if (item.night) lines.push("Night: " + item.night, "");
    if (item.sittingTitle) lines.push("Sitting: " + plainBlock(item.sittingTitle), "");
    if (groupBy !== "folder" && entry.folder) lines.push("Folder: " + plainBlock(entry.folder.name), "");
    const spot = resolveLink(item.href, baseUrl);
    const place = resolveLink(item.place, baseUrl);
    if (spot) lines.push("[Open this spot](" + markdownHref(spot) + ")", "");
    if (place && place !== spot) lines.push("[Open the sitting](" + markdownHref(place) + ")", "");
    if (item.note) lines.push("Note: " + plainBlock(item.note), "");
    return lines.join("\n");
  }

  function commonplaceMarkdown(state, options) {
    const opts = commonplaceOptions(options);
    const book = commonplaceBook(state, opts);
    const lines = ["# " + book.title, ""];
    if (book.epigraph) lines.push(quoteLines(book.epigraph), "");
    if (book.message) {
      lines.push(book.message, "");
      return lines.join("\n").replace(/\n+$/, "\n");
    }
    lines.push(book.groupLabel + " " + countSentence(book.count), "");
    lines.push("## Table of contents", "");
    book.sections.forEach((section) => {
      lines.push("- [" + markdownLabel(section.title) + "](#" + section.id + ")");
    });
    lines.push("");
    book.sections.forEach((section) => {
      lines.push('<a id="' + section.id + '"></a>', "", "## " + section.title, "");
      section.entries.forEach((entry) => {
        lines.push(entryMarkdown(entry, book.groupBy, opts.baseUrl).replace(/\n+$/, ""), "");
      });
    });
    return lines.join("\n").replace(/\n+$/, "\n");
  }

  function anchorHtml(href, label, external) {
    const extra = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeAttr(href)}"${extra}>${escapeText(label)}</a>`;
  }

  function citeHtml(item, baseUrl) {
    const url = resolveLink(item.sourceUrl, baseUrl);
    if (!item.work && !item.citation && !url) return "";
    const parts = [];
    if (item.work) {
      const name = url ? anchorHtml(url, item.work, true) : escapeText(item.work);
      parts.push(`<cite>${name}</cite>`);
    } else if (url) {
      parts.push(anchorHtml(url, "Open the source", true));
    }
    if (item.citation) parts.push(escapeText(item.citation));
    return `<p class="commonplace-cite">${parts.join(", ")}</p>`;
  }

  function entryHtml(entry, groupBy, baseUrl) {
    const item = entry.item;
    const quoted = item.kind === "verbatim" || item.kind === "passage";
    const flag = item.kind === "paraphrase"
      ? `<p class="note-flag">Labeled paraphrase, not a quotation.</p>`
      : (encounterKind(item.kind) ? `<p class="note-flag">The room's note, not a quotation.</p>` : "");
    const body = quoted
      ? `<blockquote class="commonplace-quote">${escapeText(item.text)}</blockquote>`
      : `<p class="commonplace-prose">${escapeText(item.text)}</p>`;
    const bits = [];
    if (item.speaker) bits.push(`<p class="commonplace-speaker">${escapeText(item.speaker)}</p>`);
    const cite = citeHtml(item, baseUrl);
    if (cite) bits.push(cite);
    if (item.edition) {
      const label = item.kind === "film" ? "Rating" : "Edition";
      bits.push(`<p class="commonplace-meta">${escapeText(label)}: ${escapeText(item.edition)}</p>`);
    }
    const when = [item.night, item.sittingTitle].filter(Boolean).join(" · ");
    if (when) bits.push(`<p class="commonplace-meta">${escapeText(when)}</p>`);
    if (groupBy !== "folder" && entry.folder) bits.push(`<p class="commonplace-meta">Folder: ${escapeText(entry.folder.name)}</p>`);
    const spot = resolveLink(item.href, baseUrl);
    const place = resolveLink(item.place, baseUrl);
    if (spot) bits.push(`<p>${anchorHtml(spot, "Open this spot", false)}</p>`);
    if (place && place !== spot) bits.push(`<p>${anchorHtml(place, "Open the sitting", false)}</p>`);
    if (item.note) bits.push(`<p class="commonplace-note"><span class="kicker">Note</span> ${escapeText(item.note)}</p>`);
    return `<article class="commonplace-entry">
      <p class="kicker">${escapeText(kindLabel(item.kind))}</p>
      ${flag}
      ${body}
      ${bits.join("\n")}
    </article>`;
  }

  function headingTag(embedded, level) {
    return embedded ? (level === 1 ? "h2" : "h3") : (level === 1 ? "h1" : "h2");
  }

  function commonplaceMarkup(book, baseUrl, embedded) {
    const titleTag = headingTag(embedded, 1);
    const sectionTag = headingTag(embedded, 2);
    const epigraph = book.epigraph ? `<p class="commonplace-epigraph">${escapeText(book.epigraph)}</p>` : "";
    const summary = book.message
      ? `<p class="commonplace-empty">${escapeText(book.message)}</p>`
      : `<p class="commonplace-meta">${escapeText(book.groupLabel)} ${escapeText(countSentence(book.count))}</p>`;
    const hint = embedded ? "" : `<p class="commonplace-print-hint">Print this page, or save it as PDF from the browser.</p>`;
    let toc = "";
    let body = "";
    if (!book.message) {
      const items = book.sections.map((section) => `<li><a href="#${escapeAttr(section.id)}">${escapeText(section.title)}</a></li>`).join("");
      toc = `<nav class="commonplace-toc" aria-label="Table of contents"><${sectionTag} class="commonplace-contents">Table of contents</${sectionTag}><ol>${items}</ol></nav>`;
      body = book.sections.map((section) => {
        const entries = section.entries.map((entry) => entryHtml(entry, book.groupBy, baseUrl)).join("");
        return `<section class="commonplace-section" id="${escapeAttr(section.id)}" aria-labelledby="${escapeAttr(section.id)}-title"><${sectionTag} class="commonplace-section-title" id="${escapeAttr(section.id)}-title">${escapeText(section.title)}</${sectionTag}>${entries}</section>`;
      }).join("");
    }
    const emptyClass = book.message ? " is-empty" : "";
    return `<article class="commonplace-book${emptyClass}" id="commonplace-book" tabindex="-1">
      <header class="commonplace-title-page">
        <p class="kicker">The Athenaeum</p>
        <${titleTag} class="commonplace-title">${escapeText(book.title)}</${titleTag}>
        ${epigraph}
        ${summary}
        ${hint}
      </header>
      ${toc}
      ${body}
    </article>`;
  }

  function commonplaceHtml(state, options) {
    const book = commonplaceBook(state, options);
    return commonplaceMarkup(book, "", true);
  }

  function commonplaceDocument(state, options) {
    const opts = commonplaceOptions(options);
    const book = commonplaceBook(state, opts);
    const inner = commonplaceMarkup(book, opts.baseUrl, false);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeText(book.title)}</title>
<style>
${DOCUMENT_CSS}
</style>
</head>
<body>
${inner}
</body>
</html>
`;
  }

  function commonplaceFilename(title, ext) {
    const text = oneLine(clip(title, 120)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    return (text || "commonplace-book") + (ext === "md" ? ".md" : ".html");
  }

  function commonplaceFolderFields(state, selectedIds) {
    const selected = new Set();
    (Array.isArray(selectedIds) ? selectedIds : []).forEach((id) => {
      const safe = safeId(id);
      if (safe) selected.add(safe);
    });
    return view(state, "").folders.map((group) => {
      const folder = group.folder;
      const id = "commonplace-folder-" + folder.id;
      const checked = selected.has(folder.id) ? " checked" : "";
      const mark = folder.emoji ? folder.emoji + " " : "";
      const count = group.items.length === 1 ? "1 passage" : group.items.length + " passages";
      return `<label class="check" for="${escapeAttr(id)}"><input type="checkbox" id="${escapeAttr(id)}" name="commonplace-folder" value="${escapeAttr(folder.id)}"${checked} /> <span>${escapeText(mark + folder.name)}</span> <span class="hint">(${escapeText(count)})</span></label>`;
    }).join("");
  }

  return {
    VERSION, STORAGE_KEY, UNSORTED, COLORS, SORTS, KINDS,
    emptyState, normalize, load, save, addItem, updateItem, removeItem,
    createFolder, renameFolder, labelFolder, deleteFolder, moveItem, reorder, orderIds, setSort,
    view, kindLabel, locate, exportText, exportMarkdown, exportJson, importLibrary, findByBlock,
    escapeText, escapeAttr, safeHref, exactText, libraryHtml, colorChoices, folderOptions,
    commonplaceBook, commonplaceMarkdown, commonplaceHtml, commonplaceDocument, commonplaceFilename, commonplaceFolderFields
  };
});
