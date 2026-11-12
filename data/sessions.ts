// Logging sessions (spec section 4). A session starts as a draft; only one draft exists in the
// whole app. "Last time" reads finished sessions only (PR #21, decision 5).
import { and, asc, count, desc, eq, max } from 'drizzle-orm';

import { fullName } from '../domain/clients';
import type { SetValue } from '../domain/sets';
import { clients, exercises, sessionExercises, sessions, sets } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

/** Spec section 4, "One draft at a time". GYM-21 shows the dialogs; this is the rule itself. */
export class DraftExistsError extends Error {
  constructor() {
    super('Another session is in progress');
    this.name = 'DraftExistsError';
  }
}

export type SessionInfo = {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  status: 'draft' | 'finished';
};

export type DraftInfo = {
  sessionId: string;
  clientId: string;
  clientName: string;
  exerciseCount: number;
};

export type SessionExerciseItem = {
  id: string;
  sessionId: string;
  exerciseId: string;
  position: number;
  nameEn: string;
  namePl: string | null;
  usesBodyweight: boolean;
};

export function getSession(db: DbOrTx, id: string): SessionInfo | null {
  const row = db
    .select({
      id: sessions.id,
      clientId: sessions.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      date: sessions.date,
      status: sessions.status,
    })
    .from(sessions)
    .innerJoin(clients, eq(clients.id, sessions.clientId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;
  const { firstName, lastName, ...rest } = row;
  return { ...rest, clientName: fullName(firstName, lastName) };
}

export function getDraft(db: DbOrTx): DraftInfo | null {
  const draft = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.status, 'draft'))
    .get();
  if (!draft) return null;
  const s = getSession(db, draft.id)!;
  const n = db
    .select({ n: count() })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, s.id))
    .get()!.n;
  return { sessionId: s.id, clientId: s.clientId, clientName: s.clientName, exerciseCount: n };
}

/** Starts a draft session. Throws DraftExistsError if any draft exists, for any client. */
export function startSession(db: DbOrTx, clientId: string, date: string): string {
  if (getDraft(db)) throw new DraftExistsError();
  const id = newId();
  const now = nowIso();
  db.insert(sessions)
    .values({ id, clientId, date, status: 'draft', startedAt: now, updatedAt: now })
    .run();
  return id;
}

/** Adds an exercise at the end of the session's list; returns the session-exercise id. */
export function addExerciseToSession(db: DbOrTx, sessionId: string, exerciseId: string): string {
  const last = db
    .select({ p: max(sessionExercises.position) })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId))
    .get();
  const id = newId();
  const now = nowIso();
  db.insert(sessionExercises)
    .values({ id, sessionId, exerciseId, position: (last?.p ?? 0) + 1, updatedAt: now })
    .run();
  db.update(sessions).set({ updatedAt: now }).where(eq(sessions.id, sessionId)).run();
  return id;
}

const itemColumns = {
  id: sessionExercises.id,
  sessionId: sessionExercises.sessionId,
  exerciseId: sessionExercises.exerciseId,
  position: sessionExercises.position,
  nameEn: exercises.nameEn,
  namePl: exercises.namePl,
  usesBodyweight: exercises.usesBodyweight,
};

export function listSessionExercises(db: DbOrTx, sessionId: string): SessionExerciseItem[] {
  return db
    .select(itemColumns)
    .from(sessionExercises)
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(asc(sessionExercises.position))
    .all();
}

export function getSessionExercise(db: DbOrTx, id: string): SessionExerciseItem | null {
  return (
    db
      .select(itemColumns)
      .from(sessionExercises)
      .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
      .where(eq(sessionExercises.id, id))
      .get() ?? null
  );
}

/**
 * The client's sets for this exercise from their latest finished session that had it (by date,
 * then finish time), in set order. null when there is no such session; [] when it had no sets.
 * Drafts (including the session being logged) and other clients never count.
 */
export function lastTimeSets(db: DbOrTx, clientId: string, exerciseId: string): SetValue[] | null {
  const latest = db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
    .where(
      and(
        eq(sessions.clientId, clientId),
        eq(sessions.status, 'finished'),
        eq(sessionExercises.exerciseId, exerciseId),
      ),
    )
    .orderBy(desc(sessions.date), desc(sessions.finishedAt), asc(sessionExercises.position))
    .limit(1)
    .get();
  if (!latest) return null;
  return db
    .select({ weightKg: sets.weightKg, reps: sets.reps })
    .from(sets)
    .where(eq(sets.sessionExerciseId, latest.id))
    .orderBy(asc(sets.setNo))
    .all();
}
