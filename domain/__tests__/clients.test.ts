import { ageOn, fullName } from '../clients';

test('fullName joins first and last name, skipping a missing last name', () => {
  expect(fullName('Anna', null)).toBe('Anna');
  expect(fullName('Anna', 'Kowalska')).toBe('Anna Kowalska');
  expect(fullName('Anna', '')).toBe('Anna');
});

test('ageOn counts a birthday only once it has happened', () => {
  expect(ageOn('1990-11-12', '2026-11-11')).toBe(35);
  expect(ageOn('1990-11-11', '2026-11-11')).toBe(36);
  expect(ageOn('1992-03-15', '2026-11-11')).toBe(34);
});
