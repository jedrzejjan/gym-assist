/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const DIR = path.join(__dirname, '..', 'migrations');
const NOW = '2026-11-11T10:00:00.000Z';

/** Runs one migration file the way drizzle does: statement by statement. */
function apply(db: Database.Database, file: string) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8');
  for (const statement of text.split('--> statement-breakpoint')) {
    if (statement.trim()) db.exec(statement);
  }
}

function migrationFile(prefix: string): string {
  const file = fs.readdirSync(DIR).find((f) => f.startsWith(prefix) && f.endsWith('.sql'));
  if (!file) throw new Error(`no migration ${prefix}`);
  return file;
}

test('0001 drops category and keeps every exercise row', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF'); // as on the phone and in createTestDb while migrating
  apply(db, '0000_init.sql');

  db.exec(`
    INSERT INTO exercises (id, name_en, name_pl, category, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
      VALUES ('e1', 'Back squat', 'Przysiad', 'KD', 'Strength', 'KD', 0, 0, '${NOW}', '${NOW}'),
             ('e2', 'Dips', NULL, 'Push', 'Strength', 'Push vertical', 1, 1, '${NOW}', '${NOW}');
    INSERT INTO exercise_muscles (exercise_id, muscle, updated_at) VALUES ('e1', 'quadriceps', '${NOW}');
    INSERT INTO clients (id, first_name, is_self, created_at, updated_at) VALUES ('c1', 'Anna', 0, '${NOW}', '${NOW}');
    INSERT INTO sessions (id, client_id, date, status, started_at, updated_at)
      VALUES ('s1', 'c1', '2026-11-11', 'finished', '${NOW}', '${NOW}');
    INSERT INTO session_exercises (id, session_id, exercise_id, position, updated_at)
      VALUES ('se1', 's1', 'e2', 0, '${NOW}');
  `);

  apply(db, migrationFile('0001_'));
  db.pragma('foreign_keys = ON');

  const columns = (db.pragma('table_info(exercises)') as { name: string }[]).map((c) => c.name);
  expect(columns).not.toContain('category');
  expect(columns).toEqual(
    expect.arrayContaining(['id', 'name_en', 'name_pl', 'training_type', 'pattern', 'is_custom']),
  );
  expect(db.prepare('SELECT id, name_en, is_custom FROM exercises ORDER BY id').all()).toEqual([
    { id: 'e1', name_en: 'Back squat', is_custom: 0 },
    { id: 'e2', name_en: 'Dips', is_custom: 1 },
  ]);
  expect(db.prepare('SELECT exercise_id FROM exercise_muscles').all()).toEqual([
    { exercise_id: 'e1' },
  ]);
  expect(db.prepare('SELECT id, session_id, exercise_id FROM session_exercises').all()).toEqual([
    { id: 'se1', session_id: 's1', exercise_id: 'e2' },
  ]);
  expect(db.pragma('foreign_key_check')).toEqual([]);
  // the unique name index survives
  expect(() =>
    db.exec(
      `INSERT INTO exercises (id, name_en, training_type, pattern, uses_bodyweight, is_custom, created_at, updated_at)
       VALUES ('e3', 'back SQUAT', 'Strength', 'KD', 0, 1, '${NOW}', '${NOW}')`,
    ),
  ).toThrow(/UNIQUE/);
});
