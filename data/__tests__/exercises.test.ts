/**
 * @jest-environment node
 */
// Reading and adding exercises on the v2 library (GYM-144, GYM-149).
import {
  addCustomExercise,
  allExerciseNames,
  countByPattern,
  countExercises,
  DuplicateNameError,
  getExercise,
  listExercises,
  type NewExercise,
} from '../exercises';
import { createTestDb } from '../testing/testDb';
import { exerciseId, seedLibrary } from '../testing/library';

const names = (rows: { nameEn: string }[]) => rows.map((r) => r.nameEn);

function library() {
  const db = createTestDb();
  seedLibrary(db);
  return db;
}

test('the list starts with the most common exercises, A to Z, cardio included', () => {
  const db = library();
  const all = listExercises(db, {});
  expect(all).toHaveLength(831);
  expect(names(all.slice(0, 3))).toEqual(['Back Squat', 'Band hop forward and backward', 'Band Pull-Apart']);
  const importance = all.map((e) => e.importance);
  expect(importance).toEqual([...importance].sort((a, b) => a - b));
  expect(all.some((e) => e.pattern === null)).toBe(true);
});

test('a row carries what the lists show: equipment, primary muscles, pattern, subcategory', () => {
  const db = library();
  const pullUp = listExercises(db, { search: 'Pull-Up' }).find((e) => e.nameEn === 'Pull-Up')!;
  expect(pullUp).toMatchObject({
    namePl: 'Podciąganie nachwytem',
    pattern: 'Pull',
    subcategory: 'vertical',
    equipment: 'bodyweight',
    primaryMuscles: ['lats'],
    importance: 1,
    usesBodyweight: true,
    isCustom: false,
  });
});

test('search finds aliases; the alias is reported only when no real name matched', () => {
  const db = library();
  const hits = listExercises(db, { search: 'military' });
  expect(hits).toHaveLength(6);
  expect(hits[0]).toMatchObject({ nameEn: 'Overhead Press', matchedAlias: 'military press' });
  expect(hits.slice(1).every((e) => e.matchedAlias === null)).toBe(true);
  expect(hits.slice(1).map((e) => e.importance)).toEqual([2, 2, 2, 3, 4]);
});

test('search puts names that start with the text first', () => {
  const db = library();
  const hits = listExercises(db, { search: 'deadlift' });
  const firstNot = hits.findIndex((e) => !e.nameEn.toLowerCase().startsWith('deadlift'));
  expect(firstNot).toBeGreaterThan(0);
  expect(hits.slice(firstNot).every((e) => !e.nameEn.toLowerCase().startsWith('deadlift'))).toBe(true);
});

test('search folds Polish letters and ignores case and spaces', () => {
  const db = library();
  expect(names(listExercises(db, { search: 'ŁAW' }))).toEqual(names(listExercises(db, { search: '  ław ' })));
  expect(listExercises(db, { search: 'ław' }).length).toBeGreaterThan(0);
});

test('an old app name finds the renamed exercise', () => {
  const db = library();
  expect(names(listExercises(db, { search: 'Overhand pull-up' }))).toContain('Pull-Up');
});

test('the pattern and subcategory filters; "other" means no subcategory', () => {
  const db = library();
  const push = listExercises(db, { pattern: 'Push' });
  expect(push).toHaveLength(251);
  const vertical = listExercises(db, { pattern: 'Push', subcategory: 'vertical' });
  expect(vertical).toHaveLength(92);
  expect(vertical.every((e) => e.subcategory === 'vertical')).toBe(true);
  const other = listExercises(db, { pattern: 'Push', subcategory: 'other' });
  expect(other).toHaveLength(73);
  expect(other.every((e) => e.pattern === 'Push' && e.subcategory === null)).toBe(true);
});

test('getExercise returns the detail: muscles by role, sides, level, aliases', () => {
  const db = library();
  expect(getExercise(db, exerciseId(db, 'Pull-Up'))).toMatchObject({
    nameEn: 'Pull-Up',
    trainingType: 'Strength',
    pattern: 'Pull',
    subcategory: 'vertical',
    equipment: 'bodyweight',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back', 'forearms'],
    unilateral: false,
    level: 'beginner',
    aliases: expect.arrayContaining(['Overhand pull-up']),
  });
  expect(getExercise(db, exerciseId(db, 'Pause Squat'))!.level).toBeNull();
  expect(getExercise(db, 'missing')).toBeNull();
});

test('countByPattern counts the 5 patterns; cardio is not one', () => {
  const db = library();
  expect(countByPattern(db)).toEqual({ KD: 160, HD: 106, Push: 251, Pull: 203, Core: 95 });
});

test('allExerciseNames lists English names and aliases', () => {
  const db = library();
  const all = allExerciseNames(db);
  expect(all).toContain('Bench Press');
  expect(all).toContain('Treadmill run');
});

const dips: NewExercise = {
  nameEn: '  my ring dips ',
  namePl: 'Pompki na kółkach',
  trainingType: 'Strength',
  pattern: 'Push',
  subcategory: 'vertical',
  equipment: 'bodyweight',
  primaryMuscles: ['chest', 'triceps'],
  unilateral: false,
  usesBodyweight: true,
};

test('addCustomExercise saves a trimmed custom exercise, importance 1, muscles as primary', () => {
  const db = createTestDb();
  const id = addCustomExercise(db, dips);
  expect(getExercise(db, id)).toMatchObject({
    nameEn: 'my ring dips',
    namePl: 'Pompki na kółkach',
    pattern: 'Push',
    subcategory: 'vertical',
    equipment: 'bodyweight',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: [],
    importance: 1,
    isCustom: true,
    usesBodyweight: true,
    level: null,
    aliases: [],
  });
});

test('addCustomExercise refuses a name or an alias that exists, ignoring case and spaces', () => {
  const db = library();
  addCustomExercise(db, dips);
  expect(() => addCustomExercise(db, { ...dips, nameEn: 'MY RING DIPS' })).toThrow(DuplicateNameError);
  expect(() => addCustomExercise(db, { ...dips, nameEn: 'bench PRESS' })).toThrow(DuplicateNameError);
  expect(() => addCustomExercise(db, { ...dips, nameEn: ' military press' })).toThrow(DuplicateNameError);
  expect(countExercises(db)).toBe(832);
});

test('a cardio exercise is saved with no pattern or subcategory', () => {
  const db = createTestDb();
  const id = addCustomExercise(db, {
    ...dips,
    nameEn: 'Rowing sprint',
    trainingType: 'Cardio',
    pattern: 'Push',
    subcategory: 'vertical',
  });
  expect(getExercise(db, id)).toMatchObject({ pattern: null, subcategory: null });
});

test('addCustomExercise refuses what the form never allows', () => {
  const db = createTestDb();
  expect(() => addCustomExercise(db, { ...dips, nameEn: '   ' })).toThrow();
  expect(() => addCustomExercise(db, { ...dips, primaryMuscles: [] })).toThrow();
  expect(() => addCustomExercise(db, { ...dips, pattern: null })).toThrow();
  expect(() => addCustomExercise(db, { ...dips, pattern: 'KD', subcategory: 'vertical' })).toThrow();
  const id = addCustomExercise(db, { ...dips, namePl: '  ' });
  expect(getExercise(db, id)!.namePl).toBeNull();
});
