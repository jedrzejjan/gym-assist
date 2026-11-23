import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getExercise } from '../../data/exercises';
import { useLive } from '../../data/live';
import {
  equipmentName,
  levelName,
  muscleList,
  patternName,
  subcategoryName,
} from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { colors, sizes } from '../../ui/theme';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

/**
 * Board `library / detail` (GYM-149 screen review): Training type · Pattern (with subcategory) ·
 * Equipment · Primary · Secondary muscles · Sides · Level, empty rows hidden. Exercises installed
 * with the app are read-only (spec section 5, Exercise library).
 */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useLive((db) => getExercise(db, id), [id]);

  if (!exercise) {
    return (
      <Screen
        header={
          <AppBar title="Exercise" back={{ label: '‹ Library', onPress: () => router.back() }} />
        }
      >
        <Text style={styles.body}>This exercise no longer exists.</Text>
      </Screen>
    );
  }

  const pattern = exercise.subcategory
    ? `${patternName(exercise.pattern)} · ${subcategoryName(exercise.subcategory).toLowerCase()}`
    : patternName(exercise.pattern);
  const rows: [string, string | null][] = [
    ['Training type', exercise.trainingType],
    ['Pattern', pattern],
    ['Equipment', equipmentName(exercise.equipment)],
    [
      'Primary muscles',
      exercise.primaryMuscles.length ? muscleList(exercise.primaryMuscles) : null,
    ],
    [
      'Secondary muscles',
      exercise.secondaryMuscles.length ? muscleList(exercise.secondaryMuscles) : null,
    ],
    ['Sides', exercise.unilateral ? 'Unilateral' : 'Bilateral'],
    ['Level', exercise.level ? levelName(exercise.level) : null],
  ];

  return (
    <Screen
      header={
        <AppBar title="Exercise" back={{ label: '‹ Library', onPress: () => router.back() }} />
      }
    >
      <View style={styles.body}>
        <View>
          <Text variant="title">{exercise.nameEn}</Text>
          {exercise.namePl ? <Text variant="small">{exercise.namePl}</Text> : null}
        </View>
        <View style={styles.card}>
          {rows.map(([label, value]) =>
            value === null ? null : <Field key={label} label={label} value={value} />,
          )}
        </View>
        {exercise.isCustom ? null : (
          <Text variant="small">Exercises installed with the app are read-only.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: sizes.gutter, gap: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    padding: sizes.gutter,
    gap: 16,
  },
  field: { gap: 2 },
});
