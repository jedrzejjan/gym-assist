// Personal training history must never be committed, wherever it is copied.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..', '..');

function isIgnored(file) {
  return spawnSync('git', ['check-ignore', '-q', '--no-index', file], { cwd: root }).status === 0;
}

test.each([
  'sessions.csv',
  'visits.csv',
  'data/sessions.csv',
  'data/visits.csv',
  'legacy/data/sessions.csv',
])('ignores personal history at %s', (file) => {
  expect(isIgnored(file)).toBe(true);
});

test('does not ignore anonymised test fixtures', () => {
  expect(isIgnored('data/__fixtures__/sample-sessions.csv')).toBe(false);
});
