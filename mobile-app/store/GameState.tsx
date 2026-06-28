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

export interface BoardState {
  session_id: string;
  difficulty: string;
  length: number;
  guesses: string[];
  results: string[][];
  current_guess: string;
  game_over: boolean;
  won: boolean;
  answer?: string | null;
}

export interface ShareRequestState {
  from_player_id: string;
  from_player_name: string;
  session_id: string;
  created_at: string;
}

export type ActiveBoard = 'shared' | 'individual';

interface GameStateContextType {
  difficulty: string;
  wordLength: number;
  sessionId: string | null;
  roomId: string | null;
  playerId: string | null;
  playerName: string;
  roomPlayers: RoomPlayer[];
  livekit: LiveKitSession | null;
  activeBoard: ActiveBoard;
  sharedBoard: BoardState | null;
  individualBoard: BoardState | null;
  shareRequest: ShareRequestState | null;
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
  createSharedGame: () => Promise<void>;
  createIndividualGame: () => Promise<void>;
  setActiveBoard: (board: ActiveBoard) => Promise<void>;
  requestShareBoard: () => Promise<void>;
  respondToShareRequest: (accept: boolean) => Promise<void>;
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
const ROOM_STORAGE_KEY = 'word_party_room';

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
  const [activeBoard, setActiveBoardState] = useState<ActiveBoard>('shared');
  const [sharedBoard, setSharedBoard] = useState<BoardState | null>(null);
  const [individualBoard, setIndividualBoard] = useState<BoardState | null>(null);
  const [shareRequest, setShareRequest] = useState<ShareRequestState | null>(null);
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
  const currentGuessRef = useRef('');

  useEffect(() => {
    latestRoomRef.current = { roomId, playerId };
  }, [roomId, playerId]);

  useEffect(() => {
    currentGuessRef.current = currentGuess;
  }, [currentGuess]);

  useEffect(() => {
    AsyncStorage.getItem('word_unlimited_stats').then(val => {
      if (val) setStats(JSON.parse(val));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ROOM_STORAGE_KEY).then(async val => {
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
          await AsyncStorage.removeItem(ROOM_STORAGE_KEY);
          return;
        }

        const data = await res.json();
        setPlayerId(data.player_id);
        setPlayerName(saved.playerName || 'Player');
        applyRoomState(data);
      } catch {
        await AsyncStorage.removeItem(ROOM_STORAGE_KEY);
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
    currentGuessRef.current = '';
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

  const applyBoard = (board: BoardState | null) => {
    if (!board) return;
    setSessionId(board.session_id);
    setWordLength(board.length);
    setDifficulty(board.difficulty);
    setGuesses(board.guesses ?? []);
    setResults(board.results ?? []);
    setCurrentGuess(board.current_guess ?? '');
    currentGuessRef.current = board.current_guess ?? '';
    setLetterStates(buildLetterStates(board.guesses ?? [], board.results ?? [], board.difficulty));
    setGameStatus(board.won ? 'won' : board.game_over ? 'lost' : 'playing');
    setAnswer(board.answer ?? null);
  };

  const applyRoomState = (data: any) => {
    const boardMode: ActiveBoard = data.active_board === 'individual' ? 'individual' : 'shared';
    const nextShared = data.shared_board ?? null;
    const nextIndividual = data.individual_board ?? null;
    const active = boardMode === 'individual' ? nextIndividual : nextShared;

    setRoomId(data.room_id);
    setRoomPlayers(data.players ?? []);
    setLivekit(data.livekit ?? null);
    setActiveBoardState(boardMode);
    setSharedBoard(nextShared);
    setIndividualBoard(nextIndividual);
    setShareRequest(data.share_request ?? null);
    applyBoard(active ?? {
      session_id: data.session_id,
      difficulty: data.difficulty,
      length: data.length,
      guesses: data.guesses ?? [],
      results: data.results ?? [],
      current_guess: data.current_guess ?? '',
      game_over: data.game_over,
      won: data.won,
      answer: data.answer,
    });
  };

  const persistRoom = async (data: any, name: string) => {
    await AsyncStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify({
      roomId: data.room_id,
      playerId: data.player_id,
      playerName: name.trim() || 'Player',
    }));
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
      setActiveBoardState('shared');
      setSharedBoard(null);
      setIndividualBoard(null);
      setShareRequest(null);
      AsyncStorage.removeItem(ROOM_STORAGE_KEY);
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
      const cleanName = name.trim() || 'Player';
      setPlayerId(data.player_id);
      setPlayerName(cleanName);
      await persistRoom(data, cleanName);
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
      const cleanName = name.trim() || 'Player';
      setPlayerId(data.player_id);
      setPlayerName(cleanName);
      await persistRoom(data, cleanName);
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
    setActiveBoardState('shared');
    setSharedBoard(null);
    setIndividualBoard(null);
    setShareRequest(null);
    AsyncStorage.removeItem(ROOM_STORAGE_KEY);
    startGame(difficulty);
  };

  const postRoomAction = async (path: string, body: Record<string, unknown>) => {
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, ...body }),
      });
      if (!res.ok) throw new Error(path);
      const data = await res.json();
      resetBoardState();
      applyRoomState(data);
    } catch {
      showToast('Could not update room', 'error');
    }
  };

  const createSharedGame = async () => {
    await postRoomAction('shared-game', {});
  };

  const createIndividualGame = async () => {
    await postRoomAction('individual-game', {});
  };

  const setActiveBoard = async (board: ActiveBoard) => {
    await postRoomAction('active-board', { board });
  };

  const requestShareBoard = async () => {
    await postRoomAction('share-request', {});
    showToast('Board share request sent', 'info');
  };

  const respondToShareRequest = async (accept: boolean) => {
    await postRoomAction('share-request/respond', { accept });
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
    const guess = currentGuessRef.current;
    if (guess.length < wordLength) {
      const nextGuess = guess + letter;
      currentGuessRef.current = nextGuess;
      setCurrentGuess(nextGuess);
      syncRoomInput(nextGuess);
    }
  };

  const removeLetter = () => {
    if (gameStatus !== 'playing') return;
    const nextGuess = currentGuessRef.current.slice(0, -1);
    currentGuessRef.current = nextGuess;
    setCurrentGuess(nextGuess);
    syncRoomInput(nextGuess);
  };

  const submitGuess = async () => {
    const guess = currentGuessRef.current;
    if (gameStatus !== 'playing' || !sessionId) return;

    if (guess.length !== wordLength) {
      triggerShake();
      showToast(`Need ${wordLength} letters`, 'error');
      return;
    }

    const isModerateOrHard = ['moderate', 'difficult', 'prodigy'].includes(difficulty);
    const isHardOrProdigy = ['difficult', 'prodigy'].includes(difficulty);

    if (isHardOrProdigy) {
      for (let i = 0; i < guess.length; i++) {
        const l = guess[i];
        if (letterStates[l] === 'absent' || letterStates[l] === 'banned') {
          triggerShake();
          showToast(`'${l}' is eliminated - it is not in the word`, 'error');
          return;
        }
      }
    }

    if (isModerateOrHard && guesses.length > 0) {
      for (let g = 0; g < guesses.length; g++) {
        const pastGuess = guesses[g];
        const pastResult = results[g];
        for (let i = 0; i < wordLength; i++) {
          if (pastResult[i] === 'correct' && guess[i] !== pastGuess[i]) {
            triggerShake();
            showToast(`'${pastGuess[i]}' must stay in position ${i + 1}`, 'error');
            return;
          }
          if (pastResult[i] === 'present' && !guess.includes(pastGuess[i])) {
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
        ? { player_id: playerId, guess }
        : { session_id: sessionId, guess };
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
      if (res.status === 409) {
        showToast('This board is already finished', 'warning');
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
      currentGuessRef.current = '';
      syncRoomInput('');

      if (roomId) {
        applyRoomState(data);
        return;
      }

      const newResults = [...results, data.states];
      const newGuesses = [...guesses, guess];
      setResults(newResults);
      setGuesses(newGuesses);

      const newStates = { ...letterStates };
      for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
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
      roomPlayers, livekit, activeBoard, sharedBoard, individualBoard, shareRequest,
      guesses, results, currentGuess, gameStatus, letterStates, stats,
      startGame, createRoom, joinRoom, leaveRoom, createSharedGame, createIndividualGame,
      setActiveBoard, requestShareBoard, respondToShareRequest, addLetter, removeLetter,
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
