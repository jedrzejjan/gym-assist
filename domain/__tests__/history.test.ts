import { countsText } from '../history';

test('countsText uses the singular for one', () => {
  expect(countsText(4, 14)).toBe('4 exercises · 14 sets');
  expect(countsText(1, 1)).toBe('1 exercise · 1 set');
  expect(countsText(1, 0)).toBe('1 exercise · 0 sets');
});
