import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
} from 'react-native-reanimated';

// ── Colour constants — plain JS objects, safe to use inside reanimated worklets ──
const COLORS = {
  correct:      { bg: '#2f8d46', border: '#2f8d46' },
  present:      { bg: '#d6a524', border: '#d6a524' },
  absent:       { bg: '#3b4652', border: '#3b4652' },
  empty:        { bg: '#0b1219', border: '#2a3544' },
  locked:       { bg: '#111820', border: '#18212b' },
  filledBorder: '#5a6573',
} as const;

// Always render this many rows so the grid height never jumps between difficulties
const VISUAL_ROWS = 6;
const IS_WEB = Platform.OS === 'web';

// ── Cell sizes ───────────────────────────────────────────────────────────────
const CELL_GAP        = 6;
const GRID_H_PADDING  = 24;   // total left+right padding
const MAX_CELL_SIZE   = 54;
const MIN_CELL_SIZE   = 32;

function useCellSize(wordLength: number) {
  const { width, height } = useWindowDimensions();
  const available = width - GRID_H_PADDING * 2 - CELL_GAP * (wordLength - 1);
  const byWidth = Math.floor(available / wordLength);
  const byHeight = Math.floor((height * 0.47 - CELL_GAP * (VISUAL_ROWS - 1)) / VISUAL_ROWS);
  return Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, byWidth, byHeight));
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
        { rotateY: IS_WEB ? '0deg' : `${rotateY.value}deg` },
      ],
      backgroundColor: flipped ? col.bg     : COLORS.empty.bg,
      borderColor:     flipped ? col.border  : (letter ? COLORS.filledBorder : COLORS.empty.border),
    };
  });

  const textStyle = useAnimatedStyle(() => {
    'worklet';
    const flipped = rotateY.value > 90 || (isPastRow && !isJustSubmitted);
    return {
      transform: [{ rotateY: IS_WEB ? '0deg' : (flipped ? '180deg' : '0deg') }],
      color:     flipped ? '#ffffff' : '#f8fafc',
    };
  });

  return (
    <Animated.View style={[
      styles.cell,
      { width: size, height: size, borderRadius: 8 },
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
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  cellText: {
    fontWeight: '900',
    lineHeight: undefined,  // let it auto
  },
});
