const assert = require("assert");
const fs = require("fs");
const lines = require("../lines.js");
const tables = JSON.parse(fs.readFileSync("data/tables.json", "utf8"));
const influence = JSON.parse(fs.readFileSync("data/influence.json", "utf8"));

assert.strictEqual(lines.startYear("551–479 BC"), -551);
assert.strictEqual(lines.startYear("c. 428–348 BCE"), -428);
assert.strictEqual(lines.startYear("6th century BC"), -550);
assert.strictEqual(lines.startYear("121–180"), 121);
assert.strictEqual(lines.startYear("1933–"), 1933);

const ancient = [
  { id: "marcus", name: "Marcus Aurelius", years: "121–180" },
  { id: "plato", name: "Plato", years: "c. 428–348 BCE" },
  { id: "aristotle", name: "Aristotle", years: "384–322 BCE" }
];
assert.deepStrictEqual(lines.order(ancient).map((person) => person.id), ["plato", "aristotle", "marcus"]);

const seen = new Set();
influence.edges.forEach((edge) => {
  const table = tables.tables.find((item) => item.id === edge.tableId);
  assert.ok(table, edge.tableId);
  assert.ok(table.thinkers.includes(edge.from), edge.from + " not on " + edge.tableId);
  assert.ok(table.thinkers.includes(edge.to), edge.to + " not on " + edge.tableId);
  assert.notStrictEqual(edge.from, edge.to);
  assert.ok(edge.basis && edge.basis.length > 20);
  assert.ok(!/["“”]/.test(edge.basis), edge.basis);
  assert.ok(edge.label);
  const key = edge.tableId + edge.from + edge.to + edge.label;
  assert.ok(!seen.has(key), key);
  seen.add(key);
});

tables.tables.forEach((table) => {
  const edges = lines.edgesFor(influence, table.id);
  assert.ok(edges.length >= 1, table.id + " has no line");
  const points = lines.layout(table.thinkers);
  const ids = new Set(points.map((point) => point.id));
  assert.strictEqual(ids.size, table.thinkers.length);
  const box = lines.frame(points);
  points.forEach((point) => {
    assert.ok(point.x >= 0 && point.x < box.width);
    assert.ok(point.y >= 0 && point.y < box.height);
  });
});

console.log("lines", influence.edges.length);
console.log("influence tests passed");
