import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { mutate, useDb } from '../../../../data/live';
import { addWeight, listWeights } from '../../../../data/measurements';
import { formatDayMonthYear, todayLocal } from '../../../../domain/dates';
import { parseWeight } from '../../../../domain/sets';
import { AppBar } from '../../../../ui/AppBar';
import { Button } from '../../../../ui/Button';
import { Dialog } from '../../../../ui/Dialog';
import { Screen } from '../../../../ui/Screen';
import { WeightFields } from '../../../../ui/WeightFields';

/** Board `weight/add`. A date that already has a weight asks before replacing it. */
export default function AddWeightScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [date, setDate] = useState(() => todayLocal(new Date()));
  const [kgText, setKgText] = useState('');
  const [conflictKg, setConflictKg] = useState<number | null | undefined>(undefined);
  const saving = useRef(false);

  const kg = parseWeight(kgText);
  const valid = typeof kg === 'number' && kg > 0;

  const save = (replace: boolean) => {
    if (!valid || saving.current) return;
    saving.current = true;
    let result: 'saved' | 'conflict';
    try {
      result = mutate(db, (tx) => addWeight(tx, id, date, kg as number, { replace }));
    } finally {
      saving.current = false;
    }
    if (result === 'conflict') {
      setConflictKg(listWeights(db, id).find((w) => w.date === date)?.valueKg ?? null);
      return;
    }
    setConflictKg(undefined);
    saving.current = true; // leaving the screen; ignore further taps
    router.back();
  };

  return (
    <Screen
      header={
        <AppBar
          title="Add weight"
          back={{ label: '‹ Body weight', onPress: () => router.back() }}
        />
      }
      footer={<Button label="Save" onPress={() => save(false)} disabled={!valid} />}
    >
      <WeightFields date={date} onDate={setDate} kg={kgText} onKg={setKgText} />
      <Dialog
        visible={conflictKg !== undefined}
        title="Replace the weight for this date?"
        message={`${formatDayMonthYear(date)} already has ${conflictKg != null ? `${conflictKg} kg` : 'a weight'}.`}
        confirmLabel="Replace"
        onConfirm={() => save(true)}
        onCancel={() => setConflictKg(undefined)}
      />
    </Screen>
  );
}
