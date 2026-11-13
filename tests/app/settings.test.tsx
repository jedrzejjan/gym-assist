import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Home from '../../app/index';
import Settings from '../../app/settings/index';
import { createClient } from '../../data/clients';
import { pickFolder } from '../../data/files';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  BACKUP_LAST_AT,
  BACKUP_LAST_ERROR,
  getSetting,
  setSetting,
  WELCOME_DONE,
} from '../../data/settings';
import { createFakeFolder } from '../../data/testing/fakeFolder';
import { createTestDb } from '../../data/testing/testDb';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

// data/files.ts is the only code that touches expo-file-system; here it uses an in-memory folder.
const mockFolder = createFakeFolder('Gym Assist');
jest.mock('../../data/files', () => ({
  pickFolder: jest.fn(),
  openFolder: jest.fn(() => mockFolder),
  pickTextFile: jest.fn(),
}));
const pick = pickFolder as jest.MockedFunction<typeof pickFolder>;

beforeEach(() => {
  mockFolder.files.clear();
  mockFolder.writes = 0;
  pick.mockReset();
});

function setup({ folder = true } = {}) {
  const db = createTestDb();
  setSetting(db, WELCOME_DONE, '1');
  createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  if (folder) {
    setSetting(db, BACKUP_FOLDER_URI, 'content://tree/gym');
    setSetting(db, BACKUP_FOLDER_NAME, 'Gym Assist');
  }
  return db;
}

const button = (name: RegExp | string) => screen.getByRole('button', { name });

test('Settings shows the folder name and "today 18:42", Export writes a file, and with no folder Export asks for one first', async () => {
  fixToday(2026, 11, 12);
  const db = setup();
  setSetting(db, BACKUP_LAST_AT, new Date(2026, 10, 12, 18, 42).toISOString());
  await renderWithDb(<Settings />, db);
  expect(screen.getByText('Settings')).toBeTruthy();
  expect(screen.getByText('Gym Assist · today 18:42')).toBeTruthy();
  expect(screen.getByText('Save a full copy now')).toBeTruthy();

  await fireEvent.press(button(/^Export data \(JSON\)/));
  expect(await screen.findByText('Saved gym-assist-backup-2026-11-12.json')).toBeTruthy();
  expect([...mockFolder.files.keys()]).toEqual(['gym-assist-backup-2026-11-12.json']);
  expect(pick).not.toHaveBeenCalled();
});

test('with no folder, Export asks for one first, saves it, then writes the file', async () => {
  fixToday(2026, 11, 12);
  const db = setup({ folder: false });
  pick.mockResolvedValue({ uri: 'content://tree/new', name: 'Gym Assist' });
  await renderWithDb(<Settings />, db);
  expect(screen.getByText('Not chosen · tap to choose')).toBeTruthy();
  await fireEvent.press(button(/^Export data \(JSON\)/));
  expect(await screen.findByText('Saved gym-assist-backup-2026-11-12.json')).toBeTruthy();
  expect(pick).toHaveBeenCalledTimes(1);
  expect(getSetting(db, BACKUP_FOLDER_URI)).toBe('content://tree/new');
  expect(mockFolder.files.size).toBe(1);
});

test('cancelling the folder picker on Export writes nothing', async () => {
  const db = setup({ folder: false });
  pick.mockResolvedValue(null);
  await renderWithDb(<Settings />, db);
  await fireEvent.press(button(/^Export data \(JSON\)/));
  await waitFor(() => expect(pick).toHaveBeenCalled());
  expect(mockFolder.files.size).toBe(0);
  expect(getSetting(db, BACKUP_FOLDER_URI)).toBeNull();
});

test('tapping Backup folder chooses a folder and writes no file', async () => {
  const db = setup({ folder: false });
  pick.mockResolvedValue({ uri: 'content://tree/new', name: 'Backups' });
  await renderWithDb(<Settings />, db);
  await fireEvent.press(button(/^Backup folder/));
  expect(await screen.findByText('Backups · no backup yet')).toBeTruthy();
  expect(getSetting(db, BACKUP_FOLDER_NAME)).toBe('Backups');
  expect(mockFolder.files.size).toBe(0);
});

test('choosing a new folder clears an old failure', async () => {
  const db = setup();
  setSetting(db, BACKUP_LAST_ERROR, 'Permission denied');
  pick.mockResolvedValue({ uri: 'content://tree/new', name: 'Backups' });
  await renderWithDb(<Settings />, db);
  expect(screen.getByText('Last backup failed: check the folder')).toBeTruthy();
  await fireEvent.press(button(/^Backup folder/));
  expect(await screen.findByText('Backups · no backup yet')).toBeTruthy();
  expect(getSetting(db, BACKUP_LAST_ERROR)).toBeNull();
});

test('a failed export says so', async () => {
  const db = setup();
  mockFolder.failWrites = true;
  try {
    await renderWithDb(<Settings />, db);
    await fireEvent.press(button(/^Export data \(JSON\)/));
    expect(await screen.findByText('Export failed: Permission denied')).toBeTruthy();
    expect(screen.getByText('Last backup failed: check the folder')).toBeTruthy();
  } finally {
    mockFolder.failWrites = false;
  }
});

test('Import history and Restore are both available', async () => {
  await renderWithDb(<Settings />, setup());
  expect(button(/^Import history \(CSV\)/)).toBeEnabled();
  expect(button(/^Restore from backup/)).toBeEnabled();
});

test('the Settings tile on Home opens Settings', async () => {
  await renderWithDb(<Home />, setup());
  await fireEvent.press(screen.getByText('Settings'));
  expect(mockRouter.push).toHaveBeenCalledWith('/settings');
});
