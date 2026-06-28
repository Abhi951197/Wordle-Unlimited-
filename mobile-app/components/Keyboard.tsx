import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  letterStates: Record<string, 'correct' | 'present' | 'absent' | 'empty' | 'banned'>;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const KEY_BG: Record<string, string> = {
  correct: '#2f8d46',
  present: '#d6a524',
  absent: '#3b4652',
  banned: '#18212b',
  empty: '#202a36',
};

const KEY_TEXT: Record<string, string> = {
  correct: '#ffffff',
  present: '#ffffff',
  absent: '#ffffff',
  banned: '#6b7280',
  empty: '#f8fafc',
};

export const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress, onEnter, onDelete, letterStates,
}) => {
  return (
    <View style={styles.keyboard}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
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
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  key: {
    height: 48,
    minWidth: 29,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2a3544',
  },
  wideKey: {
    minWidth: 55,
    paddingHorizontal: 6,
  },
  bannedKey: {
    opacity: 0.45,
  },
  keyText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
