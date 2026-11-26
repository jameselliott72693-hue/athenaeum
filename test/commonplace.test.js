const assert = require("assert");
const fs = require("fs");
const path = require("path");
const reader = require("../reader.js");

function hiddenWord() {
  return String.fromCharCode(71, 114, 101, 101, 110, 115, 98, 111, 114, 111);
}

const quote = "  The RIGHT OF NATURE, “as he will himselfe.”";
const paraphrase = "Hobbes says people give up the private use of force.";
const filmNote = "A room note about a film.";
const loose = "A highlighted sentence from the sitting.";

function library() {
  let state = reader.emptyState();
  state = reader.createFolder(state, { id: "folder-law", name: "Public law", emoji: "⚖", color: "sky" }).state;
  state = reader.addItem(state, {
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
    href: "docket.html?night=2026-11-17#saved-hl-hobbes",
    place: "docket.html?night=2026-11-17#sitting-p1",
    note: "Keep the sword line.",
    folderId: "folder-law",
    savedAt: "2026-11-20T05:00:00.000Z"
  }).state;
  state = reader.addItem(state, {
    id: "hl-modern",
    text: paraphrase,
    kind: "paraphrase",
    speaker: "Thomas Hobbes",
    night: "2026-11-17",
    sittingTitle: "Liberty versus order",
    folderId: "folder-law",
    savedAt: "2026-11-20T06:00:00.000Z"
  }).state;
  state = reader.addItem(state, {
    id: "hl-film",
    text: filmNote,
    kind: "film",
    speaker: "Ingmar Bergman",
    work: "The Seventh Seal",
    citation: "1957",
    sourceUrl: "https://example.com/seal",
    href: "encounters.html#work-seventh-seal",
    folderId: "unsorted",
    savedAt: "2026-11-19T00:00:00.000Z"
  }).state;
  state = reader.addItem(state, {
    id: "hl-loose",
    text: loose,
    kind: "passage",
    folderId: "unsorted",
    savedAt: "2026-11-18T00:00:00.000Z"
  }).state;
  state = reader.orderIds(state, "folder", ["folder-law", "unsorted"]).state;
  return state;
}

function part(markdown, heading) {
  const chunks = markdown.split("\n### ");
  return chunks.find((chunk) => chunk.indexOf(heading) === 0) || "";
}

const state = library();
const byFolder = reader.commonplaceBook(state, { groupBy: "folder", title: "Night notes", epigraph: "Read slowly." });
assert.strictEqual(byFolder.title, "Night notes");
assert.strictEqual(byFolder.epigraph, "Read slowly.");
assert.strictEqual(byFolder.groupBy, "folder");
assert.strictEqual(byFolder.count, 4);
assert.strictEqual(byFolder.message, "");
assert.deepStrictEqual(byFolder.sections.map((section) => section.title), ["⚖ Public law", "Unsorted"]);
const kept = byFolder.sections[0].entries.find((entry) => entry.item.id === "hl-hobbes");
assert.strictEqual(kept.item.text, quote);
assert.ok(byFolder.sections[0].entries.every((entry) => entry.item.folderId === "folder-law"));
assert.ok(byFolder.sections[1].entries.some((entry) => entry.item.id === "hl-film"));

const byThinker = reader.commonplaceBook(state, { groupBy: "thinker" });
assert.deepStrictEqual(byThinker.sections.map((section) => section.title), ["Ingmar Bergman", "Thomas Hobbes", "Without a named thinker"]);
const hobbes = byThinker.sections.find((section) => section.title === "Thomas Hobbes");
assert.deepStrictEqual(hobbes.entries.map((entry) => entry.item.id).sort(), ["hl-hobbes", "hl-modern"]);
assert.strictEqual(byThinker.sections[2].entries[0].item.id, "hl-loose");

const bySource = reader.commonplaceBook(state, { groupBy: "source" });
assert.deepStrictEqual(bySource.sections.map((section) => section.title), [
  "Leviathan",
  "Liberty versus order",
  "Further encounters · Film",
  "Without a named source"
]);
assert.ok(!bySource.sections.some((section) => section.title === "The Seventh Seal"));
assert.deepStrictEqual(
  reader.commonplaceBook(state, { groupBy: "theme" }).sections.map((section) => section.id),
  bySource.sections.map((section) => section.id)
);
assert.strictEqual(reader.commonplaceBook(state, { groupBy: "nope" }).groupBy, "folder");

const onlyLaw = reader.commonplaceBook(state, { scope: "folders", folderIds: ["folder-law", "folder-law"], groupBy: "folder" });
assert.strictEqual(onlyLaw.count, 2);
assert.strictEqual(onlyLaw.sections.length, 1);
assert.ok(onlyLaw.sections[0].entries.every((entry) => entry.folder.id === "folder-law"));
const lawMarkdown = reader.commonplaceMarkdown(state, { scope: "folders", folderIds: ["folder-law"] });
assert.ok(lawMarkdown.indexOf(quote) >= 0);
assert.ok(lawMarkdown.indexOf(filmNote) < 0);
assert.ok(lawMarkdown.indexOf("The Seventh Seal") < 0);

const choose = reader.commonplaceBook(state, { scope: "folders", folderIds: [] });
assert.strictEqual(choose.emptyReason, "choose");
assert.strictEqual(choose.count, 0);
assert.strictEqual(choose.sections.length, 0);
assert.ok(reader.commonplaceMarkdown(state, { scope: "folders" }).indexOf("Choose at least one folder.") >= 0);
assert.ok(reader.commonplaceHtml(state, { scope: "folders", folderIds: ["missing-folder"] }).indexOf("Nothing is saved in the folders you chose.") >= 0);

const emptyMarkdown = reader.commonplaceMarkdown(reader.emptyState(), { title: "  ", epigraph: "   " });
assert.ok(emptyMarkdown.indexOf("# Commonplace Book") === 0);
assert.ok(emptyMarkdown.indexOf("Nothing is saved in this browser yet.") >= 0);
assert.ok(emptyMarkdown.indexOf("## ") < 0);
const emptyHtml = reader.commonplaceHtml(reader.emptyState(), {});
assert.ok(emptyHtml.indexOf("Nothing is saved in this browser yet.") >= 0);
assert.ok(emptyHtml.indexOf("<blockquote") < 0);
assert.ok(emptyHtml.indexOf(quote) < 0);
assert.ok(emptyHtml.indexOf("is-empty") >= 0);

const markdown = reader.commonplaceMarkdown(state, { title: "Night notes", epigraph: "Read slowly.\nThen again." });
assert.ok(markdown.startsWith("# Night notes\n\n> Read slowly.\n> Then again.\n"));
assert.ok(markdown.indexOf("[⚖ Public law](#cb-public-law)") >= 0);
assert.ok(markdown.indexOf('<a id="cb-public-law"></a>') >= 0);
assert.ok(markdown.indexOf("## ⚖ Public law") >= 0);
assert.ok(markdown.indexOf("## Unsorted") > markdown.indexOf("## ⚖ Public law"));
assert.ok(markdown.indexOf("Grouped by bookmark folder.") >= 0);
assert.ok(markdown.indexOf("4 passages saved in this browser.") >= 0);
const verbatim = part(markdown, "Verbatim quotation");
assert.ok(verbatim.indexOf(">   The RIGHT OF NATURE, “as he will himselfe.”") >= 0);
assert.ok(verbatim.indexOf("Thomas Hobbes") >= 0);
assert.ok(verbatim.indexOf("Leviathan, Leviathan, Part I, ch. XIV") >= 0);
assert.ok(verbatim.indexOf("[Open the source](https://www.gutenberg.org/ebooks/3207)") >= 0);
assert.ok(verbatim.indexOf("Edition: 1651; Project Gutenberg ebook 3207") >= 0);
assert.ok(verbatim.indexOf("Night: 2026-11-17") >= 0);
assert.ok(verbatim.indexOf("Sitting: Liberty versus order") >= 0);
assert.ok(verbatim.indexOf("[Open this spot](docket.html?night=2026-11-17#saved-hl-hobbes)") >= 0);
assert.ok(verbatim.indexOf("[Open the sitting](docket.html?night=2026-11-17#sitting-p1)") >= 0);
assert.ok(verbatim.indexOf("Note: Keep the sword line.") >= 0);
const paraphrasePart = part(markdown, "Paraphrase");
assert.ok(paraphrasePart.indexOf("Labeled paraphrase, not a quotation.") >= 0);
assert.ok(paraphrasePart.indexOf(paraphrase) >= 0);
assert.ok(paraphrasePart.indexOf("\n> ") < 0);
const filmPart = part(markdown, "Film");
assert.ok(filmPart.indexOf("The room's note, not a quotation.") >= 0);
assert.ok(filmPart.indexOf(filmNote) >= 0);
assert.ok(filmPart.indexOf("\n> ") < 0);
assert.ok(filmPart.indexOf("[Open the source](https://example.com/seal)") >= 0);

const themed = reader.commonplaceMarkdown(state, { groupBy: "thinker" });
assert.ok(themed.indexOf("## Ingmar Bergman") < themed.indexOf("## Thomas Hobbes"));
assert.ok(themed.indexOf("## Thomas Hobbes") < themed.indexOf("## Without a named thinker"));
assert.ok(themed.indexOf("Folder: Public law") >= 0);

let odd = reader.createFolder(reader.emptyState(), { id: "folder-odd", name: "Law\n## Injected" }).state;
odd = reader.addItem(odd, { id: "hl-1", text: "One saved line.", kind: "verbatim", folderId: "folder-odd" }).state;
const oddMarkdown = reader.commonplaceMarkdown(odd, { groupBy: "folder" });
assert.ok(oddMarkdown.indexOf("## Law ## Injected") >= 0);
assert.ok(oddMarkdown.indexOf("\n## Injected") < 0);
assert.strictEqual((oddMarkdown.match(/^## /gm) || []).length, 2);

const word = hiddenWord();
const stripped = reader.commonplaceMarkdown(state, { title: "Notes from " + word, epigraph: "A line " + word + " here" });
assert.ok(stripped.indexOf(word) < 0);
assert.ok(stripped.indexOf("# Notes from") === 0);
assert.ok(stripped.indexOf(quote) >= 0);
assert.strictEqual(reader.commonplaceFilename("My Book", "md"), "my-book.md");
assert.strictEqual(reader.commonplaceFilename("###", "html"), "commonplace-book.html");
assert.ok(reader.commonplaceFilename(word + " Notes", "md").indexOf(word) < 0);
const long = reader.commonplaceBook(reader.emptyState(), { title: "A".repeat(200), epigraph: "B".repeat(800) });
assert.strictEqual(long.title.length, 120);
assert.strictEqual(long.epigraph.length, 500);

const nasty = reader.commonplaceHtml({
  version: 1,
  folders: [
    { id: "unsorted", name: "Unsorted" },
    { id: "folder-x", name: "<script>folder</script>" }
  ],
  items: [{
    id: "hl-nasty",
    text: "<script>alert(1)</script>",
    kind: "verbatim",
    speaker: "<b>Hobbes</b>",
    work: "A \"work\"",
    note: "<img src=x onerror=alert(1)>",
    href: "javascript:alert(1)",
    sourceUrl: "javascript:alert(1)",
    folderId: "folder-x",
    savedAt: "2026-11-20T00:00:00.000Z"
  }]
}, { title: "<script>title</script>", epigraph: "<b>epi</b>" });
assert.ok(nasty.indexOf("&lt;script&gt;alert(1)&lt;/script&gt;") >= 0);
assert.ok(nasty.indexOf("&lt;script&gt;title&lt;/script&gt;") >= 0);
assert.ok(nasty.indexOf("&lt;b&gt;epi&lt;/b&gt;") >= 0);
assert.ok(nasty.indexOf("&lt;b&gt;Hobbes&lt;/b&gt;") >= 0);
assert.ok(nasty.indexOf("&lt;script&gt;folder&lt;/script&gt;") >= 0);
assert.ok(nasty.indexOf("&lt;img") >= 0);
assert.ok(!/<script/i.test(nasty));
assert.ok(!/<img/i.test(nasty));
assert.ok(nasty.indexOf("javascript:") < 0);
assert.ok(nasty.indexOf("<blockquote class=\"commonplace-quote\">&lt;script&gt;alert(1)&lt;/script&gt;</blockquote>") >= 0);

const html = reader.commonplaceHtml(state, { title: "Night notes", epigraph: "Read slowly." });
assert.ok(html.indexOf('<h2 class="commonplace-title">Night notes</h2>') >= 0);
assert.ok(html.indexOf('<blockquote class="commonplace-quote">' + quote + "</blockquote>") >= 0);
assert.ok(html.indexOf('<p class="commonplace-prose">' + paraphrase + "</p>") >= 0);
assert.ok(html.indexOf('<p class="commonplace-prose">' + filmNote + "</p>") >= 0);
assert.ok(html.indexOf("Labeled paraphrase, not a quotation.") >= 0);
assert.ok(html.indexOf("The room's note, not a quotation.") >= 0);
assert.ok(html.indexOf('href="https://www.gutenberg.org/ebooks/3207"') >= 0);
assert.ok(html.indexOf('href="docket.html?night=2026-11-17#saved-hl-hobbes"') >= 0);
assert.ok(html.indexOf('href="#cb-public-law"') >= 0);
assert.ok(html.indexOf('id="cb-public-law"') >= 0);
assert.strictEqual((html.match(/<blockquote/g) || []).length, 2);
assert.ok(!/<script/i.test(html));

const doc = reader.commonplaceDocument(state, {
  title: "Night notes",
  baseUrl: "https://example.test/athenaeum/"
});
assert.ok(doc.startsWith("<!DOCTYPE html>"));
assert.ok(doc.indexOf("<title>Night notes</title>") >= 0);
assert.ok(doc.indexOf('<h1 class="commonplace-title">Night notes</h1>') >= 0);
assert.ok(doc.indexOf("@media print") >= 0);
assert.ok(doc.indexOf("https://example.test/athenaeum/docket.html?night=2026-11-17#saved-hl-hobbes") >= 0);
assert.ok(doc.indexOf("https://www.gutenberg.org/ebooks/3207") >= 0);
assert.ok(!/<script/i.test(doc));
const rejected = reader.commonplaceDocument(state, { baseUrl: "javascript:alert(1)" });
assert.ok(rejected.indexOf("javascript:") < 0);
assert.ok(rejected.indexOf('href="docket.html?night=2026-11-17#saved-hl-hobbes"') >= 0);

const fields = reader.commonplaceFolderFields(
  reader.createFolder(reader.emptyState(), { id: "folder-x", name: '"><script>alert(1)</script>' }).state,
  ["folder-x"]
);
assert.ok(fields.indexOf("&lt;script&gt;alert(1)&lt;/script&gt;") >= 0);
assert.ok(fields.indexOf('value="folder-x"') >= 0);
assert.ok(fields.indexOf(" checked") >= 0);
assert.ok(!/<script/i.test(fields));
assert.ok(reader.commonplaceFolderFields(state, []).indexOf("Public law") >= 0);
assert.ok(reader.commonplaceFolderFields(state, []).indexOf("2 passages") >= 0);

const page = fs.readFileSync(path.join(__dirname, "../saved.html"), "utf8");
["commonplace-form", "commonplace-preview", "commonplace-print", "commonplace-html", "commonplace-md", "commonplace-title", "commonplace-epigraph", "reader-commonplace"].forEach((id) => {
  assert.ok(page.indexOf('id="' + id + '"') >= 0, id);
});
assert.ok(page.indexOf('name="commonplace-scope"') >= 0);
assert.ok(page.indexOf('name="commonplace-group"') >= 0);
assert.ok(page.indexOf('value="thinker"') >= 0);
assert.ok(page.indexOf('value="source"') >= 0);
const css = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
assert.ok(css.indexOf(".commonplace-book") >= 0);
assert.ok(css.indexOf("commonplace-printing") >= 0);
assert.ok(/\.commonplace-controls \.check\s*\{[^}]*min-height:\s*44px/.test(css));
assert.ok(/\.commonplace-folders\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css));
assert.ok(fs.readFileSync(path.join(__dirname, "../reader-page.js"), "utf8").indexOf("commonplaceDocument") >= 0);
assert.ok(fs.readFileSync(path.join(__dirname, "../README.md"), "utf8").indexOf("commonplace book") >= 0);

["reader.js", "reader-page.js", "saved.html", "styles.css", "README.md", "test/commonplace.test.js"].forEach((name) => {
  const source = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
  assert.ok(source.indexOf(word) < 0, name);
});
