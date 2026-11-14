import {
  CATEGORIES,
  categoryForPattern,
  displayName,
  exerciseSubtitle,
  MUSCLES,
  muscleList,
  muscleName,
  PATTERNS,
  TRAINING_TYPES,
} from '../catalogue';

test('categoryForPattern derives the hidden category from the pattern (GYM-99)', () => {
  expect(categoryForPattern('KD')).toBe('KD');
  expect(categoryForPattern('HD')).toBe('HD');
  expect(categoryForPattern('Push vertical')).toBe('Push');
  expect(categoryForPattern('Push horizontal')).toBe('Push');
  expect(categoryForPattern('Pull vertical')).toBe('Pull');
  expect(categoryForPattern('Pull horizontal')).toBe('Pull');
  expect(categoryForPattern('Anti flexion')).toBe('Core');
  expect(categoryForPattern('Anti extension')).toBe('Core');
  expect(categoryForPattern('Carries')).toBe('Core');
  expect(categoryForPattern('none')).toBe('Core');
});

test('the fixed lists are exactly those in spec section 5', () => {
  expect(CATEGORIES).toEqual(['KD', 'HD', 'Push', 'Pull', 'Core']);
  expect(TRAINING_TYPES).toEqual(['Strength', 'Plyometric', 'Power', 'Cardio']);
  expect(PATTERNS).toEqual([
    'KD',
    'HD',
    'Push vertical',
    'Push horizontal',
    'Pull vertical',
    'Pull horizontal',
    'Anti flexion',
    'Anti extension',
    'Carries',
    'none',
  ]);
});

test('there are 12 muscles, with Polish names from the legacy tool', () => {
  expect(MUSCLES).toHaveLength(12);
  expect(muscleName('upper back')).toEqual({
    en: 'Upper back',
    pl: 'mięśnie górnej części pleców',
  });
  expect(muscleName('core')).toEqual({ en: 'Core', pl: 'mięśnie tułowia (core)' });
});

test('KD and HD display as Knee Dominant and Hip Dominant; others unchanged', () => {
  expect(displayName('KD')).toBe('Knee Dominant');
  expect(displayName('HD')).toBe('Hip Dominant');
  expect(displayName('Push vertical')).toBe('Push vertical');
  expect(displayName('none')).toBe('none');
});

test('muscleList reads like the design: "Lats, biceps"', () => {
  expect(muscleList(['lats', 'biceps'])).toBe('Lats, biceps');
  expect(muscleList(['upper back', 'lats'])).toBe('Upper back, lats');
  expect(muscleList([])).toBe('-');
});

test('exerciseSubtitle follows the library board: PL name, then pattern or BW, then custom', () => {
  const base = {
    namePl: 'Przysiad ze sztangą',
    pattern: 'KD',
    usesBodyweight: false,
    isCustom: false,
  };
  expect(exerciseSubtitle(base)).toBe('Przysiad ze sztangą · Knee Dominant');
  expect(exerciseSubtitle({ ...base, namePl: 'Podciąganie nachwytem', usesBodyweight: true })).toBe(
    'Podciąganie nachwytem · BW',
  );
  expect(
    exerciseSubtitle({
      ...base,
      namePl: 'Pompki na poręczach',
      usesBodyweight: true,
      isCustom: true,
    }),
  ).toBe('Pompki na poręczach · BW · custom');
  expect(exerciseSubtitle({ ...base, namePl: null, pattern: 'none' })).toBe('none');
});
