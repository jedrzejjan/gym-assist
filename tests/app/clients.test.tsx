import { fireEvent, screen } from '@testing-library/react-native';
import { sql } from 'drizzle-orm';

import Clients from '../../app/clients/index';
import { createClient } from '../../data/clients';
import { createTestDb } from '../../data/testing/testDb';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

const base = { weightKg: 70, weightDate: '2026-11-01' };

test('an empty list offers "Add my profile" and says "No clients yet"', async () => {
  await renderWithDb(<Clients />);
  expect(screen.getByText('+ Add my profile')).toBeTruthy();
  expect(screen.getByText('No clients yet')).toBeTruthy();
  expect(screen.getByText('Add your first client to start logging sessions.')).toBeTruthy();
  await fireEvent.press(screen.getByText('+ Add my profile'));
  expect(mockRouter.push).toHaveBeenCalledWith('/create-profile?from=clients');
});

test('with only Me: Me is shown, marked "me", and other clients are still to come', async () => {
  const db = createTestDb();
  createClient(db, { ...base, firstName: 'Jędrzej', isSelf: true });
  await renderWithDb(<Clients />, db);
  expect(screen.getByText('Jędrzej')).toBeTruthy();
  expect(screen.getByText('me')).toBeTruthy();
  expect(screen.queryByText('+ Add my profile')).toBeNull();
  expect(screen.getByText('No clients yet. Add your first client below.')).toBeTruthy();
});

test('Me is pinned first, then clients by name, each with their last session', async () => {
  const db = createTestDb();
  const anna = createClient(db, { ...base, firstName: 'Anna', lastName: 'Kowalska' });
  createClient(db, { ...base, firstName: 'Zofia' });
  createClient(db, { ...base, firstName: 'Jędrzej', isSelf: true });
  db.run(
    sql`INSERT INTO sessions (id, client_id, date, status, started_at, finished_at, updated_at)
        VALUES ('s1', ${anna}, '2026-11-07', 'finished', 'x', 'x', 'x')`,
  );
  await renderWithDb(<Clients />, db);
  const names = screen.getAllByText(/^(Jędrzej|Anna Kowalska|Zofia)$/).map((t) => t.props.children);
  expect(names).toEqual(['Jędrzej', 'Anna Kowalska', 'Zofia']);
  expect(screen.getByText('Last session: 7 Nov 2026')).toBeTruthy();
  expect(screen.getAllByText('No sessions yet')).toHaveLength(2);
});

test('"Add client" opens the form', async () => {
  await renderWithDb(<Clients />);
  await fireEvent.press(screen.getByText('Add client'));
  expect(mockRouter.push).toHaveBeenCalledWith('/clients/add');
});
