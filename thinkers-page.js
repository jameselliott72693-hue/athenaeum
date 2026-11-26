(function () {
  const T = window.AthenaeumThinkers;
  const D = window.AthenaeumDocket;
  const $ = (id) => document.getElementById(id);
  const state = {
    model: null,
    thinker: "",
    pair: "",
    thinkerQuery: "",
    tradition: "all",
    era: "all",
    frequency: "any",
    thinkerSort: "name",
    matrixQuery: "",
    minShared: 2,
    matrixSort: "agreement"
  };

  function applyTheme(next) {
    const dark = next === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const button = $("theme");
    if (button) {
      button.textContent = dark ? "Light" : "Dark";
      button.setAttribute("aria-pressed", dark ? "true" : "false");
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#14110e" : "#1c1712");
    try { localStorage.setItem("athenaeum.theme", dark ? "dark" : "light"); } catch (err) { /* ignore */ }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.thinker = params.get("thinker") || "";
    state.pair = params.get("pair") || "";
  }

  function writeUrl(push) {
    const params = new URLSearchParams();
    if (state.thinker) params.set("thinker", state.thinker);
    if (state.pair) params.set("pair", state.pair);
    const desired = params.toString() ? `?${params.toString()}` : "";
    if ((location.search || "") === desired) return;
    const next = desired || location.pathname;
    history[push ? "pushState" : "replaceState"](null, "", next);
  }

  function titleFor() {
    const row = state.model && state.thinker && state.model.byId[state.thinker];
    document.title = row ? `${row.name} · Thinkers · The Athenaeum` : "Thinkers · The Athenaeum";
  }

  function fillFilters() {
    const tradition = $("thinker-tradition");
    const era = $("thinker-era");
    const groups = state.model.traditions;
    const tableOpts = groups.primary.map((name) => `<option value="${D.escapeAttr(name)}">${D.escapeText(name)}</option>`).join("");
    const restOpts = groups.rest.map((name) => `<option value="${D.escapeAttr(name)}">${D.escapeText(name)}</option>`).join("");
    tradition.innerHTML = `<option value="all">Any tradition</option>${tableOpts ? `<optgroup label="Tables">${tableOpts}</optgroup>` : ""}${restOpts ? `<optgroup label="Named on a sitting">${restOpts}</optgroup>` : ""}`;
    era.innerHTML = `<option value="all">Any era</option>${state.model.eras.map((name) => `<option value="${D.escapeAttr(name)}">${D.escapeText(name)}</option>`).join("")}`;
  }

  function shownThinkers() {
    const filtered = T.filterThinkers(state.model.thinkers, {
      query: state.thinkerQuery,
      tradition: state.tradition,
      era: state.era,
      frequency: state.frequency
    });
    return T.sortThinkers(filtered, state.thinkerSort);
  }

  function shownPairs() {
    const filtered = T.filterPairs(state.model.pairs, {
      query: state.matrixQuery,
      minShared: state.minShared
    }, state.model.byId);
    return T.sortPairs(filtered, state.matrixSort, state.model.byId);
  }

  function renderList(scrollSelected) {
    const rows = shownThinkers();
    const status = $("thinker-status");
    const list = $("thinker-list");
    const top = list.scrollTop;
    list.innerHTML = T.listHtml(rows, state.thinker);
    if (scrollSelected) {
      const current = list.querySelector('[aria-current="true"]');
      if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
    } else list.scrollTop = top;
    status.textContent = `${rows.length} of ${state.model.thinkers.length} thinkers.`;
  }

  function renderDossier(focus) {
    const host = $("dossier");
    const row = state.thinker ? state.model.byId[state.thinker] : null;
    if (!state.thinker) {
      host.innerHTML = `<h3 id="dossier-title" tabindex="-1">Choose a thinker</h3><p class="lede">The note, the years, and the works come from the shelf. Sittings and verified quotations come from the docket.</p>`;
    } else if (!row) {
      host.innerHTML = T.dossierHtml(null);
    } else host.innerHTML = T.dossierHtml(row);
    titleFor();
    if (focus) {
      const heading = $("dossier-title");
      if (heading && heading.focus) heading.focus({ preventScroll: true });
      if (window.matchMedia && window.matchMedia("(max-width: 800px)").matches && host.scrollIntoView) {
        host.scrollIntoView({ block: "start" });
      }
    }
  }

  function renderMatrix(scrollDrill) {
    const pairs = shownPairs();
    const ordered = T.axisOrder(pairs, state.matrixSort, state.model.byId);
    const grid = T.gridAxes(ordered, { cap: 18 });
    $("matrix-grid").innerHTML = T.matrixHtml(grid.axes, pairs, state.model.byId, state.pair);
    $("pair-list").innerHTML = T.pairListHtml(pairs, state.model.byId, state.pair);
    const pair = state.pair ? state.model.pairs.find((row) => row.id === state.pair) : null;
    $("pair-drill").innerHTML = state.pair ? T.drillHtml(pair, state.model.byId) : "";
    const min = state.minShared;
    const clipped = grid.truncated
      ? ` The grid shows ${grid.axes.length} of ${ordered.length} thinkers, those with the highest total in this sort. The list has every pair.`
      : "";
    $("matrix-status").textContent = pairs.length
      ? `${T.plural(pairs.length, "pair", "pairs")} seated together at least ${T.plural(min, "time", "times")}. ${ordered.length} thinkers in this filter.${clipped}`
      : `No pair was seated together at least ${T.plural(min, "time", "times")}.`;
    if (scrollDrill && state.pair) {
      const drill = $("pair-drill");
      const title = $("pair-title");
      if (title && title.focus) title.focus({ preventScroll: true });
      if (drill && drill.scrollIntoView) drill.scrollIntoView({ block: "nearest" });
    }
  }

  function renderAll(flags) {
    const opts = flags || {};
    renderList(opts.scrollSelected);
    renderDossier(opts.focusDossier);
    renderMatrix(opts.scrollDrill);
  }

  function selectThinker(id, push) {
    state.thinker = id;
    writeUrl(push);
    renderList(true);
    renderDossier(true);
  }

  function selectPair(id, push) {
    state.pair = id;
    writeUrl(push);
    renderMatrix(true);
  }

  function onClick(event) {
    const jump = event.target.closest("a.thinker-jump");
    if (jump) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(jump.href, location.href);
      if (!/thinkers\.html$/.test(url.pathname)) return;
      event.preventDefault();
      const nextThinker = url.searchParams.get("thinker");
      const hasPair = url.searchParams.has("pair");
      if (nextThinker) state.thinker = nextThinker;
      if (hasPair) state.pair = url.searchParams.get("pair") || "";
      writeUrl(true);
      if (nextThinker) {
        renderList(true);
        renderDossier(true);
      }
      if (hasPair) renderMatrix(true);
      return;
    }
    const button = event.target.closest("[data-thinker], [data-pair]");
    if (!button || !$("thinkers-main").contains(button)) return;
    if (button.hasAttribute("data-pair")) selectPair(button.getAttribute("data-pair"), true);
    else if (button.hasAttribute("data-thinker")) selectThinker(button.getAttribute("data-thinker"), true);
  }

  function safeFile(name) {
    const text = String(name || "");
    return /^[A-Za-z0-9._-]+$/.test(text) ? text : "";
  }

  async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(url);
    return response.json();
  }

  async function boot() {
    const stored = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(stored === "dark" || stored === "light" ? stored : prefer);
    $("theme").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    const [tables, index, archive, agreements] = await Promise.all([
      loadJson("data/tables.json"),
      loadJson("docket/index.json"),
      loadJson("docket/archive.json").catch(() => ({ nights: [] })),
      loadJson("docket/agreements.json")
    ]);
    const ids = (tables.thinkers || []).filter((id) => /^[A-Za-z0-9-]+$/.test(String(id)));
    const thinkerFiles = (await Promise.all(ids.map((id) => loadJson(`data/thinkers/${id}.json`).catch(() => null)))).filter(Boolean);
    const nights = D.openableNights(index.nights || [], (archive && archive.nights) || []);
    const records = (await Promise.all(nights.map(async (entry) => {
      const file = safeFile(entry.file);
      if (!file) return null;
      try {
        const night = await loadJson(`docket/${file}`);
        return { date: entry.date, label: entry.label || (night && night.date_long) || entry.date, night };
      } catch (err) {
        return null;
      }
    }))).filter(Boolean);
    state.model = T.assemble({
      tables,
      thinkers: thinkerFiles,
      records,
      agreementRows: (agreements && agreements.discussions) || []
    });
    fillFilters();
    readUrl();
    $("thinkers-main").removeAttribute("aria-busy");
    renderAll({ scrollSelected: true, focusDossier: false, scrollDrill: false });
    $("thinker-filters").addEventListener("submit", (event) => event.preventDefault());
    $("matrix-filters").addEventListener("submit", (event) => event.preventDefault());
    $("thinker-search").addEventListener("input", (event) => {
      state.thinkerQuery = event.target.value;
      renderList(false);
    });
    $("thinker-tradition").addEventListener("change", (event) => {
      state.tradition = event.target.value;
      renderList(false);
    });
    $("thinker-era").addEventListener("change", (event) => {
      state.era = event.target.value;
      renderList(false);
    });
    $("thinker-frequency").addEventListener("change", (event) => {
      state.frequency = event.target.value;
      renderList(false);
    });
    $("thinker-sort").addEventListener("change", (event) => {
      state.thinkerSort = event.target.value;
      renderList(false);
    });
    $("matrix-search").addEventListener("input", (event) => {
      state.matrixQuery = event.target.value;
      renderMatrix(false);
    });
    $("matrix-min").addEventListener("input", (event) => {
      const n = Number(event.target.value);
      state.minShared = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
      renderMatrix(false);
    });
    $("matrix-sort").addEventListener("change", (event) => {
      state.matrixSort = event.target.value;
      renderMatrix(false);
    });
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", () => {
      readUrl();
      renderAll({ scrollSelected: true, focusDossier: false, scrollDrill: !!state.pair });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch(() => {
      const status = $("thinker-status");
      const main = $("thinkers-main");
      if (main) main.removeAttribute("aria-busy");
      if (status) status.textContent = "The dossiers could not be loaded. Open this page through the site, not as a loose file.";
    });
  });
})();
