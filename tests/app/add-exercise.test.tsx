// Boards `library / add exercise` and `- muscles open` (GYM-149).
import { fireEvent, screen } from '@testing-library/react-native';

import AddExercise from '../../app/library/add';
import { countExercises, getExercise, listExercises } from '../../data/exercises';
import { seededTestDb } from '../../data/testing/library';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

const save = () => screen.getByRole('button', { name: 'Save exercise' });
const field = (label: string) =>
  screen.queryByRole('button', { name: new RegExp(`^${label.replace('*', '\\*')}, `) });

async function choose(label: string, option: string) {
  await fireEvent.press(field(label)!);
  await fireEvent.press(screen.getByRole('radio', { name: option }));
}

async function tick(label: string, options: string[]) {
  await fireEvent.press(field(label)!);
  for (const o of options) await fireEvent.press(screen.getByRole('checkbox', { name: o }));
  await fireEvent.press(screen.getByRole('button', { name: `Done (${options.length})` }));
}

async function fillRequired(name = 'Landmine press') {
  await fireEvent.changeText(screen.getByLabelText('English name *'), name);
  await choose('Training type *', 'Strength');
  await choose('Pattern *', 'Push');
  await choose('Equipment *', 'Barbell');
  await tick('Primary muscles *', ['Shoulders']);
}

test('Save stays disabled until name, training type, pattern, equipment and a muscle are set', async () => {
  await renderWithDb(<AddExercise />);
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Landmine press');
  await choose('Training type *', 'Strength');
  await choose('Pattern *', 'Push');
  await choose('Equipment *', 'Barbell');
  expect(save()).toBeDisabled();
  await tick('Primary muscles *', ['Shoulders']);
  expect(save()).toBeEnabled();
});

test('the pattern offers the 5 patterns', async () => {
  await renderWithDb(<AddExercise />);
  await fireEvent.press(field('Pattern *')!);
  for (const p of ['Knee dominant', 'Hip dominant', 'Push', 'Pull', 'Core']) {
    expect(screen.getByRole('radio', { name: p })).toBeTruthy();
  }
});

test('Subcategory shows for Push, Pull and Core only, and a pattern change clears it', async () => {
  await renderWithDb(<AddExercise />);
  expect(field('Subcategory')).toBeNull();
  await choose('Pattern *', 'Push');
  await choose('Subcategory', 'Vertical');
  expect(field('Subcategory')).toHaveProp('accessibilityLabel', 'Subcategory, Vertical');
  await choose('Pattern *', 'Core');
  expect(field('Subcategory')).toHaveProp('accessibilityLabel', 'Subcategory, -');
  await fireEvent.press(field('Subcategory')!);
  expect(screen.getByRole('radio', { name: 'Anti-rotation' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close list' }));
  await choose('Pattern *', 'Knee dominant');
  expect(field('Subcategory')).toBeNull();
});

test('Cardio hides the pattern and saves without one', async () => {
  const { db } = await renderWithDb(<AddExercise />);
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Rowing sprint');
  await choose('Training type *', 'Cardio');
  expect(field('Pattern *')).toBeNull();
  await choose('Equipment *', 'Machine');
  await tick('Primary muscles *', ['Upper back']);
  await fireEvent.press(save());
  expect(getExercise(db, listExercises(db, { search: 'Rowing sprint' })[0].id)).toMatchObject({
    pattern: null,
    subcategory: null,
    trainingType: 'Cardio',
  });
});

test('saving stores every field, importance 1, then goes back', async () => {
  const { db } = await renderWithDb(<AddExercise />);
  await fillRequired();
  await fireEvent.changeText(screen.getByLabelText('Polish name'), 'Wyciskanie landmine');
  await choose('Subcategory', 'Vertical');
  await fireEvent.press(screen.getByRole('radio', { name: 'Unilateral: Yes' }));
  await fireEvent.press(save());
  const id = listExercises(db, { search: 'Landmine press' })[0].id;
  expect(getExercise(db, id)).toMatchObject({
    nameEn: 'Landmine press',
    namePl: 'Wyciskanie landmine',
    trainingType: 'Strength',
    pattern: 'Push',
    subcategory: 'vertical',
    equipment: 'barbell',
    primaryMuscles: ['shoulders'],
    unilateral: true,
    usesBodyweight: false,
    importance: 1,
    isCustom: true,
  });
  expect(mockRouter.back).toHaveBeenCalled();
});

test('a name that exists, or is another name of an exercise, saves nothing', async () => {
  const db = seededTestDb();
  await renderWithDb(<AddExercise />, db);
  await fillRequired('military PRESS');
  await fireEvent.press(save());
  expect(screen.getByText('An exercise with this name already exists')).toBeTruthy();
  expect(countExercises(db)).toBe(831);
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('the duplicate message clears as soon as the name changes', async () => {
  await renderWithDb(<AddExercise />, seededTestDb());
  await fillRequired('Deadlift');
  await fireEvent.press(save());
  expect(screen.getByText('An exercise with this name already exists')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Deadlift 2');
  expect(screen.queryByText('An exercise with this name already exists')).toBeNull();
});

test('the footnote from the design is shown', async () => {
  await renderWithDb(<AddExercise />);
  expect(
    screen.getByText(
      '* required · Primary muscles: pick one or more · Subcategory only for Push, Pull and Core · no pattern for Cardio',
    ),
  ).toBeTruthy();
});

test('a double tap on Save exercise saves once', async () => {
  const { db } = await renderWithDb(<AddExercise />);
  await fillRequired();
  await fireEvent.press(save());
  await fireEvent.press(save());
  expect(countExercises(db)).toBe(1);
});
