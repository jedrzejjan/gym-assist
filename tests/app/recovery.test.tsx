import { fireEvent, screen } from '@testing-library/react-native';

import RecoveryTab from '../../app/clients/[id]/recovery';
import { createClient } from '../../data/clients';
import { addExerciseToSession, addSet, finishSession, startSession } from '../../data/sessions';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';
import { exerciseId, seededTestDb } from '../../data/testing/library';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function setup() {
  const db = seededTestDb();
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const ex = (name: string) => exerciseId(db, name);
  return { db, anna, ex };
}

function log(db: Db, clientId: string, date: string, exerciseIds: string[]) {
  const sid = startSession(db, clientId, date);
  for (const id of exerciseIds)
    addSet(db, addExerciseToSession(db, sid, id), { weightKg: 50, reps: 5 });
  finishSession(db, sid);
}

test('Patterns shows the 5 patterns; the Muscles chip switches to primary muscles only', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  log(s.db, s.anna, '2026-11-06', [s.ex('Back squat')]); // KD; primary quadriceps
  log(s.db, s.anna, '2026-11-10', [s.ex('Deadlift')]); // HD; primary hamstrings
  log(s.db, s.anna, '2026-11-11', [s.ex('Bench press')]); // Push; primary chest
  log(s.db, s.anna, '2026-11-12', [s.ex('Overhead press')]); // Push; primary shoulders
  mockParams.current = { id: s.anna };
  await renderWithDb(<RecoveryTab />, s.db);

  expect(screen.getByRole('tab', { name: 'Recovery' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Patterns' })).toBeChecked();
  expect(screen.getByLabelText('Knee dominant, due · 6 days ago')).toBeTruthy();
  expect(
    screen.getByLabelText('Hip dominant, in supercompensation window (48–72 h) · 2 days ago'),
  ).toBeTruthy();
  // Push: bench press yesterday, overhead press today; the later one counts.
  expect(screen.getByLabelText('Push, recovering, too soon · today')).toBeTruthy();
  expect(screen.getByLabelText('Pull, never logged')).toBeTruthy();
  expect(screen.getByLabelText('Core, never logged')).toBeTruthy();
  expect(screen.queryByText('Glutes')).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'Muscles' }));
  expect(screen.getByRole('radio', { name: 'Muscles' })).toBeChecked();
  expect(screen.getByLabelText('Quadriceps, due · 6 days ago')).toBeTruthy();
  expect(screen.getByLabelText('Chest, recovering, too soon · 1 day ago')).toBeTruthy();
  // Secondary muscles don't count (GYM-149): glutes and triceps were only helpers.
  expect(screen.getByLabelText('Glutes, never logged')).toBeTruthy();
  expect(screen.getByLabelText('Triceps, never logged')).toBeTruthy();
  expect(screen.queryByText('Knee dominant')).toBeNull();
});

test('a client with no sessions shows "never logged" everywhere', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  mockParams.current = { id: s.anna };
  await renderWithDb(<RecoveryTab />, s.db);
  expect(screen.getAllByText('never logged')).toHaveLength(5);
  await fireEvent.press(screen.getByRole('radio', { name: 'Muscles' }));
  expect(screen.getAllByText('never logged')).toHaveLength(16);
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
