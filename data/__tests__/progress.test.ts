/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { addWeight } from '../measurements';
import {
  bodyProgress,
  currentOneRepMax,
  estimateAll,
  setOneRepMax,
  strengthList,
} from '../progress';
import { oneRepMaxes } from '../schema';
import { SEED_EXERCISES } from '../seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../sessions';
import { createTestDb } from '../testing/testDb';
import type { Db } from '../types';

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, ex };
}

type Plan = [string, [number | null, number | null][]][];

function log(db: Db, clientId: string, date: string, plan: Plan, finish = true) {
  const sid = startSession(db, clientId, date);
  for (const [exerciseId, values] of plan) {
    const se = addExerciseToSession(db, sid, exerciseId);
    for (const [weightKg, reps] of values) addSet(db, se, { weightKg, reps });
  }
  if (finish) finishSession(db, sid);
  return sid;
}

test('strengthList: finished sessions only, most recently trained first, with the best set', () => {
  const s = setup();
  log(s.db, s.anna, '2026-11-01', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [92.5, 3],
      ],
    ],
  ]);
  log(s.db, s.anna, '2026-11-05', [[s.ex('Bench press'), [[50, 8]]]]);
  log(s.db, s.anna, '2026-11-07', [[s.ex('Deadlift'), [[200, 1]]]], false); // a draft
  const list = strengthList(s.db, s.anna);
  expect(list.map((e) => e.nameEn)).toEqual(['Bench press', 'Back squat']);
  expect(list[1].best).toMatchObject({
    loadKg: 92.5,
    reps: 3,
    date: '2026-11-01',
    shown: { weightKg: 92.5, reps: 3 },
  });
  expect(list[1].best!.e1rmKg).toBeCloseTo(101.75, 10);
  expect(list[1].oneRepMax).toBeNull();
});

test('strengthList uses total load for bodyweight exercises', () => {
  const s = setup(); // body weight 63.5
  log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Overhand pull-up'),
      [
        [10, 6],
        [null, 8],
      ],
    ],
  ]);
  const [pullUp] = strengthList(s.db, s.anna);
  expect(pullUp.usesBodyweight).toBe(true);
  // 73.5 × 1.2 = 88.2 beats 63.5 × (1 + 8/30) ≈ 80.43
  expect(pullUp.best).toMatchObject({ loadKg: 73.5, reps: 6, shown: { weightKg: 10, reps: 6 } });
});

test('the body weight on the session date counts, not today’s', () => {
  const s = setup();
  addWeight(s.db, s.anna, '2026-11-10', 70, { replace: false });
  log(s.db, s.anna, '2026-11-05', [[s.ex('Overhand pull-up'), [[0, 5]]]]);
  expect(strengthList(s.db, s.anna)[0].best!.loadKg).toBe(63.5);
});

test('an exercise with a stored 1RM is listed even if never trained; no comparable set gives null', () => {
  const s = setup();
  setOneRepMax(s.db, s.anna, s.ex('Bench press'), 60, 'manual');
  log(s.db, s.anna, '2026-11-05', [[s.ex('Treadmill run'), [[null, null]]]]);
  const list = strengthList(s.db, s.anna);
  expect(list.map((e) => e.nameEn)).toEqual(['Treadmill run', 'Bench press']);
  expect(list[0].best).toBeNull();
  expect(list[1]).toMatchObject({ best: null, oneRepMax: { valueKg: 60, source: 'manual' } });
});

test('setOneRepMax keeps the history; the newest row is the current 1RM', () => {
  const s = setup();
  const bench = s.ex('Bench press');
  setOneRepMax(s.db, s.anna, bench, 60, 'manual');
  setOneRepMax(s.db, s.anna, bench, 63.33, 'estimated');
  expect(currentOneRepMax(s.db, s.anna, bench)).toMatchObject({
    valueKg: 63.33,
    source: 'estimated',
  });
  expect(() => setOneRepMax(s.db, s.anna, bench, 0, 'manual')).toThrow();
});

test('two 1RMs saved in the same millisecond: the last one saved is current', () => {
  const s = setup();
  const bench = s.ex('Bench press');
  const spy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-11-12T10:00:00.000Z');
  try {
    setOneRepMax(s.db, s.anna, bench, 60, 'manual');
    setOneRepMax(s.db, s.anna, bench, 63.33, 'estimated');
    setOneRepMax(s.db, s.anna, bench, 61, 'manual');
  } finally {
    spy.mockRestore();
  }
  expect(currentOneRepMax(s.db, s.anna, bench)).toMatchObject({ valueKg: 61, source: 'manual' });
});

test('logging a set never changes the 1RM', () => {
  const s = setup();
  const bench = s.ex('Bench press');
  setOneRepMax(s.db, s.anna, bench, 60, 'manual');
  log(s.db, s.anna, '2026-11-05', [[bench, [[100, 5]]]]);
  expect(currentOneRepMax(s.db, s.anna, bench)).toMatchObject({ valueKg: 60, source: 'manual' });
});

test('bodyProgress: latest weight, change since the first entry, entries newest first', () => {
  const s = setup(); // 63.5 on 1 Oct
  expect(bodyProgress(s.db, s.anna)).toMatchObject({
    latest: { valueKg: 63.5 },
    changeKg: null,
    since: null,
  });
  addWeight(s.db, s.anna, '2026-09-15', 65.8, { replace: false });
  addWeight(s.db, s.anna, '2026-11-10', 63.5, { replace: false });
  const b = bodyProgress(s.db, s.anna)!;
  expect(b.latest).toMatchObject({ date: '2026-11-10', valueKg: 63.5 });
  expect(b.changeKg).toBeCloseTo(-2.3, 10);
  expect(b.since).toBe('2026-09-15');
  expect(b.entries.map((e) => e.date)).toEqual(['2026-11-10', '2026-10-01', '2026-09-15']);
});

describe('estimateAll (GYM-134)', () => {
  /**
   * Back squat 92.5 × 3, no 1RM → set 101.75. Overhand pull-up BW 63.5 + 10 × 6 = 88.2, stored
   * estimated 80 → updated. Bench press 50 × 8, manual 70 → kept. Deadlift 100 × 5 = 116.67,
   * already estimated at 116.67 → skipped. Treadmill run has no comparable set → skipped.
   */
  function history() {
    const s = setup();
    log(s.db, s.anna, '2026-11-05', [
      [s.ex('Back squat'), [[92.5, 3]]],
      [s.ex('Overhand pull-up'), [[10, 6]]],
      [s.ex('Bench press'), [[50, 8]]],
      [s.ex('Deadlift'), [[100, 5]]],
      [s.ex('Treadmill run'), [[null, null]]],
    ]);
    setOneRepMax(s.db, s.anna, s.ex('Overhand pull-up'), 80, 'estimated');
    setOneRepMax(s.db, s.anna, s.ex('Bench press'), 70, 'manual');
    setOneRepMax(s.db, s.anna, s.ex('Deadlift'), 116.67, 'estimated');
    return s;
  }
  const rows = (db: Db) => db.select().from(oneRepMaxes).all().length;

  test('sets the missing, updates the estimated, keeps manual and equal ones, skips no sets', () => {
    const s = history();
    const before = rows(s.db);
    expect(estimateAll(s.db, s.anna)).toEqual({ set: 1, updated: 1 });
    expect(rows(s.db)).toBe(before + 2);
    const orm = (name: string) => currentOneRepMax(s.db, s.anna, s.ex(name));
    expect(orm('Back squat')).toMatchObject({ valueKg: 101.75, source: 'estimated' });
    expect(orm('Overhand pull-up')).toMatchObject({ valueKg: 88.2, source: 'estimated' });
    expect(orm('Bench press')).toMatchObject({ valueKg: 70, source: 'manual' });
    expect(orm('Deadlift')).toMatchObject({ valueKg: 116.67, source: 'estimated' });
    expect(orm('Treadmill run')).toBeNull();
  });

  test('a second run changes nothing', () => {
    const s = history();
    estimateAll(s.db, s.anna);
    const after = rows(s.db);
    expect(estimateAll(s.db, s.anna)).toEqual({ set: 0, updated: 0 });
    expect(rows(s.db)).toBe(after);
  });

  test('only this client is touched', () => {
    const s = history();
    const ewa = createClient(s.db, { firstName: 'Ewa', weightKg: 60, weightDate: '2026-10-01' });
    log(s.db, ewa, '2026-11-06', [[s.ex('Back squat'), [[50, 5]]]]);
    estimateAll(s.db, s.anna);
    expect(currentOneRepMax(s.db, ewa, s.ex('Back squat'))).toBeNull();
  });
});
