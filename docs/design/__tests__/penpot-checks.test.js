// Runs penpot-checks.js against a small fake Penpot page, the way execute_code runs it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'penpot-checks.js'), 'utf8');

let nextId = 0;
function shape(props) {
  nextId += 1;
  const s = { id: `s${nextId}`, type: 'rectangle', children: [], interactions: [], ...props };
  s.bounds = { x: s.x, y: s.y, width: s.width, height: s.height };
  for (const c of s.children) c.parent = s;
  return s;
}

function load(boards) {
  const all = (root) => [root, ...root.children.flatMap(all)];
  const page = { root: { children: boards } };
  const penpotUtils = {
    getPageByName: (n) => (n === 'Test' ? page : null),
    findShapes: (pred, root) => all(root).filter(pred),
    isContainedIn: (s, b) =>
      s.x >= b.x && s.y >= b.y && s.x + s.width <= b.x + b.width && s.y + s.height <= b.y + b.height,
  };
  const storage = {};
  vm.runInNewContext(source, { penpotUtils, storage });
  return storage;
}

const text = (props) =>
  shape({
    type: 'text',
    fontSize: '16',
    x: 10,
    y: 10,
    width: 100,
    height: 20,
    textBounds: { x: 10, y: 10, width: 100, height: 20 },
    ...props,
  });

const board = (name, children = [], props = {}) =>
  shape({ type: 'board', name, x: 0, y: 0, width: 360, height: 800, children, ...props });

test('checkBoards passes a clean board', () => {
  const storage = load([board('log/start', [text({ name: 'title' })])]);
  expect(storage.checkBoards('Test', ['log/start'])).toEqual({
    missing: [],
    extra: [],
    wrongSize: [],
    smallText: [],
    smallTargets: [],
    overflow: [],
  });
});

test('checkBoards flags text with mixed font sizes', () => {
  const storage = load([board('log/start', [text({ name: 'mixed', fontSize: 'mixed' })])]);
  expect(storage.checkBoards('Test', ['log/start']).smallText).toEqual(['log/start > mixed']);
});

test('checkBoards matches "kit / app bar" to "kit/app bar"', () => {
  const storage = load([board('kit / app bar')]);
  expect(storage.checkBoards('Test', ['kit/app bar'])).toMatchObject({ missing: [], extra: [] });
});

test('checkBoards survives text that has no textBounds yet', () => {
  const storage = load([board('log/start', [text({ name: 'pending', textBounds: undefined })])]);
  expect(storage.checkBoards('Test', ['log/start']).overflow).toEqual([]);
});

test('checkLinks does not count a link to the same board as incoming', () => {
  const a = board('log/a');
  const orphan = board('log/orphan');
  a.children.push(shape({ x: 0, y: 0, width: 10, height: 10, interactions: [{ action: { destination: orphan } }] }));
  orphan.children.push(
    shape({ x: 0, y: 0, width: 10, height: 10, interactions: [{ action: { destination: a } }] }),
  );
  const self = board('log/self');
  self.children.push(
    shape({ x: 0, y: 0, width: 10, height: 10, interactions: [{ action: { destination: self } }] }),
  );
  expect(load([a, orphan, self]).checkLinks('Test', ['log/a']).unreachable).toEqual(['log/self']);
});
