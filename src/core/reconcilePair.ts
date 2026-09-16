import type { PairReconciliation, Party, ReconciliationSettings, Statement } from '../types';
import { allocatePayments } from './allocate';
import { buildActions } from './actions';
import { matchStatements } from './matchEntries';
import { buildBridge } from './reconcile';

export const DEFAULT_SETTINGS: ReconciliationSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
  termDays: 30,
  asOfDate: '',
};

/**
 * Runs one creditor/debtor pair end to end: match, bridge, allocate, advise.
 *
 * Ageing is measured on the creditor's ledger, because that is the side that
 * chases the money and the side whose invoice dates and vade the debtor has
 * to answer to.
 */
export function reconcilePair(
  creditor: Party,
  debtor: Party,
  creditorStatement: Statement,
  debtorStatement: Statement,
  settings: ReconciliationSettings,
): PairReconciliation {
  const match = matchStatements(creditorStatement, debtorStatement, settings);
  const bridge = buildBridge(creditorStatement, debtorStatement, match, settings.amountTolerance);
  const allocation = allocatePayments(
    creditorStatement.entries,
    creditorStatement.perspective,
    settings.termDays,
    settings.asOfDate,
  );

  // "Material" scales with the relationship: a 500 TL gap is noise against a
  // 5 million TL account and a crisis against a 20 thousand one.
  const scale = Math.max(Math.abs(bridge.creditorBalance), Math.abs(bridge.debtorBalance), 1);
  const materiality = Math.max(100, scale * 0.005);

  const actions = buildActions({ creditor, debtor, match, bridge, allocation, materiality });

  return {
    creditor,
    debtor,
    creditorStatement,
    debtorStatement,
    currency: creditorStatement.currency || debtorStatement.currency,
    match,
    bridge,
    allocation,
    actions,
    asOfDate: settings.asOfDate,
  };
}
