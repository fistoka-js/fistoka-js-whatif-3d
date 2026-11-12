# Brief: the writer (topic → script → voice → show.json)

For a helper agent. Read `docs/HELPER-RULES.md` first and obey it exactly. Then read `docs/SPEC.md`, `docs/AUDIO.md`, `docs/QA.md`, `kit/catalog.json`, `tools/validate.mjs` (its `--json` output), and one finished show (`shows/demo-sky/show.json`).

You own: `pipeline/llm.py`, `pipeline/writer.py`, `pipeline/prompts/**`, `pipeline/catalog_text.py`, `pipeline/fallback.py`, `tests/py/test_writer*.py`, `tests/py/test_fallback.py`, `tests/py/test_catalog_text.py`, `docs/WRITER.md`. Do not edit anything else. No paid API call may happen in your session: everything is tested with a fake LLM.

## What it does

`python -m pipeline.writer --topic "What if the Moon disappeared?" --slug moon-gone [--mode api|files]`

1. **Script call.** Input: the topic, the list of prop and environment names with their one-line summaries, and the script rules. Output (JSON): `title`, `script`, `description`, `tags`, `feasible` (true/false), `missing` (things it wanted to show that the catalogue lacks), `claims` (the factual claims made, one per line, for the human reviewer).
   Script rules to put in the prompt: 110 to 150 words (the video must end under 58 s); the first sentence is a hook that states the question or a surprising fact; short spoken sentences; one idea per 5-8 s; every sentence should be showable with catalogue props (name concrete things); pauses come from punctuation (full stops, commas, dashes); numbers written the way they should be spoken; no "subscribe" filler longer than one short closing line; no claims the model is not confident are true, and hedge honestly where science is uncertain ("probably", "scientists think"). "What if" topics must stay grounded in real physics/biology.
   If `feasible` is false: write `shows/<slug>/NEEDS-PROPS.md` with the `missing` list and stop with exit code 3.
2. **Voice.** Call `pipeline.voice.make_voice` (free Edge TTS) → `voice.mp3`, `words.json`. If the voice is longer than 58 s, ask the LLM once to shorten the script by the needed number of words, then re-voice. (In tests, voice is faked.)
3. **Show call.** Input: the compact catalogue text (see below), the show-format rules, one or two complete example shows, and the script as numbered spoken words with times. Output: the full `show.json` only.
   Guidance to put in the prompt: 6 to 10 shots; a new shot at least every 8 s; every shot has a clear main subject, at least one action, and a camera move; change environment or subject between neighbouring shots so the video does not look templated; use `label`, `text`, `count` and `icon` sparingly (at most 2 overlays at once, label text under 22 characters, in capitals); anchor phrases must be copied exactly from the spoken words, 2-4 words long, and must be inside the shot; prefer slots over coordinates; put one or two props per shot, three at most; pick colours that contrast with the environment; never rely on text to explain what the picture should show.
4. **Check and repair.** Write the reply to `shows/<slug>/show.json`, run `node tools/validate.mjs shows/<slug> --json`. On errors: send the errors back with the previous show and ask for a corrected full file. Up to 3 repair rounds. A reply that is not valid JSON (after stripping one code fence) counts as a failed round.
5. **QA repair.** Run `node tools/qa.mjs <slug> --json`. If the result is `fail`: one repair round with the QA findings, then validate and QA again. Still failing → keep the best version, mark the run `qa: fail` in the review file (the pipeline decides what to do).
6. **Fallback.** If no valid show after the repair rounds: `pipeline/fallback.py` builds a plain but always-valid show from the script alone (one shot per sentence or two, environments and a few safe props rotated by a seeded choice, `text` overlays of 1-3 key words, varied camera moves). It must validate for any script: property-test it over many random scripts. Mark the run `show: fallback`.
7. **Review file.** `shows/<slug>/review.md`: title, script, the `claims` list for fact checking, description, tags, how the show was made (first try / repaired N times / fallback), QA result, token counts and estimated cost per call and in total, and the files produced.

## The LLM layer (`pipeline/llm.py`)

- One function: `complete(system: str, user: str, *, purpose: str, max_tokens: int) -> LlmReply(text, input_tokens, output_tokens, model)`.
- **Mode `api`**: the Anthropic Python SDK, key from the `ANTHROPIC_API_KEY` environment variable only (never read from a file, never printed). Before writing this, load the `claude-api` skill and use the current model names and prices from it; do not guess them. Model is a setting (default: the current Sonnet-class model; document a cheaper Haiku-class option). Use prompt caching for the long fixed part (catalogue + rules + examples) if the skill says it helps at this size. Log tokens and estimated cost. Retries with backoff on overload/rate-limit errors.
- **Mode `files`** (free, no API key; this is how the kit is tested and how Jacob can make videos through his Claude subscription): `complete` writes the exact prompt to `shows/<slug>/llm/<n>-<purpose>.prompt.md` and looks for `shows/<slug>/llm/<n>-<purpose>.reply.md`. If the reply file is missing it exits with code 4 and prints which file it is waiting for. Running the same command again continues from where it stopped. So a person or a Claude Code agent can act as the LLM by reading each prompt file and writing the reply file. The prompt files must be complete and self-contained (they are exactly what the API would receive).
- Tests inject a fake `complete`.

## The compact catalogue (`pipeline/catalog_text.py`)

`kit/catalog.json` is too long for a prompt. Generate a short text from it: one line per prop like `rocket(color, body: enum[...]) anim: thrust 0..1 — summary`, one line per environment, a short table of actions with their fields, camera options, slots, colour names. Target: under about 3,500 tokens for 70 props. Test that every prop, env and action in catalog.json appears in the text.

## Tests (pytest, fake LLM, fake voice, real `node tools/validate.mjs`)

- Happy path: fake returns a valid show → files written, review.md lists the claims.
- Repair: fake returns a show with 2 validator errors, then a fixed one → 1 repair round recorded; the second prompt contains the validator's messages.
- Non-JSON reply, then good.
- Three bad replies → fallback used, and the fallback validates.
- Fallback property test: 50 random scripts (different lengths, punctuation, repeated words) all validate.
- `files` mode: first run exits 4 and writes the prompt; after the reply file is added, the next run continues.
- Not-feasible topic → NEEDS-PROPS.md and exit 3.
- Cost arithmetic.

## Done means

All pytest tests pass (paste the summary line). `docs/WRITER.md` explains in plain language: the steps, both modes, every setting, what each exit code means, how to change the prompts, and the measured prompt sizes in tokens (estimate: characters / 4) with the resulting cost estimate per video for the Sonnet-class and Haiku-class models, clearly labelled as an estimate until a real run. Report under 400 words.
