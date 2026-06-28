import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

export interface LiveKitSession {
  configured: boolean;
  url?: string | null;
  token?: string | null;
}

export interface RoomPlayer {
  player_id: string;
  player_name: string;
  joined_at: string;
}

interface GameStateContextType {
  difficulty: string;
  wordLength: number;
  sessionId: string | null;
  roomId: string | null;
  playerId: string | null;
  playerName: string;
  roomPlayers: RoomPlayer[];
  livekit: LiveKitSession | null;
  guesses: string[];
  results: string[][];
  currentGuess: string;
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'>;
  stats: Stats;
  startGame: (difficulty: string) => Promise<void>;
  createRoom: (difficulty: string, playerName: string) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  leaveRoom: () => void;
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
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [difficulty, setDifficulty] = useState('easy');
  const [wordLength, setWordLength] = useState(5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [livekit, setLivekit] = useState<LiveKitSession | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [results, setResults] = useState<string[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [hints, setHints] = useState<{ level: number; text: string }[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [invalidShake, setInvalidShake] = useState(0);
  const [lastSubmittedRow, setLastSubmittedRow] = useState(-1);
  const [answer, setAnswer] = useState<string | null>(null);
  const [toast, setToastState] = useState<Toast | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRoomRef = useRef<{ roomId: string | null; playerId: string | null }>({
    roomId: null,
    playerId: null,
  });

  useEffect(() => {
    latestRoomRef.current = { roomId, playerId };
  }, [roomId, playerId]);

  useEffect(() => {
    AsyncStorage.getItem('word_unlimited_stats').then(val => {
      if (val) setStats(JSON.parse(val));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('word_party_room').then(async val => {
      if (!val) return;
      try {
        const saved = JSON.parse(val);
        if (!saved.roomId || !saved.playerId) return;

        const res = await fetch(`${API_URL}/rooms/${saved.roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: saved.playerId,
            player_name: saved.playerName || 'Player',
          }),
        });
        if (!res.ok) {
          await AsyncStorage.removeItem('word_party_room');
          return;
        }

        const data = await res.json();
        setPlayerId(data.player_id);
        setPlayerName(saved.playerName || 'Player');
        applyRoomState(data);
      } catch {
        await AsyncStorage.removeItem('word_party_room');
      }
    });
  }, []);

  const saveAndSetStats = async (s: Stats) => {
    setStats(s);
    await AsyncStorage.setItem('word_unlimited_stats', JSON.stringify(s));
  };

  const showToast = (message: string, type: Toast['type'] = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ message, type });
    toastTimer.current = setTimeout(() => setToastState(null), 2400);
  };

  const triggerShake = () => setInvalidShake(v => v + 1);

  const resetBoardState = () => {
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
  };

  const buildLetterStates = (
    syncedGuesses: string[],
    syncedResults: string[][],
    diff: string,
  ) => {
    const isHardOrProdigy = ['difficult', 'prodigy'].includes(diff);
    const nextStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'> = {};

    syncedGuesses.forEach((guess, guessIndex) => {
      const row = syncedResults[guessIndex] ?? [];
      for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        const state = row[i];
        if (state === 'correct') {
          nextStates[ch] = 'correct';
        } else if (state === 'present' && nextStates[ch] !== 'correct') {
          nextStates[ch] = 'present';
        } else if (state === 'absent' && !nextStates[ch]) {
          nextStates[ch] = isHardOrProdigy ? 'banned' : 'absent';
        }
      }
    });

    return nextStates;
  };

  const applyRoomState = (data: any) => {
    setSessionId(data.session_id);
    setRoomId(data.room_id);
    setWordLength(data.length);
    setDifficulty(data.difficulty);
    setGuesses(data.guesses ?? []);
    setResults(data.results ?? []);
    setCurrentGuess(data.current_guess ?? '');
    setRoomPlayers(data.players ?? []);
    setLivekit(data.livekit ?? null);
    setLetterStates(buildLetterStates(data.guesses ?? [], data.results ?? [], data.difficulty));
    setGameStatus(data.won ? 'won' : data.game_over ? 'lost' : 'playing');
    setAnswer(data.answer ?? null);
  };

  const startGame = async (diff: string) => {
    try {
      const res = await fetch(`${API_URL}/word?difficulty=${diff}`);
      const data = await res.json();
      setSessionId(data.session_id);
      setRoomId(null);
      setPlayerId(null);
      setRoomPlayers([]);
      setLivekit(null);
      AsyncStorage.removeItem('word_party_room');
      setWordLength(data.length);
      setDifficulty(diff);
      resetBoardState();
    } catch {
      showToast('Cannot reach backend - is it running?', 'error');
    }
  };

  const createRoom = async (diff: string, name: string) => {
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff, player_name: name }),
      });
      if (!res.ok) throw new Error('Could not create room');

      const data = await res.json();
      setPlayerId(data.player_id);
      setPlayerName(name.trim() || 'Player');
      await AsyncStorage.setItem('word_party_room', JSON.stringify({
        roomId: data.room_id,
        playerId: data.player_id,
        playerName: name.trim() || 'Player',
      }));
      resetBoardState();
      applyRoomState(data);
      showToast(`Room ${data.room_id} is ready`, 'info');
    } catch {
      showToast('Could not create room', 'error');
    }
  };

  const joinRoom = async (code: string, name: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      showToast('Enter a room code', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/rooms/${normalizedCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, player_name: name }),
      });
      if (res.status === 404) {
        showToast('Room not found', 'error');
        return;
      }
      if (!res.ok) throw new Error('Could not join room');

      const data = await res.json();
      setPlayerId(data.player_id);
      setPlayerName(name.trim() || 'Player');
      await AsyncStorage.setItem('word_party_room', JSON.stringify({
        roomId: data.room_id,
        playerId: data.player_id,
        playerName: name.trim() || 'Player',
      }));
      resetBoardState();
      applyRoomState(data);
      showToast(`Joined room ${data.room_id}`, 'info');
    } catch {
      showToast('Could not join room', 'error');
    }
  };

  const leaveRoom = () => {
    setRoomId(null);
    setPlayerId(null);
    setRoomPlayers([]);
    setLivekit(null);
    AsyncStorage.removeItem('word_party_room');
    startGame(difficulty);
  };

  useEffect(() => {
    if (!roomId || !playerId) return;

    const refresh = async () => {
      try {
        const res = await fetch(`${API_URL}/rooms/${roomId}?player_id=${playerId}`);
        if (!res.ok) return;
        const data = await res.json();
        applyRoomState(data);
      } catch {
        // Transient polling failures should not interrupt the local UI.
      }
    };

    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [roomId, playerId]);

  const getHint = async (level: number) => {
    if (hintsUsed >= 2 || !sessionId) return;
    try {
      const res = await fetch(`${API_URL}/hint?session_id=${sessionId}&level=${level}`);
      const data = await res.json();
      setHints(prev => [...prev, { level, text: data.hint }]);
      setHintsUsed(prev => prev + 1);
    } catch {
      showToast('Could not load hint', 'warning');
    }
  };

  const syncRoomInput = async (nextGuess: string) => {
    const activeRoomId = latestRoomRef.current.roomId;
    const activePlayerId = latestRoomRef.current.playerId;
    if (!activeRoomId || !activePlayerId) return;

    try {
      await fetch(`${API_URL}/rooms/${activeRoomId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: activePlayerId,
          current_guess: nextGuess,
        }),
      });
    } catch {
      // Current-letter sync is best effort; polling will repair state.
    }
  };

  const addLetter = (letter: string) => {
    if (gameStatus !== 'playing') return;
    if (currentGuess.length < wordLength) {
      const nextGuess = currentGuess + letter;
      setCurrentGuess(nextGuess);
      syncRoomInput(nextGuess);
    }
  };

  const removeLetter = () => {
    if (gameStatus !== 'playing') return;
    const nextGuess = currentGuess.slice(0, -1);
    setCurrentGuess(nextGuess);
    syncRoomInput(nextGuess);
  };

  const submitGuess = async () => {
    if (gameStatus !== 'playing' || !sessionId) return;

    if (currentGuess.length !== wordLength) {
      triggerShake();
      showToast(`Need ${wordLength} letters`, 'error');
      return;
    }

    const isModerateOrHard = ['moderate', 'difficult', 'prodigy'].includes(difficulty);
    const isHardOrProdigy = ['difficult', 'prodigy'].includes(difficulty);

    if (isHardOrProdigy) {
      for (let i = 0; i < currentGuess.length; i++) {
        const l = currentGuess[i];
        if (letterStates[l] === 'absent' || letterStates[l] === 'banned') {
          triggerShake();
          showToast(`'${l}' is eliminated - it's not in the word`, 'error');
          return;
        }
      }
    }

    if (isModerateOrHard && guesses.length > 0) {
      for (let g = 0; g < guesses.length; g++) {
        const pastGuess = guesses[g];
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

    try {
      const endpoint = roomId && playerId ? `${API_URL}/rooms/${roomId}/guess` : `${API_URL}/guess`;
      const body = roomId && playerId
        ? { player_id: playerId, guess: currentGuess }
        : { session_id: sessionId, guess: currentGuess };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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
      setLastSubmittedRow(guesses.length);
      setCurrentGuess('');
      syncRoomInput('');

      if (roomId) {
        applyRoomState(data);
        return;
      }

      const newResults = [...results, data.states];
      const newGuesses = [...guesses, currentGuess];
      setResults(newResults);
      setGuesses(newGuesses);

      const newStates = { ...letterStates };
      for (let i = 0; i < currentGuess.length; i++) {
        const ch = currentGuess[i];
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
      showToast('Network error - check your connection', 'error');
    }
  };

  const maxGuesses = difficulty === 'prodigy' ? 4 : 6;

  return (
    <GameStateContext.Provider value={{
      difficulty, wordLength, sessionId, roomId, playerId, playerName,
      roomPlayers, livekit, guesses, results, currentGuess, gameStatus,
      letterStates, stats, startGame, createRoom, joinRoom, leaveRoom,
      addLetter, removeLetter, submitGuess, getHint, hints, hintsUsed,
      invalidShake, lastSubmittedRow, answer, maxGuesses, toast,
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
