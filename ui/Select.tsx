import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

export type Option<T extends string> = { value: T; label: string };

/**
 * The closed dropdown: a labelled field like TextField, showing the value and a chevron
 * (board `library / add exercise`). Its accessible name is "label, value". No tap guard:
 * opening is idempotent, so a double tap does no harm.
 */
export function DropdownField({
  label,
  text,
  onOpen,
}: {
  label: string;
  text: string | null;
  onOpen: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${text ?? '-'}`}
        onPress={onOpen}
        style={styles.field}
      >
        <Text style={[styles.value, text === null && styles.placeholder]} numberOfLines={1}>
          {text ?? '-'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
    </View>
  );
}

/**
 * The open list as a bottom sheet over a dimmed screen. A tap outside it, or Android's back
 * button, closes it.
 */
export function Sheet({
  visible,
  title,
  hint,
  onClose,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close list"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <Text variant="title">{title}</Text>
        {hint ? <Text variant="small">{hint}</Text> : null}
        <ScrollView style={styles.list}>{children}</ScrollView>
        {footer}
      </SafeAreaView>
    </Modal>
  );
}

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/** A dropdown with one choice (GYM-149: training type, pattern, subcategory, equipment). */
export function Select<T extends string>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value) ?? null;
  return (
    <>
      <DropdownField label={label} text={chosen?.label ?? null} onOpen={() => setOpen(true)} />
      <Sheet visible={open} title={label.replace(/\s*\*$/, '')} onClose={() => setOpen(false)}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked }}
              onPress={() => {
                setOpen(false);
                onChange(o.value);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={checked ? styles.checkedText : undefined}>{o.label}</Text>
              {checked ? <Text style={styles.checkedText}>✓</Text> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

export const sheetStyles = StyleSheet.create({
  pressed: { backgroundColor: colors.background },
});

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  field: {
    minHeight: sizes.minTap,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: { flex: 1, fontFamily: fonts.regular, fontSize: sizes.body, color: colors.navy },
  placeholder: { color: colors.muted },
  chevron: { color: colors.accent, fontSize: sizes.title },
  scrim: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderTopLeftRadius: sizes.tileRadius,
    borderTopRightRadius: sizes.tileRadius,
    padding: sizes.gutter,
    gap: 8,
  },
  list: { flexGrow: 0 },
  option: {
    minHeight: sizes.minTap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: sheetStyles.pressed,
  checkedText: { fontFamily: fonts.semibold, color: colors.accent },
});
