# WRITER: topic -> script -> voice -> show.json

```
python -m pipeline.writer --topic "What if the Moon disappeared?" --slug moon-gone [--mode api|files]
```

The writer turns one topic into a finished show folder `shows/<slug>/`: `script.txt`, `voice.mp3`,
`words.json`, `show.json`, plus `review.md` (for a person) and `writer.json` (for the pipeline runner).
Code: `pipeline/writer.py` (the steps), `pipeline/llm.py` (talking to the model), `pipeline/prompts/`
(every word the model reads), `pipeline/catalog_text.py`, `pipeline/fact_check.py`, `pipeline/fallback.py`.
Tests: `tests/py/test_writer.py`, `test_fact_check.py`, `test_fallback.py`, `test_catalog_text.py`
(fake model, fake voice, the real `node tools/validate.mjs`; no paid calls, no network).

## The steps

1. **Script.** The model gets the topic, the channel's script rules and the list of props and
   environments, and replies with `title`, `script`, `description`, `tags`, `feasible`, `missing`, `claims`.
   Square-bracket notes are removed from the script. If `feasible` is false the writer writes
   `NEEDS-PROPS.md` (the `missing` list) and stops with exit code 3.
2. **Fact check.** A second call lists every claim in the script with a verdict. Any flagged claim
   (unsupported, contradicted, known misconception) causes ONE redraft with a corrections block, and the
   new script is checked again. Anything still flagged goes into `review.md` under **NEEDS FACT CHECK**.
   "simplified" never flags. The fact check never stops the run.
3. **Voice.** Free Edge TTS (`pipeline.voice.make_voice`) makes `voice.mp3` and `words.json`. If the
   voice is longer than `max_seconds` (58 s), the model is asked once to shorten the script by the needed
   number of words, then it is voiced again. The writer only re-voices when the script text changed
   (`voice.stats.json` keeps a fingerprint, also of the long script a shorten replaced), so a resumed run
   never voices again and keeps the same word times.
4. **Show.** The model gets the show rules, the compact catalogue, two worked examples, and the script as
   numbered sentences with every word's start time. Its reply is written to `show.json` and checked with
   `node tools/validate.mjs`. On errors the model gets its previous show plus the checker's messages and
   must send a corrected full file: up to `max_repairs` (3) repair rounds. A reply that is not valid JSON
   (after removing one code fence) counts as a failed round, and so does an API failure (refusal, answer
   cut off, outage after retries).
5. **Picture check.** `node tools/qa.mjs <slug>` draws the show. If the result is `fail`, the model gets one
   repair round with the findings; the new show is validated and checked again, and the better of the
   two is kept. Still failing: the run is marked `qa: fail` (the runner decides what to do). If Chrome or
   2 GB of free memory is missing, QA is `not_run`.
6. **Fallback.** If no reply validated, `pipeline/fallback.py` builds a plain show from the words alone
   (one shot per sentence or two, rotating environments and safe props, a prop the words name when the
   catalogue has it, 1-3 key words as text). It validates for any script (tested on 50 random scripts).
7. **Review files.** `review.md` and `writer.json` (below).

## The two modes

- **files** (the default; free). Every model call writes the exact prompt to
  `shows/<slug>/llm/<nn>-<purpose>.prompt.md` (system part, then user part) and waits for
  `shows/<slug>/llm/<nn>-<purpose>.reply.md`. When the reply file is missing the writer prints which file
  it is waiting for and exits with code 4. Write the reply (only the answer, e.g. the JSON) and run the
  same command again: earlier replies are replayed from disk and the run continues. This is how Jacob
  can make a video with his Claude subscription: a Claude Code agent reads each prompt file and writes the
  reply file. Purposes in order: `script`, `audit`, (`script-redraft`, `audit-redraft`), (`shorten`),
  `show`, (`repair1`..`repair3`), (`qa-repair`). Token counts in this mode are characters / 4.
  To start again from a step, delete that reply file and every later one.
- **api** (paid). The Anthropic API through the official Python SDK (`pip install anthropic`; it is not
  in `pipeline/requirements.txt` yet). The key is read only from the `ANTHROPIC_API_KEY` environment
  variable; it is never read from a file or printed. The long fixed part of each prompt (rules,
  catalogue, examples) is sent as a cached system block, so repair rounds pay about a twentieth for it.
  Overload and rate-limit errors are retried (the SDK's own 2 retries, then 4 more waiting 5, 10, 20, 40 s).
  A refusal or an answer cut off at `max_tokens` counts as a failed call. Each call's tokens and cost are
  in `review.md` and `writer.json`.

## Settings

Optional file `settings.yaml` at the repo root, section `writer:` (flat `key: value` lines; anything
missing uses the default). The writer reads only these keys:

| key | default | meaning |
|---|---|---|
| `mode` | `files` | `files` or `api` (the `--mode` flag wins) |
| `model` | `claude-sonnet-5-5` | model for api mode, and the price used for files-mode estimates. Cheaper: `claude-haiku-5-5` |
| `effort` | `medium` | api only: how hard the model thinks (`low`, `medium`, `high`); thinking is billed as output |
| `max_repairs` | `3` | validator repair rounds for the show |
| `qa` | `true` | run the picture check |
| `qa_repair` | `true` | one repair round when the picture check fails |
| `max_seconds` | `58` | the voice must end before this |
| `voice` | `en-US-AndrewNeural` | Edge voice |
| `rate` | `+12%` | Edge speaking rate |
| `fallback_seed` | `0` | which variant of the fallback show |

## Exit codes

| code | meaning | files written |
|---|---|---|
| 0 | a valid show was written (by the model, or the fallback) | everything |
| 1 | failed (script reply unusable, voice failed, API error) | review.md, writer.json (with `error`) |
| 2 | bad command line (missing `--topic`/`--slug`, bad slug) | nothing |
| 3 | the topic needs props the catalogue lacks | NEEDS-PROPS.md, review.md, writer.json |
| 4 | files mode: waiting for a reply file | the prompt file only (an old writer.json is deleted) |

## writer.json (for the runner)

```json
{"slug": "moon-gone", "topic": "...", "status": "ok | fallback | needs_props | failed",
 "title": "...", "description": "...", "tags": ["..."],
 "show": "llm | fallback | none", "repairs": 0, "qa": "pass | warn | fail | not_run",
 "needs_fact_check": false, "voice_seconds": 41.5, "mode": "api", "model": "claude-sonnet-5-5",
 "tokens": {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
 "cost_usd": 0.13, "cost_is_estimate": false, "calls": [{"purpose": "script", "...": "..."}], "error": null}
```
`writer.json` exists only after a finished run (exit 0, 1 or 3). `review.md` has the same facts in words,
the script, the claims as a tick list, the fact-check verdicts, how the show was made, QA findings and a
cost table per call.

## Changing the prompts

All model-facing text is in `pipeline/prompts/`. Edit it there; no code change is needed.
- `script_system.md`, `script_user.md`: the script rules (tone, hook, length, facts, JSON shape).
  `{{CATALOG_NAMES}}` is filled with prop and environment names.
- `show_system.md`: the heart. How the engine works, a "how to think" procedure (beats -> one thing to
  look at -> env and props -> moments -> JSON), the checker's rules, picture rules, a checklist.
  `{{CATALOG}}` is filled from `kit/catalog.json` by `pipeline/catalog_text.py`; `{{EXAMPLES}}` with the
  examples.
- `show_user.md`, `repair_user.md`, `qa_repair_user.md`, `shorten_user.md`: the per-call parts.
- `examples/<name>/`: `show.json`, `words.json` (real Edge voice timings), `script.txt`, `plan.md` (the
  beat plan shown as the "thinking"). The order is `EXAMPLE_ORDER` in `writer.py`. They are also
  regression fixtures: `test_prompt_examples_are_valid_shows` fails if a catalogue change breaks them.
  To change one, copy it to `shows/zz-ex-<name>/` with a voice (`python -m pipeline.voice shows/zz-ex-<name>`),
  edit, run `node tools/validate.mjs`, `node tools/qa.mjs` and `node tools/still.mjs <slug> --sheet`, LOOK
  at the sheet, then copy `show.json`, `words.json`, `script.txt` back.
- New environment in the kit: add it to `ENV_GROUND` in `catalog_text.py` (a test reminds you).

## Prompt sizes and cost (ESTIMATE until a real api run)

Measured on 2026-11-12, tokens = characters / 4:

| part | tokens |
|---|---|
| show system prompt (rules ~3,100 + catalogue ~3,840 + two examples ~5,900) | ~12,850 |
| show user part (words with times, 39 s script) | ~770 |
| script system prompt (rules + prop/env names) | ~2,900 |
| fact-check prompt | ~1,100 |
| a show reply (compact JSON, 8 shots) | ~1,600 to 3,000 |

Assumed per call: thinking about as long as the visible answer (it is billed as output). Prices from the
claude-api skill (2026-11-03): Sonnet 5.5 $2 in / $10 out / $0.10 cache read / $2.50 cache write per
million tokens; Haiku 5.5 $0.10 / $0.50 (cache rates assumed 0.1x and 1.25x).

| per video | Sonnet 5.5 (default) | Haiku 5.5 |
|---|---|---|
| typical (show valid first time, no redraft): script ~$0.02, audit ~$0.02, show ~$0.09 | **about $0.13** | about $0.007 |
| each extra repair round (system read from cache, previous show + errors resent) | about +$0.07 | about +$0.004 |
| worst case (redraft + 2nd audit + shorten + 3 repairs + QA repair) | about $0.45 | about $0.025 |

The files-mode self-test below priced its calls at $0.058 with no cache and short replies; real
replies with thinking will cost more, as in the table.

## Differences from the stock-footage pipeline

- **No research step.** The old `research.py` called Tavily with a key file; it is left out (no key files,
  no paid services). The fact check therefore runs without research text, and its prompt gets one added
  note telling the checker to judge claims by widely accepted knowledge (otherwise every number would be
  "unsupported" just for missing from the empty research block).
- No niche profiles, b-roll terms, thumbnails, variation history or `config.py`. The science niche's
  tone, hooks, structure, closing lines and forbidden phrases are written straight into `script_system.md`.
- Bracket removal is a short regex, not the old `script_clean.py` (the prompt forbids notes anyway).

## Self-test (files mode, one new topic)

Topic "How does a vaccine teach your body to fight a virus?" (slug `zz-selftest-vaccine`, git-ignored).
The helper that wrote the prompt acted as the model, using only the prompt files. Result: the show
validated on the first try (0 repair rounds), QA `warn` (the first shot's subject was small). Looking at
the stills: the story reads shot by shot; weak points were the small first shot and an antibody cloud
too small to see. Added to the prompt afterwards: minimum sizes for named things and particles, and a
"first shot is the thumbnail" rule. Caveat: the prompt's author is not a fair test; the lead will repeat
this with fresh agents. After the self-test the prompt also gained a short "good to know" list (ring tilt and
size, flat particle rings, bars) and a relaxed environment rule, and both examples were corrected to obey
every rule the prompt states (a test now checks that). The prompt was not re-tested after these edits.
