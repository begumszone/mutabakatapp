import ExcelJS from 'exceljs';
import type { Locale, PairReconciliation, UnmatchedEntry } from '../types';
import { translate } from './i18n';
import { formatDate } from './formatters';

const MONEY = '#,##0.00';
const HEAD_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EEF7' },
};

function headerRow(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEAD_FILL;
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB4C2D9' } } };
  });
}

/**
 * Writes the reconciliation out as the "SONUÇ TABLOSU" both finance
 * departments already recognise.
 *
 * This deliberately reproduces the spreadsheet these teams build by hand
 * today, line for line and in their sign convention — the debtor's side is
 * shown negated after reconciliation, so the two adjusted balances read as
 * mirror images and the bottom line is a single "Mutabakat Farkı" that
 * should be zero. Somebody who has checked these by hand for years can put
 * the app's output next to their own and see the same shape, which is what
 * makes it trustworthy enough to sign.
 *
 * The supporting sheets behind it carry the detail: every matched document
 * and how it was matched, every amount difference, every missing record, the
 * ageing, and the recommended actions.
 */
export async function exportReconciliation(
  result: PairReconciliation,
  locale: Locale,
): Promise<Blob> {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const { creditor, debtor, bridge, match, allocation, actions } = result;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MutabakatAPP';
  workbook.created = new Date();

  // --- SONUÇ TABLOSU ------------------------------------------------------
  const summary = workbook.addWorksheet('SONUÇ TABLOSU');
  summary.columns = [
    { width: 18 }, { width: 26 }, { width: 22 }, { width: 22 }, { width: 3 },
    { width: 18 }, { width: 3 }, { width: 46 },
  ];

  summary.addRow(['', 'A FİRMASI', creditor.name]);
  summary.addRow(['', 'B FİRMASI', debtor.name]);
  summary.addRow(['', 'TARİH', formatDate(result.asOfDate, locale)]);
  summary.addRow([]);
  summary.getCell('B1').font = { bold: true };
  summary.getCell('B2').font = { bold: true };
  summary.getCell('B3').font = { bold: true };

  const head = summary.addRow([
    t('table.date'),
    'İŞLEM / AÇIKLAMA',
    t('result.figuresOf', { name: creditor.name }),
    t('result.figuresOf', { name: debtor.name }),
    '',
    t('table.diff'),
  ]);
  headerRow(head);

  const line = (
    label: string,
    a: number | string | null,
    b: number | string | null,
    diff: number | string | null,
    note = '',
    date = '',
  ): ExcelJS.Row => {
    const row = summary.addRow([date, label, a, b, '', diff, '', note]);
    for (const col of ['C', 'D', 'F']) {
      const cell = row.getCell(col);
      if (typeof cell.value === 'number') cell.numFmt = MONEY;
    }
    return row;
  };

  line(
    t('result.balanceToday'),
    bridge.creditorBalance,
    bridge.debtorBalance,
    bridge.difference,
    t('result.balanceDiff'),
    formatDate(result.asOfDate, locale),
  );
  line(
    t('result.opening'),
    bridge.creditorOpening,
    bridge.debtorOpening,
    bridge.openingDifference,
    t('result.openingDiff'),
  );
  // Each side's cell is what *that* side has to add, in that side's own sign.
  line(t('result.missingTotal'), bridge.debtorOnlyTotal, -bridge.creditorOnlyTotal, null);
  const adjusted = line(
    t('result.afterReconciliation'),
    bridge.creditorAdjusted,
    -bridge.debtorAdjusted,
    null,
  );
  adjusted.font = { bold: true };

  const verdict = line(
    t('result.difference'),
    bridge.residual,
    bridge.agreed ? `${t('result.agreed')} !` : t('result.notAgreed'),
    null,
  );
  verdict.font = { bold: true };
  verdict.getCell('D').font = {
    bold: true,
    color: { argb: bridge.agreed ? 'FF1B7F4B' : 'FFB3261E' },
  };

  if (!bridge.reconciles) {
    const warn = summary.addRow(['', t('result.bridgeBroken')]);
    warn.getCell('B').font = { bold: true, color: { argb: 'FFB3261E' } };
  }

  summary.addRow([]);
  const listHead = summary.addRow([
    t('table.docNo'),
    t('table.date'),
    t('result.debtorOnly', { creditor: creditor.name, debtor: debtor.name }),
    t('result.creditorOnly', { creditor: creditor.name, debtor: debtor.name }),
    '',
    '',
    '',
    t('result.explanation'),
  ]);
  headerRow(listHead);

  const explanationFor = (entryId: string): string => {
    const action = actions.find((a) => a.entryIds.includes(entryId));
    return action ? t(action.messageKey, action.messageVars) : '';
  };

  const addMissing = (item: UnmatchedEntry, column: 'C' | 'D'): void => {
    const row = summary.addRow([
      item.entry.docNo,
      formatDate(item.entry.date, locale),
      column === 'C' ? item.claim : null,
      column === 'D' ? item.claim : null,
      '',
      '',
      '',
      explanationFor(item.entry.id),
    ]);
    row.getCell(column).numFmt = MONEY;
  };

  for (const item of match.debtorOnly) addMissing(item, 'C');
  for (const item of match.creditorOnly) addMissing(item, 'D');
  if (match.debtorOnly.length === 0 && match.creditorOnly.length === 0) {
    summary.addRow(['', '', '', '', '', '', '', t('result.noRows')]);
  }

  // --- Amount differences -------------------------------------------------
  const mismatches = match.pairs.filter((p) => Math.abs(p.amountDifference) >= 0.01);
  const diffSheet = workbook.addWorksheet('Tutar Farkları');
  diffSheet.columns = [
    { width: 22 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 60 },
  ];
  headerRow(
    diffSheet.addRow([
      t('table.docNo'),
      t('table.date'),
      t('table.creditorAmount', { name: creditor.name }),
      t('table.debtorAmount', { name: debtor.name }),
      t('table.diff'),
      t('result.explanation'),
    ]),
  );
  for (const pair of mismatches) {
    const row = diffSheet.addRow([
      pair.creditorEntry.docNo || pair.debtorEntry.docNo,
      formatDate(pair.creditorEntry.date, locale),
      pair.creditorClaim,
      pair.debtorClaim,
      pair.amountDifference,
      explanationFor(pair.creditorEntry.id),
    ]);
    for (const col of ['C', 'D', 'E']) row.getCell(col).numFmt = MONEY;
  }

  // --- Matched documents --------------------------------------------------
  const matched = workbook.addWorksheet('Eşleşen Belgeler');
  matched.columns = [
    { width: 22 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 },
    { width: 14 }, { width: 22 },
  ];
  headerRow(
    matched.addRow([
      t('table.docNo'),
      `${creditor.name} ${t('table.date')}`,
      `${debtor.name} ${t('table.date')}`,
      t('table.creditorAmount', { name: creditor.name }),
      t('table.debtorAmount', { name: debtor.name }),
      t('table.diff'),
      t('table.basis'),
    ]),
  );
  for (const pair of match.pairs) {
    const row = matched.addRow([
      pair.creditorEntry.docNo || pair.debtorEntry.docNo,
      formatDate(pair.creditorEntry.date, locale),
      formatDate(pair.debtorEntry.date, locale),
      pair.creditorClaim,
      pair.debtorClaim,
      pair.amountDifference,
      t(`basis.${pair.basis}`),
    ]);
    for (const col of ['D', 'E', 'F']) row.getCell(col).numFmt = MONEY;
  }

  // --- Ageing -------------------------------------------------------------
  const aging = workbook.addWorksheet('Yaşlandırma');
  aging.columns = [
    { width: 22 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 14 }, { width: 18 },
  ];
  headerRow(
    aging.addRow([
      t('table.docNo'),
      t('table.date'),
      t('table.dueDate'),
      t('table.amount'),
      'Kapanan',
      t('table.open'),
      t('table.daysOverdue'),
      t('table.bucket'),
    ]),
  );
  for (const invoice of allocation.invoices) {
    if (invoice.open <= 0.01) continue;
    const row = aging.addRow([
      invoice.entry.docNo,
      formatDate(invoice.entry.date, locale),
      invoice.dueDate === null ? '—' : formatDate(invoice.dueDate, locale),
      invoice.amount,
      invoice.paid,
      invoice.open,
      invoice.daysOverdue,
      t(`aging.${invoice.bucket}`),
    ]);
    for (const col of ['D', 'E', 'F']) row.getCell(col).numFmt = MONEY;
  }

  // --- Actions ------------------------------------------------------------
  const actionSheet = workbook.addWorksheet('Aksiyonlar');
  actionSheet.columns = [{ width: 12 }, { width: 24 }, { width: 18 }, { width: 100 }];
  headerRow(actionSheet.addRow(['Öncelik', 'Sorumlu', t('table.amount'), 'Aksiyon']));
  for (const action of actions) {
    const owner = action.ownerPartyId === creditor.id ? creditor.name : debtor.name;
    const row = actionSheet.addRow([
      t(`severity.${action.severity}`),
      owner,
      action.amount,
      t(action.messageKey, action.messageVars),
    ]);
    row.getCell('C').numFmt = MONEY;
    row.getCell('D').alignment = { wrapText: true, vertical: 'top' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
