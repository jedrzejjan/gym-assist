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
