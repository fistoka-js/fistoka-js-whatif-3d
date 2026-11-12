"""Reads settings.yaml (non-secret settings only). Missing keys fall back to DEFAULTS."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = {
    "channel_id": "",                 # the ONLY channel uploads may go to; empty = uploads refused
    "llm_mode": "files",               # api or files (see docs/WRITER.md)
    "synthetic_voice_note": False,    # add the note below to the video description
    "synthetic_voice_note_text": "The narration in this video is synthetic (computer-generated) speech.",
    "max_topics_per_run": 3,
}


def load_settings(path=None):
    path = Path(path) if path else ROOT / "settings.yaml"
    data = {}
    if path.exists():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(data, dict):
            raise ValueError(f"{path}: expected key: value lines")
    out = dict(DEFAULTS)
    out.update(data)
    out["channel_id"] = str(out["channel_id"] or "").strip()
    return out
