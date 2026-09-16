import type {
  ColumnMapping,
  ParsedFile,
  Perspective,
  RawRow,
  Statement,
  StatementEntry,
} from '../types';
import { detectDocType, detectDocTypeFromText } from '../core/detectDocType';
import { foldText, normalizeDocNo, normalizeDocNoLoose } from '../core/normalize';
import { parseAmount, round2 } from '../core/parseNumber';
import { parseDate } from '../core/parseDate';
import { suggestPerspective } from '../core/claim';
import type { Period } from '../types';

/** Footer wording that must never be read as a ledger line. */
const FOOTER = /(genel toplam|toplam tutarlar|^toplam$|^ara toplam|grand total|^total$)/;

export interface BuildResult {
  entries: StatementEntry[];
  /** Perspective the engine inferred from the data. */
  suggestedPerspective: Perspective;
  /** Rows dropped because they carried no readable date. */
  skippedNoDate: number;
  /** Rows dropped as report footers rather than transactions. */
  skippedFooter: number;
  /** Rows kept but carrying no amount at all. */
  zeroAmount: number;
}

function text(row: RawRow, header: string | null): string {
  if (!header) return '';
  const value = row[header];
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * Reads the mapped columns of one sheet into ledger lines.
 *
 * Two things in real exports need handling before anything else. Report
 * footers ("Genel Toplam", "Toplam Tutarlar :") look like rows and would add
 * the whole statement to itself if kept, so they are dropped by wording and
 * by the absence of a date. And a single signed amount column has to be
 * split back into borç and alacak, because the rest of the engine reasons in
 * those terms regardless of which ERP the file came out of.
 *
 * Document type is worked out in two passes: first from wording alone, which
 * is what tells us whether the sheet is a receivable or a payable card, and
 * then again with that answer in hand so the lines whose description says
 * nothing can still be read correctly.
 */
export function buildStatement(file: ParsedFile, mapping: ColumnMapping): BuildResult {
  interface Draft {
    entry: StatementEntry;
  }
  const drafts: Draft[] = [];
  let skippedNoDate = 0;
  let skippedFooter = 0;
  let zeroAmount = 0;

  file.rows.forEach((row, index) => {
    const description = text(row, mapping.description);
    const docNoPrimary = text(row, mapping.docNo);
    const docNoAlt = text(row, mapping.docNoAlt);
    const docTypeText = text(row, mapping.docTypeColumn);

    const haystack = foldText(`${description} ${docNoPrimary}`);
    if (FOOTER.test(haystack.trim())) {
      skippedFooter++;
      return;
    }

    const date = parseDate(row[mapping.date ?? ''] as string | number);
    if (!date) {
      skippedNoDate++;
      return;
    }

    let debit = 0;
    let credit = 0;
    if (mapping.amountLayout === 'signed') {
      const signed = parseAmount(row[mapping.amount ?? '']) ?? 0;
      if (signed >= 0) debit = round2(signed);
      else credit = round2(-signed);
    } else {
      debit = round2(parseAmount(row[mapping.debit ?? '']) ?? 0);
      credit = round2(parseAmount(row[mapping.credit ?? '']) ?? 0);
      // A negative borç is an alacak written awkwardly; fold it over so the
      // pair is always two non-negative figures.
      if (debit < 0) {
        credit = round2(credit - debit);
        debit = 0;
      }
      if (credit < 0) {
        debit = round2(debit - credit);
        credit = 0;
      }
    }
    if (debit === 0 && credit === 0) zeroAmount++;

    const docNo = docNoPrimary || docNoAlt;
    const currency = text(row, mapping.currency) || '';

    drafts.push({
      entry: {
        id: `r${index}`,
        sourceRow: index + 1,
        date,
        dueDate: parseDate(row[mapping.dueDate ?? ''] as string | number),
        docNo,
        docKey: normalizeDocNo(docNo),
        docKeyLoose: normalizeDocNoLoose(docNo),
        // The wording pass only; the amount-aware pass runs once we know the
        // statement's perspective.
        docType: detectDocTypeFromText(`${description} ${docTypeText}`, docNo) ?? 'other',
        description: [description, docNoAlt && docNoAlt !== docNo ? docNoAlt : '']
          .filter(Boolean)
          .join(' '),
        debit,
        credit,
        currency,
        clearingDoc: text(row, mapping.clearingDoc),
      },
    });
  });

  const entries = drafts.map((d) => d.entry);
  const suggestedPerspective = suggestPerspective(entries);

  for (const entry of entries) {
    if (entry.docType !== 'other') continue;
    entry.docType = detectDocType(
      entry.description,
      entry.docNo,
      entry.debit,
      entry.credit,
      suggestedPerspective,
    );
  }

  return { entries, suggestedPerspective, skippedNoDate, skippedFooter, zeroAmount };
}

/** Wraps built entries into a Statement for one party. */
export function makeStatement(
  id: string,
  file: ParsedFile,
  entries: StatementEntry[],
  ownerPartyId: string,
  counterpartyPartyId: string,
  perspective: Perspective,
  statedPeriod: Period | null = null,
): Statement {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.currency) continue;
    counts.set(entry.currency, (counts.get(entry.currency) ?? 0) + 1);
  }
  let currency = 'TRY';
  let best = 0;
  for (const [code, count] of counts) {
    if (count > best) {
      best = count;
      currency = code;
    }
  }

  return {
    id,
    fileName: `${file.fileName} — ${file.sheetName}`,
    ownerPartyId,
    counterpartyPartyId,
    perspective,
    currency,
    entries,
    statedPeriod,
  };
}
