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
): BalanceBridge {
  let creditorBalance = 0;
  for (const entry of creditorStatement.entries) {
    creditorBalance += claimOf(entry, creditorStatement.perspective);
  }
  let debtorBalance = 0;
  for (const entry of debtorStatement.entries) {
    debtorBalance += claimOf(entry, debtorStatement.perspective);
  }
  creditorBalance = round2(creditorBalance);
  debtorBalance = round2(debtorBalance);

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
  const explained = round2(amountDifferences + creditorOnlyTotal - debtorOnlyTotal);

  // Each side, once the records it never booked are put back on it.
  const creditorAdjusted = round2(creditorBalance + debtorOnlyTotal);
  const debtorAdjusted = round2(debtorBalance + creditorOnlyTotal);

  const creditorOpening = openingBalance(creditorStatement);
  const debtorOpening = openingBalance(debtorStatement);

  const residual = round2(creditorAdjusted - debtorAdjusted);

  return {
    creditorBalance,
    debtorBalance,
    difference,
    creditorOpening,
    debtorOpening,
    openingDifference: round2(creditorOpening - debtorOpening),
    amountDifferences,
    creditorOnlyTotal,
    debtorOnlyTotal,
    creditorAdjusted,
    debtorAdjusted,
    residual,
    reconciles: Math.abs(difference - explained) <= tolerance,
    agreed: Math.abs(residual) <= tolerance && Math.abs(amountDifferences) <= tolerance,
  };
}
