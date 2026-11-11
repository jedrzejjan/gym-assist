import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  title: string;
  /** e.g. { label: '‹ Home', onPress } — omitted on Home and Welcome. */
  back?: { label: string; onPress: () => void };
};

export function AppBar({ title, back }: Props) {
  return (
    <View style={styles.bar}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={back.label}
          onPress={back.onPress}
          hitSlop={8}
          style={styles.back}
        >
          <Text style={styles.backText}>{back.label}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: sizes.appBar,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.gutter,
    gap: 12,
  },
  back: { minHeight: sizes.minTap, justifyContent: 'center' },
  backText: { color: colors.onNavy, fontSize: sizes.small },
  title: { color: colors.white, fontFamily: fonts.semibold, fontSize: sizes.title },
});
