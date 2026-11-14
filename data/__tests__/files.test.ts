/**
 * @jest-environment node
 */
import { baseName } from '../files';

test('baseName keeps the readable last part of a storage-access name', () => {
  expect(baseName('Gym Assist')).toBe('Gym Assist');
  expect(baseName('primary:Gym Assist')).toBe('Gym Assist');
  expect(baseName('primary%3AGym%20Assist')).toBe('Gym Assist');
  expect(baseName('primary%3AGym%20Assist%2Fgym-assist-backup-2026-11-12.json')).toBe(
    'gym-assist-backup-2026-11-12.json',
  );
  expect(baseName('gym-assist-backup-2026-11-12.json')).toBe('gym-assist-backup-2026-11-12.json');
  expect(baseName('100%')).toBe('100%'); // not valid encoding: left as it is
});
