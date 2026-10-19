(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function passageLine(entry) {
    if (entry.fromText) {
      const work = String(entry.work || "");
      const loc = String(entry.loc || "");
      const place = work && loc.indexOf(work) === 0 ? loc : `${work}, ${loc}`;
      return `From the full text of ${place}: “${entry.claim}”`;
    }
    if (entry.verbatim) return `From ${entry.work}, ${entry.loc}: “${entry.claim}”`;
    return `Summary of ${entry.work}, ${entry.loc}, not a quotation: ${entry.claim}`;
  }

  function citeOf(entry) {
    const cite = {
      work: entry.work,
      loc: entry.loc,
      url: entry.url,
      bears: entry.bears,
      verbatim: !!entry.verbatim
    };
    if (entry.fromText) cite.fromText = true;
    if (entry.passageId) cite.passageId = entry.passageId;
    return cite;
  }

  function cardSnap(entry) {
    const snap = {
      topics: (entry.topics || []).slice(),
      claim: entry.claim || "",
      bears: entry.bears || "",
      work: entry.work || "",
      loc: entry.loc || ""
    };
    if (entry.fromText) snap.fromText = true;
    if (entry.passageId) snap.passageId = entry.passageId;
    return snap;
  }

  function blob(entry) {
    return `${entry.claim || ""} ${entry.bears || ""}`;
  }

  function overlap(entry, raised, distinctive) {
    const topics = (entry.topics || []).filter((topic) => raised.topics.has(topic));
    const terms = distinctive(blob(entry)).filter((word) => raised.terms.has(word));
    return { topics, terms, score: topics.length * 4 + terms.length * 2 };
  }

  function addRaised(raised, entry, speaker, distinctive) {
    let row = raised.speakers.find((item) => item.id === speaker.id);
    if (!row) {
      row = { id: speaker.id, name: speaker.name, topics: new Set(), terms: new Set() };
      raised.speakers.push(row);
    }
    (entry.topics || []).forEach((topic) => {
      raised.topics.add(topic);
      row.topics.add(topic);
    });
    distinctive(blob(entry)).forEach((word) => {
      raised.terms.add(word);
      row.terms.add(word);
    });
  }

  function addressedTo(raised, entry, distinctive) {
    let best = null;
    raised.speakers.forEach((speaker) => {
      const topics = (entry.topics || []).filter((topic) => speaker.topics.has(topic));
      const terms = distinctive(blob(entry)).filter((word) => speaker.terms.has(word));
      const score = topics.length * 4 + terms.length * 2;
      if (!best || score >= best.score) best = { speaker, topics, terms, score };
    });
    return best && best.score > 0 ? best : null;
  }

  function groundOf(hit) {
    if (hit.topics.length) return hit.topics.slice(0, 3).join(" and ");
    return hit.terms.slice(0, 2).join(" and ");
  }

  function silenceTurn(thinkers) {
    const editorial = thinkers.length === 1
      ? `${thinkers[0].name} has not written on this, on the shelf we have.`
      : "No chair has written on this, on the shelf we have.";
    return {
      kind: "silence",
      id: "",
      name: "The table",
      lean: "",
      editorial,
      paragraphs: [],
      cites: [],
      replyTo: null,
      cards: []
    };
  }

  function poolOf(thinker, subjectMatches) {
    const list = (thinker.entries || []).slice();
    (subjectMatches || []).forEach((match) => {
      if (match.entry && match.entry.fromText) list.push(match.entry);
    });
    return list;
  }

  function pickConnecting(thinker, raised, subjectMatches, distinctive, used) {
    let best = null;
    poolOf(thinker, subjectMatches).forEach((entry) => {
      if (entry.passageId && used && used.has(entry.passageId)) return;
      const hit = overlap(entry, raised, distinctive);
      if (hit.score <= 0) return;
      const known = (subjectMatches || []).find((match) => match.entry === entry);
      const candidate = {
        entry,
        hit,
        onSubject: known ? known.score : 0,
        verbatim: entry.verbatim ? 1 : 0,
        fromText: entry.fromText ? 1 : 0
      };
      if (!best
        || candidate.hit.score > best.hit.score
        || (candidate.hit.score === best.hit.score && candidate.onSubject > best.onSubject)
        || (candidate.hit.score === best.hit.score && candidate.onSubject === best.onSubject && candidate.fromText < best.fromText)
        || (candidate.hit.score === best.hit.score && candidate.onSubject === best.onSubject && candidate.fromText === best.fromText && candidate.verbatim > best.verbatim)) {
        best = candidate;
      }
    });
    return best;
  }

  function takeMatches(matches, used, count) {
    const chosen = [];
    (matches || []).forEach((match) => {
      if (chosen.length >= count) return;
      const entry = match.entry;
      if (!entry) return;
      if (entry.passageId && used && used.has(entry.passageId)) return;
      if (chosen.some((item) => item === entry || (item.passageId && item.passageId === entry.passageId))) return;
      chosen.push(entry);
    });
    return chosen;
  }

  function buildRound(opts) {
    const thinkers = opts.thinkers || [];
    const text = opts.text || "";
    const relevance = opts.relevance;
    const scoreThinker = opts.scoreThinker;
    const distinctive = opts.distinctive;
    const opening = opts.opening === "moderator" ? "moderator" : "subject";
    const anchor = opts.anchor || null;
    const used = opts.usedPassageIds instanceof Set ? opts.usedPassageIds : new Set(opts.usedPassageIds || []);
    const scored = thinkers.map((thinker) => ({ thinker, score: scoreThinker(thinker, text, relevance) }));
    const speakers = scored
      .filter((row) => row.score.speaks)
      .sort((a, b) => b.score.score - a.score.score || a.thinker.name.localeCompare(b.thinker.name));
    const quiet = scored.filter((row) => !row.score.speaks);
    if (!speakers.length) return { turns: [silenceTurn(thinkers)] };

    const turns = [];
    const raised = { topics: new Set(), terms: new Set(), speakers: [] };
    speakers.forEach((row, index) => {
      if (index === 0) {
        const entries = takeMatches(row.score.matches, used, 2);
        if (!entries.length) {
          const editorial = `${row.thinker.name} sits out this turn. Nothing on this shelf meets what has already been raised.`;
          turns.push({
            kind: "abstain",
            id: row.thinker.id,
            name: row.thinker.name,
            lean: "abstain",
            editorial,
            paragraphs: [],
            cites: [],
            replyTo: null,
            cards: [],
            reason: editorial
          });
          return;
        }
        entries.forEach((entry) => {
          addRaised(raised, entry, row.thinker, distinctive);
          if (entry.passageId) used.add(entry.passageId);
        });
        turns.push({
          kind: "chair",
          id: row.thinker.id,
          name: row.thinker.name,
          lean: entries[0].press || "qualifies",
          editorial: opening === "moderator" ? "Answering the moderator." : "Addressing the subject.",
          paragraphs: entries.map(passageLine),
          cites: entries.map(citeOf),
          replyTo: opening === "moderator" && anchor ? { id: anchor.id, name: anchor.name, turnIndex: anchor.turnIndex } : null,
          cards: entries.map(cardSnap),
          hits: row.score.hits
        });
        return;
      }
      const chosen = pickConnecting(row.thinker, raised, row.score.matches, distinctive, used);
      if (!chosen) {
        const editorial = `${row.thinker.name} sits out this turn. Nothing on this shelf meets what has already been raised.`;
        turns.push({
          kind: "abstain",
          id: row.thinker.id,
          name: row.thinker.name,
          lean: "abstain",
          editorial,
          paragraphs: [],
          cites: [],
          replyTo: null,
          cards: [],
          reason: editorial
        });
        return;
      }
      const addressed = addressedTo(raised, chosen.entry, distinctive);
      const who = addressed ? addressed.speaker : raised.speakers[raised.speakers.length - 1];
      const prior = [...turns].reverse().find((turn) => turn.kind === "chair" && turn.id === who.id);
      addRaised(raised, chosen.entry, row.thinker, distinctive);
      if (chosen.entry.passageId) used.add(chosen.entry.passageId);
      turns.push({
        kind: "chair",
        id: row.thinker.id,
        name: row.thinker.name,
        lean: chosen.entry.press || "qualifies",
        editorial: `Responding to ${who.name} on ${groundOf(chosen.hit)}.`,
        paragraphs: [passageLine(chosen.entry)],
        cites: [citeOf(chosen.entry)],
        replyTo: { id: who.id, name: who.name, turnIndex: prior ? turns.indexOf(prior) : null },
        cards: [cardSnap(chosen.entry)],
        hits: row.score.hits
      });
    });
    quiet.forEach((row) => {
      const editorial = `${row.thinker.name} has not written on this, on the shelf we have, and sits out.`;
      turns.push({
        kind: "abstain",
        id: row.thinker.id,
        name: row.thinker.name,
        lean: "abstain",
        editorial,
        paragraphs: [],
        cites: [],
        replyTo: null,
        cards: [],
        reason: editorial
      });
    });
    return { turns };
  }

  return { buildRound, passageLine };
});
