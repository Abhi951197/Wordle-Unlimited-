# Technical Design Document (TDD)

# Project

**Wordle Party (Working Title)**

Version: 0.1

Status: Draft

---

# 1. Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Socket.IO Client
* LiveKit React SDK

---

## Backend

* FastAPI
* Python 3.12+
* Socket.IO (Python)
* LiveKit Server SDK
* Uvicorn

---

## Database

PostgreSQL

Used for:

* User data (future)
* Rooms
* Game sessions
* Match history
* Statistics (future)

---

## Cache / Real-Time State

Redis

Used for:

* Active rooms
* Current game state
* Connected players
* Temporary room data
* Pub/Sub for scaling

---

## Voice Communication

LiveKit

Responsibilities:

* Voice rooms
* Audio transport
* Participant management
* Room tokens
* Low-latency communication

Game state is **not** synchronized through LiveKit.

---

## Deployment

Frontend

* Vercel

Backend

* Render / Railway / VPS

Database

* PostgreSQL

Redis

* Redis Cloud

LiveKit

* LiveKit Cloud (recommended for MVP)

---

# 2. High-Level Architecture

```
                 React Frontend
                        │
        ┌───────────────┴───────────────┐
        │                               │
   Socket.IO                       LiveKit
        │                               │
        │                               │
      FastAPI                    Voice Server
        │
        │
   PostgreSQL
        │
      Redis
```

---

# 3. Responsibilities

## Frontend

Responsible for:

* Game UI
* Keyboard input
* Board rendering
* Voice controls
* Room interface
* Real-time updates

---

## FastAPI

Responsible for:

* Room creation
* Join room
* Word validation
* Puzzle generation
* Guess validation
* Synchronization
* LiveKit token generation

---

## LiveKit

Responsible only for:

* Voice communication
* Audio streaming
* Participant connections

No gameplay logic should exist inside LiveKit.

---

# 4. Multiplayer Communication

## Socket.IO

Used for:

* Player joins
* Player leaves
* Guess submission
* Board updates
* Game events

Example events:

```
join_room

leave_room

submit_guess

game_update

game_finished
```

---

# 5. Voice Communication

Every game room corresponds to one LiveKit room.

Example:

```
Room ID

ABCD1234

↓

LiveKit Room

ABCD1234
```

When a player joins:

1. Backend creates a LiveKit access token.
2. Token is sent to the client.
3. Client connects to LiveKit.
4. Voice becomes active.

---

# 6. Dictionary

The game requires two separate word lists.

## Answer List

Contains words that may become the puzzle answer.

Recommended:

Original Wordle Answer List

Approximately:

* 2,315 words

Example:

```
apple

crane

flame

chair
```

---

## Allowed Guess List

Contains all valid guesses accepted by the game.

Recommended:

Original Wordle Allowed Guess List

Approximately:

* 10,657 words

---

# 7. Dictionary Storage

Store both lists as static files.

```
backend/

    data/

        answers.txt

        allowed_guesses.txt
```

Load once during server startup.

Convert to:

```
Python Set
```

for O(1) lookup.

Example:

```
allowed_words = set(...)
```

---

# 8. Selecting a Puzzle

For room-based games:

```
random.choice(answer_list)
```

Store the selected answer with the room.

Every participant in the room receives the same answer when required by the selected gameplay mode.

Puzzle generation logic can be extended later for daily challenges or custom word lists.

---

# 9. Guess Validation

When a player submits a word:

1. Check length.
2. Check alphabetic characters.
3. Check existence in allowed guess list.
4. Compute tile colors.
5. Update room state.
6. Broadcast update.

---

# 10. Real-Time Flow

```
Player

↓

Submit Guess

↓

FastAPI

↓

Validate

↓

Update Room State

↓

Broadcast

↓

Clients Update Board
```

---

# 11. Room State

Each room maintains:

```
Room ID

Players

Current Puzzle

Current Board State

Guess History

Game Status

Created Time
```

Redis is recommended for active room state because it provides fast in-memory access.

---

# 12. LiveKit Integration

Backend responsibilities:

* Generate access tokens
* Create rooms when needed
* Authenticate participants

Frontend responsibilities:

* Connect using token
* Publish microphone
* Receive remote audio
* Display participant status

---

# 13. Suggested Project Structure

```
backend/

    app/

        api/

        websocket/

        services/

            room_service.py

            game_service.py

            dictionary_service.py

            livekit_service.py

        models/

        schemas/

        utils/

    data/

        answers.txt

        allowed_guesses.txt

frontend/

    src/

        components/

        pages/

        hooks/

        services/

        socket/

        livekit/

        game/

```

---

# 14. Future Extensions

Possible future additions include:

* Daily puzzle mode
* Custom dictionaries
* Multiple gameplay modes
* Match history
* Rankings
* Replay support
* Spectator mode
* Mobile applications
* Cross-platform synchronization

These are intentionally excluded from the initial implementation.

---

# 15. Design Principles

* Keep gameplay logic independent of voice communication.
* Treat LiveKit solely as the real-time audio layer.
* Validate all guesses on the backend.
* Maintain a single authoritative game state on the server.
* Use Redis for fast synchronization of active rooms.
* Store only long-term data in PostgreSQL.
* Keep the frontend responsible only for presentation and user interaction.
