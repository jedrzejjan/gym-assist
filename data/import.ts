// The one-time import of the old tool's history into "Me" (spec section 6, Import; GYM-25,
// Sprint 2 plan decision 9). The screen checks the file with validateImport first and runs this
// inside one mutate, so it is all or nothing and the automatic export follows.
import { and, eq, inArray } from 'drizzle-orm';

import { foldImportName, type ImportRow } from '../domain/importRows';
import { getSelf } from './clients';
import { exercises, sessionExercises, sessions, sets } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

/** The import goes to "Me" only; without one, the screen first opens Create my profile. */
export class NoSelfError extends Error {
  constructor() {
    super('There is no "Me" profile to import into');
    this.name = 'NoSelfError';
  }
}

/** "Me" already has a session on these dates: importing again would double the history. */
export class DatesTakenError extends Error {
  constructor(readonly dates: string[]) {
    super(`"Me" already has sessions on ${dates.join(', ')}`);
    this.name = 'DatesTakenError';
  }
}

/**
 * One finished session per date for "Me". Exercises follow their first appearance that day;
 * sets keep set_no, side and every column. For a bodyweight exercise the weight is the added
 * load, as in the old tool. Each session gets a finish time (noon UTC on its date), so "Last
 * time" and History order it like any other.
 */
export function importHistory(db: DbOrTx, rows: ImportRow[]): { sessions: number } {
  const me = getSelf(db);
  if (!me) throw new NoSelfError();

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const taken = db
    .select({ date: sessions.date })
    .from(sessions)
    .where(and(eq(sessions.clientId, me.id), inArray(sessions.date, dates)))
    .all()
    .map((s) => s.date);
  if (taken.length > 0) throw new DatesTakenError([...new Set(taken)].sort());

  const idOf = new Map(
    db
      .select({ id: exercises.id, nameEn: exercises.nameEn })
      .from(exercises)
      .all()
      .map((e) => [foldImportName(e.nameEn), e.id]),
  );
  const now = nowIso();

  for (const date of dates) {
    const sessionId = newId();
    const at = `${date}T12:00:00.000Z`;
    db.insert(sessions)
      .values({
        id: sessionId,
        clientId: me.id,
        date,
        status: 'finished',
        startedAt: at,
        finishedAt: at,
        updatedAt: now,
      })
      .run();

    const seIds = new Map<string, string>();
    for (const r of rows.filter((x) => x.date === date)) {
      const exerciseId = idOf.get(foldImportName(r.exerciseEn));
      if (!exerciseId) throw new Error(`Unknown exercise ${r.exerciseEn}`); // validated before
      let seId = seIds.get(exerciseId);
      if (!seId) {
        seId = newId();
        seIds.set(exerciseId, seId);
        db.insert(sessionExercises)
          .values({
            id: seId,
            sessionId,
            exerciseId,
            position: seIds.size,
            finishedAt: at,
            updatedAt: now,
          })
          .run();
      }
      db.insert(sets)
        .values({
          id: newId(),
          sessionExerciseId: seId,
          setNo: r.setNo,
          weightKg: r.weightKg,
          reps: r.reps,
          side: r.side,
          heightCm: r.heightCm,
          speedKmh: r.speedKmh,
          minutes: r.minutes,
          note: r.note,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
  return { sessions: dates.length };
}
