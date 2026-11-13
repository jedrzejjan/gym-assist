import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import RestoreDone from '../../app/settings/restore-done';
import Settings from '../../app/settings/index';
import { exportAll } from '../../data/backup';
import { countClients, createClient, listClients } from '../../data/clients';
import { pickTextFile } from '../../data/files';
import { onWrite } from '../../data/live';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  getSetting,
  setSetting,
  WELCOME_DONE,
} from '../../data/settings';
import { createFakeFolder } from '../../data/testing/fakeFolder';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);
const mockFolder = createFakeFolder('Gym Assist');
jest.mock('../../data/files', () => ({
  pickFolder: jest.fn(),
  openFolder: jest.fn(() => mockFolder),
  pickTextFile: jest.fn(),
}));
const pick = pickTextFile as jest.MockedFunction<typeof pickTextFile>;
const FILE = 'gym-assist-backup-2026-11-09.json';

beforeEach(() => {
  mockFolder.files.clear();
  mockFolder.writes = 0;
  mockFolder.failWrites = false;
  pick.mockReset();
});

/** The backup: 2 clients (Anna, Jan) on another phone. */
function backupText() {
  const db = createTestDb();
  setSetting(db, WELCOME_DONE, '1');
  createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  return JSON.stringify({ ...exportAll(db), exportedAt: '2026-11-09T17:42:00.000Z' });
}

/** This phone: a folder chosen, and one client (Ewa) that the restore replaces. */
function thisPhone({ folder = true, client = true } = {}): Db {
  const db = createTestDb();
  setSetting(db, WELCOME_DONE, '1');
  if (folder) {
    setSetting(db, BACKUP_FOLDER_URI, 'content://tree/gym');
    setSetting(db, BACKUP_FOLDER_NAME, 'Gym Assist');
  }
  if (client) createClient(db, { firstName: 'Ewa', weightKg: 60, weightDate: '2026-11-01' });
  return db;
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function chooseBackup(db: Db, text = backupText()) {
  pick.mockResolvedValue({ name: FILE, text });
  await renderWithDb(<Settings />, db);
  await fireEvent.press(button(/^Restore from backup/));
}

test('the dialog says "This replaces all data in the app with gym-assist-backup-2026-11-09.json."', async () => {
  const db = thisPhone();
  await chooseBackup(db);
  expect(await screen.findByText('Restore from backup?')).toBeTruthy();
  expect(screen.getByText(`This replaces all data in the app with ${FILE}.`)).toBeTruthy();
  await fireEvent.press(button('Cancel'));
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Ewa']); // nothing changed
  expect(mockFolder.files.size).toBe(0);
});

test("restore writes gym-assist-before-restore.json first and does not overwrite today's backup", async () => {
  const db = thisPhone();
  const exports: boolean[] = [];
  const stop = onWrite((e) => exports.push(e.export));
  await chooseBackup(db);
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  stop();

  expect([...mockFolder.files.keys()]).toEqual(['gym-assist-before-restore.json']);
  const safety = JSON.parse(mockFolder.files.get('gym-assist-before-restore.json')!);
  expect(safety.tables.clients.map((c: { firstName: string }) => c.firstName)).toEqual(['Ewa']);
  expect(exports).toEqual([false]); // the restore itself never triggers the automatic export
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Anna', 'Jan']);
  expect(getSetting(db, BACKUP_FOLDER_URI)).toBe('content://tree/gym'); // this phone's folder kept
  expect(mockRouter.push).toHaveBeenCalledWith(
    '/settings/restore-done?date=2026-11-09&clients=2&sessions=0',
  );
});

test('with no folder, restore skips the safety file and still restores', async () => {
  const db = thisPhone({ folder: false });
  await chooseBackup(db);
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled()); // the restore has finished
  expect(countClients(db)).toBe(2);
  expect(mockFolder.writes).toBe(0);
});

test('with no clients (a fresh install), restore skips the safety file and still restores', async () => {
  const db = thisPhone({ client: false });
  await chooseBackup(db);
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  expect(countClients(db)).toBe(2);
  expect(mockFolder.writes).toBe(0);
});

test('a failed safety write stops the restore and changes nothing', async () => {
  const db = thisPhone();
  mockFolder.failWrites = true;
  await chooseBackup(db);
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
  expect(
    await screen.findByText(
      'Nothing was restored: the safety copy could not be written (Permission denied). Check the backup folder.',
    ),
  ).toBeTruthy();
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Ewa']);
  expect(mockRouter.push).not.toHaveBeenCalled();
});

test('a bad file shows its message and changes nothing', async () => {
  const db = thisPhone();
  const older = JSON.stringify({ ...JSON.parse(backupText()), schemaVersion: 0 });
  await chooseBackup(db, older);
  expect(await screen.findByText(/^This backup is from an older version of the app/)).toBeTruthy();
  expect(screen.queryByText('Restore from backup?')).toBeNull();
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Ewa']);
});

test('cancelling the file picker changes nothing and never asks for a folder', async () => {
  const db = thisPhone({ folder: false });
  pick.mockResolvedValue(null);
  await renderWithDb(<Settings />, db);
  await fireEvent.press(button(/^Restore from backup/));
  await waitFor(() => expect(pick).toHaveBeenCalled());
  expect(screen.queryByText('Restore from backup?')).toBeNull();
  expect(getSetting(db, BACKUP_FOLDER_URI)).toBeNull();
});

test('done says "All data now comes from the backup of 9 Nov 2026: 4 clients, 61 sessions." and "Go to clients" opens Clients', async () => {
  mockParams.current = { date: '2026-11-09', clients: '4', sessions: '61' };
  await renderWithDb(<RestoreDone />, createTestDb());
  expect(screen.getByText('Restore done')).toBeTruthy();
  expect(
    screen.getByText('All data now comes from the backup of 9 Nov 2026: 4 clients, 61 sessions.'),
  ).toBeTruthy();
  await fireEvent.press(button('Go to clients'));
  expect(mockRouter.dismissAll).toHaveBeenCalled();
  expect(mockRouter.push).toHaveBeenCalledWith('/clients');
});

test('done uses the singular for one client and one session', async () => {
  mockParams.current = { date: '2026-11-09', clients: '1', sessions: '1' };
  await renderWithDb(<RestoreDone />, createTestDb());
  expect(
    screen.getByText('All data now comes from the backup of 9 Nov 2026: 1 client, 1 session.'),
  ).toBeTruthy();
});
