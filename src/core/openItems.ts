import type { ExcludedSummary, MatchResult, Statement, StatementEntry } from '../types';

export interface OpenItemView {
  creditorStatement: Statement;
  debtorStatement: Statement;
  match: MatchResult;
  excluded: ExcludedSummary;
}

/**
 * Reduces both ledgers to what is still open, so the two sides are compared
 * on the same basis.
 *
 * A SAP-style extract reports its balance as the rows with no clearing
 * document; everything else is an invoice the ERP has already closed against
 * a payment, often a payment for an invoice raised before the extract even
 * begins. Added together those settled rows do not come to anything
 * meaningful, which is why the whole extract does not foot to its own
 * balance.
 *
 * The counterparty's export usually has no clearing column at all, so the
 * settled set is carried across by the match itself: if this side says
 * invoice X is closed, the other side's copy of invoice X is closed too.
 * That inference is what keeps the comparison symmetric — without it, every
 * historical document the counterparty booked would come back as a record
 * the supplier is missing.
 *
 * Opening lines are set aside as well. A devir *is* the settled history in
 * one figure, so leaving it in would double-count exactly what was just
 * removed. It is reported on its own row in the result instead.
 */
export function selectOpenItems(
  creditorStatement: Statement,
  debtorStatement: Statement,
  match: MatchResult,
): OpenItemView {
  const settledCreditor = new Set<string>();
  const settledDebtor = new Set<string>();

  for (const entry of creditorStatement.entries) {
    if (entry.clearingDoc !== '') settledCreditor.add(entry.id);
  }
  for (const entry of debtorStatement.entries) {
    if (entry.clearingDoc !== '') settledDebtor.add(entry.id);
  }

  // Carry each side's verdict across to the other side's copy of the document.
  for (const pair of match.pairs) {
    if (settledCreditor.has(pair.creditorEntry.id)) settledDebtor.add(pair.debtorEntry.id);
    if (settledDebtor.has(pair.debtorEntry.id)) settledCreditor.add(pair.creditorEntry.id);
  }

  const isOpen = (entry: StatementEntry, settled: Set<string>): boolean =>
    !settled.has(entry.id) && entry.docType !== 'opening';

  const creditorEntries = creditorStatement.entries.filter((e) => isOpen(e, settledCreditor));
  const debtorEntries = debtorStatement.entries.filter((e) => isOpen(e, settledDebtor));

  const creditorOpen = new Set(creditorEntries.map((e) => e.id));
  const debtorOpen = new Set(debtorEntries.map((e) => e.id));

  const filtered: MatchResult = {
    // A pair survives only if both halves are still open. A pair split by the
    // filter would leave one side's document unexplained on its own.
    pairs: match.pairs.filter(
      (pair) => creditorOpen.has(pair.creditorEntry.id) && debtorOpen.has(pair.debtorEntry.id),
    ),
    creditorOnly: match.creditorOnly.filter((item) => creditorOpen.has(item.entry.id)),
    debtorOnly: match.debtorOnly.filter((item) => debtorOpen.has(item.entry.id)),
  };

  const openingLines =
    creditorStatement.entries.filter((e) => e.docType === 'opening').length +
    debtorStatement.entries.filter((e) => e.docType === 'opening').length;

  return {
    creditorStatement: { ...creditorStatement, entries: creditorEntries },
    debtorStatement: { ...debtorStatement, entries: debtorEntries },
    match: filtered,
    excluded: {
      active: true,
      creditorSettled: creditorStatement.entries.length - creditorEntries.length - 0,
      debtorSettled: debtorStatement.entries.length - debtorEntries.length - 0,
      openingLines,
    },
  };
}
