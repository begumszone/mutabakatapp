import { describe, expect, it } from 'vitest';
import type { Party, ReconciliationSettings, Statement, StatementEntry } from '../types';
import { normalizeDocNo, normalizeDocNoLoose } from './normalize';
import { reconcilePair } from './reconcilePair';

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
    sourceRow: 1,
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
    clearingDoc: '',
    ...extra,
  };
}

function statement(
  id: string,
  perspective: 'receivable' | 'payable',
  entries: StatementEntry[],
  statedPeriod: Statement['statedPeriod'] = null,
): Statement {
  return {
    id,
    fileName: `${id}.xlsx`,
    ownerPartyId: id,
    counterpartyPartyId: id === 'a' ? 'b' : 'a',
    perspective,
    currency: 'TRY',
    entries,
    statedPeriod,
  };
}

const settings: ReconciliationSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
  openItemsOnly: false,
  requestedPeriod: null,
  asOfDate: '2026-06-30',
};

const koru: Party = { id: 'a', name: 'Koru Sigorta', taxId: null };
const abc: Party = { id: 'b', name: 'ABC Limited', taxId: null };

describe('two statements that cover different periods', () => {
  /**
   * The situation the feature exists for: one side sends the year to date,
   * the other sends March onwards, and the balances at 1 March disagree.
   */
  function scenario(abcOpening: number) {
    const creditor = statement(
      'a',
      'receivable',
      [
        entry('c0', '2026-01-01', '', 0, 0, { docType: 'opening' }),
        entry('c1', '2026-01-20', 'KRU2026000000101', 100000, 0),
        entry('c2', '2026-02-18', 'BN0041', 0, 50000),
        entry('c3', '2026-03-12', 'KRU2026000000140', 40000, 0),
        entry('c4', '2026-05-09', 'KRU2026000000188', 25000, 0),
      ],
      { start: '2026-01-01', end: '2026-06-30' },
    );
    const debtor = statement(
      'b',
      'payable',
      [
        entry('d0', '2026-03-01', '', 0, abcOpening, { docType: 'opening' }),
        entry('d3', '2026-03-12', 'KRU2026000000140', 0, 40000),
        entry('d4', '2026-05-09', 'KRU2026000000188', 0, 25000),
      ],
      { start: '2026-03-01', end: '2026-06-30' },
    );
    return reconcilePair(koru, abc, creditor, debtor, settings);
  }

  it('compares only the overlap and rolls the earlier months into an opening', () => {
    const result = scenario(50000);
    expect(result.period.common).toEqual({ start: '2026-03-01', end: '2026-06-30' });
    expect(result.period.misaligned).toBe(true);
    // Koru's January invoice and February collection are before the overlap,
    // so they are not reported as records ABC failed to book.
    expect(result.match.creditorOnly).toHaveLength(0);
    expect(result.period.creditorOpening).toBe(50000);
    expect(result.period.debtorOpening).toBe(50000);
    // Rolled forward, both sides close at the same figure.
    expect(result.bridge.creditorBalance).toBe(115000);
    expect(result.bridge.debtorBalance).toBe(115000);
    expect(result.bridge.agreed).toBe(true);
    expect(result.period.shortSide).toBeNull();
  });

  it('names the statement to ask for when the openings disagree', () => {
    const result = scenario(63250);
    expect(result.period.openingDifference).toBe(-13250);
    expect(result.period.shortSide).toBe('debtor');
    // The gap arose before March, and only Koru has documented that window —
    // so ABC's statement is needed from where Koru's detail begins.
    expect(result.period.neededFrom).toBe('2026-01-01');

    const ask = result.actions.find((action) => action.category === 'periodGap');
    expect(ask?.severity).toBe('critical');
    expect(ask?.messageVars.shortParty).toBe('ABC Limited');
    expect(ask?.messageVars.neededFrom).toBe('2026-01-01');

    // Every document inside the overlap matches, yet the reconciliation is
    // not agreed: the disagreement is real and sits before the window.
    expect(result.match.creditorOnly).toHaveLength(0);
    expect(result.match.debtorOnly).toHaveLength(0);
    expect(result.bridge.agreed).toBe(false);
    expect(result.bridge.reconciles).toBe(true);
  });

  it('will not narrow the window just because one side has sparse rows', () => {
    // No stated period and no devir: a statement that simply had nothing to
    // record until July. Folding June's invoice into an opening balance would
    // hide the fact that the debtor never booked it.
    const creditor = statement('a', 'receivable', [
      entry('c1', '2026-06-01', 'KRU2026000000200', 10000, 0),
      entry('c2', '2026-07-15', 'KRU2026000000240', 8000, 0),
    ]);
    const debtor = statement('b', 'payable', [
      entry('d2', '2026-07-15', 'KRU2026000000240', 0, 8000),
    ]);
    const result = reconcilePair(koru, abc, creditor, debtor, settings);
    expect(result.period.common?.start).toBe('2026-06-01');
    expect(result.match.creditorOnly).toHaveLength(1);
    expect(result.match.creditorOnly[0].entry.docNo).toBe('KRU2026000000200');
  });

  it('warns when a side states no opening at all, rather than assuming zero quietly', () => {
    const creditor = statement(
      'a',
      'receivable',
      [entry('c1', '2026-03-12', 'KRU2026000000140', 40000, 0)],
      { start: '2026-03-01', end: '2026-06-30' },
    );
    const debtor = statement(
      'b',
      'payable',
      [entry('d1', '2026-03-12', 'KRU2026000000140', 0, 40000)],
      { start: '2026-03-01', end: '2026-06-30' },
    );
    const result = reconcilePair(koru, abc, creditor, debtor, settings);
    expect(result.period.assumedZeroOpening).toEqual(['creditor', 'debtor']);
    expect(result.actions.filter((a) => a.category === 'missingOpening')).toHaveLength(2);
  });
});
