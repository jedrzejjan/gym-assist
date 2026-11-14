// Spec section 5, progress.ts: the Epley estimated 1RM, the best set, and "% to kg".
import type { SetValue } from './sets';

/** Epley, as est_1rm in legacy/gym_tracker.py: the weight itself for one rep. */
export function e1rm(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * A set that can be compared. `loadKg` is the total load: for a bodyweight exercise, the body
 * weight on the session date plus the added load. `shown` keeps the set as logged.
 */
export type ComparableSet = { loadKg: number; reps: number; date: string; shown: SetValue };

/**
 * The best set: the highest e1RM, then more reps, then the earliest date. Sets without a load or
 * reps are skipped; null when nothing is left.
 */
export function bestSet(sets: ComparableSet[]): ComparableSet | null {
  let best: ComparableSet | null = null;
  for (const s of sets) {
    if (s.loadKg == null || s.reps == null) continue;
    if (best === null) {
      best = s;
      continue;
    }
    const a = e1rm(s.loadKg, s.reps);
    const b = e1rm(best.loadKg, best.reps);
    if (
      a > b ||
      (a === b && (s.reps > best.reps || (s.reps === best.reps && s.date < best.date)))
    ) {
      best = s;
    }
  }
  return best;
}

/** kg = 1RM × % / 100, rounded to the nearest 1 kg. */
export function percentToKg(oneRmKg: number, percent: number): number {
  return Math.round((oneRmKg * percent) / 100);
}

/**
 * For an exercise that uses body weight: the added load is the total (1RM × %) minus the body
 * weight, rounded to 1 kg and never below 0. The unrounded total is used, then rounded once.
 */
export function addedLoadFromPercent(
  oneRmKg: number,
  percent: number,
  bodyWeightKg: number,
): number {
  return Math.max(0, Math.round((oneRmKg * percent) / 100 - bodyWeightKg));
}
