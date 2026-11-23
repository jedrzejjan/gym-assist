// Fixed lists (spec section 5, catalogue.ts; GYM-144 and GYM-149). Pure data; no UI, no database.

export const TRAINING_TYPES = ['Strength', 'Plyometric', 'Power', 'Cardio'] as const;

/** The 5 movement patterns, in the owner's order (GYM-149). Cardio exercises have no pattern. */
export const PATTERNS = ['KD', 'HD', 'Push', 'Pull', 'Core'] as const;

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'band',
  'other',
] as const;

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const MECHANICS = ['compound', 'isolation'] as const;
export const MUSCLE_ROLES = ['primary', 'secondary'] as const;

// Keys, English and Polish names: MUSCLE_NAMES in legacy/gym_tracker.py, plus the 4 added in
// GYM-144 (owner decision 2026-11-18).
const MUSCLE_NAMES = {
  quadriceps: { en: 'Quadriceps', pl: 'mięsień czworogłowy uda' },
  hamstrings: { en: 'Hamstrings', pl: 'mięśnie kulszowo-goleniowe' },
  glutes: { en: 'Glutes', pl: 'mięśnie pośladkowe' },
  adductors: { en: 'Adductors', pl: 'mięśnie przywodziciele' },
  abductors: { en: 'Abductors', pl: 'mięśnie odwodziciele' },
  calves: { en: 'Calves', pl: 'mięśnie łydki' },
  core: { en: 'Core', pl: 'mięśnie tułowia (core)' },
  'lower back': { en: 'Lower back', pl: 'prostowniki grzbietu' },
  chest: { en: 'Chest', pl: 'mięsień piersiowy większy' },
  shoulders: { en: 'Shoulders', pl: 'mięśnie barku' },
  triceps: { en: 'Triceps', pl: 'mięsień trójgłowy ramienia' },
  biceps: { en: 'Biceps', pl: 'mięsień dwugłowy ramienia' },
  forearms: { en: 'Forearms', pl: 'mięśnie przedramienia' },
  lats: { en: 'Lats', pl: 'mięsień najszerszy grzbietu' },
  'upper back': { en: 'Upper back', pl: 'mięśnie górnej części pleców' },
  traps: { en: 'Traps', pl: 'mięsień czworoboczny' },
} as const;

export type TrainingType = (typeof TRAINING_TYPES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Level = (typeof LEVELS)[number];
export type Mechanic = (typeof MECHANICS)[number];
export type MuscleRole = (typeof MUSCLE_ROLES)[number];
export type Muscle = keyof typeof MUSCLE_NAMES;

export const MUSCLES = Object.keys(MUSCLE_NAMES) as Muscle[];

/** Subcategories group a pattern's exercises; the owner chooses by them, never searches by them. */
export const SUBCATEGORIES = {
  KD: [],
  HD: [],
  Push: ['vertical', 'horizontal'],
  Pull: ['vertical', 'horizontal'],
  Core: ['anti-extension', 'anti-rotation', 'carry'],
} as const satisfies Record<Pattern, readonly string[]>;

export type Subcategory = (typeof SUBCATEGORIES)[Pattern][number];

const SUBCATEGORY_NAMES: Record<Subcategory, string> = {
  vertical: 'Vertical',
  horizontal: 'Horizontal',
  'anti-extension': 'Anti-extension',
  'anti-rotation': 'Anti-rotation',
  carry: 'Carry',
};

/** Whether a subcategory may go with a pattern (null always may). */
export function subcategoryFits(p: Pattern | null, s: Subcategory | null): boolean {
  if (s === null) return true;
  return p !== null && (SUBCATEGORIES[p] as readonly string[]).includes(s);
}

/** "Knee dominant", "Hip dominant", "Push"…; an exercise with no pattern is cardio. */
export function patternName(p: Pattern | null): string {
  if (p === null) return 'Cardio';
  if (p === 'KD') return 'Knee dominant';
  if (p === 'HD') return 'Hip dominant';
  return p;
}

/** "Vertical", "Anti-rotation"…; exercises without one are listed under "Other". */
export function subcategoryName(s: Subcategory | null): string {
  return s === null ? 'Other' : SUBCATEGORY_NAMES[s];
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function equipmentName(e: Equipment): string {
  return capitalise(e);
}

export function levelName(l: Level): string {
  return capitalise(l);
}

export function muscleName(m: Muscle): { en: string; pl: string } {
  return MUSCLE_NAMES[m];
}

/** ['lats', 'biceps'] → 'Lats, biceps' (as on the library/detail board). */
export function muscleList(muscles: readonly Muscle[]): string {
  if (muscles.length === 0) return '-';
  return capitalise(muscles.map((m) => MUSCLE_NAMES[m].en.toLowerCase()).join(', '));
}

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

/** The library row's second line (board `library / list`): Polish name · pattern · equipment. */
export function libraryRowText(e: {
  namePl: string | null;
  pattern: Pattern | null;
  equipment: Equipment;
}): string {
  return join([e.namePl, patternName(e.pattern), equipmentName(e.equipment)]);
}

/**
 * The choose lists' second line (boards `log / choose - pattern exercises` and `- search`):
 * Polish name · equipment · primary muscles, and "also: <alias>" when only an alias matched.
 */
export function chooseRowText(e: {
  namePl: string | null;
  equipment: Equipment;
  primaryMuscles: readonly Muscle[];
  matchedAlias?: string | null;
}): string {
  return join([
    e.namePl,
    equipmentName(e.equipment),
    muscleList(e.primaryMuscles),
    e.matchedAlias ? `also: ${e.matchedAlias}` : null,
  ]);
}
