import { IMPORT_COLUMNS, validateImport } from '../importRows';

const HEADER = [...IMPORT_COLUMNS];
const known = new Set(['Back squat', 'Bench press', 'Hip flexor variation with locked leg']);
const TODAY = '2026-11-12';

/** A row in header order; missing trailing fields are blank. */
const row = (o: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>) =>
  HEADER.map((c) => o[c] ?? '');

test('a valid file gives typed rows with the file line numbers', () => {
  const r = validateImport(
    [
      HEADER,
      row({
        date: '2026-11-01',
        exercise_en: ' back squat ',
        set_no: '1',
        weight_kg: '80',
        reps: '5',
      }),
      row({
        date: '2026-11-01',
        exercise_en: 'Bench press',
        set_no: '2',
        speed_kmh: '10',
        minutes: '20',
        note: 'easy, warm-up',
      }),
    ],
    known,
    TODAY,
  );
  expect(r).toEqual({
    ok: true,
    rows: [
      {
        line: 2,
        date: '2026-11-01',
        exerciseEn: 'back squat',
        setNo: 1,
        side: null,
        weightKg: 80,
        reps: 5,
        heightCm: null,
        speedKmh: null,
        minutes: null,
        note: null,
      },
      {
        line: 3,
        date: '2026-11-01',
        exerciseEn: 'Bench press',
        setNo: 2,
        side: null,
        weightKg: null,
        reps: null,
        heightCm: null,
        speedKmh: 10,
        minutes: 20,
        note: 'easy, warm-up',
      },
    ],
  });
});

test('the header may be in any order, but must have exactly the 10 columns', () => {
  const shuffled = [...HEADER].reverse();
  const r = validateImport(
    [
      shuffled,
      shuffled.map(
        (c) => ({ date: '2026-11-01', exercise_en: 'Back squat', set_no: '1' })[c as 'date'] ?? '',
      ),
    ],
    known,
    TODAY,
  );
  expect(r.ok).toBe(true);
  const missing = validateImport([HEADER.slice(0, 9), ['2026-11-01']], known, TODAY);
  expect(missing).toMatchObject({ ok: false, line: 1 });
  if (!missing.ok)
    expect(missing.message).toMatch(/^The first row must have the columns date, exercise_en/);
});

test('unknown names are all listed and nothing is accepted', () => {
  const r = validateImport(
    [
      HEADER,
      row({ date: '2026-11-01', exercise_en: 'Back squat', set_no: '1' }),
      row({ date: '2026-11-01', exercise_en: 'Front squat', set_no: '1' }),
      row({ date: '2026-11-02', exercise_en: 'Nordic curl', set_no: '1' }),
      row({ date: '2026-11-02', exercise_en: 'front squat', set_no: '2' }),
    ],
    known,
    TODAY,
  );
  expect(r).toEqual({
    ok: false,
    line: 3,
    message: 'Row 3 has an exercise that is not in the library:',
    unknownNames: ['Front squat', 'Nordic curl'],
  });
});

test('a bad reps value reports its line', () => {
  const r = validateImport(
    [
      HEADER,
      row({ date: '2026-11-01', exercise_en: 'Back squat', set_no: '1', reps: '5' }),
      row({ date: '2026-11-01', exercise_en: 'Back squat', set_no: '2', reps: '8.5' }),
    ],
    known,
    TODAY,
  );
  expect(r).toEqual({
    ok: false,
    line: 3,
    message: 'Row 3: reps must be a whole number, 1 or more.',
    unknownNames: [],
  });
});

test('22,5 is 22.5', () => {
  const r = validateImport(
    [
      HEADER,
      row({
        date: '2026-11-01',
        exercise_en: 'Bench press',
        set_no: '1',
        weight_kg: '22,5',
        reps: '8',
      }),
    ],
    known,
    TODAY,
  );
  expect(r.ok && r.rows[0].weightKg).toBe(22.5);
});

test('the same set_no with L and P is kept twice', () => {
  const name = 'Hip flexor variation with locked leg';
  const r = validateImport(
    [
      HEADER,
      row({ date: '2026-10-20', exercise_en: name, set_no: '1', side: 'L', reps: '12' }),
      row({ date: '2026-10-20', exercise_en: name, set_no: '1', side: 'P', reps: '12' }),
    ],
    known,
    TODAY,
  );
  expect(r.ok && r.rows.map((x) => [x.setNo, x.side])).toEqual([
    [1, 'L'],
    [1, 'P'],
  ]);
});

test.each([
  [{ date: '2026-13-01' }, 'Row 2: "2026-13-01" is not a date (YYYY-MM-DD).'],
  [{ date: '2026-11-13' }, 'Row 2: 2026-11-13 is in the future.'],
  [{ set_no: '0' }, 'Row 2: set_no must be a whole number, 1 or more.'],
  [{ weight_kg: 'heavy' }, 'Row 2: weight_kg must be a number, 0 or more.'],
  [{ side: 'left' }, 'Row 2: side must be blank, L, P or "per side".'],
  [{ minutes: '-1' }, 'Row 2: minutes must be a number, 0 or more.'],
])('a bad value is refused: %o', (bad, message) => {
  const r = validateImport(
    [HEADER, row({ date: '2026-11-01', exercise_en: 'Back squat', set_no: '1', ...bad })],
    known,
    TODAY,
  );
  expect(r).toEqual({ ok: false, line: 2, message, unknownNames: [] });
});

test('a row with the wrong number of fields, or a file with no rows, is refused', () => {
  expect(validateImport([HEADER, ['2026-11-01', 'Back squat']], known, TODAY)).toMatchObject({
    ok: false,
    line: 2,
    message: 'Row 2 has 2 fields; the first row has 10.',
  });
  expect(validateImport([HEADER], known, TODAY)).toMatchObject({
    ok: false,
    message: 'The file has no sets to import.',
  });
  expect(validateImport([], known, TODAY)).toMatchObject({ ok: false, line: 1 });
});
