const assert = require("assert");
const fs = require("fs");
const path = require("path");
const score = require("../score.js");
const lines = require("../lines.js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tables.json"), "utf8"));
const influence = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/influence.json"), "utf8"));
const thinkers = catalog.thinkers.map((id) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data/thinkers", id + ".json"), "utf8")));
const byId = Object.fromEntries(thinkers.map((thinker) => [thinker.id, thinker]));
const rel = catalog.relevance;
const open = catalog.tables.find((table) => table.id === "mixed");

assert.ok(open && open.open);
assert.deepStrictEqual(open.limits, { min: 2, hardMax: 12, recommendedMax: 6, defaultCount: 5 });
assert.deepStrictEqual(open.preset, []);
assert.deepStrictEqual(open.thinkers, []);

assert.strictEqual(score.traditionName(byId.plato, catalog.tables), "Ancient Greek and Roman");
assert.strictEqual(score.traditionName(byId.lewis, catalog.tables), "Letters");
assert.strictEqual(score.traditionName(byId.kant, catalog.tables), "Enlightenment");
assert.strictEqual(score.traditionName(byId.burke, catalog.tables), "Traditionalist and conservative");

const ancient = score.chooseRandom({
  tables: catalog.tables,
  thinkers,
  traditionId: "ancient",
  mix: false,
  size: 5,
  onlyRelevant: false,
  relevance: rel,
  rng: () => 0.2
});
assert.strictEqual(ancient.ok, true);
assert.strictEqual(ancient.table.id, "ancient");
assert.ok(ancient.ids.every((id) => catalog.tables.find((table) => table.id === "ancient").thinkers.includes(id)));

const crossed = score.chooseRandom({
  tables: catalog.tables,
  thinkers,
  traditionId: "ancient",
  mix: true,
  size: 8,
  onlyRelevant: false,
  relevance: rel,
  rng: () => 0.3
});
assert.strictEqual(crossed.ok, true);
assert.strictEqual(crossed.table.id, "mixed");
assert.strictEqual(crossed.ids.length, 8);
assert.strictEqual(new Set(crossed.ids).size, 8);
const homes = new Set(crossed.ids.map((id) => score.traditionName(byId[id], catalog.tables)));
assert.ok(homes.size > 1, "a mixed draw should cross traditions");
assert.ok(/crosses traditions/.test(crossed.note));

const tooBig = score.chooseRandom({
  tables: catalog.tables,
  thinkers,
  mix: true,
  size: 13,
  relevance: rel,
  rng: () => 0
});
assert.strictEqual(tooBig.ok, false);

const named = catalog.tables.filter((table) => !table.open);
named.forEach((table) => {
  assert.ok(table.thinkers.length >= 6, table.id);
  assert.ok(!table.open);
});

const among = lines.edgesAmong(influence, ["plato", "aristotle", "kant"]);
assert.ok(among.some((edge) => edge.from === "plato" && edge.to === "aristotle"));
assert.ok(among.every((edge) => ["plato", "aristotle", "kant"].includes(edge.from)));
assert.ok(!among.some((edge) => edge.to === "kant" && edge.from === "plato"));

console.log("mixed tests passed");
