import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  variant?: 'solid' | 'outline';
};

export function Button({ label, onPress, color = colors.blue, variant = 'solid' }: Props) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: color } : { borderColor: color, borderWidth: 1.5 },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.label, { color: solid ? '#FFFFFF' : color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
});
