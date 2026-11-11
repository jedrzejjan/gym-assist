import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

/** Pill button, 56 px high (design index). Primary is filled; secondary is outlined. */
export function Button({ label, onPress, variant = 'primary', disabled = false }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, { color: primary ? colors.white : colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.button,
    borderRadius: sizes.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.accent },
  disabled: { opacity: 0.4 },
  label: { fontFamily: fonts.semibold, fontSize: sizes.body },
});
