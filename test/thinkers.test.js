const assert = require("assert");
const fs = require("fs");
const path = require("path");
const docket = require("../docket.js");
const thinkers = require("../thinkers.js");

const root = path.join(__dirname, "..");

function hiddenWord() {
  return String.fromCharCode(71, 114, 101, 101, 110, 115, 98, 111, 114, 111);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function loadModel() {
  const tables = readJson("data/tables.json");
  const index = readJson("docket/index.json");
  const archive = readJson("docket/archive.json");
  const agreements = readJson("docket/agreements.json");
  const files = (tables.thinkers || []).map((id) => readJson(`data/thinkers/${id}.json`));
  const nights = docket.openableNights(index.nights || [], archive.nights || []);
  const records = [];
  nights.forEach((entry) => {
    if (!entry.file) return;
    const file = path.join(root, "docket", entry.file);
    if (!fs.existsSync(file)) return;
    const night = JSON.parse(fs.readFileSync(file, "utf8"));
    records.push({ date: entry.date, label: entry.label || night.date_long || entry.date, night });
  });
  return {
    model: thinkers.assemble({ tables, thinkers: files, records, agreementRows: agreements.discussions || [] }),
    records,
    agreements: agreements.discussions || [],
    tables,
    files
  };
}

assert.deepStrictEqual(thinkers.eraFromYears("384–322 BCE"), { label: "4th century BCE", sort: -384 });
assert.deepStrictEqual(thinkers.eraFromYears("1225–1274"), { label: "13th century", sort: 1225 });
assert.deepStrictEqual(thinkers.eraFromYears("6th century BC"), { label: "6th century BCE", sort: -550 });
assert.deepStrictEqual(thinkers.eraFromYears("4th century BC"), { label: "4th century BCE", sort: -350 });
assert.deepStrictEqual(thinkers.eraFromYears("1933–"), { label: "20th century", sort: 1933 });
assert.deepStrictEqual(thinkers.eraFromYears("c. 428–348 BCE"), { label: "5th century BCE", sort: -428 });
assert.deepStrictEqual(thinkers.eraFromYears("121–180"), { label: "2nd century", sort: 121 });
assert.deepStrictEqual(thinkers.eraFromYears("c. 480–524"), { label: "5th century", sort: 480 });
assert.strictEqual(thinkers.eraFromYears(""), null);
assert.strictEqual(thinkers.eraFromYears("no year"), null);
assert.strictEqual(thinkers.seatId("Niccolò Machiavelli"), "seat:niccolo-machiavelli");
assert.strictEqual(thinkers.plural(1, "split", "splits"), "1 split");
assert.strictEqual(thinkers.plural(2, "agreement", "agreements"), "2 agreements");

const fixtureTables = {
  thinkers: ["aquinas", "kant", "plato"],
  tables: [
    { id: "christian", name: "Classical Christian", tradition: "Classical Christian", thinkers: ["aquinas"] },
    { id: "ancient", name: "Ancient philosophy", tradition: "Ancient Greek and Roman", thinkers: ["plato"] }
  ]
};
const fixtureThinkers = [
  { id: "aquinas", name: "Thomas Aquinas", years: "1225–1274", place: "Roccasecca", epithet: "The angelic doctor", dossier: "A shelf note without a quotation.", tableId: "christian", portrait: "images/aquinas.jpg", works: [{ title: "Summa Theologica", url: "https://www.gutenberg.org/ebooks/17897", note: "Project Gutenberg" }, { title: "Bad", url: "javascript:alert(1)", note: "skip" }] },
  { id: "kant", name: "Immanuel Kant", years: "1724–1804", place: "Königsberg", epithet: "The critical philosopher", dossier: "Another note.", tableId: "letters", works: [] },
  { id: "plato", name: "Plato", years: "c. 428–348 BCE", place: "Athens", dossier: "Plato's note.", tableId: "ancient", works: [{ title: "Republic", url: "https://www.gutenberg.org/ebooks/1497", note: "A text" }] }
];
const fixtureRecords = [{
  date: "2026-11-01",
  label: "Sunday, November 1, 2026",
  night: {
    sittings: [
      {
        id: "p1",
        section: "Political",
        headline: "A pledge",
        question: "What does a pledge require?",
        briefing: { agreed: "A promise binds.", split: "Aquinas, a formed conscience; Kant, the pledge." },
        chairs: [
          { name: "Thomas Aquinas", roster_id: "aquinas", years: "1225–1274", tradition: "Classical Christian", quotes: [{ text: "every will at variance with reason", work: "Summa Theologica", location: "I-II, Q. 19", verified: true, source_url: "https://www.gutenberg.org/ebooks/17897" }, { text: "not verified", work: "Summa", location: "nowhere", verified: false }] },
          { name: "Immanuel Kant", roster_id: "kant", quotes: [{ text: "A line that was not checked", verified: false }] }
        ]
      },
      {
        id: "p2",
        section: "Political",
        headline: "Again",
        briefing: { agreed: "They meet once more.", split: "" },
        chairs: [
          { name: "Thomas Aquinas", roster_id: "aquinas" },
          { name: "Immanuel Kant", roster_id: "kant" }
        ]
      },
      {
        id: "p3",
        section: "Political",
        headline: "Alone",
        briefing: { agreed: "Only one chair.", split: "" },
        chairs: [{ name: "Thomas Aquinas", roster_id: "aquinas" }]
      },
      {
        id: "p4",
        section: "Political",
        headline: "Off the file",
        briefing: { agreed: "This sitting is not listed.", split: "Aquinas, left; Kant, right." },
        chairs: [
          { name: "Thomas Aquinas", roster_id: "aquinas" },
          { name: "Immanuel Kant", roster_id: "kant" }
        ]
      },
      {
        id: "p5",
        section: "Cultural",
        headline: "The apology",
        briefing: { agreed: "Socrates stays.", split: "" },
        chairs: [
          { name: "Socrates, in Plato's Apology", roster_id: "plato", tradition: "Ancient philosophy", works: ["Apology"], quotes: [{ text: "A Socratic line", work: "Apology", location: "38a", verified: true, source_url: "https://www.gutenberg.org/ebooks/1656" }] },
          { name: "Immanuel Kant", roster_id: "kant" }
        ]
      }
    ]
  }
}];
const fixtureRows = [
  { id: "2026-11-01/p1", subject: "moral", count: 2 },
  { id: "2026-11-01/p2", subject: "moral", count: 2 },
  { id: "2026-11-01/p3", subject: "moral", count: 1 },
  { id: "2026-11-01/p5", subject: "moral", count: 2 }
];
const fixture = thinkers.assemble({ tables: fixtureTables, thinkers: fixtureThinkers, records: fixtureRecords, agreementRows: fixtureRows });
const aquinas = fixture.byId.aquinas;
const kant = fixture.byId.kant;
const plato = fixture.byId.plato;
assert.strictEqual(aquinas.sittingCount, 4);
assert.strictEqual(aquinas.quotes.length, 1);
assert.strictEqual(aquinas.quotes[0].text, "every will at variance with reason");
assert.strictEqual(aquinas.place, "Roccasecca");
assert.strictEqual(aquinas.dossier, "A shelf note without a quotation.");
assert.strictEqual(aquinas.works[0].url, "https://www.gutenberg.org/ebooks/17897");
assert.strictEqual(aquinas.works[1].url, "");
assert.ok(aquinas.traditions.includes("Classical Christian"));
assert.strictEqual(plato.sittingCount, 0);
const socrates = fixture.thinkers.find((row) => row.name === "Socrates, in Plato's Apology");
assert.ok(socrates);
assert.notStrictEqual(socrates.id, "plato");
assert.strictEqual(socrates.shelfId, "plato");
assert.strictEqual(socrates.shelfSameName, false);
assert.strictEqual(socrates.quotes.length, 1);
assert.ok(!plato.quotes.some((quote) => quote.text === "A Socratic line"));
const pair = fixture.pairs.find((row) => row.a === "aquinas" && row.b === "kant" || row.a === "kant" && row.b === "aquinas");
assert.ok(pair);
assert.strictEqual(pair.together, 3);
assert.strictEqual(pair.agree, 2);
assert.strictEqual(pair.disagree, 1);
assert.ok(pair.sittings.some((sitting) => sitting.id === "2026-11-01/p4" && sitting.agreed === false && sitting.split === false));
assert.strictEqual(aquinas.agrees[0].id, "kant");
assert.strictEqual(aquinas.agrees[0].count, 2);
assert.strictEqual(aquinas.disagrees[0].count, 1);
assert.ok(fixture.pairs.some((row) => row.a === socrates.id || row.b === socrates.id));

const unsafe = thinkers.dossierHtml({
  id: "x",
  name: "<script>",
  seatedNames: [],
  yearsLabel: "<b>",
  place: "",
  epithet: "",
  dossier: "Plain <em>note</em>",
  portrait: "javascript:alert(1)",
  traditions: ["<i>"],
  works: [{ title: "<script>", url: "javascript:alert(1)", note: "" }],
  shelfId: "",
  sittings: [],
  quotes: [{ text: "A real line", work: "Book", location: "1", verified: true, href: "docket.html?night=2026-11-01#sitting-p1", label: "Night" }],
  sittingCount: 1,
  agrees: [],
  disagrees: []
});
assert.ok(unsafe.includes("<q class=\"vq\">A real line</q>"));
assert.ok(!/<script/i.test(unsafe));
assert.ok(unsafe.includes("&lt;script&gt;"));
assert.ok(unsafe.includes("&lt;em&gt;"));
assert.ok(!unsafe.includes("javascript:"));
const quoteCount = unsafe.split("<q").length - 1;
assert.strictEqual(quoteCount, 1);

const drill = thinkers.drillHtml(pair, fixture.byId);
assert.ok(drill.includes("A promise binds."));
assert.ok(drill.includes("docket.html?night=2026-11-01#sitting-p1"));
assert.ok(!drill.includes("<q"));
assert.ok(drill.includes("Agreement recorded"));
assert.ok(drill.includes(">Split<") || drill.includes("Split"));

const listed = thinkers.filterThinkers(fixture.thinkers, { query: "aquinas", tradition: "all", era: "all", frequency: "any" });
assert.deepStrictEqual(listed.map((row) => row.id), ["aquinas"]);
const unseated = thinkers.filterThinkers(fixture.thinkers, { frequency: "unseated" });
assert.ok(unseated.some((row) => row.id === "plato"));
assert.ok(!unseated.some((row) => row.id === "aquinas"));
const ancient = thinkers.filterThinkers(fixture.thinkers, { tradition: "Ancient Greek and Roman" });
assert.ok(ancient.some((row) => row.id === "plato"));
const byEra = thinkers.filterThinkers(fixture.thinkers, { era: "13th century" });
assert.deepStrictEqual(byEra.map((row) => row.id), ["aquinas"]);
const byFreq = thinkers.sortThinkers(fixture.thinkers, "frequency");
assert.ok(byFreq[0].sittingCount >= byFreq[1].sittingCount);
assert.ok(byFreq.findIndex((row) => row.id === "aquinas") < byFreq.findIndex((row) => row.id === "plato"));
const earliest = thinkers.sortThinkers(fixture.thinkers, "earliest");
assert.strictEqual(earliest[0].id, "plato");

const filtered = thinkers.filterPairs(fixture.pairs, { query: "Kant", minShared: 2 }, fixture.byId);
assert.ok(filtered.some((row) => row.id === pair.id));
assert.strictEqual(thinkers.filterPairs(fixture.pairs, { minShared: 4 }, fixture.byId).length, 0);
const sharpest = thinkers.sortPairs(fixture.pairs, "disagreement", fixture.byId);
assert.ok(sharpest[0].disagree >= sharpest[sharpest.length - 1].disagree);
const axes = thinkers.axisOrder(filtered, "agreement", fixture.byId);
assert.ok(axes.includes("aquinas"));
assert.ok(axes.includes("kant"));
const grid = thinkers.gridAxes(axes.concat(["extra"]), { cap: 2 });
assert.strictEqual(grid.axes.length, 2);
assert.strictEqual(grid.truncated, axes.length + 1 - 2);

const matrix = thinkers.matrixHtml(["aquinas", "kant"], [pair], fixture.byId, pair.id);
assert.ok(matrix.includes(`data-pair="${pair.id}"`));
assert.ok(matrix.includes("aria-pressed=\"true\""));
assert.ok(matrix.includes(">2<"));
assert.ok(matrix.includes(">1<"));
assert.ok(!/<script/i.test(thinkers.listHtml([{ id: "x", name: "<script>", traditions: [], sittingCount: 0 }], "")));
assert.ok(thinkers.listHtml([], "").includes("No thinker matches"));
assert.strictEqual(thinkers.dossierHtml(null).includes("not in the catalog"), true);

const loaded = loadModel();
const model = loaded.model;
const aristotleFile = loaded.files.find((file) => file.id === "aristotle");
const aristotle = model.byId.aristotle;
assert.strictEqual(aristotle.name, aristotleFile.name);
assert.strictEqual(aristotle.yearsLabel, aristotleFile.years);
assert.strictEqual(aristotle.place, aristotleFile.place);
assert.strictEqual(aristotle.dossier, aristotleFile.dossier);
assert.ok(aristotle.works.some((work) => work.title === "Nicomachean Ethics" && work.url === "https://www.gutenberg.org/ebooks/8438"));
assert.ok(aristotle.sittingCount >= 1);
assert.ok(aristotle.quotes.length >= 1);
aristotle.quotes.forEach((quote) => {
  assert.strictEqual(quote.verified, true);
  assert.ok(quote.text);
  assert.ok(quote.work);
  assert.ok(quote.href.includes("docket.html?night="));
});
const chair = docket.chairPage("Aristotle", loaded.records, loaded.agreements);
assert.strictEqual(aristotle.sittingCount, chair.sittings.length);
assert.strictEqual(aristotle.quotes.length, chair.quotes.length);
assert.deepStrictEqual(aristotle.agrees.map((row) => row.count), chair.agrees.map((row) => row.count));
assert.deepStrictEqual(aristotle.disagrees.map((row) => row.count), chair.disagrees.map((row) => row.count));

const hayek = model.byId.hayek;
const hayekFile = loaded.files.find((file) => file.id === "hayek");
assert.strictEqual(hayek.name, hayekFile.name);
assert.ok(hayek.sittingCount >= 1);
assert.ok(hayek.seatedNames.includes("Friedrich Hayek"));
assert.strictEqual(model.thinkers.filter((row) => row.name === "Friedrich Hayek").length, 0);
assert.strictEqual(hayek.dossier, hayekFile.dossier);

const realSocrates = model.thinkers.filter((row) => /Socrates/i.test(row.name));
assert.ok(realSocrates.length >= 1);
realSocrates.forEach((row) => {
  assert.notStrictEqual(row.id, "plato");
  assert.strictEqual(row.dossier, "");
  row.quotes.forEach((quote) => {
    assert.ok(!model.byId.plato.quotes.some((other) => other.text === quote.text && other.href === quote.href));
  });
});

const spencer = model.byId.spencer;
assert.strictEqual(spencer.sittingCount, 0);
assert.strictEqual(spencer.dossier, loaded.files.find((file) => file.id === "spencer").dossier);
const unseatedReal = thinkers.filterThinkers(model.thinkers, { frequency: "unseated" });
assert.ok(unseatedReal.some((row) => row.id === "spencer"));
assert.ok(!unseatedReal.some((row) => row.id === "aristotle"));
assert.ok(thinkers.filterThinkers(model.thinkers, { tradition: "Ancient Greek and Roman" }).some((row) => row.id === "aristotle"));
assert.ok(thinkers.filterThinkers(model.thinkers, { era: "4th century BCE" }).some((row) => row.id === "aristotle"));
assert.ok(thinkers.filterThinkers(model.thinkers, { query: "friedrich" }).some((row) => row.id === "hayek"));

model.pairs.forEach((row) => {
  assert.ok(row.together >= row.agree);
  assert.ok(row.agree >= row.disagree);
  assert.strictEqual(row.sittings.length, row.together);
  const agreed = row.sittings.filter((sitting) => sitting.agreed).length;
  const split = row.sittings.filter((sitting) => sitting.split).length;
  assert.strictEqual(agreed, row.agree);
  assert.strictEqual(split, row.disagree);
});
const sample = model.pairs.find((row) => row.together >= 2 && row.disagree >= 1);
assert.ok(sample);
const sortedAgree = thinkers.sortPairs(model.pairs, "agreement", model.byId);
assert.ok(sortedAgree[0].agree >= sortedAgree[1].agree);
const sortedSplit = thinkers.sortPairs(model.pairs, "disagreement", model.byId);
assert.ok(sortedSplit[0].disagree >= sortedSplit[1].disagree);
const sortedShared = thinkers.sortPairs(model.pairs, "shared", model.byId);
assert.ok(sortedShared[0].together >= sortedShared[1].together);
assert.strictEqual(thinkers.filterPairs(model.pairs, { minShared: 100 }, model.byId).length, 0);

const realHtml = thinkers.dossierHtml(aristotle);
assert.ok(realHtml.includes("<q class=\"vq\">"));
assert.ok(realHtml.includes("Nicomachean Ethics"));
assert.ok(realHtml.includes("index.html#thinker=aristotle"));
assert.ok(!/<script/i.test(realHtml));
const withoutQuotes = realHtml.replace(/<q class="vq">[\s\S]*?<\/q>/g, "");
assert.ok(!withoutQuotes.includes("<q"));

["thinkers.js", "thinkers-page.js", "thinkers.html", "styles.css", "README.md"].forEach((name) => {
  const source = fs.readFileSync(path.join(root, name), "utf8");
  assert.ok(source.indexOf(hiddenWord()) < 0, name);
});
["index.html", "docket.html", "archive.html", "saved.html", "encounters.html", "thinkers.html"].forEach((name) => {
  const page = fs.readFileSync(path.join(root, name), "utf8");
  assert.ok(page.includes('href="thinkers.html"'), name);
  assert.ok(page.includes('href="docket.html"'), name);
  assert.ok(page.includes('href="archive.html"'), name);
  assert.ok(page.includes('href="encounters.html"'), name);
  assert.ok(page.includes('href="saved.html"'), name);
});
assert.ok(fs.readFileSync(path.join(root, "thinkers.html"), "utf8").includes('aria-current="page"'));
assert.ok(fs.readFileSync(path.join(root, "README.md"), "utf8").includes("thinkers.html"));

console.log("thinkers", model.thinkers.length, "pairs", model.pairs.length, "aristotle", aristotle.sittingCount, aristotle.quotes.length);
console.log("thinkers tests passed");
