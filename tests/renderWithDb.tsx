import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { DbProvider } from '../data/live';
import { createTestDb } from '../data/testing/testDb';
import type { Db } from '../data/types';

/** Render a screen with a real in-memory database, migrated like the phone's. */
export async function renderWithDb(ui: ReactElement, db: Db = createTestDb()) {
  const utils = await render(<DbProvider db={db}>{ui}</DbProvider>);
  return { db, ...utils };
}
