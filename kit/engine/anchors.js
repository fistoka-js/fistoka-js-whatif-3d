// Anchors: turning "when this phrase is spoken" into a time in seconds (SPEC §4).
// Exports: normWord(text), phraseTokens(text), anchorShapeProblem(anchor) -> message or null,
//          findPhrase(words, phrase, fromTime) -> { start, end } or null,
//          resolveAnchor(anchor, opts) -> { t } or { error }, wordsBetween(words, t0, t1) -> "word (1.20) ..." text.
// words is the words.json list: [{ text, start, end }, ...] in spoken order.

// Lower case, letters and digits only ("That's," -> "thats").
export const normWord = text => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// A phrase as matching tokens. Hyphens and dashes split words ("well-known" -> well, known).
export const phraseTokens = text => String(text).split(/[\s\-–—]+/).map(normWord).filter(Boolean);

// The transcript as tokens, each remembering which word it came from (so hyphenated words still match).
function tokenize(words) {
  const out = [];
  words.forEach((w, i) => { for (const tok of phraseTokens(w.text)) out.push({ tok, i }); });
  return out;
}

// Checks the anchor's shape only (not whether the phrase is spoken). Returns a message or null.
export function anchorShapeProblem(a) {
  const help = 'An anchor is "a spoken phrase", {"phrase": "...", "edge": "start"|"end", "offset": 0.2}, {"time": 12.3} or {"shot": 0.5}.';
  if (typeof a === 'string') {
    const n = phraseTokens(a).length;
    if (n === 0) return `"${a}" has no words in it. ${help}`;
    if (n > 6) return `"${a}" has ${n} words; use 1 to 6 words of the narration.`;
    return null;
  }
  if (a === null || typeof a !== 'object' || Array.isArray(a)) return `${JSON.stringify(a)} is not an anchor. ${help}`;
  const keys = Object.keys(a);
  if ('phrase' in a) {
    const extra = keys.filter(k => !['phrase', 'edge', 'offset'].includes(k));
    if (extra.length) return `anchor field "${extra[0]}" is not allowed with "phrase" (allowed: phrase, edge, offset).`;
    const inner = anchorShapeProblem(a.phrase);
    if (inner) return inner;
    if (a.edge !== undefined && a.edge !== 'start' && a.edge !== 'end') return `edge ${JSON.stringify(a.edge)} must be "start" or "end".`;
    if (a.offset !== undefined && (typeof a.offset !== 'number' || Math.abs(a.offset) > 5)) return `offset ${JSON.stringify(a.offset)} must be a number of seconds between -5 and 5.`;
    return null;
  }
  if ('time' in a) {
    if (keys.length !== 1) return `{"time": ...} takes no other fields.`;
    return typeof a.time === 'number' && a.time >= 0 ? null : `time ${JSON.stringify(a.time)} must be a number of seconds, 0 or more.`;
  }
  if ('shot' in a) {
    if (keys.length !== 1) return `{"shot": ...} takes no other fields.`;
    return typeof a.shot === 'number' && a.shot >= 0 && a.shot <= 1 ? null : `shot ${JSON.stringify(a.shot)} must be a fraction from 0 to 1.`;
  }
  return `${JSON.stringify(a)} is not an anchor. ${help}`;
}

// The first place `phrase` is spoken starting at or after fromTime. Returns { start, end } in seconds, or null.
export function findPhrase(words, phrase, fromTime = 0) {
  const want = phraseTokens(phrase);
  const toks = tokenize(words);
  for (let i = 0; i + want.length <= toks.length; i++) {
    if (words[toks[i].i].start < fromTime - 0.005) continue;
    let ok = true;
    for (let j = 0; j < want.length && ok; j++) ok = toks[i + j].tok === want[j];
    if (ok) return { start: words[toks[i].i].start, end: words[toks[i + want.length - 1].i].end };
  }
  return null;
}

// "word (1.20) word (1.45) ..." for the words spoken from t0 up to (not including) t1. Long lists are cut.
export function wordsBetween(words, t0, t1, max = 60) {
  const inside = words.filter(w => w.start >= t0 - 0.005 && w.start < t1);
  const text = inside.slice(0, max).map(w => `${w.text} (${w.start.toFixed(2)})`).join(' ');
  return inside.length > max ? text + ' ...' : (text || '(no words)');
}

// Resolves an anchor to seconds.
// opts: { words, from: search start (s), until: window end (s) for messages, shot: { start, end } or null, where: text }
// Returns { t } or { error: message }.
export function resolveAnchor(anchor, opts) {
  const { words, from = 0, until = Infinity, shot = null, where = 'this shot' } = opts;
  if (typeof anchor === 'string') anchor = { phrase: anchor };
  if ('time' in anchor) return { t: anchor.time };
  if ('shot' in anchor) {
    if (!shot) return { error: `{"shot": ...} can only be used inside a shot (for actions), not for a shot's own start.` };
    return { t: shot.start + anchor.shot * (shot.end - shot.start) };
  }
  const hit = findPhrase(words, anchor.phrase, from);
  if (!hit) {
    const earlier = findPhrase(words, anchor.phrase, 0);
    const before = earlier ? ` It is spoken at ${earlier.start.toFixed(2)} s, before ${where} starts (${from.toFixed(2)} s).` : ' It is not in the narration at all.';
    const end = Number.isFinite(until) ? until : (words.length ? words[words.length - 1].end + 1 : 0);
    return { error: `"${anchor.phrase}" is not spoken in ${where}.${before} Words spoken in ${where}: ${wordsBetween(words, from, end)}` };
  }
  const base = anchor.edge === 'end' ? hit.end : hit.start;
  return { t: Math.max(0, base + (anchor.offset || 0)) };
}
