import { act, fireEvent, screen } from '@testing-library/react-native';

import Home from '../../app/index';
import { createClient } from '../../data/clients';
import { seedExercises } from '../../data/exercises';
import { mutate } from '../../data/live';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function answeredDb() {
  const db = createTestDb();
  setSetting(db, WELCOME_DONE, '1');
  return db;
}

test('Home sends a first start to Welcome', async () => {
  await renderWithDb(<Home />);
  expect(screen.getByText('redirect:/welcome')).toBeTruthy();
});

test('Home shows Clients, Settings and Exercise library in that order', async () => {
  await renderWithDb(<Home />, answeredDb());
  const titles = screen
    .getAllByText(/^(Clients|Settings|Exercise library)$/)
    .map((t) => t.props.children);
  expect(titles).toEqual(['Clients', 'Settings', 'Exercise library']);
  expect(screen.getByText('Gym Assist')).toBeTruthy();
});

test('the Clients tile counts clients and refreshes after a new one is saved', async () => {
  const db = answeredDb();
  await renderWithDb(<Home />, db);
  expect(screen.getByText('0 clients')).toBeTruthy();
  await act(async () =>
    mutate(db, (tx) =>
      createClient(tx, { firstName: 'Anna', weightKg: 64, weightDate: '2026-11-11' }),
    ),
  );
  expect(screen.getByText('1 client')).toBeTruthy();
});

test('the Settings tile is enabled and opens Settings (GYM-26)', async () => {
  await renderWithDb(<Home />, answeredDb());
  const tile = screen.getByRole('button', { name: /Settings/ });
  expect(tile).toBeEnabled();
  await fireEvent.press(tile);
  expect(mockRouter.push).toHaveBeenCalledWith('/settings');
});

test('the Exercise library tile counts exercises and opens the library', async () => {
  const db = answeredDb();
  seedExercises(db, SEED_EXERCISES);
  await renderWithDb(<Home />, db);
  expect(screen.getByText('23 exercises')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Exercise library/ }));
  expect(mockRouter.push).toHaveBeenCalledWith('/library');
});
