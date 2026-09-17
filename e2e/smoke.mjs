/**
 * Smoke test against the built site, not the source.
 *
 * This exists because of a specific failure: four commits' worth of changes
 * were written, tested, screenshotted locally and pushed — to a branch the
 * deployment does not serve. The customer opened the live site, saw the old
 * app, and said nothing had changed. They were right.
 *
 * Unit tests could not have caught that; nothing about the source was wrong.
 * What was missing was a check on the artefact people actually open. So this
 * drives the built `dist/` the way a person does — uploads a real statement,
 * answers the questions, reads the result — and asserts both that the removed
 * things are gone and that the figures are the ones two finance departments
 * agreed by hand.
 *
 * Usage:
 *   npm run build
 *   npx vite preview --port 4199 &
 *   npm run smoke
 *
 * SMOKE_URL points it somewhere else — the deployed site, once that host is
 * reachable, which is the check that would have caught the failure above.
 *
 * It uses playwright-core, which ships no browsers, so CHROMIUM_PATH must
 * point at one. Kept out of `npm test` because it needs a running server and
 * a real customer file, and neither belongs in the repository.
 */

import { chromium } from 'playwright-core';
const fails = [];
const ok = [];
const check = (name, cond) => (cond ? ok : fails).push(name);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1380, height: 1200 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
const base = process.env.SMOKE_URL ?? 'http://localhost:4199/';
await page.goto(base, { waitUntil: 'networkidle' });

// Load a real multi-sheet file on both sides.
const inputs = page.locator('input[type=file]');
await inputs.nth(0).setInputFiles(process.env.SMOKE_FILE ?? 'sample-data/paros-ingage-sonuc-tablosu.xlsx');
await inputs.nth(1).setInputFiles(process.env.SMOKE_FILE ?? 'sample-data/paros-ingage-sonuc-tablosu.xlsx');
await page.waitForTimeout(1500);
const next = page.getByRole('button', { name: /Kolonları eşle|Devam|İleri/i });
if (await next.count()) { await next.first().click(); await page.waitForTimeout(600); }

// 1. It must ASK which sheet, and refuse to run until told.
const askText = (await page.locator('.ask').allInnerTexts()).join(' | ');
check('Hangi sayfa? sorusu çıkıyor', /Hangisini kullanalım/i.test(askText));
check('Seçim yapılmadan çalıştırılamıyor',
  await page.getByRole('button', { name: /Mutabakatı çalıştır/i }).isDisabled());

await page.locator('.sheet-choice', { hasText: 'PAROS' }).first().click();
await page.waitForTimeout(400);
await page.locator('.sheet-choice', { hasText: 'INGAGE' }).last().click();
await page.waitForTimeout(600);

// 2. The settings tab must no longer carry vade or the open-items switch.
await page.getByRole('button', { name: /Dönem ve mutabakat tarihi/i }).click();
await page.waitForTimeout(400);
const settings = await page.locator('section.card').first().innerText();
check('“Vade (gün)” kaldırılmış', !/Vade \(gün\)/i.test(settings));
check('“Sadece açık kalemler” kaldırılmış', !/açık kalemler/i.test(settings));
check('“Hangi tarih itibarıyla” sorusu var', /Hangi tarih itibarıyla/i.test(settings));
check('Yıl seçenekleri var', /Bu yıl/.test(settings) && /Son 3 yıl/.test(settings));

// The two date controls have to do what they say, not merely be present.
const asOfBox = page.locator('input[type=date]').nth(0);
const startBox = page.locator('input[type=date]').nth(1);
await asOfBox.fill('2026-06-30');
await page.waitForTimeout(300);
const starts = [];
for (const preset of ['Bu yıl', 'Son 2 yıl', 'Son 3 yıl']) {
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.waitForTimeout(250);
  starts.push(await startBox.inputValue());
}
check('Yıl seçenekleri başlangıcı gerçekten değiştiriyor',
  starts.join() === '2026-01-01,2025-01-01,2024-01-01');
check('İki seçenek aynı tarihi vermiyor', new Set(starts).size === starts.length);
check('Mutabakat tarihi seçeneklerden etkilenmiyor',
  (await asOfBox.inputValue()) === '2026-06-30');
await page.getByRole('button', { name: 'Bu yıl', exact: true }).click();
await page.waitForTimeout(250);

await page.getByRole('button', { name: /Mutabakatı çalıştır/i }).click();
await page.waitForTimeout(1200);

// 3. The result must be dated, decomposed, and numerically right.
const table = await page.locator('.card table').first().innerText();
check('Satır başlığı “30.06.2026 Bakiyesi”', /30\.06\.2026 Bakiyesi/.test(table));
check('“Bugünkü Bakiye” yazmıyor', !/Bugünkü Bakiye/.test(table));
check('Devir satırı tarihli (31.12.2025)', /31\.12\.2025 Devir/.test(table));
check('PAROS bakiyesi 145.412,70', /145\.412,70/.test(table));
check('INGAGE bakiyesi 139.883,70', /139\.883,70/.test(table));
check('Fark 5.529,00', /5\.529,00/.test(table));

const tabs = await page.locator('.tabs').last().innerText();
check('Yaşlandırma sekmesi yok', !/aşlandırma/i.test(tabs));

const derive = await page.locator('.derivation').innerText().catch(() => '');
check('“Fark nasıl bulundu?” bölümü var', /Fark nasıl bulundu/.test(derive));
check('Devirden gelen fark −99.522,00 yazıyor', /-99\.522,00/.test(derive));
check('Eksik kayıt 105.051,00 yazıyor', /105\.051,00/.test(derive));
check('Devir uyarısı çıkıyor', /önceki dönem kapatılmadan/.test(derive));

const buttons = (await page.locator('button').allInnerTexts()).join(' | ');
check('“Ayarlara dön” tuşu var', /Ayarlara dön/.test(buttons));

await page.screenshot({ path: process.env.SMOKE_SHOT ?? 'smoke-result.png', fullPage: true });
console.log('GEÇEN (' + ok.length + '):');
for (const o of ok) console.log('  ✓ ' + o);
console.log('KALAN (' + fails.length + '):');
for (const f of fails) console.log('  ✗ ' + f);
console.log('JS HATASI:', errs.join(' | ') || 'yok');
await browser.close();
process.exit(fails.length === 0 && errs.length === 0 ? 0 : 1);
