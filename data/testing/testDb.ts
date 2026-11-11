import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import type { Db } from '../types';

/**
 * An in-memory database migrated with the same SQL files the phone uses.
 * Foreign keys are off while migrating (a table rebuild would otherwise cascade-delete rows),
 * then on, as on the phone. better-sqlite3 turns them on by default, hence the explicit OFF.
 */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = OFF');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });
  sqlite.pragma('foreign_keys = ON');
  return db as unknown as Db;
}
