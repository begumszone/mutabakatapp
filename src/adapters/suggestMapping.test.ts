import { describe, expect, it } from 'vitest';
import type { ParsedFile, RawRow } from '../types';
import { suggestMapping } from './suggestMapping';

function file(headers: string[], rows: RawRow[]): ParsedFile {
  return { fileName: 'x.xlsx', sheetName: 'Sheet1', headers, rows };
}

/**
 * Each of these is a column the guesser got wrong on a real customer export
 * before it was fixed. A wrong guess here is not a small error — it produces
 * a confident, wrong reconciliation — so they are pinned individually.
 */
describe('guessing columns from real export headers', () => {
  it('prefers the reference the counterparty books over SAP’s composite key', () => {
    // Both headers score on the word they share; "Referans anahtar" is an
    // internal composite that matches nothing on the other side.
    const mapping = suggestMapping(
      file(
        ['Belge tarihi', 'Referans anahtar', 'Referans', 'UP cinsinden tutar'],
        [
          {
            'Belge tarihi': '21.04.2022',
            'Referans anahtar': '370000146910112022',
            Referans: 'ERP2022000000588',
            'UP cinsinden tutar': -37239.99,
          },
        ],
      ),
    );
    expect(mapping.docNo).toBe('Referans');
    expect(mapping.docNoAlt).toBe('Referans anahtar');
  });

  it('recognises the Turkish SAP wording for a clearing document', () => {
    const mapping = suggestMapping(
      file(
        ['Belge tarihi', 'Denkleştirme belgesi', 'UP cinsinden tutar'],
        [{ 'Belge tarihi': '21.04.2022', 'Denkleştirme belgesi': '9100001234', 'UP cinsinden tutar': 100 }],
      ),
    );
    expect(mapping.clearingDoc).toBe('Denkleştirme belgesi');
  });

  it('does not let the "tür" exclusion swallow a column called Fatura', () => {
    // "Evrak Türü" is a type and must be excluded; "Fatura" merely contains
    // those three letters and is the column we are after.
    const mapping = suggestMapping(
      file(
        ['Deftere nakil tarihi', 'Fatura', 'Belge tipi', 'Borç', 'Alacak'],
        [
          {
            'Deftere nakil tarihi': '30.01.2023',
            Fatura: 'RBA2022000000089',
            'Belge tipi': 'RV',
            Borç: 111.35,
            Alacak: 0,
          },
        ],
      ),
    );
    expect(mapping.docNo).toBe('Fatura');
  });

  it('never mistakes a running balance for the debit column', () => {
    // A Logo ekstre puts "Borç Bak." next to "Borç Tut."; taking the balance
    // would double every figure in the reconciliation.
    const mapping = suggestMapping(
      file(
        ['Tarih', 'Fiş No', 'Borç Tut.', 'Alac.Tut.', 'Borç Bak.', 'Alacak Bak.'],
        [
          {
            Tarih: '05.01.2026',
            'Fiş No': 'AL6202600000024',
            'Borç Tut.': 0,
            'Alac.Tut.': 61757.75,
            'Borç Bak.': 0,
            'Alacak Bak.': 505111.11,
          },
        ],
      ),
    );
    expect(mapping.debit).toBe('Borç Tut.');
    expect(mapping.credit).toBe('Alac.Tut.');
    expect(mapping.amountLayout).toBe('debitCredit');
  });
});
