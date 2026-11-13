/**
 * @jest-environment node
 */
import { backupStatus, startAutoExport, writeBackup } from '../autoExport';
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { mutate } from '../live';
import { addWeight } from '../measurements';
import { SEED_EXERCISES } from '../seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../sessions';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  BACKUP_LAST_ERROR,
  getSetting,
  setSetting,
} from '../settings';
import { createFakeFolder } from '../testing/fakeFolder';
import { createTestDb } from '../testing/testDb';

const TODAY_FILE = (d: string) => `gym-assist-backup-${d}.json`;

function setup(withClient = true) {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = withClient
    ? createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' })
    : '';
  const folder = createFakeFolder();
  return { db, anna, folder };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('writeBackup', () => {
  test('two exports on one day leave one file', async () => {
    const { db, folder } = setup();
    await writeBackup(db, folder, '2026-11-12');
    await writeBackup(db, folder, '2026-11-12');
    expect([...folder.files.keys()]).toEqual([TODAY_FILE('2026-11-12')]);
    expect(JSON.parse(folder.files.get(TODAY_FILE('2026-11-12'))!).app).toBe('gym-assist');
  });

  test("writing over today's file with shorter text leaves exactly the new text", async () => {
    const { db, folder } = setup();
    folder.files.set(TODAY_FILE('2026-11-12'), 'x'.repeat(10_000_000));
    await writeBackup(db, folder, '2026-11-12');
    const text = folder.files.get(TODAY_FILE('2026-11-12'))!;
    expect(text.length).toBeLessThan(10_000_000);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('keeps the newest 10 backup files and leaves other files alone', async () => {
    const { db, folder } = setup();
    for (let d = 1; d <= 11; d++) {
      folder.files.set(TODAY_FILE(`2026-11-${String(d).padStart(2, '0')}`), '{}');
    }
    folder.files.set('notes.txt', 'mine');
    await writeBackup(db, folder, '2026-11-12');
    const names = [...folder.files.keys()].sort();
    expect(names).toHaveLength(11); // 10 backups + notes.txt
    expect(names).toContain('notes.txt');
    expect(names).not.toContain(TODAY_FILE('2026-11-01'));
    expect(names).not.toContain(TODAY_FILE('2026-11-02'));
    expect(names).toContain(TODAY_FILE('2026-11-12'));
  });

  test('success stores lastAt and clears lastError; a failure stores lastError and rethrows', async () => {
    const { db, folder } = setup();
    folder.failWrites = true;
    await expect(writeBackup(db, folder, '2026-11-12')).rejects.toThrow('Permission denied');
    expect(backupStatus(db).lastError).toBe('Permission denied');
    folder.failWrites = false;
    await writeBackup(db, folder, '2026-11-12');
    expect(backupStatus(db)).toMatchObject({ lastError: null });
    expect(backupStatus(db).lastAt).not.toBeNull();
  });
});

describe('startAutoExport', () => {
  test('auto-export runs after finishSession and a weight change, not after an export: false write', async () => {
    const { db, anna, folder } = setup();
    const auto = startAutoExport(db, () => folder);
    const squat = listExercises(db, { search: 'Back squat' })[0].id;
    // draft-only writes, as the screens make them
    const sid = mutate(db, (tx) => startSession(tx, anna, '2026-11-12'), { export: false });
    const se = mutate(db, (tx) => addExerciseToSession(tx, sid, squat), { export: false });
    mutate(db, (tx) => addSet(tx, se, { weightKg: 80, reps: 5 }), { export: false });
    await auto.idle();
    expect(folder.writes).toBe(0);

    mutate(db, (tx) => finishSession(tx, sid));
    await auto.idle();
    expect(folder.writes).toBe(1);
    expect([...folder.files.keys()]).toEqual([TODAY_FILE(today())]);

    mutate(db, (tx) => addWeight(tx, anna, '2026-11-12', 63, { replace: false }));
    await auto.idle();
    expect(folder.writes).toBe(2);
    auto();
  });

  test('one write gives exactly one export', async () => {
    const { db, folder } = setup();
    const auto = startAutoExport(db, () => folder);
    mutate(db, (tx) => setSetting(tx, 'something', '1'));
    await auto.idle();
    await auto.idle();
    expect(folder.writes).toBe(1); // saving lastAt (export: false) didn't start another
    auto();
  });

  test('writes that arrive while an export runs give one more export, not one each', async () => {
    const { db, folder } = setup();
    const auto = startAutoExport(db, () => folder);
    mutate(db, (tx) => setSetting(tx, 'a', '1'));
    mutate(db, (tx) => setSetting(tx, 'b', '1'));
    mutate(db, (tx) => setSetting(tx, 'c', '1'));
    await auto.idle();
    expect(folder.writes).toBe(2);
    auto();
  });

  test('choosing a folder writes no file', async () => {
    const { db, folder } = setup();
    const auto = startAutoExport(db, () => folder);
    mutate(
      db,
      (tx) => {
        setSetting(tx, BACKUP_FOLDER_URI, 'content://tree/x');
        setSetting(tx, BACKUP_FOLDER_NAME, 'Gym Assist');
      },
      { export: false },
    );
    await auto.idle();
    expect(folder.writes).toBe(0);
    auto();
  });

  test('an empty database (no clients) is never exported automatically; Export now still writes it', async () => {
    const { db, folder } = setup(false);
    const auto = startAutoExport(db, () => folder);
    mutate(db, (tx) => setSetting(tx, 'x', '1'));
    await auto.idle();
    expect(folder.writes).toBe(0);
    await writeBackup(db, folder, '2026-11-12'); // the Export button calls this directly
    expect(folder.writes).toBe(1);
    auto();
  });

  test('with no folder, auto-export writes nothing and sets no lastError', async () => {
    const { db } = setup();
    const auto = startAutoExport(db, () => null);
    mutate(db, (tx) => setSetting(tx, 'x', '1'));
    await auto.idle();
    expect(getSetting(db, BACKUP_LAST_ERROR)).toBeNull();
    auto();
  });

  test('a folder write that fails stores lastError and does not throw', async () => {
    const { db, folder } = setup();
    folder.failWrites = true;
    const auto = startAutoExport(db, () => folder);
    mutate(db, (tx) => setSetting(tx, 'x', '1'));
    await expect(auto.idle()).resolves.toBeUndefined();
    expect(backupStatus(db).lastError).toBe('Permission denied');
    auto();
  });

  test('after stop, writes no longer export', async () => {
    const { db, folder } = setup();
    const auto = startAutoExport(db, () => folder);
    auto();
    mutate(db, (tx) => setSetting(tx, 'x', '1'));
    await auto.idle();
    expect(folder.writes).toBe(0);
  });
});

test('backupStatus reads the folder name, last backup time and last error', () => {
  const { db } = setup();
  expect(backupStatus(db)).toEqual({ folderName: null, lastAt: null, lastError: null });
  setSetting(db, BACKUP_FOLDER_NAME, 'Gym Assist');
  expect(backupStatus(db).folderName).toBe('Gym Assist');
});
