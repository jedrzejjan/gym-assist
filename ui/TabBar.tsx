import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props<T extends string> = {
  tabs: { value: T; label: string }[];
  current: T;
  onSelect: (value: T) => void;
};

/**
 * The `kit/tab bar`: equal-width tabs under the app bar. The selected one is in the accent
 * colour, semibold and underlined. Tapping the selected tab does nothing.
 */
export function TabBar<T extends string>({ tabs, current, onSelect }: Props<T>) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((t) => {
        const selected = t.value === current;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected }}
            onPress={() => (selected ? undefined : onSelect(t.value))}
            style={[styles.tab, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: sizes.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: { borderBottomColor: colors.accent },
  label: { fontSize: sizes.small, color: colors.slate },
  selectedLabel: { fontFamily: fonts.semibold, color: colors.accent },
});
