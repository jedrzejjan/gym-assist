// One-time: converts a backup from the app before GYM-144 (schema 1) to the current schema
// (GYM-145). It reuses the phone's own upgrade path instead of a second mapping: the old rows go
// into a database at schema 1, the remaining migrations run, then syncLibrary maps the exercises
// onto the library exactly as the app update does at start-up, and exportAll writes the new file.
// Node only (better-sqlite3); the app never imports it. Run it with scripts/convert-backup-v2.run.ts.
import { asc } from 'drizzle-orm';

import { BACKUP_TABLES, exportAll } from '../data/backup';
import { syncLibrary, type SyncResult } from '../data/library';
import { exercises } from '../data/schema';
import { SEED_EXERCISES, type SeedExercise } from '../data/seed/exercises';
import { createTestDbAt } from '../data/testing/testDb';
import { type BackupFile, readBackup } from '../domain/backup';
import { planLibraryUpgrade } from '../domain/library';

const OLD_SCHEMA = 1;
/** Schema 1 had every table but exercise_aliases (added by migration 0001). */
const OLD_TABLES = BACKUP_TABLES.map((t) => t.name).filter((n) => n !== 'exercise_aliases');

export type Counts = {
  clients: number;
  measurements: number;
  sessions: number;
  sessionExercises: number;
  sets: number;
  oneRepMaxes: number;
  exercises: number;
};

export type DroppedExercise = {
  nameEn: string;
  isCustom: boolean;
  sets: number;
  oneRepMaxes: number;
};

export type ConversionReport = {
  before: Counts;
  after: Counts;
  sync: SyncResult;
  /** Exercises with no match in the library: deleted with their history (owner rule, GYM-149). */
  dropped: DroppedExercise[];
};

function counts(tables: Record<string, unknown[]>): Counts {
  const n = (t: string) => tables[t]?.length ?? 0;
  return {
    clients: n('clients'),
    measurements: n('measurements'),
    sessions: n('sessions'),
    sessionExercises: n('session_exercises'),
    sets: n('sets'),
    oneRepMaxes: n('one_rep_maxes'),
    exercises: n('exercises'),
  };
}

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const sqlValue = (v: unknown) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

/** Throws with the reason when the text is not a schema-1 Gym Assist backup. */
export function convertBackupV2(
  text: string,
  seed: SeedExercise[] = SEED_EXERCISES,
): { file: BackupFile; report: ConversionReport } {
  const check = readBackup(text, OLD_SCHEMA, OLD_TABLES);
  if (!check.ok) {
    throw new Error(
      check.message.includes('version of the app')
        ? `Only backups from schema 1 (before GYM-144) can be converted: ${check.message}`
        : check.message,
    );
  }
  const old = check.file;
  const { db, sqlite, migrateRest } = createTestDbAt(OLD_SCHEMA);

  // The old rows, as Drizzle exported them (camelCase), into the schema-1 tables, parents first.
  sqlite.transaction(() => {
    for (const table of OLD_TABLES) {
      for (const row of old.tables[table] as Record<string, unknown>[]) {
        const keys = Object.keys(row);
        sqlite
          .prepare(
            `INSERT INTO "${table}" (${keys.map((k) => `"${snake(k)}"`).join(', ')}) ` +
              `VALUES (${keys.map(() => '?').join(', ')})`,
          )
          .run(...keys.map((k) => sqlValue(row[k])));
      }
    }
  })();
  migrateRest();

  // What the upgrade will drop, worked out the way syncLibrary orders the rows (built-in first,
  // then by age), so the owner can see the lost history before restoring.
  const existing = db
    .select({ id: exercises.id, nameEn: exercises.nameEn, isCustom: exercises.isCustom })
    .from(exercises)
    .orderBy(asc(exercises.isCustom), asc(exercises.createdAt), asc(exercises.id))
    .all();
  const dropIds = new Set(
    planLibraryUpgrade(
      existing.map((e) => ({ ...e, aliases: [] })),
      seed,
    ).drop,
  );
  const seIds = (exerciseId: string) =>
    (old.tables.session_exercises as { id: string; exerciseId: string }[])
      .filter((se) => se.exerciseId === exerciseId)
      .map((se) => se.id);
  const dropped = existing
    .filter((e) => dropIds.has(e.id))
    .map((e) => {
      const ses = new Set(seIds(e.id));
      return {
        nameEn: e.nameEn,
        isCustom: e.isCustom,
        sets: (old.tables.sets as { sessionExerciseId: string }[]).filter((s) =>
          ses.has(s.sessionExerciseId),
        ).length,
        oneRepMaxes: (old.tables.one_rep_maxes as { exerciseId: string }[]).filter(
          (r) => r.exerciseId === e.id,
        ).length,
      };
    });

  const sync = db.transaction((tx) => syncLibrary(tx, seed));
  if (sync.dropped !== dropped.length) {
    throw new Error(
      `The report lists ${dropped.length} dropped exercises but the upgrade dropped ${sync.dropped}.`,
    );
  }
  const file = exportAll(db);
  sqlite.close();
  return {
    file,
    report: { before: counts(old.tables), after: counts(file.tables), sync, dropped },
  };
}
