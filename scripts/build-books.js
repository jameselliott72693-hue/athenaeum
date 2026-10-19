#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { tokenize } = require("../stem.js");

const ROOT = path.join(__dirname, "..");
const TEXT = path.join(ROOT, "data", "books", "text");
const INDEX = path.join(ROOT, "data", "books", "index");
const RAW = process.env.BOOK_RAW || "/tmp/pg";

const BOOKS = [
  book("aristotle", "aristotle-ethics", "Nicomachean Ethics", "Aristotle", "D. P. Chase", "Project Gutenberg ebook 8438", "The Nicomachean Ethics is ancient and this English translation was published in the nineteenth century. Public domain.", "https://www.gutenberg.org/ebooks/8438", "8438", "Every art"),
  book("aristotle", "aristotle-politics", "Politics", "Aristotle", "William Ellis", "Project Gutenberg ebook 6762", "Ancient work. Ellis's English translation is public domain.", "https://www.gutenberg.org/ebooks/6762", "6762", "BOOK I"),
  book("plato", "plato-republic", "The Republic", "Plato", "Benjamin Jowett", "Project Gutenberg ebook 1497", "Ancient work. Jowett's translation is public domain. The translator's analysis before the dialogue is not indexed.", "https://www.gutenberg.org/ebooks/1497", "1497", "I went down yesterday"),
  book("cicero", "cicero-offices", "De Officiis", "Cicero", null, "Project Gutenberg ebook 47001", "Ancient work in a public-domain English translation.", "https://www.gutenberg.org/ebooks/47001", "47001", "My dear son Marcus"),
  book("epictetus", "epictetus", "The Enchiridion", "Epictetus", "Thomas Wentworth Higginson", "Project Gutenberg ebook 45109", "Ancient work. Higginson's translation is public domain. His preface is not indexed.", "https://www.gutenberg.org/ebooks/45109", "45109", "There are things which are within our power"),
  book("marcus", "marcus", "Meditations", "Marcus Aurelius", null, "Project Gutenberg ebook 2680", "Ancient work in a public-domain English translation. The editor's introduction is not indexed.", "https://www.gutenberg.org/ebooks/2680", "2680", "Of my grandfather Verus"),
  book("lucretius", "lucretius", "On the Nature of Things", "Lucretius", "William Ellery Leonard", "Project Gutenberg ebook 785", "Ancient poem. Leonard's 1916 translation is public domain in the United States.", "https://www.gutenberg.org/ebooks/785", "785", "BOOK I"),
  book("augustine", "augustine-confessions", "The Confessions of St. Augustine", "Augustine", "E. B. Pusey", "Project Gutenberg ebook 3296", "Ancient work. Pusey's English translation is public domain.", "https://www.gutenberg.org/ebooks/3296", "3296", "BOOK I"),
  book("augustine", "augustine-city", "The City of God", "Augustine", "Marcus Dods", "Project Gutenberg ebook 45305, volume II", "Ancient work. Dods's translation is public domain. This file is volume II, beginning at Book XIV. The translator's argument before that book is not indexed.", "https://www.gutenberg.org/ebooks/45305", "45305", "We have already stated in the preceding books"),
  book("boethius", "boethius", "The Consolation of Philosophy", "Boethius", null, "Project Gutenberg ebook 14328", "Sixth-century work in a public-domain English translation.", "https://www.gutenberg.org/ebooks/14328", "14328", "While I was thus"),
  book("aquinas", "aquinas-summa", "Summa Theologica, Part I", "Thomas Aquinas", "Fathers of the English Dominican Province", "Project Gutenberg ebook 17611", "Medieval work. The English Dominican translation is public domain.", "https://www.gutenberg.org/ebooks/17611", "17611", "QUESTION 1"),
  book("aquinas", "aquinas-summa-12", "Summa Theologica, Part I-II", "Thomas Aquinas", "Fathers of the English Dominican Province", "Project Gutenberg ebook 17897", "Medieval work. The English Dominican translation is public domain. Indexing begins at the prologue. The editor's note before it is not indexed.", "https://www.gutenberg.org/ebooks/17897", "17897", "Since, as Damascene states"),
  book("aquinas", "aquinas-summa-22", "Summa Theologica, Part II-II", "Thomas Aquinas", "Fathers of the English Dominican Province", "Project Gutenberg ebook 18755", "Medieval work. The English Dominican translation is public domain.", "https://www.gutenberg.org/ebooks/18755", "18755", "QUESTION 1"),
  book("aquinas", "aquinas-summa-3", "Summa Theologica, Part III", "Thomas Aquinas", "Fathers of the English Dominican Province", "Project Gutenberg ebook 19950", "Medieval work. The English Dominican translation is public domain.", "https://www.gutenberg.org/ebooks/19950", "19950", "QUESTION 1"),
  book("dante", "dante", "The Divine Comedy", "Dante Alighieri", "Henry Francis Cary", "Project Gutenberg ebook 8800", "Medieval poem. Cary's translation is public domain.", "https://www.gutenberg.org/ebooks/8800", "8800", "CANTO I"),
  book("kempis", "kempis", "The Imitation of Christ", "Thomas à Kempis", "William Benham", "Project Gutenberg ebook 1653", "Medieval work. Benham's translation is public domain.", "https://www.gutenberg.org/ebooks/1653", "1653", "He that followeth me"),
  book("pascal", "pascal", "Pensées", "Blaise Pascal", null, "Project Gutenberg ebook 18269", "Seventeenth-century work in a public-domain English translation. T. S. Eliot's introduction in this file is not indexed.", "https://www.gutenberg.org/ebooks/18269", "18269", "SECTION I"),
  book("locke", "locke-treatise", "Second Treatise of Government", "John Locke", null, "Project Gutenberg ebook 7370", "Published 1689. Public domain. Indexing begins at Book II, the Second Treatise.", "https://www.gutenberg.org/ebooks/7370", "7370", "Book II"),
  book("locke", "locke-letter", "A Letter Concerning Toleration", "John Locke", "William Popple", "Wikisource transcription of the 1689 Popple translation", "Published 1689. Popple's translation is public domain.", "https://en.wikisource.org/wiki/A_Letter_Concerning_Toleration", null, null, "wiki"),
  book("smith", "smith-sentiments", "The Theory of Moral Sentiments", "Adam Smith", null, "Project Gutenberg ebook 58559, in The Essays of Adam Smith", "Published 1759. Public domain.", "https://www.gutenberg.org/ebooks/58559", "58559", "OF THE PROPRIETY OF ACTIONS"),
  book("smith", "smith-wealth", "An Inquiry into the Nature and Causes of the Wealth of Nations", "Adam Smith", null, "Project Gutenberg ebook 3300", "Published 1776. Public domain.", "https://www.gutenberg.org/ebooks/3300", "3300", "annual labour of every nation"),
  book("burke", "burke-discontents", "Thoughts on the Present Discontents", "Edmund Burke", null, "Project Gutenberg ebook 2173", "Published 1770. Public domain.", "https://www.gutenberg.org/ebooks/2173", "2173", "It is an undertaking"),
  book("burke", "burke-conciliation", "Speech on Conciliation with the Colonies", "Edmund Burke", null, "Project Gutenberg ebook 5655", "Delivered 1775. Public domain.", "https://www.gutenberg.org/ebooks/5655", "5655", "I hope, Sir"),
  book("burke", "burke-reflections", "Reflections on the Revolution in France", "Edmund Burke", null, "Project Gutenberg ebook 15679, in Works, volume 3", "Published 1790. Public domain. Indexing begins at the letter itself, not the earlier pieces in that volume.", "https://www.gutenberg.org/ebooks/15679", "15679", "Dear Sir"),
  book("tocqueville", "tocqueville-1", "Democracy in America, volume 1", "Alexis de Tocqueville", "Henry Reeve", "Project Gutenberg ebook 815", "Published 1835. Reeve's translation is public domain.", "https://www.gutenberg.org/ebooks/815", "815", "Amongst the novel objects"),
  book("tocqueville", "tocqueville-2", "Democracy in America, volume 2", "Alexis de Tocqueville", "Henry Reeve", "Project Gutenberg ebook 816", "Published 1840. Reeve's translation is public domain.", "https://www.gutenberg.org/ebooks/816", "816", "The Americans live in a democratic state of society"),
  book("mill", "mill-liberty", "On Liberty", "John Stuart Mill", null, "Project Gutenberg ebook 34901", "Published 1859. Public domain.", "https://www.gutenberg.org/ebooks/34901", "34901", "so-called Liberty of the Will"),
  book("mill", "mill-util", "Utilitarianism", "John Stuart Mill", null, "Project Gutenberg ebook 11224", "Published 1863. Public domain.", "https://www.gutenberg.org/ebooks/11224", "11224", "There are few circumstances among those which make up"),
  book("mill", "mill-principles", "Principles of Political Economy", "John Stuart Mill", null, "Project Gutenberg ebook 30107", "Published 1848. Public domain.", "https://www.gutenberg.org/ebooks/30107", "30107", "Writers on Political Economy profess"),
  book("spencer", "spencer-ignore", "The Right to Ignore the State", "Herbert Spencer", null, "Project Gutenberg ebook 34649, from Social Statics", "From Social Statics, 1851. Public domain. The publisher's note before the essay is not indexed.", "https://www.gutenberg.org/ebooks/34649", "34649", "As a corollary to the proposition that all institutions"),
  book("spencer", "spencer-education", "Essays on Education and Kindred Subjects", "Herbert Spencer", null, "Project Gutenberg ebook 16510", "Nineteenth-century essays. Public domain. Charles W. Eliot's introduction is not indexed. The Man versus the State stays on the cards; this file does not contain it.", "https://www.gutenberg.org/ebooks/16510", "16510", "It has been truly remarked that, in order of time"),
  book("green", "green-obligation", "Lectures on the Principles of Political Obligation", "T. H. Green", null, "Project Gutenberg ebook 61889", "Delivered 1879–80 and published in the nineteenth century. Public domain. Bernard Bosanquet's preface and the editor's note are not indexed.", "https://www.gutenberg.org/ebooks/61889", "61889", "The subject of this course of lectures is the principles of"),
  book("chesterton", "chesterton-orthodoxy", "Orthodoxy", "G. K. Chesterton", null, "Project Gutenberg ebook 16769", "Published 1908. Public domain in the United States.", "https://www.gutenberg.org/ebooks/16769", "16769", "CHAPTER I"),
  book("chesterton", "chesterton-heretics", "Heretics", "G. K. Chesterton", null, "Project Gutenberg ebook 470", "Published 1905. Public domain in the United States.", "https://www.gutenberg.org/ebooks/470", "470", "Nothing more strangely indicates"),
  book("chesterton", "chesterton-wrong", "What's Wrong with the World", "G. K. Chesterton", null, "Project Gutenberg ebook 1717", "Published 1910. Public domain in the United States.", "https://www.gutenberg.org/ebooks/1717", "1717", "A book of modern social inquiry"),
  book("dewey", "dewey-democracy", "Democracy and Education", "John Dewey", null, "Project Gutenberg ebook 852", "Published 1916. Public domain in the United States.", "https://www.gutenberg.org/ebooks/852", "852", "The most notable distinction between"),
  book("dewey", "dewey-conduct", "Human Nature and Conduct", "John Dewey", null, "Project Gutenberg ebook 41386", "Published 1922. Public domain in the United States.", "https://www.gutenberg.org/ebooks/41386", "41386", "Give a dog a bad name and hang him"),
  book("dewey", "dewey-public", "The Public and Its Problems", "John Dewey", null, "Project Gutenberg ebook 71000", "Published 1927. Public domain in the United States.", "https://www.gutenberg.org/ebooks/71000", "71000", "If one wishes to realize the distance"),
  book("keynes", "keynes-peace", "The Economic Consequences of the Peace", "John Maynard Keynes", null, "Project Gutenberg ebook 15776", "Published 1919. Public domain. The General Theory (1936) is still in copyright and is not included.", "https://www.gutenberg.org/ebooks/15776", "15776", "The power to become habituated to his surroundings"),
  book("keynes", "keynes-tract", "A Tract on Monetary Reform", "John Maynard Keynes", null, "Project Gutenberg ebook 65278", "Published 1923. Public domain.", "https://www.gutenberg.org/ebooks/65278", "65278", "Money is only important for what it will procure"),
  book("arnold", "arnold", "Culture and Anarchy", "Matthew Arnold", null, "Project Gutenberg ebook 4212", "Published 1869. Public domain. The later editor's notes before Chapter I are not indexed.", "https://www.gutenberg.org/ebooks/4212", "4212", "The disparagers of culture make its motive curiosity"),
  book("ruskin", "ruskin", "Unto This Last, and Other Essays on Political Economy", "John Ruskin", null, "Project Gutenberg ebook 36541", "Nineteenth-century essays. Public domain.", "https://www.gutenberg.org/ebooks/36541", "36541", "THE ROOTS OF HONOUR"),
  book("carlyle", "carlyle", "Past and Present", "Thomas Carlyle", null, "Project Gutenberg ebook 26159", "Published 1843. Public domain.", "https://www.gutenberg.org/ebooks/26159", "26159", "The condition of England, on which many pamphlets"),
  book("newman", "newman", "The Idea of a University", "John Henry Newman", null, "Project Gutenberg ebook 24526", "The Dublin discourses are nineteenth-century and public domain. Indexing begins at Newman's preface.", "https://www.gutenberg.org/ebooks/24526", "24526", "The view taken of a University"),
  book("morris", "morris", "News from Nowhere", "William Morris", null, "Project Gutenberg ebook 3261", "Published 1890. Public domain.", "https://www.gutenberg.org/ebooks/3261", "3261", "CHAPTER I: DISCUSSION AND BED"),
  book("pater", "pater", "The Renaissance", "Walter Pater", null, "Project Gutenberg ebook 2398", "Studies in Art and Poetry. Nineteenth century. Public domain.", "https://www.gutenberg.org/ebooks/2398", "2398", "Many attempts have been made by writers on art")
];

const EXCLUDED = [
  ["lewis", "C. S. Lewis", "Works cited on the shelf were published after 1930 and remain in copyright."],
  ["kirk", "Russell Kirk", "In copyright."],
  ["buckley", "William F. Buckley Jr.", "In copyright."],
  ["oakeshott", "Michael Oakeshott", "In copyright."],
  ["scruton", "Roger Scruton", "In copyright."],
  ["weaver", "Richard M. Weaver", "In copyright."],
  ["chambers", "Whittaker Chambers", "In copyright."],
  ["strauss", "Leo Strauss", "In copyright."],
  ["mises", "Ludwig von Mises", "The English editions on the shelf are in copyright. No public-domain English text is indexed."],
  ["hayek", "F. A. Hayek", "In copyright."],
  ["friedman", "Milton Friedman", "In copyright."],
  ["rothbard", "Murray Rothbard", "In copyright."],
  ["rand", "Ayn Rand", "In copyright."],
  ["rawls", "John Rawls", "In copyright."],
  ["berlin", "Isaiah Berlin", "In copyright."],
  ["sen", "Amartya Sen", "In copyright."]
];

const SEED = {
  "aristotle-ethics": "Book I, Chapter I",
  "plato-republic": "Book I",
  "cicero-offices": "Book I",
  "epictetus": "I",
  "marcus": "Book I",
  "boethius": "Book I",
  "kempis": "Chapter I",
  "locke-letter": "A Letter Concerning Toleration",
  "smith-wealth": "Introduction and Plan of the Work",
  "burke-discontents": "Thoughts on the Present Discontents",
  "burke-conciliation": "Speech on Conciliation with the Colonies",
  "burke-reflections": "Reflections on the Revolution in France",
  "tocqueville-1": "Introductory Chapter",
  "tocqueville-2": "Preface to the Second Part",
  "mill-liberty": "Chapter I. Introductory",
  "mill-util": "Chapter I. General Remarks",
  "mill-principles": "Preliminary Remarks",
  "spencer-ignore": "The Right to Ignore the State",
  "spencer-education": "What Knowledge Is of Most Worth?",
  "green-obligation": "The grounds of political obligation",
  "augustine-city": "Book XIV",
  "dewey-conduct": "Introduction",
  "dewey-public": "Chapter I. Search for the Public",
  "keynes-peace": "Chapter I. Introductory",
  "keynes-tract": "Chapter I",
  "arnold": "Chapter I",
  "chesterton-heretics": "I. Introductory Remarks on the Importance of Orthodoxy",
  "chesterton-wrong": "I. The Medical Mistake",
  "newman": "Preface",
  "aquinas-summa-12": "Prologue",
  "dewey-democracy": "Chapter I. Education as a Necessity of Life",
  "carlyle": "Chapter I. Midas",
  "pater": "Preface"
};

function book(thinkerId, id, title, author, translator, edition, pdBasis, sourceUrl, gutenbergId, start, kind) {
  return { thinkerId, id, title, author, translator, edition, pdBasis, sourceUrl, gutenbergId, start: start || null, kind: kind || "gutenberg" };
}

function extractBody(raw, kind) {
  if (kind === "wiki") {
    let text = raw.replace(/\{\{header[\s\S]*?\}\}/, "");
    text = text.replace(/<ref[\s\S]*?<\/ref>/gi, "");
    text = text.replace(/\[\d+\]/g, "");
    text = text.replace(/''+/g, "");
    text = text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1");
    text = text.replace(/\{\{[^}]+\}\}/g, "");
    return text;
  }
  const start = raw.search(/\*\*\* START OF THE PROJECT GUTENBERG/);
  let body = start >= 0 ? raw.slice(raw.indexOf("\n", start) + 1) : raw;
  const end = body.search(/\*\*\* END OF THE PROJECT GUTENBERG/);
  if (end >= 0) body = body.slice(0, end);
  return body;
}

function isHeading(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 90) return false;
  if (/_{3,}|={3,}/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 14) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upper > 0.72) return true;
  return /^(book|chapter|canto|section|part|discourse|article|question|of the|first book|second book|third book|fourth book|lecture|introduction|preface|proem)\b/i.test(t);
}

function paragraphsOf(body, startMarker) {
  let text = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (startMarker) {
    let at = -1;
    let from = 0;
    while (from < text.length) {
      const found = text.indexOf(startMarker, from);
      if (found < 0) break;
      const next = text[found + startMarker.length] || "";
      if (!/[A-Za-z0-9]/.test(next)) { at = found; break; }
      from = found + 1;
    }
    if (at < 0) throw new Error("start marker missing: " + startMarker);
    text = text.slice(at);
  }
  text = text.replace(/_([^_\n]{1,80})_/g, "$1");
  const blocks = [];
  let buf = [];
  function flush() {
    if (!buf.length) return;
    let joined = [];
    buf.forEach((line) => {
      const prev = joined[joined.length - 1];
      if (prev && /[A-Za-z]-$/.test(prev) && /^[a-z]/.test(line)) joined[joined.length - 1] = prev.slice(0, -1) + line;
      else joined.push(line);
    });
    const paragraph = joined.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph) blocks.push(paragraph);
    buf = [];
  }
  text.split("\n").forEach((line) => {
    const trimmed = line.trim().replace(/^>\s*/, "").replace(/\[\d+\]/g, "");
    if (!trimmed) flush();
    else buf.push(trimmed);
  });
  flush();
  return blocks.filter((p) => !/project gutenberg|end of (the|this) project|www\.gutenberg\.org|^produced by\b|^transcriber/i.test(p));
}

function sentencesOf(paragraph) {
  const parts = paragraph.split(/(?<=[.!?]["”']?)\s+(?=[A-Z“"'])/);
  return parts.map((s) => s.trim()).filter((s) => s.length >= 40 && /[.!?]["”']?$/.test(s));
}

function passagesFrom(blocks, seedHeading) {
  const passages = [];
  let heading = seedHeading || "";
  let n = 0;
  blocks.forEach((block) => {
    if (isHeading(block)) {
      heading = block.replace(/\s+/g, " ");
      n = 0;
      return;
    }
    if (block.length < 80) return;
    const chunks = block.length > 900 ? sentencesOf(block) : (/[.!?]["”']?$/.test(block) ? [block] : sentencesOf(block));
    chunks.forEach((chunk) => {
      if (chunk.length < 80 || chunk.length > 900) return;
      if (!/[.!?]["”']?$/.test(chunk)) return;
      n += 1;
      const loc = heading ? `${heading}, paragraph ${n}` : `paragraph ${n}`;
      passages.push({ loc, text: chunk });
    });
  });
  return passages;
}

function buildOne(meta) {
  const rawPath = path.join(RAW, meta.id + (meta.kind === "wiki" ? ".wiki" : ".txt"));
  if (!fs.existsSync(rawPath)) throw new Error("missing raw " + rawPath);
  const raw = fs.readFileSync(rawPath, "utf8");
  const blocks = paragraphsOf(extractBody(raw, meta.kind), meta.start);
  const passages = passagesFrom(blocks, SEED[meta.id]);
  if (passages.length < 8) throw new Error(meta.id + " produced only " + passages.length + " passages");
  const cleaned = passages.map((p) => p.text).join("\n\n");
  const outPath = path.join(TEXT, meta.id + ".txt");
  fs.writeFileSync(outPath, cleaned + "\n");
  let cursor = 0;
  const located = passages.map((p, i) => {
    const start = cursor;
    const end = start + p.text.length;
    cursor = end + 2;
    return { id: `${meta.id}-p${i + 1}`, loc: p.loc, start, end };
  });
  if (cleaned.slice(located[0].start, located[0].end) !== passages[0].text) throw new Error("offset mismatch " + meta.id);
  return { meta, passages: located, count: located.length, chars: cleaned.length, sample: passages[3] || passages[0] };
}

function main() {
  fs.mkdirSync(TEXT, { recursive: true });
  fs.mkdirSync(INDEX, { recursive: true });
  const byThinker = new Map();
  const manifestBooks = [];
  BOOKS.forEach((meta) => {
    const built = buildOne(meta);
    const record = {
      id: meta.id,
      thinkerId: meta.thinkerId,
      title: meta.title,
      author: meta.author,
      translator: meta.translator,
      edition: meta.edition,
      pdBasis: meta.pdBasis,
      sourceUrl: meta.sourceUrl,
      gutenbergId: meta.gutenbergId,
      textFile: `data/books/text/${meta.id}.txt`,
      passages: built.count,
      characters: built.chars
    };
    manifestBooks.push(record);
    if (!byThinker.has(meta.thinkerId)) byThinker.set(meta.thinkerId, []);
    byThinker.get(meta.thinkerId).push({ meta, built });
    console.log(meta.id, built.count, "passages", built.chars, "chars", "|", built.sample.loc);
  });

  const sizes = [];
  byThinker.forEach((rows, thinkerId) => {
    const books = [];
    const passages = [];
    rows.forEach(({ meta, built }, bookIndex) => {
      books.push({
        id: meta.id,
        title: meta.title,
        translator: meta.translator,
        edition: meta.edition,
        url: meta.sourceUrl,
        file: `data/books/text/${meta.id}.txt`
      });
      built.passages.forEach((p) => passages.push({ id: p.id, book: bookIndex, loc: p.loc, start: p.start, end: p.end }));
    });
    const texts = rows.map(({ built }) => fs.readFileSync(path.join(TEXT, built.meta.id + ".txt"), "utf8"));
    let total = 0;
    const postings = {};
    const dl = new Array(passages.length);
    passages.forEach((p, pi) => {
      const slice = texts[p.book].slice(p.start, p.end);
      const counts = {};
      tokenize(slice).forEach((term) => { counts[term] = (counts[term] || 0) + 1; });
      const len = Object.values(counts).reduce((n, c) => n + c, 0);
      dl[pi] = len;
      total += len;
      Object.keys(counts).forEach((term) => {
        if (!postings[term]) postings[term] = [];
        postings[term].push([pi, counts[term]]);
      });
    });
    const index = {
      thinkerId,
      books,
      passages,
      N: passages.length,
      avgdl: passages.length ? total / passages.length : 0,
      dl,
      postings
    };
    console.log("indexing", thinkerId, passages.length);
    const file = path.join(INDEX, thinkerId + ".json");
    fs.writeFileSync(file, JSON.stringify(index));
    sizes.push({ thinkerId, bytes: fs.statSync(file).size, passages: passages.length, books: books.length });
  });

  const manifest = {
    builtBy: "node scripts/build-books.js",
    note: "Cleaned texts drop the Project Gutenberg license and editorial front matter named in each book's basis. Passages are whole sentences or whole paragraphs. In-copyright thinkers stay on their cards.",
    books: manifestBooks,
    excluded: EXCLUDED.map(([id, name, reason]) => ({ id, name, reason }))
  };
  fs.writeFileSync(path.join(ROOT, "data", "books", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const textBytes = manifestBooks.reduce((n, b) => n + b.characters, 0);
  const indexBytes = sizes.reduce((n, s) => n + s.bytes, 0);
  console.log("\nBOOKS", manifestBooks.length, "TEXT CHARS", textBytes);
  sizes.sort((a, b) => b.bytes - a.bytes).forEach((s) => console.log(s.thinkerId, s.books, "books", s.passages, "passages", (s.bytes / 1024).toFixed(0) + "KB"));
  console.log("INDEX", (indexBytes / 1024 / 1024).toFixed(2) + "MB");
}

main();
