import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  title: string;
  subtitle?: string;
  /** A small mark next to the title, e.g. "me". */
  tag?: string;
  onPress?: () => void;
  /** Shown as a button that can't be used now (e.g. a pattern with no exercises). */
  disabled?: boolean;
  /** What a screen reader says instead of the title and subtitle. */
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  subtitle,
  tag,
  onPress,
  disabled = false,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      accessibilityRole={onPress || disabled ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      style={styles.row}
    >
      <View style={styles.titleLine}>
        <Text style={styles.title}>{title}</Text>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
      </View>
      {subtitle ? <Text variant="small">{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    backgroundColor: colors.white,
    paddingHorizontal: sizes.gutter,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.navy },
  tag: {
    fontSize: sizes.small,
    color: colors.white,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
});
