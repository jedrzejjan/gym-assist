import { formatKg, formatLastTime, formatSet, parseWeight } from '../sets';

test('parseWeight accepts a comma or a dot', () => {
  expect(parseWeight('22,5')).toBe(22.5);
  expect(parseWeight('22.5')).toBe(22.5);
  expect(parseWeight(',5')).toBe(0.5);
  expect(parseWeight('.5')).toBe(0.5);
  expect(parseWeight('22.')).toBe(22);
  expect(parseWeight(' 22,5 ')).toBe(22.5);
  expect(parseWeight('0')).toBe(0);
});

test('parseWeight treats blank as no value', () => {
  expect(parseWeight('')).toBeNull();
  expect(parseWeight('  ')).toBeNull();
});

test('parseWeight refuses anything else', () => {
  for (const bad of ['22,,5', '-5', '1e3', 'abc', '2 2', '22,5kg']) {
    expect(parseWeight(bad)).toBe('invalid');
  }
});

test('formatKg drops a trailing ".0"', () => {
  expect(formatKg(62.5)).toBe('62.5');
  expect(formatKg(60)).toBe('60');
});

test('formatSet shows kg × reps, with "-" for a blank value', () => {
  expect(formatSet({ weightKg: 60, reps: 8 }, false)).toBe('60 kg × 8');
  expect(formatSet({ weightKg: null, reps: 10 }, false)).toBe('- × 10');
  expect(formatSet({ weightKg: 62.5, reps: null }, false)).toBe('62.5 kg × -');
});

test('formatSet shows body weight as BW, plus any added load', () => {
  expect(formatSet({ weightKg: 10, reps: 6 }, true)).toBe('BW + 10 kg × 6');
  expect(formatSet({ weightKg: null, reps: 8 }, true)).toBe('BW × 8');
  expect(formatSet({ weightKg: 0, reps: 8 }, true)).toBe('BW × 8');
});

test('formatLastTime lists the sets, or says "First time"', () => {
  expect(
    formatLastTime(
      [
        { weightKg: 60, reps: 8 },
        { weightKg: 62.5, reps: 6 },
      ],
      false,
    ),
  ).toBe('Last time: 60 kg × 8, 62.5 kg × 6');
  expect(
    formatLastTime(
      [
        { weightKg: 10, reps: 6 },
        { weightKg: null, reps: 8 },
      ],
      true,
    ),
  ).toBe('Last time: BW + 10 kg × 6, BW × 8');
  expect(formatLastTime(null, false)).toBe('First time');
  expect(formatLastTime([], false)).toBe('First time');
});
