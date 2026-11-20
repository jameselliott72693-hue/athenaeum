(function () {
  const Encounters = window.AthenaeumEncounters;
  const Reader = window.AthenaeumReader;
  if (!Encounters || !Reader) return;

  function storage() {
    try { return localStorage; } catch (err) { return null; }
  }

  function catalog() {
    return window.AthenaeumEncountersData || null;
  }

  function workById(id) {
    const data = catalog();
    const works = data && data.catalog && data.catalog.works;
    if (!works) return null;
    return works.find((work) => work.id === id) || null;
  }

  function isSaved(id) {
    const ui = window.AthenaeumReaderUI;
    if (ui && ui.hasEncounter) return ui.hasEncounter(id);
    const loaded = Reader.load(storage());
    return loaded.state.items.some((item) => item.block === "encounter:" + id);
  }

  function refresh(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-encounter-save]").forEach((button) => {
      const id = button.getAttribute("data-encounter-save") || "";
      const work = workById(id);
      const title = work ? work.title : "this work";
      const saved = isSaved(id);
      button.textContent = saved ? "Saved" : "Save";
      button.setAttribute("aria-pressed", saved ? "true" : "false");
      button.setAttribute("aria-label", (saved ? "Remove " : "Save ") + title + (saved ? " from Saved" : " to Saved"));
    });
  }

  function contextOf(button) {
    const section = button.closest("[data-encounter-scope]") || button.closest(".encounter-browse");
    if (!section) return {};
    return {
      night: section.getAttribute("data-encounter-night") || "",
      sittingId: section.getAttribute("data-encounter-sitting") || "",
      sittingTitle: section.getAttribute("data-encounter-question") || "",
      place: section.getAttribute("data-encounter-place") || ""
    };
  }

  function save(button) {
    const id = button.getAttribute("data-encounter-save") || "";
    const work = workById(id);
    if (!work) return;
    const payload = Encounters.savePayload(work, contextOf(button));
    if (!payload) return;
    const ui = window.AthenaeumReaderUI;
    if (ui && ui.toggleEncounter) {
      ui.toggleEncounter(payload);
      refresh(document);
      return;
    }
    const loaded = Reader.load(storage());
    if (!loaded.available || loaded.blocked) return;
    const existing = loaded.state.items.find((item) => item.block === payload.block);
    const next = existing ? Reader.removeItem(loaded.state, existing.id).state : Reader.addItem(loaded.state, payload).state;
    Reader.save(storage(), next);
    refresh(document);
  }

  function selectTab(tab) {
    const list = tab.closest("[role='tablist']");
    const section = tab.closest("[data-encounter-scope]") || tab.closest(".encounter-browse");
    if (!list || !section) return;
    const type = tab.getAttribute("data-encounter-tab");
    list.querySelectorAll("[role='tab']").forEach((button) => {
      const on = button === tab;
      button.setAttribute("aria-selected", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
    });
    section.querySelectorAll("[data-encounter-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-encounter-panel") !== type;
    });
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest && event.target.closest("[data-encounter-tab]");
    if (tab) {
      selectTab(tab);
      return;
    }
    const button = event.target.closest && event.target.closest("[data-encounter-save]");
    if (!button) return;
    event.preventDefault();
    save(button);
  });

  document.addEventListener("keydown", (event) => {
    const tab = event.target.closest && event.target.closest("[data-encounter-tab]");
    if (!tab) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    const tabs = [...tab.closest("[role='tablist']").querySelectorAll("[role='tab']")];
    const index = tabs.indexOf(tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    event.preventDefault();
    tabs[next].focus();
    selectTab(tabs[next]);
  });

  window.AthenaeumEncountersUI = { refresh };
})();
