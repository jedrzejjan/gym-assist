// Spec section 5, progress.ts. This file holds the "% to kg" part; e1RM and best set come with
// Progress (Sprint 2).

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
