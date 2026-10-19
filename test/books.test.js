const assert = require("assert");
const fs = require("fs");
const path = require("path");
const score = require("../score.js");
const panel = require("../panel.js");
const books = require("../books.js");

const root = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/tables.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/books/manifest.json"), "utf8"));
const thinkers = catalog.thinkers.map((id) => JSON.parse(fs.readFileSync(path.join(root, "data/thinkers", id + ".json"), "utf8")));
const byId = Object.fromEntries(thinkers.map((thinker) => [thinker.id, thinker]));
const rel = catalog.relevance;
const compass = "The importance of a shared moral compass in a society";
const rawDir = process.env.BOOK_RAW || "/tmp/pg";

function load(id) {
  const pack = books.readThinker(root, id);
  if (pack) books.install(id, pack.index, pack.texts);
  return pack;
}

function judge(thinker, text, relevance) {
  const card = score.scoreThinker(thinker, text, relevance);
  const pack = books.library.indexes[thinker.id];
  if (!pack) return card;
  return books.mergeScore(card, books.rankedEntries(thinker.id, text, relevance, 8), relevance);
}

function roundFor(tableId, text, used) {
  const ids = catalog.tables.find((table) => table.id === tableId).preset;
  ids.forEach(load);
  return panel.buildRound({
    thinkers: ids.map((id) => byId[id]),
    text,
    relevance: rel,
    scoreThinker: judge,
    distinctive: score.distinctive,
    opening: "subject",
    usedPassageIds: used
  });
}

const excluded = new Set(manifest.excluded.map((row) => row.id));
assert.ok(excluded.has("lewis"));
assert.ok(!manifest.books.some((book) => excluded.has(book.thinkerId)));
assert.ok(!fs.existsSync(path.join(root, "data/books/index/lewis.json")));
manifest.books.forEach((book) => {
  assert.ok(book.pdBasis && book.sourceUrl && book.edition, book.id);
  assert.ok(fs.existsSync(path.join(root, book.textFile)), book.id);
  const index = path.join(root, "data/books/index", book.thinkerId + ".json");
  assert.ok(fs.existsSync(index), book.thinkerId);
});

const tie = books.mergeScore({
  idle: false,
  score: 8,
  speaks: true,
  hits: 1,
  matches: [{ entry: { claim: "A curated card.", work: "Card", loc: "page 1", press: "for", topics: ["moral"], verbatim: true, bears: "A summary, not a quotation." }, score: 8, lexical: [], hitTopics: ["moral"] }],
  topics: ["moral"]
}, [{
  score: 8,
  hitTopics: ["moral"],
  entry: { fromText: true, verbatim: true, claim: "A searched passage.", work: "Book", loc: "Book I, paragraph 1", passageId: "tie-1", press: "qualifies", topics: ["moral"], bears: "" }
}], rel);
assert.strictEqual(tie.matches[0].entry.claim, "A curated card.");
assert.strictEqual(tie.matches[1].entry.fromText, true);

function claimOf(paragraph) {
  const quoted = paragraph.match(/“([\s\S]*)”$/);
  return quoted ? quoted[1] : "";
}

const seen = [];
["christian", "ancient", "traditionalist"].forEach((tableId) => {
  const built = roundFor(tableId, compass);
  const again = roundFor(tableId, compass);
  assert.deepStrictEqual(built.turns.map((turn) => turn.paragraphs), again.turns.map((turn) => turn.paragraphs), tableId + " drifted");
  const full = built.turns.filter((turn) => (turn.cites || []).some((cite) => cite.fromText));
  assert.ok(full.length > 0, tableId + " quoted no full text");
  const ids = [];
  built.turns.forEach((turn) => {
    (turn.cites || []).forEach((cite, i) => {
      if (!cite.fromText) return;
      const claim = claimOf(turn.paragraphs[i]);
      assert.strictEqual(claim, turn.cards[i].claim);
      assert.ok(/[.!?]["”']?$/.test(claim), cite.loc);
      assert.ok(cite.loc && cite.url && cite.passageId, cite.work);
      assert.ok(turn.paragraphs[i].startsWith("From the full text of "), turn.paragraphs[i].slice(0, 40));
      ids.push(cite.passageId);
      seen.push({ thinkerId: turn.id, claim, cite });
    });
  });
  assert.strictEqual(new Set(ids).size, ids.length, tableId + " repeated a passage");
  console.log(tableId, built.turns.map((turn) => `${turn.kind}:${turn.name}:${(turn.cites || []).some((cite) => cite.fromText) ? "text" : turn.kind}`).join(" | "));
});

const prior = new Set(seen.filter((row) => row.thinkerId && catalog.tables.find((table) => table.id === "christian").preset.includes(row.thinkerId)).map((row) => row.cite.passageId));
const used = new Set(prior);
const follow = roundFor("christian", compass, used);
const followIds = follow.turns.flatMap((turn) => (turn.cites || []).map((cite) => cite.passageId).filter(Boolean));
followIds.forEach((id) => assert.ok(!prior.has(id), id));

function normalize(text) {
  return String(text || "")
    .replace(/_([^_\n]{1,80})_/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/([A-Za-z])-\s+([a-z])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

let checked = 0;
const samples = [];
manifest.books.forEach((book) => {
  const pack = load(book.thinkerId);
  const bookIndex = pack.index.books.findIndex((row) => row.id === book.id);
  const text = pack.texts[bookIndex];
  const passages = pack.index.passages.filter((passage) => passage.book === bookIndex);
  [12, 40, 90].forEach((at) => {
    if (samples.length >= 24) return;
    const passage = passages[at];
    if (!passage) return;
    samples.push({ book, passage, text });
  });
});
assert.ok(samples.length >= 20, "needed 20 passages, got " + samples.length);
samples.slice(0, 20).forEach((sample) => {
  const slice = sample.text.slice(sample.passage.start, sample.passage.end);
  assert.ok(slice.length >= 80 && slice.length <= 900, sample.book.id);
  assert.ok(/[.!?]["”']?$/.test(slice), sample.book.id + " " + sample.passage.loc);
  const rawName = sample.book.id + (sample.book.id === "locke-letter" ? ".wiki" : ".txt");
  const rawPath = path.join(rawDir, rawName);
  if (fs.existsSync(rawPath)) {
    const raw = fs.readFileSync(rawPath, "utf8");
    const body = sample.book.id === "locke-letter" ? raw : raw.split("*** START OF THE PROJECT GUTENBERG")[1] || raw;
    assert.ok(normalize(body).includes(normalize(slice)), sample.book.id + " " + sample.passage.loc);
  }
  checked += 1;
  console.log("exact", sample.book.id, sample.passage.loc);
});
assert.strictEqual(checked, 20);
seen.forEach((row) => {
  const index = books.library.indexes[row.thinkerId];
  const passage = index.passages.find((item) => item.id === row.cite.passageId);
  const file = index.books[passage.book].file;
  const slice = books.library.texts[file].slice(passage.start, passage.end);
  assert.strictEqual(slice, row.claim, row.cite.passageId);
});

async function linkCheck() {
  const urls = [...new Set(manifest.books.map((book) => book.sourceUrl))];
  const bad = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "AthenaeumLinkCheck/1.0" } });
      if (res.status < 200 || res.status >= 400) bad.push(url + " " + res.status);
    } catch (err) {
      bad.push(url + " " + err.message);
    }
  }
  assert.deepStrictEqual(bad, []);
  console.log("links", urls.length);
}

linkCheck().then(() => console.log("book tests passed")).catch((err) => {
  console.error(err);
  process.exit(1);
});
