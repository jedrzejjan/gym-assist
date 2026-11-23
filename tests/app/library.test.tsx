// Boards `library / list` and `library / detail` on the v2 library (GYM-149).
import { fireEvent, screen } from '@testing-library/react-native';

import ExerciseDetailScreen from '../../app/library/[id]';
import Library from '../../app/library/index';
import { addCustomExercise } from '../../data/exercises';
import { exerciseId, seededTestDb } from '../../data/testing/library';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

test('the list starts with the most common exercises: Polish name · pattern · equipment', async () => {
  await renderWithDb(<Library />, seededTestDb());
  expect(screen.getByText('Back Squat')).toBeTruthy();
  expect(screen.getByText('Przysiad ze sztangą · Knee dominant · Barbell')).toBeTruthy();
});

test('an exercise the trainer added lists first, with no "custom" mark', async () => {
  const db = seededTestDb();
  addCustomExercise(db, {
    nameEn: 'Aaa landmine press',
    namePl: 'Wyciskanie landmine',
    trainingType: 'Strength',
    pattern: 'Push',
    subcategory: 'vertical',
    equipment: 'barbell',
    primaryMuscles: ['shoulders'],
    unilateral: true,
    usesBodyweight: false,
  });
  await renderWithDb(<Library />, db);
  expect(screen.getByText('Wyciskanie landmine · Push · Barbell')).toBeTruthy();
  expect(screen.queryByText(/custom/)).toBeNull();
});

test('All plus the 5 pattern chips; a chip filters the list, All brings everything back', async () => {
  await renderWithDb(<Library />, seededTestDb());
  for (const name of ['All', 'Knee dominant', 'Hip dominant', 'Push', 'Pull', 'Core']) {
    expect(screen.getByRole('radio', { name })).toBeTruthy();
  }
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Core' }));
  expect(screen.getByText('Cable Crunch')).toBeTruthy();
  expect(screen.queryByText('Back Squat')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
  expect(screen.getByText('Back Squat')).toBeTruthy();
});

test('search finds Polish names and other names; an unknown word shows the empty state', async () => {
  await renderWithDb(<Library />, seededTestDb());
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Overhand pull-up');
  expect(screen.getByText('Pull-Up')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'ławce płaskiej');
  expect(screen.getByText('Bench Press')).toBeTruthy();
  expect(screen.queryByText('Back Squat')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'xyz');
  expect(screen.getByText('No exercises match "xyz".')).toBeTruthy();
  expect(
    screen.getByText('Check the spelling, or try another name, in English or Polish.'),
  ).toBeTruthy();
});

test('tapping an exercise opens its detail', async () => {
  const db = seededTestDb();
  await renderWithDb(<Library />, db);
  await fireEvent.press(screen.getByText('Back Squat'));
  expect(mockRouter.push).toHaveBeenCalledWith(`/library/${exerciseId(db, 'Back Squat')}`);
});

test('the detail shows the fields in the owner order (board library / detail)', async () => {
  const db = seededTestDb();
  mockParams.current = { id: exerciseId(db, 'Pull-Up') };
  await renderWithDb(<ExerciseDetailScreen />, db);
  const pairs = [
    ['Training type', 'Strength'],
    ['Pattern', 'Pull · vertical'],
    ['Equipment', 'Bodyweight'],
    ['Primary muscles', 'Lats'],
    ['Secondary muscles', 'Biceps, upper back, forearms'],
    ['Sides', 'Bilateral'],
    ['Level', 'Beginner'],
  ];
  for (const [label, value] of pairs) {
    expect(screen.getByLabelText(`${label}: ${value}`)).toBeTruthy();
  }
  expect(screen.getByText('Podciąganie nachwytem')).toBeTruthy();
  expect(screen.getByText('Exercises installed with the app are read-only.')).toBeTruthy();
  for (const gone of ['Mechanic', 'Uses body weight', 'Also called', 'Category']) {
    expect(screen.queryByText(gone)).toBeNull();
  }
});

test('the detail hides empty rows: no level, no subcategory, no secondary muscles', async () => {
  const db = seededTestDb();
  mockParams.current = { id: exerciseId(db, 'Back Squat') };
  await renderWithDb(<ExerciseDetailScreen />, db);
  expect(screen.getByLabelText('Pattern: Knee dominant')).toBeTruthy();
  mockParams.current = { id: exerciseId(db, 'Bench Press') };
  await renderWithDb(<ExerciseDetailScreen />, db);
  expect(screen.queryByText('Level')).toBeNull();
});

test('a cardio exercise reads Cardio as its pattern', async () => {
  const db = seededTestDb();
  mockParams.current = { id: exerciseId(db, 'Running, Treadmill') };
  await renderWithDb(<ExerciseDetailScreen />, db);
  expect(screen.getByLabelText('Pattern: Cardio')).toBeTruthy();
});

test('"+ Add exercise" opens the Add exercise page', async () => {
  await renderWithDb(<Library />, seededTestDb());
  await fireEvent.press(screen.getByRole('button', { name: '+ Add exercise' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/library/add');
});
