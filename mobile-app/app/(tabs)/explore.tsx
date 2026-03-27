import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform,
} from 'react-native';
import { useGameState } from '@/store/GameState';

const DIFF_INFO = [
  { emoji: '🟢', label: 'Easy',      desc: 'Classic Wordle — guess freely, no restrictions.' },
  { emoji: '🟡', label: 'Moderate',  desc: 'Confirmed letters must be reused in every subsequent guess.' },
  { emoji: '🔴', label: 'Difficult', desc: 'Moderate rules + absent letters are permanently banned from the keyboard.' },
  { emoji: '🧠', label: 'Prodigy',   desc: 'Difficult rules + only 4 guesses + rare word pool.' },
];

export default function StatsScreen() {
  const { stats } = useGameState();

  const winPct = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;
  const avgGuesses = stats.wins > 0
    ? (stats.guessDistribution.reduce((s, c, i) => s + c * (i + 1), 0) / stats.wins).toFixed(1)
    : '—';
  const maxDist = Math.max(...stats.guessDistribution, 1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>STATISTICS</Text>
          <View style={styles.headerLine} />
        </View>

        {/* Primary stats */}
        <View style={styles.statsGrid}>
          {[
            { value: stats.gamesPlayed,           label: 'Played' },
            { value: `${winPct}%`,                label: 'Win Rate' },
            { value: stats.currentStreak,         label: 'Streak' },
            { value: stats.maxStreak,             label: 'Best Streak' },
          ].map(({ value, label }) => (
            <View key={label} style={styles.statCard}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Secondary stats */}
        <View style={styles.secondaryRow}>
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryValue}>{avgGuesses}</Text>
            <Text style={styles.secondaryLabel}>Avg Guesses / Win</Text>
          </View>
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryValue}>{stats.wins}</Text>
            <Text style={styles.secondaryLabel}>Total Wins</Text>
          </View>
        </View>

        {/* Guess distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guess Distribution</Text>
          {stats.guessDistribution.map((count, idx) => {
            const pct = Math.max((count / maxDist) * 100, 5);
            return (
              <View key={idx} style={styles.distRow}>
                <Text style={styles.distNum}>{idx + 1}</Text>
                <View
                  style={[
                    styles.distBar,
                    { width: `${pct}%` },
                    count > 0 ? styles.distBarFilled : styles.distBarEmpty,
                  ]}
                >
                  <Text style={styles.distCount}>{count}</Text>
                </View>
              </View>
            );
          })}
          {stats.gamesPlayed === 0 && (
            <Text style={styles.emptyHint}>
              Complete a game to see your distribution here.
            </Text>
          )}
        </View>

        {/* How to play */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Play</Text>
          <Text style={styles.howText}>
            Guess the hidden 5-letter word in 6 tries (4 on Prodigy).{'\n'}
            Each guess must be a valid letter sequence.{'\n'}
            After each guess the tiles reveal how close you were:
          </Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendTile, { backgroundColor: '#6aaa64' }]}>
              <Text style={styles.legendLetter}>A</Text>
            </View>
            <Text style={styles.legendDesc}>Correct letter, correct position</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendTile, { backgroundColor: '#c9b458' }]}>
              <Text style={styles.legendLetter}>B</Text>
            </View>
            <Text style={styles.legendDesc}>Letter is in the word but wrong position</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendTile, { backgroundColor: '#787c7e' }]}>
              <Text style={styles.legendLetter}>C</Text>
            </View>
            <Text style={styles.legendDesc}>Letter is not in the word</Text>
          </View>
        </View>

        {/* Difficulty rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Modes</Text>
          {DIFF_INFO.map(({ emoji, label, desc }) => (
            <View key={label} style={styles.diffCard}>
              <Text style={styles.diffEmoji}>{emoji}</Text>
              <View style={styles.diffTextWrap}>
                <Text style={styles.diffLabel}>{label}</Text>
                <Text style={styles.diffDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 20 : 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#1a1a1b',
  },
  headerLine: {
    marginTop: 10,
    width: '100%',
    height: 1,
    backgroundColor: '#d3d6da',
  },

  // Primary stats grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 12,
  },
  statCard: { alignItems: 'center', minWidth: 64 },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1a1a1b',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#787c7e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: 'center',
  },

  // Secondary row
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  secondaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1b',
  },
  secondaryLabel: {
    fontSize: 11,
    color: '#787c7e',
    marginTop: 4,
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#1a1a1b',
    marginBottom: 12,
  },

  // Distribution
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  distNum: {
    width: 18,
    textAlign: 'right',
    fontWeight: '700',
    fontSize: 13,
    color: '#1a1a1b',
  },
  distBar: {
    paddingRight: 8,
    paddingLeft: 6,
    height: 22,
    borderRadius: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 24,
  },
  distBarFilled: { backgroundColor: '#6aaa64' },
  distBarEmpty:  { backgroundColor: '#d3d6da' },
  distCount: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: '#787c7e',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // How to play
  howText: {
    fontSize: 14,
    color: '#3a3a3c',
    lineHeight: 22,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  legendTile: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendLetter: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  legendDesc: {
    flex: 1,
    fontSize: 13,
    color: '#3a3a3c',
  },

  // Difficulty cards
  diffCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  diffEmoji: { fontSize: 22, marginTop: 1 },
  diffTextWrap: { flex: 1 },
  diffLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1b',
    marginBottom: 3,
  },
  diffDesc: {
    fontSize: 13,
    color: '#565758',
    lineHeight: 19,
  },
});
