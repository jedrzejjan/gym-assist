import { eq } from 'drizzle-orm';

import { appSettings } from './schema';
import { type DbOrTx, nowIso } from './types';

/** Keys stored in app_settings. */
export const WELCOME_DONE = 'welcome_done';
/** The backup folder (GYM-26). These stay with the phone: a restore keeps them (decision 8). */
export const BACKUP_FOLDER_URI = 'backup.folderUri';
export const BACKUP_FOLDER_NAME = 'backup.folderName';
export const BACKUP_LAST_AT = 'backup.lastAt';
export const BACKUP_LAST_ERROR = 'backup.lastError';

/** Settings that belong to this phone, not to the data (the backup folder and status). */
export const isPhoneSetting = (key: string) => key.startsWith('backup.');

export function getSetting(db: DbOrTx, key: string): string | null {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(db: DbOrTx, key: string, value: string): void {
  const updatedAt = nowIso();
  db.insert(appSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } })
    .run();
}

export function deleteSetting(db: DbOrTx, key: string): void {
  db.delete(appSettings).where(eq(appSettings.key, key)).run();
}
