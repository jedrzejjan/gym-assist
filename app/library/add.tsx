import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addCustomExercise, DuplicateNameError } from '../../data/exercises';
import { mutate, useDb } from '../../data/live';
import { addExerciseToSession } from '../../data/sessions';
import {
  categoryForPattern,
  displayName,
  type Muscle,
  muscleName,
  MUSCLES,
  type Pattern,
  PATTERNS,
  TRAINING_TYPES,
  type TrainingType,
} from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { MultiChips } from '../../ui/MultiChips';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { colors, sizes } from '../../ui/theme';

const options = <T extends string>(values: readonly T[]) =>
  values.map((v) => ({ value: v, label: displayName(v) }));

const YES_NO = [
  { value: 'no' as const, label: 'No' },
  { value: 'yes' as const, label: 'Yes' },
];

/**
 * Board `library/add exercise` (spec section 5, Add exercise). Required: English name, training
 * type, pattern. The category is hidden and derived from the pattern (GYM-99). Opened from a session as "New exercise"
 * (`?returnTo=session&sessionId=…`), saving also adds the exercise to that session and opens it.
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
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [bodyweight, setBodyweight] = useState<'no' | 'yes'>('no');
  const [duplicate, setDuplicate] = useState(false);
  const saving = useRef(false); // a double tap must not save twice

  const valid = nameEn.trim() !== '' && trainingType && pattern;

  const save = () => {
    if (!valid || saving.current) return;
    saving.current = true;
    let sessionExerciseId: string | null = null;
    try {
      mutate(db, (tx) => {
        const exerciseId = addCustomExercise(tx, {
          nameEn,
          namePl,
          category: categoryForPattern(pattern),
          trainingType,
          pattern,
          usesBodyweight: bodyweight === 'yes',
          muscles,
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
        <Chips
          label="Training type *"
          options={options(TRAINING_TYPES)}
          value={trainingType}
          onChange={setTrainingType}
        />
        <Chips
          label="Pattern *"
          options={options(PATTERNS)}
          value={pattern}
          onChange={setPattern}
        />
        <MultiChips
          label="Muscles"
          options={MUSCLES.map((m) => ({ value: m, label: muscleName(m).en }))}
          value={muscles}
          onChange={setMuscles}
        />
        <Chips
          label="Uses body weight"
          options={YES_NO}
          value={bodyweight}
          onChange={(v) => setBodyweight(v ?? 'no')}
          clearable={false}
        />
        <Text variant="small">* required · the English name must be unique</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
  error: { color: colors.accent, fontSize: sizes.small },
});
