// QA contact sheet: one tile per shot (its midpoint picture), labelled with the shot id,
// outlined red when the shot has a FAIL and yellow when it has a WARN.
// Exports: makeQaSheet(session, tiles, file) where tiles = [{ id, level: 'fail'|'warn'|'pass', t, buf (PNG/JPEG Buffer) }].

import fs from 'node:fs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = { fail: '#ff3b3b', warn: '#ffd21f', pass: '#2a2a2a' };

export async function makeQaSheet(session, tiles, file, tileW = 270, tileH = 480) {
  const cols = Math.min(6, Math.max(1, tiles.length));
  const page = await session.newPage();
  try {
    const cell = x => `<div style="outline:4px solid ${COLORS[x.level]};outline-offset:0;background:#111">
      <img src="data:image/png;base64,${x.buf.toString('base64')}" style="width:${tileW}px;height:${tileH}px;display:block">
      <div style="padding:3px 4px;color:${x.level === 'pass' ? '#ddd' : COLORS[x.level]}">${esc(x.id)} · ${x.t.toFixed(1)} s${x.level === 'pass' ? '' : ' · ' + x.level.toUpperCase()}</div></div>`;
    const html = `<html><body style="margin:0;background:#000;font:600 13px Segoe UI,Arial">
      <div style="display:grid;grid-template-columns:repeat(${cols},${tileW}px);gap:10px;padding:10px">${tiles.map(cell).join('')}</div></body></html>`;
    await page.setViewport({ width: cols * (tileW + 10) + 10, height: 200, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    fs.writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true }));
  } finally {
    await page.close();
  }
}
