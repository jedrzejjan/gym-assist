import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  message: string;
  /** The action on the right, e.g. "FIX". */
  actionLabel: string;
  /** What a screen reader says for the action. */
  actionAccessibilityLabel: string;
  onAction: () => void;
};

/** The `kit/banner`: a warning strip under the app bar, with one action on the right. */
export function Banner({ message, actionLabel, actionAccessibilityLabel, onAction }: Props) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionAccessibilityLabel}
        onPress={onAction}
        hitSlop={8}
        style={styles.action}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: sizes.minTap + 16,
    backgroundColor: colors.warning,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.gutter,
    gap: 12,
  },
  message: { flex: 1, color: colors.navy, fontSize: sizes.small },
  action: { minHeight: sizes.minTap, minWidth: sizes.minTap, justifyContent: 'center' },
  actionText: { color: colors.navy, fontFamily: fonts.semibold, fontSize: sizes.small },
});
