// Database tables: spec section 6. Dates are 'YYYY-MM-DD'; timestamps are ISO strings.
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    gender: text('gender', { enum: ['female', 'male', 'other', 'prefer_not_to_say'] }),
    dateOfBirth: text('date_of_birth'),
    heightCm: real('height_cm'),
    isSelf: integer('is_self', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [
    // At most one "Me".
    uniqueIndex('clients_one_self')
      .on(t.isSelf)
      .where(sql`${t.isSelf} = 1`),
  ],
);

export const measurements = sqliteTable(
  'measurements',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    type: text('type').notNull(),
    value: real('value').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('measurements_client_type_date').on(t.clientId, t.type, t.date)],
);

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    nameEn: text('name_en').notNull(),
    namePl: text('name_pl'),
    category: text('category').notNull(),
    trainingType: text('training_type').notNull(),
    pattern: text('pattern').notNull(),
    usesBodyweight: integer('uses_bodyweight', { mode: 'boolean' }).notNull().default(false),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    // "Dips" and "dips" are the same exercise (the CSV import matches by name).
    uniqueIndex('exercises_name_en_nocase').on(sql`lower(${t.nameEn})`),
  ],
);

export const exerciseMuscles = sqliteTable(
  'exercise_muscles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    muscle: text('muscle').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.muscle] })],
);

export const oneRepMaxes = sqliteTable(
  'one_rep_maxes',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    valueKg: real('value_kg').notNull(),
    source: text('source', { enum: ['estimated', 'manual'] }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('one_rep_maxes_client_exercise').on(t.clientId, t.exerciseId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: ['draft', 'finished'] }).notNull(),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    // Only one draft in the whole app (spec section 4, "One draft at a time").
    uniqueIndex('sessions_one_draft')
      .on(t.status)
      .where(sql`${t.status} = 'draft'`),
    index('sessions_client_date').on(t.clientId, t.date),
  ],
);

export const sessionExercises = sqliteTable(
  'session_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    finishedAt: text('finished_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('session_exercises_session').on(t.sessionId)],
);

export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    setNo: integer('set_no').notNull(),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    // Backlog columns (spec section 6): kept for the imported history, no UI in the MVP.
    side: text('side'),
    heightCm: real('height_cm'),
    speedKmh: real('speed_kmh'),
    minutes: real('minutes'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('sets_session_exercise').on(t.sessionExerciseId)],
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
