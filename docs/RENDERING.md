# Rendering a show to MP4

```
node tools/render.mjs <slug> [--chunks N] [--size 1080x1920] [--fps 30] [--from S --to S]
                             [--out path] [--no-audio] [--quality 92] [--crf 20]
```

Result: `shows/<slug>/out/<slug>.mp4` (video + the show's voice as AAC, cut or padded to the video length) and
`<slug>.render.json` next to it (frames, seconds, fps, chunks, size, renderer, per-chunk times, ffmpeg version).
The last line printed is `RENDER_DONE frames=.. seconds=.. fps=.. chunks=.. out=..`.

Options: `--chunks` how many parallel Chromes (default: half the CPUs, at most 4); `--size` picture size, both numbers even;
`--from/--to` render only that stretch (seconds); `--no-audio` video only; `--quality` JPEG quality of each captured frame;
`--crf` x264 quality (lower = bigger and better).
Needs: Chrome (`CHROME_PATH` if not in the usual place), `ffmpeg` and `ffprobe` on PATH (or `FFMPEG_PATH` / `FFPROBE_PATH`), 2 GB free memory per chunk to be safe.

## How long it takes (demo-sky: 54.7 s, 1641 frames, 1080x1920, software WebGL)

| Machine | Chunks | Time | Speed |
|---|---|---|---|
| This PC (20 logical CPUs) | 4 | 76 s | 21.5 frames/s |
| Same PC limited to 4 CPUs (proxy for a public-repo runner) | 4 | 92 s | 17.8 frames/s |
| Same PC limited to 2 CPUs (proxy for a 2-vCPU runner) | 2 | 126 s | 13.0 frames/s |

The limited runs are only a proxy: a cloud CPU is usually slower per core than this PC, so expect somewhat longer there.

## How the chunking works

1. The frames 0..N-1 are cut into equal runs, one per chunk. Frame f is always drawn at exactly time f/fps.
2. Each chunk is a separate worker (`tools/lib/render-worker.mjs`) with its own Chrome and its own small web server.
3. A worker draws a frame (`__renderAt`), waits two animation frames, grabs a JPEG, and feeds ffmpeg, which writes a video-only `.ts` file.
4. Every chunk starts with a full picture (keyframe), so the chunk files are joined with no re-encoding; then the voice is added.
5. The finished file is checked: the frame count and the picture size must be exactly right, or the render fails.

## When it fails

- `the show has N error(s)`: run `node tools/validate.mjs shows/<slug>` and fix what it lists. Nothing is rendered.
- `page error ...` or `the page could not play`: the page threw an error; the message says at which time.
- `only X GB of memory is free`: close programs, or use fewer `--chunks`.
- `chunk N failed`: the message after it is the worker's own error (often Chrome or ffmpeg missing).
- `wrong frame count`: a chunk lost frames; render again, and report it if it repeats.
- Ctrl+C is safe: Chromes, ffmpeg and temporary files (`out/.render-tmp-*`) are cleaned up. A leftover `.render-tmp-*` folder after a crash can be deleted.

Contact sheets of every prop and environment: `node tools/gallery.mjs` (writes `docs/gallery/`).
