const assert = require("assert");
const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");

const index = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/index.json"), "utf8"));
assert.ok(Array.isArray(index.nights) && index.nights.length);
const dates = index.nights.map((night) => night.date);
assert.deepStrictEqual(dates, dates.slice().sort().reverse());
function assertPlain(value, label) {
  if (value == null) return;
  assert.strictEqual(typeof value, "string", label);
  assert.ok(!/<[a-z!/]/i.test(value), label);
}

index.nights.forEach((night, i) => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(night.date));
  if (i) assert.ok(night.date < index.nights[i - 1].date);
  assert.ok(night.file || night.report, night.date);
  let sittingIds = null;
  if (night.file) {
  const file = path.join(__dirname, "../docket", night.file);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.strictEqual(data.date, night.date);
  assert.strictEqual(data.schema_version, "1.0");
  assert.strictEqual(data.integrity.reconstructions, true);
  sittingIds = new Set(data.sittings.map((sitting) => sitting.id));
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
      if (chair.portrait == null) assert.strictEqual(docket.portraitPath(chair.portrait), "", sitting.id);
      else {
        const mapped = docket.portraitPath(chair.portrait);
        assert.ok(mapped.indexOf("images/") === 0, chair.portrait);
        assert.ok(!mapped.includes("assets/"), chair.portrait);
        assert.ok(fs.existsSync(path.join(__dirname, "..", mapped)), mapped);
      }
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
  }
  if (night.report) {
    const report = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket", night.report), "utf8"));
    assert.strictEqual(report.date, night.date);
    assert.strictEqual(report.schema_version, "1.0");
    assert.ok(report.title && report.date_long);
    assert.ok(Array.isArray(report.sections) && report.sections.length);
    const linked = new Set();
    report.sections.forEach((section) => {
      assert.ok(section.name);
      assertPlain(section.name, section.name);
      section.stories.forEach((story) => {
        assert.ok(/^[a-z]+-\d+$/.test(story.id), story.id);
        ["headline", "summary", "side_a", "side_b", "question_underneath"].forEach((key) => {
          assert.ok(story[key], story.id + " " + key);
          assertPlain(story[key], story.id + " " + key);
        });
        assertPlain(story.thinkers_note, story.id);
        assertPlain(story.side_a_label, story.id);
        assertPlain(story.side_b_label, story.id);
        if (story.sitting_id != null) linked.add(story.sitting_id);
        if (sittingIds) {
          if (story.sitting_id != null) assert.ok(sittingIds.has(story.sitting_id), story.sitting_id);
        } else {
          assert.strictEqual(story.sitting_id, null, story.id);
        }
        (story.sources || []).forEach((source) => {
          assert.ok(source.name);
          assert.strictEqual(docket.httpUrl(source.url), source.url, source.url);
        });
        (report.note_links || []).forEach((link) => assert.strictEqual(docket.httpUrl(link.url), link.url));
      });
    });
    if (sittingIds) sittingIds.forEach((id) => assert.ok(linked.has(id), id));
    const html = docket.reportHtml(report, sittingIds ? [...sittingIds] : []);
    assert.ok(html.includes('id="news-report"'), night.date);
    assert.ok(!/<script/i.test(html), night.date);
    if (sittingIds) assert.ok(html.includes('href="#sitting-p1"'));
    else assert.ok(!html.includes("The sitting"));
  }
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

assert.strictEqual(index.nights[0].date, "2026-10-29");
assert.strictEqual(index.nights[0].file, "2026-10-29.json");
assert.strictEqual(index.nights[0].report, "2026-10-29-report.json");
assert.strictEqual(index.nights[1].file, "2026-10-26.json");
assert.strictEqual(index.nights[2].file, "2026-10-25.json");
assert.strictEqual(index.nights[3].file, "2026-10-24.json");
assert.strictEqual(index.nights[4].file, "2026-10-23.json");
assert.strictEqual(index.nights[5].file, "2026-10-22.json");
const thursday = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-29.json"), "utf8"));
assert.strictEqual(thursday.sittings.length, 12);
assert.strictEqual(thursday.integrity.quotes_verified, 94);
const thursdaySections = thursday.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(thursdaySections, { Political: 3, Cultural: 4, Religious: 5 });
const monday = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-26.json"), "utf8"));
assert.strictEqual(monday.sittings.length, 10);
assert.strictEqual(monday.integrity.quotes_verified, 77);
const mondaySections = monday.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(mondaySections, { Political: 3, Cultural: 3, Religious: 4 });
const sunday = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-25.json"), "utf8"));
assert.strictEqual(sunday.sittings.length, 11);
assert.ok(!sunday.sittings.some((sitting) => sitting.id === "r4"));
assert.strictEqual(docket.nightFromLocation({ search: "", hash: "" }, index.nights), "2026-10-29");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-22", hash: "" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-23", hash: "" }, index.nights), "2026-10-23");
assert.strictEqual(docket.nightFromLocation({ search: "", hash: "#night=2026-10-22" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-24", hash: "" }, index.nights), "2026-10-24");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-25", hash: "" }, index.nights), "2026-10-25");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-26", hash: "" }, index.nights), "2026-10-26");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-29", hash: "" }, index.nights), "2026-10-29");
assert.strictEqual(docket.nightFromLocation({ search: "?night=1999-01-01", hash: "" }, index.nights), "");
assert.strictEqual(docket.nightFromLocation({ search: "?night=garbage", hash: "" }, index.nights), "");
assert.strictEqual(docket.nightQuery({ search: "?night=1999-01-01", hash: "" }), "1999-01-01");
assert.strictEqual(docket.nightQuery({ search: "?night=garbage", hash: "#night=2026-10-22" }), "garbage");
assert.strictEqual(docket.nightQuery({ search: "", hash: "#night=2026-10-22" }), "2026-10-22");
assert.strictEqual(docket.nightQuery({ search: "", hash: "#sitting-p1" }), "");
assert.strictEqual(docket.nightQuery({ search: "", hash: "" }), "");
assert.strictEqual(docket.portraitPath("assets/madison.svg"), "images/madison.svg");
assert.strictEqual(docket.portraitPath("images/locke.svg"), "images/locke.svg");
assert.strictEqual(docket.portraitPath("assets/../madison.svg"), "");
assert.strictEqual(docket.portraitPath("https://example.com/a.svg"), "");
assert.strictEqual(docket.portraitPath(null), "");
assert.strictEqual(docket.portraitPath(""), "");
assert.strictEqual(docket.nightUrl("2026-10-22"), "docket.html?night=2026-10-22");
assert.strictEqual(docket.placeUrl("2026-10-23", "#sitting-p1"), "docket.html?night=2026-10-23#sitting-p1");
assert.strictEqual(docket.placeUrl("2026-10-23", "#story-political-1"), "docket.html?night=2026-10-23#story-political-1");
assert.strictEqual(docket.placeUrl("2026-10-23", "#night=2026-10-22"), "docket.html?night=2026-10-23");
assert.strictEqual(docket.placeUrl("2026-10-23", ""), "docket.html?night=2026-10-23");
assert.strictEqual(docket.sideLabel(null, "One side"), "One side");
assert.strictEqual(docket.sideLabel("  ", "The other side"), "The other side");
assert.strictEqual(docket.sideLabel("Hawks", "One side"), "Hawks");
assert.strictEqual(docket.httpUrl("javascript:alert(1)"), "");
assert.strictEqual(docket.httpUrl("https://example.com/a?b=1&c=2"), "https://example.com/a?b=1&c=2");
assert.deepStrictEqual(
  docket.noteParts("Also noted (Al Jazeera); done.", [{ name: "Al Jazeera", url: "https://www.aljazeera.com/news/x" }]),
  [
    { text: "Also noted (" },
    { text: "Al Jazeera", url: "https://www.aljazeera.com/news/x" },
    { text: "); done." }
  ]
);
const poisonedStory = docket.reportStoryHtml({
  id: "political-1",
  number: 1,
  headline: "<script>alert(1)</script>",
  summary: "A summary",
  sources: [{ name: "Bad <b>", url: "javascript:alert(1)" }, { name: "NYT", url: "https://example.com/a?b=1&c=2" }],
  side_a: "Left",
  side_a_label: null,
  side_b: "Right",
  side_b_label: null,
  question_underneath: "A question",
  thinkers_note: "<img src=x>",
  sitting_id: null
}, "Political", false);
assert.ok(!/<script/i.test(poisonedStory));
assert.ok(!/javascript:/i.test(poisonedStory));
assert.ok(poisonedStory.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
assert.ok(poisonedStory.includes("&lt;img src=x&gt;"));
assert.ok(poisonedStory.includes("One side"));
assert.ok(poisonedStory.includes("The other side"));
assert.ok(poisonedStory.includes('href="https://example.com/a?b=1&amp;c=2"'));
assert.ok(poisonedStory.includes('target="_blank"'));
assert.ok(poisonedStory.includes('rel="noopener"'));
assert.ok(!poisonedStory.includes("The sitting"));
const october = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-22-report.json"), "utf8"));
assert.strictEqual(docket.storyIdForSitting(october, "p1"), "political-1");
assert.strictEqual(docket.storyIdForSitting(october, "missing"), "");

const thinkers = new Set(fs.readdirSync(path.join(__dirname, "../data/thinkers")).map((name) => name.replace(/\.json$/, "")));
index.nights.filter((entry) => entry.file).forEach((entry) => {
  const night = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket", entry.file), "utf8"));
  night.sittings.forEach((sitting) => {
    sitting.chairs.forEach((chair) => {
      if (chair.roster_id) assert.ok(thinkers.has(chair.roster_id), chair.name + " " + chair.roster_id);
    });
  });
});

assert.strictEqual(docket.READ_STORAGE_KEY, "athenaeum:docket:read");
assert.deepStrictEqual(docket.parseReadState("not json"), {});
assert.deepStrictEqual(docket.parseReadState("[]"), {});
assert.deepStrictEqual(docket.parseReadState(JSON.stringify({
  "2026-10-24": true,
  "2026-10-23": "2026-10-25T00:00:00.000Z",
  "2026-10-22": false,
  "nope": true
})), {
  "2026-10-24": true,
  "2026-10-23": "2026-10-25T00:00:00.000Z"
});
const nights = [
  { date: "2026-10-24", label: "Saturday, October 24, 2026" },
  { date: "2026-10-23", label: "Friday, October 23, 2026" }
];
assert.strictEqual(docket.isNightRead({ "2026-10-24": true }, "2026-10-24"), true);
assert.strictEqual(docket.isNightRead({}, "2026-10-24"), false);
assert.strictEqual(docket.unreadCount(nights, { "2026-10-24": true }), 1);
assert.strictEqual(docket.unreadHint(nights, {}), "2 nights unread");
assert.strictEqual(docket.unreadHint(nights, { "2026-10-24": true }), "1 night unread");
assert.strictEqual(docket.unreadHint(nights, { "2026-10-24": true, "2026-10-23": true }), "All nights read");
assert.strictEqual(docket.nightMenuLabel(nights[0], {}), "● Unread, Saturday, October 24, 2026");
assert.strictEqual(docket.nightMenuLabel(nights[1], { "2026-10-23": true }), "✓ Read, Friday, October 23, 2026");
const marked = docket.withNightRead({ "2026-10-22": true }, "2026-10-24", true, "2026-10-25T12:00:00.000Z");
assert.strictEqual(marked["2026-10-24"], "2026-10-25T12:00:00.000Z");
assert.strictEqual(docket.withNightRead(marked, "2026-10-24", false)["2026-10-24"], undefined);
const memory = { store: {}, getItem(key) { return this.store[key] || null; }, setItem(key, value) { this.store[key] = value; } };
assert.strictEqual(docket.saveReadMap(memory, marked), true);
assert.deepStrictEqual(docket.loadReadMap(memory), marked);
assert.deepStrictEqual(docket.loadReadMap({ getItem() { throw new Error("blocked"); } }), {});
assert.strictEqual(docket.saveReadMap({ setItem() { throw new Error("blocked"); } }, marked), false);
assert.deepStrictEqual(docket.loadReadMap(null), {});

console.log("docket tests passed", index.nights.map((entry) => entry.date).join(", "));
