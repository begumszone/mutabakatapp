import type { Perspective, Statement, StatementEntry } from '../types';
import { round2 } from './parseNumber';

/**
 * Orients one ledger line into the single direction the whole engine works
 * in: **"how much the debtor owes the creditor"**.
 *
 * In the creditor's own books that relationship is a receivable, so an
 * invoice is a borç and the claim is `debit - credit`. In the debtor's books
 * the identical invoice is a payable booked as alacak, so the claim is
 * `credit - debit`. Applying this once, up front, is what makes the two
 * statements directly comparable line by line — every later step can then
 * treat a positive number as "the debtor owes more" no matter whose file it
 * came from.
 */
export function claimOf(entry: StatementEntry, perspective: Perspective): number {
  const signed = perspective === 'receivable' ? entry.debit - entry.credit : entry.credit - entry.debit;
  return round2(signed);
}

/** Closing balance of a statement, in "debtor owes creditor" terms. */
export function statementBalance(statement: Statement): number {
  let total = 0;
  for (const entry of statement.entries) total += claimOf(entry, statement.perspective);
  return round2(total);
}

/**
 * Guesses which perspective a statement was written from.
 *
 * A supplier's copy of a customer card is invoice-heavy on the borç side; the
 * customer's copy of the same card is invoice-heavy on the alacak side. So we
 * look at where the invoice lines sit: if invoices are mostly debits the
 * owner is the one owed money.
 *
 * Falls back to the sign of the raw total, and finally to 'receivable'. The
 * UI always shows the guess and lets the user flip it, because a wrong
 * orientation would silently double the reported gap rather than halve it.
 */
export function suggestPerspective(entries: StatementEntry[]): Perspective {
  let invoiceDebit = 0;
  let invoiceCredit = 0;
  for (const entry of entries) {
    if (entry.docType !== 'invoice') continue;
    invoiceDebit += entry.debit;
    invoiceCredit += entry.credit;
  }
  if (invoiceDebit > 0 || invoiceCredit > 0) {
    return invoiceDebit >= invoiceCredit ? 'receivable' : 'payable';
  }

  let net = 0;
  for (const entry of entries) net += entry.debit - entry.credit;
  return net >= 0 ? 'receivable' : 'payable';
}

/**
 * Rewrites entries so that a later `claimOf(entry, 'receivable')` gives the
 * same answer the original perspective would have.
 *
 * This exists so that a side assembled from several sheets can be merged at
 * all. Two tabs of the same customer card can be written from opposite sides
 * — a Logo export of "our supplier" next to a SAP extract of "their
 * customer" — and a merged ledger can only carry one perspective. Orienting
 * each source as it is read, rather than at the end, means the merge is a
 * plain concatenation and every downstream step sees one direction.
 *
 * A payable line is mirrored by swapping borç and alacak, which is exactly
 * what the two ledgers do to each other in the first place.
 */
export function orientEntries(
  entries: StatementEntry[],
  perspective: Perspective,
): StatementEntry[] {
  if (perspective === 'receivable') return entries;
  return entries.map((entry) => ({ ...entry, debit: entry.credit, credit: entry.debit }));
}

/** Earliest and latest dates present in a statement, or null when empty. */
export function dateRange(entries: StatementEntry[]): { start: string; end: string } | null {
  if (entries.length === 0) return null;
  let start = entries[0].date;
  let end = entries[0].date;
  for (const entry of entries) {
    if (entry.date < start) start = entry.date;
    if (entry.date > end) end = entry.date;
  }
  return { start, end };
}
