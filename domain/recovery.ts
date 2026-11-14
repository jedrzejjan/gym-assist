// Recovery per movement pattern and per muscle (spec section 5, recovery.ts). Same thresholds as
// recovery_label in legacy/gym_tracker.py, counted in calendar days. Pure: data in, result out.
import { MUSCLES, type Muscle, type Pattern, PATTERNS } from './catalogue';
import { daysBetween } from './dates';

export type RecoveryStatus =
  'recovering, too soon' | 'in supercompensation window (48–72 h)' | 'due' | 'never logged';

export type RecoveryRow<K> = {
  key: K;
  lastDate: string | null;
  days: number | null;
  status: RecoveryStatus;
};

/** One trained exercise: the session date, its pattern and its muscles. */
export type Trained = { date: string; pattern: Pattern; muscles: Muscle[] };

/** 0–1 days: too soon; 2–3 (exactly 3 counts here): the window; 4 or more: due. */
export function recoveryLabel(days: number): RecoveryStatus {
  if (days < 2) return 'recovering, too soon';
  if (days <= 3) return 'in supercompensation window (48–72 h)';
  return 'due';
}

/** 0 → 'today', 1 → '1 day ago', 6 → '6 days ago'. */
export function daysAgo(days: number): string {
  if (days === 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function rows<K extends string>(keys: readonly K[], last: Map<K, string>, today: string) {
  return keys.map((key): RecoveryRow<K> => {
    const lastDate = last.get(key) ?? null;
    if (lastDate === null) return { key, lastDate, days: null, status: 'never logged' };
    const days = daysBetween(lastDate, today);
    return { key, lastDate, days, status: recoveryLabel(days) };
  });
}

/**
 * The latest date each pattern and muscle was trained, as status rows. Patterns follow the
 * spec order and leave out "none" (such an exercise still counts for its muscles); muscles
 * follow the catalogue order.
 */
export function recoveryTable(
  trained: Trained[],
  today: string,
): { patterns: RecoveryRow<Pattern>[]; muscles: RecoveryRow<Muscle>[] } {
  const byPattern = new Map<Pattern, string>();
  const byMuscle = new Map<Muscle, string>();
  const keepLatest = <K>(map: Map<K, string>, key: K, date: string) => {
    const seen = map.get(key);
    if (seen === undefined || date > seen) map.set(key, date);
  };
  for (const t of trained) {
    keepLatest(byPattern, t.pattern, t.date);
    for (const m of t.muscles) keepLatest(byMuscle, m, t.date);
  }
  return {
    patterns: rows(
      PATTERNS.filter((p) => p !== 'none'),
      byPattern,
      today,
    ),
    muscles: rows(MUSCLES, byMuscle, today),
  };
}
