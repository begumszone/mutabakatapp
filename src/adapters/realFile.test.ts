import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseXlsxBuffer, sheetToParsedFile } from './parseFile';
import { suggestMapping } from './suggestMapping';
import { buildStatement } from './buildStatement';
import { statementBalance } from '../core/claim';
import { parseAmount } from '../core/parseNumber';

/**
 * Regression test against a real customer export.
 *
 * Synthetic fixtures only prove the engine agrees with the fixture's author.
 * This one is a genuine AİR LIQUIDE / AKVATEK reconciliation, complete with
 * its hand-prepared SONUÇ TABLOSU, so the figures below are what two finance
 * departments actually agreed — the strongest check available that the
 * ingestion path reads these files the way a person does.
 *
 * The file itself is not in the repository: it is a counterparty's ledger,
 * and publishing it is the account owner's decision, not this test's. Drop it
 * at sample-data/akvatek.xlsx to run these; they skip when it is absent.
 */
const FIXTURE = fileURLToPath(new URL('../../sample-data/akvatek.xlsx', import.meta.url));
const available = existsSync(FIXTURE);

async function loadWorkbook() {
  const bytes = readFileSync(FIXTURE);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return parseXlsxBuffer('akvatek.xlsx', buffer);
}

describe.skipIf(!available)('a real AİR LIQUIDE / AKVATEK export', () => {
  it('finds the header row under the report preamble on every sheet', async () => {
    const workbook = await loadWorkbook();
    const names = workbook.sheets.map((sheet) => sheet.name);
    expect(names).toEqual(['AİR', 'SONUÇ TABLOSU', 'AKVATEK', 'AKVATEK1']);
    // The Logo sheets carry a cari code, an address and a tax number above
    // their headers; row 0 would make "AKVATEK1 Cari Kod" the column names.
    expect(workbook.sheets[3].suggestedHeaderRow).toBe(4);
    expect(workbook.sheets[2].suggestedHeaderRow).toBe(5);
  });

  it('reads the customer’s lira ledger to the exact balance the two firms agreed', async () => {
    const workbook = await loadWorkbook();
    const sheet = workbook.sheets[3];
    const parsed = sheetToParsedFile(workbook, 3, sheet.suggestedHeaderRow);
    const mapping = suggestMapping(parsed);

    // Guessed with no help: the borç/alacak pair, not the running balances
    // sitting next to them, and vade rather than the posting date.
    expect(mapping.debit).toBe('Borç Tut.');
    expect(mapping.credit).toBe('Alac.Tut.');
    expect(mapping.date).toBe('Tarih');
    expect(mapping.dueDate).toBe('Vade Tarihi');
    expect(mapping.docNo).toBe('Fiş No');

    const build = buildStatement(parsed, mapping);
    expect(build.suggestedPerspective).toBe('payable');
    expect(
      statementBalance({
        id: 'b',
        fileName: 'akvatek',
        ownerPartyId: 'b',
        counterpartyPartyId: 'a',
        perspective: build.suggestedPerspective,
        currency: 'TRY',
        entries: build.entries,
      }),
    ).toBe(486418.22);

    // The DEVIR line is carried as an opening, and the two "Toplam" footers
    // are dropped — keeping either would add the whole statement to itself.
    const openings = build.entries.filter((entry) => entry.docType === 'opening');
    expect(openings).toHaveLength(1);
    expect(openings[0].credit).toBe(443353.36);
    expect(build.entries.some((entry) => /toplam/i.test(entry.description))).toBe(false);
  });

  it('maps the SAP sheet onto the reference, not the internal document number', async () => {
    const workbook = await loadWorkbook();
    const parsed = sheetToParsedFile(workbook, 0, 0);
    const mapping = suggestMapping(parsed);
    // "Reference" holds the invoice number the customer also books;
    // "Document Number" is SAP's own and matches nothing on the other side.
    expect(mapping.docNo).toBe('Reference');
    expect(mapping.docNoAlt).toBe('Document Number');
    expect(mapping.amountLayout).toBe('signed');
    expect(mapping.amount).toBe('Amount in local currency');
  });

  it('shows that the supplier’s balance is its open items, not its whole extract', async () => {
    const workbook = await loadWorkbook();
    const parsed = sheetToParsedFile(workbook, 0, 0);

    let all = 0;
    let open = 0;
    for (const row of parsed.rows) {
      const amount = parseAmount(row['Amount in local currency']) ?? 0;
      all += amount;
      if (String(row['Clearing Document'] ?? '').trim() === '') open += amount;
    }

    // This is the finding that decides how such an extract must be read: the
    // 501.717,37 the two firms reconciled to is the sum of the rows SAP has
    // not cleared, while every row added together comes to something else
    // entirely, because the extract carries payments for invoices raised
    // before it begins.
    expect(Math.round(open * 100) / 100).toBe(501717.37);
    expect(Math.round(all * 100) / 100).toBe(30467.42);
  });
});
