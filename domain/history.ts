// Wording for the workout history (boards `history/list` and `history/dialog - delete session`).

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** (4, 14) → '4 exercises · 14 sets'; (1, 1) → '1 exercise · 1 set'. */
export function countsText(exerciseCount: number, setCount: number): string {
  return `${plural(exerciseCount, 'exercise')} · ${plural(setCount, 'set')}`;
}
