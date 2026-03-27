import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  letterStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'>;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

// Background colours per letter state
const KEY_BG: Record<string, string> = {
  correct: '#6aaa64',
  present: '#c9b458',
  absent:  '#787c7e',
  banned:  '#3a3a3c',
  empty:   '#d3d6da',
};

// Text colour: white on all coloured states, dark on default grey
const KEY_TEXT: Record<string, string> = {
  correct: '#ffffff',
  present: '#ffffff',
  absent:  '#ffffff',
  banned:  '#666666',
  empty:   '#1a1a1b',
};

export const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress, onEnter, onDelete, letterStates,
}) => {
  return (
    <View style={styles.keyboard}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => {
            const isEnter  = key === 'ENTER';
            const isDel    = key === '⌫';
            const state    = (!isEnter && !isDel) ? (letterStates[key] ?? 'empty') : 'empty';
            const isBanned = state === 'banned';

            return (
              <TouchableOpacity
                key={key}
                disabled={isBanned}
                activeOpacity={isBanned ? 1 : 0.65}
                style={[
                  styles.key,
                  (isEnter || isDel) && styles.wideKey,
                  { backgroundColor: KEY_BG[state] ?? KEY_BG.empty },
                  isBanned && styles.bannedKey,
                ]}
                onPress={() => {
                  if (isEnter) onEnter();
                  else if (isDel) onDelete();
                  else onKeyPress(key);
                }}
              >
                <Text
                  style={[
                    styles.keyText,
                    (isEnter || isDel) && styles.actionText,
                    { color: KEY_TEXT[state] ?? KEY_TEXT.empty },
                  ]}
                >
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  keyboard: {
    paddingHorizontal: 6,
    paddingBottom: 8,
    gap: 7,
    alignItems: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  key: {
    height: 56,
    minWidth: 33,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    // subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  wideKey: {
    minWidth: 52,
    paddingHorizontal: 6,
  },
  bannedKey: {
    opacity: 0.45,
  },
  keyText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
