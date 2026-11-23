import {
  chooseRowText,
  EQUIPMENT,
  equipmentName,
  LEVELS,
  libraryRowText,
  MECHANICS,
  MUSCLES,
  muscleList,
  muscleName,
  patternName,
  PATTERNS,
  SUBCATEGORIES,
  subcategoryName,
  TRAINING_TYPES,
} from '../catalogue';

test('the 5 patterns, in the owner order (GYM-149)', () => {
  expect(PATTERNS).toEqual(['KD', 'HD', 'Push', 'Pull', 'Core']);
  expect(TRAINING_TYPES).toEqual(['Strength', 'Plyometric', 'Power', 'Cardio']);
});

test('pattern names: KD and HD spelled out, no pattern reads Cardio', () => {
  expect(patternName('KD')).toBe('Knee dominant');
  expect(patternName('HD')).toBe('Hip dominant');
  expect(patternName('Push')).toBe('Push');
  expect(patternName(null)).toBe('Cardio');
});

test('subcategories belong to Push, Pull and Core only', () => {
  expect(SUBCATEGORIES.Push).toEqual(['vertical', 'horizontal']);
  expect(SUBCATEGORIES.Pull).toEqual(['vertical', 'horizontal']);
  expect(SUBCATEGORIES.Core).toEqual(['anti-extension', 'anti-rotation', 'carry']);
  expect(SUBCATEGORIES.KD).toEqual([]);
  expect(SUBCATEGORIES.HD).toEqual([]);
  expect(subcategoryName('vertical')).toBe('Vertical');
  expect(subcategoryName('anti-rotation')).toBe('Anti-rotation');
  expect(subcategoryName(null)).toBe('Other');
});

test('equipment, level and mechanic lists', () => {
  expect(EQUIPMENT).toEqual([
    'barbell',
    'dumbbell',
    'kettlebell',
    'machine',
    'cable',
    'bodyweight',
    'band',
    'other',
  ]);
  expect(equipmentName('barbell')).toBe('Barbell');
  expect(LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
  expect(MECHANICS).toEqual(['compound', 'isolation']);
});

test('16 muscles, each with an English and a Polish name', () => {
  expect(MUSCLES).toHaveLength(16);
  for (const m of ['forearms', 'lower back', 'traps', 'abductors'] as const) {
    expect(MUSCLES).toContain(m);
  }
  for (const m of MUSCLES) {
    expect(muscleName(m).en).not.toBe('');
    expect(muscleName(m).pl).not.toBe('');
  }
  expect(muscleName('upper back')).toEqual({
    en: 'Upper back',
    pl: 'mięśnie górnej części pleców',
  });
});

test('muscleList reads like the design: "Lats, biceps"', () => {
  expect(muscleList(['lats', 'biceps'])).toBe('Lats, biceps');
  expect(muscleList(['lower back'])).toBe('Lower back');
  expect(muscleList([])).toBe('-');
});

test('library row: Polish name · pattern · equipment (board library / list)', () => {
  expect(
    libraryRowText({ namePl: 'Przysiad ze sztangą', pattern: 'KD', equipment: 'barbell' }),
  ).toBe('Przysiad ze sztangą · Knee dominant · Barbell');
  expect(libraryRowText({ namePl: 'Bieżnia', pattern: null, equipment: 'machine' })).toBe(
    'Bieżnia · Cardio · Machine',
  );
  expect(libraryRowText({ namePl: null, pattern: 'Push', equipment: 'cable' })).toBe(
    'Push · Cable',
  );
});

test('choose row: Polish name · equipment · primary muscles, plus the alias hit', () => {
  const base = {
    namePl: 'Wyciskanie sztangi nad głowę',
    equipment: 'barbell' as const,
    primaryMuscles: ['shoulders' as const],
  };
  expect(chooseRowText(base)).toBe('Wyciskanie sztangi nad głowę · Barbell · Shoulders');
  expect(chooseRowText({ ...base, matchedAlias: 'military press' })).toBe(
    'Wyciskanie sztangi nad głowę · Barbell · Shoulders · also: military press',
  );
  expect(chooseRowText({ ...base, namePl: null, matchedAlias: null })).toBe(
    'Barbell · Shoulders',
  );
});
