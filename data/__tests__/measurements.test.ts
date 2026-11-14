/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import {
  addWeight,
  deleteWeight,
  getWeight,
  LastWeightError,
  latestWeight,
  listWeights,
  updateWeight,
} from '../measurements';
import { createTestDb } from '../testing/testDb';

function clientWithWeight() {
  const db = createTestDb();
  const id = createClient(db, { firstName: 'Anna', weightKg: 65.8, weightDate: '2026-09-15' });
  return { db, id };
}

test('listWeights is newest first, and latestWeight is the newest date', () => {
  const { db, id } = clientWithWeight();
  addWeight(db, id, '2026-11-10', 63.5, { replace: false });
  addWeight(db, id, '2026-10-27', 64.2, { replace: false });
  expect(listWeights(db, id).map((w) => [w.date, w.valueKg])).toEqual([
    ['2026-11-10', 63.5],
    ['2026-10-27', 64.2],
    ['2026-09-15', 65.8],
  ]);
  expect(latestWeight(db, id)).toMatchObject({ date: '2026-11-10', valueKg: 63.5 });
});

test('a second weight on the same date is a conflict until the trainer chooses Replace', () => {
  const { db, id } = clientWithWeight();
  expect(addWeight(db, id, '2026-09-15', 66, { replace: false })).toBe('conflict');
  expect(listWeights(db, id).map((w) => w.valueKg)).toEqual([65.8]);
  expect(addWeight(db, id, '2026-09-15', 66, { replace: true })).toBe('saved');
  expect(listWeights(db, id).map((w) => w.valueKg)).toEqual([66]);
});

test('moving an entry onto another entry’s date is a conflict; Replace removes the other one', () => {
  const { db, id } = clientWithWeight();
  addWeight(db, id, '2026-10-27', 64.2, { replace: false });
  const oct = listWeights(db, id).find((w) => w.date === '2026-10-27')!;
  expect(updateWeight(db, oct.id, { date: '2026-09-15', kg: 64 }, { replace: false })).toBe(
    'conflict',
  );
  expect(listWeights(db, id)).toHaveLength(2);
  expect(updateWeight(db, oct.id, { date: '2026-09-15', kg: 64 }, { replace: true })).toBe('saved');
  expect(listWeights(db, id).map((w) => [w.id, w.date, w.valueKg])).toEqual([
    [oct.id, '2026-09-15', 64],
  ]);
});

test('updateWeight on its own date just changes the value', () => {
  const { db, id } = clientWithWeight();
  const only = listWeights(db, id)[0];
  expect(updateWeight(db, only.id, { date: only.date, kg: 65 }, { replace: false })).toBe('saved');
  expect(getWeight(db, only.id)!.valueKg).toBe(65);
});

test('the last remaining weight can be edited but not deleted', () => {
  const { db, id } = clientWithWeight();
  const only = listWeights(db, id)[0];
  expect(() => deleteWeight(db, only.id)).toThrow(LastWeightError);
  addWeight(db, id, '2026-11-10', 63.5, { replace: false });
  deleteWeight(db, only.id);
  expect(listWeights(db, id).map((w) => w.date)).toEqual(['2026-11-10']);
});

test('weights must be positive', () => {
  const { db, id } = clientWithWeight();
  expect(() => addWeight(db, id, '2026-11-10', 0, { replace: false })).toThrow();
  expect(() => addWeight(db, id, '2026-11-10', Number.NaN, { replace: false })).toThrow();
});
