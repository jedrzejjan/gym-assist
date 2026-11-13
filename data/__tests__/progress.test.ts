/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { addWeight } from '../measurements';
import { bodyProgress, currentOneRepMax, setOneRepMax, strengthList } from '../progress';
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
