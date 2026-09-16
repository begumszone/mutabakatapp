/**
 * Parses an amount that may carry thousand separators, a currency symbol, or
 * accounting parentheses, in either US (1,234.56) or TR/EU (1.234,56) style.
 * Returns null when the value cannot be read as a number — never 0, because
 * a silent zero in a ledger is a wrong balance.
 */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const trimmed = String(value).trim();
  if (trimmed === '') return null;

  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const isTrailingNegative = /-\s*$/.test(trimmed);
  let cleaned = trimmed.replace(/[^0-9.,-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    // Whichever separator comes last is the decimal separator.
    const decimalIsComma = lastComma > lastDot;
    cleaned = cleaned.split(decimalIsComma ? '.' : ',').join('');
    if (decimalIsComma) cleaned = cleaned.replace(',', '.');
  } else if (lastComma !== -1) {
    const fraction = cleaned.length - lastComma - 1;
    const commas = cleaned.split(',').length - 1;
    if (commas === 1 && fraction > 0 && fraction <= 2) cleaned = cleaned.replace(',', '.');
    else cleaned = cleaned.split(',').join('');
  } else if (lastDot !== -1) {
    const fraction = cleaned.length - lastDot - 1;
    const dots = cleaned.split('.').length - 1;
    if (dots > 1 || fraction === 3) cleaned = cleaned.split('.').join('');
  }

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (isParenNegative || isTrailingNegative) return -Math.abs(n);
  return n;
}

/**
 * Rounds to cents, killing the float noise that makes a bridge look
 * unbalanced.
 *
 * Also collapses negative zero. It is a real value in IEEE arithmetic and
 * comes out of any sum that cancels from below, but "-0,00 ₺" in a
 * reconciliation reads as a difference somebody then goes looking for.
 */
export function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}
