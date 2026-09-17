import { describe, expect, it } from 'vitest';
import { inferColumns, looksHeaderless } from './inferColumns';
import type { ParsedFile, RawRow } from '../types';

function file(headers: string[], rows: (string | number | null)[][]): ParsedFile {
  return {
    fileName: 'x.xlsx',
    sheetName: 'Sheet1',
    headers,
    rows: rows.map((row) => {
      const obj: RawRow = {};
      headers.forEach((h, i) => (obj[h] = row[i] ?? null));
      return obj;
    }),
  };
}

const UNNAMED = ['Column A', 'Column B', 'Column C', 'Column D', 'Column E'];

describe('looksHeaderless', () => {
  it('knows a sheet whose columns were never named', () => {
    expect(looksHeaderless(file(UNNAMED, [['a', 1, 2, 3, 4]]))).toBe(true);
  });

  it('leaves a properly labelled sheet alone', () => {
    expect(looksHeaderless(file(['Tarih', 'Evrak No', 'Borç', 'Alacak'], [[1, 2, 3, 4]]))).toBe(false);
  });
});

describe('inferColumns', () => {
  it('reads a signed SAP-shaped extract with no headers', () => {
    // date, doc no, signed amount, currency.
    const rows = [
      ['2026-01-01', 'AL72026000000126', 13018.52, 'TRY', 'x'],
      ['2026-01-14', 'TEB01TRY0126115', -37240.52, 'TRY', 'x'],
      ['2026-01-26', 'TEB01TRY0126127', -9942.87, 'TRY', 'x'],
      ['2026-01-31', 'AL52026000000290', 63349.4, 'TRY', 'x'],
      ['2026-02-02', 'TEB01TRY0126203', -49020.45, 'TRY', 'x'],
    ];
    const result = inferColumns(file(UNNAMED, rows));
    expect(result.mapping.date).toBe('Column A');
    expect(result.mapping.docNo).toBe('Column B');
    expect(result.mapping.amountLayout).toBe('signed');
    expect(result.mapping.amount).toBe('Column C');
    expect(result.ambiguousMoneyColumns).toEqual([]);
  });

  it('refuses to guess between borç, alacak and bakiye, and says which is the balance', () => {
    // The mistake this exists to prevent: three money columns, one of which is
    // the running balance. Summing the balance produces a confident wrong
    // answer, so the app has to ask rather than pick.
    const rows = [
      ['2026-01-01', 'FT-1', 1000, 0, 1000],
      ['2026-01-05', 'FT-2', 500.5, 0, 1500.5],
      ['2026-01-09', 'TH-1', 0, 400.25, 1100.25],
      ['2026-01-15', 'FT-3', 250.75, 0, 1351],
      ['2026-01-20', 'TH-2', 0, 351, 1000],
      ['2026-01-28', 'FT-4', 120.4, 0, 1120.4],
    ];
    const result = inferColumns(file(UNNAMED, rows));
    expect(result.balanceColumns).toContain('Column E');
    expect(result.ambiguousMoneyColumns.sort()).toEqual(['Column C', 'Column D']);
    // Nothing is assigned, so validateMapping blocks the run.
    expect(result.mapping.debit).toBeNull();
    expect(result.mapping.credit).toBeNull();
    expect(result.mapping.amount).toBeNull();
    expect(result.mapping.date).toBe('Column A');
  });

  it('prefers the invoice reference over the ERP’s own document number', () => {
    // A SAP extract carries both. Only the reference exists in the
    // counterparty's books, so matching on the internal number matches
    // nothing -- which is how a file whose amounts agree line for line comes
    // back with a thousand unmatched records.
    const headers = ['Column A', 'Column B', 'Column C', 'Column D', 'Column E'];
    const rows = [
      ['2026-04-13', '1400000243', 'AB12026000007057', -209907.21, 'NONREF 11114020 BOGAZICI'],
      ['2026-04-20', '1400000300', 'AB12026000003265', -37875.02, 'NONREF 1890001870 BOGAZICI'],
      ['2026-05-14', '1400008007', 'AB12026000021770', -18937.51, 'NONREF 1890004530 BOGAZICI'],
      ['2026-05-13', '1400008029', 'AB12026000007058', 16559.4, 'NONREF 1890004529 BOGAZICI'],
      ['2026-05-12', '1400008030', 'AB12026000012895', 21763.37, 'NONREF 1890004531 BOGAZICI'],
    ];
    const result = inferColumns(file(headers, rows));
    expect(result.mapping.docNo).toBe('Column C');
    expect(result.mapping.docNoAlt).toBe('Column B');
    expect(result.mapping.amount).toBe('Column D');
  });

  it('does not mistake a running balance for the movement in a signed sheet', () => {
    const rows = [
      ['2026-01-01', 'FT-1', 1000.5, 1000.5],
      ['2026-01-05', 'FT-2', -400.25, 600.25],
      ['2026-01-09', 'FT-3', 250.75, 851],
      ['2026-01-15', 'FT-4', -51.5, 799.5],
      ['2026-01-20', 'FT-5', 200.25, 999.75],
    ];
    const result = inferColumns(file(['Column A', 'Column B', 'Column C', 'Column D'], rows));
    expect(result.balanceColumns).toEqual(['Column D']);
    expect(result.mapping.amount).toBe('Column C');
  });
});
