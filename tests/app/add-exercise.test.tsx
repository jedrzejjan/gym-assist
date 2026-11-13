import { fireEvent, screen, within } from '@testing-library/react-native';

import AddExercise from '../../app/library/add';
import { countExercises, getExercise, listExercises, seedExercises } from '../../data/exercises';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { createTestDb } from '../../data/testing/testDb';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

const save = () => screen.getByRole('button', { name: 'Save exercise' });
const pick = async (group: string, option: string) =>
  fireEvent.press(
    within(screen.getByTestId(`chips:${group}`)).getByRole('radio', { name: option }),
  );

async function fillRequired(name = 'Dips') {
  await fireEvent.changeText(screen.getByLabelText('English name *'), name);
  await pick('Training type *', 'Strength');
  await pick('Pattern *', 'Push vertical');
}

test('Save exercise stays disabled until name, training type and pattern are set', async () => {
  await renderWithDb(<AddExercise />);
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Dips');
  await pick('Training type *', 'Strength');
  expect(save()).toBeDisabled();
  await pick('Pattern *', 'Push vertical');
  expect(save()).toBeEnabled();
});

test('"none" is an allowed pattern, and KD shows as Knee Dominant', async () => {
  await renderWithDb(<AddExercise />);
  const patterns = within(screen.getByTestId('chips:Pattern *'));
  expect(patterns.getByRole('radio', { name: 'none' })).toBeTruthy();
  expect(patterns.getByRole('radio', { name: 'Knee Dominant' })).toBeTruthy();
});

test('saving stores the exercise with muscles and body weight, then goes back', async () => {
  const { db } = await renderWithDb(<AddExercise />);
  await fillRequired();
  await fireEvent.changeText(screen.getByLabelText('Polish name'), 'Pompki na poręczach');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chest' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Triceps' }));
  await pick('Uses body weight', 'Yes');
  await fireEvent.press(save());
  const id = listExercises(db, { search: 'Dips' })[0].id;
  expect(getExercise(db, id)).toMatchObject({
    nameEn: 'Dips',
    namePl: 'Pompki na poręczach',
    trainingType: 'Strength',
    pattern: 'Push vertical',
    usesBodyweight: true,
    isCustom: true,
    muscles: ['chest', 'triceps'],
  });
  expect(mockRouter.back).toHaveBeenCalled();
});

test('a name that already exists shows the message and saves nothing', async () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  await renderWithDb(<AddExercise />, db);
  await fillRequired('bench PRESS');
  await fireEvent.press(save());
  expect(screen.getByText('An exercise with this name already exists')).toBeTruthy();
  expect(countExercises(db)).toBe(23); // nothing was added
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('the form does not ask for a category', async () => {
  await renderWithDb(<AddExercise />);
  expect(screen.queryByText(/Category/)).toBeNull();
});

test('the required note from the design is shown', async () => {
  await renderWithDb(<AddExercise />);
  expect(screen.getByText('* required · the English name must be unique')).toBeTruthy();
});

test('a double tap on Save exercise saves once', async () => {
  const { db } = await renderWithDb(<AddExercise />);
  await fillRequired();
  await fireEvent.press(save());
  await fireEvent.press(save());
  expect(countExercises(db)).toBe(1);
});

test('the duplicate message clears as soon as the name changes', async () => {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  await renderWithDb(<AddExercise />, db);
  await fillRequired('Deadlift');
  await fireEvent.press(save());
  expect(screen.getByText('An exercise with this name already exists')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Deadlift 2');
  expect(screen.queryByText('An exercise with this name already exists')).toBeNull();
});
