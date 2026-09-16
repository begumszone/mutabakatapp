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

export type AgingBucket = 'notDue' | 'd1to30' | 'd31to60' | 'd61to90' | 'd90plus';

/** An invoice after payments have been allocated against it. */
export interface OpenInvoice {
  entry: StatementEntry;
  /** Invoice amount, oriented "debtor owes creditor". Always > 0. */
  amount: number;
  paid: number;
  open: number;
  /** Vade from the statement, or invoice date + agreed term. */
  dueDate: string;
  /** Whether `dueDate` came from the file or was derived from the term. */
  dueDateSource: 'statement' | 'term';
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
  /** Payment terms in days when a line carries no vade of its own. */
  termDays: number;
  /** The date ageing is measured from. ISO. */
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
}

export interface MappingIssue {
  severity: 'error' | 'warning';
  messageKey: string;
  messageVars?: Record<string, string | number>;
}
