// What a client trained, as input for domain/recovery.ts (Sprint 2 plan, Task 4, decision 5).
import { and, eq, exists, inArray } from 'drizzle-orm';

import type { Muscle, Pattern } from '../domain/catalogue';
import type { Trained } from '../domain/recovery';
import { exerciseMuscles, exercises, sessionExercises, sessions, sets } from './schema';
import type { DbOrTx } from './types';

/**
 * One row per session exercise with at least one set, in the client's finished sessions: the
 * session date, the exercise's pattern and its muscles. A draft never counts. Two queries in
 * all, however long the history is.
 */
export function trainedFor(db: DbOrTx, clientId: string): Trained[] {
  const rows = db
    .select({ date: sessions.date, exerciseId: exercises.id, pattern: exercises.pattern })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(
      and(
        eq(sessions.clientId, clientId),
        eq(sessions.status, 'finished'),
        exists(
          db
            .select({ id: sets.id })
            .from(sets)
            .where(eq(sets.sessionExerciseId, sessionExercises.id)),
        ),
      ),
    )
    .all();
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.exerciseId))];
  const musclesOf = new Map<string, Muscle[]>();
  for (const m of db
    .select({ exerciseId: exerciseMuscles.exerciseId, muscle: exerciseMuscles.muscle })
    .from(exerciseMuscles)
    .where(inArray(exerciseMuscles.exerciseId, ids))
    .all()) {
    musclesOf.set(m.exerciseId, [...(musclesOf.get(m.exerciseId) ?? []), m.muscle as Muscle]);
  }
  return rows.map((r) => ({
    date: r.date,
    pattern: r.pattern as Pattern,
    muscles: musclesOf.get(r.exerciseId) ?? [],
  }));
}
