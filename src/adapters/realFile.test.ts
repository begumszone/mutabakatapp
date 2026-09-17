import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseXlsxBuffer, sheetToParsedFile } from './parseFile';
import { suggestMapping } from './suggestMapping';
import { buildStatement } from './buildStatement';
import { statementBalance } from '../core/claim';
import { parseAmount } from '../core/parseNumber';
import { reconcilePair } from '../core/reconcilePair';
import type { Party, ReconciliationSettings, Statement } from '../types';

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
        statedPeriod: null,
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

  it('reconciles the two ledgers to the figures the two firms signed off', async () => {
    const workbook = await loadWorkbook();

    const build = (sheetIndex: number, headerRow: number) => {
      const parsed = sheetToParsedFile(workbook, sheetIndex, headerRow);
      const mapping = suggestMapping(parsed);
      return { parsed, mapping, result: buildStatement(parsed, mapping) };
    };

    const air = build(0, 0);
    const akvatek = build(3, 4);

    // The SAP sheet is the one that says which of its lines are closed.
    expect(air.mapping.clearingDoc).toBe('Clearing Document');

    const statement = (
      id: string,
      entries: Statement['entries'],
      perspective: Statement['perspective'],
    ): Statement => ({
      id,
      fileName: id,
      ownerPartyId: id,
      counterpartyPartyId: id === 'a' ? 'b' : 'a',
      perspective,
      currency: 'TRY',
      entries,
      statedPeriod: null,
    });

    const settings: ReconciliationSettings = {
      amountTolerance: 0.01,
      dayTolerance: 7,
      allowDateAmountFallback: true,
      requestedPeriod: null,
      asOfDate: '2026-08-31',
    };

    const airLiquide: Party = { id: 'a', name: 'AİR LIQUIDE', taxId: null };
    const akvatekSu: Party = { id: 'b', name: 'AKVATEK SU', taxId: null };

    const result = reconcilePair(
      airLiquide,
      akvatekSu,
      statement('a', air.result.entries, 'receivable'),
      statement('b', akvatek.result.entries, akvatek.result.suggestedPerspective),
      settings,
    );

    // What the two ledgers say when each is summed to the same date.
    //
    // These are not the figures the two firms signed. AİR's export is a SAP
    // open-item list: it carries payments settling invoices raised before it
    // begins, so its rows add up to 30.467,42 while the balance both firms
    // agreed is 501.717,37 — the sum of the rows SAP has not cleared. Summing
    // such an extract is arithmetic on an incomplete ledger, so the engine
    // says so rather than presenting the total as a balance.
    expect(result.bridge.creditorBalance).toBe(30467.42);
    expect(result.bridge.debtorBalance).toBe(486418.22);

    // The eight documents both sides carry still line up, and the one
    // genuine disagreement is still found: a kuruş on one invoice, which is
    // the unexplained "-0,01" in the firms' own hand-made SONUÇ TABLOSU.
    const mismatches = result.match.pairs.filter((pair) => Math.abs(pair.amountDifference) >= 0.005);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].creditorEntry.docNo).toBe('AL42026000005577');
    expect(mismatches[0].amountDifference).toBe(0.01);

    // The customer's devir is reported on its own row: it is the settled
    // history in one figure, and a gap against the other side's opening is
    // what sends somebody to ask for the earlier statement.
    expect(result.bridge.debtorOpening).toBe(443353.36);

    // The customer's ledger begins on 1 January and says so with a devir, so
    // the supplier's 2025-dated rows sit before the window both sides can
    // speak to.
    expect(result.period.common?.start).toBe('2026-01-01');

    // And the extract is called what it is, so nobody signs its total.
    expect(result.actions.some((a) => a.category === 'incompleteExtract')).toBe(true);
  });
});
