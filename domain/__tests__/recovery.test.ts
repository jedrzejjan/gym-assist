/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Muscle, Pattern } from '../catalogue';
import { parseCsv } from '../csv';
import { daysAgo, recoveryLabel, recoveryTable, type RecoveryStatus } from '../recovery';
import golden from './fixtures/recovery-golden.json';

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

test('recoveryTable: patterns in spec order without "none", then the 12 muscles; never is null', () => {
  const t = recoveryTable(
    [{ date: '2026-11-09', pattern: 'none', muscles: ['calves'] }],
    '2026-11-12',
  );
  expect(t.patterns.map((r) => r.key)).toEqual([
    'KD',
    'HD',
    'Push vertical',
    'Push horizontal',
    'Pull vertical',
    'Pull horizontal',
    'Anti flexion',
    'Anti extension',
    'Carries',
  ]);
  expect(t.patterns.every((r) => r.status === 'never logged' && r.days === null)).toBe(true);
  expect(t.muscles).toHaveLength(12);
  expect(t.muscles.find((r) => r.key === 'calves')).toEqual({
    key: 'calves',
    lastDate: '2026-11-09',
    days: 3,
    status: 'in supercompensation window (48–72 h)',
  });
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

/** The fixtures as the importer reads them (BOM, 
 and quoted fields included). */
function readCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'fixtures', file), 'utf8');
  const [keys, ...rows] = parseCsv(text);
  return rows.map((r) => Object.fromEntries(r.map((v, i) => [keys[i], v])));
}

test('recoveryTable matches gym_tracker.py on the golden sample', () => {
  const exercises = new Map(readCsv('exercises-sample.csv').map((e) => [e.exercise_en, e]));
  // Every CSV row is a set, so each one counts, as a session exercise with a set does in the app.
  const trained = readCsv('sessions-sample.csv').map((r) => {
    const e = exercises.get(r.exercise_en)!;
    return {
      date: r.date,
      pattern: e.pattern as Pattern,
      muscles: e.muscles.split(';').filter(Boolean) as Muscle[],
    };
  });
  const t = recoveryTable(trained, golden.today);
  // Python writes "48-72 h" with a hyphen; the app uses an en dash.
  const asPython = (s: RecoveryStatus) => s.replace('–', '-');
  for (const row of t.patterns) {
    const g = golden.patterns[row.key as keyof typeof golden.patterns];
    expect({ key: row.key, days: row.days, status: asPython(row.status) }).toEqual({
      key: row.key,
      days: g.days,
      status: g.status,
    });
  }
  for (const row of t.muscles) {
    const g = golden.muscles[row.key as keyof typeof golden.muscles];
    expect({ key: row.key, days: row.days, status: asPython(row.status) }).toEqual({
      key: row.key,
      days: g.days,
      status: g.status,
    });
  }
  expect(t.patterns).toHaveLength(Object.keys(golden.patterns).length);
  expect(t.muscles).toHaveLength(Object.keys(golden.muscles).length);
});
