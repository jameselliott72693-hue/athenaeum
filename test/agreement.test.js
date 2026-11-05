const assert = require("assert");
const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");
const score = require("../score.js");

const root = path.join(__dirname, "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "docket/index.json"), "utf8"));
const tables = JSON.parse(fs.readFileSync(path.join(root, "data/tables.json"), "utf8"));
const topicsOf = (text) => score.subjectTopics(text, tables.relevance);

function loadDiscussions() {
  const discussions = [];
  index.nights.forEach((night) => {
    const data = JSON.parse(fs.readFileSync(path.join(root, "docket", night.file), "utf8"));
    discussions.push(...docket.discussionsFromNight(night.date, data));
  });
  return discussions;
}

const made = [
  { id: "a", question: "Should schools teach one curriculum?", agreed: "A university needs argument.", chairs: ["Mill", "Newman"] },
  { id: "b", question: "Who guards the university?", agreed: "One-sided learning fails.", chairs: ["Mill", "mill", "Aristotle"] },
  { id: "c", question: "Is faith a public matter?", agreed: "Voters may weigh a candidate's faith.", chairs: ["Madison", "Augustine"] },
  { id: "d", question: "A private note.", agreed: "Only one chair spoke.", chairs: ["Locke"] },
  { id: "e", question: "Tools and making.", agreed: "Tools can give results without forming the maker.", chairs: ["Plato", "Aristotle"] },
  { id: "a", question: "duplicate id", agreed: "Should not count twice.", chairs: ["Plato", "Aristotle"] }
];
const tallies = docket.agreementTallies(made, topicsOf);
const byId = Object.fromEntries(tallies.map((row) => [row.id, row]));
assert.ok(!byId.d, "one chair is not an agreement among different thinkers");
assert.strictEqual(tallies.filter((row) => row.id === "a").length, 1);
assert.ok(byId.a.subject);
assert.ok(byId.b.subject);
assert.strictEqual(byId.a.subject, byId.b.subject);
assert.strictEqual(byId.a.count, byId.b.count);
assert.ok(byId.a.count >= 2);
assert.notStrictEqual(byId.c.subject, byId.a.subject);
assert.strictEqual(byId.e.subject, "");
assert.strictEqual(byId.e.count, 1);
assert.strictEqual(docket.agreementLabel(byId.e), "discussion records this agreement. No listed subject ties it to another");
assert.strictEqual(
  docket.agreementLabel({ subject: "knowledge", count: 2 }),
  "discussions where thinkers agreed on knowledge"
);
assert.strictEqual(
  docket.agreementLabel({ subject: "knowledge", count: 1 }),
  "discussion where thinkers agreed on knowledge"
);

const tied = docket.agreementTallies([
  { id: "1", question: "faith and family", agreed: "Both matter here.", chairs: ["Augustine", "Aquinas"] },
  { id: "2", question: "faith and family", agreed: "Both matter again.", chairs: ["Augustine", "Luther"] }
], () => ["religion", "family"]);
assert.strictEqual(tied[0].subject, "family");
assert.strictEqual(tied[0].count, 2);
assert.strictEqual(tied[1].count, 2);

const discussions = loadDiscussions();
const fresh = docket.agreementTallies(discussions, topicsOf);
const saved = JSON.parse(fs.readFileSync(path.join(root, "docket/agreements.json"), "utf8"));
assert.deepStrictEqual(saved.discussions, fresh, "docket/agreements.json is stale; run node scripts/build-agreements.js");
assert.ok(fresh.length >= discussions.length - 5);
assert.ok(!index.nights.some((night) => night.date === "2026-10-27" || night.date === "2026-10-28"));
assert.ok(!fresh.some((row) => row.id.startsWith("2026-10-27/") || row.id.startsWith("2026-10-28/")));

const sample = fresh.find((row) => row.id === "2026-11-02/p1");
assert.ok(sample && sample.subject && sample.count >= 1);
const sampleCount = discussions.filter((item) => {
  if (docket.distinctChairs(item.chairs).length < 2 || !String(item.agreed || "").trim()) return false;
  return topicsOf(`${item.question || ""} ${item.agreed}`).includes(sample.subject);
}).length;
assert.strictEqual(sample.count, sampleCount);
assert.ok(sampleCount >= 2, sample.subject);

const page = fs.readFileSync(path.join(root, "docket-page.js"), "utf8");
assert.ok(page.includes("agree-tally"));
assert.ok(page.includes("agreementLabel"));
assert.ok(page.includes("docket/agreements.json"));

console.log("agreement", fresh.length, "sample", sample.id, sample.subject, sample.count);
console.log("agreement tests passed");
