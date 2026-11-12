# AUDIT of the 3D video work (written 2026-11-11 by Fable)

Labels: **VERIFIED** = I ran it or read it myself this session. **REASONED** = worked out from verified facts. **OPINION** = my judgement. **RESEARCHED** = a helper looked it up on the web today; source given; not re-checked by me.

## 1. What I looked at

- Pexels repo (`youtube-shorts-pipeline`): folder listing and git file list only. Nothing changed. VERIFIED.
- 3D repo (`youtube-3d-pipeline`) at commit `49100d9`, plus 7 files changed but not committed by another session (saved as `E:\Youtube Project\_fable_work\other-session-uncommitted.patch`, 1,215 lines; I did not touch that working folder). VERIFIED.
- Code read: engine `core.js`, `timeline.js`, the page, the render tool, both storyboards, the sky-blue plan, handoffs 00, 04, 05, the feasibility list.
- Videos: the approved chameleon render, the old sky-blue render, and a fresh render of the current committed sky-blue that I made myself (`_fable_work\out\sky-blue-head.mp4`). I looked at frame grids of all three and measured loudness.
- Web research on policy, licences and GitHub limits (section 7).
- Not available to me: the Claude Project "Youtube Automation" notes (they are not on this disk).

## 2. What is good (keep these ideas)

1. **Time comes only from the narration clock.** `window.__renderAt(t)` draws any frame on demand, so renders are repeatable. VERIFIED (render of 1,642 frames, no page errors).
2. **Word anchors.** Things happen "when this word is spoken", so a new voice does not break timing. Sound idea. VERIFIED in the storyboards.
3. **The render tool works.** Headless Chrome, software graphics, frames piped to ffmpeg, split into parallel chunks. Current sky-blue (54.7 s, 1080x1920) rendered in 152 s on this PC. VERIFIED. The "24 minutes on a 2-CPU GitHub runner" figure is inherited from the handoff, not re-measured.
4. **A storyboard data file plus a checker with readable error messages.** Right direction.
5. **The chameleon video looks good.** Solid lit character, coloured backgrounds, labelled layers, clear story. OPINION, and Jacob approved it.
6. **Captions** (4 words, active word yellow) are clean and readable. VERIFIED by eye.

## 3. The main problem: it is not yet a kit

**Each scene type is really one moment of one video.** VERIFIED from the repo's own documents:

- `kit/topics-feasibility.md`: with the library as built for the chameleon, **1 of 36 topics** needed no new code, and that one was the chameleon itself.
- The second topic (sky blue) needed **4 new scene modules and 2 new assets**: about 1,900 lines of scene code, plus tests and schemas, over roughly three days.
- Scene types are named after story beats (`spectrum_split`, `path_compare`, `character_pair`), not after reusable things. `spectrum_split` can only ever show a prism or two waves. `interaction` must always have both an X and a "?" icon, so the sky-blue storyboard hides one at zero opacity.
- Chameleon leftovers are baked into every video: five fixed set names (A, S, L, T, P), a "legacy chameleon scene" that is always built, 1,200 chameleon stars.

**REASONED:** at this rate every new topic costs days of new code. Stage 4 ("an LLM writes the storyboard") cannot fix that, because the LLM can only choose among beats that already exist. The handoffs' cost estimate of $0.04-0.08 per video assumes the code already exists for the topic; it usually will not.

A helper is running one direct test of this (a third topic with zero new code). Result: see section 9.

## 4. Why sky-blue looks flatter than the chameleon

VERIFIED by looking at frames from both:

- Chameleon: a solid, shaded character fills the frame; backgrounds are coloured gradients; the layer stack has thickness and labels.
- Sky-blue, 10 s to 47 s (two thirds of the video): thin glowing lines, small dots and flat sine waves on a black background. They are drawn in 3D space but nothing in them shows depth: no solid lit object, no ground, no shadow, nothing near the camera, little camera movement.
- The newest commit improved the opening (sea, clouds) and the ending (a properly lit Earth). Those two parts now look 3D. The middle is unchanged.

**REASONED:** "3D look" comes from a short list of ingredients: solid objects with shading, a ground or backdrop that shows distance, shadows, haze, things passing near the camera, and a camera that keeps moving. The kit has no shared way to give every scene those ingredients; each scene module does its own thing. A real kit should supply them by default.

## 5. The voice: louder and denser

VERIFIED by measurement (ffmpeg loudness meter):

| File | Loudness | Length | Words | Words per second |
|---|---|---|---|---|
| chameleon voice | -32.4 LUFS | 61.1 s | 182 | 3.0 |
| sky-blue voice, as Edge made it | -20.3 LUFS | 54.7 s | 166 | 3.0 |
| sky-blue voice, after the other session turned it down | -32.4 LUFS | 54.7 s | 166 | 3.0 |

- The chameleon voice is the odd one out: -32 is very quiet (YouTube plays at about -14). The right fix is to bring **every** finished video to one target level in the final mix, not to turn new voices down to match the chameleon. REASONED.
- After the re-voice the two videos run at about the same word rate, so the "denser" feeling in the first sky-blue render was the old 51 s voice (3.2 words/s) and fewer pauses. Pauses come from punctuation; that is a script-writing rule, not an audio setting. REASONED.
- Word timings came from Whisper and had to be corrected by hand (`reconciliation.txt`). That blocks automation. Edge TTS can report exact word times itself; the experiment in section 9 tests this.

## 6. Process and maintainability

VERIFIED:

- `kit/README.md` is 1,323 lines (184 KB). `kit/reports/stage2-report.md` is 3,547 lines. A weaker model cannot hold these in its head, and neither can a person.
- About 9,000 lines of code and 12,000 lines of tests for two videos.
- The pixel-exact regression against the chameleon was the right tool for stages 1-2, but it now forces every change to keep chameleon quirks alive.
- The mandatory fixer/skeptic loop (up to 8 rounds per commit) produced careful code and very slow progress: one stage took about 6 hours by Jacob's account; the repo history shows stage 2 spanning 4 Nov to 9 Nov.
- Code style is very defensive (for example an edit-distance spelling helper inside the timeline). Each piece is fine; the total is heavy.
- Stage 4 (LLM storyboard, quality checks) and stage 5 (music, sound effects, loudness, workflow, upload, channel guard): nothing built. VERIFIED: no such files exist.
- The 3D repo has about 28 commits that exist only on this disk. A disk failure loses all of it. See DECISIONS-FOR-JACOB.md.

## 7. Outside facts (RESEARCHED today; sources in brackets)

**YouTube policy**
- "Inauthentic content" (renamed July 2025) is not monetisable: "mass-produced, generic, repetitive", including content that "looks like it's made with a template" and AI content made with "generic or unoriginal templates giving the impression of mass production". [support.google.com/youtube/answer/1311392]
- REASONED consequence: original animation helps, but **a kit is a template**. If every video is the same five scenes with different words, the kit itself becomes the risk. Defence: many props and environments, real per-topic visual variety, scripts with real substance, human review before publishing (already Jacob's rule), and a consistent *style* (voice, captions, colour) rather than a repeated *layout*.
- Disclosure label: not required for "fully animated" video. A fully synthetic narrator is not explicitly covered. [support.google.com/youtube/answer/14328491]
- Shorts monetisation: 1,000 subscribers and 10 million Shorts views in 90 days. New partner terms from 1 Feb 2027; details not found. Shorts over 60 s with claimed music are blocked from monetisation, so **keep videos at or under 60 s** or use music that can never be claimed. [answer/72851, answer/12504220]

**GitHub Actions**
- Free plan: about 2,000 minutes a month on 2-CPU private runners (now stated as $12 of compute; the minutes are arithmetic). Public repos: free, unlimited, and **4 CPUs / 16 GB** instead of 2 / 8. Job limit 6 hours. Artifact storage 500 MB. [docs.github.com/en/actions/reference/limits]
- REASONED: 13 videos x about 40 minutes = about 520 minutes a month, well inside the private allowance. A public repo (no music files in it) would render about twice as fast for free; that is a choice for Jacob, not a need.

**Edge TTS (the biggest licensing weak spot)**
- No Microsoft document licenses the Edge read-aloud service for commercial use; a Microsoft Q&A answer says it "could be a violation". The service has blocked old clients before (early 2026). [learn.microsoft.com Q&A 2088770; github.com/rany2/edge-tts/issues/458]
- Free alternative with a clear licence: Kokoro-82M (Apache-2.0), runs on CPU. Piper voices are not automatically safe.
- OPINION: keep Edge + Andrew for now (Jacob's choice, and the look/sound he approved), but make the voice step swappable and put the risk in DECISIONS-FOR-JACOB.md.

**Music and sound**
- The 3D repo's `music/` folder has 26 MP3s and **no record of where each came from or its licence**. VERIFIED (no ledger file). The same files are tracked in the public Pexels repo (VERIFIED with `git ls-files`); Pixabay's licence forbids standalone redistribution, which a public repo arguably is. RESEARCHED + REASONED. Jacob should know.
- Pixabay music can still receive Content ID claims. YouTube Audio Library tracks will not be claimed. [pixabay.com/service/license-summary, support.google.com/youtube/answer/3376882]
- Sound effects made by our own code have no licence risk at all. REASONED.

**YouTube upload API**
- Docs now list `videos.insert` in its own bucket of 100 uploads a day. Whether unverified API projects are forced to private is contradictory in the docs; irrelevant for us because uploads are private anyway. [developers.google.com/youtube/v3]

**three.js / Chrome**
- three.js 0.160 still works; latest is r187. Chrome is retiring the automatic software-graphics fallback; the explicit flags are needed. The render tool already uses software graphics successfully on this PC (VERIFIED: renderer string shows SwiftShader).

**3D models:** Kenney, Quaternius and Poly Haven are CC0 (no credit needed). NASA models need a credit line. Poly Pizza is mixed, per model.

## 8. Challenging the big assumptions

| Assumption | Verdict |
|---|---|
| three.js in headless Chrome | **Keep.** It works, it is free, it runs on GitHub. Blender on CPU would be slower and harder to drive from data; 2D tools would lose the 3D goal. REASONED. |
| Storyboard file + word anchors | **Keep the idea, change the shape.** Anchors by word-plus-occurrence-number ("the 3rd 'Blue'") are fragile; hand-typed camera coordinates are slow. Use phrase anchors and automatic framing. REASONED. |
| Scene-type library | **Replace.** Scenes-as-story-beats do not reuse. Use small building blocks instead: props (things), actions (what things do), environments (where), shots (how the camera looks). REASONED from section 3. |
| The 5-stage plan | **Drop the order.** It polishes two hand-made videos before proving a topic can be made cheaply. The cheap-new-topic proof must come first. OPINION. |
| Pixel-exact chameleon regression | **Retire it for new work.** Keep the old repo as the frozen home of the chameleon video. Use ordinary tests plus automatic picture checks. OPINION. |
| Two clean skeptic rounds per commit | **Too expensive as a default.** Tests plus looking at real renders catch more per hour. OPINION. |
| $0.04-0.08 per video | **Plausible only with a compact storyboard format** (an LLM writing about 1-2 thousand tokens, not 20 KB of keyframes). Unmeasured until Jacob approves one paid test run. REASONED. |
| 24-minute render | Fine for the budget even if the new look costs 2x. To be re-measured. |

## 9. Experiment: a third topic with zero new code

A Sonnet helper was asked to make "Why does the Moon have phases?" in a private copy of the old kit, changing no code. Files: `E:\Youtube Project\_fable_work\exp-third-topic\kit\storyboards\moon-phases\`.

- **The data-file approach works for a weaker model.** It produced a storyboard that passes the checker, including strict mode, after 2 rounds of error messages, in about 25-30 minutes. The checker's messages were clear. (Helper's report; I did not re-run its checks.)
- **The catalogue is the wall.** No Moon (it used the Earth tinted grey: the "full Moon" frame is a grey Earth with continents and teal coastlines; VERIFIED, I looked at the still). No free-standing Sun. The light direction cannot be aimed. Nothing can orbit anything. No labels or arrows. The Moon's spin cannot be stopped.
- The helper scored it 6/10; my own score from the still is 3/10 and not uploadable. OPINION.
- Authoring pain it reported: the 1,300-line README, counting word occurrences ("the 2nd 'The'": a wrong number was not caught when the time happened to be legal), hand-calculated camera numbers, and a hidden rule that chapters are mandatory.
- **Edge TTS gives exact word timings itself**: 100 script words in, 100 timed words out, in order; only trailing punctuation is dropped. So Whisper and the hand "reconciliation" step can go. Needs `boundary="WordBoundary"` in edge-tts 7.3.
- Process note: the helper said it used a throwaway script in its own scratch folder, which may have been outside `E:\Youtube Project`. Later briefs name the allowed scratch folder explicitly.

**Conclusion (REASONED):** keep the proven ideas (narration clock, word anchors, data file, checker, headless render). Replace the scene library with small reusable building blocks, automatic camera framing and phrase anchors. See PLAN.md.

## 10. What is missing for the goal

1. A reusable building-block library (props, actions, environments, shots) with a default "3D look".
2. A compact storyboard format an LLM can write reliably, with a strict checker and automatic repair.
3. Exact word timings without hand fixes.
4. Automatic picture checks (black, frozen, subject out of frame, text collisions).
5. Audio: one loudness target, music, sound effects, with a licence record for every file.
6. The pipeline around it: topic, script, voice, storyboard, render, check, mix, private upload with a wrong-channel guard, GitHub workflow.
7. Short documents a weaker model can actually use.
