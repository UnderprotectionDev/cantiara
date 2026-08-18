# Veri Güvenliği ve Taşınabilirlik

Bu belge veri sınıflandırması, güvenlik redaksiyonu, saklama, kalıcı silme ve seçili kayıtların kontrollü içe/dışa aktarımının tek normatif sahibidir. Hesap, platform ve operasyonel kurtarma [Hesap, Platform ve Operasyonlarda](03-account-platform-operations.md), ortak kayıt yaşam döngüsü [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md) yaşar.

## Veri güvenliği ve taşınabilirlik

- **İçe ve dışa aktarma işlemlerinden önce kayıt, ilişki, iç kimlik, proje kısa kodu, güncel kullanıcıya dönük iş anahtarı ve iş anahtarı geçmişi, özel alan ve sürüm sorunları denetlenir.** Sonuçlar kullanıcıya gösterilir; mevcut çalışma alanı açık onay olmadan değiştirilmez.

<a id="database-first-guvenlik-tabani"></a>
### Database-first güvenlik tabanı

- **GitHub ile Hesap oluşturma ve giriş, güvenli oturum, veri bölgesi, operasyonel yedek ve RPO/RTO hedefleri [Hesap, Platform ve Operasyonlar](03-account-platform-operations.md) tarafından tanımlanır.** Ortak kayıt sahipliği, Arşiv ve Çöp Kutusu durumları ile Proje silme grubunun kapsam invariantı [Domain Modeli ve Yaşam Döngüsü](02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) tarafından belirlenir. Saklama süreleri, güvenli kalıcı silme ve redaksiyon bu belgenin sorumluluğundadır.

- **Özel ve herkese açık veri yolları teknik olarak ayrılır.** Özel içerik yalnız arayüzde gizlenmiş sayılmaz; herkese açık sorgular özel kayıtlara ve ilişki uçlarına erişemez.

- **Veri aktarım sırasında TLS 1.2 veya 1.3, depolama sırasında AES-256 ya da aynı güvenlik düzeyinde yönetilen bulut şifrelemesiyle korunur.** Üretim verisi, yedek ve export hazırlama alanı ayrı anahtar kapsamları kullanır. GitHub ve gelecekteki dinamik entegrasyon token'ları uygulama katmanında envelope encryption ile şifrelenerek PostgreSQL'de tutulur; sürümlü üst anahtarlar Railway Sealed Variables'tan gelir, veritabanına veya loga yazılmaz. Entegrasyon, üretim, yedek ve export alanları ayrı döndürülebilir veri anahtarları kullanır; anahtar sürümü ciphertext ile tutulur, yılda en az bir kez ve şüpheli erişimde hemen döndürülür. Token düz metni yalnız yetkili işlem belleğinde gerekli süre yaşar, normal proje kaydı, arama, export, kanıt veya log kapsamına girmez ve iptal edilebilir.

- **Ürün veriyi `Herkese açık`, `Özel`, `Hassas kişisel veri` ve `Secret` olarak sınıflandırır.** Contact e-postası, kullanıcı araştırması katılımcı bilgisi ve özel geri bildirim kişisel veridir; bağlantıyla sınırlı paylaşım parolası, oturum, paylaşım ve entegrasyon anahtarı `Secret`tır. Secret arama, export, paylaşım ve yayın kapsamına hiçbir zaman girmez. Sağlık, biyometri, resmî kimlik numarası, ödeme kartı, çocuk verisi veya benzeri özel nitelikli kişisel veri ilk üründe bilinçli olarak tutulmaz; kullanıcı veri girişinde bu sınır hakkında uyarılır.

- **Kurucu yalnız hukuka uygun biçimde topladığı üçüncü kişi verisini eklemekten sorumludur.** Ürün Contact ve ilişkili kişisel veriler için `Kişisel veriyi dışa aktar` ve `Kişisel veriyi sil` eylemleri sunar. Dışa aktarma kişinin Contact, e-posta takma değerleri, Geri Bildirim, Araştırma ve ilişkili kanıt kayıtlarını okunabilir paket olarak toplar. Silme önizlemesi etkilenen kaynakları gösterir; gerekli tarihsel bütünlük için içeriksiz tombstone ve denetim olayı kalabilir, ad/e-posta/özgün mesaj gibi kişisel değerler geri döndürülemez redakte edilir. Aktif paylaşım veya yayındaki değer aynı işlemde kaldırılır ve cache temizliğine alınır.

- **Kalıcı silmeden sonra denetim kaydında yalnız geri döndürülemeyen hesap/kayıt takma kimliği, olay türü, zaman ve işlemi yapan aktör tutulur; e-posta, IP, içerik veya silinen alan değeri tutulmaz.** Güvenlik veya hukuki saklama zorunluluğu doğarsa kapsam, gerekçe ve bitiş tarihi ayrı kararla belgelenmeden olağan saklama süresi uzatılamaz.

- **Loglarda token, iletişim bilgisi ve özel içerik gibi hassas veriler maskelenir.** Paylaşım token’ları tahmin edilemez ve iptal edilebilir olur. Bağlantıyla sınırlı paylaşım parolaları geri okunabilir biçimde saklanmaz; başarısız denemeler hız sınırı ve kötüye kullanım korumasına tabidir. Parola değiştirme mevcut erişimi yeni parolaya geçirir; bağlantıyı iptal etme token ve parola doğrulamasından bağımsız olarak erişimi tamamen durdurur.

- **YouTube kartı sayfa açıldığında üçüncü tarafa istek göndermez.** Kullanıcı oynatıcıyı yüklemeden önce üçüncü taraf içerik, çerez ve olası veri aktarımı açıkça bildirilir; uygulanabildiği yerde YouTube'un gizliliği artırılmış modu kullanılır. Bu onay, videoyu veya ilişkili başka kaydı herkese açık yapmaz ve keyfî iframe çalıştırma yetkisi vermez.

- **Güvenlik redaksiyonu hassas değeri güncel içerikten, bütün kayıt geçmişi revizyonlarından, Dış yüzey snapshot revizyonlarından, arama indekslerinden, dışa aktarma hazırlıklarından ve cache'lerden geri döndürülemez biçimde kaldırır.** İçeriksiz redaksiyon işareti özgün olay türü, zaman ve aktörü korur; olağan restore redakte edilmiş içeriği yeniden etkinleştiremez.

- **Dış yüzey redaksiyonu ve temizliği yayın erişimini yeniden açamaz.** İptalin erişim, token, ziyaretçi oturumu ve cache davranışı [ortak Dış yüzey güvenlik sözleşmesinde](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) yaşar; bu belge yalnız redaksiyonun saklanan revizyon, indeks ve cache kopyalarına yayılımını sahiplenir.

<a id="cop-kutusu-ve-geri-yukleme"></a>
### Çöp kutusu ve geri yükleme

<a id="saklama-ve-guvenli-silme-sureleri"></a>
#### Saklama ve güvenli silme süreleri

- **Çöp Kutusu kayıtları 30 gün sonra kalıcı silinir.** Kullanıcı daha önce açık kalıcı silme başlatabilir; etki önizlemesi ve yeniden kimlik doğrulama gerekir. Kimlik doğrulama, yetkilendirme, paylaşım, yayın, entegrasyon ve yüksek riskli veri işlemi denetim kayıtları 365 gün; olağan güvenlik olay logları 90 gün; diğer uygulama ve operasyon logları 30 gün tutulur. Restore replay için ayrı tutulan içeriksiz ve geri döndürülemez takma kimlikli silme/iptal/rotasyon tombstone'u, ilgili Hesap silinse bile en uzun operasyonel backup/restore penceresi artı 30 gün korunur ve sonra fiziksel silinir. Secret ve özel içerik hiçbir log veya tombstone'a yazılmaz. Güvenlik redaksiyonu ve kalıcı silme bu sürelerden bağımsız açık yaşam döngüleridir.

- **Silinen belgeler ve uygulama kayıtları kalıcı olarak silinmeden önce geri yüklenebilir çöp kutusunda tutulur.**

- **Bir ana kaydı Çöp Kutusuna alma önizlemesi ona bağlı bütün Dış yüzeyleri listeler ve varsayılan olarak iptal eder.** Kullanıcı yalnız yaşayan bir Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynak kayıt silinirken ve yalnız geri alınabilir silme süresince açıkça `Onaylı dış yüzeyi koru` seçebilir; Proje, Çalışma Alanı veya Hesap silmede bu seçenek sunulmaz. Korunan yüzey son Onaylı snapshot revizyonunda donar, yeni içerik veya canlı alan yayımlayamaz ve kaynak geri yüklendiğinde otomatik yeniden bağlanmaz. Kalıcı silme, kaydı kullanan etkin Dış yüzey iptal edilip bütün hassas içerik güvenle kaldırılmadan engellenir.

- **Proje silme grubunun hangi kayıtları kapsadığı ve nasıl geri yüklendiği [ortak yaşam döngüsünde](02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) tanımlanır.** Güvenlik açısından grup 30 günlük geri alınabilir süreyi tek birim olarak izler; çocuk kayıtlar ayrı sürede kalıcı silinemez. Süre sonu veya yeniden kimlik doğrulamalı erken kalıcı silme bütün gruba uygulanır ve içerikleri kaldırır; zorunlu içeriksiz kimlik ile denetim işaretleri kalabilir.

- **İptal edilmiş Dış yüzey olağan 30 günlük Çöp Kutusuna alınabilir.** Kalıcı silme revizyon içeriğini ve Dosya Eki referanslarını kaldırır; zorunlu içeriksiz denetim işaretleri kalabilir. İptalin terminal erişim ve token semantiği [Paylaşım ve Herkese Açık Yayın](14-sharing-and-public-publishing.md#bağlantıyla-sınırlı-salt-okunur-paylaşım) belgesindedir.

- **Proje bazlı özel alanlar, öncelik ölçütleri, Akıllı Koleksiyonlar ve adlandırılmış görünümleri, Önceliklendirme oturumları, otomasyon kuralları, kullanıcı tanımlı kayıt eylemleri, belge şablonları ve iş öğesi şablonları da aynı saklama ve kalıcı silme kurallarıyla yapılandırma çöp kutusuna alınır.** Silme önizlemesi etkilenecek kayıt değerlerini ve bağımlı görünüm, kural veya referansları gösterir; çöp kutusundaki tanım etkin olarak çalışmaz.

- **Geri yükleme yapılandırma varlığının aynı iç kimliğini, tanımını, saklanan kayıt değerlerini ve çözülebilen bağımlılıklarını geri getirir.** Arada kalıcı olarak silinen veya anlamı değişen bir bağımlılık varsa ürün sessizce yeni kimlik üretmez ya da başka hedefe bağlamaz; çakışmayı önizler ve kullanıcı çözümü ister.

- **Çöp kutusu silinmemiş fakat bozulmuş veya topluca yanlış değiştirilmiş kayıtlar için geçmiş restore-point sistemi değildir.**

- **Test kayıtlarının silme, geri yükleme ve düzeltme semantiğinin tek normatif sahibi [Test kayıtlarında arşiv, Çöp Kutusu ve kalıcı silme](10-testing-and-validation.md#arşiv-çöp-kutusu-ve-kalıcı-silme) bölümüdür.** Standart içe/dışa aktarma bu yaşam döngüsünü değiştirmez; bağımsız Dosya Eki veya takip İşi kullanıcı onayı olmadan silinmez.

### Standart biçimlerde seçili kayıt dışa aktarma

- **Kullanıcı tek belgeyi Markdown veya PDF; desteklenen görünümde seçtiği kayıtları CSV veya JSON; seçili Dosya Ekini özgün biçiminde dışa aktarabilir.** İşlem başına tek kayıt türü ve tek seçili kapsamdaki yapılandırılmış kayıt dışa aktarımı en fazla 10.000 satır veya 25 MB'dir; hangisine önce ulaşılırsa sınır odur. Dışa aktarma yalnız kullanıcının erişebildiği seçili kayıt ve alanları kapsar; secret, paylaşım token'ı ve bağlantıyla sınırlı paylaşım parolası hiçbir çıktıya girmez.

- **Kesin görünüm çıktısı:** Desteklenen İş listeleri, Akıllı Koleksiyonlar ve çapraz proje listeleri ekranda görülen kesin kapsamı CSV veya okunabilir PDF snapshot olarak dışa aktarabilir. Çıktı görünüm adını, etkin filtreleri, görünür alan/kolon sırasını, sıralamayı, proje veya çalışma alanı kapsamını ve üretim zamanını taşır; yeni adlandırılmış görünüm, rapor kaydı, canlı abonelik veya doğruluk kaynağı oluşturmaz. Canlı üyelik ve hesaplanan özetler üretim anındaki değerleriyle tarihli snapshot olur; kaynak görünümün sonraki değişiklikleri çıktıyı güncellemez. İlk ürün XLS ve Atom biçimleri sunmaz.

- **Görsel bölge snapshot'ı:** Proje Duvarı ve Moodboard'da seçilen grup veya bölgeler tarihli PNG ya da PDF snapshot'ı olarak dışa aktarılabilir. PNG seçimleri ayrı görsellere, PDF'deki seçili gruplar okunabilir ayrı sayfalara dönüşür; dev tuvalin tamamını tek sayfaya sıkıştıran genel çıktı sunulmaz. Önizleme çıktının canlı kaynak bağlantısı taşımadığını, hangi görünüm anını temsil ettiğini ve uygulanacak görünüm-yerel sunum üstverisini açıklar.

- **Teknik Diyagram görsel çıktısı:** Kullanıcı kesin Diyagram Sürümü veya Diyagram Görünümünden PNG, SVG ve okunabilir sayfalanmış PDF snapshot'ı alabilir. Önizleme kaynak Teknik Diyagramı, otorite kipini, kesin sürüm ve görünümü, kapsam dışı öğeleri ve statik çıktının canlı bağlantı veya editable round-trip kaynağı olmadığını gösterir; büyük diyagram tek okunamaz sayfaya sıkıştırılmaz.

- **Teknik SQL çıktısı:** Kesin Veri Modeli Diyagramı Sürümünden üretilen PostgreSQL DDL taslağı ile onaylanmış Migration Artefaktının desteklenen SQL'i `.sql` olarak dışa aktarılabilir. Dosya kaynak/hedef sürüm hash'lerini, generator sürümünü, statik doğrulama durumunu ve uyarıları eşlik eden manifestte korur; export SQL'i çalıştırmaz, repository'ye yazmaz, database backup veya uygulanmış migration paketi oluşturmaz.

- **JSON, desteklenen seçili kayıtların kanonik yapılandırılmış round-trip biçimidir.** Güncel alan değerlerini, kararlı kimlikleri ve İş anahtar geçmişini, seçili kapsamdaki özel alan tanımlarını, kökeni ve iki ucu da seçilmiş ilişkileri taşır; olağan kayıt geçmişini taşımaz. Her çıktı açık şema sürümü taşır. Ürün kendi yayımladığı v1'den itibaren içe aktarılabilir kayıt türlerinin bütün JSON şema sürümlerini test edilmiş migration'larla destekler; bilinmeyen gelecek sürüm hiçbir yazma yapmadan reddedilir. Kaçınılmaz veri kaybı varsa import önizlemesinde alan bazında açıklanır. Teknik Diyagramın ilk üründeki export-only istisnası aşağıdaki kendi sözleşmesinin sahibidir ve bu genel round-trip vaadini miras almaz.

- **Teknik Diyagram JSON dışa aktarımı:** Seçili Teknik Diyagramın yapısal modeli, Diyagram otorite kipi, Diyagram Görünümleri ve seçili Diyagram Sürümlerinin manifesti standart JSON şemasıyla dışa aktarılabilir. Dış kaynak bağlantısı içerik sahiplenmez; yalnız izin verilen kesin köken üstverisini taşır. Bu JSON ilk üründe Teknik Diyagram oluşturma, güncelleme, restore veya editable round-trip girdisi olarak içe aktarılamaz; Diyagram Görünümü ve Diyagram Sürümü de bağımsız kayıt olarak import edilemez. Teknik Diyagram JSON import'u ayrı ürün kararı olmadan genel JSON round-trip sözleşmesine eklenmez.

- **Seçili İşin JSON round-trip'i ona ait Dış yürütme devirlerini; seçili Proje Sürümünün round-trip'i ona ait Erişim ve Sonuç gözlemlerini sahibinin içinde sürümlü şemayla taşır.** Bu sahipli bileşenler bağımsız kayıt türü olarak seçilemez, başka İş veya Sürüme tek başına içe aktarılamaz ve sahibinden ayrı kapsam/kimlik kazanamaz. Dış yürütme gidiş paketindeki secret ve erişilemeyen alan yasağı JSON dışa aktarmada da korunur; eksik veya geçersiz sahip bağı bütün kayıt import'unu atomik olarak reddeder.

- **CSV güncel görünümün düz ve kayıplı kolaylık çıktısıdır.** Kolonlar, kapsam, filtre ve sıralama ile kaybolacak ilişki, tür, kimlik veya yapı önceden raporlanır. Elektronik tablonun formül olarak yorumlayabileceği `=`, `+`, `-`, `@`, tab veya satır başı ile başlayan hücreler güvenli veri olarak escape edilir ve dönüşüm raporlanır; JSON ham değeri kayıpsız tutar. Yeniden içe aktarma yalnız ürünün kendi export kökeniyle kanıtlanmış escape'i kaldırır, kullanıcının olağan apostrof metnini değiştirmez. Markdown içerik, frontmatter ve okunabilir referansları taşır; sürüm geçmişi taşımaz. PDF görsel/statik kolaylık çıktısıdır, etiketli PDF veya PDF içinde WCAG uyumu garanti etmez; export öncesi bu sınırlama ve erişilebilir Markdown alternatifi açıklanır.

- **Çıktı, tam Wiki/proje/çalışma alanı yedeği veya geri yüklenebilir ürün paketi olarak sunulmaz.** Hesap kapatma sırasında ürün, hangi veri türünün hangi mevcut belge/görünüm/ek export'uyla alınabileceğini gösteren kapsam kontrol listesi ve bağlantılar sunar; desteklenmeyen geçmiş, ayar veya bağımlılıkları açıkça bildirir. İşlem mevcut eşzamanlı dışa aktarma sınırını aşarsa sessizce uzun süre çalışmaz; kullanıcıya kapsamı daraltması veya gelecek tam paket yeteneğini beklemesi gerektiği açıkça bildirilir.

### Standart dosyalardan içe aktarma

- **Kullanıcı tekil Markdown dosyasını Proje veya Wiki Belgesi olarak; tekil CSV ya da JSON dosyasını dosya başına tek desteklenen kayıt türü ve tek seçili kapsam için içe aktarabilir.** Bir işlem en fazla 10.000 satır veya 25 MB'dir; hangisine önce ulaşılırsa sınır odur ve daha büyük veri açıkça bölünür. İlk ürün klasör, ZIP, çok dosyalı Markdown paketi veya bütün Çalışma Alanı import'u yapmaz. Hedef kapsam, oluşturulacak/güncellenecek kayıtlar, kaynak alanların ürün alanlarına ve Proje bazlı özel alanlara dönüşümü, kayıp ve çakışmalar uygulanmadan önce gösterilir.

- **Teknik Diyagram editable import sınırı:** İlk üründeki tek editable yabancı gösterim dönüşümü [Belge içi Mermaid'den açık Teknik Diyagram dönüşümüdür](07-documents-and-knowledge.md#uygulama-içi-markdown-belge-yönetimi). PostgreSQL DDL ve DBML import'u, Draw.io/Visio/Eraser/Koboyo native biçimleri, görselden veya keyfî dosyadan AI rekonstrüksiyonu ve dış araçla canlı round-trip ilk ürün standart import yüzeyinde bulunmaz. Desteklenmeyen dosya normal Dosya Eki veya güvenli dış bağlantı olarak tutulabilir; editable Teknik Diyagram ya da kanonik kaynak gibi sunulmaz.

- **CSV/JSON import, tablo yapıştırma ve listeden İş oluşturma aynı önizleme sözleşmesini kullanır.** Geçersiz her satır kullanıcı tarafından düzeltilir veya nihai kapsamdan açıkça çıkarılır. Seçilen nihai küme atomiktir: ya bütün kayıt ve ilişkiler bir kez yazılır ya da hiçbiri yazılmaz; kayıt bazlı sessiz kısmi başarı yoktur.

- **Azami boyuttaki dosya şifreli sunucu staging alanında en fazla 24 saat tutulur ve ana kayıtları değiştirmez.** Kullanıcı kesin farkı gördükten sonra ayrı `İçe aktarmayı uygula` onayı verir. İşlem idempotency anahtarı ve taban revizyonlarıyla yürür; sonucu kayıp bağlantıda yeniden açılabilen kalıcı işlem makbuzudur. İptal yalnız atomik commit bariyerinden önce mümkündür. Bariyerden sonra durum `Sonlandırılıyor` olur ve sistem tam commit makbuzu veya tam rollback sonucu üretir.

- **Yapılandırılmış manuel, AI ajanı veya harici araç test raporu olan Markdown veya JSON dosyası yalnız [güvenli, atomik ve idempotent kabul](10-testing-and-validation.md#güvenli-atomik-ve-idempotent-kabul) ile [kanonik kimlik, parmak izi ve cevap](10-testing-and-validation.md#kanonik-kimlik-parmak-izi-ve-cevap-sözleşmesi) sözleşmelerine göre eklenebilir.** Taşınabilirlik yüzeyi aynı doğrulayıcıyı ve kararlı hata kodlarını kullanır; bu yol Belge veya İş içe aktarmasına dönüşmez ve başarısız kabul hiçbir kısmi yazma bırakmaz.

- **Kaynak veri kararlı bir özgün kayıt anahtarı veya iç kimlik taşıyorsa içe aktarma kökeni bu değeri sağlayıcı/dosya kapsamıyla birlikte korur; bu değer ürün kimliğini diriltme yetkisi değildir.** Aynı kaynak set yeniden içe aktarıldığında etkin kayıt kesin kökenle eşleşirse `mevcut kaydı güncelle`, `atla` veya `çakışmayı çöz` sonucu önizlenir. Üründe kalıcı silinmiş bir kimlik yeniden geldiğinde açık yeniden içe aktarma yeni ürün kimliği ve anahtarı üretir, önceki kökeni görünür tutar; emekli kimlik emekli kalır ve ilişkiler yeni kimliğe açık eşlemeyle kurulur. Kaynak kararlı kimlik taşımıyorsa bu sınır açıkça belirtilir ve kullanıcı onayı olmadan tahminî eşleme yapılmaz.

- **İçe aktarılan dış dosyalar veritabanı kayıtlarına dönüşür; harici dosyayla canlı bağlantı kurulmaz.** Notion, Confluence, Jira, Linear veya başka bir araca özel taşıma sihirbazı gerçek ihtiyaç doğrulanana kadar sunulmaz.

### Kullanıcı kontrollü yedekleme sınırı

- **Ürün, kullanıcıya otomatik yedek zaman çizelgesi, tam Wiki/proje/çalışma alanı yedek paketi veya geçmiş restore-point’lerinden ayrı kurtarma kopyası oluşturma özelliği sunmaz.** Standart Markdown/JSON/CSV dışa aktarımları seçili verinin taşınması içindir ve tam yedek ya da geri yükleme garantisi vermez. Hizmetin zorunlu operasyonel yedek davranışı ve hedefleri yalnız [operasyonel yedek ve kurtarma](03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma) bölümünde tanımlanır; sağlayıcı ve tatbikat ayrıntıları ayrıca açık ürün kararı beklemez.
