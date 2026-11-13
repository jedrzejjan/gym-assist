// Restore from backup (spec section 5, Restore; GYM-103, Sprint 2 plan decision 8). A repository
// function: the screen first writes the safety copy, then runs this inside one
// mutate(…, { export: false }), so a failure changes nothing and today's backup isn't overwritten.
import { count, eq, like } from 'drizzle-orm';

import type { BackupFile } from '../domain/backup';
import { todayLocal } from '../domain/dates';
import { BACKUP_TABLES } from './backup';
import { appSettings, clients, sessions } from './schema';
import type { DbOrTx } from './types';

/** SQLite's limit on bound variables: insert in chunks so a big table can't hit it. */
const CHUNK = 100;

/** Settings that belong to this phone, not to the data: a restore keeps them. */
const PHONE_SETTINGS = 'backup.%';

/**
 * Replaces every table with the backup's rows, except this phone's backup.* settings. Children
 * are deleted first and parents inserted first; rows go in file order (rowid order, see
 * exportAll), so ties such as two 1RMs saved in one millisecond stay broken the same way.
 * Returns what the "Restore done" screen shows: every client (archived too), the finished
 * sessions, and the backup's local date.
 */
export function restoreAll(
  db: DbOrTx,
  file: BackupFile,
): { clients: number; sessions: number; date: string } {
  const keep = db.select().from(appSettings).where(like(appSettings.key, PHONE_SETTINGS)).all();

  for (const { table } of [...BACKUP_TABLES].reverse()) db.delete(table).run();

  for (const { name, table } of BACKUP_TABLES) {
    let rows = file.tables[name] as Record<string, unknown>[];
    if (name === 'app_settings') {
      rows = rows.filter((r) => !String(r.key).startsWith('backup.'));
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      // The rows come from exportAll for this very table, so they have its shape.
      const chunk = rows.slice(i, i + CHUNK) as (typeof table.$inferInsert)[];
      db.insert(table).values(chunk).run();
    }
  }
  if (keep.length > 0) db.insert(appSettings).values(keep).run();

  return {
    clients: db.select({ n: count() }).from(clients).get()!.n,
    sessions: db.select({ n: count() }).from(sessions).where(eq(sessions.status, 'finished')).get()!
      .n,
    date: todayLocal(new Date(file.exportedAt)),
  };
}
