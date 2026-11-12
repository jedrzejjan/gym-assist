import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, sizes } from './theme';

type Props<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  /** Selected values, kept in the order they were tapped. */
  value: T[];
  onChange: (value: T[]) => void;
};

/** Chips where several can be selected (e.g. muscles). Each chip is a checkbox. */
export function MultiChips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityLabel={label} testID={`chips:${label}`}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() =>
                onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])
              }
              style={[styles.chip, checked && styles.selected]}
            >
              <Text style={{ color: checked ? colors.white : colors.accent }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
