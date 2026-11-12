# PLAN (written 2026-11-11 by Fable)

## The decision

**Change substantially, in a new folder.** New repo: `E:\Youtube Project\whatif-3d` (local git, nothing pushed).

- The old 3D repo (`youtube-3d-pipeline`) is left exactly as it is. The approved chameleon video keeps working there. Another session's unfinished sky-blue work is untouched.
- The Pexels repo is never touched.
- Proven ideas are carried over: narration clock, word anchors, a data file per video, a checker with readable messages, headless-Chrome rendering in chunks, the caption style.
- Replaced: the scene library. Why: see AUDIT.md sections 3 and 9 (1 of 36 topics without new code; a "Moon" that is a grey Earth).

## Trade-offs (honest)

| | Keep the old kit | New kit (chosen) |
|---|---|---|
| New topic cost | days of new scene code | a new data file, if the props exist; one small prop file if not |
| Chameleon video | plays as is | stays in the old repo; the chameleon model can be ported later as one prop |
| Work thrown away | none | the 12 scene modules and their tests are not reused (engine ideas are) |
| Risk | known code | new code with less mileage; mitigated by tests, picture checks and sample videos |
| Docs | 1,300-line README | short docs, catalogue generated from code |

What I am giving up: pixel-exact proof that nothing changed. In its place: unit tests, a determinism test, automatic picture checks on every render, and looking at real frames.

## How the new kit is shaped (one paragraph)

A video is a `show.json`: a list of **shots**. Each shot picks an **environment** (space, sky, studio...), places **props** (planet, sun, particles, arrow, label...) by slot name, gives one **camera** instruction (the engine frames the props itself, above the captions), and lists **actions** tied to spoken phrases ("when the narrator says 'vanished', the moon disappears"). The full contract is `docs/SPEC.md`.

## Tasks

Status is tracked in STATUS.md. "Working" = the test named here passes and I have looked at real output.

| # | Task | Who | Working means |
|---|---|---|---|
| 1 | Engine core: page, shots, anchors, actions, camera auto-framing, captions, overlays, checker, still tool, timeline tool, catalogue generator, starter props/envs, demo show | Opus | `node --test tests/` passes; demo show validates; I have looked at the contact sheet and it reads as 3D |
| 2 | Audio: Edge voice + exact word times, own-made sound effects, mix, loudness, mux | Sonnet | pytest passes; a mixed MP4 measures at the target loudness |
| 3 | Render tool (chunked, MP4) + prop gallery tool | Sonnet | a full 1080x1920 MP4 of the demo; time measured, also with 2 workers as a GitHub proxy |
| 4 | Prop library, in batches (space; earth and nature; micro and physics; everyday objects and figures; info-graphics) and more environments | Sonnet x3-4 in parallel | every prop appears in the gallery image and I have looked at it; catalogue regenerated |
| 5 | QA tool: black/frozen frames, props out of frame, text collisions, audio/video length, contact sheet | Sonnet | catches each deliberately broken test show |
| 6 | Writer: topic → script → show.json using the catalogue; checker-driven repair loop; safe fallback. Paid API calls are behind one function and mocked in tests | Opus or Sonnet | mocked tests pass; a helper acting as "the LLM" with only the real prompt produces a valid show for 2 topics |
| 7 | Pipeline runner + private upload with wrong-channel guard + GitHub workflow (manual trigger only) | Sonnet | dry run end to end with `--no-upload`; guard unit test refuses a wrong channel |
| 8 | Sample videos: sky-blue remake (direct comparison with the old one), one "what if", one more | me + helpers | MP4 paths in STATUS.md; QA passes; I have watched frames and measured audio |
| 9 | Docs for a weaker model: README, AUTHORING, HOW-IT-WORKS (one page), ASKING-CLAUDE, KNOWN-PROBLEMS | me + Sonnet | a fresh Sonnet helper adds a new prop and a new show using only the docs |

Order: 1 and 2 run now, in parallel (they share no files). 3, 4, 5 start when 1 lands. 6 and 7 after the catalogue has grown. 8 and 9 throughout.

## Rules I am working under

- Jacob's safety rules (secrets, no paid calls, no uploads, no push, only inside `E:\Youtube Project`). Every helper gets `docs/HELPER-RULES.md`.
- Helpers do not commit. I commit, staging files by name.
- Usage: I re-read the usage file before each batch of helpers and stop starting work near 90%.
- Anything needing Jacob goes in DECISIONS-FOR-JACOB.md and work continues around it.

## Cost per video (estimate until measured)

- Voice, render, mix, sound effects: free.
- LLM: script (about 1 call) + show file (about 1-2 calls of roughly 6k tokens in, 2-3k out). REASONED estimate: **$0.05-0.12 per video on a Sonnet-class model**, less on Haiku. Not measured: needs one paid test run that only Jacob can approve.
- GitHub minutes: to be measured in task 3; budget allows about 150 minutes per video.
