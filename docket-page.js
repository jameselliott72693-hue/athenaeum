(function () {
  const D = window.AthenaeumDocket;
  const $ = (id) => document.getElementById(id);
  const state = { nights: [], night: null, report: null, entry: null, portraits: {}, timers: {} };

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
    const portrait = chair.roster_id && state.portraits[chair.roster_id];
    const mark = portrait
      ? `<img class="avatar" src="${esc(safeUrl(portrait))}" alt="" />`
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

  function shownDate() {
    return (state.night && state.night.date) || (state.report && state.report.date) || (state.entry && state.entry.date) || "";
  }

  function renderNight() {
    Object.keys(state.timers).forEach((id) => {
      window.clearInterval(state.timers[id]);
      delete state.timers[id];
    });
    const night = state.night;
    const report = state.report;
    const host = $("docket");
    if (!night && !report) {
      host.innerHTML = `<p class="err">This night is not on the docket.</p>`;
      return;
    }
    const date = shownDate();
    const dateLong = (night && (night.date_long || night.date)) || (report && (report.date_long || report.date)) || date;
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
      ${lede}
      ${policy}
      <div class="docket-tools">
        <label class="field" for="docket-night">Night</label>
        <select id="docket-night">${state.nights.map((item) => `<option value="${esc(item.date)}"${item.date === date ? " selected" : ""}>${esc(item.label || item.date)}</option>`).join("")}</select>
        <div class="row-btns">
          <button type="button" id="docket-share">Share this night</button>
          <button type="button" id="docket-print">Print</button>
        </div>
        <p id="docket-share-note" class="hint" role="status"></p>
      </div>
      ${jumps}
      ${pending}
      ${D.reportHtml(report, sittingIds)}
      ${sittings}`;
    const select = $("docket-night");
    if (select) select.addEventListener("change", () => showNight(select.value, true));
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
    const night = state.night;
    const note = $("docket-share-note");
    if (!night) return;
    const url = `${location.origin}${location.pathname}${location.search}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (err) { copied = false; }
    if (note) note.textContent = copied ? "Link copied." : url;
  }

  async function loadPortraits(night) {
    const ids = [...new Set((night.sittings || []).flatMap((sitting) => (sitting.chairs || []).map((chair) => chair.roster_id).filter(Boolean)))];
    await Promise.all(ids.map(async (id) => {
      if (state.portraits[id]) return;
      try {
        const response = await fetch(`data/thinkers/${id}.json`);
        if (!response.ok) return;
        const thinker = await response.json();
        if (thinker.portrait) state.portraits[id] = thinker.portrait;
      } catch (err) { /* monogram remains */ }
    }));
  }

  async function loadDocketFile(file) {
    if (!file) return null;
    const response = await fetch(`docket/${file}`);
    if (!response.ok) throw new Error("missing night");
    return response.json();
  }

  async function showNight(date, push) {
    const entry = state.nights.find((night) => night.date === date) || state.nights[0];
    if (!entry) {
      state.entry = null;
      state.night = null;
      state.report = null;
      renderNight();
      return;
    }
    const [night, report] = await Promise.all([
      loadDocketFile(entry.file),
      loadDocketFile(entry.report)
    ]);
    state.entry = entry;
    state.night = night;
    state.report = report;
    if (night) await loadPortraits(night);
    const shown = shownDate();
    const url = push ? D.nightUrl(shown) : D.placeUrl(shown, window.location.hash);
    if (push) history.pushState({ night: shown }, "", url);
    else history.replaceState({ night: shown }, "", url);
    renderNight();
  }

  function onClick(event) {
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

  async function boot() {
    const index = await fetch("docket/index.json").then((response) => response.json());
    state.nights = index.nights || [];
    const date = D.nightFromLocation(window.location, state.nights);
    await showNight(date, false);
    document.body.addEventListener("click", onClick);
    window.addEventListener("popstate", () => {
      const next = D.nightFromLocation(window.location, state.nights);
      if (next && next === shownDate()) return;
      showNight(next, false);
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
