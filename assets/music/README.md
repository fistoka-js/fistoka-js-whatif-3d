# Music

Music MP3s are **not committed** (they are git-ignored by `assets/music/*.mp3`). A track may only be
committed once it has a licence record in the ledger below.

The mix works with no music at all: just leave out `--music` (or `music_path`).

## Ledger: `assets/music/LEDGER.csv`

One row per track, with this header:

```
file,title,artist,source URL,licence,date downloaded,proof file
```

- `file`: the MP3 name in this folder
- `source URL`: the page the track came from
- `licence`: the exact licence (for example "CC0", "YouTube Audio Library, no attribution")
- `date downloaded`: YYYY-MM-DD
- `proof file`: a screenshot or saved licence page kept in `assets/music/proof/`

No row, no use in a published video.
