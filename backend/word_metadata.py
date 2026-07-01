from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from words import ANSWER_WORDS


DATA_DIR = Path(__file__).resolve().parent / "data"
METADATA_PATH = DATA_DIR / "word_metadata.json"


def _fallback_metadata(word: str) -> dict[str, str]:
    vowels = sum(1 for ch in word if ch in "AEIOU")
    repeated = len(set(word)) != len(word)
    start = "a vowel" if word[0] in "AEIOU" else "a consonant"
    repeat_text = "contains a repeated letter" if repeated else "has no repeated letters"
    return {
        "word": word,
        "definition": f"{word.title()} is a valid English word used in Wordle-style puzzles.",
        "part_of_speech": "word",
        "category_hint": "English vocabulary",
        "riddle_hint": "A five-letter English word from the answer list.",
        "structure_hint": f"Starts with {start}, ends with {word[-1]}, has {vowels} vowel{'s' if vowels != 1 else ''}, and {repeat_text}.",
        "example": "",
    }


def load_word_metadata() -> dict[str, dict[str, str]]:
    if not METADATA_PATH.exists():
        return {word: _fallback_metadata(word) for word in ANSWER_WORDS}

    raw: dict[str, Any] = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    metadata: dict[str, dict[str, str]] = {}
    for word in ANSWER_WORDS:
        entry = raw.get(word) or {}
        fallback = _fallback_metadata(word)
        metadata[word] = {
            key: str(entry.get(key) or fallback[key])
            for key in ("word", "definition", "part_of_speech", "category_hint", "riddle_hint", "structure_hint", "example")
        }
        metadata[word]["word"] = word
    return metadata


WORD_METADATA = load_word_metadata()


def get_word_metadata(word: str | None) -> dict[str, str] | None:
    if not word:
        return None
    normalized = word.strip().upper()
    return WORD_METADATA.get(normalized) or _fallback_metadata(normalized)


def validate_metadata_coverage() -> list[str]:
    return [
        word
        for word in ANSWER_WORDS
        if word not in WORD_METADATA or not WORD_METADATA[word].get("definition")
    ]
