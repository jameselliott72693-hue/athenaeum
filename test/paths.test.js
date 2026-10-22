const assert = require("assert");
const fs = require("fs");
const paths = require("../paths.js");
const catalog = JSON.parse(fs.readFileSync("data/paths.json", "utf8"));

function memory() {
  const box = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(box, key) ? box[key] : null),
    setItem: (key, value) => { box[key] = String(value); }
  };
}

const indexes = {};
function indexOf(id) {
  if (!indexes[id]) indexes[id] = JSON.parse(fs.readFileSync(`data/books/index/${id}.json`, "utf8"));
  return indexes[id];
}

catalog.paths.forEach((path) => {
  assert.ok(path.stops.length >= 4, path.id);
  path.stops.forEach((stop) => {
    const text = fs.readFileSync(stop.textFile, "utf8");
    const paragraph = paths.paragraphContaining(text, stop.needle);
    assert.ok(paragraph, stop.id + " missing");
    assert.ok(paragraph.indexOf(stop.needle) !== -1);
    assert.ok(!paragraph.startsWith("A summary"), stop.id);
    const index = indexOf(stop.thinkerId);
    const hit = index.passages.find((passage) => {
      const book = index.books[passage.book];
      return book.file === stop.textFile && text.slice(passage.start, passage.end) === paragraph;
    });
    assert.ok(hit, stop.id + " is not an indexed passage");
    assert.strictEqual(hit.loc, stop.loc, stop.id);
    const book = index.books[hit.book];
    assert.strictEqual(book.title, stop.work);
    assert.strictEqual(book.url, stop.url);
    assert.ok(stop.ask.length >= 8 && stop.ask.length <= 180);
    assert.ok(!stop.guide.includes(stop.needle), stop.id + " guide repeats the quotation");
  });
});

assert.strictEqual(paths.paragraphContaining("alpha\n\nbeta needle\n\ngamma", "needle"), "beta needle");
assert.strictEqual(paths.paragraphContaining("alpha", "missing"), null);
assert.strictEqual(paths.pathForTable(catalog, "ancient").id, "ancient-city");
assert.strictEqual(paths.pathForTable(catalog, "letters"), null);

const store = memory();
assert.deepStrictEqual(paths.loadProgress(store), { read: {}, current: {} });
let progress = paths.markRead({ read: {}, current: {} }, "ancient-city", "plato-justice");
paths.saveProgress(store, progress);
progress = paths.loadProgress(store);
assert.strictEqual(paths.isRead(progress, "ancient-city", "plato-justice"), true);
assert.strictEqual(paths.isRead(progress, "ancient-city", "aristotle-city"), false);
assert.strictEqual(progress.current["ancient-city"], "plato-justice");
store.setItem(paths.KEY, "{");
assert.deepStrictEqual(paths.loadProgress(store), { read: {}, current: {} });

console.log("paths", catalog.paths.length, "stops", catalog.paths.reduce((n, path) => n + path.stops.length, 0));
console.log("paths tests passed");
