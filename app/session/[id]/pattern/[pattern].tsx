import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';

import { listExercises } from '../../../../data/exercises';
import { mutate, useDb, useLive } from '../../../../data/live';
import { addExerciseToSession, sessionWriteOptions } from '../../../../data/sessions';
import { displayName, type Pattern } from '../../../../domain/catalogue';
import { AppBar } from '../../../../ui/AppBar';
import { ListRow } from '../../../../ui/ListRow';
import { Screen } from '../../../../ui/Screen';

/** Board `log/choose - pattern exercises`: tap an exercise to add it to the session. */
export default function PatternExercises() {
  const db = useDb();
  const { id, pattern } = useLocalSearchParams<{ id: string; pattern: Pattern }>();
  const exercises = useLive((d) => listExercises(d, { pattern }), [pattern]);
  const choosing = useRef(false); // a double tap must not add the exercise twice

  const choose = (exerciseId: string) => {
    if (choosing.current) return;
    choosing.current = true;
    let seId: string;
    try {
      seId = mutate(
        db,
        (tx) => addExerciseToSession(tx, id, exerciseId),
        sessionWriteOptions(db, id),
      );
    } catch (e) {
      choosing.current = false; // let the trainer try again
      throw e;
    }
    // Leave the choose pages behind: back from the exercise returns to the session page.
    router.dismissTo(`/session/${id}`);
    router.push(`/session/${id}/exercise/${seId}`);
  };

  return (
    <Screen
      header={
        <AppBar
          title={displayName(pattern)}
          back={{ label: '‹ Patterns', onPress: () => router.back() }}
        />
      }
    >
      {exercises.map((e) => (
        <ListRow
          key={e.id}
          title={e.nameEn}
          subtitle={e.namePl ?? undefined}
          onPress={() => choose(e.id)}
        />
      ))}
    </Screen>
  );
}
