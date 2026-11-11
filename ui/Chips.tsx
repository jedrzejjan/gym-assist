import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, sizes } from './theme';

type Props<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  /** Tapping the selected chip again clears it (the field is optional). */
  onChange: (value: T | null) => void;
};

export function Chips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? null : o.value)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={{ color: selected ? colors.white : colors.accent }}>{o.label}</Text>
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
