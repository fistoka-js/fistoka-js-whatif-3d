// Reading a show folder from disk (Node tools only). The checking itself is kit/engine/show.js, shared with the page.
// Exports: findShowDir(arg) -> absolute folder, loadShow(dir) -> { raw, words, show, errors, warnings }, REPO.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveShow } from '../../kit/engine/show.js';
import { catalog } from '../../kit/engine/registry.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Accepts "shows/<slug>", "<slug>" or an absolute folder. Throws with a helpful message if it is not there.
export function findShowDir(arg) {
  const tries = [path.resolve(arg), path.join(REPO, 'shows', arg), path.join(REPO, arg)];
  for (const dir of tries) if (fs.existsSync(path.join(dir, 'show.json'))) return dir;
  const slugs = fs.existsSync(path.join(REPO, 'shows')) ? fs.readdirSync(path.join(REPO, 'shows')).filter(d => fs.existsSync(path.join(REPO, 'shows', d, 'show.json'))) : [];
  throw new Error(`no show.json found for "${arg}". Shows here: ${slugs.join(', ') || 'none'}.`);
}

function readJson(file, label) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { error: { path: label, message: `file not found: ${file}`, hint: '' } }; }
  try { return { value: JSON.parse(text) }; } catch (e) {
    return { error: { path: label, message: `is not valid JSON: ${e.message}`, hint: 'Check for a missing comma, a trailing comma, or unquoted names.' } };
  }
}

// Loads and checks a show folder. Never throws for problems in the show; they come back in errors.
export function loadShow(dir) {
  const showFile = readJson(path.join(dir, 'show.json'), 'show.json');
  if (showFile.error) return { raw: null, words: null, show: null, errors: [showFile.error], warnings: [] };
  const raw = showFile.value;
  const wordsName = raw && raw.voice && typeof raw.voice.words === 'string' ? raw.voice.words : 'words.json';
  const wordsFile = readJson(path.join(dir, wordsName), 'voice.words');
  if (wordsFile.error) return { raw, words: null, show: null, errors: [wordsFile.error], warnings: [] };
  const res = resolveShow(raw, wordsFile.value, catalog);
  if (raw && raw.voice && typeof raw.voice.audio === 'string' && !fs.existsSync(path.join(dir, raw.voice.audio))) {
    res.errors.push({ path: 'voice.audio', message: `"${raw.voice.audio}" is not in the show folder.`, hint: '' });
    res.show = null;
  }
  return { raw, words: wordsFile.value, ...res };
}
