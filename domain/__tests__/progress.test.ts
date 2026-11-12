import { addedLoadFromPercent, percentToKg } from '../progress';

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
