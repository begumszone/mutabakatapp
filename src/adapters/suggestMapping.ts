import type { AmountLayout, ColumnMapping, MappingIssue, ParsedFile, RawRow } from '../types';
import { foldText } from '../core/normalize';
import { parseAmount } from '../core/parseNumber';
import { parseDate } from '../core/parseDate';
import { inferColumns, looksHeaderless } from './inferColumns';

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
      { needle: 'fatura', score: 5 },
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
    exclude: ['bak', 'bakiye', 'balance', 'toplam'],
  },
  credit: {
    candidates: [
      { needle: 'alac tut', score: 10 },
      { needle: 'alacak tut', score: 10 },
      { needle: 'alacak', score: 8 },
      { needle: 'alac', score: 7 },
      { needle: 'credit', score: 8 },
    ],
    exclude: ['bak', 'bakiye', 'balance', 'toplam'],
  },
  amount: {
    candidates: [
      { needle: 'amount in local currency', score: 10 },
      { needle: 'up cinsinden tutar', score: 10 },
      { needle: 'yerel para tutar', score: 10 },
      { needle: 'amount in doc', score: 7 },
      { needle: 'tutar', score: 6 },
      { needle: 'amount', score: 6 },
    ],
    exclude: ['bak', 'bakiye', 'balance', 'toplam'],
  },
  clearingDoc: {
    candidates: [
      { needle: 'clearing document', score: 10 },
      { needle: 'denklestirme belgesi', score: 10 },
      { needle: 'denklestirme', score: 9 },
      { needle: 'kapanis belgesi', score: 10 },
      { needle: 'kapatma belgesi', score: 10 },
      { needle: 'clearing doc', score: 9 },
      { needle: 'clearing', score: 7 },
    ],
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

/**
 * Exclusions match whole words, not substrings.
 *
 * "Tür" is a disqualifying word for a document-number column — "Evrak Türü"
 * is a type, not a number. As a substring it also sits inside "Fatura", which
 * is exactly the column we want. Anchoring to word boundaries keeps the rule
 * doing what it was written to do.
 */
function containsWord(haystack: string, word: string): boolean {
  return new RegExp(`(^| )${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(haystack);
}

function scoreHeader(header: string, spec: FieldSpec): number {
  const folded = foldText(header).replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  if (spec.exclude?.some((bad) => containsWord(folded, bad))) return 0;
  let best = 0;
  for (const candidate of spec.candidates) {
    if (folded.includes(candidate.needle)) best = Math.max(best, candidate.score);
  }
  return best;
}

/**
 * Ranks every header for one field, best first, dropping non-matches.
 *
 * Ties are broken by how much header is left over once the matched wording is
 * accounted for. A SAP export carries both "Referans" and "Referans anahtar",
 * and they score identically on the word they share — but "Referans" holds the
 * invoice number the counterparty also books, while "Referans anahtar" is a
 * composite key that matches nothing on the other side. The shorter header is
 * the more exact answer, so it wins.
 */
function rank(headers: string[], spec: FieldSpec): string[] {
  return headers
    .map((header) => ({ header, score: scoreHeader(header, spec), length: foldText(header).length }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.length - b.length)
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

/**
 * How much of the sheet a column actually dates.
 *
 * Distinct from the purity below, and the distinction is the whole point: a
 * column that holds nothing but dates in the third of rows where it is
 * filled looks perfect by purity and dates only a third of the statement.
 * Choosing it drops every blank row, and those rows then read as documents
 * the counterparty never booked.
 */
function dateCoverage(rows: RawRow[], header: string | null): number {
  if (!header) return 0;
  const sample = rows.slice(0, 200);
  if (sample.length === 0) return 0;
  let dates = 0;
  for (const row of sample) {
    if (parseDate(row[header] as string | number) !== null) dates++;
  }
  return dates / sample.length;
}

/** Of the values a column does hold, how many read as dates. */
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

  // A sheet that never named its columns cannot be read by header wording.
  // What the data itself says is read instead -- including which money column
  // is a running balance, which is the one mistake that must never be made
  // silently.
  if (looksHeaderless(file)) return inferColumns(file).mapping;

  const pickChecked = (field: string, test: (header: string) => boolean): string | null => {
    for (const header of rank(headers, FIELDS[field])) {
      if (test(header)) return header;
    }
    return null;
  };

  /**
   * Picks the date column by how much of the sheet it actually dates, not
   * only by what it is called.
   *
   * A Logo ekstre carries both "Tarih" and "Belge tarihi", and on some sheets
   * the second is filled in for two rows out of three. Its name scores
   * higher, but choosing it drops every row it leaves blank — ten real
   * movements on one of these files, fifty-four on another — and those rows
   * then look like documents the other side never booked. Coverage wins
   * unless the better-named column is nearly as complete.
   */
  const pickDate = (field: string): string | null => {
    const candidates = rank(headers, FIELDS[field])
      .map((header) => ({
        header,
        purity: dateShare(rows, header),
        coverage: dateCoverage(rows, header),
      }))
      // Purity says it is a date column at all; coverage decides which one.
      .filter((item) => item.purity >= 0.5);
    if (candidates.length === 0) return null;
    const best = candidates.reduce((a, b) => (b.coverage > a.coverage + 0.02 ? b : a));
    return best.header;
  };

  const date = pickDate('date');

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
    docNo,
    docNoAlt,
    docTypeColumn: rank(headers, FIELDS.docTypeColumn)[0] ?? null,
    description: rank(headers, FIELDS.description)[0] ?? null,
    amountLayout,
    debit,
    credit,
    amount,
    currency: rank(headers, FIELDS.currency)[0] ?? null,
    clearingDoc: rank(headers, FIELDS.clearingDoc)[0] ?? null,
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
  return issues;
}
