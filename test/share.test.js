const assert = require("assert");
const crypto = require("crypto");
const share = require("../share.js");

const compass = {
  topic: "The importance of a shared moral compass in a society",
  brief: "",
  tableId: "christian",
  seated: ["augustine", "aquinas", "boethius", "pascal", "kempis"],
  panel: true,
  topics: ["moral", "society"],
  turns: [{
    kind: "chair",
    id: "augustine",
    name: "Augustine",
    editorial: "Addressing the subject.",
    paragraphs: ["From the full text of The City of God, Book XIV, paragraph 2: “For human society constrains him.”"],
    cites: [{ work: "The City of God", loc: "Book XIV, paragraph 2", url: "https://www.gutenberg.org/ebooks/45305", verbatim: true, fromText: true, bears: "" }],
    cards: [{ topics: ["society", "moral"], claim: "For human society constrains him.", work: "The City of God", loc: "Book XIV, paragraph 2", verbatim: true, fromText: true }]
  }]
};

const legacy = {
  id: "legacy-before-books",
  topic: "A note kept before the books were searchable",
  brief: "",
  tableId: "letters",
  seated: ["aristotle", "aquinas"],
  chairs: [{
    id: "aristotle",
    name: "Aristotle",
    paragraphs: ["Summary of the Ethics, not a quotation: A city exists for the sake of a good life."],
    cites: [{ work: "Nicomachean Ethics", loc: "Book I", url: "https://www.gutenberg.org/ebooks/8438", bears: "A summary, not a quotation." }]
  }],
  abstained: [{ id: "locke", name: "John Locke", reason: "John Locke has not written on this, on the shelf we have, and sits out." }]
};

async function main() {
  const packed = await share.pack(compass);
  assert.strictEqual(packed.ok, true);
  assert.ok(packed.hash.startsWith("#s=") || packed.hash.startsWith("#t="));
  const opened = await share.unpack(packed.hash);
  assert.strictEqual(opened.topic, compass.topic);
  assert.strictEqual(opened.tableId, "christian");
  assert.deepStrictEqual(opened.seated, compass.seated);
  assert.strictEqual(opened.turns[0].cites[0].url, compass.turns[0].cites[0].url);
  assert.strictEqual(opened.turns[0].paragraphs[0], compass.turns[0].paragraphs[0]);
  assert.ok(!("portrait" in opened));

  const old = await share.pack(legacy);
  assert.strictEqual(old.ok, true);
  const restored = await share.unpack(old.hash);
  assert.strictEqual(restored.topic, legacy.topic);
  assert.strictEqual(restored.chairs[0].cites[0].url, legacy.chairs[0].cites[0].url);
  assert.strictEqual(restored.abstained[0].id, "locke");
  assert.ok(!restored.turns);

  const huge = {
    topic: "A very long sitting",
    brief: "",
    tableId: "letters",
    seated: ["aristotle"],
    panel: true,
    turns: [{
      kind: "chair",
      id: "aristotle",
      name: "Aristotle",
      paragraphs: [crypto.randomBytes(18000).toString("base64")],
      cites: [{ work: "Ethics", loc: "I", url: "https://www.gutenberg.org/ebooks/8438" }],
      cards: []
    }]
  };
  const too = await share.pack(huge);
  assert.strictEqual(too.ok, false);
  assert.strictEqual(too.tooLong, true);
  assert.strictEqual(await share.unpack("#s=not-valid"), null);
  assert.strictEqual(await share.unpack(""), null);
  console.log("share link", packed.length, "chars");
  console.log("share tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
