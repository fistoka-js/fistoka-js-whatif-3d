# Part 5 (the writer): open review problems

Fixed on 16 Nov 2026 (see the fix report); kept for history.

The writer change went through 5 of 8 review rounds with no clean pass; the loop paused at the weekly usage limit on 14 Nov 2026. These 6 problems from round 5 are NOT fixed yet. Fix them first next time, then restart the fixer and skeptic loop (fresh skeptics; clear count starts at 0).

## Round 5 report (word for word)

1. [BUG] `pipeline/prompts/script_rewrite_user.md` line 9, used by `writer.py` `check_beats` after a shorten (line 623).
   - When the beat check fails after a shorten, the rewrite prompt says "Follow every rule above". That includes the system prompt's "Length: 150 to 175 words". It also says "about the same number of words".
   - It never says that the shorten's word target wins over that floor, and it gives no target or time limit.
   - So a model can grow the shortened script back to 150 or more words. The writer voices it with no further shorten. It ends as "STILL TOO LONG" and still exits 0.
   - This breaks the agreed rule "the shorten step's word target wins over the 150-word floor". `shorten_user.md` line 6 says the exception, but the rewrite that follows it does not.

2. [BUG] `pipeline/writer.py` lines 158-159 (`NO_CHANGE`): common ways to say "no change" are accepted as real changes. Probe output (`in NO_CHANGE`, `CAMERA_OR_OVERLAY.match`):
   - `'stays the same' False False`
   - `'it stays the same' False False`
   - `'no visible change' False False`
   - `'nothing moves' False False`
   - `'remains still' False False`

   The prompt bans "stays", but "stays the same" passes. No rewrite is asked for, and the plan goes to the show call as if it were usable.

3. [NITPICK] `pipeline/writer.py` lines 203-207 (`sentence_matches`): the match is too loose to catch a shifted beat when sentences are short.
   - The substring test works on letters, not whole words, so beat "Ice." matches "Notice how it melts."
   - Half the words in common is enough: `sentence_matches('No dye.', 'No paint.', 1)` and `sentence_matches('It is light.', 'It is not paint.', 1)` both return `True`.
   - The chameleon script itself has "No paint. No dye. Just physics.", and shifting those beats by one is not caught.

4. [NITPICK] `pipeline/writer.py` lines 619-638: when the shorten reply has an empty `script`, `voice_note` stays "". It then becomes `"; STILL TOO LONG: ..."`, with a leading "; " and no word that the shorten gave no script.

5. [NITPICK] `pipeline/writer.py` line 878: the review.md heading "Picture plan (beat list from the script call)" is wrong when the beats came from a rewrite, redraft or shorten. In my dry run the beats shown were from the shorten reply.

6. [NITPICK] `pipeline/writer.py` lines 883-885: after a redraft and then a shorten, review.md says "Still flagged after one redraft:". But the flagged claims come from the `audit-shorten` of new shortened words, which were never redrafted.

**Out of scope notes**
- `pipeline/prompts/qa_repair_user.md` (not changed in this task) does not mention the story rules or the dial rule. A picture-check repair that breaks them is quietly thrown away and the earlier show is kept (`writer.py` lines 792-794).
- `pipeline/run.py`: the writer step skips on status `fallback` and refuses on status, while upload refuses on `fallback_note`. Today the writer always sets both, so this works, but the two checks use different fields.

## Round 8 report (16 Nov 2026, the review cap; NOT fixed yet)

Fixed on 16 Nov 2026 in one last fix pass (unreviewed), then committed.

Rounds 6 and 7 found more problems, all fixed. Round 8 was the 8th and last review round; the loop ended at the cap with no clean pass. These 7 are open:

1. [BUG] `pipeline/writer.py` L213-223 (`_CAMERA_LEAD`, `_CAMERA_MOVE`, `CAMERA_OR_OVERLAY`). The word "camera" is optional, and the beat's subject sits in its own field (the prompt's own example is "turns red"). So real prop changes written without the subject are flagged as "only a camera move". Probe results: `"tilts up"`, `"pulls back"`, `"pushes in"`, `"cuts into the apple"` and `"cuts"` all give `is_camera_or_overlay_only=True`. `"the lever tilts down"` gives False. A lever tilting up or a muscle pulling back is a real prop change, so this spends the one rewrite on a false alarm. That breaks the rule that a real prop change must never be flagged. `"orbits around the sun"` is also called a camera move instead of idle motion, so the message is wrong.

2. [BUG] `pipeline/writer.py` L694 with L756-758 and L1109-1118. Sequence: a run is shortened, then the user resets in files mode, and the beat rewrite after the shorten answers `feasible: false`. On that run, `_voice_if_needed(long)` reuses the stats saved under `shortened_from` and does not voice again, but it still writes the long script to `script.txt`. Then the run stops with exit 3. What I saw: `script.txt` had 150 words while `words.json`/`voice.mp3` had 130 words. `review.md` shows the long script, and an old `show.json` is still listed under Files. This breaks the rule that the voice files on disk always match the script that `review.md` describes. Only the success path does the exact voicing again (L732).

3. [NITPICK] `pipeline/writer.py` L623. A rewrite after a shorten is dropped when it is over `target`, but the shortened script itself is never held to `target`. A 140-word shorten (target 131) is kept, while a 135-word rewrite of it would be thrown away as "over the limit".

4. [NITPICK] `pipeline/writer.py` L180-181 (`_WORD`). It refuses any word ending in "ing", so plain nouns are refused too. Probe: `"the spring stays still"`, `"the wing stays still"`, `"the building sits still"` and `"the ring spins"` are all not flagged. `"the drop stays the same"` and `"the earth spins"` are flagged.

5. [NITPICK] `pipeline/writer.py` L993. The "Stopped for props" sentence starts in lower case.

6. [NITPICK] `pipeline/prompts/script_system.md` L47 says environments are tagged `[can follow a dial: ...]`. `writer.catalog_names` (L351) actually prints `[can follow a dial (dialParams): ...]`.

7. [NITPICK] `pipeline/prompts/script_system.md` L26 says "a sentence ends at . ? or !" but does not warn against abbreviations. `script_sentences("…U.S. scientists agree!")` returns `['U.S.', 'scientists agree!']`. So a script containing "U.S." or "Dr." gets a wrong beat count and uses up the one rewrite.

Out of scope notes (round 8):
- `pipeline/prompts/show_system.md` L40 says "label text up to 32 characters" and L77 says "under 22 characters" (older lines).
- `tools/lib/story-rules.mjs` L36: the JS sentence split does not count curly closing quotes or "…" as sentence ends, but the Python `sentences()` now does, so S numbers and story-rules sentence indexes can disagree.
