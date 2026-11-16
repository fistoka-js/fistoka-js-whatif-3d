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

1. **Script and picture plan, together.** The model gets the topic, the script shape, the rules and the
   list of props (with what each can vary), and replies with `title`, `script`, `beats`, `description`,
   `tags`, `feasible`, `mechanism_prop`, `missing`, `claims`.
   - Script shape: hook (a belief or the question) -> "here is what really happens" -> ONE mechanism
     followed through 2-3 zoom levels or stages -> one analogy shown as an object -> why it matters ->
     closing question. One subject, one chain of cause and effect, 150-175 words (the voice reads about
     3.3 words a second, so 175 words is about 53 s and fits the 55 s limit).
   - `beats` has one entry per sentence: `subject` (the thing that stays on screen), `change` (what
     visibly changes while the sentence is spoken, as a verb; a camera move, a label, spin, bob, orbit or idle drift does not count). The check is cautious: it flags only clear cases, and anything unclear is left to the show call (a false alarm would use up the run's one rewrite and could leave the show call with no plan; a miss only gives a weaker plan). It flags a change only when the WHOLE change is one short "nothing happens" shape ("-", "none", "nothing happens", "the lizard sits still", "it stays the same", "hold on the lizard", "nothing, just the lizard", "the lizard spins", "the lizard drifts", "the lizard is static", "orbits around the sun"; "the moon orbits closer" or "orbits the sun faster" is a real change) or one camera/text shape ("slow zoom in", "zoom in on the lizard", "the camera pulls back", "a label appears"); a word inside a longer sentence never counts, so "the drop that stays on the leaf shrinks", "nothing moves except the lattice", "zoom in on the cells swelling" and "zoom in as the crystals spread apart" pass, and so do unclear ones such as "the skin stays green". The subject has its own field, so a bare verb is the subject's own change and is never called a camera move ("tilts up", "pulls back", "pushes in", "cuts into the apple"): a camera move is flagged only when the change starts with "camera", a camera noun ("close-up", "wide shot") or "zoom"/"pan" ("zoom in", "pan left", "pans across the sea"). In "the X", -ing words are refused ("the cells swelling" is not a plain thing) except a short list of common nouns such as "spring", "wing", "ring" and "building")
     and `dial` (the number that drives it, if any). If a sentence has no showable change, or the list
     does not match the sentences (a sentence ends at . ? or !, but not after a common abbreviation or a dotted initialism such as "U.S.", "U.S.A.", "Dr.", "Mr.", "e.g." or "etc."; the script prompt asks for none, so a real sentence ending in one joins the next; a wrong count, or a beat whose copied `sentence` is clearly another sentence, judged on whole words, so "No dye." is not "No paint." and a sentence under 5 words must be copied almost exactly; case, quotes and apostrophes of any kind, spacing, punctuation ("U.S." is "US"), a thousands separator ("1,000" is "1000"), curly quotes after a full stop, a beat's own number and a cut-short copy of a longer sentence are fine; one changed word such as "black" for "white" is not, and a sentence that is only a number is matched as that text), the script is sent back (`script-rewrite`) before it is voiced. The
     same check runs on the fact-check redraft and on a shortened script, but there is ONE rewrite per
     run in total. If it is still wrong, review.md and `writer.json` (`beats_note`) say "script has
     sentences with no visible change" (or "the picture plan does not fit the script" for a wrong beat count or a missing subject), and the show call gets no plan (a wrong plan is worse than none).
   - If no prop can show the topic's central mechanism changing, the model answers `feasible: false` and
     one paragraph in `mechanism_prop` (what the needed prop looks like and what varies). Icons and bar
     charts are not allowed as a stand-in for the mechanism. The writer writes `NEEDS-PROPS.md` with that
     paragraph and the `missing` list, and stops with exit code 3; the runner then moves the topic to
     `queue/needs-props/`. This also applies when the beat rewrite (after the first script, the redraft or
     a shorten) answers `feasible: false`. Then `review.md` says which call stopped the run, that no show
     was made and no voice is used, and shows the last script the run accepted (never an unchecked redraft
     or rewrite) with its own claims and fact check (NEEDS FACT CHECK if that check flagged anything);
     `writer.json` has no `beats_note` or `beat_problems` for it. Voice files left from an earlier run
     (a reset in files mode) are voiced again to match that script, and an old `show.json` is not listed
     under Files.
   Square-bracket notes are removed from the script.
2. **Fact check.** A second call lists every claim in the script with a verdict. Any flagged claim
   (unsupported, contradicted, known misconception) causes ONE redraft (`script_redraft_user.md`: the
   current script and beats plus a corrections block); its beats are checked, then it is fact-checked
   again. A redraft that answers `feasible: false` stops the run like step 1 (exit 3). Anything still
   flagged goes into `review.md` under **NEEDS FACT CHECK**. "simplified" never flags. The fact check
   itself never stops the run.
3. **Voice.** Free Edge TTS (`pipeline.voice.make_voice`) makes `voice.mp3` and `words.json`. If the
   voice is longer than `max_seconds` (55 s), the model is asked once to shorten the script by the needed
   number of words (the prompt gives a word target; if that target is under 150 words it wins over the usual 150-175 range; with a new beat list, checked as in step 1; the shortened words always get their own fact check, `audit-shorten`, before they are voiced, so `final_audit`, the claims list and `review.md` describe the script that is voiced. The rewrite, redraft and shorten prompts each ask for a new `claims` list, because a reply with no `claims` does not keep the old list: the list is empty and `review.md` says so. If a redraft failed but the shortened script's audit is clean, nothing is marked NEEDS FACT CHECK; if the review cannot list a flagged claim it says so instead of printing an empty list), then it is voiced again. If that shortened script needs the one beat rewrite, the rewrite is told the same word target (it wins over the 150 word floor). One rule holds both: a shortened script over the target is still used (it is shorter than the long one), and review.md's Voice line says it was over the target; a rewrite over the target is used only when it is no longer than the shortened script it replaces (review.md says so), otherwise it is not used: the shortened script is kept, voiced, and review.md says so. 55 s of
   voice plus the 0.4 s tail keeps the finished video at 60 s or less. The writer only re-voices when the script text changed
   (`voice.stats.json` keeps a fingerprint, also of the long script a shorten replaced), so a resumed run
   never voices again and keeps the same word times. The voice files on disk always belong to the script
   in `script.txt` and `review.md`: if a resumed run ends up keeping the long script after all (for
   example the shorten reply was removed and answered badly), the long script is voiced again.
4. **Show.** The model gets the show rules, the compact catalogue (now including dials, bindings,
   continuing shots, `until` ramps and the camera's `fill` and `glide`), one worked example (the
   chameleon video), the script as numbered sentences with every word's start time, and the beat list.
   The rules ask for 2-4 main scenes (runs of `continue` shots) instead of a new room per sentence, a
   hero prop that stays, at least one dial bound to two or more things, cause and effect in the same
   frame, labels that only name parts, and nothing unchanged for more than 3.5 s.
   Its reply is written to `show.json` and checked with
   `node tools/validate.mjs --story-rules` (SPEC section 14: every sentence needs a change, no still
   stretch over 3.5 s). The writer accepts a show only with no errors, neither of the checker's
   subject warnings (`story.scenes`: more than 6 scenes; `story.subject`: no prop on screen for 30% of
   the video) and at least one dial bound to two or more things in one scene (`story.dial`, checked in
   `writer.py`). Otherwise the model gets its previous show plus those messages and must send a
   corrected full file: up to `max_repairs` (3) repair rounds. Other warnings of the accepted show are
   listed in `review.md`. A reply that is not valid JSON
   (after removing one code fence) counts as a failed round, and so does an API failure (refusal, answer
   cut off, outage after retries).
5. **Picture check.** `node tools/qa.mjs <slug>` draws the show. If the result is `fail`, the model gets one
   repair round with the findings; the new show is validated and checked again, and the better of the
   two is kept. Still failing: the run is marked `qa: fail` (the runner decides what to do). If Chrome or
   2 GB of free memory is missing, QA is `not_run`.
6. **Fallback.** If no reply validated, `pipeline/fallback.py` builds a plain show from the words alone
   (one shot per sentence or two, rotating environments and safe props, a prop the words name when the
   catalogue has it, 1-3 key words as text). It validates for any script (tested on 50 random scripts),
   but it is a slideshow, so it is checked WITHOUT the story rules and marked
   **"fallback: not good enough to publish"** at the top of `review.md` and in `writer.json`
   (`fallback_note`). The runner fails such a topic (`queue/failed/`) and never renders it for upload
   or uploads it; `python -m pipeline.run --allow-fallback` renders it for a local test only.
7. **Review files.** `review.md` and `writer.json` (below).

## The two modes

- **files** (the default; free). Every model call writes the exact prompt to
  `shows/<slug>/llm/<nn>-<purpose>.prompt.md` (system part, then user part) and waits for
  `shows/<slug>/llm/<nn>-<purpose>.reply.md`. When the reply file is missing the writer prints which file
  it is waiting for and exits with code 4. Write the reply (only the answer, e.g. the JSON) and run the
  same command again: earlier replies are replayed from disk and the run continues. This is how Jacob
  can make a video with his Claude subscription: a Claude Code agent reads each prompt file and writes the
  reply file. Purposes in order: `script`, (`script-rewrite`), `audit`, (`script-redraft`,
  (`script-rewrite`), `audit-redraft`), (`shorten`, (`script-rewrite`), `audit-shorten`), `show`, (`repair1`..`repair3`),
  (`qa-repair`); `script-rewrite` happens at most once. Token counts in this mode are characters / 4.
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
| `max_seconds` | `55` | the voice must end before this (55 s + 0.4 s tail keeps the video at 60 s or less) |
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
| 4 | files mode: waiting for a reply file | the prompt file for the step it waits at, plus whatever earlier steps already made (`script.txt`, `voice.mp3`, `words.json`, `voice.stats.json`); an old writer.json and NEEDS-PROPS.md are deleted |

## writer.json (for the runner)

```json
{"slug": "moon-gone", "topic": "...", "status": "ok | fallback | needs_props | failed",
 "title": "...", "description": "...", "tags": ["..."],
 "show": "llm | fallback | none", "repairs": 0, "qa": "pass | warn | fail | not_run",
 "fallback_note": "fallback: not good enough to publish (only when show is fallback, else null)",
 "beats": [{"sentence": "...", "subject": "lattice", "change": "crystals spread apart", "dial": "gap"}],
 "beat_rewrite": false,
 "beats_note": "script has sentences with no visible change, or the picture plan does not fit the script (when still wrong, else null)",
 "beat_problems": [],
 "needs_fact_check": false, "voice_seconds": 41.5, "mode": "api", "model": "claude-sonnet-5-5",
 "tokens": {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
 "cost_usd": 0.13, "cost_is_estimate": false, "calls": [{"purpose": "script", "...": "..."}], "error": null}
```
`writer.json` exists only after a finished run (exit 0, 1 or 3). `review.md` has the same facts in words,
the script, the picture plan (beat list), the claims as a tick list, the fact-check verdicts, how the
show was made, the checker's warnings on the accepted show, QA findings and a cost table per call.
A run removes an old `writer.json` and `NEEDS-PROPS.md` when it starts.

## Changing the prompts

All model-facing text is in `pipeline/prompts/`. Edit it there; no code change is needed.
- `script_system.md`, `script_user.md`: the script shape and rules (hook, one mechanism, length, facts),
  the beat list, the feasibility rule and the JSON shape. `{{CATALOG_NAMES}}` is filled with prop and
  environment names and what each prop can vary. `script_rewrite_user.md`: the one send-back when a
  sentence has no showable change. `script_redraft_user.md`: the fact-check redraft (current script and
  beats plus the corrections).
- `show_system.md`: the heart. How the engine works, a "how to think" procedure (the chain and the hero ->
  2-4 scenes -> dials -> a change in every sentence -> cause and effect together -> JSON), the checker's
  rules (story rules included), picture rules, a short "good to know" list (ring radius and tilt, flat
  particle rings, bars), a checklist.
  `{{CATALOG}}` is filled from `kit/catalog.json` by `pipeline/catalog_text.py`; `{{EXAMPLES}}` with the
  examples.
- `show_user.md` (gets the beat list as `{{BEATS}}`), `repair_user.md`, `qa_repair_user.md`,
  `shorten_user.md`: the per-call parts.
- `examples/<name>/`: `show.json`, `words.json` (real Edge voice timings), `script.txt`, `plan.md` (the
  picture plan in the same `S1 subject: ... | change: ...` format a real call gets, one row per sentence, no icons as changes), `notes.md` (comments shown after the input). The order is `EXAMPLE_ORDER` in `writer.py`: only `chameleon` (the
  approved video rebuilt in this kit; its "emotions" shot is split in two so no shot is over 9 s, and its
  `script.txt` is the voiced words). `rings` and `ice` are kept on disk but left out: they are
  slideshows that fail the story rules (a test checks that). Examples are also regression fixtures:
  `test_prompt_examples_are_valid_shows` fails if a catalogue change breaks them or they fail
  `validate.mjs --story-rules`.
  To change one, copy it to `shows/zz-ex-<name>/` with a voice
  (`python -m pipeline.voice shows/zz-ex-<name>`), edit, run `node tools/validate.mjs --story-rules`,
  `node tools/qa.mjs` and `node tools/still.mjs <slug> --sheet`, LOOK at the sheet, then copy
  `show.json`, `words.json`, `script.txt` back, and keep `plan.md` at one row per sentence.
- New environment in the kit: add it to `ENV_GROUND` in `catalog_text.py` (a test reminds you).

## Prompt sizes and cost (ESTIMATE until a real api run)

Measured on 2026-11-13 (round 2), tokens = characters / 4:

| part | tokens |
|---|---|
| show system prompt (rules ~3,400 + catalogue ~4,700 + the chameleon example ~5,900); 56,521 characters | ~14,000 |
| show user part (words with times + beat list, 55 s script) | ~1,400 |
| script system prompt (rules + beat list + prop/env names); 14,076 characters, was 11,964 | ~3,500 |
| fact-check prompt | ~1,100 |
| a show reply (compact JSON, 3-4 scenes with dials; the chameleon example is ~4,300) | ~2,500 to 4,500 |

Assumed per call: thinking about as long as the visible answer (it is billed as output). Prices from the
claude-api skill (2026-11-03): Sonnet 5.5 $2 in / $10 out / $0.10 cache read / $2.50 cache write per
million tokens; Haiku 5.5 $0.10 / $0.50 (cache rates assumed 0.1x and 1.25x).

| per video | Sonnet 5.5 (default) | Haiku 5.5 |
|---|---|---|
| typical (show valid first time, no rewrite, no redraft): script with beats ~$0.035, audit ~$0.02, show ~$0.12 | **about $0.18** | about $0.009 |
| the one script rewrite (a sentence with no showable change) | about +$0.03 | about +$0.002 |
| each extra repair round (system read from cache, previous show + errors resent) | about +$0.10 | about +$0.005 |
| worst case (rewrite + redraft + 2nd audit + shorten + audit-shorten + 3 repairs + QA repair) | about $0.70 | about $0.035 |

Round 2 (2026-11-13): these are ESTIMATES from the prompt sizes above (characters / 4) and longer show
replies with dials; no paid call was made to measure them. The files-mode self-test below priced its
calls at $0.058 with no cache and short replies; real replies with thinking will cost more, as in the
table.

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
this with fresh agents. After the self-test the prompt also gained a short "good to know" list (ring
tilt and size, flat particle rings, bars; still in the prompt) and a relaxed environment rule, and the
examples of that time were corrected to obey every rule the prompt stated. The prompt was not
re-tested after these edits.
This self-test is from before round 2 (scenes, dials, beat list, story rules); it says nothing about
the current prompt.
