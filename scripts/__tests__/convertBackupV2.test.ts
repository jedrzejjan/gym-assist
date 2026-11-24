// The one-time backup converter, schema 1 → 2 (GYM-145), on a small anonymised sample.
import { BACKUP_TABLES, SCHEMA_VERSION } from '../../data/backup';
import { restoreAll } from '../../data/restore';
import { V1_EXERCISES } from '../../data/testing/exercisesV1';
import { createTestDb } from '../../data/testing/testDb';
import { readBackup } from '../../domain/backup';
import { convertBackupV2 } from '../convertBackupV2';

const T = '2026-10-01T10:00:00.000Z';
const exId = (name: string) => `ex-${name}`;

/** An old-app backup (schema 1): the v1 library, one custom exercise, one client with history. */
function v1Backup(customNames: string[] = []) {
  const exercises = [
    ...V1_EXERCISES.map((e) => ({ ...e, isCustom: false })),
    ...customNames.map((n) => ({
      nameEn: n,
      namePl: null,
      category: 'Push',
      trainingType: 'Strength',
      pattern: 'Push vertical',
      usesBodyweight: false,
      muscles: ['shoulders'],
      isCustom: true,
    })),
  ];
  const sessionRow = (id: string, date: string, status = 'finished') => ({
    id,
    clientId: 'c1',
    date,
    status,
    startedAt: T,
    finishedAt: status === 'finished' ? T : null,
    updatedAt: T,
  });
  const logged = ['Bench press', 'Overhand pull-up', ...customNames];
  return {
    app: 'gym-assist',
    formatVersion: 1,
    schemaVersion: 1,
    exportedAt: T,
    tables: {
      clients: [
        {
          id: 'c1',
          firstName: 'Client',
          lastName: 'One',
          gender: 'female',
          dateOfBirth: '1990-01-01',
          heightCm: 170,
          isSelf: false,
          notes: null,
          createdAt: T,
          updatedAt: T,
          archivedAt: null,
        },
      ],
      exercises: exercises.map(({ muscles, ...e }) => ({
        id: exId(e.nameEn),
        ...e,
        createdAt: T,
        updatedAt: T,
      })),
      exercise_muscles: exercises.flatMap((e) =>
        e.muscles.map((muscle) => ({ exerciseId: exId(e.nameEn), muscle, updatedAt: T })),
      ),
      measurements: [
        {
          id: 'm1',
          clientId: 'c1',
          date: '2026-10-01',
          type: 'weight',
          value: 63.5,
          createdAt: T,
          updatedAt: T,
        },
      ],
      one_rep_maxes: [
        {
          id: 'r1',
          clientId: 'c1',
          exerciseId: exId('Bench press'),
          valueKg: 80,
          source: 'manual',
          createdAt: T,
          updatedAt: T,
        },
      ],
      sessions: logged.map((n, i) => sessionRow(`s${i}`, `2026-10-0${i + 2}`)),
      session_exercises: logged.map((n, i) => ({
        id: `se${i}`,
        sessionId: `s${i}`,
        exerciseId: exId(n),
        position: 1,
        finishedAt: T,
        updatedAt: T,
      })),
      sets: logged.map((n, i) => ({
        id: `set${i}`,
        sessionExerciseId: `se${i}`,
        setNo: 1,
        weightKg: 60,
        reps: 8,
        side: null,
        heightCm: null,
        speedKmh: null,
        minutes: null,
        note: null,
        createdAt: T,
        updatedAt: T,
      })),
      app_settings: [{ key: 'units', value: 'kg', updatedAt: T }],
    },
  };
}

const tableNames = BACKUP_TABLES.map((t) => t.name);
const rows = (file: { tables: Record<string, unknown[]> }, table: string) =>
  file.tables[table] as Record<string, unknown>[];

test('the result is a current-schema backup that readBackup accepts and restoreAll restores', () => {
  const { file } = convertBackupV2(JSON.stringify(v1Backup()));
  expect(file.schemaVersion).toBe(SCHEMA_VERSION);
  const check = readBackup(JSON.stringify(file), SCHEMA_VERSION, tableNames);
  expect(check.ok).toBe(true);
  const restored = restoreAll(createTestDb(), file);
  expect(restored).toMatchObject({ clients: 1, sessions: 2 });
});

test('exercises keep their ids and take the library name and properties, so history stays linked', () => {
  const { file } = convertBackupV2(JSON.stringify(v1Backup()));
  const pullUp = rows(file, 'exercises').find((e) => e.id === exId('Overhand pull-up'))!;
  expect(pullUp).toMatchObject({ nameEn: 'Pull-Up', pattern: 'Pull', equipment: 'bodyweight' });
  expect(rows(file, 'exercise_aliases')).toContainEqual(
    expect.objectContaining({ exerciseId: exId('Overhand pull-up') }),
  );
  expect(rows(file, 'exercise_muscles')).toContainEqual(
    expect.objectContaining({ exerciseId: exId('Overhand pull-up'), role: 'primary' }),
  );
  expect(rows(file, 'session_exercises').map((se) => se.exerciseId)).toEqual([
    exId('Bench press'),
    exId('Overhand pull-up'),
  ]);
  expect(rows(file, 'one_rep_maxes')[0]).toMatchObject({
    id: 'r1',
    exerciseId: exId('Bench press'),
    valueKg: 80,
  });
  expect(rows(file, 'exercises')).toHaveLength(831);
});

test('clients, measurements, sets and settings are copied unchanged', () => {
  const old = v1Backup();
  const { file } = convertBackupV2(JSON.stringify(old));
  for (const table of ['clients', 'measurements', 'sets', 'sessions', 'app_settings']) {
    expect(rows(file, table)).toEqual(expect.arrayContaining(old.tables[table as 'clients']));
  }
  expect(rows(file, 'app_settings')).toContainEqual(
    expect.objectContaining({ key: 'library.version', value: '2' }),
  );
});

test('a custom exercise with a library name keeps its id and history and becomes built-in', () => {
  const { file, report } = convertBackupV2(JSON.stringify(v1Backup(['Nordic Hamstring Curl'])));
  expect(rows(file, 'exercises').find((e) => e.id === exId('Nordic Hamstring Curl'))).toMatchObject(
    { isCustom: false },
  );
  expect(report.after.sets).toBe(3);
  expect(report.dropped.map((d) => d.nameEn)).not.toContain('Nordic Hamstring Curl');
});

test('the report counts before and after, and names each dropped exercise with its sets', () => {
  const { report } = convertBackupV2(JSON.stringify(v1Backup(['Zzz unknown press'])));
  expect(report.before).toEqual({
    clients: 1,
    measurements: 1,
    sessions: 3,
    sessionExercises: 3,
    sets: 3,
    oneRepMaxes: 1,
    exercises: V1_EXERCISES.length + 1,
  });
  expect(report.after).toMatchObject({
    clients: 1,
    measurements: 1,
    sessions: 2,
    sessionExercises: 2,
    sets: 2,
    oneRepMaxes: 1,
    exercises: 831,
  });
  expect(report.dropped).toContainEqual({
    nameEn: 'Zzz unknown press',
    isCustom: true,
    sets: 1,
    oneRepMaxes: 0,
  });
});

test('a file that is not a schema-1 Gym Assist backup is refused', () => {
  expect(() => convertBackupV2('not json')).toThrow('This file is not a Gym Assist backup.');
  const current = { ...v1Backup(), schemaVersion: SCHEMA_VERSION };
  expect(() => convertBackupV2(JSON.stringify(current))).toThrow(/schema 1/);
});
