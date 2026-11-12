// Captions: groups the spoken words into short lines and highlights the word being spoken (SPEC §8).
// Exports: buildChunks(words) -> [{ words: [{text, start, end}], start, end }] (pure, used by tests),
//          makeCaptions(el, words, duration) -> { update(t), rect() }.
// Rules (ported from the approved chameleon video): at most 4 words and 22 characters per line; a line ends at
// . ? ! : and at a comma once it has 11+ characters. Unspoken words are dimmed, the current word is the accent colour.
// update(t) sets every class from t alone, so the same t always gives the same captions.

export const CAPTION_RULES = { maxWords: 4, maxChars: 22, commaBreakMinChars: 11, showBefore: 0.04, holdAfter: 0.7 };

export function buildChunks(words, rules = CAPTION_RULES) {
  const chunks = [];
  let cur = [], chars = 0;
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = []; chars = 0;
  };
  for (const w of words) {
    const len = w.text.length;
    if (cur.length && (chars + 1 + len > rules.maxChars || cur.length >= rules.maxWords)) flush();
    cur.push(w);
    chars += (chars ? 1 : 0) + len;
    if (/[.?!:]$/.test(w.text) || (/,$/.test(w.text) && chars >= rules.commaBreakMinChars)) flush();
  }
  flush();
  return chunks;
}

// Which chunk shows at time t (index, or -1 for none).
export function chunkAt(chunks, t, duration, rules = CAPTION_RULES) {
  let ci = -1;
  for (let i = chunks.length - 1; i >= 0; i--) if (t >= chunks[i].start - rules.showBefore) { ci = i; break; }
  if (ci >= 0 && t > chunks[ci].end + rules.holdAfter && !(ci === chunks.length - 1 && t < duration)) ci = -1;
  return ci;
}

export function makeCaptions(el, words, duration) {
  const chunks = buildChunks(words);
  let shown = -2, spans = [];
  return {
    chunks,
    update(t) {
      const ci = chunkAt(chunks, t, duration);
      if (ci !== shown) {
        // Rebuild the line only when the chunk changes; the classes below are always set from t.
        shown = ci;
        el.textContent = '';
        spans = [];
        if (ci >= 0) {
          const line = document.createElement('span');
          line.className = 'line';
          for (const w of chunks[ci].words) {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = w.text;
            line.appendChild(s);
            spans.push(s);
          }
          el.appendChild(line);
        }
      }
      if (ci < 0) return;
      const ws = chunks[ci].words;
      let cw = -1;
      for (let i = 0; i < ws.length; i++) if (t >= ws[i].start) cw = i;
      spans.forEach((s, i) => { s.className = 'w' + (i < cw ? ' past' : i === cw ? ' on' : ''); });
    },
  };
}
