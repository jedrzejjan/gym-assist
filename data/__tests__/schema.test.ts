/**
 * @jest-environment node
 */
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

import * as schema from '../schema';
import { createTestDb } from '../testing/testDb';

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
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
        VALUES (${id}, ${nameEn}, 'Strength', 'none', 0, 0, ${NOW}, ${NOW})`,
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
    if (name === 'exercise_muscles') {
      expect(cols).toEqual(expect.arrayContaining(['exercise_id', 'muscle']));
      const pk = db
        .all<{ name: string; pk: number }>(sql.raw(`PRAGMA table_info(${name})`))
        .filter((c) => c.pk > 0)
        .map((c) => c.name)
        .sort();
      expect(pk).toEqual(['exercise_id', 'muscle']);
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
