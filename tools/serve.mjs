// A tiny static file server rooted at the repo, on 127.0.0.1 (the page must not be opened from file://).
// Usage: node tools/serve.mjs [--port 8080]      (default: a free port, printed)
// Exports: startServer({ port }) -> Promise<{ port, url, close() }>  (used by tools/lib/browser.mjs)
// Supports Range requests so the preview's audio can seek. Refuses paths outside the repo.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};

function handle(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.resolve(ROOT, '.' + urlPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  let stat;
  try { stat = fs.statSync(file); } catch { res.writeHead(404); res.end('not found: ' + urlPath); return; }
  if (stat.isDirectory()) { res.writeHead(404); res.end('is a folder: ' + urlPath); return; }
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  fs.createReadStream(file).pipe(res);
}

export function startServer({ port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({ port: p, url: `http://127.0.0.1:${p}/`, close: () => new Promise(r => server.close(() => r())) });
    });
  });
}

// Run from the command line: serve until stopped.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 0;
  if (i > 0 && !Number.isInteger(port)) { console.error('USAGE: node tools/serve.mjs [--port 8080]'); process.exit(2); }
  const s = await startServer({ port });
  console.log(`Serving ${ROOT} at ${s.url}`);
  console.log(`Open a show: ${s.url}kit/index.html?show=shows/demo-sky`);
}
