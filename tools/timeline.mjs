// Writes shows/<slug>/out/timeline.json: the show's duration, shot windows and sound-effect events, for the pipeline.
// Usage: node tools/timeline.mjs shows/<slug>
// Shape: { "duration": 54.7, "shots": [{ "id", "start", "end" }], "events": [{ "t", "sfx", "why" }] }
// The sound mapping lives in kit/engine/sounds.js (SOUND_RULES). Exit: 0 written, 1 show has errors, 2 bad command.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findShowDir, loadShow } from './lib/showfiles.mjs';
import { soundEvents } from '../kit/engine/sounds.js';
import { catalog } from '../kit/engine/registry.js';

const round2 = x => Math.round(x * 100) / 100;

export function buildTimeline(show) {
  return {
    duration: round2(show.duration),
    shots: show.shots.map(s => ({ id: s.id, start: round2(s.start), end: round2(s.end) })),
    events: soundEvents(show, catalog),
  };
}

function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith('--')) { console.error('USAGE: node tools/timeline.mjs shows/<slug>'); return 2; }
  let dir;
  try { dir = findShowDir(argv[0]); } catch (e) { console.error('USAGE: ' + e.message); return 2; }
  const { show, errors } = loadShow(dir);
  if (errors.length) { console.error(`TIMELINE ERROR: the show has ${errors.length} error(s); run node tools/validate.mjs ${argv[0]}`); return 1; }
  const out = path.join(dir, 'out', 'timeline.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tl = buildTimeline(show);
  fs.writeFileSync(out, JSON.stringify(tl, null, 2) + '\n');
  console.log(`TIMELINE ${out}: ${tl.shots.length} shots, ${tl.events.length} sound events, ${tl.duration} s`);
  return 0;
}

// Run only when started from the command line (tests import buildTimeline).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
