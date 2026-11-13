// A client's workout history (spec section 4, "Editing a finished session"; plan Task 2).
// Only finished sessions count: a draft is never listed.
import { and, count, countDistinct, desc, eq, inArray } from 'drizzle-orm';

import type { SetValue } from '../domain/sets';
import { sessionExercises, sessions, sets } from './schema';
import { getSession, listSessionExercises, listSets } from './sessions';
import type { DbOrTx } from './types';

export type HistoryRow = {
  sessionId: string;
  date: string;
  exerciseCount: number;
  setCount: number;
};

/**
 * The client's finished sessions, newest date first, then the one finished later. One query
 * with the counts, so a long history doesn't cost a query per row.
 */
export function listHistory(db: DbOrTx, clientId: string): HistoryRow[] {
  return db
    .select({
      sessionId: sessions.id,
      date: sessions.date,
      exerciseCount: countDistinct(sessionExercises.id),
      setCount: count(sets.id),
    })
    .from(sessions)
    .leftJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(and(eq(sessions.clientId, clientId), eq(sessions.status, 'finished')))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.date), desc(sessions.finishedAt))
    .all();
}

export type SessionSummary = {
  date: string;
  clientId: string;
  status: 'draft' | 'finished';
  exercises: { nameEn: string; namePl: string | null; usesBodyweight: boolean; sets: SetValue[] }[];
};

/** One session for the read-only summary: exercises by position, sets by set number. */
export function sessionSummary(db: DbOrTx, sessionId: string): SessionSummary | null {
  const session = getSession(db, sessionId);
  if (!session) return null;
  return {
    date: session.date,
    clientId: session.clientId,
    status: session.status,
    exercises: listSessionExercises(db, sessionId).map((e) => ({
      nameEn: e.nameEn,
      namePl: e.namePl,
      usesBodyweight: e.usesBodyweight,
      sets: listSets(db, e.id).map(({ weightKg, reps }) => ({ weightKg, reps })),
    })),
  };
}

/**
 * "Delete session" on a finished session: the session, its exercises and their sets. A draft is
 * refused here; it has its own "Cancel session" (discardSession).
 */
export function deleteSession(db: DbOrTx, sessionId: string): void {
  const session = getSession(db, sessionId);
  if (!session || session.status !== 'finished') {
    throw new Error('Only a finished session can be deleted');
  }
  const ids = listSessionExercises(db, sessionId).map((e) => e.id);
  if (ids.length > 0) {
    db.delete(sets).where(inArray(sets.sessionExerciseId, ids)).run();
    db.delete(sessionExercises).where(inArray(sessionExercises.id, ids)).run();
  }
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
