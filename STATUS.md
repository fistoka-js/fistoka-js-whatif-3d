# STATUS

Last updated: 2026-11-11, about 23:30 local (04:30 UTC 12 Nov). Task numbers match PLAN.md.
Work paused here because the 5-hour Claude usage window reached 87% (weekly: 25%). The window resets at 08:10 UTC on 12 Nov (about 03:10 local).

## Done
- Audit: `AUDIT.md`. Decision and plan: `PLAN.md`. Contract: `docs/SPEC.md`. Items for Jacob: `DECISIONS-FOR-JACOB.md`.
- **Task 1, engine core** (commit `55f24da`). A page that plays any show file; shots, phrase anchors, 18 actions, a camera that frames props by itself above the captions, captions, labels/text/counters/icons, a checker with readable errors, tools for stills, timeline and catalogue. Starter catalogue: 7 props (ball, box, planet with 6 looks, sun, particles, arrow, beam) and 3 environments (space, studio, sky).
  - VERIFIED by me: 81 of 81 tests pass; the demo show passes the checker; I looked at the demo contact sheet.
  - Helper's measurement, not re-run by me: 56 to 102 ms per frame at 1080x1920 with software graphics (about 10-18 frames a second, faster than the old kit); frames are pixel-identical between runs.
- **Task 2, audio** (commit `ac00cac`). Edge voice with exact word times (no Whisper), 9 own-made sound effects, mix to -16 LUFS, mux without re-encoding the video. VERIFIED by me: 28 tests pass.

## Not started
- Task 3: full video render tool (MP4) and prop gallery tool. **Next step.**
- Task 4: the prop library (about 30 more props, more environments).
- Task 5: automatic picture checks (QA).
- Task 6: the writer (topic → script → show file) with repair loop.
- Task 7: pipeline runner, private upload with wrong-channel guard, GitHub workflow.
- Task 8: finished sample videos.
- Task 9: README, authoring guide, one-page "how it works", "how to ask Sonnet or Opus".

## What you can look at now
- New kit, demo "Why is the sky blue?" as a grid of frames (stills only, no video yet):
  `E:\Youtube Project\whatif-3d\shows\demo-sky\out\stills\sheet.jpg`
- Old kit, same topic, for comparison: `E:\Youtube Project\_fable_work\out\sky-blue-head-sheet.jpg` and the video `sky-blue-head.mp4` beside it.
- To watch the demo play with sound in a browser: in a terminal, `cd "E:\Youtube Project\whatif-3d"`, then `node tools/serve.mjs`, and open the address it prints followed by `/kit/index.html?show=shows/demo-sky`.

## Known problems
- **No finished video exists yet from the new kit.** Only stills.
- The demo is a feature test, not a finished explainer: with 7 props it uses balls and boxes as stand-ins (a red ball on the sea, pink boxes for "pinball").
- Labels do not yet avoid each other or the props. Wide layouts leave the lower half of the frame empty. The grass ground is plain; the sunset desert is very orange. (Helper's list; the last two I have not looked at closely.)
- Nobody has listened to the sound effects.
- `pipeline/mix.py` needs ffmpeg 7 or newer; GitHub's Ubuntu runners may ship an older one (unchecked).
- Music loops with a hard cut if the track is shorter than the video.
- No paid LLM call has been made; cost per video ($0.05-0.12) is an estimate.
- GitHub runner render time is not re-measured.
- Nothing is pushed. Both this repo and the old 3D repo exist only on this PC (DECISIONS-FOR-JACOB.md items 1 and 2).

## How to continue (for Jacob, or any model picking this up)
Say: "Continue PLAN.md from task 3. Read STATUS.md, docs/SPEC.md and docs/HELPER-RULES.md first."
Tasks 3, 4 and 5 can run in parallel (they share no files). The "how to add a prop" recipe is in docs/SPEC.md.
