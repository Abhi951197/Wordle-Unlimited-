import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  letterStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'>;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['DEL', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER'],
];

const KEY_BG: Record<string, string> = {
  correct: '#16a34a',
  present: '#facc15',
  absent: '#101820',
  banned: '#101820',
  empty: '#64748b',
};

const KEY_TEXT: Record<string, string> = {
  correct: '#ffffff',
  present: '#111827',
  absent: '#475569',
  banned: '#475569',
  empty: '#ffffff',
};

export const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress, onEnter, onDelete, letterStates,
}) => {
  const { width, height } = useWindowDimensions();
  const keyboardWidth = Math.min(width - 16, 420);
  const keyGap = width < 380 ? 4 : 5;
  const wideRatio = 1.65;
  const rowOneFit = (keyboardWidth - keyGap * 9) / 10;
  const actionRowFit = (keyboardWidth - keyGap * 8) / (7 + wideRatio * 2);
  const normalKeyWidth = Math.max(26, Math.floor(Math.min(rowOneFit, actionRowFit)));
  const keyHeight = Math.max(38, Math.min(54, Math.floor(height * 0.058)));
  const wideKeyWidth = Math.max(54, Math.floor(normalKeyWidth * wideRatio));

  return (
    <View style={[styles.keyboard, { maxWidth: keyboardWidth }]}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: keyGap }]}>
          {row.map((key) => {
            const isEnter = key === 'ENTER';
            const isDel = key === 'DEL';
            const state = (!isEnter && !isDel) ? (letterStates[key] ?? 'empty') : 'empty';
            const isBanned = state === 'banned';

            return (
              <TouchableOpacity
                key={key}
                disabled={isBanned}
                activeOpacity={isBanned ? 1 : 0.68}
                style={[
                  styles.key,
                  { width: isEnter || isDel ? wideKeyWidth : normalKeyWidth, height: keyHeight },
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
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  key: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  bannedKey: {
    opacity: 0.45,
  },
  keyText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
