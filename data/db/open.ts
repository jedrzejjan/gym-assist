// Phone-only start-up: open the database, protect it with a snapshot, migrate, and only then
// build the Drizzle database the app uses. Jest never loads this file (it needs native modules);
// the logic it wires is tested in prepare.test.ts, and the owner's phone test covers the rest.
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { Directory, File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../migrations/migrations';
import * as schema from '../schema';
import type { Db } from '../types';
import { prepareDatabase, type PrepareResult } from './prepare';

const DB_NAME = 'gym-assist.db';

/** A plain filesystem path, as SQLite's VACUUM INTO needs (not a file:// URI). */
function plainPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function asUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function openRaw(): SQLiteDatabase {
  // Change listeners are unused (we have useLive); foreign keys stay OFF until migrations finish.
  const raw = openDatabaseSync(DB_NAME);
  raw.execSync('PRAGMA foreign_keys = OFF');
  return raw;
}

export async function openAppDatabase(): Promise<{ db: Db; result: PrepareResult }> {
  let raw = openRaw();
  const backups = new Directory(Paths.document, 'backups');
  const dbFile = (suffix = '') => new File(asUri(defaultDatabaseDirectory), DB_NAME + suffix);

  const result = await prepareDatabase({
    appliedVersion: () => {
      const table = raw.getFirstSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
      );
      if (!table) return 0; // fresh install
      return raw.getFirstSync<{ n: number }>('SELECT count(*) AS n FROM __drizzle_migrations')!.n;
    },
    targetVersion: () => migrations.journal.entries.length,
    snapshotTo: (name) => {
      if (!backups.exists) backups.create({ intermediates: true, idempotent: true });
      const target = new File(backups, name);
      if (target.exists) target.delete(); // VACUUM INTO fails if the file exists
      raw.execSync(`VACUUM INTO '${plainPath(target.uri).replace(/'/g, "''")}'`);
    },
    listSnapshots: () => (backups.exists ? backups.list().map((entry) => entry.name) : []),
    deleteSnapshot: (name) => {
      const file = new File(backups, name);
      if (file.exists) file.delete();
    },
    restoreFrom: (name) => {
      raw.closeSync();
      for (const suffix of ['', '-wal', '-shm']) {
        const file = dbFile(suffix);
        if (file.exists) file.delete(); // copy may not overwrite
      }
      new File(backups, name).copy(dbFile());
      raw = openRaw();
    },
    migrate: async () => {
      await migrate(drizzle(raw, { schema }), migrations);
      // A rebuilt table must not leave rows pointing at nothing.
      const broken = raw.getAllSync('PRAGMA foreign_key_check');
      if (broken.length > 0) {
        throw new Error(`migration left ${broken.length} broken references`);
      }
    },
  });

  // Every start, including the usual one with nothing to migrate.
  raw.execSync('PRAGMA foreign_keys = ON');
  const db = drizzle(raw, { schema }) as unknown as Db;
  // Task 4 (GYM-17) seeds the exercise library here, inside one transaction.
  return { db, result };
}
