(function () {
  const D = window.AthenaeumDocket;
  const $ = (id) => document.getElementById(id);
  const state = { nights: [], night: null, report: null, entry: null, timers: {}, read: {}, unknown: "", fileNote: "" };
  let requestSeq = 0;

  function esc(text) {
    return D.escapeText(text);
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (err) { /* not a link */ }
    return "";
  }

  function initials(name) {
    return String(name || "")
      .replace(/\(.*?\)/g, " ")
      .split(/[^A-Za-zÀ-ÿ]+/)
      .filter((part) => part && part !== "in" && part !== "of")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  }

  function paragraphs(list, quotes) {
    return (list || []).map((paragraph) => `<p class="passage">${D.sanitizeParagraph(paragraph.html, quotes)}</p>`).join("");
  }

  function chairHead(chair) {
    const portrait = D.portraitPath(chair && chair.portrait);
    const src = portrait ? safeUrl(portrait) : "";
    const mark = src
      ? `<img class="avatar" src="${esc(src)}" alt="" width="48" height="48" loading="lazy" decoding="async" />`
      : `<span class="monogram" aria-hidden="true">${esc(initials(chair.name))}</span>`;
    const name = chair.roster_id
      ? `<a href="index.html#thinker=${esc(chair.roster_id)}">${esc(chair.name)}</a>`
      : esc(chair.name);
    const meta = [chair.tradition, chair.years].filter(Boolean).join(" · ");
    return `<div class="remark-head">${mark}<div><p class="kicker">${esc(meta)}</p><h3>${name}</h3></div></div>`;
  }

  function quoteList(quotes) {
    const rows = (quotes || []).filter((quote) => quote && quote.verified === true);
    if (!rows.length) return "";
    return `<div class="cites"><p class="kicker">Writings behind this response</p><ol>${rows.map((quote) => {
      const href = safeUrl(quote.source_url);
      const work = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(quote.work)}</a>`
        : esc(quote.work);
      return `<li>${work}<span class="loc">, ${esc(quote.location)}</span></li>`;
    }).join("")}</ol></div>`;
  }

  function modernBlock(chair) {
    const text = D.plainModern(chair.modern_read);
    if (!text) return "";
    return `<div class="modern-read"><p><span class="note-flag">Paraphrase, not a quotation.</span> ${esc(text)}</p></div>`;
  }

  function turnHtml(step) {
    if (step.kind === "chair") {
      const chair = step.chair;
      const quotes = chair.paraphrase_only ? [] : (chair.quotes || []);
      return `<article class="remark docket-turn" data-speaker="${esc(chair.name)}">
        ${chairHead(chair)}
        ${paragraphs(chair.turn, quotes)}
        ${modernBlock(chair)}
        ${quoteList(quotes)}
      </article>`;
    }
    const label = step.kind === "closing" ? "Closing" : "Moderator";
    return `<article class="remark moderator docket-turn" data-speaker="${label}">
      <div class="remark-head"><div><p class="kicker">${label}</p><h3>${step.kind === "closing" ? "Where the table came out" : "Opening"}</h3></div></div>
      ${paragraphs([step.paragraph], step.quotes)}
    </article>`;
  }

  function stepsOf(sitting) {
    const quotes = sitting.quotes || [];
    const steps = [{ kind: "opening", paragraph: sitting.moderator.opening, quotes }];
    (sitting.chairs || []).forEach((chair) => steps.push({ kind: "chair", chair }));
    steps.push({ kind: "closing", paragraph: sitting.moderator.closing, quotes });
    return steps;
  }

  function briefingHtml(night) {
    return (night.briefing || []).map((item) => `<article class="briefing-card">
      <p class="kicker">${esc(item.section)} · ${esc(item.number)}</p>
      <h3><a href="#sitting-${esc(item.sitting_id)}">${esc(item.question)}</a></h3>
      <p class="meta">${(item.chairs || []).map(esc).join(", ")}</p>
      <p><strong>Agreed.</strong> ${esc(item.agreed)}</p>
      <p><strong>Split.</strong> ${esc(item.split)}</p>
    </article>`).join("");
  }

  function sittingHtml(sitting) {
    const steps = stepsOf(sitting);
    const storyId = D.storyIdForSitting(state.report, sitting.id);
    const back = storyId
      ? ` · <a class="report-back" href="#story-${D.escapeAttr(storyId)}">The news report</a>`
      : "";
    return `<section class="docket-sitting" id="sitting-${esc(sitting.id)}" data-sitting="${esc(sitting.id)}">
      <p class="kicker">${esc(sitting.section)} · ${esc(sitting.number)}${back}</p>
      <h3>${esc(sitting.headline)}</h3>
      <div class="docket-setup">${paragraphs([sitting.setup], sitting.quotes)}</div>
      <p class="docket-question">${esc(sitting.question)}</p>
      <p class="why-chairs"><span class="note-flag">Why these chairs</span> ${esc(sitting.why_these_chairs)}</p>
      <div class="playback docket-play" role="group" aria-label="Turns in this sitting">
        <button type="button" data-docket-play aria-pressed="false">Play</button>
        <button type="button" data-docket-next>Next turn</button>
        <button type="button" data-docket-all>Show the sitting</button>
      </div>
      <p class="hint docket-status" role="status">The moderator has opened. The chairs speak one at a time.</p>
      <div class="docket-turns">${steps.map((step, index) => {
        const html = turnHtml(step);
        return index === 0 ? html : html.replace("<article ", "<article hidden ");
      }).join("")}</div>
    </section>`;
  }

  function tallyHtml(night) {
    const tonight = night.tally && night.tally.tonight;
    if (!tonight) return "";
    const thinkers = (tonight.top_thinkers || []).map((row) => `<li>${esc(row.name)} <span class="meta">${esc(row.sittings)} sitting${row.sittings === 1 ? "" : "s"}, ${esc(row.verified_quotes)} verified quote${row.verified_quotes === 1 ? "" : "s"}</span></li>`).join("");
    const works = (tonight.top_works || []).map((row) => `<li>${esc(row.title)}${row.author ? ` <span class="meta">${esc(row.author)}</span>` : ""} <span class="meta">${esc(row.times_quoted)}</span></li>`).join("");
    return `<section class="docket-tally">
      <p class="kicker">Cited tonight</p>
      <h2>From this night's tally</h2>
      <p class="hint">${esc(tonight.thinkers_seated)} thinkers, ${esc(tonight.seats)} seats, ${esc(tonight.verified_quotes)} verified quotes, ${esc(tonight.works_quoted)} works.</p>
      <div class="tally-split">
        <div><p class="kicker">Thinkers</p><ol>${thinkers}</ol></div>
        <div><p class="kicker">Works</p><ol>${works}</ol></div>
      </div>
    </section>`;
  }

  function nightOptions(selected) {
    return state.nights.map((item) => `<option value="${esc(item.date)}"${item.date === selected ? " selected" : ""}>${esc(D.nightMenuLabel(item, state.read))}</option>`).join("");
  }

  function readControl(place) {
    const date = shownDate();
    const read = D.isNightRead(state.read, date);
    const badge = read
      ? `<p class="read-state" data-read-state${place === "top" ? ' role="status"' : ' aria-hidden="true"'}><span class="read-mark" aria-hidden="true">✓</span> <span class="read-word">Read</span></p>`
      : `<p class="read-state is-unread" data-read-state${place === "top" ? ' role="status"' : ' aria-hidden="true"'}><span class="read-mark" aria-hidden="true">●</span> <span class="read-word">Unread</span></p>`;
    return `<div class="read-bar read-bar-${place}">
      ${badge}
      <button type="button" class="read-toggle" data-docket-read aria-pressed="${read ? "true" : "false"}">${read ? "Mark as unread" : "Mark as read"}</button>
    </div>`;
  }

  function paintRead() {
    const date = shownDate();
    const read = D.isNightRead(state.read, date);
    document.querySelectorAll("[data-docket-read]").forEach((button) => {
      button.textContent = read ? "Mark as unread" : "Mark as read";
      button.setAttribute("aria-pressed", read ? "true" : "false");
      button.removeAttribute("aria-label");
    });
    document.querySelectorAll("[data-read-state]").forEach((node) => {
      node.classList.toggle("is-unread", !read);
      const mark = node.querySelector(".read-mark");
      if (mark) mark.textContent = read ? "✓" : "●";
      const label = node.querySelector(".read-word");
      if (label) label.textContent = read ? "Read" : "Unread";
    });
    const select = $("docket-night");
    if (select) {
      const selected = state.unknown ? "" : (select.value || date);
      const placeholder = state.unknown ? `<option value="">Choose a night</option>` : "";
      select.innerHTML = placeholder + nightOptions(selected);
    }
    const hint = $("docket-unread");
    if (hint) hint.textContent = D.unreadHint(state.nights, state.read);
  }

  function toggleRead() {
    const date = shownDate();
    if (!date) return;
    const read = !D.isNightRead(state.read, date);
    state.read = D.withNightRead(state.read, date, read, new Date().toISOString());
    D.saveReadMap(window.localStorage, state.read);
    paintRead();
  }

  function shownDate() {
    return (state.night && state.night.date) || (state.report && state.report.date) || (state.entry && state.entry.date) || "";
  }

  function nightTools(selected) {
    const placeholder = state.unknown ? `<option value="">Choose a night</option>` : "";
    return `<div class="docket-tools">
      <label class="field" for="docket-night">Night</label>
      <select id="docket-night" aria-describedby="docket-unread">${placeholder}${nightOptions(selected || "")}</select>
      <p id="docket-unread" class="hint">${esc(D.unreadHint(state.nights, state.read))}</p>
    </div>`;
  }

  function bindNightSelect() {
    const select = $("docket-night");
    if (!select) return;
    select.addEventListener("change", () => {
      if (!select.value) return;
      showNight(select.value, true).catch(reportDocketError);
    });
  }

  function renderNight() {
    Object.keys(state.timers).forEach((id) => {
      window.clearInterval(state.timers[id]);
      delete state.timers[id];
    });
    const host = $("docket");
    if (!host) return;
    host.removeAttribute("aria-busy");
    if (state.unknown) {
      document.title = "Not on the docket · Tonight's docket";
      host.innerHTML = `
        <p class="kicker">Tonight's docket</p>
        <h2>Not on the docket</h2>
        <p class="err" role="alert">This night is not on the docket.</p>
        <p class="hint">The address asked for ${esc(state.unknown)}. Choose a night that was kept.</p>
        ${nightTools("")}`;
      bindNightSelect();
      return;
    }
    const night = state.night;
    const report = state.report;
    if (!night && !report) {
      const label = (state.entry && (state.entry.label || state.entry.date)) || "";
      document.title = label ? `${label} · Tonight's docket` : "Tonight's docket";
      host.innerHTML = `
        <p class="kicker">Tonight's docket</p>
        ${label ? `<h2>${esc(label)}</h2>` : ""}
        <p class="err" role="alert">${esc(state.fileNote || (state.entry ? "This night's files could not be loaded." : "This night is not on the docket."))}</p>
        ${state.nights.length ? nightTools(state.entry && state.entry.date) : ""}`;
      bindNightSelect();
      return;
    }
    const date = shownDate();
    const dateLong = (night && (night.date_long || night.date)) || (report && (report.date_long || report.date)) || (state.entry && (state.entry.label || state.entry.date)) || date;
    const fileAlert = state.fileNote ? `<p class="err" role="alert">${esc(state.fileNote)}</p>` : "";
    document.title = `${dateLong} · Tonight's docket`;
    const sittingIds = night ? (night.sittings || []).map((sitting) => sitting.id) : [];
    const jumps = report && night
      ? `<nav class="docket-jumps" aria-label="On this night"><a href="#news-report">The news report</a><a href="#the-sittings">The sittings</a></nav>`
      : "";
    const pending = night ? "" : `<p class="hint docket-pending">The sittings for this night are coming.</p>`;
    const lede = night && night.subtitle ? `<p class="lede">${esc(night.subtitle)}</p>` : "";
    const policy = night && night.integrity && night.integrity.quotation_policy
      ? `<p class="integrity"><span class="note-flag">How quotation marks are used</span> ${esc(night.integrity.quotation_policy)}</p>`
      : "";
    const sittings = night ? `<section id="the-sittings">
        <p class="kicker">At a glance</p>
        <h2 id="briefing-heading">The night's briefing</h2>
        <div class="briefing-list">${briefingHtml(night)}</div>
        <div class="docket-sittings">${(night.sittings || []).map(sittingHtml).join("")}</div>
        ${tallyHtml(night)}
      </section>` : "";
    host.innerHTML = `
      <p class="kicker">Tonight's docket</p>
      <h2>${esc(dateLong)}</h2>
      ${fileAlert}
      ${readControl("top")}
      ${lede}
      ${policy}
      <div class="docket-tools">
        <label class="field" for="docket-night">Night</label>
        <select id="docket-night" aria-describedby="docket-unread">${nightOptions(date)}</select>
        <p id="docket-unread" class="hint">${esc(D.unreadHint(state.nights, state.read))}</p>
        <div class="row-btns">
          <button type="button" id="docket-share">Share this night</button>
          <button type="button" id="docket-print">Print</button>
        </div>
        <p id="docket-share-note" class="hint" role="status"></p>
      </div>
      ${jumps}
      ${pending}
      ${D.reportHtml(report, sittingIds)}
      ${sittings}
      ${readControl("bottom")}`;
    bindNightSelect();
    $("docket-share").addEventListener("click", shareNight);
    $("docket-print").addEventListener("click", () => window.print());
    const fragment = (window.location.hash || "").replace(/^#/, "");
    const anchor = fragment && fragment.indexOf("night=") !== 0 ? document.getElementById(fragment) : null;
    if (anchor && anchor.scrollIntoView) anchor.scrollIntoView();
  }

  function sectionOf(node) {
    return node && node.closest("[data-sitting]");
  }

  function hiddenTurns(section) {
    return [...section.querySelectorAll(".docket-turn")].filter((turn) => turn.hidden);
  }

  function revealNext(section) {
    const next = hiddenTurns(section)[0];
    if (!next) {
      stopPlay(section);
      const status = section.querySelector(".docket-status");
      if (status) status.textContent = "The sitting is complete.";
      return false;
    }
    next.hidden = false;
    const status = section.querySelector(".docket-status");
    const speaker = next.dataset.speaker || "The next turn";
    if (status) status.textContent = next.classList.contains("moderator") ? `${speaker} is on the page.` : `${speaker} has spoken.`;
    if (next.scrollIntoView) next.scrollIntoView({ block: "nearest" });
    return true;
  }

  function stopPlay(section) {
    const id = section.dataset.sitting;
    if (state.timers[id]) window.clearInterval(state.timers[id]);
    delete state.timers[id];
    const button = section.querySelector("[data-docket-play]");
    if (button) {
      button.textContent = "Play";
      button.setAttribute("aria-pressed", "false");
    }
  }

  function play(section) {
    Object.keys(state.timers).forEach((id) => {
      if (id !== section.dataset.sitting) {
        const other = document.querySelector(`[data-sitting="${id}"]`);
        if (other) stopPlay(other);
      }
    });
    stopPlay(section);
    const button = section.querySelector("[data-docket-play]");
    if (button) {
      button.textContent = "Pause";
      button.setAttribute("aria-pressed", "true");
    }
    state.timers[section.dataset.sitting] = window.setInterval(() => {
      if (!revealNext(section)) stopPlay(section);
    }, 2800);
  }

  async function shareNight() {
    const note = $("docket-share-note");
    const url = `${location.origin}${location.pathname}${location.search}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (err) { copied = false; }
    if (note) note.textContent = copied ? "Link copied." : url;
  }

  async function loadDocketFile(file) {
    if (!file) return { data: null, failed: false };
    try {
      const response = await fetch(`docket/${file}`);
      if (!response.ok) return { data: null, failed: true };
      return { data: await response.json(), failed: false };
    } catch (err) {
      return { data: null, failed: true };
    }
  }

  function reportDocketError(err) {
    console.error(err);
    const note = $("docket-share-note") || $("docket-unread");
    if (note) {
      note.textContent = "That night could not be opened.";
      return;
    }
    const host = $("docket");
    if (host) host.insertAdjacentHTML("afterbegin", `<p class="err" role="alert">That night could not be opened.</p>`);
  }

  async function showNight(date, push) {
    const seq = ++requestSeq;
    const entry = state.nights.find((night) => night.date === date);
    if (!entry) {
      if (seq !== requestSeq) return;
      state.entry = null;
      state.night = null;
      state.report = null;
      state.fileNote = "";
      state.unknown = date || "";
      renderNight();
      return;
    }
    const [nightRes, reportRes] = await Promise.all([
      loadDocketFile(entry.file),
      loadDocketFile(entry.report)
    ]);
    if (seq !== requestSeq) return;
    state.entry = entry;
    state.night = nightRes.data;
    state.report = reportRes.data;
    state.unknown = "";
    const notes = [];
    if (entry.file && nightRes.failed) notes.push("The sittings for this night could not be loaded.");
    if (entry.report && reportRes.failed) notes.push("The report for this night could not be loaded.");
    state.fileNote = notes.join(" ");
    const shown = shownDate() || entry.date;
    const url = push ? D.nightUrl(shown) : D.placeUrl(shown, window.location.hash);
    if (push) history.pushState({ night: shown }, "", url);
    else history.replaceState({ night: shown }, "", url);
    renderNight();
  }

  function onClick(event) {
    if (event.target.closest("[data-docket-read]")) {
      toggleRead();
      return;
    }
    const playButton = event.target.closest("[data-docket-play]");
    const nextButton = event.target.closest("[data-docket-next]");
    const allButton = event.target.closest("[data-docket-all]");
    const section = sectionOf(playButton || nextButton || allButton);
    if (!section) return;
    if (playButton) {
      if (state.timers[section.dataset.sitting]) stopPlay(section);
      else play(section);
      return;
    }
    if (nextButton) {
      stopPlay(section);
      revealNext(section);
      return;
    }
    if (allButton) {
      stopPlay(section);
      section.querySelectorAll(".docket-turn").forEach((turn) => { turn.hidden = false; });
      const status = section.querySelector(".docket-status");
      if (status) status.textContent = "The whole sitting is on the page.";
    }
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

  function syncReadFromStorage(event) {
    if (!event || event.key !== D.READ_STORAGE_KEY) return;
    state.read = D.parseReadState(event.newValue);
    paintRead();
  }

  async function boot() {
    const response = await fetch("docket/index.json");
    if (!response.ok) throw new Error("missing docket index");
    const index = await response.json();
    state.nights = index.nights || [];
    state.read = D.loadReadMap(window.localStorage);
    const asked = D.nightQuery(window.location);
    const known = D.nightFromLocation(window.location, state.nights);
    await showNight(asked && !known ? asked : known, false);
    document.body.addEventListener("click", onClick);
    window.addEventListener("storage", syncReadFromStorage);
    window.addEventListener("popstate", () => {
      const nextAsked = D.nightQuery(window.location);
      const nextKnown = D.nightFromLocation(window.location, state.nights);
      const date = nextAsked && !nextKnown ? nextAsked : nextKnown;
      if (!state.unknown && date === shownDate()) return;
      showNight(date, false).catch(reportDocketError);
    });
    const theme = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(theme === "dark" || theme === "light" ? theme : prefer);
    $("theme").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      const host = $("docket");
      if (host) host.innerHTML = `<p class="err">The docket could not be loaded. Open this page through the site, not as a loose file.</p>`;
      console.error(err);
    });
  });
})();
