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
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Keyboard } from '@/components/Keyboard';
import { VoiceControls } from '@/components/VoiceControls';
import { WordGrid } from '@/components/WordGrid';
import { ActiveBoard, useGameState } from '@/store/GameState';

const DIFF_META: Record<string, {
  color: string;
  label: string;
  desc: string;
  guesses: string;
}> = {
  easy: {
    color: '#59c65f',
    label: 'Easy',
    desc: 'Classic Wordle rules',
    guesses: '6 guesses',
  },
  moderate: {
    color: '#d6b849',
    label: 'Moderate',
    desc: 'Reuse confirmed letters',
    guesses: '6 guesses',
  },
  difficult: {
    color: '#ef6461',
    label: 'Difficult',
    desc: 'Confirmed letters plus bans',
    guesses: '6 guesses',
  },
  prodigy: {
    color: '#b268ff',
    label: 'Prodigy',
    desc: 'Hard rules, only 4 chances',
    guesses: '4 guesses',
  },
};

const ToastBanner: React.FC<{ message: string; type: 'error' | 'warning' | 'info' }> = ({
  message,
  type,
}) => {
  const bg =
    type === 'error' ? '#ef6461' :
    type === 'warning' ? '#d6b849' : '#2f8d46';

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
    createSharedGame,
    createIndividualGame,
    setActiveBoard,
    requestShareBoard,
    respondToShareRequest,
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
    playerId,
    playerName,
    roomPlayers,
    livekit,
    activeBoard,
    shareRequest,
    stats,
    invalidShake,
    lastSubmittedRow,
    answer,
    maxGuesses,
    toast,
  } = useGameState();

  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [diffModal, setDiffModal] = useState(false);
  const [statsModal, setStatsModal] = useState(false);
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
  const shareFromMe = shareRequest?.from_player_id === playerId;
  const hasShareForMe = !!shareRequest && !shareFromMe;

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#59c65f" />
        <Text style={styles.loadingText}>Connecting...</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 8 }]}
          onPress={() => startGame('easy')}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const copyRoom = async () => {
    if (!roomId || Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(roomId);
  };

  const chooseDifficulty = (d: string) => {
    startGame(d);
    setDiffModal(false);
  };

  const switchBoard = (board: ActiveBoard) => {
    if (activeBoard !== board) setActiveBoard(board);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.shell, wide && styles.shellWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroPanel, wide && styles.heroPanelWide]}>
          <Text style={styles.brand}>WORDLE</Text>
          <Text style={styles.brandAccent}>UNLIMITED</Text>
          <Text style={styles.heroCopy}>Play solo, together, or side by side while voice stays connected.</Text>

          <View style={styles.modeStack}>
            <TouchableOpacity
              style={[styles.modeButton, styles.modeTogether]}
              onPress={() => roomId ? createSharedGame() : createRoom(difficulty, roomName)}
              activeOpacity={0.78}
            >
              <Text style={styles.modeTitle}>Play Together</Text>
              <Text style={styles.modeSub}>One shared board for everyone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, styles.modeSolo]}
              onPress={() => roomId ? createIndividualGame() : startGame(difficulty)}
              activeOpacity={0.78}
            >
              <Text style={styles.modeTitle}>Play Individually</Text>
              <Text style={styles.modeSub}>Different boards, same room chat</Text>
            </TouchableOpacity>
          </View>

          {!roomId && (
            <View style={styles.quickJoinBox}>
              <Text style={styles.quickJoinTitle}>Join Party</Text>
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={value => setJoinCode(value.toUpperCase())}
                  placeholder="Room code"
                  placeholderTextColor="#667085"
                  style={[styles.darkInput, styles.joinInput]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <TouchableOpacity style={styles.joinBtn} onPress={() => joinRoom(joinCode, roomName)}>
                  <Text style={styles.primaryBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setDiffModal(true)}
            style={[styles.diffBadge, { borderColor: activeMeta.color }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.diffBadgeLabel, { color: activeMeta.color }]}>
              {activeMeta.label} - {activeMeta.guesses}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStatsModal(true)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Stats</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainStage}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.stageTitle}>WORLD UNLIMITED</Text>
              <Text style={styles.stageMeta}>
                {roomId
                  ? `${activeBoard === 'shared' ? 'Shared board' : 'Individual board'} in room ${roomId}`
                  : 'Solo mode'}
              </Text>
            </View>
            {roomId && <VoiceControls livekit={livekit} compact />}
          </View>

          {toast ? (
            <View style={styles.toastSlot} pointerEvents="none">
              <ToastBanner message={toast.message} type={toast.type} />
            </View>
          ) : <View style={styles.toastSlot} />}

          {roomId && (
            <View style={styles.boardTabs}>
              <TouchableOpacity
                style={[styles.boardTab, activeBoard === 'shared' && styles.boardTabActive]}
                onPress={() => switchBoard('shared')}
              >
                <Text style={[styles.boardTabText, activeBoard === 'shared' && styles.boardTabTextActive]}>
                  Shared
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.boardTab, activeBoard === 'individual' && styles.boardTabActive]}
                onPress={() => switchBoard('individual')}
              >
                <Text style={[styles.boardTabText, activeBoard === 'individual' && styles.boardTabTextActive]}>
                  Individual
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {hasShareForMe && (
            <View style={styles.sharePrompt}>
              <Text style={styles.sharePromptText}>{shareRequest?.from_player_name} wants to share a board.</Text>
              <View style={styles.promptActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToShareRequest(true)}>
                  <Text style={styles.promptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => respondToShareRequest(false)}>
                  <Text style={styles.promptBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {shareFromMe && (
            <View style={styles.sharePrompt}>
              <Text style={styles.sharePromptText}>Share request sent. Waiting for a friend to accept.</Text>
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

          {roomId && activeBoard === 'individual' && gameStatus === 'playing' && (
            <TouchableOpacity style={styles.shareBoardBtn} onPress={requestShareBoard}>
              <Text style={styles.primaryBtnText}>Share My Board</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.partyPanel, wide && styles.partyPanelWide]}>
          <Text style={styles.panelTitle}>{roomId ? `Room ${roomId}` : 'Create Party'}</Text>
          <Text style={styles.panelSub}>
            {roomId ? `${roomPlayers.length} connected` : 'Invite friends and keep voice open'}
          </Text>

          <TextInput
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Your name"
            placeholderTextColor="#667085"
            style={styles.darkInput}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {roomId ? (
            <>
              <View style={styles.roomCodeRow}>
                <Text style={styles.roomCode}>{roomId}</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={copyRoom}>
                  <Text style={styles.smallBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.playerList}>
                {roomPlayers.map(player => (
                  <View key={player.player_id} style={styles.playerRow}>
                    <View style={styles.avatarDot} />
                    <Text style={styles.playerName}>
                      {player.player_name}{player.player_id === playerId ? ' (You)' : ''}
                    </Text>
                    <View style={styles.onlineDot} />
                  </View>
                ))}
              </View>

              <VoiceControls livekit={livekit} />

              <TouchableOpacity style={styles.secondaryBtn} onPress={createSharedGame}>
                <Text style={styles.secondaryBtnText}>Start Shared Board</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={createIndividualGame}>
                <Text style={styles.secondaryBtnText}>Play Individually</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
                <Text style={styles.leaveBtnText}>Leave Room</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => createRoom(difficulty, roomName)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Create Party</Text>
              </TouchableOpacity>
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={value => setJoinCode(value.toUpperCase())}
                  placeholder="Room code"
                  placeholderTextColor="#667085"
                  style={[styles.darkInput, styles.joinInput]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <TouchableOpacity style={styles.joinBtn} onPress={() => joinRoom(joinCode, roomName)}>
                  <Text style={styles.primaryBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

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
                onPress={() => chooseDifficulty(d)}
                style={[styles.diffOption, active && { borderColor: m.color, backgroundColor: '#16231b' }]}
                activeOpacity={0.75}
              >
                <View style={styles.diffOptionText}>
                  <View style={styles.diffOptionRow}>
                    <Text style={[styles.diffOptionLabel, active && { color: m.color }]}>{m.label}</Text>
                    <Text style={[styles.diffOptionGuesses, active && { color: m.color }]}>{m.guesses}</Text>
                  </View>
                  <Text style={styles.diffOptionDesc}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>

      <Modal visible={statsModal} transparent animationType="slide" onRequestClose={() => setStatsModal(false)}>
        <View style={styles.statsModalContainer}>
          <View style={styles.statsSheet}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {gameStatus !== 'playing' && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={[styles.resultTitle, gameStatus === 'won' ? styles.wonColor : styles.lostColor]}>
              {gameStatus === 'won' ? 'You Won!' : 'Game Over'}
            </Text>
            {gameStatus === 'lost' && answer && (
              <View style={styles.answerBadge}>
                <Text style={styles.answerLabel}>The word was</Text>
                <Text style={styles.answerWord}>{answer}</Text>
              </View>
            )}
            {roomId ? (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={createSharedGame}>
                  <Text style={styles.primaryBtnText}>Continue Together</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={createIndividualGame}>
                  <Text style={styles.secondaryBtnText}>Play Individually</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => startGame(difficulty)}>
                <Text style={styles.primaryBtnText}>Play Again</Text>
              </TouchableOpacity>
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
              isLast ? { backgroundColor: '#59c65f' } : { backgroundColor: '#667085' },
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
    backgroundColor: '#061017',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#061017',
    gap: 10,
  },
  loadingText: { fontSize: 14, color: '#9aa4b2' },
  shell: {
    padding: 14,
    gap: 12,
  },
  shellWide: {
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroPanel: {
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 8,
    backgroundColor: '#091720',
    padding: 18,
    gap: 14,
  },
  heroPanelWide: {
    width: 250,
  },
  brand: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandAccent: {
    color: '#59c65f',
    fontSize: 24,
    fontWeight: '900',
    marginTop: -12,
  },
  heroCopy: {
    color: '#d5dde7',
    fontSize: 14,
    lineHeight: 20,
  },
  modeStack: {
    gap: 10,
  },
  modeButton: {
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  modeTogether: {
    backgroundColor: '#281946',
    borderColor: '#7c3aed',
  },
  modeSolo: {
    backgroundColor: '#08243a',
    borderColor: '#2380c9',
  },
  modeTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  modeSub: {
    color: '#cdd6e1',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 16,
  },
  quickJoinBox: {
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 8,
    backgroundColor: '#061017',
    padding: 12,
    gap: 8,
  },
  quickJoinTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  diffBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#0d1720',
  },
  diffBadgeLabel: { fontSize: 12, fontWeight: '900' },
  mainStage: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 8,
    backgroundColor: '#07131b',
    padding: 14,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  stageTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  stageMeta: {
    color: '#9aa4b2',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  toastSlot: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  boardTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 8,
  },
  boardTab: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#0d1720',
  },
  boardTabActive: {
    backgroundColor: '#2f8d46',
  },
  boardTabText: {
    color: '#9aa4b2',
    fontWeight: '900',
    fontSize: 12,
  },
  boardTabTextActive: {
    color: '#fff',
  },
  sharePrompt: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderColor: '#d6b849',
    backgroundColor: '#211b0b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  sharePromptText: {
    color: '#f7e6a1',
    fontSize: 13,
    fontWeight: '800',
  },
  promptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#2f8d46',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  declineBtn: {
    backgroundColor: '#4a5565',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  promptBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  gridArea: {
    flex: 1,
    minHeight: 310,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  shareBoardBtn: {
    marginTop: 12,
    backgroundColor: '#2380c9',
    borderRadius: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  partyPanel: {
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 8,
    backgroundColor: '#091720',
    padding: 16,
    gap: 12,
  },
  partyPanelWide: {
    width: 280,
  },
  panelTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  panelSub: {
    color: '#9aa4b2',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -8,
  },
  darkInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#f8fafc',
    backgroundColor: '#061017',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    backgroundColor: '#2f8d46',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    backgroundColor: '#0d1720',
    borderWidth: 1,
    borderColor: '#243241',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: '#d5dde7',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  roomCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomCode: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  smallBtn: {
    backgroundColor: '#111820',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '900',
  },
  playerList: {
    gap: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  avatarDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2380c9',
  },
  playerName: {
    flex: 1,
    color: '#d5dde7',
    fontSize: 13,
    fontWeight: '800',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#59c65f',
  },
  leaveBtn: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ef6461',
    backgroundColor: '#170e10',
  },
  leaveBtnText: {
    color: '#ef6461',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinInput: {
    flex: 1,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  joinBtn: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    backgroundColor: '#2380c9',
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomSheet: {
    backgroundColor: '#091720',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#243241',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  diffOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243241',
    marginBottom: 10,
    backgroundColor: '#061017',
  },
  diffOptionText: { flex: 1 },
  diffOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  diffOptionLabel: { fontSize: 15, fontWeight: '900', color: '#f8fafc' },
  diffOptionGuesses: { fontSize: 11, fontWeight: '700', color: '#9aa4b2' },
  diffOptionDesc: { fontSize: 12, color: '#9aa4b2', lineHeight: 17 },
  statsModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  statsSheet: {
    backgroundColor: '#091720',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#243241',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111820',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: { fontSize: 13, fontWeight: '900', color: '#d5dde7' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
    width: '100%',
  },
  statBox: { alignItems: 'center', minWidth: 60 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  statLabel: {
    fontSize: 10,
    color: '#9aa4b2',
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  avgLine: { fontSize: 12, color: '#9aa4b2', marginBottom: 16, textAlign: 'center' },
  distTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#f8fafc',
    marginBottom: 8,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  distNum: { width: 18, textAlign: 'right', fontWeight: '800', fontSize: 13, color: '#f8fafc' },
  distBar: {
    paddingRight: 8,
    paddingLeft: 6,
    height: 22,
    borderRadius: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 24,
  },
  distCount: { color: '#fff', fontWeight: '800', fontSize: 12 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,16,23,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    padding: 18,
  },
  overlayCard: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#243241',
    borderRadius: 8,
    backgroundColor: '#091720',
    gap: 12,
  },
  resultTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  wonColor: { color: '#59c65f' },
  lostColor: { color: '#ef6461' },
  answerBadge: {
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#211b0b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#d6b849',
  },
  answerLabel: {
    fontSize: 11,
    color: '#f7e6a1',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  answerWord: { fontSize: 28, fontWeight: '900', letterSpacing: 7, color: '#f8fafc' },
});
