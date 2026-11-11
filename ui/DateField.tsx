import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, sizes } from './theme';

type Props = {
  label: string;
  /** 'YYYY-MM-DD' or null. */
  value: string | null;
  /** Shown value, e.g. "12 Mar 1992" (the screen formats it with domain/dates). */
  display: string;
  onChange: (value: string) => void;
  /** Converts the picked Date to 'YYYY-MM-DD' (domain/dates todayLocal). */
  toIsoDate: (d: Date) => string;
};

/** 'YYYY-MM-DD' → a local Date at noon, so no time zone shifts it to another day. */
function localNoon(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function DateField({ label, value, display, onChange, toIsoDate }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${display}` : label}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Text style={{ color: value ? colors.navy : colors.muted }}>{value ? display : '-'}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          mode="date"
          value={value ? localNoon(value) : new Date()}
          maximumDate={new Date()}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(toIsoDate(date));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, flex: 1 },
  field: {
    minHeight: sizes.minTap,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
});
