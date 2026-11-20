(function () {
  const Reader = window.AthenaeumReader;
  if (!Reader) return;

  const $ = (id) => document.getElementById(id);
  let state = Reader.emptyState();
  let blocked = false;
  let memoryOnly = false;
  let pageRoot = null;
  let ctx = { page: "", night: "", title: "", place: "" };
  let pending = null;
  let dialogDraft = null;
  let lastKeyboard = false;

  const loaded = Reader.load(browserStorage());
  state = loaded.state;
  blocked = !!loaded.blocked;
  memoryOnly = !loaded.available;

  const live = document.createElement("p");
  live.id = "reader-live";
  live.className = "reader-live";
  live.setAttribute("role", "status");
  document.body.appendChild(live);

  const toolbar = document.createElement("div");
  toolbar.id = "reader-toolbar";
  toolbar.className = "reader-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Highlight");
  toolbar.hidden = true;
  toolbar.innerHTML = `<button type="button" id="reader-open-save">Save highlight</button><button type="button" id="reader-toolbar-dismiss">Dismiss</button>`;
  document.body.appendChild(toolbar);

  const dialog = document.createElement("dialog");
  dialog.id = "reader-dialog";
  dialog.className = "reader-dialog";
  dialog.innerHTML = `<form id="reader-form">
      <p class="kicker" id="reader-dialog-kicker">Highlight</p>
      <h2 id="reader-dialog-title">Save highlight</h2>
      <blockquote id="reader-dialog-text"></blockquote>
      <p id="reader-dialog-meta" class="meta"></p>
      <fieldset class="reader-colors"><legend>Highlight color</legend><div id="reader-dialog-colors"></div></fieldset>
      <label class="field" for="reader-note">Note</label>
      <textarea id="reader-note" maxlength="2000"></textarea>
      <label class="field" for="reader-folder">Folder</label>
      <select id="reader-folder"></select>
      <div class="row-btns">
        <button type="submit" class="solid" id="reader-dialog-save">Save highlight</button>
        <button type="button" id="reader-dialog-remove" hidden>Remove</button>
        <button type="button" id="reader-dialog-cancel">Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  $("reader-dialog-colors").innerHTML = Reader.colorChoices("amber", "reader-color");

  function browserStorage() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (err) {
      return null;
    }
  }

  function announce(message) {
    live.textContent = message || "";
  }

  function persist() {
    if (blocked) {
      announce("Saved highlights in this browser use a library this page cannot change.");
      return false;
    }
    const result = Reader.save(browserStorage(), state);
    if (!result.ok) {
      memoryOnly = true;
      announce("This browser could not store highlights. They last until you leave the page.");
      return false;
    }
    memoryOnly = false;
    return true;
  }

  function elementOf(node) {
    if (!node) return null;
    return node.nodeType === 1 ? node : node.parentElement;
  }

  function setBlock(el, meta) {
    if (!el || !meta) return;
    const fields = {
      "data-reader-block": meta.block || "",
      "data-reader-kind": meta.kind || "passage",
      "data-reader-speaker": meta.speaker || "",
      "data-reader-work": meta.work || "",
      "data-reader-citation": meta.citation || "",
      "data-reader-edition": meta.edition || "",
      "data-reader-url": meta.url || "",
      "data-reader-night": meta.night || "",
      "data-reader-title": meta.title || "",
      "data-reader-sitting": meta.sitting || "",
      "data-reader-place": meta.place || ""
    };
    Object.keys(fields).forEach((key) => el.setAttribute(key, fields[key]));
    if (meta.claim) el.setAttribute("data-reader-claim", meta.claim);
  }

  function readMeta(el) {
    if (!el) return {};
    return {
      block: el.getAttribute("data-reader-block") || "",
      kind: el.getAttribute("data-reader-kind") || "passage",
      speaker: el.getAttribute("data-reader-speaker") || "",
      work: el.getAttribute("data-reader-work") || "",
      citation: el.getAttribute("data-reader-citation") || "",
      edition: el.getAttribute("data-reader-edition") || "",
      sourceUrl: el.getAttribute("data-reader-url") || "",
      night: el.getAttribute("data-reader-night") || "",
      sittingTitle: el.getAttribute("data-reader-title") || "",
      sittingId: el.getAttribute("data-reader-sitting") || "",
      place: el.getAttribute("data-reader-place") || ""
    };
  }

  function slug(text) {
    let n = 0;
    const value = String(text || "");
    for (let i = 0; i < value.length; i++) n = (n * 33 + value.charCodeAt(i)) >>> 0;
    return n.toString(36);
  }

  function nightFrom(href) {
    const match = /[?&]night=(\d{4}-\d{2}-\d{2})/.exec(String(href || ""));
    return match ? match[1] : "";
  }

  function addQuoteButton(quote, text) {
    let button = quote.nextElementSibling;
    if (!button || !button.classList || !button.classList.contains("reader-save-quote")) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "reader-save-quote reader-chrome";
      quote.insertAdjacentElement("afterend", button);
    }
    button.textContent = "Save quote";
    button.setAttribute("data-reader-save", "quote");
    button.setAttribute("data-reader-text", text);
    Array.prototype.forEach.call(quote.attributes, (attr) => {
      if (attr.name.indexOf("data-reader-") === 0) button.setAttribute(attr.name, attr.value);
    });
    const hint = text.replace(/\s+/g, " ").trim();
    const short = hint.length > 72 ? hint.slice(0, 71).trim() + "…" : hint;
    button.setAttribute("aria-label", "Save quote: " + short);
  }

  function stampQuotes(scope, meta, quotes) {
    scope.querySelectorAll("q.vq").forEach((quote) => {
      const text = quote.textContent;
      const match = (quotes || []).find((row) => row && row.text === text) || null;
      const id = match && match.id ? String(match.id) : slug(text);
      const block = "quote:" + (meta.night || "night") + ":" + id;
      setBlock(quote, {
        block,
        kind: "verbatim",
        speaker: (match && (match.speaker || match.author)) || meta.speaker || "",
        work: (match && match.work) || "",
        citation: (match && match.location) || "",
        edition: (match && match.edition) || "",
        url: (match && (match.source_url || match.sourceUrl)) || "",
        night: meta.night || "",
        title: meta.title || "",
        sitting: meta.sitting || "",
        place: meta.place || ""
      });
      addQuoteButton(quote, text);
    });
  }

  function stampDocket(root, detail) {
    const night = detail.night || "";
    const sittings = detail.sittings || [];
    root.querySelectorAll(".report-story").forEach((article) => {
      const id = String(article.id || "").replace(/^story-/, "");
      const heading = article.querySelector("h4");
      setBlock(article, {
        block: "docket:" + night + ":story:" + id,
        kind: "passage",
        night,
        title: heading ? heading.textContent : (detail.title || ""),
        sitting: id,
        place: night ? "docket.html?night=" + encodeURIComponent(night) + "#story-" + id : ""
      });
    });
    const note = root.querySelector(".report-note");
    if (note) {
      setBlock(note, {
        block: "docket:" + night + ":report-note",
        kind: "passage",
        night,
        title: detail.title || "",
        place: night ? "docket.html?night=" + encodeURIComponent(night) + "#news-report" : ""
      });
    }
    root.querySelectorAll(".docket-sitting").forEach((section) => {
      const sittingId = section.getAttribute("data-sitting") || "";
      const sitting = sittings.find((row) => row && String(row.id) === sittingId) || {};
      const heading = section.querySelector("h3");
      const title = (heading && heading.textContent) || sitting.headline || sitting.question || "";
      const place = night ? "docket.html?night=" + encodeURIComponent(night) + "#sitting-" + sittingId : "";
      const quotes = (sitting.quotes || []).slice();
      (sitting.chairs || []).forEach((chair) => {
        (chair.quotes || []).forEach((quote) => quotes.push(quote));
      });
      const base = { night, title, sitting: sittingId, place };
      section.querySelectorAll(".docket-setup .passage, .docket-question, .why-chairs").forEach((node, index) => {
        setBlock(node, Object.assign({ block: "docket:" + night + ":" + sittingId + ":frame:" + index, kind: "passage", speaker: node.classList.contains("passage") ? "Moderator" : "" }, base));
        if (node.classList.contains("passage")) stampQuotes(node, Object.assign({ speaker: "Moderator" }, base), quotes);
      });
      section.querySelectorAll(".docket-turn").forEach((turn, turnIndex) => {
        const speaker = turn.getAttribute("data-speaker") || "";
        turn.querySelectorAll(":scope > p.passage").forEach((paragraph, index) => {
          setBlock(paragraph, Object.assign({
            block: "docket:" + night + ":" + sittingId + ":turn:" + turnIndex + ":p:" + index,
            kind: "passage",
            speaker
          }, base));
          stampQuotes(paragraph, Object.assign({ speaker }, base), quotes);
        });
        const modern = turn.querySelector(":scope > .modern-read");
        if (modern) {
          setBlock(modern, Object.assign({
            block: "docket:" + night + ":" + sittingId + ":modern:" + turnIndex,
            kind: "paraphrase",
            speaker
          }, base));
        }
      });
    });
  }

  function stampChair(root, detail) {
    const quotes = detail.quotes || [];
    root.querySelectorAll(".chair-quote").forEach((row) => {
      const quote = row.querySelector("q.vq");
      if (!quote) return;
      const text = quote.textContent;
      const match = quotes.find((item) => item && item.text === text) || {};
      const href = typeof match.href === "string" ? match.href : "";
      const night = nightFrom(href);
      const id = match.id ? String(match.id) : slug(text);
      setBlock(quote, {
        block: "quote:" + (night || "chair") + ":" + id,
        kind: "verbatim",
        speaker: match.speaker || match.author || detail.speaker || "",
        work: match.work || "",
        citation: match.location || "",
        edition: match.edition || "",
        url: match.source_url || "",
        night,
        title: match.label || detail.speaker || "",
        sitting: "",
        place: href
      });
      addQuoteButton(quote, text);
    });
  }

  function textNodes(block) {
    const nodes = [];
    if (!block) return nodes;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("button, script, style, .reader-chrome")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function blockPlain(block) {
    return textNodes(block).map((node) => node.nodeValue).join("");
  }

  function unwrap(root) {
    root.querySelectorAll("mark.reader-hl").forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    if (root.normalize) root.normalize();
  }

  function splitWrap(textNode, start, end, mark) {
    const value = textNode.nodeValue || "";
    const before = value.slice(0, start);
    const mid = value.slice(start, end);
    const after = value.slice(end);
    mark.textContent = mid;
    const parent = textNode.parentNode;
    if (before) parent.insertBefore(document.createTextNode(before), textNode);
    parent.insertBefore(mark, textNode);
    if (after) textNode.nodeValue = after;
    else parent.removeChild(textNode);
    return mark;
  }

  function wrapRange(block, range) {
    const nodes = textNodes(block);
    let offset = 0;
    const hits = [];
    nodes.forEach((node) => {
      const len = node.nodeValue.length;
      const start = Math.max(range.start, offset);
      const end = Math.min(range.end, offset + len);
      if (start < end) hits.push({ node, start: start - offset, end: end - offset });
      offset += len;
    });
    let first = null;
    for (let i = hits.length - 1; i >= 0; i--) {
      const mark = document.createElement("mark");
      mark.className = "reader-hl reader-hl-" + (range.color || "amber");
      mark.dataset.hl = range.id;
      if (i === 0 && !document.getElementById("saved-" + range.id)) {
        mark.id = "saved-" + range.id;
        mark.tabIndex = 0;
        mark.setAttribute("role", "button");
        mark.setAttribute("aria-label", "Saved highlight. Activate to edit or remove it.");
        first = mark;
      }
      splitWrap(hits[i].node, hits[i].start, hits[i].end, mark);
    }
    return first;
  }

  function paint(root) {
    if (!root) return;
    unwrap(root);
    root.querySelectorAll("[data-reader-block]").forEach((block) => {
      const key = block.getAttribute("data-reader-block");
      if (!key) return;
      const plain = blockPlain(block);
      const ranges = state.items.filter((item) => item.block === key).map((item) => {
        const found = Reader.locate(plain, item.text, item.start);
        if (!found) return null;
        return { start: found.start, end: found.end, id: item.id, color: item.color || "amber", length: item.text.length };
      }).filter(Boolean);
      ranges.sort((a, b) => b.length - a.length || a.start - b.start);
      ranges.forEach((range) => wrapRange(block, range));
    });
    syncQuoteButtons(root);
  }

  function syncQuoteButtons(root) {
    root.querySelectorAll("[data-reader-save='quote']").forEach((button) => {
      const text = button.getAttribute("data-reader-text") || "";
      const block = button.getAttribute("data-reader-block") || "";
      const saved = state.items.some((item) => item.block === block && item.text === text);
      button.textContent = saved ? "Remove saved quote" : "Save quote";
      button.setAttribute("aria-pressed", saved ? "true" : "false");
      const hint = text.replace(/\s+/g, " ").trim();
      const short = hint.length > 72 ? hint.slice(0, 71).trim() + "…" : hint;
      button.setAttribute("aria-label", (saved ? "Remove saved quote: " : "Save quote: ") + short);
    });
  }

  function unhide(node) {
    let el = node;
    while (el) {
      if (el.hidden) el.hidden = false;
      el = el.parentElement;
    }
  }

  function revealHash() {
    const hash = String(location.hash || "").replace(/^#/, "");
    if (hash.indexOf("saved-") !== 0) return;
    const mark = document.getElementById(hash);
    if (mark) {
      unhide(mark);
      if (mark.scrollIntoView) mark.scrollIntoView({ block: "center" });
      return;
    }
    const id = hash.replace(/^saved-/, "");
    const item = state.items.find((row) => row.id === id);
    if (!item || !item.place) return;
    const frag = item.place.split("#")[1];
    const anchor = frag ? document.getElementById(frag) : null;
    if (anchor && anchor.scrollIntoView) {
      unhide(anchor);
      anchor.scrollIntoView({ block: "center" });
    }
  }

  function hrefFor(id, place) {
    const base = String(place || "").split("#")[0] || (ctx.page === "home" ? "index.html" : "docket.html");
    return base + "#saved-" + id;
  }

  function blockForRange(range) {
    const startEl = elementOf(range.startContainer);
    const endEl = elementOf(range.endContainer);
    const startBlock = startEl && startEl.closest("[data-reader-block]");
    const endBlock = endEl && endEl.closest("[data-reader-block]");
    if (startBlock && endBlock) {
      if (startBlock === endBlock) return startBlock;
      if (startBlock.contains(endBlock)) return startBlock;
      if (endBlock.contains(startBlock)) return endBlock;
    }
    const host = elementOf(range.commonAncestorContainer);
    return host && host.closest("[data-reader-block]");
  }

  function selectionText(range) {
    const frag = range.cloneContents();
    frag.querySelectorAll("button, script, style, .reader-chrome").forEach((node) => node.remove());
    return frag.textContent || "";
  }

  function offsetOf(block, container, offset) {
    const probe = document.createRange();
    probe.selectNodeContents(block);
    probe.setEnd(container, offset);
    const frag = probe.cloneContents();
    frag.querySelectorAll("button, script, style, .reader-chrome").forEach((node) => node.remove());
    return (frag.textContent || "").length;
  }

  function metaFor(range, block, text) {
    const startEl = elementOf(range.startContainer);
    const quote = startEl && startEl.closest("q.vq");
    let meta;
    if (quote && block.contains(quote) && quote.contains(range.startContainer) && quote.contains(range.endContainer)) {
      meta = readMeta(quote);
      meta.kind = "verbatim";
      if (!meta.block) meta.block = block.getAttribute("data-reader-block") || "";
    } else {
      const modern = startEl && startEl.closest(".modern-read");
      if (modern && (modern === block || block.contains(modern) || modern.contains(range.endContainer))) {
        meta = readMeta(modern.closest("[data-reader-block]") || block);
        meta.kind = "paraphrase";
      } else {
        meta = readMeta(block);
        const claim = block.getAttribute("data-reader-claim") || "";
        if (claim && text === claim) meta.kind = "verbatim";
        else meta.kind = meta.kind === "paraphrase" ? "paraphrase" : "passage";
        if (block.closest(".modern-read")) meta.kind = "paraphrase";
      }
    }
    if (meta.kind !== "verbatim") {
      meta.work = "";
      meta.citation = "";
      meta.edition = "";
      meta.sourceUrl = "";
    }
    return meta;
  }

  function capture() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    if (!pageRoot) return null;
    const range = selection.getRangeAt(0);
    if (!pageRoot.contains(range.commonAncestorContainer)) return null;
    const block = blockForRange(range);
    if (!block || !pageRoot.contains(block)) return null;
    const text = selectionText(range);
    if (!text.trim()) return null;
    let start = 0;
    try { start = offsetOf(block, range.startContainer, range.startOffset); } catch (err) { start = 0; }
    const meta = metaFor(range, block, text);
    return { text, start, meta, range };
  }

  function hideToolbar() {
    toolbar.hidden = true;
    pending = null;
  }

  function showToolbar(snapshot) {
    pending = snapshot;
    toolbar.hidden = false;
    const rect = snapshot.range.getBoundingClientRect();
    const top = Math.max(8, rect.bottom + 8);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 280));
    toolbar.style.top = top + "px";
    toolbar.style.left = left + "px";
  }

  function openDialog(draft) {
    dialogDraft = draft;
    $("reader-dialog-text").textContent = draft.text;
    const paraphrase = draft.kind === "paraphrase";
    $("reader-dialog-kicker").textContent = paraphrase ? "Paraphrase, not a quotation." : Reader.kindLabel(draft.kind);
    $("reader-dialog-title").textContent = draft.id ? "Saved highlight" : "Save highlight";
    const bits = [draft.speaker, draft.work, draft.citation, draft.night].filter(Boolean);
    $("reader-dialog-meta").textContent = bits.join(" · ");
    $("reader-note").value = draft.note || "";
    $("reader-dialog-colors").innerHTML = Reader.colorChoices(draft.color || "amber", "reader-color");
    $("reader-folder").innerHTML = Reader.folderOptions(state, draft.folderId || Reader.UNSORTED);
    $("reader-dialog-save").textContent = draft.id ? "Save changes" : "Save highlight";
    $("reader-dialog-remove").hidden = !draft.id;
    if (typeof dialog.showModal === "function") dialog.showModal();
    $("reader-note").focus();
  }

  function saveDraft(draft, extra) {
    if (draft.id) {
      const updated = Reader.updateItem(state, draft.id, extra);
      state = updated.state;
      persist();
      if (pageRoot) paint(pageRoot);
      announce("Saved the changes.");
      return;
    }
    const added = Reader.addItem(state, Object.assign({}, draft, extra));
    if (!added.item) {
      announce("Select a passage to save.");
      return;
    }
    state = added.state;
    const href = hrefFor(added.item.id, added.item.place || draft.place);
    state = Reader.updateItem(state, added.item.id, { href }).state;
    persist();
    if (pageRoot) paint(pageRoot);
    announce(added.item.kind === "verbatim" ? "Saved quote." : "Saved highlight.");
  }

  function chosenColor() {
    const picked = dialog.querySelector("input[name='reader-color']:checked");
    return picked ? picked.value : "amber";
  }

  toolbar.addEventListener("mousedown", (event) => event.preventDefault());
  $("reader-open-save").addEventListener("click", () => {
    const snapshot = pending || capture();
    if (!snapshot) {
      announce("Select text in the sitting, then save the highlight.");
      return;
    }
    hideToolbar();
    openDialog({
      text: snapshot.text,
      start: snapshot.start,
      kind: snapshot.meta.kind || "passage",
      speaker: snapshot.meta.speaker || "",
      work: snapshot.meta.work || "",
      citation: snapshot.meta.citation || "",
      edition: snapshot.meta.edition || "",
      sourceUrl: snapshot.meta.sourceUrl || "",
      night: snapshot.meta.night || "",
      sittingTitle: snapshot.meta.sittingTitle || "",
      sittingId: snapshot.meta.sittingId || "",
      place: snapshot.meta.place || "",
      block: snapshot.meta.block || "",
      color: "amber",
      note: "",
      folderId: Reader.UNSORTED
    });
  });
  $("reader-toolbar-dismiss").addEventListener("click", hideToolbar);

  $("reader-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!dialogDraft) return;
    saveDraft(dialogDraft, {
      note: $("reader-note").value,
      color: chosenColor(),
      folderId: $("reader-folder").value
    });
    dialog.close();
    dialogDraft = null;
  });
  $("reader-dialog-cancel").addEventListener("click", () => {
    dialog.close();
    dialogDraft = null;
  });
  $("reader-dialog-remove").addEventListener("click", () => {
    if (!dialogDraft || !dialogDraft.id) return;
    state = Reader.removeItem(state, dialogDraft.id).state;
    persist();
    if (pageRoot) paint(pageRoot);
    dialog.close();
    announce("Removed the saved highlight.");
    dialogDraft = null;
  });

  document.addEventListener("selectionchange", () => {
    const snapshot = capture();
    if (!snapshot) {
      if (!toolbar.hidden && document.activeElement && toolbar.contains(document.activeElement)) return;
      toolbar.hidden = true;
      pending = null;
      return;
    }
    showToolbar(snapshot);
  });

  document.addEventListener("keyup", (event) => {
    if (!pending || toolbar.hidden) return;
    if (event.key !== "Shift" && !event.shiftKey) return;
    if (!lastKeyboard) return;
    const button = $("reader-open-save");
    if (button && document.activeElement !== button) button.focus();
  });

  document.addEventListener("keydown", (event) => {
    lastKeyboard = true;
    const mark = event.target && event.target.closest && event.target.closest("mark.reader-hl");
    if (!mark) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    editMark(mark.getAttribute("data-hl"));
  });

  document.addEventListener("pointerdown", () => { lastKeyboard = false; });

  document.addEventListener("click", (event) => {
    const button = event.target.closest && event.target.closest("[data-reader-save='quote']");
    if (button) {
      event.preventDefault();
      toggleQuote(button);
      return;
    }
    const mark = event.target.closest && event.target.closest("mark.reader-hl");
    if (!mark) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    editMark(mark.getAttribute("data-hl"));
  });

  function toggleQuote(button) {
    const text = button.getAttribute("data-reader-text") || "";
    const block = button.getAttribute("data-reader-block") || "";
    const existing = Reader.findByBlock(state, block, text);
    if (existing) {
      state = Reader.removeItem(state, existing.id).state;
      persist();
      if (pageRoot) paint(pageRoot);
      announce("Removed the saved quote.");
      return;
    }
    const added = Reader.addItem(state, {
      text,
      kind: "verbatim",
      color: "amber",
      speaker: button.getAttribute("data-reader-speaker") || "",
      work: button.getAttribute("data-reader-work") || "",
      citation: button.getAttribute("data-reader-citation") || "",
      edition: button.getAttribute("data-reader-edition") || "",
      sourceUrl: button.getAttribute("data-reader-url") || "",
      night: button.getAttribute("data-reader-night") || "",
      sittingTitle: button.getAttribute("data-reader-title") || "",
      sittingId: button.getAttribute("data-reader-sitting") || "",
      place: button.getAttribute("data-reader-place") || "",
      block,
      start: 0
    });
    if (!added.item) return;
    state = added.state;
    state = Reader.updateItem(state, added.item.id, { href: hrefFor(added.item.id, added.item.place) }).state;
    persist();
    if (pageRoot) paint(pageRoot);
    announce("Saved quote.");
  }

  function editMark(id) {
    const item = state.items.find((row) => row.id === id);
    if (!item) return;
    openDialog(Object.assign({}, item));
  }

  function sync(detail) {
    const next = detail || {};
    pageRoot = next.root || pageRoot;
    ctx = {
      page: next.page || "",
      night: next.night || "",
      title: next.title || "",
      place: next.place || ""
    };
    if (!pageRoot) return;
    if (next.page === "docket") stampDocket(pageRoot, next);
    else if (next.page === "chair") stampChair(pageRoot, next);
    paint(pageRoot);
    revealHash();
    if (memoryOnly) announce("Saving in this browser is unavailable. Highlights last until you leave the page.");
    else if (blocked) announce("Saved highlights in this browser use a library this page cannot change.");
  }

  function hasEncounter(id) {
    return state.items.some((item) => item.block === "encounter:" + id);
  }

  function toggleEncounter(input) {
    const source = input && typeof input === "object" ? input : {};
    if (!source.block || !source.text) return { saved: false };
    if (blocked) {
      announce("Saved highlights in this browser use a library this page cannot change.");
      return { saved: false, blocked: true };
    }
    const existing = state.items.find((item) => item.block === source.block);
    if (existing) {
      state = Reader.removeItem(state, existing.id).state;
      persist();
      announce("Removed from Saved.");
      return { saved: false };
    }
    const added = Reader.addItem(state, source);
    if (!added.item) {
      announce("That suggestion could not be saved.");
      return { saved: false };
    }
    state = added.state;
    persist();
    announce("Saved to your folder.");
    return { saved: true, id: added.item.id };
  }

  window.AthenaeumReaderUI = { sync, paint, announce, toggleEncounter, hasEncounter };
})();
