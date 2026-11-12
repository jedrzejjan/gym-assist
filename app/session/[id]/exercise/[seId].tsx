import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { mutate, useDb, useLive } from '../../../../data/live';
import {
  addSet,
  deleteSet,
  exerciseScreenData,
  type ExerciseScreenData,
  finishExercise,
  type SetRow,
  updateSet,
} from '../../../../data/sessions';
import { formatDayMonth, todayLocal } from '../../../../domain/dates';
import { addedLoadFromPercent, percentToKg } from '../../../../domain/progress';
import {
  formatKg,
  formatLastTime,
  formatSet,
  parseReps,
  parseWeight,
} from '../../../../domain/sets';
import { AppBar } from '../../../../ui/AppBar';
import { Button } from '../../../../ui/Button';
import { Chips } from '../../../../ui/Chips';
import { Screen } from '../../../../ui/Screen';
import { Text } from '../../../../ui/Text';
import { NumberField } from '../../../../ui/TextField';
import { colors, fonts, sizes } from '../../../../ui/theme';

type Mode = 'kg' | '%';

// The kg | % choice per session exercise, kept in memory while the app runs, so it survives
// leaving the screen and coming back (spec section 4: "keeps the last choice for the rest of
// that exercise in the session"). It is not stored in the database.
const modeChoice = new Map<string, Mode>();

/** 62.5 → '62,5' for the input field (the trainer's keyboard uses a comma). */
const toInput = (n: number | null) => (n === null ? '' : formatKg(n).replace('.', ','));

/**
 * Boards `log/exercise - …` (spec section 4, steps 3 to 5): last time, the sets so far, and the
 * form to add or edit a set in kg or as a % of the stored 1RM. Every set is saved at once, so
 * the draft survives the app closing.
 */
export default function SessionExercise() {
  const { seId } = useLocalSearchParams<{ id: string; seId: string }>();
  const data = useLive((db) => exerciseScreenData(db, seId), [seId]);
  if (!data) return null;
  return <ExerciseForm seId={seId} data={data} />;
}

function ExerciseForm({ seId, data }: { seId: string; data: ExerciseScreenData }) {
  const db = useDb();
  const { exercise, oneRepMax, bodyWeight } = data;
  const bw = exercise.usesBodyweight;
  const [mode, setModeState] = useState<Mode>(() => modeChoice.get(seId) ?? 'kg');
  const setMode = (m: Mode) => {
    modeChoice.set(seId, m);
    setModeState(m);
  };
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [editing, setEditing] = useState<SetRow | null>(null);
  const leaving = useRef(false);

  const percentMode = mode === '%' && oneRepMax !== null && editing === null;
  const typed = parseWeight(weightText);
  const reps = parseReps(repsText);

  // The kg that will be saved (the added load for bodyweight exercises).
  let kg: number | null = null;
  if (typeof typed === 'number') {
    if (!percentMode) kg = typed;
    else if (bw) kg = addedLoadFromPercent(oneRepMax.valueKg, typed, bodyWeight?.valueKg ?? 0);
    else kg = percentToKg(oneRepMax.valueKg, typed);
  }
  const valid = typed !== 'invalid' && reps !== 'invalid';
  const values = () => ({ weightKg: kg, reps: reps as number | null });

  const weightLabel = percentMode ? '% of 1RM' : bw ? 'Added (kg)' : 'Weight (kg)';

  const add = () => {
    if (!valid) return;
    mutate(db, (tx) => addSet(tx, seId, values()));
    // The fields keep their values: the next set is usually the same or close.
  };

  const startEdit = (s: SetRow) => {
    if (editing?.id === s.id) {
      stopEdit();
      return;
    }
    setEditing(s);
    setWeightText(toInput(s.weightKg)); // a set is stored in kg, so editing shows kg
    setRepsText(s.reps === null ? '' : String(s.reps));
  };

  const stopEdit = () => {
    setEditing(null);
    setWeightText('');
    setRepsText('');
  };

  const save = () => {
    if (!editing || !valid) return;
    mutate(db, (tx) => updateSet(tx, editing.id, values()));
    stopEdit();
  };

  const remove = () => {
    if (!editing) return;
    mutate(db, (tx) => deleteSet(tx, editing.id));
    stopEdit();
  };

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    mutate(db, (tx) => finishExercise(tx, seId));
    router.dismissTo(`/session/${data.sessionId}`);
  };

  const ormLine = oneRepMax
    ? `1RM ${formatKg(oneRepMax.valueKg)} kg (${oneRepMax.source}, ${formatDayMonth(
        todayLocal(new Date(oneRepMax.createdAt)),
      )})` +
      (percentMode && typeof typed === 'number' && kg !== null
        ? ` · ${formatKg(typed)}% = ${bw ? `BW + ${formatKg(kg)}` : formatKg(kg)} kg`
        : '')
    : null;

  const weightHint =
    typed === 'invalid'
      ? percentMode
        ? 'Percent: a number like 85'
        : 'Weight: a number like 22,5'
      : null;
  const repsHint = reps === 'invalid' ? 'Reps: a whole number, 1 or more' : null;

  return (
    <Screen
      header={
        <AppBar title="Exercise" back={{ label: '‹ Session', onPress: () => router.back() }} />
      }
      footer={
        editing ? (
          <>
            <Button label={`Save set ${editing.setNo}`} onPress={save} disabled={!valid} />
            <Button label={`Delete set ${editing.setNo}`} variant="secondary" onPress={remove} />
          </>
        ) : (
          <>
            <Button label="Add set" onPress={add} disabled={!valid} />
            <Button label="Finish exercise" variant="secondary" onPress={finish} />
          </>
        )
      }
    >
      <View style={styles.head}>
        <Text style={styles.name}>{exercise.nameEn}</Text>
        {exercise.namePl ? <Text variant="small">{exercise.namePl}</Text> : null}
        <Text style={styles.last}>{formatLastTime(data.lastTime, bw)}</Text>
      </View>

      {data.sets.length === 0 ? (
        <Text variant="small" style={styles.pad}>
          No sets yet.
        </Text>
      ) : (
        data.sets.map((s) => {
          const text = formatSet(s, bw);
          const active = editing?.id === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Set ${s.setNo}, ${text}`}
              accessibilityState={{ selected: active }}
              onPress={() => startEdit(s)}
              style={[styles.row, active && styles.rowActive]}
            >
              <Text style={styles.setNo}>{s.setNo}</Text>
              <Text>{text}</Text>
            </Pressable>
          );
        })
      )}

      <View style={styles.form}>
        {editing ? <Text variant="title">{`Edit set ${editing.setNo}`}</Text> : null}
        {bw && bodyWeight ? (
          <Text variant="small">
            {`Body weight ${formatKg(bodyWeight.valueKg)} kg (${formatDayMonth(bodyWeight.date)}) is added to the load.`}
          </Text>
        ) : null}
        {editing ? null : oneRepMax ? (
          mode === '%' ? (
            <Text variant="small">{ormLine}</Text>
          ) : null
        ) : (
          <Text variant="small">Set a 1RM in Progress to use %</Text>
        )}
        {editing ? null : (
          <Chips
            options={[
              { value: 'kg' as Mode, label: 'kg' },
              { value: '%' as Mode, label: '%', disabled: oneRepMax === null },
            ]}
            value={mode}
            onChange={(v) => setMode(v ?? 'kg')}
            clearable={false}
          />
        )}
        <View style={styles.fields}>
          <View style={styles.field}>
            <NumberField label={weightLabel} value={weightText} onChangeText={setWeightText} />
          </View>
          <View style={styles.field}>
            <NumberField label="Reps" value={repsText} onChangeText={setRepsText} />
          </View>
        </View>
        {weightHint ? (
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {weightHint}
          </Text>
        ) : null}
        {repsHint ? (
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {repsHint}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { padding: sizes.gutter, gap: 4 },
  name: { fontFamily: fonts.semibold, fontSize: sizes.title, color: colors.navy },
  last: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    color: colors.slate,
    fontSize: sizes.small,
  },
  pad: { paddingHorizontal: sizes.gutter },
  row: {
    minHeight: sizes.minTap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: sizes.gutter,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowActive: { backgroundColor: colors.warning },
  setNo: { width: 24, fontFamily: fonts.semibold, color: colors.slate },
  form: { padding: sizes.gutter, gap: 12 },
  fields: { flexDirection: 'row', gap: sizes.gutter },
  field: { flex: 1 },
  hint: { color: colors.slate, fontSize: sizes.small },
});
