import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addCustomExercise, DuplicateNameError } from '../../data/exercises';
import { mutate, useDb } from '../../data/live';
import { addExerciseToSession } from '../../data/sessions';
import {
  EQUIPMENT,
  type Equipment,
  equipmentName,
  type Muscle,
  muscleName,
  MUSCLES,
  type Pattern,
  patternName,
  PATTERNS,
  SUBCATEGORIES,
  type Subcategory,
  subcategoryName,
  TRAINING_TYPES,
  type TrainingType,
} from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { MultiSelect } from '../../ui/MultiSelect';
import { Screen } from '../../ui/Screen';
import { Select } from '../../ui/Select';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { colors, sizes } from '../../ui/theme';

const yesNo = (label: string) => [
  { value: 'no' as const, label: 'No', a11yLabel: `${label}: No` },
  { value: 'yes' as const, label: 'Yes', a11yLabel: `${label}: Yes` },
];

const TYPE_OPTIONS = TRAINING_TYPES.map((t) => ({ value: t, label: t }));
const PATTERN_OPTIONS = PATTERNS.map((p) => ({ value: p, label: patternName(p) }));
const EQUIPMENT_OPTIONS = EQUIPMENT.map((e) => ({ value: e, label: equipmentName(e) }));
const MUSCLE_OPTIONS = MUSCLES.map((m) => ({ value: m, label: muscleName(m).en }));

/**
 * Boards `library / add exercise` and `- muscles open` (GYM-149). Required: English name,
 * training type, pattern (not for Cardio), equipment and at least one primary muscle. Subcategory
 * only for Push, Pull and Core. The trainer's own exercise gets importance 1, so it lists first.
 * Opened from a session as "New exercise" (`?returnTo=session&sessionId=…`), saving also adds the
 * exercise to that session and opens it.
 */
export default function AddExercise() {
  const db = useDb();
  const { returnTo, sessionId } = useLocalSearchParams<{
    returnTo?: string;
    sessionId?: string;
  }>();
  const toSession = returnTo === 'session' && sessionId ? sessionId : null;
  const [nameEn, setNameEn] = useState('');
  const [namePl, setNamePl] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType | null>(null);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [unilateral, setUnilateral] = useState<'no' | 'yes'>('no');
  const [bodyweight, setBodyweight] = useState<'no' | 'yes'>('no');
  const [duplicate, setDuplicate] = useState(false);
  const saving = useRef(false); // a double tap must not save twice

  const cardio = trainingType === 'Cardio';
  const subcategories = !cardio && pattern ? SUBCATEGORIES[pattern] : [];
  const valid =
    nameEn.trim() !== '' &&
    trainingType !== null &&
    (cardio || pattern !== null) &&
    equipment !== null &&
    muscles.length > 0;

  const choosePattern = (p: Pattern) => {
    setPattern(p);
    // A subcategory belongs to one pattern: changing the pattern drops it.
    if (p !== pattern) setSubcategory(null);
  };

  const save = () => {
    if (!valid || saving.current) return;
    saving.current = true;
    let sessionExerciseId: string | null = null;
    try {
      mutate(db, (tx) => {
        const exerciseId = addCustomExercise(tx, {
          nameEn,
          namePl,
          trainingType,
          pattern: cardio ? null : pattern,
          subcategory: cardio ? null : subcategory,
          equipment,
          primaryMuscles: muscles,
          unilateral: unilateral === 'yes',
          usesBodyweight: bodyweight === 'yes',
        });
        // One user action, one transaction: the new exercise joins the session or nothing is saved.
        if (toSession) sessionExerciseId = addExerciseToSession(tx, toSession, exerciseId);
      });
    } catch (e) {
      saving.current = false;
      if (e instanceof DuplicateNameError) {
        setDuplicate(true);
        return;
      }
      throw e;
    }
    if (toSession && sessionExerciseId) {
      router.replace(`/session/${toSession}/exercise/${sessionExerciseId}`);
    } else {
      router.back();
    }
  };

  return (
    <Screen
      header={
        <AppBar
          title="New exercise"
          back={{ label: toSession ? '‹ Session' : '‹ Library', onPress: () => router.back() }}
        />
      }
      footer={<Button label="Save exercise" onPress={save} disabled={!valid} />}
    >
      <View style={styles.form}>
        <TextField
          label="English name *"
          value={nameEn}
          onChangeText={(t) => {
            setNameEn(t);
            setDuplicate(false);
          }}
        />
        {duplicate ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            An exercise with this name already exists
          </Text>
        ) : null}
        <TextField label="Polish name" value={namePl} onChangeText={setNamePl} />
        <Select
          label="Training type *"
          options={TYPE_OPTIONS}
          value={trainingType}
          onChange={setTrainingType}
        />
        {cardio ? null : (
          <Select
            label="Pattern *"
            options={PATTERN_OPTIONS}
            value={pattern}
            onChange={choosePattern}
          />
        )}
        {subcategories.length > 0 ? (
          <Select
            label="Subcategory"
            options={subcategories.map((s) => ({ value: s, label: subcategoryName(s) }))}
            value={subcategory}
            onChange={setSubcategory}
          />
        ) : null}
        <Select
          label="Equipment *"
          options={EQUIPMENT_OPTIONS}
          value={equipment}
          onChange={setEquipment}
        />
        <MultiSelect
          label="Primary muscles *"
          options={MUSCLE_OPTIONS}
          value={muscles}
          onChange={setMuscles}
        />
        <View style={styles.toggle}>
          <Text variant="label">Unilateral</Text>
          <Chips
            options={yesNo('Unilateral')}
            value={unilateral}
            onChange={(v) => setUnilateral(v ?? 'no')}
            clearable={false}
          />
        </View>
        <View style={styles.toggle}>
          <Text variant="label">Uses body weight</Text>
          <Chips
            options={yesNo('Uses body weight')}
            value={bodyweight}
            onChange={(v) => setBodyweight(v ?? 'no')}
            clearable={false}
          />
        </View>
        <Text variant="small">
          * required · Primary muscles: pick one or more · Subcategory only for Push, Pull and Core
          · no pattern for Cardio
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.accent, fontSize: sizes.small },
});
