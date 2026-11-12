# Rules for every helper agent (and for any model working in this repo)

Read this first. These are safety rules, not style.

## Where you may work
- Only inside `E:\Youtube Project\whatif-3d` (this repo), plus scratch files in `E:\Youtube Project\_fable_work\`.
- Do not read, list, search or change anything outside `E:\Youtube Project`. No Downloads, Desktop, Documents, home folder, other drives, system folders.
- `E:\Youtube Project\youtube-shorts-pipeline` is LIVE. Never write to it, never run git in it.
- `E:\Youtube Project\youtube-3d-pipeline` belongs to another session. Never write to it or run git in it. If your brief says to reuse code from the old kit, read it from the read-only copy at `E:\Youtube Project\_fable_work\ref-head\`.
- Temp files: before running node or python, set `TEMP` and `TMP` to `E:\Youtube Project\_fable_work\tmp` (bash: `export TEMP="E:\\Youtube Project\\_fable_work\\tmp" TMP="E:\\Youtube Project\\_fable_work\\tmp" npm_config_cache="E:\\Youtube Project\\_fable_work\\npm-cache"`).

## Secrets and money
- Never read, open or print any file with `token`, `secret` or `config.json` in its name, or anything in a `.verticals` folder, or any key.
- No paid API calls (no Anthropic/OpenAI API, no paid services). No YouTube uploads. Free tools (Edge TTS, ffmpeg, npm, pip) are fine.
- Code that would call a paid API must be written so tests use a fake, and must never run for real in your session.

## Git
- Do NOT commit, push, or change git config unless your brief says so. The lead commits.
- Never `git add .` or `git add -A`.

## Machine care
- Check free RAM before any browser job: PowerShell `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB` (GB). Do not start a browser job under 2 GB free. One render at a time; stills are light.
- Do not stop processes you did not start. Close browsers you opened.
- Put long commands in script files, not long one-liners.

## Working style
- Stay inside the files your brief gives you. If you need a change in a file owned by someone else, do not make it; say so in your report.
- Small, plain modules. Comments say why, briefly. No clever abstractions. A weaker model must be able to edit this later.
- Tests must really run and pass; paste the final pass/fail line in your report. Never claim something works unless you ran it.
- Look at pictures you produce (read the image file) before saying they look right.
- Final report: under 400 words, plain language: what you built, what you ran and the result, what is not done, anything the lead must decide.
