import { Pressable, StyleSheet, View } from 'react-native';

import { Menu, type MenuItem } from './Menu';
import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  title: string;
  /** e.g. { label: '‹ Home', onPress } — omitted on Home and Welcome. */
  back?: { label: string; onPress: () => void };
  /** The kebab menu (⋮) at the right, for the screen's rare or risky actions (GYM-133). */
  menu?: MenuItem[];
};

export function AppBar({ title, back, menu }: Props) {
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
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {menu ? <Menu items={menu} /> : null}
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
  title: { color: colors.white, fontFamily: fonts.semibold, fontSize: sizes.title, flexShrink: 1 },
});
