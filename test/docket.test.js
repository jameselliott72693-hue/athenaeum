const assert = require("assert");
const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");

const index = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/index.json"), "utf8"));
assert.ok(Array.isArray(index.nights) && index.nights.length);
const dates = index.nights.map((night) => night.date);
assert.deepStrictEqual(dates, dates.slice().sort().reverse());
index.nights.forEach((night, i) => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(night.date));
  if (i) assert.ok(night.date < index.nights[i - 1].date);
  const file = path.join(__dirname, "../docket", night.file);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.strictEqual(data.date, night.date);
  assert.strictEqual(data.schema_version, "1.0");
  assert.strictEqual(data.integrity.reconstructions, true);
  data.sittings.forEach((sitting) => {
    const verified = new Set(sitting.quotes.filter((quote) => quote.verified === true).map((quote) => quote.text));
    const paragraphs = [sitting.setup, sitting.moderator.opening, sitting.moderator.closing]
      .concat(sitting.chairs.flatMap((chair) => chair.turn));
    paragraphs.forEach((paragraph) => {
      const safe = docket.sanitizeParagraph(paragraph.html, sitting.quotes);
      assert.ok(!/<script/i.test(safe), sitting.id);
      const found = [...safe.matchAll(/<q class="vq">([\s\S]*?)<\/q>/g)].map((match) => docket.decodeEntities(match[1]));
      found.forEach((text) => assert.ok(verified.has(text), `${sitting.id} marked a quote that is not verified`));
    });
    sitting.chairs.forEach((chair) => {
      const quotes = chair.paraphrase_only ? [] : chair.quotes;
      chair.turn.forEach((paragraph) => {
        const safe = docket.sanitizeParagraph(paragraph.html, quotes);
        if (chair.paraphrase_only) assert.ok(!/<q /.test(safe), chair.name);
      });
      const modern = docket.plainModern(chair.modern_read);
      assert.ok(modern.length > 0, chair.name);
      assert.ok(!/[“”"]/.test(modern), chair.name);
    });
  });
});

const poisoned = docket.sanitizeParagraph(
  'Before <q class="vq">Not a real quote</q> <script>alert(1)</script> <span class="cite">(nowhere)</span>',
  [{ text: "A real sentence.", verified: true }]
);
assert.ok(!/<q /.test(poisoned));
assert.ok(!/<script/i.test(poisoned));
assert.ok(poisoned.includes("Not a real quote"));
assert.ok(poisoned.includes('<span class="cite">(nowhere)</span>'));

const kept = docket.sanitizeParagraph(
  '<q class="vq">A real sentence.</q>',
  [{ text: "A real sentence.", verified: true }]
);
assert.ok(kept.includes('<q class="vq">A real sentence.</q>'));

assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-22", hash: "" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "", hash: "#night=2026-10-22" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "?night=1999-01-01", hash: "" }, index.nights), index.nights[0].date);
assert.strictEqual(docket.nightUrl("2026-10-22"), "docket.html?night=2026-10-22");

const night = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-22.json"), "utf8"));
const thinkers = new Set(fs.readdirSync(path.join(__dirname, "../data/thinkers")).map((name) => name.replace(/\.json$/, "")));
night.sittings.forEach((sitting) => {
  sitting.chairs.forEach((chair) => {
    if (chair.roster_id) assert.ok(thinkers.has(chair.roster_id), chair.name + " " + chair.roster_id);
  });
});

console.log("docket tests passed", night.date, night.sittings.length);
