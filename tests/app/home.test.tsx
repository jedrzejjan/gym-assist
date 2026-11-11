import { act, screen } from '@testing-library/react-native';

import Home from '../../app/index';
import { createClient } from '../../data/clients';
import { mutate } from '../../data/live';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import { renderWithDb } from '../renderWithDb';

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

test('Settings is dimmed and disabled until Sprint 2', async () => {
  await renderWithDb(<Home />, answeredDb());
  expect(screen.getByRole('button', { name: /Settings/ })).toBeDisabled();
});
