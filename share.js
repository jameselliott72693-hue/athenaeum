(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AthenaeumShare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_URL = 12000;

  function slimCite(cite) {
    return {
      work: cite.work || "",
      loc: cite.loc || "",
      url: cite.url || "",
      bears: cite.bears || "",
      verbatim: !!cite.verbatim,
      fromText: !!cite.fromText
    };
  }

  function slimCard(card) {
    const slimmed = {
      topics: (card.topics || []).slice(),
      claim: card.claim || "",
      work: card.work || "",
      loc: card.loc || "",
      bears: card.bears || "",
      verbatim: !!card.verbatim,
      fromText: !!card.fromText
    };
    if (card.modern && String(card.modern).trim()) slimmed.modern = String(card.modern).trim();
    return slimmed;
  }

  function slimTurn(turn) {
    const slimmed = {
      kind: turn.kind || "chair",
      id: turn.id || "",
      name: turn.name || "",
      lean: turn.lean || "",
      editorial: turn.editorial || turn.reason || "",
      paragraphs: (turn.paragraphs || []).slice(),
      text: turn.text || "",
      cites: (turn.cites || []).map(slimCite),
      cards: (turn.cards || []).map(slimCard),
      replyTo: turn.replyTo || null
    };
    if (turn.modern && String(turn.modern).trim()) slimmed.modern = String(turn.modern).trim();
    return slimmed;
  }

  function slim(reading) {
    const sitting = {
      v: 1,
      topic: reading.topic || "",
      brief: reading.brief || "",
      tableId: reading.tableId || "",
      seated: (reading.seated || []).slice(),
      panel: !!reading.panel,
      topics: (reading.topics || []).slice()
    };
    if (Array.isArray(reading.turns) && reading.turns.length) sitting.turns = reading.turns.map(slimTurn);
    if (Array.isArray(reading.chairs)) {
      sitting.chairs = reading.chairs.map((chair) => ({
        id: chair.id || "",
        name: chair.name || "",
        lean: chair.lean || "",
        paragraphs: (chair.paragraphs || []).slice(),
        cites: (chair.cites || []).map(slimCite)
      }));
    }
    if (Array.isArray(reading.abstained)) {
      sitting.abstained = reading.abstained.map((row) => ({
        id: row.id || "",
        name: row.name || "",
        reason: row.reason || ""
      }));
    }
    return sitting;
  }

  function toB64url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromB64url(text) {
    const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
    const binary = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function gzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function pack(reading) {
    const json = JSON.stringify(slim(reading));
    const zipped = await gzip(new TextEncoder().encode(json));
    const compressed = "#s=" + toB64url(zipped);
    const plain = "#t=" + encodeURIComponent(json);
    const hash = compressed.length <= plain.length ? compressed : plain;
    if (hash.length > MAX_URL) return { ok: false, tooLong: true, length: hash.length };
    return { ok: true, hash, length: hash.length };
  }

  async function unpack(hash) {
    if (!hash) return null;
    const text = String(hash).replace(/^#/, "");
    try {
      if (text.startsWith("s=")) {
        const raw = await gunzip(fromB64url(text.slice(2)));
        const sitting = JSON.parse(new TextDecoder().decode(raw));
        return sitting && sitting.topic ? sitting : null;
      }
      if (text.startsWith("t=")) {
        const sitting = JSON.parse(decodeURIComponent(text.slice(2)));
        return sitting && sitting.topic ? sitting : null;
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  return { slim, pack, unpack, MAX_URL };
});
