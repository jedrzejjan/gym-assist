import { backupFileName, filesToDelete, readBackup } from '../backup';

test('backupFileName("2026-11-12") is gym-assist-backup-2026-11-12.json', () => {
  expect(backupFileName('2026-11-12')).toBe('gym-assist-backup-2026-11-12.json');
});

test('filesToDelete keeps the newest 10 and ignores other files', () => {
  const days = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const names = [
    ...days.map(backupFileName),
    'gym-assist-before-restore.json',
    'notes.txt',
    'gym-assist-backup-latest.json',
  ].reverse(); // the order from the folder doesn't matter
  expect(filesToDelete(names).sort()).toEqual([
    'gym-assist-backup-2026-11-01.json',
    'gym-assist-backup-2026-11-02.json',
  ]);
  expect(filesToDelete(names, 12)).toEqual([]);
  expect(filesToDelete(['notes.txt'])).toEqual([]);
});

describe('readBackup', () => {
  const TABLES = ['clients', 'sessions', 'measurements'] as const;
  const good = (o: Record<string, unknown> = {}) =>
    JSON.stringify({
      app: 'gym-assist',
      formatVersion: 1,
      schemaVersion: 1,
      exportedAt: '2026-11-09T17:42:00.000Z',
      tables: {
        clients: [{ id: 'c1' }],
        sessions: [{ id: 's1', date: '2026-11-09' }],
        measurements: [{ id: 'm1', date: '2026-11-01' }],
      },
      ...o,
    });

  test('a backup from this app and schema is accepted', () => {
    const r = readBackup(good(), 1, TABLES);
    expect(r.ok && r.file.tables.sessions).toEqual([{ id: 's1', date: '2026-11-09' }]);
  });

  test.each([
    ['not JSON', 'hello', 'This file is not a Gym Assist backup.'],
    ['another app', good({ app: 'other' }), 'This file is not a Gym Assist backup.'],
    ['another format', good({ formatVersion: 2 }), 'This file is not a Gym Assist backup.'],
    [
      'an older schemaVersion',
      good({ schemaVersion: 0 }),
      "This backup is from an older version of the app (schema 0; this app uses 1). Restoring older backups isn't possible yet.",
    ],
    [
      'a newer schemaVersion',
      good({ schemaVersion: 2 }),
      'This backup is from a newer version of the app (schema 2; this app uses 1). Update the app first.',
    ],
    [
      'a missing table',
      good({ tables: { clients: [], sessions: [] } }),
      'This backup is incomplete: the table measurements is missing.',
    ],
    [
      'a bad date',
      good({
        tables: { clients: [], sessions: [{ id: 's', date: '9.11.2026' }], measurements: [] },
      }),
      'This backup has an invalid date: 9.11.2026.',
    ],
    [
      'a bad exportedAt',
      good({ exportedAt: 'yesterday' }),
      'This file is not a Gym Assist backup.',
    ],
    [
      'a row that is not an object',
      good({ tables: { clients: [], sessions: [null], measurements: [] } }),
      'This backup is damaged: the table sessions has a bad row.',
    ],
  ])('%s is refused', (_, text, message) => {
    expect(readBackup(text, 1, TABLES)).toEqual({ ok: false, message });
  });
});
