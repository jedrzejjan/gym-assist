import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  title: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Full width (the Clients tile) or half width. */
  wide?: boolean;
};

/** A Home tile (design board `home`). Disabled tiles are dimmed. */
export function Tile({ title, subtitle, onPress, disabled = false, wide = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tile, wide ? styles.wide : styles.half, disabled && styles.disabled]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.accent,
    borderRadius: sizes.tileRadius,
    padding: 20,
    minHeight: 120,
  },
  wide: { width: '100%' },
  half: { flex: 1 },
  disabled: { opacity: 0.4 },
  title: { fontFamily: fonts.semibold, fontSize: sizes.title, color: colors.white },
  subtitle: { fontSize: sizes.small, color: colors.onNavy, marginTop: 8 },
});
