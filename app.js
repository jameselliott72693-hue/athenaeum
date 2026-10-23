(function () {
  const A = window.Athenaeum;
  const Panel = window.AthenaeumPanel;
  const Compare = window.AthenaeumCompare;
  const Books = window.AthenaeumBooks;
  const Store = window.AthenaeumStore;
  const Share = window.AthenaeumShare;
  const Lines = window.AthenaeumLines;
  const Paths = window.AthenaeumPaths;
  const Modern = window.AthenaeumModern;
  const SPEEDS = { slow: 7000, normal: 3600, fast: 1300 };
  const state = {
    thinkers: [],
    tables: [],
    relevance: null,
    seated: [],
    minutes: [],
    seatings: [],
    bookmarks: [],
    lines: { edges: [] },
    pathCatalog: { paths: [] },
    pathProgress: { read: {}, current: {} },
    pathTexts: {},
    pathOpen: null,
    reading: null,
    tableFilter: "letters",
    query: "",
    bookHits: [],
    scoring: false,
    undo: null,
    undoTable: null,
    audio: null,
    sound: { muted: false, volume: 70 },
    revealToken: 0,
    playback: { speed: "normal", paused: true, index: 0, timer: null, token: 0 },
    modernDefault: false
  };

  const $ = (id) => document.getElementById(id);
  const byId = (id) => state.thinkers.find((t) => t.id === id);
  const tableById = (id) => state.tables.find((t) => t.id === id);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function safeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch (err) { /* ignore */ }
    return "#";
  }
  function subjectText() {
    return `${$("topic").value} ${$("brief").value}`.trim();
  }
  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* full or private */ }
  }

  function onTable(person, tableId) {
    if (!person) return false;
    const table = tableById(tableId);
    if (table && Array.isArray(table.thinkers)) return table.thinkers.includes(person.id);
    if (Array.isArray(person.tables) && person.tables.length) return person.tables.includes(tableId);
    return person.tableId === tableId;
  }

  function activeTable() {
    if (state.tableFilter && state.tableFilter !== "any") return tableById(state.tableFilter) || state.tables[0];
    return state.tables[0];
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function judge(thinker, text, rel) {
    const card = A.scoreThinker(thinker, text, rel);
    if (!Books || !Books.ready(thinker.id)) return card;
    return Books.mergeScore(card, Books.rankedEntries(thinker.id, text, rel, 8), rel);
  }

  function scoreOf(thinker) {
    return judge(thinker, subjectText(), state.relevance);
  }

  function thinkerIdsFor(tableId) {
    if (!tableId || tableId === "any") return state.thinkers.map((thinker) => thinker.id);
    return state.thinkers.filter((thinker) => onTable(thinker, tableId)).map((thinker) => thinker.id);
  }

  function usedFromReading(reading) {
    const used = new Set(reading && reading.usedPassages || []);
    (reading && reading.turns || []).forEach((turn) => {
      (turn.cards || []).forEach((card) => { if (card.passageId) used.add(card.passageId); });
      (turn.cites || []).forEach((cite) => { if (cite.passageId) used.add(cite.passageId); });
    });
    return used;
  }

  function tierLabel(tier) {
    if (tier === "high") return "Most written on this";
    if (tier === "low") return "Little or nothing on this topic";
    if (tier === "mid") return "Some writing on this";
    return "";
  }

  function badge(score) {
    if (!score || score.idle || state.scoring) return "";
    const label = tierLabel(score.tier);
    return `<span class="badge ${esc(score.tier)}">${esc(label)}</span>`;
  }

  function worksList(score) {
    if (!score || score.idle || state.scoring) return "";
    const items = (score.matches || []).slice(0, 4).map((m) => {
      const kind = m.entry.fromText ? "From the full text" : (m.entry.verbatim ? "Quotation" : "Summary");
      return `<li><span class="meta">${kind}.</span> ${esc(m.entry.work)}, ${esc(m.entry.loc)}</li>`;
    }).join("");
    const body = items || "<li>No passage on this shelf matches.</li>";
    return `<details class="works"><summary>Works on this</summary><ul>${body}</ul></details>`;
  }

  function renderHub() {
    const host = $("hub");
    if (!host) return;
    host.innerHTML = state.tables.map((t) => {
      const on = state.tableFilter === t.id;
      const n = state.thinkers.filter((p) => onTable(p, t.id)).length;
      return `<button type="button" class="hub-card" data-table="${esc(t.id)}" aria-pressed="${on ? "true" : "false"}">
        <span class="kicker">${esc(t.tradition)}</span>
        <strong>${esc(t.name)}</strong>
        <span class="meta">${n} chairs</span>
      </button>`;
    }).join("");
  }

  function selectTable(id) {
    if (id === state.tableFilter) return true;
    if (state.seated.length) {
      $("err").textContent = "A sitting stays inside one tradition. Clear the table before opening another.";
      return false;
    }
    state.tableFilter = id;
    const table = id === "any" ? state.tables[0] : tableById(id);
    if (table) $("panel-size").value = String(table.limits.defaultCount);
    $("err").textContent = "";
    renderHub();
    renderRoster();
    renderTable();
    return true;
  }

  function renderTradition() {
    const select = $("tradition");
    const current = state.tableFilter;
    select.innerHTML = `<option value="any">Any tradition</option>` + state.tables.map((t) =>
      `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
    select.value = current;
    renderHub();
    fillCompare();
    const table = activeTable();
    if (!table) return;
    const size = $("panel-size");
    size.min = String(table.limits.min);
    size.max = String(table.limits.hardMax);
    if (!size.value) size.value = String(table.limits.defaultCount);
    const preset = table.preset || [];
    $("seat-preset").textContent = `Seat the usual ${preset.length}`;
    renderLines();
    renderPaths();
  }

  function renderLines() {
    const box = $("line-box");
    if (!box || !Lines) return;
    const table = activeTable();
    const people = state.thinkers.filter((person) => table && onTable(person, table.id));
    if (!table || !people.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const ordered = Lines.order(people);
    const edges = Lines.edgesFor(state.lines, table.id);
    const points = Lines.layout(ordered.map((person) => person.id));
    const at = {};
    points.forEach((point) => { at[point.id] = point; });
    const boxSize = Lines.frame(points);
    const strokes = edges.map((edge) => {
      const from = at[edge.from];
      const to = at[edge.to];
      if (!from || !to) return "";
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"><title>${esc(edge.basis)}</title></line>`;
    }).join("");
    const nodes = ordered.map((person) => {
      const point = at[person.id];
      const short = person.name.split(" ").slice(-1)[0];
      return `<g><circle cx="${point.x}" cy="${point.y}" r="4"></circle><text x="${point.x + 8}" y="${point.y + 4}">${esc(short)}</text></g>`;
    }).join("");
    $("line-map").innerHTML = `<svg viewBox="0 0 ${boxSize.width} ${boxSize.height}" role="img" aria-label="Who taught, read, or answered whom on this table">${strokes}${nodes}</svg>`;
    $("line-when").innerHTML = ordered.map((person) => `<li><strong>${esc(person.name)}</strong> <span>${esc(person.years)} · ${esc(person.place)}</span></li>`).join("");
    $("line-edges").innerHTML = edges.map((edge) => {
      const from = byId(edge.from);
      const to = byId(edge.to);
      return `<li><strong>${esc(from ? from.name : edge.from)}</strong> ${esc(edge.label)} <strong>${esc(to ? to.name : edge.to)}</strong>. ${esc(edge.basis)}</li>`;
    }).join("");
  }

  function renderPaths() {
    const box = $("path-box");
    if (!box || !Paths) return;
    const path = Paths.pathForTable(state.pathCatalog, state.tableFilter);
    if (!path) {
      box.hidden = true;
      state.pathOpen = null;
      return;
    }
    box.hidden = false;
    $("path-title").textContent = path.title;
    $("path-blurb").textContent = path.blurb;
    const open = state.pathOpen && state.pathOpen.pathId === path.id ? state.pathOpen : null;
    $("path-stops").innerHTML = path.stops.map((stop, index) => {
      const person = byId(stop.thinkerId);
      const read = Paths.isRead(state.pathProgress, path.id, stop.id);
      const current = open && open.stopId === stop.id;
      return `<li><button type="button" data-path-stop="${esc(stop.id)}" aria-current="${current ? "true" : "false"}">${index + 1}. ${esc(person ? person.name : stop.thinkerId)}${read ? " · read" : ""}</button></li>`;
    }).join("");
    const readHost = $("path-read");
    if (!open) {
      readHost.hidden = true;
      readHost.innerHTML = "";
      return;
    }
    const stop = path.stops.find((item) => item.id === open.stopId);
    readHost.hidden = false;
    readHost.innerHTML = `
      <p class="editorial"><span class="note-flag">Note, not a quotation.</span> ${esc(stop.guide)}</p>
      <p class="path-passage">${esc(open.paragraph)}</p>
      <p class="meta"><a href="${esc(safeUrl(stop.url))}" target="_blank" rel="noopener">${esc(stop.work)}</a>, ${esc(stop.loc)}</p>
      <div class="row-btns">
        <button type="button" id="path-read-btn">${Paths.isRead(state.pathProgress, path.id, stop.id) ? "Read" : "Mark this stop read"}</button>
        <button type="button" class="solid" id="path-put">Put this passage to the table</button>
      </div>`;
  }

  async function textOfStop(stop) {
    if (state.pathTexts[stop.textFile] != null) return state.pathTexts[stop.textFile];
    const res = await fetch(stop.textFile);
    if (!res.ok) throw new Error("missing book");
    const text = await res.text();
    state.pathTexts[stop.textFile] = text;
    return text;
  }

  async function openPathStop(stopId) {
    const path = Paths.pathForTable(state.pathCatalog, state.tableFilter);
    const stop = path && path.stops.find((item) => item.id === stopId);
    const note = $("path-note");
    if (!stop) return;
    if (note) note.textContent = "Opening the book…";
    let paragraph = null;
    try {
      paragraph = Paths.paragraphContaining(await textOfStop(stop), stop.needle);
    } catch (err) {
      paragraph = null;
    }
    if (!paragraph) {
      if (note) note.textContent = "That sentence is not in the book file on this shelf.";
      return;
    }
    state.pathProgress = Paths.setCurrent(state.pathProgress, path.id, stop.id);
    Paths.saveProgress(localStorage, state.pathProgress);
    state.pathOpen = { pathId: path.id, stopId: stop.id, paragraph };
    if (note) note.textContent = "";
    renderPaths();
  }

  function markPathRead() {
    const path = Paths.pathForTable(state.pathCatalog, state.tableFilter);
    const open = state.pathOpen;
    if (!path || !open || open.pathId !== path.id) return;
    state.pathProgress = Paths.markRead(state.pathProgress, path.id, open.stopId);
    Paths.saveProgress(localStorage, state.pathProgress);
    const note = $("path-note");
    const done = path.stops.filter((stop) => Paths.isRead(state.pathProgress, path.id, stop.id)).length;
    if (note) note.textContent = `${done} of ${path.stops.length} stops read. Kept in this browser.`;
    renderPaths();
  }

  async function putPathPassage() {
    const path = Paths.pathForTable(state.pathCatalog, state.tableFilter);
    const open = state.pathOpen;
    const note = $("path-note");
    const stop = path && open && path.stops.find((item) => item.id === open.stopId);
    if (!stop || !open.paragraph) return;
    if (!state.seated.includes(stop.thinkerId)) {
      trySeat(stop.thinkerId);
      if (!state.seated.includes(stop.thinkerId)) return;
    }
    $("topic").value = stop.ask;
    $("brief").value = open.paragraph;
    saveJson("athenaeum.draft", { topic: stop.ask, brief: open.paragraph });
    scheduleScore();
    const table = activeTable();
    const person = byId(stop.thinkerId);
    if (state.seated.length < table.limits.min) {
      if (note) note.textContent = `Seated ${person.name} and put the passage in the brief. Seat at least ${table.limits.min} chairs, then ask the table.`;
      return;
    }
    if (note) note.textContent = `The passage is the brief. Asking ${person.name}’s table.`;
    await weigh();
  }

  function fillCompare() {
    const first = $("compare-a");
    const second = $("compare-b");
    if (!first || !second) return;
    const keepFirst = first.value;
    const keepSecond = second.value;
    const options = state.tables.map((table) => `<option value="${esc(table.id)}">${esc(table.name)}</option>`).join("");
    first.innerHTML = options;
    second.innerHTML = options;
    const ids = state.tables.map((table) => table.id);
    first.value = ids.includes(keepFirst) ? keepFirst : (ids.includes("christian") ? "christian" : ids[0]);
    second.value = ids.includes(keepSecond) ? keepSecond : (ids.includes("traditionalist") ? "traditionalist" : (ids[1] || ids[0]));
    if (first.value === second.value && ids.length > 1) second.value = ids.find((id) => id !== first.value);
  }

  function comparePills(topics) {
    if (!topics.length) return `<span>None</span>`;
    return topics.map((topic) => `<span>${esc(topic)}</span>`).join("");
  }

  function compareSide(table, lines) {
    const body = lines.length
      ? lines.map((line) => `<div class="compare-line"><p class="meta">${esc(line.speaker)}</p><p>${esc(line.paragraph)}</p><p class="meta">${line.url ? `<a href="${esc(safeUrl(line.url))}" target="_blank" rel="noopener">${esc(line.work)}</a>` : esc(line.work)}${line.loc ? `, ${esc(line.loc)}` : ""}</p></div>`).join("")
      : `<p class="empty">No card or passage was cited.</p>`;
    return `<section class="compare-side"><h3>${esc(table.name)}</h3>${body}</section>`;
  }

  function renderCompare(left, right, topic, view) {
    const host = $("compare");
    host.hidden = false;
    host.innerHTML = `
      <div class="compare-head">
        <p class="kicker">Where the cited cards meet</p>
        <h2>${esc(topic)}</h2>
        <p class="lede">Topics below are the ones named on the cards and passages these chairs actually spoke. Nothing is added.</p>
        <p class="meta">Named at both tables</p>
        <div class="compare-topics">${comparePills(view.both)}</div>
        <p class="meta">Named only at ${esc(left.name)}</p>
        <div class="compare-topics">${comparePills(view.onlyLeft)}</div>
        <p class="meta">Named only at ${esc(right.name)}</p>
        <div class="compare-topics">${comparePills(view.onlyRight)}</div>
      </div>
      <div class="compare-grid">
        ${compareSide(left, view.left)}
        ${compareSide(right, view.right)}
      </div>`;
  }

  async function compareTables() {
    const note = $("compare-note");
    const topic = $("topic").value.trim();
    const brief = $("brief").value.trim();
    const left = tableById($("compare-a").value);
    const right = tableById($("compare-b").value);
    if (topic.length < 8) {
      note.textContent = "Give the subject a few more words.";
      return;
    }
    if (!left || !right || left.id === right.id) {
      note.textContent = "Choose two different tables.";
      return;
    }
    const leftPeople = (left.preset || []).map(byId).filter(Boolean);
    const rightPeople = (right.preset || []).map(byId).filter(Boolean);
    if (leftPeople.length < 2 || rightPeople.length < 2) {
      note.textContent = "Each table needs its usual chairs.";
      return;
    }
    note.textContent = "Asking both tables…";
    const text = `${topic} ${brief}`.trim();
    if (Books) {
      try { await Books.ensure(leftPeople.concat(rightPeople).map((thinker) => thinker.id)); } catch (err) { /* the cards still answer */ }
    }
    const shared = {
      text,
      relevance: state.relevance,
      scoreThinker: judge,
      distinctive: A.distinctive,
      opening: "subject"
    };
    const leftRound = Panel.buildRound(Object.assign({ thinkers: leftPeople }, shared));
    const rightRound = Panel.buildRound(Object.assign({ thinkers: rightPeople }, shared));
    renderCompare(left, right, topic, Compare.cited(leftRound, rightRound));
    note.textContent = `${left.name} and ${right.name}, from the cards and passages they cited.`;
    $("compare").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderRoster() {
    const q = state.query.trim().toLowerCase();
    let list = state.thinkers.filter((t) => state.tableFilter === "any" || onTable(t, state.tableFilter));
    if (q) list = list.filter((t) => `${t.name} ${t.epithet} ${t.years}`.toLowerCase().includes(q));
    const text = subjectText();
    const status = $("score-status");
    if (state.scoring && text.length >= 3) {
      status.textContent = "Checking the shelf…";
      status.setAttribute("aria-busy", "true");
    } else if (text.length >= 3) {
      status.textContent = "Highlight is a hint. It does not seat or unseat anyone.";
      status.removeAttribute("aria-busy");
    } else {
      status.textContent = "Enter a subject to see who has written on it.";
      status.removeAttribute("aria-busy");
    }
    if (!state.scoring && text.length >= 3) {
      const order = { high: 0, mid: 1, low: 2 };
      list = list.slice().sort((a, b) => {
        const sa = scoreOf(a);
        const sb = scoreOf(b);
        const d = (order[sa.tier] ?? 3) - (order[sb.tier] ?? 3);
        if (d) return d;
        if (sb.score !== sa.score) return sb.score - sa.score;
        return a.name.localeCompare(b.name);
      });
    }
    $("roster").innerHTML = list.map((t) => {
      const on = state.seated.includes(t.id);
      const score = scoreOf(t);
      const rel = !state.scoring && score.tier ? ` rel-${score.tier}` : "";
      return `<article class="card${on ? " on" : ""}${rel}">
        <img class="avatar" src="${esc(safeUrl(t.portrait))}" alt="" />
        <div class="card-main">
          <button type="button" class="name-btn" data-dossier="${esc(t.id)}"><span class="name">${esc(t.name)}</span></button>
          <span class="meta">${esc(t.years)} · ${esc(t.epithet)}</span>
          <div class="card-actions">
            ${badge(score)}
            <button type="button" data-toggle="${esc(t.id)}" aria-pressed="${on ? "true" : "false"}">${on ? "Unseat" : "Seat"}</button>
          </div>
          ${worksList(score)}
        </div>
      </article>`;
    }).join("") || `<p class="empty">No one in this pool matches.</p>`;
  }

  function renderTable() {
    const table = activeTable();
    const limits = table.limits;
    const people = state.seated.map(byId).filter(Boolean);
    $("seat-count").textContent = people.length
      ? `${people.length} seated · ${limits.min} to ${limits.hardMax}, ${limits.recommendedMax} or fewer recommended`
      : `Empty · seat ${limits.min} to ${limits.hardMax}`;
    $("table").innerHTML = people.length ? people.map((t) => {
      const score = scoreOf(t);
      const rel = !state.scoring && score.tier ? ` rel-${score.tier}` : "";
      return `<span class="chip${rel}">
        <img class="avatar" src="${esc(safeUrl(t.portrait))}" alt="" />
        <span class="chip-body"><strong>${esc(t.name)}</strong>${badge(score)}</span>
        <button type="button" class="icon-btn" data-remove="${esc(t.id)}" aria-label="Remove ${esc(t.name)}">Remove</button>
      </span>`;
    }).join("") : `<p class="empty">No one seated. Seat a chair from the pool, or draw a random table.</p>`;
    const note = $("limit-note");
    if (people.length >= limits.recommendedMax + 1 && people.length <= limits.hardMax) {
      note.hidden = false;
      note.textContent = `Larger panels take longer and cost more per sitting; ${limits.recommendedMax} or fewer is recommended.`;
    } else note.hidden = true;
    renderLineup(people);
  }

  function renderLineup(people) {
    const host = $("lineup");
    const text = subjectText();
    if (text.length < 3 || !people.length || state.scoring) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const scored = people.map((t) => ({ t, s: scoreOf(t) }));
    const speakers = scored.filter((x) => x.s.speaks).sort((a, b) => b.s.score - a.s.score || a.t.name.localeCompare(b.t.name));
    const quiet = scored.filter((x) => !x.s.speaks);
    host.hidden = false;
    const speak = speakers.length
      ? speakers.map((x, i) => `${i + 1}. ${esc(x.t.name)}`).join(", ")
      : "No one seated has written on this.";
    const out = quiet.length ? ` Sitting out: ${quiet.map((x) => esc(x.t.name)).join(", ")}.` : "";
    host.innerHTML = `<p class="kicker">If you asked now</p><p>${speak}.${out} The relevance gate may leave fewer speaking than are seated.</p>`;
  }

  function renderShelf() {
    const host = $("shelf");
    host.innerHTML = state.minutes.length
      ? state.minutes.map((m, i) => `<button type="button" data-minute="${i}"><strong>${esc(m.topic)}</strong><span class="when">${esc(m.when)} · ${esc((m.chairs || []).map((c) => c.name.split(" ").slice(-1)[0]).join(", "))}</span><span class="drop" data-drop="${i}">Discard</span></button>`).join("")
      : `<p class="empty">No sittings saved yet.</p>`;
  }

  function scheduleScore() {
    const ms = (state.relevance && state.relevance.debounceMs) || 240;
    state.scoring = subjectText().length >= 3;
    renderRoster();
    renderTable();
    window.clearTimeout(scheduleScore.timer);
    scheduleScore.timer = window.setTimeout(async () => {
      const text = subjectText();
      if (Books && text.length >= 3) {
        try { await Books.ensure(thinkerIdsFor(state.tableFilter)); } catch (err) { /* shelf still works from the cards */ }
      }
      state.scoring = false;
      renderRoster();
      renderTable();
      $("only-wrap").hidden = subjectText().length < 3;
    }, ms);
  }

  function setSeated(ids) {
    state.seated = ids.slice();
    saveJson("athenaeum.seated", state.seated);
    renderRoster();
    renderTable();
  }

  function trySeat(id) {
    const person = byId(id);
    const err = $("err");
    if (!person) return;
    if (state.seated.includes(id)) {
      setSeated(state.seated.filter((x) => x !== id));
      err.textContent = "";
      return;
    }
    const table = activeTable();
    if (state.tableFilter === "any") {
      err.textContent = "Choose one table first. A sitting stays inside one tradition.";
      return;
    }
    if (!onTable(person, table.id)) {
      err.textContent = "A sitting stays inside one tradition. Clear the table before seating someone from another.";
      return;
    }
    const limits = table.limits;
    if (state.seated.length >= limits.hardMax) {
      err.textContent = `This table seats ${limits.hardMax} at most. Remove someone first.`;
      return;
    }
    err.textContent = "";
    setSeated(state.seated.concat(id));
  }

  function seatPreset() {
    if (state.tableFilter === "any") {
      $("err").textContent = "Choose one table first. A sitting stays inside one tradition.";
      return;
    }
    const table = activeTable();
    if (!table) return;
    setSeated((table.preset || []).filter((id) => onTable(byId(id), table.id)).slice(0, table.limits.hardMax));
    $("err").textContent = "";
  }

  async function randomSeat(reroll) {
    const onlyRelevant = $("only-relevant").checked && !$("only-wrap").hidden;
    if (onlyRelevant && Books) {
      try { await Books.ensure(thinkerIdsFor(state.tableFilter)); } catch (err) { /* draw from the cards */ }
    }
    const drawn = A.chooseRandom({
      tables: state.tables,
      thinkers: state.thinkers,
      traditionId: state.tableFilter,
      size: Number($("panel-size").value),
      onlyRelevant,
      subject: subjectText(),
      relevance: state.relevance,
      scoreThinker: judge
    });
    const note = $("random-note");
    if (!drawn.ok) {
      note.textContent = drawn.message;
      return;
    }
    if (!state.undo) state.undo = state.seated.slice();
    if (!state.undoTable) state.undoTable = state.tableFilter;
    $("undo-random").disabled = false;
    if (drawn.table && drawn.table.id !== state.tableFilter) {
      state.tableFilter = drawn.table.id;
      renderHub();
      renderTradition();
    }
    setSeated(drawn.ids);
    const verb = reroll ? "Rerolled" : "Seated";
    note.textContent = `${verb} ${drawn.ids.length} from ${drawn.table.name}. ${drawn.note}`.trim();
    $("err").textContent = "";
  }

  function undoRandom() {
    if (!state.undo) return;
    const previous = state.undo;
    const previousTable = state.undoTable;
    state.undo = null;
    state.undoTable = null;
    $("undo-random").disabled = true;
    if (previousTable && previousTable !== state.tableFilter && !previous.length) {
      state.tableFilter = previousTable;
      renderHub();
      renderTradition();
    } else if (previousTable && previous.length) {
      state.tableFilter = previousTable;
      renderHub();
      renderTradition();
    }
    setSeated(previous);
    $("random-note").textContent = "Restored the seating from before the draw.";
  }

  function projectReading(reading) {
    if (!reading || !Array.isArray(reading.turns)) return;
    reading.chairs = reading.turns.filter((turn) => turn.kind === "chair").map((turn) => ({
      id: turn.id,
      name: turn.name,
      lean: turn.lean,
      hits: turn.hits || (turn.cites || []).length,
      paragraphs: (turn.paragraphs || []).slice(),
      cites: turn.cites || [],
      replyTo: turn.replyTo || null
    }));
    reading.abstained = reading.turns.filter((turn) => turn.kind === "abstain" || turn.kind === "silence").map((turn) => ({
      id: turn.id || "",
      name: turn.name || "The table",
      reason: turn.editorial || turn.reason || ""
    }));
  }

  function clearPlayTimer() {
    if (state.playback.timer) window.clearTimeout(state.playback.timer);
    state.playback.timer = null;
  }

  function stopPlaybackClock() {
    state.playback.token += 1;
    clearPlayTimer();
  }

  function persistReading(reading) {
    projectReading(reading);
    return Store.put("sittings", reading).catch(() => {
      const note = $("memory-note");
      if (note) note.textContent = "This sitting could not be saved in the browser.";
    });
  }

  async function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!state.audio) state.audio = new AC();
    if (state.audio.state === "suspended") {
      try { await state.audio.resume(); } catch (err) { /* autoplay still locked */ }
    }
  }

  function playSound(thinker) {
    if (state.sound.muted || !state.audio || state.audio.state !== "running") return;
    const motif = thinker && thinker.sound;
    if (!motif || !motif.notes) return;
    const t0 = state.audio.currentTime + 0.02;
    const peak = Math.max(0.001, (state.sound.volume / 100) * 0.12);
    motif.notes.forEach((freq, i) => {
      const osc = state.audio.createOscillator();
      const gain = state.audio.createGain();
      osc.type = motif.wave || "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(state.audio.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  function remarkHtml(person, body, lean, meta, turnIndex) {
    const save = turnIndex == null ? "" : `<button type="button" class="text-btn" data-save-turn="${turnIndex}">Bookmark this turn</button>`;
    return `<article class="remark${lean === "abstain" ? " abstain" : ""} reveal">
      <div class="remark-head">
        <img class="avatar" src="${esc(safeUrl(person.portrait))}" alt="" />
        <div>
          <p class="kicker">${esc(person.years)}</p>
          <h3>${esc(person.name)}</h3>
          <span class="lean ${esc(lean)}">${esc(lean)}</span>
          ${meta ? `<span class="meta"> ${esc(meta)}</span>` : ""}
        </div>
      </div>
      ${body}
      ${save}
    </article>`;
  }

  function closeHtml(reading) {
    const groups = { for: [], against: [], qualifies: [] };
    (reading.chairs || []).forEach((c) => { if (groups[c.lean]) groups[c.lean].push(c.name); });
    const line = (key, label) => groups[key].length ? `<li><strong>${label}:</strong> ${groups[key].map(esc).join(", ")}</li>` : "";
    const quiet = (reading.abstained || []).map((a) => esc(a.name)).join(", ");
    return `<section class="close-panel reveal">
      <p class="kicker">Where they part company</p>
      <p>The operative sentence: ${esc(reading.operative)}</p>
      <ul>
        ${line("for", "Presses for")}
        ${line("against", "Presses against")}
        ${line("qualifies", "Qualifies")}
        ${quiet ? `<li><strong>Sits out:</strong> ${quiet}</li>` : ""}
      </ul>
      ${(reading.exchanges || []).map((x) => `<p class="exchange"><strong>${esc(x.from)}</strong> answers <strong>${esc(x.to)}</strong>. ${esc(x.text)}</p>`).join("")}
    </section>`;
  }

  function turnHtml(turn, index) {
    const save = `<button type="button" class="text-btn" data-save-turn="${index}">Bookmark this turn</button>`;
    if (turn.kind === "moderator") {
      const who = turn.toId ? `To ${esc(turn.toName)}` : "To the table";
      return `<article class="remark moderator" data-turn="${index}">
        <div class="remark-head"><div><p class="kicker">Moderator</p><h3>${who}</h3></div></div>
        <p class="moderator-ask">${esc(turn.text || "")}</p>
        ${save}
      </article>`;
    }
    if (turn.kind === "silence") {
      return `<article class="remark notice" data-turn="${index}">
        <p class="editorial"><span class="note-flag">Note, not a chair’s words.</span> ${esc(turn.editorial || "")}</p>
      </article>`;
    }
    const person = byId(turn.id) || { name: turn.name, years: "", portrait: "" };
    const reply = turn.replyTo ? `<p class="reply-to">Answers ${esc(turn.replyTo.name)}.</p>` : "";
    const passages = (turn.paragraphs || []).map((paragraph) => {
      const full = String(paragraph || "").indexOf("From the full text") === 0;
      return `<p class="passage${full ? " from-text" : ""}">${esc(paragraph)}</p>`;
    }).join("");
    const meta = turn.kind === "abstain" ? "Sits out" : (turn.hits ? `${turn.hits} passage${turn.hits === 1 ? "" : "s"}` : "");
    return `<article class="remark${turn.kind === "abstain" ? " abstain" : ""}" data-turn="${index}">
      <div class="remark-head">
        <img class="avatar" src="${person.portrait ? esc(safeUrl(person.portrait)) : ""}" alt="" />
        <div>
          <p class="kicker">${esc(person.years || "")}</p>
          <h3>${esc(turn.name)}</h3>
          ${turn.lean ? `<span class="lean ${esc(turn.lean)}">${esc(turn.lean)}</span>` : ""}
          ${meta ? `<span class="meta"> ${esc(meta)}</span>` : ""}
        </div>
      </div>
      <p class="editorial"><span class="note-flag">Note, not a chair’s words.</span> ${esc(turn.editorial || "")}</p>
      ${reply}
      ${passages}
      ${modernHtml(turn, index)}
      ${citeHtml(turn.cites, index)}
      ${save}
    </article>`;
  }

  function closeFromTurns(reading) {
    const items = (reading.turns || []).map((turn) => {
      if (turn.kind === "moderator") {
        const who = turn.toId ? esc(turn.toName) : "the table";
        return `<li><strong>Moderator</strong> asked ${who}.</li>`;
      }
      if (turn.kind === "chair" && turn.replyTo) {
        return `<li><strong>${esc(turn.name)}</strong> answers <strong>${esc(turn.replyTo.name)}</strong>.</li>`;
      }
      if (turn.kind === "chair") return `<li><strong>${esc(turn.name)}</strong> addresses the subject.</li>`;
      return `<li>${esc(turn.editorial || "")}</li>`;
    }).join("");
    return `<section class="close-panel" id="close-panel"><p class="kicker">Where the thread went</p><ul>${items}</ul></section>`;
  }

  function updatePlayButtons() {
    const button = $("play-toggle");
    const step = $("step-turn");
    if (!button || !state.reading) return;
    const done = state.playback.index >= (state.reading.turns || []).length;
    button.disabled = done;
    if (step) step.disabled = done;
    button.textContent = !done && state.playback.paused ? "Resume" : "Pause";
    button.setAttribute("aria-pressed", state.playback.paused ? "true" : "false");
    document.querySelectorAll("#playback [data-speed]").forEach((speedButton) => {
      speedButton.setAttribute("aria-pressed", speedButton.dataset.speed === state.playback.speed ? "true" : "false");
    });
  }

  function finishPlayback() {
    clearPlayTimer();
    state.playback.paused = true;
    if (state.reading && !$("close-panel")) $("turns").insertAdjacentHTML("afterend", closeFromTurns(state.reading));
    const status = $("play-status");
    if (status) status.textContent = "The sitting is complete.";
    updatePlayButtons();
  }

  function scheduleNext() {
    clearPlayTimer();
    if (state.playback.paused || !state.reading) return;
    if (state.playback.index >= state.reading.turns.length) {
      finishPlayback();
      return;
    }
    const token = state.playback.token;
    state.playback.timer = window.setTimeout(() => {
      if (token !== state.playback.token) return;
      revealNext();
    }, SPEEDS[state.playback.speed] || SPEEDS.normal);
  }

  function revealNext() {
    const reading = state.reading;
    if (!reading || !reading.turns || !$("turns")) return;
    if (state.playback.index >= reading.turns.length) {
      finishPlayback();
      return;
    }
    const index = state.playback.index;
    const turn = reading.turns[index];
    $("turns").insertAdjacentHTML("beforeend", turnHtml(turn, index));
    state.playback.index += 1;
    if ((turn.kind === "chair" || turn.kind === "abstain") && turn.id) playSound(byId(turn.id));
    const status = $("play-status");
    if (status) {
      status.textContent = turn.kind === "moderator"
        ? "The moderator has asked."
        : (turn.kind === "chair" ? `${turn.name} has spoken.` : "A chair sits out.");
    }
    const node = $("turns").lastElementChild;
    if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
    if (state.playback.index >= reading.turns.length) finishPlayback();
    else if (!state.playback.paused) scheduleNext();
    updatePlayButtons();
  }

  function beginPlayback() {
    stopPlaybackClock();
    state.playback.paused = false;
    state.playback.index = 0;
    if ($("turns")) $("turns").innerHTML = "";
    const close = $("close-panel");
    if (close) close.remove();
    revealNext();
  }

  function showFinished(reading) {
    stopPlaybackClock();
    state.playback.paused = true;
    state.playback.index = (reading.turns || []).length;
    if ($("turns")) $("turns").innerHTML = (reading.turns || []).map((turn, index) => turnHtml(turn, index)).join("");
    if (!$("close-panel") && $("turns")) $("turns").insertAdjacentHTML("afterend", closeFromTurns(reading));
    updatePlayButtons();
    const status = $("play-status");
    if (status) status.textContent = "Saved sitting. The full conversation is on the page.";
  }

  async function togglePlay() {
    await unlockAudio();
    if (!state.reading || !state.reading.panel) return;
    if (state.playback.index >= state.reading.turns.length) return;
    state.playback.paused = !state.playback.paused;
    if (state.playback.paused) clearPlayTimer();
    else scheduleNext();
    updatePlayButtons();
  }

  async function stepTurn() {
    await unlockAudio();
    if (!state.reading || !state.reading.panel) return;
    if (state.playback.index >= state.reading.turns.length) return;
    const wasPaused = state.playback.paused;
    clearPlayTimer();
    state.playback.paused = true;
    revealNext();
    if (!wasPaused && state.playback.index < state.reading.turns.length) {
      state.playback.paused = false;
      scheduleNext();
    }
    updatePlayButtons();
  }

  function setSpeed(speed) {
    if (!SPEEDS[speed]) return;
    state.playback.speed = speed;
    saveJson("athenaeum.playback", { speed });
    updatePlayButtons();
    if (!state.playback.paused && state.playback.timer) {
      clearPlayTimer();
      scheduleNext();
    }
  }

  function bindTransport() {
    const play = $("play-toggle");
    const step = $("step-turn");
    const form = $("moderator");
    if (play) play.addEventListener("click", togglePlay);
    if (step) step.addEventListener("click", stepTurn);
    document.querySelectorAll("#playback [data-speed]").forEach((button) => {
      button.addEventListener("click", () => setSpeed(button.dataset.speed));
    });
    if (form) form.addEventListener("submit", askFollow);
  }

  function panelShell(reading) {
    const topics = (reading.topics || []).join(" and ") || "no named topic on this shelf";
    const speeds = ["slow", "normal", "fast"].map((speed) => {
      const label = speed.charAt(0).toUpperCase() + speed.slice(1);
      return `<button type="button" data-speed="${speed}" aria-pressed="${state.playback.speed === speed ? "true" : "false"}">${label}</button>`;
    }).join("");
    const options = [`<option value="table">The whole table</option>`].concat((reading.seated || []).map((id) => {
      const person = byId(id);
      return `<option value="${esc(id)}">${esc(person ? person.name : id)}</option>`;
    })).join("");
    return `
      <p class="kicker">The reading</p>
      <h2>${esc(reading.topic)}</h2>
      <p class="lede">Read against ${esc(topics)}. The first chair addresses the subject. Each later chair answers from a card or a passage that meets what was already raised, or sits out.</p>
      <div class="playback" id="playback" role="group" aria-label="Playback">
        <button type="button" id="play-toggle" aria-pressed="false" aria-keyshortcuts="p">Pause</button>
        <button type="button" id="step-turn" aria-keyshortcuts="n">Next turn</button>
        <div class="speed" role="radiogroup" aria-label="Speed">${speeds}</div>
        <p id="play-status" class="hint" role="status"></p>
      </div>
      <p class="hint playback-keys">Keyboard, when you are not typing: P pauses, N steps to the next turn.</p>
      <form id="moderator" class="moderator-form">
        <label class="field" for="follow-up">Follow-up</label>
        <textarea id="follow-up" maxlength="240" placeholder="A question for the table, or for one chair."></textarea>
        <label class="field" for="follow-target">Ask</label>
        <select id="follow-target">${options}</select>
        <button type="submit" class="solid" id="ask-follow">Ask this</button>
        <p id="follow-note" class="hint" role="status"></p>
      </form>
      <div class="session-tools">
        <button type="button" id="copy-sitting">Copy the reading</button>
        <button type="button" id="download-sitting">Download text</button>
        <button type="button" id="download-pdf">Download PDF</button>
        <button type="button" id="print-sitting">Print</button>
        <button type="button" id="share-sitting">Share link</button>
        <p id="share-note" class="hint" role="status"></p>
      </div>
      <div id="turns"></div>`;
  }

  async function shareSitting(reading) {
    const note = $("share-note");
    let packed = null;
    try { packed = await Share.pack(reading); } catch (err) { packed = null; }
    if (!packed || !packed.ok) {
      if (note) note.textContent = "This sitting is too long for a link. Download the text or the PDF instead.";
      return;
    }
    const url = `${location.origin}${location.pathname}${location.search}${packed.hash}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (err) { copied = false; }
    if (note) note.innerHTML = `${copied ? "Link copied. " : "Copy this link. "}<a href="${esc(packed.hash)}">${esc(url)}</a>`;
  }

  function renderPanel(reading, opts) {
    state.reading = reading;
    state.revealToken += 1;
    const host = $("session");
    host.innerHTML = panelShell(reading);
    $("copy-sitting").addEventListener("click", async () => {
      const button = $("copy-sitting");
      try {
        await navigator.clipboard.writeText(sittingText(reading));
        button.textContent = "Copied";
      } catch (err) { button.textContent = "Copy failed"; }
    });
    $("download-sitting").addEventListener("click", () => downloadSitting(reading));
    $("download-pdf").addEventListener("click", () => downloadPdf(reading));
    $("print-sitting").addEventListener("click", () => window.print());
    $("share-sitting").addEventListener("click", () => shareSitting(reading));
    bindTransport();
    if (opts && opts.play) beginPlayback();
    else showFinished(reading);
  }

  async function askFollow(event) {
    event.preventDefault();
    const reading = state.reading;
    const note = $("follow-note");
    if (!reading || !reading.panel) return;
    const question = $("follow-up").value.trim();
    if (question.length < 8) {
      if (note) note.textContent = "Give the follow-up a few more words.";
      return;
    }
    await unlockAudio();
    const target = $("follow-target").value;
    const person = target === "table" ? null : byId(target);
    if (target !== "table" && !person) {
      if (note) note.textContent = "That chair is no longer on this shelf.";
      return;
    }
    const interrupted = state.playback.index < (reading.turns || []).length;
    const hold = interrupted && state.playback.paused;
    stopPlaybackClock();
    const close = $("close-panel");
    if (close) close.remove();
    reading.turns = (reading.turns || []).slice(0, state.playback.index);
    const moderator = {
      kind: "moderator",
      id: "moderator",
      name: "Moderator",
      toId: person ? person.id : "",
      toName: person ? person.name : "the table",
      text: question,
      editorial: person ? `The moderator asks ${person.name}.` : "The moderator asks the table.",
      paragraphs: [],
      cites: [],
      replyTo: null,
      cards: []
    };
    reading.turns.push(moderator);
    const anchor = { id: "moderator", name: "Moderator", turnIndex: reading.turns.length - 1 };
    const pool = person ? [person] : (reading.seated || []).map(byId).filter(Boolean);
    if (Books) {
      try { await Books.ensure(pool.map((thinker) => thinker.id)); } catch (err) { /* answer from the cards */ }
    }
    const used = usedFromReading(reading);
    const built = Panel.buildRound({
      thinkers: pool,
      text: question,
      relevance: state.relevance,
      scoreThinker: judge,
      distinctive: A.distinctive,
      opening: "moderator",
      anchor,
      usedPassageIds: used
    });
    attachModern(built.turns);
    reading.usedPassages = [...used];
    reading.turns.push(...built.turns);
    $("follow-up").value = "";
    if (note) note.textContent = person ? `Asked ${person.name}.` : "Asked the table.";
    state.playback.paused = !!hold;
    revealNext();
    if (hold) clearPlayTimer();
    updatePlayButtons();
    persistReading(reading);
  }

  function renderReading(reading, opts) {
    if (reading && reading.panel && Array.isArray(reading.turns)) {
      renderPanel(reading, opts);
      return;
    }
    const animate = opts && opts.animate;
    const sound = opts && opts.sound;
    state.revealToken += 1;
    const token = state.revealToken;
    const host = $("session");
    const topics = (reading.topics || []).join(" and ") || "no named topic on this shelf";
    host.innerHTML = `
      <p class="kicker">The reading</p>
      <h2>${esc(reading.topic)}</h2>
      <p class="lede">Read against ${esc(topics)}. Speakers are ordered by how much of their shelf bears on the subject. ${esc((reading.abstained || []).length)} seated chair${(reading.abstained || []).length === 1 ? "" : "s"} sit out.</p>
      <div class="session-tools">
        <button type="button" id="copy-sitting">Copy the reading</button>
        <button type="button" id="download-sitting">Download text</button>
        <button type="button" id="download-pdf">Download PDF</button>
        <button type="button" id="print-sitting">Print</button>
        <button type="button" id="share-sitting">Share link</button>
        <p id="share-note" class="hint" role="status"></p>
      </div>
      <div id="turns"></div>`;
    $("copy-sitting").addEventListener("click", async () => {
      const btn = $("copy-sitting");
      try {
        await navigator.clipboard.writeText(sittingText(reading));
        btn.textContent = "Copied";
      } catch (err) { btn.textContent = "Copy failed"; }
    });
    $("download-sitting").addEventListener("click", () => downloadSitting(reading));
    $("download-pdf").addEventListener("click", () => downloadPdf(reading));
    $("print-sitting").addEventListener("click", () => window.print());
    $("share-sitting").addEventListener("click", () => shareSitting(reading));
    const turns = $("turns");
    const steps = [];
    state.reading = reading;
    (reading.chairs || []).forEach((c, i) => {
      const person = byId(c.id) || { id: c.id, name: c.name, years: "", portrait: "", sound: null };
      steps.push({
        person,
        html: remarkHtml(person, (c.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("") + citeHtml(c.cites, i), c.lean, c.hits ? `${c.hits} passage${c.hits === 1 ? "" : "s"}` : "", i)
      });
    });
    (reading.abstained || []).forEach((a, i) => {
      const turnIndex = (reading.chairs || []).length + i;
      const person = byId(a.id) || { id: a.id, name: a.name, years: "", portrait: "", sound: null };
      steps.push({
        person,
        html: remarkHtml(person, `<p>${esc(a.reason)}</p>`, "abstain", "Sits out", turnIndex)
      });
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) {
      steps.forEach((step, i) => {
        turns.insertAdjacentHTML("beforeend", step.html);
        if (sound) window.setTimeout(() => { if (token === state.revealToken) playSound(step.person); }, i * 420);
      });
      turns.insertAdjacentHTML("beforeend", closeHtml(reading));
      return;
    }
    steps.forEach((step, i) => {
      window.setTimeout(() => {
        if (token !== state.revealToken) return;
        turns.insertAdjacentHTML("beforeend", step.html);
        if (sound) playSound(step.person);
        if (i === steps.length - 1) turns.insertAdjacentHTML("beforeend", closeHtml(reading));
      }, i * 520);
    });
    if (!steps.length) turns.insertAdjacentHTML("beforeend", closeHtml(reading));
  }

  function modernHtml(turn, index) {
    if (!Modern || turn.kind !== "chair") return "";
    const text = Modern.forTurn(turn);
    if (!text) return "";
    const open = !!state.modernDefault;
    return `<button type="button" class="text-btn modern-toggle" data-modern="${index}" aria-expanded="${open ? "true" : "false"}" aria-controls="modern-read-${index}">${open ? "Hide modern read" : "Modern read"}</button>
      <div class="modern-read" id="modern-read-${index}"${open ? "" : " hidden"}><p><span class="note-flag">Paraphrase, not a quotation.</span> ${esc(text)}</p></div>`;
  }

  function applyModernDefault(on) {
    state.modernDefault = !!on;
    try { localStorage.setItem("athenaeum.modern", on ? "1" : "0"); } catch (err) { /* ignore */ }
    document.querySelectorAll("#turns [data-modern]").forEach((button) => {
      const block = document.getElementById(button.getAttribute("aria-controls"));
      if (!block) return;
      block.hidden = !on;
      button.setAttribute("aria-expanded", on ? "true" : "false");
      button.textContent = on ? "Hide modern read" : "Modern read";
    });
  }

  function attachModern(turns) {
    if (!Modern) return;
    (turns || []).forEach((turn) => {
      if (turn.modern && String(turn.modern).trim()) return;
      const text = Modern.forTurn(turn);
      if (text) turn.modern = text;
    });
  }

  function citeHtml(cites, turnIndex) {
    if (!cites || !cites.length) return "";
    return `<div class="cites"><p class="kicker">Writings behind this response</p><ol>${cites.map((c, i) =>
      `<li>${c.fromText ? `<span class="meta">From the full text. </span>` : ""}<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">${esc(c.work)}</a><span class="loc">, ${esc(c.loc)}</span>${c.bears ? `<p class="bears">${esc(c.bears)}</p>` : ""}<button type="button" class="text-btn" data-save-cite="${turnIndex}:${i}">Bookmark this citation</button></li>`).join("")}</ol></div>`;
  }

  function sittingText(reading) {
    if (reading.panel && reading.turns) {
      const lines = [reading.topic, ""];
      reading.turns.forEach((turn) => {
        if (turn.kind === "moderator") {
          lines.push(`Moderator, to ${turn.toName || "the table"}: ${turn.text}`, "");
          return;
        }
        lines.push(turn.name || "The table");
        if (turn.editorial) lines.push(`Note, not a chair's words: ${turn.editorial}`);
        if (turn.replyTo) lines.push(`Answers ${turn.replyTo.name}.`);
        (turn.paragraphs || []).forEach((paragraph) => lines.push(paragraph));
        if (turn.kind === "chair" && turn.modern) lines.push(`Paraphrase, not a quotation: ${turn.modern}`);
        (turn.cites || []).forEach((cite) => lines.push(`  ${cite.work}, ${cite.loc}. ${cite.url}`));
        lines.push("");
      });
      return lines.join("\n");
    }
    const lines = [reading.topic, "", `Operative sentence: ${reading.operative}`, ""];
    (reading.chairs || []).forEach((c) => {
      lines.push(`${c.name} — ${c.lean}`);
      (c.paragraphs || []).forEach((p) => lines.push(p));
      (c.cites || []).forEach((cite) => lines.push(`  ${cite.work}, ${cite.loc}. ${cite.url}`));
      lines.push("");
    });
    (reading.abstained || []).forEach((a) => lines.push(`${a.name} sits out. ${a.reason}`));
    lines.push("", "Where they part company");
    return lines.join("\n");
  }

  function downloadSitting(reading) {
    const blob = new Blob([sittingText(reading)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "athenaeum-reading.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function pdfSafe(s) {
    return String(s == null ? "" : s).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, "-").replace(/[^\x20-\x7E\n]/g, "");
  }
  function pdfEscape(s) {
    return pdfSafe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
  function wrapPdf(text, width) {
    const words = pdfSafe(text).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((w) => {
      if (!w) return;
      const next = line ? `${line} ${w}` : w;
      if (next.length > width) {
        if (line) lines.push(line);
        line = w;
      } else line = next;
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function buildPdf(reading) {
    const pageW = 612;
    const pageH = 792;
    const margin = 54;
    const lines = [];
    const push = (text, size, gap) => lines.push({ text, size, gap });
    push("The Athenaeum", 18, 22);
    push(reading.topic, 14, 18);
    push(reading.operative, 11, 18);
    if (reading.panel && reading.turns) {
      reading.turns.forEach((turn) => {
        if (turn.kind === "moderator") {
          push(`Moderator, to ${turn.toName || "the table"}: ${turn.text}`, 12, 16);
          return;
        }
        push(turn.name || "The table", 13, 16);
        if (turn.editorial) wrapPdf(`Note: ${turn.editorial}`, 88).forEach((text) => push(text, 10, 13));
        if (turn.replyTo) push(`Answers ${turn.replyTo.name}.`, 10, 13);
        (turn.paragraphs || []).forEach((paragraph) => wrapPdf(paragraph, 88).forEach((text) => push(text, 11, 14)));
        if (turn.kind === "chair" && turn.modern) wrapPdf(`Paraphrase, not a quotation: ${turn.modern}`, 88).forEach((text) => push(text, 10, 13));
        (turn.cites || []).forEach((cite) => wrapPdf(`${cite.work}, ${cite.loc}. ${cite.url}`, 86).forEach((text) => push(text, 9, 12)));
        push("", 11, 8);
      });
    }
    (reading.panel ? [] : (reading.chairs || [])).forEach((c) => {
      push(`${c.name} — ${c.lean}`, 13, 16);
      (c.paragraphs || []).forEach((p) => wrapPdf(p, 88).forEach((t) => push(t, 11, 14)));
      (c.cites || []).forEach((cite) => wrapPdf(`${cite.work}, ${cite.loc}. ${cite.url}`, 86).forEach((t) => push(t, 9, 12)));
      push("", 11, 8);
    });
    (reading.panel ? [] : (reading.abstained || [])).forEach((a) => push(`${a.name} sits out. ${a.reason}`, 11, 14));
    const pages = [[]];
    let y = pageH - margin;
    lines.forEach((item) => {
      if (y - item.gap < margin) {
        pages.push([]);
        y = pageH - margin;
      }
      pages[pages.length - 1].push({ ...item, y });
      y -= item.gap;
    });
    const objects = [];
    const add = (body) => { objects.push(body); return objects.length; };
    const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
    const pageIds = [];
    pages.forEach((items) => {
      const cmds = ["BT"];
      items.forEach((item) => {
        if (!item.text) return;
        cmds.push(`/F1 ${item.size} Tf`);
        cmds.push(`1 0 0 1 ${margin} ${item.y} Tm`);
        cmds.push(`(${pdfEscape(item.text)}) Tj`);
      });
      cmds.push("ET");
      const stream = cmds.join("\n");
      const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent PAGES /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contents} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
    });
    const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    objects.forEach((body, i) => { objects[i] = body.replace("Parent PAGES", `Parent ${pagesId} 0 R`); });
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((off) => { pdf += `${String(off).padStart(10, "0")} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  }
  function downloadPdf(reading) {
    const blob = new Blob([buildPdf(reading)], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const slug = pdfSafe(reading.topic).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "reading";
    a.download = `athenaeum-${slug}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function weigh() {
    await unlockAudio();
    const topic = $("topic").value.trim();
    const brief = $("brief").value.trim();
    const err = $("err");
    const table = activeTable();
    const people = state.seated.map(byId).filter(Boolean);
    if (topic.length < 8) { err.textContent = "Give the table a subject — a question or a claim."; return; }
    if (people.length < table.limits.min) {
      err.textContent = `Seat at least ${table.limits.min} chairs.`;
      return;
    }
    err.textContent = "";
    const text = `${topic} ${brief}`.trim();
    if (Books) {
      try { await Books.ensure(people.map((thinker) => thinker.id)); } catch (err) { /* the cards still answer */ }
    }
    const used = new Set();
    const built = Panel.buildRound({
      thinkers: people,
      text,
      relevance: state.relevance,
      scoreThinker: judge,
      distinctive: A.distinctive,
      opening: "subject",
      usedPassageIds: used
    });
    attachModern(built.turns);
    const reading = {
      id: uid(),
      when: new Date().toISOString(),
      topic,
      brief,
      topics: A.subjectTopics(text, state.relevance),
      operative: topic,
      exchanges: [],
      seated: people.map((t) => t.id),
      tableId: table.id,
      panel: true,
      usedPassages: [...used],
      turns: built.turns,
      chairs: [],
      abstained: []
    };
    projectReading(reading);
    state.minutes.unshift(reading);
    persistReading(reading);
    renderShelf();
    renderReading(reading, { play: true });
    $("session").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openDossier(id) {
    const t = byId(id);
    if (!t) return;
    $("dossier-body").innerHTML = `
      <div class="dossier-head">
        <img src="${esc(safeUrl(t.portrait))}" alt="" />
        <div>
          <p class="kicker">${esc(t.years)} · ${esc(t.place)}</p>
          <h2>${esc(t.name)}</h2>
          <p class="meta">${esc(t.epithet)}</p>
        </div>
      </div>
      <p>${esc(t.dossier)}</p>
      <p class="kicker">Writings</p>
      <ul class="works">${(t.works || []).map((w) => `<li><a href="${esc(safeUrl(w.url))}" target="_blank" rel="noopener">${esc(w.title)}</a> — ${esc(w.note)}</li>`).join("")}</ul>
      <button type="button" class="solid" id="close-dossier">Close</button>`;
    $("close-dossier").addEventListener("click", () => $("dossier").close());
    $("dossier").showModal();
  }

  function applySoundControls() {
    const muted = state.sound.muted;
    $("mute").textContent = muted ? "Sound off" : "Sound on";
    $("mute").setAttribute("aria-pressed", muted ? "true" : "false");
    $("volume").value = String(state.sound.volume);
    $("volume").setAttribute("aria-valuetext", `${state.sound.volume} percent`);
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const btn = $("theme");
    btn.textContent = dark ? "Light" : "Dark";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#14110e" : "#1c1712");
    try { localStorage.setItem("athenaeum.theme", dark ? "dark" : "light"); } catch (err) { /* ignore */ }
  }

  function markQuery(text, query) {
    const words = [...new Set(String(query || "").toLowerCase().match(/[a-z]{4,}/g) || [])];
    let html = esc(text);
    words.forEach((word) => {
      const re = new RegExp("\\b(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "ig");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  function renderBookHits(query) {
    const host = $("book-results");
    if (!host) return;
    if (!state.bookHits.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = state.bookHits.map((hit, i) => {
      const person = byId(hit.thinkerId);
      const entry = hit.entry;
      return `<article class="book-hit">
        <p class="meta">${esc(person ? person.name : hit.thinkerId)} · ${esc(entry.work)}</p>
        <p class="loc">${esc(entry.loc)}</p>
        <p class="passage from-text">${markQuery(entry.claim, query)}</p>
        <p class="meta">From the full text</p>
        <div class="row-btns">
          <button type="button" data-book-context="${i}">Context</button>
          <button type="button" data-book-mark="${i}">Bookmark</button>
          <button type="button" data-book-seat="${i}">Seat ${esc(person ? person.name.split(" ").slice(-1)[0] : "this chair")}</button>
          <button type="button" data-book-ask="${i}">Ask the table</button>
        </div>
        <div class="book-context" id="book-context-${i}" hidden></div>
      </article>`;
    }).join("");
  }

  async function searchBooks() {
    const query = $("book-query").value.trim();
    const note = $("book-note");
    if (query.length < 3) {
      if (note) note.textContent = "Give the search a few more words.";
      return;
    }
    const all = $("book-all").checked;
    const ids = thinkerIdsFor(all ? "any" : state.tableFilter);
    if (note) note.textContent = "Searching the books…";
    try {
      await Books.ensure(ids);
    } catch (err) {
      if (note) note.textContent = "The book index could not be loaded.";
      return;
    }
    const rows = [];
    ids.forEach((id) => {
      Books.rankedEntries(id, query, state.relevance, 6).forEach((row) => {
        rows.push({ thinkerId: id, score: row.score, entry: row.entry });
      });
    });
    rows.sort((a, b) => b.score - a.score || a.entry.passageId.localeCompare(b.entry.passageId));
    state.bookHits = rows.slice(0, 12);
    if (note) {
      note.textContent = state.bookHits.length
        ? `${state.bookHits.length} passage${state.bookHits.length === 1 ? "" : "s"}. These are not citations until a chair speaks one.`
        : "No passage in these books matches.";
    }
    renderBookHits(query);
  }

  function showBookContext(index) {
    const hit = state.bookHits[index];
    const host = document.getElementById(`book-context-${index}`);
    if (!hit || !host) return;
    if (!host.hidden && host.innerHTML) {
      host.hidden = true;
      return;
    }
    const rows = Books.contextOf(hit.thinkerId, hit.entry.passageId);
    host.innerHTML = rows.map((row) => `<p class="${row.current ? "current" : "meta"}"><span class="meta">${esc(row.loc)}</span> ${esc(row.text)}</p>`).join("");
    host.hidden = false;
  }

  function bookmarkPassage(index) {
    const hit = state.bookHits[index];
    if (!hit) return;
    const person = byId(hit.thinkerId);
    const row = {
      id: uid(),
      kind: "passage",
      at: new Date().toISOString(),
      sittingId: "",
      tableId: state.tableFilter,
      topic: $("book-query").value.trim(),
      thinkerId: hit.thinkerId,
      thinkerName: person ? person.name : hit.thinkerId,
      excerpt: hit.entry.claim,
      work: hit.entry.work,
      loc: hit.entry.loc,
      url: hit.entry.url,
      passageId: hit.entry.passageId
    };
    state.bookmarks.unshift(row);
    Store.put("bookmarks", row).then(() => {
      $("memory-note").textContent = `Bookmarked a passage from ${row.work}. It is not a citation until a chair speaks it.`;
      renderBookmarks();
    });
  }

  function homeTable(person) {
    return state.tables.find((table) => onTable(person, table.id)) || null;
  }

  function seatFromBooks(thinkerId) {
    const person = byId(thinkerId);
    if (!person) return false;
    if (state.tableFilter !== "any" && onTable(person, state.tableFilter)) {
      if (!state.seated.includes(person.id)) trySeat(person.id);
      return state.seated.includes(person.id);
    }
    if (state.seated.length) {
      $("err").textContent = "A sitting stays inside one tradition. Clear the table before seating someone from another.";
      return false;
    }
    const home = homeTable(person);
    if (!home) return false;
    if (state.tableFilter !== home.id) {
      state.tableFilter = home.id;
      renderHub();
      renderTradition();
    }
    if (!state.seated.includes(person.id)) trySeat(person.id);
    return state.seated.includes(person.id);
  }

  async function askFromBooks(index) {
    const hit = state.bookHits[index];
    if (!hit) return;
    const query = $("book-query").value.trim();
    if (query.length >= 8) {
      $("topic").value = query.slice(0, 180);
      saveJson("athenaeum.draft", { topic: $("topic").value, brief: $("brief").value });
    }
    const seated = seatFromBooks(hit.thinkerId);
    if (!seated) return;
    scheduleScore();
    if ($("topic").value.trim().length < 8) {
      $("book-note").textContent = "Seated. Give the table a longer subject before asking.";
      return;
    }
    if (state.seated.length < activeTable().limits.min) {
      $("book-note").textContent = `Seated. The table needs at least ${activeTable().limits.min} chairs.`;
      return;
    }
    await weigh();
  }

  function bind() {
    $("search").addEventListener("input", () => { state.query = $("search").value; renderRoster(); });
    $("tradition").addEventListener("change", () => {
      const next = $("tradition").value;
      if (!selectTable(next)) $("tradition").value = state.tableFilter;
      else renderTradition();
    });
    const hub = $("hub");
    if (hub) hub.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-table]");
      if (!btn) return;
      if (selectTable(btn.dataset.table)) renderTradition();
    });
    $("roster").addEventListener("click", (e) => {
      const dossier = e.target.closest("[data-dossier]");
      if (dossier) { openDossier(dossier.dataset.dossier); return; }
      const btn = e.target.closest("[data-toggle]");
      if (btn) trySeat(btn.dataset.toggle);
    });
    $("table").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (btn) trySeat(btn.dataset.remove);
    });
    $("clear-table").addEventListener("click", () => {
      setSeated([]);
      $("err").textContent = "";
      $("random-note").textContent = "";
    });
    $("seat-preset").addEventListener("click", seatPreset);
    $("random-table").addEventListener("click", () => randomSeat(false));
    $("reroll").addEventListener("click", () => randomSeat(true));
    $("undo-random").addEventListener("click", undoRandom);
    $("weigh").addEventListener("click", weigh);
    $("compare-go").addEventListener("click", compareTables);
    const pathBox = $("path-box");
    if (pathBox) pathBox.addEventListener("click", (e) => {
      const stop = e.target.closest("[data-path-stop]");
      if (stop) { openPathStop(stop.dataset.pathStop); return; }
      if (e.target.closest("#path-read-btn")) { markPathRead(); return; }
      if (e.target.closest("#path-put")) putPathPassage();
    });
    $("book-go").addEventListener("click", searchBooks);
    $("book-query").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); searchBooks(); }
    });
    $("book-results").addEventListener("click", (e) => {
      const context = e.target.closest("[data-book-context]");
      if (context) { showBookContext(Number(context.dataset.bookContext)); return; }
      const mark = e.target.closest("[data-book-mark]");
      if (mark) { bookmarkPassage(Number(mark.dataset.bookMark)); return; }
      const seat = e.target.closest("[data-book-seat]");
      if (seat) {
        const hit = state.bookHits[Number(seat.dataset.bookSeat)];
        if (hit && seatFromBooks(hit.thinkerId)) $("book-note").textContent = `Seated ${byId(hit.thinkerId).name}.`;
        return;
      }
      const ask = e.target.closest("[data-book-ask]");
      if (ask) askFromBooks(Number(ask.dataset.bookAsk));
    });
    ["topic", "brief"].forEach((id) => {
      $(id).addEventListener("input", () => {
        saveJson("athenaeum.draft", { topic: $("topic").value, brief: $("brief").value });
        scheduleScore();
      });
    });
    document.querySelectorAll("[data-topic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("topic").value = btn.dataset.topic;
        $("brief").value = btn.dataset.brief || "";
        saveJson("athenaeum.draft", { topic: $("topic").value, brief: $("brief").value });
        scheduleScore();
      });
    });
    $("shelf").addEventListener("click", async (e) => {
      const drop = e.target.closest("[data-drop]");
      if (drop) {
        e.stopPropagation();
        const reading = state.minutes[Number(drop.dataset.drop)];
        state.minutes.splice(Number(drop.dataset.drop), 1);
        if (reading && reading.id) Store.remove("sittings", reading.id).catch(() => {});
        renderShelf();
        return;
      }
      const btn = e.target.closest("[data-minute]");
      if (!btn) return;
      const reading = state.minutes[Number(btn.dataset.minute)];
      if (!reading) return;
      await unlockAudio();
      openReading(reading);
    });
    $("seatings").addEventListener("click", (e) => {
      const drop = e.target.closest("[data-drop-seating]");
      if (drop) {
        e.stopPropagation();
        const row = state.seatings[Number(drop.dataset.dropSeating)];
        state.seatings.splice(Number(drop.dataset.dropSeating), 1);
        if (row && row.id) Store.remove("seatings", row.id).catch(() => {});
        renderSeatings();
        return;
      }
      const btn = e.target.closest("[data-seating]");
      if (!btn) return;
      const row = state.seatings[Number(btn.dataset.seating)];
      if (row) loadSeating(row);
    });
    $("save-seating").addEventListener("click", saveSeating);
    $("bookmarks").addEventListener("click", (e) => {
      const drop = e.target.closest("[data-drop-bookmark]");
      if (!drop) return;
      e.stopPropagation();
      const row = state.bookmarks[Number(drop.dataset.dropBookmark)];
      state.bookmarks.splice(Number(drop.dataset.dropBookmark), 1);
      if (row && row.id) Store.remove("bookmarks", row.id).catch(() => {});
      renderBookmarks();
    });
    $("open-tally").addEventListener("click", openTally);
    $("close-tally").addEventListener("click", () => $("tally").close());
    $("tally-table").addEventListener("change", renderTally);
    $("export-memory").addEventListener("click", exportMemory);
    $("import-memory").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", importMemory);
    $("session").addEventListener("click", (e) => {
      const modern = e.target.closest("[data-modern]");
      if (modern) {
        const block = document.getElementById(modern.getAttribute("aria-controls"));
        if (!block) return;
        const open = block.hidden;
        block.hidden = !open;
        modern.setAttribute("aria-expanded", open ? "true" : "false");
        modern.textContent = open ? "Hide modern read" : "Modern read";
        return;
      }
      const turn = e.target.closest("[data-save-turn]");
      if (turn) { bookmarkTurn(Number(turn.dataset.saveTurn)); return; }
      const cite = e.target.closest("[data-save-cite]");
      if (cite) {
        const [turnIndex, citeIndex] = cite.dataset.saveCite.split(":").map(Number);
        bookmarkCite(turnIndex, citeIndex);
      }
    });
    $("dossier").addEventListener("click", (e) => { if (e.target.id === "dossier") $("dossier").close(); });
    $("dossier").addEventListener("cancel", (e) => { e.preventDefault(); $("dossier").close(); });
    $("mute").addEventListener("click", async () => {
      await unlockAudio();
      state.sound.muted = !state.sound.muted;
      saveJson("athenaeum.sound", state.sound);
      applySoundControls();
    });
    $("volume").addEventListener("input", async () => {
      await unlockAudio();
      state.sound.volume = Number($("volume").value);
      saveJson("athenaeum.sound", state.sound);
      applySoundControls();
    });
    $("theme").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    const modernBox = $("modern-default");
    if (modernBox) {
      modernBox.checked = !!state.modernDefault;
      modernBox.addEventListener("change", () => applyModernDefault(modernBox.checked));
    }
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        weigh();
        return;
      }
      if (!state.reading || !state.reading.panel) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && e.target.closest && e.target.closest("input, textarea, select, button, a")) return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "n" || e.key === "N" || e.key === "ArrowRight") {
        e.preventDefault();
        stepTurn();
      }
    });
    document.addEventListener("pointerdown", () => { unlockAudio(); }, { passive: true });
  }

  function renderSeatings() {
    const host = $("seatings");
    host.innerHTML = state.seatings.length
      ? state.seatings.map((row, i) => `<button type="button" data-seating="${i}"><strong>${esc(row.name || "Seating")}</strong><span class="when">${esc(row.when || "")} · ${esc((row.thinkerIds || []).length)} chairs</span><span class="drop" data-drop-seating="${i}">Discard</span></button>`).join("")
      : `<p class="empty">No seatings saved yet.</p>`;
  }

  function renderBookmarks() {
    const host = $("bookmarks");
    if (!host) return;
    host.innerHTML = state.bookmarks.length
      ? state.bookmarks.map((row, i) => {
        const titled = row.kind === "citation" || row.kind === "passage";
        const title = titled ? (row.work || "Passage") : (row.thinkerName || "Turn");
        const detail = titled
          ? `${row.kind === "passage" ? "Full text · " : ""}${row.thinkerName || ""} · ${row.loc || ""}`
          : (row.topic || "");
        return `<button type="button" data-bookmark="${i}"><strong>${esc(title)}</strong><span class="when">${esc(detail)}</span><span class="drop" data-drop-bookmark="${i}">Discard</span></button>`;
      }).join("")
      : `<p class="empty">No bookmarks yet.</p>`;
  }

  async function saveSeating() {
    if (state.tableFilter === "any") {
      $("err").textContent = "Choose one table first.";
      return;
    }
    if (state.seated.length < activeTable().limits.min) {
      $("err").textContent = `Seat at least ${activeTable().limits.min} chairs before saving a seating.`;
      return;
    }
    const row = {
      id: uid(),
      name: $("seating-name").value.trim() || `${activeTable().name} seating`,
      tableId: activeTable().id,
      thinkerIds: state.seated.slice(),
      when: new Date().toISOString()
    };
    state.seatings.unshift(row);
    await Store.put("seatings", row);
    $("seating-name").value = "";
    $("memory-note").textContent = `Saved “${row.name}”.`;
    renderSeatings();
  }

  function loadSeating(row) {
    if (row.tableId && tableById(row.tableId)) state.tableFilter = row.tableId;
    renderHub();
    renderTradition();
    setSeated((row.thinkerIds || []).filter((id) => byId(id)));
    $("memory-note").textContent = `Loaded “${row.name || "seating"}”.`;
    $("err").textContent = "";
  }

  function openReading(reading, opts) {
    $("topic").value = reading.topic || "";
    $("brief").value = reading.brief || "";
    if (reading.tableId && tableById(reading.tableId)) state.tableFilter = reading.tableId;
    renderHub();
    renderTradition();
    setSeated(reading.seated || []);
    if (!(opts && opts.books === false)) scheduleScore();
    renderReading(reading, { play: false, animate: false, sound: false });
  }

  function turnRecord(reading, index) {
    if (reading.turns && reading.turns.length) return reading.turns[index] || null;
    const chair = (reading.chairs || [])[index];
    if (chair) return Object.assign({ kind: "chair", editorial: "" }, chair);
    const quiet = (reading.abstained || [])[index - (reading.chairs || []).length];
    if (!quiet) return null;
    return { kind: "abstain", id: quiet.id, name: quiet.name, editorial: quiet.reason || "", paragraphs: [], cites: [] };
  }

  function bookmarkTurn(index) {
    const reading = state.reading;
    if (!reading) return;
    const turn = turnRecord(reading, index);
    if (!turn) return;
    const row = {
      id: uid(),
      kind: "turn",
      at: new Date().toISOString(),
      sittingId: reading.id || "",
      tableId: reading.tableId || state.tableFilter,
      topic: reading.topic,
      thinkerId: turn.id || "",
      thinkerName: turn.kind === "moderator" ? "Moderator" : (turn.name || "Turn"),
      excerpt: turn.kind === "moderator" ? (turn.text || "") : ((turn.paragraphs && turn.paragraphs.length) ? turn.paragraphs.join(" ") : (turn.editorial || turn.reason || "")),
      work: turn.cites && turn.cites[0] ? turn.cites[0].work : "",
      loc: turn.cites && turn.cites[0] ? turn.cites[0].loc : "",
      url: turn.cites && turn.cites[0] ? turn.cites[0].url : "",
      replyTo: turn.replyTo || null
    };
    state.bookmarks.unshift(row);
    Store.put("bookmarks", row).then(() => {
      $("memory-note").textContent = `Bookmarked ${row.thinkerName}'s turn.`;
      renderBookmarks();
    });
  }

  function bookmarkCite(turnIndex, citeIndex) {
    const reading = state.reading;
    const turn = reading && turnRecord(reading, turnIndex);
    const cite = turn && (turn.cites || [])[citeIndex];
    if (!cite) return;
    const row = {
      id: uid(),
      kind: "citation",
      at: new Date().toISOString(),
      sittingId: reading.id || "",
      tableId: reading.tableId || state.tableFilter,
      topic: reading.topic,
      thinkerId: turn.id,
      thinkerName: turn.name,
      excerpt: cite.bears || "",
      work: cite.work,
      loc: cite.loc,
      url: cite.url
    };
    state.bookmarks.unshift(row);
    Store.put("bookmarks", row).then(() => {
      $("memory-note").textContent = `Bookmarked ${cite.work}.`;
      renderBookmarks();
    });
  }

  function tallyRows(tableId) {
    const counts = new Map();
    state.minutes.forEach((sitting) => {
      if (tableId && tableId !== "all" && sitting.tableId !== tableId) return;
      const source = sitting.turns && sitting.turns.length ? sitting.turns : (sitting.chairs || []);
      source.forEach((turn) => {
        (turn.cites || []).forEach((cite) => {
          const key = `${cite.work}||${cite.loc || ""}`;
          const row = counts.get(key) || { work: cite.work, loc: cite.loc || "", url: cite.url || "", count: 0 };
          row.count += 1;
          counts.set(key, row);
        });
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.work.localeCompare(b.work));
  }

  function renderTally() {
    const tableId = $("tally-table").value;
    const rows = tallyRows(tableId);
    $("tally-body").innerHTML = rows.length
      ? rows.map((row) => `<div class="tally-row"><div><a href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener">${esc(row.work)}</a><div class="meta">${esc(row.loc)}</div></div><span>${row.count}</span></div>`).join("")
      : `<p class="empty">No saved sitting has cited a work yet.</p>`;
  }

  function openTally() {
    const select = $("tally-table");
    select.innerHTML = `<option value="all">All tables</option>` + state.tables.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
    select.value = state.tableFilter !== "any" && tableById(state.tableFilter) ? state.tableFilter : "all";
    renderTally();
    $("tally").showModal();
  }

  async function exportMemory() {
    const data = await Store.dump();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "athenaeum-memory.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    $("memory-note").textContent = "Exported bookmarks, seatings, and full sittings.";
  }

  async function importMemory(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const added = await Store.merge(data);
      state.minutes = await Store.all("sittings");
      state.seatings = await Store.all("seatings");
      state.bookmarks = await Store.all("bookmarks");
      sortMemory();
      renderShelf();
      renderSeatings();
      renderBookmarks();
      $("memory-note").textContent = `Imported ${added.sittings} sittings, ${added.seatings} seatings, and ${added.bookmarks} bookmarks. Nothing already saved was deleted.`;
    } catch (err) {
      $("memory-note").textContent = "That file could not be read as Athenaeum memory.";
    }
  }

  function sortMemory() {
    const stamp = (row) => Date.parse(row.at || row.when || "") || 0;
    state.minutes.sort((a, b) => stamp(b) - stamp(a));
    state.seatings.sort((a, b) => stamp(b) - stamp(a));
    state.bookmarks.sort((a, b) => stamp(b) - stamp(a));
  }

  function inferTable(ids) {
    const matches = state.tables.filter((t) => ids.length && ids.every((id) => onTable(byId(id), t.id)));
    if (matches.length === 1) return matches[0].id;
    const letters = matches.find((t) => t.id === "letters");
    return (letters || matches[0] || state.tables[0]).id;
  }

  async function migrateLocalHistory() {
    if (localStorage.getItem("athenaeum.memoryMigrated") === "1") return;
    const minutes = loadJson("athenaeum.minutes", []);
    for (const reading of minutes) {
      if (!reading || !reading.topic) continue;
      if (!reading.id) reading.id = uid();
      await Store.put("sittings", reading);
    }
    const seats = loadJson("athenaeum.seated", []);
    if (Array.isArray(seats) && seats.length) {
      await Store.put("seatings", {
        id: "legacy-seated",
        name: "Seating kept from this browser",
        tableId: "letters",
        thinkerIds: seats.filter((id) => byId(id)),
        when: new Date().toISOString()
      });
    }
    localStorage.setItem("athenaeum.memoryMigrated", "1");
  }

  async function boot() {
    const catalog = await fetch("data/tables.json").then((r) => r.json());
    state.tables = catalog.tables;
    state.relevance = catalog.relevance;
    state.thinkers = await Promise.all(catalog.thinkers.map((id) => fetch(`data/thinkers/${id}.json`).then((r) => r.json())));
    state.lines = await fetch("data/influence.json").then((r) => r.ok ? r.json() : { edges: [] }).catch(() => ({ edges: [] }));
    state.pathCatalog = await fetch("data/paths.json").then((r) => r.ok ? r.json() : { paths: [] }).catch(() => ({ paths: [] }));
    state.pathProgress = Paths ? Paths.loadProgress(localStorage) : { read: {}, current: {} };
    const savedSeats = loadJson("athenaeum.seated", null);
    const legacy = loadJson("athenaeum.five", null);
    const initial = Array.isArray(savedSeats) ? savedSeats : (Array.isArray(legacy) ? legacy : []);
    state.seated = initial.filter((id) => byId(id));
    if (state.seated.length) state.tableFilter = inferTable(state.seated);
    await migrateLocalHistory();
    state.minutes = (await Store.all("sittings")).filter((m) => m && m.topic);
    state.seatings = await Store.all("seatings");
    state.bookmarks = await Store.all("bookmarks");
    sortMemory();
    const playback = loadJson("athenaeum.playback", null);
    if (playback && SPEEDS[playback.speed]) state.playback.speed = playback.speed;
    const sound = loadJson("athenaeum.sound", null);
    if (sound && typeof sound.muted === "boolean") state.sound.muted = sound.muted;
    if (sound && Number.isFinite(sound.volume)) state.sound.volume = sound.volume;
    const draft = loadJson("athenaeum.draft", {});
    try { state.modernDefault = localStorage.getItem("athenaeum.modern") === "1"; } catch (err) { state.modernDefault = false; }
    const theme = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(theme === "dark" || theme === "light" ? theme : prefer);
    applySoundControls();
    renderTradition();
    if (draft.topic) $("topic").value = draft.topic;
    if (draft.brief) $("brief").value = draft.brief;
    $("only-wrap").hidden = subjectText().length < 3;
    $("panel-size").value = String((activeTable() && activeTable().limits.defaultCount) || 5);
    bind();
    renderRoster();
    renderTable();
    renderShelf();
    renderSeatings();
    renderBookmarks();
    if (state.bookmarks.length) $("memory-note").textContent = `${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? "" : "s"} saved.`;
    let shared = null;
    if (Share && location.hash) {
      try { shared = await Share.unpack(location.hash); } catch (err) { shared = null; }
    }
    if (shared && shared.topic) openReading(shared, { books: false });
    else if (state.minutes[0]) renderReading(state.minutes[0], { animate: false, sound: false });
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      const main = document.querySelector("main");
      if (main) main.insertAdjacentHTML("afterbegin", `<p class="err">The shelf could not be loaded. Open this page through the site, not as a loose file. ${esc(err && err.message)}</p>`);
    });
  });
})();
