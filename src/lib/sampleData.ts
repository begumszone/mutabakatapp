import type { ParsedFile } from '../types';

/**
 * A worked example of the situation this app exists for: ABC invoices Begüm
 * on 30-day terms, Begüm settles batches of invoices with single round
 * transfers, and the two ledgers drift apart in the three ways these
 * accounts always drift — a record one side never booked, an invoice in
 * euros booked at two different rates, and an invoice that has simply gone
 * unpaid past its vade.
 *
 * The two sides are deliberately written in different house styles: ABC's
 * ERP exports one signed amount column with English headers, Begüm's exports
 * a Turkish borç/alacak pair with a devir line and a totals footer. That is
 * what the real files look like, so the sample exercises the same mapping
 * and matching path a real upload does rather than a tidied-up version of it.
 */
export function sampleFiles(): { creditor: ParsedFile; debtor: ParsedFile } {
  const creditorRows = [
    ['01.01.2026', '', 'Devir', 'DEVIR', 125000, ''],
    ['05.01.2026', '12.02.2026', 'ABC2026000000101', 'Hizmet bedeli - Ocak', 48000, 'TRY'],
    ['18.01.2026', '17.02.2026', 'ABC2026000000102', 'Hizmet bedeli - Ocak', 62500, 'TRY'],
    ['02.02.2026', '04.03.2026', 'ABC2026000000103', 'Danışmanlık - Şubat', 51750, 'TRY'],
    ['10.02.2026', '12.03.2026', 'ABC2026000000104', 'Hizmet bedeli - Şubat', 39900, 'TRY'],
    ['15.02.2026', '', 'BN1201', 'Gelen havale', -235500, 'TRY'],
    ['03.03.2026', '02.04.2026', 'ABC2026000000105', 'Bakım sözleşmesi (EUR)', 106240, 'TRY'],
    ['12.03.2026', '11.04.2026', 'ABC2026000000106', 'Hizmet bedeli - Mart', 57300, 'TRY'],
    ['20.03.2026', '', 'BN1288', 'Gelen havale', -145000, 'TRY'],
    ['02.04.2026', '02.05.2026', 'ABC2026000000107', 'Hizmet bedeli - Nisan', 44150, 'TRY'],
    ['28.04.2026', '28.05.2026', 'ABC2026000000108', 'Ek iş kalemi', 18900, 'TRY'],
  ];

  const creditor: ParsedFile = {
    fileName: 'ABC-Limited-cari-ekstre.xlsx',
    sheetName: 'ABC',
    headers: ['Document Date', 'Due Date', 'Reference', 'Text', 'Amount in local currency', 'Local Currency'],
    rows: creditorRows.map((row) => ({
      'Document Date': row[0] as string,
      'Due Date': (row[1] as string) || null,
      Reference: row[2] as string,
      Text: row[3] as string,
      'Amount in local currency': row[4] as number,
      'Local Currency': (row[5] as string) || null,
    })),
  };

  // Begüm's copy of the same relationship, mirrored: an invoice is an alacak.
  // Invoice 107 was never booked, and 105 was converted at 53,12 rather than
  // 54,50, so the same euro invoice carries a different lira figure.
  const debtorRows: [string, string, string, string, number, number][] = [
    ['01.01.2026', '01.01.2026', '', 'DEVIR', 0, 125000],
    ['05.01.2026', '12.02.2026', 'ABC202600000101', 'FATURANIZ', 0, 48000],
    ['18.01.2026', '17.02.2026', 'ABC202600000102', 'FATURANIZ', 0, 62500],
    ['02.02.2026', '04.03.2026', 'ABC202600000103', 'FATURANIZ', 0, 51750],
    ['10.02.2026', '12.03.2026', 'ABC202600000104', 'FATURANIZ', 0, 39900],
    ['15.02.2026', '15.02.2026', 'BN/1201', 'ZİRAAT ABC HS EFT', 235500, 0],
    ['03.03.2026', '02.04.2026', 'ABC202600000105', 'FATURANIZ', 0, 103548.8],
    ['12.03.2026', '11.04.2026', 'ABC202600000106', 'FATURANIZ', 0, 57300],
    ['20.03.2026', '20.03.2026', 'BN/1288', 'ZİRAAT ABC HS EFT', 145000, 0],
    ['28.04.2026', '28.05.2026', 'ABC202600000108', 'FATURANIZ', 0, 18900],
  ];

  const debtor: ParsedFile = {
    fileName: 'Begum-Teknoloji-cari-ekstre.xlsx',
    sheetName: 'ABC CARİ',
    headers: ['Tarih', 'Vade Tarihi', 'Fiş No', 'Açıklama', 'Borç Tut.', 'Alac.Tut.'],
    rows: debtorRows.map((row) => ({
      Tarih: row[0],
      'Vade Tarihi': row[1],
      'Fiş No': row[2],
      Açıklama: row[3],
      'Borç Tut.': row[4],
      'Alac.Tut.': row[5],
    })),
  };

  return { creditor, debtor };
}
