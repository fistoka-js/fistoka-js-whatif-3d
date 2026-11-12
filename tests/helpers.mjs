// Test helpers (not a test file): the demo words, a tiny valid show, and a quick resolver.
// Exports: REPO, WORDS (the demo-sky words), MINI_WORDS, demoShow() (a fresh copy of shows/demo-sky/show.json),
//          miniShow() (two shots, use with MINI_WORDS), resolve(show, words = WORDS), resolveMini(show), SFX_FILES.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveShow } from '../kit/engine/show.js';
import { catalog } from '../kit/engine/registry.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORDS = JSON.parse(fs.readFileSync(path.join(REPO, 'shows/demo-sky/words.json'), 'utf8'));
// The first 24 words (up to "...in it at all?", 7.14 s): short enough for a two-shot mini show.
export const MINI_WORDS = WORDS.slice(0, 24);
export const demoShow = () => JSON.parse(fs.readFileSync(path.join(REPO, 'shows/demo-sky/show.json'), 'utf8'));

// Two shots over the first sentences of the demo words.
export function miniShow() {
  return {
    format: 1, title: 'Mini', voice: { audio: 'voice.mp3', words: 'words.json' },
    shots: [
      {
        id: 'one', env: 'space',
        props: [{ id: 'earth', type: 'planet', look: 'earth' }, { id: 'moon', type: 'planet', look: 'moon', at: 'right', size: 0.3 }],
        actions: [
          { at: 'sky is blue', do: 'appear', prop: 'moon' },
          { at: 'reflects', do: 'move', prop: 'moon', to: 'left', over: 1 },
        ],
      },
      { id: 'two', start: 'What if sunlight', env: { type: 'studio', color: 'teal' }, props: [{ id: 'ball', type: 'ball' }] },
    ],
  };
}

export const resolve = (show, words = WORDS) => resolveShow(show, words, catalog);
export const resolveMini = show => resolveShow(show, MINI_WORDS, catalog);

// The sound names the timeline may use = the .wav files in assets/sfx.
export const SFX_FILES = fs.readdirSync(path.join(REPO, 'assets', 'sfx')).filter(f => f.endsWith('.wav')).map(f => f.replace(/\.wav$/, ''));
