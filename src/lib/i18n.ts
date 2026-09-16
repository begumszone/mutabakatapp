import type { Locale } from '../types';

type Dict = Record<string, string>;

/**
 * Turkish is the source language here, not a translation of an English app.
 * The result screen deliberately reuses the exact wording of the "SONUÇ
 * TABLOSU" both finance departments already sign off on — "Bugünkü Bakiye",
 * "Eksik Kayıt Toplamı", "MUTABAKAT SAĞLANDI" — so nobody has to learn a new
 * vocabulary to check the app against the spreadsheet it replaces.
 */
const tr: Dict = {
  'app.title': 'Mutabakat',
  'app.subtitle': 'İki firmanın cari hesap ekstrelerini karşılaştırır, farkları ve alınacak aksiyonları çıkarır.',
  'app.privacy': 'Dosyalarınız tarayıcınızdan çıkmaz. Hiçbir veri sunucuya yüklenmez.',

  'step.upload': 'Ekstreleri yükle',
  'step.map': 'Kolonları eşle',
  'step.result': 'Mutabakat sonucu',

  'upload.creditor': 'A firması — alacaklı taraf',
  'upload.creditorHint': 'Hizmeti veren / faturayı kesen firma. Örn. ABC Limited.',
  'upload.debtor': 'B firması — borçlu taraf',
  'upload.debtorHint': 'Hizmeti alan / ödemeyi yapan firma. Örn. Begüm Teknoloji.',
  'upload.drop': 'Dosyayı buraya sürükleyin veya seçin',
  'upload.formats': '.xlsx, .xlsm veya .csv',
  'upload.partyName': 'Firma adı',
  'upload.continue': 'Devam et',
  'upload.sample': 'Örnek veriyle dene',
  'upload.bothNeeded': 'Mutabakat için iki tarafın da ekstresi gerekiyor.',

  'mapping.sheet': 'Sayfa',
  'mapping.headerRow': 'Başlık satırı',
  'mapping.perspective': 'Bu ekstre hangi taraftan yazılmış?',
  'mapping.receivable': 'Alacak kartı — karşı taraf bize borçlu',
  'mapping.payable': 'Borç kartı — biz karşı tarafa borçluyuz',
  'mapping.perspectiveHint':
    'Yanlış seçim farkı yarıya indirmek yerine iki katına çıkarır. Fatura satırlarının borç mu alacak mı olduğuna bakılarak tahmin edildi.',
  'mapping.amountLayout': 'Tutar kolonları',
  'mapping.debitCredit': 'Ayrı borç / alacak kolonları',
  'mapping.signed': 'Tek işaretli tutar kolonu',
  'mapping.field.date': 'Tarih',
  'mapping.field.dueDate': 'Vade tarihi',
  'mapping.field.docNo': 'Belge / fiş no',
  'mapping.field.docNoAlt': 'İkinci belge no',
  'mapping.field.docTypeColumn': 'Belge türü',
  'mapping.field.description': 'Açıklama',
  'mapping.field.debit': 'Borç',
  'mapping.field.credit': 'Alacak',
  'mapping.field.amount': 'Tutar (işaretli)',
  'mapping.field.currency': 'Para birimi',
  'mapping.field.clearingDoc': 'Kapanış (clearing) belgesi',
  'mapping.none': '— yok —',
  'mapping.missingDate': 'Tarih kolonu seçilmeden mutabakat yapılamaz.',
  'mapping.missingAmount': 'Tutar kolonu seçilmedi.',
  'mapping.missingDebitCredit': 'Borç ve alacak kolonlarından en az biri seçilmeli.',
  'mapping.missingDocNo': 'Belge no seçilmedi — eşleştirme yalnız tarih ve tutara dayanacak.',
  'mapping.missingDueDate': 'Vade kolonu yok — vade, fatura tarihine vade günü eklenerek hesaplanacak.',
  'mapping.rowsRead': '{count} satır okundu',
  'mapping.skippedNoDate': '{count} satır tarihi okunamadığı için atlandı',
  'mapping.skippedFooter': '{count} toplam satırı atlandı',
  'mapping.addSheet': 'Bu tarafa sayfa ekle:',
  'mapping.addFile': 'Bu tarafa başka bir dosya ekle',
  'mapping.removeSource': 'Bu sayfayı çıkar',
  'mapping.preview': 'Önizleme',
  'mapping.run': 'Mutabakatı çalıştır',
  'mapping.back': 'Geri',

  'settings.title': 'Mutabakat ayarları',
  'settings.termDays': 'Vade (gün)',
  'settings.termDaysHint': 'Ekstrede vade tarihi olmayan faturalar için.',
  'settings.asOf': 'Mutabakat tarihi',
  'settings.amountTolerance': 'Tutar toleransı',
  'settings.dayTolerance': 'Gün toleransı',
  'settings.fallback': 'Belge no yoksa tarih + tutar ile eşleştir',
  'settings.openItems': 'Sadece açık kalemler üzerinden mutabakat',
  'settings.openItemsHint':
    'Ekstre hangi satırlarının kapandığını söylüyorsa (clearing belgesi), kapanmış belgeler ve karşı taraftaki eşleri karşılaştırmadan çıkarılır. İki taraf da "hâlâ ne borçlu" tabanında karşılaştırılır. Ekstrenizde kapanış kolonu bulunduğu için otomatik açıldı.',
  'settings.openItemsUnavailable':
    'Yüklenen ekstrelerde kapanış (clearing) belgesi kolonu yok; tüm satırlar karşılaştırılacak.',
  'result.excluded':
    'Açık kalem modu: {creditorSettled} kapanmış alacaklı satırı, {debtorSettled} kapanmış borçlu satırı ve {openingLines} devir satırı karşılaştırma dışında tutuldu. Devir aşağıda ayrıca raporlanıyor.',

  'result.balanceToday': 'Bugünkü Bakiye',
  'result.opening': 'Devir',
  'result.missingTotal': 'Eksik Kayıt Toplamı',
  'result.afterReconciliation': 'Mutabakat Sonrası Bakiye',
  'result.difference': 'Mutabakat Farkı',
  'result.balanceDiff': 'Bakiye Fark',
  'result.openingDiff': 'Devir Fark',
  'result.agreed': 'MUTABAKAT SAĞLANDI',
  'result.notAgreed': 'MUTABAKAT SAĞLANAMADI',
  'result.agreedHint': 'Eksik kayıtlar karşılıklı işlendiğinde iki tarafın bakiyesi birebir tutuyor.',
  'result.notAgreedHint': 'Aşağıdaki farklar giderildikten sonra {amount} açıklanamayan fark kalıyor.',
  'result.bridgeBroken':
    'Dikkat: farklar bakiye açığını birebir açıklamıyor. Kolon eşlemesini ve taraf yönünü kontrol edin.',
  'result.figuresOf': '{name} firmasının rakamları',
  'result.matched': 'Eşleşen belgeler',
  'result.creditorOnly': "{creditor}'da olup {debtor}'de olmayan kayıtlar",
  'result.debtorOnly': "{debtor}'de olup {creditor}'da olmayan kayıtlar",
  'result.amountMismatch': 'İki tarafın farklı tutarla kaydettiği belgeler',
  'result.noRows': 'Bu başlıkta kayıt yok.',
  'result.actions': 'Alınacak aksiyonlar',
  'result.aging': 'Açık faturalar ve yaşlandırma',
  'result.export': 'Sonuç tablosunu indir (.xlsx)',
  'result.restart': 'Yeni mutabakat',
  'result.explanation': 'Açıklama',

  'table.date': 'Tarih',
  'table.docNo': 'Belge no',
  'table.description': 'Açıklama',
  'table.amount': 'Tutar',
  'table.creditorAmount': '{name} tutarı',
  'table.debtorAmount': '{name} tutarı',
  'table.diff': 'Fark',
  'table.basis': 'Eşleşme',
  'table.dueDate': 'Vade',
  'table.open': 'Açık tutar',
  'table.daysOverdue': 'Gecikme (gün)',
  'table.bucket': 'Yaşlandırma',
  'table.row': 'Satır',

  'basis.docNoAndAmount': 'Belge no + tutar',
  'basis.docNo': 'Belge no',
  'basis.docNoLoose': 'Belge no (sıfır farkı)',
  'basis.docNoSuffix': 'Seri sonu',
  'basis.dateAndAmount': 'Tarih + tutar',
  'basis.amountOnly': 'Yalnız tutar',
  'basis.manual': 'Elle',

  'aging.notDue': 'Vadesi gelmemiş',
  'aging.d1to30': '1-30 gün',
  'aging.d31to60': '31-60 gün',
  'aging.d61to90': '61-90 gün',
  'aging.d90plus': '90+ gün',
  'aging.totalOpen': 'Toplam açık',
  'aging.overdue': 'Vadesi geçmiş',
  'aging.dueFromTerm': 'vade fatura tarihine {days} gün eklenerek hesaplandı',

  'action.balanceAgreed':
    '{creditor} ile {debtor} bakiyeleri, eksik kayıtlar işlendikten sonra birebir tutuyor. Mutabakat mektubu imzaya hazır.',
  'action.missingInCounterparty':
    '{docNo} numaralı belge ({date}) {holder} kayıtlarında var, {missing} kayıtlarında yok. Belgeyi {missing} tarafına gönderip kaydettirin.',
  'action.missingInOwn':
    '{docNo} numaralı belge ({date}) {holder} kayıtlarında var, {missing} kayıtlarında yok. {missing} tarafında kaydı araştırın; büyük ihtimalle tahsilat veya iade kaydedilmemiş.',
  'action.cutOff':
    '{docNo} numaralı belge ({date}) karşı ekstrenin tarih aralığı dışında. Dönem kayması olabilir; aynı kesim tarihli ekstre isteyin.',
  'action.amountMismatch':
    '{docNo} numaralı belge iki tarafta farklı tutarla kayıtlı: {creditorAmount} / {debtorAmount}. Fatura aslıyla karşılaştırın.',
  'action.amountMismatchVat':
    '{docNo} numaralı belgede aradaki oran tam %{rate} KDV. Bir taraf tutarı KDV dahil, diğeri hariç kaydetmiş olabilir.',
  'action.amountMismatchFx':
    '{docNo} numaralı belge iki tarafta farklı para biriminde kayıtlı; ima edilen kur {rate}. Kur farkı kaydı gerekiyor.',
  'action.amountMismatchMaybeFx':
    '{docNo} numaralı belgede tutarlar arasındaki oran {rate} — kur farkından kaynaklanıyor olabilir. İki tarafın kullandığı kuru karşılaştırın.',
  'action.amountMismatchRate':
    '{docNo} numaralı belgede iki tarafın tutarı %{percent} farklı — iki taraf aynı dövizli faturayı farklı kurdan çevirmiş olabilir. Kullanılan kurları karşılaştırın ve kur farkı faturası kesilmesi gerekip gerekmediğine bakın.',
  'action.overdue':
    '{docNo} numaralı fatura {days} gündür vadesi geçmiş (vade {dueDate}). {debtor} tarafından tahsilat takibi yapılmalı.',
  'action.unappliedPayment':
    '{count} tahsilat hiçbir faturaya kapatılamadı. Avans olabilir ya da eksik fatura kaydına işaret ediyor olabilir.',

  'severity.critical': 'Kritik',
  'severity.warning': 'Önemli',
  'severity.info': 'Bilgi',

  'common.creditor': 'A firması',
  'common.debtor': 'B firması',
  'common.total': 'Toplam',
  'common.count': '{count} kayıt',
};

const en: Dict = {
  'app.title': 'Reconciliation',
  'app.subtitle':
    'Compares two companies’ current-account statements, then reports the differences and what to do about them.',
  'app.privacy': 'Your files never leave your browser. Nothing is uploaded to a server.',

  'step.upload': 'Upload statements',
  'step.map': 'Map columns',
  'step.result': 'Reconciliation result',

  'upload.creditor': 'Company A — the creditor',
  'upload.creditorHint': 'The side that provides the service and raises the invoice.',
  'upload.debtor': 'Company B — the debtor',
  'upload.debtorHint': 'The side that receives the service and makes the payment.',
  'upload.drop': 'Drag a file here, or choose one',
  'upload.formats': '.xlsx, .xlsm or .csv',
  'upload.partyName': 'Company name',
  'upload.continue': 'Continue',
  'upload.sample': 'Try it with sample data',
  'upload.bothNeeded': 'Reconciliation needs a statement from both sides.',

  'mapping.sheet': 'Sheet',
  'mapping.headerRow': 'Header row',
  'mapping.perspective': 'Which side is this statement written from?',
  'mapping.receivable': 'Receivable card — the other side owes us',
  'mapping.payable': 'Payable card — we owe the other side',
  'mapping.perspectiveHint':
    'Getting this wrong doubles the reported gap rather than halving it. Guessed from which side the invoice lines sit on.',
  'mapping.amountLayout': 'Amount columns',
  'mapping.debitCredit': 'Separate debit / credit columns',
  'mapping.signed': 'One signed amount column',
  'mapping.field.date': 'Date',
  'mapping.field.dueDate': 'Due date',
  'mapping.field.docNo': 'Document number',
  'mapping.field.docNoAlt': 'Second reference',
  'mapping.field.docTypeColumn': 'Document type',
  'mapping.field.description': 'Description',
  'mapping.field.debit': 'Debit',
  'mapping.field.credit': 'Credit',
  'mapping.field.amount': 'Amount (signed)',
  'mapping.field.currency': 'Currency',
  'mapping.field.clearingDoc': 'Clearing document',
  'mapping.none': '— none —',
  'mapping.missingDate': 'A date column is required.',
  'mapping.missingAmount': 'No amount column selected.',
  'mapping.missingDebitCredit': 'Select at least one of the debit and credit columns.',
  'mapping.missingDocNo': 'No document number — matching will rely on date and amount alone.',
  'mapping.missingDueDate': 'No due-date column — due dates will come from the agreed term.',
  'mapping.rowsRead': '{count} rows read',
  'mapping.skippedNoDate': '{count} rows skipped for having no readable date',
  'mapping.skippedFooter': '{count} total rows skipped',
  'mapping.addSheet': 'Add a sheet to this side:',
  'mapping.addFile': 'Add another file to this side',
  'mapping.removeSource': 'Remove this sheet',
  'mapping.preview': 'Preview',
  'mapping.run': 'Run the reconciliation',
  'mapping.back': 'Back',

  'settings.title': 'Reconciliation settings',
  'settings.termDays': 'Payment term (days)',
  'settings.termDaysHint': 'Used for invoices whose statement carries no due date.',
  'settings.asOf': 'As of date',
  'settings.amountTolerance': 'Amount tolerance',
  'settings.dayTolerance': 'Day tolerance',
  'settings.fallback': 'Match on date + amount when there is no document number',
  'settings.openItems': 'Reconcile open items only',
  'settings.openItemsHint':
    'Where an export says which of its lines are closed, settled documents and their counterparts on the other side drop out, so both sides are compared on what is still owed. Switched on automatically because a clearing column was found.',
  'settings.openItemsUnavailable':
    'Neither upload carries a clearing-document column, so every line will be compared.',
  'result.excluded':
    'Open-item mode: {creditorSettled} settled creditor lines, {debtorSettled} settled debtor lines and {openingLines} opening lines were left out of the comparison. The opening is reported separately below.',

  'result.balanceToday': 'Closing balance',
  'result.opening': 'Opening (devir)',
  'result.missingTotal': 'Total of missing records',
  'result.afterReconciliation': 'Balance after reconciliation',
  'result.difference': 'Remaining difference',
  'result.balanceDiff': 'Balance gap',
  'result.openingDiff': 'Opening gap',
  'result.agreed': 'BALANCES AGREE',
  'result.notAgreed': 'BALANCES DO NOT AGREE',
  'result.agreedHint': 'Once each side books what it is missing, the two balances match exactly.',
  'result.notAgreedHint': '{amount} is still unexplained once the differences below are settled.',
  'result.bridgeBroken':
    'Warning: the differences do not add up to the balance gap. Check the column mapping and which side each statement is written from.',
  'result.figuresOf': '{name}’s figures',
  'result.matched': 'Matched documents',
  'result.creditorOnly': 'In {creditor}’s books but not {debtor}’s',
  'result.debtorOnly': 'In {debtor}’s books but not {creditor}’s',
  'result.amountMismatch': 'Documents booked at different amounts',
  'result.noRows': 'Nothing here.',
  'result.actions': 'Recommended actions',
  'result.aging': 'Open invoices and ageing',
  'result.export': 'Download the result table (.xlsx)',
  'result.restart': 'New reconciliation',
  'result.explanation': 'Explanation',

  'table.date': 'Date',
  'table.docNo': 'Document no',
  'table.description': 'Description',
  'table.amount': 'Amount',
  'table.creditorAmount': '{name} amount',
  'table.debtorAmount': '{name} amount',
  'table.diff': 'Difference',
  'table.basis': 'Matched on',
  'table.dueDate': 'Due',
  'table.open': 'Open',
  'table.daysOverdue': 'Days overdue',
  'table.bucket': 'Ageing',
  'table.row': 'Row',

  'basis.docNoAndAmount': 'Document no + amount',
  'basis.docNo': 'Document no',
  'basis.docNoLoose': 'Document no (zero padding)',
  'basis.docNoSuffix': 'Serial suffix',
  'basis.dateAndAmount': 'Date + amount',
  'basis.amountOnly': 'Amount only',
  'basis.manual': 'Manual',

  'aging.notDue': 'Not yet due',
  'aging.d1to30': '1-30 days',
  'aging.d31to60': '31-60 days',
  'aging.d61to90': '61-90 days',
  'aging.d90plus': '90+ days',
  'aging.totalOpen': 'Total open',
  'aging.overdue': 'Overdue',
  'aging.dueFromTerm': 'due date derived by adding {days} days to the invoice date',

  'action.balanceAgreed':
    '{creditor} and {debtor} agree exactly once the missing records are booked. The reconciliation letter is ready to sign.',
  'action.missingInCounterparty':
    'Document {docNo} ({date}) is in {holder}’s books but not {missing}’s. Send the document to {missing} and have it booked.',
  'action.missingInOwn':
    'Document {docNo} ({date}) is in {holder}’s books but not {missing}’s. Investigate on {missing}’s side — most likely a payment or credit note never booked.',
  'action.cutOff':
    'Document {docNo} ({date}) falls outside the other statement’s date range. Likely a cut-off difference; ask for a statement to the same date.',
  'action.amountMismatch':
    'Document {docNo} is booked at different amounts: {creditorAmount} / {debtorAmount}. Compare against the original invoice.',
  'action.amountMismatchVat':
    'On document {docNo} the ratio is exactly {rate}% VAT. One side has likely booked gross and the other net.',
  'action.amountMismatchFx':
    'Document {docNo} is booked in different currencies; the implied rate is {rate}. An FX difference entry is needed.',
  'action.amountMismatchMaybeFx':
    'On document {docNo} the two amounts differ by a factor of {rate} — possibly an FX rate difference. Compare the rates each side used.',
  'action.amountMismatchRate':
    'On document {docNo} the two amounts differ by {percent}% — most likely the same foreign-currency invoice converted at two different rates. Compare the rates used and check whether an FX difference invoice is needed.',
  'action.overdue':
    'Invoice {docNo} is {days} days past due (due {dueDate}). {debtor} should be chased for payment.',
  'action.unappliedPayment':
    '{count} payments could not be applied to any invoice. They may be advances, or point to invoices never booked.',

  'severity.critical': 'Critical',
  'severity.warning': 'Important',
  'severity.info': 'Info',

  'common.creditor': 'Company A',
  'common.debtor': 'Company B',
  'common.total': 'Total',
  'common.count': '{count} records',
};

const DICTS: Record<Locale, Dict> = { tr, en };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Renders one placeholder value in the reader's own conventions.
 *
 * Action sentences are assembled from raw engine values — a ratio, a lira
 * figure, an ISO date — and a Turkish reader should never see "%2.6" or
 * "2026-04-02" in the middle of a sentence they are meant to act on. Doing
 * this here rather than at each call site means every message gets it right,
 * including the ones written later.
 */
function renderVar(locale: Locale, value: string | number): string {
  const tag = locale === 'tr' ? 'tr-TR' : 'en-US';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    const decimals = Number.isInteger(value) ? 0 : 2;
    return new Intl.NumberFormat(tag, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  if (ISO_DATE.test(value)) {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat(tag, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(parsed));
    }
  }
  return value;
}

/** Looks up a key and fills its {placeholders}, in the reader's conventions. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const text = DICTS[locale][key] ?? DICTS.tr[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? renderVar(locale, vars[name]) : match,
  );
}
