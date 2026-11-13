// Checking the old tool's sessions.csv before anything is imported (spec section 6, Import;
// GYM-25). Pure: the table comes from parseCsv, the exercise names from the library.
import { isValidDate } from './dates';
import { parseReps, parseWeight } from './sets';

/** The columns of legacy/gym_tracker.py's SESSION_FIELDS. */
export const IMPORT_COLUMNS = [
  'date',
  'exercise_en',
  'set_no',
  'side',
  'weight_kg',
  'reps',
  'height_cm',
  'speed_kmh',
  'minutes',
  'note',
] as const;

type Column = (typeof IMPORT_COLUMNS)[number];

export type ImportRow = {
  /** The line in the file; the header is line 1. */
  line: number;
  date: string;
  exerciseEn: string;
  setNo: number;
  side: string | null;
  weightKg: number | null;
  reps: number | null;
  heightCm: number | null;
  speedKmh: number | null;
  minutes: number | null;
  note: string | null;
};

export type ImportCheck =
  | { ok: true; rows: ImportRow[] }
  | { ok: false; line: number; message: string; unknownNames: string[] };

const SIDES = new Set(['L', 'P', 'per side']);

/** Exercise names match ignoring case and surrounding spaces (as in the library). */
export const foldImportName = (s: string) => s.trim().toLocaleLowerCase('pl');

const fail = (line: number, message: string): ImportCheck => ({
  ok: false,
  line,
  message,
  unknownNames: [],
});

/**
 * Every row is checked before anything is written, so nothing is imported partly. Unknown
 * exercise names are all listed at once (the trainer fixes them in one go), with the first row
 * that has one; any other problem reports its row.
 */
export function validateImport(
  table: string[][],
  knownNames: Set<string>,
  today: string,
): ImportCheck {
  const header = (table[0] ?? []).map((h) => h.trim());
  const sameColumns =
    header.length === IMPORT_COLUMNS.length && IMPORT_COLUMNS.every((c) => header.includes(c));
  if (!sameColumns) {
    return fail(1, `The first row must have the columns ${IMPORT_COLUMNS.join(', ')}.`);
  }
  if (table.length < 2) return fail(1, 'The file has no sets to import.');
  const at = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    Column,
    number
  >;

  for (let i = 1; i < table.length; i++) {
    if (table[i].length !== IMPORT_COLUMNS.length) {
      return fail(i + 1, `Row ${i + 1} has ${table[i].length} fields; the first row has 10.`);
    }
  }

  // Pass 1: every unknown name, in the order they first appear.
  const known = new Set([...knownNames].map(foldImportName));
  const unknown = new Map<string, { name: string; line: number }>();
  for (let i = 1; i < table.length; i++) {
    const name = table[i][at.exercise_en].trim();
    const key = foldImportName(name);
    if (!known.has(key) && !unknown.has(key)) unknown.set(key, { name, line: i + 1 });
  }
  if (unknown.size > 0) {
    const first = [...unknown.values()][0].line;
    return {
      ok: false,
      line: first,
      message: `Row ${first} has an exercise that is not in the library:`,
      unknownNames: [...unknown.values()].map((u) => u.name),
    };
  }

  // Pass 2: the values.
  const rows: ImportRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const get = (c: Column) => table[i][at[c]].trim();
    const blank = (v: string) => (v === '' ? null : v);

    const date = get('date');
    if (!isValidDate(date)) return fail(line, `Row ${line}: "${date}" is not a date (YYYY-MM-DD).`);
    if (date > today) return fail(line, `Row ${line}: ${date} is in the future.`);

    const setNo = get('set_no');
    if (!/^\d+$/.test(setNo) || Number(setNo) < 1) {
      return fail(line, `Row ${line}: set_no must be a whole number, 1 or more.`);
    }

    const side = get('side');
    if (side !== '' && !SIDES.has(side)) {
      return fail(line, `Row ${line}: side must be blank, L, P or "per side".`);
    }

    const weightKg = parseWeight(get('weight_kg'));
    if (weightKg === 'invalid') {
      return fail(line, `Row ${line}: weight_kg must be a number, 0 or more.`);
    }
    const reps = parseReps(get('reps'));
    if (reps === 'invalid') {
      return fail(line, `Row ${line}: reps must be a whole number, 1 or more.`);
    }

    const extra: Record<'height_cm' | 'speed_kmh' | 'minutes', number | null> = {
      height_cm: null,
      speed_kmh: null,
      minutes: null,
    };
    for (const c of ['height_cm', 'speed_kmh', 'minutes'] as const) {
      const v = parseWeight(get(c)); // the same rule: a comma or a dot, 0 or more, or blank
      if (v === 'invalid') return fail(line, `Row ${line}: ${c} must be a number, 0 or more.`);
      extra[c] = v;
    }

    rows.push({
      line,
      date,
      exerciseEn: get('exercise_en'),
      setNo: Number(setNo),
      side: blank(side),
      weightKg,
      reps,
      heightCm: extra.height_cm,
      speedKmh: extra.speed_kmh,
      minutes: extra.minutes,
      note: blank(table[i][at.note]),
    });
  }
  return { ok: true, rows };
}
