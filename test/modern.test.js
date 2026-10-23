const assert = require("assert");
const fs = require("fs");
const path = require("path");
const score = require("../score.js");
const panel = require("../panel.js");
const modern = require("../modern.js");
const share = require("../share.js");

const dir = path.join(__dirname, "../data/thinkers");
const GLUE = new Set("a an the and or but of to in on for with as by from that this these those it its is are was were be been being not no nor if then than so such which who whom whose what when where while whilst among amongst you your has does into unto at his her their our my we they he she i me him them there here also only very more most other upon over after before about between within without through during per both each any all some many much one two same own out up down off again still just even ever never may can will would should shall do did done doing have had having".split(/\s+/));

function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

function sentenceCount(text) {
  const masked = String(text || "").replace(/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|No|Vol|Bk|ch|cf|e\.g|i\.e)\./gi, (match) => match.replace(/\./g, ""));
  return (masked.match(/[.!?]/g) || []).length;
}

const hume = JSON.parse(fs.readFileSync(path.join(dir, "hume.json"), "utf8"));
const humeClaim = "Some people are subject to a certain delicacy of passion, which makes them extremely sensible to all the accidents of life, and gives them a lively joy upon every prosperous event, as well as a piercing grief when they meet with misfortune and adversity.";
assert.strictEqual(hume.entries[0].claim, humeClaim);
assert.strictEqual(hume.entries[0].verbatim, true);
assert.ok(hume.entries[0].modern);
assert.notStrictEqual(hume.entries[0].modern, humeClaim);
assert.ok(hume.entries[0].modern.includes("The essay begins from a delicacy of passion"));
assert.ok(!/[\u201c\u201d"]/.test(hume.entries[0].modern));

const augustine = JSON.parse(fs.readFileSync(path.join(dir, "augustine.json"), "utf8"));
const thou = augustine.entries.find((entry) => entry.claim.indexOf("Thou madest us") === 0);
assert.ok(thou);
assert.strictEqual(thou.claim, "Thou madest us for Thyself, and our heart is restless, until it repose in Thee.");
assert.ok(thou.modern.includes("You madest us"));
assert.ok(!thou.modern.includes("Thou"));

let count = 0;
fs.readdirSync(dir).filter((name) => name.endsWith(".json")).forEach((name) => {
  const thinker = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  (thinker.entries || []).forEach((entry, index) => {
    count += 1;
    assert.ok(entry.modern, `${name}#${index} missing modern`);
    const sentences = sentenceCount(entry.modern);
    assert.ok(sentences >= 1 && sentences <= 3, `${name}#${index} has ${sentences} sentences: ${entry.modern}`);
    assert.ok(!/[\u201c\u201d"]/.test(entry.modern), `${name}#${index} looks like a quotation`);
    assert.ok(!/(^|[^A-Za-z0-9])'|'(?![A-Za-z0-9])/.test(entry.modern), `${name}#${index} has a quotation mark`);
    assert.strictEqual(entry.modern, modern.compose(entry.claim, entry.bears), `${name}#${index} drifted from compose`);
    const source = new Set(tokens(`${entry.claim} ${entry.bears}`));
    tokens(entry.modern).forEach((word) => {
      if (GLUE.has(word)) return;
      assert.ok(source.has(word), `${name}#${index} adds “${word}”`);
    });
    if (entry.verbatim) assert.ok(entry.claim && entry.claim !== entry.modern, `${name}#${index} replaced the quotation`);
  });
});
assert.strictEqual(count, 509);

const supplied = "People feel joy and grief more sharply when passion is delicate. A later reply can say this in its own words.";
const hooked = modern.forTurn({
  kind: "chair",
  modern: `  ${supplied}  `,
  cards: [{ claim: "Something else entirely.", bears: "Not this." }]
});
assert.strictEqual(hooked, supplied);

assert.strictEqual(modern.forTurn({ kind: "abstain", modern: "Should not show.", editorial: "Sits out." }), "");
assert.strictEqual(modern.forTurn({ kind: "moderator", text: "Ask again." }), "");
assert.strictEqual(modern.forTurn({ kind: "silence", editorial: "Nobody wrote on this." }), "");

const fromText = modern.forTurn({
  kind: "chair",
  cards: [{ fromText: true, claim: "For human society constrains him. He learns to live with others.", bears: "" }]
});
assert.ok(fromText.includes("For human society constrains him."));
assert.ok(fromText.includes("He learns to live with others."));
assert.ok(!/[\u201c\u201d"]/.test(fromText));
assert.ok(sentenceCount(fromText) <= 3);

const narrow = {
  topicWeight: 4,
  lexicalWeight: 2,
  highMin: 28,
  lowMax: 2,
  speakMin: 4,
  lexicon: { moral: ["moral"] }
};
const ada = {
  id: "ada",
  name: "Ada",
  entries: [{
    topics: ["moral"],
    claim: "A moral custom holds.",
    bears: "Custom is the point.",
    modern: "A moral custom holds. Custom is the point.",
    press: "for",
    work: "Ada Book",
    loc: "1",
    url: "https://example.com/ada",
    verbatim: true
  }]
};
const built = panel.buildRound({
  thinkers: [ada],
  text: "a moral custom",
  relevance: narrow,
  scoreThinker: score.scoreThinker,
  distinctive: score.distinctive,
  opening: "subject"
});
assert.strictEqual(built.turns[0].kind, "chair");
assert.strictEqual(built.turns[0].cards[0].modern, ada.entries[0].modern);
assert.ok(built.turns[0].paragraphs[0].includes("“A moral custom holds.”"));
assert.ok(!built.turns[0].paragraphs[0].includes("Custom is the point."));

const packed = share.slim({
  topic: "A subject",
  turns: [{
    kind: "chair",
    name: "Ada",
    modern: "A moral custom holds.",
    paragraphs: ["From Ada Book, 1: “A moral custom holds.”"],
    cards: [{ claim: "A moral custom holds.", modern: "A moral custom holds.", topics: ["moral"] }],
    cites: []
  }]
});
assert.strictEqual(packed.turns[0].modern, "A moral custom holds.");
assert.strictEqual(packed.turns[0].cards[0].modern, "A moral custom holds.");
assert.strictEqual(packed.turns[0].paragraphs[0], "From Ada Book, 1: “A moral custom holds.”");
const bare = share.slim({ topic: "A subject", turns: [{ kind: "chair", paragraphs: ["x"], cards: [{ claim: "c" }] }] });
assert.ok(!("modern" in bare.turns[0]));
assert.ok(!("modern" in bare.turns[0].cards[0]));

console.log("modern tests passed", count);
