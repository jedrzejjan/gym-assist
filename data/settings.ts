import { eq } from 'drizzle-orm';

import { appSettings } from './schema';
import { type DbOrTx, nowIso } from './types';

/** Keys stored in app_settings. */
export const WELCOME_DONE = 'welcome_done';

export function getSetting(db: DbOrTx, key: string): string | null {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(db: DbOrTx, key: string, value: string): void {
  const updatedAt = nowIso();
  db.insert(appSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } })
    .run();
}
