(function () {
  const Reader = window.AthenaeumReader;
  if (!Reader) return;
  const $ = (id) => document.getElementById(id);
  let state = Reader.emptyState();
  let blocked = false;
  let memoryOnly = false;
  let loadError = "";
  let query = "";
  let drag = null;

  const loaded = Reader.load(browserStorage());
  state = loaded.state;
  blocked = !!loaded.blocked;
  memoryOnly = !loaded.available;
  loadError = loaded.error || "";

  const folderDialog = document.createElement("dialog");
  folderDialog.className = "reader-dialog";
  folderDialog.innerHTML = `<form id="reader-folder-form">
      <p class="kicker">Folder</p>
      <h2 id="reader-folder-title">New folder</h2>
      <label class="field" for="reader-folder-name">Name</label>
      <input id="reader-folder-name" type="text" maxlength="80" />
      <fieldset class="reader-colors"><legend>Color</legend><div id="reader-folder-colors"></div></fieldset>
      <label class="field" for="reader-folder-emoji">Emoji label</label>
      <input id="reader-folder-emoji" type="text" maxlength="8" placeholder="Optional" />
      <div class="row-btns">
        <button type="submit" class="solid" id="reader-folder-save">Create folder</button>
        <button type="button" id="reader-folder-cancel">Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(folderDialog);

  let folderMode = { type: "create", id: "" };

  function browserStorage() {
    try { return localStorage; } catch (err) { return null; }
  }

  function announce(message) {
    const node = $("reader-status");
    if (node) node.textContent = message;
  }

  function baseStatus() {
    const count = state.items.length;
    const folders = state.folders.length;
    let text = (count === 1 ? "1 saved passage" : count + " saved passages") + " in " + folders + (folders === 1 ? " folder." : " folders.");
    if (memoryOnly) text += " Saving in this browser is unavailable. Highlights last until you leave the page.";
    else if (blocked) text += " This library uses a version this page cannot change.";
    else if (loadError === "unreadable") text += " An unreadable copy was set aside. A new save replaces it.";
    return text;
  }

  function persist() {
    if (blocked) {
      announce("This library uses a version this page cannot change.");
      return false;
    }
    const result = Reader.save(browserStorage(), state);
    if (!result.ok) {
      memoryOnly = true;
      announce("This browser could not store highlights. They last until you leave the page.");
      return false;
    }
    memoryOnly = false;
    loadError = "";
    return true;
  }

  function fillSorts() {
    const folderSort = $("reader-sort-folders");
    const itemSort = $("reader-sort-items");
    const options = Reader.SORTS.map((row) => `<option value="${Reader.escapeAttr(row.id)}">${Reader.escapeText(row.label)}</option>`).join("");
    folderSort.innerHTML = options;
    itemSort.innerHTML = options;
    folderSort.value = state.sort.folders;
    itemSort.value = state.sort.items;
  }

  function render(focusSelector) {
    const host = $("reader-library");
    if (!host) return;
    host.innerHTML = Reader.libraryHtml(state, query);
    refreshCommonplaceFolders();
    refreshCommonplacePreview();
    announce(baseStatus());
    if (!focusSelector) return;
    const node = document.querySelector(focusSelector);
    if (node && node.focus) node.focus();
  }

  function visualIds(selector, root) {
    return Array.prototype.map.call((root || document).querySelectorAll(selector), (node) => node.getAttribute("data-folder") || node.getAttribute("data-item"));
  }

  function moveInList(ids, id, direction) {
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return null;
    const copy = ids.slice();
    const swapped = copy[index];
    copy[index] = copy[next];
    copy[next] = swapped;
    return copy;
  }

  function setFieldHidden(id, hidden) {
    const node = $(id);
    node.hidden = hidden;
    const label = folderDialog.querySelector("label[for='" + id + "']");
    if (label) label.hidden = hidden;
  }

  function openFolderDialog(mode) {
    folderMode = mode;
    const folder = mode.id ? state.folders.find((row) => row.id === mode.id) : null;
    $("reader-folder-title").textContent = mode.type === "rename" ? "Rename folder" : (mode.type === "label" ? "Folder label" : "New folder");
    $("reader-folder-save").textContent = mode.type === "create" ? "Create folder" : "Save";
    $("reader-folder-name").value = folder ? folder.name : "";
    $("reader-folder-name").disabled = mode.type === "label" || (folder && folder.id === Reader.UNSORTED);
    $("reader-folder-emoji").value = folder ? folder.emoji : "";
    $("reader-folder-colors").innerHTML = Reader.colorChoices((folder && folder.color) || "amber", "folder-color");
    setFieldHidden("reader-folder-name", mode.type === "label");
    setFieldHidden("reader-folder-emoji", mode.type === "rename");
    $("reader-folder-colors").closest("fieldset").hidden = mode.type === "rename";
    if (typeof folderDialog.showModal === "function") folderDialog.showModal();
    const focus = mode.type === "label" ? $("reader-folder-emoji") : $("reader-folder-name");
    if (focus && !focus.disabled) focus.focus();
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const button = $("theme");
    if (!button) return;
    button.textContent = dark ? "Light" : "Dark";
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    try { localStorage.setItem("athenaeum.theme", dark ? "dark" : "light"); } catch (err) { /* ignore */ }
  }

  fillSorts();
  render();

  const theme = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
  const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(theme === "dark" || theme === "light" ? theme : prefer);
  $("theme").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  $("reader-search").addEventListener("input", () => {
    query = $("reader-search").value;
    render();
  });
  $("reader-sort-folders").addEventListener("change", () => {
    state = Reader.setSort(state, "folders", $("reader-sort-folders").value).state;
    persist();
    render();
  });
  $("reader-sort-items").addEventListener("change", () => {
    state = Reader.setSort(state, "items", $("reader-sort-items").value).state;
    persist();
    render();
  });
  $("reader-new-folder").addEventListener("click", () => openFolderDialog({ type: "create", id: "" }));
  $("reader-folder-cancel").addEventListener("click", () => folderDialog.close());
  $("reader-folder-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const colorNode = folderDialog.querySelector("input[name='folder-color']:checked");
    const color = colorNode ? colorNode.value : "";
    const emoji = $("reader-folder-emoji").value;
    const name = $("reader-folder-name").value;
    if (folderMode.type === "create") {
      const created = Reader.createFolder(state, { name, color, emoji });
      if (!created.folder) {
        announce("Give the folder a name.");
        return;
      }
      state = created.state;
    } else if (folderMode.type === "rename") {
      const renamed = Reader.renameFolder(state, folderMode.id, name);
      if (renamed.error) {
        announce(renamed.error === "locked" ? "Unsorted keeps its name." : "Give the folder a name.");
        return;
      }
      state = renamed.state;
    } else {
      const labeled = Reader.labelFolder(state, folderMode.id, { color, emoji });
      if (!labeled.folder) return;
      state = labeled.state;
    }
    persist();
    folderDialog.close();
    render();
  });

  $("reader-export-json").addEventListener("click", () => download("athenaeum-saved.json", Reader.exportJson(state), "application/json"));
  $("reader-export-text").addEventListener("click", () => download("athenaeum-saved.txt", Reader.exportText(state), "text/plain"));
  $("reader-export-md").addEventListener("click", () => download("athenaeum-saved.md", Reader.exportMarkdown(state), "text/markdown"));
  $("reader-import").addEventListener("click", () => $("reader-import-file").click());
  $("reader-import-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    let text = "";
    try { text = await file.text(); } catch (err) { text = ""; }
    const imported = Reader.importLibrary(state, text);
    if (imported.error) {
      announce(imported.error === "version" ? "That file uses a library version this page cannot read." : "That file could not be read as saved highlights.");
      return;
    }
    state = imported.state;
    persist();
    fillSorts();
    render();
    announce("Imported " + imported.added.items + " passages and " + imported.added.folders + " folders. Nothing already saved was deleted.");
  });

  $("reader-library").addEventListener("click", (event) => {
    const rename = event.target.closest("[data-rename]");
    if (rename) {
      openFolderDialog({ type: "rename", id: rename.getAttribute("data-rename") });
      return;
    }
    const label = event.target.closest("[data-label]");
    if (label) {
      openFolderDialog({ type: "label", id: label.getAttribute("data-label") });
      return;
    }
    const removeFolder = event.target.closest("[data-delete-folder]");
    if (removeFolder) {
      const id = removeFolder.getAttribute("data-delete-folder");
      const folder = state.folders.find((row) => row.id === id);
      const name = folder ? folder.name : "this folder";
      if (!window.confirm("Delete " + name + "? Passages in it move to Unsorted.")) return;
      const removed = Reader.deleteFolder(state, id);
      if (removed.error) {
        announce("Unsorted stays on the page.");
        return;
      }
      state = removed.state;
      persist();
      render();
      announce("Deleted the folder. Its passages are in Unsorted.");
      return;
    }
    const folderMove = event.target.closest("[data-move-folder]");
    if (folderMove) {
      if (query.trim()) {
        announce("Clear the search before reordering folders.");
        return;
      }
      const id = folderMove.getAttribute("data-folder-id");
      const direction = folderMove.getAttribute("data-move-folder") === "up" ? -1 : 1;
      const ids = visualIds(":scope > [data-folder]", $("reader-library"));
      const next = moveInList(ids, id, direction);
      if (!next) return;
      state = Reader.orderIds(state, "folder", next).state;
      persist();
      fillSorts();
      render("[data-folder-id='" + id + "'][data-move-folder='" + (direction < 0 ? "up" : "down") + "']");
      return;
    }
    const itemMove = event.target.closest("[data-move-item-order]");
    if (itemMove) {
      if (query.trim()) {
        announce("Clear the search before reordering passages.");
        return;
      }
      const id = itemMove.getAttribute("data-item-id");
      const direction = itemMove.getAttribute("data-move-item-order") === "up" ? -1 : 1;
      const section = itemMove.closest("[data-folder]");
      const ids = visualIds("[data-item]", section);
      const next = moveInList(ids, id, direction);
      if (!next) return;
      state = Reader.orderIds(state, "item", next, section.getAttribute("data-folder")).state;
      persist();
      fillSorts();
      render("#saved-" + id + " [data-move-item-order='" + (direction < 0 ? "up" : "down") + "']");
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      state = Reader.removeItem(state, remove.getAttribute("data-remove")).state;
      persist();
      render();
      announce("Removed the saved passage.");
      return;
    }
    const save = event.target.closest("[data-save-item]");
    if (save) {
      const id = save.getAttribute("data-save-item");
      const note = document.querySelector("[data-note='" + id + "']");
      const color = document.querySelector("input[name='color-" + id + "']:checked");
      state = Reader.updateItem(state, id, {
        note: note ? note.value : "",
        color: color ? color.value : "amber"
      }).state;
      persist();
      render("#saved-" + id + " [data-save-item]");
      announce("Saved the changes.");
    }
  });

  $("reader-library").addEventListener("change", (event) => {
    const select = event.target.closest("[data-move-item]");
    if (!select) return;
    const id = select.getAttribute("data-move-item");
    state = Reader.moveItem(state, id, select.value).state;
    persist();
    render("#move-" + id);
    announce("Moved the passage.");
  });

  $("reader-library").addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-drag]");
    if (!handle) return;
    drag = {
      id: handle.getAttribute("data-drag"),
      type: handle.getAttribute("data-drag-type"),
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
    if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  $("reader-library").addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const info = drag;
    drag = null;
    if (Math.abs(event.clientX - info.x) + Math.abs(event.clientY - info.y) < 8) return;
    if (query.trim()) {
      announce("Clear the search before reordering.");
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target) return;
    if (info.type === "folder") {
      const folder = target.closest("[data-folder]");
      if (!folder || folder.getAttribute("data-folder") === info.id) return;
      const ids = visualIds(":scope > [data-folder]", $("reader-library"));
      const from = ids.indexOf(info.id);
      const to = ids.indexOf(folder.getAttribute("data-folder"));
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, info.id);
      state = Reader.orderIds(state, "folder", ids).state;
    } else {
      const item = target.closest("[data-item]");
      const folder = target.closest("[data-folder]");
      if (!folder) return;
      const folderId = folder.getAttribute("data-folder");
      const ids = visualIds("[data-item]", folder).filter((id) => id !== info.id);
      if (item && item.getAttribute("data-item") !== info.id) {
        const at = ids.indexOf(item.getAttribute("data-item"));
        ids.splice(at < 0 ? ids.length : at, 0, info.id);
      } else ids.push(info.id);
      state = Reader.orderIds(state, "item", ids, folderId).state;
    }
    persist();
    fillSorts();
    render();
    announce("Order saved.");
  });

  function checkedValues(selector) {
    return Array.prototype.map.call(document.querySelectorAll(selector), (node) => node.value);
  }

  function commonplaceOptions(withBase) {
    const scopeNode = document.querySelector("input[name='commonplace-scope']:checked");
    const groupNode = document.querySelector("input[name='commonplace-group']:checked");
    const options = {
      scope: scopeNode ? scopeNode.value : "all",
      groupBy: groupNode ? groupNode.value : "folder",
      folderIds: checkedValues("input[name='commonplace-folder']:checked"),
      title: $("commonplace-title") ? $("commonplace-title").value : "",
      epigraph: $("commonplace-epigraph") ? $("commonplace-epigraph").value : ""
    };
    if (withBase) options.baseUrl = new URL("./", window.location.href).href;
    return options;
  }

  function refreshCommonplaceFolders() {
    const box = $("commonplace-folders");
    if (!box || !Reader.commonplaceFolderFields) return;
    const selected = checkedValues("#commonplace-folders input:checked");
    box.innerHTML = Reader.commonplaceFolderFields(state, selected);
  }

  function syncCommonplaceScope() {
    const selected = document.querySelector("input[name='commonplace-scope']:checked");
    const box = $("commonplace-folders");
    if (!box) return;
    box.hidden = !selected || selected.value !== "folders";
  }

  function refreshCommonplacePreview() {
    const host = $("commonplace-preview-host");
    if (!host || host.hidden || !Reader.commonplaceHtml) return;
    host.innerHTML = Reader.commonplaceHtml(state, commonplaceOptions(false));
  }

  function openCommonplacePreview() {
    const host = $("commonplace-preview-host");
    if (!host) return null;
    const options = commonplaceOptions(false);
    host.hidden = false;
    host.innerHTML = Reader.commonplaceHtml(state, options);
    const book = Reader.commonplaceBook(state, options);
    const article = host.querySelector(".commonplace-book");
    if (article && article.focus) article.focus();
    if (host.scrollIntoView) host.scrollIntoView({ behavior: "smooth", block: "start" });
    announce(book.message || ("Commonplace book ready. " + book.count + (book.count === 1 ? " passage." : " passages.")));
    return book;
  }

  const commonplaceForm = $("commonplace-form");
  if (commonplaceForm) {
    syncCommonplaceScope();
    commonplaceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      openCommonplacePreview();
    });
    commonplaceForm.addEventListener("change", (event) => {
      const name = event.target && event.target.name;
      if (name === "commonplace-scope") syncCommonplaceScope();
      if (!$("commonplace-preview-host").hidden) refreshCommonplacePreview();
    });
    commonplaceForm.addEventListener("input", (event) => {
      const id = event.target && event.target.id;
      if (id !== "commonplace-title" && id !== "commonplace-epigraph") return;
      if (!$("commonplace-preview-host").hidden) refreshCommonplacePreview();
    });
    $("commonplace-print").addEventListener("click", () => {
      openCommonplacePreview();
      document.body.classList.add("commonplace-printing");
      const cleanup = () => {
        document.body.classList.remove("commonplace-printing");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      try { window.print(); } catch (err) { cleanup(); }
    });
    $("commonplace-html").addEventListener("click", () => {
      const options = commonplaceOptions(true);
      const book = Reader.commonplaceBook(state, options);
      download(Reader.commonplaceFilename(book.title, "html"), Reader.commonplaceDocument(state, options), "text/html");
      announce(book.message || "Downloaded the commonplace book as HTML.");
    });
    $("commonplace-md").addEventListener("click", () => {
      const options = commonplaceOptions(true);
      const book = Reader.commonplaceBook(state, options);
      download(Reader.commonplaceFilename(book.title, "md"), Reader.commonplaceMarkdown(state, options), "text/markdown");
      announce(book.message || "Downloaded the commonplace book as Markdown.");
    });
  }

  const commonplaceJump = $("reader-commonplace");
  if (commonplaceJump) {
    commonplaceJump.addEventListener("click", () => {
      const section = $("commonplace");
      if (section && section.scrollIntoView) section.scrollIntoView({ behavior: "smooth", block: "start" });
      const title = $("commonplace-title");
      if (title && title.focus) title.focus();
    });
  }
})();
