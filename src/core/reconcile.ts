import type { BalanceBridge, MatchResult, Statement } from '../types';
import { claimOf } from './claim';
import { round2 } from './parseNumber';

/** Sum of the opening (devir) lines a statement carries. */
export function openingBalance(statement: Statement): number {
  let total = 0;
  for (const entry of statement.entries) {
    if (entry.docType === 'opening') total += claimOf(entry, statement.perspective);
  }
  return round2(total);
}

/**
 * Builds the balance bridge from a completed match.
 *
 * The identity being asserted is simple and worth stating plainly: the gap
 * between the two closing balances is exactly the sum of the documents one
 * side booked and the other did not, plus the net of the documents both
 * booked at different figures. Nothing else can move a balance. If that
 * identity fails, the match itself is inconsistent — so the engine reports
 * `reconciles: false` rather than presenting a bridge that quietly omits
 * money, and the UI refuses to call the reconciliation clean.
 */
export function buildBridge(
  creditorStatement: Statement,
  debtorStatement: Statement,
  match: MatchResult,
  tolerance = 0.01,
  /**
   * Devir figures, which are read from the *unfiltered* ledgers. Under the
   * open-item reading the opening lines are removed before the comparison —
   * a devir is the settled history in one figure — but they still belong on
   * the result's own Devir row, where a gap between the two means somebody
   * should ask for a statement covering the earlier period.
   */
  openings?: {
    creditor: number;
    debtor: number;
    /**
     * Whether the carried-forward figures form part of the balances.
     *
     * Rolling a window forward, they do: the closing balance is what was
     * carried in plus what moved. Comparing open items, they must not — the
     * devir *is* the settled history in one figure, and the settled lines it
     * stands for have already been taken out, so adding it back would count
     * the same money twice.
     */
    includeInBalance: boolean;
  },
): BalanceBridge {
  let creditorBalance = 0;
  for (const entry of creditorStatement.entries) {
    creditorBalance += claimOf(entry, creditorStatement.perspective);
  }
  let debtorBalance = 0;
  for (const entry of debtorStatement.entries) {
    debtorBalance += claimOf(entry, debtorStatement.perspective);
  }
  const creditorOpening = openings?.creditor ?? openingBalance(creditorStatement);
  const debtorOpening = openings?.debtor ?? openingBalance(debtorStatement);
  if (openings?.includeInBalance) {
    creditorBalance += creditorOpening;
    debtorBalance += debtorOpening;
  }
  creditorBalance = round2(creditorBalance);
  debtorBalance = round2(debtorBalance);
  const openingDifference = round2(creditorOpening - debtorOpening);

  let amountDifferences = 0;
  for (const pair of match.pairs) amountDifferences += pair.amountDifference;
  amountDifferences = round2(amountDifferences);

  let creditorOnlyTotal = 0;
  for (const item of match.creditorOnly) creditorOnlyTotal += item.claim;
  creditorOnlyTotal = round2(creditorOnlyTotal);

  let debtorOnlyTotal = 0;
  for (const item of match.debtorOnly) debtorOnlyTotal += item.claim;
  debtorOnlyTotal = round2(debtorOnlyTotal);

  const difference = round2(creditorBalance - debtorBalance);
  // Nothing else can move a balance: what each side carried in, the documents
  // only one of them booked, and the ones they booked at two different
  // figures.
  const explained = round2(
    (openings?.includeInBalance ? openingDifference : 0) +
      amountDifferences +
      creditorOnlyTotal -
      debtorOnlyTotal,
  );

  // Each side, once the records it never booked are put back on it.
  const creditorAdjusted = round2(creditorBalance + debtorOnlyTotal);
  const debtorAdjusted = round2(debtorBalance + creditorOnlyTotal);

  const residual = round2(creditorAdjusted - debtorAdjusted);

  return {
    creditorBalance,
    debtorBalance,
    difference,
    creditorOpening,
    debtorOpening,
    openingDifference,
    amountDifferences,
    creditorOnlyTotal,
    debtorOnlyTotal,
    creditorAdjusted,
    debtorAdjusted,
    residual,
    reconciles: Math.abs(difference - explained) <= tolerance,
    agreed:
      Math.abs(residual) <= tolerance &&
      Math.abs(amountDifferences) <= tolerance &&
      // A gap in what the two sides carried in is a real disagreement, even
      // when every document inside the window lines up.
      (!openings?.includeInBalance || Math.abs(openingDifference) <= tolerance),
  };
}
