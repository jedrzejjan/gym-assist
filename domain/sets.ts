// Number input rules (spec section 5, "Errors"): a comma or a dot is the decimal separator,
// blank means no value, and anything else is refused rather than saved wrong.

const DECIMAL = /^(\d+([.,]\d*)?|[.,]\d+)$/;

/** '22,5' and '22.5' → 22.5; '' → null; '-5', '1e3', 'abc' → 'invalid'. */
export function parseWeight(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (t === '') return null;
  if (!DECIMAL.test(t)) return 'invalid';
  return Number(t.replace(',', '.'));
}

/** '8' → 8; '' → null; '0', '8.5', '-1', 'abc' → 'invalid' (a set has at least 1 rep). */
export function parseReps(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return 'invalid';
  const n = Number(t);
  return n >= 1 ? n : 'invalid';
}

/** The next set's number: one more than the highest, so numbers never repeat after a delete. */
export function nextSetNo(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/** One set's values as stored: kg (the added load for bodyweight exercises) and reps. */
export type SetValue = { weightKg: number | null; reps: number | null };

/** 62.5 → '62.5', 60 → '60'. */
export function formatKg(n: number): string {
  return String(Number(n.toFixed(2)));
}

/** '60 kg × 8'; for bodyweight exercises 'BW + 10 kg × 6' or 'BW × 8'. A blank value is '-'. */
export function formatSet(s: SetValue, usesBodyweight: boolean): string {
  const reps = s.reps === null ? '-' : String(s.reps);
  let weight: string;
  if (usesBodyweight) weight = s.weightKg ? `BW + ${formatKg(s.weightKg)} kg` : 'BW';
  else weight = s.weightKg === null ? '-' : `${formatKg(s.weightKg)} kg`;
  return `${weight} × ${reps}`;
}

/** 'Last time: 60 kg × 8, 62.5 kg × 6', or 'First time' when there is nothing to show. */
export function formatLastTime(sets: SetValue[] | null, usesBodyweight: boolean): string {
  if (!sets || sets.length === 0) return 'First time';
  return `Last time: ${sets.map((s) => formatSet(s, usesBodyweight)).join(', ')}`;
}
