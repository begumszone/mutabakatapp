import type {
  PairReconciliation,
  Party,
  ReconciliationSettings,
  Statement,
} from '../types';
import { buildActions } from './actions';
import { matchStatements } from './matchEntries';
import { alignPeriods } from './period';
import { buildBridge } from './reconcile';

export const DEFAULT_SETTINGS: ReconciliationSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
  requestedPeriod: null,
  asOfDate: '',
};


/**
 * Runs one creditor/debtor pair end to end: align in time, match, bridge,
 * advise.
 *
 * The order matters. Two ledgers can only be compared where they overlap, and
 * what each side carried *into* that overlap has to be settled before any
 * document inside it means anything — a devir the two sides do not share is a
 * difference no amount of document matching will ever explain.
 */
export function reconcilePair(
  creditor: Party,
  debtor: Party,
  creditorStatement: Statement,
  debtorStatement: Statement,
  settings: ReconciliationSettings,
): PairReconciliation {
  const { alignment, creditor: creditorSplit, debtor: debtorSplit } = alignPeriods(
    creditorStatement,
    debtorStatement,
    settings.amountTolerance,
    true,
    settings.requestedPeriod,
  );
  const creditorInPeriod: Statement = { ...creditorStatement, entries: creditorSplit.inside };
  const debtorInPeriod: Statement = { ...debtorStatement, entries: debtorSplit.inside };

  const match = matchStatements(creditorInPeriod, debtorInPeriod, settings);

  const bridge = buildBridge(
    creditorInPeriod,
    debtorInPeriod,
    match,
    settings.amountTolerance,
    {
      creditor: creditorSplit.opening,
      debtor: debtorSplit.opening,
      includeInBalance: true,
    },
  );

  // "Material" scales with the relationship: a 500 TL gap is noise against a
  // 5 million TL account and a crisis against a 20 thousand one.
  const scale = Math.max(Math.abs(bridge.creditorBalance), Math.abs(bridge.debtorBalance), 1);
  const materiality = Math.max(100, scale * 0.005);

  const actions = buildActions({
    creditor,
    debtor,
    match,
    creditorStatement: creditorInPeriod,
    debtorStatement: debtorInPeriod,
    bridge,
    materiality,
    period: alignment,
  });

  return {
    creditor,
    debtor,
    creditorStatement: creditorInPeriod,
    debtorStatement: debtorInPeriod,
    currency: creditorStatement.currency || debtorStatement.currency,
    match,
    bridge,
    actions,
    asOfDate: settings.asOfDate,
    period: alignment,
  };
}
