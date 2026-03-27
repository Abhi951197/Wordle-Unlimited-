import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Stats {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
}

export interface Toast {
  message: string;
  type: 'error' | 'warning' | 'info';
}

interface GameStateContextType {
  difficulty: string;
  wordLength: number;
  sessionId: string | null;
  guesses: string[];
  results: string[][];
  currentGuess: string;
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'>;
  stats: Stats;
  startGame: (difficulty: string) => Promise<void>;
  addLetter: (letter: string) => void;
  removeLetter: () => void;
  submitGuess: () => Promise<void>;
  getHint: (level: number) => Promise<void>;
  hints: { level: number; text: string }[];
  hintsUsed: number;
  invalidShake: number;
  lastSubmittedRow: number;
  answer: string | null;
  maxGuesses: number;
  toast: Toast | null;
}

const defaultStats: Stats = {
  gamesPlayed: 0, wins: 0, currentStreak: 0, maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [difficulty, setDifficulty] = useState('easy');
  const [wordLength, setWordLength]   = useState(5);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [guesses, setGuesses]         = useState<string[]>([]);
  const [results, setResults]         = useState<string[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus]   = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, any>>({});
  const [stats, setStats]             = useState<Stats>(defaultStats);
  const [hints, setHints]             = useState<{ level: number; text: string }[]>([]);
  const [hintsUsed, setHintsUsed]     = useState(0);
  const [invalidShake, setInvalidShake] = useState(0);
  const [lastSubmittedRow, setLastSubmittedRow] = useState(-1);
  const [answer, setAnswer]           = useState<string | null>(null);
  const [toast, setToastState]        = useState<Toast | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_URL = 'https://wordle-unlimited-6sjv.onrender.com';

  // ── Persist / load stats ────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('word_unlimited_stats').then(val => {
      if (val) setStats(JSON.parse(val));
    });
  }, []);

  const saveAndSetStats = async (s: Stats) => {
    setStats(s);
    await AsyncStorage.setItem('word_unlimited_stats', JSON.stringify(s));
  };

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = (message: string, type: Toast['type'] = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ message, type });
    toastTimer.current = setTimeout(() => setToastState(null), 2400);
  };

  const triggerShake = () => setInvalidShake(v => v + 1);

  // ── Start game ───────────────────────────────────────────────────────────────
  const startGame = async (diff: string) => {
    try {
      const res  = await fetch(`${API_URL}/word?difficulty=${diff}`);
      const data = await res.json();
      setSessionId(data.session_id);
      setWordLength(data.length);
      setDifficulty(diff);
      setGuesses([]);
      setResults([]);
      setCurrentGuess('');
      setGameStatus('playing');
      setLetterStates({});
      setHints([]);
      setHintsUsed(0);
      setInvalidShake(0);
      setLastSubmittedRow(-1);
      setAnswer(null);
      setToastState(null);
    } catch {
      showToast('Cannot reach backend — is it running?', 'error');
    }
  };

  // ── Hints ────────────────────────────────────────────────────────────────────
  const getHint = async (level: number) => {
    if (hintsUsed >= 2 || !sessionId) return;
    try {
      const res  = await fetch(`${API_URL}/hint?session_id=${sessionId}&level=${level}`);
      const data = await res.json();
      setHints(prev => [...prev, { level, text: data.hint }]);
      setHintsUsed(prev => prev + 1);
    } catch {
      showToast('Could not load hint', 'warning');
    }
  };

  // ── Letter input ─────────────────────────────────────────────────────────────
  const addLetter = (letter: string) => {
    if (gameStatus !== 'playing') return;
    if (currentGuess.length < wordLength) {
      setCurrentGuess(prev => prev + letter);
    }
  };

  const removeLetter = () => {
    if (gameStatus !== 'playing') return;
    setCurrentGuess(prev => prev.slice(0, -1));
  };

  // ── Submit guess ─────────────────────────────────────────────────────────────
  const submitGuess = async () => {
    if (gameStatus !== 'playing') return;
    if (!sessionId) return;

    // 1. Length check
    if (currentGuess.length !== wordLength) {
      triggerShake();
      showToast(`Need ${wordLength} letters`, 'error');
      return;
    }

    const isModerateOrHard = ['moderate', 'difficult', 'prodigy'].includes(difficulty);
    const isHardOrProdigy  = ['difficult', 'prodigy'].includes(difficulty);

    // 2. Banned-letter check (Hard / Prodigy)
    if (isHardOrProdigy) {
      for (let i = 0; i < currentGuess.length; i++) {
        const l = currentGuess[i];
        if (letterStates[l] === 'absent' || letterStates[l] === 'banned') {
          triggerShake();
          showToast(`'${l}' is eliminated — it's not in the word`, 'error');
          return;
        }
      }
    }

    // 3. Constraint checks (Moderate+)
    if (isModerateOrHard && guesses.length > 0) {
      for (let g = 0; g < guesses.length; g++) {
        const pastGuess  = guesses[g];
        const pastResult = results[g];
        for (let i = 0; i < wordLength; i++) {
          if (pastResult[i] === 'correct' && currentGuess[i] !== pastGuess[i]) {
            triggerShake();
            showToast(`'${pastGuess[i]}' must stay in position ${i + 1}`, 'error');
            return;
          }
          if (pastResult[i] === 'present' && !currentGuess.includes(pastGuess[i])) {
            triggerShake();
            showToast(`Must include '${pastGuess[i]}' somewhere in your guess`, 'warning');
            return;
          }
        }
      }
    }

    // 4. Send to backend
    try {
      const res = await fetch(`${API_URL}/guess`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId, guess: currentGuess }),
      });

      // Word-not-in-list rejection
      if (res.status === 422) {
        triggerShake();
        showToast('Not in word list', 'error');
        return;
      }
      if (!res.ok) {
        triggerShake();
        showToast('Something went wrong', 'error');
        return;
      }

      const data = await res.json();
      const newResults = [...results, data.states];
      const newGuesses = [...guesses, currentGuess];

      setLastSubmittedRow(guesses.length);
      setResults(newResults);
      setGuesses(newGuesses);
      setCurrentGuess('');

      // Update letter states
      const newStates = { ...letterStates };
      for (let i = 0; i < currentGuess.length; i++) {
        const ch    = currentGuess[i];
        const state = data.states[i];
        if (state === 'correct') {
          newStates[ch] = 'correct';
        } else if (state === 'present' && newStates[ch] !== 'correct') {
          newStates[ch] = 'present';
        } else if (state === 'absent' && !newStates[ch]) {
          newStates[ch] = isHardOrProdigy ? 'banned' : 'absent';
        }
      }
      setLetterStates(newStates);

      // Wait for flip animation then show result
      setTimeout(() => {
        if (data.won) {
          setGameStatus('won');
          const newDists = [...stats.guessDistribution];
          newDists[newGuesses.length - 1]++;
          const streak = stats.currentStreak + 1;
          saveAndSetStats({
            gamesPlayed: stats.gamesPlayed + 1,
            wins: stats.wins + 1,
            currentStreak: streak,
            maxStreak: Math.max(stats.maxStreak, streak),
            guessDistribution: newDists,
          });
        } else if (data.game_over) {
          setAnswer(data.answer);
          setGameStatus('lost');
          saveAndSetStats({
            ...stats,
            gamesPlayed: stats.gamesPlayed + 1,
            currentStreak: 0,
          });
        }
      }, 1600);

    } catch {
      showToast('Network error — check your connection', 'error');
    }
  };

  const maxGuesses = difficulty === 'prodigy' ? 4 : 6;

  return (
    <GameStateContext.Provider value={{
      difficulty, wordLength, sessionId, guesses, results, currentGuess,
      gameStatus, letterStates, stats, startGame, addLetter, removeLetter,
      submitGuess, getHint, hints, hintsUsed, invalidShake, lastSubmittedRow,
      answer, maxGuesses, toast,
    }}>
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be inside GameStateProvider');
  return ctx;
};
