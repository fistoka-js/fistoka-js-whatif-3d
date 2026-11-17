# Asking Claude to change something

For Jacob. You do not need to know code. You need to say clearly what you want, which files, and what "done" looks like. Every helper must obey `docs/HELPER-RULES.md`.

## Which model for what

| Job | Model |
|---|---|
| Build a new prop, a new environment, or any new visual group (needs taste and many look-and-fix rounds) | Opus |
| Fix a bug, change a number, edit docs, update tests | Sonnet |
| Review someone else's work (the "skeptic") | Sonnet, a fresh one each time |
| Play the paid model in files mode (read each prompt file, write each reply file) | Sonnet, reading every line of each prompt file |

## The habit: fixer, then skeptic

1. Give the task to one helper (the fixer). It changes files and reports real test output.
2. Start a new, separate helper (the skeptic). Give it only the original task and the list of changed files. It looks for problems and ends with `VERDICT: CLEAR` or `VERDICT: PROBLEMS`.
3. If PROBLEMS: paste the skeptic's report, word for word, to the fixer and ask it to fix every problem, nitpicks included. Then start another new skeptic.
4. Stop when two new skeptics in a row say CLEAR. Never reuse a skeptic. Never tell a skeptic what an earlier one found.

## Brief template (copy, then fill in the brackets)

```text
Read and obey docs/HELPER-RULES.md first. It is binding. Work only in E:\Youtube Project\whatif-3d. Do NOT commit. No paid calls, no uploads.

Task: [one or two plain sentences: what to change and why]

Files you may change: [list, for example kit/props/cat.js, kit/props/index.js]
Files you must not change: [list, or "everything else"]

Read first: [docs/AUTHORING.md, docs/PROP-BRIEF.md, the example file, ...]

Done means:
- [what Jacob will see, for example "a still sheet where the cat is recognisable"]
- .\.venv\Scripts\python.exe -m pytest tests/py -q passes
- npm test passes (never run node --test tests/)

Report (under 350 words): files changed with line counts, the real final test lines, the path of any picture you made, and anything you could not check. Paste the output; do not say "works" without running it.
```

## Prompt: build a missing prop from a NEEDS-PROPS file

Use this when the writer stopped with exit code 3 and wrote `shows/<slug>/NEEDS-PROPS.md`. An example of the format: `shows/black-hole-light/NEEDS-PROPS.md`. Use Opus.

```text
Read and obey docs/HELPER-RULES.md first. It is binding. Work only in E:\Youtube Project\whatif-3d. Do NOT commit. No paid calls, no uploads.

Task: build the prop described in shows/[slug]/NEEDS-PROPS.md. Read that file first. The section "The mechanism prop that is needed" is the design; the list under "Missing" is what must exist. Its named values (for example bend, mass) become animatable params with those names, 0 to 1 unless the file says otherwise.

Read, in this order: docs/AUTHORING.md (the add-a-prop steps), docs/PROP-BRIEF.md (what a good prop is), kit/props/ball.js and one prop close to the topic.

Do: follow "Add a prop" in docs/AUTHORING.md exactly. Make a scratch show shows/zz-[name]/ and look at stills of the prop at the low and the high value of every animatable param. Be a harsh art director: fix it until it is recognisable at phone size. Run node tools/catalog.mjs after the prop is registered.

Done means: the prop is registered in kit/props/index.js; docs/CATALOG.md and kit/catalog.json are regenerated; .\.venv\Scripts\python.exe -m pytest tests/py -q and npm test pass; node tools/validate.mjs zz-[name] passes; you looked at the sheet and say honestly how good it is (1 to 10).

Report (under 350 words): files changed with line counts, the real final test lines, the path of your sheet, your look score, and anything you dropped or could not check.
```

After the prop is built and reviewed, run the pipeline again (see `docs/HOW-IT-WORKS.md`, "The needs-props path"): in files mode (the default) first delete `shows/<slug>/llm/` (or at least the reply files from `01-script.reply.md` on), because earlier replies are replayed and the old "feasible: false" answer would stop the run again (api mode needs no deletion); for a one-off `--topic` run, then repeat the same command; for a queued topic, first move its file from `queue/needs-props/` back to `queue/pending/`. The writer reads `kit/catalog.json`, so it sees the new prop.

## Prompt: write the model's replies in files mode (free)

```text
Read and obey docs/HELPER-RULES.md first. Work only in E:\Youtube Project\whatif-3d. No paid calls, no uploads.

Run: .\.venv\Scripts\python.exe -m pipeline.run --topic "[topic]" --slug [slug] --llm files --no-upload
It stops with exit code 4 and says only that it waits for a reply file in shows/[slug]/llm/. Open that folder and find the .prompt.md file that has no matching .reply.md (the newest one; shows/[slug]/out/run.log also shows it). Read that whole prompt file in chunks of under 100 lines, including the worked example and its OUTPUT JSON. Write only the answer (for example the JSON) to the reply file with the same name but ending .reply.md. Run the same command again. Repeat until it finishes or exits 3 (needs props) or 1 (failed). Report the last output lines.
```

## Tips

- One task per brief. Small tasks come back better.
- Say which pictures to look at. Helpers must open the image files, not guess.
- If a helper says something works, ask for the pasted test output.
- Pushing to GitHub and uploading to YouTube are never part of a brief. You do those yourself.
