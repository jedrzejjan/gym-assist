import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { mutate, useDb, useLive } from '../../../../data/live';
import {
  deleteWeight,
  getWeight,
  listWeights,
  updateWeight,
  weightCount,
  type WeightRow,
} from '../../../../data/measurements';
import { formatDayMonthYear } from '../../../../domain/dates';
import { parseWeight } from '../../../../domain/sets';
import { AppBar } from '../../../../ui/AppBar';
import { Button } from '../../../../ui/Button';
import { Dialog } from '../../../../ui/Dialog';
import { Screen } from '../../../../ui/Screen';
import { Text } from '../../../../ui/Text';
import { sizes } from '../../../../ui/theme';
import { WeightFields } from '../../../../ui/WeightFields';

/** Board `weight/edit`. The last remaining entry can be edited but not deleted. */
export default function EditWeightScreen() {
  const { mid } = useLocalSearchParams<{ mid: string }>();
  const entry = useLive((db) => getWeight(db, mid), [mid]);
  if (!entry) return null; // e.g. just deleted, while going back
  return <EditWeight entry={entry} />;
}

function EditWeight({ entry }: { entry: WeightRow }) {
  const db = useDb();
  const count = useLive((d) => weightCount(d, entry.clientId), [entry.clientId]);
  const [date, setDate] = useState(entry.date);
  const [kgText, setKgText] = useState(String(entry.valueKg));
  const [conflictKg, setConflictKg] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);

  const kg = parseWeight(kgText);
  const valid = typeof kg === 'number' && kg > 0;
  const canDelete = count > 1;

  const save = (replace: boolean) => {
    if (!valid || busy.current) return;
    busy.current = true;
    let result: 'saved' | 'conflict';
    try {
      result = mutate(db, (tx) =>
        updateWeight(tx, entry.id, { date, kg: kg as number }, { replace }),
      );
    } finally {
      busy.current = false;
    }
    if (result === 'conflict') {
      const other = listWeights(db, entry.clientId).find(
        (w) => w.date === date && w.id !== entry.id,
      );
      setConflictKg(other?.valueKg ?? null);
      return;
    }
    setConflictKg(null);
    busy.current = true;
    router.back();
  };

  const remove = () => {
    if (busy.current) return;
    busy.current = true;
    setConfirmDelete(false);
    try {
      mutate(db, (tx) => deleteWeight(tx, entry.id));
    } catch (e) {
      busy.current = false;
      throw e;
    }
    router.back();
  };

  return (
    <Screen
      header={
        <AppBar
          title="Edit weight"
          back={{ label: '‹ Body weight', onPress: () => router.back() }}
        />
      }
      footer={
        <>
          <Button label="Save" onPress={() => save(false)} disabled={!valid} />
          {canDelete ? (
            <Button
              label="Delete entry"
              variant="secondary"
              onPress={() => setConfirmDelete(true)}
            />
          ) : null}
        </>
      }
    >
      <WeightFields date={date} onDate={setDate} kg={kgText} onKg={setKgText} />
      {canDelete ? null : (
        <Text variant="small" style={styles.note}>
          The last remaining entry can be edited but not deleted.
        </Text>
      )}
      <Dialog
        visible={conflictKg !== null}
        title="Replace the weight for this date?"
        message={`${formatDayMonthYear(date)} already has ${conflictKg} kg.`}
        confirmLabel="Replace"
        onConfirm={() => save(true)}
        onCancel={() => setConflictKg(null)}
      />
      <Dialog
        visible={confirmDelete}
        title="Delete this weight entry?"
        message={`${entry.valueKg} kg · ${formatDayMonthYear(entry.date)}`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: sizes.gutter },
});
