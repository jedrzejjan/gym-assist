import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import type { Db } from '../types';

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

/**
 * An in-memory database migrated with the same SQL files the phone uses.
 * Foreign keys are off while migrating (a table rebuild would otherwise cascade-delete rows),
 * then on, as on the phone. better-sqlite3 turns them on by default, hence the explicit OFF.
 */
export function createTestDb(): Db {
  return createTestDbAt(Number.POSITIVE_INFINITY).db;
}

/**
 * A database as an older app version left it: only the first `migrations` migrations applied,
 * so a test can fill it with old data. `migrateRest` then runs the remaining ones, as the app
 * update does on the phone (foreign keys off while migrating, on afterwards).
 */
export function createTestDbAt(migrations: number): {
  db: Db;
  sqlite: Database.Database;
  migrateRest: () => void;
} {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  const run = (folder: string) => {
    sqlite.pragma('foreign_keys = OFF');
    migrate(db, { migrationsFolder: folder });
    sqlite.pragma('foreign_keys = ON');
  };
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'),
  );
  if (migrations >= journal.entries.length) {
    run(MIGRATIONS);
  } else {
    // A copy of the migrations folder whose journal lists only the first few entries.
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-migrations-'));
    fs.mkdirSync(path.join(folder, 'meta'));
    for (const e of journal.entries.slice(0, migrations)) {
      fs.copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(folder, `${e.tag}.sql`));
    }
    fs.writeFileSync(
      path.join(folder, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, migrations) }),
    );
    run(folder);
    fs.rmSync(folder, { recursive: true, force: true });
  }
  return { db: db as unknown as Db, sqlite, migrateRest: () => run(MIGRATIONS) };
}
