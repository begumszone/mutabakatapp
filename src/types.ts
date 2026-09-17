/**
 * Domain model for two-sided current-account reconciliation (cari hesap
 * mutabakatı).
 *
 * The whole engine is built around one idea: two companies that trade with
 * each other each keep a ledger of the *same* relationship, and those two
 * ledgers are mirror images. ABC invoices Begüm; in ABC's books that is a
 * receivable (borç on Begüm's card), in Begüm's books the identical event is
 * a payable (alacak on ABC's card). Reconciling means orienting both ledgers
 * in one direction, matching document by document, and explaining every
 * remaining lira of the balance gap.
 */

export type Locale = 'tr' | 'en';

export type PartyId = string;

/** A company taking part in the reconciliation. */
export interface Party {
  id: PartyId;
  /** Legal name as it should appear on the mutabakat letter. */
  name: string;
  /** Vergi kimlik no / TCKN, when known. Used to auto-pair statements. */
  taxId: string | null;
}

/**
 * What a ledger line is, economically. Detected from the description and
 * document number, correctable by the user. Only `invoice` and `payment`
 * drive the ageing and allocation logic; the rest are carried through so the
 * balance bridge stays complete.
 */
export type DocType = 'invoice' | 'payment' | 'creditNote' | 'offset' | 'opening' | 'other';

/** One line of a cari hesap ekstresi, after column mapping. */
export interface StatementEntry {
  /** Stable id, unique within a statement. */
  id: string;
  /** 1-based row number in the uploaded file, so the user can find it again. */
  sourceRow: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Vade tarihi when the statement carries one, else null. */
  dueDate: string | null;
  /** Document number exactly as it appeared in the file. */
  docNo: string;
  /** Normalized document number used for matching. May be ''. */
  docKey: string;
  /** Zero-padding-insensitive variant of `docKey`, for a later matching pass. */
  docKeyLoose: string;
  docType: DocType;
  description: string;
  /** Borç, always >= 0. */
  debit: number;
  /** Alacak, always >= 0. */
  credit: number;
  currency: string;
  /**
   * The ERP's clearing/kapanış document, when the export carries one. A
   * non-empty value means that ERP considers this line settled — the invoice
   * and the payment that closed it have already been matched internally.
   * Empty means the line is still open, or that the export says nothing.
   */
  clearingDoc: string;
}

/**
 * Which side of the relationship a statement is written from.
 *
 * - `receivable` — the owner is owed money (their customer's cari card).
 * - `payable` — the owner owes money (their supplier's cari card).
 *
 * This is what lets the engine mirror one side onto the other.
 */
export type Perspective = 'receivable' | 'payable';

/** A closed date range, inclusive at both ends. */
export interface Period {
  start: string;
  end: string;
}

/** One uploaded cari hesap ekstresi. */
export interface Statement {
  id: string;
  fileName: string;
  /** Whose books these are. */
  ownerPartyId: PartyId;
  /** Who they are reconciling against. */
  counterpartyPartyId: PartyId;
  perspective: Perspective;
  currency: string;
  entries: StatementEntry[];
  /**
   * The period the export says it covers. Taken from the ekstre's own header
   * block where it states one, which is better evidence than the first and
   * last dates that happen to appear in the rows.
   */
  statedPeriod: Period | null;
}

/** How a pair of entries came to be considered the same document. */
export type MatchBasis =
  | 'docNoAndAmount'
  | 'docNo'
  | 'docNoLoose'
  | 'docNoSuffix'
  | 'dateAndAmount'
  | 'amountOnly'
  | 'manual';

export interface MatchedPair {
  creditorEntry: StatementEntry;
  debtorEntry: StatementEntry;
  basis: MatchBasis;
  /** Claim amount on the creditor's side, oriented "debtor owes creditor". */
  creditorClaim: number;
  debtorClaim: number;
  /** creditorClaim - debtorClaim. Zero for a clean match. */
  amountDifference: number;
  /** Calendar days between the two recorded dates. */
  dayDifference: number;
}

export interface UnmatchedEntry {
  entry: StatementEntry;
  /** Claim oriented "debtor owes creditor". */
  claim: number;
  /** True when the entry falls outside the other statement's date range, which
   *  usually means a cut-off difference rather than a missing record. */
  outsideCounterpartyRange: boolean;
}

export interface MatchSettings {
  /** Absolute amount tolerance, in the statement currency. */
  amountTolerance: number;
  /** How many days apart two records of the same document may be. */
  dayTolerance: number;
  /** Allow falling back to date+amount when no document number lines up. */
  allowDateAmountFallback: boolean;
}

export interface MatchResult {
  pairs: MatchedPair[];
  creditorOnly: UnmatchedEntry[];
  debtorOnly: UnmatchedEntry[];
}

/**
 * The balance bridge — the figures the mutabakat letter is actually built
 * from, in the order an accountant reads them.
 *
 * It mirrors the "SONUÇ TABLOSU" both sides already sign off on: each party's
 * closing balance, the opening (devir) each carried in, the records the other
 * party never booked, and what is left once those are put back. The engine
 * asserts that the pieces reproduce the gap exactly, so the bottom line is a
 * proof rather than a rounding story.
 */
export interface BalanceBridge {
  /** Closing balance per the creditor's books, "debtor owes creditor". */
  creditorBalance: number;
  /** Closing balance per the debtor's books, same direction. */
  debtorBalance: number;
  /** creditorBalance - debtorBalance: the gap to explain. */
  difference: number;

  /** Devir carried into the period by each side, and the gap between them. */
  creditorOpening: number;
  debtorOpening: number;
  openingDifference: number;

  /** Net effect of documents both booked, at different amounts. */
  amountDifferences: number;
  /** Documents only the creditor booked — the debtor is missing these. */
  creditorOnlyTotal: number;
  /** Documents only the debtor booked — the creditor is missing these. */
  debtorOnlyTotal: number;

  /** Each side's balance once the records it is missing are added back. */
  creditorAdjusted: number;
  debtorAdjusted: number;
  /** What the two sides still disagree on after every known difference. */
  residual: number;
  /** True when the explained components reproduce `difference` exactly. */
  reconciles: boolean;
  /** True when nothing at all is left unexplained — "MUTABAKAT SAĞLANDI". */
  agreed: boolean;
}

/** What the open-item reading left out of the comparison. */
export interface ExcludedSummary {
  active: boolean;
  /** Creditor lines the ERP had already cleared. */
  creditorSettled: number;
  /** Debtor lines settled because they matched a cleared creditor line. */
  debtorSettled: number;
  /** Opening (devir) lines, reported on their own row rather than compared. */
  openingLines: number;
}

/**
 * How the two statements line up in time, and what that costs.
 *
 * Two ekstre almost never cover the same window. One side sends the year to
 * date, the other sends the last three months, and the two closing balances
 * are then not comparable at all until the earlier part is accounted for.
 * This records the overlap the reconciliation can actually be run over, what
 * each side carries into it, and — when that carried-in figure does not
 * agree — which statement has to be asked for to explain the rest.
 */
export interface PeriodAlignment {
  creditorPeriod: Period | null;
  debtorPeriod: Period | null;
  /** The window both statements cover, which is where documents are compared. */
  common: Period | null;
  /** True when the two statements cover different windows. */
  misaligned: boolean;
  /** Each side's balance as it enters the common period. */
  creditorOpening: number;
  debtorOpening: number;
  openingDifference: number;
  /** The side whose statement starts later, when they differ. */
  shortSide: 'creditor' | 'debtor' | null;
  /** The date that side's statement is needed from. */
  neededFrom: string | null;
  /** Lines set aside for falling outside the common window. */
  creditorOutside: number;
  debtorOutside: number;
  /** Sides that state no devir at all, so their opening was taken as zero. */
  assumedZeroOpening: ('creditor' | 'debtor')[];
}

export type AgingBucket = 'notDue' | 'd1to30' | 'd31to60' | 'd61to90' | 'd90plus';

/** An invoice after payments have been allocated against it. */
export interface OpenInvoice {
  entry: StatementEntry;
  /** Invoice amount, oriented "debtor owes creditor". Always > 0. */
  amount: number;
  paid: number;
  open: number;
  /** Vade from the statement, or invoice date + agreed term. */
  dueDate: string | null;
  /**
   * Where `dueDate` came from. `none` means the statement carried no vade —
   * an invoice with no agreed due date is not overdue, and inventing one from
   * a default term produces confident-looking figures nobody agreed to.
   */
  dueDateSource: 'statement' | 'none';
  daysOverdue: number;
  bucket: AgingBucket;
  /** Ids of the payment entries that were applied to this invoice. */
  appliedPaymentIds: string[];
}

export interface AllocationResult {
  invoices: OpenInvoice[];
  /** Payment money left over after every invoice was covered. */
  unappliedPayments: number;
  /** Payments that could not be tied to any invoice at all. */
  unappliedPaymentIds: string[];
}

export type ActionSeverity = 'critical' | 'warning' | 'info';

export type ActionCategory =
  | 'missingInCounterparty'
  | 'missingInOwn'
  | 'amountMismatch'
  | 'cutOff'
  | 'overdue'
  | 'dueSoon'
  | 'unappliedPayment'
  | 'periodGap'
  | 'missingOpening'
  | 'openingMismatch'
  | 'openingVerified'
  | 'balanceAgreed';

/** A concrete next step, addressed to a named party. */
export interface RecommendedAction {
  id: string;
  severity: ActionSeverity;
  category: ActionCategory;
  /** Who has to do something. */
  ownerPartyId: PartyId;
  /** Money at stake, for sorting and for the summary. */
  amount: number;
  /** i18n key plus the values the sentence needs. */
  messageKey: string;
  messageVars: Record<string, string | number>;
  /** Source rows the user should look at. */
  entryIds: string[];
}

export interface ReconciliationSettings extends MatchSettings {
  /**
   * Reconcile only what is still open.
   *
   * A SAP-style extract is an open-item list plus its settled history: the
   * balance it reports is the rows with no clearing document, and the rest
   * are invoices already closed by payments the extract may not even carry.
   * With this on, settled documents drop out of the comparison on both sides
   * — including the counterparty rows that matched them — so the two sides
   * are compared on the same basis: what is genuinely still owed.
   */
  openItemsOnly: boolean;
  /**
   * The window the two ledgers are compared in, when the user names one.
   *
   * Mutabakat is almost always asked for over a stated period — the year to
   * date, or two or three years of it — and the extracts either side sends
   * rarely line up with that exactly. Naming the window makes the answer
   * reproducible: everything outside it is set aside as out of period rather
   * than reported as a missing record.
   */
  requestedPeriod: Period | null;
  /**
   * The date the two sides want to agree a balance at. ISO.
   *
   * Distinct from the end of `requestedPeriod`: an extract may run to
   * 05.08.2026 while the balance being signed off is the one at 30.06.2026.
   * Lines after this date are reported separately and never enter the balance.
   */
  asOfDate: string;
}

/** Everything the UI needs for one creditor/debtor pair. */
export interface PairReconciliation {
  creditor: Party;
  debtor: Party;
  creditorStatement: Statement;
  debtorStatement: Statement;
  currency: string;
  match: MatchResult;
  bridge: BalanceBridge;
  allocation: AllocationResult;
  actions: RecommendedAction[];
  /** The date ageing and the result table are stated as of. */
  asOfDate: string;
  /** What was set aside as already settled, and why the totals look smaller. */
  excluded: ExcludedSummary;
  /** How the two statements line up in time. */
  period: PeriodAlignment;
}

// ---------------------------------------------------------------------------
// File ingestion
// ---------------------------------------------------------------------------

export type Cell = string | number | null;
export type RawRow = Record<string, string | number | null>;

export interface ParsedSheet {
  name: string;
  grid: Cell[][];
  /** Where the engine thinks the column headers are; the user can correct it. */
  suggestedHeaderRow: number;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheet[];
}

export interface ParsedFile {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: RawRow[];
}

/**
 * How the amounts sit in the uploaded sheet.
 *
 * Turkish ERP exports use a borç/alacak pair; SAP exports use one signed
 * column. Both are common in the same reconciliation, so the mapper carries
 * the choice rather than guessing once for the whole app.
 */
export type AmountLayout = 'debitCredit' | 'signed';

/** Which uploaded column feeds each field the engine needs. */
export interface ColumnMapping {
  date: string | null;
  dueDate: string | null;
  docNo: string | null;
  /** A second reference column, used when the primary one is blank. */
  docNoAlt: string | null;
  docTypeColumn: string | null;
  description: string | null;
  amountLayout: AmountLayout;
  debit: string | null;
  credit: string | null;
  /** The single signed column, when `amountLayout` is 'signed'. */
  amount: string | null;
  currency: string | null;
  /** The ERP's clearing document column, when the export has one. */
  clearingDoc: string | null;
}

export interface MappingIssue {
  severity: 'error' | 'warning';
  messageKey: string;
  messageVars?: Record<string, string | number>;
}
