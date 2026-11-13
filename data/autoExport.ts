// Writing backups: "Export now" and the automatic export after every change to finished data
// (spec section 5, Backup plan; Sprint 2 plan, Task 6). Not a repository: it runs outside any
// screen action and saves its own status with mutate(…, { export: false }).
import { count } from 'drizzle-orm';

import { backupFileName, filesToDelete } from '../domain/backup';
import { todayLocal } from '../domain/dates';
import { exportAll } from './backup';
import type { BackupFolder } from './files';
import { mutate, onWrite } from './live';
import { clients } from './schema';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_LAST_AT,
  BACKUP_LAST_ERROR,
  deleteSetting,
  getSetting,
  setSetting,
} from './settings';
import { type Db, type DbOrTx, nowIso } from './types';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Writes today's backup file (replacing an earlier one from today), keeps the newest 10, and
 * saves the result: `backup.lastAt` on success, `backup.lastError` on failure, which is then
 * rethrown so "Export now" can say so.
 */
export async function writeBackup(db: Db, folder: BackupFolder, today: string): Promise<void> {
  try {
    const text = JSON.stringify(exportAll(db));
    await folder.write(backupFileName(today), text);
    for (const name of filesToDelete(await folder.list())) await folder.remove(name);
  } catch (e) {
    mutate(db, (tx) => setSetting(tx, BACKUP_LAST_ERROR, message(e)), { export: false });
    throw e;
  }
  mutate(
    db,
    (tx) => {
      setSetting(tx, BACKUP_LAST_AT, nowIso());
      deleteSetting(tx, BACKUP_LAST_ERROR);
    },
    { export: false },
  );
}

const hasClients = (db: DbOrTx) => db.select({ n: count() }).from(clients).get()!.n > 0;

export type AutoExport = (() => void) & {
  /** Resolves when no export is running or waiting (for tests and a clean shutdown). */
  idle(): Promise<void>;
};

/**
 * Exports after every write that may change finished data. It skips `export: false` writes, a
 * database with no clients (a fresh install must not overwrite a real backup with an empty one)
 * and the case with no folder chosen (the Home warning covers that, so no lastError). Writes
 * that arrive during an export give one more export, not one each. It never throws. Call the
 * returned function to stop.
 */
export function startAutoExport(db: Db, getFolder: () => BackupFolder | null): AutoExport {
  let running: Promise<void> | null = null;
  let pending = false;

  const run = async () => {
    do {
      pending = false;
      const folder = getFolder();
      if (folder === null || !hasClients(db)) continue;
      try {
        await writeBackup(db, folder, todayLocal(new Date()));
      } catch {
        // writeBackup saved backup.lastError; the trainer sees it on Home and in Settings.
      }
    } while (pending);
  };

  const unsubscribe = onWrite((e) => {
    if (!e.export) return;
    if (running) {
      pending = true;
      return;
    }
    running = run().finally(() => {
      running = null;
    });
  });

  const stop = (() => unsubscribe()) as AutoExport;
  stop.idle = async () => {
    while (running) await running;
  };
  return stop;
}

export type BackupStatus = {
  folderName: string | null;
  lastAt: string | null;
  lastError: string | null;
};

export function backupStatus(db: DbOrTx): BackupStatus {
  return {
    folderName: getSetting(db, BACKUP_FOLDER_NAME),
    lastAt: getSetting(db, BACKUP_LAST_AT),
    lastError: getSetting(db, BACKUP_LAST_ERROR),
  };
}
