// Dates are 'YYYY-MM-DD' strings in the phone's local time zone (sessions store a date only).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date on the phone. Not toISOString(), which is UTC and can be a day off. */
export function todayLocal(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

/** '2026-11-07' → '7 Nov' */
export function formatDayMonth(s: string): string {
  const [, m, d] = parts(s);
  return `${d} ${MONTHS[m - 1]}`;
}

/** '2026-10-27' → '27 Oct 2026' */
export function formatDayMonthYear(s: string): string {
  const [y] = parts(s);
  return `${formatDayMonth(s)} ${y}`;
}
