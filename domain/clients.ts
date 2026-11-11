export function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

/** Age in whole years on `today`; a birthday counts once it has happened. Dates are 'YYYY-MM-DD'. */
export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}
