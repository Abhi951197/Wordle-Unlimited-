# World Unlimited — Project Context for Claude

## What This Is
A competitive, skill-based word-guessing game that evolves beyond Wordle. Built by a solo developer. The goal is an unlimited, replayable word game with multiplayer, AI benchmarking, and a unique hint system.

---

## Game Modes

### Solo Mode
The primary loop. Unlimited plays, no daily limits.

**Difficulty Levels:**

| Level | Rules |
|---|---|
| 🟢 Easy | Classic Wordle — no restrictions, guess any letters anywhere |
| 🟡 Moderate | Correct letter in correct position → must reuse that spot. Correct letter wrong position → must reuse it somewhere |
| 🔴 Difficult | All Moderate rules + wrong letters are permanently banned from keyboard |
| 🧠 Prodigy | All Difficult rules + limited guesses + rare/tricky word pool + hidden letter count info |

### Co-op Mode
- Two players share the same hidden word
- Players **cannot** see each other's actual letters
- Players **can** see: opponent's correct position count (🟩), misplaced count (🟨), total guesses used — in real time
- Winner = first to solve, or best result after 6 guesses
- Invite system for players to join each other's game
- Real-time grid sync (WebSocket-based)

---

## Core Features

### Unlimited Play
- No daily word limit
- Streak system
- "Play Again" button is a primary CTA on the result screen

### Hint System (Key Differentiator)
- No direct letter reveals — hints are **riddles**
- Progressive hint levels per game:
  - **Level 1:** Category clue (e.g. "Animal", "Action", "Object")
  - **Level 2:** Semantic/riddle clue (e.g. "A dance from Argentina 💃" for TANGO)
  - **Level 3:** Structural clue (e.g. "Contains a double letter", "Starts with a consonant cluster")
- Max 2 hints per game

Dont include score in the app its either you won in 6 guesses or you lose 

---

## Stats & Scoring (No Rank Tiers)

Display clean user history metrics — no levels or badges:

**Guess Distribution:**
- 1-guess wins, 2-guess wins … up to 6-guess wins (bar chart)

**Performance Stats:**
- Total games played
- Total wins
- Win %
- Current streak
- Max streak

**Skill Indicators (secondary):**
- Avg guesses per win
- Avg time per game
- Accuracy %

---

## Anti-Cheat
- Detect app backgrounding / focus loss → flag session
- Time anomaly detection (suspiciously fast perfect solves)
- Input pattern analysis for unrealistic sequences
- Strict tracking in ranked/competitive sessions; relaxed in casual

---

## Word System
Tiered word pool by difficulty:
- **Easy:** High-frequency, common words
- **Medium:** Mixed frequency
- **Hard/Prodigy:** Rare words, tricky patterns (double letters, uncommon combos)

Each word tagged with: frequency score, letter rarity score, pattern complexity.

---

## Tech Stack (Planned)
- **Mobile App:** React Native (iOS + Android)
- **Backend:** FastAPI
- **Realtime:** WebSockets (co-op sync)
- **Database:** PostgreSQL (users, game sessions, stats)
- **Sessions/Cache:** Redis

**DB Tables (core):**
- `users` — id, username, created_at
- `game_sessions` — id, user_id, word, guesses[], result, mode, time_taken
- `stats` — total_games, wins, streak, max_streak (or computed dynamically)

---

## UI Notes
- Keyboard with constraint highlights (banned letters greyed, correct letters highlighted)
- Forced-reuse indicators in Moderate/Hard mode
- Co-op screen: your grid + opponent's progress bar showing only 🟩🟨 counts
- Result screen: stats card + Play Again CTA + share option
- Replay/history view

---

## MVP Scope (Build First)
1. Solo mode with all 4 difficulty levels
2. Word engine + constraint enforcement
3. Hint system (riddle-based)
4. Stats tracking + guess distribution display
5. Play Again flow

## Phase 2
- Co-op mode (invite + real-time hidden progress)
- AI benchmark display (post-solve comparison: your moves vs solver vs top 10% humans — using a deterministic Wordle solver algorithm, not a live LLM)
- Leaderboard / anti-cheat layer