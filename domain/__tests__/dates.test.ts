import { formatDayMonth, formatDayMonthYear, isValidDate, todayLocal } from '../dates';

test('todayLocal uses the phone’s local date, not UTC', () => {
  // Guard: jest.global-setup.js sets Europe/Warsaw (UTC+1 in November); CI runs in UTC.
  expect(new Date(2026, 10, 11, 0, 30).getTimezoneOffset()).toBe(-60);
  // 00:30 local on 11 Nov is 23:30 UTC on 10 Nov, so a UTC implementation fails here.
  expect(todayLocal(new Date(2026, 10, 11, 0, 30))).toBe('2026-11-11');
});

test('todayLocal pads month and day', () => {
  expect(todayLocal(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
});

test('formatDayMonth and formatDayMonthYear', () => {
  expect(formatDayMonth('2026-11-07')).toBe('7 Nov');
  expect(formatDayMonthYear('2026-10-27')).toBe('27 Oct 2026');
});

test('isValidDate accepts real dates only', () => {
  expect(isValidDate('2026-11-11')).toBe(true);
  expect(isValidDate('2024-02-29')).toBe(true);
  expect(isValidDate('2026-02-30')).toBe(false);
  expect(isValidDate('2026-13-01')).toBe(false);
  expect(isValidDate('11/11/2026')).toBe(false);
  expect(isValidDate('')).toBe(false);
});
