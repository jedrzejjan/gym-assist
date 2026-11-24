/**
 * @jest-environment node
 */
import { MUSCLES } from '../catalogue';
import { daysAgo, recoveryLabel, recoveryTable, type RecoveryStatus } from '../recovery';

test('recoveryLabel: 0 and 1 too soon, 2 and 3 window, 4 or more due', () => {
  const soon: RecoveryStatus = 'recovering, too soon';
  const window: RecoveryStatus = 'in supercompensation window (48–72 h)';
  expect([0, 1].map(recoveryLabel)).toEqual([soon, soon]);
  expect([2, 3].map(recoveryLabel)).toEqual([window, window]);
  expect([4, 30].map(recoveryLabel)).toEqual(['due', 'due']);
});

test('daysAgo says today, 1 day ago, N days ago', () => {
  expect(daysAgo(0)).toBe('today');
  expect(daysAgo(1)).toBe('1 day ago');
  expect(daysAgo(6)).toBe('6 days ago');
});

test('recoveryTable: the 5 patterns in the owner order, then the 16 muscles; never is null', () => {
  const t = recoveryTable(
    [{ date: '2026-11-09', pattern: 'Core', muscles: ['calves'] }],
    '2026-11-12',
  );
  expect(t.patterns.map((r) => r.key)).toEqual(['KD', 'HD', 'Push', 'Pull', 'Core']);
  expect(t.patterns.filter((r) => r.status === 'never logged')).toHaveLength(4);
  expect(t.muscles.map((r) => r.key)).toEqual(MUSCLES);
  expect(t.muscles).toHaveLength(16);
  expect(t.muscles.find((r) => r.key === 'calves')).toEqual({
    key: 'calves',
    lastDate: '2026-11-09',
    days: 3,
    status: 'in supercompensation window (48–72 h)',
  });
});

test('cardio (no pattern) counts for its muscles and for no pattern', () => {
  const t = recoveryTable(
    [{ date: '2026-11-11', pattern: null, muscles: ['quadriceps'] }],
    '2026-11-12',
  );
  expect(t.patterns.every((r) => r.status === 'never logged')).toBe(true);
  expect(t.muscles.find((r) => r.key === 'quadriceps')).toMatchObject({ days: 1 });
});

test('recoveryTable keeps the latest date, whatever the input order', () => {
  const t = recoveryTable(
    [
      { date: '2026-11-10', pattern: 'KD', muscles: ['glutes'] },
      { date: '2026-11-01', pattern: 'KD', muscles: ['glutes'] },
    ],
    '2026-11-12',
  );
  expect(t.patterns[0]).toMatchObject({ key: 'KD', lastDate: '2026-11-10', days: 2 });
});
