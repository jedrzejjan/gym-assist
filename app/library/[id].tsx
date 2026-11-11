import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getExercise } from '../../data/exercises';
import { useLive } from '../../data/live';
import { displayName, muscleList } from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { colors, sizes } from '../../ui/theme';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

/** Board `library/detail`. Seed exercises are read-only (spec section 5, Exercise library). */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useLive((db) => getExercise(db, id), [id]);

  return (
    <Screen
      header={
        <AppBar title="Exercise" back={{ label: '‹ Library', onPress: () => router.back() }} />
      }
    >
      {exercise ? (
        <View style={styles.body}>
          <View>
            <Text variant="title">{exercise.nameEn}</Text>
            {exercise.namePl ? <Text variant="small">{exercise.namePl}</Text> : null}
          </View>
          <View style={styles.card}>
            <Field label="Category" value={displayName(exercise.category)} />
            <Field label="Training type" value={exercise.trainingType} />
            <Field label="Pattern" value={displayName(exercise.pattern)} />
            <Field label="Muscles" value={muscleList(exercise.muscles)} />
            <Field
              label="Uses body weight"
              value={exercise.usesBodyweight ? 'Yes · added load is typed' : 'No'}
            />
          </View>
          {exercise.isCustom ? null : (
            <Text variant="small">Exercises installed with the app are read-only.</Text>
          )}
        </View>
      ) : (
        <Text style={styles.body}>This exercise no longer exists.</Text>
      )}
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
