import { planLibraryUpgrade } from '../library';

const seed = [
  { nameEn: 'Barbell Bench Press - Medium Grip', aliases: ['Bench press', 'flat bench'] },
  { nameEn: 'Back Squat', aliases: ['squat'] },
  { nameEn: 'Przysiad bułgarski', aliases: [] },
  { nameEn: 'Plank', aliases: [] },
];

test('an old name that is now an alias maps to that exercise, keeping its id', () => {
  const plan = planLibraryUpgrade([{ id: 'e1', nameEn: 'Bench press', aliases: [] }], seed);
  expect(plan.map).toEqual([{ id: 'e1', seedIndex: 0 }]);
  expect(plan.drop).toEqual([]);
  expect(plan.insert).toEqual([1, 2, 3]);
});

test('matching ignores case and surrounding spaces, Polish letters too', () => {
  const plan = planLibraryUpgrade(
    [
      { id: 'a', nameEn: '  back SQUAT ', aliases: [] },
      { id: 'b', nameEn: 'PRZYSIAD BUŁGARSKI', aliases: [] },
    ],
    seed,
  );
  expect(plan.map).toEqual([
    { id: 'a', seedIndex: 1 },
    { id: 'b', seedIndex: 2 },
  ]);
});

test("an existing exercise's own alias can match too", () => {
  const plan = planLibraryUpgrade([{ id: 'e1', nameEn: 'My plank', aliases: ['plank'] }], seed);
  expect(plan.map).toEqual([{ id: 'e1', seedIndex: 3 }]);
});

test('an exercise with no match is dropped', () => {
  const plan = planLibraryUpgrade([{ id: 'x', nameEn: 'My drill', aliases: [] }], seed);
  expect(plan.map).toEqual([]);
  expect(plan.merge).toEqual([]);
  expect(plan.drop).toEqual(['x']);
  expect(plan.insert).toEqual([0, 1, 2, 3]);
});

test('two existing exercises hitting one library exercise: the first maps, the second merges into it', () => {
  const plan = planLibraryUpgrade(
    [
      { id: 'first', nameEn: 'Bench press', aliases: [] },
      { id: 'second', nameEn: 'flat bench', aliases: [] },
    ],
    seed,
  );
  expect(plan.map).toEqual([{ id: 'first', seedIndex: 0 }]);
  // A match is never deleted with its history (owner rule): it joins the exercise it matched.
  expect(plan.merge).toEqual([{ from: 'second', into: 'first' }]);
  expect(plan.drop).toEqual([]);
  expect(plan.insert).toEqual([1, 2, 3]);
});
