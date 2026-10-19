const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { scoreThinker, chooseRandom } = require("../score.js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tables.json"), "utf8"));
const thinkers = catalog.thinkers.map((id) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data/thinkers", id + ".json"), "utf8")));
const rel = catalog.relevance;
const byId = Object.fromEntries(thinkers.map((t) => [t.id, t]));

const compass = "The importance of a shared moral compass in a society";
const ranked = thinkers
  .map((t) => ({ id: t.id, ...scoreThinker(t, compass, rel) }))
  .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

ranked.forEach((r) => console.log(r.tier, r.score, r.hits, r.speaks ? "speaks" : "sits out", r.id));

["lewis", "aristotle", "aquinas", "burke", "smith", "augustine"].forEach((id) => {
  assert.ok(scoreThinker(byId[id], compass, rel).speaks, id + " should speak on a moral compass");
});

const schooling = "Should the state direct what schools may teach?";
const smithSchool = scoreThinker(byId.smith, schooling, rel);
assert.ok(smithSchool.speaks, "Smith should speak on schooling");
assert.ok(smithSchool.matches.some((m) => /education of the common people|parish schools/i.test(m.entry.claim)), "the schooling card should be the Wealth of Nations passage");
assert.ok(byId.locke.entries.some((e) => e.verbatim && e.work === "A Letter Concerning Toleration" && /care of souls/.test(e.claim)));
assert.ok(byId.spencer.entries.some((e) => e.verbatim && e.work === "The Man versus the State" && /divine right of parliaments/.test(e.claim)));
for (const id of [].concat(...["traditionalist", "classical", "modern"].map((tableId) => catalog.tables.find((t) => t.id === tableId).thinkers))) {
  assert.ok(byId[id].entries.length >= 8, id + " should have at least eight cards");
}
assert.strictEqual(scoreThinker(byId.lewis, compass, rel).tier, "high");
assert.ok(ranked.filter((r) => r.tier === "high").length < ranked.length);
assert.strictEqual(scoreThinker(byId.locke, compass, rel).tier, "mid");
assert.ok(scoreThinker(byId.aquinas, compass, rel).score > 0);

const mars = thinkers.map((t) => scoreThinker(t, "Should we colonize Mars?", rel));
assert.ok(mars.every((s) => !s.speaks), "Mars should not produce speeches");
assert.ok(mars.every((s) => s.tier === "low"));

const chesterton = scoreThinker(byId.chesterton, compass, rel);
assert.ok(!chesterton.matches.some((m) => /importance of orthodoxy/i.test(m.entry.loc) && m.lexical.includes("importance")));

const anonymous = scoreThinker(byId.chesterton, "Should anonymous speech be outlawed? A bill would verify every user on the ground that unnamed speech is a danger.", rel);
assert.ok(!anonymous.matches.some((m) => /Fear of the Past/.test(m.entry.loc)), "the word ground must not pull the revolution card");

const seq = [0.1, 0.9];
let i = 0;
const rng = () => seq[i++] ?? 0.2;
const twoTables = [
  { id: "a", name: "Alpha", limits: { min: 2, hardMax: 12, recommendedMax: 6, defaultCount: 5 } },
  { id: "b", name: "Beta", limits: { min: 2, hardMax: 12, recommendedMax: 6, defaultCount: 5 } }
];
const fake = [
  { id: "a1", tableId: "a" }, { id: "a2", tableId: "a" }, { id: "a3", tableId: "a" },
  { id: "b1", tableId: "b" }, { id: "b2", tableId: "b" }, { id: "b3", tableId: "b" }
];
const draw = chooseRandom({ tables: twoTables, thinkers: fake, traditionId: "any", size: 3, onlyRelevant: false, relevance: rel, rng });
assert.strictEqual(draw.ok, true);
assert.ok(draw.ids.every((id) => id.startsWith(draw.table.id === "a" ? "a" : "b")));
assert.strictEqual(new Set(draw.ids.map((id) => id[0])).size, 1);

const tooBig = chooseRandom({ tables: catalog.tables, thinkers, traditionId: "letters", size: 13, relevance: rel, rng: () => 0 });
assert.strictEqual(tooBig.ok, false);

const full = chooseRandom({ tables: catalog.tables, thinkers, traditionId: "letters", size: 12, relevance: rel, rng: () => 0.3 });
assert.strictEqual(full.ok, true);
assert.strictEqual(full.ids.length, 12);
assert.strictEqual(new Set(full.ids).size, 12);

const byTable = Object.fromEntries(catalog.tables.map((t) => [t.id, new Set(t.thinkers)]));
assert.deepStrictEqual([...byTable.traditionalist], ["burke", "kirk", "buckley", "oakeshott", "scruton", "tocqueville", "weaver", "chambers", "strauss"]);
assert.deepStrictEqual([...byTable.classical], ["locke", "mises", "hayek", "friedman", "rothbard", "rand", "smith", "spencer", "mill"]);
assert.deepStrictEqual([...byTable.modern], ["dewey", "rawls", "green", "keynes", "berlin", "sen"]);
for (const id of ["traditionalist", "classical", "modern"]) {
  const draw = chooseRandom({ tables: catalog.tables, thinkers, traditionId: id, size: 5, onlyRelevant: false, relevance: rel, rng: () => 0.4 });
  assert.strictEqual(draw.ok, true, id);
  assert.ok(draw.ids.every((thinkerId) => byTable[id].has(thinkerId)), id + " mixed traditions");
  const seated = draw.ids.map((thinkerId) => byId[thinkerId]);
  assert.ok(seated.some((t) => scoreThinker(t, compass, rel).speaks), id + " should have a speaker on a moral compass");
}

["burke", "tocqueville", "locke", "smith", "mill", "spencer", "green", "dewey", "keynes"].forEach((id) => {
  const scored = scoreThinker(byId[id], compass, rel);
  const best = scored.matches.reduce((n, m) => Math.max(n, m.score), 0);
  const verbatimTied = scored.matches.some((m) => m.score === best && m.entry.verbatim);
  if (verbatimTied) assert.strictEqual(!!scored.matches[0].entry.verbatim, true, id + " should speak the public-domain sentence when it matches as well as a summary");
});

for (const id of ["christian", "ancient", "victorian"]) {
  const table = catalog.tables.find((item) => item.id === id);
  assert.ok(table.thinkers.length >= 6 && table.thinkers.length <= 9, id);
  assert.ok(table.preset.every((thinkerId) => table.thinkers.includes(thinkerId)), id);
  table.thinkers.forEach((thinkerId) => {
    assert.ok(byId[thinkerId].tables.includes(id), thinkerId + " is not seated on " + id);
    assert.ok(byId[thinkerId].entries.length >= 4, thinkerId);
  });
  const seated = table.preset.map((thinkerId) => byId[thinkerId]);
  assert.ok(seated.filter((thinker) => scoreThinker(thinker, compass, rel).speaks).length >= 2, id + " preset should hold a conversation");
}
assert.ok(byId.dante.entries.some((entry) => entry.verbatim && /gloomy wood/.test(entry.claim)));
assert.ok(byId.lucretius.entries.some((entry) => entry.verbatim && /Nothing from nothing/.test(entry.claim)));
assert.ok(byId.arnold.entries.some((entry) => entry.verbatim && /study of perfection/.test(entry.claim)));

console.log("score tests passed");
