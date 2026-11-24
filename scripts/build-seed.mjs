#!/usr/bin/env node
// Builds data/seed/exercises.json from the owner's merged exercise library (GYM-149).
//
//   node scripts/build-seed.mjs local-data/main-exercise-db.json
//
// The source file is gitignored; the output is committed and is the library the app installs.
// It maps the source's names to the app's codes ("Knee dominant" → KD, "Anti-extension" →
// anti-extension, important → importance) and stops on any value the app doesn't know, so a
// typo in the source can't reach a phone. Keys are written in a fixed order, so diffs stay small.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PATTERNS = {
  'Knee dominant': 'KD',
  'Hip dominant': 'HD',
  Push: 'Push',
  Pull: 'Pull',
  Core: 'Core',
};
const SUBCATEGORIES = {
  vertical: 'vertical',
  horizontal: 'horizontal',
  'Anti-extension': 'anti-extension',
  'Anti-rotation': 'anti-rotation',
  Carry: 'carry',
};
const TRAINING_TYPES = ['Strength', 'Plyometric', 'Power', 'Cardio'];
const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'band',
  'other',
];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const MECHANICS = ['compound', 'isolation'];
const MUSCLES = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'core',
  'lower back',
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'upper back',
  'traps',
];

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/build-seed.mjs <main-exercise-db.json>');
  process.exit(2);
}

const problems = [];
function check(ok, name, what) {
  if (!ok) problems.push(`${name}: ${what}`);
}
function mapped(table, value, name, field) {
  if (value === null || value === undefined) return null;
  check(value in table, name, `unknown ${field} ${JSON.stringify(value)}`);
  return table[value] ?? null;
}
function oneOf(list, value, name, field, { nullable }) {
  if (value === null || value === undefined) {
    check(nullable, name, `missing ${field}`);
    return null;
  }
  check(list.includes(value), name, `unknown ${field} ${JSON.stringify(value)}`);
  return value;
}
function muscles(list, name, field) {
  const out = list ?? [];
  for (const m of out)
    check(MUSCLES.includes(m), name, `unknown ${field} muscle ${JSON.stringify(m)}`);
  return out;
}

const { exercises } = JSON.parse(readFileSync(source, 'utf8'));
const seed = exercises.map((e) => {
  const name = e.nameEn;
  check(typeof name === 'string' && name.trim() !== '', String(name), 'missing English name');
  check(typeof e.namePl === 'string' && e.namePl.trim() !== '', name, 'missing Polish name');
  check([1, 2, 3, 4].includes(e.important), name, `importance ${e.important}`);
  return {
    nameEn: name.trim(),
    namePl: e.namePl.trim(),
    aliases: (e.aliases ?? []).map((a) => a.trim()),
    pattern: mapped(PATTERNS, e.pattern, name, 'pattern'),
    subcategory: mapped(SUBCATEGORIES, e.subcategory, name, 'subcategory'),
    trainingType: oneOf(TRAINING_TYPES, e.trainingType, name, 'training type', { nullable: false }),
    equipment: oneOf(EQUIPMENT, e.equipment, name, 'equipment', { nullable: false }),
    primaryMuscles: muscles(e.primaryMuscles, name, 'primary'),
    secondaryMuscles: muscles(e.secondaryMuscles, name, 'secondary'),
    mechanic: oneOf(MECHANICS, e.mechanic, name, 'mechanic', { nullable: true }),
    level: oneOf(LEVELS, e.level, name, 'level', { nullable: true }),
    unilateral: e.unilateral === true,
    usesBodyweight: e.usesBodyweight === true,
    importance: e.important,
  };
});

if (problems.length > 0) {
  console.error(`${problems.length} problem(s) in ${source}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seed', 'exercises.json');
writeFileSync(out, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
console.log(`wrote ${seed.length} exercises to ${out}`);
