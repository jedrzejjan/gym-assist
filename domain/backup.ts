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
