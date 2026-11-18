TOPIC: {{TOPIC}}

You wrote this script:
{{SCRIPT}}

Read aloud it lasts {{SECONDS}} seconds, but the voice must end before {{LIMIT}} seconds. Rewrite it about {{WORDS}} words shorter (at most {{TARGET}} words, and never below {{FLOOR}} words). Keep the hook, the one mechanism, the facts you are sure of, the closing question and the final "comment your answer below" line; cut the weakest sentence or tighten wording. Follow every rule above except the 180 to 195 word length: for this rewrite the word limit above wins, but never go below {{FLOOR}} words. Give a new beat list for the shorter script (one beat per sentence).

Reply with strict JSON only: {"script": "the shorter script", "beats": [{"sentence": "...", "subject": "...", "change": "...", "dial": ""}], "claims": ["each factual claim, one per item"]}
