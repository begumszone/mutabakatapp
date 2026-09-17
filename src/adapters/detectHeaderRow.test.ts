import { describe, expect, it } from 'vitest';
import { detectHeaderRowIndex, NO_HEADER_ROW, type Cell } from './detectHeaderRow';

describe('detectHeaderRowIndex', () => {
  it('finds the header under a report preamble', () => {
    const grid: Cell[][] = [
      ['ACME Ltd — Cari Hesap Ekstresi', null, null],
      ['01.01.2026 - 30.06.2026', null, null],
      ['Tarih', 'Evrak No', 'Borç'],
      ['01.02.2026', 'FT-1', 100],
    ];
    expect(detectHeaderRowIndex(grid)).toBe(2);
  });

  it('reports no header when the export starts straight at the data', () => {
    // A real SAP extract: no column names, just rows. Scoring row 0 as the
    // header turned "1700000068" into a column name and silently dropped
    // that payment from the ledger.
    const grid: Cell[][] = [
      ['10306264', 'KONSENSUS TURIZM', 'KA', '1700000068', '2026-05-11', -40000, 'TRY'],
      ['10306264', 'KONSENSUS TURIZM', 'ZP', '2000000372', '2026-05-12', 40000, 'TRY'],
      ['10306264', 'KONSENSUS TURIZM', 'KA', '1700000080', '2026-05-13', -190750, 'TRY'],
    ];
    expect(detectHeaderRowIndex(grid)).toBe(NO_HEADER_ROW);
  });

  it('never reads a row holding a date as column names', () => {
    const grid: Cell[][] = [
      ['12.01.2026', 'Alış Faturası', 'AB1', 33657.62],
      ['13.01.2026', 'Alış Faturası', 'AB2', 12869.78],
    ];
    expect(detectHeaderRowIndex(grid)).toBe(NO_HEADER_ROW);
  });

  it('still prefers the header over a merged banner above it', () => {
    const grid: Cell[][] = [
      ['RAPOR', 'RAPOR', 'RAPOR', 'RAPOR'],
      ['Tarih', 'Açıklama', 'Borç', 'Alacak'],
      ['01.02.2026', 'Fatura', 100, null],
    ];
    expect(detectHeaderRowIndex(grid)).toBe(1);
  });
});
