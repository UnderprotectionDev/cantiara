# Cantiara — Ürün Vizyonu ve Kapsamı

Bu belge ürünün amacının, kullanıcısının, ilk ürün sınırının, çalışma ilkelerinin ve tamamlanma tanımının tek normatif sahibidir. Ürün alanlarındaki davranışlar ilgili alan belgesinde, ürün-geneli kalite hedefleri [Ürün Kalitesi](15-product-quality.md) belgesinde, doğrulama yöntemi ile kanıt ise [Ürün Kabulü](16-product-acceptance.md) belgesinde yaşar.

<a id="urun-amaci-ve-kullanicisi"></a>
## Ürün amacı ve kullanıcısı

- **Ürünün marka adı Cantiara'dır.** Ad, İtalyancada bir işin veya eserin yapım alanını ifade eden `cantiere` kelimesinden esinlenir; Cantiara'nın kendisi İtalyanca bir sözlük kelimesi değil, ürün için türetilmiş özel addır.

- **Ürün, bir yazılım ürününü araştırma, tasarım, geliştirme, doğrulama, sürüm ve paylaşım boyunca tek başına yürüten bağımsız ürün geliştiricisinin proje bağlamını tek doğruluk kaynağında koruyan kişisel proje işletim sistemidir.** Kodun yanı sıra belgeleri, işleri, tasarımları, kararları, riskleri, varsayımları, geri bildirimleri, üretim olaylarını, Proje Sürümlerini, repository bağlantılarını ve çalışma geçmişini aynı proje bağlamında tutar. Projeden bağımsız kalması gereken kalıcı bilgi Kişisel Wiki'de yaşar; aynı bilgi hem proje belgelerinde hem de Wiki'de ayrı doğruluk kaynakları olarak tutulmaz.

- **İlk kullanıcı kurucudur.** Uzun vadeli birincil kullanıcı da bir yazılım ürününü araştırma, tasarım, geliştirme, sürüm ve paylaşım boyunca tek başına yürüten **solo product builder / bağımsız ürün geliştiricisidir**. İlk hedef, kurucunun kullanacağı tam web ve macOS Tauri deneyimini gerçek projelerle doğrulamaktır.

Ürün üç temel değer sunar:

- **Fikirden gözlenen sonuca kadar ürün geliştirme sürecini tek proje bağlamında yürütmek.**
- **İşleri, kararları, kanıtları, tasarımları, kod değişikliklerini ve sürümleri birbirine bağlayarak neden–sonuç zincirini görünür tutmak.**
- **Proje gerçeğini parçalamadan korumak; oluşan bilgiyi doğru kapsamda yeniden kullanmak ve güvenle paylaşmak.**

Bu değerleri destekleyen iki tamamlayıcı yetenek vardır:

- **Projeden bağımsız kalıcı bilgi Kişisel Wiki'de yeniden kullanılabilir.**
- **Seçilen proje bağlamı ikinci bir içerik sistemi kurulmadan kontrollü biçimde paylaşılabilir veya yayımlanabilir.**

Birincil kullanıcı işleri şunlardır:

1. **Sınıflandırılmamış bir girdiyi kaybetmeden yakalamak ve kalıcı bağlama dönüştürmek.**
2. **Yapılacak işi, nedenini, kanıtını, bağımlılıklarını ve planını birlikte yönetmek.**
3. **Belge, karar, risk, varsayım, araştırma, tasarım ve test bağlamını aynı projede korumak.**
4. **Kodlama veya başka test-dışı çalışma dış araçta yürütülürken kesin gidiş bağlamını ve uzlaştırılmış dönüşü İşte korumak.**
5. **Proje Hedefinden kanıta, uygulamaya, Sürüme ve gözlenen sonuca uzanan Değer Zincirini kopukluklarıyla görmek.**
6. **GitHub geliştirme gerçeğini proje planıyla ilişkilendirip Proje Sürümünü hazırlamak; hedef kitleye erişim ile gözlenen sonucu birbirinden ayırarak yeniden değerlendirmek.**
7. **Teknik mimariyi, PostgreSQL veri modelini ve sistemler arası sıralı etkileşimi proje kayıtlarıyla birlikte modellemek; kesin şema sürümünden statik doğrulanmış DDL ve schema-only migration artefaktı üretmek.**
8. **Seçilen proje bağlamını özel içeriği sızdırmadan paylaşmak veya herkese açık yayımlamak.**
9. **Seçili belge ve yapılandırılmış kayıtları uygulamaya bağımlı kalmadan standart Markdown, JSON veya CSV biçiminde dışa aktarmak.**

<a id="kapsam-dili"></a>
## Kapsam ve normatif dil

- **İlk ürünün zorunlu kapsamı bu belge ile `02`–`15` arasındaki ürün ve kalite belgelerinde tanımlanır.** [Ürün Kabulü](16-product-acceptance.md) bu davranışların test yöntemini ve tamamlanma kanıtını tanımlar. Bütün zorunlu davranışlar ve kabul koşulları birlikte karşılanmadan Ürün sürüm adayı tamamlanmış sayılmaz; ilk ürün ayrıca teslim aşamalarına veya öncelik kodlarına bölünmez. Bu hüküm uygulama çalışmasının bağımlılığa göre iç teknik dilimlere ayrılmasını engellemez; hiçbir iç dilim kısmi ürün yayımlamak, zorunlu kapsamı düşürmek veya kabulü ertelemek için kullanılamaz.

- **[Ticari Genişleme](17-commercial-expansion.md) ilk ürün doğrulandıktan sonraki kararlaştırılmış alandır.** [Gelecek Yönleri](18-future-directions.md) ancak belirtilen kanıt oluşursa ayrıca değerlendirilecek adayları, [Kapsam Dışı Hükümler](19-out-of-scope.md) ise bu ürün kapsamında bulunmayan açık sınırları taşır. Bir kabul örneği, gelecek anlatısı veya başka dosyadaki söz bir davranışı sessizce ilk ürün kapsamına alamaz.

- **`Sistem sunar`, `destekler`, `korur`, `gösterir` ve `engeller` zorunlu ürün davranışıdır.** `Kullanıcı isteğe bağlı olarak` ifadesi yeteneğin zorunlu, kullanımının isteğe bağlı olduğunu belirtir. `Sunabilir`, `desteklenebilir` veya bağlamı belirsiz `olabilir` zorunlu davranış oluşturmaz; metin açık zorunlu davranışa, kullanıcı seçimine veya gelecek adayına dönüştürülür.

- **Bir alanın veri modeli başka bir alanın gereksinimlerini önceden destekleyebilir; kullanıcıya yarım, güvenlik sınırı belirsiz veya doğrulanmamış yüzey açılmaz.** Güvenlik, veri bütünlüğü, kimlik, kapsam, yaşam döngüsü veya ürün kabulünü etkileyen açık karar ilk ürün belgelerinde bırakılmaz. Görsel düzen ve sağlayıcı seçimi gibi ürün davranışını değiştirmeyen uygulama ayrıntıları ilgili teknik tasarımda çözülebilir.

- **Aşağıdaki sunum düzeyi davranışlarda PRD bilinçli olarak hiçbir eşik, sayı veya algoritma vaat etmez.** Kapalı liste; yakalama triage'ındaki ve yeni İş oluşturmadaki benzer kayıt önerilerini, `Çalışmaya Dön` yüzeyinin seçtiği geri dönüş kartı sayısını, yapılandırılmış bir bölümün boş durum sunumunu, Bitiriş efekti tema adlarının çağrıştırdığı hissi, Günlük Odak kapanış görünümünün ve Odak Dönemi kapanış özetinin sunum tonunu kapsar. Bu yüzeylerin varlığı, güvenlik sınırları ve erişilebilirlik sözleşmesi zorunludur; benzerlik ölçütü, gösterilecek öğe sayısı ve görsel ton ilgili teknik tasarımda çözülür ve kabulde eşik olarak sınanmaz.

- **PRD'nin normatif açıklama dili ve kullanıcıya dönük açıklayıcı ürün belgeleri Türkçe; kaynak kod, kod içi adlandırmalar ve ilk ürünün kullanıcı arayüzü dili İngilizcedir.** Navigasyon, düğme, durum, sistem mesajı, doğrulama hatası ve ürünün sağladığı varsayılan şablon metni İngilizce olur; kullanıcı içeriği çevrilmez. Protokol, dış sağlayıcı ve ekosistem tarafından zorunlu kılınan özgün adlar korunur. PRD Türkçe domain terimini kullanabilir fakat kullanıcıya gösterilen kesin terim [ortak sözlükteki İngilizce UI etiketiyle](02-domain-model-and-lifecycle.md#terim-sözlüğü) belirtilir. Arayüz dili kullanıcı tercihi değildir; tarih, saat ve sayı biçimi Hesap locale'ından gelir. İlk üründe kullanıcıya gösterilen para birimi alanı bulunmaz; para birimi yalnız [Ticari Genişleme](17-commercial-expansion.md) etkinleştiğinde ilgili ticari belgeden gelir.

- **Uygulama planlaması başlamadan kullanıcıya görünen anlamsal İngilizce sözlük kapatılır.** Kayıt türleri, durumlar, eylemler ve kullanıcıya gösterilen hata adları tek anlam için tek terim kullanır. Uzun yardım metni ve açıklayıcı şablon gövdeleri ilgili yüzey tasarımında tamamlanabilir; ancak Ürün sürüm adayı kabulünde bütün varsayılan şablon metinleriyle birlikte [ürün dili kabul envanterine](16-product-acceptance.md#uctan-uca-kabul-yolculuklari) girer.

<a id="dogfooding-ve-tamamlanma"></a>
## Dogfooding ve tamamlanma koşulları

- **Ürün öncelikle kurucunun kendi gerçek yazılım projelerinde kullanması için geliştirilir.** İlk Ürün sürüm adayının birincil gerçek dogfooding Projesi Cantiara'nın kendisidir; sentetik fixture'lar otomatik testte kullanılabilir fakat bu gerçek Proje kanıtının yerine geçmez. İlk ürün varsayımları, hazır yapılandırmalar ve günlük akışlar bu doğrudan kullanımla doğrulanır. Ürün satışa açılmayacak olsa da dış görünürlük, paylaşım ve GitHub davranışları ilk ürün sözleşmesinin parçasıdır.

Ürün sürüm adayı aşağıdaki koşullar birlikte sağlanmadan doğrulanmış sayılmaz:

| Ölçü | Kabul eşiği |
| --- | --- |
| Gerçek proje | Gerçek repository'ye bağlı en az bir yazılım projesinde, [uçtan uca kabul yolculuklarının](16-product-acceptance.md#uctan-uca-kabul-yolculuklari) gerçek proje kanıtı gerektiren bütün kümesi baştan sona tamamlanır. Kapının kapsamı bu belgede ayrıca sayılmaz; her zorunlu ürün alanı kabul tablosunda en az bir yolculuğa bağlı olduğu için hiçbir alan kapıdan sessizce düşemez |
| Kişisel Wiki | Cantiara Projesine ait PRD veya proje belgeleri yerine kurucunun yeniden kullanılabilir teknik not, araç notu, öğrenim ve referanslarından oluşan aynı gerçek proje-dışı kişisel yazılım geliştirme bilgi kümesi; klasörler, belge hiyerarşisi, şablonun gerçek yeniden kullanımı, arşivden geri yükleme, sürüm karşılaştırma/geri yükleme, anlamlı backlink/ilişki/Dosya Eki ve Markdown/PDF dışa aktarma ile uçtan uca sürdürülür |
| Paralel doğruluk kaynağı | Kapsamdaki İş, Belge, Karar, Risk, test ve Proje Sürümü yönetimi için başka bir proje veya belge sistemi ana doğruluk kaynağı olarak kullanılmaz |
| Dış araca kaçış | Her yüksek etkili kaçış aynı gerçek iş akışının mevcut Ürün sürüm adayı üzerinde tamamlanması, güncel gerçeğin kullanılabilir ürün kayıtlarına dönmesi, dış kopyanın paralel doğruluk kaynağı olmaktan çıkması ve düzeltme kanıtının bu kayıtlara bağlanmasıyla kapanır; manuel yeniden oluşturma veya desteklenen import kullanılabilir |
| Veri bütünlüğü | Kalıcı veri kaybı, yanlış çalışma alanına veri sızıntısı ve geri alınamayan kimlik veya ilişki bozulması: `0` |
| Kritik hata | Açık S1 hata: `0`; açık S2 hata: `0`. Daha düşük önemdekiler yalnız sınırları belgeli ve veri, güvenlik veya erişilebilirlik bütünlüğü riski taşımayan durumlarda kabul edilebilir |

- **`S1`, veri kaybı, yetkisiz erişim, ana akışın bütünüyle kullanılamaması veya yanlış herkese açık yayın anlamına gelir.** `S2`, geçici çözümü olmayan önemli ana akış bozulmasıdır.

- **Dogfooding için hafta, aktif gün, dakika, oturum, belge, klasör veya kayıt sayısı eşiği yoktur.** Yüksek etkili dış araca kaçış, ürün eksikliği veya güvenilmezliği nedeniyle ana doğruluk kaynağının başka araca taşınması ya da aynı iş için başka araçta kalıcı paralel kayıt tutulmasıdır. Her kaçışın başlangıcı, nedeni, etkisi, çözümü ve kapanış kanıtı kaydedilir.

- **Kod inceleme ve nihai yüksek detaylı görsel tasarım gibi bilinçli dış sınırlar başka araçlarda kalabilir.** Dogfooding sırasında aynı özel alanı projeler arasında ortak kimlikle kullanma ve görsel Akıllı Koleksiyon koşullarının ifade edemediği sorgular yazma ihtiyacı özellikle ürün boşluğu olarak izlenir. Bu sinyaller ilk ürüne çalışma alanı genelindeki özel alan şeması veya serbest yazılabilir gelişmiş sorgu dili eklemez; sonraki ürün kararlarına kanıt sağlar.

## Temel çalışma ilkeleri

### Personal-first, collaboration-ready

- **İlk kullanıcı deneyimi kişisel kullanıma göre optimize edilir.** İlk üründe ekip daveti, roller, izin yönetimi ve ortak düzenleme arayüzleri bulunmaz. Buna karşılık temel veri modeli gelecekte ekip kullanımına genişlemeyi engellemez; Çalışma Alanı sınırı, kullanıcı kimliği, kayıt yazarlığı ve sahipliği, genişletilebilir üyelik modeli ve denetlenebilir değişiklik geçmişi baştan desteklenir.

### Repository'den daha geniş proje anlayışı

- **Proje, repository'den bağımsız ve ondan önce başlayabilen bir çalışma alanıdır.** Projenin yaşam döngüsü durumu araştırma, tasarım veya geliştirme gibi çalışma aşamalarından ayrı izlenir. Bir Proje sıfır, bir veya birden fazla repository ile ilişkilendirilebilir; repository Proje çalışma alanının veya planlama kaydının yerini almaz.

### Esnek ve zorunlu olmayan akış

- **Sistem sabit bir çalışma sırası veya onay kapısı dayatmaz.** Kullanıcı araştırma, tasarım, planlama, geliştirme, doğrulama ve yayın çalışmalarını ihtiyacına göre sıralı veya paralel yürütebilir. Projeler ve İşler tamamlanmadan bilinçli biçimde kapatıldıklarında `Vazgeçildi` sonucuna alınabilir; isteğe bağlı gerekçe, içerik ve geçmiş korunur ve kayıt daha sonra yeniden açılabilir.

### Database-first ve taşınabilir içerik

- **Belgeler, Teknik Diyagramların türlenmiş yapısal modelleri, yapılandırılmış kayıtlar, ilişkiler ve diğer ana içerikler veritabanında yaşar ve yalnız uygulama içinde düzenlenir.** Bilgisayarda uygulamayla canlı eşzamanlanan proje klasörleri, fiziksel Markdown veya diagram-as-code doğruluk kaynakları tutulmaz. VS Code, Obsidian ve benzeri harici editörlerle canlı düzenleme desteklenmez.

- **Ürün seçili içeriği standart ve insan tarafından okunabilir biçimlerde taşımayı destekler; tam çalışma alanı yedeği veya geri yüklenebilir ürün paketi sunmaz.** Biçimler, işlem sınırları, önizleme, atomiklik ve içe/dışa aktarma güvenliği yalnız [Veri Güvenliği ve Taşınabilirlik](13-data-security-and-portability.md) belgesinde tanımlanır.

### Her içerik için tek ana kayıt

- **Her kalıcı domain öğesi [kapalı sahiplik kapsamlarından](02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) tam olarak birinde ana kayıt olarak yaşar veya tek ana kaydın ondan bağımsız yaşayamayan sahipli bileşenidir.** Favoriler, planlama görünümleri, Akıllı Koleksiyonlar, takvimler, özetler ve bildirimler bu kaydın farklı gösterimleridir; ayrı içerik kopyaları oluşturmaz. Bir görünümden yapılan değişiklik aynı ana kaydı günceller ve diğer görünümlere yansır.

- **Odak Dönemi kapsamı ve Manuel Proje Güncellemesi gibi açıkça tarihsel anlık görüntüler belirli bir andaki değerlendirmeyi korur; güncel ana kaydın yerine geçmez.** Build in Public ve tekil Wiki yayını kontrollü paylaşım istisnalarıdır: dış yüzey sürekli güncellenen kopya yerine kullanıcının gözden geçirip onayladığı güvenli sürümü gösterir.

- **Ana kayıtlardan hesaplanan her sayı, oran, dağılım ve durum göstergesi hesaplamaya katılan kayıtları ve filtreleri açar.** Kaynaklar değişirse özet yeniden hesaplanır; ayrıca güncellenmesi gereken ikinci rapor kaydı oluşmaz. Elle yazılan değerlendirmelerin yazarı, zamanı ve tarihsel niteliği açıkça gösterilir.

### Görüşlü başlangıç, sonradan yapılandırma

- **Ürün kullanıcıyı ilk açılışta bütün veri modelini kurmaya zorlamaz.** Az sayıda görüşlü başlangıç yapılandırması güçlü varsayılanlar sunar; kullanıcıya dönük yapı daha sonra değiştirilebilir ve hiçbir özellik zorunlu çalışma sırasına dönüşmez.

- **Yeni Projenin etkin alan, aşama, hazır görünüm ve sabitlenmiş navigasyonu seçilen kapalı [Başlangıç yapılandırması sözleşmesinden](04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları) gelir.** `Overview` ve `All Tools` her Projede erişilebilir kalır; yapılandırma yalnız önerilen başlangıçtır, aşama, süreç kapısı veya özellik kapsamı değildir. Etkin fakat sabitlenmemiş alanlar ilk günden `All Tools`, Evrensel Arama ve desteklenen Komut Paleti eylemlerinden erişilebilir. Navigasyondan kaldırmak alanı devre dışı bırakmaz, içeriğini silmez veya kayıt davranışını değiştirmez.

- **İç teknik kimlik, kayıt türü, iş akışı durumu, kapanış sonucu ve değiştirilemeyen temel ilişkiler gibi korunan ürün semantiği silinemez veya başka anlam için kullanılamaz.** Kullanıcı alan görünürlüğünü, durum adlarını, akış değerlerini ve özel alanları desteklenen sınırlar içinde yapılandırabilir.

### Açık kullanıcı kontrolü

- **Planlama görünümleri, dış sistem olayları, bildirimler ve otomasyonlar kaynak kayıtların yaşam döngüsünü örtük biçimde değiştirmez.** Durum, yayın ve kalıcı dönüşüm gibi anlamlı değişiklikler açık kullanıcı eylemi veya açıkça etkinleştirilmiş kural gerektirir.
