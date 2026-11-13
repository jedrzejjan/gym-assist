// Fixed lists (spec section 5, catalogue.ts). Pure data; no UI, no database.

export const TRAINING_TYPES = ['Strength', 'Plyometric', 'Power', 'Cardio'] as const;
export const PATTERNS = [
  'KD',
  'HD',
  'Push vertical',
  'Push horizontal',
  'Pull vertical',
  'Pull horizontal',
  'Anti flexion',
  'Anti extension',
  'Carries',
  'none',
] as const;

// Keys, English and Polish names: MUSCLE_NAMES in legacy/gym_tracker.py.
const MUSCLE_NAMES = {
  quadriceps: { en: 'Quadriceps', pl: 'mięsień czworogłowy uda' },
  hamstrings: { en: 'Hamstrings', pl: 'mięśnie kulszowo-goleniowe' },
  glutes: { en: 'Glutes', pl: 'mięśnie pośladkowe' },
  adductors: { en: 'Adductors', pl: 'mięśnie przywodziciele' },
  calves: { en: 'Calves', pl: 'mięśnie łydki' },
  core: { en: 'Core', pl: 'mięśnie tułowia (core)' },
  chest: { en: 'Chest', pl: 'mięsień piersiowy większy' },
  shoulders: { en: 'Shoulders', pl: 'mięśnie barku' },
  triceps: { en: 'Triceps', pl: 'mięsień trójgłowy ramienia' },
  biceps: { en: 'Biceps', pl: 'mięsień dwugłowy ramienia' },
  lats: { en: 'Lats', pl: 'mięsień najszerszy grzbietu' },
  'upper back': { en: 'Upper back', pl: 'mięśnie górnej części pleców' },
} as const;

export type TrainingType = (typeof TRAINING_TYPES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Muscle = keyof typeof MUSCLE_NAMES;

export const MUSCLES = Object.keys(MUSCLE_NAMES) as Muscle[];

export function muscleName(m: Muscle): { en: string; pl: string } {
  return MUSCLE_NAMES[m];
}

/** Screens show the patterns KD and HD as "Knee Dominant" and "Hip Dominant". */
export function displayName(code: string): string {
  if (code === 'KD') return 'Knee Dominant';
  if (code === 'HD') return 'Hip Dominant';
  return code;
}

/** ['lats', 'biceps'] → 'Lats, biceps' (as on the library/detail board). */
export function muscleList(muscles: readonly Muscle[]): string {
  if (muscles.length === 0) return '-';
  const text = muscles.map((m) => MUSCLE_NAMES[m].en.toLowerCase()).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The library row subtitle (board `library/list`): the Polish name, then the pattern — or "BW"
 * for an exercise that uses body weight — then "custom" for one the trainer added.
 */
export function exerciseSubtitle(e: {
  namePl: string | null;
  pattern: string;
  usesBodyweight: boolean;
  isCustom: boolean;
}): string {
  const parts = [e.namePl, e.usesBodyweight ? 'BW' : displayName(e.pattern)];
  if (e.isCustom) parts.push('custom');
  return parts.filter(Boolean).join(' · ');
}
