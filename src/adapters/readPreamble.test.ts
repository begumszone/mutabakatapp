import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Cell } from '../types';
import { readPreamble } from './readPreamble';
import { parseXlsxBuffer } from './parseFile';

const FIXTURE = fileURLToPath(new URL('../../sample-data/akvatek.xlsx', import.meta.url));

describe('reading what an ekstre says about itself', () => {
  it('pulls the firms, the account code, the tax number and the period', () => {
    // A Logo export, merged cells and all: every value repeats across the
    // columns its cell spans.
    const grid: Cell[][] = [
      ['AKVATEK SU ÜRÜNLERİ TURİZM SAN. VE TİC.', 'AKVATEK SU ÜRÜNLERİ TURİZM SAN. VE TİC.',
       'Dövizli Hareket Dökümü  ( 01.01.2026 - 31.08.2026 )', 'Dövizli Hareket Dökümü  ( 01.01.2026 - 31.08.2026 )'],
      ['Cari Kod', '320-03-01-403', 'AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.', 'AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.'],
      ['Tel :0 850 4602587', 'Tel :0 850 4602587'],
      ['REŞİTPAŞA MAH.ESKİ BÜYÜKDERE CAD.PARK PLAZA NO:14 D:8 SARIYER İSTANBUL'],
      ['V.No: 0100420227 V.Dairesi: YENİKAPI'],
      ['Tarih', 'Fiş No', 'Açıklama', 'Vade Tarihi'],
    ];

    const preamble = readPreamble(grid, 5);
    expect(preamble.ownerName).toBe('AKVATEK SU ÜRÜNLERİ TURİZM SAN. VE TİC.');
    expect(preamble.counterpartyName).toBe('AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.');
    expect(preamble.counterpartyCode).toBe('320-03-01-403');
    expect(preamble.counterpartyTaxId).toBe('0100420227');
    expect(preamble.periodStart).toBe('2026-01-01');
    expect(preamble.periodEnd).toBe('2026-08-31');
  });

  it('drops a tax number the export truncated rather than half-trusting it', () => {
    // This cell really comes out of Logo like this: the number runs into the
    // next field and loses digits. Filing a reconciliation under a half tax
    // number would attach it to the wrong counterparty.
    const grid: Cell[][] = [
      ['Cari Kod', '320-01-01-403', 'AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.'],
      ['V.No: 010042V.Dairesi: YENİKAPI'],
      ['Tarih', 'Fiş No'],
    ];
    const preamble = readPreamble(grid, 2);
    expect(preamble.counterpartyTaxId).toBeNull();
    expect(preamble.counterpartyName).toBe('AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.');
  });

  it('never mistakes a phone number, an address or a label for a company', () => {
    const grid: Cell[][] = [
      ['Tel :0 850 4602587'],
      ['REŞİTPAŞA MAH.ESKİ BÜYÜKDERE CAD.PARK PLAZA NO:14 D:8 SARIYER İSTANBUL'],
      ['Sayfa 1'],
      ['Tarih', 'Fiş No'],
    ];
    const preamble = readPreamble(grid, 3);
    expect(preamble.ownerName).toBeNull();
    expect(preamble.counterpartyName).toBeNull();
  });

  it('returns nothing at all for an export with no preamble', () => {
    const preamble = readPreamble([['Tarih', 'Fiş No']], 0);
    expect(preamble.periodStart).toBeNull();
    expect(preamble.ownerName).toBeNull();
  });
});

describe.skipIf(!existsSync(FIXTURE))('against the real AKVATEK export', () => {
  it('reads both ledger sheets without being told anything', async () => {
    const bytes = readFileSync(FIXTURE);
    const workbook = await parseXlsxBuffer(
      'akvatek.xlsx',
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );

    const lira = workbook.sheets[3];
    const liraPreamble = readPreamble(lira.grid, lira.suggestedHeaderRow);
    expect(liraPreamble.counterpartyName).toBe('AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.');
    expect(liraPreamble.counterpartyCode).toBe('320-01-01-403');

    const euro = workbook.sheets[2];
    const euroPreamble = readPreamble(euro.grid, euro.suggestedHeaderRow);
    expect(euroPreamble.ownerName).toBe('AKVATEK SU ÜRÜNLERİ TURİZM SAN. VE TİC.');
    expect(euroPreamble.counterpartyName).toBe('AİR LİQUİDE GAZ SAN.VE TİC.A.Ş.');
    expect(euroPreamble.counterpartyTaxId).toBe('0100420227');
    // The period the two sides have to be compared over, stated by the file.
    expect(euroPreamble.periodStart).toBe('2026-01-01');
    expect(euroPreamble.periodEnd).toBe('2026-08-31');
  });
});

describe('labels that are not firms', () => {
  it('does not read a field label as the counterparty', () => {
    // A real export prints "Alt Hesap Adı :" with the value in another cell,
    // and the label was being taken for the firm.
    const preamble = readPreamble(
      [['Cari Kod', '320-01-001', 'Alt Hesap Adı :'], ['Tarih', 'Borç']],
      1,
    );
    expect(preamble.counterpartyName).toBeNull();
    expect(preamble.counterpartyCode).toBe('320-01-001');
  });
});
