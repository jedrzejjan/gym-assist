import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DbProvider, mutate, notifyDataChanged, subscribeToDataChanges, useLive } from '../live';
import { clients } from '../schema';
import { createTestDb } from '../testing/testDb';
import type { Db } from '../types';

const NOW = '2026-11-11T10:00:00.000Z';

function addClient(db: Pick<Db, 'insert'>, id: string) {
  db.insert(clients).values({ id, firstName: 'Anna', createdAt: NOW, updatedAt: NOW }).run();
}

function ClientCount() {
  const n = useLive((db) => db.select().from(clients).all().length, []);
  return <Text>{String(n)}</Text>;
}

test('useLive re-runs after notifyDataChanged', async () => {
  const db = createTestDb();
  await render(
    <DbProvider db={db}>
      <ClientCount />
    </DbProvider>,
  );
  expect(screen.getByText('0')).toBeTruthy();
  addClient(db, 'c1');
  await act(async () => notifyDataChanged());
  expect(screen.getByText('1')).toBeTruthy();
});

test('mutate refreshes useLive after a write', async () => {
  const db = createTestDb();
  await render(
    <DbProvider db={db}>
      <ClientCount />
    </DbProvider>,
  );
  await act(async () => mutate(db, (tx) => addClient(tx, 'c1')));
  expect(screen.getByText('1')).toBeTruthy();
});

test('mutate rolls back and does not notify when write throws', () => {
  const db = createTestDb();
  const listener = jest.fn();
  const unsubscribe = subscribeToDataChanges(listener);
  expect(() =>
    mutate(db, (tx) => {
      addClient(tx, 'c1');
      throw new Error('boom');
    }),
  ).toThrow('boom');
  unsubscribe();
  expect(db.select().from(clients).all()).toHaveLength(0);
  expect(listener).not.toHaveBeenCalled();
});
