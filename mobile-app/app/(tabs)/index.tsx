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
import { useGameState } from '@/store/GameState';

const DIFF_META: Record<string, {
  color: string;
  label: string;
  desc: string;
  guesses: string;
}> = {
  easy: {
    color: '#6aaa64',
    label: 'Easy',
    desc: 'No restrictions - classic Wordle',
    guesses: '6 guesses',
  },
  moderate: {
    color: '#c9b458',
    label: 'Moderate',
    desc: 'Must reuse confirmed letters in every guess',
    guesses: '6 guesses',
  },
  difficult: {
    color: '#e55c5c',
    label: 'Difficult',
    desc: 'Moderate rules plus eliminated letters are banned',
    guesses: '6 guesses',
  },
  prodigy: {
    color: '#9b59b6',
    label: 'Prodigy',
    desc: 'Difficult rules plus only 4 chances',
    guesses: '4 guesses',
  },
};

const ToastBanner: React.FC<{ message: string; type: 'error' | 'warning' | 'info' }> = ({
  message,
  type,
}) => {
  const bg =
    type === 'error' ? '#1a1a1b' :
    type === 'warning' ? '#8b6914' : '#538d4e';

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(300)}
      style={[styles.toast, { backgroundColor: bg }]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function GameScreen() {
  const {
    startGame,
    createRoom,
    joinRoom,
    leaveRoom,
    gameStatus,
    currentGuess,
    addLetter,
    removeLetter,
    submitGuess,
    guesses,
    results,
    wordLength,
    letterStates,
    sessionId,
    difficulty,
    roomId,
    playerName,
    roomPlayers,
    livekit,
    stats,
    invalidShake,
    lastSubmittedRow,
    answer,
    maxGuesses,
    toast,
  } = useGameState();

  const [diffModal, setDiffModal] = useState(false);
  const [statsModal, setStatsModal] = useState(false);
  const [partyModal, setPartyModal] = useState(false);
  const [roomName, setRoomName] = useState(playerName);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!sessionId && gameStatus === 'playing') startGame(difficulty);
  }, []);

  useEffect(() => {
    setRoomName(playerName);
  }, [playerName]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;
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
  }, [gameStatus, addLetter, removeLetter, submitGuess]);

  const winPct = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;
  const avgGuesses = stats.wins > 0
    ? (stats.guessDistribution.reduce((s, c, i) => s + c * (i + 1), 0) / stats.wins).toFixed(1)
    : '-';
  const maxDist = Math.max(...stats.guessDistribution, 1);
  const activeMeta = DIFF_META[difficulty] ?? DIFF_META.easy;

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6aaa64" />
        <Text style={styles.loadingText}>Connecting...</Text>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: '#6aaa64', marginTop: 8 }]}
          onPress={() => startGame('easy')}
        >
          <Text style={styles.pillTextWhite}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startDifficulty = (d: string) => {
    startGame(d);
    setDiffModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setDiffModal(true)}
          style={[styles.diffBadge, { borderColor: activeMeta.color }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.diffBadgeLabel, { color: activeMeta.color }]}>
            {activeMeta.label}
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>WORLD UNLIMITED</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setPartyModal(true)}
            style={[styles.headerBtn, roomId && styles.headerBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerBtnText, roomId && styles.headerBtnTextActive]}>Party</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatsModal(true)}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>Stats</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerLine} />

      <View style={styles.toastSlot} pointerEvents="none">
        {toast ? <ToastBanner message={toast.message} type={toast.type} /> : null}
      </View>

      {roomId && (
        <View style={styles.roomBar}>
          <View style={styles.roomBarText}>
            <Text style={styles.roomLabel}>Room {roomId}</Text>
            <Text style={styles.roomMeta}>
              {roomPlayers.length} player{roomPlayers.length === 1 ? '' : 's'} connected
            </Text>
          </View>
          <VoiceControls livekit={livekit} />
        </View>
      )}

      <View style={styles.gridArea}>
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

      <Keyboard
        onKeyPress={addLetter}
        onEnter={submitGuess}
        onDelete={removeLetter}
        letterStates={letterStates}
      />

      <Modal visible={partyModal} transparent animationType="slide" onRequestClose={() => setPartyModal(false)}>
        <TouchableWithoutFeedback onPress={() => setPartyModal(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Party Room</Text>

          <TextInput
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Your name"
            style={styles.roomInput}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {roomId ? (
            <View style={styles.roomPanel}>
              <Text style={styles.roomCode}>{roomId}</Text>
              <Text style={styles.roomHelp}>Share this code with friends so they can join.</Text>
              <View style={styles.playerList}>
                {roomPlayers.map(player => (
                  <Text key={player.player_id} style={styles.playerChip}>
                    {player.player_name}
                  </Text>
                ))}
              </View>
              <VoiceControls livekit={livekit} />
              <TouchableOpacity
                style={[styles.roomActionBtn, styles.leaveRoomBtn]}
                onPress={() => {
                  leaveRoom();
                  setPartyModal(false);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.roomActionText}>Leave Room</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.roomActionBtn}
                onPress={() => {
                  createRoom(difficulty, roomName);
                  setPartyModal(false);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.roomActionText}>Create Room</Text>
              </TouchableOpacity>

              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={value => setJoinCode(value.toUpperCase())}
                  placeholder="Room code"
                  style={[styles.roomInput, styles.joinInput]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.roomActionBtn, styles.joinBtn]}
                  onPress={() => {
                    joinRoom(joinCode, roomName);
                    setPartyModal(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.roomActionText}>Join</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{ height: 20 }} />
        </View>
      </Modal>

      <Modal visible={diffModal} transparent animationType="slide" onRequestClose={() => setDiffModal(false)}>
        <TouchableWithoutFeedback onPress={() => setDiffModal(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Choose Difficulty</Text>

          {Object.entries(DIFF_META).map(([d, m]) => {
            const active = difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => startDifficulty(d)}
                style={[styles.diffOption, active && { borderColor: m.color, backgroundColor: `${m.color}18` }]}
                activeOpacity={0.75}
              >
                <View style={styles.diffOptionText}>
                  <View style={styles.diffOptionRow}>
                    <Text style={[styles.diffOptionLabel, active && { color: m.color }]}>{m.label}</Text>
                    <Text style={[styles.diffOptionGuesses, active && { color: m.color }]}>{m.guesses}</Text>
                  </View>
                  <Text style={styles.diffOptionDesc}>{m.desc}</Text>
                </View>
                {active && <Text style={[styles.diffOptionCheck, { color: m.color }]}>OK</Text>}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </View>
      </Modal>

      <Modal visible={statsModal} transparent animationType="slide" onRequestClose={() => setStatsModal(false)}>
        <View style={styles.statsModalContainer}>
          <View style={styles.statsSheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setStatsModal(false)}>
              <Text style={styles.closeBtnText}>X</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Statistics</Text>
              <StatsSummary
                stats={stats}
                winPct={winPct}
                avgGuesses={avgGuesses}
                maxDist={maxDist}
                gameStatus={gameStatus}
                guesses={guesses}
              />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {gameStatus !== 'playing' && (
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayCard} showsVerticalScrollIndicator={false}>
            <Text style={[styles.resultTitle, gameStatus === 'won' ? styles.wonColor : styles.lostColor]}>
              {gameStatus === 'won' ? 'You Won!' : 'Game Over'}
            </Text>

            {gameStatus === 'lost' && answer && (
              <View style={styles.answerBadge}>
                <Text style={styles.answerLabel}>The word was</Text>
                <Text style={styles.answerWord}>{answer}</Text>
              </View>
            )}

            <StatsSummary
              stats={stats}
              winPct={winPct}
              avgGuesses={avgGuesses}
              maxDist={maxDist}
              gameStatus={gameStatus}
              guesses={guesses}
            />

            <TouchableOpacity
              style={[styles.playAgainBtn, { backgroundColor: activeMeta.color }]}
              onPress={() => roomId ? createRoom(difficulty, playerName) : startGame(difficulty)}
              activeOpacity={0.8}
            >
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setDiffModal(true)} style={{ marginTop: 12 }}>
              <Text style={styles.changeDiffText}>Change difficulty</Text>
            </TouchableOpacity>
          </ScrollView>
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
      {[
        { v: stats.gamesPlayed, l: 'Played' },
        { v: `${winPct}%`, l: 'Win Rate' },
        { v: stats.currentStreak, l: 'Streak' },
        { v: stats.maxStreak, l: 'Best' },
      ].map(({ v, l }) => (
        <View key={l} style={styles.statBox}>
          <Text style={styles.statValue}>{v}</Text>
          <Text style={styles.statLabel}>{l}</Text>
        </View>
      ))}
    </View>

    <Text style={styles.avgLine}>
      Avg guesses per win: <Text style={{ fontWeight: '800' }}>{avgGuesses}</Text>
    </Text>

    <Text style={styles.distTitle}>Guess Distribution</Text>
    {stats.guessDistribution.map((count: number, idx: number) => {
      const pct = Math.max((count / maxDist) * 100, 5);
      const isLast = gameStatus === 'won' && idx === guesses.length - 1;
      return (
        <View key={idx} style={styles.distRow}>
          <Text style={styles.distNum}>{idx + 1}</Text>
          <View
            style={[
              styles.distBar,
              { width: `${pct}%` },
              isLast ? { backgroundColor: '#6aaa64' } : { backgroundColor: '#787c7e' },
            ]}
          >
            <Text style={styles.distCount}>{count}</Text>
          </View>
        </View>
      );
    })}
  </>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    gap: 10,
  },
  loadingText: { fontSize: 14, color: '#787c7e' },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 8,
  },
  headerLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#d3d6da',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#1a1a1b',
    textAlign: 'center',
    flex: 1,
  },
  diffBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    minWidth: 84,
  },
  diffBadgeLabel: { fontSize: 12, fontWeight: '800' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 156,
    justifyContent: 'flex-end',
  },
  headerBtn: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d3d6da',
    backgroundColor: '#fff',
  },
  headerBtnActive: {
    borderColor: '#6aaa64',
    backgroundColor: '#eef7ee',
  },
  headerBtnText: {
    color: '#565758',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerBtnTextActive: {
    color: '#538d4e',
  },
  toastSlot: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  roomBar: {
    width: '92%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3d6da',
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  roomBarText: { flex: 1 },
  roomLabel: {
    color: '#1a1a1b',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  roomMeta: {
    color: '#787c7e',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  roomInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#d3d6da',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#1a1a1b',
    backgroundColor: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  roomActionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#6aaa64',
    paddingHorizontal: 16,
  },
  roomActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  joinInput: {
    flex: 1,
    marginBottom: 0,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  joinBtn: { minWidth: 84 },
  roomPanel: { gap: 10 },
  roomCode: {
    color: '#1a1a1b',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
  },
  roomHelp: {
    color: '#787c7e',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  playerChip: {
    color: '#1a1a1b',
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '800',
  },
  leaveRoomBtn: { backgroundColor: '#e55c5c' },
  gridArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d3d6da',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#1a1a1b',
    marginBottom: 16,
    textAlign: 'center',
  },
  diffOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    marginBottom: 10,
    backgroundColor: '#fff',
    gap: 12,
  },
  diffOptionText: { flex: 1 },
  diffOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  diffOptionLabel: { fontSize: 15, fontWeight: '800', color: '#1a1a1b' },
  diffOptionGuesses: { fontSize: 11, fontWeight: '600', color: '#787c7e' },
  diffOptionDesc: { fontSize: 12, color: '#565758', lineHeight: 17 },
  diffOptionCheck: { fontSize: 12, fontWeight: '900' },
  statsModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: { fontSize: 13, fontWeight: '800', color: '#565758' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
    width: '100%',
  },
  statBox: { alignItems: 'center', minWidth: 60 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#1a1a1b' },
  statLabel: {
    fontSize: 10,
    color: '#787c7e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  avgLine: { fontSize: 12, color: '#787c7e', marginBottom: 16, textAlign: 'center' },
  distTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#1a1a1b',
    marginBottom: 8,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  distNum: { width: 18, textAlign: 'right', fontWeight: '700', fontSize: 13, color: '#1a1a1b' },
  distBar: {
    paddingRight: 8,
    paddingLeft: 6,
    height: 22,
    borderRadius: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 24,
  },
  distCount: { color: '#fff', fontWeight: '700', fontSize: 12 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,249,249,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  overlayCard: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    width: '100%',
    maxWidth: 420,
  },
  resultTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 1, marginBottom: 14 },
  wonColor: { color: '#6aaa64' },
  lostColor: { color: '#e55c5c' },
  answerBadge: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#f0c040',
  },
  answerLabel: {
    fontSize: 11,
    color: '#7a6020',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  answerWord: { fontSize: 28, fontWeight: '900', letterSpacing: 7, color: '#1a1a1b' },
  playAgainBtn: {
    marginTop: 22,
    paddingVertical: 13,
    paddingHorizontal: 56,
    borderRadius: 10,
  },
  playAgainText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  changeDiffText: { fontSize: 13, color: '#787c7e', textDecorationLine: 'underline' },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  pillTextWhite: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
