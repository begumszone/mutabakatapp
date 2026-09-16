import type { AmountLayout, ColumnMapping, MappingIssue, ParsedFile, RawRow } from '../types';
import { foldText } from '../core/normalize';
import { parseAmount } from '../core/parseNumber';
import { parseDate } from '../core/parseDate';

interface Candidate {
  /** Substring to look for in the folded header. */
  needle: string;
  score: number;
}

/** A header disqualified outright, whatever else it matches. */
interface FieldSpec {
  candidates: Candidate[];
  exclude?: string[];
}

/**
 * What each field is called across the exports these files actually come
 * from: SAP in English, and Logo/Netsis/Mikro in Turkish.
 *
 * The exclusions matter more than the matches. "Borç Bak." and "Alacak Bak."
 * sit right next to "Borç Tut." and "Alac.Tut." in a Logo ekstre, but they
 * are running balances — mapping one as the debit column would double every
 * figure in the reconciliation. Likewise "Vade Tarihi" must never be taken
 * for the document date, and "Amount in local currency" is an amount, not a
 * currency.
 */
const FIELDS: Record<string, FieldSpec> = {
  date: {
    candidates: [
      { needle: 'belge tarihi', score: 10 },
      { needle: 'document date', score: 10 },
      { needle: 'fis tarihi', score: 9 },
      { needle: 'islem tarihi', score: 9 },
      { needle: 'posting date', score: 7 },
      { needle: 'kayit tarihi', score: 7 },
      { needle: 'calisma tarih', score: 6 },
      { needle: 'tarih', score: 5 },
      { needle: 'date', score: 5 },
    ],
    exclude: ['vade', 'due', 'valor'],
  },
  dueDate: {
    candidates: [
      { needle: 'vade tarihi', score: 10 },
      { needle: 'vade', score: 9 },
      { needle: 'due date', score: 9 },
      { needle: 'net due', score: 8 },
    ],
  },
  docNo: {
    candidates: [
      { needle: 'reference', score: 10 },
      { needle: 'referans', score: 10 },
      { needle: 'fatura no', score: 9 },
      { needle: 'fis no', score: 9 },
      { needle: 'evrak no', score: 9 },
      { needle: 'belge no', score: 9 },
      { needle: 'invoice no', score: 9 },
      { needle: 'document number', score: 6 },
      { needle: 'fis', score: 4 },
      { needle: 'evrak', score: 4 },
    ],
    exclude: ['turu', 'tur', 'type', 'clearing'],
  },
  docTypeColumn: {
    candidates: [
      { needle: 'evrak turu', score: 10 },
      { needle: 'belge turu', score: 10 },
      { needle: 'document type', score: 10 },
      { needle: 'islem tipi', score: 8 },
      { needle: 'hareket turu', score: 8 },
    ],
  },
  description: {
    candidates: [
      { needle: 'aciklama', score: 10 },
      { needle: 'description', score: 9 },
      { needle: 'text', score: 7 },
      { needle: 'islem', score: 5 },
    ],
  },
  debit: {
    candidates: [
      { needle: 'borc tut', score: 10 },
      { needle: 'borc', score: 8 },
      { needle: 'debit', score: 8 },
    ],
    exclude: ['bak', 'balance', 'toplam'],
  },
  credit: {
    candidates: [
      { needle: 'alac tut', score: 10 },
      { needle: 'alacak tut', score: 10 },
      { needle: 'alacak', score: 8 },
      { needle: 'alac', score: 7 },
      { needle: 'credit', score: 8 },
    ],
    exclude: ['bak', 'balance', 'toplam'],
  },
  amount: {
    candidates: [
      { needle: 'amount in local currency', score: 10 },
      { needle: 'yerel para tutar', score: 10 },
      { needle: 'amount in doc', score: 7 },
      { needle: 'tutar', score: 6 },
      { needle: 'amount', score: 6 },
    ],
    exclude: ['bak', 'balance', 'bakiye', 'toplam'],
  },
  currency: {
    candidates: [
      { needle: 'dvz cinsi', score: 10 },
      { needle: 'doviz cinsi', score: 10 },
      { needle: 'para birimi', score: 10 },
      { needle: 'local currency', score: 8 },
      { needle: 'currency', score: 7 },
      { needle: 'dvz', score: 6 },
      { needle: 'doviz', score: 6 },
    ],
    exclude: ['amount', 'tutar'],
  },
};

function scoreHeader(header: string, spec: FieldSpec): number {
  const folded = foldText(header).replace(/[._]/g, ' ').replace(/\s+/g, ' ');
  if (spec.exclude?.some((bad) => folded.includes(bad))) return 0;
  let best = 0;
  for (const candidate of spec.candidates) {
    if (folded.includes(candidate.needle)) best = Math.max(best, candidate.score);
  }
  return best;
}

/** Ranks every header for one field, best first, dropping non-matches. */
function rank(headers: string[], spec: FieldSpec): string[] {
  return headers
    .map((header) => ({ header, score: scoreHeader(header, spec) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.header);
}

/** How many of a column's non-blank values read as real numbers. */
function numericShare(rows: RawRow[], header: string | null): number {
  if (!header) return 0;
  let filled = 0;
  let numeric = 0;
  for (const row of rows.slice(0, 200)) {
    const value = row[header];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    filled++;
    if (parseAmount(value) !== null) numeric++;
  }
  return filled === 0 ? 0 : numeric / filled;
}

/** How many of a column's non-blank values read as dates. */
function dateShare(rows: RawRow[], header: string | null): number {
  if (!header) return 0;
  let filled = 0;
  let dates = 0;
  for (const row of rows.slice(0, 200)) {
    const value = row[header];
    if (value === null || value === undefined || String(value).trim() === '') continue;
    filled++;
    if (parseDate(value as string | number) !== null) dates++;
  }
  return filled === 0 ? 0 : dates / filled;
}

/** True when a column carries both positive and negative numbers. */
function hasBothSigns(rows: RawRow[], header: string | null): boolean {
  if (!header) return false;
  let positive = false;
  let negative = false;
  for (const row of rows) {
    const value = parseAmount(row[header]);
    if (value === null || value === 0) continue;
    if (value > 0) positive = true;
    else negative = true;
    if (positive && negative) return true;
  }
  return false;
}

/**
 * Guesses how the uploaded sheet maps onto the fields the engine needs.
 *
 * Header wording decides most of it, but a header alone is not proof: a
 * column called "Tutar" that holds text is not the amount column. So the
 * top-ranked candidate for every numeric and date field is checked against
 * the data underneath it, and a column that does not hold the right kind of
 * value is passed over for the next candidate. Everything the guesser
 * chooses is shown to the user before anything is calculated.
 */
export function suggestMapping(file: ParsedFile): ColumnMapping {
  const { headers, rows } = file;

  const pickChecked = (field: string, test: (header: string) => boolean): string | null => {
    for (const header of rank(headers, FIELDS[field])) {
      if (test(header)) return header;
    }
    return null;
  };

  const date = pickChecked('date', (h) => dateShare(rows, h) >= 0.5);
  const dueDate = pickChecked('dueDate', (h) => dateShare(rows, h) >= 0.5);

  const docNoRanked = rank(headers, FIELDS.docNo);
  const docNo = docNoRanked[0] ?? null;
  const docNoAlt = docNoRanked.find((h) => h !== docNo) ?? null;

  const debit = pickChecked('debit', (h) => numericShare(rows, h) >= 0.5);
  const credit = pickChecked('credit', (h) => numericShare(rows, h) >= 0.5);
  const amount = pickChecked('amount', (h) => numericShare(rows, h) >= 0.5);

  // A borç/alacak pair is only a pair when both halves are there. A lone
  // signed column that swings both ways is the SAP shape.
  let amountLayout: AmountLayout = 'debitCredit';
  if (!debit || !credit) amountLayout = 'signed';
  else if (amount && hasBothSigns(rows, amount) && !hasBothSigns(rows, debit)) {
    amountLayout = 'debitCredit';
  }

  return {
    date,
    dueDate,
    docNo,
    docNoAlt,
    docTypeColumn: rank(headers, FIELDS.docTypeColumn)[0] ?? null,
    description: rank(headers, FIELDS.description)[0] ?? null,
    amountLayout,
    debit,
    credit,
    amount,
    currency: rank(headers, FIELDS.currency)[0] ?? null,
  };
}

/** Everything that would stop the mapping from producing usable entries. */
export function validateMapping(mapping: ColumnMapping): MappingIssue[] {
  const issues: MappingIssue[] = [];
  if (!mapping.date) issues.push({ severity: 'error', messageKey: 'mapping.missingDate' });
  if (mapping.amountLayout === 'debitCredit') {
    if (!mapping.debit && !mapping.credit) {
      issues.push({ severity: 'error', messageKey: 'mapping.missingDebitCredit' });
    }
  } else if (!mapping.amount) {
    issues.push({ severity: 'error', messageKey: 'mapping.missingAmount' });
  }
  if (!mapping.docNo) issues.push({ severity: 'warning', messageKey: 'mapping.missingDocNo' });
  if (!mapping.dueDate) issues.push({ severity: 'warning', messageKey: 'mapping.missingDueDate' });
  return issues;
}
