(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function linesOf(round) {
    const topics = new Set();
    const lines = [];
    (round && round.turns || []).forEach((turn) => {
      if (!turn || turn.kind === "abstain" || turn.kind === "moderator") return;
      (turn.cards || []).forEach((card, index) => {
        (card.topics || []).forEach((topic) => topics.add(topic));
        const cite = (turn.cites || [])[index] || {};
        lines.push({
          speaker: turn.name || "",
          paragraph: (turn.paragraphs || [])[index] || "",
          work: cite.work || card.work || "",
          loc: cite.loc || card.loc || "",
          url: cite.url || "",
          topics: (card.topics || []).slice()
        });
      });
    });
    return { topics, lines };
  }

  function cited(leftRound, rightRound) {
    const left = linesOf(leftRound);
    const right = linesOf(rightRound);
    const both = [...left.topics].filter((topic) => right.topics.has(topic)).sort();
    const onlyLeft = [...left.topics].filter((topic) => !right.topics.has(topic)).sort();
    const onlyRight = [...right.topics].filter((topic) => !left.topics.has(topic)).sort();
    return { both, onlyLeft, onlyRight, left: left.lines, right: right.lines };
  }

  return { cited };
});
