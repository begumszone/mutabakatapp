import type { ColumnMapping, ParsedFile, RawRow } from '../types';
import { parseAmount } from '../core/parseNumber';
import { parseDate } from '../core/parseDate';

/**
 * Reading a sheet that never named its columns.
 *
 * Several ERPs export the raw table: no header row, just rows. The column
 * names are then generic ("Column A"), so wording-based guessing has nothing
 * to work with and the sheet is unusable until somebody labels it by hand.
 * What the data itself still says is quite a lot — which column holds dates,
 * which hold money, and, crucially, which money column is a *running balance*
 * rather than a movement.
 *
 * That last one is the whole point. A borç, an alacak and a bakiye column all
 * look like money. Mistake the bakiye for a movement and every figure the app
 * reports is wrong while looking entirely plausible — so where the evidence
 * does not settle it, this module says so and the app asks instead of
 * guessing.
 */

const GENERIC = /^Column [A-Z]+( \(\d+\))?$/;

/** True when the sheet arrived with no column names of its own. */
export function looksHeaderless(file: ParsedFile): boolean {
  if (file.headers.length === 0) return false;
  const generic = file.headers.filter((h) => GENERIC.test(h)).length;
  return generic / file.headers.length >= 0.6;
}

function values(rows: RawRow[], header: string): (number | null)[] {
  return rows.map((row) => parseAmount(row[header]));
}

function numericShare(rows: RawRow[], header: string): number {
  let filled = 0;
  let numeric = 0;
  for (const row of rows) {
    const raw = row[header];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    filled++;
    if (parseAmount(raw) !== null) numeric++;
  }
  return filled === 0 ? 0 : numeric / filled;
}

/**
 * Whether one cell reads as a date *here*.
 *
 * Stricter than the general date parser on purpose. That parser accepts a
 * bare number as an Excel serial, which is right when reading a column
 * somebody has told us is a date — and disastrous when deciding which column
 * that is: 1.000,50 TL then parses happily as 27.09.1902, and the amount
 * column disappears into the date slot. A bare number only counts here if it
 * is a whole serial in the range a ledger date can plausibly occupy.
 */
function looksLikeDateCell(raw: unknown): boolean {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 20000 && raw <= 60000;
  }
  const text = String(raw).trim();
  if (/^-?[\d.,]+$/.test(text)) {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) return Number.isInteger(n) && n >= 20000 && n <= 60000;
  }
  return parseDate(text) !== null;
}

function dateShare(rows: RawRow[], header: string): number {
  let filled = 0;
  let dates = 0;
  for (const row of rows) {
    const raw = row[header];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    filled++;
    if (looksLikeDateCell(raw)) dates++;
  }
  return filled === 0 ? 0 : dates / filled;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * Whether `balance` moves, row by row, by exactly what `movement` says.
 *
 * This is what separates a bakiye column from a borç or alacak column without
 * knowing a word of the header. A running balance is defined by its own
 * arithmetic: each row's value is the row before it plus that row's movement.
 * `movement` is given as a per-row figure so a signed column and a
 * borç-minus-alacak pair can both be tested the same way.
 */
function runsAsBalance(balance: (number | null)[], movement: (number | null)[]): boolean {
  let checked = 0;
  let agreed = 0;
  for (let i = 1; i < balance.length; i++) {
    const previous = balance[i - 1];
    const current = balance[i];
    const step = movement[i];
    if (previous === null || current === null || step === null) continue;
    checked++;
    if (near(current - previous, step) || near(current - previous, -step)) agreed++;
  }
  return checked >= 4 && agreed / checked >= 0.7;
}

export interface InferredColumns {
  mapping: ColumnMapping;
  /**
   * Money columns the evidence could not tell apart.
   *
   * Non-empty means the app must ask before it calculates anything: which of
   * these is borç, which is alacak, which is the running bakiye.
   */
  ambiguousMoneyColumns: string[];
  /** Columns the arithmetic proved to be running balances, so never movements. */
  balanceColumns: string[];
}

const EMPTY_MAPPING: ColumnMapping = {
  date: null, dueDate: null, docNo: null, docNoAlt: null, docTypeColumn: null,
  description: null, amountLayout: 'debitCredit', debit: null, credit: null,
  amount: null, currency: null, clearingDoc: null,
};

/**
 * Works out what each unnamed column is, from what it holds.
 *
 * Dates are taken by coverage, the earliest-filled one being the posting date
 * and a later one the vade. Money columns are found, running balances are
 * ruled out by the arithmetic above, and what remains is read as either one
 * signed movement column or a borç/alacak pair. When two money columns remain
 * and nothing distinguishes them, both are reported as ambiguous rather than
 * assigned.
 */
export function inferColumns(file: ParsedFile): InferredColumns {
  const { headers, rows } = file;
  const sample = rows.slice(0, 400);
  if (sample.length === 0) {
    return { mapping: EMPTY_MAPPING, ambiguousMoneyColumns: [], balanceColumns: [] };
  }

  const moneyCols = headers.filter(
    (header) =>
      numericShare(sample, header) >= 0.9 &&
      // An id column is numeric too; money is what varies in magnitude and
      // carries kuruş, an account code does neither.
      sample.some((row) => {
        const v = parseAmount(row[header]);
        return v !== null && !Number.isInteger(v);
      }),
  );

  const dateCols = headers
    .filter((header) => !moneyCols.includes(header))
    .map((header) => ({ header, share: dateShare(sample, header) }))
    .filter((c) => c.share >= 0.7)
    .map((c) => c.header);

  const series = new Map(moneyCols.map((header) => [header, values(sample, header)]));

  // Which money columns are running balances? Test each against every other
  // money column on its own, and against every borç/alacak pair.
  const balanceColumns = new Set<string>();
  for (const candidate of moneyCols) {
    const balance = series.get(candidate)!;
    for (const other of moneyCols) {
      if (other === candidate) continue;
      if (runsAsBalance(balance, series.get(other)!)) balanceColumns.add(candidate);
      for (const third of moneyCols) {
        if (third === candidate || third === other) continue;
        const a = series.get(other)!;
        const b = series.get(third)!;
        const pair = a.map((v, i) => (v === null && b[i] === null ? null : (v ?? 0) - (b[i] ?? 0)));
        if (runsAsBalance(balance, pair)) balanceColumns.add(candidate);
      }
    }
  }

  const movementCols = moneyCols.filter((header) => !balanceColumns.has(header));

  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  mapping.date = dateCols[0] ?? null;
  mapping.dueDate = dateCols[1] ?? null;

  // The document number: the most distinctive text column that carries digits.
  let bestDoc: { header: string; score: number } | null = null;
  for (const header of headers) {
    if (dateCols.includes(header) || moneyCols.includes(header)) continue;
    const seen = new Set<string>();
    let withDigits = 0;
    let filled = 0;
    for (const row of sample) {
      const raw = row[header];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      const text = String(raw).trim();
      filled++;
      seen.add(text);
      if (/\d/.test(text) && text.length >= 4) withDigits++;
    }
    if (filled === 0) continue;
    const score = (seen.size / filled) * (withDigits / filled);
    if (score > 0.5 && (bestDoc === null || score > bestDoc.score)) bestDoc = { header, score };
  }
  mapping.docNo = bestDoc?.header ?? null;

  const ambiguousMoneyColumns: string[] = [];
  const signed = movementCols.filter((header) => {
    const v = series.get(header)!;
    return v.some((x) => x !== null && x > 0) && v.some((x) => x !== null && x < 0);
  });

  if (signed.length === 1) {
    mapping.amountLayout = 'signed';
    mapping.amount = signed[0];
  } else if (signed.length === 0 && movementCols.length === 2) {
    // A borç/alacak pair: two one-sided columns that are rarely both filled.
    const [first, second] = movementCols;
    const a = series.get(first)!;
    const b = series.get(second)!;
    let overlap = 0;
    let either = 0;
    for (let i = 0; i < a.length; i++) {
      const left = a[i] !== null && a[i] !== 0;
      const right = b[i] !== null && b[i] !== 0;
      if (left || right) either++;
      if (left && right) overlap++;
    }
    if (either > 0 && overlap / either <= 0.2) {
      // They are a pair, but which is borç and which is alacak cannot be read
      // off the numbers -- only a balance column or a header would say.
      ambiguousMoneyColumns.push(first, second);
    } else {
      ambiguousMoneyColumns.push(...movementCols);
    }
  } else if (movementCols.length > 0) {
    ambiguousMoneyColumns.push(...movementCols);
  }

  return { mapping, ambiguousMoneyColumns, balanceColumns: [...balanceColumns] };
}
