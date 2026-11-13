/**
 * @jest-environment node
 */
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { BACKUP_TABLES, exportAll, SCHEMA_VERSION } from '../backup';
import { createClient } from '../clients';
import { seedExercises } from '../exercises';
import { mutate, onWrite } from '../live';
import journal from '../migrations/meta/_journal.json';
import { setOneRepMax } from '../progress';
import * as schema from '../schema';
import { SEED_EXERCISES } from '../seed/exercises';
import { createTestDb } from '../testing/testDb';

test('exportAll has every schema table and the schemaVersion from the journal', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const schemaTables = (Object.values(schema) as unknown[])
    .filter((v): v is SQLiteTable => v instanceof SQLiteTable)
    .map((t) => getTableConfig(t).name)
    .sort();
  expect(BACKUP_TABLES.map((t) => t.name).sort()).toEqual(schemaTables);
  // parents before children, so a restore can insert in this order
  const order = BACKUP_TABLES.map((t) => t.name);
  expect(order.indexOf('clients')).toBeLessThan(order.indexOf('sessions'));
  expect(order.indexOf('sessions')).toBeLessThan(order.indexOf('session_exercises'));
  expect(order.indexOf('session_exercises')).toBeLessThan(order.indexOf('sets'));
  expect(order.indexOf('exercises')).toBeLessThan(order.indexOf('exercise_muscles'));

  const file = exportAll(db);
  expect(file).toMatchObject({ app: 'gym-assist', formatVersion: 1 });
  expect(SCHEMA_VERSION).toBe(journal.entries.length);
  expect(file.schemaVersion).toBe(journal.entries.length);
  expect(Object.keys(file.tables).sort()).toEqual(schemaTables);
  expect(file.tables.exercises).toHaveLength(23);
  expect(file.tables.clients).toEqual([expect.objectContaining({ firstName: 'Anna' })]);
  expect(Number.isNaN(Date.parse(file.exportedAt))).toBe(false);
});

test('exportAll keeps insertion order, so a 1RM tie stays resolved after a restore', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const bench = (exportAll(db).tables.exercises as { id: string; nameEn: string }[]).find(
    (e) => e.nameEn === 'Bench press',
  )!.id;
  const spy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-11-12T10:00:00.000Z');
  try {
    setOneRepMax(db, anna, bench, 60, 'manual');
    setOneRepMax(db, anna, bench, 61, 'manual');
  } finally {
    spy.mockRestore();
  }
  const rows = exportAll(db).tables.one_rep_maxes as { valueKg: number }[];
  expect(rows.map((r) => r.valueKg)).toEqual([60, 61]);
});

test('mutate tells onWrite listeners about each write; export is true unless said otherwise', () => {
  const db = createTestDb();
  const seen: boolean[] = [];
  const stop = onWrite((e) => seen.push(e.export));
  mutate(db, (tx) => createClient(tx, { firstName: 'A', weightKg: 60, weightDate: '2026-11-01' }));
  mutate(db, () => undefined, { export: false });
  mutate(db, () => undefined, { export: true });
  stop();
  mutate(db, () => undefined);
  expect(seen).toEqual([true, false, true]);
});

test('a failed write tells no listener', () => {
  const db = createTestDb();
  const seen: boolean[] = [];
  const stop = onWrite((e) => seen.push(e.export));
  expect(() =>
    mutate(db, () => {
      throw new Error('boom');
    }),
  ).toThrow('boom');
  stop();
  expect(seen).toEqual([]);
});
