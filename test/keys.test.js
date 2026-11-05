const assert = require("assert");
const fs = require("fs");
const path = require("path");
const keys = require("../keys.js");

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    dump() { return data; }
  };
}

function node(tag, extra) {
  return Object.assign({
    tagName: tag,
    isContentEditable: false,
    parentElement: null,
    getAttribute(name) { return this.attrs && Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  }, extra || {});
}

assert.strictEqual(keys.SPACE_TURN_KEY, "athenaeum.spaceTurn");
assert.strictEqual(keys.readSpaceTurn(null), false);
assert.strictEqual(keys.readSpaceTurn({}), false);
assert.strictEqual(keys.readSpaceTurn(memory()), false);
assert.strictEqual(keys.readSpaceTurn(memory({ "athenaeum.spaceTurn": "0" })), false);
assert.strictEqual(keys.readSpaceTurn(memory({ "athenaeum.spaceTurn": "true" })), false);
assert.strictEqual(keys.readSpaceTurn(memory({ "athenaeum.spaceTurn": "1" })), true);
assert.strictEqual(keys.readSpaceTurn({ getItem() { throw new Error("blocked"); } }), false);

const store = memory();
assert.strictEqual(keys.writeSpaceTurn(store, true), true);
assert.strictEqual(store.dump()["athenaeum.spaceTurn"], "1");
assert.strictEqual(keys.readSpaceTurn(store), true);
assert.strictEqual(keys.writeSpaceTurn(store, false), true);
assert.strictEqual(keys.readSpaceTurn(store), false);
assert.strictEqual(keys.writeSpaceTurn(null, true), false);
assert.strictEqual(keys.writeSpaceTurn({ setItem() { throw new Error("full"); } }, true), false);

assert.strictEqual(keys.isSpaceEvent(null), false);
assert.strictEqual(keys.isSpaceEvent({ key: " " }), true);
assert.strictEqual(keys.isSpaceEvent({ key: "Spacebar" }), true);
assert.strictEqual(keys.isSpaceEvent({ key: "Unidentified", code: "Space" }), true);
assert.strictEqual(keys.isSpaceEvent({ key: "n", code: "KeyN" }), false);
assert.strictEqual(keys.isSpaceEvent({ key: "n", code: "Space" }), false);

const space = { key: " " };
assert.strictEqual(keys.spaceShouldAdvance(space, { enabled: false }), false);
assert.strictEqual(keys.spaceShouldAdvance(space, { enabled: true }), true);
assert.strictEqual(keys.spaceShouldAdvance({ key: "n" }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", metaKey: true }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", ctrlKey: true }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", altKey: true }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", shiftKey: true }, { enabled: true }), true);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", defaultPrevented: true }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", isComposing: true }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", keyCode: 229 }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance(space, { enabled: true, dialogOpen: true }), false);

const field = node("INPUT");
const typed = node("DIV", { parentElement: field });
assert.strictEqual(keys.isTypingTarget(field), true);
assert.strictEqual(keys.isTypingTarget(typed), true);
assert.strictEqual(keys.isTypingTarget(node("TEXTAREA")), true);
assert.strictEqual(keys.isTypingTarget(node("SELECT")), true);
assert.strictEqual(keys.isTypingTarget(node("BUTTON")), true);
assert.strictEqual(keys.isTypingTarget(node("A")), true);
assert.strictEqual(keys.isTypingTarget(node("SUMMARY")), true);
assert.strictEqual(keys.isTypingTarget(node("DIV", { attrs: { role: "textbox" } })), true);
assert.strictEqual(keys.isTypingTarget(node("DIV", { isContentEditable: true })), true);
assert.strictEqual(keys.isTypingTarget(node("DIV", { attrs: { contenteditable: "true" } })), true);
assert.strictEqual(keys.isTypingTarget(node("DIV", { attrs: { contenteditable: "" } })), true);
assert.strictEqual(keys.isTypingTarget(node("DIV", { attrs: { contenteditable: "false" } })), false);
assert.strictEqual(keys.isTypingTarget(node("DIV")), false);
assert.strictEqual(keys.isTypingTarget(null), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", target: field }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", target: node("DIV", { isContentEditable: true }) }, { enabled: true }), false);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", target: node("P") }, { enabled: true }), true);

const dialog = node("DIALOG");
const inside = node("P", { parentElement: dialog });
assert.strictEqual(keys.isInOverlay(inside), true);
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", target: inside }, { enabled: true }), false);
const modal = node("DIV", { attrs: { "aria-modal": "true" } });
assert.strictEqual(keys.spaceShouldAdvance({ key: " ", target: node("P", { parentElement: modal }) }, { enabled: true }), false);
assert.strictEqual(keys.overlayOpen(null), false);
assert.strictEqual(keys.overlayOpen({ querySelector() { return null; } }), false);
assert.strictEqual(keys.overlayOpen({ querySelector() { return {}; } }), true);
assert.strictEqual(keys.overlayOpen({ querySelector() { throw new Error("no document"); } }), false);

const view = { top: 0, bottom: 800 };
const first = { id: "p1", top: 0, bottom: 520, hiddenCount: 4 };
const second = { id: "p2", top: 520, bottom: 1100, hiddenCount: 3 };
assert.deepStrictEqual(keys.chooseSitting([first, second], view), { id: "p1", advance: true });
assert.deepStrictEqual(keys.chooseSitting([
  { id: "p1", top: -400, bottom: 40, hiddenCount: 1 },
  { id: "p2", top: 40, bottom: 700, hiddenCount: 2 }
], view), { id: "p2", advance: true });
assert.strictEqual(keys.chooseSitting([
  { id: "p1", top: 900, bottom: 1400, hiddenCount: 2 }
], view), null);
assert.strictEqual(keys.chooseSitting([
  { id: "p1", top: 700, bottom: 1500, hiddenCount: 2 }
], view), null);
assert.deepStrictEqual(keys.chooseSitting([
  { id: "p1", top: 900, bottom: 1400, hiddenCount: 2, focused: true }
], view), { id: "p1", advance: true });
assert.deepStrictEqual(keys.chooseSitting([
  { id: "p1", top: 0, bottom: 800, hiddenCount: 0 },
  { id: "p2", top: 800, bottom: 1600, hiddenCount: 3 }
], view), { id: "p1", advance: false });
assert.strictEqual(keys.chooseSitting([], view), null);
assert.strictEqual(keys.chooseSitting(null, view), null);
assert.deepStrictEqual(keys.chooseSitting([
  { id: "later", top: 100, bottom: 400, hiddenCount: 1 },
  { id: "earlier", top: 0, bottom: 90, hiddenCount: 2 }
], view), { id: "earlier", advance: true });

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const docket = fs.readFileSync(path.join(root, "docket.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const docketPage = fs.readFileSync(path.join(root, "docket-page.js"), "utf8");

function hasUncheckedOption(html) {
  assert.ok(html.includes("Space advances to the next turn"));
  assert.ok(html.includes('id="space-turn"'));
  assert.ok(!/id="space-turn"[^>]*\schecked/.test(html));
}

hasUncheckedOption(index);
hasUncheckedOption(docket);
assert.ok(index.indexOf('src="keys.js"') < index.indexOf('src="app.js"'));
assert.ok(docket.indexOf('src="keys.js"') < docket.indexOf('src="docket-page.js"'));
assert.ok(app.includes("readSpaceTurn"));
assert.ok(app.includes("spaceShouldAdvance"));
assert.ok(app.includes("writeSpaceTurn"));
assert.ok(docketPage.includes("readSpaceTurn"));
assert.ok(docketPage.includes("spaceShouldAdvance"));
assert.ok(docketPage.includes("chooseSitting"));
assert.ok(docketPage.includes("data-docket-next"));
