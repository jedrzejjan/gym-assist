// The JSON backup (spec section 5, Backup plan; Sprint 2 plan, Global Constraints). Pure: the
// file name rules and the format. Reading and writing live in data/.

/**
 * `tables` maps each SQL table name to its rows as Drizzle selects them (camelCase keys), so a
 * restore can insert them back through Drizzle unchanged. `schemaVersion` is the number of
 * migrations the app has run.
 */
export type BackupFile = {
  app: 'gym-assist';
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

const BACKUP_NAME = /^gym-assist-backup-\d{4}-\d{2}-\d{2}\.json$/;

/** '2026-11-12' → 'gym-assist-backup-2026-11-12.json'. Several exports on one day share a file. */
export function backupFileName(date: string): string {
  return `gym-assist-backup-${date}.json`;
}

/**
 * The backup files to delete so the newest `keep` remain. Only names that match the backup
 * pattern count; any other file in the folder (notes, the before-restore copy) is left alone.
 * The date in the name sorts as text, so no parsing is needed.
 */
export function filesToDelete(names: string[], keep = 10): string[] {
  const backups = names.filter((n) => BACKUP_NAME.test(n)).sort();
  return backups.slice(0, Math.max(0, backups.length - keep));
}

export type BackupCheck = { ok: true; file: BackupFile } | { ok: false; message: string };

const NOT_A_BACKUP = 'This file is not a Gym Assist backup.';
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const validDate = (s: unknown) => {
  if (typeof s !== 'string') return false;
  const m = DATE.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
};

/**
 * Reads a backup file before a restore (spec section 5, Restore; Sprint 2 plan decision 8). It
 * accepts only this app's format and exactly the app's schema version: an older backup needs a
 * migration step that doesn't exist yet (GYM-131). The caller passes the table names, so this
 * stays pure.
 */
export function readBackup(
  text: string,
  currentSchema: number,
  tableNames: readonly string[],
): BackupCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_A_BACKUP };
  }
  const f = parsed as Partial<BackupFile> | null;
  if (
    !f ||
    typeof f !== 'object' ||
    f.app !== 'gym-assist' ||
    f.formatVersion !== 1 ||
    typeof f.schemaVersion !== 'number' ||
    typeof f.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(f.exportedAt)) ||
    !f.tables ||
    typeof f.tables !== 'object'
  ) {
    return { ok: false, message: NOT_A_BACKUP };
  }
  const versions = `(schema ${f.schemaVersion}; this app uses ${currentSchema})`;
  if (f.schemaVersion < currentSchema) {
    return {
      ok: false,
      message: `This backup is from an older version of the app ${versions}. Restoring older backups isn't possible yet.`,
    };
  }
  if (f.schemaVersion > currentSchema) {
    return {
      ok: false,
      message: `This backup is from a newer version of the app ${versions}. Update the app first.`,
    };
  }
  for (const name of tableNames) {
    if (!Array.isArray(f.tables[name])) {
      return { ok: false, message: `This backup is incomplete: the table ${name} is missing.` };
    }
  }
  for (const name of ['sessions', 'measurements']) {
    for (const row of (f.tables[name] ?? []) as { date?: unknown }[]) {
      if (!validDate(row.date)) {
        return { ok: false, message: `This backup has an invalid date: ${String(row.date)}.` };
      }
    }
  }
  return { ok: true, file: f as BackupFile };
}
