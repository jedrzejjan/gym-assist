/* global penpotUtils, storage */
// Board checks for the Gym Assist UX Penpot file (Stage 1 plan, Task 1).
// Paste this file into the Penpot MCP `execute_code` tool, then call e.g.
//   return storage.checkBoards('Log session', [...names]);
//   return storage.checkLinks('Log session', ['clients/list']);

const TARGET_COMPONENTS = [
  'kit/button primary',
  'kit/button secondary',
  'kit/list row',
  'kit/set row',
  'kit/number field',
  'kit/search field',
];

// Penpot shows a path as "kit / app bar"; the plan writes "kit/app bar". Compare both the same way.
const norm = (name) => name.replace(/\s*\/\s*/g, '/').trim();
const componentName = (c) => norm(c.path ? `${c.path}/${c.name}` : c.name);

function pageBoards(pageName) {
  const page = penpotUtils.getPageByName(pageName);
  if (!page) throw new Error(`Page not found: ${pageName}`);
  return page.root.children.filter((s) => s.type === 'board');
}

function inside(inner, outer) {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}

storage.checkBoards = function checkBoards(pageName, expected, opts = {}) {
  const boards = pageBoards(pageName);
  const names = boards.map((b) => norm(b.name));
  const wanted = expected.map(norm);
  const result = {
    missing: wanted.filter((n) => !names.includes(n)),
    extra: names.filter(
      (n) => !wanted.includes(n) && !(pageName === 'Flows' && n.startsWith('flow/')),
    ),
    wrongSize: [],
    smallText: [],
    smallTargets: [],
    overflow: [],
  };
  for (const board of boards) {
    if (!opts.ignoreSize && (Math.round(board.width) !== 360 || Math.round(board.height) !== 800)) {
      result.wrongSize.push(board.name);
    }
    const shapes = penpotUtils.findShapes(() => true, board).filter((s) => s.id !== board.id);
    for (const shape of shapes) {
      const where = `${board.name} > ${shape.name}`;
      if (shape.type === 'text') {
        if (Number(shape.fontSize) < 14) result.smallText.push(where);
        if (shape.parent && !inside(shape.textBounds, shape.parent.bounds)) {
          result.overflow.push(where);
        }
      }
      const component = shape.isComponentRoot && shape.isComponentRoot() ? shape.component() : null;
      if (
        component &&
        TARGET_COMPONENTS.includes(componentName(component)) &&
        (shape.width < 48 || shape.height < 48)
      ) {
        result.smallTargets.push(where);
      }
      if (!penpotUtils.isContainedIn(shape, board)) result.overflow.push(where);
    }
  }
  result.overflow = [...new Set(result.overflow)];
  return result;
};

storage.checkLinks = function checkLinks(pageName, startBoards) {
  const boards = pageBoards(pageName);
  const incoming = new Set();
  const outgoing = new Map(boards.map((b) => [b.id, 0]));
  for (const board of boards) {
    const shapes = penpotUtils.findShapes(() => true, board);
    for (const shape of shapes) {
      for (const interaction of shape.interactions || []) {
        outgoing.set(board.id, outgoing.get(board.id) + 1);
        const destination = interaction.action && interaction.action.destination;
        if (destination) incoming.add(destination.id);
      }
    }
  }
  const isDialog = (b) => b.name.includes('/dialog');
  return {
    unreachable: boards
      .filter((b) => !startBoards.map(norm).includes(norm(b.name)) && !incoming.has(b.id))
      .map((b) => b.name),
    deadEnds: boards.filter((b) => !isDialog(b) && outgoing.get(b.id) === 0).map((b) => b.name),
    dialogsMissingActions: boards
      .filter((b) => isDialog(b) && outgoing.get(b.id) < 2)
      .map((b) => b.name),
  };
};
