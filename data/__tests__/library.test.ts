/**
 * @jest-environment node
 */
// The one-time library upgrade on a phone that ran the v1 app (GYM-149): exercises are mapped by
// name or alias and keep their ids; unmatched ones go with their history; the rest is inserted.
import { sql } from 'drizzle-orm';

import { createClient } from '../clients';
import { countExercises } from '../exercises';
import { syncLibrary } from '../library';
import { currentOneRepMax, setOneRepMax } from '../progress';
import { SEED_EXERCISES, SEED_VERSION } from '../seed/exercises';
import { getSetting } from '../settings';
import { V1_EXERCISES } from '../testing/exercisesV1';
import { logSession } from '../testing/logSession';
import { createTestDb, createTestDbAt } from '../testing/testDb';
import type { Db } from '../types';

const T = '2026-11-01T10:00:00.000Z';

function insertV1(db: Db, id: string, e: (typeof V1_EXERCISES)[number], isCustom = false) {
  db.run(
    sql`INSERT INTO exercises (id, name_en, name_pl, category, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
        VALUES (${id}, ${e.nameEn}, ${e.namePl}, ${e.category}, ${e.trainingType}, ${e.pattern}, ${e.usesBodyweight ? 1 : 0}, ${isCustom ? 1 : 0}, ${T}, ${T})`,
  );
  for (const m of e.muscles) {
    db.run(
      sql`INSERT INTO exercise_muscles (exercise_id, muscle, updated_at) VALUES (${id}, ${m}, ${T})`,
    );
  }
}

const custom = (nameEn: string) => ({
  nameEn,
  namePl: nameEn,
  category: 'Core',
  trainingType: 'Strength',
  pattern: 'none',
  usesBodyweight: false,
  muscles: ['core'],
});

const idOf = (name: string) => `v1-${name}`;

/** A phone on the v1 app: the 23 built-in exercises, custom ones, a client with history. */
function v1Phone(customNames: string[] = []) {
  const at = createTestDbAt(1);
  const { db } = at;
  for (const e of V1_EXERCISES) insertV1(db, idOf(e.nameEn), e);
  for (const n of customNames) insertV1(db, idOf(n), custom(n), true);
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63, weightDate: '2026-10-01' });
  return { ...at, anna };
}

const row = (db: Db, id: string) =>
  db.get<Record<string, unknown>>(sql`SELECT * FROM exercises WHERE id = ${id}`);
const count = (db: Db, table: string) =>
  db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table}`))!.n;
const aliases = (db: Db, id: string) =>
  db
    .all<{ alias: string }>(sql`SELECT alias FROM exercise_aliases WHERE exercise_id = ${id}`)
    .map((a) => a.alias);

test('the 22 kept exercises keep their ids, take the library name, and keep the old one as an alias', () => {
  const { db, anna, migrateRest } = v1Phone();
  logSession(db, {
    clientId: anna,
    date: '2026-11-03',
    exerciseId: idOf('Bench press'),
    sets: [[60, 8]],
  });
  setOneRepMax(db, anna, idOf('Bench press'), 80, 'manual');
  migrateRest();

  const result = syncLibrary(db, SEED_EXERCISES);

  expect(result).toMatchObject({ mapped: 22, dropped: 1, inserted: 831 - 22 });
  expect(countExercises(db)).toBe(831);
  // Renamed: the old name stays findable as an alias.
  expect(row(db, idOf('Overhand pull-up'))).toMatchObject({
    name_en: 'Pull-Up',
    pattern: 'Pull',
    subcategory: 'vertical',
    equipment: 'bodyweight',
    is_custom: 0,
  });
  expect(aliases(db, idOf('Overhand pull-up'))).toContain('Overhand pull-up');
  // Same name in another case: not added again as an alias.
  expect(row(db, idOf('Bench press'))).toMatchObject({ name_en: 'Bench Press', pattern: 'Push' });
  expect(aliases(db, idOf('Bench press')).map((a) => a.toLowerCase())).not.toContain('bench press');
  expect(count(db, 'sets')).toBe(1);
  expect(currentOneRepMax(db, anna, idOf('Bench press'))!.valueKg).toBe(80);
  const roles = db.all<{ muscle: string; role: string }>(
    sql`SELECT muscle, role FROM exercise_muscles WHERE exercise_id = ${idOf('Bench press')}`,
  );
  expect(roles).toEqual(expect.arrayContaining([{ muscle: 'chest', role: 'primary' }]));
  expect(roles.filter((r) => r.role === 'secondary')).toHaveLength(2);
  expect(getSetting(db, 'library.version')).toBe(String(SEED_VERSION));
});

test('the hip flexor and an unknown custom exercise go, with their sets, 1RMs and emptied sessions', () => {
  const { db, sqlite, anna, migrateRest } = v1Phone(['My drill']);
  const onlyDrill = logSession(db, {
    clientId: anna,
    date: '2026-11-03',
    exerciseId: idOf('My drill'),
    sets: [[10, 5]],
  });
  const onlyHip = logSession(db, {
    clientId: anna,
    date: '2026-11-04',
    exerciseId: idOf('Hip flexor variation with locked leg'),
    sets: [[null, 10]],
  });
  // A session with the drill and a kept exercise keeps the kept one.
  const mixed = logSession(db, {
    clientId: anna,
    date: '2026-11-05',
    exerciseId: idOf('Back squat'),
    sets: [[80, 5]],
  });
  db.run(
    sql`INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at) VALUES ('mixed-drill', ${mixed}, ${idOf('My drill')}, 2, ${T})`,
  );
  db.run(
    sql`INSERT INTO sets (id, session_exercise_id, set_no, weight_kg, reps, created_at, updated_at) VALUES ('mixed-drill-1', 'mixed-drill', 1, 10, 5, ${T}, ${T})`,
  );
  setOneRepMax(db, anna, idOf('My drill'), 20, 'manual');
  migrateRest();

  const result = syncLibrary(db, SEED_EXERCISES);

  expect(result).toMatchObject({ dropped: 2, sessionsDeleted: 2 });
  expect(row(db, idOf('My drill'))).toBeUndefined();
  expect(row(db, idOf('Hip flexor variation with locked leg'))).toBeUndefined();
  const sessionIds = db.all<{ id: string }>(sql`SELECT id FROM sessions`).map((s) => s.id);
  expect(sessionIds).not.toContain(onlyDrill);
  expect(sessionIds).not.toContain(onlyHip);
  expect(sessionIds).toContain(mixed);
  expect(count(db, 'sets')).toBe(1); // the squat set
  expect(count(db, 'one_rep_maxes')).toBe(0);
  expect(sqlite.pragma('foreign_key_check')).toEqual([]);
});

test('a draft in progress goes only if all its exercises were dropped', () => {
  const { db, anna, migrateRest } = v1Phone(['My drill']);
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const draft = logSession(db, {
    clientId: anna,
    date: '2026-11-06',
    exerciseId: idOf('My drill'),
    sets: [[10, 5]],
    status: 'draft',
  });
  const finished = logSession(db, {
    clientId: jan,
    date: '2026-11-06',
    exerciseId: idOf('Deadlift'),
    sets: [[100, 5]],
  });
  migrateRest();

  syncLibrary(db, SEED_EXERCISES);

  const ids = db.all<{ id: string }>(sql`SELECT id FROM sessions`).map((s) => s.id);
  expect(ids).toEqual([finished]);
  expect(ids).not.toContain(draft);
});

test('a draft that keeps one exercise survives with its sets', () => {
  const { db, anna, migrateRest } = v1Phone(['My drill']);
  const draft = logSession(db, {
    clientId: anna,
    date: '2026-11-06',
    exerciseId: idOf('Back squat'),
    sets: [[80, 5]],
    status: 'draft',
  });
  db.run(
    sql`INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at) VALUES ('d-drill', ${draft}, ${idOf('My drill')}, 2, ${T})`,
  );
  migrateRest();

  syncLibrary(db, SEED_EXERCISES);

  expect(db.get<{ status: string }>(sql`SELECT status FROM sessions WHERE id = ${draft}`)).toEqual({
    status: 'draft',
  });
  expect(count(db, 'sets')).toBe(1);
});

test('a custom exercise that has a library name is mapped, becomes built-in and keeps its history', () => {
  const { db, anna, migrateRest } = v1Phone(['push-up']);
  const sid = logSession(db, {
    clientId: anna,
    date: '2026-11-03',
    exerciseId: idOf('push-up'),
    sets: [[0, 20]],
  });
  setOneRepMax(db, anna, idOf('push-up'), 90, 'manual');
  migrateRest();

  syncLibrary(db, SEED_EXERCISES);

  expect(row(db, idOf('push-up'))).toMatchObject({
    name_en: 'Push-Up',
    is_custom: 0,
    importance: 1,
  });
  expect(countExercises(db)).toBe(831);
  expect(db.get<{ id: string }>(sql`SELECT id FROM sessions WHERE id = ${sid}`)).toBeDefined();
  expect(count(db, 'sets')).toBe(1);
  expect(currentOneRepMax(db, anna, idOf('push-up'))!.valueKg).toBe(90);
});

test('a custom exercise matching the same library exercise as a built-in one merges into it, history kept', () => {
  // v1 allowed both: "Overhand pull-up" (built-in) and "Pull-up" (custom) are different names, but
  // both are names of "Pull-Up" now. The built-in row wins; the custom one's history moves to it.
  const { db, sqlite, anna, migrateRest } = v1Phone(['Pull-up']);
  const onlyCustom = logSession(db, {
    clientId: anna,
    date: '2026-11-03',
    exerciseId: idOf('Pull-up'),
    sets: [[5, 8]],
  });
  logSession(db, {
    clientId: anna,
    date: '2026-11-04',
    exerciseId: idOf('Overhand pull-up'),
    sets: [[0, 10]],
  });
  setOneRepMax(db, anna, idOf('Pull-up'), 95, 'manual');
  migrateRest();

  const result = syncLibrary(db, SEED_EXERCISES);

  expect(result).toMatchObject({ mapped: 22, merged: 1, dropped: 1 }); // dropped: the hip flexor
  expect(row(db, idOf('Pull-up'))).toBeUndefined();
  const pullUp = idOf('Overhand pull-up');
  expect(row(db, pullUp)).toMatchObject({ name_en: 'Pull-Up', is_custom: 0 });
  const moved = db.get<{ exercise_id: string }>(
    sql`SELECT exercise_id FROM session_exercises WHERE session_id = ${onlyCustom}`,
  )!;
  expect(moved.exercise_id).toBe(pullUp);
  expect(count(db, 'sets')).toBe(2);
  expect(currentOneRepMax(db, anna, pullUp)!.valueKg).toBe(95);
  expect(countExercises(db)).toBe(831);
  expect(sqlite.pragma('foreign_key_check')).toEqual([]);
});

test('which row wins a merge does not depend on insertion order: built-in before custom', () => {
  const at = createTestDbAt(1);
  // The custom row is inserted first this time.
  insertV1(at.db, 'mine', custom('Pull-up'), true);
  for (const e of V1_EXERCISES) insertV1(at.db, idOf(e.nameEn), e);
  at.migrateRest();

  syncLibrary(at.db, SEED_EXERCISES);

  expect(row(at.db, 'mine')).toBeUndefined();
  expect(row(at.db, idOf('Overhand pull-up'))).toMatchObject({ name_en: 'Pull-Up' });
});

test('later starts change nothing, and an exercise added after the upgrade stays', () => {
  const { db, migrateRest } = v1Phone();
  migrateRest();
  syncLibrary(db, SEED_EXERCISES);
  db.run(
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, equipment, is_custom, created_at, updated_at)
        VALUES ('mine', 'My new drill', 'Strength', 'Core', 'other', 1, ${T}, ${T})`,
  );

  expect(syncLibrary(db, SEED_EXERCISES)).toEqual({
    mapped: 0,
    merged: 0,
    dropped: 0,
    inserted: 0,
    sessionsDeleted: 0,
  });
  expect(row(db, 'mine')).toBeDefined();
  expect(countExercises(db)).toBe(832);
});

test('a later library version never runs the one-time upgrade again', () => {
  const db = createTestDb();
  syncLibrary(db, SEED_EXERCISES);
  db.run(
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, equipment, is_custom, created_at, updated_at)
        VALUES ('mine', 'My new drill', 'Strength', 'Core', 'other', 1, ${T}, ${T})`,
  );

  const result = syncLibrary(db, SEED_EXERCISES, 3);

  expect(result).toMatchObject({ dropped: 0, merged: 0, mapped: 0 });
  expect(row(db, 'mine')).toBeDefined();
  expect(getSetting(db, 'library.version')).toBe('3');
});

test('a later seed version only adds exercises whose names are free', () => {
  const db = createTestDb();
  syncLibrary(db, SEED_EXERCISES);
  const extra = { ...SEED_EXERCISES[0], nameEn: 'Brand new lift', aliases: [] };
  const clash = { ...SEED_EXERCISES[0], nameEn: 'Something', aliases: [SEED_EXERCISES[1].nameEn] };
  expect(syncLibrary(db, [...SEED_EXERCISES, extra, clash])).toMatchObject({
    inserted: 1,
    dropped: 0,
  });
  expect(countExercises(db)).toBe(832);
});

test('a fresh install gets the whole library and the version', () => {
  const db = createTestDb();
  expect(syncLibrary(db, SEED_EXERCISES)).toEqual({
    mapped: 0,
    merged: 0,
    dropped: 0,
    inserted: 831,
    sessionsDeleted: 0,
  });
  expect(count(db, 'exercise_aliases')).toBe(
    SEED_EXERCISES.reduce((n, e) => n + e.aliases.length, 0),
  );
  expect(getSetting(db, 'library.version')).toBe('2');
});
