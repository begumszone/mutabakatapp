import type { AgingBucket, AllocationResult, OpenInvoice, StatementEntry } from '../types';
import { claimOf } from './claim';
import { normalizeDocNo, normalizeDocNoLoose } from './normalize';
import { addDays, daysBetween } from './parseDate';
import { round2 } from './parseNumber';
import type { Perspective } from '../types';

interface Payment {
  entry: StatementEntry;
  remaining: number;
}

interface Invoice {
  entry: StatementEntry;
  amount: number;
  paid: number;
  appliedPaymentIds: string[];
}

function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'notDue';
  if (daysOverdue <= 30) return 'd1to30';
  if (daysOverdue <= 60) return 'd31to60';
  if (daysOverdue <= 90) return 'd61to90';
  return 'd90plus';
}

/**
 * Pulls the invoice references out of a payment line.
 *
 * A bulk transfer for forty-five invoices usually still names some of them,
 * in the description or in the ERP's clearing field. Where it does, that
 * beats any date ordering we could invent, so those references are applied
 * first and only the rest of the money falls through to FIFO.
 */
function referencedInvoiceKeys(entry: StatementEntry): string[] {
  const keys = new Set<string>();
  for (const token of `${entry.docNo} ${entry.description}`.split(/[\s,;|]+/)) {
    // An invoice serial is long and mostly digits. A bank slip number like
    // "BN77" is neither, and matching on it would tie the payment to the
    // wrong document entirely.
    const digits = token.replace(/\D/g, '').length;
    if (token.length < 5 || digits < 3) continue;
    const key = normalizeDocNo(token);
    if (key !== '') keys.add(key);
  }
  return [...keys];
}

/**
 * Works out which invoices are genuinely still open, and how late they are.
 *
 * Turkish trade practice is what makes this necessary: a supplier raises
 * dozens of invoices over a month and the customer settles them with one
 * round payment, naming none of them. Reading either ledger line by line
 * would say every invoice is unpaid and a large payment is floating
 * unexplained. So payments are applied to invoices — by explicit reference
 * first, then oldest invoice first, which is both the legal default and what
 * the two accounting departments will assume when they talk.
 *
 * The due date comes from the statement's own vade column when it has one,
 * and otherwise from the invoice date plus the agreed term, and every
 * invoice records which of the two it used so nobody has to guess whether a
 * "45 days overdue" came from the file or from a setting.
 */
export function allocatePayments(
  entries: StatementEntry[],
  perspective: Perspective,
  termDays: number,
  asOfDate: string,
): AllocationResult {
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];

  for (const entry of entries) {
    if (entry.docType === 'opening') continue;
    const claim = claimOf(entry, perspective);
    if (claim > 0) invoices.push({ entry, amount: claim, paid: 0, appliedPaymentIds: [] });
    else if (claim < 0) payments.push({ entry, remaining: -claim });
  }

  invoices.sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  payments.sort((a, b) => a.entry.date.localeCompare(b.entry.date));

  const byKey = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    for (const key of [invoice.entry.docKey, normalizeDocNoLoose(invoice.entry.docNo)]) {
      if (key === '') continue;
      const bucket = byKey.get(key);
      if (bucket) bucket.push(invoice);
      else byKey.set(key, [invoice]);
    }
  }

  // Pass 1 — payments that name the invoice they settle.
  for (const payment of payments) {
    for (const key of referencedInvoiceKeys(payment.entry)) {
      if (payment.remaining <= 0) break;
      const candidates = byKey.get(key);
      if (!candidates) continue;
      for (const invoice of candidates) {
        if (payment.remaining <= 0) break;
        const owing = round2(invoice.amount - invoice.paid);
        if (owing <= 0) continue;
        const applied = Math.min(owing, payment.remaining);
        invoice.paid = round2(invoice.paid + applied);
        payment.remaining = round2(payment.remaining - applied);
        invoice.appliedPaymentIds.push(payment.entry.id);
      }
    }
  }

  // Pass 2 — whatever is left settles the oldest open invoice first.
  for (const payment of payments) {
    for (const invoice of invoices) {
      if (payment.remaining <= 0) break;
      const owing = round2(invoice.amount - invoice.paid);
      if (owing <= 0) continue;
      const applied = Math.min(owing, payment.remaining);
      invoice.paid = round2(invoice.paid + applied);
      payment.remaining = round2(payment.remaining - applied);
      if (!invoice.appliedPaymentIds.includes(payment.entry.id)) {
        invoice.appliedPaymentIds.push(payment.entry.id);
      }
    }
  }

  const open: OpenInvoice[] = invoices.map((invoice) => {
    const dueDate = invoice.entry.dueDate ?? addDays(invoice.entry.date, termDays);
    const daysOverdue = daysBetween(dueDate, asOfDate);
    const remaining = round2(invoice.amount - invoice.paid);
    return {
      entry: invoice.entry,
      amount: invoice.amount,
      paid: invoice.paid,
      open: remaining,
      dueDate,
      dueDateSource: invoice.entry.dueDate ? 'statement' : 'term',
      // An invoice that is settled is not overdue, however late the payment was.
      daysOverdue: remaining > 0 ? Math.max(0, daysOverdue) : 0,
      bucket: remaining > 0 ? bucketFor(daysOverdue) : 'notDue',
      appliedPaymentIds: invoice.appliedPaymentIds,
    };
  });

  let unapplied = 0;
  const unappliedIds: string[] = [];
  for (const payment of payments) {
    if (payment.remaining > 0.01) {
      unapplied = round2(unapplied + payment.remaining);
      unappliedIds.push(payment.entry.id);
    }
  }

  return { invoices: open, unappliedPayments: unapplied, unappliedPaymentIds: unappliedIds };
}
