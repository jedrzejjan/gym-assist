import { act, fireEvent, screen } from '@testing-library/react-native';

import Home from '../../app/index';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { mutate } from '../../data/live';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  BACKUP_LAST_AT,
  BACKUP_LAST_ERROR,
  setSetting,
  WELCOME_DONE,
} from '../../data/settings';
import { addExerciseToSession, startSession } from '../../data/sessions';
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

describe('backup warning (GYM-27, board `home - backup warning`)', () => {
  function withFolder() {
    const db = answeredDb();
    setSetting(db, BACKUP_FOLDER_URI, 'content://tree/gym');
    setSetting(db, BACKUP_FOLDER_NAME, 'Gym Assist');
    return db;
  }

  test('no folder shows "Backups are off: choose a folder"; FIX opens Settings', async () => {
    await renderWithDb(<Home />, answeredDb());
    expect(screen.getByText('Backups are off: choose a folder')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fix backups' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });

  test('a failed last export shows "Last backup failed: check the folder"', async () => {
    const db = withFolder();
    setSetting(db, BACKUP_LAST_ERROR, 'Permission denied');
    await renderWithDb(<Home />, db);
    expect(screen.getByText('Last backup failed: check the folder')).toBeTruthy();
    expect(screen.queryByText('Backups are off: choose a folder')).toBeNull();
  });

  test('no banner after a successful export', async () => {
    const db = withFolder();
    setSetting(db, BACKUP_LAST_AT, '2026-11-12T17:42:00.000Z');
    await renderWithDb(<Home />, db);
    expect(screen.queryByText('Backups are off: choose a folder')).toBeNull();
    expect(screen.queryByText('Last backup failed: check the folder')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fix backups' })).toBeNull();
  });

  test('the banner and the "Session in progress" bar show together', async () => {
    const db = answeredDb();
    seedExercises(db, SEED_EXERCISES);
    const anna = createClient(db, { firstName: 'Anna', weightKg: 64, weightDate: '2026-11-11' });
    const sid = startSession(db, anna, '2026-11-12');
    addExerciseToSession(db, sid, listExercises(db, {})[0].id);
    await renderWithDb(<Home />, db);
    expect(screen.getByText('Backups are off: choose a folder')).toBeTruthy();
    expect(screen.getByText('Session in progress: Anna')).toBeTruthy();
  });
});
