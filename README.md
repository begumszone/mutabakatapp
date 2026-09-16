# Mutabakat

İki firmanın cari hesap ekstrelerini karşılaştırıp mutabakatını çıkaran,
tamamen tarayıcıda çalışan bir uygulama. Dosyalar hiçbir sunucuya
yüklenmez — gerçek mali veriyle kullanmak bu yüzden güvenlidir.

## Ne yapar

Birbiriyle alışverişi olan iki firma, aynı ilişkinin **birbirinin aynası**
olan iki defterini tutar. ABC, Begüm Teknoloji'ye fatura keser: ABC'nin
defterinde bu bir alacak (Begüm'ün kartında borç), Begüm'ün defterinde ise
aynı olay bir borçtur (ABC'nin kartında alacak). Mutabakat, bu iki defteri
tek yöne çevirip belge belge eşleştirmek ve kalan her kuruşu açıklamaktır.

Uygulama şunu üretir:

1. **SONUÇ TABLOSU** — finans ekiplerinin bugün elle hazırladığı tablonun
   aynısı: Bugünkü Bakiye, Devir, Eksik Kayıt Toplamı, Mutabakat Sonrası
   Bakiye ve tek satırlık Mutabakat Farkı.
2. **Eksik kayıtlar** — bir tarafın işleyip diğerinin işlemediği belgeler,
   iki ayrı liste halinde.
3. **Tutar farkları** — iki tarafın farklı tutarla kaydettiği belgeler ve
   farkın *nedeni*: KDV, kur çevrimi ya da iki farklı kur.
4. **Yaşlandırma** — vadesi geçmiş açık faturalar, gecikme günleriyle.
5. **Alınacak aksiyonlar** — kimin ne yapması gerektiği, tutara ve
   gecikmeye göre sıralanmış.
6. **Excel çıktısı** — yukarıdakilerin tamamı, aynı düzende.

## Neden basit bir karşılaştırma değil

Gerçek ekstreler birbirini tutmaz, çünkü:

- **Belge numaraları farklı yazılır.** SAP `AL72026000000017` yazarken
  müşterinin Logo ekstresi aynı faturayı `AL7202600000017` diye tutar —
  bir sıfır fark. Uygulama sıfır dolgusunu sıkıştırarak bunları
  birleştirir, ama `AL1...` ile `AL7...`'yi ayrı tutar.
- **Tahsilatların referansı yoktur.** 45 fatura tek bir havaleyle
  kapatılır ve havale hiçbirini isimlendirmez. Ödemeler önce açıkça
  belirtilen faturaya, kalanı en eski faturadan başlayarak kapatılır —
  hem yasal varsayım hem de iki muhasebe biriminin telefonda varsayacağı
  şey budur.
- **Farkın nedeni farkın kendisinden önemlidir.** "8.286,26 TL fark var"
  ile "ABBOTT 53,12'den, KONSENSUS 54,50'den çevirmiş" arasındaki mesafe,
  mutabakatın çözülmesiyle çözülmemesi arasındaki mesafedir.

## Açık kalem modu

SAP tarzı bir ekstre aslında bir **açık kalem listesi + kapanmış hareket
geçmişidir**. Raporladığı bakiye, kapanış (clearing / "Denkleştirme")
belgesi boş olan satırların toplamıdır; geri kalanı ERP'nin çoktan
kapattığı faturalardır — üstelik bu faturaların bir kısmı ekstre
başlamadan önce kesilmiştir. Bu yüzden ekstrenin tamamı kendi bakiyesini
vermez. Gerçek bir dosyada: açık kalemler **501.717,37**, bütün satırlar
ise **30.467,42**.

Ekstre hangi satırlarının kapandığını söylüyorsa, kapanmış belgeler
karşılaştırmadan çıkarılır. Karşı tarafın ekstresinde genelde kapanış
kolonu yoktur; bu yüzden karar **eşleştirmenin kendisiyle** karşıya
taşınır: bu taraf "X faturası kapandı" diyorsa, öbür taraftaki X faturası
da kapanmıştır. Bu çıkarım olmasa, müşterinin geçmişte kaydettiği her
belge "tedarikçide eksik kayıt" olarak geri gelirdi.

Eşleştirme her zaman **önce tüm satırlar üzerinde** çalışır: daraltmayı
önce yapmak, daraltmayı doğru kılan bağlantıları atmak olurdu.

Devir satırları da dışarıda bırakılır. Devir zaten kapanmış geçmişin tek
rakama inmiş hâlidir; içeride bırakmak az önce çıkarılanı iki kez saymak
olur. Devir, sonucun kendi satırında raporlanır — iki tarafın devri
tutmuyorsa, daha eski dönemi kapsayan bir ekstre istemek gerekir.

Mod, kapanış kolonu varsa kendiliğinden açılır, yoksa kapalı kalır; bu
okumayı desteklemeyen bir yükleme hiçbir zaman sessizce yeniden
yorumlanmaz.

## Eşleştirme nasıl çalışır

Kanıtı güçlüden zayıfa doğru kullanan katmanlı bir eşleştirme yapılır ve
her katman yalnızca öncekilerden artanı görür:

1. belge no **ve** tutar aynı — tartışmasız eşleşme;
2. belge no aynı, tutar farklı — bu bir eşleşme hatası değil, bulgunun
   kendisidir;
3. sıfır dolgusu sıkıştırıldığında belge no aynı (önce tutar şartıyla,
   sonra tutar şartı olmadan — çünkü farklı dolgulu fatura çoğu zaman
   farklı kurdan çevrilmiş aynı faturadır);
4. seri sonu aynı;
5. tarih + tutar aynı — referansı olmayan tahsilatlar için;
6. yalnız tutar, üstelik iki tarafta da tek aday varsa.

Belge numarasının eşleştirmeye girebilmesi için yeterince uzun olması
gerekir. Logo fişlerini `0000000000000001` diye numaralandırır; dolgu
sıfırları atılınca geriye "1" kalır ve iki firmanın da bir 1 numaralı fişi
vardır. Kısa numaralar kanıt taşımadığı için o satır tarih ve tutar
adımlarına düşer.

Son iki adım tahmindir; kapatılabilirler ve eşleşen her satır hangi
adımdan geldiğini gösterir.

Bir fatura ile bir tahsilat, aynı referansı taşısalar bile asla
eşleştirilmez: bakiyeyi ters yönlere iterler ve eşleştirilirlerse gerçek
bir farkı sessizce götürürler.

## Bakiye köprüsü bir iddiadır

İki bakiye arasındaki fark, **tam olarak** şuna eşittir: bir tarafın
işleyip diğerinin işlemediği belgeler, artı iki farklı tutarla işlenen
belgelerin neti. Bir bakiyeyi başka hiçbir şey oynatamaz. Uygulama bu
özdeşliği her çalıştırmada doğrular; tutmuyorsa sonucu "tutmuş" gibi
sunmak yerine eşlemenin tutarsız olduğunu söyler.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm test         # motor testleri
npm run build    # üretim derlemesi
```

Veri olmadan denemek için giriş ekranındaki **"Örnek veriyle dene"**
düğmesi, bu üç farkın (eksik kayıt, kur farkı, vadesi geçmiş fatura)
hepsini içeren bir senaryo yükler.

## Desteklenen dosyalar

`.xlsx`, `.xlsm`, `.csv`. Sayfa ve başlık satırı otomatik bulunur;
kolonlar hem SAP'ın İngilizce başlıklarından hem de Logo/Netsis/Mikro'nun
Türkçe başlıklarından otomatik tanınır. Tahmin edilen her şey
hesaplamadan önce ekranda düzeltilebilir hâlde gösterilir — buradaki
yanlış bir tahmin küçük bir hata değil, kendinden emin ve yanlış bir
mutabakat üretir.

Tutarlar ister ayrı **Borç / Alacak** kolonlarında, ister tek işaretli bir
tutar kolonunda olabilir. Tarihler nokta ile yazılmışsa gün önce
(`31.12.2025`), eğik çizgi ile yazılmışsa ay önce (`8/31/2026`) okunur;
bu, iki sistemin gerçekten yaptığı ayrımdır.

Rapor alt toplamları ("Genel Toplam", "Toplam Tutarlar :") satır sanılıp
hesaba katılmaz; "Devir" / "Nakli Yekün" satırları ise devir olarak ayrı
raporlanır.

## Sonraki adım: ERP entegrasyonu

Çekirdek (`src/core`) dosya okumaktan tamamen bağımsızdır: normalize et →
eşleştir → köprüle → aksiyon çıkar. Dosya okuma `src/adapters` altında
ayrı durur. Bir ERP'den doğrudan veri çekmek, aynı `Statement` biçimini
üreten yeni bir adaptör yazmak demektir; motorun hiçbir yeri değişmez.
