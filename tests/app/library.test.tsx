import { fireEvent, screen } from '@testing-library/react-native';
import { sql } from 'drizzle-orm';

import ExerciseDetailScreen from '../../app/library/[id]';
import Library from '../../app/library/index';
import { listExercises, seedExercises } from '../../data/exercises';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { createTestDb } from '../../data/testing/testDb';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function seededDb() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  return db;
}

test('the list shows each exercise with its Polish name and pattern', async () => {
  await renderWithDb(<Library />, seededDb());
  expect(screen.getByText('Back squat')).toBeTruthy();
  expect(screen.getByText('Przysiad ze sztangą · Knee Dominant')).toBeTruthy();
});

test('a bodyweight exercise shows BW, and a custom one is marked custom', async () => {
  const db = seededDb();
  db.run(
    sql`INSERT INTO exercises (id, name_en, name_pl, category, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
        VALUES ('dips', 'Dips', 'Pompki na poręczach', 'Push', 'Strength', 'Push vertical', 1, 1, 'x', 'x')`,
  );
  await renderWithDb(<Library />, db);
  expect(screen.getByText('Podciąganie nachwytem · BW')).toBeTruthy();
  expect(screen.getByText('Pompki na poręczach · BW · custom')).toBeTruthy();
});

test('a pattern chip filters the list, and All brings everything back', async () => {
  await renderWithDb(<Library />, seededDb());
  await fireEvent.press(screen.getByRole('radio', { name: 'Hip Dominant' }));
  expect(screen.getByText('Deadlift')).toBeTruthy();
  expect(screen.queryByText('Back squat')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
  expect(screen.getByText('Back squat')).toBeTruthy();
});

test('search finds Polish names, and an unknown word shows the empty state', async () => {
  await renderWithDb(<Library />, seededDb());
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'martwy');
  expect(screen.getByText('Deadlift')).toBeTruthy();
  expect(screen.queryByText('Back squat')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'xyz');
  expect(screen.getByText('No exercises match "xyz".')).toBeTruthy();
  expect(screen.getByText('Check the spelling, or search in English or Polish.')).toBeTruthy();
});

test('tapping an exercise opens its detail', async () => {
  const db = seededDb();
  await renderWithDb(<Library />, db);
  await fireEvent.press(screen.getByText('Back squat'));
  const id = listExercises(db, { search: 'Back squat' })[0].id;
  expect(mockRouter.push).toHaveBeenCalledWith(`/library/${id}`);
});

test('the detail shows every field, and says seed exercises are read-only', async () => {
  const db = seededDb();
  mockParams.current = { id: listExercises(db, { search: 'Overhand pull-up' })[0].id };
  await renderWithDb(<ExerciseDetailScreen />, db);
  for (const text of [
    'Overhand pull-up',
    'Podciąganie nachwytem',
    'Pull',
    'Strength',
    'Pull vertical',
    'Lats, upper back',
    'Uses body weight',
    'Yes · added load is typed',
    'Exercises installed with the app are read-only.',
  ]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
});

test('a non-bodyweight exercise says No, and KD shows as Knee Dominant', async () => {
  const db = seededDb();
  mockParams.current = { id: listExercises(db, { search: 'Back squat' })[0].id };
  await renderWithDb(<ExerciseDetailScreen />, db);
  expect(screen.getByText('No')).toBeTruthy();
  expect(screen.getAllByText('Knee Dominant').length).toBeGreaterThan(0);
});

test('the pattern chips are radios: one is checked, and tapping it again keeps it checked', async () => {
  await renderWithDb(<Library />, seededDb());
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Hip Dominant' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hip Dominant' }));
  expect(screen.getByRole('radio', { name: 'Hip Dominant' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked();
});

test('a pattern with no exercises says so', async () => {
  await renderWithDb(<Library />, seededDb());
  await fireEvent.press(screen.getByRole('radio', { name: 'Carries' }));
  expect(screen.getByText('No exercises for this pattern yet.')).toBeTruthy();
});

test('"+ Add exercise" opens the Add exercise page', async () => {
  await renderWithDb(<Library />, seededDb());
  await fireEvent.press(screen.getByRole('button', { name: '+ Add exercise' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/library/add');
});
