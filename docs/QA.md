# QA: the automatic picture check

```
node tools/qa.mjs <slug> [--video path] [--json] [--step 0.5]
```

Opens the show once in the browser (540x960), draws it every `--step` seconds plus: every shot's middle, 0.1 s after its start,
0.1 s before its end, and 0.3 s after each action that has a prop (or is a `focus`). Then it applies the rules below.
Result: `pass`, `warn` or `fail`. Exit code 0 = pass or warn, 1 = fail (or the show cannot play), 2 = bad command.
Always written: `shows/<slug>/out/qa.json` and `shows/<slug>/out/qa-sheet.jpg` (one tile per shot middle, labelled with the shot id,
outlined red when the shot has a FAIL and yellow for a WARN). The human reviewer looks at the sheet.
If `--video` is not given and `shows/<slug>/out/<slug>.mp4` exists, the video checks run on it.
Runtime is about 10 to 20 s for a 55 s show.

## Reading the output

```
FAIL shot "pinball" at 28.4 s: prop "ball2" is 70% outside the frame (box x 900..1300 of 540, ...). Fix: move it toward the centre ...
```

Level, shot id, first time it was seen, what is wrong with the measured numbers, `(seen in N samples)` if it repeats, then a `Fix:` hint
written in show-file terms (`"at"`, `"size"`, `"until"`, camera `"framing"`). Repeats of the same problem are joined into one line.
`--json` prints the same as data: `{ result, samples, findings: [{level, code, shot, time, what, measured, fix, hits}], measured, files }`.
All numbers in boxes are pixels of the 540x960 sampling size.

## The checks (thresholds are in the table `T` at the top of `tools/lib/qa-rules.mjs`)

| code | level | meaning |
|---|---|---|
| `black` | FAIL | mean brightness under 5% of full scale for more than 1.0 s, and almost no bright pixels (under 0.15%) outside captions/overlays, so a dark space scene with a lit subject is not "black" |
| `frozen` | FAIL | samples 0.5 s apart differ by under 0.3/255 on average for more than 2.5 s; captions and overlays are masked out so changing captions cannot hide a frozen picture |
| `prop-outside` | FAIL | a prop that an action points at (or that is in the camera `focus`, at the shot middle) has under 60% of its box inside the frame. Not checked 0.3 s after `appear`/`disappear` (the prop is flying in or out), and not for beams/arrows (their box is a line's bounding box and they often leave the frame on purpose) |
| `prop-in-captions` | WARN | more than 40% of a prop's box is inside the caption zone (bottom 24%) |
| `subject-small` | WARN | at the shot middle, all visible props together cover under 6% of the frame (beams/arrows not counted) |
| `nothing-visible` | FAIL | no prop, label, text, counter or icon visible in any sample of a shot (the caption alone does not count) |
| `empty-stretch` | WARN | nothing visible for more than 1.5 s inside a shot |
| `text-overlap` | FAIL / WARN | two of label, text, counter, icon, caption overlap by 20% or more of the smaller box: FAIL if seen in 2+ samples, else WARN; 2% to 20%: WARN. Tilted `stamp` texts are shrunk to their real shape first |
| `text-outside` | FAIL / WARN | more than 5% of a text box is outside the frame (FAIL if seen in 2+ samples). The engine shrinks long text to fit, so this rarely fires |
| `label-covers-prop` | WARN | a label covers more than 35% of the prop it belongs to |
| `idle` | WARN | a shot with camera `still` or `drift` has no action for more than 7 s |
| `too-many-overlays` | WARN | more than 3 labels/texts/counters/icons visible at once |
| `video-length` | FAIL | video and `voice.mp3` lengths differ by more than 0.5 s |
| `video-size` / `video-fps` / `video-audio` | FAIL | not 1080x1920 / not 30 fps / no audio stream |
| `video-loudness` | WARN | integrated loudness (ffmpeg ebur128) outside -18..-13 LUFS; the measured value is in `qa.json` under `measured.video.lufs` |
| `show-invalid`, `video-missing`, `video-unreadable`, `page-problem` | FAIL / WARN | the show does not validate, `--video` file missing/unreadable, or the page logged an error |

## How the page is used

Only the documented hooks: `__ready`/`__error` (via `openShow`), `__boxes(t)` (props, labels, texts, counts, icons, caption), and the
screenshot after it. A label's own prop is found from its box id `<shot>:<action path>` (e.g. `myth:shots[0].actions[3]`) matched to the
resolved show (`kit/engine/show.js`, action `path`). If that id format changes, `label-covers-prop` and the readable names in messages stop working;
everything else keeps working.

## Adding a check

1. Write a pure function in `tools/lib/qa-rules.mjs`: `(show, samples, frame) => findings`. Make findings with `mk(level, code, shot, time, what, measured, fix, key)`;
   same `key` = joined into one line. Put every number in the `T` table with a one-line comment.
2. Call it in `runQa` in `tools/qa.mjs` (the `all = [...]` list). If it needs a new measurement per sample, add it where the sample is built (`sampleShow`).
3. Test it in `tests/qa.test.mjs` on made-up samples (see `sample(...)`, `box(...)`), and, if it needs a real picture, add `tests/fixtures/qa/<name>.show.json`
   (the test helper `qa(name)` copies it into a temporary `shows/qa-tmp-<name>/` folder with the demo voice and the first 24 demo words, 7 s).
4. Add a row to the table above.
