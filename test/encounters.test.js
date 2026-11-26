const assert = require("assert");
const fs = require("fs");
const path = require("path");
const enc = require("../encounters.js");

function hiddenWord() {
  return String.fromCharCode(71, 114, 101, 101, 110, 115, 98, 111, 114, 111);
}

const root = path.join(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "data/encounters.json"), "utf8"));
const map = JSON.parse(fs.readFileSync(path.join(root, "data/encounter-map.json"), "utf8"));
const catalog = enc.normalizeCatalog(raw);

assert.strictEqual(raw.version, 1);
assert.strictEqual(catalog.version, 1);
assert.strictEqual(catalog.works.length, raw.works.length);
assert.ok(catalog.works.length >= 100);

const required = ["id", "type", "title", "creator", "year", "why", "themes", "url"];
catalog.works.forEach((work) => {
  required.forEach((key) => {
    assert.ok(work[key] !== undefined && work[key] !== "", `${work.id} missing ${key}`);
  });
  assert.ok(enc.TYPES.indexOf(work.type) >= 0, work.id);
  assert.ok(Number.isInteger(work.year) && work.year > 0 && work.year < 2100, work.id);
  assert.ok(Array.isArray(work.themes) && work.themes.length >= 1 && work.themes.length <= 4, work.id);
  work.themes.forEach((id) => assert.ok(enc.THEME_IDS.indexOf(id) >= 0, work.id + " " + id));
  assert.ok(/^https?:\/\//.test(work.url), work.id);
  assert.ok(!Object.prototype.hasOwnProperty.call(work, "lyrics"), work.id);
  assert.ok(!Object.prototype.hasOwnProperty.call(work, "lyric"), work.id);
  assert.ok(!/["“”]/.test(work.why), work.id + " why has quotation marks");
  assert.ok(work.why.length >= 40 && work.why.length <= 420, work.id + " why length");
  if (work.type !== "poem") {
    assert.ok(!Object.prototype.hasOwnProperty.call(work, "text"), work.id);
    assert.ok(!Object.prototype.hasOwnProperty.call(work, "publicDomain"), work.id);
  }
  if (work.text) {
    assert.strictEqual(work.type, "poem", work.id);
    assert.strictEqual(work.publicDomain, true, work.id);
    assert.ok(/^https?:\/\//.test(work.sourceUrl), work.id);
    assert.ok(work.year < 1930, work.id);
    assert.ok(work.text.length > 40, work.id);
  }
  if (work.rating) assert.strictEqual(work.type, "film", work.id);
});

const withText = catalog.works.filter((work) => work.text);
assert.ok(withText.length >= 3, "public-domain poems with text");

enc.THEME_IDS.forEach((id) => {
  const rows = catalog.works.filter((work) => work.themes.indexOf(id) >= 0);
  assert.ok(rows.length >= 8, id + " needs 8 works, has " + rows.length);
  enc.TYPES.forEach((type) => {
    assert.ok(rows.some((work) => work.type === type), id + " missing " + type);
  });
});

const files = fs.readdirSync(path.join(root, "docket")).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
let sittings = 0;
files.forEach((name) => {
  const night = JSON.parse(fs.readFileSync(path.join(root, "docket", name), "utf8"));
  (night.sittings || []).forEach((sitting) => {
    sittings += 1;
    const key = night.date + "/" + sitting.id;
    if (Array.isArray(sitting.themes)) {
      assert.ok(sitting.themes.length >= 1 && sitting.themes.length <= 3, key);
      sitting.themes.forEach((id) => assert.ok(enc.THEME_IDS.indexOf(id) >= 0, key));
      const resolved = enc.themesForSitting(sitting, night.date, map);
      assert.deepStrictEqual(resolved, sitting.themes, key);
    } else {
      const tags = map.sittings[key];
      assert.ok(Array.isArray(tags) && tags.length >= 1 && tags.length <= 3, key);
      tags.forEach((id) => assert.ok(enc.THEME_IDS.indexOf(id) >= 0, key));
      const resolved = enc.themesForSitting(sitting, night.date, map);
      assert.deepStrictEqual(resolved, tags, key);
    }
  });
});
assert.strictEqual(sittings, 269);
assert.deepStrictEqual(enc.themesForSitting({ id: "x", question: "zzzz" }, "1999-01-01", { sittings: {} }), []);
assert.deepStrictEqual(enc.themesForSitting({ id: "p1", themes: ["mercy", "justice", "nope"] }, "1999-01-01", map), ["mercy", "justice"]);

const sample = catalog.works.find((work) => work.id === "poem-adlestrop");
const card = enc.cardHtml(sample);
assert.ok(card.indexOf("Read the poem") >= 0);
assert.ok(card.indexOf(sample.text.split("\n")[0]) >= 0);
assert.ok(card.indexOf('rel="noopener noreferrer"') >= 0);
const html = enc.panelHtml({
  themes: ["exile"],
  catalog,
  scope: "test",
  limit: 3,
  context: { night: "2026-11-17", sittingId: "p1", sittingTitle: "Home", place: "docket.html?night=2026-11-17#sitting-p1" }
});
assert.ok(html.indexOf("Further encounters") >= 0);
assert.ok(html.indexOf('role="tab"') >= 0);
assert.ok(html.indexOf('rel="noopener noreferrer"') >= 0);
assert.ok(html.indexOf("target=\"_blank\"") >= 0);
assert.ok(!/<script/i.test(html));
assert.ok(html.indexOf("lyrics") < 0);

const payload = enc.savePayload(catalog.works.find((work) => work.type === "film"), {
  night: "2026-11-17",
  sittingId: "p1",
  sittingTitle: "A question",
  place: "docket.html?night=2026-11-17#sitting-p1"
});
assert.ok(["film", "song", "poem"].indexOf(payload.kind) >= 0);
assert.strictEqual(payload.kind, "film");
assert.ok(payload.block.indexOf("encounter:") === 0);
assert.ok(payload.href.indexOf("encounters.html#work-") === 0);

const word = hiddenWord();
["encounters.js", "encounters-ui.js", "encounters-page.js", "encounters.html", "data/encounters.json", "data/encounter-map.json", "build_sittings.md"].forEach((name) => {
  const source = fs.readFileSync(path.join(root, name), "utf8");
  assert.ok(source.indexOf(word) < 0, name);
});

const guide = fs.readFileSync(path.join(root, "build_sittings.md"), "utf8");
assert.ok(guide.indexOf("Week of <Monday> to <Sunday>") >= 0);
assert.ok(guide.indexOf('"themes"') >= 0);
["index.html", "docket.html", "archive.html", "saved.html", "encounters.html", "thinkers.html"].forEach((name) => {
  const page = fs.readFileSync(path.join(root, name), "utf8");
  assert.ok(page.indexOf('href="encounters.html"') >= 0, name);
});

const replaced = {
  "song-young": "https://en.wikipedia.org/wiki/To_Be_Young,_Gifted_and_Black",
  "poem-slumber": "https://en.wikipedia.org/wiki/A_slumber_did_my_spirit_seal",
  "poem-fears": "https://en.wikipedia.org/wiki/When_I_Have_Fears",
  "poem-house": "https://en.wikipedia.org/wiki/Verses_upon_the_Burning_of_Our_House",
  "poem-wheatley": "https://en.wikipedia.org/wiki/Poems_on_Various_Subjects,_Religious_and_Moral#%22On_Being_Brought_from_Africa_to_America%22"
};
Object.keys(replaced).forEach((id) => {
  const work = catalog.works.find((row) => row.id === id);
  assert.ok(work, id);
  assert.strictEqual(work.url, replaced[id]);
});
[
  "https://en.wikipedia.org/wiki/To_Be_Young,_Gifted_and_Black_(song)",
  "https://en.wikipedia.org/wiki/A_Slumber_Did_My_Spirit_Seal",
  "https://en.wikipedia.org/wiki/When_I_Have_Fears_That_I_May_Cease_to_Be",
  "https://en.wikipedia.org/wiki/Here_Follows_Some_Verses_upon_the_Burning_of_Our_House",
  "https://en.wikipedia.org/wiki/On_Being_Brought_from_Africa_to_America"
].forEach((url) => {
  assert.ok(!raw.works.some((work) => work.url === url), url);
});
