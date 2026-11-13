import { backupFileName, filesToDelete } from '../backup';

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
