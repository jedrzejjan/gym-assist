import { bodyWeightOn } from '../bodyweight';

const entries = [
  { date: '2026-11-01', valueKg: 82 },
  { date: '2026-10-01', valueKg: 80 },
];

test('bodyWeightOn takes the latest entry on or before the date', () => {
  expect(bodyWeightOn(entries, '2026-10-15')).toEqual({ valueKg: 80, date: '2026-10-01' });
  expect(bodyWeightOn(entries, '2026-11-01')).toEqual({ valueKg: 82, date: '2026-11-01' });
  expect(bodyWeightOn(entries, '2026-11-05')).toEqual({ valueKg: 82, date: '2026-11-01' });
});

test('before the first entry, the earliest is used; no entries is null', () => {
  expect(bodyWeightOn(entries, '2026-09-01')).toEqual({ valueKg: 80, date: '2026-10-01' });
  expect(bodyWeightOn([], '2026-09-01')).toBeNull();
});
