const assert = require("assert");
const fs = require("fs");
const path = require("path");
const score = require("../score.js");
const panel = require("../panel.js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tables.json"), "utf8"));
const thinkers = catalog.thinkers.map((id) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data/thinkers", id + ".json"), "utf8")));
const byId = Object.fromEntries(thinkers.map((thinker) => [thinker.id, thinker]));
const rel = catalog.relevance;
const compass = "The importance of a shared moral compass in a society";

function roundFor(tableId, text) {
  const ids = catalog.tables.find((table) => table.id === tableId).preset;
  return panel.buildRound({
    thinkers: ids.map((id) => byId[id]),
    text,
    relevance: rel,
    scoreThinker: score.scoreThinker,
    distinctive: score.distinctive,
    opening: "subject"
  });
}

function claimsOf(thinker) {
  return new Set((thinker.entries || []).map((entry) => entry.claim));
}

["traditionalist", "classical", "modern"].forEach((tableId) => {
  const built = roundFor(tableId, compass);
  const first = built.turns[0];
  assert.strictEqual(first.kind, "chair", tableId);
  assert.strictEqual(first.editorial, "Addressing the subject.");
  assert.ok(first.paragraphs.length > 0, tableId);
  const thinker = byId[first.id];
  const claims = claimsOf(thinker);
  first.paragraphs.forEach((line) => {
    const claim = [...claims].find((item) => line.includes(item));
    assert.ok(claim, `${tableId} first turn has a line that is not a card`);
    const entry = thinker.entries.find((item) => item.claim === claim);
    const scored = score.scoreEntry(entry, compass, rel);
    assert.ok(scored.score > 0, `${tableId} opening card misses the subject`);
  });
  assert.ok(!/[“”"]/.test(first.editorial), tableId);

  const replies = built.turns.filter((turn, index) => index > 0 && turn.kind === "chair");
  assert.ok(replies.length > 0, `${tableId} has no reply`);
  replies.forEach((turn) => {
    assert.ok(/^Responding to .+ on .+\.$/.test(turn.editorial), turn.editorial);
    assert.ok(!/[“”"]/.test(turn.editorial), turn.editorial);
    assert.ok(turn.replyTo && turn.replyTo.name, tableId);
    assert.ok(turn.editorial.includes(turn.replyTo.name), turn.editorial);
    const owner = byId[turn.id];
    const claim = [...claimsOf(owner)].find((item) => turn.paragraphs[0].includes(item));
    assert.ok(claim, `${turn.name} reply is not a card`);
    const earlier = built.turns.slice(0, built.turns.indexOf(turn)).flatMap((item) => item.cards || []);
    const card = turn.cards[0];
    const linked = earlier.some((prev) => {
      const topics = card.topics.some((topic) => prev.topics.includes(topic));
      const terms = score.distinctive(`${card.claim} ${card.bears}`).some((word) => score.distinctive(`${prev.claim} ${prev.bears}`).includes(word));
      return topics || terms;
    });
    assert.ok(linked, `${turn.name} does not connect to an earlier card`);
  });
  console.log(tableId, built.turns.map((turn) => `${turn.kind}:${turn.name}:${turn.editorial}`).join(" | "));
});

const narrow = {
  topicWeight: 4,
  lexicalWeight: 2,
  highMin: 28,
  lowMax: 2,
  speakMin: 4,
  lexicon: { moral: ["moral"], economy: ["inflation"] }
};
const ada = {
  id: "ada",
  name: "Ada",
  entries: [{ topics: ["moral"], claim: "A moral custom holds.", bears: "Custom is the point.", press: "for", work: "Ada Book", loc: "1", url: "https://example.com/ada", verbatim: true }]
};
const bea = {
  id: "bea",
  name: "Bea",
  entries: [{ topics: ["economy"], claim: "Prices unsettle contracts.", bears: "The standard of value moves.", press: "against", work: "Bea Book", loc: "2", url: "https://example.com/bea", verbatim: false }]
};
const cio = {
  id: "cio",
  name: "Cio",
  entries: [{ topics: ["moral", "liberty"], claim: "Liberty needs a moral custom before it is safe.", bears: "Freedom follows the habit.", press: "qualifies", work: "Cio Book", loc: "3", url: "https://example.com/cio", verbatim: true }]
};
const drifted = panel.buildRound({
  thinkers: [ada, bea, cio],
  text: "a moral inflation",
  relevance: narrow,
  scoreThinker: score.scoreThinker,
  distinctive: score.distinctive
});
assert.strictEqual(drifted.turns[0].id, "ada");
assert.strictEqual(drifted.turns[1].kind, "abstain");
assert.strictEqual(drifted.turns[1].id, "bea");
assert.strictEqual(drifted.turns[2].kind, "chair");
assert.strictEqual(drifted.turns[2].replyTo.id, "ada");
assert.ok(drifted.turns[2].editorial.startsWith("Responding to Ada on moral"));
assert.ok(drifted.turns[2].cards[0].topics.includes("liberty"), "the reply can carry a related topic");

const mars = panel.buildRound({
  thinkers: catalog.tables.find((table) => table.id === "traditionalist").preset.map((id) => byId[id]),
  text: "Should we colonize Mars?",
  relevance: rel,
  scoreThinker: score.scoreThinker,
  distinctive: score.distinctive,
  opening: "moderator"
});
assert.strictEqual(mars.turns.length, 1);
assert.strictEqual(mars.turns[0].kind, "silence");
assert.strictEqual(mars.turns[0].cites.length, 0);
assert.ok(mars.turns[0].editorial.includes("No chair has written on this"));

const direct = panel.buildRound({
  thinkers: [byId.burke],
  text: "Should we colonize Mars?",
  relevance: rel,
  scoreThinker: score.scoreThinker,
  distinctive: score.distinctive,
  opening: "moderator",
  anchor: { id: "moderator", name: "Moderator", turnIndex: 3 }
});
assert.strictEqual(direct.turns.length, 1);
assert.ok(direct.turns[0].editorial.includes("Edmund Burke"));
assert.strictEqual(direct.turns[0].cites.length, 0);

const asked = panel.buildRound({
  thinkers: [byId.burke],
  text: compass,
  relevance: rel,
  scoreThinker: score.scoreThinker,
  distinctive: score.distinctive,
  opening: "moderator",
  anchor: { id: "moderator", name: "Moderator", turnIndex: 2 }
});
assert.strictEqual(asked.turns[0].editorial, "Answering the moderator.");
assert.deepStrictEqual(asked.turns[0].replyTo, { id: "moderator", name: "Moderator", turnIndex: 2 });

console.log("panel tests passed");
