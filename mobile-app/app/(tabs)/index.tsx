import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Keyboard } from '@/components/Keyboard';
import { VoiceControls } from '@/components/VoiceControls';
import { WordGrid } from '@/components/WordGrid';
import { ActiveBoard, useGameState } from '@/store/GameState';

const DIFF_META: Record<string, { color: string; label: string; desc: string; guesses: string }> = {
  easy: { color: '#4caf50', label: 'Easy', desc: 'Classic Wordle rules', guesses: '6 guesses' },
  moderate: { color: '#f59e0b', label: 'Moderate', desc: 'Reuse confirmed letters', guesses: '6 guesses' },
  difficult: { color: '#ef4444', label: 'Difficult', desc: 'Confirmed letters plus bans', guesses: '6 guesses' },
  prodigy: { color: '#8b5cf6', label: 'Prodigy', desc: 'Hard rules, only 4 chances', guesses: '4 guesses' },
};

type AppView = 'home' | 'solo' | 'party';

const ToastBanner: React.FC<{ message: string; type: 'error' | 'warning' | 'info' }> = ({ message, type }) => {
  const bg = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#4caf50';
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={[styles.toast, { backgroundColor: bg }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function GameScreen() {
  const {
    startGame, createRoom, joinRoom, leaveRoom, createSharedGame, createIndividualGame,
    setActiveBoard, requestShareBoard, respondToShareRequest, gameStatus, currentGuess,
    addLetter, removeLetter, submitGuess, guesses, results, wordLength, letterStates,
    sessionId, difficulty, roomId, playerId, playerName, roomPlayers, livekit, activeBoard,
    shareRequest, stats, invalidShake, lastSubmittedRow, answer, maxGuesses, toast,
  } = useGameState();

  const [view, setView] = useState<AppView>('home');
  const [diffModal, setDiffModal] = useState(false);
  const [statsModal, setStatsModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [roomName, setRoomName] = useState(playerName);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!sessionId && gameStatus === 'playing') startGame(difficulty);
  }, []);

  useEffect(() => {
    setRoomName(playerName);
  }, [playerName]);

  useEffect(() => {
    if (roomId) setView('party');
  }, [roomId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (view === 'home' || gameStatus !== 'playing') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
      if (event.key === 'Backspace') {
        event.preventDefault();
        removeLetter();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submitGuess();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        addLetter(event.key.toUpperCase());
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [view, gameStatus, addLetter, removeLetter, submitGuess]);

  const winPct = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const avgGuesses = stats.wins > 0
    ? (stats.guessDistribution.reduce((s, c, i) => s + c * (i + 1), 0) / stats.wins).toFixed(1)
    : '-';
  const maxDist = Math.max(...stats.guessDistribution, 1);
  const activeMeta = DIFF_META[difficulty] ?? DIFF_META.easy;
  const shareFromMe = shareRequest?.from_player_id === playerId;
  const hasShareForMe = !!shareRequest && !shareFromMe;

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.mutedText}>Connecting...</Text>
      </View>
    );
  }

  const copyRoom = async () => {
    if (!roomId || Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(roomId);
  };

  const openSolo = async () => {
    if (roomId) leaveRoom();
    await startGame(difficulty);
    setView('solo');
  };

  const openParty = async () => {
    setView('party');
  };

  const createParty = async () => {
    await createRoom(difficulty, roomName);
    setView('party');
  };

  const joinParty = async () => {
    await joinRoom(joinCode, roomName);
    setView('party');
  };

  const switchBoard = (board: ActiveBoard) => {
    if (activeBoard !== board) setActiveBoard(board);
  };

  const renderHeader = (subtitle: string, showVoice = false) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => setView('home')}>
        <Text style={styles.iconText}>‹</Text>
      </TouchableOpacity>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle}>WORDLE UNLIMITED</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerActions}>
        {roomId && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setRoomModal(true)}>
            <Text style={styles.iconText}>i</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={() => setHelpModal(true)}>
          <Text style={styles.iconText}>?</Text>
        </TouchableOpacity>
      </View>
      {showVoice && roomId && <View style={styles.voiceDock}><VoiceControls livekit={livekit} compact /></View>}
    </View>
  );

  const renderBoard = () => (
    <View style={styles.boardShell}>
      <View style={styles.toastSlot}>{toast ? <ToastBanner message={toast.message} type={toast.type} /> : null}</View>
      {roomId && (
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentBtn, activeBoard === 'shared' && styles.segmentActive]} onPress={() => switchBoard('shared')}>
            <Text style={[styles.segmentText, activeBoard === 'shared' && styles.segmentTextActive]}>Shared</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, activeBoard === 'individual' && styles.segmentActive]} onPress={() => switchBoard('individual')}>
            <Text style={[styles.segmentText, activeBoard === 'individual' && styles.segmentTextActive]}>Solo Board</Text>
          </TouchableOpacity>
        </View>
      )}
      {hasShareForMe && (
        <View style={styles.prompt}>
          <Text style={styles.promptText}>{shareRequest?.from_player_name} wants to share a board.</Text>
          <View style={styles.promptRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToShareRequest(true)}><Text style={styles.btnText}>Accept</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => respondToShareRequest(false)}><Text style={styles.ghostText}>Decline</Text></TouchableOpacity>
          </View>
        </View>
      )}
      {shareFromMe && <View style={styles.prompt}><Text style={styles.promptText}>Waiting for a friend to accept your board.</Text></View>}
      <View style={styles.gridWrap}>
        <WordGrid
          guesses={guesses}
          results={results}
          currentGuess={currentGuess}
          wordLength={wordLength}
          invalidShake={invalidShake}
          lastSubmittedRow={lastSubmittedRow}
          maxGuesses={maxGuesses}
        />
      </View>
      <Keyboard onKeyPress={addLetter} onEnter={submitGuess} onDelete={removeLetter} letterStates={letterStates} />
      {roomId && activeBoard === 'individual' && gameStatus === 'playing' && (
        <TouchableOpacity style={styles.inlineAction} onPress={requestShareBoard}><Text style={styles.inlineActionText}>Share My Board</Text></TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {view === 'home' && (
        <View style={styles.home}>
          <View style={styles.homeTop}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>W</Text></View>
            <Text style={styles.brand}>WORDLE</Text>
            <Text style={styles.brandAccent}>UNLIMITED</Text>
            <Text style={styles.homeSubtitle}>Choose how you want to play.</Text>
          </View>
          <View style={styles.homeActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openSolo}>
              <Text style={styles.primaryText}>Play Solo</Text>
              <Text style={styles.actionHint}>No voice chat. Just Wordle.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={openParty}>
              <Text style={styles.primaryText}>Party Mode</Text>
              <Text style={styles.actionHint}>Voice room, shared or individual boards.</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.homeFooter}>
            <TouchableOpacity style={styles.footerIcon} onPress={() => setHelpModal(true)}><Text style={styles.footerIconText}>?</Text></TouchableOpacity>
            <TouchableOpacity style={styles.footerIcon} onPress={() => setStatsModal(true)}><Text style={styles.footerIconText}>≡</Text></TouchableOpacity>
            <TouchableOpacity style={styles.footerIcon} onPress={() => setDiffModal(true)}><Text style={styles.footerIconText}>⚙</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {view === 'solo' && (
        <View style={styles.gameScreen}>
          {renderHeader(`${activeMeta.label} solo`, false)}
          {renderBoard()}
        </View>
      )}

      {view === 'party' && (
        <View style={styles.gameScreen}>
          {renderHeader(roomId ? `Room ${roomId} · ${roomPlayers.length} online` : 'Party mode', !!roomId)}
          {!roomId ? (
            <View style={styles.partySetup}>
              <Text style={styles.sectionTitle}>Start a Party</Text>
              <TextInput value={roomName} onChangeText={setRoomName} placeholder="Your name" placeholderTextColor="#6b7280" style={styles.input} />
              <TouchableOpacity style={styles.primaryBtn} onPress={createParty}><Text style={styles.primaryText}>Create Party</Text></TouchableOpacity>
              <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>or join</Text><View style={styles.line} /></View>
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={value => setJoinCode(value.toUpperCase())}
                  placeholder="Room code"
                  placeholderTextColor="#6b7280"
                  style={[styles.input, styles.joinInput]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <TouchableOpacity style={styles.joinBtn} onPress={joinParty}><Text style={styles.primaryText}>Join</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.partyTopBar}>
                <TouchableOpacity style={styles.chipBtn} onPress={createSharedGame}><Text style={styles.chipText}>Together</Text></TouchableOpacity>
                <TouchableOpacity style={styles.chipBtn} onPress={createIndividualGame}><Text style={styles.chipText}>Individual</Text></TouchableOpacity>
                <TouchableOpacity style={styles.chipBtn} onPress={() => setRoomModal(true)}><Text style={styles.chipText}>Room</Text></TouchableOpacity>
              </View>
              {renderBoard()}
            </>
          )}
        </View>
      )}

      <Modal visible={diffModal} transparent animationType="slide" onRequestClose={() => setDiffModal(false)}>
        <TouchableWithoutFeedback onPress={() => setDiffModal(false)}><View style={styles.modalBackdrop} /></TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Difficulty</Text>
          {Object.entries(DIFF_META).map(([d, m]) => (
            <TouchableOpacity
              key={d}
              style={[styles.sheetRow, difficulty === d && { borderColor: m.color }]}
              onPress={() => {
                startGame(d);
                setDiffModal(false);
              }}
            >
              <Text style={[styles.sheetRowTitle, difficulty === d && { color: m.color }]}>{m.label}</Text>
              <Text style={styles.sheetRowMeta}>{m.desc} · {m.guesses}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Modal visible={roomModal} transparent animationType="slide" onRequestClose={() => setRoomModal(false)}>
        <TouchableWithoutFeedback onPress={() => setRoomModal(false)}><View style={styles.modalBackdrop} /></TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Room {roomId}</Text>
          <TouchableOpacity style={styles.copyRow} onPress={copyRoom}><Text style={styles.copyCode}>{roomId}</Text><Text style={styles.copyLabel}>Copy</Text></TouchableOpacity>
          <View style={styles.playerList}>
            {roomPlayers.map(player => (
              <View key={player.player_id} style={styles.playerRow}>
                <View style={styles.avatarDot} />
                <Text style={styles.playerName}>{player.player_name}{player.player_id === playerId ? ' (You)' : ''}</Text>
                <View style={styles.onlineDot} />
              </View>
            ))}
          </View>
          <VoiceControls livekit={livekit} />
          <TouchableOpacity style={styles.dangerBtn} onPress={() => { leaveRoom(); setRoomModal(false); setView('home'); }}><Text style={styles.dangerText}>Leave Room</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={helpModal} transparent animationType="fade" onRequestClose={() => setHelpModal(false)}>
        <View style={styles.centerModal}>
          <View style={styles.helpCard}>
            <Text style={styles.sheetTitle}>How to Play</Text>
            <Text style={styles.helpText}>Guess the word in six tries. Green means correct spot, yellow means wrong spot, gray means not in the word.</Text>
            <Text style={styles.helpText}>Solo is a clean Wordle game. Party keeps voice on and lets friends play together or side by side.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setHelpModal(false)}><Text style={styles.primaryText}>Got it</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={statsModal} transparent animationType="slide" onRequestClose={() => setStatsModal(false)}>
        <View style={styles.centerModal}>
          <View style={styles.helpCard}>
            <Text style={styles.sheetTitle}>Statistics</Text>
            <StatsSummary stats={stats} winPct={winPct} avgGuesses={avgGuesses} maxDist={maxDist} gameStatus={gameStatus} guesses={guesses} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStatsModal(false)}><Text style={styles.primaryText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {gameStatus !== 'playing' && view !== 'home' && (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={[styles.resultTitle, gameStatus === 'won' ? styles.win : styles.loss]}>{gameStatus === 'won' ? 'Great Job' : 'Game Over'}</Text>
            {gameStatus === 'lost' && answer && <Text style={styles.answerText}>The word was {answer}</Text>}
            {roomId ? (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={createSharedGame}><Text style={styles.primaryText}>Continue Together</Text></TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={createIndividualGame}><Text style={styles.ghostText}>Play Individually</Text></TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => startGame(difficulty)}><Text style={styles.primaryText}>New Game</Text></TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const StatsSummary: React.FC<{
  stats: any;
  winPct: number;
  avgGuesses: string;
  maxDist: number;
  gameStatus: 'playing' | 'won' | 'lost';
  guesses: string[];
}> = ({ stats, winPct, avgGuesses, maxDist, gameStatus, guesses }) => (
  <>
    <View style={styles.statsRow}>
      {[{ v: stats.gamesPlayed, l: 'Played' }, { v: `${winPct}%`, l: 'Win Rate' }, { v: stats.currentStreak, l: 'Streak' }, { v: stats.maxStreak, l: 'Best' }].map(({ v, l }) => (
        <View key={l} style={styles.statBox}><Text style={styles.statValue}>{v}</Text><Text style={styles.statLabel}>{l}</Text></View>
      ))}
    </View>
    <Text style={styles.avgLine}>Avg guesses per win: <Text style={{ fontWeight: '800' }}>{avgGuesses}</Text></Text>
    {stats.guessDistribution.map((count: number, idx: number) => {
      const pct = Math.max((count / maxDist) * 100, 5);
      const isLast = gameStatus === 'won' && idx === guesses.length - 1;
      return (
        <View key={idx} style={styles.distRow}>
          <Text style={styles.distNum}>{idx + 1}</Text>
          <View style={[styles.distBar, { width: `${pct}%` }, isLast ? { backgroundColor: '#4caf50' } : null]}><Text style={styles.distCount}>{count}</Text></View>
        </View>
      );
    })}
  </>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f14' },
  mutedText: { color: '#a7b0be', fontSize: 14 },
  home: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 20, justifyContent: 'space-between' },
  homeTop: { alignItems: 'center', paddingTop: 42 },
  logoMark: { width: 58, height: 58, borderRadius: 14, backgroundColor: '#4caf50', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoMarkText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  brand: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 0 },
  brandAccent: { color: '#4caf50', fontSize: 25, fontWeight: '900', marginTop: -8 },
  homeSubtitle: { color: '#a7b0be', fontSize: 16, marginTop: 14, textAlign: 'center' },
  homeActions: { gap: 12 },
  primaryBtn: { minHeight: 56, borderRadius: 14, backgroundColor: '#4caf50', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryBtn: { minHeight: 56, borderRadius: 14, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  actionHint: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  homeFooter: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingBottom: 8 },
  footerIcon: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#2a3544', backgroundColor: '#141a22', alignItems: 'center', justifyContent: 'center' },
  footerIconText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  gameScreen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  header: { minHeight: 82, justifyContent: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: '#2a3544', backgroundColor: '#141a22', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerTitleBlock: { position: 'absolute', left: 48, right: 88, top: 15 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1.4 },
  headerSubtitle: { color: '#a7b0be', fontSize: 12, fontWeight: '700', marginTop: 3 },
  headerActions: { position: 'absolute', right: 0, top: 12, flexDirection: 'row', gap: 8 },
  voiceDock: { marginTop: 10, paddingLeft: 48 },
  boardShell: { flex: 1, alignItems: 'center', justifyContent: 'space-between', minHeight: 0 },
  toastSlot: { height: 32, justifyContent: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 12 },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: '#2a3544', backgroundColor: '#141a22', borderRadius: 14, padding: 3, marginBottom: 4 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 22, borderRadius: 11 },
  segmentActive: { backgroundColor: '#4caf50' },
  segmentText: { color: '#a7b0be', fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: '#fff' },
  gridWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  prompt: { width: '100%', borderRadius: 14, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#261b05', padding: 10, marginBottom: 6 },
  promptText: { color: '#ffd88a', fontWeight: '800', fontSize: 13 },
  promptRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: { backgroundColor: '#4caf50', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  ghostBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#2a3544', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  ghostText: { color: '#fff', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' },
  inlineAction: { marginTop: 8, minHeight: 42, borderRadius: 13, backgroundColor: '#1b2430', borderWidth: 1, borderColor: '#2a3544', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  inlineActionText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  partySetup: { flex: 1, justifyContent: 'center', gap: 14 },
  sectionTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#2a3544', backgroundColor: '#141a22', color: '#fff', paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  joinRow: { flexDirection: 'row', gap: 10 },
  joinInput: { flex: 1, letterSpacing: 2, textTransform: 'uppercase' },
  joinBtn: { minHeight: 54, borderRadius: 14, backgroundColor: '#8b5cf6', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: '#2a3544' },
  dividerText: { color: '#6b7280', fontWeight: '900', textTransform: 'uppercase', fontSize: 11 },
  partyTopBar: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chipBtn: { flex: 1, minHeight: 38, borderRadius: 13, backgroundColor: '#141a22', borderWidth: 1, borderColor: '#2a3544', alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#141a22', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2a3544', gap: 12 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  sheetRow: { borderWidth: 1, borderColor: '#2a3544', borderRadius: 16, padding: 14, backgroundColor: '#1b2430' },
  sheetRowTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  sheetRowMeta: { color: '#a7b0be', fontSize: 13, marginTop: 4 },
  copyRow: { borderRadius: 16, backgroundColor: '#1b2430', borderWidth: 1, borderColor: '#2a3544', padding: 14, flexDirection: 'row', alignItems: 'center' },
  copyCode: { flex: 1, color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  copyLabel: { color: '#4caf50', fontSize: 13, fontWeight: '900' },
  playerList: { gap: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 },
  avatarDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#8b5cf6' },
  playerName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800' },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4caf50' },
  dangerBtn: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: '#ef4444', fontWeight: '900', textTransform: 'uppercase' },
  centerModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.66)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  helpCard: { width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: '#141a22', borderWidth: 1, borderColor: '#2a3544', padding: 20, gap: 14 },
  helpText: { color: '#a7b0be', fontSize: 15, lineHeight: 22 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,20,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultCard: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: '#141a22', borderWidth: 1, borderColor: '#2a3544', padding: 20, gap: 12, alignItems: 'stretch' },
  resultTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  win: { color: '#4caf50' },
  loss: { color: '#ef4444' },
  answerText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#a7b0be', fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  avgLine: { color: '#a7b0be', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  distNum: { width: 18, color: '#fff', fontWeight: '900', textAlign: 'right' },
  distBar: { height: 22, minWidth: 24, borderRadius: 5, backgroundColor: '#3b4652', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 7 },
  distCount: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
