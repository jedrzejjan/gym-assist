/**
 * @jest-environment node
 */
import { getSetting, setSetting } from '../settings';
import { createTestDb } from '../testing/testDb';

test('getSetting returns null for a key that was never set', () => {
  const db = createTestDb();
  expect(getSetting(db, 'welcome_done')).toBeNull();
});

test('setSetting stores a value and overwrites it on the second call', () => {
  const db = createTestDb();
  setSetting(db, 'welcome_done', '1');
  expect(getSetting(db, 'welcome_done')).toBe('1');
  setSetting(db, 'welcome_done', '0');
  expect(getSetting(db, 'welcome_done')).toBe('0');
});
