from __future__ import annotations

import json
import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
ANSWERS_PATH = DATA_DIR / "answers.txt"
OUTPUT_PATH = DATA_DIR / "word_metadata.json"


POS_LABELS = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "s": "adjective",
    "r": "adverb",
}

LEXNAME_PRIORITY = {
    "noun.artifact": 0,
    "noun.animal": 1,
    "noun.food": 2,
    "noun.plant": 3,
    "noun.object": 4,
    "noun.substance": 5,
    "verb.motion": 6,
    "verb.contact": 7,
    "verb.creation": 8,
    "verb.change": 9,
    "verb.stative": 10,
    "adj.all": 11,
    "noun.attribute": 12,
    "noun.act": 13,
    "noun.event": 14,
    "noun.state": 15,
    "noun.cognition": 16,
}


def ensure_wordnet():
    try:
        import nltk
        from nltk.corpus import wordnet as wn
        wn.synsets("apple")
        return wn
    except LookupError:
        import nltk
        nltk.download("wordnet")
        nltk.download("omw-1.4")
        from nltk.corpus import wordnet as wn
        return wn
    except ImportError:
        print("Install nltk first: python -m pip install nltk", file=sys.stderr)
        raise


def load_answers() -> list[str]:
    return [
        line.strip().upper()
        for line in ANSWERS_PATH.read_text(encoding="ascii").splitlines()
        if len(line.strip()) == 5 and line.strip().isalpha()
    ]


def clean_definition(text: str) -> str:
    text = re.sub(r"\s+", " ", text.strip())
    return text[:1].upper() + text[1:] if text else text


def word_shape_hint(word: str) -> str:
    vowels = [ch for ch in word if ch in "AEIOU"]
    repeated = sorted({ch for ch in word if word.count(ch) > 1})
    start = "a vowel" if word[0] in "AEIOU" else "a consonant"
    repeated_text = f"contains repeated {', '.join(repeated)}" if repeated else "has no repeated letters"
    return (
        f"Starts with {start}, ends with {word[-1]}, "
        f"has {len(vowels)} vowel{'s' if len(vowels) != 1 else ''}, and {repeated_text}."
    )


def category_from_synset(synset) -> str:
    lexname = synset.lexname().replace(".", " / ").replace("_", " ")
    return lexname[:1].upper() + lexname[1:]


def example_for(word: str, synset) -> str:
    examples = synset.examples()
    if examples:
        example = clean_definition(examples[0])
        return example if word.lower() in example.lower() else f"{word.title()}: {example}"
    return ""


def fallback_entry(word: str) -> dict[str, str]:
    return {
        "word": word,
        "definition": f"{word.title()} is a valid English word used in Wordle-style puzzles.",
        "part_of_speech": "word",
        "category_hint": "English vocabulary",
        "riddle_hint": "A five-letter English word from the answer list.",
        "structure_hint": word_shape_hint(word),
        "example": "",
    }


def entry_for(word: str, wn) -> dict[str, str]:
    synsets = wn.synsets(word.lower())
    if not synsets:
        return fallback_entry(word)

    synset = sorted(
        synsets,
        key=lambda item: (
            LEXNAME_PRIORITY.get(item.lexname(), 50),
            "_" in item.name().split(".")[0],
            item.lexname() in {"noun.person", "noun.location", "noun.communication"},
        ),
    )[0]
    definition = clean_definition(synset.definition())
    category = category_from_synset(synset)
    return {
        "word": word,
        "definition": definition or fallback_entry(word)["definition"],
        "part_of_speech": POS_LABELS.get(synset.pos(), "word"),
        "category_hint": category or "English vocabulary",
        "riddle_hint": f"Think of something described as: {definition.lower()}",
        "structure_hint": word_shape_hint(word),
        "example": example_for(word, synset),
    }


def main() -> int:
    wn = ensure_wordnet()
    answers = load_answers()
    data = {word: entry_for(word, wn) for word in answers}

    missing = [
        word for word, entry in data.items()
        if not all(entry.get(key) for key in ("definition", "category_hint", "riddle_hint", "structure_hint"))
    ]
    if missing:
        raise RuntimeError(f"Missing metadata for {len(missing)} words: {missing[:10]}")

    OUTPUT_PATH.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    wordnet_count = sum(1 for entry in data.values() if entry["part_of_speech"] != "word")
    print(f"Wrote {len(data)} metadata entries to {OUTPUT_PATH}")
    print(f"WordNet-backed entries: {wordnet_count}; generated fallback entries: {len(data) - wordnet_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
