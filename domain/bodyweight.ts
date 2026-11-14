// Spec section 4: the body weight on a date is the latest entry on or before it; for dates
// before the first entry, the earliest entry is used.

export type WeightEntry = { date: string; valueKg: number };

export function bodyWeightOn(entries: WeightEntry[], date: string): WeightEntry | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let found = sorted[0];
  for (const e of sorted) {
    if (e.date <= date) found = e;
    else break;
  }
  return { valueKg: found.valueKg, date: found.date };
}
