# Decisions for Jacob

Things only you can decide or do. Nothing here blocks the build; work continues around each item. Newest first within each group.

## Jacob's answers (received 2026-11-13). These are decided.
1. Old 3D repo: Jacob pushed it himself. DONE. Do not touch that working folder.
2. This repo: pushed on 13 Nov to the private repo `fistoka-js/fistoka-js-whatif-3d` (commits up to `bb86990`). Every later push needs a new yes.
3. Voice: keep Edge `en-US-AndrewNeural` at +12%. Keep the voice step swappable. If there is spare time, make a free Kokoro sample of the same script so Jacob can compare by ear. Do not switch.
4. Music: only YouTube Audio Library tracks that Jacob downloads himself, each with one line in `assets/music/LEDGER.csv`. TO DO for Claude: music files are git-ignored, so propose and document the simplest legal way for a GitHub run to get them (for example a private repo that holds the files, or a release asset), with the trade-off written here. Do not touch the Pexels repo.
5. Loudness: -16 LUFS for now, as ONE named setting. TO DO: make one short file at -16 and one at -20 from the same sample video so Jacob can compare by ear.
6. Length: voice capped at 60 s, plus a 2.5 s ending (video about 62 s; superseded 18 Nov, was 55 s). The writer enforces it.
7. Paid writer test: yes in principle, only after the round-2 samples look good. TO DO: prepare the single command for Jacob to run himself at the `!` prompt, with a cost estimate.
7a. Writer model: start in free "files" mode. TO DO: prepare, but do not run, two paid tests: (b) Haiku for script and fact check plus Sonnet for the show file, and (c) Haiku for everything. Also note how much of Jacob's weekly Claude usage one files-mode video takes.
7b. Yes: the workflow commits `shows/<slug>/` (script, voice, show file, review.md; no large renders). TO DO: make that workflow change.
7c. Topics the kit cannot show: automatic runs skip them and list what is missing in `queue/needs-props/`. TO DO: write a short ready-to-paste prompt Jacob can give a Sonnet or Opus Claude Code session to build the two most-requested missing mechanisms.
8. Second channel: later; Jacob creates it. Keep `docs/CHANNEL_SETUP.md` accurate and complete.
9. Stay on a private repo.
10. Project notes are exported to `E:\Youtube Project\notes\project-notes-3d-and-animation.md`. TO DO: check whether they change any conclusion in AUDIT.md.

Rules Jacob restated: work only inside `E:\Youtube Project`; never touch the Pexels repo; never read keys, tokens, `client_secret.json` or `.verticals\config.json`; no paid API calls, no YouTube uploads, and no pushes unless Jacob says yes in that session.

## New items for Jacob (13 Nov)

### 11. Does every change in this repo need the fixer and two-skeptic review?
- **What:** your rules file in the Pexels project says every file change goes through a fixer and then fresh reviewers until two in a row are clear. I assumed that also applies here, including to status notes like this one. It is thorough but costly: part 3b used about 85% of a 5-hour window (one build, two reviews, one and a half fix rounds) and is not finished.
- **Options:** (a) keep the full loop for everything; (b) full loop for code and show files, but status and decision notes are written by the lead with no review; (c) one review round instead of two clear runs.
- **Recommendation:** (b). Until you say otherwise I keep doing (a).

### 12. The remaining plan will probably not fit in this week's usage
- **What:** weekly usage is 76% and resets 16 Nov 09:00 UTC, about when I stop being available. Left to do: finish part 3b, part 5 (the writer), three samples, task 9 docs, and the leftovers above. Each review round costs about 2 weekly points and each build about 2-4.
- **Recommendation:** spend what is left in your priority order and accept that items 4 and 5 of that order (docs, leftovers) may not be reached. Item 11 option (b) or (c) would stretch the budget.

### 13. Commit part 5 (the writer) at the review count reached?
- **What:** part 5 used all 8 review rounds (the cap) with no clean pass. Round 8 found 2 bugs (a camera-move check that can flag real prop changes such as "tilts up"; a files-mode reset path where the voice files on disk can differ from the script shown) and 5 small problems, listed in `docs/briefs/part5-open-review.md`.
- **Recommendation:** one fix pass for those 7, a test run, then commit locally (no push), as was done for part 3b.
- **Answer (16 Nov):** yes — fix the 7, test, commit locally (no push). Done.

## Please do soon

### 1. Back up the old 3D repo (about 28 commits exist only on this PC) — DONE 13 Nov
- **What:** `youtube-3d-pipeline` has never been pushed. If the disk fails, the chameleon video's source and all of stages 1-3 are gone.
- **My recommendation:** push it (it is a private repo). I did not, because every push needs your yes, and another session has unfinished changes in that folder.
- **Steps:** in the session that owns that folder, commit or discard the 7 changed files, then at the `!` prompt:
  `cd "/e/Youtube Project/youtube-3d-pipeline" && git pull --rebase && git push`

### 2. Back up this new repo (`whatif-3d`) — DONE 13 Nov
- **What:** it is local only. It needs a GitHub repo, which I may not create (accounts and pushes are yours).
- **Recommendation:** create a **private** repo `fistoka-js/whatif-3d` on github.com (no README), then at the `!` prompt:
  `cd "/e/Youtube Project/whatif-3d" && git remote add origin https://github.com/fistoka-js/whatif-3d.git && git push -u origin main`

## Decide when you have time

### 3. Edge TTS has no commercial licence (risk, not an emergency)
- **What:** Microsoft has no terms that allow the Edge read-aloud voice in monetised videos, and one Microsoft answer says it "could be a violation". The service has also blocked old clients before. Both channels depend on it.
- **Options:** (a) keep Edge + Andrew and accept the risk; (b) switch to Kokoro (free, Apache-2.0 licence, runs on GitHub runners; different voice); (c) pay for Azure TTS with the same Andrew voice (from memory, not checked today: about $16 per million characters; a 60 s script is about 900 characters, so roughly 1.5 cents per video).
- **Recommendation:** (a) now, and listen to a Kokoro sample before monetisation matters. The voice step is built to be swappable.

### 4. Music files have no licence record, and they sit in the public Pexels repo
- **What:** `music/` (26 MP3s) has no list of where each file came from. Some names look like Pixabay downloads; Pixabay's licence forbids redistributing the files on their own, and a public repo arguably does that. Pixabay tracks can also get Content ID claims.
- **Recommendation:** for the new channel use only YouTube Audio Library tracks (never claimed), which you download yourself, with a one-line record each in `assets/music/LEDGER.csv`. In this repo music files are git-ignored. For the Pexels repo: your call; I have not touched it.
- **Until then:** sample videos here use tracks copied locally from the old 3D repo's `music/` folder, for your private review only.

### 5. Final loudness target
- **What:** the chameleon voice measures -32 LUFS (very quiet); the Pexels pipeline finishes at about -20; YouTube's own reference is about -14.
- **New evidence:** your own `loudness_check\loudness_after.mp3` measures -20 LUFS (the "before" file is -27), so -20 is what you approved by ear for the Pexels channel. The six music audition files all measure about -27.
- **Recommendation:** the kit is set to -16 LUFS (a little louder than your Pexels videos; YouTube turns loud videos down to about -14 but does not turn quiet ones up). If you prefer to match the Pexels channel, change one number, `target_lufs` in `pipeline/mix.py`, to -20.

### 6. Keep videos at 60 seconds or less
- **What:** YouTube blocks monetisation of Shorts longer than 60 s that contain claimed music. Your brief said 40-70 s.
- **Recommendation:** cap the voice at 60 s (a 2.5 s ending follows; was 55 s until 18 Nov). The writer step will enforce it unless you say otherwise.

### 7. One paid test of the automatic writer
- **What:** the step where Claude writes the script and the show file is built and tested with fakes only. Real cost per video is an estimate ($0.05-0.12) until one real run.
- **Steps:** will be a single command here when the writer is ready (see STATUS.md).

### 7a. Which model writes the videos (this sets the cost per video)
- **What:** estimates from the measured prompt sizes (not from a real run): about **$0.13 per video on Sonnet** (plus about $0.07 for each repair round, worst case about $0.45), or about **$0.007 on Haiku**. Sonnet is above your "few cents" target; Haiku is far below it but may write weaker shows.
- **Options:** (a) Sonnet for everything; (b) Haiku for the script and fact check, Sonnet only for the show file (roughly $0.08-0.10); (c) Haiku for everything; (d) no API at all: "files" mode, where a Claude Code session on your subscription answers the prompt files (free per video, but someone has to start it).
- **Recommendation:** start with (d) for the first handful of videos so you can judge quality at zero cost, then run one paid test each of (b) and (c) and compare. 13 videos a month on Sonnet would be about $1.70-2.50.
- **Where:** `settings.yaml`, section `writer`. Details: `docs/WRITER.md`.

### 7c. What should happen when a topic needs a mechanism the kit does not have?
- **What:** chameleon-level videos need a moving model of the thing being explained (the crystal lattice, the skin layers). The kit will have a growing set of these, but never all of them. A topic without one comes out as a slideshow of objects, which is what you saw.
- **Options:** (a) the automatic pipeline skips such topics and lists what is missing in `queue/needs-props/`; (b) a Claude Code session on your subscription (Sonnet or Opus, which can look at pictures) builds the missing mechanism as one new prop file, about 100-200 lines, then the topic runs; (c) the paid API writes the mechanism code blind, with no eyes. I do not recommend (c): the props in this kit only became good after 2-4 rounds of looking at pictures.
- **Recommendation:** (a) for the automatic runs plus (b) as a regular short session ("build the two most-requested mechanisms"). This means fully automatic videos only for topics the kit can already explain. It is the honest price of the quality you asked for.

### 7b. Keep each video's script and show file in the repo?
- **What:** the GitHub workflow commits only the topic queue back. The script, voice and show file of each video would exist only in a download that GitHub deletes after 7 days.
- **Recommendation:** yes, commit `shows/<slug>/` (small text files plus one MP3 of about 1 MB) so any video can be re-rendered or fixed later. It is a small workflow change; say the word.

### 8. Second YouTube channel
- **What:** private uploads need the new channel, its login token stored as GitHub secrets, and its channel ID in the config (the wrong-channel guard refuses to upload without it).
- **Steps:** will be in `docs/CHANNEL_SETUP.md` when the upload step is ready.

### 9. Private or public repo for rendering
- **What:** private repos get 2-CPU runners and about 2,000 free minutes a month; public repos get 4-CPU runners, free and unlimited.
- **Recommendation:** stay private for now (13 videos fit easily). Revisit only if render time becomes a problem.

### 10. The Claude Project notes
- **What:** your "Youtube Automation" project notes (animation research, channel research, music selection) are not on this disk, so I audited without them.
- **If you want them used:** export them into `E:\Youtube Project\notes\`.
