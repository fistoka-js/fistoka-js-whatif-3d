"""The one place the writer talks to a language model.

complete(system, user, *, purpose, max_tokens) -> LlmReply(text, input_tokens, output_tokens, model, ...)

Two modes (make_complete picks one):
  api    the Anthropic API. The key comes ONLY from the ANTHROPIC_API_KEY environment variable
         (never from a file, never printed). Costs money. The long fixed part of each prompt (the
         "system" text: rules, catalogue, examples) is marked for prompt caching, so repair rounds
         re-read it at a tenth of the price.
  files  free. Each call writes the exact prompt to shows/<slug>/llm/<n>-<purpose>.prompt.md and reads
         the answer from shows/<slug>/llm/<n>-<purpose>.reply.md. If the answer is not there yet it
         raises WaitingForReply (the writer then exits with code 4). A person or a Claude Code agent
         writes the reply file and runs the same command again; the writer replays earlier answers
         from disk and carries on. Token counts in this mode are estimates (characters / 4).

Tests pass their own fake `complete` to the writer, so nothing here runs in tests except the
files mode and the cost arithmetic.
"""
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

# Model names and prices from the claude-api skill's model table (cached 2026-11-03).
# Dollars per million tokens: input, output, cache read, cache write (5-minute cache).
# Cache write is 1.25 x input (Anthropic's standard rate). Haiku's cache read is assumed to be
# 0.1 x input; check the pricing page before relying on it.
DEFAULT_MODEL = "claude-sonnet-5-5"
CHEAP_MODEL = "claude-haiku-5-5"
PRICES = {
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00, "cache_read": 0.10, "cache_write": 2.50},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50, "cache_read": 0.01, "cache_write": 0.125},
    "claude-opus-5-5": {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00},
}
RETRIES = 4                 # extra tries on overload / rate limit, waiting 5, 10, 20, 40 s


class LlmError(RuntimeError):
    """The model gave no usable answer (refused, cut off, or the API failed after retries)."""


class WaitingForReply(BaseException):
    """files mode: the reply file for this call does not exist yet.

    A BaseException on purpose: fact_check.audit_script() turns every Exception from its LLM call
    into "audit unavailable", but waiting for a reply must stop the whole run (exit 4) instead."""

    def __init__(self, prompt_path, reply_path):
        super().__init__(f"waiting for {reply_path}")
        self.prompt_path = Path(prompt_path)
        self.reply_path = Path(reply_path)


@dataclass
class LlmReply:
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    purpose: str = ""
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    estimated: bool = False          # True when the token counts are characters / 4
    files: list = field(default_factory=list)


def estimate_tokens(text):
    """Rough token count: characters / 4 (good enough for cost estimates)."""
    return (len(text) + 3) // 4


def cost_usd(model, input_tokens, output_tokens, cache_read_tokens=0, cache_write_tokens=0):
    """Dollars for one call. input_tokens means the uncached input only."""
    p = PRICES.get(model, PRICES[DEFAULT_MODEL])
    return (input_tokens * p["input"] + output_tokens * p["output"]
            + cache_read_tokens * p["cache_read"] + cache_write_tokens * p["cache_write"]) / 1_000_000


def reply_cost(reply, price_model=None):
    """Cost of an LlmReply. In files mode there is no real model, so price_model says which to price as."""
    model = price_model or reply.model
    return cost_usd(model, reply.input_tokens, reply.output_tokens,
                    reply.cache_read_tokens, reply.cache_write_tokens)


# ---------------------------------------------------------------- files mode

def prompt_text(system, user):
    """The exact text a person or agent reads in files mode: the system part, then the user part."""
    return ("<!-- One LLM call. Read all of it as your instructions, then write ONLY your answer into the "
            "matching .reply.md file (same name, .reply.md instead of .prompt.md). -->\n\n"
            "=== SYSTEM ===\n\n" + system.rstrip() + "\n\n=== USER ===\n\n" + user.rstrip() + "\n")


class FilesLlm:
    """files mode. Call n writes llm/<nn>-<purpose>.prompt.md and reads llm/<nn>-<purpose>.reply.md."""

    def __init__(self, folder):
        self.folder = Path(folder) / "llm"
        self.count = 0

    def complete(self, system, user, *, purpose, max_tokens=16000):
        self.count += 1
        stem = f"{self.count:02d}-{purpose}"
        prompt_path = self.folder / f"{stem}.prompt.md"
        reply_path = self.folder / f"{stem}.reply.md"
        text = prompt_text(system, user)
        if reply_path.exists():
            # Replay an answer given earlier. The prompt file is left as it was answered.
            answer = reply_path.read_text(encoding="utf-8-sig")
        else:
            self.folder.mkdir(parents=True, exist_ok=True)
            prompt_path.write_text(text, encoding="utf-8")
            raise WaitingForReply(prompt_path, reply_path)
        return LlmReply(text=answer, input_tokens=estimate_tokens(text), output_tokens=estimate_tokens(answer),
                        model="files", purpose=purpose, estimated=True,
                        files=[str(prompt_path), str(reply_path)])


# ---------------------------------------------------------------- api mode

class ApiLlm:
    """api mode: the Anthropic Python SDK (pip install anthropic). Costs money on every call."""

    def __init__(self, model=DEFAULT_MODEL, effort="medium", client=None):
        self.model = model
        self.effort = effort
        self._client = client            # tests may pass a fake client

    def _get_client(self):
        if self._client is None:
            key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
            if not key:
                raise LlmError("ANTHROPIC_API_KEY is not set. api mode needs it (or use --mode files).")
            import anthropic                 # imported here so files mode and tests need no SDK
            self._client = anthropic.Anthropic(api_key=key, max_retries=2)
        return self._client

    def _create(self, system, user, max_tokens):
        client = self._get_client()
        kwargs = dict(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": self.effort},
        )
        if system.strip():
            # The long fixed part is cached: repair rounds (and the next video within 5 minutes)
            # pay about a tenth of the input price for it.
            kwargs["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        return client.messages.create(**kwargs)

    def complete(self, system, user, *, purpose, max_tokens=16000):
        wait = 5
        for attempt in range(RETRIES + 1):
            try:
                msg = self._create(system, user, max_tokens)
                break
            except Exception as e:           # only overload / rate limit are retried
                name = type(e).__name__
                status = getattr(e, "status_code", None)
                retry = name in ("RateLimitError", "OverloadedError", "InternalServerError",
                                 "APIConnectionError", "APITimeoutError") or status in (429, 500, 502, 503, 529)
                if not retry or attempt == RETRIES:
                    raise LlmError(f"API call failed ({name}): {str(e)[:300]}") from e
                print(f"[llm] {purpose}: {name}, retrying in {wait} s")
                time.sleep(wait)
                wait *= 2
        if msg.stop_reason == "refusal":
            raise LlmError(f"{purpose}: the model declined to answer")
        if msg.stop_reason == "max_tokens":
            raise LlmError(f"{purpose}: the answer was cut off at max_tokens={max_tokens}")
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        u = msg.usage
        return LlmReply(text=text, input_tokens=u.input_tokens or 0, output_tokens=u.output_tokens or 0,
                        model=self.model, purpose=purpose,
                        cache_read_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
                        cache_write_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0)


def make_complete(mode, folder, model=DEFAULT_MODEL, effort="medium"):
    """The complete() function for a mode: 'files' (free) or 'api' (paid)."""
    if mode == "files":
        return FilesLlm(folder).complete
    if mode == "api":
        return ApiLlm(model=model, effort=effort).complete
    raise ValueError(f"unknown mode {mode!r} (use api or files)")
