/** Text and document-number normalization shared by parsing and matching. */

const TR_MAP: Record<string, string> = {
  ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

/** Lower-cases and strips Turkish diacritics so "FATURA" and "Fatura" agree. */
export function foldText(value: string): string {
  return value
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .trim();
}

/**
 * Turns a document number into a matching key.
 *
 * The same invoice is rarely typed the same way twice. One side books
 * "ABC2026000000123", the other "ABC 2026-123" or just "123". We strip
 * everything that is not alphanumeric, fold case, and drop zero padding
 * inside the number so those collapse onto each other.
 *
 * Returns '' when nothing usable is left, which callers must treat as
 * "no document number" rather than as a key that matches other blanks.
 */
export function normalizeDocNo(value: string | null | undefined): string {
  if (!value) return '';
  const folded = foldText(String(value)).replace(/[^a-z0-9]/g, '');
  if (folded === '') return '';
  // Collapse runs of zeros that only exist as padding: abc000123 -> abc123.
  const unpadded = folded.replace(/(^|[a-z])0+(\d)/g, '$1$2');
  return unpadded === '' ? '' : unpadded;
}

/**
 * The trailing digits of a document number, used as a weaker second-pass key.
 * Serials are what actually identify the document; prefixes are branch codes,
 * series letters and year stamps that the two sides often record differently.
 * Returns '' when there are fewer than `minLength` digits to be confident with.
 */
export function docNoSuffix(docKey: string, minLength = 5): string {
  const digits = docKey.replace(/\D/g, '');
  if (digits.length < minLength) return '';
  return digits.slice(-Math.max(minLength, Math.min(digits.length, 8)));
}

/**
 * A looser document key that also collapses runs of padding zeros *inside*
 * the number.
 *
 * Two ERPs pad the same invoice differently: SAP writes
 * `AL72026000000017` where the customer's Logo export writes
 * `AL7202600000017` — one zero apart, same invoice. Squeezing every run of
 * two or more zeros out of both leaves `al7202617` on each side, while
 * keeping `AL1...` and `AL7...` apart. It is deliberately a later pass than
 * the exact key, because it can in principle bring two genuinely different
 * numbers together.
 */
export function normalizeDocNoLoose(value: string | null | undefined): string {
  const key = normalizeDocNo(value);
  if (key === '') return '';
  const squeezed = key.replace(/0{2,}/g, '');
  return squeezed === '' ? key : squeezed;
}

/** Normalizes a company name enough to tell two spellings of one firm apart. */
export function normalizePartyName(value: string): string {
  const folded = foldText(value);
  return folded
    .replace(/\b(a\.?s\.?|anonim sirketi|ltd\.?|limited|sti\.?|sirketi|san\.?|tic\.?|ve)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits only, so "123 456 7890" and "1234567890" are the same tax id. */
export function normalizeTaxId(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}
