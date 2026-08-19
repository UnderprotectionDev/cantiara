# Paylaşım ve Herkese Açık Yayın

Bu belge Dış yüzey, Onaylı snapshot revizyonu, bağlantıyla sınırlı paylaşım, tekil Wiki yayını, Build in Public ve diğer herkese açık yayın davranışlarının tek normatif sahibidir. Güvenlik redaksiyonunun genel yayılımı [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md#database-first-guvenlik-tabani) yaşar.

## Paylaşım

<a id="ortak-snapshot-ve-dis-gorunurluk-guvenligi"></a>
### Ortak snapshot ve dış görünürlük güvenlik sözleşmesi

- **Bağlantıyla sınırlı salt okunur paylaşım, tekil Wiki yayını, Build in Public, changelog ve desteklenen dışa aktarma/sunum yüzeyleri aşağıdaki ortak sözleşmeyi kullanır.** Bu paylaşım, bağlantıyı ve varsa ortak parolayı elinde tutan herkese bearer-link erişimi verir; kimlik doğrulamalı veya kişi özelinde `Özel paylaşım` değildir. Yüzeye özgü bölümler yalnız bu sözleşmeden ayrılan kapsam, canlılık, erişim veya sunum davranışlarını tanımlar.

- **Her ürün kontrollü paylaşım veya yayın kökü, kararlı URL/token, erişim türü, parola, süre ve etkinlik durumunu taşıyan bir `Dış yüzey` ana kaydıdır ve yayın köküyle aynı kanonik kapsamda yaşar.** Gösterilecek kesin kayıt, alan, ilişki ve Dosya Eki sürümleri ise Dış yüzeyin bağımsız yaşayamayan, değişmez `Onaylı snapshot revizyonu` bileşenidir. Yeni onay yeni revizyon oluşturur; URL/token yaşam döngüsüyle içerik revizyonu aynı nesne değildir. Önceki revizyonlar Dış yüzey süresi dolsa veya iptal edilse de yüzey yaşadığı sürece yalnız iç denetim ve fark için korunur, eski ziyaretçi görünümü olarak seçilemez.

- **Dış yüzeyler kapalı dünya kapsamıyla başlar.** Kayıtlar, alanlar, ilişkiler, ekler, gömülü kaynaklar ve görünüm üstverisi açıkça önizlenip onaylanmadıkça kapsama girmez; görünürlük ilişki, klasör, üst belge veya görünüm üyeliği üzerinden kalıtılmaz.
- **Varsayılan çıktı, ana kaydın canlı yansıması değil; kaynak kimliği, kesin içerik/ek sürümü, kapsam ve onay zamanı bilinen salt okunur snapshot'tır.** Sonraki kaynak değişiklikleri fark önizlemesi ve yeni onay olmadan dış yüzeyi güncellemez.
- **Bir yüzey güvenli yapılandırılmış alanlarda sınırlı canlılık destekliyorsa canlı alanlar tek tek izin listesine alınır ve `Canlı` olarak işaretlenir.** Serbest metin, yeni kayıt, yeni ilişki, yeni ek ve yeni ek sürümü varsayılan olarak snapshot'ta kalır. Karma yüzey `Bazı alanlar canlı`, bütünü dondurulmuş yüzey `Onaylı snapshot` olarak gösterilir; yanıltıcı genel `Güncel` etiketi kullanılmaz.
- **Önizleme özel kayıt adı, ilişki ucu, iletişim bilgisi, dosya üstverisi, görünüm boşluğu ve benzeri dolaylı sızıntıları da denetler.** Kapsamdan çıkarılan içerik, varlığını boşluk, sayaç, sıra atlaması veya kırık çizgiyle ele vermez.
- **Ürün tarafından [tanınan çözülmemiş yer tutucular](07-documents-and-knowledge.md#yer-tutucu-soz-dizimi) kaynak kayıt, alan ve metin bağlamıyla aynı önizlemede gösterilir.** Kapsam veya gizlilik onayı bu uyarıyı kabul etmiş sayılmaz; kullanıcı içeriğe döner ya da ayrı `Yine de paylaş/yayımla` onayı verir. Sistem normal cümlelerden anlamsal eksiklik tahmin etmez ve AI kullanmaz.
- **İptal veya yayından kaldırma, ürünün kontrol ettiği her sayfa ve varlık isteğinde Dış yüzey etkinliğini cache tesliminden önce doğrulayarak yeni erişimi hemen fail-closed reddeder.** Cache purge ve arama indeksi temizliği asenkron takip işidir; yönetim yüzeyi durumu ve yeniden denemeyi gösterir fakat purge başarısızlığı içeriği yeniden erişilebilir yapmaz. Statik export geri çağrılabilir gibi sunulmaz; üçüncü taraf cache, indirme, ekran görüntüsü veya bağımsız kopyaların tamamen geri alınabileceği vaat edilmez.
- **Dış yüzey kaynak kaydı, iç durumu, herkese açık etiketi, planlama üyeliğini veya başka bir yayın yüzeyini örtük değiştirmez; ziyaretçiye çalışma alanı yetkisi, düzenleme veya ilişkiler üzerinden ek erişim vermez.**
- **Dış yüzey ve Onaylı snapshot revizyonları [güvenlik redaksiyonunun tek sahipli yayılım sözleşmesine](13-data-security-and-portability.md#database-first-guvenlik-tabani) katılır.** Paylaşım yönetimi etkilenen revizyonu içerik sızdırmadan redaksiyon durumuyla gösterir ve redakte edilmiş değeri eski ziyaretçi görünümü olarak sunmaz.

- **Dış yüzey kalıcı silindiğinde revizyon içeriği ve Dosya Eki referansları kaldırılır; URL/token ile içeriksiz yaşam ve denetim işaretleri yeniden kullanımı engellemek için kalabilir.** Dış yüzey Hesap ve Çalışma Alanından uzun yaşayamaz.
- **Tekil kaynak silinirken açıkça korunan Dış yüzey son Onaylı snapshot revizyonunda donmuş ve kaynaktan ayrılmış olarak yaşayabilir.** Yüzey yeni onay, canlı alan güncellemesi veya kaynak düzenleme bağlantısı sunmaz; kaynak geri yüklenirse kullanıcı kesin farkı inceleyip yeni açık bağlama ve yayınlama onayı vermeden yeniden bağlanmaz. Proje, Çalışma Alanı veya Hesap silme bütün kapsanmış Dış yüzeyleri terminal olarak iptal eder; geri yükleme eski URL/token'ı canlandırmaz ve yeniden yayın yeni Dış yüzey gerektirir.
- **Her sayfa ve asset yanıtı `Referrer-Policy: no-referrer`, kısıtlayıcı CSP ve dış bağlantılarda `rel="noreferrer"` kullanır.** Ziyaretçi onayı öncesinde üçüncü taraf istek veya script yüklenmez. Loglar token, bearer URL, parola veya temizlenmemiş paylaşım adresi içermez.
- **Her Dosya Eki ve range isteği ürün kontrollü, yüzeye özgü asset URL'sinden geçer; Dış yüzey/erişim oturumu, kesin dosya sürümü ve geçerli byte aralığı her istekte doğrulanır.** Ham herkese açık R2 adresi veya doğrulamayı atlayan yeniden kullanılabilir origin/CDN URL'si açıklanmaz; cache'lenmiş payload yalnız edge/origin etkinlik kontrolünden sonra teslim edilir, offline ya da stale erişim penceresi yoktur. Eşzamanlılık ve rate limit uygulanır. İptal veya süre dolumu CDN durumundan bağımsız olarak dosyayı hemen engeller.
- **Dış yüzey şablonları masaüstü yanında kabul anındaki destek matrisine sabitlenen güncel ve bir önceki iOS Safari ile Android Chrome'da responsive salt okunur ziyaretçi deneyimi sunar.** Bu gereksinim kimlik doğrulamalı mobil ürün veya native mobil uygulama açmaz.

### Bağlantıyla sınırlı salt okunur paylaşım

- **Kullanıcı seçili Belge, Roadmap, Ekran, Proje Duvarı, Moodboard, Teknik Diyagram, Akıllı Koleksiyon veya tekil İş, Karar, Risk, Geri Bildirim, Üretim Olayı, Kilometre Taşı ya da Proje Sürümü kaydı için iptal edilebilir salt okunur paylaşım bağlantısı oluşturabilir.**

- **Ekran paylaşımında oluşturma önizlemesi gösterilecek kesin Wireframe sürümünü açıkça seçtirir.** Onaylı snapshot revizyonu Ekran kimliğiyle bu kesin sürümü birlikte korur; Ekranın sonraki Wireframe sürümü mevcut bağlantıda sessizce görünmez ve yalnız fark önizlemesi ile yeni onaydan sonra yeni snapshot revizyonuna girer.

- **Ürün-owned Teknik Diyagram paylaşımı:** `Üründe yazılmış model` veya `İçe aktarılmış bağımsız kopya` kipindeki Teknik Diyagramın oluşturma önizlemesi kesin Diyagram Sürümü ile Diyagram Görünümünü açıkça seçtirir. Onaylı snapshot revizyonu Teknik Diyagram kimliği, türü, otorite kipi, kesin yapısal model sürümü, görünüm ve onaylı öğe kapsamını birlikte korur. Canlı Teknik Diyagramdaki sonraki düğüm, alan, bağlantı veya yerleşim değişikliği mevcut bağlantıda sessizce görünmez; kullanıcı canlı–paylaşılan farkı inceleyip yeni snapshot revizyonunu ayrıca onaylar.

- **Dış kaynak bağlantılı diyagram paylaşımı kesin köken snapshot'ıdır.** Bu kipte yapısal Diyagram Sürümü veya Diyagram Görünümü aranmaz. Kullanıcının ayrı ayrı seçip onayladığı kesin URL, bilinen dış revision/güncelleme zamanı, son kullanıcı kontrol zamanı ve sağlayıcı etiketi ile yalnız bu alanlardan ve ürünün sağlayıcı simgesinden üretilen güvenli statik link kartı değişmez Onaylı snapshot revizyonunu oluşturur; dış başlık, görsel veya içerik snapshot'a kopyalanmaz. Dış kökenin sonraki değişikliği mevcut bağlantıya sessizce yansımaz; yeni kesin köken snapshot'ı fark önizlemesi ve ayrı onay ister. Paylaşım dış aracı iframe ile açmaz, ziyaretçiye dış edit yetkisi vermez, dış içeriği cache'lemez veya dış kaynağın hâlâ güncel/erişilebilir olduğunu vaat etmez.

- **Oluşturma önizlemesi bağlantının göstereceği kayıtları, alanları ve ekleri kapalı dünya kapsamı olarak listeler.** Paylaşım bir adlandırılmış görünümden başlatılırsa o görünümün filtreleri, düzeni, görünür alanları ve varsa yerel grup/sütun sunum sırası yalnız ilk onay önizlemesine tek seferlik taslak olur. Kullanıcı kayıt ve alanları yine açıkça onaylar; görünüm erişim izni olmaz ve sonraki görünüm değişiklikleri mevcut bağlantıya otomatik yayımlanmaz.

- **Oluşturma önizlemesi yer tutucu, hassas veri, kapalı dünya kapsamı ve dolaylı sızıntı denetimlerinde ortak snapshot ve dış görünürlük güvenlik sözleşmesini kullanır.**

- **Proje Duvarı veya Moodboard paylaşımında kartlar ve kesin Dosya Eki sürümleri tek tek onaylanır.** Duvar yerleşimi, grup başlıkları, görsel çizgiler, görünüm metinleri, odak sırası, renk/palet, kırpma/döndürme ve işaretleme katmanı ayrı paylaşım öğeleri olarak önizlenir; hiçbir öğe kaynak kart veya dosyanın onayını örtük olarak vermez. Duvara eklenmiş canlı Akıllı Koleksiyon özet bloğu; kaynak görünüm tanımı, gösterilecek kesin kayıt kümesi, alanlar ve sunum üstverisiyle ayrı öğe olarak onaylanır. Özel bağlantıda yalnız ayrıca canlılığı onaylanan güvenli yapılandırılmış alanlar güncel kalabilir; yeni üyeler, serbest metin, ilişki veya ekler fark önizlemesi olmadan görünmez. Çıkarılan özel öğelere ait çizgi uçları, boş başlıklar, koleksiyon üyelik ipuçları veya konum boşlukları özel yapıyı dolaylı biçimde ele vermeyecek güvenli salt okunur snapshot'a dönüştürülür.

- **Bağlantıya sahip ziyaretçi yalnız onaylı kapsamı inceleyebilir; çalışma alanına erişemez, yorum, reaksiyon veya çizim ekleyemez, ortak düzenleme gerçekleştiremez ve paylaşılan yüzeyi düzenlenebilir proje/duvar kopyasına dönüştüremez.** İlişkili kayıt adı, alanı, geri bağlantısı, satır içi referansı, salt okunur canlı içerik kaynağı veya gömülü görünüm içeriği ayrıca paylaşım kapsamına alınmadıkça gösterilmez. Paylaşım token’ı özel kayıtlara ilişki üzerinden erişim kazandırmaz ve görünürlük başka kayıtlara miras kalmaz. Yakalama Gelen Kutusu, çözümlenmemiş Toplu Anlamlandırma girdileri ve kaydedilmemiş taslaklar hiçbir paylaşım kapsamını miras almaz.

- **Roadmap veya Akıllı Koleksiyon paylaşımında ilk eşleşen kayıtlar tek tek onaylanır.** Daha önce onaylanmış kayıtlar aynı ana kaynaktan gösterilmeye devam eder; yalnız ürünün güvenli olarak tanımladığı, önizlemede kullanıcı tarafından ayrıca seçilip `canlı` olarak işaretlenen yapılandırılmış alanlar bağlantıda güncel değerlerini gösterebilir. Bu izin listesi varsayılan olarak kapalıdır ve serbest metni, yeni ilişkileri, yeni ekleri veya eklerin yeni sürümlerini kapsamaz.

<a id="canli-alan-izin-listesi"></a>
- **Canlılığı ayrıca onaylanabilen alanlar yalnız kullanıcıya dönük durum ve kapanış sonucu, öncelik, planlanan başlangıç/hedef/yeniden görünme tarihi, Roadmap ufku, Kilometre Taşı durumu, Proje Sürümü durumu ve kaynağı açılabilir sayısal veya tarihsel hesaplanmış özetlerdir.** Başlık, açıklama, Markdown, kullanıcı yorumu, ilişki gerekçesi, Contact/Company verisi, URL, Dosya Eki, yeni ek sürümü, secret ve özel alanlar canlı izin listesinde değildir. Yeni alan eklemek güvenlik incelemesi ve bu bölümde açık değişiklik gerektirir.

- **Canlı olarak onaylanmamış alan değişiklikleri son onaylı değerinde kalır; yeni serbest metin, ilişki, ek ve ek sürümü paylaşım farkı önizlemesiyle yeniden onaylanmadan gösterilmez.** Filtreye sonradan giren yeni kayıtlar yalnız paylaşım farkında aday olur ve açık onay verilmeden ziyaretçiye görünmez. Daha önce onaylanan bir kayıt filtre üyeliğini yalnız canlılığı onaylanmış alanlardaki değişiklik nedeniyle kaybederse bağlantıdan kalkabilir; diğer değişiklikler kapsamı sessizce daraltmaz. Bu hibrit davranış yalnız bağlantıyla sınırlı paylaşım yüzeyine aittir ve Build in Public snapshot’ını değiştirmez.

- **Bağlantıyla sınırlı paylaşım yüzeyi son kapsam onay zamanını görünür kılar.** Tamamen dondurulmuş içerik `Onaylı snapshot`, canlılığı ayrıca onaylanan değerler `Canlı`, ikisini birlikte taşıyan kayıt ise `Bazı alanlar canlı` olarak işaretlenir; karma kaydın ayrıntısı hangi kesin alanların canlı olduğunu açıklar. Yüzeyin tamamı canlı değilse genel `Güncel` etiketi kullanılmaz. Onay bekleyen değişiklik ve yeni adayların varlığı yalnız sahibin fark ekranında gösterilir; ziyaretçiye içerik, sayaç, boşluk veya başka dolaylı ipucuyla sızdırılmaz.

- **Bağlantı ziyaretçi hesabı gerektirmez ve kullanıcı tarafından iptal edildiği anda yeni erişimi durdurur.** Kullanıcı bağlantıya isteğe bağlı parola ekleyebilir, parolayı değiştirebilir veya kaldırabilir. Parola, bağlantıyla birlikte iletilebilen ortak bir sırdır; ziyaretçi kimliği, kişi bazlı izin/iptal veya denetim kaydı sağlamaz ve kimlik doğrulamalı paylaşım gibi sunulmaz.

- **Ziyaretçi token'lı URL'yi ve varsa parolayı doğruladıktan sonra backend yalnız bu Dış yüzeye bağlı `HttpOnly`, `Secure` erişim oturumu oluşturur ve tarayıcıyı token içermeyen temiz URL'ye yönlendirir.** Temiz URL başka tarayıcı veya oturumda erişim vermez. Erişim oturumu tarayıcı kapanışında veya oluşturulduktan en geç 12 saat sonra sona erer; etkinlik süreyi uzatmaz. Parola değişikliği/kaldırılması, süre dolumu ve iptal mevcut oturumları hemen geçersiz kılar.

- **Token ve parola denemeleri Dış yüzey ile ham IP veya yeniden kullanılabilir parmak izi saklamayan, gizlilik koruyucu ağ/cihaz sinyalleri katmanlarında hız sınırına tabidir.** Yanıtlar yüzey veya parola varlığını açıklamayan genel hata ve artan cooldown kullanır. Sinyal, yüzeye özgü anahtarlı kaba ağ prefix'i ve asgari cihaz bağlamıyla sınırlıdır; anahtar döner ve veri son denemeden sonra en geç 24 saatte silinir. Yalnız toplu güvenlik olayları normal güvenlik log süresine kalır. Şüpheli olay kullanıcıya token/parola döndürme eylemi sunar; anonim ziyaretçi hesabı üretmez.

- **Kullanıcı bağlantıya isteğe bağlı sona erme tarihi ve saati ekleyebilir; varsayılan otomatik süre yoktur.** Değer kullanıcının profil saat diliminde girilir ve kesin saat dilimiyle gösterilir. Süre dolduğunda bütün mevcut erişim oturumları ve yeni erişim durur; kaynak kayıt, son Onaylı snapshot revizyonu, parola ve Build in Public yayını değişmez. Kullanıcı süresi dolmadan tarihi uzatabilir. Dolduktan sonra yeniden etkinleştirme iki ayrı eylem sunar: varsayılan `Yeni bağlantıyla yeniden paylaş` yeni Dış yüzey/URL üretir; `Aynı bağlantıyı yeniden aç` bütün eski bağlantı sahiplerinin yeniden erişebileceğini açıkça uyarır ve ayrı onay ister.

- **`İptal et` geri döndürülemez durum geçişidir; aynı URL/token hiçbir zaman yeniden etkinleştirilemez veya başka Dış yüzey için kullanılamaz.** Sonraki paylaşım yeni Dış yüzey, URL, token ve revizyon zinciri oluşturur. Geri yüklenen tarihsel kayıt iptal durumunu korur ve erişimi canlandırmaz; saklama süresi ile kalıcı silme etkisi [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md#saklama-ve-guvenli-silme-sureleri) yaşar.

- **Paylaşımı açmak, süresini değiştirmek veya yeniden etkinleştirmek kaynak kaydın veya ilişkili içeriğin durumunu, herkese açık etiketini ya da Build in Public yayın snapshot’ını değiştirmez.**

- **Bağlantıyla sınırlı paylaşım Build in Public yayınından ayrıdır.**

### Paylaşım ve Yayınlar yönetimi

- **Proje ve çalışma alanı düzeyindeki `Paylaşım ve Yayınlar` yüzeyi bütün aktif, süresi dolmuş ve iptal edilmiş Dış yüzeyleri, yayımlanmış Wiki sayfalarını ve Build in Public yüzeylerini tek yönetim dizininde gösterir.** Her satır kapsamı ve kaynak kaydı, parola durumunu, varsa sona erme zamanını ve `Aktif`/`Süresi doldu`/`İptal edildi` durumunu, son onay zamanını, yayımlanmamış değişiklik bulunup bulunmadığını, anonim toplam görüntülenme ile son erişim zamanını ve duruma uygun `Kaynağı aç`, `Farkı gözden geçir`, `Süreyi değiştir/Yeniden etkinleştir`, `İptal et/Kaldır` veya `Çöp Kutusuna taşı` eylemlerini sunar.

- **Yüzey yeni içerik kopyası veya ayrı yayın sistemi oluşturmaz; mevcut paylaşım ve yayın kayıtlarını yönetir.** Görüntülenme bilgisi yalnız anonim toplam ve son erişim gibi temel toplamlardır; tekil ziyaretçi kimliği, IP profili, cihaz izi veya kişi bazlı hareket geçmişi üretmez.

- **İndekslenmiş bir yüzey iptal edildiğinde eski URL içerik ve varlık sızdırmayan genel `410 Gone` ile yanıt verir, `noindex` olur, sitemap'ten çıkarılır ve ürün kontrollü arama/cache temizleme isteği başlatılır.** Üçüncü taraf kopyaların tümüyle silineceği vaat edilmez. URL hiçbir zaman yeniden kullanılmaz, yeni yüzeye veya özel içeriğe yönlendirilmez.

### Tekil Wiki belgesi yayınlama

- **Kullanıcı seçili bir Wiki belgesini proje Build in Public yüzeyinden bağımsız, iptal edilebilir bir herkese açık sayfa olarak yayımlayabilir.** Yayın, ortak snapshot ve dış görünürlük güvenlik sözleşmesine uyan kesin belge sürümünü kullanır.

- **Yayın önizlemesi satır içi referansları, geri bağlantıları, ekleri, çocuk belgeleri, canlı Akıllı Koleksiyon bloklarını, salt okunur canlı içerik bölümlerini ve diğer gömülü kaynakları ayrı ayrı listeler.** Bunlar açıkça onaylanmadıkça herkese açık çıktıda gösterilmez; canlı bloklar ve canlı içerik bölümleri onaylandığı andaki kaynak ve tarih etiketi bulunan salt okunur snapshot olarak yayımlanır ve özel kayıtlara geçiş sağlamaz.

- **Wiki sayfası varsayılan olarak `noindex` kullanır, sitemap’e eklenmez ve kullanıcı tarafından iptal edildiğinde uygulamanın yönettiği yeni erişim ile cache temizliği tetiklenir.** Kullanıcı indekslemeyi ayrıca etkinleştirebilir; üçüncü taraf cache veya kopyaların tamamen geri alınamayacağı önceden açıklanır. Ziyaretçi yorum, oy, geri bildirim, abonelik veya ortak düzenleme yapamaz.

<a id="build-in-public"></a>
## Build in Public

### Kapalı dünya ve açık izin listesi

- **Build in Public Proje bazında isteğe bağlı etkinleştirilir ve bu belgedeki [ortak snapshot ve dış görünürlük güvenlik sözleşmesinin](#ortak-snapshot-ve-dis-gorunurluk-guvenligi) kapalı dünya kapsamını kullanır.**

- **Yayın önizlemesi başlık, alan, ek, kaynak, geri bağlantı, gömülü içerik ve erişilebilir ilişki yollarını olası hassas bilgi sızıntısı açısından denetler.** Özel kayıt adı, iletişim bilgisi, dosya veya ek üstverisi ya da ilişki gerekçesi açıkça yayımlanmadıkça herkese açık yüzeye çıkmaz.

### Onaylı yayın snapshot'ı

- **Herkese açık yayın Dış yüzey ana kaydı ve ona sahipli Onaylı snapshot revizyonu ayrımını kullanır.** Ana kayıttaki sonraki değişiklikler `Yayımlanmamış değişiklikler` olarak fark görünümünde sunulur ve yalnız yeni yayın önizlemesi ile kullanıcı onayından sonra yeni Onaylı snapshot revizyonuna girer. Dış yüzey URL/token/süre/iptal yaşamını, revizyon ise kesin gösterilebilir içeriği taşır.

- **Herkese açık snapshot'a alınan Dosya Eki onay anındaki kesin dosya sürümünü kullanır.** Aynı ana eke daha sonra yeni sürüm yüklenmesi herkese açık dosyayı sessizce değiştirmez; mevcut ve önerilen sürüm yayın farkında gösterilip yeniden onaylanana kadar önceki herkese açık sürüm erişilebilir kalır.

- **Seçili Proje Duvarı kapalı dünya snapshot'ı olarak eklenebilir.** Yayın farkı kart ve alanlarla birlikte yerleşimi, grupları, grup başlıklarını, görünüm metinlerini, görsel çizgileri, odak sırasını, görünüm renklerini ve kesin sürüme bağlı kırpma/döndürme ile işaretleme katmanlarını ayrı ayrı gösterir. Canlı Akıllı Koleksiyon özet bloğu herkese açık yüzeyde canlı sorgu çalıştırmaz; onaylanan kesin kayıt, alan, kaynak görünüm ve tarih etiketiyle salt okunur snapshot olur. Kapsamdan çıkarılan özel kartların çizgi uçları, boş grupları, koleksiyon üyelik ipuçları, sıra atlamaları veya konum boşlukları özel yapıyı dolaylı biçimde açığa çıkaramaz. Ana duvarın sonraki değişiklikleri mevcut herkese açık snapshot'ı otomatik güncellemez.

- **Herkese açık snapshot'taki YouTube kartı ancak kart, özgün URL ve üçüncü taraf yükleme davranışı ayrıca onaylandıysa gösterilir.** Ziyaretçiye `Canlı dış kaynak` etiketi ve gizlilik/çerez uyarısı gösterilir; oynatıcı yalnız ziyaretçinin eylemiyle yüklenir. Kart kullanılamıyorsa yüzey özel üstveri sızdırmadan güvenli bağlantı veya açıklanabilir hata fallback'ine döner.

- **Herkese açık Roadmap'te ziyaretçinin plan yorumunu değiştirecek bir fark — herkese açık etiket, gösterilen tam tarih/ay/çeyrek veya Roadmap kapsamına giriş-çıkış — yayımlanırken kullanıcıya isteğe bağlı `Değişikliği açıkla` alanı sunulur.** Açıklama tam önceki ve yeni herkese açık değerlerle aynı yayın olayına bağlanır ve herkese açık gelişim akışında gösterilebilir. Sistem açıklama üretmez; alan zorunlu değildir ve ana plan alanı ya da ikinci plan doğruluk kaynağı oluşturmaz.

### Yayınlama ve gizlilik denetimleri

- **Kullanıcı yayımlanacak içerik ve alanları seçebilir, belirli içerikleri özel tutabilir ve daha önce yayımlanmış içeriği herkese açık görünümden kaldırabilir.**

- **Proje bazlı arama motoru indeksleme kontrolü varsayılan olarak kapalıdır.** Herkese açık sayfa URL'yi bilen herkes tarafından erişilebilir kalır ancak kullanıcı açıkça indekslemeyi etkinleştirene kadar `noindex` kullanılır ve sayfa uygulamanın sitemap'ine eklenmez. Etkinleştirme öncesinde herkese açık keşfedilebilirlik ile arama motorları ve diğer üçüncü taraf cache'lerinde kalabilecek kopyaların tamamen geri alınamayacağı açıklanır.

- **Kaldırma işlemi kaynak erişimini hemen fail-closed reddeder ve ortak dış görünürlük güvenliğiyle uygulamanın yönettiği herkese açık cache ile arama indeksini temizler.** Temizleme güvenli biçimde yeniden denenir; tamamlanma veya hata yönetim yüzeyinde görünür. İnternet üzerinde üçüncü tarafların daha önce aldığı ekran görüntüsü veya bağımsız cache kopyalarının geri alınabileceği vaat edilmez.

### İç durumların herkese açık sunumu

- **Kullanıcı Proje bazında ayrıntılı iç İş durumlarını az sayıda, ziyaretçi tarafından anlaşılır herkese açık etikete eşler.** Eşleme aynı ana İşin yalnız yayın sunumudur; ayrı herkese açık İş kaydı veya ikinci durum doğruluk kaynağı oluşturmaz. İlk ürün başlangıç eşlemeleri `Not Started → Planned`, `In Progress → In Progress` ve `Closed + Completed → Released` olur. `Blocked` ile `Closed + Abandoned` varsayılan eşleme taşımaz; bu İşler kullanıcı açıkça herkese açık etiket seçmeden yayımlanamaz. Başlangıç eşlemeleri görünür ve Proje bazında değiştirilebilir olur.

- **İç durum değişikliği herkese açık etiketi kendiliğinden değiştirmez.** Yeni herkese açık etiket yalnız yayın farkında mevcut ve önerilen değerleriyle gösterilir ve kullanıcı önizleyip onayladıktan sonra herkese açık snapshot'a girer. Herkese açık etiket değişikliği de iç İş durumunu değiştirmez.

- **Herkese açık Roadmap'e seçilen bir İş isteğe bağlı `Herkese açık başlık` ve kısa `Herkese açık özet` taşıyabilir.** Bu alanlar ayrı herkese açık İş kaydı oluşturmaz; aynı iç İşe bağlı yayın alanlarıdır ve yalnız onaylı snapshot içinde görünür. İç başlık, açıklama, kapsam, durum veya planlama bağlamı değiştiğinde mevcut herkese açık metin kendiliğinden yeniden yazılmaz. Yayın farkı iç kaynaktaki değişikliği ve mevcut dış anlatıyı birlikte gösterir; kullanıcı metni yeniden onaylayabilir, düzenleyebilir veya kaydı kapsamdan çıkarabilir.

### Herkese açık yayın üstverisi

- **Her yayın yüzeyi kendi onaylı yüzey başlığı ve kısa özet kaynağını açıkça gösterir.** Herkese açık Proje, Roadmap indeks sayfası ve changelog indeks sayfası kendi yayın ayarlarında `Yayın başlığı` ile `Yayın özeti` taşır. Roadmap içindeki İşlerin herkese açık başlık ve özet alanları yalnız kendi kartlarını, tekil changelog girdisinin başlığı ve özeti yalnız o girdiyi etkiler. Yayımlanan Wiki Belgesi ana Belge başlığı ile isteğe bağlı Belgeye özgü herkese açık özeti kullanır. Bu alanlar birbirine miras olmaz.

- **Herkese açık Proje, Roadmap, changelog ve isteğe bağlı indekslenebilir Wiki yüzeyi aynı onaylı üstveriden varsayılan üretilen, isteğe bağlı `Arama başlığı`, `Meta açıklaması` ve okunabilir `Slug` alanları taşır.** Bu dar yayın alanları genel Page/SEO modeli, ana içerik alanı veya keyword yönetim sistemi oluşturmaz.

- **Open Graph ve diğer desteklenen sosyal paylaşım önizlemeleri ayrı başlık veya açıklama doğruluk kaynağı taşımaz; aynı onaylı üstveriyi ve Proje logosu ya da ürünün güvenli standart görselini kullanır.** Custom social image, gelişmiş schema/structured-data editörü, keyword yönetimi ve analytics bu kapsamda bulunmaz.

- **Üstveri herkese açık snapshot'ın parçasıdır.** Varsayılan veya kullanıcı tarafından yazılmış değerlerdeki değişiklik yayın farkında gösterilip onaylanmadan canlı yüzeyi değiştirmez. Üstverinin bulunması yüzeyi kendiliğinden indekslenebilir yapmaz.

- **Slug Çalışma Alanı içinde benzersiz canonical herkese açık yol oluşturur.** Slug değişikliği uygulanmadan önce eski URL'den yeni canonical URL'ye redirect üretileceği gösterilir. Redirect yalnız yüzey herkese açık kaldığı sürece çalışır; unpublish veya paylaşım iptalinde özel içeriğe yönlendirmez ve ilgili cache ile indeks temizliğiyle kaldırılır.

### Herkese açık Proje görünümü

- **Herkese açık Proje görünümü son onaylanmış Proje özetini sunar.** Ziyaretçiler yayımlanan Roadmap, İşler, Belgeler, tasarımlar, Kararlar ve seçilmiş Proje Duvarı snapshot'larını inceleyebilir; Çalışma Alanını değiştiremez veya yüzeyi düzenlenebilir Proje kopyasına dönüştüremez.

- **Oturum açmış Proje sahibi herkese açık görünüm bağlamında yalnız kendisine gösterilen `Kaynak kaydı aç` ve `Yayın farkını gözden geçir` yönetim eylemlerini kullanabilir.** Bu eylemler ana kaydı normal özel ürün yüzeyinde veya ilgili yayın farkı önizlemesini açar; snapshot üzerinde doğrudan düzenleme yapmaz. Ziyaretçiler bu kontrolleri görmez.

- **Kullanıcı tarihli bir İş için hedef tarih sunumunu `Tam tarih`, `Ay`, `Çeyrek` veya `Gizli` olarak seçer.** Ay ve çeyrek iç hedef tarihten türetilir; bağımsız herkese açık tarih alanı oluşturulmaz. İç hedef tarih değişirse dış tahmin yeni yayın farkı onaylanana kadar değişmez.

- **Kullanıcı daha önce onaylanmış tek bir herkese açık Proje Sürümünü veya önemli Kararı görünümün üst bölümünde sınırlı süre öne çıkarabilir.** Özellik varsayılan olarak kapalıdır; aynı anda en fazla bir kayıt seçilebilir ve kullanıcı bitiş zamanını belirler. Öne çıkarma özel veriyi yayımlamaz, yeni içerik veya bildirim/abonelik üretmez; süre dolduğunda kayıt normal kronolojik konumuna döner.

- **Herkese açık Roadmap ve changelog başlığı Proje profilindeki isteğe bağlı logoyu kullanabilir.** Bunun dışındaki renk, tema, tipografi ve düzen ürünün standart erişilebilir herkese açık görsel sisteminden gelir.

### Herkese açık gelişim akışı

- **Herkese açık gelişim akışı kullanıcının yayımladığı zaman çizelgesi olaylarını kronolojik Proje hikâyesi olarak gösterir.** Kullanıcının bir Roadmap yayın farkı için yazdığı `Değişikliği açıkla` notu aynı yayın olayına bağlı olarak bu akışta yer alabilir. Sistem otomatik blog, değişiklik açıklaması veya dönemsel ilerleme metni üretmez.

### Tek yönlü yayın ve temel istatistikler

- **Build in Public yüzeyi ziyaretçiden özel veya herkese açık geri bildirim, yorum ya da oy almaz.** Ziyaretçi profili, talep sayacı, cevap dizisi, herkese açık changelog aboneliği veya gelişim akışı aboneliği oluşturmaz.

- **Kullanıcı herkese açık Proje görünümünün ve yayımlanmış içeriklerin anonim toplam görüntülenme ve son erişim zamanı gibi temel bilgilerini inceleyebilir.** Özellik tekil ziyaretçi kimliği, IP profili, cihaz izi, kişi bazlı hareket geçmişi, gelişmiş analitik veya ziyaretçi profilleme sistemi oluşturmaz.
