/**
 * @jest-environment node
 */
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

import { SCHEMA_VERSION } from '../backup';
import * as schema from '../schema';
import { createTestDb, createTestDbAt } from '../testing/testDb';

type Db = ReturnType<typeof createTestDb>;

const NOW = '2026-11-11T10:00:00.000Z';

function columns(db: Db, table: string): string[] {
  return db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`)).map((c) => c.name);
}

function addClient(db: Db, id: string, isSelf = false) {
  db.run(
    sql`INSERT INTO clients (id, first_name, is_self, created_at, updated_at) VALUES (${id}, 'Anna', ${isSelf ? 1 : 0}, ${NOW}, ${NOW})`,
  );
}

function addExercise(db: Db, id: string, nameEn: string) {
  db.run(
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, equipment, created_at, updated_at)
        VALUES (${id}, ${nameEn}, 'Strength', 'Push', 'barbell', ${NOW}, ${NOW})`,
  );
}

function addSession(db: Db, id: string, clientId: string, status: 'draft' | 'finished') {
  db.run(
    sql`INSERT INTO sessions (id, client_id, date, status, started_at, updated_at)
        VALUES (${id}, ${clientId}, '2026-11-11', ${status}, ${NOW}, ${NOW})`,
  );
}

function count(db: Db, table: string): number {
  return db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table}`))!.n;
}

const tables = (Object.values(schema) as unknown[]).filter(
  (v): v is SQLiteTable => v instanceof SQLiteTable,
);

test('every table has id and updated_at', () => {
  const db = createTestDb();
  const names = tables.map((t) => getTableConfig(t).name).sort();
  expect(names).toEqual(
    [
      'app_settings',
      'clients',
      'exercise_aliases',
      'exercise_muscles',
      'exercises',
      'measurements',
      'one_rep_maxes',
      'session_exercises',
      'sessions',
      'sets',
    ].sort(),
  );
  for (const name of names) {
    const cols = columns(db, name);
    expect(cols).toContain('updated_at');
    const pk = db
      .all<{ name: string; pk: number }>(sql.raw(`PRAGMA table_info(${name})`))
      .filter((c) => c.pk > 0)
      .map((c) => c.name)
      .sort();
    if (name === 'exercise_muscles') {
      expect(pk).toEqual(['exercise_id', 'muscle']);
    } else if (name === 'exercise_aliases') {
      expect(pk).toEqual(['alias', 'exercise_id']);
    } else if (name === 'app_settings') {
      expect(cols).toContain('key');
    } else {
      expect(cols).toContain('id');
    }
  }
});

test('session_exercises has an index on exercise_id (Last time, progress, recovery)', () => {
  const db = createTestDb();
  const indexed = db
    .all<{ name: string }>(sql`PRAGMA index_list(session_exercises)`)
    .flatMap((i) => db.all<{ name: string }>(sql.raw(`PRAGMA index_info(${i.name})`)))
    .map((c) => c.name);
  expect(indexed).toContain('exercise_id');
});

test('only one draft session', () => {
  const db = createTestDb();
  addClient(db, 'c1');
  addSession(db, 's1', 'c1', 'draft');
  expect(() => addSession(db, 's2', 'c1', 'draft')).toThrow();
  addSession(db, 's3', 'c1', 'finished');
  addSession(db, 's4', 'c1', 'finished');
  expect(count(db, 'sessions')).toBe(3);
});

test('foreign keys are on after createTestDb', () => {
  const db = createTestDb();
  expect(db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`)!.foreign_keys).toBe(1);
  addClient(db, 'c1');
  db.run(
    sql`INSERT INTO measurements (id, client_id, date, type, value, created_at, updated_at)
        VALUES ('m1', 'c1', '2026-11-11', 'weight', 82, ${NOW}, ${NOW})`,
  );
  db.run(sql`DELETE FROM clients WHERE id = 'c1'`);
  expect(count(db, 'measurements')).toBe(0);
});

test('exercise name_en is unique ignoring case', () => {
  const db = createTestDb();
  addExercise(db, 'e1', 'Dips');
  expect(() => addExercise(db, 'e2', 'dips')).toThrow();
});

test('only one client can be Me', () => {
  const db = createTestDb();
  addClient(db, 'c1', true);
  expect(() => addClient(db, 'c2', true)).toThrow();
  addClient(db, 'c3', false);
  addClient(db, 'c4', false);
  expect(count(db, 'clients')).toBe(3);
});

test('one weight per client, type and date', () => {
  const db = createTestDb();
  addClient(db, 'c1');
  const add = (id: string) =>
    db.run(
      sql`INSERT INTO measurements (id, client_id, date, type, value, created_at, updated_at)
          VALUES (${id}, 'c1', '2026-11-11', 'weight', 82, ${NOW}, ${NOW})`,
    );
  add('m1');
  expect(() => add('m2')).toThrow();
});

test('deleting a session deletes its exercises and sets', () => {
  const db = createTestDb();
  addClient(db, 'c1');
  addExercise(db, 'e1', 'Bench press');
  addSession(db, 's1', 'c1', 'finished');
  db.run(
    sql`INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at)
        VALUES ('se1', 's1', 'e1', 1, ${NOW})`,
  );
  db.run(
    sql`INSERT INTO sets (id, session_exercise_id, set_no, weight_kg, reps, created_at, updated_at)
        VALUES ('x1', 'se1', 1, 60, 8, ${NOW}, ${NOW})`,
  );
  db.run(sql`DELETE FROM sessions WHERE id = 's1'`);
  expect(count(db, 'session_exercises')).toBe(0);
  expect(count(db, 'sets')).toBe(0);
});

test('sets keep nullable backlog columns', () => {
  const db = createTestDb();
  addClient(db, 'c1');
  addExercise(db, 'e1', 'Bench press');
  addSession(db, 's1', 'c1', 'finished');
  db.run(
    sql`INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at)
        VALUES ('se1', 's1', 'e1', 1, ${NOW})`,
  );
  db.run(
    sql`INSERT INTO sets (id, session_exercise_id, set_no, weight_kg, reps, side, height_cm, speed_kmh, minutes, note, created_at, updated_at)
        VALUES ('x1', 'se1', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${NOW}, ${NOW})`,
  );
  const row = db.get<Record<string, unknown>>(sql`SELECT * FROM sets WHERE id = 'x1'`)!;
  for (const col of ['weight_kg', 'reps', 'side', 'height_cm', 'speed_kmh', 'minutes', 'note']) {
    expect(row[col]).toBeNull();
  }
});

test('exercises carry the v2 properties; category is gone (GYM-144)', () => {
  const db = createTestDb();
  const cols = columns(db, 'exercises');
  expect(cols).toEqual(
    expect.arrayContaining([
      'subcategory',
      'equipment',
      'mechanic',
      'level',
      'unilateral',
      'importance',
    ]),
  );
  expect(cols).not.toContain('category');
  expect(columns(db, 'exercise_muscles')).toContain('role');
  expect(SCHEMA_VERSION).toBe(2);
});

test('a cardio exercise has no pattern; defaults: bilateral, importance 1, primary muscle', () => {
  const db = createTestDb();
  db.run(
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, equipment, created_at, updated_at)
        VALUES ('run', 'Treadmill', 'Cardio', NULL, 'machine', ${NOW}, ${NOW})`,
  );
  db.run(
    sql`INSERT INTO exercise_muscles (exercise_id, muscle, updated_at) VALUES ('run', 'calves', ${NOW})`,
  );
  const row = db.get<Record<string, unknown>>(sql`SELECT * FROM exercises WHERE id = 'run'`)!;
  expect(row).toMatchObject({ pattern: null, unilateral: 0, importance: 1, is_custom: 0 });
  expect(db.get<{ role: string }>(sql`SELECT role FROM exercise_muscles`)!.role).toBe('primary');
});

test('an alias is unique ignoring case across exercises, and goes with its exercise', () => {
  const db = createTestDb();
  addExercise(db, 'e1', 'Barbell Bench Press');
  addExercise(db, 'e2', 'Dumbbell Bench Press');
  const alias = (id: string, a: string) =>
    db.run(
      sql`INSERT INTO exercise_aliases (exercise_id, alias, updated_at) VALUES (${id}, ${a}, ${NOW})`,
    );
  alias('e1', 'Bench press');
  expect(() => alias('e2', 'bench press')).toThrow();
  db.run(sql`DELETE FROM exercises WHERE id = 'e1'`);
  expect(count(db, 'exercise_aliases')).toBe(0);
});

test('migration 0001 keeps a v1 exercise, its id and its sets', () => {
  const { db, sqlite, migrateRest } = createTestDbAt(1);
  addClient(db, 'c1');
  db.run(
    sql`INSERT INTO exercises (id, name_en, category, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
        VALUES ('e1', 'Overhead press', 'Push', 'Strength', 'Push vertical', 0, 0, ${NOW}, ${NOW})`,
  );
  db.run(
    sql`INSERT INTO exercise_muscles (exercise_id, muscle, updated_at) VALUES ('e1', 'shoulders', ${NOW})`,
  );
  addSession(db, 's1', 'c1', 'finished');
  db.run(
    sql`INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at)
        VALUES ('se1', 's1', 'e1', 1, ${NOW})`,
  );
  db.run(
    sql`INSERT INTO sets (id, session_exercise_id, set_no, weight_kg, reps, created_at, updated_at)
        VALUES ('x1', 'se1', 1, 40, 8, ${NOW}, ${NOW})`,
  );

  migrateRest();

  const row = db.get<Record<string, unknown>>(sql`SELECT * FROM exercises WHERE id = 'e1'`)!;
  // The pattern is re-tagged by syncLibrary (data/library.ts), not by the SQL migration.
  expect(row).toMatchObject({
    name_en: 'Overhead press',
    pattern: 'Push vertical',
    equipment: 'other',
  });
  expect(db.get<{ role: string }>(sql`SELECT role FROM exercise_muscles`)!.role).toBe('primary');
  expect(count(db, 'sets')).toBe(1);
  expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  expect(db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`)!.foreign_keys).toBe(1);
});
