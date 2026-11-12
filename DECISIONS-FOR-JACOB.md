# Decisions for Jacob

Things only you can decide or do. Nothing here blocks the build; work continues around each item. Newest first within each group.

## Please do soon

### 1. Back up the old 3D repo (about 28 commits exist only on this PC)
- **What:** `youtube-3d-pipeline` has never been pushed. If the disk fails, the chameleon video's source and all of stages 1-3 are gone.
- **My recommendation:** push it (it is a private repo). I did not, because every push needs your yes, and another session has unfinished changes in that folder.
- **Steps:** in the session that owns that folder, commit or discard the 7 changed files, then at the `!` prompt:
  `cd "/e/Youtube Project/youtube-3d-pipeline" && git pull --rebase && git push`

### 2. Back up this new repo (`whatif-3d`)
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
- **Recommendation:** -16 LUFS for every video (set in `pipeline/mix.py`). Your ears decide; it is one number.

### 6. Keep videos at 60 seconds or less
- **What:** YouTube blocks monetisation of Shorts longer than 60 s that contain claimed music. Your brief said 40-70 s.
- **Recommendation:** cap scripts at about 55 s. The writer step will enforce it unless you say otherwise.

### 7. One paid test of the automatic writer
- **What:** the step where Claude writes the script and the show file is built and tested with fakes only. Real cost per video is an estimate ($0.05-0.12) until one real run.
- **Steps:** will be a single command here when the writer is ready (see STATUS.md).

### 8. Second YouTube channel
- **What:** private uploads need the new channel, its login token stored as GitHub secrets, and its channel ID in the config (the wrong-channel guard refuses to upload without it).
- **Steps:** will be in `docs/CHANNEL_SETUP.md` when the upload step is ready.

### 9. Private or public repo for rendering
- **What:** private repos get 2-CPU runners and about 2,000 free minutes a month; public repos get 4-CPU runners, free and unlimited.
- **Recommendation:** stay private for now (13 videos fit easily). Revisit only if render time becomes a problem.

### 10. The Claude Project notes
- **What:** your "Youtube Automation" project notes (animation research, channel research, music selection) are not on this disk, so I audited without them.
- **If you want them used:** export them into `E:\Youtube Project\notes\`.
