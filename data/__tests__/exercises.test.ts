/**
 * @jest-environment node
 */
import { sql } from 'drizzle-orm';

import {
  addCustomExercise,
  countByPattern,
  DuplicateNameError,
  countExercises,
  getExercise,
  listExercises,
  seedExercises,
} from '../exercises';
import { SEED_EXERCISES } from '../seed/exercises';
import { createTestDb } from '../testing/testDb';

const names = (rows: { nameEn: string }[]) => rows.map((r) => r.nameEn);

test('seeding inserts the 23 exercises once', () => {
  const db = createTestDb();
  expect(SEED_EXERCISES).toHaveLength(23);
  expect(seedExercises(db, SEED_EXERCISES)).toBe(23);
  expect(seedExercises(db, SEED_EXERCISES)).toBe(0);
  expect(countExercises(db)).toBe(23);
});

test('a custom exercise with a seed name (any case) is kept, and the seed entry skipped', () => {
  const db = createTestDb();
  db.run(
    sql`INSERT INTO exercises (id, name_en, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
        VALUES ('mine', 'back squat', 'Strength', 'KD', 0, 1, 'x', 'x')`,
  );
  expect(seedExercises(db, SEED_EXERCISES)).toBe(22);
  const squat = listExercises(db, { search: 'back squat' });
  expect(squat).toHaveLength(1);
  expect(squat[0]).toMatchObject({ id: 'mine', nameEn: 'back squat', isCustom: true });
});

test('only the two pull-ups use body weight', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const bw = listExercises(db, {}).filter((e) => e.usesBodyweight);
  expect(names(bw).sort()).toEqual(['Overhand pull-up', 'Underhand pull-up']);
});

test('search matches English or Polish names, ignoring case and spaces', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  expect(names(listExercises(db, { search: 'przysiad' })).sort()).toEqual([
    'Back squat',
    'Bulgarian split squat',
  ]);
  expect(names(listExercises(db, { search: '  BENCH  ' }))).toContain('Bench press');
});

test('search folds Polish letters ("ŁAWCE" finds "…na ławce płaskiej")', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  expect(names(listExercises(db, { search: 'ŁAWCE' }))).toEqual(
    expect.arrayContaining(['Bench press', 'Single-arm dumbbell bench press']),
  );
});

test('the pattern filter returns only that pattern, sorted by English name', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const kd = listExercises(db, { pattern: 'KD' });
  expect(kd.length).toBeGreaterThan(0);
  expect(kd.every((e) => e.pattern === 'KD')).toBe(true);
  expect(names(kd)).toEqual([...names(kd)].sort((a, b) => a.localeCompare(b, 'en')));
});

test('getExercise returns the detail with muscles in the seed order', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const id = listExercises(db, { search: 'Overhand pull-up' })[0].id;
  expect(getExercise(db, id)).toMatchObject({
    nameEn: 'Overhand pull-up',
    namePl: 'Podciąganie nachwytem',
    trainingType: 'Strength',
    pattern: 'Pull vertical',
    usesBodyweight: true,
    isCustom: false,
    muscles: ['lats', 'upper back'],
  });
  expect(getExercise(db, 'missing')).toBeNull();
});

test('countByPattern counts every pattern, with 0 for empty ones', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const counts = countByPattern(db);
  expect(counts.Carries).toBe(0);
  expect(counts.HD).toBe(3);
  expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(23);
});

const dips = {
  nameEn: '  dips ',
  namePl: 'Pompki na poręczach',
  trainingType: 'Strength' as const,
  pattern: 'Push vertical' as const,
  usesBodyweight: true,
  muscles: ['chest' as const, 'triceps' as const],
};

test('addCustomExercise saves a trimmed, custom exercise with its muscles', () => {
  const db = createTestDb();
  const id = addCustomExercise(db, dips);
  expect(getExercise(db, id)).toMatchObject({
    nameEn: 'dips',
    namePl: 'Pompki na poręczach',
    isCustom: true,
    usesBodyweight: true,
    muscles: ['chest', 'triceps'],
  });
});

test('addCustomExercise refuses a name that already exists, ignoring case and spaces', () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  addCustomExercise(db, dips);
  expect(() => addCustomExercise(db, { ...dips, nameEn: 'Dips' })).toThrow(DuplicateNameError);
  expect(() => addCustomExercise(db, { ...dips, nameEn: 'bench PRESS' })).toThrow(
    DuplicateNameError,
  );
});

test('addCustomExercise refuses a blank English name, and stores a blank Polish name as none', () => {
  const db = createTestDb();
  expect(() => addCustomExercise(db, { ...dips, nameEn: '   ' })).toThrow();
  const id = addCustomExercise(db, { ...dips, namePl: '  ' });
  expect(getExercise(db, id)!.namePl).toBeNull();
});
