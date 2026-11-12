// Checks a show against the catalogue and its words file, without a browser (SPEC §9), plus the story rules (SPEC §14).
// Usage: node tools/validate.mjs shows/<slug> [--json] [--story-rules | --no-story-rules]
// Prints one line per problem: "ERROR <path>: <message> <hint>" (warnings as WARNING). --json prints
// { ok, errors: [{path, message, hint}], warnings: [...] } for the repair loop.
// The story rules (does the picture change with every sentence?) run when the show itself is valid; whether they run
// without a flag is STORY_RULES_DEFAULT in tools/lib/story-rules.mjs. Their problems have paths starting with "story.".
// Exit codes: 0 = ok (warnings allowed), 1 = errors, 2 = bad command.

import { findShowDir, loadShow } from './lib/showfiles.mjs';
import { formatProblem } from '../kit/engine/show.js';
import { catalog } from '../kit/engine/registry.js';
import { storyRules, STORY_RULES_DEFAULT } from './lib/story-rules.mjs';

const USAGE = 'USAGE: node tools/validate.mjs shows/<slug> [--json] [--story-rules | --no-story-rules]';

function main(argv) {
  const json = argv.includes('--json');
  const story = argv.includes('--story-rules') ? true : argv.includes('--no-story-rules') ? false : STORY_RULES_DEFAULT;
  const rest = argv.filter(a => !['--json', '--story-rules', '--no-story-rules'].includes(a));
  if (rest.length !== 1 || rest[0].startsWith('--')) {
    console.error(USAGE);
    return 2;
  }
  let dir;
  try { dir = findShowDir(rest[0]); } catch (e) { console.error('USAGE: ' + e.message); return 2; }
  const { show, errors, warnings } = loadShow(dir);
  if (story && show && errors.length === 0) {
    const r = storyRules(show, catalog);
    const plain = ({ path, message, hint }) => ({ path, message, hint });
    errors.push(...r.errors.map(plain));
    warnings.push(...r.warnings.map(plain));
  }
  if (json) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
  } else {
    for (const p of errors) console.log(formatProblem(p, 'ERROR'));
    for (const p of warnings) console.log(formatProblem(p, 'WARNING'));
    if (errors.length === 0) console.log(`OK ${rest[0]}: ${show.shots.length} shots, ${show.duration.toFixed(2)} s, ${warnings.length} warning(s).`);
    else console.log(`FAILED ${rest[0]}: ${errors.length} error(s), ${warnings.length} warning(s).`);
  }
  return errors.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
