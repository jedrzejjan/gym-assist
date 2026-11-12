import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, sizes } from './theme';

type Props<T extends string> = {
  /** Shown above the chips (form fields); omit for a filter row. */
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Optional fields: tapping the selected chip again clears it. Filters keep one chip selected. */
  clearable?: boolean;
  /** One scrolling line instead of wrapping (the library's pattern filter). */
  scroll?: boolean;
};

export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  clearable = true,
  scroll = false,
}: Props<T>) {
  const chips = options.map((o) => {
    const selected = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={() => onChange(selected && clearable ? null : o.value)}
        style={[styles.chip, selected && styles.selected]}
      >
        <Text style={{ color: selected ? colors.white : colors.accent }}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View
      style={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={label ? `chips:${label}` : undefined}
    >
      {label ? <Text variant="label">{label}</Text> : null}
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.line}
        >
          {chips}
        </ScrollView>
      ) : (
        <View style={styles.row}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  line: { flexDirection: 'row', gap: 8 },
  chip: {
    minHeight: sizes.minTap,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent },
});
