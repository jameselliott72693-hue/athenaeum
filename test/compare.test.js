const assert = require("assert");
const fs = require("fs");
const path = require("path");
const score = require("../score.js");
const panel = require("../panel.js");
const books = require("../books.js");
const compare = require("../compare.js");

const root = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/tables.json"), "utf8"));
const thinkers = catalog.thinkers.map((id) => JSON.parse(fs.readFileSync(path.join(root, "data/thinkers", id + ".json"), "utf8")));
const byId = Object.fromEntries(thinkers.map((thinker) => [thinker.id, thinker]));
const rel = catalog.relevance;
const compass = "The importance of a shared moral compass in a society";

function load(id) {
  const pack = books.readThinker(root, id);
  if (pack) books.install(id, pack.index, pack.texts);
}

function judge(thinker, text, relevance) {
  const card = score.scoreThinker(thinker, text, relevance);
  if (!books.library.indexes[thinker.id]) return card;
  return books.mergeScore(card, books.rankedEntries(thinker.id, text, relevance, 8), relevance);
}

function roundFor(tableId) {
  const ids = catalog.tables.find((table) => table.id === tableId).preset;
  ids.forEach(load);
  return panel.buildRound({
    thinkers: ids.map((id) => byId[id]),
    text: compass,
    relevance: rel,
    scoreThinker: judge,
    distinctive: score.distinctive,
    opening: "subject"
  });
}

function topicsIn(lines) {
  const found = new Set();
  lines.forEach((line) => (line.topics || []).forEach((topic) => found.add(topic)));
  return found;
}

const christian = roundFor("christian");
const traditionalist = roundFor("traditionalist");
const view = compare.cited(christian, traditionalist);
const again = compare.cited(roundFor("christian"), roundFor("traditionalist"));
assert.deepStrictEqual(view, again);

const leftTopics = topicsIn(view.left);
const rightTopics = topicsIn(view.right);
view.both.forEach((topic) => {
  assert.ok(leftTopics.has(topic) && rightTopics.has(topic), topic);
});
view.onlyLeft.forEach((topic) => {
  assert.ok(leftTopics.has(topic) && !rightTopics.has(topic), topic);
});
view.onlyRight.forEach((topic) => {
  assert.ok(rightTopics.has(topic) && !leftTopics.has(topic), topic);
});
assert.ok(view.left.length && view.right.length);
view.left.concat(view.right).forEach((line) => {
  assert.ok(line.paragraph && line.speaker && line.work, line.speaker);
  assert.ok(!/they agree|they differ|on balance/i.test(line.paragraph));
});
assert.ok(view.left.some((line) => /From the full text of /.test(line.paragraph)));
assert.ok(view.both.includes("moral") || view.both.includes("society") || view.onlyLeft.includes("moral") || view.onlyRight.includes("moral"));
console.log("both", view.both.join(", "));
console.log("only christian", view.onlyLeft.join(", ") || "(none)");
console.log("only traditionalist", view.onlyRight.join(", ") || "(none)");
console.log("compare tests passed");
