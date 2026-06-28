from pathlib import Path
import random


DATA_DIR = Path(__file__).resolve().parent / "data"
ANSWERS_PATH = DATA_DIR / "answers.txt"
ALLOWED_GUESSES_PATH = DATA_DIR / "allowed_guesses.txt"


def _load_words(path: Path) -> tuple[str, ...]:
    words = []
    for line in path.read_text(encoding="ascii").splitlines():
        word = line.strip().upper()
        if len(word) == 5 and word.isalpha():
            words.append(word)

    if not words:
        raise RuntimeError(f"No valid 5-letter words found in {path}")

    return tuple(dict.fromkeys(words))


ANSWER_WORDS = _load_words(ANSWERS_PATH)
VALID_GUESSES = set(_load_words(ALLOWED_GUESSES_PATH)) | set(ANSWER_WORDS)

# Backward-compatible shape for the existing API. Difficulty currently changes
# game rules only; the answer source is the full Wordle-style answer list.
WORD_LISTS = {
    "easy": ANSWER_WORDS,
    "moderate": ANSWER_WORDS,
    "difficult": ANSWER_WORDS,
    "prodigy": ANSWER_WORDS,
}


def get_word(difficulty: str = "easy") -> str:
    words = WORD_LISTS.get(difficulty.lower(), ANSWER_WORDS)
    return random.choice(words)
