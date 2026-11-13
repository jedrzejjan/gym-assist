import { fireEvent, screen } from '@testing-library/react-native';

import RecoveryTab from '../../app/clients/[id]/recovery';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../../data/sessions';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, ex };
}

function log(db: Db, clientId: string, date: string, exerciseIds: string[]) {
  const sid = startSession(db, clientId, date);
  for (const id of exerciseIds)
    addSet(db, addExerciseToSession(db, sid, id), { weightKg: 50, reps: 5 });
  finishSession(db, sid);
}

test('Patterns shows "Knee Dominant" / "due · 6 days ago"; the Muscles chip switches the list', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  log(s.db, s.anna, '2026-11-06', [s.ex('Back squat')]); // KD; quadriceps, glutes
  log(s.db, s.anna, '2026-11-10', [s.ex('Deadlift')]); // HD; glutes, hamstrings
  log(s.db, s.anna, '2026-11-11', [s.ex('Bench press')]); // Push horizontal
  log(s.db, s.anna, '2026-11-12', [s.ex('Overhead press')]); // Push vertical
  mockParams.current = { id: s.anna };
  await renderWithDb(<RecoveryTab />, s.db);

  expect(screen.getByRole('tab', { name: 'Recovery' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Patterns' })).toBeChecked();
  expect(screen.getByLabelText('Knee Dominant, due · 6 days ago')).toBeTruthy();
  expect(
    screen.getByLabelText('Hip Dominant, in supercompensation window (48–72 h) · 2 days ago'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Push horizontal, recovering, too soon · 1 day ago')).toBeTruthy();
  expect(screen.getByLabelText('Push vertical, recovering, too soon · today')).toBeTruthy();
  expect(screen.getByLabelText('Carries, never logged')).toBeTruthy();
  expect(screen.queryByText('none')).toBeNull();
  expect(screen.queryByText('Glutes')).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'Muscles' }));
  expect(screen.getByRole('radio', { name: 'Muscles' })).toBeChecked();
  // glutes: squat on 6 Nov and deadlift on 10 Nov; the later one counts
  expect(
    screen.getByLabelText('Glutes, in supercompensation window (48–72 h) · 2 days ago'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Quadriceps, due · 6 days ago')).toBeTruthy();
  expect(screen.getByLabelText('Calves, never logged')).toBeTruthy();
  expect(screen.queryByText('Knee Dominant')).toBeNull();
});

test('a client with no sessions shows "never logged" everywhere', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  mockParams.current = { id: s.anna };
  await renderWithDb(<RecoveryTab />, s.db);
  expect(screen.getAllByText('never logged')).toHaveLength(9);
  await fireEvent.press(screen.getByRole('radio', { name: 'Muscles' }));
  expect(screen.getAllByText('never logged')).toHaveLength(12);
});

test('the other tabs replace Recovery', async () => {
  const s = setup();
  mockParams.current = { id: s.anna };
  await renderWithDb(<RecoveryTab />, s.db);
  await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
  expect(mockRouter.replace).toHaveBeenCalledWith(`/clients/${s.anna}/history`);
  await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(mockRouter.replace).toHaveBeenCalledWith(`/clients/${s.anna}`);
});
