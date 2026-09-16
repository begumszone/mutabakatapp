import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseXlsxBuffer, sheetToParsedFile } from '../src/adapters/parseFile';
import { suggestMapping } from '../src/adapters/suggestMapping';
import { buildStatement } from '../src/adapters/buildStatement';
import { claimOf } from '../src/core/claim';
import { parseAmount } from '../src/core/parseNumber';

const out: string[] = [];
const log = (...p: unknown[]) => out.push(p.map(String).join(' '));

const TARGETS: [string, number[]][] = [
  ['flo-magazacilik-ve-paz-a-s-erzurum-31-07', [0]],
  ['data-sonuc-tablosu', [0, 1, 2]],
  ['paros-ingage-sonuc-tablosu', [0, 1]],
  ['enuygun-sonuc-tablosu-ingage', [1]],
];

describe('dig', () => {
  it('opens up the sheets that did not reproduce their stated balance', async () => {
    for (const [name, indexes] of TARGETS) {
      const bytes = readFileSync(`sample-data/${name}.xlsx`);
      const wb = await parseXlsxBuffer(name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      log(`\n${'='.repeat(70)}\n${name}`);
      for (const i of indexes) {
        const sheet = wb.sheets[i];
        if (!sheet) { log(`  [${i}] YOK`); continue; }
        log(`\n  --- [${i}] "${sheet.name}" satır=${sheet.grid.length} başlık=${sheet.suggestedHeaderRow}`);
        log('  İLK 3 HAM SATIR:');
        sheet.grid.slice(0, Math.min(3, sheet.grid.length)).forEach((r, k) => {
          log(`    r${k}: ` + Array.from({ length: Math.min(r.length, 16) }, (_, c) => r[c] === null || r[c] === undefined ? '·' : String(r[c]).slice(0, 22)).join(' | '));
        });
        const parsed = sheetToParsedFile(wb, i, sheet.suggestedHeaderRow);
        log('  BAŞLIKLAR: ' + parsed.headers.slice(0, 16).join(' | '));
        const m = suggestMapping(parsed);
        log(`  EŞLEME: date=${m.date} due=${m.dueDate} doc=${m.docNo} layout=${m.amountLayout} debit=${m.debit} credit=${m.credit} amt=${m.amount} clear=${m.clearingDoc}`);
        const b = buildStatement(parsed, m);
        let bal = 0; for (const e of b.entries) bal += claimOf(e, b.suggestedPerspective);
        log(`  SONUÇ: n=${b.entries.length} tarihsiz=${b.skippedNoDate} footer=${b.skippedFooter} sıfır=${b.zeroAmount} bakiye=${Math.round(bal*100)/100}`);

        // If there is a clearing column, what do the open items come to?
        if (m.clearingDoc) {
          let open = 0, openRows = 0;
          for (const row of parsed.rows) {
            if (String(row[m.clearingDoc] ?? '').trim() !== '') continue;
            openRows++;
            open += parseAmount(row[m.amount ?? '']) ?? 0;
          }
          log(`  AÇIK KALEM: ${openRows} satır, toplam ${Math.round(open*100)/100}`);
        }
        log('  İLK 2 OKUNAN KAYIT: ' + JSON.stringify(b.entries.slice(0, 2)));
      }
    }
    writeFileSync('/tmp/claude-0/dig.txt', out.join('\n'));
  });
});
