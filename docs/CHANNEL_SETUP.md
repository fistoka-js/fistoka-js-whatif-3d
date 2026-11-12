# CHANNEL SETUP: the second channel and private uploads

Videos are always uploaded as **private**; you publish them yourself in YouTube Studio. The uploader will not upload to any channel except the one whose ID is in `settings.yaml`.
Everything here is done by you; nothing is automatic. Windows PowerShell, from the `whatif-3d` folder, with the virtual environment on (`(.venv)` in the prompt: `.\.venv\Scripts\Activate.ps1`).

## 1. Create the second channel
1. Open youtube.com signed in to your Google account.
2. Click your picture, then "Create a channel" (or "Switch account", then "Create a channel"). Make a separate channel (a brand account), with its own name. The old channel stays untouched.

## 2. Reuse the same Google Cloud project (yes, you can)
The OAuth client (`client_secret.json`) belongs to the Google Cloud project, not to a channel. Which channel gets the login is decided when you sign in during step 3. So the same `client_secret.json` as the old pipeline works. The upload quota (10,000 units per day, one upload costs about 1,600) is shared by both channels, which is fine at a few videos per week. Keep `client_secret.json` somewhere outside this folder or leave it out of git (git already ignores `client_secret*.json`).

## 3. Log in as the NEW channel
```
pip install -r pipeline/requirements.txt
python scripts/setup_youtube_oauth.py "C:\path\to\client_secret.json"
```
A browser opens. Sign in, and when Google asks which channel/account to use, pick the NEW one. When it finishes it prints a line like `Channel: My New Channel   ID: UCxxxxxxxxxxxxxxxxxxxxxx`. The login is saved in `.verticals\youtube_token.json` in this folder (ignored by git; never paste or share that file). If you see the OLD channel's name, run the script again and choose differently.

## 4. Put the channel ID in settings.yaml
Open `settings.yaml` and set `channel_id: "UCxxxxxxxxxxxxxxxxxxxxxx"` (the ID printed in step 3). Without it, every upload is refused.

## 5. Check the guard before trusting it
Make one video without uploading: `python -m pipeline.run --no-upload`. Then try a real upload of that video: `python -m pipeline.run --topic "<same topic>" --slug <same slug>` (this is the first upload, so do it deliberately). If you want to see the guard refuse, set `channel_id` to a wrong ID first: the run stops with exit code 6 and a message showing both IDs and the channel name. Put the right ID back afterwards.

## 6. GitHub secrets (only for the cloud workflow)
In your GitHub repo: Settings, then "Secrets and variables", then "Actions", then "New repository secret". Add:
- `YOUTUBE_TOKEN_B64`: the content of `.verticals\youtube_token.json`, base64 encoded. In PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes(".verticals\youtube_token.json")) | Set-Clipboard`, then paste into the secret box.
- `ANTHROPIC_API_KEY`: your Anthropic key (only needed when the writer runs in `api` mode).

The workflow also needs `channel_id` in `settings.yaml` to be committed (it is not secret). `client_secret.json` is not needed in GitHub: the saved login already contains what it needs to renew itself.
If your Google consent screen is in "Testing" mode, the login stops working after 7 days and step 3 has to be repeated; setting the screen to "In production" avoids that.

The workflow is untested until the repo is pushed. Run it first with `upload` off.
