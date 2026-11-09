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
          if (source.archived != null) assert.strictEqual(docket.httpUrl(source.archived), source.archived, source.archived);
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

assert.strictEqual(index.nights[0].date, "2026-11-08");
assert.strictEqual(index.nights[0].file, "2026-11-08.json");
assert.strictEqual(index.nights[0].report, "2026-11-08-report.json");
assert.strictEqual(index.nights[1].date, "2026-11-07");
assert.strictEqual(index.nights[1].file, "2026-11-07.json");
assert.strictEqual(index.nights[1].report, "2026-11-07-report.json");
assert.strictEqual(index.nights[2].date, "2026-11-06");
assert.strictEqual(index.nights[2].file, "2026-11-06.json");
assert.strictEqual(index.nights[2].report, "2026-11-06-report.json");
assert.strictEqual(index.nights[3].date, "2026-11-05");
assert.strictEqual(index.nights[3].file, "2026-11-05.json");
assert.strictEqual(index.nights[3].report, "2026-11-05-report.json");
assert.strictEqual(index.nights[4].date, "2026-11-04");
assert.strictEqual(index.nights[4].file, "2026-11-04.json");
assert.strictEqual(index.nights[4].report, "2026-11-04-report.json");
assert.strictEqual(index.nights[5].date, "2026-11-03");
assert.strictEqual(index.nights[5].file, "2026-11-03.json");
assert.strictEqual(index.nights[5].report, "2026-11-03-report.json");
assert.strictEqual(index.nights[6].file, "2026-11-02.json");
assert.strictEqual(index.nights[7].file, "2026-11-01.json");
assert.strictEqual(index.nights[8].file, "2026-10-31.json");
assert.strictEqual(index.nights[9].file, "2026-10-30.json");
assert.strictEqual(index.nights[10].file, "2026-10-29.json");
assert.strictEqual(index.nights[11].file, "2026-10-26.json");
assert.strictEqual(index.nights[12].file, "2026-10-25.json");
assert.strictEqual(index.nights[13].file, "2026-10-24.json");
assert.strictEqual(index.nights[14].file, "2026-10-23.json");
assert.strictEqual(index.nights[15].file, "2026-10-22.json");
const novemberEighth = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-08.json"), "utf8"));
assert.strictEqual(novemberEighth.date, "2026-11-08");
assert.strictEqual(novemberEighth.sittings.length, 9);
assert.strictEqual(novemberEighth.integrity.quotes_verified, 84);
const novemberEighthSections = novemberEighth.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberEighthSections, { Political: 3, Cultural: 3, Religious: 3 });
const novemberSeventh = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-07.json"), "utf8"));
assert.strictEqual(novemberSeventh.date, "2026-11-07");
assert.strictEqual(novemberSeventh.sittings.length, 10);
assert.strictEqual(novemberSeventh.integrity.quotes_verified, 68);
const novemberSeventhSections = novemberSeventh.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberSeventhSections, { Political: 4, Cultural: 3, Religious: 3 });
const novemberSixth = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-06.json"), "utf8"));
assert.strictEqual(novemberSixth.date, "2026-11-06");
assert.strictEqual(novemberSixth.sittings.length, 9);
assert.strictEqual(novemberSixth.integrity.quotes_verified, 50);
const novemberSixthSections = novemberSixth.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberSixthSections, { Political: 3, Cultural: 3, Religious: 3 });
const novemberFifth = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-05.json"), "utf8"));
assert.strictEqual(novemberFifth.date, "2026-11-05");
assert.strictEqual(novemberFifth.sittings.length, 10);
assert.strictEqual(novemberFifth.integrity.quotes_verified, 48);
const novemberFifthSections = novemberFifth.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberFifthSections, { Political: 4, Cultural: 3, Religious: 3 });
const novemberFourth = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-04.json"), "utf8"));
assert.strictEqual(novemberFourth.sittings.length, 10);
assert.strictEqual(novemberFourth.integrity.quotes_verified, 58);
const novemberFourthSections = novemberFourth.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberFourthSections, { Political: 3, Cultural: 3, Religious: 4 });
const novemberThird = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-03.json"), "utf8"));
assert.strictEqual(novemberThird.sittings.length, 9);
assert.strictEqual(novemberThird.integrity.quotes_verified, 94);
const novemberThirdSections = novemberThird.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberThirdSections, { Political: 3, Cultural: 3, Religious: 3 });
const novemberSecond = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-02.json"), "utf8"));
assert.strictEqual(novemberSecond.sittings.length, 11);
assert.strictEqual(novemberSecond.integrity.quotes_verified, 117);
const novemberSecondSections = novemberSecond.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberSecondSections, { Political: 3, Cultural: 4, Religious: 4 });
const november = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-01.json"), "utf8"));
assert.strictEqual(november.sittings.length, 10);
assert.strictEqual(november.integrity.quotes_verified, 99);
const novemberSections = november.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(novemberSections, { Political: 3, Cultural: 3, Religious: 4 });
const saturday = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-31.json"), "utf8"));
assert.strictEqual(saturday.sittings.length, 10);
assert.strictEqual(saturday.integrity.quotes_verified, 92);
const saturdaySections = saturday.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(saturdaySections, { Political: 4, Cultural: 3, Religious: 3 });
const friday = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-10-30.json"), "utf8"));
assert.strictEqual(friday.sittings.length, 11);
assert.strictEqual(friday.integrity.quotes_verified, 114);
const fridaySections = friday.sittings.reduce((counts, sitting) => {
  counts[sitting.section] = (counts[sitting.section] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(fridaySections, { Political: 4, Cultural: 3, Religious: 4 });
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
assert.strictEqual(docket.nightFromLocation({ search: "", hash: "" }, index.nights), "2026-11-08");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-22", hash: "" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-23", hash: "" }, index.nights), "2026-10-23");
assert.strictEqual(docket.nightFromLocation({ search: "", hash: "#night=2026-10-22" }, index.nights), "2026-10-22");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-24", hash: "" }, index.nights), "2026-10-24");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-25", hash: "" }, index.nights), "2026-10-25");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-26", hash: "" }, index.nights), "2026-10-26");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-29", hash: "" }, index.nights), "2026-10-29");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-30", hash: "" }, index.nights), "2026-10-30");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-31", hash: "" }, index.nights), "2026-10-31");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-01", hash: "" }, index.nights), "2026-11-01");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-02", hash: "" }, index.nights), "2026-11-02");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-03", hash: "" }, index.nights), "2026-11-03");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-04", hash: "" }, index.nights), "2026-11-04");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-05", hash: "" }, index.nights), "2026-11-05");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-06", hash: "" }, index.nights), "2026-11-06");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-07", hash: "" }, index.nights), "2026-11-07");
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-11-08", hash: "" }, index.nights), "2026-11-08");
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
assert.ok(poisonedStory.includes('class="tap-target"'));
assert.ok(!poisonedStory.includes(">archived<"));
const archivedStory = docket.reportStoryHtml({
  id: "political-3",
  number: 3,
  headline: "A court order",
  summary: "The order is cited.",
  sources: [
    { name: "Ninth Circuit order", url: "https://cdn.ca9.uscourts.gov/datastore/opinions/2026/10/30/26-7231.pdf", archived: "https://web.archive.org/web/20261031190939id_/https://cdn.ca9.uscourts.gov/datastore/opinions/2026/10/30/26-7231.pdf" },
    { name: "Bad archive", url: "https://example.com/story", archived: "javascript:alert(1)" },
    { name: "No archive", url: "https://example.com/plain" }
  ],
  side_a: "One",
  side_b: "Two",
  question_underneath: "A question"
}, "Political", false);
assert.ok(archivedStory.includes('class="tap-target source-archived"'));
assert.ok(archivedStory.includes("https://web.archive.org/web/20261031190939id_/https://cdn.ca9.uscourts.gov/datastore/opinions/2026/10/30/26-7231.pdf"));
assert.ok(!/javascript:/i.test(archivedStory));
assert.strictEqual(archivedStory.split(">archived<").length - 1, 1);
const novemberReport = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-01-report.json"), "utf8"));
const circuit = novemberReport.sections.flatMap((section) => section.stories).flatMap((story) => story.sources || []).find((source) => source.url === "https://cdn.ca9.uscourts.gov/datastore/opinions/2026/10/30/26-7231.pdf");
assert.ok(circuit, "November 1 Ninth Circuit source");
assert.ok(/^https:\/\/web\.archive\.org\/web\/\d+id_\/https:\/\/cdn\.ca9\.uscourts\.gov\/datastore\/opinions\/2026\/10\/30\/26-7231\.pdf$/.test(circuit.archived), circuit.archived);
assert.strictEqual(docket.httpUrl(circuit.archived), circuit.archived);
assert.ok(poisonedStory.includes('target="_blank"'));
const tapCss = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
assert.ok(/a\.tap-target\s*\{[^}]*min-height:\s*24px/.test(tapCss));
assert.ok(/a\.tap-target\s*\{[^}]*min-width:\s*24px/.test(tapCss));
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

const found = docket.searchNights([
  {
    date: "2026-11-01",
    label: "Sunday, November 1, 2026",
    night: {
      sittings: [{
        id: "p1",
        headline: "A pledge and a conscience",
        question: "Loyalty versus conscience",
        chairs: [{ name: "Thomas Aquinas" }, { name: "Immanuel Kant" }],
        quotes: [
          { text: "every will at variance with reason", work: "Summa Theologica", verified: true },
          { text: "not verified", work: "Secret", verified: false }
        ]
      }]
    },
    report: {
      sections: [{
        stories: [{
          id: "political-1",
          headline: "A Democrat endorses the Republican",
          summary: "A primary pledge broke.",
          sitting_id: "p1"
        }]
      }]
    }
  }
], "aquinas");
assert.strictEqual(found.length, 1);
assert.strictEqual(found[0].kind, "thinker");
assert.strictEqual(found[0].href, "docket.html?night=2026-11-01#sitting-p1");
const quoted = docket.searchNights([{
  date: "2026-11-01",
  label: "Sunday",
  night: { sittings: [{ id: "p1", chairs: [], quotes: [{ text: "every will at variance with reason", work: "Summa", verified: true }] }] }
}], "variance");
assert.strictEqual(quoted[0].kind, "quotation");
assert.strictEqual(quoted[0].sittingId, "p1");
const stories = docket.searchNights([{
  date: "2026-11-01",
  label: "Sunday",
  report: { sections: [{ stories: [{ id: "political-1", headline: "Mail ballots", summary: "A court order", sitting_id: "p3" }] }] }
}], "ballots");
assert.strictEqual(stories[0].kind, "story");
assert.strictEqual(stories[0].href, "docket.html?night=2026-11-01#sitting-p3");
assert.deepStrictEqual(docket.searchNights([{ date: "2026-11-01", night: { sittings: [] } }], "a"), []);
const unsafe = docket.searchResultHtml([{ kind: "story", date: "2026-11-01", label: "<b>", title: "<script>", excerpt: "x", href: "docket.html?night=2026-11-01#sitting-p1" }]);
assert.ok(!/<script/i.test(unsafe));
assert.ok(unsafe.includes("&lt;script&gt;"));
assert.ok(unsafe.includes('href="docket.html?night=2026-11-01#sitting-p1"'));
const pageJs = fs.readFileSync(path.join(__dirname, "../docket-page.js"), "utf8");
assert.ok(pageJs.includes('id="docket-search"'));
assert.ok(pageJs.includes("searchNights"));
assert.ok(pageJs.includes("chairUrl"));
assert.ok(pageJs.includes("On the shelf"));

const groups = docket.splitGroups(
  "Aquinas, a formed conscience; Kant, Cicero, the pledge; Burke, fight within; Washington, Thoreau.",
  ["Thomas Aquinas", "Immanuel Kant", "Edmund Burke", "George Washington", "Henry David Thoreau", "Cicero"]
);
assert.deepStrictEqual(groups.map((group) => group.slice().sort()), [
  ["Thomas Aquinas"],
  ["Cicero", "Immanuel Kant"],
  ["Edmund Burke"],
  ["George Washington", "Henry David Thoreau"]
]);
const chairRecords = [{
  date: "2026-11-01",
  label: "Sunday, November 1, 2026",
  night: {
    sittings: [{
      id: "p1",
      section: "Political",
      headline: "A pledge",
      briefing: { split: "Aquinas, a formed conscience; Kant, the pledge." },
      chairs: [
        {
          name: "Thomas Aquinas",
          roster_id: "aquinas",
          years: "1225–1274",
          tradition: "Classical Christian",
          quotes: [{ text: "every will at variance with reason", work: "Summa Theologica", location: "I-II, Q. 19", verified: true, source_url: "https://www.gutenberg.org/ebooks/17897" }]
        },
        { name: "Immanuel Kant", quotes: [] }
      ]
    }]
  }
}];
const chairRows = [{ id: "2026-11-01/p1", subject: "moral", count: 2 }];
const aquinas = docket.chairPage("thomas aquinas", chairRecords, chairRows);
assert.strictEqual(aquinas.name, "Thomas Aquinas");
assert.strictEqual(aquinas.rosterId, "aquinas");
assert.strictEqual(aquinas.sittings.length, 1);
assert.strictEqual(aquinas.sittings[0].href, "docket.html?night=2026-11-01#sitting-p1");
assert.strictEqual(aquinas.quotes.length, 1);
assert.strictEqual(aquinas.quotes[0].work, "Summa Theologica");
assert.strictEqual(aquinas.quotes[0].location, "I-II, Q. 19");
assert.strictEqual(aquinas.agrees[0].name, "Immanuel Kant");
assert.strictEqual(aquinas.agrees[0].count, 1);
assert.strictEqual(aquinas.disagrees[0].name, "Immanuel Kant");
assert.strictEqual(docket.chairPage("Nobody", chairRecords, chairRows), null);
const chairHtml = docket.chairPageHtml(aquinas);
assert.ok(chairHtml.includes("Summa Theologica"));
assert.ok(chairHtml.includes("I-II, Q. 19"));
assert.ok(chairHtml.includes("index.html#thinker=aquinas"));
assert.ok(chairHtml.includes("Agrees most often with"));
assert.ok(chairHtml.includes("Disagrees most often with"));
assert.ok(!/<script/i.test(docket.chairPageHtml({ name: "<script>", rosterId: "", years: "", tradition: "", sittings: [], quotes: [], agrees: [], disagrees: [] })));
assert.ok(docket.chairPageHtml(null).includes("no sitting"));
assert.strictEqual(docket.chairUrl("Thomas Aquinas"), "docket.html?chair=Thomas%20Aquinas");
assert.strictEqual(docket.chairQuery({ search: "?chair=Thomas%20Aquinas", hash: "" }), "Thomas Aquinas");
const realAquinas = docket.chairPage("Thomas Aquinas", [{
  date: "2026-11-01",
  label: "Sunday, November 1, 2026",
  night: JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/2026-11-01.json"), "utf8"))
}], JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/agreements.json"), "utf8")).discussions);
assert.ok(realAquinas.sittings.length >= 1);
assert.ok(realAquinas.quotes.length >= 1);
realAquinas.quotes.forEach((quote) => {
  assert.ok(quote.work, quote.text);
  assert.ok(quote.location, quote.text);
});
assert.ok(realAquinas.agrees.length >= 1);

const menu = [
  { date: "2026-11-08", label: "Live", file: "2026-11-08.json" },
  { date: "2026-11-01", label: "Flagged", file: "2026-11-01.json", archived: true }
];
const stored = [{ date: "2026-10-22", label: "Stored", file: "2026-10-22.json" }];
assert.deepStrictEqual(docket.liveNights(menu, stored).map((night) => night.date), ["2026-11-08"]);
assert.deepStrictEqual(docket.archivedNights(menu, stored).map((night) => night.date), ["2026-11-01", "2026-10-22"]);
assert.strictEqual(docket.openableNights(menu, stored)[0].date, "2026-11-08");
assert.ok(docket.openableNights(menu, stored).some((night) => night.date === "2026-10-22"));
assert.strictEqual(docket.nightFromLocation({ search: "?night=2026-10-22", hash: "" }, docket.openableNights(menu, stored)), "2026-10-22");
assert.ok(docket.archiveListHtml([]).includes("No nights are in the archive"));
const archiveHtml = docket.archiveListHtml(stored);
assert.ok(archiveHtml.includes('href="docket.html?night=2026-10-22"'));
assert.ok(archiveHtml.includes("Stored"));
assert.ok(!docket.archiveListHtml([{ date: "2026-10-22", label: "<script>" }]).includes("<script>"));
const archiveFile = JSON.parse(fs.readFileSync(path.join(__dirname, "../docket/archive.json"), "utf8"));
assert.deepStrictEqual(archiveFile.nights, []);
assert.ok(!index.nights.some((night) => night.archived === true));
assert.ok(fs.readFileSync(path.join(__dirname, "../README.md"), "utf8").includes("archive it instead of deleting"));
assert.ok(fs.readFileSync(path.join(__dirname, "../docket-page.js"), "utf8").includes("archive.json"));

console.log("docket tests passed", index.nights.map((entry) => entry.date).join(", "));
