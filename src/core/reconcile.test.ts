import { describe, expect, it } from 'vitest';
import type { Party, ReconciliationSettings, Statement, StatementEntry } from '../types';
import { normalizeDocNo, normalizeDocNoLoose } from './normalize';
import { parseAmount } from './parseNumber';
import { parseDate } from './parseDate';
import { reconcilePair } from './reconcilePair';
import { matchStatements } from './matchEntries';

function entry(
  id: string,
  date: string,
  docNo: string,
  debit: number,
  credit: number,
  extra: Partial<StatementEntry> = {},
): StatementEntry {
  return {
    id,
    sourceRow: Number(id.replace(/\D/g, '')) || 1,
    date,
    dueDate: null,
    docNo,
    docKey: normalizeDocNo(docNo),
    docKeyLoose: normalizeDocNoLoose(docNo),
    docType: 'other',
    description: '',
    debit,
    credit,
    currency: 'TRY',
    ...extra,
  };
}

function statement(id: string, perspective: 'receivable' | 'payable', entries: StatementEntry[]): Statement {
  return {
    id,
    fileName: `${id}.xlsx`,
    ownerPartyId: id,
    counterpartyPartyId: id === 'a' ? 'b' : 'a',
    perspective,
    currency: 'TRY',
    entries,
  };
}

const settings: ReconciliationSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
  termDays: 30,
  asOfDate: '2026-08-31',
};

const abc: Party = { id: 'a', name: 'ABC Limited', taxId: null };
const begum: Party = { id: 'b', name: 'Begüm Teknoloji', taxId: null };

describe('parsing helpers', () => {
  it('reads Turkish and US number formats', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('(1.500,00)')).toBe(-1500);
    expect(parseAmount('61,757.75')).toBe(61757.75);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('reads day-first Turkish dates and ISO alike', () => {
    expect(parseDate('31.12.2025')).toBe('2025-12-31');
    expect(parseDate('1/5/2026')).toBe('2026-01-05');
    expect(parseDate('2026-03-07')).toBe('2026-03-07');
    expect(parseDate('yok')).toBeNull();
  });

  it('collapses the padding difference between two ERP invoice numbers', () => {
    // SAP writes one more zero than the customer's Logo export does.
    expect(normalizeDocNoLoose('AL72026000000017')).toBe(normalizeDocNoLoose('AL7202600000017'));
    // ...without dragging a genuinely different series along with it.
    expect(normalizeDocNoLoose('AL12026000000017')).not.toBe(normalizeDocNoLoose('AL7202600000017'));
  });
});

describe('matching', () => {
  it('never pairs an invoice with a payment that shares a reference', () => {
    const creditor = statement('a', 'receivable', [entry('c1', '2026-01-05', 'FTR100', 1000, 0)]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-01-05', 'FTR100', 1000, 0)]);
    // On the debtor's payable card a borç is a payment, so the two lines push
    // the balance in opposite directions and must not be called one document.
    const result = matchStatements(creditor, debtor, settings);
    expect(result.pairs).toHaveLength(0);
    expect(result.creditorOnly).toHaveLength(1);
    expect(result.debtorOnly).toHaveLength(1);
  });

  it('matches a mirrored invoice across the two ledgers', () => {
    const creditor = statement('a', 'receivable', [entry('c1', '2026-01-05', 'FTR100', 1000, 0)]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-01-05', 'FTR100', 0, 1000)]);
    const result = matchStatements(creditor, debtor, settings);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].basis).toBe('docNoAndAmount');
    expect(result.pairs[0].amountDifference).toBe(0);
  });

  it('matches a payment that carries no reference by date and amount', () => {
    const creditor = statement('a', 'receivable', [entry('c1', '2026-01-06', '', 0, 89406.3)]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-01-06', 'BN24', 89406.3, 0)]);
    const result = matchStatements(creditor, debtor, settings);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].basis).toBe('dateAndAmount');
  });

  it('refuses to guess when the same amount appears twice on a side', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-01-06', '', 0, 5000),
      entry('c2', '2026-01-08', '', 0, 5000),
    ]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-01-07', 'BN1', 5000, 0)]);
    const result = matchStatements(creditor, debtor, settings);
    expect(result.pairs).toHaveLength(0);
  });
});

describe('the balance bridge', () => {
  it('explains the gap exactly when one side is missing a record', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-01-05', 'FTR100', 1000, 0),
      entry('c2', '2026-02-05', 'FTR200', 15299.14, 0),
      entry('c3', '2026-01-20', '', 0, 1000),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-01-05', 'FTR100', 0, 1000),
      entry('d3', '2026-01-20', 'BN9', 1000, 0),
    ]);

    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    expect(result.bridge.creditorBalance).toBe(15299.14);
    expect(result.bridge.debtorBalance).toBe(0);
    expect(result.bridge.difference).toBe(15299.14);
    expect(result.bridge.creditorOnlyTotal).toBe(15299.14);
    expect(result.bridge.reconciles).toBe(true);
    // Once the debtor books the invoice it never recorded, both sides agree.
    expect(result.bridge.debtorAdjusted).toBe(15299.14);
    expect(result.bridge.residual).toBe(0);
    expect(result.bridge.agreed).toBe(true);
  });

  it('explains a gap that comes from the same invoice booked at two figures', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-05-29', 'KON2026000000163', 102260, 0, { currency: 'TRY' }),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-05-29', 'KON2026000000163', 0, 104912.5, { currency: 'TRY' }),
    ]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    expect(result.bridge.difference).toBe(-2652.5);
    expect(result.bridge.amountDifferences).toBe(-2652.5);
    expect(result.bridge.reconciles).toBe(true);
    expect(result.bridge.agreed).toBe(false);
    expect(result.actions.some((a) => a.category === 'amountMismatch')).toBe(true);
  });

  it('keeps the bridge balanced however the differences are spread', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-01-05', 'F1', 1000, 0),
      entry('c2', '2026-01-06', 'F2', 2000, 0),
      entry('c3', '2026-02-01', 'F3', 3000, 0),
      entry('c4', '2026-02-10', '', 0, 1500),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-01-05', 'F1', 0, 1100),
      entry('d2', '2026-01-06', 'F2', 0, 2000),
      entry('d4', '2026-02-10', 'BN3', 1500, 0),
      entry('d5', '2026-02-12', 'F9', 0, 700),
    ]);
    const { bridge } = reconcilePair(abc, begum, creditor, debtor, settings);
    expect(bridge.reconciles).toBe(true);
    expect(
      Math.round(
        (bridge.amountDifferences + bridge.creditorOnlyTotal - bridge.debtorOnlyTotal) * 100,
      ) / 100,
    ).toBe(bridge.difference);
  });
});

describe('naming the cause of a difference', () => {
  it('pairs an invoice the two ERPs padded differently, even at different amounts', () => {
    // SAP writes one more zero than Logo does, and the invoice is also
    // converted at two different rates — the combination that would otherwise
    // be reported as two unrelated missing records.
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-03-03', 'ABC2026000000105', 106240, 0),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-03-03', 'ABC202600000105', 0, 103548.8),
    ]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    expect(result.match.pairs).toHaveLength(1);
    expect(result.match.pairs[0].basis).toBe('docNoLoose');
    expect(result.match.creditorOnly).toHaveLength(0);
    expect(result.match.debtorOnly).toHaveLength(0);
  });

  it('reads a few percent between two amounts as two different FX rates', () => {
    // The real figures from a KONSENSUS/ABBOTT reconciliation: 53,12 against
    // 54,50 on the same euro invoice.
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-05-29', 'KON2026000000163', 102260, 0),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-05-29', 'KON2026000000163', 0, 104912.5),
    ]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    const action = result.actions.find((a) => a.category === 'amountMismatch');
    expect(action?.messageKey).toBe('action.amountMismatchRate');
    expect(action?.messageVars.percent).toBe(2.59);
  });

  it('recognises a gap that is exactly the VAT', () => {
    const creditor = statement('a', 'receivable', [entry('c1', '2026-05-29', 'F1', 12000, 0)]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-05-29', 'F1', 0, 10000)]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    const action = result.actions.find((a) => a.category === 'amountMismatch');
    expect(action?.messageKey).toBe('action.amountMismatchVat');
    expect(action?.messageVars.rate).toBe(20);
  });

  it('calls out an invoice one side never converted out of its own currency', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-08-01', 'AL62026000005029', 15299.14, 0, { currency: 'TRY' }),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d1', '2026-08-01', 'AL6202600005029', 0, 280.8, { currency: 'EUR' }),
    ]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    const action = result.actions.find((a) => a.category === 'amountMismatch');
    expect(action?.messageKey).toBe('action.amountMismatchFx');
    expect(action?.messageVars.rate).toBe(54.48);
  });
});

describe('payment allocation and ageing', () => {
  it('settles many invoices from one bulk payment, oldest first', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-06-01', 'F1', 10000, 0),
      entry('c2', '2026-06-05', 'F2', 10000, 0),
      entry('c3', '2026-06-10', 'F3', 10000, 0),
      entry('c4', '2026-07-15', 'BULK', 0, 25000),
    ]);
    const debtor = statement('b', 'payable', [entry('d4', '2026-07-15', 'BULK', 25000, 0)]);
    const { allocation } = reconcilePair(abc, begum, creditor, debtor, settings);

    const byDoc = new Map(allocation.invoices.map((i) => [i.entry.docNo, i]));
    expect(byDoc.get('F1')?.open).toBe(0);
    expect(byDoc.get('F2')?.open).toBe(0);
    expect(byDoc.get('F3')?.open).toBe(5000);
    expect(allocation.unappliedPayments).toBe(0);
  });

  it('applies a payment to the invoice it names, not merely the oldest', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-06-01', 'FTR1001', 10000, 0),
      entry('c2', '2026-06-05', 'FTR1002', 10000, 0),
      entry('c3', '2026-07-15', 'BN77', 0, 10000, { description: 'FTR1002 tahsilat' }),
    ]);
    const debtor = statement('b', 'payable', []);
    const { allocation } = reconcilePair(abc, begum, creditor, debtor, settings);
    const byDoc = new Map(allocation.invoices.map((i) => [i.entry.docNo, i]));
    expect(byDoc.get('FTR1002')?.open).toBe(0);
    expect(byDoc.get('FTR1001')?.open).toBe(10000);
  });

  it('ages an unpaid invoice from its vade and raises an action', () => {
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-06-01', 'F1', 10000, 0, { dueDate: '2026-07-01' }),
    ]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-06-01', 'F1', 0, 10000)]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    const invoice = result.allocation.invoices[0];
    expect(invoice.dueDateSource).toBe('statement');
    expect(invoice.daysOverdue).toBe(61);
    expect(invoice.bucket).toBe('d61to90');
    const overdue = result.actions.find((a) => a.category === 'overdue');
    expect(overdue?.severity).toBe('critical');
  });

  it('derives a vade from the agreed term when the file carries none', () => {
    const creditor = statement('a', 'receivable', [entry('c1', '2026-08-15', 'F1', 10000, 0)]);
    const debtor = statement('b', 'payable', [entry('d1', '2026-08-15', 'F1', 0, 10000)]);
    const result = reconcilePair(abc, begum, creditor, debtor, settings);
    const invoice = result.allocation.invoices[0];
    expect(invoice.dueDateSource).toBe('term');
    expect(invoice.dueDate).toBe('2026-09-14');
    expect(invoice.daysOverdue).toBe(0);
  });
});
