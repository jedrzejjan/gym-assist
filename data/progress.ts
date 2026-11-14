// Progress (spec section 5, progress.ts; Sprint 2 plan, Task 5, decision 6): the stored 1RM, the
// best set per exercise, and the body-weight trend. This file never imports data/sessions.ts:
// sessions.ts imports the 1RM from here.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { bodyWeightOn } from '../domain/bodyweight';
import { bestSet, type ComparableSet, e1rm, planEstimateAll } from '../domain/progress';
import { listWeights, type WeightRow } from './measurements';
import { exercises, oneRepMaxes, sessionExercises, sessions, sets } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

export type OneRepMax = { valueKg: number; source: 'estimated' | 'manual'; createdAt: string };

/**
 * The current 1RM: the newest one_rep_maxes row by created_at (spec section 6). Two rows saved in
 * the same millisecond are told apart by insertion order (SQLite's rowid), so the last one wins.
 */
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
      .orderBy(desc(oneRepMaxes.createdAt), desc(sql`rowid`))
      .limit(1)
      .get() ?? null
  );
}

/**
 * Stores a 1RM set on purpose ("Estimate" or "Set manually"). A new row each time, so the history
 * is kept; the newest one is current. For a bodyweight exercise the value is the total load.
 */
export function setOneRepMax(
  db: DbOrTx,
  clientId: string,
  exerciseId: string,
  valueKg: number,
  source: 'estimated' | 'manual',
): void {
  if (!(valueKg > 0)) throw new Error('A 1RM must be more than 0 kg');
  const now = nowIso();
  db.insert(oneRepMaxes)
    .values({ id: newId(), clientId, exerciseId, valueKg, source, createdAt: now, updatedAt: now })
    .run();
}

/**
 * "Estimate all 1RMs" (GYM-134): one estimated row for each exercise the plan sets or updates.
 * It reads the list again here, so it acts on the data as it is when the write runs. The screen
 * calls it inside one `mutate`, so it is all or nothing.
 */
export function estimateAll(db: DbOrTx, clientId: string): { set: number; updated: number } {
  const plan = planEstimateAll(strengthList(db, clientId));
  for (const { exerciseId, valueKg } of [...plan.set, ...plan.update]) {
    setOneRepMax(db, clientId, exerciseId, valueKg, 'estimated');
  }
  return { set: plan.set.length, updated: plan.update.length };
}

export type StrengthItem = {
  exerciseId: string;
  nameEn: string;
  namePl: string | null;
  usesBodyweight: boolean;
  oneRepMax: OneRepMax | null;
  best: (ComparableSet & { e1rmKg: number }) | null;
};

/**
 * The Strength list: every exercise the client did in a finished session, most recently trained
 * first, then those with only a stored 1RM, by name. Each has its current 1RM and best set. For a
 * bodyweight exercise the load is the body weight on the session date plus the added load (a
 * blank added load counts as 0). A fixed number of queries, however long the history is.
 */
export function strengthList(db: DbOrTx, clientId: string): StrengthItem[] {
  const logged = db
    .select({
      exerciseId: exercises.id,
      nameEn: exercises.nameEn,
      namePl: exercises.namePl,
      usesBodyweight: exercises.usesBodyweight,
      date: sessions.date,
      weightKg: sets.weightKg,
      reps: sets.reps,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sessionExercises.id, sets.sessionExerciseId))
    .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(and(eq(sessions.clientId, clientId), eq(sessions.status, 'finished')))
    .all();

  const stored = db
    .select({ exerciseId: oneRepMaxes.exerciseId })
    .from(oneRepMaxes)
    .where(eq(oneRepMaxes.clientId, clientId))
    .groupBy(oneRepMaxes.exerciseId)
    .all()
    .map((r) => r.exerciseId);
  const onlyStored = stored.filter((id) => !logged.some((r) => r.exerciseId === id));
  const storedInfo =
    onlyStored.length === 0
      ? []
      : db
          .select({
            exerciseId: exercises.id,
            nameEn: exercises.nameEn,
            namePl: exercises.namePl,
            usesBodyweight: exercises.usesBodyweight,
          })
          .from(exercises)
          .where(inArray(exercises.id, onlyStored))
          .all();

  const weights = listWeights(db, clientId);
  type Group = Omit<StrengthItem, 'oneRepMax' | 'best'> & { last: string; sets: ComparableSet[] };
  const groups = new Map<string, Group>();
  for (const r of logged) {
    const g = groups.get(r.exerciseId) ?? {
      exerciseId: r.exerciseId,
      nameEn: r.nameEn,
      namePl: r.namePl,
      usesBodyweight: r.usesBodyweight,
      last: r.date,
      sets: [],
    };
    if (r.date > g.last) g.last = r.date;
    const bw = r.usesBodyweight ? bodyWeightOn(weights, r.date) : null;
    const loadKg = r.usesBodyweight
      ? bw === null
        ? null
        : bw.valueKg + (r.weightKg ?? 0)
      : r.weightKg;
    if (loadKg !== null && r.reps !== null) {
      g.sets.push({
        loadKg,
        reps: r.reps,
        date: r.date,
        shown: { weightKg: r.weightKg, reps: r.reps },
      });
    }
    groups.set(r.exerciseId, g);
  }

  const trained = [...groups.values()].sort(
    (a, b) => b.last.localeCompare(a.last) || a.nameEn.localeCompare(b.nameEn, 'en'),
  );
  const items: StrengthItem[] = trained.map(({ last: _last, sets: groupSets, ...info }) => {
    const best = bestSet(groupSets);
    return {
      ...info,
      oneRepMax: currentOneRepMax(db, clientId, info.exerciseId),
      best: best ? { ...best, e1rmKg: e1rm(best.loadKg, best.reps) } : null,
    };
  });
  const rest = [...storedInfo]
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
    .map((info) => ({
      ...info,
      oneRepMax: currentOneRepMax(db, clientId, info.exerciseId),
      best: null,
    }));
  return [...items, ...rest];
}

export type BodyProgress = {
  latest: WeightRow;
  /** Latest minus the earliest entry; null with a single entry. */
  changeKg: number | null;
  /** The earliest entry's date; null with a single entry. */
  since: string | null;
  /** Newest first. */
  entries: WeightRow[];
};

/** The Body view. Every client has at least one weight (adding a client needs one). */
export function bodyProgress(db: DbOrTx, clientId: string): BodyProgress | null {
  const entries = listWeights(db, clientId);
  if (entries.length === 0) return null;
  const latest = entries[0];
  const earliest = entries[entries.length - 1];
  const single = entries.length === 1;
  return {
    latest,
    changeKg: single ? null : latest.valueKg - earliest.valueKg,
    since: single ? null : earliest.date,
    entries,
  };
}
