(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumKeys = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SPACE_TURN_KEY = "athenaeum.spaceTurn";
  const FIELD_TAGS = { input: 1, textarea: 1, select: 1, button: 1, a: 1, summary: 1, audio: 1, video: 1 };
  const FIELD_ROLES = {
    textbox: 1,
    searchbox: 1,
    combobox: 1,
    button: 1,
    link: 1,
    listbox: 1,
    slider: 1,
    spinbutton: 1
  };

  function readSpaceTurn(storage) {
    try {
      if (!storage || typeof storage.getItem !== "function") return false;
      return storage.getItem(SPACE_TURN_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function writeSpaceTurn(storage, on) {
    try {
      if (!storage || typeof storage.setItem !== "function") return false;
      storage.setItem(SPACE_TURN_KEY, on ? "1" : "0");
      return true;
    } catch (err) {
      return false;
    }
  }

  function isSpaceEvent(event) {
    if (!event) return false;
    const key = event.key;
    if (key === " " || key === "Spacebar") return true;
    if (event.code !== "Space") return false;
    return key == null || key === "" || key === "Unidentified";
  }

  function tagName(node) {
    return String(node && node.tagName || "").toLowerCase();
  }

  function roleOf(node) {
    if (!node) return "";
    if (typeof node.getAttribute === "function") return String(node.getAttribute("role") || "");
    return String(node.role || "");
  }

  function isEditableHost(node) {
    if (!node) return false;
    if (node.isContentEditable) return true;
    if (typeof node.getAttribute !== "function") return false;
    const value = node.getAttribute("contenteditable");
    if (value == null) return false;
    const flag = String(value).toLowerCase();
    return flag === "" || flag === "true" || flag === "plaintext-only";
  }

  function isFieldElement(node) {
    if (!node) return false;
    if (FIELD_TAGS[tagName(node)]) return true;
    if (FIELD_ROLES[roleOf(node).toLowerCase()]) return true;
    return isEditableHost(node);
  }

  function isTypingTarget(target) {
    let node = target;
    while (node) {
      if (isFieldElement(node)) return true;
      node = node.parentElement || null;
    }
    return false;
  }

  function isInOverlay(target) {
    let node = target;
    while (node) {
      const role = roleOf(node).toLowerCase();
      const modal = typeof node.getAttribute === "function" && node.getAttribute("aria-modal") === "true";
      if (tagName(node) === "dialog" || role === "dialog" || role === "alertdialog" || modal) return true;
      node = node.parentElement || null;
    }
    return false;
  }

  function overlayOpen(doc) {
    try {
      if (!doc || typeof doc.querySelector !== "function") return false;
      return !!doc.querySelector("dialog[open], [aria-modal='true']");
    } catch (err) {
      return false;
    }
  }

  function spaceShouldAdvance(event, opts) {
    opts = opts || {};
    if (!opts.enabled) return false;
    if (!isSpaceEvent(event)) return false;
    if (event.defaultPrevented) return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || event.keyCode === 229) return false;
    if (opts.dialogOpen) return false;
    if (isTypingTarget(event.target)) return false;
    if (isInOverlay(event.target)) return false;
    return true;
  }

  function chooseSitting(sittings, view) {
    if (!Array.isArray(sittings) || !sittings.length) return null;
    const viewTop = view && Number.isFinite(view.top) ? view.top : 0;
    const viewBottom = view && Number.isFinite(view.bottom) ? view.bottom : viewTop;
    const list = sittings.filter((sitting) => sitting && sitting.id != null && String(sitting.id) !== "");
    if (!list.length) return null;
    const focused = list.find((sitting) => sitting.focused);
    let chosen = focused || null;
    if (!chosen) {
      const probe = viewTop + Math.min(96, Math.max(0, viewBottom - viewTop) * 0.2);
      const ordered = list.slice().sort((a, b) => {
        const at = Number(a.top);
        const bt = Number(b.top);
        if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
        if (!Number.isFinite(at)) return 1;
        if (!Number.isFinite(bt)) return -1;
        return at - bt;
      });
      let started = null;
      ordered.forEach((sitting) => {
        const top = Number(sitting.top);
        const bottom = Number(sitting.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
        if (!(bottom > viewTop && top < viewBottom)) return;
        if (top <= probe) started = sitting;
      });
      chosen = started;
    }
    if (!chosen) return null;
    return { id: String(chosen.id), advance: (Number(chosen.hiddenCount) || 0) > 0 };
  }

  return {
    SPACE_TURN_KEY,
    readSpaceTurn,
    writeSpaceTurn,
    isSpaceEvent,
    isTypingTarget,
    isInOverlay,
    overlayOpen,
    spaceShouldAdvance,
    chooseSitting
  };
});
