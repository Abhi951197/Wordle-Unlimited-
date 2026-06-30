import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Keyboard } from '@/components/Keyboard';
import { VoiceControls } from '@/components/VoiceControls';
import { WordGrid } from '@/components/WordGrid';
import { ActiveBoard, useGameState } from '@/store/GameState';
import { trackEvent } from '@/utils/analytics';

const DIFF_META: Record<string, { color: string; label: string; desc: string; guesses: string; mark: string }> = {
  easy: { color: '#16C75A', label: 'Easy', desc: 'Classic Wordle rules', guesses: '6 guesses', mark: 'E' },
  moderate: { color: '#FACC15', label: 'Moderate', desc: 'Reuse confirmed letters', guesses: '6 guesses', mark: 'M' },
  difficult: { color: '#EF4444', label: 'Difficult', desc: 'Confirmed letters plus bans', guesses: '6 guesses', mark: 'D' },
  prodigy: { color: '#8B5CF6', label: 'Prodigy', desc: 'Hard rules, only 4 chances', guesses: '4 guesses', mark: 'P' },
};

type AppView = 'splash' | 'mode' | 'difficulty' | 'party' | 'roomCreated' | 'solo';
type PlayMode = 'solo' | 'party';
type StatsTab = 'overall' | 'easy' | 'moderate' | 'difficult' | 'prodigy';

interface RecentRoom {
  roomId: string;
  name: string;
  joinedAt: string;
}

interface AppSettings {
  sound: boolean;
  vibration: boolean;
  voiceChat: boolean;
  defaultDifficulty: string;
  theme: 'dark';
}

const RECENT_ROOMS_KEY = 'word_recent_rooms';
const SETTINGS_KEY = 'word_app_settings';
const PLAYER_EMOJIS = ['🙂', '😎', '🔥', '🚀', '🧠', '🎯', '⭐', '👑', '🍀', '⚡'];

const ToastBanner: React.FC<{ message: string; type: 'error' | 'warning' | 'info' }> = ({ message, type }) => {
  const bg = type === 'error' ? '#EF4444' : type === 'warning' ? '#FACC15' : '#16C75A';
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={[styles.toast, { backgroundColor: bg }]}>
      <Text style={[styles.toastText, type === 'warning' && styles.warningToastText]}>{message}</Text>
    </Animated.View>
  );
};

export default function GameScreen() {
  const {
    startGame, createRoom, joinRoom, leaveRoom, createSharedGame, createIndividualGame, changeRoomDifficulty,
    setActiveBoard, requestShareBoard, respondToShareRequest, gameStatus, currentGuess,
    addLetter, removeLetter, submitGuess, guesses, results, wordLength, letterStates,
    sessionId, difficulty, roomId, playerId, playerEmoji, roomPlayers, maxRoomPlayers, typingPlayerName, typingPlayerEmoji, livekit, activeBoard,
    shareRequest, stats, invalidShake, lastSubmittedRow, answer, maxGuesses, toast,
  } = useGameState();

  const { width, height } = useWindowDimensions();
  const isWide = width >= 760;
  const [view, setView] = useState<AppView>('splash');
  const [selectedMode, setSelectedMode] = useState<PlayMode>('solo');
  const [diffModal, setDiffModal] = useState(false);
  const [statsModal, setStatsModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🙂');
  const [nameError, setNameError] = useState('');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [joinCode, setJoinCode] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ sound: true, vibration: true, voiceChat: true, defaultDifficulty: 'easy', theme: 'dark' });
  const [statsTab, setStatsTab] = useState<StatsTab>('overall');
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  useEffect(() => {
    if (!sessionId && gameStatus === 'playing') startGame(difficulty);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (!roomParam) return;
    setJoinCode(roomParam.toUpperCase());
    if (!roomId) {
      setSelectedMode('party');
      setView('party');
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    if (view === 'splash') setView('party');
  }, [roomId, view]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_ROOMS_KEY).then(value => {
      if (value) setRecentRooms(JSON.parse(value));
    });
    AsyncStorage.getItem(SETTINGS_KEY).then(value => {
      if (value) setSettings(prev => ({ ...prev, ...JSON.parse(value) }));
    });
  }, []);

  useEffect(() => {
    if (gameStatus === 'playing') {
      setShowResultOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowResultOverlay(true), 1000);
    return () => clearTimeout(timer);
  }, [gameStatus, sessionId]);

  useEffect(() => {
    if (roomId) void saveRecentRoom(roomId, roomName);
  }, [roomId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((view !== 'solo' && view !== 'party') || gameStatus !== 'playing') return;
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

  const activeMeta = DIFF_META[difficulty] ?? DIFF_META.easy;
  const shareFromMe = shareRequest?.from_player_id === playerId;
  const hasShareForMe = !!shareRequest && !shareFromMe;

  const featureLine = useMemo(() => ['Solo & Party Mode', 'Voice Chat', 'Real-time Sync', 'Multiple Difficulties'], []);

  const saveRecentRoom = async (nextRoomId: string, name: string) => {
    const next: RecentRoom = { roomId: nextRoomId, name: name.trim() || 'My Room', joinedAt: new Date().toISOString() };
    const merged = [next, ...recentRooms.filter(room => room.roomId !== nextRoomId)].slice(0, 5);
    setRecentRooms(merged);
    await AsyncStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(merged));
  };

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16C75A" />
        <Text style={styles.mutedText}>Loading Wordle Unlimited...</Text>
      </View>
    );
  }

  const getInviteLink = () => {
    if (!roomId) return '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    }
    return `Room code: ${roomId}`;
  };

  const copyRoom = async () => {
    if (!roomId) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard?.writeText(getInviteLink());
    }
  };

  const shareRoom = async () => {
    if (!roomId) return;
    trackEvent('Room Invite Shared', { room_id: roomId });
    const inviteLink = getInviteLink();
    const message = `Join my Wordle Unlimited party room ${roomId}: ${inviteLink}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const webNavigator = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (webNavigator.share) {
        await webNavigator.share({ title: 'Wordle Unlimited Party', text: `Join room ${roomId}`, url: inviteLink });
        return;
      }
      await navigator.clipboard?.writeText(message);
      return;
    }
    await Share.share({ title: 'Wordle Unlimited Party', message });
  };

  const chooseMode = (mode: PlayMode) => {
    trackEvent('Mode Selected', { mode });
    setSelectedMode(mode);
    if (mode === 'solo') setView('difficulty');
    else setView('party');
  };

  const startSelectedDifficulty = async (nextDifficulty = difficulty) => {
    if (selectedMode === 'solo') {
      if (roomId) leaveRoom();
      await startGame(nextDifficulty);
      setView('solo');
      return;
    }
    await startGame(nextDifficulty);
    setView('party');
  };

  const createParty = async () => {
    if (!roomName.trim()) {
      setNameError('Enter your name to continue');
      return;
    }
    setNameError('');
    const created = await createRoom(difficulty, roomName, selectedEmoji);
    if (created) setView('roomCreated');
  };

  const joinParty = async () => {
    if (!roomName.trim()) {
      setNameError('Enter your name to continue');
      return;
    }
    setNameError('');
    const joined = await joinRoom(joinCode, roomName, selectedEmoji);
    if (joined) {
      if (joinCode.trim()) void saveRecentRoom(joinCode.trim().toUpperCase(), roomName);
      setView('party');
    }
  };

  const switchBoard = (board: ActiveBoard) => {
    if (activeBoard !== board) setActiveBoard(board);
  };

  const changeDifficulty = async (nextDifficulty: string) => {
    setDiffModal(false);
    if (roomId) {
      await changeRoomDifficulty(nextDifficulty);
      setView('party');
      return;
    }
    await startGame(nextDifficulty);
  };

  const roomSubtitle = roomId
    ? `${activeMeta.label} - ${roomPlayers.length || 1}/${maxRoomPlayers} players`
    : 'Create or join a room';

  const goBack = () => {
    if (view === 'splash') return;
    if (view === 'mode') setView('splash');
    else if (view === 'difficulty') setView('mode');
    else if (view === 'roomCreated') setView('party');
    else if (view === 'solo') setView('difficulty');
    else if (view === 'party' && !roomId) setView('mode');
    else setView('mode');
  };

  const renderHeroBrand = () => (
    <View style={styles.brandBlock}>
      <View style={styles.logoMark}><Text style={styles.logoMarkText}>W</Text></View>
      <Text style={styles.brand}>WORDLE <Text style={styles.brandAccent}>UNLIMITED</Text></Text>
      <Text style={styles.homeSubtitle}>Premium Multiplayer Word Game</Text>
      <View style={styles.pillRow}>
        {featureLine.map(item => <Text key={item} style={styles.featurePill}>{item}</Text>)}
      </View>
    </View>
  );

  const renderTopBar = (title: string, subtitle?: string, roomActions = false) => (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.smallIconBtn} onPress={goBack}>
        <Text style={styles.smallIconText}>{'<'}</Text>
      </TouchableOpacity>
      <View style={styles.topTitleWrap}>
        <Text style={styles.topTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.topSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.topActions}>
        {roomId && roomActions && <TouchableOpacity style={styles.smallIconBtn} onPress={() => setRoomModal(true)}><Text style={styles.smallIconText}>i</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.smallIconBtn} onPress={() => setDiffModal(true)}><Text style={[styles.smallIconText, { color: activeMeta.color }]}>{activeMeta.mark}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallIconBtn} onPress={() => { trackEvent('Settings Opened'); setSettingsModal(true); }}><Text style={styles.smallIconText}>S</Text></TouchableOpacity>
      </View>
    </View>
  );

  const renderBoard = () => (
    <View style={styles.boardShell}>
      <View style={styles.toastSlot}>{toast ? <ToastBanner message={toast.message} type={toast.type} /> : null}</View>
      {roomId && (
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentBtn, activeBoard === 'shared' && styles.segmentActive]} onPress={() => switchBoard('shared')}>
            <Text style={[styles.segmentText, activeBoard === 'shared' && styles.segmentTextActive]}>Shared Board</Text>
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
      <View
        style={styles.gridWrap}
        onLayout={(event) => {
          const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
          setGridSize({ width: nextWidth, height: nextHeight });
        }}
      >
        {roomId && typingPlayerName && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.liveCursor}>
            <Text style={styles.liveCursorEmoji}>{typingPlayerEmoji || '🙂'}</Text>
            <Text style={styles.liveCursorText}>{typingPlayerName}</Text>
          </Animated.View>
        )}
        <WordGrid
          guesses={guesses}
          results={results}
          currentGuess={currentGuess}
          wordLength={wordLength}
          invalidShake={invalidShake}
          lastSubmittedRow={lastSubmittedRow}
          maxGuesses={maxGuesses}
          maxWidth={gridSize.width}
          maxHeight={gridSize.height}
        />
      </View>
      <Keyboard onKeyPress={addLetter} onEnter={submitGuess} onDelete={removeLetter} letterStates={letterStates} />
      {roomId && <Text style={styles.typingLine}>{typingPlayerName ? `${typingPlayerName} is typing...` : activeBoard === 'shared' ? 'Shared board ready' : 'Your private board'}</Text>}
      {roomId && activeBoard === 'individual' && gameStatus === 'playing' && (
        <TouchableOpacity style={styles.inlineAction} onPress={requestShareBoard}><Text style={styles.inlineActionText}>Share My Board</Text></TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.appFrame, isWide && styles.appFrameWide]}>
        {view === 'splash' && (
          <View style={styles.screen}>
            <View style={styles.splashBody}>
              {renderHeroBrand()}
              <View style={styles.splashActions}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('mode')}><Text style={styles.primaryText}>Get Started</Text></TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setHelpModal(true)}><Text style={styles.outlineText}>How to Play</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {view === 'mode' && (
          <ScrollView contentContainerStyle={[styles.scrollScreen, styles.centeredScreen]} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.floatingBack} onPress={goBack}><Text style={styles.smallIconText}>{'<'}</Text></TouchableOpacity>
            <Text style={styles.pageTitle}>Choose Game Mode</Text>
            <Text style={styles.pageSub}>Play your way</Text>
            <TouchableOpacity style={[styles.modeCard, styles.soloCard]} onPress={() => chooseMode('solo')} activeOpacity={0.82}>
              <View style={styles.modeIcon}><Text style={styles.modeIconText}>S</Text></View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeTitle}>Solo Mode</Text>
                <Text style={styles.modeDesc}>Play alone and challenge yourself.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeCard, styles.partyCard]} onPress={() => chooseMode('party')} activeOpacity={0.82}>
              <View style={[styles.modeIcon, styles.partyIcon]}><Text style={styles.modeIconText}>P</Text></View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeTitle}>Party Mode</Text>
                <Text style={styles.modeDesc}>Play with friends in real time with optional voice.</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}

        {view === 'difficulty' && (
          <ScrollView contentContainerStyle={styles.scrollScreen} showsVerticalScrollIndicator={false}>
            {renderTopBar('Select Difficulty', 'Choose your challenge')}
            <View style={styles.difficultyList}>
              {Object.entries(DIFF_META).map(([key, meta]) => (
                <TouchableOpacity key={key} style={[styles.diffCard, difficulty === key && { borderColor: meta.color }]} onPress={() => startSelectedDifficulty(key)}>
                  <View style={[styles.diffBadge, { backgroundColor: meta.color }]}><Text style={styles.diffBadgeText}>{meta.mark}</Text></View>
                  <View style={styles.diffTextWrap}>
                    <Text style={styles.diffTitle}>{meta.label}</Text>
                    <Text style={styles.diffDesc}>{meta.desc}</Text>
                  </View>
                  <Text style={styles.diffGuesses}>{meta.guesses}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {view === 'party' && !roomId && (
          <ScrollView contentContainerStyle={styles.scrollScreen} showsVerticalScrollIndicator={false}>
            {renderTopBar('Start a Party', 'Create or join a room')}
            <Text style={styles.inputLabel}>Your name</Text>
            <TextInput
              value={roomName}
              onChangeText={(value) => { setRoomName(value); if (nameError) setNameError(''); }}
              placeholder=""
              placeholderTextColor="#64748B"
              style={[styles.input, nameError && styles.inputError]}
              autoCorrect={false}
            />
            {!!nameError && <Text style={styles.fieldError}>{nameError}</Text>}
            <Text style={styles.inputLabel}>Profile emoji</Text>
            <View style={styles.emojiPicker}>
              {PLAYER_EMOJIS.map(emoji => (
                <TouchableOpacity key={emoji} style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiOptionActive]} onPress={() => setSelectedEmoji(emoji)}>
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.createPartyBtn]} onPress={createParty}><Text style={styles.primaryText}>Create Party</Text></TouchableOpacity>
            <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>or join a room</Text><View style={styles.line} /></View>
            <Text style={styles.inputLabel}>Room code</Text>
            <View style={styles.joinRow}>
              <TextInput
                value={joinCode}
                onChangeText={value => setJoinCode(value.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor="#64748B"
                style={[styles.input, styles.joinInput]}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />
              <TouchableOpacity style={styles.joinBtn} onPress={joinParty}><Text style={styles.primaryText}>Join</Text></TouchableOpacity>
            </View>
            <View style={styles.recentBox}>
              <Text style={styles.recentTitle}>Recent rooms</Text>
              {recentRooms.length === 0 ? (
                <Text style={styles.recentEmpty}>Rooms you join will appear here later.</Text>
              ) : recentRooms.map(room => (
                <TouchableOpacity key={room.roomId} style={styles.recentRow} onPress={() => setJoinCode(room.roomId)}>
                  <Text style={styles.recentCode}>{room.roomId}</Text>
                  <Text style={styles.recentMeta}>{room.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {view === 'roomCreated' && roomId && (
          <View style={styles.screen}>
            {renderTopBar('Room Created', 'Share this code')}
            <View style={styles.createdBody}>
              <Text style={styles.pageTitle}>Room Created!</Text>
              <Text style={styles.pageSub}>Share this code with your friends</Text>
              <View style={styles.createdCodeBox}><Text style={styles.createdCode}>{roomId}</Text></View>
              <View style={styles.inviteActions}>
                <TouchableOpacity style={styles.inviteBtn} onPress={copyRoom}><Text style={styles.copyLabel}>Copy Code</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.inviteBtn, styles.shareBtn]} onPress={shareRoom}><Text style={styles.shareLabel}>Share Link</Text></TouchableOpacity>
              </View>
              <Text style={styles.waitingText}>Friends can join any time. No waiting room needed.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('party')}><Text style={styles.primaryText}>Continue to Game</Text></TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => { leaveRoom(); setView('mode'); }}><Text style={styles.outlineText}>Cancel Room</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {view === 'solo' && (
          <View style={styles.gameScreen}>
            {renderTopBar('Solo Game', activeMeta.label)}
            {renderBoard()}
          </View>
        )}

        {view === 'party' && roomId && (
          <View style={styles.gameScreen}>
            {renderTopBar(`Room ${roomId}`, roomSubtitle, true)}
            <View style={styles.voicePanel}>
              <Text style={styles.voiceLabel}>Voice Chat</Text>
              <VoiceControls livekit={livekit} compact />
            </View>
            <View style={styles.playerStrip}>
              {roomPlayers.slice(0, 4).map((player, index) => (
                <View key={player.player_id} style={styles.playerChip}>
                  <View style={[styles.avatarDot, index === 0 && styles.ownerDot]}><Text style={styles.avatarEmoji}>{player.player_emoji || '🙂'}</Text></View>
                  <Text style={styles.playerChipText} numberOfLines={1}>{player.player_name}</Text>
                  <View style={styles.onlineDot} />
                </View>
              ))}
            </View>
            {renderBoard()}
          </View>
        )}
      </View>

      <Modal visible={diffModal} transparent animationType="slide" onRequestClose={() => setDiffModal(false)}>
        <TouchableWithoutFeedback onPress={() => setDiffModal(false)}><View style={styles.modalBackdrop} /></TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Difficulty</Text>
          {Object.entries(DIFF_META).map(([d, m]) => (
            <TouchableOpacity
              key={d}
              style={[styles.sheetRow, difficulty === d && { borderColor: m.color }]}
              onPress={() => changeDifficulty(d)}
            >
              <Text style={[styles.sheetRowTitle, difficulty === d && { color: m.color }]}>{m.label}</Text>
              <Text style={styles.sheetRowMeta}>{m.desc} - {m.guesses}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Modal visible={roomModal} transparent animationType="slide" onRequestClose={() => setRoomModal(false)}>
        <TouchableWithoutFeedback onPress={() => setRoomModal(false)}><View style={styles.modalBackdrop} /></TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Room Info</Text>
          <View style={styles.infoGrid}>
            <InfoRow label="Room code" value={roomId || '-'} />
            <InfoRow label="Difficulty" value={activeMeta.label} />
            <InfoRow label="Players" value={`${roomPlayers.length || 1}/8`} />
          </View>
          <View style={styles.inviteCard}>
            <Text style={styles.copyCode}>{roomId}</Text>
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.inviteBtn} onPress={copyRoom}><Text style={styles.copyLabel}>Copy Link</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.inviteBtn, styles.shareBtn]} onPress={shareRoom}><Text style={styles.shareLabel}>Share</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.playerList}>
            {roomPlayers.map(player => (
              <View key={player.player_id} style={styles.playerRow}>
                <View style={styles.avatarDot}><Text style={styles.avatarEmoji}>{player.player_emoji || '🙂'}</Text></View>
                <Text style={styles.playerName}>{player.player_name}{player.player_id === playerId ? ' (You)' : ''}</Text>
                <View style={styles.onlineDot} />
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => { leaveRoom(); setRoomModal(false); setView('mode'); }}><Text style={styles.dangerText}>Leave Room</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={helpModal} transparent animationType="fade" onRequestClose={() => setHelpModal(false)}>
        <View style={styles.centerModal}>
          <View style={styles.helpCard}>
            <Text style={styles.sheetTitle}>How to Play</Text>
            <View style={styles.exampleWord}>
              {['W', 'O', 'R', 'D', 'E'].map((letter, index) => (
                <View key={letter} style={[styles.exampleTile, index === 0 && styles.exampleGreen, index === 2 && styles.exampleYellow, index > 2 && styles.exampleGray]}>
                  <Text style={styles.exampleLetter}>{letter}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helpText}>Green means correct place, yellow means wrong place, gray means not in the word.</Text>
            <Text style={styles.helpText}>Solo is private. Party keeps the room alive so friends can talk and play shared or individual boards.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setHelpModal(false)}><Text style={styles.primaryText}>Got It</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={statsModal} transparent animationType="slide" onRequestClose={() => setStatsModal(false)}>
        <View style={styles.centerModal}>
          <View style={styles.helpCard}>
            <Text style={styles.sheetTitle}>Statistics</Text>
            <StatsSummary stats={stats} activeTab={statsTab} onTabChange={setStatsTab} gameStatus={gameStatus} guesses={guesses} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStatsModal(false)}><Text style={styles.primaryText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsModal} transparent animationType="fade" onRequestClose={() => setSettingsModal(false)}>
        <View style={styles.centerModal}>
          <View style={styles.menuCard}>
            <Text style={styles.sheetTitle}>Settings</Text>
            <SettingToggle label="Sound Effects" value={settings.sound} onPress={() => updateSetting('sound', !settings.sound)} />
            <SettingToggle label="Vibration" value={settings.vibration} onPress={() => updateSetting('vibration', !settings.vibration)} />
            <SettingToggle label="Voice Chat" value={settings.voiceChat} onPress={() => updateSetting('voiceChat', !settings.voiceChat)} />
            <View style={styles.settingRow}>
              <Text style={styles.menuText}>Default Difficulty</Text>
              <View style={styles.settingOptions}>
                {Object.entries(DIFF_META).map(([key, meta]) => (
                  <TouchableOpacity key={key} style={[styles.settingPill, settings.defaultDifficulty === key && { borderColor: meta.color }]} onPress={() => updateSetting('defaultDifficulty', key)}>
                    <Text style={[styles.settingPillText, settings.defaultDifficulty === key && { color: meta.color }]}>{meta.mark}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.menuRow} onPress={() => { setHelpModal(true); setSettingsModal(false); }}><Text style={styles.menuText}>How to Play</Text><Text style={styles.chevron}>{'>'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => { setStatsModal(true); setSettingsModal(false); }}><Text style={styles.menuText}>Statistics</Text><Text style={styles.chevron}>{'>'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuRow}><Text style={styles.menuText}>Achievements</Text><Text style={styles.menuMuted}>Soon</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setSettingsModal(false)}><Text style={styles.primaryText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showResultOverlay && gameStatus !== 'playing' && (view === 'solo' || (view === 'party' && roomId)) && (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <View style={styles.logoMarkSmall}><Text style={styles.logoMarkText}>W</Text></View>
            <Text style={[styles.resultTitle, gameStatus === 'won' ? styles.win : styles.loss]}>{gameStatus === 'won' ? 'You Win!' : 'Game Over'}</Text>
            {gameStatus === 'lost' && answer && <Text style={styles.answerText}>The word was {answer}</Text>}
            <StatsSummary stats={stats} activeTab="overall" gameStatus={gameStatus} guesses={guesses} compact />
            {roomId ? (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={createSharedGame}><Text style={styles.primaryText}>Continue Together</Text></TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={createIndividualGame}><Text style={styles.outlineText}>Play Individually</Text></TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => startGame(difficulty)}><Text style={styles.primaryText}>Play Again</Text></TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const SettingToggle: React.FC<{ label: string; value: boolean; onPress: () => void }> = ({ label, value, onPress }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.78}>
    <Text style={styles.menuText}>{label}</Text>
    <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </View>
  </TouchableOpacity>
);

const StatsSummary: React.FC<{
  stats: any;
  activeTab: StatsTab;
  onTabChange?: (tab: StatsTab) => void;
  gameStatus: 'playing' | 'won' | 'lost';
  guesses: string[];
  compact?: boolean;
}> = ({ stats, activeTab, onTabChange, gameStatus, guesses, compact = false }) => {
  const source = activeTab === 'overall'
    ? stats
    : { gamesPlayed: 0, wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, guessDistribution: [0, 0, 0, 0, 0, 0], ...(stats.byDifficulty?.[activeTab] ?? {}) };
  const winPct = source.gamesPlayed > 0 ? Math.round((source.wins / source.gamesPlayed) * 100) : 0;
  const avgGuesses = source.wins > 0
    ? (source.guessDistribution.reduce((sum: number, count: number, index: number) => sum + count * (index + 1), 0) / source.wins).toFixed(1)
    : '-';
  const maxDist = Math.max(...source.guessDistribution, 1);
  const tabs: StatsTab[] = ['overall', 'easy', 'moderate', 'difficult', 'prodigy'];

  return (
    <>
      {!compact && (
        <View style={styles.statsTabs}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab} style={[styles.statsTab, activeTab === tab && styles.statsTabActive]} onPress={() => onTabChange?.(tab)}>
              <Text style={[styles.statsTabText, activeTab === tab && styles.statsTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.statsRow}>
        {[{ v: source.gamesPlayed, l: 'Played' }, { v: `${winPct}%`, l: 'Win Rate' }, { v: source.currentStreak, l: 'Streak' }, { v: source.maxStreak, l: 'Best' }].map(({ v, l }) => (
          <View key={l} style={styles.statBox}><Text style={styles.statValue}>{v}</Text><Text style={styles.statLabel}>{l}</Text></View>
        ))}
      </View>
      {!compact && <Text style={styles.avgLine}>Avg guesses per win: <Text style={{ fontWeight: '800' }}>{avgGuesses}</Text></Text>}
      {!compact && source.guessDistribution.map((count: number, idx: number) => {
      const pct = Math.max((count / maxDist) * 100, 5);
      const isLast = gameStatus === 'won' && idx === guesses.length - 1;
      return (
        <View key={idx} style={styles.distRow}>
          <Text style={styles.distNum}>{idx + 1}</Text>
          <View style={[styles.distBar, { width: `${pct}%` }, isLast ? { backgroundColor: '#16C75A' } : null]}><Text style={styles.distCount}>{count}</Text></View>
        </View>
      );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F16', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F16' },
  mutedText: { color: '#9CA3AF', fontSize: 14, marginTop: 10 },
  appFrame: { flex: 1, width: '100%', maxWidth: 440, backgroundColor: '#0B0F16' },
  appFrameWide: { maxWidth: 980, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1F2937' },
  screen: { flex: 1, paddingHorizontal: 20, paddingBottom: 18 },
  scrollScreen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 },
  centeredScreen: { justifyContent: 'center' },
  floatingBack: { position: 'absolute', left: 20, top: 12, width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  splashBody: { flex: 1, justifyContent: 'center', gap: 34 },
  brandBlock: { alignItems: 'center' },
  logoMark: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#16C75A', alignItems: 'center', justifyContent: 'center', shadowColor: '#16C75A', shadowOpacity: 0.55, shadowRadius: 24, elevation: 12 },
  logoMarkSmall: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#16C75A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 6 },
  logoMarkText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  brand: { color: '#F8FAFC', fontSize: 34, fontWeight: '900', letterSpacing: 0, textAlign: 'center', marginTop: 24 },
  brandAccent: { color: '#16C75A' },
  homeSubtitle: { color: '#F8FAFC', opacity: 0.86, fontSize: 15, marginTop: 8, textAlign: 'center', fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  featurePill: { color: '#D1D5DB', fontSize: 11, fontWeight: '800', borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  splashActions: { gap: 12 },
  pageTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 18 },
  pageSub: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  topBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallIconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  smallIconText: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  topTitleWrap: { flex: 1, minWidth: 0 },
  topTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  topSubtitle: { color: '#9CA3AF', fontSize: 12, fontWeight: '800', marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 8 },
  modeCard: { minHeight: 108, borderRadius: 18, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12 },
  soloCard: { borderColor: '#16C75A', backgroundColor: '#10251A' },
  partyCard: { borderColor: '#8B5CF6', backgroundColor: '#201538' },
  modeIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#16C75A', alignItems: 'center', justifyContent: 'center' },
  partyIcon: { backgroundColor: '#8B5CF6' },
  modeIconText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  modeCopy: { flex: 1 },
  modeTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  modeDesc: { color: '#D1D5DB', fontSize: 13, lineHeight: 18, marginTop: 6, fontWeight: '700' },
  difficultyList: { gap: 10, marginTop: 12 },
  diffCard: { minHeight: 76, borderRadius: 16, borderWidth: 1, borderColor: '#283447', backgroundColor: '#151C27', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  diffBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  diffBadgeText: { color: '#fff', fontWeight: '900' },
  diffTextWrap: { flex: 1 },
  diffTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  diffDesc: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginTop: 3 },
  diffGuesses: { color: '#D1D5DB', fontSize: 11, fontWeight: '900' },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: '#16C75A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, shadowColor: '#16C75A', shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  outlineBtn: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  outlineText: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  inputLabel: { color: '#D1D5DB', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: '#283447', backgroundColor: '#151C27', color: '#F8FAFC', paddingHorizontal: 14, fontSize: 15, fontWeight: '800' },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, fontWeight: '800', marginTop: 6 },
  emojiPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  emojiOptionActive: { borderColor: '#16C75A', backgroundColor: '#10251A' },
  emojiOptionText: { fontSize: 18 },
  createPartyBtn: { marginTop: 14 },
  joinRow: { flexDirection: 'row', gap: 10 },
  joinInput: { flex: 1, letterSpacing: 3, textTransform: 'uppercase' },
  joinBtn: { minHeight: 52, borderRadius: 12, backgroundColor: '#8B5CF6', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#283447' },
  dividerText: { color: '#64748B', fontWeight: '900', textTransform: 'uppercase', fontSize: 10 },
  recentBox: { borderRadius: 16, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', padding: 14, marginTop: 16 },
  recentTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  recentEmpty: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginTop: 6 },
  recentRow: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#283447', backgroundColor: '#151C27', paddingHorizontal: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  recentCode: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  recentMeta: { color: '#9CA3AF', fontSize: 12, fontWeight: '800' },
  createdBody: { flex: 1, justifyContent: 'center', gap: 14 },
  createdCodeBox: { minHeight: 78, borderRadius: 16, backgroundColor: '#151C27', borderWidth: 1, borderColor: '#283447', alignItems: 'center', justifyContent: 'center' },
  createdCode: { color: '#F8FAFC', fontSize: 30, fontWeight: '900', letterSpacing: 9 },
  waitingText: { color: '#D1D5DB', fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  gameScreen: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  voicePanel: { width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', borderRadius: 16, padding: 9, marginBottom: 8, gap: 6 },
  voiceLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  playerStrip: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', gap: 6, marginBottom: 8 },
  playerChip: { flex: 1, minHeight: 34, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#283447', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 },
  playerChipText: { flex: 1, color: '#F8FAFC', fontSize: 11, fontWeight: '800' },
  boardShell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', justifyContent: 'space-between', minHeight: 0 },
  toastSlot: { height: 28, justifyContent: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  warningToastText: { color: '#111827' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', borderRadius: 14, padding: 3, marginBottom: 2 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 11 },
  segmentActive: { backgroundColor: '#16C75A' },
  segmentText: { color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  segmentTextActive: { color: '#fff' },
  gridWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 186, position: 'relative' },
  liveCursor: { position: 'absolute', right: 8, top: 8, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#10243A', borderWidth: 1, borderColor: '#31557E', paddingHorizontal: 10, paddingVertical: 6 },
  liveCursorEmoji: { fontSize: 15 },
  liveCursorText: { color: '#BFDBFE', fontSize: 11, fontWeight: '900' },
  prompt: { width: '100%', borderRadius: 14, borderWidth: 1, borderColor: '#FACC15', backgroundColor: '#2A2108', padding: 10, marginBottom: 6 },
  promptText: { color: '#FDE68A', fontWeight: '800', fontSize: 13 },
  promptRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: { backgroundColor: '#16C75A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  ghostBtn: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#283447', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  ghostText: { color: '#F8FAFC', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  inlineAction: { marginTop: 8, minHeight: 40, borderRadius: 13, backgroundColor: '#10243A', borderWidth: 1, borderColor: '#31557E', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  inlineActionText: { color: '#60A5FA', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  typingLine: { color: '#9CA3AF', fontSize: 11, fontWeight: '800', minHeight: 18, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: { backgroundColor: '#151C27', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: '#283447', gap: 12 },
  sheetTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  sheetRow: { borderWidth: 1, borderColor: '#283447', borderRadius: 16, padding: 14, backgroundColor: '#111827' },
  sheetRowTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  sheetRowMeta: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  inviteCard: { borderRadius: 16, backgroundColor: '#111827', borderWidth: 1, borderColor: '#283447', padding: 14, gap: 12 },
  inviteActions: { flexDirection: 'row', gap: 10 },
  inviteBtn: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#175E35', backgroundColor: '#10251A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  shareBtn: { borderColor: '#31557E', backgroundColor: '#10243A' },
  copyCode: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  copyLabel: { color: '#16C75A', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  shareLabel: { color: '#60A5FA', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  playerList: { gap: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 },
  avatarDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  ownerDot: { backgroundColor: '#16C75A' },
  avatarEmoji: { fontSize: 13 },
  playerName: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16C75A' },
  dangerBtn: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: '#EF4444', fontWeight: '900', textTransform: 'uppercase' },
  infoGrid: { borderRadius: 16, borderWidth: 1, borderColor: '#283447', backgroundColor: '#111827', padding: 12, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '800' },
  infoValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '900' },
  centerModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  helpCard: { width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: '#151C27', borderWidth: 1, borderColor: '#283447', padding: 20, gap: 14 },
  helpText: { color: '#D1D5DB', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  exampleWord: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  exampleTile: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' },
  exampleGreen: { backgroundColor: '#16C75A' },
  exampleYellow: { backgroundColor: '#FACC15' },
  exampleGray: { backgroundColor: '#64748B' },
  exampleLetter: { color: '#fff', fontWeight: '900', fontSize: 18 },
  menuCard: { width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: '#151C27', borderWidth: 1, borderColor: '#283447', padding: 14, gap: 8 },
  menuRow: { minHeight: 52, borderRadius: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: '#283447', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuText: { color: '#F8FAFC', fontSize: 14, fontWeight: '900' },
  menuMuted: { color: '#9CA3AF', fontSize: 12, fontWeight: '900' },
  chevron: { color: '#9CA3AF', fontSize: 16, fontWeight: '900' },
  settingRow: { minHeight: 52, borderRadius: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: '#283447', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleTrack: { width: 46, height: 26, borderRadius: 999, backgroundColor: '#334155', padding: 3, justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: '#16C75A' },
  toggleThumb: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#F8FAFC' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  settingOptions: { flexDirection: 'row', gap: 6 },
  settingPill: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#283447', alignItems: 'center', justifyContent: 'center', backgroundColor: '#151C27' },
  settingPillText: { color: '#9CA3AF', fontSize: 12, fontWeight: '900' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,22,0.94)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultCard: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: '#151C27', borderWidth: 1, borderColor: '#283447', padding: 20, gap: 12, alignItems: 'stretch' },
  resultTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  win: { color: '#FACC15' },
  loss: { color: '#EF4444' },
  answerText: { color: '#F8FAFC', textAlign: 'center', fontSize: 16, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statsTabs: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  statsTab: { flex: 1, minHeight: 30, borderRadius: 10, borderWidth: 1, borderColor: '#283447', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  statsTabActive: { borderColor: '#16C75A', backgroundColor: '#10251A' },
  statsTabText: { color: '#9CA3AF', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  statsTabTextActive: { color: '#16C75A' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#9CA3AF', fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  avgLine: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  distNum: { width: 18, color: '#F8FAFC', fontWeight: '900', textAlign: 'right' },
  distBar: { height: 22, minWidth: 24, borderRadius: 5, backgroundColor: '#334155', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 7 },
  distCount: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
