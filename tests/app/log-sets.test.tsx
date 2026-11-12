// The exercise screen: add, edit and delete sets, kg | %, and body weight (GYM-20).
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import SessionPage from '../../app/session/[id]/index';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { DbProvider } from '../../data/live';
import { addWeight } from '../../data/measurements';
import { oneRepMaxes } from '../../data/schema';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import {
  addExerciseToSession,
  addSet,
  getSessionExercise,
  listSets,
  startSession,
} from '../../data/sessions';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';

function setup(exercise = 'Bench press', date = '2026-11-10') {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 80,
    weightDate: '2026-10-01',
  });
  addWeight(db, anna, '2026-11-07', 82, { replace: false });
  const exerciseId = listExercises(db, { search: exercise }).find((e) => e.nameEn === exercise)!.id;
  const sid = startSession(db, anna, date);
  const seId = addExerciseToSession(db, sid, exerciseId);
  return { db, anna, exerciseId, sid, seId };
}

function renderExercise(db: Db, sid: string, seId: string) {
  return renderRouter(
    {
      _layout: () => (
        <DbProvider db={db}>
          <Stack screenOptions={{ headerShown: false }} />
        </DbProvider>
      ),
      'session/[id]/index': SessionPage,
      'session/[id]/exercise/[seId]': SessionExercise,
    },
    { initialUrl: `/session/${sid}/exercise/${seId}` },
  );
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const chip = (name: string) => screen.getByRole('radio', { name });
const rows = (db: Db, seId: string) => listSets(db, seId).map((s) => [s.setNo, s.weightKg, s.reps]);

test('typing 22,5 and 8 and tapping "Add set" adds the row "22.5 kg × 8"', async () => {
  const { db, sid, seId } = setup();
  await renderExercise(db, sid, seId);
  expect(screen.getByText('No sets yet.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '22,5');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '8');
  await press('Add set');
  expect(rows(db, seId)).toEqual([[1, 22.5, 8]]);
  expect(screen.getByText('22.5 kg × 8')).toBeTruthy();
  expect(screen.queryByText('No sets yet.')).toBeNull();
});

test('blank weight and reps add a "- × -" set; invalid numbers are refused with a hint', async () => {
  const { db, sid, seId } = setup();
  await renderExercise(db, sid, seId);
  await fireEvent.changeText(screen.getByLabelText('Reps'), '8.5');
  expect(screen.getByText('Reps: a whole number, 1 or more')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add set' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '-5');
  expect(screen.getByText('Weight: a number like 22,5')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Reps'), '');
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '');
  await press('Add set');
  expect(rows(db, seId)).toEqual([[1, null, null]]);
  expect(screen.getByText('- × -')).toBeTruthy();
});

test('without a 1RM the % chip is disabled with a hint', async () => {
  const { db, sid, seId } = setup('Back squat');
  await renderExercise(db, sid, seId);
  expect(chip('%')).toBeDisabled();
  expect(screen.getByText('Set a 1RM in Progress to use %')).toBeTruthy();
});

test('with a 1RM of 60, 85 in % mode saves 51 kg, and % stays on for the next set', async () => {
  const { db, anna, exerciseId, sid, seId } = setup();
  db.insert(oneRepMaxes)
    .values({
      id: 'orm',
      clientId: anna,
      exerciseId,
      valueKg: 60,
      source: 'manual',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    })
    .run();
  await renderExercise(db, sid, seId);
  expect(chip('kg')).toBeChecked();
  await fireEvent.press(chip('%'));
  await fireEvent.changeText(screen.getByLabelText('% of 1RM'), '85');
  expect(screen.getByText('1RM 60 kg (manual, 20 Oct) · 85% = 51 kg')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Reps'), '6');
  await press('Add set');
  expect(rows(db, seId)).toEqual([[1, 51, 6]]);
  expect(chip('%')).toBeChecked();
  // Leaving the exercise and coming back keeps % for this exercise.
  await act(() => router.replace(`/session/${sid}`));
  expect(screen.queryByRole('radio', { name: '%' })).toBeNull(); // the exercise screen is gone
  await act(() => router.push(`/session/${sid}/exercise/${seId}`));
  expect(chip('%')).toBeChecked();
});

test('bodyweight: the line about body weight shows and a set reads "BW + 10 kg × 6"', async () => {
  const { db, sid, seId } = setup('Overhand pull-up', '2026-11-10');
  await renderExercise(db, sid, seId);
  expect(screen.getByText('Body weight 82 kg (7 Nov) is added to the load.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Added (kg)'), '10');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '6');
  await press('Add set');
  await fireEvent.changeText(screen.getByLabelText('Added (kg)'), '');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '8');
  await press('Add set');
  expect(screen.getByText('BW + 10 kg × 6')).toBeTruthy();
  expect(screen.getByText('BW × 8')).toBeTruthy();
});

test('tapping a set edits it: change reps to 10 and save; or delete it', async () => {
  const { db, sid, seId } = setup();
  addSet(db, seId, { weightKg: 60, reps: 8 });
  addSet(db, seId, { weightKg: 60, reps: 8 });
  addSet(db, seId, { weightKg: 62.5, reps: 6 });
  await renderExercise(db, sid, seId);
  await press('Set 2, 60 kg × 8');
  expect(screen.getByText('Edit set 2')).toBeTruthy();
  expect(screen.getByLabelText('Weight (kg)').props.value).toBe('60');
  expect(screen.getByLabelText('Reps').props.value).toBe('8');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '10');
  await press('Save set 2');
  expect(rows(db, seId)).toEqual([
    [1, 60, 8],
    [2, 60, 10],
    [3, 62.5, 6],
  ]);
  expect(screen.queryByText('Edit set 2')).toBeNull();
  await press('Set 2, 60 kg × 10');
  await press('Delete set 2');
  expect(rows(db, seId)).toEqual([
    [1, 60, 8],
    [3, 62.5, 6],
  ]);
  // The next set gets the next number.
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '62,5');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '5');
  await press('Add set');
  expect(rows(db, seId).map((r) => r[0])).toEqual([1, 3, 4]);
});

test('"Finish exercise" marks it finished and goes back to the session page', async () => {
  const { db, sid, seId } = setup();
  await renderExercise(db, sid, seId);
  await press('Finish exercise');
  expect(getSessionExercise(db, seId)!.finishedAt).not.toBeNull();
  expect(screen).toHavePathname(`/session/${sid}`);
  expect(within(screen.getByTestId('session-exercises')).getByText('Bench press')).toBeTruthy();
});
