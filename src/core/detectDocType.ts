import type { DocType, Perspective } from '../types';
import { foldText } from './normalize';

interface Rule {
  type: DocType;
  patterns: RegExp[];
}

/**
 * Turkish and English wording for what each ledger line is. Order matters:
 * the more specific wordings are tested first, since "fatura" also sits
 * inside "iade faturası".
 */
const RULES: Rule[] = [
  {
    type: 'opening',
    patterns: [/devir/, /devreden/, /nakli yekun/, /acilis/, /onceki donem/, /opening/, /brought forward/],
  },
  {
    type: 'creditNote',
    patterns: [/iade/, /alacak dekont/, /credit note/, /iskonto/, /rebate/],
  },
  {
    type: 'offset',
    patterns: [/mahsup/, /virman/, /takas/, /netlestirme/, /offset/, /set-?off/, /contra/],
  },
  {
    type: 'payment',
    patterns: [
      /tahsilat/, /odeme/, /havale/, /eft/, /banka/, /kasa/, /cek/, /senet/,
      /kredi karti/, /\bpos\b/, /payment/, /receipt/, /remittance/, /transfer/,
    ],
  },
  {
    type: 'invoice',
    patterns: [/fatura/, /\bftr\b/, /e-?ars/, /e-?fat/, /invoice/, /satis/, /hizmet bedeli/],
  },
];

/**
 * Classifies a line from its wording alone, or returns null when the text
 * gives nothing away.
 *
 * This is deliberately separate from the amount-based fallback: the engine
 * uses these text-only verdicts to work out which side of the relationship a
 * statement is written from, and an amount-based guess would assume the very
 * answer it is trying to find.
 */
export function detectDocTypeFromText(description: string, docNo: string): DocType | null {
  const haystack = `${foldText(description)} ${foldText(docNo)}`;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) return rule.type;
  }
  return null;
}

/**
 * Classifies a line, falling back to the shape of the amounts once the
 * statement's perspective is known.
 *
 * On a receivable card a borç is almost always an invoice and an alacak a
 * payment; on a payable card it is the other way round. That is the reading
 * an accountant would give the same line, and it is only ever used when the
 * description says nothing at all.
 */
export function detectDocType(
  description: string,
  docNo: string,
  debit: number,
  credit: number,
  perspective: Perspective,
): DocType {
  const fromText = detectDocTypeFromText(description, docNo);
  if (fromText) return fromText;

  const increasesDebt = perspective === 'receivable' ? debit - credit : credit - debit;
  if (increasesDebt > 0) return 'invoice';
  if (increasesDebt < 0) return 'payment';
  return 'other';
}
