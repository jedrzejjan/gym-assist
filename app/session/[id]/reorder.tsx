import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { deleteSession } from '../../../data/history';
import { mutate, useDb, useLive } from '../../../data/live';
import {
  getSession,
  listSessionExercises,
  moveExercise,
  removeExercise,
  sessionWriteOptions,
  type SessionExerciseItem,
} from '../../../data/sessions';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';

const setsText = (n: number) => (n === 1 ? '1 set' : `${n} sets`);

/**
 * Board `log/session - reorder`: ▲ ▼ move an exercise, ✕ removes it after a confirmation. In a
 * finished session, ✕ on the only exercise asks to delete the session instead (board
 * `history/dialog - delete last exercise`): a finished session needs at least one exercise.
 */
export default function Reorder() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useLive((d) => listSessionExercises(d, id), [id]);
  const session = useLive((d) => getSession(d, id), [id]);
  const [toRemove, setToRemove] = useState<SessionExerciseItem | null>(null);
  const deleting = useRef(false); // a double tap must not delete or navigate twice
  if (!session) return null; // e.g. just deleted, while leaving
  const lastOfFinished = session.status === 'finished' && items.length === 1;

  const move = (seId: string, dir: 'up' | 'down') =>
    mutate(db, (tx) => moveExercise(tx, seId, dir), sessionWriteOptions(db, id));

  const remove = () => {
    if (!toRemove) return;
    const seId = toRemove.id;
    setToRemove(null);
    mutate(db, (tx) => removeExercise(tx, seId), sessionWriteOptions(db, id));
  };

  const deleteWholeSession = () => {
    if (deleting.current) return;
    deleting.current = true;
    setToRemove(null);
    mutate(db, (tx) => deleteSession(tx, id));
    router.dismissTo(`/clients/${session.clientId}/history`);
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
        visible={toRemove !== null && lastOfFinished}
        title="Delete this session?"
        message={
          toRemove
            ? `${toRemove.nameEn} is its only exercise. A finished session needs at least one.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={deleteWholeSession}
        onCancel={() => setToRemove(null)}
      />
      <Dialog
        visible={toRemove !== null && !lastOfFinished}
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
