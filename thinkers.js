(function (root, factory) {
  const docket = typeof module === "object" && module.exports ? require("./docket.js") : root.AthenaeumDocket;
  const api = factory(docket);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumThinkers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (docket) {
  function ordinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    const mod10 = n % 10;
    if (mod10 === 1) return `${n}st`;
    if (mod10 === 2) return `${n}nd`;
    if (mod10 === 3) return `${n}rd`;
    return `${n}th`;
  }

  function centuryLabel(year) {
    if (!Number.isFinite(year) || year === 0) return "";
    if (year < 0) return `${ordinal(Math.ceil((-year) / 100))} century BCE`;
    return `${ordinal(Math.ceil(year / 100))} century`;
  }

  function eraFromYears(years) {
    const text = String(years || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    const centuryOnly = text.match(/^(?:c\.?\s+)?(\d{1,2})(?:st|nd|rd|th)\s+century(?:\s+(BCE|BC|CE|AD))?$/i);
    const yearMatch = text.match(/(\d{2,4})(?!\s*(?:st|nd|rd|th))/);
    if (!yearMatch && centuryOnly) {
      const n = Number(centuryOnly[1]);
      const tag = String(centuryOnly[2] || "").toUpperCase();
      const bce = tag === "BC" || tag === "BCE";
      return { label: `${ordinal(n)} century${bce ? " BCE" : ""}`, sort: bce ? -(n * 100 - 50) : ((n - 1) * 100 + 50) };
    }
    if (!yearMatch) return null;
    let year = Number(yearMatch[1]);
    if (/\b(?:BCE|BC)\b/i.test(text)) year = -year;
    const label = centuryLabel(year);
    if (!label) return null;
    return { label, sort: year };
  }

  function lastToken(name) {
    const stop = new Set(["jr", "sr", "ii", "iii", "iv", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "of", "the", "de", "van", "von", "la", "in", "st", "dr", "pope", "saint"]);
    const parts = docket.chairKey(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 3 && !stop.has(part));
    return parts.length ? parts[parts.length - 1] : "";
  }

  function samePerson(catalogName, seatedName) {
    if (docket.chairKey(catalogName) === docket.chairKey(seatedName)) return true;
    const catalogToken = lastToken(catalogName);
    const seatedToken = lastToken(seatedName);
    return !!catalogToken && catalogToken === seatedToken;
  }

  function seatId(name) {
    const slug = docket.chairKey(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `seat:${slug || "chair"}`;
  }

  function plural(n, one, many) {
    const count = Number(n) || 0;
    return `${count} ${count === 1 ? one : many}`;
  }

  function pairId(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function preferName(counts, fallback) {
    let best = fallback || "";
    let n = -1;
    counts.forEach((count, name) => {
      if (count > n || (count === n && String(name).localeCompare(best) < 0)) {
        best = name;
        n = count;
      }
    });
    return best;
  }

  function blankSeat() {
    return {
      names: new Map(),
      rosterIds: new Set(),
      years: [],
      traditions: [],
      works: [],
      portrait: "",
      sittings: [],
      quotes: []
    };
  }

  function catalogWorks(file) {
    return ((file && file.works) || []).filter((work) => work && work.title).map((work) => ({
      title: String(work.title),
      url: docket.httpUrl(work.url) || "",
      note: work.note ? String(work.note) : ""
    }));
  }

  function traditionsFor(file, membership, seat) {
    const out = [];
    const rows = membership || [];
    const primary = file && file.tableId ? rows.find((row) => row.id === file.tableId) : null;
    if (primary && primary.tradition) out.push(primary.tradition);
    rows.forEach((row) => {
      if (row.tradition && !out.includes(row.tradition)) out.push(row.tradition);
    });
    if (seat) {
      seat.traditions.forEach((tradition) => {
        if (tradition && !out.includes(tradition)) out.push(tradition);
      });
    }
    return out;
  }

  function assemble(input) {
    const source = input || {};
    const tables = source.tables || {};
    const files = new Map();
    (source.thinkers || []).forEach((file) => {
      if (file && file.id) files.set(String(file.id), file);
    });
    const membership = new Map();
    (tables.tables || []).forEach((table) => {
      const seen = new Set();
      (table.thinkers || []).forEach((id) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (!membership.has(id)) membership.set(id, []);
        membership.get(id).push({
          id: table.id,
          name: table.name || "",
          tradition: table.tradition || ""
        });
      });
    });

    const seats = new Map();
    const seenSitting = new Set();
    const appearances = [];
    (source.records || []).forEach((record) => {
      const night = record && record.night;
      const date = record && record.date ? String(record.date) : "";
      if (!date || !night) return;
      const label = record.label || night.date_long || date;
      (night.sittings || []).forEach((sitting, index) => {
        const rawId = sitting && sitting.id != null ? String(sitting.id) : "";
        const safeId = /^[A-Za-z0-9-]+$/.test(rawId) ? rawId : "";
        const appearanceId = safeId ? `${date}/${safeId}` : `${date}/~${index}`;
        if (seenSitting.has(appearanceId)) return;
        seenSitting.add(appearanceId);
        const href = docket.placeUrl(date, safeId ? `#sitting-${safeId}` : "");
        const chairs = (sitting && sitting.chairs) || [];
        const names = [];
        chairs.forEach((chair) => {
          const name = chair && chair.name ? String(chair.name).trim() : "";
          if (!name) return;
          const key = docket.chairKey(name);
          if (!key) return;
          names.push(name);
          let seat = seats.get(key);
          if (!seat) {
            seat = blankSeat();
            seats.set(key, seat);
          }
          seat.names.set(name, (seat.names.get(name) || 0) + 1);
          if (chair.roster_id) seat.rosterIds.add(String(chair.roster_id));
          if (chair.years && !seat.years.includes(String(chair.years))) seat.years.push(String(chair.years));
          if (chair.tradition && !seat.traditions.includes(String(chair.tradition))) seat.traditions.push(String(chair.tradition));
          (Array.isArray(chair.works) ? chair.works : []).forEach((work) => {
            const title = String(work || "").trim();
            if (title && !seat.works.includes(title)) seat.works.push(title);
          });
          if (!seat.portrait) seat.portrait = docket.portraitPath(chair.portrait);
          const mark = `${appearanceId}\0${key}`;
          if (seat._seen && seat._seen.has(mark)) return;
          if (!seat._seen) seat._seen = new Set();
          seat._seen.add(mark);
          const row = {
            date,
            label,
            id: safeId,
            section: sitting.section || "",
            headline: sitting.headline || sitting.question || "",
            href
          };
          seat.sittings.push(row);
          if (chair.paraphrase_only) return;
          (chair.quotes || []).forEach((quote) => {
            if (!quote || quote.verified !== true || !quote.text) return;
            seat.quotes.push({
              text: String(quote.text),
              work: quote.work ? String(quote.work) : "",
              location: quote.location ? String(quote.location) : "",
              source_url: quote.source_url || "",
              passage_url: quote.passage_url || "",
              archived: quote.archived || "",
              verified: true,
              label,
              href
            });
          });
        });
        appearances.push({
          id: appearanceId,
          safeId,
          date,
          label,
          section: sitting.section || "",
          headline: sitting.headline || sitting.question || "",
          href,
          agreedText: (sitting.briefing && sitting.briefing.agreed) || "",
          splitText: (sitting.briefing && sitting.briefing.split) || "",
          names: docket.distinctChairs(names)
        });
      });
    });

    const order = [];
    const seenOrder = new Set();
    (tables.thinkers || []).forEach((id) => {
      if (!id || seenOrder.has(id)) return;
      seenOrder.add(id);
      order.push(String(id));
    });
    files.forEach((file, id) => {
      if (!seenOrder.has(id)) {
        seenOrder.add(id);
        order.push(id);
      }
    });

    const consumed = new Set();
    function claim(key) {
      if (!key || consumed.has(key) || !seats.has(key)) return null;
      consumed.add(key);
      return seats.get(key);
    }

    const thinkers = [];
    const keyToId = new Map();
    const usedIds = new Set(order);

    function pushDossier(row, seatKeys) {
      thinkers.push(row);
      (seatKeys || []).forEach((key) => keyToId.set(key, row.id));
    }

    order.forEach((id) => {
      const file = files.get(id) || null;
      const name = file && file.name ? String(file.name) : id;
      const seatKeys = [];
      let seat = claim(docket.chairKey(name));
      if (seat) seatKeys.push(docket.chairKey(name));
      if (!seat) {
        const holders = [];
        seats.forEach((row, key) => {
          if (row.rosterIds.has(id)) holders.push(key);
        });
        if (holders.length === 1 && !consumed.has(holders[0]) && seats.get(holders[0]).rosterIds.size === 1) {
          const held = seats.get(holders[0]);
          const seated = preferName(held.names, holders[0]);
          if (samePerson(name, seated)) {
            seat = claim(holders[0]);
            if (seat) seatKeys.push(holders[0]);
          }
        }
      }
      const years = file && file.years ? [String(file.years)] : (seat ? seat.years.slice() : []);
      const works = catalogWorks(file);
      pushDossier({
        id,
        name,
        seatedNames: seat ? preferList(seat.names) : [],
        years,
        yearsLabel: years.join(" · "),
        place: file && file.place ? String(file.place) : "",
        epithet: file && file.epithet ? String(file.epithet) : "",
        dossier: file && file.dossier ? String(file.dossier) : "",
        portrait: docket.portraitPath(file && file.portrait) || (seat && seat.portrait) || "",
        traditions: traditionsFor(file, membership.get(id), seat),
        tables: (membership.get(id) || []).map((row) => ({ id: row.id, name: row.name, tradition: row.tradition })),
        works: works.length ? works : ((seat && seat.works) || []).map((title) => ({ title, url: "", note: "" })),
        shelfId: file ? id : "",
        shelfName: file && file.name ? String(file.name) : "",
        shelfSameName: true,
        guest: !file,
        sittings: seat ? seat.sittings : [],
        quotes: seat ? seat.quotes : [],
        sittingCount: seat ? seat.sittings.length : 0,
        era: eraFromYears(years[0] || ""),
        agrees: [],
        disagrees: []
      }, seatKeys);
    });

    seats.forEach((seat, key) => {
      if (consumed.has(key)) return;
      consumed.add(key);
      const name = preferName(seat.names, key);
      const roster = [...seat.rosterIds];
      let shelfId = "";
      let shelfName = "";
      let shelfSameName = false;
      if (roster.length === 1 && files.has(roster[0])) {
        const file = files.get(roster[0]);
        shelfId = roster[0];
        shelfName = file && file.name ? String(file.name) : roster[0];
        shelfSameName = docket.chairKey(shelfName) === key;
      }
      let id = seatId(name);
      if (usedIds.has(id)) {
        let n = 2;
        while (usedIds.has(`${id}-${n}`)) n += 1;
        id = `${id}-${n}`;
      }
      usedIds.add(id);
      const years = seat.years.slice();
      pushDossier({
        id,
        name,
        seatedNames: preferList(seat.names),
        years,
        yearsLabel: years.join(" · "),
        place: "",
        epithet: "",
        dossier: "",
        portrait: seat.portrait || "",
        traditions: traditionsFor(null, [], seat),
        tables: [],
        works: seat.works.map((title) => ({ title, url: "", note: "" })),
        shelfId,
        shelfName,
        shelfSameName,
        guest: true,
        sittings: seat.sittings,
        quotes: seat.quotes,
        sittingCount: seat.sittings.length,
        era: eraFromYears(years[0] || ""),
        agrees: [],
        disagrees: []
      }, [key]);
    });

    const byId = {};
    thinkers.forEach((row) => { byId[row.id] = row; });

    const agreedIds = new Set((source.agreementRows || []).map((row) => (row && row.id != null ? String(row.id) : "")).filter(Boolean));
    const pairMap = new Map();
    appearances.forEach((item) => {
      const byDossier = new Map();
      item.names.forEach((name) => {
        const id = keyToId.get(docket.chairKey(name));
        if (!id) return;
        if (!byDossier.has(id)) byDossier.set(id, []);
        byDossier.get(id).push(name);
      });
      const ids = [...byDossier.keys()];
      if (ids.length < 2) return;
      const agreed = !!(item.safeId && agreedIds.has(item.id));
      const splitKeys = new Set();
      if (agreed) {
        const rel = docket.chairRelations([{
          id: item.id,
          chairs: item.names,
          split: item.splitText
        }], [{ id: item.id }]);
        Object.keys(rel.disagree).forEach((left) => {
          Object.keys(rel.disagree[left]).forEach((right) => {
            splitKeys.add(left < right ? `${left}\0${right}` : `${right}\0${left}`);
          });
        });
      }
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const id = pairId(ids[i], ids[j]);
          if (!pairMap.has(id)) {
            const a = ids[i] < ids[j] ? ids[i] : ids[j];
            const b = ids[i] < ids[j] ? ids[j] : ids[i];
            pairMap.set(id, { id, a, b, together: 0, agree: 0, disagree: 0, sittings: [] });
          }
          const pair = pairMap.get(id);
          pair.together += 1;
          if (agreed) pair.agree += 1;
          let split = false;
          byDossier.get(ids[i]).forEach((left) => {
            byDossier.get(ids[j]).forEach((right) => {
              const a = docket.chairKey(left);
              const b = docket.chairKey(right);
              const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
              if (splitKeys.has(key)) split = true;
            });
          });
          if (split) pair.disagree += 1;
          pair.sittings.push({
            id: item.id,
            date: item.date,
            label: item.label,
            section: item.section,
            headline: item.headline,
            href: item.href,
            agreed,
            split,
            agreedText: agreed ? String(item.agreedText || "") : "",
            splitText: split ? String(item.splitText || "") : ""
          });
        }
      }
    });

    const pairs = [...pairMap.values()].sort((a, b) => {
      if (b.together !== a.together) return b.together - a.together;
      return a.id.localeCompare(b.id);
    });
    thinkers.forEach((row) => {
      row.agrees = topFromPairs(row.id, pairs, "agree", byId, 5);
      row.disagrees = topFromPairs(row.id, pairs, "disagree", byId, 5);
    });
    thinkers.sort((a, b) => a.name.localeCompare(b.name));

    return {
      thinkers,
      byId,
      pairs,
      traditions: traditionOptions(tables, thinkers),
      eras: eraOptions(thinkers)
    };
  }

  function preferList(counts) {
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map((row) => row[0]);
  }

  function topFromPairs(id, pairs, field, byId, limit) {
    return pairs.filter((pair) => (pair.a === id || pair.b === id) && pair[field] > 0).map((pair) => {
      const other = pair.a === id ? pair.b : pair.a;
      return { id: other, name: byId[other].name, count: pair[field] };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit || 5);
  }

  function traditionOptions(tables, thinkers) {
    const primary = [];
    ((tables && tables.tables) || []).forEach((table) => {
      if (table && table.tradition && !primary.includes(table.tradition)) primary.push(table.tradition);
    });
    const used = new Set();
    (thinkers || []).forEach((row) => (row.traditions || []).forEach((tradition) => used.add(tradition)));
    const tableTraditions = primary.filter((tradition) => used.has(tradition));
    const rest = [...used].filter((tradition) => !tableTraditions.includes(tradition)).sort((a, b) => a.localeCompare(b));
    return { primary: tableTraditions, rest };
  }

  function eraOptions(thinkers) {
    const map = new Map();
    (thinkers || []).forEach((row) => {
      if (!row.era) return;
      if (!map.has(row.era.label) || row.era.sort < map.get(row.era.label)) map.set(row.era.label, row.era.sort);
    });
    return [...map.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map((row) => row[0]);
  }

  function filterThinkers(thinkers, options) {
    const opts = options || {};
    const query = String(opts.query || "").trim().toLowerCase();
    const tradition = opts.tradition && opts.tradition !== "all" ? opts.tradition : "";
    const era = opts.era && opts.era !== "all" ? opts.era : "";
    const frequency = opts.frequency || "any";
    return (thinkers || []).filter((row) => {
      if (query) {
        const hay = [row.name].concat(row.seatedNames || []).join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (tradition && !(row.traditions || []).includes(tradition)) return false;
      if (era && (!row.era || row.era.label !== era)) return false;
      const count = row.sittingCount || 0;
      if (frequency === "seated" && count < 1) return false;
      if (frequency === "often" && count < 5) return false;
      if (frequency === "unseated" && count !== 0) return false;
      return true;
    });
  }

  function sortThinkers(thinkers, mode) {
    const list = (thinkers || []).slice();
    list.sort((a, b) => {
      if (mode === "frequency" && a.sittingCount !== b.sittingCount) return b.sittingCount - a.sittingCount;
      if (mode === "earliest" || mode === "latest") {
        const as = a.era ? a.era.sort : null;
        const bs = b.era ? b.era.sort : null;
        if (as == null && bs != null) return 1;
        if (bs == null && as != null) return -1;
        if (as != null && bs != null && as !== bs) return mode === "earliest" ? as - bs : bs - as;
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  function filterPairs(pairs, options, byId) {
    const opts = options || {};
    const query = String(opts.query || "").trim().toLowerCase();
    const min = Number(opts.minShared);
    const floor = Number.isFinite(min) && min >= 1 ? Math.floor(min) : 1;
    return (pairs || []).filter((pair) => {
      if ((pair.together || 0) < floor) return false;
      if (!query) return true;
      const a = byId[pair.a];
      const b = byId[pair.b];
      if (!a || !b) return false;
      const hay = [a.name, b.name].concat(a.seatedNames || [], b.seatedNames || []).join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function sortPairs(pairs, mode, byId) {
    const list = (pairs || []).slice();
    const label = (pair) => {
      const names = orderedNames(pair, byId);
      return `${names[0]} ${names[1]}`;
    };
    list.sort((a, b) => {
      if (mode === "disagreement") {
        if (a.disagree !== b.disagree) return b.disagree - a.disagree;
        const ar = a.agree ? a.disagree / a.agree : 0;
        const br = b.agree ? b.disagree / b.agree : 0;
        if (ar !== br) return br - ar;
      } else if (mode === "shared") {
        if (a.together !== b.together) return b.together - a.together;
      } else if (a.agree !== b.agree) return b.agree - a.agree;
      if (mode !== "shared" && a.together !== b.together) return b.together - a.together;
      return label(a).localeCompare(label(b));
    });
    return list;
  }

  function axisOrder(pairs, mode, byId) {
    const score = {};
    (pairs || []).forEach((pair) => {
      const metric = mode === "disagreement" ? pair.disagree : mode === "shared" ? pair.together : pair.agree;
      score[pair.a] = (score[pair.a] || 0) + metric;
      score[pair.b] = (score[pair.b] || 0) + metric;
    });
    return Object.keys(score).sort((a, b) => {
      if (score[b] !== score[a]) return score[b] - score[a];
      return byId[a].name.localeCompare(byId[b].name);
    });
  }

  function gridAxes(axes, options) {
    const opts = options || {};
    const cap = Number(opts.cap) > 0 ? Math.floor(Number(opts.cap)) : 18;
    const list = axes || [];
    if (list.length <= cap) return { axes: list, truncated: 0 };
    return { axes: list.slice(0, cap), truncated: list.length - cap };
  }

  function orderedNames(pair, byId) {
    const a = byId[pair.a] ? byId[pair.a].name : pair.a;
    const b = byId[pair.b] ? byId[pair.b].name : pair.b;
    return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
  }

  function orderedIds(pair, byId) {
    const names = orderedNames(pair, byId);
    const first = byId[pair.a] && byId[pair.a].name === names[0] ? pair.a : pair.b;
    const second = first === pair.a ? pair.b : pair.a;
    return [first, second];
  }

  function pairSummary(pair, byId) {
    const names = orderedNames(pair, byId);
    return `${names[0]} and ${names[1]}. ${plural(pair.together, "shared sitting", "shared sittings")}, ${plural(pair.agree, "agreement", "agreements")}, ${plural(pair.disagree, "split", "splits")}.`;
  }

  function tone(pair) {
    if (!pair || pair.together < 1) return "tone-meet";
    if (pair.agree === 0) return "tone-meet";
    if (pair.disagree === 0) return "tone-agree";
    if (pair.disagree >= pair.agree) return "tone-split";
    return "tone-mixed";
  }

  function initials(name) {
    return String(name || "")
      .replace(/\(.*?\)/g, " ")
      .split(/[^A-Za-zÀ-ÿ]+/)
      .filter((part) => part && part.toLowerCase() !== "in" && part.toLowerCase() !== "of")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  }

  function listHtml(thinkers, selectedId) {
    if (!thinkers || !thinkers.length) return `<li class="hint">No thinker matches.</li>`;
    return thinkers.map((row) => {
      const on = row.id === selectedId;
      const meta = [row.traditions && row.traditions[0], plural(row.sittingCount, "sitting", "sittings")].filter(Boolean).join(" · ");
      return `<li><button type="button" class="thinker-pick" data-thinker="${docket.escapeAttr(row.id)}"${on ? ' aria-current="true"' : ""}><span class="name">${docket.escapeText(row.name)}</span><span class="meta">${docket.escapeText(meta)}</span></button></li>`;
    }).join("");
  }

  function relationHtml(rows, kind, selfId) {
    if (!rows || !rows.length) {
      return kind === "agree"
        ? `<p class="hint">No other chair shares a recorded agreement.</p>`
        : `<p class="hint">No recorded split puts another chair on the other side.</p>`;
    }
    return `<ul class="chair-relations">${rows.map((row) => {
      const label = kind === "agree"
        ? plural(row.count, "shared agreement", "shared agreements")
        : plural(row.count, "split", "splits");
      const href = `thinkers.html?thinker=${encodeURIComponent(row.id)}`;
      const where = `thinkers.html?pair=${encodeURIComponent(pairId(selfId, row.id))}`;
      return `<li><a class="tap-target thinker-jump" href="${docket.escapeAttr(href)}">${docket.escapeText(row.name)}</a> <span class="meta">${docket.escapeText(label)}</span> <a class="tap-target thinker-jump" href="${docket.escapeAttr(where)}">Where they met</a></li>`;
    }).join("")}</ul>`;
  }

  function dossierHtml(row) {
    if (!row) {
      return `<h3>Not on the shelf or the docket</h3><p class="err thinker-alert" role="alert">That chair is not in the catalog and was not seated on a night.</p>`;
    }
    const meta = [row.yearsLabel, row.place].filter(Boolean).join(" · ");
    const portraitPath = docket.portraitPath(row.portrait);
    const portrait = portraitPath
      ? `<img src="${docket.escapeAttr(portraitPath)}" alt="" width="84" height="84" decoding="async" />`
      : `<span class="monogram" aria-hidden="true">${docket.escapeText(initials(row.name))}</span>`;
    const epithet = row.epithet ? `<p class="meta">${docket.escapeText(row.epithet)}</p>` : "";
    const note = row.dossier ? `<p>${docket.escapeText(row.dossier)}</p>` : "";
    const traditions = row.traditions && row.traditions.length
      ? `<p class="meta">${docket.escapeText(row.traditions.join(" · "))}</p>`
      : "";
    const aliases = (row.seatedNames || []).filter((name) => docket.chairKey(name) !== docket.chairKey(row.name));
    const seated = aliases.length
      ? `<p class="meta">Seated as ${docket.escapeText(aliases.join(", "))}</p>`
      : "";
    const shelf = row.shelfId
      ? (row.shelfSameName
        ? `<a class="shelf-link tap-target" href="index.html#thinker=${docket.escapeAttr(row.shelfId)}">On the shelf</a>`
        : `<a class="shelf-link tap-target" href="index.html#thinker=${docket.escapeAttr(row.shelfId)}">${docket.escapeText(row.shelfName)} on the shelf</a>`)
      : "";
    const docketLinks = (row.seatedNames || []).map((name) => {
      const text = docket.chairKey(name) === docket.chairKey(row.name) ? "On the docket" : `On the docket as ${name}`;
      return `<a class="tap-target" href="${docket.escapeAttr(docket.chairUrl(name))}">${docket.escapeText(text)}</a>`;
    }).join(" ");
    const links = [shelf, docketLinks].filter(Boolean).join(" ");
    const count = row.sittingCount
      ? `<p class="meta">${docket.escapeText(`Seated at ${plural(row.sittingCount, "sitting", "sittings")}.`)}</p>`
      : `<p class="hint">No sitting on the docket seats this chair.</p>`;
    const works = row.works && row.works.length
      ? `<ul class="works">${row.works.map((work) => {
        const title = docket.escapeText(work.title);
        const noteBit = work.note ? ` — ${docket.escapeText(work.note)}` : "";
        const href = docket.httpUrl(work.url);
        const body = href
          ? `<a href="${docket.escapeAttr(href)}" target="_blank" rel="noopener">${title}</a>${noteBit}`
          : `${title}${noteBit}`;
        return `<li>${body}</li>`;
      }).join("")}</ul>`
      : `<p class="hint">No works are recorded for this chair.</p>`;
    const sittings = row.sittings && row.sittings.length
      ? `<ul class="chair-sittings">${row.sittings.map((sitting) => `<li><a class="tap-target" href="${docket.escapeAttr(sitting.href)}"><span class="kicker">${docket.escapeText([sitting.label, sitting.section].filter(Boolean).join(" · "))}</span><strong>${docket.escapeText(sitting.headline || sitting.id || "Sitting")}</strong></a></li>`).join("")}</ul>`
      : `<p class="hint">No sittings on the docket.</p>`;
    const quotes = row.quotes && row.quotes.length
      ? `<ol class="chair-quotes">${row.quotes.map((quote) => {
        const cite = docket.quoteCitationHtml(quote);
        return `<li class="chair-quote"><q class="vq">${docket.escapeText(quote.text)}</q><p class="meta"><a class="tap-target" href="${docket.escapeAttr(quote.href)}">${docket.escapeText(quote.label || "")}</a></p>${cite ? `<ol class="cites">${cite}</ol>` : ""}</li>`;
      }).join("")}</ol>`
      : `<p class="hint">No verified quotation on these nights.</p>`;
    return `<div class="dossier-head">${portrait}<div><p class="kicker">${docket.escapeText(meta)}</p><h3 id="dossier-title" tabindex="-1">${docket.escapeText(row.name)}</h3>${epithet}</div></div>
      ${traditions}
      ${seated}
      ${links ? `<p class="hint">${links}</p>` : ""}
      ${count}
      ${note}
      <section class="chair-block"><h4>Works</h4>${works}</section>
      <section class="chair-block"><h4>Sittings</h4>${sittings}</section>
      <section class="chair-block"><h4>Verified quotations</h4>${quotes}</section>
      <section class="chair-block"><h4>Agrees most often with</h4>${relationHtml(row.agrees, "agree", row.id)}</section>
      <section class="chair-block"><h4>Disagrees most often with</h4>${relationHtml(row.disagrees, "disagree", row.id)}</section>`;
  }

  function matrixHtml(axes, pairs, byId, selectedPairId) {
    if (!axes || !axes.length) return `<p class="hint">No pair matches.</p>`;
    const map = new Map((pairs || []).map((pair) => [pair.id, pair]));
    const head = axes.map((id) => {
      const name = byId[id].name;
      return `<th scope="col"><button type="button" class="matrix-colhead" data-thinker="${docket.escapeAttr(id)}" title="${docket.escapeAttr(name)}"><span>${docket.escapeText(name)}</span></button></th>`;
    }).join("");
    const body = axes.map((rowId) => {
      const cells = axes.map((colId) => {
        if (rowId === colId) return `<td class="matrix-self"></td>`;
        const id = pairId(rowId, colId);
        const pair = map.get(id);
        if (!pair) return `<td class="matrix-empty"></td>`;
        const label = pairSummary(pair, byId);
        const pressed = id === selectedPairId ? "true" : "false";
        return `<td><button type="button" class="matrix-cell ${tone(pair)}" data-pair="${docket.escapeAttr(id)}" aria-pressed="${pressed}" aria-label="${docket.escapeAttr(label)}"><span class="matrix-agree">${pair.agree}</span><span class="matrix-split">${pair.disagree}</span></button></td>`;
      }).join("");
      return `<tr><th scope="row"><button type="button" class="matrix-rowhead" data-thinker="${docket.escapeAttr(rowId)}">${docket.escapeText(byId[rowId].name)}</button></th>${cells}</tr>`;
    }).join("");
    return `<div class="matrix-scroll"><table class="matrix"><caption>Upper number, agreements. Lower number, splits. A blank cell is a pair that does not meet the filter.</caption><thead><tr><th class="matrix-corner" scope="col">Thinker</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function pairListHtml(pairs, byId, selectedId) {
    if (!pairs || !pairs.length) return `<p class="hint">No pair matches.</p>`;
    return `<ul class="pair-list">${pairs.map((pair) => {
      const names = orderedNames(pair, byId);
      const meta = `${plural(pair.together, "shared sitting", "shared sittings")} · ${plural(pair.agree, "agreement", "agreements")} · ${plural(pair.disagree, "split", "splits")}`;
      const pressed = pair.id === selectedId ? "true" : "false";
      return `<li><button type="button" class="pair-pick" data-pair="${docket.escapeAttr(pair.id)}" aria-pressed="${pressed}"><span class="name">${docket.escapeText(`${names[0]} and ${names[1]}`)}</span><span class="meta">${docket.escapeText(meta)}</span></button></li>`;
    }).join("")}</ul>`;
  }

  function drillHtml(pair, byId) {
    if (!pair || !byId[pair.a] || !byId[pair.b]) {
      return `<p class="err thinker-alert" role="alert">Those two are not both on the record.</p>`;
    }
    const names = orderedNames(pair, byId);
    const ids = orderedIds(pair, byId);
    const meta = `${plural(pair.together, "shared sitting", "shared sittings")} · ${plural(pair.agree, "agreement", "agreements")} · ${plural(pair.disagree, "split", "splits")}`;
    const items = (pair.sittings || []).map((sitting) => {
      const flags = [];
      if (sitting.agreed) flags.push("Agreement recorded");
      if (sitting.split) flags.push("Split");
      if (!sitting.agreed) flags.push("Seated together");
      const kicker = [sitting.label, sitting.section, flags.join(" · ")].filter(Boolean).join(" · ");
      const agreed = sitting.agreedText ? `<p><strong>Agreed.</strong> ${docket.escapeText(sitting.agreedText)}</p>` : "";
      const split = sitting.splitText ? `<p><strong>Split.</strong> ${docket.escapeText(sitting.splitText)}</p>` : "";
      return `<li><a class="tap-target" href="${docket.escapeAttr(sitting.href)}"><span class="kicker">${docket.escapeText(kicker)}</span><strong>${docket.escapeText(sitting.headline || sitting.id || "Sitting")}</strong></a>${agreed}${split}</li>`;
    }).join("");
    const left = `thinkers.html?thinker=${encodeURIComponent(ids[0])}`;
    const right = `thinkers.html?thinker=${encodeURIComponent(ids[1])}`;
    return `<section class="pair-drill" aria-labelledby="pair-title"><h3 id="pair-title" tabindex="-1">${docket.escapeText(names[0])} and ${docket.escapeText(names[1])}</h3><p class="meta">${docket.escapeText(meta)}</p><p class="hint"><a class="thinker-jump tap-target" href="${docket.escapeAttr(left)}">${docket.escapeText(names[0])}</a> · <a class="thinker-jump tap-target" href="${docket.escapeAttr(right)}">${docket.escapeText(names[1])}</a></p><ul class="chair-sittings">${items}</ul></section>`;
  }

  return {
    eraFromYears,
    seatId,
    plural,
    pairId,
    assemble,
    traditionOptions,
    eraOptions,
    filterThinkers,
    sortThinkers,
    filterPairs,
    sortPairs,
    axisOrder,
    gridAxes,
    listHtml,
    dossierHtml,
    matrixHtml,
    pairListHtml,
    drillHtml,
    pairSummary,
    tone,
    initials
  };
});
