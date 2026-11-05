const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");
const score = require("../score.js");

const root = path.join(__dirname, "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "docket/index.json"), "utf8"));
const tables = JSON.parse(fs.readFileSync(path.join(root, "data/tables.json"), "utf8"));
const discussions = [];
(index.nights || []).forEach((night) => {
  const file = path.join(root, "docket", night.file);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  discussions.push(...docket.discussionsFromNight(night.date, data));
});
const payload = {
  discussions: docket.agreementTallies(discussions, (text) => score.subjectTopics(text, tables.relevance))
};
const out = path.join(root, "docket/agreements.json");
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(`wrote ${payload.discussions.length} agreement tallies`);
