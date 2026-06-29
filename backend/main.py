from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
import uuid
import os
import string
import random

from words import get_word, VALID_GUESSES

load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    from livekit import api as livekit_api
except ImportError:  # LiveKit voice is disabled until livekit-api is installed.
    livekit_api = None

app = FastAPI(title="World Unlimited API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for game sessions (MVP)
from typing import Dict, Any
sessions: Dict[str, Dict[str, Any]] = {}
rooms: Dict[str, Dict[str, Any]] = {}

MAX_ROOM_PLAYERS = 8
ROOM_IDLE_TTL = timedelta(minutes=45)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

class GameCreateResponse(BaseModel):
    session_id: str
    length: int

class GuessRequest(BaseModel):
    session_id: str
    guess: str

class GuessResponse(BaseModel):
    states: list[str]  # e.g. ["correct", "present", "absent", ...]
    game_over: bool
    won: bool
    answer: str | None = None

class PlayerRequest(BaseModel):
    player_name: str = "Player"
    player_id: str | None = None

class RoomCreateRequest(PlayerRequest):
    difficulty: str = "easy"

class RoomJoinRequest(PlayerRequest):
    pass

class RoomGuessRequest(BaseModel):
    player_id: str
    guess: str

class RoomInputRequest(BaseModel):
    player_id: str
    current_guess: str

class RoomDifficultyRequest(BaseModel):
    player_id: str
    difficulty: str

class ActiveBoardRequest(BaseModel):
    player_id: str
    board: str

class ShareRequestCreate(BaseModel):
    player_id: str

class ShareRequestRespond(BaseModel):
    player_id: str
    accept: bool

class LiveKitInfo(BaseModel):
    configured: bool
    url: str | None = None
    token: str | None = None

class RoomPlayer(BaseModel):
    player_id: str
    player_name: str
    joined_at: str
    last_active_at: str | None = None

class BoardState(BaseModel):
    session_id: str
    difficulty: str
    length: int
    guesses: list[str]
    results: list[list[str]]
    current_guess: str = ""
    game_over: bool
    won: bool
    answer: str | None = None
    typing_player_id: str | None = None
    typing_player_name: str | None = None

class ShareRequestState(BaseModel):
    from_player_id: str
    from_player_name: str
    session_id: str
    created_at: str

class RoomStateResponse(BaseModel):
    room_id: str
    session_id: str
    difficulty: str
    length: int
    guesses: list[str]
    results: list[list[str]]
    current_guess: str = ""
    game_over: bool
    won: bool
    answer: str | None = None
    players: list[RoomPlayer]
    livekit: LiveKitInfo | None = None
    host_player_id: str | None = None
    active_board: str = "shared"
    shared_board: BoardState | None = None
    individual_board: BoardState | None = None
    share_request: ShareRequestState | None = None
    max_players: int = MAX_ROOM_PLAYERS
    typing_player_id: str | None = None
    typing_player_name: str | None = None

class RoomJoinResponse(RoomStateResponse):
    player_id: str

@app.get("/")
def read_root():
    return {"message": "Welcome to World Unlimited API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def _cleanup_idle_rooms() -> None:
    cutoff = datetime.now(timezone.utc) - ROOM_IDLE_TTL
    stale_rooms = [
        room_id
        for room_id, room in rooms.items()
        if _parse_dt(room.get("last_active_at") or room.get("created_at")) < cutoff
    ]
    for room_id in stale_rooms:
        room = rooms.pop(room_id, None)
        if not room:
            continue
        session_ids = set(room.get("player_sessions", {}).values())
        if room.get("active_shared_session_id"):
            session_ids.add(room["active_shared_session_id"])
        for session_id in session_ids:
            sessions.pop(session_id, None)

def _touch_room(room: dict[str, Any], player_id: str | None = None) -> None:
    now = _now_iso()
    room["last_active_at"] = now
    if player_id and player_id in room.get("players", {}):
        room["players"][player_id]["last_active_at"] = now

def _room_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(alphabet) for _ in range(6))
        if code not in rooms:
            return code

def _clean_player_name(player_name: str) -> str:
    name = player_name.strip()
    if not name:
        return "Player"
    return name[:32]

def _create_session(difficulty: str) -> str:
    word = get_word(difficulty)
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "word": word,
        "difficulty": difficulty,
        "guesses": [],
        "results": [],
        "current_guess": "",
        "game_over": False,
        "won": False,
        "typing_player_id": None,
        "typing_player_name": None,
    }
    return session_id

def _board_state(session_id: str | None) -> BoardState | None:
    if not session_id or session_id not in sessions:
        return None

    session = sessions[session_id]
    return BoardState(
        session_id=session_id,
        difficulty=session["difficulty"],
        length=len(session["word"]),
        guesses=session["guesses"],
        results=session["results"],
        current_guess=session.get("current_guess", ""),
        game_over=session["game_over"],
        won=session["won"],
        answer=session["word"] if session["game_over"] and not session["won"] else None,
        typing_player_id=session.get("typing_player_id"),
        typing_player_name=session.get("typing_player_name"),
    )

def _evaluate_guess(target_word: str, guess: str) -> list[str]:
    target_letters = list(target_word)
    guess_letters = list(guess)
    states = ["absent"] * len(target_word)

    for i in range(len(target_word)):
        if guess_letters[i] == target_letters[i]:
            states[i] = "correct"
            target_letters[i] = None

    for i in range(len(target_word)):
        if states[i] == "absent" and guess_letters[i] in target_letters:
            states[i] = "present"
            target_letters[target_letters.index(guess_letters[i])] = None

    return states

def _livekit_token(room_id: str, player_id: str, player_name: str) -> LiveKitInfo:
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET and livekit_api):
        return LiveKitInfo(configured=False)

    token = (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(player_id)
        .with_name(player_name)
        .with_grants(livekit_api.VideoGrants(room_join=True, room=room_id))
        .to_jwt()
    )
    return LiveKitInfo(configured=True, url=LIVEKIT_URL, token=token)

def _room_state(room_id: str, player_id: str | None = None) -> RoomStateResponse:
    _cleanup_idle_rooms()
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    room = rooms[room_id]
    if player_id and player_id not in room["player_sessions"]:
        room["player_sessions"][player_id] = _create_session(room.get("difficulty", "easy"))
    active_board = room["player_active_boards"].get(player_id, "shared") if player_id else "shared"
    shared_session_id = room.get("active_shared_session_id")
    individual_session_id = room["player_sessions"].get(player_id) if player_id else None
    active_session_id = (
        individual_session_id
        if active_board == "individual" and individual_session_id
        else shared_session_id or individual_session_id
    )
    session = sessions[active_session_id]
    livekit = None
    if player_id and player_id in room["players"]:
        livekit = _livekit_token(room_id, player_id, room["players"][player_id]["player_name"])

    return RoomStateResponse(
        room_id=room_id,
        session_id=active_session_id,
        difficulty=session["difficulty"],
        length=len(session["word"]),
        guesses=session["guesses"],
        results=session["results"],
        current_guess=session.get("current_guess", ""),
        game_over=session["game_over"],
        won=session["won"],
        answer=session["word"] if session["game_over"] and not session["won"] else None,
        players=list(room["players"].values()),
        livekit=livekit,
        host_player_id=room.get("host_player_id"),
        active_board=active_board,
        shared_board=_board_state(shared_session_id),
        individual_board=_board_state(individual_session_id),
        share_request=room.get("share_request"),
        max_players=MAX_ROOM_PLAYERS,
        typing_player_id=session.get("typing_player_id"),
        typing_player_name=session.get("typing_player_name"),
    )

def _require_room_player(room_id: str, player_id: str) -> dict[str, Any]:
    _cleanup_idle_rooms()
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if player_id not in rooms[room_id]["players"]:
        raise HTTPException(status_code=403, detail="Player is not in this room")
    return rooms[room_id]

def _active_session_id(room: dict[str, Any], player_id: str) -> str:
    if player_id not in room["player_sessions"]:
        room["player_sessions"][player_id] = _create_session(room.get("difficulty", "easy"))

    active_board = room["player_active_boards"].get(player_id, "shared")
    if active_board == "individual":
        return room["player_sessions"][player_id]
    return room["active_shared_session_id"] or room["player_sessions"][player_id]

def _submit_guess_to_session(session_id: str, guess: str) -> GuessResponse:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    target_word = session["word"]
    guess = guess.upper()

    if session.get("game_over"):
        raise HTTPException(status_code=409, detail="Game already finished")

    if len(guess) != len(target_word):
        raise HTTPException(status_code=400, detail="Invalid guess length")

    if not guess.isalpha() or guess not in VALID_GUESSES:
        raise HTTPException(status_code=422, detail="Not in word list")

    states = _evaluate_guess(target_word, guess)
    session["guesses"].append(guess)
    session["results"].append(states)
    session["current_guess"] = ""
    session["typing_player_id"] = None
    session["typing_player_name"] = None

    won = states.count("correct") == len(target_word)
    max_guesses = 4 if session["difficulty"] == "prodigy" else 6
    game_over = won or len(session["guesses"]) >= max_guesses
    session["won"] = won
    session["game_over"] = game_over

    return GuessResponse(
        states=states,
        game_over=game_over,
        won=won,
        answer=target_word if (game_over and not won) else None,
    )

@app.get("/word", response_model=GameCreateResponse)
def create_game(difficulty: str = "easy"):
    session_id = _create_session(difficulty)
    return GameCreateResponse(session_id=session_id, length=len(sessions[session_id]["word"]))

@app.post("/guess", response_model=GuessResponse)
def submit_guess(req: GuessRequest):
    return _submit_guess_to_session(req.session_id, req.guess)

@app.post("/rooms", response_model=RoomJoinResponse)
def create_room(req: RoomCreateRequest):
    _cleanup_idle_rooms()
    room_id = _room_code()
    player_id = req.player_id or str(uuid.uuid4())
    player_name = _clean_player_name(req.player_name)
    shared_session_id = _create_session(req.difficulty)
    individual_session_id = _create_session(req.difficulty)
    rooms[room_id] = {
        "room_id": room_id,
        "host_player_id": player_id,
        "voice_room_id": room_id,
        "difficulty": req.difficulty,
        "active_shared_session_id": shared_session_id,
        "player_sessions": {player_id: individual_session_id},
        "player_active_boards": {player_id: "shared"},
        "share_request": None,
        "created_at": _now_iso(),
        "players": {
            player_id: {
                "player_id": player_id,
                "player_name": player_name,
                "joined_at": _now_iso(),
                "last_active_at": _now_iso(),
            }
        },
        "last_active_at": _now_iso(),
    }
    state = _room_state(room_id, player_id)
    return RoomJoinResponse(**state.model_dump(), player_id=player_id)

@app.post("/rooms/{room_id}/join", response_model=RoomJoinResponse)
def join_room(room_id: str, req: RoomJoinRequest):
    _cleanup_idle_rooms()
    room_id = room_id.strip().upper()
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    player_id = req.player_id or str(uuid.uuid4())
    if player_id not in rooms[room_id]["players"] and len(rooms[room_id]["players"]) >= MAX_ROOM_PLAYERS:
        raise HTTPException(status_code=409, detail="Room is full")
    if player_id not in rooms[room_id]["player_sessions"]:
        rooms[room_id]["player_sessions"][player_id] = _create_session(rooms[room_id].get("difficulty", "easy"))
    rooms[room_id]["player_active_boards"].setdefault(player_id, "shared")
    rooms[room_id]["players"][player_id] = {
        "player_id": player_id,
        "player_name": _clean_player_name(req.player_name),
        "joined_at": rooms[room_id]["players"].get(player_id, {}).get("joined_at", _now_iso()),
        "last_active_at": _now_iso(),
    }
    _touch_room(rooms[room_id], player_id)
    state = _room_state(room_id, player_id)
    return RoomJoinResponse(**state.model_dump(), player_id=player_id)

@app.get("/rooms/{room_id}", response_model=RoomStateResponse)
def get_room_state(room_id: str, player_id: str | None = None):
    return _room_state(room_id.strip().upper(), player_id)

@app.post("/rooms/{room_id}/guess", response_model=RoomStateResponse)
def submit_room_guess(room_id: str, req: RoomGuessRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)

    _submit_guess_to_session(_active_session_id(room, req.player_id), req.guess)
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/input", response_model=RoomStateResponse)
def update_room_input(room_id: str, req: RoomInputRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)

    session = sessions[_active_session_id(room, req.player_id)]
    guess = req.current_guess.upper()
    if len(guess) > len(session["word"]) or (guess and not guess.isalpha()):
        raise HTTPException(status_code=400, detail="Invalid current guess")

    if not session.get("game_over"):
        session["current_guess"] = guess
        if guess:
            session["typing_player_id"] = req.player_id
            session["typing_player_name"] = room["players"][req.player_id]["player_name"]
        else:
            session["typing_player_id"] = None
            session["typing_player_name"] = None
        _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/shared-game", response_model=RoomStateResponse)
def create_shared_game(room_id: str, req: PlayerRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id or "")
    difficulty = room.get("difficulty", "easy")
    room["active_shared_session_id"] = _create_session(difficulty)
    room["share_request"] = None
    for player_id in room["players"]:
        room["player_active_boards"][player_id] = "shared"
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/individual-game", response_model=RoomStateResponse)
def create_individual_game(room_id: str, req: PlayerRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id or "")
    difficulty = room.get("difficulty", "easy")
    room["player_sessions"][req.player_id] = _create_session(difficulty)
    room["player_active_boards"][req.player_id] = "individual"
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/difficulty", response_model=RoomStateResponse)
def change_room_difficulty(room_id: str, req: RoomDifficultyRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)
    difficulty = req.difficulty.strip().lower()
    room["difficulty"] = difficulty
    room["active_shared_session_id"] = _create_session(difficulty)
    room["share_request"] = None
    for player_id in room["players"]:
        room["player_sessions"][player_id] = _create_session(difficulty)
        room["player_active_boards"][player_id] = "shared"
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/active-board", response_model=RoomStateResponse)
def set_active_board(room_id: str, req: ActiveBoardRequest):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)
    if req.board not in {"shared", "individual"}:
        raise HTTPException(status_code=400, detail="Board must be shared or individual")
    if req.board == "shared" and not room.get("active_shared_session_id"):
        room["active_shared_session_id"] = _create_session(room.get("difficulty", "easy"))
    if req.board == "individual" and req.player_id not in room["player_sessions"]:
        room["player_sessions"][req.player_id] = _create_session(room.get("difficulty", "easy"))
    room["player_active_boards"][req.player_id] = req.board
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/share-request", response_model=RoomStateResponse)
def create_share_request(room_id: str, req: ShareRequestCreate):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)
    if req.player_id not in room["player_sessions"]:
        room["player_sessions"][req.player_id] = _create_session(room.get("difficulty", "easy"))
    room["share_request"] = ShareRequestState(
        from_player_id=req.player_id,
        from_player_name=room["players"][req.player_id]["player_name"],
        session_id=room["player_sessions"][req.player_id],
        created_at=_now_iso(),
    )
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

@app.post("/rooms/{room_id}/share-request/respond", response_model=RoomStateResponse)
def respond_share_request(room_id: str, req: ShareRequestRespond):
    room_id = room_id.strip().upper()
    room = _require_room_player(room_id, req.player_id)
    share_request = room.get("share_request")
    if not share_request:
        return _room_state(room_id, req.player_id)

    if req.accept:
        room["active_shared_session_id"] = share_request.session_id
        for player_id in room["players"]:
            room["player_active_boards"][player_id] = "shared"
    room["share_request"] = None
    _touch_room(room, req.player_id)
    return _room_state(room_id, req.player_id)

from hints import WORD_HINTS

@app.get("/hint")
def get_hint(session_id: str, level: int = 1):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    word = sessions[session_id]["word"]
    hints = WORD_HINTS.get(word, {})
    
    if level == 1:
        return {"hint": hints.get("category", "No category hint available")}
    elif level == 2:
        return {"hint": hints.get("riddle", "No riddle available")}
    else:
        return {"hint": hints.get("structure", "No structural hint available")}
