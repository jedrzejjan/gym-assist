import {
  addedLoadFromPercent,
  bestSet,
  type ComparableSet,
  e1rm,
  estimateAllText,
  percentToKg,
  planEstimateAll,
  round2,
} from '../progress';

test('percentToKg is 1RM × % / 100, rounded to 1 kg', () => {
  expect(percentToKg(60, 85)).toBe(51);
  expect(percentToKg(101.75, 80)).toBe(81);
});

test('addedLoadFromPercent: total minus body weight, rounded, never below 0', () => {
  expect(addedLoadFromPercent(99, 80, 82)).toBe(0); // -2.8 → -3 → 0
  expect(addedLoadFromPercent(120, 85, 82)).toBe(20);
  // 85.85 − 82.4 = 3.45 → 3. Rounding the total first would give 86 − 82.4 = 3.6 → 4.
  expect(addedLoadFromPercent(101, 85, 82.4)).toBe(3);
});

// Golden values from legacy/gym_tracker.py est_1rm: 92.5 × 3 → 101.75000000000001, 100 × 1 → 100,
// 60 × 8 → 76.0, 52.5 × 6 → 63.0.
test('e1rm is Epley, and the weight itself for one rep', () => {
  expect(e1rm(92.5, 3)).toBeCloseTo(101.75, 10);
  expect(e1rm(100, 1)).toBe(100);
  expect(e1rm(60, 8)).toBeCloseTo(76, 10);
  expect(e1rm(52.5, 6)).toBeCloseTo(63, 10);
});

const set = (loadKg: number, reps: number, date: string): ComparableSet => ({
  loadKg,
  reps,
  date,
  shown: { weightKg: loadKg, reps },
});

test('bestSet ranks by e1RM, then reps, then earliest date', () => {
  expect(bestSet([])).toBeNull();
  // 92.5 × 3 = 101.75 beats 100 × 1 = 100
  expect(bestSet([set(100, 1, '2026-11-01'), set(92.5, 3, '2026-11-05')])).toMatchObject({
    loadKg: 92.5,
  });
  // equal e1RM (60 × 5 = 70 and 70 × 1 = 70): more reps wins
  expect(bestSet([set(70, 1, '2026-11-01'), set(60, 5, '2026-11-05')])).toMatchObject({ reps: 5 });
  // a full tie: the earliest date wins
  expect(bestSet([set(60, 5, '2026-11-05'), set(60, 5, '2026-11-01')])).toMatchObject({
    date: '2026-11-01',
  });
});

test('bestSet skips sets with null weight or reps', () => {
  const blank = [
    { loadKg: null, reps: 5, date: '2026-11-01', shown: { weightKg: null, reps: 5 } },
    { loadKg: 80, reps: null, date: '2026-11-01', shown: { weightKg: 80, reps: null } },
  ] as unknown as ComparableSet[];
  expect(bestSet(blank)).toBeNull();
  expect(bestSet([...blank, set(50, 5, '2026-11-02')])).toMatchObject({ loadKg: 50 });
});

describe('Estimate all (GYM-134): keep the 1RMs set by hand', () => {
  const item = (
    exerciseId: string,
    oneRepMax: { valueKg: number; source: 'estimated' | 'manual' } | null,
    e1rmKg: number | null,
  ) => ({ exerciseId, oneRepMax, best: e1rmKg === null ? null : { e1rmKg } });

  test('round2 keeps 2 decimals', () => {
    expect(round2(61.6666)).toBe(61.67);
    expect(round2(101.75)).toBe(101.75);
  });

  test('no 1RM is set, a different estimate is updated, manual, equal and no best set are skipped', () => {
    const plan = planEstimateAll([
      item('squat', null, 101.75),
      item('bench', { valueKg: 60, source: 'estimated' }, 63.3333),
      item('deadlift', { valueKg: 150, source: 'manual' }, 116.67),
      item('row', { valueKg: 61.67, source: 'estimated' }, 61.6666),
      item('run', null, null),
      item('plank', { valueKg: 50, source: 'estimated' }, null),
    ]);
    expect(plan).toEqual({
      set: [{ exerciseId: 'squat', valueKg: 101.75 }],
      update: [{ exerciseId: 'bench', valueKg: 63.33 }],
    });
  });

  test('nothing to do gives empty lists', () => {
    expect(planEstimateAll([])).toEqual({ set: [], update: [] });
  });

  test.each([
    [3, 2, "Set 3 new 1RMs and update 2 from each exercise's best set. 1RMs set by hand stay."],
    [1, 1, "Set 1 new 1RM and update 1 from each exercise's best set. 1RMs set by hand stay."],
    [2, 0, "Set 2 new 1RMs from each exercise's best set. 1RMs set by hand stay."],
    [0, 1, "Update 1 1RM from each exercise's best set. 1RMs set by hand stay."],
    [0, 4, "Update 4 1RMs from each exercise's best set. 1RMs set by hand stay."],
  ])('estimateAllText with %i new and %i updated', (n, u, text) => {
    const row = { exerciseId: 'x', valueKg: 1 };
    expect(estimateAllText({ set: Array(n).fill(row), update: Array(u).fill(row) })).toBe(text);
  });
});
