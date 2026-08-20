# Gelecek Yönleri

Bu belge yalnız doğrulama kanıtı ve yeni ürün kararıyla kapsama alınabilecek adayların tek sahibidir; ayrıntılı anlatım teslim taahhüdü oluşturmaz.

## Gelecekte değerlendirilecek ürün yönleri

Bu belgedeki yönler yalnız dogfooding veya ayrıca yapılan doğrulama yeterli kanıt ürettiğinde yeni bir ürün kararıyla kapsama alınır. Bir yönün burada ayrıntılı anlatılması teslim taahhüdü oluşturmaz.

Bu belge iki açık sınıf taşır. `Sözleşmeli aday`, [Doğrulama katmanları](#doğrulama-katmanları) tablosunda kararlı bir `Sözleşme kimliği` ile listelenen ve gövdesinde tam olarak `Tetikleyici`, `İlk dilim`, `İlerleme ve bırakma ölçütü` parçalarını taşıyan 15 yöndür; bu üç parçalı biçim yalnız o tabloda kimliği bulunan başlıklarda kullanılır. Diğer bütün başlık ve anlatılar `Bağlayıcı olmayan yön notu`dur ve üç parçalı biçimi kullanmaz; ilk ürün veya kararlaştırılmış genişleme emri oluşturamaz. Bir yön notu ancak kapsam, tetikleyici, sahiplik, yaşam döngüsü, kabul ve teknoloji etkisini ilgili normatif belgelere ekleyen ayrı Kararla sözleşmeli adaya dönüşür; uygulamanın başlaması ya da başlığın değiştirilmesi tek başına terfi değildir.

<a id="alanlar-arasi-uzman-arac-dogrulama-portfoyu"></a>
## Alanlar arası uzman araç doğrulama portföyü

Bu bölüm, mevcut ürün alanlarını tekrar etmeyen ve kendine özgü çalışma deneyimi üreten uzman araç adaylarının portföyünü toplar; hiçbir davranış, kayıt veya kabul kuralının normatif sahibi değildir ve buradaki ayrıntı ilgili alan belgelerindeki hükümlerin yerine geçmez. Aşağıdaki adaylar [ilk ürünün zorunlu kapsamına](01-product-vision-and-scope.md#kapsam-dili) veya [Ürün Kabulüne](16-product-acceptance.md#kapsam-izlenebilirligi) eklenmiş değildir. Bir aday ancak burada belirtilen bağımlılık ve doğrulama kapılarını geçtikten sonra ayrı ürün kararıyla kapsama alınabilir; o kararda kesin veri modeli, yaşam döngüsü, alan sahibi davranışı ve kabul koşulları sırasıyla ilgili `02`–`14` belgesine ve `16-product-acceptance.md` dosyasına eklenir.

<a id="uzman-arac-ortak-dogrulama-kapisi"></a>
### Ortak doğrulama ve kapsam kapısı

Bir adayın ürün amacıyla uyumlu olması; ilk ürüne alınması, doğrulama sırasındaki yeri veya hangi PRD alanına ait olduğu kararından ayrıdır. Uyum tek başına teslim taahhüdü oluşturmaz. Mevcut bir yeteneği farklı adla tekrarlayan, açık kapsam sınırıyla çatışan veya gerekli başka kayıt ya da araç kararı henüz verilmemiş aday doğrulama sırasına alınmaz.

Kendine özgü kalıcı çıktı ve yaşam döngüsü üretmeyen bir birleştirme, karşılaştırma veya odak görünümü bağımsız özellik ya da ana kayıt olmaz; ilgili mevcut yeteneğin kullanıcı deneyimi olarak kalır. Kullanıcının geliştirdiği ürünün iş alanı davranışını, aktörlerini, verisini, durumlarını, sözleşmelerini veya izinlerini modellemek ürün amacıyla uyumludur; bu modeller bu uygulamanın kendi mimarisi, kayıt yaşam döngüsü, ekip rolü veya erişim yetkisiyle aynı kavramlar değildir.

Bir adayın doğrulanması için aynı gerçek proje üzerinde aşağıdaki sonuçların birlikte gözlenmesi gerekir:

- Mevcut ürün yüzeyleriyle güvenilir biçimde çözülemeyen gerçek ve tekrar eden bir kullanıcı işi bulunur.
- Aday, bu işi daha az bağlam kaybı veya daha az yeniden kurma hatasıyla tamamlatır ve yeniden açılabilir, kullanılabilir bir çıktı bırakır.
- Çıktı mevcut ana kayıtların içeriğini kopyalayan paralel doğruluk kaynağı oluşturmaz.
- Başarı yalnız prototipin anlaşılır, güzel veya beğenilmiş olmasıyla değil; kullanıcının aldığı sonucun ölçülebilir biçimde iyileşmesiyle gösterilir.

İlk deneme bu eşiği karşılamazsa aday yeni ana kayıt türüne, tam editöre veya ilk ürün taahhüdüne dönüşmez; kanıtlanmamış gelecek yönü olarak kalır. Başarılı deneme de adayı kendiliğinden kapsama almaz; kesin kapsam için ayrıca PRD kararı gerekir.

<a id="uzman-arac-ortak-urun-sozlesmesi"></a>
### Ortak ürün sözleşmesi

Bu portföyden kapsama alınacak her araç aşağıdaki ortak sınırları izler:

- Araç içindeki kart, düğüm, çizgi, işaret ve bölüm varsayılan olarak aracın sahipli bileşenidir. Paylaşılan bir ana kayda dönüşüm; hedef türü, başlangıç alanlarını, proje kapsamını ve oluşacak köken ilişkisini gösteren açık önizleme ile kullanıcı onayı ister. Dönüşümden sonra araç aynı içeriği kopyalamaz, ana kaydı canlı referans olarak gösterir.
- Araç içindeki yerel bağlantı kendiliğinden kalıcı ürün ilişkisine dönüşmez. Kalıcı ilişki ayrı kullanıcı eylemi, kesin iki uç ve fark önizlemesiyle kurulur; mevcut [ilişki ve geri bağlantı](08-search-relations-and-evidence.md#içerik-ilişkileri-ve-geri-bağlantılar) semantiğini kullanır.
- Sistem doğruluk, tamlık, sağlık, önem, öncelik, etki, coverage veya yayıma hazır olma hükmü üretmez. Kullanıcı onayı olmadan ana kayıt oluşturmaz, kayıt alanı ya da yaşam durumu değiştirmez ve takip işi açmaz.
- Canlı kartlar kesin ana kaynağı; tarihsel kanıtlar kesin kaynak ve sürümü açar. Yeni sürüm geçmiş bağı sessizce güncellemez; çözülemeyen, redakte edilmiş veya erişilemeyen kaynak başka kayda yönlendirilmez. Bu davranış [kaynak sürümü karşılaştırması](08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması) ile [etkileşim tutarlılığı](15-product-quality.md#etkilesim-tutarliligi) sözleşmelerini yeniden kullanır.
- Paylaşım ve dışa aktarma, kaynak projeyi veya bağlı özel kayıtları ilişki üzerinden açmaz. Kullanıcının seçtiği kesin öğe ve sürümler mevcut [kapalı dünya önizleme ve snapshot güvenliği](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) üzerinden ayrıca onaylanır.
- Tuval, harita ve matrislerin görsel yüzeyine ek olarak aynı temel oluşturma, seçme, sıralama, gruplama, bağlama, bağlantıyı kaldırma, inceleme ve kaynak açma işlerini sunan klavye ve ekran okuyucu uyumlu yapılandırılmış görünüm bulunur; [ortak erişilebilirlik sözleşmesi](15-product-quality.md#erisilebilirlik) gevşetilmez.

<a id="uzman-arac-kayit-ve-gorunum-sahipligi"></a>
### Kayıt ve görünüm sahipliği

Araçların kalıcı sahipliği aşağıdaki ayrımı korur:

| Aday | Kalıcı sahiplik kararı |
| --- | --- |
| Arayüz Envanteri ve Örüntü İncelemesi | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; kesin Dosya Eki sürümüne bağlı ekran görüntüsü referansı, örüntü grubu ve bulgu sahipli bileşendir |
| Kanıt ve Gerekçe Haritası | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; iddia düğümü ile yönlü gerekçe çizgisi sahipli bileşendir |
| Uçtan Uca Dilimleme Planı | Özelliğin içinde kalıcı bir bölümdür; Dilim sahipli bileşendir ve ayrı ana kayıt, backlog öğesi ya da bağımsız plan değildir |
| Alan Olayları Panosu | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; yerel tuval öğeleri sahipli bileşendir |
| Dar Geçmiş Bağlam Görünümü | Mevcut kayıt, ilişki, sürüm ve olay geçmişinden hesaplanan salt okunur görünümdür; yeni tarihsel içerik ana kaydı oluşturmaz |
| Üretim Olayı Önleme Zinciri | Mevcut Üretim Olayı, İş, Planlı Test Senaryosu, kesin Test Oturumu veya Oturum Testi sonucu, Proje Sürümü ve yalnız açık anlam taşıyan kesin ilişkilerden hesaplanan salt okunur görünümdür; ikinci olay, önlem veya yayın kaydı oluşturmaz |
| Akış Kötüye Kullanım İncelemesi | Kullanıcı Akışına ait, incelediği kesin akış sürümünü gösteren kalıcı sahipli bileşendir; yerel bulgu ayrı ana kayıt, backlog öğesi veya bağımsız yaşam döngüsü değildir |
| Hizmet Tasarım Planı | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; şerit ve kopukluk işaretleri sahipli bileşendir |
| Durum ve Geçiş Modelleyicisi | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; durum, geçiş, koşul ve yan etki sahipli bileşendir |
| Sistemler Arası Veri Sözleşmesi Alanı | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; örnek, hata ve sürüm farkı sahipli bileşendir |
| Bilgi Kökeni Görünümü | Mevcut köken, dönüşüm, yerine-geçme ve sürüm ilişkilerinden hesaplanan salt okunur görünümdür |
| Kavram Haritası | Kendi kimliği ve sürüm geçmişi bulunan proje ana kaydı; sabit türdeki yerel düğüm ve çizgiler sahipli bileşendir |
| Varsayım Karşılaştırma Haritası | Mevcut Varsayım, deney, kanıt ve karar kayıtlarından hesaplanan görünümdür; konum tercihi dışında ikinci varsayım kaydı tutmaz |
| Görsel Değişiklik İncelemesi | Mevcut Test Oturumu ve görsel kanıtlar üzerinde uzman görünümdür; kullanıcı değerlendirmesi oturuma bağlı kalıcı inceleme sonucu, bölge notu ise kesin görsel sürümüne bağlı bileşendir |
| Durum–Test İzlenebilirlik Matrisi | Durum ve Geçiş Modelleyicisi ile mevcut test kayıtlarının kesin ilişkilerinden hesaplanan salt okunur matristir |

<a id="uzman-araclari-besleyen-ortak-kayitlar"></a>
### Uzman araçları besleyen ortak kayıtlar

Aşağıdaki sekiz proje kapsamlı kayıt öneridir; hiçbiri üründe bulunmaz. Tablo bu adaylar için sahiplik, yaşam döngüsü, alan kümesi, ilişki veya kabul kararı vermez ve bir kayıt ihtiyacının burada anılması onu ürünün kayıt envanterine eklemez. [Ana kayıt türleri ve asgari sözleşmeler](02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) envanteri kapalıdır: bir aday kayıt yalnız ayrı bir ürün kararıyla o envantere eklenerek gerçek ana kayıt türüne dönüşebilir, bu belgedeki anlatı böyle bir ekleme gerekçesi ya da izni oluşturmaz.

Bir aday kaydın önerilebilmesi için onu kullanan ilk aracın doğrulanmış olması ve kesin yaşam döngüsü ile kabul koşullarının aynı kararda ilgili domain sahibi belgeye yazılması gerekir; hiçbiri tek başına boş bir kayıt paketi olarak önerilmez. Öneri kapsama alınırsa başka projede yeniden kullanım açık kopya ile, projeden bağımsız uzun açıklama ise Kişisel Wiki'ye aktarım ile yapılır; projeler arasında canlı ortak kimlik kurulmaz.

| Aday kayıt ihtiyacı | Önerilen ayırt edici anlam | İlk olası tüketici adayı |
| --- | --- | --- |
| İş Kuralı | Kullanıcının tasarladığı ürünün yürürlükteki davranış kuralıdır; Karar bu kuralın neden seçildiğini açıklayabilir fakat kural metnini kopyalamaz | Alan Olayları Panosu |
| Proje Kısıtı | Hukuki, teknik, platform, ticari veya operasyonel olduğu bilinen etkin sınırdır; Risk belirsiz bir olumsuz olasılıktır | Uçtan Uca Dilimleme Planı |
| Alan Terimi | Proje içinde kısa ve kanonik tanımdır; Kişisel Wiki uzun açıklamayı taşır ve terime referans verir | Alan Olayları Panosu |
| Ürün Yeteneği | Tasarlanan ürünün kalıcı kullanıcı yeteneğidir; Özellik teslim çalışmasıdır ve Yetenek backlog durumu veya ilerleme taşımaz | Arayüz Envanteri ve Örüntü İncelemesi veya Uçtan Uca Dilimleme Planı |
| Ürün Aktörü | Kullanıcının tasarladığı üründeki insan ya da sistem rolüdür; gerçek Contact, Persona belgesi veya bu uygulamadaki ekip rolü değildir | Alan Olayları Panosu veya Hizmet Tasarım Planı |
| Kullanım Senaryosu | Aktörün hedefini, önkoşulunu, başarılı sonucunu, ana ve alternatif yollarını ekran ve teknolojiden bağımsız anlatır; Kullanıcı Akışı arayüz yolunu taşır | Uçtan Uca Dilimleme Planı veya Hizmet Tasarım Planı |
| Alan Olayı | Tasarlanan ürünün iş alanında anlamlı olay türüdür; Proje Etkinliği, GitHub olayı veya Üretim Olayı değildir | Alan Olayları Panosu |
| Veri Varlığı | Tasarlanan üründeki iş verisinin anlamını, hassasiyetini ve izin verilen akışını modeller; gerçek veri veya veritabanı şeması değildir | Sistemler Arası Veri Sözleşmesi Alanı |

<a id="birinci-dogrulama-grubu"></a>
### Birinci doğrulama grubu

Bu grup portföyün ilk doğrulama sırasıdır; listedeki sıra aynı anda geliştirme taahhüdü oluşturmaz.

#### Arayüz Envanteri ve Örüntü İncelemesi

Gerçek bir ürünün uygulanmış ekranlarını, durumlarını ve tekrar eden arayüz örüntülerini envanterler; kesin görsel konuma kullanıcı bulgusu sabitler. Bulgunun kaynağı, kullanıcı tarafından seçilen sınıflandırması ve önemi araçta korunur; çözüm yaşam döngüsü açık önizlemeyle bağlanan mevcut İş, Bug veya Test Açığında kalır. Kullanılabilirlik ilkeleri incelemesi ayrı araç değil, bu yüzeyin sınıflandırma kipidir. Aday ancak gerçek ekranlarla yapılan denemede mevcut Wireframe, Moodboard, Dosya Eki ve görsel işaretleme yüzeylerinden daha güvenilir bir inceleme sağlarsa; en az bir tekrar veya tutarsızlığın geliştirme işine kaynak bağını kaybetmeden taşınmasını kolaylaştırırsa ilerler. Yalnız ekran görüntülerini yan yana göstermek yeterli kanıt değildir.

#### Kanıt ve Gerekçe Haritası

Kullanıcı iddiaları destekleyen, çelişen, koşula bağlayan veya yanıtsız bırakan kesin kanıt, Varsayım ve Karar ilişkileriyle yönlü haritada kurar; araç otomatik sonuç çıkarmaz. Aday ancak gerçek bir Kararın dayanaklarını ve açık çelişkilerini mevcut [Kanıt Akışından](08-search-relations-and-evidence.md#kanıt-akışı) daha anlaşılır ve daha az hatayla görünür kılarsa ilerler.

#### Uçtan Uca Dilimleme Planı

Tek bir Özelliği kullanıcı sonucu, görünen deneyim, domain davranışı, veri veya entegrasyon etkisi ve doğrulama yaklaşımı boyunca küçük Dilimlere ayırır. Dilim tarih, durum, öncelik veya bağımsız yaşam döngüsü taşımaz; yürütüm mevcut İş, Test, PR ve Proje Sürümü kayıtlarında kalır. Aday ancak büyük bir Özelliği teknik katmanlar yerine bağımsız gözlenebilir kullanıcı sonuçlarına böldüğünü ve her Dilimin sınanabilir olduğunu gerçek işte gösterirse ilerler.

#### Alan Olayları Panosu

Komut, Alan Olayı, Ürün Aktörü, politika ve dış sistem öğelerini zaman sırasındaki neden–sonuç akışıyla düzenleyerek kullanıcının tasarladığı ürünün iş alanı davranışını keşfeder; bu uygulamanın kendi mimari veya erişim modelini anlatmaz. Aday ancak gerçek bir özellikte teknik mimari ya da Kullanıcı Akışında görünmeyen davranış, İş Kuralı veya Açık Soruları ortaya çıkarırsa ilerler.

#### Dar Geçmiş Bağlam Görünümü

Bütün projeyi keyfî bir tarihte yeniden kurmak yerine seçili Özellik veya Kararın tarihsel bağlam konisini gösterir: o anda görünen içerik, bağlı kanıt, karar, risk ve test sürümleri ile bugünkü fark. Aday ancak geçmiş bir kararın hangi bilgilerle alındığını yeniden kurma süresini veya hatasını anlamlı biçimde azaltırsa ilerler.

<a id="ikinci-dogrulama-grubu"></a>
### İkinci doğrulama grubu

Bu grup, birinci grubun doğrulama öğrenimleri ve gerekli ortak kayıtların gerçek kullanımından sonra ele alınır.

#### Hizmet Tasarım Planı

Kullanıcı eylemi, görünen temas, arka plan süreci, destek sistemi ve kanıt şeritlerini aynı hizmet akışında eşler. Aday ancak mevcut Müşteri Yolculuğu ve Kullanıcı Akışının gösteremediği ön yüz–arka plan bağlantılarını, sorumluluk geçişlerini veya kopuklukları gerçek projede görünür kılarsa ilerler.

<a id="durum-ve-gecis-modelleyicisi"></a>
#### Durum ve Geçiş Modelleyicisi

Kullanıcının tasarladığı üründeki bir varlığın durumlarını, izin verilen geçişlerini, geçiş koşullarını, yan etkilerini ve geçersiz yollarını modeller. Aday ancak tekrar eden yaşam döngüsü kurallarını görünür kılarak gerçek bir modelleme veya uygulama hatasını önlerse ilerler; yapılacaklar takibi ya da bu uygulamanın kendi kayıt yaşam döngüsü editörü olmaz.

#### Sistemler Arası Veri Sözleşmesi Alanı

Sistemler arasındaki istek, yanıt veya olay örneklerini; hataları, sürümleri ve uyumluluk farklarını birlikte tasarlar. Aday ancak gerçek ve tekrar eden sistem bağlantısı sorunlarını mevcut teknik mimari veya Belge yüzeyinden daha açık çözerse ilerler. Dış sisteme istek göndermez, sözleşmeyi çalıştırmaz, mock server, SDK veya ayrı developer portalı üretmez.

#### Bilgi Kökeni Görünümü

Bir kaydın Yakalama veya import kaynağından dönüşümlerine, yerine-geçme zincirine ve ondan türeyen hedeflere kadar kesin köken yolunu gösterir. Aday ancak mevcut geri bağlantılar, Kaynak kökeni ve sürüm geçmişi gerçek bir kararın nereden geldiğini açıklamakta tekrar tekrar yetersiz kalırsa ve görünüm bu araştırma süresini azaltırsa ilerler.

#### Kavram Haritası

Alan Terimi, İş Kuralı, Ürün Yeteneği, Karar ve kesin kanıtları sabit düğüm ve ilişki türleriyle gezilebilir bir proje haritasında birleştirir. Aday ancak ortak kayıtlar gerçek projede kullanıldıktan sonra aralarındaki anlamı liste, arama ve Proje Duvarından daha anlaşılır kılarsa ilerler; serbest çizim veya genel amaçlı whiteboard olmaz.

#### Varsayım Karşılaştırma Haritası

Mevcut Varsayımları kullanıcı tarafından seçilen etki ve belirsizlik konumlarında karşılaştırır; deney, kanıt ve Karar ilişkilerini ana kayıtlarından açar. Aday ancak düz listenin zorlaştırdığı doğrulama yatırımı karşılaştırmasını gerçek projede kolaylaştırırsa ilerler. Sistem konumu değiştirmez ve önem, öncelik, güven veya doğruluk puanı üretmez.

#### Görsel Değişiklik İncelemesi

Dışarıda yürütülmüş testten gelen referans ve sonuç görüntülerini yan yana, kaydırıcı veya fark katmanıyla gösterir; kullanıcı kesin bölgeye bulgu sabitler ve mevcut İş, Bug veya Test Açığına bağlar. Değerlendirme [Test Oturumunda bildirilen tarihsel sonucu](10-testing-and-validation.md#test-oturumu-ve-kaynak-ayrımı) yeniden yazmaz. Aday ancak mevcut genel test kanıtı görünümünün karşılayamadığı tekrarlanan görsel karşılaştırmaları daha güvenilir sonuçlandırırsa ilerler.

<a id="bagimli-ucuncu-dogrulama-adayi"></a>
### Bağımlı üçüncü doğrulama adayı

#### Durum–Test İzlenebilirlik Matrisi

Bu aday Durum ve Geçiş Modelleyicisi kapsama alınıp gerçek projede güvenilir durum kaynağı olduğunu kanıtlamadan doğrulanamaz. Açılırsa durum ve geçişleri kesin Planlı Test Senaryosu sürümleri ile bildirilen test sonuçlarına bağlanan hücrelerde gösterir; ilişkisi olmayan hücreyi yalnız `Bağlanmadı` olarak sunar. Eksik test, coverage yüzdesi, kalite hükmü, otomatik Test Açığı veya yayın kapısı üretmez.

<a id="ozel-kanit-bekleyen-uzman-araclar"></a>
### Özel kanıt bekleyen uzman araçlar

Bu bölümdeki adaylar ürünle uyumludur fakat iki ayrı kapıdan ilerler. Adlandırılmış bağımlılık bekleyen adaylar, belirtilen önkoşul çözülmeden doğrulama sırasına alınmaz. Doğrudan dogfooding kanıtı bekleyen adayların önkoşulu ise kendi deney ve öldürme ölçütüdür; deney başarısı yine teslim taahhüdü oluşturmaz.

#### Adlandırılmış bağımlılık bekleyen adaylar

- **Yetki Modelleyicisi:** Kullanıcının tasarladığı üründe aktör, kaynak, eylem, koşullu izin ve istisnaların gerçek projelerde tekrar eden karmaşık bir problem olması gerekir. Bu uygulamanın gelecekteki ekip rolleriyle karıştırılmaz.
- **Ürün İletişim Akışı:** Aynı Ürün Mesajının birden fazla tetikleyici, hedef aktör, kanal, geri dönüş ve kullanıcı kontrolü akışında tekrar kullanılması gereği kanıtlanmalıdır. Bu kanıt oluşursa `Ürün Mesajı` kayıt ihtiyacı araçla birlikte kararlaştırılır; Birleşik Bildirim Merkezini çoğaltmaz.
- **Fiyat ve Paket Tasarım Alanı:** [Ticari genişlemede](17-commercial-expansion.md#ilk-urun-sonrasi-ticari-genisleme) gerçek paket seçeneklerini yetenek, limit, ölçüm birimi, hedef kitle ve fiyat varsayımıyla karşılaştırma ihtiyacı ortaya çıkmalıdır. Bu kanıt oluşursa `Fiyatlandırma Paketi` kayıt ihtiyacı araçla birlikte kararlaştırılır; Proposal veya Invoice yerine geçmez.

#### Doğrudan dogfooding kanıtı bekleyen adaylar

<a id="uretim-olayi-onleme-zinciri"></a>
##### Üretim Olayı Önleme Zinciri

Bir Üretim Olayından o olay için yapılan düzeltmeye, tekrarını önlemek için tanımlanmış Planlı Test Senaryosuna, bu senaryoya ait kesin Test Oturumu veya Oturum Testi sonucuna ve düzeltmenin yayımlandığı kesin Proje Sürümüne uzanan yolu salt okunur görünümde gösterir. Zincire yalnız anlamı açıkça verilmiş ilişkiler girer; tarih yakınlığı, metin benzerliği, aynı Projede bulunma veya genel `İlgili` ilişkisi düzeltme, önleme ya da yayımlanma nedeni sayılmaz. Eksik bir bağ yalnız seçili olayda `Düzeltme bağı eksik`, `Tekrar-önleme kanıtı eksik` veya `Yayın bağı eksik` gibi türetilmiş dikkat bilgisi olabilir; Projenin ya da Proje Sürümünün doğruluğu, tamlığı veya yayıma hazır olduğu hakkında hüküm üretmez ve takip işi açmaz.

İlk doğrulama üç gerçek Üretim Olayında mevcut olay detayı ve geri bağlantıları kullanan geçici prototipte, kullanıcı tarafından deney için açıkça verilen bağ rolleriyle yapılır; bu roller kalıcı ürün ilişkisi olmaz. Aday ancak en az iki olayda mevcut yüzeylerde kaybolan bir tekrar-önleme veya yayın kanıtını doğru biçimde görünür kılarsa ilerler. Kullanıcının sonrasında mevcut kayıtlarda işlem yapması ikincil gözlem olarak kaydedilebilir fakat ilerleme kapısı değildir. Bu sonuç oluşmazsa görünüm bırakılır. İlk deney yalnız Planlı Test Senaryosu ile ona ait kesin Test Oturumu veya Oturum Testi sonucunu tekrar-önleme kanıtı olarak kullanır; başka kanıt türleri ancak üç olaylık deneyden sonra ayrı ilişki kararıyla açılabilir. Sonuç oluşursa bile genel `İlgili` ilişkisi yeniden yorumlanmaz; gerekli uzman ilişki türleri kesin uçları, anlamı, kardinalitesi ve silme davranışıyla [standart ilişki türleri](02-domain-model-and-lifecycle.md#standart-ilişki-türleri) için ayrı PRD kararı ister.

<a id="akis-kotuye-kullanim-incelemesi"></a>
##### Akış Kötüye Kullanım İncelemesi

Kullanıcının seçtiği tek ve kesin Kullanıcı Akışı sürümünde, normal başarı ve hata yollarının hangi kullanıcı veya dış aktör davranışıyla kötüye kullanılabileceğini insan değerlendirmesiyle inceler. İnceleme Kullanıcı Akışına ait kalıcı sahipli bileşendir; kesin kaynak sürümünü, yerel senaryoları ve bulguları taşır fakat bağımsız ana kayıt, ikinci backlog, durum veya yaşam döngüsü oluşturmaz. Yeni akış sürümü eski incelemeyi güncelmiş gibi devralmaz. Kullanıcı değerli bir bulguyu mevcut Risk, Açık Soru veya Planlı Test Senaryosu kaydına dönüştürmek isterse hedef türü, başlangıç alanları, kesin akış sürümü ve köken bağı açıkça önizlenir; onaydan önce ana kayıt oluşmaz ve yerel bulgu hedef kaydın kopyasına dönüşmez.

İlk doğrulama üç gerçek ve kritik Kullanıcı Akışı sürümünde yapılır. Aday ancak en az iki akışta normal Risk ve Planlı Test Senaryosu incelemesinin kaçırdığı, kullanıcının mevcut bir kayıt türüne dönüştürmeye değer bulduğu bir kötüye kullanım yolu ortaya çıkarırsa ilerler; aksi durumda uzman araç geliştirilmez. İlk yön altyapı tehdit modelleme, genel yetkilendirme tasarımı, güvenlik kontrol veya varlık envanteri ve otomatik risk üretimini kapsamaz. Başka kaynak türleri ya da birden fazla kaynağı birleştiren inceleme ayrı tekrarlanan ihtiyaç ve yeni PRD kararı gerektirir.

### Doğrulama katmanları

Bu belgedeki aşağıdaki adayların katmanı değer veya kesin geliştirme sırası değildir; hangi varsayımın ne zaman dürüstçe sınanabileceğini gösterir. `Yakın doğrulama` ilk ürünün ardından düşük maliyetli deney yapılabileceğini, `Bağımlı` adlandırılmış önkoşul doğrulanmadan yönün açılamayacağını, `Uzak` ise uzun dönemli davranış kanıtı gerektiğini belirtir. `Sözleşme kimliği` bulunan 15 satır bu belgenin sözleşmeli adaylarıdır ve üç parçalı sözleşme biçimini yalnız onlar taşır; `—` taşıyan satır aynı tabloda yönlendirme amacıyla bulunan bağlayıcı olmayan yön notudur. Hiçbir katman uygulama taahhüdü oluşturmaz.

| Katman | Aday yön | Sözleşme kimliği |
| --- | --- | --- |
| Yakın doğrulama | [Tek Seferlik Gerçeklik Devir Teslimi](#tek-seferlik-gerçeklik-devir-teslimi) | `tek-seferlik-gerçeklik-devir-teslimi` |
| Yakın doğrulama | [Tek Sonuca Kilitlenen Çalışma Kipi](#tek-sonuca-kilitlenen-çalışma-kipi) | `tek-sonuca-kilitlenen-çalışma-kipi` |
| Yakın doğrulama | [Kanıtlı Çapraz-Proje Öğrenme Hafızası](#kanıtlı-çapraz-proje-öğrenme-hafızası) | `kanıtlı-çapraz-proje-öğrenme-hafızası` |
| Yakın doğrulama | [Kayıt Değil Soru Odaklı Proje İşletimi](#kayıt-değil-soru-odaklı-proje-işletimi) | `kayıt-değil-soru-odaklı-proje-işletimi` |
| Yakın doğrulama | Geri Döndürülebilir Proje Değişikliği Provası → [Alternatif planlama senaryoları](#alternatif-planlama-senaryoları) | — |
| Yakın doğrulama | [Proje-Öncesi Fikir İnkübatörü](#proje-öncesi-fikir-inkübatörü) | `proje-öncesi-fikir-inkübatörü` |
| Yakın doğrulama | [Doğrulanabilir Yapım Hikâyesi ve Sürüm İletişim İskeleti](#doğrulanabilir-yapım-hikâyesi) | `doğrulanabilir-yapım-hikâyesi` |
| Yakın doğrulama | [Geri Döndürülebilirliğe Göre Karar Disiplini](#geri-döndürülebilirliğe-göre-karar-disiplini) | `geri-döndürülebilirliğe-göre-karar-disiplini` |
| Yakın doğrulama | [Önceden Taahhüt Edilmiş Devam/Bırakma Koşulları](#önceden-taahhüt-edilmiş-devam-bırakma-koşulları) | `önceden-taahhüt-edilmiş-devam-bırakma-koşulları` |
| Yakın doğrulama | [Bilinçli Dış Sınır Sözleşmesi ve Dış Ana Kaynak İşareti](#bilinçli-dış-sınır-sözleşmesi) | `bilinçli-dış-sınır-sözleşmesi` |
| Yakın doğrulama | [Bir Kez Söyle, Kontrollü Olarak Her Yere İşle](#bir-kez-söyle-kontrollü-olarak-her-yere-işle) | `bir-kez-söyle-kontrollü-olarak-her-yere-işle` |
| Yakın doğrulama | [Yüzey Metni Envanteri](#yüzey-metni-envanteri) | `yüzey-metni-envanteri` |
| Yakın doğrulama | [Kullanıcıya Veri Teslimi](#kullanıcıya-veri-teslimi) | `kullanıcıya-veri-teslimi` |
| Bağımlı | [Dış İncelemeyi Geri Getiren Paylaşım](#dış-incelemeyi-geri-getiren-paylaşım) | `dış-incelemeyi-geri-getiren-paylaşım` |
| Bağımlı | [Ekip Kurmadan Sınırlı İnsan Delegasyonu](#ekip-kurmadan-sınırlı-insan-delegasyonu) | `ekip-kurmadan-sınırlı-insan-delegasyonu` |
| Uzak | Gölge Yedek Gerektirmeyen Çıkış Garantisi → [Tam ürün paketi ve geri yükleme doğrulaması](#tam-ürün-paketi-ve-geri-yükleme-doğrulaması) | — |
| Uzak | Ürünün Hayatta Kalma Sözleşmesi → [Canlı Projenin Operasyonel Yükümlülükleri](#canlı-projenin-operasyonel-yükümlülükleri) | `canlı-projenin-operasyonel-yükümlülükleri` |

<a id="tek-seferlik-gerçeklik-devir-teslimi"></a>
### Tek Seferlik Gerçeklik Devir Teslimi

**Tetikleyici:** Başka bir araçta yaşayan sınırlı bir gerçeklik kümesinin ürüne bir kez taşınması, genel sağlayıcı migration kataloğu veya canlı senkronizasyon açılmadan değerlendirilebilir. Aday ancak aynı tür dış kaydın manuel yeniden kurulması gerçek projelerde tekrar eden veri kaybı, köken kaybı veya yüksek maliyet üretirse doğrulama sırasına girer.

**İlk dilim:** Kullanıcı tek kaynak dosya veya açıkça yetkilendirilmiş tek seferlik çekim için sağlayıcıyı, kesin kaynak kapsamını, hedef Projeyi, tür ve alan eşlemelerini, reddedilecek kayıtları, ilişki kaybını ve tekrar eşleme anahtarını bütün yazmalardan önce görür. Sonuç desteklenen mevcut ana kayıtlara atomik ve idempotent biçimde yazılır; özgün dış kimlik yalnız köken olarak korunur. İşlem dış kaynağı izlemez, çift yönlü senkronizasyon kurmaz, dış kaydı silmez ve ikinci bir ürün kimliği diriltmez.

**İlerleme ve bırakma ölçütü:** Aday, iki gerçek devirde manuel yeniden kurmaya göre daha az kayıp ve daha güvenilir köken üretmeden ilerlemez. Sağlayıcıya özgü bakım yükü taşınan değeri aşarsa, güvenli tekrar eşleme kanıtlanamazsa veya kullanıcı dış kaynağı sürekli canlı tutmak zorunda kalırsa yön bırakılır; yeni connector taahhüdü oluşmaz.

<a id="tek-sonuca-kilitlenen-çalışma-kipi"></a>
### Tek Sonuca Kilitlenen Çalışma Kipi

**Tetikleyici:** Kullanıcının kısa bir çalışma aralığında tek açık sonucu görünür tutma ihtiyacı, mevcut Günlük Odak, Odak Dönemi ve İş bağlamının gerçek kullanımda tekrar tekrar yetersiz kalmasıyla doğrulanır. Bu kip yeni İş, Sprint, çalışma oturumu ana kaydı, zamanlayıcı veya zorunlu süreç kapısı değildir.

**İlk dilim:** Kullanıcı mevcut bir Proje Hedefi, Özellik, İş veya açık Test Açığını sonuç çapası olarak seçer. Görünüm yalnız açıkça seçilen sonuçla mevcut ilişkiler üzerinden bağlı kayıtları daraltır; kaynakların durumunu, önceliğini, Günlük Odak üyeliğini veya planlama alanlarını değiştirmez. Kipi kapatmak bütün kaynakları olduğu gibi bırakır; kişisel son seçim sınırlı görünüm tercihi olarak saklanabilir fakat çalışma geçmişi ya da performans ölçümü üretmez.

**İlerleme ve bırakma ölçütü:** Aday ancak üç gerçek çalışma aralığında bağlam değiştirme veya yanlış işe dönme maliyetini azaltırsa ilerler. Mevcut Günlük Odak filtresiyle aynı sonucu verirse, kullanıcı ikinci bir planı sürdürmek zorunda kalırsa ya da sonuç seçimi fiilî onay kapısına dönüşürse yön bırakılır.

<a id="kanıtlı-çapraz-proje-öğrenme-hafızası"></a>
### Kanıtlı Çapraz-Proje Öğrenme Hafızası

**Tetikleyici:** Bir projede öğrenilen bilginin başka projede yeniden kullanılmasına rağmen bağlamı ve kanıtı kayboluyorsa, projeler arasında canlı ortak domain kaydı oluşturmayan kanıtlı öğrenme hafızası değerlendirilebilir. Kişisel Wiki uzun ömürlü açıklamanın ana kaynağı; proje kayıtları ise tarihsel uygulama ve kanıt kaynağı olarak kalır.

**İlk dilim:** kullanıcı seçili Karar, Deney/Doğrulama, Kullanıcı Araştırması Oturumu, Üretim Olayı veya Proje kapanış özetinden kesin sürüm ve köken bağlantılarıyla bir Kişisel Wiki öğrenim belgesi oluşturur. Sistem metni kendiliğinden sentezlemez; kullanıcı iddiayı, geçerli bağlamı, bilinen istisnaları ve dayanak sürümlerini onaylar. Başka projede kullanım aynı Wiki kaydına referans verir veya açık kopya üretir; kaynak Proje kaydını çalışma alanı geneline taşımaz.

**İlerleme ve bırakma ölçütü:** Aday, en az üç gerçek yeniden kullanımda öğrenimi bulma süresini veya bağlam hatasını azaltmadan ilerlemez. Kanıt bağı güncellik garantisi, otomatik doğruluk puanı veya bütün projelere uygulanabilirlik hükmü üretmez. Kullanıcı Wiki ve proje kayıtlarında aynı iddiayı ayrı ayrı güncel tutmaya başlarsa yön bırakılır.

<a id="kayıt-değil-soru-odaklı-proje-işletimi"></a>
### Kayıt Değil Soru Odaklı Proje İşletimi

**Tetikleyici:** Kullanıcının “Bu kararı neden aldım?” veya “Bu sürümü ne engelliyor?” gibi soruları yanıtlamak için kayıt türleri arasında tekrar tekrar manuel gezinmesi doğrulanırsa, soru odaklı salt okunur proje görünümü değerlendirilebilir. Yüzey yeni Soru kaydı, sohbet geçmişi veya paralel proje özeti oluşturmaz.

**İlk dilim:** İlk dilim ürünün önceden tanımladığı dar soru kataloğunu kullanır ve yanıtı yalnız mevcut kayıt, kesin sürüm ve açık ilişkilerden deterministik olarak kurar. Her sonuç hangi kaynak ve ilişki nedeniyle gösterildiğini açar; cevaplanamayan kısım eksik olarak kalır. Serbest doğal dil çıkarımı, AI sentezi, otomatik ilişki veya kayıt değişikliği bu yönün parçası değildir.

**İlerleme ve bırakma ölçütü:** Aday ancak gerçek projede tekrarlanan üç sorudan en az ikisini mevcut arama ve geri bağlantılardan daha hızlı ve daha az hatayla yanıtlatırsa ilerler. Katalog genel dashboard'a dönüşürse, sonuç açıklanamazsa veya yeni bir rapor doğruluk kaynağı gerektirirse yön bırakılır.

<a id="proje-öncesi-fikir-inkübatörü"></a>
### Proje-Öncesi Fikir İnkübatörü

**Tetikleyici:** Henüz Proje açmayı hak etmeyen fakat Yakalama Gelen Kutusunda geçici kalamayacak ürün fikirlerinin tekrar eden biçimde kaybolması doğrulanırsa çalışma alanı kapsamlı dar bir fikir inkübatörü değerlendirilebilir. Bu alan Backlog, Roadmap, Opportunity, yatırım portföyü veya ikinci proje sistemi değildir.

**İlk dilim:** `Fikir Adayı`; kısa problem/fırsat ifadesi, köken yakalamaları, isteğe bağlı kanıt bağlantıları, son inceleme zamanı ve kullanıcı tarafından yönetilen `İzleniyor`, `Projeye dönüştürüldü`, `Bırakıldı` sonuçlarından birini taşır. Projeye dönüşüm hedef Proje profilini ve taşınacak/köken olarak kalacak bağları önizler, yeni Proje kimliği üretir ve özgün adayın tarihsel sonucunu korur. Sistem fikir puanlamaz, benzer adayları otomatik birleştirmez veya Proje açmaz.

**İlerleme ve bırakma ölçütü:** Aday ancak en az beş gerçek fikirde Yakalama Gelen Kutusunu uzun süreli depoya çevirmeden doğru zamanda proje kararı alınmasını kolaylaştırırsa ilerler. Kullanıcı adayları fiilî Backlog olarak planlamaya başlarsa, bakım yükü değeri aşarsa veya mevcut Yakalama + Proje akışı yeterliyse yön bırakılır.

<a id="doğrulanabilir-yapım-hikâyesi"></a>
### Doğrulanabilir Yapım Hikâyesi ve Sürüm İletişim İskeleti

**Tetikleyici:** Kullanıcının bir ürün değişikliğinin problemden gözlenen sonuca kadar hikâyesini tekrar tekrar elle kurması ve kaynak atıflarını kaybetmesi ya da bir Proje Sürümünün yayın gününde söylenecek maddelerin Notion veya benzeri bir defterde ikinci kez yazılması doğrulanırsa, aynı çapaya bağlı doğrulanabilir yapım hikâyesi ile sürüm iletişim iskeleti birlikte değerlendirilebilir. Yüzey otomatik blog, pazarlama metni veya ikinci Değer Zinciri değildir.

**İlk dilim:** kullanıcı tek Proje Hedefi ya da Proje Sürümünü çapa seçer; mevcut Değer Zinciri, gerçekleşen olaylar, kesin belge/karar/test sürümleri ve Erişim/Sonuç gözlemlerinden girecek öğeleri tek tek onaylar. Aynı çapa üzerinde yayın gününde söylenecek sahipli maddeler de seçilebilir; her madde mevcut İş, Karar, gözlem veya başka kesin kayda bağlanabilir ve kullanıcı cümlesini kendisi yazar. Sistem kronolojik, kaynak bağlantılı bir taslak iskeleti oluşturabilir fakat yorum, nedensellik ve başarı hükmünü kullanıcı yazar; iskelet yayın durumunu değiştirmez ve herkese açık changelog yüzeyi açmaz. Kaydedilen iç anlatı sürümlü Belgedir; herkese açık kullanım ayrıca ortak snapshot farkı ve onayı ister.

**İlerleme ve bırakma ölçütü:** Aday üç gerçek sürümde hikâye kurma süresini, yanlış kaynak atfını ve dış iletişim defterine ikinci kez yazma ihtiyacını azaltmadan ilerlemez. Otomatik metin kaynakta bulunmayan iddia üretirse, maddeler yine dışarıda yaşarsa, sistem kullanıcının cümlesini yazarsa, anlatı ya da iskelet Değer Zinciriyle yarışan canlı doğruluk kaynağına dönüşürse veya kullanıcı kaynakları tek tek doğrulayamıyorsa yön bırakılır.

<a id="geri-döndürülebilirliğe-göre-karar-disiplini"></a>
### Geri Döndürülebilirliğe Göre Karar Disiplini

**Tetikleyici:** Kararın geri döndürülme maliyetinin gerçek projelerde karar hızını veya gerekli kanıt düzeyini tekrar tekrar etkilediği görülürse, Karar kaydında dar bir geri döndürülebilirlik disiplini değerlendirilebilir. Bu yön otomatik önem, risk veya onay puanı üretmez.

**İlk dilim:** kullanıcı Kararı `Kolay geri döndürülebilir`, `Maliyetli fakat geri döndürülebilir` veya `Pratikte geri döndürülemez` olarak isteğe bağlı sınıflandırır; geri dönüş yolu, son güvenli karar zamanı ve ilgili Risk/Kanıt bağlarını açıklayabilir. Sınıf Karar yaşam durumunu, İş önceliğini, yayın kapısını veya zorunlu onay sayısını otomatik değiştirmez; değişiklik geçmişte önceki değer ve gerekçeyle korunur.

**İlerleme ve bırakma ölçütü:** Aday ancak en az beş gerçek Kararda doğru karar hazırlığını kolaylaştırır ve gereksiz analizi azaltırsa ilerler. Kullanıcı sınıfları tutarlı ayıramazsa, etiket yalnız önem alanına dönüşürse veya süreç kapısı beklentisi yaratırsa yön bırakılır.

<a id="önceden-taahhüt-edilmiş-devam-bırakma-koşulları"></a>
### Önceden Taahhüt Edilmiş Devam/Bırakma Koşulları

**Tetikleyici:** Deney, Özellik veya Proje değerlendirmelerinde sonucun görülmesinden sonra ölçütün geriye dönük değiştirilmesi tekrar eden karar hatası üretirse, tarihli devam/bırakma koşulları değerlendirilebilir. Koşullar sistemi kullanıcı yerine karar vermez ve otomatik kapatma yapmaz.

**İlk dilim:** kullanıcı seçili Varsayım, Deney/Doğrulama, Özellik veya Proje için değerlendirmeden önce `Devam et`, `Yeniden değerlendir` ve `Bırak` sonuçlarına bağlanabilecek açık gözlem koşullarını, değerlendirme tarihini ve izin verilen değişiklik gerekçesini kaydeder. Başlangıç sürümü ve sonraki değişiklikler değişmez tarihsel karşılaştırmada görünür; gözlenen kanıt kullanıcı tarafından bağlanır. Sistem ölçümü yürütmez, sonucu kendiliğinden seçmez veya ilgili kayıtları kapatmaz.

**İlerleme ve bırakma ölçütü:** Aday en az üç gerçek kararda hindsight değişikliğini görünür kılmadan ya da karar kalitesini artırmadan ilerlemez. Koşullar sahte kesinlik, zorunlu OKR veya genel workflow gate'e dönüşürse yön bırakılır.

<a id="bilinçli-dış-sınır-sözleşmesi"></a>
### Bilinçli Dış Sınır Sözleşmesi ve Dış Ana Kaynak İşareti

**Tetikleyici:** Bir işin kalıcı olarak dış araçta kalmasının ürün boşluğu mu yoksa bilinçli sınır mı olduğu, ya da bir gerçeğin asıl kopyasının hâlâ dışarıda olmasıyla ürün içi kaydın hangisinin ana kaynak sayıldığı tekrar tekrar karışıyorsa; Proje veya İş bağlamında açık dış sınır sözleşmesi ile mevcut kayıt üzerindeki dar bir dış ana kaynak işareti birlikte değerlendirilebilir. Bu yön dış aracı entegre etmez, izlemez veya onun gerçeğini kopyalamaz.

**İlk dilim:** kullanıcı dışarıda kalacak işi, dış ana kaynağı, üründe korunacak asgari referans ve kanıtı, geri dönüş beklentisini, sorumluluğu ve yeniden değerlendirme tetikleyicisini kaydeder. Aynı dilim, desteklenen mevcut bir kayıtta `Dış ana kaynak` işaretinin ve isteğe bağlı dış referansın açıkça konulmasını veya kaldırılmasını da kapsar; işaret tam sözleşmenin kendisi, entegrasyon ya da senkronizasyon değildir. Sözleşme mevcut Ürün Boşluğu ve Dış Araca Kaçış kayıtlarına bağlanabilir; `Bilinçli sınır` kararı ve `Dış ana kaynak` işareti geçmiş kaçışları silmez, sağlık skoru veya ürün yeteneğinin bulunduğu hükmünü üretmez ve işaretlenen kaydın yaşam döngüsünü değiştirmez. URL veya dosya kökeni erişim yetkisi vermez.

**İlerleme ve bırakma ölçütü:** Aday en az üç tekrar eden dış akışta gereksiz paralel kayıt, yanlış ürün boşluğu açılması veya yanlış boşluk/kaçış karışmasını azaltırsa ilerler. Sözleşme metni ya da işaret genel entegrasyon kataloğuna, dış sistem durum takibine veya fiilî ikinci doğruluk kaynağına dönüşürse yön bırakılır.

<a id="bir-kez-söyle-kontrollü-olarak-her-yere-işle"></a>
### Bir Kez Söyle, Kontrollü Olarak Her Yere İşle

**Tetikleyici:** Aynı açık gerçeğin birden fazla mevcut kayda elle uygulanması tekrar eden tutarsızlık üretirse, kontrollü çok kayıtlı öneri değerlendirilebilir. İlk doğrulama manuel kullanıcı ifadesiyle başlar; AI çıkarımı veya ajan yazma yetkisi önkoşul değildir ve kendiliğinden açılmaz.

**İlk dilim:** Kullanıcı tek bir değişiklik niyeti girer, hedef kayıtları açıkça seçer ve her hedefte önerilen alan/ilişki farkını tek tek görür. Uygun olmayan hedefler gerekçesiyle reddedilir; seçilen nihai küme taban revizyonlarıyla atomik ve idempotent uygulanır ya da hiç yazılmaz. Serbest script, formül, kayıt oluşturma, yaşam döngüsü geçişi, dış sistem yazması ve kalıcı yeniden kullanılabilir toplu eylem bu ilk dilimde yoktur.

**İlerleme ve bırakma ölçütü:** Aday üç gerçek çok kayıtlı değişiklikte manuel toplu düzenlemenin ifade edemediği bir tutarlılık kazanımı göstermeden ilerlemez. Hedef farkları açıklanamazsa, kullanıcı çoğu öneriyi elle düzeltirse veya işlem genel otomasyon motoruna dönüşürse yön bırakılır.

<a id="yüzey-metni-envanteri"></a>
### Yüzey Metni Envanteri

**Tetikleyici:** Kullanıcıya görünen boş durum, hata ve denetim metinlerinin tablo veya belgede Wireframe’den ayrı kalıcı ikinci defter olarak tutulması tekrar ederse, Ekrana bağlı yüzey metni envanteri değerlendirilebilir. Bu yön çeviri yönetim sistemi, e-posta aracı veya yüksek detaylı tasarım değildir.

**İlk dilim:** Kullanıcı bir Ekranın veya kesin Wireframe sürümünün sahipli `Yüzey metni` öğesine anahtar, yüzey türü ve metni yazar. Proje listesi bu öğelerden türetilir; yeni ana kayıt, locale TMS veya otomatik metin üretimi yoktur. Wireframe düzen metni ikinci kanonik kopya olmaz.

**İlerleme ve bırakma ölçütü:** Aday bir gerçek üründe dış yazı tablosunu kapatıp en az beş metni İş veya Proje Sürümüne bağlamadan ilerlemez. Tablo yaşamaya devam ederse, Figma/çeviri aracına kayarsa veya Wireframe metnini kopyalayan ikinci SoT olursa yön bırakılır.

<a id="ilk-on-dakika-vaadi"></a>
### İlk On Dakika Vaadi

Yeni hesabın ilk dakikalarda göreceği adımların Kullanıcı Akışından ayrı bir Notion listesinde tutulması tekrar ederse, Ekranlara bağlı bir kurulum vaadi yön notu olarak akılda tutulur. Bilginin dış araçta yaşaması tek başına ürün boşluğu kanıtı sayılmaz; bu not Intercom turu, zorunlu onboarding kapısı veya ikinci akış editörü önermez.

Not ileride gerçekten değerlendirilirse tartışılacak dar biçim şudur: kullanıcı sıralı vaat maddeleri yazar, her madde mevcut bir Ekrana veya Kullanıcı Akışı düğümüne bağlanabilir ve `Vaat / Henüz yok` işaretini kullanıcı koyar. Sistemin tamamlanma yüzdesi, sağlık skoru veya yayın kilidi üretmemesi bu biçimin önkoşuludur. Bir gerçek üründe dış onboarding listesi kapanmıyorsa, liste Kullanıcı Akışını kopyalıyorsa, zorunlu süreç kapısına dönüşüyorsa veya tur çalıştırıyorsa not kapanır ve konu ürün dışı liste olarak kalır.

<a id="destek-oyun-kitabı"></a>
### Destek Oyun Kitabı

Tekrarlayan kullanıcı şikâyetinde kontrol sırasının Google Doc’ta tutulması ve Üretim Olayından kopması tekrar ederse, olay veya Özelliğe bağlı bir destek oyun kitabı yön notu olarak akılda tutulur. Sıranın dış belgede yaşaması tek başına ürün boşluğu kanıtı sayılmaz; bu not helpdesk, [Üretim Olayı Önleme Zinciri](#uretim-olayi-onleme-zinciri) veya otomatik yanıt önermez.

Not ileride gerçekten değerlendirilirse tartışılacak dar biçimde kullanıcı sırası olan kontrol maddeleri yazar ve her madde mevcut Ekran, Risk veya Üretim Olayına bağlanabilir; sistemin ticket açmaması, e-posta göndermemesi ve olayı kapatmaması bu biçimin önkoşuludur. Üç gerçek şikâyette dış runbook kapanmıyorsa ya da kitap ikinci olay kaydı, SLA motoru veya Intercom kopyası hâline geliyorsa not kapanır.

<a id="kullanıcıya-veri-teslimi"></a>
### Kullanıcıya Veri Teslimi

**Tetikleyici:** Geliştirilen üründeki kullanıcının kendi verisini nasıl alacağının Cantiara’nın [seçili kayıt dışa aktarmasıyla](13-data-security-and-portability.md#kullanıcı-kontrollü-yedekleme-sınırı) karışarak dış defterde tutulması tekrar ederse, Proje kapsamında kullanıcıya veri teslimi vaadi değerlendirilebilir. Bu yön Cantiara yedeği, self-host paketi veya yasal yeterlilik değildir.

**İlk dilim:** Kullanıcı teslim biçimini, kapsadığı veriyi ve bağladığı Özellik veya Kararı yazar. Ürün o export’u çalıştırmaz ve Cantiara dışa aktarmasını sessizce bu vaat saymaz.

**İlerleme ve bırakma ölçütü:** Aday bir canlı üründe dış teslim notunu kapatmadan ilerlemez. Vaat Cantiara yedeğiyle birleşirse, otomatik dosya üretir veya hukuki hüküm olursa yön bırakılır.

<a id="altyapı-maliyeti-notu"></a>
### Altyapı Maliyeti Notu

Neon, S3 veya benzeri koşturma maliyetinin müşteri [Invoice](17-commercial-expansion.md#ilk-urun-sonrasi-ticari-genisleme) satırından ayrı bir Sheet’te tutulması tekrar ederse, Proje kapsamında bir altyapı maliyeti notu yön notu olarak akılda tutulur. Maliyetin dış tabloda yaşaması tek başına ürün boşluğu kanıtı sayılmaz; bu not muhasebe, banka uzlaştırma veya Fiyat ve Paket Tasarım Alanı önermez.

Not ileride gerçekten değerlendirilirse tartışılacak dar biçimde kullanıcı sağlayıcı, kabaca tutar, dönem ve “neden bu plan” gerekçesini yazar; bu bilgi Invoice veya teklife yazılmaz, sistem ödeme çekmez ve bütçe uyarısı üretmez. İki fatura döneminde dış maliyet Sheet’i kapanmıyorsa ya da not gelir defteri, otomatik fatura veya fiyat paketine dönüşüyorsa not kapanır.

<a id="dış-incelemeyi-geri-getiren-paylaşım"></a>
### Dış İncelemeyi Geri Getiren Paylaşım

**Tetikleyici:** Salt okunur paylaşımın dış paydaş kararını ürüne geri getirememesi nedeniyle inceleme sonucu e-posta veya başka araçta kayboluyorsa, sınırlı dış inceleme dönüşü değerlendirilir. [Kimlik doğrulamalı özel salt-okunur paylaşım](#kimlik-doğrulamalı-özel-salt-okunur-paylaşım) ve [paylaşılan içerikte bağlama sabitlenmiş asenkron geri bildirim](#paylaşılan-içerikte-bağlama-sabitlenmiş-asenkron-geri-bildirim) yönleri doğrulanmadan bu aday açılamaz.

**İlk dilim:** kullanıcı kesin Belge, Wireframe, Moodboard veya Proje Duvarı snapshot'ı için süreli bir inceleme isteği oluşturur. Yetkili dış kişi yalnız `İncelendi`, `Değişiklik istendi` veya `Yanıt veremiyorum` sonucunu, kısa notu ve izinli bağlama sabitlenmiş geri bildirimi gönderir. Sonuç kaynak kaydı düzenlemez, yayın kapısı oluşturmaz, İşi kapatmaz ve kendiliğinden Geri Bildirim/İş üretmez; iç kullanıcı açık dönüşümle takip kaydı oluşturabilir.

**İlerleme ve bırakma ölçütü:** Aday en az üç dış incelemede karar kökenini ve kapanışını mevcut paylaşım + manuel yakalamadan daha güvenilir korursa ilerler. Kimlik, iptal, saklama ve kaynak sürümü farkı güvenle çözülemezse veya dış kişi fiilen edit yetkisi beklerse yön bırakılır.

<a id="ekip-kurmadan-sınırlı-insan-delegasyonu"></a>
### Ekip Kurmadan Sınırlı İnsan Delegasyonu

**Tetikleyici:** Tek kişilik ürün kullanımında belirli bir işi dış uzmana devretme ihtiyacı tekrar eder fakat tam ekip üyeliği gerektirmezse sınırlı insan delegasyonu değerlendirilebilir. [Kimlik doğrulamalı özel salt-okunur paylaşım](#kimlik-doğrulamalı-özel-salt-okunur-paylaşım) ile [Dış İncelemeyi Geri Getiren Paylaşımın](#dış-incelemeyi-geri-getiren-paylaşım) kimlik, süre, iptal ve sınırlı sonuç dönüşü sözleşmeleri doğrulanmadan bu aday açılamaz. Aday tam ekip sisteminden, İş sorumluluğundan ve test için mevcut Test Handoff'undan ayrıdır.

**İlk dilim:** kullanıcı tek İş veya İşe bağlı test-dışı dış yürütme için adlandırılmış dış kişiyi, kesin gidiş paketini, beklenen sonucu, süreyi ve erişebileceği değişmez snapshot manifestini onaylar. Dış kişi Çalışma Alanı üyesi olmaz; başka kayıt arayamaz, ana kaydı düzenleyemez ve sonucu yalnız bu devir üzerinden geri gönderir. İç kullanıcı dönüşü uzlaştırır; İşin hesap verebilir sahibi ve kapatma yetkisi kullanıcıda kalır.

**İlerleme ve bırakma ölçütü:** Aday üç gerçek delegasyonda bağlam kaybını azaltmadan ilerlemez. Erişim kapsamı tek İşten taşarsa, kalıcı kimlik/rol/izin matrisi gerektirirse veya karşılıklı düzenleme ihtiyacı doğarsa bu yön durur ve ekip sistemi kararına aktarılır.

<a id="canlı-projenin-operasyonel-yükümlülükleri"></a>
### Canlı Projenin Operasyonel Yükümlülükleri

**Tetikleyici:** Yayımlanmış bir ürünün güvenlik, veri, erişim, yenileme ve destek yükümlülükleri İş veya hatırlatma listelerinde tekrar tekrar kayboluyorsa, canlı proje yükümlülük görünümü değerlendirilir. Bu yön canlı incident yönetimi, CMDB, pager, SLA motoru veya ikinci operasyon kayıt sistemi değildir.

**İlk dilim:** kullanıcı Proje Sürümü, Dış yüzey, entegrasyon, secret rotasyonu, veri saklama kararı, Üretim Olayı ve desteklenen tarihli ana kayıtlardan hangi yükümlülüklerin izleneceğini açıkça seçer. Görünüm mevcut kaynak, sorumlu kullanıcı, son doğrulama, sonraki gözden geçirme ve kanıt bağlantısını gösterir; yeni yükümlülük ancak kullanıcı açıkça oluşturursa kaynak bağlantılı İş veya mevcut `Yeniden bak` hatırlatması olur. Sistem uyumluluk, sağlık veya güvenlik garantisi üretmez.

**İlerleme ve bırakma ölçütü:** Aday en az iki canlı Projede üç gerçek unutulabilir yükümlülüğü doğru zamanda kaynağıyla görünür kılmadan ilerlemez. Kaynaklardan açıklanabilir biçimde türetilemezse, ayrı bakım veritabanı isterse veya kullanıcı mevcut hatırlatma/İş akışıyla aynı veriyi iki kez tutarsa yön bırakılır.

<a id="kayit-tutarliligi-tasarim-taahhudu-ve-dis-baglam-adaylari"></a>
## Kayıt tutarlılığı, tasarım taahhüdü ve dış bağlam adayları

Bu bölüm, mevcut kayıtların birbirini yanlışladığı yerleri görünür kılan, kullanıcının tasarladığı ürünün taahhütlerini modelleyen ve ürünün dış bağlamını ürün içine alan adayların portföyünü toplar; hiçbir davranış, kayıt veya kabul kuralının normatif sahibi değildir. Adaylar [ilk ürünün zorunlu kapsamına](01-product-vision-and-scope.md#kapsam-dili) veya [Ürün Kabulüne](16-product-acceptance.md#kapsam-izlenebilirligi) eklenmiş değildir ve bu bölümdeki ayrıntı teslim taahhüdü oluşturmaz.

<a id="kayit-tutarliligi-adaylari-ortak-kapi"></a>
### Ortak tetikleyici ve kanıt kapısı

Bu bölümdeki her adayın tetikleyicisi serbest gözlem değil, ürünün kendi saydığı tekrardır. Her aday adlandırılmış bir `Ürün Boşluğu` kaydına bağlanır ve o boşluğun [Dış araca kaçış günlüğünde](04-workspace-and-projects.md#dış-araca-kaçış-günlüğü) biriken tekrar sayısı doğrulama sırasına girme dayanağı olur. Kanıt oluşmadan hiçbiri doğrulama sırasına alınmaz; kanıt oluşması da kapsama alma taahhüdü değildir.

Bu bölümdeki adaylar en fazla bir yeni ana kayıt türü ve en fazla iki yeni ilişki türü açar; mevcut ana kayıtlara yeni yaşam döngüsü durumu eklemez. Yeni ana kayıt izni `Rakip` adayına ayrılmıştır ve kullanılan tek yeni ilişki türü `Karşılaştırılan yaklaşım` olup [standart ilişki türleri](02-domain-model-and-lifecycle.md#standart-ilişki-türleri) için ayrı PRD kararı ister.

<a id="kayit-bicimi-ve-sahiplik-ozeti"></a>
### Kayıt biçimi ve sahiplik özeti

| Aday | Kalıcı sahiplik kararı |
| --- | --- |
| Dayanak Geçersizleşme Kuyruğu | Hesaplanan çalışma alanı görünümü; yalnız aday satırının inceleme işareti hedef Karar ya da İş kaydının sahipli bileşenidir |
| Yerine Geçilmiş Karara Dayanan Çalışma | Tamamen hesaplanan salt okunur görünümdür; hiçbir işaret veya kayıt saklamaz |
| Tüketicisi Kapanmış Belirsizlik | Tamamen hesaplanan salt okunur görünümdür; hiçbir kaydı kendiliğinden kapatmaz |
| Ekran Durum Matrisi | Ekranın kalıcı sahipli bileşenidir; bağımsız aranamaz, ilişki ucu olamaz ve paylaşılamaz |
| Geri Alınamaz Eylem Envanteri | Kullanıcı Akışının kalıcı sahipli bileşenidir; satırları akışın kesin adımına referans verir |
| Erişilebilirlik Tasarım Kontrolü | Ekranın kalıcı sahipli bileşenidir; uyum iddiası, ölçüt numarası veya seviye taşımaz |
| Çalışma Alanı Bağlam Bütünlüğü Denetimi | Yalnız sıfır saklama gerektiren kapalı kontrolleri barındıran hesaplanan görünümdür |
| Wiki ile Proje Bilgisinin İkileşme Görünümü | Hesaplanan salt okunur görünümdür; iki sahiplik kapsamı arasında hiçbir kalıcı bağ kurmaz |
| Kaynak Yığılması Dizini | Hesaplanan salt okunur dizindir; yalnız bağlı karar sayısını olgu olarak gösterir |
| Rakip | Çalışma alanı kapsamlı ana kayıttır; iddia satırları sahipli bileşendir |
| Yayın Kanalı | Yeni ana kayıt izni bulunmayan bekleyen adaydır; kapsam kararı yeni bütçe açılmasına bağlıdır |

<a id="kapsam-sinirlarinin-onkosul-olarak-netlesmesi"></a>
### Kapsam sınırı önkoşulları

Aşağıdaki adaylar [kapsam dışı hükümlerin](19-out-of-scope.md) komşuluğunda durur. Hiçbiri o hükümleri gevşetmeyi önermez; her biri ancak kapsama alma kararında belirtilen ayrımın açıkça yazılmasıyla ilerleyebilir. Ayrım yazılmadan aday doğrulama sırasına alınmaz.

| Aday | Komşu kapsam dışı hüküm | Kapsama alınmadan önce netleşmesi gereken |
| --- | --- | --- |
| Dayanak Geçersizleşme Kuyruğu | Otomatik değişiklik etki analizi ve etki uyarıları | Mevcut deterministik türetme istisnasının yaşam döngüsü durumu geçişlerinden doğan adayları da kapsadığı |
| Yerine Geçilmiş Karara Dayanan Çalışma | Otomatik değişiklik etki analizi ve etki uyarıları | Görünümün yalnız iki açık ilişkinin kesişiminden türediği ve hiçbir hüküm üretmediği |
| Ekran Durum Matrisi | Aynı Ekran için desktop/mobile varyant yönetimi | Karşılaşılan veri durumu ile görüntü ortamı ayrımı; matrisin hiçbir cihaz sınıfı ya da kırılma noktası taşımadığı |
| Çalışma Alanı Bağlam Bütünlüğü Denetimi | Mission Control benzeri sağlık modülü ve serbest gösterge panosu | Denetimin sağlık işareti toplamadığı, kontrol listesinin kapalı olduğu ve kullanıcının kendi kuralını yazamadığı |
| Wiki ile Proje Bilgisinin İkileşme Görünümü | İçerik benzerliğine göre kendiliğinden bağlayan genel auto-linking | Görünümün yalnız açık Etiket, satır içi referans ve mevcut köken bağını okuduğu; hiçbir benzerlik hesaplamadığı |
| Kaynak Yığılması Dizini | Salt zaman geçmesine dayalı staleness bildirimleri | Sıralamanın bağlı karar sayısına dayandığı; son kontrol tarihinin yalnız olgu olarak gösterildiği |
| Rakip | Contact/Company çekirdeğinin ötesinde CRM katmanı | Rakip kaydının hiçbir iletişim, anlaşma, gelir veya ticari alan taşımadığı; aynı kuruluşun Company kaydıyla canlı bağ kurulmadığı |

<a id="dayanak-gecersizlesme-kuyrugu"></a>
### Dayanak Geçersizleşme Kuyruğu

Bu yön notunun dayanağı, bir Varsayım çürütüldüğünde o varsayıma dayanarak verilmiş kararların ve açılmış işlerin gerçek projelerde tekrar tekrar gözden kaçmasıdır. Mevcut örüntü yalnız içerik sürümü değişimini izler: [Spec değişikliği inceleme kuyruğu](07-documents-and-knowledge.md#spec-değişikliği-inceleme-kuyruğu) Belge bölümü sürümünü, kaynak tazeliği ise [Kaynak sürümü karşılaştırmasını](08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması) izler. Yaşam döngüsü durumu değişiminden doğan aynı örüntünün karşılığı yoktur. Bağlı Ürün Boşluğu: `Çürütülen dayanağın etkisi ürün içinde görünmüyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde yalnız Varsayımın çürütülme geçişi girdi olur; kanıt rolü işaretleri o biçime girmez. Kuyruk yalnız o Varsayımın açık kanıt ilişkisiyle gösterdiği hedeflerden geçerli Karar ve kapanmamış İş kayıtlarını listeler; genel `İlgili` ilişkisi, tarih yakınlığı ve metin benzerliği girdi sayılmaz. Kullanıcı her satırı `Bekliyor`, `Gözden geçirildi` veya `Etkilenmedi` olarak işaretler; işaret hedef kaydın sahipli bileşeni olur, durumunu, önceliğini ve planlama üyeliğini değiştirmez ve takip işi açmaz. Varsayım yeniden açılırsa satır düşer, konmuş işaretler hedef kaydın geçmişinde kalır ve yeniden inceleme turu açılmaz.

Notun anlamlı sayılması için üç gerçek çürütmede denenmesi ve en az ikisinde mevcut yüzeylerin kaçırdığı bir bağımlı kaydı doğru biçimde görünür kılması gerekir. Listelenen adayların çoğu bilinçli olarak etkilenmemiş çıkarsa, kullanıcı işaretleri ikinci bir plan gibi sürdürmek zorunda kalırsa veya inceleme fiilî bir onay kapısına dönüşürse not kapanır.

<a id="yerine-gecilmis-karara-dayanan-calisma"></a>
### Yerine Geçilmiş Karara Dayanan Çalışma

Bu yön notunun dayanağı, bir Karar yeni bir kararla değiştirildikten sonra eski karara bağlı işlerin sessizce eski karara bakmaya devam etmesinin gerçek projelerde tekrar etmesidir. Yerine geçmede ilişkiler kopyalanmadığı için bu kopukluk tasarım gereği oluşur; mevcut yüzey yalnız emekli karardan güncel karara gitmeyi sunar, ters yönü göstermez. Bağlı Ürün Boşluğu: `Yerine geçilmiş karara bağlı çalışma sessizce devam ediyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde görünüm yalnız emekli Karar ile ona doğrudan uygulama ilişkisiyle bağlı kapanmamış İş çiftlerini listeler; zincir boyunca dolaylı uygulama izlenmez. Hiçbir işaret veya kayıt saklanmaz, ilişki güncel karara kendiliğinden taşınmaz, eski ilişki silinmez ve işin durumu değişmez. Kullanıcı ilişkiyi elle taşıdığında veya işi kapattığında satır kendiliğinden düşer.

Notun anlamlı sayılması için iki gerçek yerine geçme olayında en az bir açık bağımlı işi görünür kılması gerekir. Konu ileride kapsama alınırsa bu görünüm bağımsız bir yüzey olarak değil, Çalışma Alanı Bağlam Bütünlüğü Denetiminin sıfır saklama gerektiren kontrollerinden biri olarak kurulur; ayrı yüzey olarak kalması gerekiyorsa gerekçesi o kararda ayrıca yazılır. Bağımlı iş hiç çıkmazsa veya kullanıcı satırları görmezden gelmeyi sürdürürse not kapanır.

<a id="tuketicisi-kapanmis-belirsizlik"></a>
### Tüketicisi Kapanmış Belirsizlik

Bu yön notunun dayanağı, vazgeçilen veya tamamlanan işler için açılmış belirsizlik kayıtlarının açık durumda birikmesinin gerçek kullanımda gözlenmesidir. İş kapanışı kalıcı bağlamı korumayı önerir fakat bağlı belirsizlik kayıtlarını hiç sormaz; sonuç, gelecekteki varsayım karşılaştırma yüzeylerinin girdisini kirleten açık kayıt yığınıdır. Bağlı Ürün Boşluğu: `Tüketicisi kapanmış belirsizlik kaydı açık kalıyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde yalnız Varsayım kayıtları listelenir ve ölçüt iki koşulu birlikte ister: kaydın en az bir bağlı İş kaydı bulunmalı ve bağlı işlerin hepsi kapanmış olmalı. Hiç tüketicisi olmayan kayıt böyle bir görünümün konusu olmaz. Görünüm hiçbir kaydı kendiliğinden kapatmaz, geçersizleşme durumuna geçişi kullanıcı yapar. Zaman geçmesine dayalı hiçbir ölçüt, yaş bilgisi veya hijyen puanı sunulmaz.

Notun anlamlı sayılması için ilk gerçek taramada listelenen kayıtların en az yarısında kullanıcının gerçekten kapatmak istediği bir belirsizliğin bulunması gerekir. Listelenen kayıtların çoğu hâlâ geçerli çıkarsa ölçüt daraltılır; daraltıldığında görünür kalan kayıt sayısı anlamsızlaşırsa not kapanır.

<a id="ekran-durum-matrisi"></a>
### Ekran Durum Matrisi

Bu yön notunun dayanağı, bir Ekranın veri bulunmayan, hata dönen, yetki verilmeyen ve ilk kullanım durumlarının tasarımda sayılmamasının ve gerçekleşen üründe eksik kalmasının tekrar etmesidir. Wireframe yüzeyi bir Ekran sürümü için tek düzen taşır; hangi render durumlarının gerektiğini sayan ve eksik bırakılanı görünür kılan yüzey yoktur. Durum ve Geçiş Modelleyicisi tasarlanan ürünün varlık yaşam döngüsünü modeller, ekranın karşılaştığı veri durumunu modellemez. Bağlı Ürün Boşluğu: `Ekranın boş, hata ve yetkisiz durumları tasarımda kayboluyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde kapalı üç durum adı sunulur: veri yok, hata, yetki yok. Serbest durum ekleme, cihaz sınıfı, kırılma noktası ve görüntü ortamı o biçimde bulunmaz ve sonraki genişlemelerde de açılmaz. Satır yalnız durumun varlığını ve adını taşır; davranış anlatımı gerekiyorsa satır Belge bölümüne canlı referans verir, metni kopyalamaz. Kesin Wireframe sürümüne bağ ilk biçime girmez; açılırsa yeni Wireframe sürümü geçmiş bağı sessizce devralmaz.

Notun anlamlı sayılması için üç gerçek Ekranda denenmesi ve en az ikisinde aynı bilgiyi Wireframe içine not yazmaktan daha güvenilir sonuç üretmesi gerekir. Matris ileride kapsama alınırsa Erişilebilirlik Tasarım Kontrolüyle birlikte Ekran altında iki ayrı kontrol yüzeyi doğurup doğurmadığı o kararda ayrıca ele alınır. Hiçbir biçimde kapsama oranı, tamlık yüzdesi veya eksik durum hükmü üretilmez ve eksik durum yayını engellemez.

<a id="geri-alinamaz-eylem-envanteri"></a>
### Geri Alınamaz Eylem Envanteri

Bu yön notunun dayanağı, kullanıcının tasarladığı üründe silme, yayımlama, gönderme, tahsilat ve erişim iptali gibi geri alınamayan eylemlerin korumasının tasarım anında dağınık kalmasının tekrar etmesidir. Yetki Modelleyicisi kimin neyi yapabildiğini modeller, eylemin geri alınabilirliğini ve korumasını modellemez; Akış Kötüye Kullanım İncelemesi kötü niyetli yolu arar, iyi niyetli fakat yıkıcı eylemi aramaz. Bağlı Ürün Boşluğu: `Geri alınamaz eylemlerin koruma kararı dağınık kalıyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek Kullanıcı Akışı sürümünde en fazla beş satır kurulur ve her satır akışın kesin bir adımına referans verir. Koruma seçenekleri kapalıdır: onay, önizleme, geri alma penceresi, yeniden kimlik doğrulama, koruma yok. Sistem hangi eylemin geri alınamaz olduğunu tahmin etmez, kod ya da onay akışı üretmez ve dolu envanter hiçbir yayını serbest bırakmaz. Aynı eylemin birden çok akışta tekrar kurulması kabul edilmiş maliyettir; bağımsız ana kayıt tartışması ancak yeni ana kayıt bütçesi yeniden açıldığında yapılır.

Notun anlamlı sayılması için iki gerçek akışta tasarım sırasında fark edilmeyen en az bir korumasız eylemin ortaya çıkması gerekir. İlk biçim altyapı tehdit modelleme, genel güvenlik kontrolü ve otomatik risk üretimini kapsamaz. Envanter mevcut Risk ve Karar kayıtlarıyla aynı bilgiyi iki kez tutmaya başlarsa not kapanır.

<a id="erisilebilirlik-tasarim-kontrolu"></a>
### Erişilebilirlik Tasarım Kontrolü

Bu yön notunun dayanağı, tasarlanan ürünün klavye yolu, odak sırası, ekran okuyucu adlandırması ve hareket alternatifi kararlarının tasarım anında kaybolup kod yazıldıktan sonra düzeltme olarak geri dönmesinin tekrar etmesidir. Planlı Test Senaryosu test niyetini ve sonucunu taşır; böyle bir kontrol ise tasarım anındaki kararı taşır ve test senaryosunu besler. Bağlı Ürün Boşluğu: `Erişilebilirlik kararları tasarım anında kayboluyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek Ekranda kapalı dört tasarım sorusu sunulur: klavye yolu, odak sırası, ekran okuyucu adı, hareket alternatifi. Ürün hiçbir uyum ölçütü numarası, seviyesi veya standart adı taşımaz ve yüzeyde bunun bir uyum değerlendirmesi olmadığı açıkça yazılır; bu ayrım [ortak erişilebilirlik sözleşmesini](15-product-quality.md#erisilebilirlik) gevşetmez. Ürün tasarlanan ürünü çalıştırmaz, tarama yapmaz, kontrast hesabını hüküm olarak sunmaz ve puan üretmez. Moodboard renk örneklerinin kontrast kararına girdi olması ilk biçime girmez.

Notun anlamlı sayılması için üç gerçek Ekranda denenmesi ve kararların sonradan yapılan erişilebilirlik düzeltmelerini azalttığının gözlenmesi gerekir. Dolu liste hiçbir yayını serbest bırakmaz. Kullanıcı aynı hataları kontrol listesine rağmen tekrarlıyorsa veya liste tasarım kararı yerine tören adımına dönüşürse not kapanır.

<a id="calisma-alani-baglam-butunlugu-denetimi"></a>
### Çalışma Alanı Bağlam Bütünlüğü Denetimi

Bu yön notunun dayanağı, yapısal bağlam boşluklarının tek yerde okunamamasının tekrar etmesidir. [Değer Zinciri](04-workspace-and-projects.md#değer-zinciri), Kanıt Akışı ve Sürüm Kanıt Paketi yalnız yerel kopukluk gösterir; çalışma alanı genelinde yapısal boşluğu toplayan yüzey yoktur. Bağlı Ürün Boşluğu: `Yapısal bağlam boşlukları tek yerde görünmüyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek proje kapsamında tek kontrol sunulur: açık kanıt ilişkisi bulunmayan geçerli Karar listesi. Kontrol listesi kapalı ve sabit olur; kullanıcı kendi kuralını yazamaz, kontrol ekleyemez ve pano düzenleyemez. Denetim yalnız sıfır saklama gerektiren kontrolleri barındırır; kalıcı işaret isteyen kontroller buraya girmez. Zamana dayalı hiçbir ölçüt bulunmaz, sağlık puanı, yüzde, renk kodu ve proje durumu hükmü üretilmez, hiçbir boşluk kendiliğinden düzeltilmez ve yayın engellenmez.

Notun anlamlı sayılması için ilk taramada bulunan boşlukların en az üçte birinde kullanıcının gerçekten davranış değiştirmesi gerekir. Bulguların ezici çoğunluğu bilinçli tercih çıkarsa kontrol listesi daraltılır; daraltıldığında geriye anlamlı kontrol kalmazsa not kapanır.

<a id="wiki-ile-proje-bilgisinin-ikilesme-gorunumu"></a>
### Wiki ile Proje Bilgisinin İkileşme Görünümü

Bu yön notunun dayanağı, aynı bilginin Kişisel Wiki ile proje belgesinde iki ayrı doğruluk kaynağına ayrılmasının gerçek kullanımda gözlenmesidir. Tek doğruluk kaynağı ilkesi ürün vizyonunda bağlayıcıdır fakat bu ilkeyi denetleyen hiçbir yüzey yoktur; köken ilişkisi yalnız açıkça devşirilen bilgiyi izler, bağımsız oluşan ikizi göstermez. Bağlı Ürün Boşluğu: `Aynı bilgi Wiki ve proje belgesinde ikiye ayrılıyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek sinyal kullanılır: aynı Etiketi taşıyan Wiki belgesi ile proje belgesi çiftleri. Satır içi referans ve köken bağı sinyalleri sonraki genişlemelere kalır. İçerik benzerliği, anlamsal karşılaştırma ve otomatik sınıflandırma hiçbir aşamada kullanılmaz. Görünüm salt okunur olur, yalnız aynı hesap içinde çalışır, iki sahiplik kapsamı arasında hiçbir kalıcı bağ kurmaz, hiçbir şeyi birleştirmez ve hangi kopyanın doğru olduğuna dair hüküm vermez. Eşleştirmenin kendisi hiçbir yere yazılmaz ve dışa aktarma ya da paylaşma çıktısı üretmez; yanlış eşleşme Etiketi düzelterek susturulur.

Notun anlamlı sayılması için üç ay içinde en az bir gerçek ikileşmenin yakalanması gerekir. Yakalanan çiftlerin çoğu bilinçli özet ve detay ayrımı çıkarsa sinyal değiştirilir; hiçbir sinyal gerçek ikileşme bulmuyorsa not kapanır.

<a id="kaynak-yigilmasi-dizini"></a>
### Kaynak Yığılması Dizini

Bu yön notunun dayanağı, kararların hangi Kaynak kayıtlarına yığıldığının görünmemesinin tekrar etmesidir. Mevcut yüzeyler tek kaynağın tazeliğini ve kontrol geçmişini gösterir; kaynakları taşıdıkları karar yüküne göre okuyan yüzey yoktur. Bağlı Ürün Boşluğu: `Kararların hangi kaynağa yığıldığı görünmüyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek çalışma alanında Kaynak kayıtları açık kanıt ilişkisi sayısına göre azalan sırada listelenir. Sütun adı bağlı karar sayısı olur; yüzeyde güç, önem, ağırlık, güven ve risk kelimeleri geçmez ve elle atanan kanıt gücü alanı okunmaz. Sıralama bir olgunun sıralaması olur, hüküm olmaz; hiçbir eşik, renk, uyarı veya kaynak ekleme önerisi üretilmez. Son kaynak kontrolü tarihi yalnız olgu olarak gösterilir, uyarıya dönüşmez ve sıralama ölçütü olmaz.

Notun anlamlı sayılması için dizin üzerinden en az iki gerçek kaynak doğrulama veya çeşitlendirme kararına yol açması gerekir. Kullanıcı dizine bakıp hiçbir işlem yapmıyorsa veya dizin fiilen bir güvenilirlik puanı gibi okunmaya başlıyorsa not kapanır.

<a id="rakip-ve-konumlandirma-alani"></a>
### Rakip ve Konumlandırma Alanı

Bu yön notunun dayanağı, rakip ürünlerin iddialarının ve kendi yaklaşımının nerede bilinçli olarak farklı olduğunun ürün dışında tutulmasının tekrar etmesidir. Bu tekrarın kanıtı bugün mevcuttur: rakip analizleri depo içinde ürün dışı belgeler olarak yaşar; rakip ekranı, onların iddiası ve buna verilen cevap da Moodboard veya Belgede ikinci bir rekabet defteri olarak tutulur. Kaynak Kaydı bir rakip sayfasını sürümleyebilir fakat iki rakibi karşılaştıramaz; Belge karşılaştırmayı yapısal olarak bağlamaz. Bağlı Ürün Boşluğu: `Rakip bağlamı ürünün dışında tutuluyor`.

Not ileride değerlendirmeye alınırsa tartışılacak dar biçimde tek Rakip kaydı çalışma alanı kapsamında oluşturulur ve iddia satırları kaydın sahipli bileşeni olarak kesin Kaynak sürümüne bağlanır. Aynı satır rakip adını, isteğe bağlı ekran veya Dosya Ekini, onların iddiasını ve kullanıcının kendi cevabını taşır ve mevcut Karar ya da Özelliğe bağlanabilir; ayrı bir rakip yırtma defteri yüzeyi önerilmez. Karşılaştırma ekseni her zaman mevcut bir Özellik kaydı olur; Rakip kaydı kendi yetenek ekseni tanımlayamaz ve tasarlanan ürünün yeteneklerinin ikizini tutmaz. Kayıt hiçbir iletişim, kişi, anlaşma, gelir, çalışan veya finansman alanı taşımaz; aynı kuruluş hem Rakip hem Company olarak varsa iki kayıt ayrı yaşar ve canlı bağ kurulmaz. Mobbin ya da Figma benzeri örüntü kataloğu, genel moodboard, sürekli dış tarama, otomatik izleme, skor, kazanan, kazanma kaybetme hükmü, parite yüzdesi, pazar büyüklüğü ve fiyat istihbaratı hiçbir aşamada bulunmaz. Yaklaşım farkının gerekçesi Rakip kaydında değil mevcut Karar kaydında yaşar. Özellik bağı ve karşılaştırma görünümü ilk biçime girmez; açılırsa `Karşılaştırılan yaklaşım` ilişkisi kesin uçları, kardinalitesi ve silme davranışıyla ayrı PRD kararı ister. Paylaşılan Özellik snapshot'ı bağlı Rakip kaydını [kapalı dünya önizleme ve snapshot güvenliği](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) gereği açmaz.

Notun anlamlı sayılması için üç ay içinde en az iki gerçek Karar veya Özellik kapsamı değişikliğine kanıt sağlaması ve üç gerçek karşılaştırmada dış rekabet notunu kapatması gerekir. Kayıt yalnız okuma notu olarak kullanılıyorsa, kendi yetenek listesini kurmaya başlıyorsa, Moodboard kopyasına veya serbest whiteboard'a dönüşüyorsa ya da ticari alanlara doğru genişliyorsa not kapanır ve rakip bilgisi ürün dışı araştırma belgesi olarak kalır.

<a id="yayin-kanali"></a>
### Yayın Kanalı

Bu yön notunun dayanağı, ürünün yayımlandığı kanalların tekrar eden gerekliliklerinin, gönderim geçmişinin ve red gerekçelerinden çıkan dersin her sürümde sıfırdan kurulmasının tekrar etmesidir. Proje Sürümü etiket ve yayın merkezlidir; yayın kontrol listesi her sürümün içinde yeniden kurulur ve o sürümle birlikte gömülür. Üretim Olayı yayın sonrası arızayı taşır, yayın öncesi kapıyı taşımaz. Bağlı Ürün Boşluğu: `Kanal gereklilikleri ve red gerekçeleri her sürümde sıfırdan kuruluyor`.

Bu notun yeni ana kayıt izni yoktur; bu bölümdeki tek izin `Rakip` adayına ayrılmıştır. Not bu nedenle önce ana kayıt gerektirmeyen bir deneyle sınanır: kullanıcı tek kanalın gerekliliklerini ve gönderim sonuçlarını mevcut kayıtlarla tutar ve bilginin sürümler arasında gerçekten kaybolduğunu ölçer. Mağaza arayüzü çağrısı, otomatik gönderim, durum çekme, pazarlama kampanyası, kurulum analitiği ve gelir takibi hiçbir aşamada bulunmaz; kanal politikasının metnini ürün getirmez ve kanal onayı Proje Sürümünü bloklamaz.

Notun anlamlı sayılması için aynı kanala yapılan ikinci gerçek gönderimde önceki gönderimin notlarını aramaktan daha güvenilir sonuç üretmesi gerekir. Bu kanıt oluşursa kalıcı kayıt biçimi ayrı bir ana kayıt bütçesi kararıyla ele alınır. Aynı kanala ikinci gönderim hiç oluşmuyorsa veya bilgi mevcut kayıtlarda yeterince yaşıyorsa not kapanır.

<a id="teknik-diyagram-genisleme-adaylari"></a>
## Teknik Diyagram genişleme adayları

Bu bölüm [ilk ürün Teknik Diyagram sözleşmesinin](11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar) doğal devamı olmayan, her biri kendi önkoşulu ve yeni ürün kararı bulunan yönleri taşır. Adaylar birbirini otomatik etkinleştirmez; manuel Teknik Diyagram ve PostgreSQL Veri Modeli kullanımı dogfooding'de doğrulanmadan hiçbiri ilk ürün kapsamına taşınmaz.

<a id="repository-semasi"></a>
### Repository şeması

Manuel Tasarlanan şema gerçek projelerde güvenilir biçimde kullanıldıktan ve repository gerçeğiyle farkı elle yeniden kurma tekrar eden hata ürettikten sonra `Repository’den türetilmiş görünüm` kipinde salt okunur Repository şeması değerlendirilebilir. Kullanıcı proje bazında kesin schema/migration dosya veya dizin allow-list'ini seçer; kaynak repository, branch ve exact commit, parser sürümü, dahil/atlanan kaynaklar, son başarılı türetme zamanı ve bayatlık görünür olur. İlk kapsam yalnız PostgreSQL gerçeğine deterministik olarak çözümlenen kaynaklarla sınırlanır; desteklenecek Prisma/SQL/migration biçimleri gerçek repository fixture'larıyla ayrıca kararlaştırılır.

Repository şeması Tasarlanan şemayı sessizce güncellemez ve çalışan database'e uygulanmış sayılmaz. Kullanıcı iki modeli karşılaştırabilir; birini diğerine dönüştürmek yeni kimlik, hedef otorite kipi, kayıp ve geçmiş etkisini gösteren açık işlem ister. Repo-geneli indeksleme, tahmini AI parse'ı, file monitorünün ana modeli doğrudan yazması, branch/commit/pull request üretimi ve runtime drift bu yönün parçası değildir.

<a id="teknik-diyagram-ddl-dbml-importu"></a>
### PostgreSQL DDL ve DBML import'u

Manuel Veri Modeli editörü ve statik PostgreSQL generator'ı adversarial fixture'larla doğrulandıktan sonra tek seferlik PostgreSQL DDL ve DBML import'u değerlendirilebilir. İşlem `İçe aktarılmış bağımsız kopya` üretir; hedef Proje ve Teknik Diyagram, parse edilen/atlanacak öğeler, satır ve öğe diagnostics'i, kayıp semantik ve oluşacak köken bağı atomik commit öncesinde gösterilir. Best-effort parse kullanıcı açıkça dışlamadığı geçersiz satırı sessizce atlayamaz.

İçe aktarılan model dış dosyayı izlemez ve yeniden import otomatik eşitleme veya round-trip olmaz. Draw.io, Visio, Eraser/Koboyo native biçimleri ve görsel/keyfî dosyadan AI rekonstrüksiyonu bu yönle kapsama girmez.

<a id="ai-teknik-diyagram-taslagi"></a>
### AI Teknik Diyagram taslağı

Manuel Teknik Diyagram akışları ile [AI değerlendirme alanındaki](#ai-değerlendirme-alanı) öncelikli Yakalama dönüşüm taslağı ayrı ayrı doğrulanmadan prompt, Belge veya seçili kayıt bağlamından AI Teknik Diyagram üretimi değerlendirilmez. Açılırsa çıktı ana Teknik Diyagramdan ayrı kaynak-manifestli taslaktır; kullanıcı düğüm, alan ve bağlantı farklarını seçip onaylamadan kanonik model, ilişki veya Diyagram Sürümü değişmez. Prompt üretimi, doğal dille düzenleme, şema iyileştirme ve migration önerisi tek yetenek sayılmaz; her biri ayrı gizlilik, maliyet, doğruluk ve kabul kapısı ister.

Codebase'den AI ile üretilmiş diyagram `Repository şeması` veya deterministik kaynak gerçeği değildir. Repository içeriği için gerekli izin, veri minimizasyonu ve kaynak doğruluğu ayrıca kararlaştırılmadan bu aday repo-geneli bağlam okuyamaz.

<a id="teknik-diyagram-sablonlari"></a>
### Teknik Diyagram şablonları

Gerçek kullanımda aynı türde boş başlangıç yapısının tekrar tekrar elle kurulduğu kanıtlanırsa içeriksiz Teknik Diyagram şablonu değerlendirilebilir. Şablon yalnız Teknik Diyagram türü, placeholder, boş semantik öğe, Diyagram Görünümü ve sınırlı stil taşır; kaynak Projenin düğüm içeriğini, ana kayıt ilişkilerini, geçmişini, dış bağlantılarını, DDL/migration'ını veya Diyagram Sürümlerini taşımaz. Üretilen Teknik Diyagram yeni kimlikli bağımsız kayıttır ve şablon değişikliği eski üretimleri güncellemez. Herkese açık galeri veya şablon pazarı ayrıca ürün kararı olmadan açılmaz.

<a id="ek-sql-dialectleri"></a>
### Ek SQL dialect'leri

PostgreSQL/Neon/Prisma dogfooding'i veri tipi, constraint, index, referential action, DDL ve migration semantiğinde gerçek uyumluluk kanıtı ürettikten sonra başka SQL dialect'leri tek tek değerlendirilebilir. Her dialect ayrı model semantiği, parser/generator, destructive değişiklik ve golden/adversarial fixture sözleşmesi ister; en düşük ortak payda modeliyle PostgreSQL doğruluğu düşürülmez ve bir dialect artefaktı başka dialect'te güvenli sayılmaz.

<a id="teknik-diyagram-inceleme-isbirligi"></a>
### Teknik Diyagram inceleme ve ortak düzenleme

Kimlik doğrulamalı özel paylaşım ve ekip sistemi doğrulandıktan sonra exact Diyagram Sürümü ve öğesine bağlı asenkron yorum değerlendirilebilir. Yazar, görünürlük, çözümleme, saklama ve kaynak sürüm kaybı davranışı tanımlanmadan yorum açılmaz; yorum kendiliğinden İş, Karar veya kanonik diyagram değişikliği değildir.

Gerçek zamanlı ortak düzenleme yalnız daha sonraki ekip/CRDT fazında; sahiplik, cursor/presence, eşzamanlı yapısal değişiklik, conflict, undo, audit ve erişilebilirlik birlikte çözülürse değerlendirilir. Anonim/herkese açık yorum veya edit bu yönün parçası değildir.

## Ürün stratejisi, dağıtım ve planlama adayları

<a id="icerikli-proje-forku"></a>
### İçerikli Proje Fork'u

Bütün Proje bağlamını iki uzun ömürlü kola ayırma ihtiyacı dogfooding'de tekrar ederse içerikli fork ayrıca değerlendirilir. Yön açılırsa kaynak Proje ile kesin başlangıç snapshot'ını görünür kılan yeni Proje kimliği kullanır; secret, paylaşım bağlantısı, aktif otomasyon, bildirim ve çalışma geçmişini varsayılan olarak taşımaz. İçerikli template ile fork aynı özellik değildir.

<a id="yeniden-eslenebilir-klavye-kisayollari"></a>
### Yeniden eşlenebilir klavye kısayolları

Tarayıcı veya işletim sistemi kısayol çatışmaları ya da erişilebilirlik ihtiyacı gerçek kullanımda tekrar eden engel oluşturursa kullanıcı tarafından yeniden eşlenebilen genel kısayol profili ayrıca değerlendirilir. Yön açılmadan önce güvenli ve geri döndürülemez eylemlerin çakışma önleme, varsayılana dönme ve görünür menü karşılığı davranışları tanımlanır.

<a id="kaydedilmis-belge-setleri"></a>
### Kaydedilmiş Belge Setleri

Koşullarla ifade edilemeyen, aynı Belgeleri birden fazla sıralı ve elle kürate edilmiş pakette kullanma ihtiyacı gerçek kullanımda tekrarlanırsa amacı açık bir `Kaydedilmiş Belge Seti` değerlendirilir. Bu yön klasör, üst Belge, etiket, Akıllı Koleksiyon ve Favorilerden ayrı ikinci üyelik kaynağının kimlik, sıralama, paylaşım ve silme davranışlarını birlikte çözmeden açılamaz.

<a id="gelismis-etiket-bakimi"></a>
### Gelişmiş etiket bakımı

Çalışma Alanı genelindeki düz etiket listesinin bakım yükü dogfooding'de sorun olursa ikinci bir Proje-yerel ad alanından önce etiket arşivleme, birleştirme ve kullanım önerileri değerlendirilir. Bu araçlar ana etiket kimliğini, Belge içindeki inline kullanımları ve import/export eşlemelerini sessizce ayıramaz.

<a id="wireframe-cihaz-varyantlari"></a>
### Wireframe cihaz varyantları

Ayrı desktop/mobile Wireframe görünümü ihtiyacı doğrulanırsa varyantlar bağımsız Ekran doğruluk kaynakları değil, aynı ana Ekran altında sürümlenen görünümler olarak değerlendirilir. Varyantlar arasında içerik sahipliği, ortak block değişikliği, paylaşım ve sürüm karşılaştırması yön açılmadan önce tanımlanır.

<a id="ekip-test-yetkileri"></a>
### Ekip test yetkileri

Ekip kullanımı doğrulanırsa `test.view`, `test_report.submit`, `test.manage`, `test.correct`, `test.redact` ve `test.export_share` yetkilerinin ayrı verilebilmesi değerlendirilir. Bu adlar ilk ürüne ekip rolü veya izin arayüzü eklemez; yürüten, raporlayan, inceleyen, düzelten, redakte eden ve dışa aktaran aktörlerin denetim ayrımı korunur.

### Sonraki kullanıcı segmentleri

Açık kaynak maintainer’ları, freelancer’lar ve küçük ekipler sonraki veya ikincil doğrulama segmentleridir. Ürün bu aşamada pazar odaklı tek bir rekabet konumlandırmasını sabitlemez; mevcut dört temel değer ve kurucu kullanımı ürün yönünü belirler.

Freelancer doğrulaması ilk ürün kapsamını büyütmez. Müşteri teklifi, Invoice ve birleşik proje sunumu [ilk ticari genişleme](17-commercial-expansion.md#ilk-urun-sonrasi-ticari-genisleme) aşamasında; solo-builder ürün akışı gerçek kullanımla doğrulandıktan sonra en az bir gerçek müşteri projesinde sınanır.

### Uzun vadeli dağıtım modeli

Son kullanıcıya yönelik self-host kurulumu ilk ürün tesliminin parçası değildir ve dağıtım sırasının en sonunda ele alınır; mevcut geliştirme self-host operasyon yüzeyleri kurmak için yavaşlatılmaz.

Self-host dağıtımı açıldığında ürünün uzun vadeli temel dağıtım biçimlerinden biri olur. Her kurulum operatörün kontrol ettiği veritabanı ve depolamayı kullanabilir; kurulum, yükseltme, sağlık kontrolü, log inceleme, yedekleme ve geri yükleme için işletilebilir bir yönetim yüzeyiyle birlikte sunulur.

Daha sonraki olası SaaS, ayrı veya özellikleri kırpılmış bir ürün değil, Apache-2.0 lisanslı aynı tam açık kaynak ürünün yönetilen bulut hizmetidir. Open-core özellik bölme yapılmaz; yönetilen hizmet kaynak kodunun kullanım, değiştirme ve dağıtma haklarını daraltmaz.

### Windows Tauri paketi

İlk ürün online-only web ve macOS Tauri ile kalır. Kurucunun Windows üzerinde gerçek ve tekrarlanan masaüstü kullanım ihtiyacı oluşursa Windows Tauri paketi ayrıca değerlendirilir; web'in Windows tarayıcıda çalışması tek başına bu ihtiyacın kanıtı değildir.

Yön açılırsa aynı backend ve ürün sözleşmesini kullanır; ikinci yerel doğruluk kaynağı veya çevrimdışı kuyruk oluşturmaz. Windows code-signing, updater, güvenli token saklama, deep link, installer ve gerçek Windows/NVDA kabul matrisi birlikte tanımlanır. Bu yön macOS paketinin kabulünü bekletmez veya geçmiş kabul matrisini geriye dönük değiştirmez.

<a id="github-hesabina-bagli-e-postayla-kurtarma"></a>
### GitHub hesabına bağlı e-postayla kurtarma

İlk ürün GitHub kimliğine bağlı tek giriş yoluyla kalır. GitHub hesabına erişimin kaybedilmesi gerçek kullanımda kritik kurtarma ihtiyacı oluşturursa, GitHub hesabıyla ilişkili e-posta üzerinden giriş veya hesap kurtarma ayrıca değerlendirilir.

Bu yön açılmadan önce e-posta sahipliğinin eski GitHub hesabının sahipliğini kanıtlayıp kanıtlamadığı, GitHub e-postasının değişmesi/gizlenmesi, e-posta hesabının ele geçirilmesi, aynı adresin başka GitHub kimliğinde kullanılması ve mevcut Hesabın yanlış kişiye bağlanması birlikte çözülür. Yalnız adres eşleşmesiyle ad-hoc yeniden bağlama yapılmaz; yön ilk ürüne örtük bir e-posta giriş yolu eklemez.

<a id="uygulama-duzeyinde-mfa"></a>
### Uygulama düzeyinde MFA

İlk ürün tek kurucu hesabı ve GitHub tabanlı kimlik doğrulamayla kalır; uygulama düzeyinde ikinci doğrulama adımı sunmaz. İkinci gerçek kullanıcıya hesap açılması, hassas müşteri verisinin alınması veya ürünün kurucu dogfooding'i dışına açılması planlandığında kimlik doğrulama tehdit incelemesi zorunlu olarak yeniden yapılır. Mevcut sağlayıcı güvenliği, callback kötüye kullanım koruması, güvenli oturumlar ve oturum iptali kabul edilebilir artık riski karşılamıyorsa MFA sonraki kapsamın zorunlu güvenlik davranışı olur.

Yön açılırsa desteklenen ikinci faktörler, kayıt ve kurtarma, güvenilir cihaz, faktör kaybı, yüksek riskli yeniden doğrulama, oturum iptali, denetim ve destek süreci birlikte tanımlanır. Yalnız SMS veya e-posta eklemek güvenli varsayılmaz; yanlış hesap bağlama ve kurtarma saldırıları karşıt testlerle doğrulanır. Bu değerlendirme tamamlanmadan dış kullanıma açılma kararı geçmiş dogfooding kabulüne dayanamaz.

### Snapshot-temelli etkileşimli birleşik proje sunumu

İlk ürün sonrasındaki ticari doğrulama, [tarihli statik PDF birleşik proje sunumuyla](17-commercial-expansion.md#birleşik-proje-sunumu) yapılır. Gerçek müşteri kullanımında sıralı bölümler arasında etkileşimli gezinme ve görsel snapshot'ları yakından inceleme ihtiyacı tekrarlanırsa aynı kesin kaynak/snapshot manifestinden üretilen iptal edilebilir, salt okunur sunum bağlantısı ayrıca değerlendirilebilir.

Bağlantı yalnız kullanıcının seçip önizlemede onayladığı proje özeti, Roadmap, Karar, Wireframe, Proje Duvarı, teklif revision'ı ve desteklenen diğer bölümleri gösterir. Ziyaretçi kaynak projeye geçemez, özel kayda ilişki üzerinden erişemez, içeriği değiştiremez veya düzenlenebilir kopya oluşturamaz. Parola/kimlik doğrulama, sona erme, cache ve iptal davranışları [bağlantıyla sınırlı paylaşımın ilgili güvenlik sözleşmelerini](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) yeniden kullanır veya farklarını açıkça tanımlar.

Varsayılan bütün bölümler üretim zamanı ve kaynak kapsamı görünür tarihli snapshot'lardır. Canlı alan veya canlı üyelik bu yönle otomatik kapsama girmez; ileride istenirse yalnız açık alan izin listesi, fark önizlemesi ve ayrı ürün kararıyla değerlendirilebilir. Etkileşimli bağlantı statik PDF'yi kaldırmaz veya gönderilmiş ticari revision'ı değiştirmez.

### Kimliksiz haftalık paylaşım eğilimi

İlk ürün bağlantıyla sınırlı salt okunur paylaşım ve herkese açık yayın yüzeylerinde anonim toplam görüntülenme ile son erişim zamanını korur. Dogfooding bu iki bilginin bir paylaşım yüzeyinin hâlâ kullanılıp kullanılmadığını anlamakta tekrar tekrar yetersiz kaldığını gösterirse bağlantı/yayın yüzeyi başına son 13 haftanın anonim haftalık görüntülenme eğilimi ilk ürün sonrası aday olarak değerlendirilebilir.

Yön açılırsa kısa aralıktaki tekrar açılışlar tek görüntülenme olarak birleştirilir; özel/herkese açık yüzey türü ayrılabilir fakat kişi, organizasyon, IP, cihaz izi, konum veya tekil oturum dökümü üretilmez. Düşük hacimde kimlik çıkarımını önleyen sayı bastırma uygulanır ve grafik başarı, engagement ya da paydaş performansı skoru olarak sunulmaz. Kesin düşük-hacim eşiği, tekrar birleştirme penceresi ve saklama süresi yön açılırken gizlilik modeliyle birlikte kararlaştırılır.

### Cihaz-yerel editör kurtarma tamponu

İlk ürün online-only kalır ve mevcut sunucu taraflı tamamlanmamış İş taslaklarıyla çalışır. Uzun metin düzenlemelerinde sekme çökmesi, sayfa yenileme veya geçici kayıt hatası nedeniyle kayıp tekrarlanan sorun hâline gelirse kişisel ve cihaz-yerel bir editör kurtarma tamponu ayrıca değerlendirilebilir.

Bu yön açılırsa yalnız kaydedilmemiş editör buffer'ını kısa ömürlü kurtarma verisi olarak tutar; çevrimdışı çalışma, senkronizasyon kuyruğu, ana Taslak, kayıt sürümü veya ikinci doğruluk kaynağı oluşturmaz. Geri yükleme öncesinde kaynak kayıt, son yerel zaman, sunucudaki güncel sürüm ve uygulanacak fark gösterilir; sunucu değişmişse sessiz üzerine yazma yapılmaz. Başarılı kayıttan sonra tampon temizlenir; arama, paylaşım, yayın ve dışa aktarmaya girmez. Kapsanacak editörler, saklama süresi, cihazdaki veri güvenliği ve otomatik temizleme davranışı uygulama fazında ayrıca kararlaştırılır.

### Fail-closed zararlı dosya taraması

İlk ürün dosya türü izin listesi, MIME/uzantı uyumu, boyut, kota, güvenli önizleme ve arşiv açma sınırlarıyla kalır; zararlı yazılım taraması yapmaz. Harici kullanıcıların dosya yükleyebildiği bir kapsam açılmadan veya hassas müşteri verisi alınmadan önce fail-closed tarama yeniden değerlendirilir.

Bu yön açılırsa ClamAV veya seçilecek eşdeğer tarama altyapısı dosyayı kullanılabilir bir kayda bağlanmadan, önizlenmeden, indekslenmeden, paylaşılmadan, yayımlanmadan veya export edilmeden önce tarar. Sonuçlar `Temiz`, `Engellendi`, `Karantinada` ve `Tarama kullanılamıyor/başarısız` olarak ayrılır; yalnız `Temiz` içerik erişime açılır. Servis kullanılamıyorsa dosya karantinada kalır, güvenli yeniden deneme veya iptal sunulur; saklama, otomatik silme, sonradan zararlı işaretleme, metrik ve alarm davranışları uygulama kararıyla birlikte kesinleştirilir.

### Tam ürün paketi ve geri yükleme doğrulaması

İlk ürün [seçili kayıt taşınabilirliği ve tam paket sınırıyla](13-data-security-and-portability.md#kullanıcı-kontrollü-yedekleme-sınırı) kalır. Tam veri taşınabilirliği veya self-host geçişi gerçek ihtiyaç hâline geldiğinde sürümlü ürün paketi ayrıca değerlendirilir; mevcut işlem sınırları bu gelecek yönünde yeniden tanımlanmaz.

Yön açılırsa paket okunabilir Markdown belgelerini, yapılandırılmış JSON kayıtlarını, özgün Dosya Eki sürümlerini, yapılandırmaları, iç kimlikleri, ilişki ve sürüm zincirlerini açık manifestle taşır; oturumlar, entegrasyon secret'ları ve paylaşım anahtarları dışarıda kalır. Oluşturma ve indirme şifreli, süreli ve iptal edilebilir olur; büyük export/import durable background job sistemiyle ilerleme, güvenli yeniden deneme, iptal ve kayıt bazlı hata sonucu sunar.

Aynı yön paket parmak izi ve şema uyumluluğu sağlık kontrolünü, yalıtılmış geri yükleme dry run'ını ve aynı ya da başka kuruluma atomik içe aktarmayı birlikte kapsar. Çakışmalar uygulanmadan önce gösterilir; başarısız işlem canlı kayıtta, dosyada, ilişkide, sayaçta veya arama indeksinde kısmi yazma bırakamaz. Tam çalışma alanı geri yüklemesinin boş/dolu hedef davranışı, paket saklama süresi ve tamamlanma bütçeleri uygulama kararıyla kesinleştirilir.

### Adlandırılmış Backlog bölümleri

İlk ürün tek ana Backlog ve onun manuel sırasıyla kalır. Uzun listenin dogfooding'de tekrar tekrar yetersiz kaldığı doğrulanırsa aynı Backlog içinde proje bazlı ve isteğe bağlı adlandırılmış bölümler ayrıca değerlendirilebilir.

Bu yön açılırsa her İş en fazla bir bölümde bulunur; bölüm üyeliği durum, etiket, Akıllı Koleksiyon, Odak Dönemi veya ayrı Backlog değildir. Otomatik üyelik ya da taşıma uygulanmaz ve her bölüm kendi kalıcı manuel sırasını korur. Bölüm yaşam döngüsü, bölümsüz İşlerin görünümü ve mevcut tek sıradan geçiş davranışı uygulama kararından önce ayrıca doğrulanır.

### Keyfî geçmiş tarihli plan baseline karşılaştırması

İlk ürün Odak Dönemi kapanışı ve proje kapanış özetindeki sınırlı plan–gerçekleşen karşılaştırmalarıyla kalır. Bu yüzeylerin dışında projenin keyfî bir geçmiş tarihindeki plan alanlarını bugünkü değerlerle topluca karşılaştırma ihtiyacı dogfooding'de doğrulanırsa tarihli plan baseline görünümü ayrıca değerlendirilebilir.

Bu yön açılırsa geçmişte zaten bulunan değişiklik kayıtlarından salt okunur bir karşılaştırma üretir; yeni plan snapshot'ı, performans puanı, sağlık hükmü veya başarı metriği oluşturmaz. Karşılaştırılacak kesin alanlar, büyük proje performans sınırları ve eksik tarihsel verinin sunumu uygulama kararında ayrıca belirlenir.

### Alternatif planlama senaryoları

Ana plana uygulanmadan tarih, Roadmap ufku veya kapsam değişikliklerini ayrı bir what-if dalında deneme şu anda gerekli görülmediği için ürün kapsamına ya da kararlaştırılmış ilk ürün sonrası alana alınmaz. İlk ürün ve mevcut gelecek yönleri tek canlı planı korur; keyfî geçmiş tarihli baseline karşılaştırması da prospective plan dalı oluşturmaz.

Alternatif planları asıl kayıt alanlarını değiştirmeden karşılaştırma ihtiyacı gerçek kullanımda tekrar eden bir engel hâline gelirse konu yeni bir ürün kararı olarak sıfırdan açılır. Bu değerlendirme gerçekleşirse taslak değişikliklerin canlı kayda sızmaması, kesin fark önizlemesi, seçerek uygulama, çakışma davranışı ve senaryo silme/geçmiş sınırı birlikte kararlaştırılır; Gantt, proje fork'u veya ikinci kalıcı plan doğruluk kaynağı varsayılmaz.

### DOCX belge göçü

İlk ürün belge içe aktarmada tekil Markdown dosyasıyla kalır. Word, Google Docs veya benzeri kaynaklardan düzenlenebilir belge göçünün tekrar eden bir onboarding engeli olduğu doğrulanırsa DOCX içe aktarma ilk ürün sonrası aday olarak değerlendirilebilir.

Yön açılırsa oluşturulacak belge hiyerarşisi, metin/tablo/görsel eşlemeleri, biçim kayıpları, bozuk iç bağlantılar ve çakışmalar uygulanmadan önce gösterilir; özgün DOCX bir Kaynak veya Dosya Eki olarak korunur ve dış dosyayla canlı bağlantı kurulmaz. Yeniden içe aktarma başlık benzerliğiyle sessiz güncelleme yapmaz. PDF için editable dönüşüm veya ayrı belge modeli açılmaz; özgün, salt okunur Dosya Eki modeli korunur.

<a id="proje-surumu-kontrol-listesini-onceki-surumden-kopyalama"></a>
### Proje Sürümü kontrol listesini önceki Proje Sürümünden kopyalama

İlk ürün mevcut manuel Proje Sürümü yayın kontrol listesiyle kalır. Aynı yayın hazırlığının dogfooding'de tekrar tekrar elle kurulması doğrulanırsa ilk sonraki tekrar kullanım mekanizması, kullanıcının seçtiği önceki Proje Sürümünün kontrol listesini yeni Proje Sürümüne tek seferlik kopyalama olur.

Kullanıcı oluşturulacak kontrol listesi maddelerini uygulamadan önce önizler. Yeni liste bağımsızdır; kaynak Proje Sürümüyle canlı bağ kurmaz ve İş kapsamını, kilometre taşını, mutlak tarihi, ilişkiyi, dependency'yi, yayın durumunu, GitHub bağlantısını veya geçmişi kopyalamaz. Farklı yayın türleri için temiz başlangıç setlerine tekrar eden ihtiyaç ayrıca doğrulanmadıkça adlandırılmış Proje Sürümü şablonu veya release-train modeli oluşturulmaz.

## Kanıt ve araştırma adayları

### Yapılandırılmış ölçüm Kaynağı

İlk ürün harici ürün analitiğini canlı dashboard, event warehouse veya kanıt kaynağı olarak içeri almaz. İlk ürün çekirdeği gerçek projede doğrulandıktan sonra bir Varsayım, Deney/Doğrulama, İş ya da Proje Sürümünün beklenen sonucunu değerlendirirken aynı ölçümü dış araçta paralel kayıt olarak tutma ihtiyacı tekrar ederse yapılandırılmış ölçüm kanıtı ayrıca değerlendirilebilir.

Yön açılırsa ilk dilim yeni bir metrik ana kaydı veya kalıcı sağlayıcı entegrasyonu oluşturmaz; `Kaynak` kaydının yapılandırılmış ölçüm türünü kullanır. Kullanıcı CSV/JSON dosyası veya açık form ile sağlayıcıyı, ölçüm tanımını, kesin dönem ve saat dilimini, cohort/filtre açıklamasını, değeri, birimi, kaynak URL'sini ve içe alma zamanını önizleyerek kaydeder. Ölçüm dış sağlayıcının bildirdiği tarihsel sonuçtur; ürün ham event'i yeniden hesaplamış, sayıyı bağımsız doğrulamış veya değişiklikle sonuç arasında nedensellik kurmuş gibi sunmaz.

Yanlış dönem, filtre ya da değer yerinde yeniden yazılmaz. Açık düzeltme, gerekçesi görünen yeni bir Kaynak sürümü üretir ve onu düzeltme zincirinin güncel sürümü olarak gösterir; eski kanıt bağlarını sessizce taşımaz. Eski sürüm, ona dayanmış Karar ve değerlendirmeler için tarihsel kalır. İlk dilim herhangi bir ölçüm sağlayıcısına sürekli OAuth bağlantısı, arka plan yenilemesi, canlı dashboard, event şeması, kullanıcı profili ya da gelişmiş ziyaretçi analitiği oluşturmaz; manuel girişin tekrarlanan ve maddi bir engel olduğu kanıtlanırsa kullanıcı başlatmalı tek seferlik yetkili çekim ayrıca değerlendirilir.

Ölçüm Kaynağı dışarı paylaşılacaksa yalnız ortak kapalı dünya önizlemesinde tek tek seçilen ölçüm tanımı, dönem, değer, birim ve güvenli kaynak alanları onaylı snapshot'a girebilir. Gizli cohort koşulu, kişi kimliği, ham event veya erişim bilgisi varsayılan olarak dışarıda kalır; bağlı İş, Karar ya da Proje Sürümünün yayımlanması ölçümü otomatik yayımlamaz.

### Sürümlü Anket Aracı ve Yanıt Kümesi

İlk ürün dış anket yürütmez veya yapılandırılmış soru–yanıt kümesi içe almaz. İlk ürün çekirdeği doğrulandıktan sonra araştırma sorularını, kullanılan kesin soru sürümünü ve yanıt kökenini dış survey aracında paralel tutma ihtiyacı tekrar ederse sürümlü Anket Aracı ile Yanıt Kümesi birlikte değerlendirilir.

Yön açılırsa kullanıcı CSV/JSON dosyasını yazmadan önce soru–kolon eşlemesi, veri türü, katılımcı kimliği, izin/köken bağlamı, reddedilecek satırlar ve kesin hedef Projeyle önizler. `Anket Aracı` proje kapsamında soru kimliklerini, sırasını, metnini ve anlamlı her değişiklikte yeni sürümü taşıyan ana kayıttır. Her import, kesin Anket Aracı sürümüne ve dağıtım/dönem bağlamına bağlı ayrı bir `Yanıt Kümesi` ana kaydı oluşturur; tekil katılımcı yanıtları kümeden bağımsız yaşamayan sahipli bileşenlerdir. Bütün küme tek atomik/idempotent commit veya tam rollback ile yazılır.

Katılımcı anonim kalabilir veya kullanıcı tarafından mevcut Contact'a açıkça bağlanabilir. Ad, e-posta veya benzerlikten Contact oluşturulmaz, birleştirilmez ya da kimlik tahmin edilmez. Kullanıcı kesin soru sürümündeki seçili yanıtı veya yanıt parçasını İş, Karar, Varsayım, Açık Soru ya da Teste kanıt olarak bağlayabilir; bütün küme, yanıt sayısı veya tekrar otomatik kanıt, tema, talep hacmi, öncelik ya da ürün hükmü oluşturmaz.

Yanlış eşleme veya eksik satır yerinde değiştirilmez. Düzeltme, gerekçesi görünen yeni bir küme/revizyon üretir ve onu düzeltme zincirinin güncel sürümü olarak gösterir; eski kesin yanıtlara kurulmuş kanıt bağları sessizce taşınmaz. İlk dilim form tasarlama/dağıtma, branching, quota, respondent portalı, e-posta, davet, hatırlatma, otomatik tema/özet veya dış katılımcı paneli sunmaz.

Anket kanıtı dışarı paylaşılacaksa soru, seçili anonim yanıt, kaynak ve izinli bağlam ortak kapalı dünya önizlemesinde ayrı ayrı onaylanır. Contact/Company kimliği, ham Yanıt Kümesi, onaylanmamış diğer yanıtlar, gizli dağıtım koşulu ve boşluk/sayı ipuçları varsayılan olarak dışarıda kalır; bir kanıt hedefinin yayımlanması yanıtı otomatik yayımlamaz.

### Hafif araştırma katılımcısı operasyonları

İlk ürün Kullanıcı Araştırması Oturumunda amaç, soru rehberi, isteğe bağlı zaman, Contact ve izin bağlamını korur; davet, zamanlama teslimi veya katılımcı operasyonu yürütmez. İlk ürün çekirdeği doğrulandıktan sonra davet durumu, yeniden planlama, no-show, tekrar temas veya teşvik takibinin dış araçta tekrar tekrar kaybolduğu görülürse hafif iç operasyon bağlamı ayrıca değerlendirilebilir.

Yön açılırsa güncel planlanan zaman, `Hazırlanmadı`, `Hazırlandı`, `Dışarıda gönderildi` veya `Yanıtlandı` gibi yalnız iç takip niteliğindeki davet durumu, `Katıldı`, `No-show` ya da `İptal` sonucu, tekrar temas notu ve isteğe bağlı teşvik durumu mevcut Kullanıcı Araştırması Oturumunda yaşar. Yeniden planlama ve durum değişiklikleri ayrı davet ana kayıtları üretmeden normal değişiklik geçmişinde önceki değer, aktör ve zamanla korunur.

Bu yön e-posta veya mesaj göndermez, teslim/yanıt okumaz, takvim daveti üretmez, harici takvim senkronizasyonu kurmaz, uygun katılımcı bulmaz, kota/uygunluk paneli, recruitment marketplace, otomatik takip veya teşvik ödemesi oluşturmaz. Bu dış eylemlerden biri ileride gerekli olursa yetkilendirme, kişisel veri, teslimat, iptal ve saklama yaşamıyla ayrı ürün kararı gerektirir.

## Ekip, AI ve programatik erişim adayları

### Gelecekte ekip sistemi yönü

Ekip sistemi solo-builder ilk ürün akışını veya ondan sonraki kararlaştırılmış ticari genişlemeyi geciktirmez. Bu iki alan doğrulandıktan sonra ekip sistemi ayrı bir ürün genişlemesi olarak ele alınır; aşağıdaki mekanikler o değerlendirmede sınanacak aday davranışlardır ve bugünden teslim taahhüdü veya ilk ürün kapsamı oluşturmaz.

Değerlendirme açılırsa atama modelinde her İşin en fazla bir `Birincil sorumlu` ve isteğe bağlı birden fazla `Katkıda bulunan` taşıması ele alınır. Kişisel `My İş / Bana atananlar` yüzeyinin bunları `Sorumlu olduklarım` ve `Katkı sağladıklarım` olarak ayırması ve yakın zamanda tamamlanan işle aktif blokaj bağlamını aynı ana kayıtlardan göstermesi aynı adayın parçası olur. Atamanın İş durumunu veya Günlük Odak üyeliğini örtük değiştirmemesi ve Günlük Odağın her üyenin bilinçli kişisel seçimi olarak kalması bu adayın önkoşuludur.

Aynı değerlendirmede adlandırılmış görünümlerin aynı canlı ana kayıtlar üzerinde ortak bir tanım olarak ekiple paylaşılması ele alınır. Üyenin geçici filtre ve sunum değişikliklerinin açıkça ortak görünüme kaydedilmedikçe tanımı etkilememesi, kalıcı ortak değişikliğin ise görünür kaydetme eylemi ve uygun ekip yetkisi istemesi aranan sınırdır. Yetkili kullanıcının proje için `Önerilen ekip varsayılanı` belirleyebilmesi de aynı adayda değerlendirilir; böyle bir görünüm yeni veya kişisel tercih yapmamış üyelere başlangıç sağlar, fakat her üye kendi varsayılanıyla geçersiz kılabilir. Kart yoğunluğu, görünür alanlar ve benzeri kişisel sunum tercihlerinin ortak görünüm tanımından ayrı kalabilmesi beklenir.

Proje Etkinliğinin ayrı Team Feed olay sistemi oluşturmadan üye ve atama filtreleriyle, ayrıca `Ekipte son değişenler` gibi hazır bir görünümle genişletilmesi aynı değerlendirmeye girer. İsteğe bağlı günlük ekip özetinin mevcut atama, My İş, blokaj ve Proje Etkinliği verilerini üye bazında gruplaması bu adayın sınırlı biçimidir. Zorunlu standup formu, otomatik Daily Note, ayrı kalıcı rapor geçmişi, katılım veya kişi performansı takibi bu adayda bulunmaz.

Odak Dönemlerinin ekipçe kullanılan ortak kapsama genişlemesi de değerlendirilebilir; ayrı Sprint varlığı, zorunlu cadence, velocity/kapasite hesabı veya otomatik rollover eklenmez. Dönem sonundaki açık işlerin ekip tarafından bilinçli olarak sonraki döneme, Backlog'a veya başka kapsama gönderilmesi aranan davranıştır. İlk ekip aşamasının mevcut sığ `Proje → Özellik → İş` kapsamıyla başlaması öngörülür; sabit Epic veya yapılandırılabilir derin hiyerarşi ancak gerçek ekip kullanımında mevcut Kapsam Ağacının yetersizliği tekrar eden kanıt üretirse sıfırdan değerlendirilir.

Kaynak, uygunluk ve kapasite planlaması ilk ürüne ya da ilk ekip genişlemesine girmez. Gerçek ekip kullanımı birden fazla Proje arasında çalışma takvimi, availability, allocation veya skill/role bazlı staffing ihtiyacını doğrularsa bunlar daha sonraki ekip genişlemesinde birlikte değerlendirilir. Bu yön açılırken kişisel zaman bütçesi ile ekip kapasitesi, atanan İş ile ayrılmış kapasite ve kişi bilinmeden açılan kaynak isteği birbirinden ayrı modellenir; kişi performans puanı veya zorunlu time tracking varsayılmaz.

İş, Karar, Risk, Açık Soru ve desteklenen diğer ana kayıtlarda kayıt düzeyinde yorum dizileri ile `@mention` bu aşamada değerlendirilebilir. Yorumun kaydın durumunu, sorumlusunu veya alanlarını örtük değiştirmemesi ve ayrı ekip sohbeti ya da Proje Etkinliği doğruluk kaynağı oluşturmaması aranan sınırdır.

Kimliği doğrulanmış ekip paylaşımı ve belge izin modeli doğrulandıktan sonra Markdown Belgesindeki seçili metne bağlı dahili yorum dizileri bu aşamanın ayrı genişlemesi olabilir. Yorum kesin belge sürümü ve metin konumunu taşır; kaynak metin değiştiğinde sessizce başka ifadeye bağlanmaz, çözülebilir ve yeniden açılabilir. Yorum ana Belge metnini değiştirmez, kendiliğinden İş/Geri Bildirim oluşturmaz ve herkese açık ya da anonim paylaşım yüzeylerine açılmaz. Takip kaydına dönüşüm yalnız kaynak, hedef ve oluşacak ilişki önizlenerek başlatılan açık kullanıcı eylemidir.

Dahili belge yorumları ve ekip izinleri doğrulandıktan sonra ayrıca `Öneri Modu` değerlendirilebilir. Ekleme, silme ve biçim değişiklikleri kabul edilene kadar ana Belgeyi, canlı içerik bloklarını, arama sonuçlarını veya dışa aktarımları etkilemeyen sürüme bağlı farklar olarak tutulur; belge sahibi önerileri tek tek kabul veya reddeder. Kaynak sürüm değişmişse öneri sessizce uygulanmaz, çakışma gösterilir; öneren ile kabul/ret kararını veren kullanıcı değişiklik geçmişinde ayrı atfedilir.

Kimlik, belge izinleri, dahili yorumlar ve Öneri Modu gerçek kullanımla doğrulandıktan sonra belirli bir Belge sürümüne bağlı isteğe bağlı review isteği ve görünür review sonucu ayrıca değerlendirilebilir. Review sonucu belgeyi düzenlemeyi, İşi ilerletmeyi veya içeriği yayımlamayı varsayılan olarak engellemez; zorunlu approval gate bu yönün parçası değildir. Sonuç değerleri, kaynak sürüm değiştiğinde yeniden review davranışı ve olası süreç kapıları ancak bu faz açılırken ayrıca kararlaştırılır.

Ekip daveti, kesin rol adları, izin matrisi, yorum/atama yetkileri ve Guest kaynak görünürlüğü bu aşama gerçekten tasarlanırken birlikte kararlaştırılır; bu PRD şimdiden Zenhub benzeri organization/çalışma alanı/source izin modelini taahhüt etmez. Slack'ten yakalama veya iki yönlü yorum senkronu da bu ekip yönünün parçası değildir ve ancak gerçek kullanımda önemli girdilerin Slack konuşmalarında tekrar tekrar kaybolduğu doğrulanırsa sıfırdan değerlendirilir.

### AI değerlendirme alanı

İlk ürün AI içermez ve AI mevcut taahhüt edilmiş ürün yol haritasının parçası değildir. Manuel Hızlı Yakalama ve kalıcı kayda dönüşüm akışı gerçek dogfooding kullanımında doğrulanmadan AI kapsamı yeniden açılmaz. Daha sonra AI değerlendirmesi gerçekten başlatılırsa ilk dar aday, kullanıcının açıkça başlattığı ve kabul etmeden önce özgün yakalamayla yan yana karşılaştırdığı tek kaynaklı `Yakalama dönüşüm taslağı`dır; bu adayın uygulanması da o günkü kanıtla ayrıca kararlaştırılır. Çok kaynaklı Research ajan, geri bildirim/kanıt sentezi veya genel proje asistanı bu adayın önüne alınmaz. Aşağıdaki diğer adaylar bu öncelik kararıyla otomatik olarak kapsama girmez.

Gelecekte AI kapsamı değerlendirilirse AI varsayılan olarak kapalı kalır ve proje bazında açık opt-in gerektirir. Kullanıcı kayıt türü, alan, ek ve tekil kayıtları kalıcı olarak AI kapsamı dışında bırakabilir. Secret/credential ve ürünün sağlayıcıya gönderilmesini yasakladığı hassas veri sınıfları kullanıcı onayıyla dahi AI bağlamına girmez. Her işlem öncesinde kullanılacak kesin kayıt, alan, ek ve kaynak sürümü manifesti gösterilir; kapsam politikası değişiklikleri denetlenebilir geçmişte tutulur. Sağlayıcı, veri gizliliği, maliyet, saklama, model girdisi/çıktısı kullanımı ve silme davranışları uygulama kararı öncesinde ayrıca doğrulanır.

Alan gerçekten açılırsa bütün AI davranışlarının kullanıcı tarafından başlatılan, öneri ile ana kaydı ayıran, özgün ve önerilen içeriği karşılaştıran ve açık kabul gerektiren taslak akışları olması aranır. AI çıktısı kendiliğinden ilişki, karar, risk, iş durumu, proje ilerlemesi, sağlık güncellemesi veya herkese açık içerik oluşturmaz. İlk deneyimlerin genel sohbeti zorunlu giriş noktası yapmak yerine Yakalama, İş, Özellik, Belge ve Odak Dönemi gibi mevcut nesnelerde kaynak kapsamı ile olası farkı önceden belirli dar eylemler olarak sunulması beklenir.

- **Yakalama dönüşüm taslağı:** Özgün yakalamayı yanında koruyarak başlık, tür, tarih ve olası kontrol listesi maddeleri önerebilir. Hiçbir öneri kullanıcı onayından önce kalıcı kayda uygulanmaz.
- **Proje başlangıç taslağı:** Proje profilinden aşama, iş durumu, etkin alan, hazır görünüm ve ilk iş taslakları önerebilir. Önerilen yapı ve içerik önizlenir; kullanıcı onayı olmadan proje yapısı veya iş oluşturulmaz.
- **Yazma ve düzenleme yardımı:** Kullanıcının seçtiği metin üzerinde üretme, kısaltma, özetleme, dil düzeltme ve eylem maddesi çıkarma taslağı sunabilir. Özgün metin ile öneri karşılaştırılır; çıkarılan eylemler kendiliğinden kontrol listesi maddesi veya bağımsız iş olmaz.
- **Kaynak bağlantılı ilerleme özeti:** AI alanı gerçekten açıldıktan sonra proje, Odak Dönemi veya kapanış bağlamındaki gerçekleşmiş ana olaylardan kullanıcı tarafından açıkça başlatılan, düzenlenebilir bir ilerleme taslağı üretebilir. Her iddia kesin kaynak kayda bağlanır; taslak kullanıcı kabul etmeden kalıcı güncelleme, herkese açık içerik, durum veya ilerleme hükmü oluşturmaz. Bu aday mevcut teslim sırasına veya Yakalama dönüşüm taslağından önceki değerlendirmeye girmez.
- **Kaynak bağlantılı Devam taslağı:** Manuel `Çalışmaya Dön` özeti ve öncelikli `Yakalama dönüşüm taslağı` gerçek kullanımda doğrulandıktan sonra kullanıcı proje veya İş bağlamında açık `Devam taslağı hazırla` eylemini başlatabilir. Taslak yalnız işlem öncesinde gösterilen kesin Belge, Karar, Risk, İş, GitHub olayı ve desteklenen diğer kaynak/sürüm manifestinden üretilir; her iddia ana kaynağına bağlanır ve belirsiz ya da çıkarılamayan bilgi açık yer tutucu veya uyarı olarak kalır. Çıktı düzenlenebilir öneridir ve kullanıcı kabul etmeden ana kayıt, ilişki, durum veya herkese açık içerik oluşturmaz ya da değiştirmez. Sistem taslağı arka planda önceden hazırlamaz, kaynak değiştiğinde sessizce güncellemez ve AI'sız deterministik `Çalışmaya Dön` özetinin yerini almaz. Bu aday ilk ürüne veya mevcut teslim sırasına girmez.
- **Örnek kontrollü yazım stili:** İlk dar AI kullanımı doğrulandıktan sonra kullanıcı açıkça seçtiği az sayıdaki onaylı kayıt veya mevcut şablondan yalnız ton, başlık yapısı, bölüm sırası ve biçim tercihlerini alan isteğe bağlı bir stil profili oluşturabilir. Kullanılan örnekler ve etkileri görünür; profil düzenlenebilir ve tamamen sıfırlanabilir olur. Sistem bütün çalışma alanı içeriğini sessizce öğrenme verisi yapmaz, davranışı `model eğitimi` diye sunmaz ve stil profilinden gerçek, karar, öncelik veya kabul kriteri türetmez.
- **Kaynak bağlantılı koordinasyon asistanı:** Yukarıdaki dar eylemler doğrulandıktan sonra seçili Proje, spec, İş, Karar, Risk, GitHub ve diğer izinli bağlamlarda soru yanıtlayan; kaynaklı spec/iş taslağı ve coding-ajan handoff önizlemesi hazırlayan genel koordinasyon yüzeyi ayrıca değerlendirilebilir. Genel sohbet dar eylemleri gizleyen zorunlu giriş noktası olmaz; her iddia kaynağını, her önerilen mutasyon farkını ve kabul/ret sınırını korur.
- **AI Teknik Diyagram taslağı:** Manuel Teknik Diyagram ile öncelikli Yakalama dönüşüm AI adayı doğrulandıktan sonraki ayrı kapıdır; kesin bağımlılık, kaynak ve kabul sınırı yalnız [AI Teknik Diyagram taslağı](#ai-teknik-diyagram-taslagi) yönünde tanımlanır.

### Read-first programatik erişim yönü

İlk ürün, yalnız [test süreç ve sonuç yönetimine yapılandırılmış rapor ekleyen dar ve tek yönlü MCP istisnası](10-testing-and-validation.md#rapor-ekleme-yolları) dışında CLI, genel MCP, API, webhook veya başka programatik erişim yüzeyi sunmaz. Bu alan ileride gerçek genişletme ihtiyacı doğrulanırsa yazma yetkili genel API ile değil, varsayılan olarak `read-first` ve açık kapsamlı bir erişim katmanıyla başlar.

Değerlendirilecek ilk somut doğrulama kullanımı, kullanıcının seçtiği Proje, Birincil spec, Karar, Risk, İş, Wireframe sürümü, Teknik Diyagram, kesin Diyagram Sürümü ve desteklenen diğer kayıt/asset bağlamını Codex, Claude Code veya benzeri coding ajanına salt okunur aktaran MCP uyumlu bir bağlam köprüsü olur. Kullanıcının erişim açılmadan önce paylaşılacak kesin kayıt, alan ve asset manifestini görmesi ve erişimin süreli ya da açıkça iptal edilebilir olması bu adayın önkoşuludur. Ajan yalnız verilen kapsamı arayıp okuyabilir; kayıt oluşturamaz, değiştiremez, durum/ilişki güncelleyemez veya kullanıcı adına uygulama eylemi başlatamaz.

Aynı adayda kullanıcının erişilebilecek kesin çalışma alanı/proje, kayıt türü, kayıt kümesi, alan ve desteklenen asset kapsamını görüp onaylaması aranır. Araç ve kaynak türlerinin açık allow-list ile ayrı ayrı etkinleştirilmesi ve varsayılan erişim verilmemesi gerekir. Kullanıcı ajana sunulan her araç/kaynak adını, açıklamasını ve erişebileceği alanları görür. Yanıt biçiminin `Kompakt` veya `Yapılandırılmış` olarak sınırlandırılabilmesi; kayıt/satır sayısı, içerik boyutu ve token/yanıt bütçelerinin uygulanması ve aşımın sessiz kırpılmaması beklenir. Her araç veya kaynak çağrısı kapsamı ve sonucuyla ayrı denetim olayı oluşturur.

Yetkinin her zaman iptal edilebilir olması; erişim ve hata olaylarının denetlenebilir kayıtta tutulması, secret/credential döndürme ile geçici asset URL davranışının açıkça tanımlanması bu fazın koşullarıdır. Türetilmiş dashboard, blog, bilgi grafiği veya başka dış deneyim ana içeriği kopyalamadan yalnız verilen kapsamı okuyabilir ve erişim iznini başka kayda genişletemez. Kesin araç kataloğu, varsayılan çıktı bütçeleri, aşım hata sözleşmesi ve denetim saklama süresi bu faz uygulanırken ayrıca kararlaştırılır.

Salt-okunur köprü gerçek kullanımla doğrulandıktan sonra yazma yetkili MCP/ajan eylemleri ayrı ve kapılı bir gelecek fazında değerlendirilebilir; read-first fazın doğal veya otomatik devamı değildir. Varsayılan yetki salt-okunur kalır. Teknik Diyagram için en geniş ilk aday, kesin taban revizyonuna karşı düğüm/alan/bağlantı farkı sunan ve kullanıcı seçip onaylamadan kanonik modeli değiştirmeyen `Ajan öneri yaması`dır. Bütün yazma eylemleri kayıt ve işlem bazında en az yetki, uygulanacak kesin fark/önizleme, açık kullanıcı onayı, ajan ile başlatan/onaylayan insanın ayrı atfı, denetlenebilir history, çakışma güvenliği ve ilgisiz sonraki değişiklikleri koruyan geri alma ister. Güncel olmayan taban sessizce uygulanmaz; genel/gözetimsiz otonom yazma, direct CRUD, delete/archive, paylaşım kapsamı değiştirme, repository/DB yazma, webhook veya dış otomasyon bu kararla kapsama girmez.

Gelecekte MCP/ajan dışında herhangi bir sağlayıcı için dış sisteme alan yazan entegrasyon değerlendirilirse her senkronize alan kaynak sistemini ve sahiplik yönünü görünür taşır. Yerel değişiklik önce bekleyen outbound fark olarak önizlenir; ayrıca açıkça etkinleştirilmiş ve kapsamı görünen bir otomasyon yoksa kullanıcı `Push` onayı vermeden dış sisteme yazılmaz. Son başarılı sync, bekleyen outbound değişiklik ve conflict ayrı gösterilir; iki tarafta değişen değer sessizce ezilmez. Alan bağlantısı etkisi önizlenerek tek tek kaldırılabilir. Bu sözleşmeyi karşılamayan entegrasyon read-only kalır; kesin conflict seçenekleri ve otomasyon izinleri yalnız ilgili sağlayıcının gerçek API davranışıyla birlikte kararlaştırılır.

Bu gelecek fazında İşin hesap verebilir `Sorumlu` kimliği insan olarak kalır. Ajan ayrı `Yürütücü`, oturumu başlatan ve değişikliği onaylayan insan ise ayrı denetim kimlikleri olarak kaydedilir; ajan oturumunun sona ermesi İşin sahipliğini değiştirmez veya kaydı sahipsiz bırakmaz.

### GitHub içinde salt okunur PR Bağlam Kartı

Temel GitHub eşitlemesi gerçek kullanımda doğrulandıktan sonra Chrome ve Firefox uzantısı, GitHub PR sayfasında bağlı İşten türetilen salt okunur bir PR Bağlam Kartı sidecar'ı sunması değerlendirilebilir. Böyle bir kartın problem özeti, beklenen sonuç, Birincil spec, önemli Kararlar, açık Riskler, bağlantının gerekli/bağlamsal rolü, build/check ve reviewer özetini göstermesi ve her öğenin kaynak uygulama kaydını açması aranır.

Bu yüzey Zenhub benzeri tam proje yönetimi arayüzünü GitHub içine taşımaz; İş durumu, yorum, review, approve, merge veya başka GitHub/ürün mutasyonu yapmaz. Eklenti izinleri, hassas alan kapsamı ve GitHub Enterprise desteği gelecekteki uygulama kararında ayrıca doğrulanır.

### Kaynak bağlantılı geri bildirim sentezi

İlk ürün ve ilk dar AI adayı, birden fazla Geri Bildirim kaydını tema veya örüntü hâlinde sentezlemez. Dogfooding’de gerçek geri bildirim hacmi okuma, etiketleme veya ilişkilendirmede tekrarlanan bakım yükü yaratırsa kullanıcı tarafından açıkça başlatılan kaynak bağlantılı sentez ayrı bir AI adayı olarak değerlendirilebilir.

Bu yön açılırsa çıktı her iddiayı onu destekleyen kesin Geri Bildirim ve Kaynak kayıtlarına bağlayan, kalıcı kayıttan ayrı ve düzenlenebilir taslak olur. Kullanıcı kabul etmeden tema, ilişki, öncelik, Fırsat veya İş oluşturmaz; kişi sayısı ya da talep hacmini ürün kararı gibi sunmaz. Sağlayıcı, gizlilik, maliyet ve kabul/ret davranışları genel AI ilkeleriyle birlikte ayrıca doğrulanır.

### AI destekli Wireframe ve Prototype taslağı

AI destekli Kullanıcı Akışı/Wireframe üretimi ilk ürün veya taahhüt edilmiş gelecek özelliği değildir. Manuel Wireframe akışı ve öncelikli `Yakalama dönüşüm taslağı` gerçek dogfooding'de doğrulandıktan sonra, seçili spec, mevcut Wireframe, referans görsel veya ekran görüntüsünden düzenlenebilir ekran ve tıklanabilir akış taslağı üretmek ayrı ve kapılı bir AI adayı olarak değerlendirilebilir. Bu aday genel Visual Sitemap üretimini otomatik olarak kapsamaz.

Yön açılırsa sistem ana tasarımı değiştirmeyen ayrı taslak varyant üretir. Özgün ve önerilen ekranlar yan yana karşılaştırılır; kullanıcı yalnız seçtiği ekran, block ve bağlantıları ayrı ayrı kabul eder. Kaynak kayıt ve kesin sürümler görünür kalır; kabul edilmeyen taslak normal arama, paylaşım, planlama ve ilişki yüzeylerine girmez.

Sağlayıcı, veri gizliliği, maliyet, saklama, asset lisansı, kaynak sürüm sabitleme ve kabul/ret geçmişi uygulama kararından önce doğrulanır. Kod üretimi, gerçek servis bağlantısı, otomatik İş/Karar/ilişki oluşturma, geliştirici handoff veya uygulama değişikliği bu adayın kapsamında değildir.

## Yakalama, paylaşım ve yayın adayları

### Dış kaynaklardan geri bildirim adayı çıkarma

İlk ürün manuel Hızlı Yakalama modelini korur. Destek konuşmaları, uygulama mağazası incelemeleri veya başka dış kaynakları sürekli tarayıp otomatik geri bildirim adayı çıkarma; ancak gerçek kullanımda önemli geri bildirimlerin bu nedenle tekrar tekrar kaçırıldığı doğrulanırsa ayrı ürün yönü olarak değerlendirilebilir.

Bu yön açılmadan önce kaynak yetkilendirmesi, veri gizliliği, sağlayıcı ve saklama sınırları, yanlış aday ve kopya temizleme yükü ile kullanıcı onayı ayrıca doğrulanır. Üretilen adaylar kalıcı geri bildirim veya iş kaydı olmaz; özgün kaynağıyla triage’a gelir ve ancak kullanıcı kararıyla mevcut kayda bağlanır ya da yeni kalıcı kayda dönüşür.

Gelecekte e-posta, toplantı, form, Slack, webhook veya başka herhangi bir dış capture kanalı ayrıca onaylanırsa bütün kanallar ortak güvenli giriş sözleşmesini izler: `kaynak ve yetkili gönderici/kapsam doğrulaması → tekrar kontrolü → görünür hedef proje/tür/şablon yönlendirmesi → Yakalama Gelen Kutusu → kullanıcı triage'ı → ana kayıt`. Teslim, yetki ve tekrar hataları görünür olur. Hiçbir connector kullanıcı onayı olmadan doğrudan İş, Geri Bildirim veya başka ana kayıt üretemez; bu sözleşme belirli bir connector'ı şimdiden taahhüt etmez.

### Harici geri bildirim toplama yüzeyi

İlk ürün herkese açık veya özel ziyaretçi geri bildirim formu sunmaz; geri bildirim uygulama içindeki manuel Hızlı Yakalama akışında kalır. Dogfooding’de çalışma alanı dışındaki kişilerin geri bildirim iletememesi nedeniyle önemli girdilerin tekrar tekrar kaybolduğu doğrulanırsa ilk değerlendirilecek yüzey, gönderilen içeriği başka ziyaretçilere göstermeyen `submit-only` formdur. Görünür fikir kataloğu, oy, yorum, abonelik veya requester konuşması bu yönün parçası değildir.

Bu yön açılırsa alan izin listesi, spam ve kötüye kullanım koruması, iletişim bilgisi ve ek gizliliği, kopya yönetimi, adayın ana Geri Bildirim kaydına ne zaman dönüşeceği ve ziyaretçiye yanıt verilip verilmeyeceği yeni PRD kararı gerektirir. Form açılması herkese açık yorum, oy, requester konuşması veya iş durumunu değiştiren talep akışı anlamına gelmez.

### Çok sayfalı yayımlanabilir bilgi tabanı

İlk ürün tekil Wiki Belgesi yayını ve onaylı herkese açık Proje yüzeyleriyle kalır. Birden fazla ilişkili Belgeyi self-service ürün dokümantasyonu olarak birlikte yayımlama ihtiyacı açık kaynak maintainer, freelancer veya küçük ekip kullanımında doğrulanırsa hiyerarşili ve aranabilir çok sayfalı bilgi tabanı ilk ürün sonrası stratejik aday olarak değerlendirilebilir.

Bu yön tekil sayfa yayınını otomatik olarak bir siteye dönüştürmez. Açılırsa belge kapsamı ve navigasyon, arama dizini, audience/access modeli, ortak yayın snapshot'ı ve fark onayı, toplu yayın/geri çekme, iptal/cache davranışı ve bilgi boşluğu ölçümünün gizlilik sınırı birlikte kararlaştırılır. Ana Belgeler kopyalanmaz; yayımlanan site ayrı belge doğruluk kaynağı, herkese açık yorum/oy yüzeyi veya Aha! Knowledge benzeri kurumsal yönetişim paketi oluşturmaz.

#### OpenAPI referans sayfası

Çok sayfalı bilgi tabanı yönü açılırken API geliştiren gerçek bir Projede OpenAPI spec'i, Proje Sürümü ve dış geliştirici dokümantasyonu arasında paralel doğruluk kaynağı oluştuğu doğrulanırsa salt okunur API referans sayfası bu bilgi tabanının ayrı sayfa türü olarak değerlendirilebilir; bağımsız API portalı veya ayrı yayın yaşamı oluşturmaz.

İlk dilimde kullanıcı kesin OpenAPI dosyasını açıkça yükler. Biçim, sürüm, boyut, dış `$ref` kullanımı, çözülemeyen referanslar ve üretilecek endpoint/şema farkı hiçbir ana Kaynak sürümü yazılmadan önce doğrulanır ve önizlenir. Onay geçerli dosyayı sürümlü Kaynak olarak kaydeder; seçili kesin Kaynak sürümü aynı Projenin Proje Sürümüne açık ilişkiyle bağlanabilir ve bilgi tabanında okunabilir referans snapshot'ı üretebilir. Yeni dosya sürümü mevcut yayımlanmış referansı sessizce değiştirmez; ortak yayın farkı ve açık onay gerekir.

Bu sayfa normal bilgi tabanı navigasyonu, araması, snapshot manifesti, iptal ve cache güvenliğini kullanır. GitHub dosya seçimi veya canlı Git senkronizasyonu, periyodik URL çekimi, API anahtarı/credential yönetimi, çalıştırılabilir request playground'u, mock server, SDK üretimi, kod örneğini çalıştırma ve ayrı developer portalı bu yönün ilk diliminde bulunmaz.

### Safari Web Clipper

İlk ürün Web Clipper Chromium ailesi ile Mozilla Firefox'u destekler; Safari paketi sunmaz. Dogfooding veya kullanıcı doğrulaması Safari eksikliğinin tekrar eden bir yakalama engeli olduğunu gösterirse aynı açık kullanıcı eylemi, hassas sayfa uyarısı, önizleme ve geçici Yakalama Gelen Kutusu sınırlarını koruyan Safari uzantısı ayrıca değerlendirilebilir.

Safari yönü mevcut uzantıya yeni yakalama türü, arka plan taraması, çevrimdışı kuyruk veya doğrudan ana kayıt oluşturma yetkisi vermez. İzin ve dağıtım farkları mevcut veri sınırını değiştiremez.

### Proje Duvarı karşılama mesajı ve harici embed

İlk ürün Proje Duvarını iptal edilebilir bağlantıyla sınırlı salt okunur paylaşım veya onaylı Build in Public snapshot'ı olarak sunar; ziyaretçiye özel karşılama mesajı ve üçüncü taraf siteye gömülebilen genel duvar widget'ı yoktur. Dış paydaşların bağlamı anlayamaması veya aynı onaylı görsel snapshot'ı başka bir sitede tekrar sunma ihtiyacı tekrarlanırsa bu iki mekanik ayrı ayrı değerlendirilebilir.

Her iki yönde de kapalı dünya kapsamı, iptal/cache davranışı, exact snapshot etiketi, YouTube için tıklayınca üçüncü taraf yükleme ve özel öğelerin dolaylı sızıntısını engelleme korunur. Embed duvarı düzenleyemez, kopyalayamaz veya canlı ana kaynağa erişemez; mevcut changelog ya da roadmap widget yönünü otomatik olarak kapsamaz.

### Proje dışı görsel duvar

İlk üründe Proje Duvarı yalnız proje kapsamındadır. Çalışma alanı veya Kişisel Wiki düzeyinde görsel toplama ihtiyacı gerçek kullanımda tekrarlanırsa ayrı kapsam, ilişki, paylaşım ve taşınabilirlik modeliyle değerlendirilebilir; proje duvarları iç içe geçirilmez ve yeni yüzey otomatik olarak çalışma alanı ana sayfasına dönüşmez.

### Moodboard içinde yerleşik görsel arama

İlk ürün kullanıcı yüklemeleri ve açıkça kaydedilen dış bağlantılarla kalır. Yerleşik stok görsel araması ancak kaynak/lisans bilgisini koruma ve seçilen görseli kesin Dosya Eki ya da Kaynak Kaydı olarak içe alma davranışı doğrulanırsa ayrıca değerlendirilebilir. Sağlayıcı sonuçları, otomatik görsel veya renk önerisi ve production tasarım token'ı üretimi bu yönle kendiliğinden kapsama girmez.

### Contact/Company için ticari ve CRM zenginleştirmesi

İlk ürün geri bildirim kimliği ve geçmişi için hafif Contact ve isteğe bağlı Company kayıtlarını içerir; bunlara plan, gelir, sözleşme, satış aşaması veya başka CRM alanları eklemez. Dogfooding’de ürün kararları için ticari bağlamı güncel tutma ihtiyacı süreklilik kazanır ve mevcut proje bazlı özel alanların yetersizliği doğrulanırsa bu zenginleştirme ayrıca değerlendirilebilir.

Bu genişleme ürünün genel solo-builder yönünü SaaS/CRM ağırlıklı bir kullanıma kaydırabileceği, yeni veri güncelliği ve manuel bakım sorumlulukları yaratacağı için kimlik/geçmiş çekirdeğinden ayrı tutulur.

### Paylaşılabilir proje yapısı şablonları

Gelecekte kullanıcı mevcut projenin aşama, iş durumu, etkin alan, hazır görünüm ve proje bazlı özel alan şemasını gerçek içerik, ilişki ve çalışma geçmişi olmadan başka kullanıcıların bağımsız projeler oluşturabileceği yapısal şablon olarak paylaşabilir.

İlk doğrulama herkese açık galeri veya pazar yerine iptal edilebilir bağlantıyla sınırlı paylaşım yüzeyiyle yapılır. Şablon paylaşımı kullanıcının mevcut çalışma alanı içindeki `Proje yapısını kopyalama` davranışını değiştirmez; herkese açık keşif ve galeri ayrıca ürün kararı gerektirir.

### Kimlik doğrulamalı özel salt-okunur paylaşım

İlk ürün iptal edilebilir, isteğe bağlı ortak parola taşıyabilen ve ziyaretçi kimliği istemeyen bağlantı paylaşımıyla kalır. Hassas beta veya müşteri içeriğinde bağlantı ve parolanın başkasına iletilmesi tekrar eden bir erişim sorunu olarak doğrulanırsa e-posta daveti, ziyaretçi oturumu, erişim listesi ve kişi bazlı iptal içeren kimlik doğrulamalı salt-okunur paylaşım collaboration-ready aşamasında değerlendirilebilir.

Bu yön mevcut bağlantıyla sınırlı paylaşımı sessizce kimlik zorunlu hâle getirmez; bağlantı tabanlı ve kimlik doğrulamalı paylaşımın erişim, iptal ve denetim davranışları ayrı ve görünür kalır.

### Paylaşılan içerikte bağlama sabitlenmiş asenkron geri bildirim

İlk ürünün bağlantıyla sınırlı paylaşımı tek yönlü ve salt okunur kalır. Kimlik doğrulamalı özel paylaşım doğrulandıktan sonra dış paydaşın seçili Belge bölümü, İş, Wireframe ekranı/block'u, Moodboard öğesi veya Proje Duvarı konumuna asenkron geri bildirim bırakabilmesi ayrı collaboration-ready yönü olarak değerlendirilebilir. Bu yön herkese açık yorum, anonim reaksiyon, ortak çizim veya düzenleme yetkisi açmaz.

Yön açılırsa geri bildirimin yazar kimliği, görünürlük kapsamı, bildirim/follow davranışı, çözümleme durumu, silme/saklama süresi ve kaynak silinmesi ya da paylaşım iptalindeki davranışı açıkça tanımlanır. Konum sabitlemesi ana kayda erişim vermez; izin kaybolduğunda özel içerik veya uzamsal ipucu sızdırmayan kırık hedef gösterir.

Yorum kendiliğinden ana Geri Bildirim veya İş kaydı değildir. Kullanıcı açık `Geri Bildirim kaydına dönüştür` ya da `Takip işi oluştur` eylemini başlatırsa özgün yorum, hedef kaynak ve oluşacak ilişkiler önizlenir; ancak onaydan sonra yeni ana kayıt oluşur. Yorumun çözülmesi veya paylaşımın iptali dönüştürülmüş kaydı sessizce kapatmaz ya da silmez.

### Zaman uyumlu anlatımlı görsel tur

İlk ürün Proje Duvarı ve Moodboard odak sırası ile bağımsız medya eki oynatımını korur; zaman uyumlu anlatım kaydı üretmez. İlk ürün dogfooding'i ve bağlantıyla sınırlı paylaşım doğrulamasından sonra asenkron handoff'ta görsel bağlamın tekrar tekrar kaybolduğu görülürse kullanıcının ses/video anlatımını seçili Proje Duvarı, Moodboard, Kullanıcı Akışı veya Wireframe gezinmesiyle zaman uyumlu kaydetmesi ilk ürün sonrası yön olarak değerlendirilebilir.

Yön açılırsa kayıt kesin kanvas/tasarım snapshot'ına ve kayıt anındaki odak rotasına bağlanır. Ana kaynak sonradan değiştiğinde eski anlatım güncelmiş gibi sunulmaz; snapshot zamanı ve varsa eskime farkı görünür olur. Kayıt izinleri, medya depolama/saklama, transcript veya bölüm üretimi, üçüncü taraf paylaşımı ve iptal/cache davranışı ayrıca kararlaştırılır; bu yön AI özeti veya otomatik eylem maddesi üretimini kendiliğinden kapsamaz.

### Kesin zaman aralıklı ses/video kanıtı

İlk ürün kanıt modelini sürüme sabit metin parçaları ile kesin görsel/PDF/Wireframe konumlarıyla sınırlar. Ses tonu, ekran davranışı veya sözlü bağlamın bu biçimlerde kritik ölçüde kaybolduğu tekrar eden gerçek kullanım doğrulanırsa desteklenen ses/video Dosya Eki sürümünde `başlangıç zamanı + bitiş zamanı` taşıyan kanıt bağı ilk ürün sonrası aday olarak değerlendirilebilir.

Yön açılırsa kanıt kesin medya sürümünü ve zaman aralığını korur, yeni dosya sürümüne sessizce taşınmaz ve kaynak kaydı açar. Mevcut Kullanıcı Araştırması Oturumu böyle bir medya için ayrı clip dosyası, transcript veya Discovery yaşam döngüsünü zorunlu kılmaz. Erişim, saklama süresi, büyük dosya maliyeti, telif/izin, dışa aktarma ve özel/herkese açık paylaşım davranışları uygulanmadan önce ayrıca kararlaştırılır; medya kanıtı AI özeti veya otomatik öğrenim üretmez.

### Dış oturum tekrarı kanıtı

İlk ürün FullStory, Hotjar veya benzeri oturum tekrarı sağlayıcısına bağlanmaz. Yapılandırılmış ölçüm Kaynağı yönü ve kişisel veri sınırı doğrulandıktan sonra davranışsal bir bulgunun yalnız metin notuyla güvenilir biçimde aktarılamadığı tekrar eden gerçek kullanım oluşursa dış oturumun kesin zaman aralığına bağlanan kanıt ayrıca değerlendirilebilir.

İlk dilim videoyu, kareleri, event akışını veya ziyaretçi profilini ürüne kopyalamaz. Proje kapsamındaki dış Kaynak; sağlayıcıyı, opaque session kimliğini, güvenli URL'yi, kesin başlangıç/bitiş aralığını, insan tarafından yazılan gözlem notunu, erişim durumunu ve gerekli izin/işleme bağlamını taşır. Kanıt hedefi yalnız bu açık Kaynak ve zaman aralığıyla kurulur; erişim sona erdiğinde eski görüntü varmış gibi sunulmaz, kaynak erişilemez işaretiyle tarihsel bağlam kalır.

Oturum tekrarı kanıtı ilk dilimde özel Proje bağlamından çıkarılamaz; bağlantıyla sınırlı paylaşım, Build in Public, export edilen herkese açık paket veya başka bir dış yüzeye alınamaz. Dış paylaşım gerçekten gerekli olursa yeniden kimlik çıkarımı, üçüncü kişi verisi, consent/işleme dayanağı, redaksiyon, saklama, sağlayıcı erişimi ve cache sınırlarıyla ayrı güvenlik kararı gerekir. Yön heatmap, funnel, canlı analytics dashboard'u, arka plan taraması, otomatik sorun/tema çıkarımı veya video depolama ürünü oluşturmaz.

<a id="herkese-acik-taahhut-etki-gorunumu"></a>
### Herkese Açık Taahhüt Etki Görünümü

Kullanıcı seçili kesin iç kayıt veya sürüm için, onu içeren aktif, süresi dolmuş veya iptal edilmiş Dış yüzeylere ait onaylı herkese açık snapshot revizyonlarını tek salt okunur görünümde inceleyebilir. Görünüm yalnız [ortak snapshot ve dış görünürlük güvenlik sözleşmesindeki](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) kesin manifest üyeliklerinden hesaplanır; her sonuç Dış yüzeyin durumunu, onay zamanını, snapshot revizyonunu ve gösterilen kesin kayıt/alan sürümünü açar. Süresi dolmuş ve iptal edilmiş yüzeyler yalnız tarihsel taahhüt bağlamıdır; yalnız aktif yüzeyler güncelleme adayı olarak ayrıştırılır. Serbest metinde aynı veya benzer ifadeyi arayıp anlamsal vaat çıkarmaz. Bağlantıyla sınırlı özel paylaşım, kimlik doğrulamalı özel paylaşım, Proposal ve statik export ilk doğrulama kapsamına girmez.

Görünüm yeni Taahhüt ana kaydı, inceleme-tamamlanma durumu, kopya yayın içeriği, otomatik İş veya yayıma hazır olma hükmü üretmez. Kullanıcı değiştirilmesi gereken bir dış sunum görürse takibi mevcut İş ve yayın farkı/onay akışlarında yürütür; bir yüzeyin görünümde bulunması onun yanlış veya güncellenmesi zorunlu olduğu anlamına gelmez.

İlk doğrulama, herkese açık Roadmap, changelog veya yayımlanmış Wiki içeriğini etkileyen üç gerçek ürün değişikliğiyle yapılır. Aday ancak en az iki değişiklikte mevcut geri bağlantılarla güvenilir biçimde bulunamayan, unutulabilecek onaylı bir herkese açık snapshot'ı doğru biçimde görünür kılarsa ilerler. Bu eşik karşılanmazsa yön bırakılır; başarılı deney de ilk ürün veya teslim taahhüdü oluşturmaz.

### Ürün içine gömülebilen changelog

İlk ürün herkese açık changelog sayfasıyla kalır. Dogfooding’de aynı changelog içeriğini üretim uygulamasına tekrar yazma ihtiyacı süreklilik kazanırsa onaylanmış herkese açık changelog snapshot’larını gösteren salt okunur, birinci taraf widget ayrıca değerlendirilebilir.

Widget yönü açılırsa embed/SDK dağıtımı, herkese açık veri uç noktası, cache ve iptal davranışı, güvenlik sınırı ve yeni yayın işaretinin okundu bilgisi ayrıca tanımlanır. Widget ana içeriği düzenleyemez ve kendi changelog doğruluk kaynağını oluşturmaz.

### Ürün içine gömülebilen herkese açık Roadmap

İlk ürün bağımsız herkese açık Roadmap sayfasıyla kalır. Dogfooding veya kullanıcı doğrulaması, ziyaretçinin planı görmek için ürün bağlamından ayrılmasını tekrarlanan bir sorun olarak gösterirse onaylanmış herkese açık Roadmap snapshot’ını sunan salt okunur, birinci taraf widget ayrı bir ürün yönü olarak değerlendirilebilir.

Changelog widget yönünün açılması herkese açık Roadmap widget’ını otomatik olarak kapsamaz. İki yüzey onaylı herkese açık snapshot ve güvenli embed altyapısını paylaşabilse de Roadmap’in taahhüt ve beklenti anlamı, gezinmesi, cache ve iptal davranışı ile güvenlik sınırı ayrıca tanımlanır. Widget ana planı düzenleyemez ve ikinci bir plan doğruluk kaynağı oluşturamaz.

### Build in Public özel alan adı

İlk ürün ürünün sağladığı kararlı herkese açık URL’yi ve isteğe bağlı proje logosunu kullanır. Dogfooding veya kullanıcı doğrulaması tekrarlanan bir marka/hosting ihtiyacı gösterirse kullanıcıya ait özel alan adı ayrıca değerlendirilebilir.

Bu yön açılmadan önce DNS ve alan adı sahipliği doğrulaması, SSL sertifikası, yönlendirme, iptal ve hata yönetimi ürün kapsamı olarak tanımlanır. Özel alan adı tam white-label, özel tema veya içerik sahipliğinin değişmesi anlamına gelmez.

### Herkese açık içerik çevirisi

İlk ürün herkese açık roadmap, changelog veya gelecekteki widget içeriğini ziyaretçi diline otomatik çevirmez. Çok dilli herkese açık trafik somut ve tekrarlanan ihtiyaç üretirse çeviri, son onaylanmış herkese açık snapshot’tan türeyen ayrı bir yayın sunumu olarak değerlendirilebilir.

Çeviri yönü açılırsa ziyaretçi özgün metne dönebilir; çeviri ana içeriği değiştirmez ve kaynak içerik ya da yayın kapsamı değiştiğinde önceki çeviri yeni onaylı snapshot’ın yerine geçmez.

### Zamanlanmış changelog yayını

İlk üründe changelog yayını kullanıcı tarafından o anda başlatılan manuel bir eylem olarak kalır. Temel sürüm–changelog–herkese açık snapshot döngüsü dogfooding'de doğrulandıktan ve belirli bir zamanda yayınlama ihtiyacı tekrarlanan kanıt ürettikten sonra, önceden onaylanmış changelog snapshot'ını açık tarih, saat ve saat diliminde yayımlama yönü ayrıca değerlendirilebilir.

Gelecekte bu yön açılırsa kullanıcı zamanlanmış yayını gerçekleşmeden önce iptal edebilir. İçerik veya yayın kapsamı değiştirildiğinde önceki yayın onayı geçersiz olur ve yeniden önizleme/onay gerekir. Zaman geldiğinde yalnız changelog snapshot'ı herkese açık olur; ilgili Proje Sürümü, işler, herkese açık durumlar ve gelişim akışı kendiliğinden değiştirilmez. Başarısız yayın içeriği özel tutar ve Birleşik Bildirim Merkezi'nde eylem gerektiren bir sinyal üretir.

Bu yön, Proje Sürümü kaydına yerleşik hedef yayın tarihi veya gerçek yayın tarihi alanı eklemez; bu alanlara ilişkin mevcut ilk ürün kararı değişmez.

### Sağlayıcısız ödeme altyapısı yön notu

İlk ticari genişleme manuel ödeme girdisi tutar fakat ödeme tahsil etmez. Gerçek kullanım, Invoice için ürün içinden tahsilat başlatma ve sonucu güvenilir biçimde uzlaştırma ihtiyacını tekrar eden kanıtla gösterirse ödeme altyapısı bağlayıcı olmayan yön notu olarak değerlendirilebilir. Ülke, ödeme akışı, para hareketi sahipliği, iade/itiraz, PCI ve kişisel veri sınırı, webhook/idempotency, operasyon, maliyet ve ticari kabul paketi ayrı Kararla tanımlanmadan sağlayıcı seçilmez veya teknoloji yığınına eklenmez.

### Sağlayıcısız ürün analitiği yön notu

İlk ürün dogfooding'i mevcut kaynak bağlantılı Deney/Doğrulama, Decision ve Proje Sürümü gözlemleriyle yürür; kalıcı event sağlayıcısı veya kullanıcı profilleme sistemi kurmaz. Tekil kullanıcı ya da oturum takibi olmadan cevaplanamayan açık ürün sorusu tekrar eden kanıt üretirse amaç, olay allow-list'i, consent/işleme dayanağı, kimlik çıkarımı, saklama, redaksiyon, bölge, erişim ve kabul yöntemi ayrı Kararla tanımlanır. Bu karar verilmeden analytics sağlayıcısı seçilmez veya teknoloji yığınına eklenmez; herkese açık ziyaretçi profilleme, session replay, heatmap ve davranışsal reklam kapsamı kendiliğinden açılmaz.

---
