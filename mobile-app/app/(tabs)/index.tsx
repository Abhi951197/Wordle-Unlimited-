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
        contentContainerStyle={[styles.shell, !wide && styles.shellPhone, wide && styles.shellWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroPanel, wide && styles.heroPanelWide]}>
          <View style={styles.phoneStatusBar}>
            <Text style={styles.statusTime}>9:41</Text>
            <Text style={styles.statusIcons}>LTE 100%</Text>
          </View>
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

        <View style={[styles.mainStage, !wide && styles.mainStagePhone]}>
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

      <View style={[styles.bottomNav, wide && styles.bottomNavWide]}>
        {[
          { label: 'Home', active: !roomId },
          { label: 'Party', active: !!roomId },
          { label: 'Stats', active: false, onPress: () => setStatsModal(true) },
          { label: 'Settings', active: false, onPress: () => setDiffModal(true) },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={item.onPress}
            activeOpacity={0.75}
          >
            <Text style={[styles.navIcon, item.active && styles.navActive]}>●</Text>
            <Text style={[styles.navLabel, item.active && styles.navActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
    backgroundColor: '#0b0f14',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0f14',
    gap: 10,
  },
  loadingText: { fontSize: 14, color: '#9aa4b2' },
  shell: {
    padding: 16,
    paddingBottom: 92,
    gap: 16,
    alignItems: 'center',
  },
  shellPhone: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  shellWide: {
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroPanel: {
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 18,
    backgroundColor: '#141a22',
    padding: 20,
    gap: 16,
    width: '100%',
  },
  heroPanelWide: {
    width: 290,
  },
  phoneStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusTime: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  statusIcons: {
    color: '#a7b0be',
    fontSize: 11,
    fontWeight: '800',
  },
  brand: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandAccent: {
    color: '#4caf50',
    fontSize: 24,
    fontWeight: '800',
    marginTop: -10,
  },
  heroCopy: {
    color: '#a7b0be',
    fontSize: 16,
    lineHeight: 22,
  },
  modeStack: {
    gap: 10,
  },
  modeButton: {
    minHeight: 96,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    justifyContent: 'center',
  },
  modeTogether: {
    backgroundColor: '#241b34',
    borderColor: '#8b5cf6',
  },
  modeSolo: {
    backgroundColor: '#132231',
    borderColor: '#2a3544',
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  modeSub: {
    color: '#a7b0be',
    fontSize: 13,
    marginTop: 5,
    lineHeight: 16,
  },
  quickJoinBox: {
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 18,
    backgroundColor: '#1b2430',
    padding: 16,
    gap: 8,
  },
  quickJoinTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  diffBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#1b2430',
  },
  diffBadgeLabel: { fontSize: 12, fontWeight: '900' },
  mainStage: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 18,
    backgroundColor: '#141a22',
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  mainStagePhone: {
    minHeight: 610,
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  stageMeta: {
    color: '#a7b0be',
    fontSize: 13,
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
    borderColor: '#2a3544',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  boardTab: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#1b2430',
  },
  boardTabActive: {
    backgroundColor: '#4caf50',
  },
  boardTabText: {
    color: '#a7b0be',
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
    borderColor: '#f59e0b',
    backgroundColor: '#261b05',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  sharePromptText: {
    color: '#ffd88a',
    fontSize: 13,
    fontWeight: '800',
  },
  promptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#4caf50',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  declineBtn: {
    backgroundColor: '#2a3544',
    borderRadius: 14,
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
    minHeight: 330,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  shareBoardBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  partyPanel: {
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 18,
    backgroundColor: '#141a22',
    padding: 20,
    gap: 12,
    width: '100%',
  },
  partyPanelWide: {
    width: 300,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  panelSub: {
    color: '#a7b0be',
    fontSize: 13,
    fontWeight: '700',
    marginTop: -8,
  },
  darkInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#ffffff',
    backgroundColor: '#0b0f14',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtn: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#141a22',
    borderWidth: 1,
    borderColor: '#2a3544',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  smallBtn: {
    backgroundColor: '#1b2430',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2a3544',
  },
  smallBtnText: {
    color: '#ffffff',
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
    backgroundColor: '#8b5cf6',
  },
  playerName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4caf50',
  },
  leaveBtn: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#1f1113',
  },
  leaveBtnText: {
    color: '#ef4444',
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
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
  },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 64,
    maxWidth: 430,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#141a22',
    borderWidth: 1,
    borderColor: '#2a3544',
    borderRadius: 24,
    paddingHorizontal: 8,
  },
  bottomNavWide: {
    maxWidth: 520,
    left: undefined,
    right: undefined,
    width: 520,
  },
  navItem: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navIcon: {
    color: '#6b7280',
    fontSize: 9,
    lineHeight: 10,
  },
  navLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '800',
  },
  navActive: {
    color: '#4caf50',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomSheet: {
    backgroundColor: '#141a22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#2a3544',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#2a3544',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  diffOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3544',
    marginBottom: 10,
    backgroundColor: '#1b2430',
  },
  diffOptionText: { flex: 1 },
  diffOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  diffOptionLabel: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  diffOptionGuesses: { fontSize: 11, fontWeight: '700', color: '#a7b0be' },
  diffOptionDesc: { fontSize: 12, color: '#a7b0be', lineHeight: 17 },
  statsModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  statsSheet: {
    backgroundColor: '#141a22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#2a3544',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1b2430',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: { fontSize: 13, fontWeight: '900', color: '#ffffff' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
    width: '100%',
  },
  statBox: { alignItems: 'center', minWidth: 60 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#ffffff' },
  statLabel: {
    fontSize: 10,
    color: '#a7b0be',
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  avgLine: { fontSize: 12, color: '#a7b0be', marginBottom: 16, textAlign: 'center' },
  distTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#ffffff',
    marginBottom: 8,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  distNum: { width: 18, textAlign: 'right', fontWeight: '800', fontSize: 13, color: '#ffffff' },
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
    backgroundColor: 'rgba(11,15,20,0.94)',
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
    borderColor: '#2a3544',
    borderRadius: 18,
    backgroundColor: '#141a22',
    gap: 12,
  },
  resultTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  wonColor: { color: '#4caf50' },
  lostColor: { color: '#ef4444' },
  answerBadge: {
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#211b0b',
    borderRadius: 18,
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
  answerWord: { fontSize: 28, fontWeight: '900', letterSpacing: 7, color: '#ffffff' },
});
