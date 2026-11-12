// Logging sessions (spec section 4). A session starts as a draft; only one draft exists in the
// whole app. "Last time" reads finished sessions only (PR #21, decision 5).
import { and, asc, count, desc, eq, max } from 'drizzle-orm';

import { fullName } from '../domain/clients';
import { bodyWeightOn } from '../domain/bodyweight';
import { nextSetNo, type SetValue } from '../domain/sets';
import { listWeights } from './measurements';
import { clients, exercises, oneRepMaxes, sessionExercises, sessions, sets } from './schema';
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
  finishedAt: string | null;
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
  finishedAt: sessionExercises.finishedAt,
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

export type SetRow = { id: string; setNo: number; weightKg: number | null; reps: number | null };

export function listSets(db: DbOrTx, sessionExerciseId: string): SetRow[] {
  return db
    .select({ id: sets.id, setNo: sets.setNo, weightKg: sets.weightKg, reps: sets.reps })
    .from(sets)
    .where(eq(sets.sessionExerciseId, sessionExerciseId))
    .orderBy(asc(sets.setNo))
    .all();
}

/** The screen validates input; this guards the rules (spec section 5, "Errors") at the source. */
function checkSet(v: SetValue) {
  if (v.weightKg !== null && !(v.weightKg >= 0)) throw new Error('Weight must be 0 or more');
  if (v.reps !== null && !(Number.isInteger(v.reps) && v.reps >= 1))
    throw new Error('Reps must be a whole number, 1 or more');
}

/** The draft is saved after every set: each change also touches the session and the exercise. */
function touch(db: DbOrTx, sessionExerciseId: string, now: string) {
  const se = db
    .select({ sessionId: sessionExercises.sessionId })
    .from(sessionExercises)
    .where(eq(sessionExercises.id, sessionExerciseId))
    .get();
  if (!se) throw new Error('Session exercise not found');
  // A change to a finished exercise reopens it (spec section 4, step 5).
  db.update(sessionExercises)
    .set({ finishedAt: null, updatedAt: now })
    .where(eq(sessionExercises.id, sessionExerciseId))
    .run();
  db.update(sessions).set({ updatedAt: now }).where(eq(sessions.id, se.sessionId)).run();
}

/** Adds a set with the next number (1, 3, 4 → 5). Blank values are saved as NULL. */
export function addSet(db: DbOrTx, sessionExerciseId: string, v: SetValue): string {
  checkSet(v);
  const now = nowIso();
  touch(db, sessionExerciseId, now);
  const id = newId();
  const setNo = nextSetNo(listSets(db, sessionExerciseId).map((x) => x.setNo));
  db.insert(sets)
    .values({
      id,
      sessionExerciseId,
      setNo,
      weightKg: v.weightKg,
      reps: v.reps,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function setOwner(db: DbOrTx, setId: string): string {
  const row = db
    .select({ seId: sets.sessionExerciseId })
    .from(sets)
    .where(eq(sets.id, setId))
    .get();
  if (!row) throw new Error('Set not found');
  return row.seId;
}

export function updateSet(db: DbOrTx, setId: string, v: SetValue): void {
  checkSet(v);
  const now = nowIso();
  touch(db, setOwner(db, setId), now);
  db.update(sets)
    .set({ weightKg: v.weightKg, reps: v.reps, updatedAt: now })
    .where(eq(sets.id, setId))
    .run();
}

/** Removes the set; the others keep their numbers. */
export function deleteSet(db: DbOrTx, setId: string): void {
  touch(db, setOwner(db, setId), nowIso());
  db.delete(sets).where(eq(sets.id, setId)).run();
}

export function finishExercise(db: DbOrTx, sessionExerciseId: string): void {
  const now = nowIso();
  db.update(sessionExercises)
    .set({ finishedAt: now, updatedAt: now })
    .where(eq(sessionExercises.id, sessionExerciseId))
    .run();
}

export function reopenExercise(db: DbOrTx, sessionExerciseId: string): void {
  db.update(sessionExercises)
    .set({ finishedAt: null, updatedAt: nowIso() })
    .where(eq(sessionExercises.id, sessionExerciseId))
    .run();
}

export type OneRepMax = { valueKg: number; source: 'estimated' | 'manual'; createdAt: string };

/** The current 1RM: the newest one_rep_maxes row by created_at (spec section 6). */
export function currentOneRepMax(
  db: DbOrTx,
  clientId: string,
  exerciseId: string,
): OneRepMax | null {
  return (
    db
      .select({
        valueKg: oneRepMaxes.valueKg,
        source: oneRepMaxes.source,
        createdAt: oneRepMaxes.createdAt,
      })
      .from(oneRepMaxes)
      .where(and(eq(oneRepMaxes.clientId, clientId), eq(oneRepMaxes.exerciseId, exerciseId)))
      .orderBy(desc(oneRepMaxes.createdAt))
      .limit(1)
      .get() ?? null
  );
}

export type ExerciseScreenData = {
  sessionId: string;
  clientId: string;
  date: string;
  finished: boolean;
  exercise: { id: string; nameEn: string; namePl: string | null; usesBodyweight: boolean };
  sets: SetRow[];
  oneRepMax: OneRepMax | null;
  /** The client's body weight on the session date. */
  bodyWeight: { valueKg: number; date: string } | null;
  lastTime: SetValue[] | null;
};

/** Everything the exercise screen shows, in one read. */
export function exerciseScreenData(
  db: DbOrTx,
  sessionExerciseId: string,
): ExerciseScreenData | null {
  const item = getSessionExercise(db, sessionExerciseId);
  if (!item) return null;
  const session = getSession(db, item.sessionId);
  if (!session) return null;
  return {
    sessionId: session.id,
    clientId: session.clientId,
    date: session.date,
    finished: item.finishedAt !== null,
    exercise: {
      id: item.exerciseId,
      nameEn: item.nameEn,
      namePl: item.namePl,
      usesBodyweight: item.usesBodyweight,
    },
    sets: listSets(db, sessionExerciseId),
    oneRepMax: currentOneRepMax(db, session.clientId, item.exerciseId),
    bodyWeight: bodyWeightOn(listWeights(db, session.clientId), session.date),
    lastTime: lastTimeSets(db, session.clientId, item.exerciseId),
  };
}
