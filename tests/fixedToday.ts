// Freeze only the date (not timers), so screens that default to "today" are predictable while
// React Native Testing Library's async helpers keep working.
export function fixToday(year: number, month: number, day: number) {
  jest.useFakeTimers({
    now: new Date(year, month - 1, day, 12, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'hrtime',
      'performance',
    ],
  });
}

afterEach(() => {
  jest.useRealTimers();
});
