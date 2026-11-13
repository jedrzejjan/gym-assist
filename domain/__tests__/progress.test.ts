import { addedLoadFromPercent, bestSet, type ComparableSet, e1rm, percentToKg } from '../progress';

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
