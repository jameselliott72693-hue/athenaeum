(function () {
  const A = window.Athenaeum;
  const state = {
    thinkers: [],
    tables: [],
    relevance: null,
    seated: [],
    minutes: [],
    tableFilter: "any",
    query: "",
    scoring: false,
    undo: null,
    audio: null,
    sound: { muted: false, volume: 70 },
    revealToken: 0
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

  function activeTable() {
    if (state.seated.length) {
      const person = byId(state.seated[0]);
      if (person) return tableById(person.tableId) || state.tables[0];
    }
    if (state.tableFilter !== "any") return tableById(state.tableFilter) || state.tables[0];
    return state.tables[0];
  }

  function scoreOf(thinker) {
    return A.scoreThinker(thinker, subjectText(), state.relevance);
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
    const items = (score.matches || []).slice(0, 4).map((m) =>
      `<li>${esc(m.entry.work)}, ${esc(m.entry.loc)}</li>`).join("");
    const body = items || "<li>No passage on this shelf matches.</li>";
    return `<details class="works"><summary>Works on this</summary><ul>${body}</ul></details>`;
  }

  function renderTradition() {
    const select = $("tradition");
    const current = state.tableFilter;
    select.innerHTML = `<option value="any">Any tradition</option>` + state.tables.map((t) =>
      `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
    select.value = current;
    const table = activeTable();
    if (!table) return;
    const size = $("panel-size");
    size.min = String(table.limits.min);
    size.max = String(table.limits.hardMax);
    if (!size.value) size.value = String(table.limits.defaultCount);
    const preset = table.preset || [];
    $("seat-preset").textContent = `Seat the usual ${preset.length}`;
  }

  function renderRoster() {
    const q = state.query.trim().toLowerCase();
    let list = state.thinkers.filter((t) => state.tableFilter === "any" || t.tableId === state.tableFilter);
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
    scheduleScore.timer = window.setTimeout(() => {
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
    if (state.seated.length) {
      const current = byId(state.seated[0]);
      if (current && current.tableId !== person.tableId) {
        err.textContent = "A sitting stays inside one tradition. Clear the table before seating someone from another.";
        return;
      }
    }
    const limits = (tableById(person.tableId) || activeTable()).limits;
    if (state.seated.length >= limits.hardMax) {
      err.textContent = `This table seats ${limits.hardMax} at most. Remove someone first.`;
      return;
    }
    err.textContent = "";
    setSeated(state.seated.concat(id));
  }

  function seatPreset() {
    const table = state.tableFilter === "any" ? state.tables[0] : tableById(state.tableFilter);
    if (!table) return;
    setSeated((table.preset || []).slice(0, table.limits.hardMax));
    $("err").textContent = "";
  }

  function randomSeat(reroll) {
    const table = activeTable();
    const drawn = A.chooseRandom({
      tables: state.tables,
      thinkers: state.thinkers,
      traditionId: state.tableFilter,
      size: Number($("panel-size").value),
      onlyRelevant: $("only-relevant").checked && !$("only-wrap").hidden,
      subject: subjectText(),
      relevance: state.relevance
    });
    const note = $("random-note");
    if (!drawn.ok) {
      note.textContent = drawn.message;
      return;
    }
    if (!state.undo) state.undo = state.seated.slice();
    $("undo-random").disabled = false;
    setSeated(drawn.ids);
    const verb = reroll ? "Rerolled" : "Seated";
    note.textContent = `${verb} ${drawn.ids.length} from ${drawn.table.name}. ${drawn.note}`.trim();
    $("err").textContent = "";
  }

  function undoRandom() {
    if (!state.undo) return;
    const previous = state.undo;
    state.undo = null;
    $("undo-random").disabled = true;
    setSeated(previous);
    $("random-note").textContent = "Restored the seating from before the draw.";
  }

  const LEAN_LINE = {
    for: "I press for the proposal, so far as it accords with the standard I have cited.",
    against: "I press against the proposal. The standard I have cited does not give it a title.",
    qualifies: "I qualify. The proposal has to be tried against the standard, and it does not pass or fail in a word."
  };

  function leanOf(entry, topic, brief) {
    const text = `${topic} ${brief}`.toLowerCase();
    const rupture = /\b(ban|outlaw|discard|abolish|require|direct|mandat|revolution|verify|repress|censor)\b/.test(text);
    const preserve = /\b(preserve|defend|keep|inherit|restore)\b/.test(text) && !rupture;
    const base = entry.press || "qualifies";
    if (preserve && base === "against") return "for";
    if (preserve && base === "for") return "against";
    if (!rupture && !preserve) return base === "against" ? "qualifies" : base;
    return base;
  }

  function applyTo(entry, operative, lean) {
    const act = {
      for: "gives this sentence a title",
      against: "withholds a title from this sentence",
      qualifies: "will not let this sentence pass until it is tried against the standard"
    }[lean];
    return `Applied to “${operative}”: the passage ${act}. ${entry.bears}`;
  }

  function buildSpeech(thinker, topic, brief, scored) {
    const matches = scored.matches.filter((m) => m.score > 0);
    const primary = matches[0] && matches[0].entry;
    if (!primary) return null;
    const secondary = matches[1] ? matches[1].entry : null;
    const operative = (brief || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] || topic;
    const lean = leanOf(primary, topic, brief);
    const paragraphs = [
      thinker.voice || `On “${topic},” I start from what I argued.`,
      brief ? `The sentence I take as operative is: ${operative}` : "No separate brief was laid down, so the question itself has to carry the weight.",
      `From ${primary.work}, ${primary.loc}: ${primary.claim}`,
      applyTo(primary, operative, lean)
    ];
    if (secondary) paragraphs.push(`A further pressure, from ${secondary.work}, ${secondary.loc}: ${secondary.claim}`);
    paragraphs.push(LEAN_LINE[lean]);
    const cites = [primary, secondary].filter(Boolean).map((c) => ({ work: c.work, loc: c.loc, url: c.url, bears: c.bears }));
    return { paragraphs, cites, lean, operative };
  }

  function exchangesOf(session, operative) {
    const by = { for: [], against: [], qualifies: [] };
    session.forEach((s) => { if (by[s.lean]) by[s.lean].push(s); });
    const out = [];
    const pair = (a, b, line) => { if (a && b) out.push({ from: a.name, to: b.name, text: line(a, b) }); };
    pair(by.against[0], by.for[0], (a, b) =>
      `${a.name}, to ${b.name}: the sentence “${operative}” does not get a title from ${a.cites[0].work}. Your lean grants what that passage withholds.`);
    pair(by.qualifies[0], by.against[0] || by.for[0], (a, b) =>
      `${a.name}, to ${b.name}: I will not let “${operative}” pass or fail in a word. ${a.cites[0].work}, ${a.cites[0].loc}, still has to be applied to the facts.`);
    return out.slice(0, 2);
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

  function remarkHtml(person, body, lean, meta) {
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

  function renderReading(reading, opts) {
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
    const turns = $("turns");
    const steps = [];
    (reading.chairs || []).forEach((c) => {
      const person = byId(c.id) || { id: c.id, name: c.name, years: "", portrait: "", sound: null };
      steps.push({
        person,
        html: remarkHtml(person, (c.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("") + citeHtml(c.cites), c.lean, c.hits ? `${c.hits} passage${c.hits === 1 ? "" : "s"}` : "")
      });
    });
    (reading.abstained || []).forEach((a) => {
      const person = byId(a.id) || { id: a.id, name: a.name, years: "", portrait: "", sound: null };
      steps.push({
        person,
        html: remarkHtml(person, `<p>${esc(a.reason)}</p>`, "abstain", "Sits out")
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

  function citeHtml(cites) {
    if (!cites || !cites.length) return "";
    return `<div class="cites"><p class="kicker">Writings behind this response</p><ol>${cites.map((c) =>
      `<li><a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">${esc(c.work)}</a><span class="loc">, ${esc(c.loc)}</span><p class="bears">${esc(c.bears)}</p></li>`).join("")}</ol></div>`;
  }

  function sittingText(reading) {
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
    (reading.chairs || []).forEach((c) => {
      push(`${c.name} — ${c.lean}`, 13, 16);
      (c.paragraphs || []).forEach((p) => wrapPdf(p, 88).forEach((t) => push(t, 11, 14)));
      (c.cites || []).forEach((cite) => wrapPdf(`${cite.work}, ${cite.loc}. ${cite.url}`, 86).forEach((t) => push(t, 9, 12)));
      push("", 11, 8);
    });
    (reading.abstained || []).forEach((a) => push(`${a.name} sits out. ${a.reason}`, 11, 14));
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
    const scored = people.map((t) => ({ t, s: A.scoreThinker(t, text, state.relevance) }));
    const speakers = scored.filter((x) => x.s.speaks).sort((a, b) => b.s.score - a.s.score || a.t.name.localeCompare(b.t.name));
    const quiet = scored.filter((x) => !x.s.speaks);
    const speeches = speakers.map((x) => ({ thinker: x.t, cover: x.s, speech: buildSpeech(x.t, topic, brief, x.s) })).filter((x) => x.speech);
    const operative = (speeches[0] && speeches[0].speech.operative) || topic;
    const session = speeches.map((x) => ({
      id: x.thinker.id,
      name: x.thinker.name,
      lean: x.speech.lean,
      hits: x.cover.hits,
      paragraphs: x.speech.paragraphs,
      cites: x.speech.cites
    }));
    const reading = {
      when: new Date().toLocaleString(),
      topic,
      brief,
      topics: A.subjectTopics(text, state.relevance),
      operative,
      exchanges: exchangesOf(session, operative),
      seated: people.map((t) => t.id),
      tableId: table.id,
      chairs: session,
      abstained: quiet.map((x) => ({
        id: x.t.id,
        name: x.t.name,
        reason: `${x.t.name} has not written on this, on the shelf we have, and sits out.`
      }))
    };
    state.minutes.unshift(reading);
    state.minutes = state.minutes.slice(0, 8);
    saveJson("athenaeum.minutes", state.minutes);
    renderShelf();
    renderReading(reading, { animate: true, sound: true });
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

  function bind() {
    $("search").addEventListener("input", () => { state.query = $("search").value; renderRoster(); });
    $("tradition").addEventListener("change", () => {
      state.tableFilter = $("tradition").value;
      const table = state.tableFilter === "any" ? state.tables[0] : tableById(state.tableFilter);
      if (table) $("panel-size").value = String(table.limits.defaultCount);
      renderTradition();
      renderRoster();
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
        state.minutes.splice(Number(drop.dataset.drop), 1);
        saveJson("athenaeum.minutes", state.minutes);
        renderShelf();
        return;
      }
      const btn = e.target.closest("[data-minute]");
      if (!btn) return;
      const reading = state.minutes[Number(btn.dataset.minute)];
      if (!reading) return;
      await unlockAudio();
      $("topic").value = reading.topic || "";
      $("brief").value = reading.brief || "";
      setSeated(reading.seated || []);
      scheduleScore();
      renderReading(reading, { animate: true, sound: true });
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
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        weigh();
      }
    });
    document.addEventListener("pointerdown", () => { unlockAudio(); }, { passive: true });
  }

  async function boot() {
    const catalog = await fetch("data/tables.json").then((r) => r.json());
    state.tables = catalog.tables;
    state.relevance = catalog.relevance;
    state.thinkers = await Promise.all(catalog.thinkers.map((id) => fetch(`data/thinkers/${id}.json`).then((r) => r.json())));
    const savedSeats = loadJson("athenaeum.seated", null);
    const legacy = loadJson("athenaeum.five", null);
    const initial = Array.isArray(savedSeats) ? savedSeats : (Array.isArray(legacy) ? legacy : []);
    state.seated = initial.filter((id) => byId(id));
    state.minutes = loadJson("athenaeum.minutes", []).filter((m) => m && m.topic).slice(0, 8);
    const sound = loadJson("athenaeum.sound", null);
    if (sound && typeof sound.muted === "boolean") state.sound.muted = sound.muted;
    if (sound && Number.isFinite(sound.volume)) state.sound.volume = sound.volume;
    const draft = loadJson("athenaeum.draft", {});
    const theme = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(theme === "dark" || theme === "light" ? theme : prefer);
    applySoundControls();
    renderTradition();
    if (draft.topic) $("topic").value = draft.topic;
    if (draft.brief) $("brief").value = draft.brief;
    $("only-wrap").hidden = subjectText().length < 3;
    $("panel-size").value = String((state.tables[0] && state.tables[0].limits.defaultCount) || 5);
    bind();
    renderRoster();
    renderTable();
    renderShelf();
    if (state.minutes[0]) renderReading(state.minutes[0], { animate: false, sound: false });
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      const main = document.querySelector("main");
      if (main) main.insertAdjacentHTML("afterbegin", `<p class="err">The shelf could not be loaded. Open this page through the site, not as a loose file. ${esc(err && err.message)}</p>`);
    });
  });
})();
