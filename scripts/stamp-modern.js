const fs = require("fs");
const path = require("path");
const Modern = require("../modern.js");

const dir = path.join(__dirname, "../data/thinkers");

function entrySpans(text) {
  const key = text.indexOf('"entries"');
  if (key < 0) throw new Error("no entries");
  const bracket = text.indexOf("[", key);
  const spans = [];
  let depth = 0;
  let inStr = false;
  let escaped = false;
  let objStart = -1;
  for (let i = bracket + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        spans.push([objStart, i]);
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) break;
  }
  return spans;
}

let files = 0;
let stamped = 0;
fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort().forEach((name) => {
  const file = path.join(dir, name);
  const original = fs.readFileSync(file, "utf8").replace(/,\n      "modern": "(?:[^"\\]|\\.)*"/g, "");
  const data = JSON.parse(original);
  const spans = entrySpans(original);
  if (spans.length !== (data.entries || []).length) {
    throw new Error(`${name}: found ${spans.length} objects, expected ${(data.entries || []).length} entries`);
  }
  const inserts = [];
  (data.entries || []).forEach((entry, index) => {
    const modern = Modern.compose(entry.claim, entry.bears);
    if (!modern) throw new Error(`${name} entry ${index} produced an empty modern read`);
    if (/[“”"]/.test(modern)) throw new Error(`${name} entry ${index} modern read contains a quotation mark`);
    const [open, close] = spans[index];
    const body = original.slice(open, close + 1);
    if (/"modern"\s*:/.test(body)) return;
    let at = close - 1;
    while (at > open && /\s/.test(original[at])) at -= 1;
    const comma = original[at] === "," ? "" : ",";
    inserts.push({ at: at + 1, line: `${comma}\n      "modern": ${JSON.stringify(modern)}` });
    stamped += 1;
  });
  inserts.sort((a, b) => b.at - a.at);
  let next = original;
  inserts.forEach((insert) => {
    next = next.slice(0, insert.at) + insert.line + next.slice(insert.at);
  });
  const check = JSON.parse(next);
  check.entries.forEach((entry, index) => {
    if (entry.claim !== data.entries[index].claim) throw new Error(`${name} claim changed`);
    if (entry.bears !== data.entries[index].bears) throw new Error(`${name} bears changed`);
    if (entry.verbatim !== data.entries[index].verbatim) throw new Error(`${name} verbatim changed`);
    if (entry.modern !== Modern.compose(entry.claim, entry.bears)) throw new Error(`${name} modern mismatch`);
  });
  if (next !== original) fs.writeFileSync(file, next);
  files += 1;
});
console.log(`stamped ${stamped} modern reads across ${files} thinkers`);
