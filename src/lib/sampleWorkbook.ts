import ExcelJS from 'exceljs';
import { sampleFiles } from './sampleData';

/**
 * Builds a downloadable cari hesap ekstresi for one side of the sample.
 *
 * The point is to show what the app expects, so this is not a tidy export of
 * the app's own data model — it is written the way a Logo or Mikro ekstre
 * actually arrives: a header block naming the firm whose books these are,
 * the counterparty, that firm's account code and tax number and the period
 * covered, then five rows of junk-free columns underneath, then a Genel
 * Toplam footer. Somebody opening it should recognise their own export, and
 * dropping it straight back into the app should work without a single
 * correction — including the parts the app reads out of the header block.
 */
export type SampleSide = 'creditor' | 'debtor';

interface SampleMeta {
  owner: string;
  counterparty: string;
  accountCode: string;
  taxId: string;
  fileName: string;
  sheetName: string;
}

const META: Record<SampleSide, SampleMeta> = {
  creditor: {
    owner: 'ABC LİMİTED ŞİRKETİ',
    counterparty: 'BEGÜM TEKNOLOJİ ANONİM ŞİRKETİ',
    accountCode: '120-01-0042',
    taxId: '4560123789',
    fileName: 'ornek-ekstre-ABC-Limited.xlsx',
    sheetName: 'BEGÜM TEKNOLOJİ',
  },
  debtor: {
    owner: 'BEGÜM TEKNOLOJİ ANONİM ŞİRKETİ',
    counterparty: 'ABC LİMİTED ŞİRKETİ',
    accountCode: '320-01-0017',
    taxId: '1230456789',
    fileName: 'ornek-ekstre-Begum-Teknoloji.xlsx',
    sheetName: 'ABC LİMİTED',
  },
};

const MONEY = '#,##0.00';

export function sampleWorkbookName(side: SampleSide): string {
  return META[side].fileName;
}

export async function buildSampleWorkbook(side: SampleSide): Promise<Blob> {
  const meta = META[side];
  const source = side === 'creditor' ? sampleFiles().creditor : sampleFiles().debtor;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MutabakatAPP';
  const sheet = workbook.addWorksheet(meta.sheetName);
  sheet.columns = [
    { width: 13 }, { width: 13 }, { width: 22 }, { width: 34 }, { width: 16 }, { width: 16 },
  ];

  // The header block, exactly where a real export puts it.
  sheet.addRow([meta.owner, '', '', `Cari Hesap Ekstresi  ( 01.01.2026 - 30.06.2026 )`]);
  sheet.addRow(['Cari Kod', meta.accountCode, meta.counterparty]);
  sheet.addRow(['Tel :0 212 000 00 00']);
  sheet.addRow(['MASLAK MAH. BÜYÜKDERE CAD. NO:100 K:5 SARIYER İSTANBUL']);
  sheet.addRow([`V.No: ${meta.taxId} V.Dairesi: BOĞAZİÇİ KURUMLAR`]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };

  const header = sheet.addRow([
    'Tarih', 'Vade Tarihi', 'Fiş No', 'Açıklama', 'Borç Tut.', 'Alac.Tut.',
  ]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE7D6' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF7A2733' } } };
  });

  let debitTotal = 0;
  let creditTotal = 0;

  for (const row of source.rows) {
    // The sample's two sides are written in different house styles; both are
    // republished here in the Turkish borç/alacak shape, since that is the
    // one somebody is most likely to be holding.
    const date = String(row[source.headers[0]] ?? '');
    const due = String(row[source.headers[1]] ?? '');
    const docNo = String(row[source.headers[2]] ?? '');
    const description = String(row[source.headers[3]] ?? '');
    const raw = row[source.headers[4]];
    const second = row[source.headers[5]];

    let debit = 0;
    let credit = 0;
    if (side === 'creditor') {
      const signed = typeof raw === 'number' ? raw : 0;
      if (signed >= 0) debit = signed;
      else credit = -signed;
    } else {
      debit = typeof raw === 'number' ? raw : 0;
      credit = typeof second === 'number' ? second : 0;
    }
    debitTotal += debit;
    creditTotal += credit;

    const line = sheet.addRow([
      date,
      due || '',
      docNo,
      description,
      debit || null,
      credit || null,
    ]);
    line.getCell(5).numFmt = MONEY;
    line.getCell(6).numFmt = MONEY;
  }

  sheet.addRow([]);
  const footer = sheet.addRow(['', '', '', 'Genel Toplam', debitTotal, creditTotal]);
  footer.font = { bold: true };
  footer.getCell(5).numFmt = MONEY;
  footer.getCell(6).numFmt = MONEY;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
