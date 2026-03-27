import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, Modal,
  ActivityIndicator, ScrollView, TextInput,
  TouchableOpacity, TouchableWithoutFeedback,
  Platform, Dimensions, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, FadeIn, FadeOut,
} from 'react-native-reanimated';
import { WordGrid } from '@/components/WordGrid';
import { Keyboard } from '@/components/Keyboard';
import { useGameState } from '@/store/GameState';

// ── Difficulty metadata ──────────────────────────────────────────────────────
const DIFF_META: Record<string, {
  emoji: string; color: string; label: string; desc: string; guesses: string;
}> = {
  easy:      { emoji: '🟢', color: '#6aaa64', label: 'Easy',      desc: 'No restrictions — classic Wordle',                              guesses: '6 guesses' },
  moderate:  { emoji: '🟡', color: '#c9b458', label: 'Moderate',  desc: 'Must reuse confirmed letters in every guess',                   guesses: '6 guesses' },
  difficult: { emoji: '🔴', color: '#e55c5c', label: 'Difficult', desc: 'Moderate rules + eliminated letters are permanently banned',     guesses: '6 guesses' },
  prodigy:   { emoji: '🧠', color: '#9b59b6', label: 'Prodigy',   desc: 'All Difficult rules + rare words + only 4 chances',             guesses: '4 guesses' },
};

// ── Toast banner ─────────────────────────────────────────────────────────────
const ToastBanner: React.FC<{ message: string; type: 'error' | 'warning' | 'info' }> = ({
  message, type,
}) => {
  const bg =
    type === 'error'   ? '#1a1a1b' :
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

// ── Hint cards ───────────────────────────────────────────────────────────────
const HINT_LABELS = ['', 'Category', 'Riddle', 'Structure'];
const HINT_ICONS  = ['', '📂', '🔍', '🧩'];

const HintCard: React.FC<{ level: number; text: string }> = ({ level, text }) => (
  <View style={styles.hintCard}>
    <View style={styles.hintCardHeader}>
      <Text style={styles.hintCardIcon}>{HINT_ICONS[level]}</Text>
      <Text style={styles.hintCardLabel}>Clue {level} — {HINT_LABELS[level]}</Text>
    </View>
    <Text style={styles.hintCardText}>{text}</Text>
  </View>
);

// ── Main screen ──────────────────────────────────────────────────────────────
export default function GameScreen() {
  const {
    startGame, gameStatus, currentGuess, addLetter, removeLetter, submitGuess,
    guesses, results, wordLength, letterStates, sessionId, difficulty,
    stats, getHint, hints, hintsUsed, invalidShake, lastSubmittedRow,
    answer, maxGuesses, toast,
  } = useGameState();

  const inputRef        = useRef<TextInput>(null);
  const [diffModal, setDiffModal]   = useState(false);
  const [statsModal, setStatsModal] = useState(false);

  // Auto-start on mount
  useEffect(() => {
    if (!sessionId && gameStatus === 'playing') startGame(difficulty);
  }, []);

  // Re-focus hidden input
  useEffect(() => {
    if (gameStatus === 'playing') setTimeout(() => inputRef.current?.focus(), 120);
  }, [gameStatus]);

  // ── computed stats ──
  const winPct = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const avgGuesses = stats.wins > 0
    ? (stats.guessDistribution.reduce((s, c, i) => s + c * (i + 1), 0) / stats.wins).toFixed(1)
    : '—';
  const maxDist    = Math.max(...stats.guessDistribution, 1);
  const activeMeta = DIFF_META[difficulty];

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6aaa64" />
        <Text style={styles.loadingText}>Connecting…</Text>
        <TouchableOpacity style={[styles.pill, { backgroundColor: '#6aaa64', marginTop: 8 }]}
          onPress={() => startGame('easy')}>
          <Text style={styles.pillTextWhite}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => { if (gameStatus === 'playing') inputRef.current?.focus(); }}>
      <SafeAreaView style={styles.container}>

        {/* Hidden hardware-keyboard capture */}
        <TextInput
          ref={inputRef}
          autoFocus
          style={styles.hidden}
          value=""
          onChangeText={() => {}}
          autoCapitalize="characters"
          autoCorrect={false}
          onKeyPress={({ nativeEvent }) => {
            if (gameStatus !== 'playing') return;
            const k = nativeEvent.key;
            if (k === 'Backspace')              removeLetter();
            else if (k === 'Enter')             submitGuess();
            else if (/^[a-zA-Z]$/.test(k))     addLetter(k.toUpperCase());
          }}
        />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Difficulty badge — tap to open modal */}
          <TouchableOpacity
            onPress={() => setDiffModal(true)}
            style={[styles.diffBadge, { borderColor: activeMeta.color }]}
            activeOpacity={0.7}
          >
            <Text style={styles.diffBadgeEmoji}>{activeMeta.emoji}</Text>
            <Text style={[styles.diffBadgeLabel, { color: activeMeta.color }]}>
              {activeMeta.label}
            </Text>
            <Text style={[styles.diffBadgeChevron, { color: activeMeta.color }]}>›</Text>
          </TouchableOpacity>

          <Text style={styles.title}>WORLD UNLIMITED</Text>

          {/* Stats icon — top-right */}
          <TouchableOpacity
            onPress={() => setStatsModal(true)}
            style={styles.statsIconBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.statsIcon}>📊</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerLine} />

        {/* ── Toast ──────────────────────────────────────────────────────── */}
        <View style={styles.toastSlot} pointerEvents="none">
          {toast ? <ToastBanner message={toast.message} type={toast.type} /> : null}
        </View>

        {/* ── Hint cards (stacked, only during active game) ──────────────── */}
        {gameStatus === 'playing' && hints.length > 0 && (
          <View style={styles.hintsArea}>
            {hints.map(h => <HintCard key={h.level} level={h.level} text={h.text} />)}
          </View>
        )}

        {/* ── Word grid ──────────────────────────────────────────────────── */}
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

        {/* ── Hint button (below grid, during active game) ────────────────── */}
        {gameStatus === 'playing' && hintsUsed < 2 && (
          <TouchableOpacity
            onPress={() => getHint(hintsUsed + 1)}
            style={styles.hintTrigger}
            activeOpacity={0.7}
          >
            <Text style={styles.hintTriggerText}>
              💡 Get a hint  ({2 - hintsUsed} left)
            </Text>
          </TouchableOpacity>
        )}

        {/* ── On-screen keyboard ─────────────────────────────────────────── */}
        <Keyboard
          onKeyPress={addLetter}
          onEnter={submitGuess}
          onDelete={removeLetter}
          letterStates={letterStates}
        />

        {/* ═══════════════════════════════════════════════════════════════════
            DIFFICULTY MODAL
        ════════════════════════════════════════════════════════════════════ */}
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
                  onPress={() => { startGame(d); setDiffModal(false); }}
                  style={[styles.diffOption, active && { borderColor: m.color, backgroundColor: m.color + '18' }]}
                  activeOpacity={0.75}
                >
                  <Text style={styles.diffOptionEmoji}>{m.emoji}</Text>
                  <View style={styles.diffOptionText}>
                    <View style={styles.diffOptionRow}>
                      <Text style={[styles.diffOptionLabel, active && { color: m.color }]}>{m.label}</Text>
                      <Text style={[styles.diffOptionGuesses, active && { color: m.color }]}>{m.guesses}</Text>
                    </View>
                    <Text style={styles.diffOptionDesc}>{m.desc}</Text>
                  </View>
                  {active && <Text style={[styles.diffOptionCheck, { color: m.color }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 20 }} />
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════
            STATS MODAL
        ════════════════════════════════════════════════════════════════════ */}
        <Modal visible={statsModal} transparent animationType="slide" onRequestClose={() => setStatsModal(false)}>
          <View style={styles.statsModalContainer}>
            <View style={styles.statsSheet}>
              <View style={styles.sheetHandle} />
              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setStatsModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetTitle}>Statistics</Text>

                {/* Primary stats */}
                <View style={styles.statsRow}>
                  {[
                    { v: stats.gamesPlayed,                              l: 'Played'   },
                    { v: `${winPct}%`,                                   l: 'Win Rate' },
                    { v: stats.currentStreak,                            l: 'Streak'   },
                    { v: stats.maxStreak,                                l: 'Best'     },
                  ].map(({ v, l }) => (
                    <View key={l} style={styles.statBox}>
                      <Text style={styles.statValue}>{v}</Text>
                      <Text style={styles.statLabel}>{l}</Text>
                    </View>
                  ))}
                </View>

                {/* Avg guesses */}
                <Text style={styles.avgLine}>Avg guesses per win: <Text style={{ fontWeight: '800' }}>{avgGuesses}</Text></Text>

                {/* Guess distribution */}
                <Text style={styles.distTitle}>Guess Distribution</Text>
                {stats.guessDistribution.map((count, idx) => {
                  const pct = Math.max((count / maxDist) * 100, 5);
                  const isLast = gameStatus === 'won' && idx === guesses.length - 1;
                  return (
                    <View key={idx} style={styles.distRow}>
                      <Text style={styles.distNum}>{idx + 1}</Text>
                      <View style={[
                        styles.distBar,
                        { width: `${pct}%` },
                        isLast ? { backgroundColor: '#6aaa64' } : { backgroundColor: '#787c7e' },
                      ]}>
                        <Text style={styles.distCount}>{count}</Text>
                      </View>
                    </View>
                  );
                })}

                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════
            END-GAME OVERLAY
        ════════════════════════════════════════════════════════════════════ */}
        {gameStatus !== 'playing' && (
          <View style={styles.overlay}>
            <ScrollView contentContainerStyle={styles.overlayCard} showsVerticalScrollIndicator={false}>

              <Text style={[styles.resultTitle, gameStatus === 'won' ? styles.wonColor : styles.lostColor]}>
                {gameStatus === 'won' ? '🎉 You Won!' : '😔 Game Over'}
              </Text>

              {/* Answer reveal */}
              {gameStatus === 'lost' && answer && (
                <View style={styles.answerBadge}>
                  <Text style={styles.answerLabel}>The word was</Text>
                  <Text style={styles.answerWord}>{answer}</Text>
                </View>
              )}

              {/* Stats summary */}
              <View style={styles.statsRow}>
                {[
                  { v: stats.gamesPlayed, l: 'Played'  },
                  { v: `${winPct}%`,      l: 'Win Rate' },
                  { v: stats.currentStreak, l: 'Streak' },
                  { v: stats.maxStreak,   l: 'Best'     },
                ].map(({ v, l }) => (
                  <View key={l} style={styles.statBox}>
                    <Text style={styles.statValue}>{v}</Text>
                    <Text style={styles.statLabel}>{l}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.avgLine}>Avg guesses per win: <Text style={{ fontWeight: '800' }}>{avgGuesses}</Text></Text>

              {/* Distribution */}
              <Text style={styles.distTitle}>Guess Distribution</Text>
              {stats.guessDistribution.map((count, idx) => {
                const pct = Math.max((count / maxDist) * 100, 5);
                const isLast = gameStatus === 'won' && idx === guesses.length - 1;
                return (
                  <View key={idx} style={styles.distRow}>
                    <Text style={styles.distNum}>{idx + 1}</Text>
                    <View style={[
                      styles.distBar,
                      { width: `${pct}%` },
                      isLast ? { backgroundColor: '#6aaa64' } : { backgroundColor: '#787c7e' },
                    ]}>
                      <Text style={styles.distCount}>{count}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Play again */}
              <TouchableOpacity
                style={[styles.playAgainBtn, { backgroundColor: activeMeta.color }]}
                onPress={() => startGame(difficulty)}
                activeOpacity={0.8}
              >
                <Text style={styles.playAgainText}>Play Again</Text>
              </TouchableOpacity>

              {/* Change difficulty shortcut */}
              <TouchableOpacity onPress={() => setDiffModal(true)} style={{ marginTop: 12 }}>
                <Text style={styles.changeDiffText}>Change difficulty →</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        )}

      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  // ── Header
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
    width: '90%',
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

  // Difficulty badge (top left)
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    minWidth: 90,
  },
  diffBadgeEmoji:   { fontSize: 13 },
  diffBadgeLabel:   { fontSize: 11, fontWeight: '700' },
  diffBadgeChevron: { fontSize: 14, fontWeight: '700', marginLeft: 1 },

  // Stats icon (top right)
  statsIconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsIcon: { fontSize: 22 },

  // ── Toast
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

  // ── Hint cards
  hintsArea: {
    width: '92%',
    gap: 6,
    marginBottom: 6,
  },
  hintCard: {
    backgroundColor: '#fef9e7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0d060',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hintCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  hintCardIcon:  { fontSize: 14 },
  hintCardLabel: { fontSize: 11, fontWeight: '800', color: '#8b6914', textTransform: 'uppercase', letterSpacing: 0.8 },
  hintCardText:  { fontSize: 14, color: '#5a4010', lineHeight: 20, fontStyle: 'italic' },

  // ── Hint trigger button
  hintTrigger: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#c9b458',
    backgroundColor: '#fffbef',
    marginBottom: 8,
  },
  hintTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8b6914',
  },

  // ── Grid area
  gridArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  // ── Difficulty modal (bottom sheet)
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
  diffOptionEmoji: { fontSize: 24 },
  diffOptionText:  { flex: 1 },
  diffOptionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  diffOptionLabel: { fontSize: 15, fontWeight: '800', color: '#1a1a1b' },
  diffOptionGuesses: { fontSize: 11, fontWeight: '600', color: '#787c7e' },
  diffOptionDesc:  { fontSize: 12, color: '#565758', lineHeight: 17 },
  diffOptionCheck: { fontSize: 18, fontWeight: '900' },

  // ── Stats modal
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

  // ── Stats content (shared between modal + overlay)
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
    width: '100%',
  },
  statBox:  { alignItems: 'center', minWidth: 60 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#1a1a1b' },
  statLabel: { fontSize: 10, color: '#787c7e', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  avgLine:   { fontSize: 12, color: '#787c7e', marginBottom: 16, textAlign: 'center' },
  distTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#1a1a1b', marginBottom: 8 },
  distRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 7 },
  distNum:   { width: 18, textAlign: 'right', fontWeight: '700', fontSize: 13, color: '#1a1a1b' },
  distBar:   { paddingRight: 8, paddingLeft: 6, height: 22, borderRadius: 3, alignItems: 'flex-end', justifyContent: 'center', minWidth: 24 },
  distCount: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // ── End-game overlay
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
  resultTitle:  { fontSize: 28, fontWeight: '900', letterSpacing: 1, marginBottom: 14 },
  wonColor:     { color: '#6aaa64' },
  lostColor:    { color: '#e55c5c' },
  answerBadge:  {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#f0c040',
  },
  answerLabel: { fontSize: 11, color: '#7a6020', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  answerWord:  { fontSize: 28, fontWeight: '900', letterSpacing: 7, color: '#1a1a1b' },

  playAgainBtn: {
    marginTop: 22,
    paddingVertical: 13,
    paddingHorizontal: 56,
    borderRadius: 10,
  },
  playAgainText:   { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  changeDiffText:  { fontSize: 13, color: '#787c7e', textDecorationLine: 'underline' },

  // ── Misc shared
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  pillTextWhite: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
