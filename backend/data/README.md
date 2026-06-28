# Word Lists

This directory stores the static dictionary files loaded by `backend/words.py`.

- `answers.txt`: Wordle-style answer list used for puzzle selection.
- `allowed_guesses.txt`: all accepted guesses, including every answer word.

The current files were normalized from the public NYT Wordle lists mirrored in:

https://github.com/LaurentLessard/wordlesolver

NYT may change its live production list over time, so these files should be treated
as a pinned Wordle-compatible dictionary rather than a live API feed.
