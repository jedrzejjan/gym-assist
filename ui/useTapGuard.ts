import { useRef } from 'react';

/**
 * Ignores a second tap that comes within `ms` of the first, so a quick double tap can't run an
 * action twice (e.g. push the same screens twice). Unlike a one-shot ref, it works again later,
 * for screens that stay mounted under the next one. It uses performance.now(), which keeps
 * counting even when a test fixes the date.
 */
export function useTapGuard(ms = 800) {
  const last = useRef(-Infinity);
  return (action: () => void) => {
    const now = performance.now();
    if (now - last.current < ms) return;
    last.current = now;
    action();
  };
}
