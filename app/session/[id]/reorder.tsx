import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { mutate, useDb, useLive } from '../../../data/live';
import {
  listSessionExercises,
  moveExercise,
  removeExercise,
  type SessionExerciseItem,
} from '../../../data/sessions';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';

const setsText = (n: number) => (n === 1 ? '1 set' : `${n} sets`);

/** Board `log/session - reorder`: ▲ ▼ move an exercise, ✕ removes it after a confirmation. */
export default function Reorder() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useLive((d) => listSessionExercises(d, id), [id]);
  const [toRemove, setToRemove] = useState<SessionExerciseItem | null>(null);

  const move = (seId: string, dir: 'up' | 'down') =>
    mutate(db, (tx) => moveExercise(tx, seId, dir));

  const remove = () => {
    if (!toRemove) return;
    const seId = toRemove.id;
    setToRemove(null);
    mutate(db, (tx) => removeExercise(tx, seId));
  };

  return (
    <Screen
      header={
        <AppBar
          title="Reorder exercises"
          back={{ label: '‹ Back', onPress: () => router.back() }}
        />
      }
      footer={<Button label="Done" onPress={() => router.back()} />}
    >
      {items.map((e, i) => (
        <View key={e.id} style={styles.row}>
          <View style={styles.names}>
            <Text style={styles.name}>{e.nameEn}</Text>
            {e.namePl ? <Text variant="small">{e.namePl}</Text> : null}
          </View>
          <IconButton
            icon="▲"
            label={`Move ${e.nameEn} up`}
            disabled={i === 0}
            onPress={() => move(e.id, 'up')}
          />
          <IconButton
            icon="▼"
            label={`Move ${e.nameEn} down`}
            disabled={i === items.length - 1}
            onPress={() => move(e.id, 'down')}
          />
          <IconButton icon="✕" label={`Remove ${e.nameEn}`} onPress={() => setToRemove(e)} />
        </View>
      ))}
      <Text variant="small" style={styles.hint}>
        ▲ ▼ move · ✕ remove
      </Text>
      <Dialog
        visible={toRemove !== null}
        title="Remove this exercise and its sets?"
        message={toRemove ? `${toRemove.nameEn} · ${setsText(toRemove.setCount)}` : ''}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setToRemove(null)}
      />
    </Screen>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.icon, disabled && styles.iconDisabled]}
    >
      <Text style={styles.iconText}>{icon}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingLeft: sizes.gutter,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  names: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.navy },
  icon: {
    width: sizes.minTap,
    height: sizes.minTap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: { opacity: 0.3 },
  iconText: { color: colors.accent, fontSize: sizes.title },
  hint: { padding: sizes.gutter },
});
