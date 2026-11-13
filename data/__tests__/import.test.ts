/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseCsv } from '../../domain/csv';
import { validateImport } from '../../domain/importRows';
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { listHistory } from '../history';
import { DatesTakenError, importHistory, NoSelfError } from '../import';
import { SEED_EXERCISES } from '../seed/exercises';
import { sessionExercises, sessions, sets } from '../schema';
import { addExerciseToSession, addSet, finishSession, startSession } from '../sessions';
import { createTestDb } from '../testing/testDb';
import type { Db } from '../types';

const SAMPLE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'tests', 'fixtures', 'sessions-sample.csv'),
  'utf8',
);

function setup({ withSelf = true } = {}) {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const me = withSelf
    ? createClient(db, { firstName: 'Me', isSelf: true, weightKg: 82, weightDate: '2026-10-01' })
    : null;
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  return { db, me, anna };
}

function sampleRows(db: Db) {
  const names = new Set(listExercises(db, {}).map((e) => e.nameEn));
  const r = validateImport(parseCsv(SAMPLE), names, '2026-11-12');
  if (!r.ok) throw new Error(r.message);
  return r.rows;
}

test('the sample imports 8 sessions into Me with every column kept', () => {
  const { db, me, anna } = setup();
  expect(importHistory(db, sampleRows(db))).toEqual({ sessions: 8 });

  const history = listHistory(db, me!);
  expect(history.map((h) => h.date)).toEqual([
    '2026-11-12',
    '2026-11-10',
    '2026-11-09',
    '2026-11-06',
    '2026-11-03',
    '2026-11-01',
    '2026-10-30',
    '2026-10-20',
  ]);
  expect(history.find((h) => h.date === '2026-11-06')).toMatchObject({
    exerciseCount: 2,
    setCount: 3,
  });
  expect(listHistory(db, anna)).toEqual([]);

  // every session is finished, with a finish time (engineering-log watch item for "Last time")
  const all = db.select().from(sessions).all();
  expect(all.every((s) => s.status === 'finished' && s.finishedAt !== null)).toBe(true);

  const allSets = db.select().from(sets).all();
  expect(allSets).toHaveLength(15);
  expect(
    allSets.filter((s) => s.side === 'L' || s.side === 'P').map((s) => [s.setNo, s.side]),
  ).toEqual([
    [1, 'L'],
    [1, 'P'],
  ]);
  expect(allSets.find((s) => s.note !== null)).toMatchObject({
    weightKg: null,
    reps: null,
    speedKmh: 10,
    minutes: 20,
    note: 'easy, warm-up',
  });
  expect(allSets.find((s) => s.side === 'per side')).toMatchObject({ weightKg: 22, reps: 10 });
  expect(allSets.some((s) => s.weightKg === 62.5)).toBe(true); // "62,5" in the file
});

test('a bodyweight set with weight "0" is kept as 0 added load, not blank', () => {
  const { db } = setup();
  const names = new Set(listExercises(db, {}).map((e) => e.nameEn));
  const header = 'date,exercise_en,set_no,side,weight_kg,reps,height_cm,speed_kmh,minutes,note';
  const r = validateImport(
    parseCsv(`${header}
2026-11-01,Overhand pull-up,1,,0,8,,,,
`),
    names,
    '2026-11-12',
  );
  if (!r.ok) throw new Error(r.message);
  importHistory(db, r.rows);
  expect(db.select().from(sets).get()).toMatchObject({ weightKg: 0, reps: 8 });
});

test('exercises keep the order of their first appearance in a day', () => {
  const { db } = setup();
  importHistory(db, sampleRows(db));
  const nov6 = db
    .select()
    .from(sessions)
    .all()
    .find((s) => s.date === '2026-11-06')!;
  const items = db
    .select()
    .from(sessionExercises)
    .all()
    .filter((e) => e.sessionId === nov6.id)
    .sort((a, b) => a.position - b.position);
  const names = new Map(listExercises(db, {}).map((e) => [e.id, e.nameEn]));
  expect(items.map((e) => names.get(e.exerciseId))).toEqual([
    'Overhand pull-up',
    'Kettlebell swing',
  ]);
});

test('a date Me already has is refused with nothing written', () => {
  const { db, me } = setup();
  const sid = startSession(db, me!, '2026-11-09');
  addSet(db, addExerciseToSession(db, sid, listExercises(db, { search: 'Deadlift' })[0].id), {
    weightKg: 100,
    reps: 5,
  });
  finishSession(db, sid);
  const before = db.select().from(sets).all().length;
  let error: unknown;
  try {
    importHistory(db, sampleRows(db));
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DatesTakenError);
  expect((error as DatesTakenError).dates).toEqual(['2026-11-09']);
  expect(db.select().from(sessions).all()).toHaveLength(1);
  expect(db.select().from(sets).all()).toHaveLength(before);
});

test('no Me throws NoSelfError', () => {
  const { db } = setup({ withSelf: false });
  expect(() => importHistory(db, sampleRows(db))).toThrow(NoSelfError);
  expect(db.select().from(sessions).all()).toEqual([]);
});
