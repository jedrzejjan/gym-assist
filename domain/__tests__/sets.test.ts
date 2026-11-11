import { parseWeight } from '../sets';

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
