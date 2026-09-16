import type { Cell } from '../types';
import { foldText, normalizeTaxId } from '../core/normalize';
import { parseDate } from '../core/parseDate';

/**
 * What an ekstre says about itself, above its column headers.
 */
export interface Preamble {
  /** The firm whose books these are, when the export names it. */
  ownerName: string | null;
  /** The firm the card is kept for. */
  counterpartyName: string | null;
  /** The owner's own account code for that firm, e.g. "320-03-01-403". */
  counterpartyCode: string | null;
  /** Vergi kimlik no, only when it reads as a whole one. */
  counterpartyTaxId: string | null;
  /** The period the export covers, when it states one. */
  periodStart: string | null;
  periodEnd: string | null;
}

export const EMPTY_PREAMBLE: Preamble = {
  ownerName: null,
  counterpartyName: null,
  counterpartyCode: null,
  counterpartyTaxId: null,
  periodStart: null,
  periodEnd: null,
};

/** "( 01.01.2026 - 31.08.2026 )" and the variants around it. */
const PERIOD = /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*[-–—]\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/;
/** "V.No: 0100420227", sometimes run together with the tax office. */
const TAX_NO = /v\.?\s*no\s*:?\s*(\d+)/;
/** "Cari Kod" and its neighbours across the ERPs these files come from. */
const ACCOUNT_LABEL = /(cari kod|cari kodu|hesap kodu|musteri kodu|account code)/;
/** An account code looks like 320-03-01-403 or 120.01.006. */
const ACCOUNT_CODE = /^\d{3}[.\-/]\d/;
/** The code itself, so it can be split off a cell that also holds the name. */
const ACCOUNT_CODE_HEAD = /^(\d{3}(?:[.\-/]\d+)+)/;

/** Labels that are never a company name, however prominent they look. */
const NOT_A_NAME =
  /(tel\s*:|faks|fax|adres|v\.?\s*dairesi|sayfa|tarih|hareket dokumu|ekstre|doviz|rapor|yazdir|toplam)/;

/** Report titles and the template's own placeholders, not firms. */
const REPORT_TITLE =
  /^(muavin defter|defteri kebir|mizan|[ab] firmasi|firma|cari hesap|hesap karti|calisma)\b/;

/**
 * Vocabulary that only ever appears in a transaction, never in a company
 * name. A sheet with no preamble at all can have its first data row mistaken
 * for one, and "GELEN EFT - FLO MAĞAZACILIK ... - İHTİRAZI KAYITLI 12 2025
 * CIRO KIRA ÖDE" is otherwise the right length and mostly letters.
 */
const TRANSACTION_WORDS = /(\beft\b|havale|virman|tahsilat|ihtirazi|dekont|\bfis\b)/;

/**
 * An address, which arrives with no label to give it away.
 *
 * "REŞİTPAŞA MAH.ESKİ BÜYÜKDERE CAD.PARK PLAZA NO:14 D:8 SARIYER İSTANBUL"
 * is mostly letters and the right length, so every test for "does this look
 * like a company" says yes. What gives it away is the vocabulary of a
 * Turkish address — the street and building words, and a door number.
 */
const LOOKS_LIKE_ADDRESS =
  /(\bmah\b|mahalle|\bcad\b|cadde|\bsok\b|sokak|bulvar|\bblv\b|\bno\s*:|\bd\s*:\s*\d|\bkat\s*:|apartman|\bapt\b|\bsit\b|organize sanayi)/;

function cellsOf(row: Cell[]): string[] {
  const seen = new Set<string>();
  const cells: string[] = [];
  for (const cell of row) {
    // Merged cells repeat the same text across every column they span.
    const text = cell === null || cell === undefined ? '' : String(cell).trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);
    cells.push(text);
  }
  return cells;
}

function looksLikeCompany(text: string): boolean {
  if (text.length < 6 || text.length > 120) return false;
  const folded = foldText(text);
  if (NOT_A_NAME.test(folded)) return false;
  if (REPORT_TITLE.test(folded)) return false;
  if (LOOKS_LIKE_ADDRESS.test(folded)) return false;
  if (TRANSACTION_WORDS.test(folded)) return false;
  if (ACCOUNT_CODE.test(text)) return false;
  // A company name is mostly letters; a code or an amount is mostly digits.
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters >= text.length * 0.5;
}

/**
 * Reads what a cari hesap ekstresi says about itself before its table starts.
 *
 * Every ERP prints a block above the column headers — who the books belong
 * to, whose card this is, that firm's account code and tax number, and the
 * period covered — and the parser has to skip it to find the headers. Skipping
 * it and then asking the user to retype the same facts is the wrong trade:
 * somebody reconciling six hundred counterparties should not name the firms
 * by hand six hundred times, and the period is the fact that decides whether
 * two statements can be compared at all.
 *
 * Nothing here is forced. Each field is returned only when the block actually
 * states it, so a terse export simply yields nulls and the user fills in what
 * is missing, rather than being handed a confident guess.
 */
export function readPreamble(grid: Cell[][], headerRowIndex: number): Preamble {
  const rows = grid.slice(0, headerRowIndex).map(cellsOf);
  const result: Preamble = { ...EMPTY_PREAMBLE };

  for (const cells of rows) {
    for (const text of cells) {
      const folded = foldText(text);

      if (!result.periodStart) {
        const period = PERIOD.exec(text);
        if (period) {
          result.periodStart = parseDate(period[1]);
          result.periodEnd = parseDate(period[2]);
        }
      }

      if (!result.counterpartyTaxId) {
        const tax = TAX_NO.exec(folded);
        if (tax) {
          const digits = normalizeTaxId(tax[1]);
          // A VKN is ten digits and a TCKN eleven. Anything else means the
          // cell was truncated or run together with the next field, and a
          // half tax number would file the reconciliation under the wrong
          // counterparty — so it is dropped rather than half-trusted.
          if (digits.length === 10 || digits.length === 11) result.counterpartyTaxId = digits;
        }
      }
    }

    // The counterparty sits on the "Cari Kod" line: label, code, then name.
    if (!result.counterpartyName && cells.some((c) => ACCOUNT_LABEL.test(foldText(c)))) {
      for (const text of cells) {
        const code = ACCOUNT_CODE_HEAD.exec(text);
        if (code) {
          // Some exports put the code and the firm in one cell, sometimes
          // with a stray trailing figure: "120.01.006 MODANİSA ... 0".
          if (!result.counterpartyCode) result.counterpartyCode = code[1];
          const rest = text.slice(code[1].length).replace(/\s+\d+$/, '').trim();
          if (!result.counterpartyName && looksLikeCompany(rest)) result.counterpartyName = rest;
        } else if (
          !result.counterpartyName &&
          looksLikeCompany(text) &&
          !ACCOUNT_LABEL.test(foldText(text))
        ) {
          result.counterpartyName = text;
        }
      }
    }
  }

  // Whoever is named before the counterparty line, and is not the
  // counterparty, is the firm whose books these are.
  for (const cells of rows) {
    if (result.ownerName) break;
    if (cells.some((c) => ACCOUNT_LABEL.test(foldText(c)))) break;
    for (const text of cells) {
      if (looksLikeCompany(text) && text !== result.counterpartyName) {
        result.ownerName = text;
        break;
      }
    }
  }

  return result;
}
