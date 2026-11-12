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

## Round 2 finding (2026-11-12): the kit can show things, but not yet explain them

Jacob watched the first two sample videos and said the pictures do not match the script well and they are not as good as the chameleon video. I compared all three at one frame per second (frames only; I did not listen). VERIFIED by looking:

- **Chameleon:** one subject (the crystal lattice) stays on screen for 20 seconds and changes on each clause. A single number, keyed at 13 spoken words in the prototype's code, drives the lattice spacing, its colour, the small chameleon's skin, the light wave and the background.
- **Our samples:** a new object for each sentence, which then sits still for 4 to 6 seconds (a person standing while the narrator talks about stars; a white sun; a bar chart; a sailboat for "why is the sky blue"). The scripts have the same fault: a list of separate facts, not one chain of cause and effect.
- The automatic picture check gave sky-blue a "pass". It checks framing and collisions, not whether the picture follows the words.

**What I got wrong:** I measured the kit by how many topics need no new code. That is only half the test. The other half is whether the kit can do what the approved video does. It cannot yet: the show format has no way to keep a subject across shots, no shared value that several things follow, and no change that runs from one word to another.

**Decision:** add those three things to the engine (additions, not another restart; the props, environments, render, audio and pipeline all stay), port the chameleon video's own mechanisms (lattice, skin layers, light wave, tuner) from the old kit, and prove it by **rebuilding the chameleon video in the new kit and comparing it second by second with the approved one**. Then teach the writer to plan script and pictures together around one mechanism, and add checker rules that fail a slideshow. Full brief: `docs/briefs/round2-improvements.md`.

**Honest limit:** the chameleon video's quality came from code written for that one topic. A kit gets close only for topics whose central mechanism exists as a prop. Topics without one should be set aside, not faked with icons. See DECISIONS-FOR-JACOB.md item 7c.

Order now: round 2 parts 1-5 → three new samples → task 9 docs.
