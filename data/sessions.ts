// Logging sessions (spec section 4). A session starts as a draft; only one draft exists in the
// whole app. "Last time" reads finished sessions only (PR #21, decision 5).
import { and, asc, count, desc, eq, inArray, isNull, lt, max, ne, or, sql } from 'drizzle-orm';

import { fullName } from '../domain/clients';
import { isValidDate } from '../domain/dates';
import { bodyWeightOn } from '../domain/bodyweight';
import { nextSetNo, type SetValue } from '../domain/sets';
import { listWeights } from './measurements';
import { currentOneRepMax, type OneRepMax } from './progress';
import { clients, exercises, sessionExercises, sessions, sets } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

/** Spec section 4, "One draft at a time". GYM-21 shows the dialogs; this is the rule itself. */
export class DraftExistsError extends Error {
  constructor() {
    super('Another session is in progress');
    this.name = 'DraftExistsError';
  }
}

/** "Finish session" needs at least one exercise (spec section 4). */
export class NoExercisesError extends Error {
  constructor() {
    super('A session needs at least one exercise to be finished');
    this.name = 'NoExercisesError';
  }
}

/** A finished session needs at least one exercise (spec section 4, "Editing a finished session"). */
export class LastExerciseError extends Error {
  constructor() {
    super('A finished session needs at least one exercise');
    this.name = 'LastExerciseError';
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
  setCount: number;
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

/**
 * The mutate options for a write to this session (GYM-26): a draft changes no finished data, so
 * it doesn't trigger the automatic export; a finished session being edited does.
 */
export function sessionWriteOptions(db: DbOrTx, sessionId: string): { export: boolean } {
  return { export: getSession(db, sessionId)?.status === 'finished' };
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
  // Explicit table names: Drizzle renders a column inside sql`` without its table.
  setCount: sql<number>`(select count(*) from "sets" where "sets"."session_exercise_id" = "session_exercises"."id")`,
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

/** The session being edited: "Last time" then looks only at sessions before it. */
export type Before = { sessionId: string; date: string; finishedAt: string | null };

/**
 * The client's sets for this exercise from their latest finished session that had it (by date,
 * then finish time), in set order. null when there is no such session; [] when it had no sets.
 * Drafts (including the session being logged) and other clients never count. With `before`
 * (editing a finished session), that session and any later one are ignored.
 */
export function lastTimeSets(
  db: DbOrTx,
  clientId: string,
  exerciseId: string,
  opts: { before?: Before } = {},
): SetValue[] | null {
  const { before } = opts;
  const latest = db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
    .where(
      and(
        eq(sessions.clientId, clientId),
        eq(sessions.status, 'finished'),
        eq(sessionExercises.exerciseId, exerciseId),
        before ? ne(sessions.id, before.sessionId) : undefined,
        before
          ? or(
              lt(sessions.date, before.date),
              and(eq(sessions.date, before.date), lt(sessions.finishedAt, before.finishedAt ?? '')),
            )
          : undefined,
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

/** Every set is saved at once: each change also touches the session and the exercise. */
function touch(db: DbOrTx, sessionExerciseId: string, now: string) {
  const se = db
    .select({ sessionId: sessionExercises.sessionId, status: sessions.status })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
    .where(eq(sessionExercises.id, sessionExerciseId))
    .get();
  if (!se) throw new Error('Session exercise not found');
  // In a draft, a change to a finished exercise reopens it (spec section 4, step 5). A finished
  // session has no open exercises to resume, so its exercises stay as they are (decision 4).
  db.update(sessionExercises)
    .set(se.status === 'draft' ? { finishedAt: null, updatedAt: now } : { updatedAt: now })
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
  touch(db, sessionExerciseId, now);
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

export type ExerciseScreenData = {
  sessionId: string;
  clientId: string;
  date: string;
  /** The session is finished: the page edits it ("Done" instead of "Finish exercise"). */
  sessionFinished: boolean;
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
  const before: Before | undefined =
    session.status === 'finished'
      ? { sessionId: session.id, date: session.date, finishedAt: finishedAtOf(db, session.id) }
      : undefined;
  return {
    sessionId: session.id,
    clientId: session.clientId,
    date: session.date,
    sessionFinished: session.status === 'finished',
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
    lastTime: lastTimeSets(db, session.clientId, item.exerciseId, { before }),
  };
}

function finishedAtOf(db: DbOrTx, sessionId: string): string | null {
  return (
    db.select({ f: sessions.finishedAt }).from(sessions).where(eq(sessions.id, sessionId)).get()
      ?.f ?? null
  );
}

/** The date of a session being edited. Refuses an invalid date or one after today. */
export function updateSessionDate(
  db: DbOrTx,
  sessionId: string,
  date: string,
  today: string,
): void {
  if (!isValidDate(date)) throw new Error(`Not a valid date: ${date}`);
  if (date > today) throw new Error('A session date cannot be in the future');
  db.update(sessions).set({ date, updatedAt: nowIso() }).where(eq(sessions.id, sessionId)).run();
}

/** Saves the draft as finished. From now on it counts for "Last time" and history. */
export function finishSession(db: DbOrTx, sessionId: string): void {
  const session = getSession(db, sessionId);
  // Finishing again would move finished_at and change the "Last time" order.
  if (!session || session.status !== 'draft') throw new Error('Only a draft can be finished');
  if (listSessionExercises(db, sessionId).length === 0) throw new NoExercisesError();
  const now = nowIso();
  db.update(sessions)
    .set({ status: 'finished', finishedAt: now, updatedAt: now })
    .where(eq(sessions.id, sessionId))
    .run();
}

/** "Discard this session?": deletes a draft with its exercises and sets. */
export function discardSession(db: DbOrTx, sessionId: string): void {
  const session = getSession(db, sessionId);
  if (!session) return;
  if (session.status !== 'draft') throw new Error('Only a draft can be discarded');
  const ids = listSessionExercises(db, sessionId).map((e) => e.id);
  if (ids.length > 0) {
    db.delete(sets).where(inArray(sets.sessionExerciseId, ids)).run();
    db.delete(sessionExercises).where(inArray(sessionExercises.id, ids)).run();
  }
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

/** Swaps the exercise with its neighbour in the list (not position ± 1: removals leave gaps). */
export function moveExercise(db: DbOrTx, sessionExerciseId: string, dir: 'up' | 'down'): void {
  const item = getSessionExercise(db, sessionExerciseId);
  if (!item) return;
  const list = listSessionExercises(db, item.sessionId);
  const i = list.findIndex((e) => e.id === sessionExerciseId);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return; // the ends do nothing
  const now = nowIso();
  const swap = (id: string, position: number) =>
    db
      .update(sessionExercises)
      .set({ position, updatedAt: now })
      .where(eq(sessionExercises.id, id))
      .run();
  swap(list[i].id, list[j].position);
  swap(list[j].id, list[i].position);
  db.update(sessions).set({ updatedAt: now }).where(eq(sessions.id, item.sessionId)).run();
}

/**
 * "Remove this exercise and its sets?" A finished session keeps at least one exercise: removing
 * the last one throws LastExerciseError, and the screen offers to delete the session instead.
 */
export function removeExercise(db: DbOrTx, sessionExerciseId: string): void {
  const item = getSessionExercise(db, sessionExerciseId);
  if (!item) return;
  const session = getSession(db, item.sessionId);
  if (session?.status === 'finished' && listSessionExercises(db, item.sessionId).length <= 1) {
    throw new LastExerciseError();
  }
  db.delete(sets).where(eq(sets.sessionExerciseId, sessionExerciseId)).run();
  db.delete(sessionExercises).where(eq(sessionExercises.id, sessionExerciseId)).run();
  db.update(sessions).set({ updatedAt: nowIso() }).where(eq(sessions.id, item.sessionId)).run();
}

export type ResumePoint = { screen: 'exercise'; seId: string } | { screen: 'session' };

/**
 * Where the "Session in progress" bar opens the draft: the first exercise that is still open
 * (no finished_at; a set change reopens a finished one), otherwise the session page.
 */
export function resumePoint(db: DbOrTx, sessionId: string): ResumePoint {
  const open = db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .where(and(eq(sessionExercises.sessionId, sessionId), isNull(sessionExercises.finishedAt)))
    .orderBy(asc(sessionExercises.position))
    .limit(1)
    .get();
  return open ? { screen: 'exercise', seId: open.id } : { screen: 'session' };
}
