const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");
const score = require("../score.js");

const root = path.join(__dirname, "..");
const tables = JSON.parse(fs.readFileSync(path.join(root, "data/tables.json"), "utf8"));

function nightsFrom(file) {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return data.nights || [];
}

const seen = new Set();
const nights = [];
nightsFrom(path.join(root, "docket/index.json")).concat(nightsFrom(path.join(root, "docket/archive.json"))).forEach((night) => {
  if (!night || !night.date || !night.file || seen.has(night.date)) return;
  const file = path.join(root, "docket", night.file);
  if (!fs.existsSync(file)) return;
  seen.add(night.date);
  nights.push(night);
});
const discussions = [];
nights.forEach((night) => {
  const data = JSON.parse(fs.readFileSync(path.join(root, "docket", night.file), "utf8"));
  discussions.push(...docket.discussionsFromNight(night.date, data));
});
const payload = {
  discussions: docket.agreementTallies(discussions, (text) => score.subjectTopics(text, tables.relevance))
};
const out = path.join(root, "docket/agreements.json");
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(`wrote ${payload.discussions.length} agreement tallies`);
