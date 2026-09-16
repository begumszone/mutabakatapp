import type {
  MatchBasis,
  MatchResult,
  MatchSettings,
  MatchedPair,
  Statement,
  StatementEntry,
  UnmatchedEntry,
} from '../types';
import { claimOf, dateRange } from './claim';
import { docNoSuffix } from './normalize';
import { daysBetween } from './parseDate';
import { round2 } from './parseNumber';

interface Candidate {
  entry: StatementEntry;
  claim: number;
  taken: boolean;
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * Two lines may only be called the same document if they push the balance the
 * same way. Without this an invoice and a payment that happen to carry the
 * same reference number would pair up and quietly cancel a real difference.
 */
function directionsAgree(a: number, b: number): boolean {
  return sign(a) === sign(b);
}

function buildPair(
  creditor: Candidate,
  debtor: Candidate,
  basis: MatchBasis,
): MatchedPair {
  return {
    creditorEntry: creditor.entry,
    debtorEntry: debtor.entry,
    basis,
    creditorClaim: creditor.claim,
    debtorClaim: debtor.claim,
    amountDifference: round2(creditor.claim - debtor.claim),
    dayDifference: daysBetween(creditor.entry.date, debtor.entry.date),
  };
}

/**
 * Pairs up the entries that share one key, when a key can legitimately appear
 * more than once on a side (a document number reused, an amount that recurs).
 *
 * Every allowed combination is scored — amount gap first, then how far apart
 * the two dates are — and the cheapest pairing is taken until one side runs
 * out. With the handful of rows that share a key this is exact and instant,
 * and it keeps the matcher from burning a good candidate on the first row it
 * happens to reach.
 */
function pairWithinGroup(
  creditors: Candidate[],
  debtors: Candidate[],
  basis: MatchBasis,
  settings: MatchSettings,
  requireAmountMatch: boolean,
  out: MatchedPair[],
): void {
  interface Option {
    creditor: Candidate;
    debtor: Candidate;
    cost: number;
  }
  const options: Option[] = [];

  for (const creditor of creditors) {
    if (creditor.taken) continue;
    for (const debtor of debtors) {
      if (debtor.taken) continue;
      if (!directionsAgree(creditor.claim, debtor.claim)) continue;
      const amountGap = Math.abs(creditor.claim - debtor.claim);
      if (requireAmountMatch && amountGap > settings.amountTolerance) continue;
      const dayGap = Math.abs(daysBetween(creditor.entry.date, debtor.entry.date));
      options.push({ creditor, debtor, cost: amountGap * 1000 + dayGap });
    }
  }

  options.sort((a, b) => a.cost - b.cost);
  for (const option of options) {
    if (option.creditor.taken || option.debtor.taken) continue;
    option.creditor.taken = true;
    option.debtor.taken = true;
    out.push(buildPair(option.creditor, option.debtor, basis));
  }
}

function groupBy(candidates: Candidate[], key: (c: Candidate) => string): Map<string, Candidate[]> {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    if (candidate.taken) continue;
    const k = key(candidate);
    if (k === '') continue; // a blank key is "unknown", not a value to match on
    const bucket = groups.get(k);
    if (bucket) bucket.push(candidate);
    else groups.set(k, [candidate]);
  }
  return groups;
}

function runKeyedPass(
  creditors: Candidate[],
  debtors: Candidate[],
  key: (c: Candidate) => string,
  basis: MatchBasis,
  settings: MatchSettings,
  requireAmountMatch: boolean,
  out: MatchedPair[],
): void {
  const creditorGroups = groupBy(creditors, key);
  const debtorGroups = groupBy(debtors, key);
  for (const [k, creditorGroup] of creditorGroups) {
    const debtorGroup = debtorGroups.get(k);
    if (!debtorGroup) continue;
    pairWithinGroup(creditorGroup, debtorGroup, basis, settings, requireAmountMatch, out);
  }
}

/**
 * Matches a date+amount pair only when the answer is unambiguous on both
 * sides. Two identical amounts a few days apart are usually the same
 * document recorded late; four identical amounts are a monthly retainer, and
 * guessing which is which would invent a match the accountant cannot defend.
 */
function runDateAmountPass(
  creditors: Candidate[],
  debtors: Candidate[],
  settings: MatchSettings,
  basis: MatchBasis,
  dayLimit: number,
  out: MatchedPair[],
): void {
  for (const creditor of creditors) {
    if (creditor.taken) continue;
    const matches = debtors.filter(
      (debtor) =>
        !debtor.taken &&
        directionsAgree(creditor.claim, debtor.claim) &&
        Math.abs(creditor.claim - debtor.claim) <= settings.amountTolerance &&
        Math.abs(daysBetween(creditor.entry.date, debtor.entry.date)) <= dayLimit,
    );
    if (matches.length !== 1) continue;

    // The other side must be just as sure: if this debtor line could equally
    // be some other creditor line, the pairing is a coin flip.
    const debtor = matches[0];
    const reverse = creditors.filter(
      (other) =>
        !other.taken &&
        directionsAgree(other.claim, debtor.claim) &&
        Math.abs(other.claim - debtor.claim) <= settings.amountTolerance &&
        Math.abs(daysBetween(other.entry.date, debtor.entry.date)) <= dayLimit,
    );
    if (reverse.length !== 1) continue;

    creditor.taken = true;
    debtor.taken = true;
    out.push(buildPair(creditor, debtor, basis));
  }
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  amountTolerance: 0.01,
  dayTolerance: 7,
  allowDateAmountFallback: true,
};

/**
 * Matches the creditor's ledger against the debtor's, document by document.
 *
 * The passes run strongest evidence first, and each one only sees what the
 * earlier ones left behind:
 *
 * 1. same document number *and* same amount — an undisputed match;
 * 2. same document number, different amount — the same invoice booked at two
 *    figures, which is a finding in itself rather than a failure to match;
 * 3. same document number once padding zeros are squeezed out, since the two
 *    ERPs pad the same invoice serial differently — with, then without, the
 *    amount having to agree, because the invoice whose serial is padded
 *    differently is very often the same invoice converted at two different
 *    FX rates;
 * 4. same trailing serial — one side kept the series prefix, the other did not;
 * 5. same amount within a few days — for payments and dekonts that carry no
 *    usable reference at all;
 * 6. same amount anywhere in the period, but only when exactly one candidate
 *    exists on each side.
 *
 * Steps 5 and 6 are the guesses, so they are switchable and always reported
 * with the basis that produced them; the UI shows it on every matched row.
 */
export function matchStatements(
  creditorStatement: Statement,
  debtorStatement: Statement,
  settings: MatchSettings = DEFAULT_MATCH_SETTINGS,
): MatchResult {
  const creditors: Candidate[] = creditorStatement.entries.map((entry) => ({
    entry,
    claim: claimOf(entry, creditorStatement.perspective),
    taken: false,
  }));
  const debtors: Candidate[] = debtorStatement.entries.map((entry) => ({
    entry,
    claim: claimOf(entry, debtorStatement.perspective),
    taken: false,
  }));

  const pairs: MatchedPair[] = [];

  runKeyedPass(creditors, debtors, (c) => c.entry.docKey, 'docNoAndAmount', settings, true, pairs);
  runKeyedPass(creditors, debtors, (c) => c.entry.docKey, 'docNo', settings, false, pairs);
  runKeyedPass(creditors, debtors, (c) => c.entry.docKeyLoose, 'docNoLoose', settings, true, pairs);
  runKeyedPass(creditors, debtors, (c) => c.entry.docKeyLoose, 'docNoLoose', settings, false, pairs);
  runKeyedPass(
    creditors,
    debtors,
    (c) => docNoSuffix(c.entry.docKey),
    'docNoSuffix',
    settings,
    true,
    pairs,
  );

  if (settings.allowDateAmountFallback) {
    runDateAmountPass(creditors, debtors, settings, 'dateAndAmount', settings.dayTolerance, pairs);
    // Last resort: the same amount anywhere in the period. Still requires the
    // match to be unique on both sides.
    runDateAmountPass(creditors, debtors, settings, 'amountOnly', 36500, pairs);
  }

  const creditorRange = dateRange(creditorStatement.entries);
  const debtorRange = dateRange(debtorStatement.entries);

  const outside = (date: string, range: { start: string; end: string } | null): boolean =>
    range === null ? false : date < range.start || date > range.end;

  const creditorOnly: UnmatchedEntry[] = creditors
    .filter((c) => !c.taken)
    .map((c) => ({
      entry: c.entry,
      claim: c.claim,
      outsideCounterpartyRange: outside(c.entry.date, debtorRange),
    }));

  const debtorOnly: UnmatchedEntry[] = debtors
    .filter((d) => !d.taken)
    .map((d) => ({
      entry: d.entry,
      claim: d.claim,
      outsideCounterpartyRange: outside(d.entry.date, creditorRange),
    }));

  pairs.sort((a, b) => a.creditorEntry.date.localeCompare(b.creditorEntry.date));
  creditorOnly.sort((a, b) => Math.abs(b.claim) - Math.abs(a.claim));
  debtorOnly.sort((a, b) => Math.abs(b.claim) - Math.abs(a.claim));

  return { pairs, creditorOnly, debtorOnly };
}
