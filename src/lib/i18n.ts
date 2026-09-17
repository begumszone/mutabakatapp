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
  'app.title': 'MutabakatAPP',
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
  'upload.samplePeriod': 'Dönem uyuşmazlığı örneği',
  'upload.downloadSample': 'Örnek cari hesap ekstresi indir (.xlsx)',
  'how.title': 'Nasıl kullanılır',
  'how.lead':
    'Mutabakat, aynı ilişkiyi tutan iki defteri karşılaştırmaktır: sizin defteriniz ve karşı firmanın defteri. Aşağıdaki beş adım, daha önce hiç mutabakat yapmamış biri için yazıldı.',
  'how.s1': 'İki tarafın da ekstresini toplayın',
  'how.s1b':
    'Muhasebe programınızdan ilgili carinin “cari hesap ekstresi” ya da “muavin defter” dökümünü Excel olarak alın. Aynısını karşı firmadan isteyin. İkisi aynı dönemi kapsıyorsa en iyisi; kapsamıyorsa uygulama bunu kendisi fark eder ve hangi tarihten itibaren ekstre istemeniz gerektiğini yazar.',
  'how.s2': 'Hangisi alacaklı, hangisi borçlu belirleyin',
  'how.s2b':
    'Faturayı kesen, yani mal veya hizmeti veren taraf alacaklıdır — soldaki A kutusu. Ödemeyi yapan taraf borçludur — sağdaki B kutusu. Emin değilseniz tek soru yeter: kim kime hizmet veriyor? Veren taraf A’dır.',
  'how.s3': 'Dosyaları sürükleyin',
  'how.s3b':
    'Başlıkları düzeltmeniz, satır silmeniz, Excel’i yeniden düzenlemeniz gerekmez. Uygulama sayfayı, başlık satırının kaçıncı satırda olduğunu ve hangi kolonun ne olduğunu kendisi bulur; ekstrenin üstündeki firma adı, vergi numarası ve dönem bilgisini de oradan okur.',
  'how.s4': 'Uygulamanın anladığını kontrol edin',
  'how.s4b':
    'İkinci adımda ne anladığını size gösterir: hangi kolonu tarih saydı, hangisini borç, ekstreyi hangi taraftan yazılmış kabul etti. Yanlış olanı açılır listeden düzeltin. Buradaki bir hata küçük bir hata değildir — kendinden emin ve yanlış bir mutabakat üretir, o yüzden hiçbir tahmin sessizce uygulanmaz.',
  'how.s5': 'Sonucu okuyun ve indirin',
  'how.s5b':
    'Üstte iki firmanın bakiyesi ve aradaki fark durur. Altında farkın her kalemi, sebebi ve kimin ne yapması gerektiği yazar. “Sonuç tablosunu indir” ile hepsini Excel olarak alır, karşı tarafa gönderirsiniz.',
  'how.termsTitle': 'Geçen terimler',
  'how.t1': 'Devir',
  'how.t1b': 'Dönem başındaki bakiye. Ekstrenin ilk satırında “DEVİR”, “Açılış Fişi” ya da “Nakli Yekün” diye geçer; öncesinde olan biten her şeyin tek rakama inmiş hâlidir.',
  'how.t2': 'Açık kalem',
  'how.t2b': 'Henüz ödenmemiş, kapanmamış fatura. Bazı ERP’ler ekstrede hangi faturanın hangi ödemeyle kapandığını yazar; uygulama bunu görürse karşılaştırmayı yalnızca açık kalemler üzerinden yapar.',
  'how.t3': 'Eksik kayıt',
  'how.t3b': 'Bir tarafın deftere işlediği, diğerinin işlemediği belge. Mutabakatsızlığın en sık sebebidir ve çözümü genelde belgeyi karşı tarafa gönderip kaydettirmektir.',
  'how.t4': 'Kur farkı',
  'how.t4b': 'Dövizli bir faturayı iki tarafın farklı kurdan çevirmesi. Tutarlar yüzde birkaç oynar; uygulama oranı hesaplayıp bunun kur kaynaklı olabileceğini söyler.',
  'what.title': 'Yüklediğinizde ne çıkar',
  'what.bridge': 'Bakiye köprüsü',
  'what.bridgeBody':
    'İki bakiye arasındaki farkın tamamını kalem kalem açıklar. Farklar açığı birebir açıklamıyorsa “tuttu” demez, tutmadığını söyler.',
  'what.cause': 'Farkın sebebi',
  'what.causeBody':
    'Kur farkı mı, KDV mi, karşı tarafın işlemediği bir kayıt mı, yoksa dönem kayması mı — adını koyar. Dövizli faturada iki tarafın kullandığı kuru hesaplar.',
  'what.action': 'Alınacak aksiyon',
  'what.actionBody':
    'Kimin ne yapması gerektiğini tutara ve gecikmeye göre sıralar. Vadesi geçmiş faturaları, toplu tahsilatları kapatarak yaşlandırır.',
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
  'mapping.rowsRead': '{count} satır okundu',
  'mapping.skippedNoDate': '{count} satır tarihi okunamadığı için atlandı',
  'mapping.skippedFooter': '{count} toplam satırı atlandı',
  'mapping.zeroAmount': '{count} satırda tutar yok — kolon eşlemesini kontrol edin',
  'mapping.addSheet': 'Bu tarafa sayfa ekle:',
  'mapping.addFile': 'Bu tarafa başka bir dosya ekle',
  'mapping.removeSource': 'Bu sayfayı çıkar',
  'mapping.preview': 'Önizleme',
  'mapping.run': 'Mutabakatı çalıştır',
  'mapping.back': 'Geri',

  'setup.tab.sides': 'Taraflar ve sütunlar',
  'setup.tab.period': 'Dönem ve mutabakat tarihi',
  'action.openingMismatch':
    '{date} devir bakiyeleri tutmuyor: {creditor} {creditorOpening}, {debtor} {debtorOpening} — fark {difference}. Bu fark dönem içindeki hiçbir hareketle açıklanamaz; önce önceki dönemin mutabakatı yapılmalıdır.',
  'action.openingVerified':
    '{date} devir bakiyesi iki tarafta da aynı: {amount}. Yıl kapanışı devri doğrulanmıştır.',
  'settings.title': 'Mutabakat ayarları',
  'mapping.whichSheet': 'Bu dosyada {count} sayfa var. Hangisini kullanalım?',
  'mapping.whichSheetHint':
    'Yanlış sayfa seçilirse mutabakat başka bir veri üzerinden çalışır ve sonuç doğru görünür ama yanlış olur. Bu yüzden siz seçmeden devam edilmiyor.',
  'mapping.sheetRows': '{count} satır',
  'mapping.whichMoney': 'Bu sayfanın sütun başlıkları yok. Hangisi borç, hangisi alacak?',
  'mapping.whichMoneyHint':
    'Şu sütunlar tutar taşıyor ama hangisinin borç, hangisinin alacak olduğu verilerden anlaşılmıyor: {columns}. Aşağıdan seçin.',
  'mapping.balanceColumns':
    'Şu sütun(lar) yürüyen bakiye gibi davranıyor, hareket değil — toplama katılmamalı: {columns}.',
  'settings.askStart': '2. Karşılaştırma hangi tarihten itibaren yapılsın?',
  'settings.periodStart': 'Başlangıç tarihi',
  'settings.startHint':
    'Bu tarihten öncesi tek bir devir rakamına indirgenir ve {opening} devir bakiyesi olarak iki tarafta ayrı ayrı kontrol edilir. Cari hesap mutabakatı genelde yıl başından itibaren yapılır; devirde şüphe varsa iki ya da üç yıl geriye gidilir.',
  'settings.preset.ytd': 'Bu yıl',
  'settings.preset.twoYears': 'Son 2 yıl',
  'settings.preset.threeYears': 'Son 3 yıl',
  'settings.askAsOf': '1. Hangi tarih itibarıyla mutabakat yapılacak?',
  'settings.asOfHint':
    'Bu tarihe kadar olan hesap hareketleri karşılaştırılır ve bu tarihteki bakiyede mutabık kalınır. Ekstre 01.01.2026–05.08.2026 aralığını kapsıyor olsa bile, 30.06.2026 yazarsanız sonraki satırlar bakiyeye girmez.',
  'settings.advanced': 'Gelişmiş eşleştirme ayarları',
  'settings.asOf': 'Mutabakat tarihi',
  'settings.amountTolerance': 'Tutar toleransı',
  'settings.dayTolerance': 'Gün toleransı',
  'settings.fallback': 'Belge no yoksa tarih + tutar ile eşleştir',

  'result.back': 'Ayarlara dön',
  'action.incompleteExtract':
    '{party} ekstresi eksik bir defter: kapatma belgesi taşıyor ve başlangıcından önce kesilmiş faturaların ödemelerini içeriyor. Satırların toplamı {summed}, oysa kapanmamış satırların toplamı {openTotal}. Bu ekstrenin toplamı bakiye değildir — {party} tarafından dönemin tamamını kapsayan cari ekstre isteyin.',
  'derive.title': 'Fark nasıl bulundu?',
  'derive.lead':
    '{creditor} {date} itibarıyla {creditorBalance}, {debtor} ise {debtorBalance} diyor. Aradaki {difference} tutarındaki fark aşağıdaki kalemlerin toplamıdır — başka hiçbir şey bir bakiyeyi değiştiremez.',
  'derive.opening': 'Devirden gelen fark ({date} kapanışı)',
  'derive.openingNote': 'Bu fark dönem başlamadan önce doğmuş.',
  'derive.openingClean': 'Devir tutuyor, fark dönem içinde doğmuş.',
  'derive.missing': 'Bir tarafta olup diğerinde olmayan kayıtlar',
  'derive.amounts': 'Aynı belgenin iki tarafta farklı tutarla kaydedilmesi',
  'derive.total': 'Açıklanan toplam',
  'derive.unexplained': 'Açıklanamayan',
  'derive.checkPrior':
    '{date} kapanış bakiyeleri tutmuyor: {creditor} {creditorOpening}, {debtor} {debtorOpening}. Devirden gelen fark {difference}. Bu dönemin mutabakatı, önceki dönem kapatılmadan imzalanmamalıdır.',
  'result.balanceToday': 'Bugünkü Bakiye',
  'result.balanceAt': '{date} Bakiyesi',
  'result.openingAt': '{date} Devir',
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
  'result.export': 'Sonuç tablosunu indir (.xlsx)',
  'result.restart': 'Yeni mutabakat',
  'result.explanation': 'Açıklama',
  'result.period': 'Karşılaştırılan dönem',
  'result.periodMisaligned':
    '{creditor}: {creditorStart} – {creditorEnd}  ·  {debtor}: {debtorStart} – {debtorEnd}. Karşılaştırma yalnızca ortak dönem üzerinden yapıldı.',
  'result.periodOutside':
    'Ortak dönemin dışında kalan {count} kayıt karşılaştırmaya alınmadı — karşı taraf o dönemi göndermediği için eksik sayılamazlar.',

  'table.date': 'Tarih',
  'table.docNo': 'Belge no',
  'table.description': 'Açıklama',
  'table.amount': 'Tutar',
  'table.creditorAmount': '{name} tutarı',
  'table.debtorAmount': '{name} tutarı',
  'table.diff': 'Fark',
  'table.basis': 'Eşleşme',
  'table.row': 'Satır',

  'basis.docNoAndAmount': 'Belge no + tutar',
  'basis.docNo': 'Belge no',
  'basis.docNoLoose': 'Belge no (sıfır farkı)',
  'basis.docNoSuffix': 'Seri sonu',
  'basis.dateAndAmount': 'Tarih + tutar',
  'basis.amountOnly': 'Yalnız tutar',
  'basis.manual': 'Elle',


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
  'action.periodGap':
    'İki ekstre farklı dönemleri kapsıyor. Ortak dönem {commonStart} tarihinde başlıyor ve o tarihteki devirler tutmuyor: {creditor} {creditorOpening}, {debtor} {debtorOpening} — arada {difference} fark var. Bu fark ortak dönemden ÖNCE oluşmuş, dolayısıyla eldeki verilerle açıklanamaz. {shortParty} firmasından {neededFrom} tarihinden itibaren ekstre isteyin.',
  'action.missingOpening':
    '{party} ekstresinde devir (açılış bakiyesi) satırı yok; {date} devri sıfır kabul edildi. Devir varsa mutabakat ayarlarından elle girin, yoksa sonuç yanıltıcı olur.',

  'severity.critical': 'Kritik',
  'severity.warning': 'Önemli',
  'severity.info': 'Bilgi',

  'common.creditor': 'A firması',
  'common.debtor': 'B firması',
  'common.total': 'Toplam',
  'common.count': '{count} kayıt',
};

const en: Dict = {
  'app.title': 'MutabakatAPP',
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
  'upload.samplePeriod': 'Mismatched-period example',
  'upload.downloadSample': 'Download a sample statement (.xlsx)',
  'how.title': 'How to use it',
  'how.lead':
    'Reconciliation means comparing two ledgers of the same relationship: yours and the other firm’s. These five steps are written for somebody who has never done one.',
  'how.s1': 'Get both sides’ statements',
  'how.s1b':
    'Export the counterparty’s account statement — the cari hesap ekstresi or muavin defter — from your accounting system as Excel, and ask the other firm for theirs. Covering the same period is ideal; where they do not, the app notices and tells you which statement to ask for and from what date.',
  'how.s2': 'Work out which side is the creditor',
  'how.s2b':
    'Whoever raises the invoice — the side supplying the goods or service — is the creditor, box A on the left. The side paying is the debtor, box B on the right. One question settles it: who is serving whom? The one serving is A.',
  'how.s3': 'Drop the files in',
  'how.s3b':
    'You do not need to fix headings, delete rows, or rearrange the spreadsheet. The app finds the sheet, the header row and what each column is, and reads the firm, tax number and period out of the block above the table.',
  'how.s4': 'Check what it understood',
  'how.s4b':
    'Step two shows you its reading: which column it took for the date, which for debit, which side the statement is written from. Correct anything wrong from the dropdowns. A wrong guess here is not a small error — it produces a confident, wrong reconciliation, which is why nothing is applied silently.',
  'how.s5': 'Read the result and download it',
  'how.s5b':
    'The two balances and the gap between them sit at the top. Below that, every difference, its cause, and who has to do what. “Download the result table” gives you all of it as Excel to send to the other side.',
  'how.termsTitle': 'Terms used here',
  'how.t1': 'Devir (opening)',
  'how.t1b': 'The balance at the start of the period. It appears on the first line as “DEVİR”, “Açılış Fişi” or “Nakli Yekün” — everything that happened before, in one figure.',
  'how.t2': 'Open item',
  'how.t2b': 'An invoice not yet settled. Some ERPs record which payment closed which invoice; where the app sees that, it compares open items only.',
  'how.t3': 'Missing record',
  'how.t3b': 'A document one side booked and the other did not. The commonest cause of a disagreement, and usually fixed by sending the document over to be booked.',
  'how.t4': 'FX difference',
  'how.t4b': 'The same foreign-currency invoice converted at two different rates. The amounts differ by a few percent; the app works out the ratio and says it may be the rate.',
  'what.title': 'What you get back',
  'what.bridge': 'A balance bridge',
  'what.bridgeBody':
    'Every lira of the gap between the two balances, accounted for. If the differences do not add up to the gap, it says so rather than claiming agreement.',
  'what.cause': 'The cause of each difference',
  'what.causeBody':
    'FX, VAT, a record the other side never booked, or a cut-off difference — named, not merely reported. For a foreign-currency invoice it works out the rate each side used.',
  'what.action': 'What to do about it',
  'what.actionBody':
    'Who has to act, ordered by money and by how late it is. Overdue invoices are aged after bulk payments have been applied against them.',
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
  'mapping.rowsRead': '{count} rows read',
  'mapping.skippedNoDate': '{count} rows skipped for having no readable date',
  'mapping.skippedFooter': '{count} total rows skipped',
  'mapping.zeroAmount': '{count} rows carry no amount — check the column mapping',
  'mapping.addSheet': 'Add a sheet to this side:',
  'mapping.addFile': 'Add another file to this side',
  'mapping.removeSource': 'Remove this sheet',
  'mapping.preview': 'Preview',
  'mapping.run': 'Run the reconciliation',
  'mapping.back': 'Back',

  'setup.tab.sides': 'Parties and columns',
  'setup.tab.period': 'Period and balance date',
  'action.openingMismatch':
    'The opening (devir) balances at {date} do not agree: {creditor} {creditorOpening}, {debtor} {debtorOpening} — a gap of {difference}. No movement inside the period can explain this; the previous period has to be reconciled first.',
  'action.openingVerified':
    'The opening (devir) balance at {date} is the same on both sides: {amount}. The year-end carry-forward is verified.',
  'settings.title': 'Reconciliation settings',
  'mapping.whichSheet': 'This file has {count} sheets. Which one should we use?',
  'mapping.whichSheetHint':
    'Picking the wrong sheet reconciles different data and produces a result that looks right and is not. Nothing runs until you choose.',
  'mapping.sheetRows': '{count} rows',
  'mapping.whichMoney': 'This sheet has no column headers. Which column is debit, which is credit?',
  'mapping.whichMoneyHint':
    'These columns hold money, but the data does not say which is debit and which is credit: {columns}. Choose below.',
  'mapping.balanceColumns':
    'These column(s) behave like a running balance rather than a movement, so they must not be summed: {columns}.',
  'settings.askStart': '2. From which date should the comparison run?',
  'settings.periodStart': 'Start date',
  'settings.startHint':
    'Everything before this date collapses into a single carried-forward figure, and the opening balance at {opening} is checked on both sides. Reconciliation usually runs from the start of the year; go back two or three years when the opening itself is in doubt.',
  'settings.preset.ytd': 'This year',
  'settings.preset.twoYears': 'Last 2 years',
  'settings.preset.threeYears': 'Last 3 years',
  'settings.askAsOf': '1. As at which date should the reconciliation be made?',
  'settings.asOfHint':
    'Movements up to this date are compared, and it is the balance at this date that gets agreed. A statement may run to 05.08.2026 while 30.06.2026 is the date being signed — later rows then never enter the balance.',
  'settings.advanced': 'Advanced matching settings',
  'settings.asOf': 'Balance date',
  'settings.amountTolerance': 'Amount tolerance',
  'settings.dayTolerance': 'Day tolerance',
  'settings.fallback': 'Match on date + amount when there is no document number',

  'result.balanceToday': 'Closing balance',
  'result.back': 'Back to setup',
  'action.incompleteExtract':
    '{party}’s statement is not a complete ledger: it names the document that closed each line and carries settlements for invoices raised before it begins. Its rows total {summed}, while the lines still open total {openTotal}. That total is not a balance — ask {party} for a statement covering the whole period.',
  'derive.title': 'How was the difference found?',
  'derive.lead':
    '{creditor} says {creditorBalance} as at {date}; {debtor} says {debtorBalance}. The {difference} between them is the sum of the items below — nothing else can move a balance.',
  'derive.opening': 'Carried forward from the opening ({date} close)',
  'derive.openingNote': 'This part of the gap was already there before the period began.',
  'derive.openingClean': 'The opening agrees; the gap arose inside the period.',
  'derive.missing': 'Records one side booked and the other did not',
  'derive.amounts': 'The same document booked at two different amounts',
  'derive.total': 'Total explained',
  'derive.unexplained': 'Unexplained',
  'derive.checkPrior':
    'The closing balances at {date} do not agree: {creditor} {creditorOpening}, {debtor} {debtorOpening}. The opening gap is {difference}. This period should not be signed off before the previous one is closed.',
  'result.balanceAt': 'Balance at {date}',
  'result.openingAt': 'Opening (devir) at {date}',
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
  'result.export': 'Download the result table (.xlsx)',
  'result.restart': 'New reconciliation',
  'result.explanation': 'Explanation',
  'result.period': 'Period compared',
  'result.periodMisaligned':
    '{creditor}: {creditorStart} – {creditorEnd}  ·  {debtor}: {debtorStart} – {debtorEnd}. Only the overlap was compared.',
  'result.periodOutside':
    '{count} records fall outside the overlap and were left out — the other side never sent those months, so their absence proves nothing.',

  'table.date': 'Date',
  'table.docNo': 'Document no',
  'table.description': 'Description',
  'table.amount': 'Amount',
  'table.creditorAmount': '{name} amount',
  'table.debtorAmount': '{name} amount',
  'table.diff': 'Difference',
  'table.basis': 'Matched on',
  'table.row': 'Row',

  'basis.docNoAndAmount': 'Document no + amount',
  'basis.docNo': 'Document no',
  'basis.docNoLoose': 'Document no (zero padding)',
  'basis.docNoSuffix': 'Serial suffix',
  'basis.dateAndAmount': 'Date + amount',
  'basis.amountOnly': 'Amount only',
  'basis.manual': 'Manual',


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
  'action.periodGap':
    'The two statements cover different periods. The overlap begins on {commonStart} and the balances carried into it do not agree: {creditor} {creditorOpening}, {debtor} {debtorOpening} — a gap of {difference}. That gap arose BEFORE the overlap, so nothing in the data can explain it. Ask {shortParty} for a statement from {neededFrom}.',
  'action.missingOpening':
    '{party}’s statement carries no opening (devir) line, so the balance at {date} was taken as zero. If there is an opening, enter it in the settings — otherwise the result is misleading.',

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
