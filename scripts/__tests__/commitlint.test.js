// Runs the real commitlint CLI the way CI does: the PR title on stdin.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const cli = require.resolve('@commitlint/cli/cli.js', { paths: [root] });

function isValid(title) {
  const result = spawnSync(process.execPath, [cli], { cwd: root, input: title, encoding: 'utf8' });
  return result.status === 0;
}

test.each(['feat(log): GYM-12 Log set screen', 'chore(infra): GYM-3 Move legacy tool'])(
  'accepts %s',
  (title) => {
    expect(isValid(title)).toBe(true);
  },
);

test.each([
  ['no ticket key', 'feat(log): Log set screen'],
  ['lowercase key', 'feat(log): gym-12 Log set screen'],
  ['unknown type', 'feature(log): GYM-12 Log set screen'],
  ['unknown scope', 'feat(ui): GYM-12 Log set screen'],
  ['no scope', 'feat: GYM-12 Log set screen'],
  ['no ticket name', 'feat(log): GYM-12'],
  ['two spaces after the key', 'feat(log): GYM-12  Log set screen'],
  ['ticket number zero', 'feat(log): GYM-0 Log set screen'],
])('rejects a title with %s', (_reason, title) => {
  expect(isValid(title)).toBe(false);
});
