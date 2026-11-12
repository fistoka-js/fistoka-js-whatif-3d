// A tiny 5x7 capital-letter font and a name-plate texture made from it (a DataTexture, so it works in Node: no canvas).
// Exports: plateTexture(text, W, H) -> THREE.DataTexture (dark rounded board with white capitals), textWidth(text).

import * as THREE from 'three';

const ROWS = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
};

// Glyph indexes for the characters we can draw (anything else is dropped; a space is a gap).
const glyphs = text => [...String(text).toUpperCase()].filter(c => c === ' ' || ROWS[c]);
// Width in font pixels: 5 per letter plus 1 gap, a space is 3.
export function textWidth(text) {
  let w = 0;
  for (const c of glyphs(text)) w += c === ' ' ? 3 : 6;
  return Math.max(0, w - 1);
}

export function plateTexture(text, W = 512, H = 88) {
  const data = new Uint8Array(W * H * 4);
  const gl = glyphs(text), tw = textWidth(text);
  const sc = Math.min(H * 0.42 / 7, (W * 0.86) / Math.max(1, tw));   // font pixel size in texels
  const x0 = (W - tw * sc) / 2, y0 = (H - 7 * sc) / 2;
  // Which font pixel is on at font coordinates (fx, fy)?
  const cols = [];
  let cx = 0;
  for (const c of gl) {
    if (c === ' ') { cx += 3; continue; }
    ROWS[c].split(' ').forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '1') cols.push(`${cx + rx},${ry}`); });
    cx += 6;
  }
  const on = new Set(cols);
  const r = H * 0.42;   // corner radius
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Rounded board: distance outside a rounded rectangle.
    const dx = Math.max(Math.abs(x + 0.5 - W / 2) - (W / 2 - r - 2), 0), dy = Math.max(Math.abs(y + 0.5 - H / 2) - (H / 2 - r - 2), 0);
    const board = Math.min(1, Math.max(0, r - Math.hypot(dx, dy) + 0.5));
    // Text coverage by 3x3 sub-samples (soft edges).
    let cov = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const fx = Math.floor((x + (sx + 0.5) / 3 - x0) / sc), fy = Math.floor((y + (sy + 0.5) / 3 - y0) / sc);
      if (on.has(`${fx},${fy}`)) cov++;
    }
    cov /= 9;
    const i = 4 * ((H - 1 - y) * W + x);   // texture row 0 is the bottom
    const base = 12 + 243 * cov;
    data[i] = data[i + 1] = data[i + 2] = base;
    data[i + 3] = Math.round(255 * board * (0.78 + 0.22 * cov));
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}
