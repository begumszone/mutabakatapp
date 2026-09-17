import type {
  ActionSeverity,
  AllocationResult,
  BalanceBridge,
  MatchResult,
  MatchedPair,
  Party,
  PeriodAlignment,
  RecommendedAction,
} from '../types';
import { round2 } from './parseNumber';

/** Common VAT ratios, so a mismatch that is exactly the tax can be named. */
const VAT_RATIOS = [1.01, 1.08, 1.1, 1.18, 1.2];

/** A sane band for a TRY cross rate, used to recognise an FX booking gap. */
const FX_RATIO_MIN = 1.5;
const FX_RATIO_MAX = 200;

/** Above this, a small ratio stops looking like two FX rates for one invoice. */
const RATE_GAP_MAX = 1.25;

function severityForAmount(amount: number, materiality: number): ActionSeverity {
  const size = Math.abs(amount);
  if (size >= materiality * 5) return 'critical';
  if (size >= materiality) return 'warning';
  return 'info';
}

/**
 * Explains *why* two sides booked the same document at different figures.
 *
 * Almost every real difference in these reconciliations has one of three
 * causes, and naming the cause is the difference between "there is a 8.286,26
 * TL gap" and "ABBOTT converted at 53,12 and KONSENSUS at 54,50". So the
 * ratio between the two amounts is tested against each cause in turn:
 *
 * - exactly a VAT rate: one side booked gross, the other net;
 * - a large ratio with different currencies on the two lines: one side never
 *   converted at all, and the ratio is the rate it should have used;
 * - a small ratio, a few percent either way: both sides converted the same
 *   foreign-currency invoice, at different rates. This is by far the most
 *   common one in practice and the easiest to mistake for a pricing dispute,
 *   so it is reported as the percentage gap between the two rates.
 *
 * Anything else is left as an unexplained mismatch rather than dressed up as
 * a diagnosis.
 */
function classifyAmountDifference(pair: MatchedPair): {
  key: string;
  vars: Record<string, string | number>;
} {
  const a = Math.abs(pair.creditorClaim);
  const b = Math.abs(pair.debtorClaim);
  const base = { docNo: pair.creditorEntry.docNo || pair.debtorEntry.docNo };

  if (a > 0 && b > 0) {
    const ratio = a > b ? a / b : b / a;

    for (const vat of VAT_RATIOS) {
      if (Math.abs(ratio - vat) < 0.002) {
        return {
          key: 'action.amountMismatchVat',
          vars: { ...base, rate: round2((vat - 1) * 100) },
        };
      }
    }

    const currenciesDiffer =
      pair.creditorEntry.currency !== '' &&
      pair.debtorEntry.currency !== '' &&
      pair.creditorEntry.currency !== pair.debtorEntry.currency;

    if (ratio >= FX_RATIO_MIN && ratio <= FX_RATIO_MAX) {
      return {
        key: currenciesDiffer ? 'action.amountMismatchFx' : 'action.amountMismatchMaybeFx',
        vars: { ...base, rate: round2(ratio) },
      };
    }

    if (ratio > 1.0005 && ratio <= RATE_GAP_MAX) {
      return {
        key: 'action.amountMismatchRate',
        vars: { ...base, percent: round2((ratio - 1) * 100) },
      };
    }
  }

  return { key: 'action.amountMismatch', vars: base };
}

export interface ActionInput {
  creditor: Party;
  debtor: Party;
  match: MatchResult;
  bridge: BalanceBridge;
  allocation: AllocationResult;
  /** Differences at or above this size are worth a phone call. */
  materiality: number;
  period: PeriodAlignment;
}

/**
 * Turns a finished reconciliation into the list of things somebody now has
 * to do, addressed to the party who has to do it.
 *
 * The ordering is the point: whoever opens this has limited time, so the
 * biggest money and the oldest debt come first, and an agreed balance is
 * stated plainly at the top instead of leaving the reader to infer it from
 * an empty list.
 */
/** The day before an ISO date -- when a devir is struck, relative to a window. */
function dayBefore(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** True for 31 December, the date a devir normally carries. */
function isYearEnd(iso: string): boolean {
  return iso.slice(5) === '12-31';
}

export function buildActions(input: ActionInput): RecommendedAction[] {
  const { creditor, debtor, match, bridge, allocation, materiality, period } = input;
  const actions: RecommendedAction[] = [];

  // Before anything inside the window: can the window be trusted at all?
  if (period.shortSide && period.neededFrom) {
    const short = period.shortSide === 'creditor' ? creditor : debtor;
    actions.push({
      id: 'period-gap',
      severity: 'critical',
      category: 'periodGap',
      ownerPartyId: short.id,
      amount: period.openingDifference,
      messageKey: 'action.periodGap',
      messageVars: {
        shortParty: short.name,
        neededFrom: period.neededFrom,
        commonStart: period.common?.start ?? '',
        creditorOpening: period.creditorOpening,
        debtorOpening: period.debtorOpening,
        difference: period.openingDifference,
        creditor: creditor.name,
        debtor: debtor.name,
      },
      entryIds: [],
    });
  }

  /*
   * The devir check, run on every reconciliation and never skipped at a year
   * end.
   *
   * `periodGap` above only fires when the two statements start on different
   * days. Two statements that start on the same day can still carry different
   * devir figures, and when they do, nothing inside the window will ever
   * explain it: the disagreement was inherited. Closing a year on top of an
   * unagreed devir carries the error into the next year, where it is harder
   * to find, so this is raised at full severity and stated with both figures.
   */
  const openingDate = period.common ? dayBefore(period.common.start) : null;
  const openingsDiffer = Math.abs(period.openingDifference) > materiality;
  if (!period.shortSide && openingsDiffer) {
    actions.push({
      id: 'opening-mismatch',
      severity: 'critical',
      category: 'openingMismatch',
      ownerPartyId: creditor.id,
      amount: period.openingDifference,
      messageKey: 'action.openingMismatch',
      messageVars: {
        date: openingDate ?? '',
        creditor: creditor.name,
        debtor: debtor.name,
        creditorOpening: period.creditorOpening,
        debtorOpening: period.debtorOpening,
        difference: period.openingDifference,
      },
      entryIds: [],
    });
  } else if (openingDate !== null && isYearEnd(openingDate) && !openingsDiffer) {
    // Saying so is the point. A devir that agrees is a result, and the person
    // signing the mutabakat mektubu needs it on the page, not inferred from
    // the absence of a warning.
    actions.push({
      id: 'opening-verified',
      severity: 'info',
      category: 'openingVerified',
      ownerPartyId: creditor.id,
      amount: period.creditorOpening,
      messageKey: 'action.openingVerified',
      messageVars: { date: openingDate, amount: period.creditorOpening },
      entryIds: [],
    });
  }

  for (const side of period.assumedZeroOpening) {
    const party = side === 'creditor' ? creditor : debtor;
    actions.push({
      id: `no-opening-${side}`,
      severity: 'warning',
      category: 'missingOpening',
      ownerPartyId: party.id,
      amount: 0,
      messageKey: 'action.missingOpening',
      messageVars: { party: party.name, date: period.common?.start ?? '' },
      entryIds: [],
    });
  }

  if (bridge.agreed) {
    actions.push({
      id: 'agreed',
      severity: 'info',
      category: 'balanceAgreed',
      ownerPartyId: creditor.id,
      amount: bridge.creditorAdjusted,
      messageKey: 'action.balanceAgreed',
      messageVars: { creditor: creditor.name, debtor: debtor.name },
      entryIds: [],
    });
  }

  // Records the debtor never booked: the creditor has to send the document.
  for (const item of match.creditorOnly) {
    const cutOff = item.outsideCounterpartyRange;
    actions.push({
      id: `creditor-only-${item.entry.id}`,
      severity: cutOff ? 'info' : severityForAmount(item.claim, materiality),
      category: cutOff ? 'cutOff' : 'missingInCounterparty',
      ownerPartyId: debtor.id,
      amount: item.claim,
      messageKey: cutOff ? 'action.cutOff' : 'action.missingInCounterparty',
      messageVars: {
        docNo: item.entry.docNo,
        date: item.entry.date,
        holder: creditor.name,
        missing: debtor.name,
      },
      entryIds: [item.entry.id],
    });
  }

  // Records the creditor never booked: usually a payment or a credit note.
  for (const item of match.debtorOnly) {
    const cutOff = item.outsideCounterpartyRange;
    actions.push({
      id: `debtor-only-${item.entry.id}`,
      severity: cutOff ? 'info' : severityForAmount(item.claim, materiality),
      category: cutOff ? 'cutOff' : 'missingInOwn',
      ownerPartyId: creditor.id,
      amount: item.claim,
      messageKey: cutOff ? 'action.cutOff' : 'action.missingInOwn',
      messageVars: {
        docNo: item.entry.docNo,
        date: item.entry.date,
        holder: debtor.name,
        missing: creditor.name,
      },
      entryIds: [item.entry.id],
    });
  }

  for (const pair of match.pairs) {
    if (Math.abs(pair.amountDifference) < 0.01) continue;
    const { key, vars } = classifyAmountDifference(pair);
    actions.push({
      id: `mismatch-${pair.creditorEntry.id}-${pair.debtorEntry.id}`,
      severity: severityForAmount(pair.amountDifference, materiality),
      category: 'amountMismatch',
      ownerPartyId: creditor.id,
      amount: pair.amountDifference,
      messageKey: key,
      messageVars: {
        ...vars,
        creditor: creditor.name,
        debtor: debtor.name,
        creditorAmount: pair.creditorClaim,
        debtorAmount: pair.debtorClaim,
        difference: pair.amountDifference,
      },
      entryIds: [pair.creditorEntry.id, pair.debtorEntry.id],
    });
  }

  for (const invoice of allocation.invoices) {
    if (invoice.open <= 0.01) continue;
    if (invoice.daysOverdue > 0) {
      actions.push({
        id: `overdue-${invoice.entry.id}`,
        severity: invoice.daysOverdue > 60 ? 'critical' : 'warning',
        category: 'overdue',
        ownerPartyId: debtor.id,
        amount: invoice.open,
        messageKey: 'action.overdue',
        messageVars: {
          docNo: invoice.entry.docNo,
          days: invoice.daysOverdue,
          dueDate: invoice.dueDate ?? '',
          debtor: debtor.name,
        },
        entryIds: [invoice.entry.id],
      });
    }
  }

  if (allocation.unappliedPayments > 0.01) {
    actions.push({
      id: 'unapplied-payments',
      severity: 'warning',
      category: 'unappliedPayment',
      ownerPartyId: creditor.id,
      amount: allocation.unappliedPayments,
      messageKey: 'action.unappliedPayment',
      messageVars: { count: allocation.unappliedPaymentIds.length },
      entryIds: allocation.unappliedPaymentIds,
    });
  }

  const rank: Record<ActionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  actions.sort((a, b) => {
    if (a.category === 'balanceAgreed') return -1;
    if (b.category === 'balanceAgreed') return 1;
    const bySeverity = rank[a.severity] - rank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  return actions;
}
