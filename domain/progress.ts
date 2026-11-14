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

/** A 1RM is stored with 2 decimals (Sprint 2 plan, decision 6). */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export type EstimateCandidate = {
  exerciseId: string;
  oneRepMax: { valueKg: number; source: 'estimated' | 'manual' } | null;
  best: { e1rmKg: number } | null;
};

export type EstimatePlan = {
  /** Exercises with no 1RM yet. */
  set: { exerciseId: string; valueKg: number }[];
  /** Exercises whose estimated 1RM differs from the estimate from their best set. */
  update: { exerciseId: string; valueKg: number }[];
};

/**
 * "Estimate all 1RMs" (GYM-134, owner decision 2026-11-14: keep the 1RMs set by hand). An
 * exercise with no best set, or whose estimate is 0 kg (sets logged as 0 kg, which a 1RM can't
 * be), is skipped; a manual 1RM is kept; and an estimated 1RM already equal to the estimate is
 * left alone, so a second run changes nothing.
 */
export function planEstimateAll(items: EstimateCandidate[]): EstimatePlan {
  const plan: EstimatePlan = { set: [], update: [] };
  for (const { exerciseId, oneRepMax, best } of items) {
    if (best === null) continue;
    const valueKg = round2(best.e1rmKg);
    if (!(valueKg > 0)) continue;
    if (oneRepMax === null) plan.set.push({ exerciseId, valueKg });
    else if (oneRepMax.source === 'estimated' && oneRepMax.valueKg !== valueKg) {
      plan.update.push({ exerciseId, valueKg });
    }
  }
  return plan;
}

/** The confirm dialog's text: "Set 3 new 1RMs and update 2 from each exercise's best set. …" */
export function estimateAllText(plan: EstimatePlan): string {
  const n = plan.set.length;
  const u = plan.update.length;
  const rms = (k: number) => (k === 1 ? '1RM' : '1RMs');
  const what =
    n > 0 && u > 0
      ? `Set ${n} new ${rms(n)} and update ${u}`
      : n > 0
        ? `Set ${n} new ${rms(n)}`
        : `Update ${u} ${rms(u)}`;
  return `${what} from each exercise's best set. 1RMs set by hand stay.`;
}
