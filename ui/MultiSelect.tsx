import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { DropdownField, type Option, Sheet, sheetStyles } from './Select';
import { Text } from './Text';
import { colors, sizes } from './theme';

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  /** Selected values, kept in the order they were ticked. */
  value: T[];
  onChange: (value: T[]) => void;
};

/**
 * A dropdown with several choices (board `library / add exercise - muscles open`): tick boxes in
 * two columns and "Done (n)". The ticks apply only on Done; closing the sheet otherwise keeps the
 * old value.
 */
export function MultiSelect<T extends string>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T[]>(value);
  const labelOf = (v: T) => options.find((o) => o.value === v)?.label ?? v;
  const text = value.length > 0 ? value.map(labelOf).join(', ') : null;
  const toggle = (v: T) =>
    setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));

  return (
    <>
      <DropdownField
        label={label}
        text={text}
        onOpen={() => {
          setDraft(value);
          setOpen(true);
        }}
      />
      <Sheet
        visible={open}
        title={label.replace(/\s*\*$/, '')}
        hint="Pick one or more"
        onClose={() => setOpen(false)}
        footer={
          <Button
            label={`Done (${draft.length})`}
            onPress={() => {
              setOpen(false);
              onChange(draft);
            }}
          />
        }
      >
        <View style={styles.grid}>
          {options.map((o) => {
            const checked = draft.includes(o.value);
            return (
              <Pressable
                key={o.value}
                accessibilityRole="checkbox"
                accessibilityLabel={o.label}
                accessibilityState={{ checked }}
                onPress={() => toggle(o.value)}
                style={({ pressed }) => [styles.cell, pressed && sheetStyles.pressed]}
              >
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <Text>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', minHeight: sizes.minTap, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.accent },
  tick: { color: colors.white, fontSize: sizes.small, lineHeight: 18 },
});
