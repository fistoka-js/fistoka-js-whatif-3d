# WRITER: topic -> script -> voice -> storyboard -> show.json

```
python -m pipeline.writer --topic "What if the Moon disappeared?" --slug moon-gone [--mode api|files]
```

The writer turns one topic into a finished show folder `shows/<slug>/`: `script.txt`, `voice.mp3`,
`words.json`, `storyboard.json` and `storyboard.md` (the picture plan; see step 4), `show.json`, plus `review.md`
(for a person) and `writer.json` (for the pipeline runner).
Code: `pipeline/writer.py` (the steps), `pipeline/llm.py` (talking to the model), `pipeline/prompts/`
(every word the model reads), `pipeline/catalog_text.py`, `pipeline/fact_check.py`, `pipeline/fallback.py`.
Tests: `tests/py/test_writer.py`, `test_storyboard.py`, `test_fact_check.py`, `test_fallback.py`, `test_catalog_text.py`
(fake model, fake voice, the real `node tools/validate.mjs`; no paid calls, no network).

## The steps

1. **Script and picture plan, together.** The model gets the topic, the script shape, the rules and the
   list of props (with what each can vary), and replies with `title`, `script`, `beats`, `description`,
   `tags`, `feasible`, `mechanism_prop`, `missing`, `claims`.
   - Script shape: hook (a belief or the question) -> "here is what really happens" -> ONE mechanism
     followed through 2-3 zoom levels or stages -> one analogy shown as an object -> why it matters ->
     closing question, then one required last line asking the viewer to comment their answer ("Comment your answer below."). One subject, one chain of cause and effect, 180-195 words counting that last line (the voice reads about
     3.3 words a second: voice stats of the sample shows ran 3.13 to 3.45 words a second, so 180 words is about 52 to 58 s and 195 words about 56 to 62 s; the aim is 186 words, which is about 54 to 59.5 s at those speeds, and a script over the 60 s limit is shortened).
   - `beats` has one entry per sentence: `subject` (the thing that stays on screen), `change` (what
     visibly changes while the sentence is spoken, as a verb; a camera move, a label, spin, bob, orbit, pulse or shake does not count) and `dial` (the number that drives it, if any).
     The check is tiny on purpose: it flags a change only when it is empty or exactly one of a short fixed list of phrases (`NO_VISIBLE_CHANGE` in `pipeline/writer.py`: "none", "nothing happens", "stays the same", "spins", "zoom in", "the camera pulls back", "a label appears", ...), ignoring case, apostrophes and end punctuation (any non-letter, non-digit at either end).
     Everything else passes, even when it is weak ("tilts up", "nothing moves except the lattice"); the show call and the story rules judge those.
     This is deliberate: a false alarm would use up the run's one rewrite, while a miss only gives a slightly weaker plan.
     If a sentence has no showable change, or the list
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
     or rewrite) with its own claims and fact check (NEEDS FACT CHECK if that check flagged anything). If no script was accepted yet (the first call, or the beat rewrite of the first script, answered not feasible), `review.md` is headed with the slug and says "No script was accepted", and `writer.json` has no title, description, tags or beats;
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
   voice is longer than `max_seconds` (60 s), the model is asked once to shorten the script by the needed
   number of words (the prompt gives a word target; the target is never below 180 words (`WORD_FLOOR` in writer.py, also written in the shorten prompt as "never below N words") and wins over the usual 180-195 range at the top; with a new beat list, checked as in step 1; the shortened words always get their own fact check, `audit-shorten`, before they are voiced, so `final_audit`, the claims list and `review.md` describe the script that is voiced. The rewrite, redraft and shorten prompts each ask for a new `claims` list, because a reply with no `claims` does not keep the old list: the list is empty and `review.md` says so. If a redraft failed but the shortened script's audit is clean, nothing is marked NEEDS FACT CHECK; if the review cannot list a flagged claim it says so instead of printing an empty list), then it is voiced again. If that shortened script needs the one beat rewrite, the rewrite is told the same word target (it wins over the 180-195 word length). Two rules follow: a shortened script over the target is still used (it is shorter than the long one), and review.md's Voice line says it was over the target; a rewrite over the target is used only when it is no longer than the shortened script it replaces (review.md says so), otherwise it is not used: the shortened script is kept, voiced, and review.md says so. The finished video is the voice plus the 2.5 s ending tail (default `tail` in show.json; the music fades out after the last word), so about 57.5 to 62.5 s for a 55 to 60 s voice, 64.5 s at the very most (62 s voice plus the tail). The writer only re-voices when the script text changed
   (`voice.stats.json` keeps a fingerprint, also of the long script a shorten replaced), so a resumed run
   never voices again and keeps the same word times. The voice files on disk always belong to the script
   in `script.txt` and `review.md`: if a resumed run ends up keeping the long script after all (for
   example the shorten reply was removed and answered badly), the long script is voiced again.
   Length limits: a script already at the 180-word floor is not shortened. If the voice is still over 60 s afterwards, up to 62 s is accepted (`voice_note` in `writer.json` and `review.md` says "ACCEPTED, a little over the limit"); more than 62 s fails the run (exit 1, `error` says the voice is too long). The limits are compared at the two decimals printed (62.004 s counts as 62.00 s). A shortened script, or a beat rewrite after a shorten, with fewer than 175 words (the 180-word floor minus a tolerance of 5, `WORD_FLOOR_TOLERANCE`, because the model counts approximately) is rejected in code: the earlier script is kept and `voice_note` (shorten) or the beat note (rewrite) says so; no extra model call is made.
4. **Storyboard** (setting `storyboard`, on by default; off = the old steps exactly). Strict scripting of
   the pictures before the show is built, because one blind show call used to decide everything.
   - `storyboard` call (`storyboard_system.md`, `storyboard_user.md`): gets the voiced sentences with their
     start and end times, the beat list and the prop and environment names. It replies with JSON: the hook
     question, the one-sentence answer, the hero prop, a plain summary, the scenes, and for EVERY sentence its
     scene, the objects on screen (catalogue prop, look, place, what it stands for), the change, the camera,
     on-screen texts (`words`, the phrase that `starts` it, the sentence at whose start it `ends`, at least
     2.5 s on screen) and flows (`what`, `by` which prop, `from` and `to` prop names), plus the ending (closing
     question, comment line, what the picture does in the 2.5 s tail). An object the catalogue cannot draw well
     is a gap: `{"missing", "stand_in", "central"}`.
   - A code check (`storyboard_problems`): one entry per sentence; hook and answer not empty; hero is a prop
     the board uses (or a central gap's name); every ending field filled; objects on every sentence (at most 2
     in the first shot); a "change" on every sentence; catalogue prop names (and gap stand-ins); text 1 to 40
     characters, its phrases found in their sentence, on screen at least 2.5 s (`TEXT_MIN_SECONDS`); each
     flow has "from" and "to" (catalogue props or props on the board) and a catalogue prop in "by". Problems
     here go straight to a repair, with no review call.
   - `storyboard-review` call (`storyboard_review_system.md`, `storyboard_review_user.md`): a separate,
     skeptical story editor checks (a) that each sentence's picture matches its words and the pictures alone
     tell the same story, (b) that the hook question is answered, (c) every named object is shown or a gap,
     (d) flow directions, (e) text kept long enough, (f) supporting props, (g) the ending, (h) central gaps. It
     replies `{"verdict": "pass" | "problems", "problems": [{"sentence", "kind", "what", "fix"}]}`. "pass"
     wins even when it lists points: they are kept as notes.
   - Problems: `storyboard-repair1`, then a new review, then `storyboard-repair2` and a review
     (`storyboard_repairs`, default 2; `storyboard_repair_user.md`). Still problems: the run fails (exit 1,
     status `failed`, `error` lists the problems left).
   - A gap with `"central": true` in the approved storyboard stops the run like a `feasible: false` script
     (NEEDS-PROPS.md, exit 3, the runner queues the topic in `queue/needs-props/`); so does a last
     storyboard that still has problems but also a central gap (it cannot be built anyway), but only when that
     last reply was readable: if the last repair reply was not, the older board is saved (storyboard.json says
     `last_reply_unusable`) and the run fails with exit 1 instead. Other gaps use their
     stand-in and are listed in `writer.json` `props_wanted` and in review.md's storyboard section.
   - `storyboard.json` (the plan plus the last review) and `storyboard.md` (a shot-by-shot plan to read) are
     written in the show folder, also when the run fails.
5. **Show.** The model gets the show rules, the compact catalogue (now including dials, bindings,
   continuing shots, `until` ramps and the camera's `fill` and `glide`), one worked example (the
   chameleon video), the script as numbered sentences with every word's start time, the beat list and, when
   the storyboard step ran, the approved storyboard as the source of truth.
   The rules ask for 2-4 main scenes (runs of `continue` shots) instead of a new room per sentence, a
   hero prop that stays, at least one dial bound to two or more things, cause and effect in the same
   frame, labels that only name parts, and nothing unchanged for more than 3.5 s. Pulse and shake are
   emphasis only (at most 3 pulses and 2 shakes in the video, a camera shake counts), particle clouds
   hold still between the words that need a change, and each scene adds 1 or 2 supporting props.
   Its reply is written to `show.json` and checked with
   `node tools/validate.mjs --story-rules` (SPEC section 14: every sentence needs a change, no still
   stretch over 3.5 s). The writer accepts a show only with no errors, neither of the checker's
   subject warnings (`story.scenes`: more than 6 scenes; `story.subject`: no prop on screen for 30% of
   the video) and at least one dial bound to two or more things in one scene (`story.dial`, checked in
   `writer.py`). With a storyboard it is also checked against it (`coverage_problems`, tolerant on
   purpose): every storyboard prop type (or a gap's stand-in) is in the show; every storyboard text is a
   label, text or count that shows it. The PROMPTS ask for a text held until the next sentence for every
   spoken number with a unit, and a count only for a number without a unit. The CHECKER is more tolerant
   and also accepts a count. For example "2000 °C" is covered by the text "2000 °C" or "2000", or by a
   count to 2000 with unit "°C" or " degrees" (see `_overlay_tokens` and `text_covers` in `writer.py`).
   The checker rule: every number of the planned text must be in one overlay, and the number alone is
   enough; units like °, degrees, C, % and percent are one token; text without numbers needs 70 percent of its whole
   words in one overlay in order, so "0" never covers "2000 °C" and "hot" never covers "hotter"; a text in the last
   sentence may stay until the voice end plus the 2.5 s tail,
   starting within 1.5 s of its phrase and not gone more than 0.5 s before its `ends` sentence (the same words
   again in the next shot count as kept up, since a label, text or count ends with its shot; the times come from
   `validate.mjs --json`'s `overlays` list); and a wire, arrow or beam the storyboard gives a `from` and `to`
   does not run the other way (an end is tied to a prop by its id, or by an [x, y, z] point within 1 unit of
   the prop's x and z). These problems have paths starting with `storyboard.`. Otherwise the model gets its previous show plus those messages and must send a
   corrected full file: up to `max_repairs` (3) repair rounds. Other warnings of the accepted show are
   listed in `review.md`. A reply that is not valid JSON
   (after removing one code fence) counts as a failed round, and so does an API failure (refusal, answer
   cut off, outage after retries).
6. **Picture check.** `node tools/qa.mjs <slug>` draws the show. If the result is `fail`, the model gets one
   repair round with the findings; the new show is validated and checked again, and the better of the
   two is kept. Still failing: the run is marked `qa: fail` (the runner decides what to do). If Chrome or
   2 GB of free memory is missing, QA is `not_run`.
7. **Fallback.** If no reply validated, `pipeline/fallback.py` builds a plain show from the words alone
   (one shot per sentence or two, rotating environments and safe props, a prop the words name when the
   catalogue has it, 1-3 key words as text). It validates for any script (tested on 50 random scripts),
   but it is a slideshow, so it is checked WITHOUT the story rules and marked
   **"fallback: not good enough to publish"** at the top of `review.md` and in `writer.json`
   (`fallback_note`). The runner fails such a topic (`queue/failed/`) and never renders it for upload
   or uploads it; `python -m pipeline.run --allow-fallback` renders it for a local test only.
8. **Review files.** `review.md` and `writer.json` (below).

## The two modes

- **files** (the default; free). Every model call writes the exact prompt to
  `shows/<slug>/llm/<nn>-<purpose>.prompt.md` (system part, then user part) and waits for
  `shows/<slug>/llm/<nn>-<purpose>.reply.md`. When the reply file is missing the writer prints which file
  it is waiting for and exits with code 4. Write the reply (only the answer, e.g. the JSON) and run the
  same command again: earlier replies are replayed from disk and the run continues. This is how Jacob
  can make a video with his Claude subscription: a Claude Code agent reads each prompt file and writes the
  reply file. Purposes in order: `script`, (`script-rewrite`), `audit`, (`script-redraft`,
  (`script-rewrite`), `audit-redraft`), (`shorten`, (`script-rewrite`), `audit-shorten`), `storyboard`,
  `storyboard-review`, (`storyboard-repair1`, `storyboard-review`, `storyboard-repair2`, `storyboard-review`),
  `show`, (`repair1`..`repair3`), (`qa-repair`); `script-rewrite` happens at most once; a storyboard repair
  whose code check fails is followed by the next repair, not a review; with `storyboard: false` the four
  storyboard purposes never appear. The file names start with a two-digit call
  number (`01-script`, `02-audit`, `03-storyboard`, `04-storyboard-review`, `05-show`); the number counts the
  calls actually made, so skipped optional steps leave no gap and a step that runs shifts every later number
  (`storyboard-review` appears once per review, each with its own number). Token counts in this mode are characters / 4.
  To start again from a step, delete that reply file and every later one.
  The agent playing the model must read every line of each prompt file, including the whole worked
  example and its OUTPUT JSON. A read tool in this setup replaced long reads with summaries, so read
  in chunks (for example under 100 lines). A re-test that skipped the example made a slideshow, while
  the same show step redone after the full read followed one subject.
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
| `max_seconds` | `60` | the voice should end before this; up to 2 s over is accepted with a note, more fails the run (the 2.5 s ending tail then makes the video 64.5 s at the very most) |
| `voice` | `en-US-AndrewNeural` | Edge voice |
| `rate` | `+12%` | Edge speaking rate |
| `fallback_seed` | `0` | which variant of the fallback show |
| `storyboard` | `true` | plan and review every sentence's picture before the show call (step 4); `false` gives the old steps exactly |
| `storyboard_repairs` | `2` | storyboard repair rounds after a failed review or code check; still failing ends the run (exit 1); only a whole number counts (anything else gives 2), below 0 gives 0 |

## Exit codes

| code | meaning | files written |
|---|---|---|
| 0 | a valid show was written (by the model, or the fallback) | everything |
| 1 | failed (script reply unusable, voice failed, API error, storyboard still failing its review after the repairs; an unreadable, refused or cut-off storyboard or review reply counts as a failed round and uses one of the repairs, so it only fails the run when no repair is left) | review.md, writer.json (with `error`), storyboard.json and storyboard.md whenever the storyboard step ran and failed, even when no storyboard ever parsed (then storyboard.json holds only `{"review": ...}` and storyboard.md says "No usable storyboard was written.") |
| 2 | bad command line (missing `--topic`/`--slug`, bad slug) | nothing |
| 3 | the topic needs props the catalogue lacks (a `feasible: false` script reply, or a central gap in the approved storyboard) | NEEDS-PROPS.md, review.md, writer.json (plus storyboard.json and storyboard.md for a storyboard stop) |
| 4 | files mode: waiting for a reply file | the prompt file for the step it waits at, plus whatever earlier steps already made (`script.txt`, `voice.mp3`, `words.json`, `voice.stats.json`); an old writer.json, NEEDS-PROPS.md, review.md, storyboard.json and storyboard.md are deleted when the run starts; if the run stops at a storyboard repair or review call, the storyboard.json and storyboard.md of the earlier failed round are on disk (the next run deletes them) |

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
 "needs_fact_check": false, "voice_seconds": 41.5,
 "voice_note": "empty text normally; says if the voice was shortened or accepted a little over 60 s",
 "mode": "api", "model": "claude-sonnet-5-5",
 "tokens": {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0},
 "cost_usd": 0.13, "cost_is_estimate": false,
 "storyboard": {"verdict": "pass | problems", "repairs": 0, "notes": ["S3 (text): ..."]},
 "props_wanted": [{"missing": "an ocean with a tide line", "stand_in": "water_drop", "sentence": 4}],
 "calls": [{"purpose": "script", "...": "..."}], "error": null}
```
`storyboard` is null when the step is off; `props_wanted` lists the non-central gaps (drawn with their stand-in)
for the prop-building backlog.
`writer.json` exists only after a finished run (exit 0, 1 or 3). `review.md` has the same facts in words,
the script, the picture plan (beat list), the storyboard's last review (verdict, repairs, notes or problems
left) with a "Props wanted" list, the claims as a tick list, the fact-check verdicts, how the
show was made, the checker's warnings on the accepted show, QA findings and a cost table per call.
When a not-feasible stop comes before any script was accepted, `writer.json` leaves out title, description, tags and beats, and `review.md` says "No script was accepted".
A run removes an old `writer.json`, `NEEDS-PROPS.md`, `review.md`, `storyboard.json` and `storyboard.md` when it starts.

## Changing the prompts

All model-facing text is in `pipeline/prompts/`. Edit it there; no code change is needed. The only sentences typed in `writer.py` are the short problem lines the code check adds to a repair prompt (for example "your last reply could not be read: ..." and the storyboard coverage misses).
- `script_system.md`, `script_user.md`: the script shape and rules (hook, one mechanism, length, facts),
  the beat list, the feasibility rule and the JSON shape. `{{CATALOG_NAMES}}` is filled with prop and
  environment names and what each prop can vary. `script_rewrite_user.md`: the one send-back when a
  sentence has no showable change. `script_redraft_user.md`: the fact-check redraft (current script and
  beats plus the corrections).
- `show_system.md`: the heart. How the engine works, a "how to think" procedure (the chain and the hero ->
  2-4 scenes -> dials -> a change in every sentence -> emphasis only (pulse, shake) -> clouds hold still
  -> variety (supporting props) -> cause and effect together -> JSON), the checker's
  rules (story rules included), picture rules, a short "good to know" list (ring radius and tilt, flat
  particle rings, bars, the planet's own turn, circuit wires, particles inside a prop, a held text for
  every unit number), a checklist.
  `{{CATALOG}}` is filled from `kit/catalog.json` by `pipeline/catalog_text.py`; `{{EXAMPLES}}` with the
  examples; `{{TEXT_SECONDS}}` from `TEXT_MIN_SECONDS` in `writer.py`.
- `show_user.md` (gets the beat list as `{{BEATS}}` and the approved storyboard as `{{STORYBOARD}}`, which is
  empty when the step is off, else `show_storyboard.md` with the board in `{{BOARD}}`), `repair_user.md`, `qa_repair_user.md`, `shorten_user.md`: the per-call parts.
- `storyboard_system.md`, `storyboard_user.md`, `storyboard_review_system.md`, `storyboard_review_user.md`,
  `storyboard_repair_user.md`: the storyboard step. `{{CATALOG_NAMES}}` is the same list as in the script
  prompt; `{{TEXT_SECONDS}}` (also in `show_system.md`) and `{{TAIL}}` (the two storyboard files only) are
  filled from `TEXT_MIN_SECONDS` and `TAIL_SECONDS` in
  `writer.py`, so the seconds never drift (a test checks that no "2.5" is typed into these two files). The
  templating is plain `{{NAME}}` replacement with no includes, so the few planning facts (stage directions,
  wire direction, battery and bulb heights, the planet's own turn) are copied word for word from
  `show_system.md`'s "good to know" list; `test_planning_facts_are_the_same_in_the_storyboard_and_show_prompts`
  fails when one copy changes without the other.
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
| show user part (words with times + beat list, 60 s script) | ~1,500 |
| script system prompt (rules + beat list + prop/env names); 14,064 characters, was 11,964 | ~3,500 |
| fact-check prompt | ~1,100 |
| a show reply (compact JSON, 3-4 scenes with dials; the chameleon example is ~4,300) | ~2,500 to 4,500 |

Assumed per call: thinking about as long as the visible answer (it is billed as output). Prices from the
claude-api skill (2026-11-03): Sonnet 5.5 $2 in / $10 out / $0.10 cache read / $2.50 cache write per
million tokens; Haiku 5.5 $0.10 / $0.50 (cache rates assumed 0.1x and 1.25x).

| per video | Sonnet 5.5 (default) | Haiku 5.5 |
|---|---|---|
| typical (show valid first time, no rewrite, no redraft): script with beats ~$0.035, audit ~$0.02, show ~$0.12; plus the storyboard step below (on by default) | **about $0.18**, about $0.28 with the storyboard | about $0.009, about $0.014 with the storyboard |
| the one script rewrite (a sentence with no showable change) | about +$0.03 | about +$0.002 |
| each extra repair round (system read from cache, previous show + errors resent) | about +$0.10 | about +$0.005 |
| worst case (rewrite + redraft + 2nd audit + shorten + audit-shorten + 3 repairs + QA repair) | about $0.70 without the storyboard step; about $0.95 with it (estimate: storyboard + review + 2 repairs with 2 more reviews, about +$0.25) | about $0.035; about $0.05 with it |
| the storyboard step (2 calls when the first review passes, 4 with one repair (storyboard, review, repair1, review): storyboard ~$0.06, review ~$0.03, the storyboard in the show prompt ~$0.004) | about +$0.10 | about +$0.005 |
| each storyboard repair (repair + another review) | about +$0.08 | about +$0.004 |

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
