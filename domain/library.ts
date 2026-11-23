// The one-time library upgrade, as a pure plan (GYM-149, owner decisions 2026-11-23). The data
// layer (data/library.ts) carries it out in one transaction.

/**
 * Case folding in JS, not SQL: SQLite's lower() folds ASCII only, so "Ł" would not match "ł".
 * Used wherever names are compared: search, the duplicate check, the import and the upgrade.
 */
export const foldName = (s: string) => s.trim().toLocaleLowerCase('pl');

export type LibraryUpgradePlan = {
  /** Existing exercises that become a library exercise in place: their id, and so their history, stays. */
  map: { id: string; seedIndex: number }[];
  /** Existing exercises with no match: deleted with their history (owner rule, GYM-149). */
  drop: string[];
  /** Library exercises nobody mapped to: inserted as new rows. */
  insert: number[];
};

/**
 * Matches each existing exercise, by its English name or any of its aliases, against the library's
 * English names and aliases, ignoring case. A library exercise takes one existing exercise only:
 * the first one in `existing` order wins, and a later one that hits the same exercise is dropped,
 * because two rows can't both become it (names are unique).
 */
export function planLibraryUpgrade(
  existing: { id: string; nameEn: string; aliases: string[] }[],
  seed: { nameEn: string; aliases: string[] }[],
): LibraryUpgradePlan {
  const indexOf = new Map<string, number>();
  seed.forEach((s, i) => {
    for (const name of [s.nameEn, ...s.aliases]) indexOf.set(foldName(name), i);
  });

  const taken = new Set<number>();
  const plan: LibraryUpgradePlan = { map: [], drop: [], insert: [] };
  for (const e of existing) {
    const hit = [e.nameEn, ...e.aliases]
      .map((n) => indexOf.get(foldName(n)))
      .find((i) => i !== undefined);
    if (hit === undefined || taken.has(hit)) {
      plan.drop.push(e.id);
    } else {
      taken.add(hit);
      plan.map.push({ id: e.id, seedIndex: hit });
    }
  }
  plan.insert = seed.map((_, i) => i).filter((i) => !taken.has(i));
  return plan;
}
