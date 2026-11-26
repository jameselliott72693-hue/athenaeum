const assert = require("assert");
const fs = require("fs");
const path = require("path");
const reader = require("../reader.js");

function memory(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    dump() { return data; }
  };
}

function hiddenWord() {
  return String.fromCharCode(71, 114, 101, 101, 110, 115, 98, 111, 114, 111);
}

const quote = "  The RIGHT OF NATURE, “as he will himselfe.”";
const paraphrase = "Hobbes says people give up the private use of force.";

let state = reader.emptyState();
assert.strictEqual(state.version, 1);
assert.strictEqual(state.folders[0].id, "unsorted");
assert.strictEqual(state.folders[0].name, "Unsorted");

const saved = reader.addItem(state, {
  id: "hl-hobbes",
  text: quote,
  kind: "verbatim",
  speaker: "Thomas Hobbes",
  work: "Leviathan",
  citation: "Leviathan, Part I, ch. XIV",
  edition: "1651; Project Gutenberg ebook 3207",
  sourceUrl: "https://www.gutenberg.org/ebooks/3207",
  night: "2026-11-17",
  sittingTitle: "Liberty versus order",
  sittingId: "p1",
  place: "docket.html?night=2026-11-17#sitting-p1",
  href: "docket.html?night=2026-11-17#saved-hl-hobbes",
  block: "quote:2026-11-17:hob-rightnature",
  start: 0,
  note: "Keep the sword line.",
  color: "rose",
  savedAt: "2026-11-20T05:00:00.000Z"
});
assert.strictEqual(saved.item.text, quote);
assert.strictEqual(saved.item.kind, "verbatim");
assert.strictEqual(saved.item.work, "Leviathan");
assert.strictEqual(saved.item.citation, "Leviathan, Part I, ch. XIV");
assert.strictEqual(saved.item.night, "2026-11-17");
state = saved.state;

const modern = reader.addItem(state, {
  id: "hl-modern",
  text: paraphrase,
  kind: "paraphrase",
  speaker: "Thomas Hobbes",
  night: "2026-11-17",
  sittingTitle: "Liberty versus order",
  block: "docket:2026-11-17:p1:modern:2",
  savedAt: "2026-11-20T06:00:00.000Z"
});
assert.strictEqual(modern.item.kind, "paraphrase");
assert.strictEqual(modern.item.text, paraphrase);
state = modern.state;

const word = hiddenWord();
const poisoned = reader.addItem(state, {
  id: "hl-plain",
  text: "A passage that must stay exact " + word,
  kind: "passage",
  note: "A note " + word + " here",
  speaker: word + " Smith",
  savedAt: "2026-11-18T00:00:00.000Z"
});
assert.ok(poisoned.item.text.indexOf(word) >= 0);
assert.ok(poisoned.item.note.indexOf(word) < 0);
assert.ok(poisoned.item.speaker.indexOf(word) < 0);
state = poisoned.state;

assert.strictEqual(reader.addItem(state, { text: "   " }).item, null);

const folder = reader.createFolder(state, { id: "folder-law", name: "Law", color: "sky", emoji: "⚖" });
assert.strictEqual(folder.folder.name, "Law");
assert.strictEqual(folder.folder.emoji, "⚖");
state = folder.state;
state = reader.moveItem(state, "hl-hobbes", "folder-law").state;
assert.strictEqual(state.items.find((item) => item.id === "hl-hobbes").folderId, "folder-law");
assert.strictEqual(state.items.filter((item) => item.id === "hl-hobbes").length, 1);

const renamed = reader.renameFolder(state, "folder-law", "Public law");
assert.strictEqual(renamed.folder.name, "Public law");
state = renamed.state;
assert.strictEqual(reader.renameFolder(state, "unsorted", "Loose").error, "locked");
assert.strictEqual(state.folders.find((row) => row.id === "unsorted").name, "Unsorted");

state = reader.labelFolder(state, "unsorted", { color: "lilac", emoji: "✦" }).state;
assert.strictEqual(state.folders.find((row) => row.id === "unsorted").emoji, "✦");

const removedFolder = reader.deleteFolder(state, "folder-law");
assert.strictEqual(removedFolder.removed, true);
assert.strictEqual(removedFolder.state.items.find((item) => item.id === "hl-hobbes").folderId, "unsorted");
assert.ok(!removedFolder.state.folders.some((row) => row.id === "folder-law"));
assert.strictEqual(reader.deleteFolder(removedFolder.state, "unsorted").error, "locked");
state = removedFolder.state;

state = reader.setSort(state, "items", "thinker").state;
const byThinker = reader.view(state, "").folders.flatMap((group) => group.items).map((item) => item.id);
assert.ok(byThinker.indexOf("hl-plain") < byThinker.indexOf("hl-hobbes"));

state = reader.setSort(state, "items", "night").state;
const byNight = reader.view(state, "").folders.flatMap((group) => group.items);
assert.strictEqual(byNight[byNight.length - 1].id, "hl-plain");
assert.ok(byNight[0].night);

state = reader.setSort(state, "items", "saved").state;
const bySaved = reader.view(state, "").folders.flatMap((group) => group.items);
assert.strictEqual(bySaved[0].id, "hl-modern");

state = reader.setSort(state, "items", "name").state;
const byName = reader.view(state, "").folders.flatMap((group) => group.items).map((item) => item.id);
assert.ok(byName.indexOf("hl-plain") < byName.indexOf("hl-hobbes"));

state = reader.setSort(state, "items", "manual").state;
state = reader.orderIds(state, "item", ["hl-plain", "hl-modern", "hl-hobbes"], "unsorted").state;
assert.deepStrictEqual(reader.view(state, "").folders[0].items.map((item) => item.id), ["hl-plain", "hl-modern", "hl-hobbes"]);

let folders = reader.createFolder(state, { id: "folder-b", name: "Beta", createdAt: "2026-11-01T00:00:00.000Z" }).state;
folders = reader.createFolder(folders, { id: "folder-a", name: "Alpha", createdAt: "2026-11-19T00:00:00.000Z" }).state;
folders = reader.setSort(folders, "folders", "name").state;
assert.deepStrictEqual(reader.view(folders, "").folders.map((group) => group.folder.name), ["Alpha", "Beta", "Unsorted"]);
folders = reader.setSort(folders, "folders", "saved").state;
assert.strictEqual(reader.view(folders, "").folders[0].folder.name, "Alpha");
folders = reader.orderIds(folders, "folder", ["folder-b", "unsorted", "folder-a"]).state;
assert.deepStrictEqual(reader.view(folders, "").folders.map((group) => group.folder.id), ["folder-b", "unsorted", "folder-a"]);

const found = reader.view(state, "sword");
assert.strictEqual(found.folders.length, 1);
assert.deepStrictEqual(found.folders[0].items.map((item) => item.id), ["hl-hobbes"]);
assert.strictEqual(reader.view(state, "no-such-phrase").folders.length, 0);

const markdown = reader.exportMarkdown(state);
assert.ok(markdown.indexOf(quote) >= 0);
assert.ok(markdown.indexOf("Verbatim quotation") >= 0);
assert.ok(markdown.indexOf("Leviathan, Part I, ch. XIV") >= 0);
assert.ok(markdown.indexOf("Labeled paraphrase, not a quotation.") >= 0);
assert.ok(markdown.indexOf(paraphrase) >= 0);
const plain = reader.exportText(state);
assert.ok(plain.indexOf(quote) >= 0);
assert.ok(plain.indexOf("Night: 2026-11-17") >= 0);
const json = reader.exportJson(state);
const round = JSON.parse(json);
assert.strictEqual(round.version, 1);
assert.strictEqual(round.items.find((item) => item.id === "hl-hobbes").text, quote);

const store = memory();
assert.strictEqual(reader.save(store, state).ok, true);
const loaded = reader.load(store);
assert.strictEqual(loaded.available, true);
assert.strictEqual(loaded.state.items.find((item) => item.id === "hl-hobbes").text, quote);
assert.strictEqual(loaded.state.items.find((item) => item.id === "hl-modern").kind, "paraphrase");

assert.strictEqual(reader.load(null).available, false);
assert.strictEqual(reader.load({ getItem() { throw new Error("blocked"); } }).error, "unavailable");
assert.strictEqual(reader.save({ setItem() { throw new Error("full"); } }, state).ok, false);
assert.strictEqual(reader.load(memory({ "athenaeum.reader": "{not json" })).error, "unreadable");
const future = memory({ "athenaeum.reader": JSON.stringify({ version: 2, items: [{ id: "x", text: "kept" }] }) });
const blocked = reader.load(future);
assert.strictEqual(blocked.blocked, true);
assert.strictEqual(blocked.state.items.length, 0);
assert.strictEqual(future.getItem("athenaeum.reader").indexOf("kept") >= 0, true);

const imported = reader.importLibrary(reader.emptyState(), json);
assert.strictEqual(imported.added.items, 3);
assert.strictEqual(imported.state.items.find((item) => item.id === "hl-hobbes").text, quote);
const again = reader.importLibrary(imported.state, json);
assert.strictEqual(again.added.items, 0);
assert.strictEqual(again.state.items.length, 3);
assert.strictEqual(reader.importLibrary(state, "{\"version\":9}").error, "version");
assert.strictEqual(reader.importLibrary(state, "nope").error, "unreadable");
assert.strictEqual(reader.addItem(state, { text: "x", href: "javascript:alert(1)" }).item.href, "");

const located = reader.locate("before " + quote + " after", quote, 0);
assert.strictEqual(located.start, 7);
assert.strictEqual(("before " + quote + " after").slice(located.start, located.end), quote);

const html = reader.libraryHtml(reader.addItem(reader.emptyState(), {
  id: "hl-script",
  text: "<script>alert(1)</script>",
  kind: "verbatim",
  speaker: "<b>Hobbes</b>",
  href: "javascript:alert(1)"
}).state, "");
assert.ok(html.indexOf("&lt;script&gt;alert(1)&lt;/script&gt;") >= 0);
assert.ok(!/<script/i.test(html));
assert.ok(html.indexOf("javascript:") < 0);
assert.ok(html.indexOf("Save quote") < 0);
assert.ok(html.indexOf("Verbatim quotation") >= 0);
assert.ok(html.indexOf("Remove") >= 0);
assert.ok(/min-height:\s*44px/.test(fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8")));
assert.ok(/\.reader-swatch\s*\{[^}]*min-height:\s*44px/.test(fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8")));
assert.ok(/button\s*\{[^}]*min-height:\s*44px/.test(fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8")));

["index.html", "docket.html", "archive.html", "saved.html", "thinkers.html"].forEach((name) => {
  const page = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
  assert.ok(page.indexOf('href="saved.html"') >= 0, name);
});
assert.ok(fs.readFileSync(path.join(__dirname, "../index.html"), "utf8").indexOf('src="reader-ui.js"') >= 0);
assert.ok(fs.readFileSync(path.join(__dirname, "../docket.html"), "utf8").indexOf('src="reader-ui.js"') >= 0);

["reader.js", "reader-ui.js", "reader-page.js", "saved.html", "app.js", "docket-page.js", "index.html", "docket.html", "archive.html", "styles.css", "README.md", "thinkers.html", "thinkers.js", "thinkers-page.js"].forEach((name) => {
  const source = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
  assert.ok(source.indexOf(word) < 0, name);
});

const span = reader.locate("alpha beta alpha", "alpha", 1);
assert.strictEqual(span.start, 11);
