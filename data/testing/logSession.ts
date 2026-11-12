import { sessionExercises, sessions, sets } from '../schema';
import type { Db } from '../types';

let n = 0;

/**
 * Test helper: writes a logged session with one exercise and its sets straight to the tables
 * (set entry in the app arrives with GYM-20). Returns the session id.
 */
export function logSession(
  db: Db,
  o: {
    clientId: string;
    date: string;
    exerciseId: string;
    sets: [number | null, number | null][];
    status?: 'draft' | 'finished';
    finishedAt?: string;
  },
): string {
  n += 1;
  const sid = `logged-session-${n}`;
  const seId = `logged-se-${n}`;
  const status = o.status ?? 'finished';
  const t = '2026-11-01T10:00:00.000Z';
  db.insert(sessions)
    .values({
      id: sid,
      clientId: o.clientId,
      date: o.date,
      status,
      startedAt: t,
      finishedAt: status === 'finished' ? (o.finishedAt ?? `${o.date}T12:00:00.000Z`) : null,
      updatedAt: t,
    })
    .run();
  db.insert(sessionExercises)
    .values({ id: seId, sessionId: sid, exerciseId: o.exerciseId, position: 1, updatedAt: t })
    .run();
  o.sets.forEach(([weightKg, reps], i) =>
    db
      .insert(sets)
      .values({
        id: `${seId}-${i}`,
        sessionExerciseId: seId,
        setNo: i + 1,
        weightKg,
        reps,
        createdAt: t,
        updatedAt: t,
      })
      .run(),
  );
  return sid;
}
