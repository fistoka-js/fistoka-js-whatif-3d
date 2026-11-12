"""Narration + exact word timings.

make_voice() turns script text into voice.mp3 and words.json using Edge TTS.
Word times come from Edge's own WordBoundary events (no Whisper). Edge's word text
has no punctuation, so align_words() maps Edge's words back onto the script's own
whitespace-separated tokens (which keep their punctuation, for captions).

To add another TTS provider (e.g. Kokoro): write a function with the same shape as
edge_synthesize() (see PROVIDERS at the bottom), add it to PROVIDERS, and pass
provider="name" to make_voice(). It must write an mp3 and return a list of
{"text", "start", "end"} dicts (seconds). Alignment and measuring are shared.

CLI:  python -m pipeline.voice shows/<slug>
"""
import asyncio
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

from . import audio_util

DEFAULT_VOICE = "en-US-AndrewNeural"
DEFAULT_RATE = "+12%"
ATTEMPTS = 3


class AlignmentError(ValueError):
    """Edge's words could not be matched to the script's words."""


# ---------------------------------------------------------------- alignment

def _key(text):
    """Letters and digits only, lowercase, accents removed. Punctuation vanishes."""
    t = unicodedata.normalize("NFKD", text)
    return "".join(c for c in t.lower() if c.isalnum() and not unicodedata.combining(c))


def _script_tokens(script_text):
    """Whitespace tokens as [text, key]. Pure-punctuation tokens join a neighbour."""
    out = []
    pending_prefix = ""
    for tok in script_text.split():
        k = _key(tok)
        if k:
            out.append([pending_prefix + tok, k])
            pending_prefix = ""
        elif out:
            out[-1][0] += " " + tok          # "nothing" + "—"  ->  "nothing —"
        else:
            pending_prefix += tok + " "      # script starts with a symbol
    return out


def _context(items, idx, label):
    lo, hi = max(0, idx - 4), min(len(items), idx + 5)
    parts = [("[[" + items[n] + "]]") if n == idx else items[n] for n in range(lo, hi)]
    return f"  {label}: " + " ".join(parts)


def align_words(script_text, edge_words):
    """Return [{"text","start","end"}] with script text and Edge timings.

    edge_words: list of {"text", "start", "end"} in seconds, spoken order.
    One script token may be several Edge words ("two-thirds" -> "two","thirds") and
    one Edge word may cover several script tokens; both are handled. Anything else
    raises AlignmentError showing both sequences near the problem.
    """
    toks = _script_tokens(script_text)
    edge = [dict(w, key=_key(w["text"])) for w in edge_words]
    edge = [w for w in edge if w["key"]]     # Edge sometimes emits bare punctuation
    out = []
    i = j = 0

    def fail(why):
        raise AlignmentError(
            f"Cannot align script to Edge words ({why}).\n"
            + _context([t[0] for t in toks], min(i, len(toks) - 1), "script")
            + "\n"
            + _context([w["text"] for w in edge], min(j, max(len(edge) - 1, 0)), "edge  ")
        )

    while i < len(toks):
        if j >= len(edge):
            fail("Edge ran out of words")
        text, tk = toks[i]
        ek = edge[j]["key"]
        if tk == ek:
            out.append({"text": text, "start": edge[j]["start"], "end": edge[j]["end"]})
            i += 1
            j += 1
        elif tk.startswith(ek):                      # token = several Edge words
            acc, jj = ek, j + 1
            while acc != tk:
                if jj >= len(edge) or not tk.startswith(acc + edge[jj]["key"]):
                    fail("script word does not match the Edge words")
                acc += edge[jj]["key"]
                jj += 1
            out.append({"text": text, "start": edge[j]["start"], "end": edge[jj - 1]["end"]})
            i += 1
            j = jj
        elif ek.startswith(tk):                      # Edge word = several tokens
            group, acc, ii = [toks[i]], tk, i + 1
            while acc != ek:
                if ii >= len(toks) or not ek.startswith(acc + toks[ii][1]):
                    fail("Edge word does not match the script words")
                acc += toks[ii][1]
                group.append(toks[ii])
                ii += 1
            total = sum(len(g[1]) for g in group)
            t0, span = edge[j]["start"], edge[j]["end"] - edge[j]["start"]
            done = 0
            for g in group:
                a = t0 + span * done / total
                done += len(g[1])
                out.append({"text": g[0], "start": a, "end": t0 + span * done / total})
            i = ii
            j += 1
        else:
            fail("words differ")
    if j < len(edge):
        fail("Edge has extra words after the script ended")
    return [{"text": w["text"], "start": round(w["start"], 3), "end": round(w["end"], 3)}
            for w in out]


# ---------------------------------------------------------------- providers

async def _edge_stream(text, voice, rate, mp3_path):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(mp3_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7          # 100-ns units -> seconds
                words.append({"text": chunk["text"], "start": start,
                              "end": start + chunk["duration"] / 1e7})
    return words


def edge_synthesize(text, voice, rate, mp3_path):
    """Edge TTS: write mp3_path, return raw word events [{"text","start","end"}]."""
    words = asyncio.run(_edge_stream(text, voice, rate, str(mp3_path)))
    if not words:
        raise RuntimeError("Edge returned no word timings")
    return words


PROVIDERS = {"edge": edge_synthesize}


def _with_retries(fn, *args):
    last = None
    for attempt in range(ATTEMPTS):
        try:
            return fn(*args)
        except Exception as e:                      # network errors come in many types
            last = e
            if attempt < ATTEMPTS - 1:
                time.sleep(2 ** attempt)            # 1 s, then 2 s
    raise RuntimeError(f"TTS failed after {ATTEMPTS} attempts: {last}") from last


# ---------------------------------------------------------------- main API

def word_stats(words, duration):
    speech = words[-1]["end"] - words[0]["start"] if words else 0
    gaps = [b["start"] - a["end"] for a, b in zip(words, words[1:])]
    return {
        "duration": round(duration, 3),
        "word_count": len(words),
        "words_per_second": round(len(words) / speech, 2) if speech > 0 else 0,
        "longest_pause": round(max(gaps), 3) if gaps else 0,
    }


def make_voice(script_text, out_dir, voice=DEFAULT_VOICE, rate=DEFAULT_RATE, provider="edge"):
    """Write voice.mp3 and words.json into out_dir. Return the stats dict."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    script_text = re.sub(r"\s+", " ", script_text).strip()
    if not script_text:
        raise ValueError("script is empty")
    mp3 = out_dir / "voice.mp3"
    raw = _with_retries(PROVIDERS[provider], script_text, voice, rate, mp3)
    words = align_words(script_text, raw)       # raises AlignmentError, never guesses
    (out_dir / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1),
                                        encoding="utf-8")
    return word_stats(words, audio_util.probe_duration(mp3))


def main(argv):
    if len(argv) != 1:
        print("usage: python -m pipeline.voice shows/<slug>")
        return 2
    folder = Path(argv[0])
    script = folder / "script.txt"
    if not script.exists():
        print(f"missing {script}")
        return 2
    stats = make_voice(script.read_text(encoding="utf-8"), folder)
    print(json.dumps(stats, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
