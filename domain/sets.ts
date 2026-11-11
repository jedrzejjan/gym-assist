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
