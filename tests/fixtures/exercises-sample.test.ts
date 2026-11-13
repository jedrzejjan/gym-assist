/**
 * @jest-environment node
 *
 * exercises-sample.csv is the seed in the legacy CSV format (legacy/data/ is not in git). This
 * keeps the two from drifting: every row matches the seed's name, pattern and muscles.
 */
import fs from 'node:fs';
import path from 'node:path';

import { SEED_EXERCISES } from '../../data/seed/exercises';

test('every exercises-sample.csv row matches the seed, and every seed exercise has a row', () => {
  const text = fs.readFileSync(path.join(__dirname, 'exercises-sample.csv'), 'utf8');
  const [header, ...lines] = text.trim().split('\n');
  expect(header.split(',')).toEqual([
    'exercise_en',
    'exercise_pl',
    'category',
    'training',
    'pattern',
    'muscles',
    'muscles_pl',
    'muscles_la',
  ]);
  const rows = lines.map((l) => l.split(','));
  expect(rows.map((r) => r[0]).sort()).toEqual(SEED_EXERCISES.map((e) => e.nameEn).sort());
  for (const [nameEn, namePl, , training, pattern, muscles] of rows) {
    const seed = SEED_EXERCISES.find((e) => e.nameEn === nameEn)!;
    expect({ nameEn, namePl, training, pattern, muscles: muscles.split(';') }).toEqual({
      nameEn: seed.nameEn,
      namePl: seed.namePl,
      training: seed.trainingType,
      pattern: seed.pattern,
      muscles: seed.muscles,
    });
  }
});
