import type { Period, PeriodAlignment, Statement, StatementEntry } from '../types';
import { claimOf } from './claim';
import { round2 } from './parseNumber';

/** The window a statement covers: what it says, or failing that, its rows. */
export function periodOf(statement: Statement): Period | null {
  if (statement.statedPeriod) return statement.statedPeriod;
  const dated = statement.entries.filter((entry) => entry.date !== '');
  if (dated.length === 0) return null;
  let start = dated[0].date;
  let end = dated[0].date;
  for (const entry of dated) {
    if (entry.date < start) start = entry.date;
    if (entry.date > end) end = entry.date;
  }
  return { start, end };
}

/**
 * Whether a statement's window is something it told us, or something we
 * inferred from the rows it happens to contain.
 *
 * The distinction decides whether the comparison may be narrowed. From rows
 * alone, "this statement begins in March" and "this firm had no transactions
 * until March" look identical — and treating the second as the first would
 * quietly fold January's invoices into an opening balance instead of
 * reporting that the other side never booked them. A statement is taken to
 * genuinely begin where it begins only when it says so, or when it carries a
 * devir, which is a firm's own way of saying "here is what came before".
 */
function beginsDeliberately(statement: Statement, start: string): boolean {
  if (statement.statedPeriod) return true;
  return statement.entries.some((entry) => entry.docType === 'opening' && entry.date <= start);
}

/**
 * The window the two statements will actually be compared over.
 *
 * The start moves forward to the later of the two only when that later
 * statement really does begin there. The end moves back to the earlier of
 * the two only when that statement says where it ends — otherwise later
 * documents stay in the comparison and are reported as the other side not
 * having booked them, which is the safer of the two mistakes.
 */
export function comparisonWindow(
  creditorStatement: Statement,
  debtorStatement: Statement,
  creditorPeriod: Period | null,
  debtorPeriod: Period | null,
  /**
   * The window the user asked for, when they named one.
   *
   * It wins outright. Inferring the window from the files is a fallback for
   * when nobody has said which period is being reconciled; once somebody has,
   * guessing against them would silently reconcile a different period than
   * the one that gets signed.
   */
  requested: Period | null = null,
): Period | null {
  if (requested) return requested;
  if (!creditorPeriod) return debtorPeriod;
  if (!debtorPeriod) return creditorPeriod;

  let start = creditorPeriod.start < debtorPeriod.start ? creditorPeriod.start : debtorPeriod.start;
  if (creditorPeriod.start !== debtorPeriod.start) {
    const creditorStartsLater = creditorPeriod.start > debtorPeriod.start;
    const later = creditorStartsLater ? creditorStatement : debtorStatement;
    const laterStart = creditorStartsLater ? creditorPeriod.start : debtorPeriod.start;
    if (beginsDeliberately(later, laterStart)) start = laterStart;
  }

  let end = creditorPeriod.end > debtorPeriod.end ? creditorPeriod.end : debtorPeriod.end;
  if (creditorPeriod.end !== debtorPeriod.end) {
    const creditorEndsEarlier = creditorPeriod.end < debtorPeriod.end;
    const earlier = creditorEndsEarlier ? creditorStatement : debtorStatement;
    if (earlier.statedPeriod) end = creditorEndsEarlier ? creditorPeriod.end : debtorPeriod.end;
  }

  return start > end ? null : { start, end };
}

/**
 * Whether a line belongs to what the statement carried *into* the window.
 *
 * A devir is stated as of the first day of the period rather than the day
 * before it, so an opening line dated exactly on the start counts as brought
 * forward. Every other line on that date is a movement inside the window.
 */
function isBroughtForward(entry: StatementEntry, start: string): boolean {
  if (entry.date < start) return true;
  return entry.docType === 'opening' && entry.date <= start;
}

export interface PeriodSplit {
  /** Balance carried into the common window. */
  opening: number;
  /** Lines to be compared against the other side. */
  inside: StatementEntry[];
  /** Lines after the window ends, which the other side cannot yet have. */
  after: StatementEntry[];
  /** True when nothing at all was carried forward explicitly. */
  statesNoOpening: boolean;
}

/**
 * Splits one ledger at the edges of the common window.
 *
 * Everything before the window is collapsed into a single carried-forward
 * figure, because that is the only thing about it the other side can be asked
 * to agree with — the detail behind it is in a statement we do not have.
 * Everything after the window is set aside rather than reported as missing:
 * the counterparty has not sent those months, so their absence says nothing.
 */
export function splitAtPeriod(statement: Statement, window: Period | null): PeriodSplit {
  if (!window) {
    return {
      opening: 0,
      inside: statement.entries,
      after: [],
      statesNoOpening: !statement.entries.some((entry) => entry.docType === 'opening'),
    };
  }

  let opening = 0;
  const inside: StatementEntry[] = [];
  const after: StatementEntry[] = [];
  let sawOpeningLine = false;

  for (const entry of statement.entries) {
    if (isBroughtForward(entry, window.start)) {
      opening += claimOf(entry, statement.perspective);
      if (entry.docType === 'opening') sawOpeningLine = true;
    } else if (entry.date > window.end) {
      after.push(entry);
    } else {
      inside.push(entry);
    }
  }

  return {
    opening: round2(opening),
    inside,
    after,
    // Only a statement that begins at the window and names no devir is
    // genuinely silent about what it carried in. One that starts earlier has
    // told us, line by line.
    statesNoOpening: !sawOpeningLine && statement.entries.every((e) => !isBroughtForward(e, window.start)),
  };
}

/**
 * Works out whether the two statements can be compared, and what to ask for
 * when they cannot.
 *
 * The situation this exists for: one side sends the year to date and the
 * other sends March onwards. The overlap starts in March, and the first
 * question is whether the two sides agree on where they stood *entering*
 * March. The longer statement can answer that by rolling its own detail
 * forward; the shorter one can only state its devir. If those two figures
 * disagree, the cause lies in a window only one side has documented, and no
 * amount of matching will explain it — the honest output is to name the
 * statement that is missing and the date it is needed from.
 */
export function alignPeriods(
  creditorStatement: Statement,
  debtorStatement: Statement,
  tolerance = 0.01,
  /**
   * Whether the carried-forward figures are being compared at all.
   *
   * Reconciling open items, they are not: the devir stands for settled
   * history that has already been taken out of the comparison, so a gap
   * between the two openings is expected and says nothing about whether
   * anyone is missing a statement. Asking for an earlier ekstre on the
   * strength of it would send the user chasing a document they do not need.
   */
  compareOpenings = true,
  requested: Period | null = null,
): { alignment: PeriodAlignment; creditor: PeriodSplit; debtor: PeriodSplit } {
  const creditorPeriod = periodOf(creditorStatement);
  const debtorPeriod = periodOf(debtorStatement);
  const common = comparisonWindow(
    creditorStatement,
    debtorStatement,
    creditorPeriod,
    debtorPeriod,
    requested,
  );

  const creditor = splitAtPeriod(creditorStatement, common);
  const debtor = splitAtPeriod(debtorStatement, common);

  const openingDifference = round2(creditor.opening - debtor.opening);

  let shortSide: 'creditor' | 'debtor' | null = null;
  let neededFrom: string | null = null;
  if (creditorPeriod && debtorPeriod && creditorPeriod.start !== debtorPeriod.start) {
    const creditorStartsLater = creditorPeriod.start > debtorPeriod.start;
    shortSide = creditorStartsLater ? 'creditor' : 'debtor';
    // The statement is needed from wherever the *other* side's detail begins,
    // since that is the window the difference has to be found in.
    neededFrom = creditorStartsLater ? debtorPeriod.start : creditorPeriod.start;
  }

  const assumedZeroOpening: ('creditor' | 'debtor')[] = [];
  if (compareOpenings) {
    if (creditor.statesNoOpening && creditor.opening === 0) assumedZeroOpening.push('creditor');
    if (debtor.statesNoOpening && debtor.opening === 0) assumedZeroOpening.push('debtor');
  }

  const misaligned =
    requested === null &&
    creditorPeriod !== null &&
    debtorPeriod !== null &&
    (creditorPeriod.start !== debtorPeriod.start || creditorPeriod.end !== debtorPeriod.end);

  const openingsDisagree = compareOpenings && Math.abs(openingDifference) > tolerance;

  return {
    alignment: {
      creditorPeriod,
      debtorPeriod,
      common,
      misaligned,
      creditorOpening: creditor.opening,
      debtorOpening: debtor.opening,
      openingDifference,
      shortSide: openingsDisagree ? shortSide : null,
      neededFrom: openingsDisagree ? neededFrom : null,
      creditorOutside: creditor.after.length,
      debtorOutside: debtor.after.length,
      assumedZeroOpening,
    },
    creditor,
    debtor,
  };
}
