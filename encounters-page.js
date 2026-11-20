(function () {
  const E = window.AthenaeumEncounters;
  const $ = (id) => document.getElementById(id);
  let catalog = null;
  let theme = "all";
  let type = "film";

  function applyTheme(next) {
    const dark = next === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const button = $("theme");
    if (button) {
      button.textContent = dark ? "Light" : "Dark";
      button.setAttribute("aria-pressed", dark ? "true" : "false");
    }
    try { localStorage.setItem("athenaeum.theme", dark ? "dark" : "light"); } catch (err) { /* ignore */ }
  }

  function hashState() {
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash.indexOf("theme-") === 0) {
      const id = hash.slice(6);
      if (id === "all" || E.themeById(id)) theme = id;
    }
    if (hash.indexOf("work-") === 0) {
      const id = hash.slice(5);
      const work = (catalog.works || []).find((row) => row.id === id);
      if (work) {
        type = work.type;
        if (work.themes && work.themes[0]) theme = work.themes[0];
      }
    }
  }

  function writeHash() {
    const next = theme === "all" ? "" : "#theme-" + theme;
    if ((location.hash || "") === next) return;
    history.replaceState(null, "", next || location.pathname);
  }

  function filters() {
    const host = $("encounter-filters");
    const themes = [{ id: "all", label: "All themes" }].concat(E.THEMES);
    const themeButtons = themes.map((row) => {
      const on = row.id === theme;
      return `<button type="button" data-theme="${E.escapeAttr(row.id)}" aria-pressed="${on ? "true" : "false"}">${E.escapeText(row.label)}</button>`;
    }).join("");
    const tabs = E.TYPES.map((kind, index) => {
      const on = kind === type;
      return `<button type="button" role="tab" id="enc-browse-tab-${kind}" aria-controls="enc-browse-panel" aria-selected="${on ? "true" : "false"}" tabindex="${on ? "0" : "-1"}" data-encounter-tab="${kind}">${E.TYPE_LABELS[kind]}</button>`;
    }).join("");
    host.innerHTML = `<div class="encounter-themes" role="group" aria-label="Themes">${themeButtons}</div>
      <div class="encounter-tabs" role="tablist" aria-label="Films, songs, and poems">${tabs}</div>`;
  }

  function results() {
    const host = $("encounter-results");
    const status = $("encounter-status");
    const works = (catalog.works || []).filter((work) => work.type === type && (theme === "all" || work.themes.indexOf(theme) >= 0));
    const label = E.TYPE_LABELS[type];
    host.innerHTML = `<div role="tabpanel" id="enc-browse-panel" data-encounter-panel="${type}" aria-labelledby="enc-browse-tab-${type}">
      ${works.map((work) => E.cardHtml(work)).join("") || `<p class="empty">Nothing in ${E.escapeText(label.toLowerCase())} for this theme.</p>`}
    </div>`;
    host.setAttribute("data-encounter-question", theme === "all" ? "Further encounters" : (E.themeById(theme) || {}).label || "");
    if (status) {
      const themeLabel = theme === "all" ? "all themes" : ((E.themeById(theme) || {}).label || theme);
      status.textContent = `${works.length} ${label.toLowerCase()} for ${themeLabel}.`;
    }
    if (window.AthenaeumEncountersUI) window.AthenaeumEncountersUI.refresh(host);
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash.indexOf("work-") === 0) {
      const node = document.getElementById(hash);
      if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
    }
  }

  function render() {
    filters();
    results();
  }

  document.addEventListener("click", (event) => {
    const themeButton = event.target.closest && event.target.closest("[data-theme]");
    if (themeButton && themeButton.closest("#encounter-filters")) {
      theme = themeButton.getAttribute("data-theme") || "all";
      writeHash();
      render();
    }
  });

  document.addEventListener("click", (event) => {
    const tab = event.target.closest && event.target.closest("#encounter-filters [data-encounter-tab]");
    if (!tab) return;
    type = tab.getAttribute("data-encounter-tab") || "film";
    render();
  });

  async function boot() {
    const stored = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(stored === "dark" || stored === "light" ? stored : prefer);
    $("theme").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    try {
      const response = await fetch("data/encounters.json");
      if (!response.ok) throw new Error("missing catalog");
      catalog = E.normalizeCatalog(await response.json());
      window.AthenaeumEncountersData = { catalog, map: { sittings: {}, tables: {} } };
      hashState();
      render();
    } catch (err) {
      $("encounter-status").textContent = "The catalog could not be loaded. Open this page through the site, not as a loose file.";
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
