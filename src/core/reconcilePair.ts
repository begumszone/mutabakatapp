import type {
  ExcludedSummary,
  PairReconciliation,
  Party,
  ReconciliationSettings,
  Statement,
  StatementEntry,
} from '../types';
import { allocatePayments } from './allocate';
import { buildActions } from './actions';
import { matchStatements } from './matchEntries';
import { alignPeriods } from './period';
import { selectOpenItems } from './openItems';
import { buildBridge } from './reconcile';

export const DEFAULT_SETTINGS: ReconciliationSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
  openItemsOnly: false,
  termDays: 30,
  asOfDate: '',
};

const NOTHING_EXCLUDED: ExcludedSummary = {
  active: false,
  creditorSettled: 0,
  debtorSettled: 0,
  openingLines: 0,
};

/** True when either export tells us which of its lines the ERP has closed. */
export function hasClearingInformation(...ledgers: StatementEntry[][]): boolean {
  return ledgers.some((entries) => entries.some((entry) => entry.clearingDoc !== ''));
}

/**
 * Runs one creditor/debtor pair end to end: match, narrow, bridge, allocate,
 * advise.
 *
 * Matching always runs over every line, even the settled ones, because that
 * is what lets one side's "this invoice is closed" be carried across to the
 * other side's copy of it. Only afterwards is the comparison narrowed to what
 * is still open — narrowing first would throw away the very links that make
 * the narrowing correct.
 *
 * Ageing is measured on the creditor's ledger, because that is the side that
 * chases the money and whose vade the debtor has to answer to.
 */
export function reconcilePair(
  creditor: Party,
  debtor: Party,
  creditorStatement: Statement,
  debtorStatement: Statement,
  settings: ReconciliationSettings,
): PairReconciliation {
  // Time first. Two statements can only be compared where they overlap, and
  // what each side carried into that overlap has to be settled before any
  // document inside it means anything.
  const { alignment, creditor: creditorSplit, debtor: debtorSplit } = alignPeriods(
    creditorStatement,
    debtorStatement,
    settings.amountTolerance,
    !settings.openItemsOnly,
  );
  const creditorInPeriod: Statement = { ...creditorStatement, entries: creditorSplit.inside };
  const debtorInPeriod: Statement = { ...debtorStatement, entries: debtorSplit.inside };

  const fullMatch = matchStatements(creditorInPeriod, debtorInPeriod, settings);

  const view = settings.openItemsOnly
    ? selectOpenItems(creditorInPeriod, debtorInPeriod, fullMatch)
    : {
        creditorStatement: creditorInPeriod,
        debtorStatement: debtorInPeriod,
        match: fullMatch,
        excluded: NOTHING_EXCLUDED,
      };

  const bridge = buildBridge(
    view.creditorStatement,
    view.debtorStatement,
    view.match,
    settings.amountTolerance,
    {
      creditor: creditorSplit.opening,
      debtor: debtorSplit.opening,
      includeInBalance: !settings.openItemsOnly,
    },
  );

  const allocation = allocatePayments(
    view.creditorStatement.entries,
    view.creditorStatement.perspective,
    settings.termDays,
    settings.asOfDate,
  );

  // "Material" scales with the relationship: a 500 TL gap is noise against a
  // 5 million TL account and a crisis against a 20 thousand one.
  const scale = Math.max(Math.abs(bridge.creditorBalance), Math.abs(bridge.debtorBalance), 1);
  const materiality = Math.max(100, scale * 0.005);

  const actions = buildActions({
    creditor,
    debtor,
    match: view.match,
    bridge,
    allocation,
    materiality,
    period: alignment,
  });

  return {
    creditor,
    debtor,
    creditorStatement: view.creditorStatement,
    debtorStatement: view.debtorStatement,
    currency: creditorStatement.currency || debtorStatement.currency,
    match: view.match,
    bridge,
    allocation,
    actions,
    asOfDate: settings.asOfDate,
    excluded: view.excluded,
    period: alignment,
  };
}
