from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import random

from words import get_word, VALID_GUESSES

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

@app.get("/")
def read_root():
    return {"message": "Welcome to World Unlimited API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/word", response_model=GameCreateResponse)
def create_game(difficulty: str = "easy"):
    word = get_word(difficulty)
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "word": word,
        "difficulty": difficulty,
        "guesses": []
    }
    return GameCreateResponse(session_id=session_id, length=len(word))

@app.post("/guess", response_model=GuessResponse)
def submit_guess(req: GuessRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[req.session_id]
    target_word = session["word"]
    guess = req.guess.upper()

    if len(guess) != len(target_word):
        raise HTTPException(status_code=400, detail="Invalid guess length")

    if guess not in VALID_GUESSES:
        raise HTTPException(status_code=422, detail="Not in word list")
    
    # Evaluate guess
    target_letters = list(target_word)
    guess_letters = list(guess)
    states = ["absent"] * len(target_word)
    
    # First pass: correct
    for i in range(len(target_word)):
        if guess_letters[i] == target_letters[i]:
            states[i] = "correct"
            target_letters[i] = None # mark as used
            
    # Second pass: present
    for i in range(len(target_word)):
        if states[i] == "absent" and guess_letters[i] in target_letters:
            states[i] = "present"
            target_letters[target_letters.index(guess_letters[i])] = None
            
    session["guesses"].append(guess)
    
    won = states.count("correct") == len(target_word)
    max_guesses = 4 if session["difficulty"] == "prodigy" else 6
    game_over = won or len(session["guesses"]) >= max_guesses
    
    return GuessResponse(
        states=states, 
        game_over=game_over, 
        won=won, 
        answer=target_word if (game_over and not won) else None
    )

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

