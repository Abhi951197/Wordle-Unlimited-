import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
} from 'react-native-reanimated';

// ── Colour constants — plain JS objects, safe to use inside reanimated worklets ──
const COLORS = {
  correct:      { bg: '#6aaa64', border: '#6aaa64' },
  present:      { bg: '#c9b458', border: '#c9b458' },
  absent:       { bg: '#787c7e', border: '#787c7e' },
  empty:        { bg: '#ffffff', border: '#d3d6da' },
  locked:       { bg: '#f0f0f0', border: '#e0e0e0' }, // beyond maxGuesses on Prodigy
  filledBorder: '#878a8c',
} as const;

// Always render this many rows so the grid height never jumps between difficulties
const VISUAL_ROWS = 6;

// ── Cell sizes ───────────────────────────────────────────────────────────────
const CELL_GAP        = 5;
const GRID_H_PADDING  = 24;   // total left+right padding
const MAX_CELL_SIZE   = 60;
const MIN_CELL_SIZE   = 40;

function useCellSize(wordLength: number) {
  const { width } = useWindowDimensions();
  const available = width - GRID_H_PADDING * 2 - CELL_GAP * (wordLength - 1);
  return Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(available / wordLength)));
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface WordGridProps {
  guesses:          string[];
  results:          string[][];
  currentGuess:     string;
  wordLength:       number;
  invalidShake:     number;
  lastSubmittedRow: number;
  maxGuesses:       number;   // 4 for Prodigy, 6 otherwise
}

// ── Single animated tile ──────────────────────────────────────────────────────
interface CellProps {
  letter:          string;
  status:          string;
  colIndex:        number;
  isJustSubmitted: boolean;
  isPastRow:       boolean;
  isCurrentRow:    boolean;
  isLocked:        boolean;   // row beyond difficulty's maxGuesses
  invalidShake:    number;
  size:            number;
}

const Cell: React.FC<CellProps> = ({
  letter, status, colIndex,
  isJustSubmitted, isPastRow, isCurrentRow,
  isLocked, invalidShake, size,
}) => {
  const rotateY = useSharedValue(isPastRow && !isJustSubmitted ? 180 : 0);
  const scale   = useSharedValue(1);
  const shakeX  = useSharedValue(0);

  // Flip on submit
  useEffect(() => {
    if (isJustSubmitted) {
      rotateY.value = withDelay(colIndex * 110, withTiming(180, { duration: 320 }));
    } else if (!isPastRow) {
      rotateY.value = 0;
    }
  }, [isJustSubmitted, isPastRow]);

  // Pop on letter entry
  useEffect(() => {
    if (isCurrentRow && letter) {
      scale.value = withSequence(
        withTiming(1.12, { duration: 60 }),
        withTiming(1.00, { duration: 60 }),
      );
    } else if (!letter) {
      scale.value = 1;
    }
  }, [letter, isCurrentRow]);

  // Shake on invalid guess
  useEffect(() => {
    if (isCurrentRow && invalidShake > 0) {
      shakeX.value = withSequence(
        withTiming(-9, { duration: 45 }), withTiming(9,  { duration: 45 }),
        withTiming(-9, { duration: 45 }), withTiming(9,  { duration: 45 }),
        withTiming( 0, { duration: 45 }),
      );
    }
  }, [invalidShake, isCurrentRow]);

  const cellStyle = useAnimatedStyle(() => {
    'worklet';
    if (isLocked) {
      return {
        transform: [{ translateX: 0 }, { scale: 1 }, { rotateY: '0deg' }],
        backgroundColor: COLORS.locked.bg,
        borderColor:     COLORS.locked.border,
      };
    }
    const flipped = rotateY.value > 90 || (isPastRow && !isJustSubmitted);
    const s = status as keyof typeof COLORS;
    const col = (COLORS[s] as { bg: string; border: string }) ?? COLORS.empty;
    return {
      transform: [
        { translateX: shakeX.value },
        { scale: scale.value },
        { rotateY: `${rotateY.value}deg` },
      ],
      backgroundColor: flipped ? col.bg     : COLORS.empty.bg,
      borderColor:     flipped ? col.border  : (letter ? COLORS.filledBorder : COLORS.empty.border),
    };
  });

  const textStyle = useAnimatedStyle(() => {
    'worklet';
    const flipped = rotateY.value > 90 || (isPastRow && !isJustSubmitted);
    return {
      transform: [{ rotateY: flipped ? '180deg' : '0deg' }],
      color:     flipped ? '#ffffff' : '#1a1a1b',
    };
  });

  return (
    <Animated.View style={[
      styles.cell,
      { width: size, height: size, borderRadius: size * 0.06 },
      cellStyle,
    ]}>
      <Animated.Text style={[styles.cellText, { fontSize: size * 0.5 }, textStyle]}>
        {isLocked ? '' : letter}
      </Animated.Text>
    </Animated.View>
  );
};

// ── Grid ──────────────────────────────────────────────────────────────────────
export const WordGrid: React.FC<WordGridProps> = ({
  guesses, results, currentGuess, wordLength,
  invalidShake, lastSubmittedRow, maxGuesses,
}) => {
  const cellSize = useCellSize(wordLength);

  const rows = [];

  for (let i = 0; i < VISUAL_ROWS; i++) {
    const isLocked      = i >= maxGuesses;        // beyond this difficulty's limit
    const isCurrentRow  = !isLocked && i === guesses.length;
    const isPastRow     = !isLocked && i <  guesses.length;
    const isJustSubmitted = i === lastSubmittedRow;
    const word          = isPastRow ? guesses[i] : (isCurrentRow ? currentGuess : '');
    const rowResults    = isPastRow ? results[i] : [];

    const cells = [];
    for (let j = 0; j < wordLength; j++) {
      cells.push(
        <Cell
          key={j}
          letter={isLocked ? '' : (word[j] ?? '')}
          status={rowResults[j] ?? 'empty'}
          colIndex={j}
          isJustSubmitted={isJustSubmitted}
          isPastRow={isPastRow}
          isCurrentRow={isCurrentRow}
          isLocked={isLocked}
          invalidShake={invalidShake}
          size={cellSize}
        />,
      );
    }

    rows.push(
      <View key={i} style={[styles.row, { gap: CELL_GAP }]}>
        {cells}
      </View>,
    );
  }

  return <View style={[styles.grid, { gap: CELL_GAP }]}>{rows}</View>;
};

// ── Styles — layout only, colours are handled in worklets ─────────────────────
const styles = StyleSheet.create({
  grid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontWeight: '900',
    lineHeight: undefined,  // let it auto
  },
});
