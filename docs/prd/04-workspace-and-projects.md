# Çalışma Alanı ve Projeler

Bu belge Proje çalışma alanının, proje profilinin, kullanıcı yapılandırmalarının, gezinmenin, bildirimlerin ve kişisel çalışma bağlamının tek normatif sahibidir. Ortak kimlik ve yaşam döngüsü invariantları [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md), saklama ve güvenli silme [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md) yaşar.

## Proje çalışma alanı

### Proje profili

- **Yeni Proje oluştururken yalnız `Project Name` ve kapalı katalogdan bir Başlangıç yapılandırması zorunludur.** Proje `Aktif` (`UI: Active`) yaşam durumunda açılır. Amaç, çözülmek istenen problem, kapsam sınırları ve hedef tarihi isteğe bağlı profil alanlarıdır; boş olmaları Projenin oluşturulmasını veya kullanılmasını engellemez.

- **Her proje, `PAY-1` gibi iş anahtarlarında kullanılmak üzere çalışma alanı içinde benzersiz bir kısa kod taşır.** Sistem Proje adından kısa kod önerir; kullanıcı ilk İş oluşturulana kadar değiştirebilir. İlk İşten sonra kod değişmez. Bir Projeye atanmış kısa kod, kullanıcı ilk İşten önce kodu değiştirse veya Proje kalıcı silinse bile aynı Çalışma Alanında başka Projeye verilmez.

- **Kullanıcı isteğe bağlı bir proje logosu yükleyebilir.** Projeye özel renk, tema, font, CSS veya white-label desteği sunulmaz. Logo yoksa standart ve erişilebilir herkese açık başlık kullanılır.

- **Projenin yaşam döngüsü durumu `Aktif`, `Bekleyen`, `Tamamlandı` veya `Vazgeçildi` olabilir ve çalışma aşamasından ayrı tutulur.** Vazgeçilen proje otomatik olarak arşivlenmez.

### Proje hedefleri

- **Proje hedefi; başlık, açıklama ve isteğe bağlı başarı göstergesi taşıyan hafif, kalıcı ve ilişkilendirilebilir bir kayıttır.** Hedefler Araştırma ve Özellik türündeki işlere ve Kilometre Taşlarına bağlanabilir; ilişki bu kayıtların durumunu veya ilerlemesini değiştirmez.

- **Her hedef isteğe bağlı bir `Hedeflenen sonuç` ile kullanıcı tarafından sonradan girilen `Gözlenen sonuç / öğrenim` alanlarını taşıyabilir.** Sistem ölçümü sürekli izlemez, gerçekleşen değeri kendiliğinden doldurmaz, hedefleri üst ve alt düzeylerde birbirine bağlayıp sonuçlarını otomatik olarak birleştirmez ve bağlı işlerden otomatik ilerleme yüzdesi üretmez. İlk ürün Boolean, sayı veya yüzde türünde Key Result, yapılandırılmış hedef/gerçekleşen değer çifti ya da ayrı ölçüm bakım yaşam döngüsü eklemez; sonuç değerlendirmesi bu esnek alanlarda kullanıcıya aittir.

- **Hedef detayı bağlı Araştırma, Özellik ve Kilometre Taşı kayıtlarının güncel durum dağılımını; ilişkili açık Risk ve Açık Soruları ana kaynaklarına bağlı nötr bir canlı özet olarak gösterebilir.** Özet otomatik ilerleme yüzdesi, hedef sağlık puanı, başarı hükmü veya tamamlanma durumu üretmez; hedeflenen ve gözlenen sonucu kullanıcı değerlendirir.

### Proje arşivi

- **Kullanıcı tamamlanmış, vazgeçilmiş veya artık aktif kullanmadığı Projeyi Arşiv görünümünden yönetilecek biçimde arşivleyebilir.** Proje arşivinin yaşam durumundan ve Çöp Kutusundan ayrılması, salt-okunur sınırı, duran işlemleri, izin verilen güvenlik istisnaları ve silme grubunun değişmez kuralları [ortak yaşam döngüsünde](02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) tek kez tanımlanır.

- **Arşivleme önizlemesi normal çalışma yüzeylerinden kaldırılacak Projeyi; devam eden import, yükleme, otomasyon ve eşitlemelerin kesin durumunu; yaşamaya devam edebilecek önceden onaylanmış Dış yüzeyleri ve erişimi azaltmak için açık kalacak güvenlik eylemlerini gösterir.** İşlem ortak revizyon bariyerini kullanır; Arşiv görünümü sonrasında Projeyi, yaşayan Dış yüzeyleri ve güvenlik eylemlerini kaynak durumlarıyla listeler.

- **Proje silme eylemi yalnız Arşiv görünümünde sunulur.** Onay yüzeyi silinecek Proje grubunu, derhal ve terminal olarak iptal edilecek Proje kapsamlı Dış yüzeyler ile ziyaretçi oturumlarını, duracak entegrasyonları, başka kapsamlarda yaşamaya devam edecek ilişkileri ve geri yüklemenin hiçbir yüzeyi otomatik yeniden yayımlamayacağını gösterir; saklama ve kalıcı silme davranışı [Veri Güvenliği ve Taşınabilirlik](13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme) belgesine aittir.

- **Arşivden çıkarma GitHub bağlantısını örtük biçimde etkinleştirmez.** Arşiv görünümü kullanıcıyı [GitHub bağlantısının kanonik yeniden bağlama sözleşmesine](12-github-and-project-releases.md#repository-bağlantıları) yönlendirir; bu yüzey GitHub olay replay'i, yetki uzlaştırması veya bağlantı yaşam döngüsü için ikinci davranış tanımlamaz.

### Kaydedilmiş çapraz proje listeleri

- **Kullanıcı projeleri yaşam döngüsü durumu, aşama, tarih, arşiv, desteklenen proje alanları ve mevcut diğer görünür koşullarla filtreleyen adlandırılmış çapraz proje listeleri kaydedebilir.** Liste üyeliği koşullardan canlı türetilir; manuel proje üyeliği, ayrı Program/Portfolio kaydı, proje skoru veya rapor doğruluk kaynağı oluşturmaz.

- **Liste görünümü desteklenen kolonları, sıralamayı ve gruplamayı saklayabilir.** Son Manuel Proje Güncellemesinin sağlık işareti kullanılırsa kendi tarihiyle birlikte `Son bildirilen sağlık` olarak gösterilir; ayrı güncel Project health alanına, otomatik sağlık hükmüne veya tarihsiz durum rozetine dönüştürülmez.

### Görüşlü başlangıç yapılandırmaları

- **İlk ürün Başlangıç yapılandırması kataloğu tam olarak `Blank Project`, `Solo SaaS`, `Open Source Library` ve `Mobile Application` seçeneklerinden oluşur.** Seçim yalnız Proje oluşturulurken bir kez uygulanır; sonradan başka Başlangıç yapılandırmasıyla değiştirilmez veya mevcut yapı üzerine yeniden uygulanmaz. Kullanıcı kurulan yapılandırmaları tek tek değiştirebilir ya da [Proje yapısını kopyalama](#proje-yapısını-kopyalama) davranışını kullanabilir.

- **Bütün Başlangıç yapılandırmaları `Not Started`, `In Progress`, `Blocked` ve `Closed` İş durumlarını kurar; `Overview`, `Work`, `Documents` ve `All Tools` erişimini korur.** İş türüne göre hazır İş Bağlam Kartı düzenleri yapılandırma arasında değişmez ve [İş Yönetimindeki tek sözleşmeyi](06-work-management-and-planning.md#iş-bağlam-kartı) kullanır. Yapılandırmalar örnek İş, sahte Belge, Karar, Risk veya çalışma geçmişi üretmez.

| Başlangıç yapılandırması | Hazır Proje aşamaları | Etkin Proje alanları | Temel erişime ek sabitlenmiş alanlar | Hazır İş görünümleri |
| --- | --- | --- | --- | --- |
| `Blank Project` | Yok | `Work`, `Documents` | Yok | `Backlog`, `Board` |
| `Solo SaaS` | `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate` | Bütün Proje alanları | `Discovery`, `Decisions`, `Design`, `Tests`, `Releases` | `Backlog`, `Board`, `Roadmap` |
| `Open Source Library` | `Scope`, `Build`, `Validate`, `Release`, `Maintain` | `Work`, `Documents`, `Decisions`, `Technical Diagrams`, `Tests`, `Releases`, `GitHub` | `GitHub`, `Tests`, `Releases` | `Backlog`, `Board`, `Roadmap` |
| `Mobile Application` | `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate` | Bütün Proje alanları | `Discovery`, `Design`, `Tests`, `Releases`, `Production` | `Backlog`, `Board`, `Roadmap` |

- **`Blank Project` yapılandırmasındaki `Blank`, ürün yeteneklerinin veya veri modelinin bulunmadığı anlamına gelmez.** Aşama, uzman görünüm ya da Başlangıç iskeleti kurmaz; diğer hazır alanlar `All Tools` içinde görünür ve kullanıcı tarafından etkinleştirilebilir.

- **İlk ürün Başlangıç iskeleti kataloğu aşağıdaki beş içeriksiz yapıdan oluşur.** `Sitemap` ve `Customer Journey` oluşturulduktan sonra normal Proje Duvarı; diğerleri normal Belge olarak yaşar. İskeletler yalnız aşağıdaki boş grup veya bölüm başlıklarını kurar; örnek araştırma bulgusu, kişi profili, görev, karar veya başka ana kayıt üretmez.

| Başlangıç iskeleti | Yüzey | Oluşturulan boş yapı |
| --- | --- | --- |
| `Sitemap` | `Project Wall` | `Primary Navigation`, `Secondary Navigation`, `Utility`, `External` |
| `Customer Journey` | `Project Wall` | `Awareness`, `Consideration`, `Onboarding`, `Core Use`, `Retention` |
| `Persona` | `Document` | `Context`, `Goals`, `Behaviors`, `Pain Points`, `Constraints`, `Evidence`, `Open Questions` |
| `Retrospective` | `Document` | `Period`, `What worked?`, `What did not?`, `What did we learn?`, `Decisions`, `Next changes`, `Related records` |
| `Launch Plan` | `Document` | `Release`, `Audience`, `Scope`, `Readiness`, `Communication`, `Launch steps`, `Risks`, `Observation plan`, `Related records` |

- **Başlangıç iskeleti özel kayıt türü veya kalıcı iskelet bağı oluşturmaz.** Teknik Diyagram şablonları ilk üründe bulunmaz ve yalnız [gerçek tekrar kanıtından sonraki ayrı yönde](18-future-directions.md#teknik-diyagram-sablonlari) değerlendirilebilir; şablon pazarı ya da içerikli Milanote Board şablonu modeli oluşturulmaz.

- **İlk açılışta isteğe bağlı, kapatılabilir bağlamsal yönlendirme seçilen başlangıç yapılandırmasının hangi varsayımları neden getirdiğini ve bunların nereden değiştirilebileceğini açıklar.** Yönlendirme örnek içerik üretmez, kullanıcıyı zorunlu kurulum turuna sokmaz ve kapatıldıktan sonra günlük çalışma yüzeylerini işgal etmez.

- **Seçilen Başlangıç yapılandırması yukarıdaki kesin ilk sabitlenmiş Proje navigasyonunu belirler.** `All Tools`, etkin veya henüz proje navigasyonuna sabitlenmemiş bütün hazır alanları tek keşif yüzeyinde gösterir; her alanın `Pin to navigation` eylemi ve mevcut görünürlük durumu açıktır. Bir alanı yalnız açmak veya içinde kayıt oluşturmak onu sessizce sabitlemez. Sabitleme, kaldırma ve sıralama Proje bazlı sunum üstverisidir; alanın etkinliğini, içerik yaşam döngüsünü veya başka Projelerin navigasyonunu değiştirmez.

- **Ürün kullanım sıklığından otomatik navigasyon düzeni çıkarmaz, az kullanılan alanı kendiliğinden gizlemez ve kullanıcıyı omurgayı sırayla tamamlamaya zorlamaz.** Kullanıcı isterse `Varsayılan navigasyonu geri yükle` önizlemesiyle yalnız sabitleme ve sıra üstverisini seçilen başlangıç yapılandırmasının varsayılanına döndürebilir; bu işlem hiçbir kayıt, alan yapılandırması veya çalışma geçmişini değiştirmez.

### Yapılandırma modu

- **Aşamalar, iş durumları, etkin alanlar, proje bazlı özel alanlar, öncelik ölçütleri, kayıtlı görünümler, İş Bağlam Kartı düzenleri ve aşağıda tanımlanan yapılandırma varlıkları açık bir `Yapılandırma modu` içinde yönetilir.** Mod bir izin veya ayrı yönetici rolü değildir; yalnız yapı değişikliklerini günlük içerik düzenlemesinden ayıran görünür bir sunum durumudur. Etkin olduğu açıkça gösterilir ve tek eylemle kapatılabilir.

- **Günlük kayıt oluşturma, içerik düzenleme, durum değiştirme ve planlama eylemleri mod dışında erişilebilir kalır.** Yapılandırma moduna girmek ana kaydı, görünüm üyeliğini veya proje yaşam döngüsünü değiştirmez.

### Yapılandırılabilir ve paralel proje aşamaları

- **Kullanıcı araştırma, tasarım veya geliştirme gibi proje aşamalarını ekleyebilir, yeniden adlandırabilir, sıralayabilir, kaldırabilir ya da hiç kullanmayabilir.**

- **Aşamalar sıralı bir state machine değildir.** Her aşama [ortak proje aşaması sözleşmesindeki](02-domain-model-and-lifecycle.md#proje-aşaması-sözleşmesi) `Planlanmadı`, `Hazır`, `Aktif`, `Tamamlandı` veya `Vazgeçildi` durumlarından birini taşır ve birden fazla aşama aynı anda `Aktif` olabilir. Aşama sırası yalnız sunum sırasıdır; çalışma kapısı veya zorunlu geçiş üretmez, içerik kullanımını kısıtlamaz ve içerikleri silmez.

### Proje alanlarını etkinleştirme

- **İlk ürünün yapılandırılabilir Proje alanı kataloğu `Work`, `Documents`, `Discovery`, `Decisions`, `Design`, `Technical Diagrams`, `Tests`, `Releases`, `Production` ve `GitHub` ile kapalıdır.** `Overview` ve `All Tools` Proje alanı değildir ve daima erişilebilir kalır. `Discovery`; Geri Bildirim, Kaynak, Kullanıcı Araştırması Oturumu ve Deney/Doğrulama kayıtlarını, `Decisions`; Karar, Risk, Varsayım ve Açık Soruyu, `Design`; Proje Duvarı, Ekran/Wireframe, Kullanıcı Akışı ve Moodboard'u toplar. Proje Hedefi ile Kilometre Taşı `Overview` ve ilgili planlama görünümlerinden erişilir; ayrı alan oluşturmaz.

- **Kullanıcı hazır Proje alanlarını etkinleştirebilir veya gizleyebilir.** Kullanılmayan alanlar içerik kaybı olmadan yeniden etkinleştirilebilir; alan kaydı sahiplenmez ve içindeki kayıt türlerinin yaşam döngüsünü değiştirmez. Her kayıt türünün kendi filtrelenebilir hazır dizini ilgili gruplanmış alan içinde bulunabilir; her tür için ayrı ana navigasyon kapısı oluşturulmaz.

- **Etkin alanlar Proje Genel Bakışında bu projede kullanılan çalışma yüzeyleri olarak adları ve görünür girişleriyle sunulur.** Bir alanı etkinleştirmek yeni içerik üretmez; gizlemek veya yeniden göstermek alanın ana kayıtlarını taşımaz, kopyalamaz ya da silmez.

### Çalışma alanı genel bakışı

- **Genel bakış ekranı aktif, bekleyen, tamamlanmış ve vazgeçilmiş projeleri; yaklaşan hedef tarihlerini, hatırlatmaları, açık riskleri, blokajları ve son çalışmaları çalışma alanı düzeyinde özetler.**

- **Yüzey `Active Projects`, `Attention Required`, `Upcoming` ve `Recent Work` hazır modülleriyle açılır.** Kullanıcı bu dört modülü gösterebilir, gizleyebilir ve sıralayabilir; ayrıca sınırlı sayıda mevcut Belgeyi veya adlandırılmış Akıllı Koleksiyon görünümünü kişisel canlı blok olarak ekleyebilir.

- **Bu bloklar kaynak belgeyi veya görünümü kopyalamayan referanslardır; ayrı sorgu, üyelik kuralı, kayıt kümesi, widget mantığı veya analitik doğruluk kaynağı oluşturmaz.** Kaynaktaki değişiklik aynı blokta görünür ve blok kaynağı ortak `Kaynak kaydı aç` eylemiyle açar. Kullanıcı tanımlı genel widget ve serbest dashboard oluşturucu sunulmaz.

### Favoriler

- **Kullanıcı sık eriştiği projeleri, belgeleri, işleri, kararları ve Akıllı Koleksiyonları Favoriler alanına ekleyebilir.** Favori olmak kaydın projesini, türünü veya durumunu değiştirmez.

### Bağlamı koruyan kişisel erişim kabuğu

- **Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve zamanı gelen `Yeniden bak` öğeleri uygulamanın her yerinden erişilen ortak bir kişisel kabukta açılabilir.** Kabuk belirli bir görsel çubuk yerleşimini zorunlu kılmaz; temel davranışı kullanıcının açık proje, kayıt ve kaynak görünümündeki mevcut konumunu kaybetmeden kişisel dikkat yüzeylerine geçebilmesidir.

- **Bu yüzeyler varsayılan olarak geçici panelde açılır ve gerektiğinde açık `Tam sayfa aç` eylemi sunar.** Kabuk yeni kayıt, bookmark kuyruğu veya planlama doğruluk kaynağı oluşturmaz. Açık panel, panel içi gezinme, scroll ve kaynak görünüm konumu oturumlar arasında recent-context olarak geri yüklenmez. Aşağıdaki büyük canvas çalışma-konumu davranışı bu genel kabuk kuralının dar ve açık istisnasıdır.

### Oturumluk Aktif Çalışma Seti

- **Kullanıcı üzerinde çalıştığı İş ve Belgeleri mevcut kaynak görünümündeki bağlamını kaybetmeden kişisel `Aktif Çalışma Seti`ne küçültebilir ve tek eylemle yeniden açabilir.** Üyelik yalnız açık uygulama oturumu boyunca yaşar; oturum sona erdiğinde geri yüklenmez.

- **Aktif Çalışma Seti Favori, Günlük Odak, öncelik, durum, planlama üyeliği, bookmark kuyruğu, ana kayıt veya başka bir doğruluk kaynağı oluşturmaz.** Bir öğeyi sete eklemek ya da setten çıkarmak kaynak kaydı ve planlama yüzeylerini değiştirmez; set kendi sıralama, tarih, bildirim veya kalıcı geçmiş semantiğini taşımaz.

- **Kaydedilmiş içerik ve tamamlanmamış oluşturma taslakları kendi normal autosave/taslak sözleşmelerini izler.** Aktif Çalışma Seti kaydedilmemiş düzenlemeler için ayrı bir dayanıklılık mekanizması değildir ve kapanan oturumun düzenleme bağlamını recent-context olarak geri getirmez.

### Büyük canvas'larda kişisel çalışma konumu

- **Her Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard ve Teknik Diyagram; kullanıcının son kişisel viewport merkezini, zoom seviyesini ve yalnız görünüm-yerel daraltılmış grup veya bölüm durumunu oturumlar arasında korur.** Bu değerler ana içerik, arama alanı, paylaşım snapshot'ı, export girdisi veya başka kullanıcının görünümü değildir.

- **Kullanıcı görünür `Görünümü sığdır` eylemiyle tek adımda nötr görünüme dönebilir.** Silinen veya önemli ölçüde değişen içerik eski viewport'u anlamsız kılarsa yüzey güvenli biçimde görünür içeriğe sığar; boş veya kayıp bir bölgeye açılmaz.

- **Seçili öğe, açık yan panel, düzenleme modu, geçici çoklu seçim, hover/odak durumu ve kaydedilmemiş işlem geri yüklenmez.** Bu dar çalışma üstverisi `Çalışmaya Dön` özetine son kayıt, sekme, filtre, sıralama, scroll veya paneli geri yükleme yetkisi vermez.

### Birleşik Bildirim Merkezi

- **Birleşik Bildirim Merkezi; hedef tarihi, yeniden görünme tarihi, kişisel hatırlatma, [açık Risk](09-discovery-decisions-and-design.md#risk-takibi), [blokaj](06-work-management-and-planning.md#iş-bağımlılıkları-ve-blokajlar), daha yeni sürümü bulunan kullanımda olan Kaynak, sonucu dönmüş fakat uzlaştırılmamış Dış yürütme devri, açıkça yeniden değerlendirmeye alınmış Proje Sürümündeki eksik gözlem, GitHub aktivitesi, başarısız bağlı PR check’i, doğrudan iş–PR durum çelişkileri, bağlama alınmamış açık PR’lar, yayımlanmış sürümde kalan açık kapsam, Akıllı Koleksiyon aboneliği ve otomasyondan doğan dikkat sinyallerini toplar.**

- **Kullanıcı proje bazında aktif herkese açık roadmap kayıtları için isteğe bağlı bir gözden geçirme süresi belirleyebilir.** Sürenin birimi gündür ve `7` ile `180` gün arasında bir tam sayıdır; varsayılanı yoktur, yani kullanıcı bir değer girmedikçe bu sinyal hiç üretilmez. Kaydın son onaylı herkese açık snapshot’ı bu süre boyunca yenilenmemişse Bildirim Merkezi `Eylem Gerekiyor` bölümünde kaydı gözden geçirmeyi önerir; aynı kayıt için yeni onaylı snapshot oluşmadıkça süre başına en fazla bir sinyal üretilir. Sinyal yalnız aktif herkese açık etiketli kayıtlar için üretilir; tamamlanmış veya kapatılmış herkese açık kayıtları kapsamaz ve iç durumu, herkese açık etiketi ya da yayın snapshot’ını otomatik değiştirmez.

- **Merkez aynı kaynakları `Eylem Gerekiyor` ve `Bilgi Akışı` bölümlerinde dikkat anlamına göre ayırır; varsayılan olarak `Eylem Gerekiyor` açılır.** Hedef tarihi, hatırlatma, açık risk, blokaj, başarısız check ve doğrudan durum çelişkisi gibi kullanıcı kararı bekleyen sinyaller eylem bölümünde; sıradan GitHub aktivitesi ve bilgilendirici koleksiyon hareketleri bilgi akışında gösterilir. Her sinyal yalnız bir bölümde bulunur.

- **Aynı ana kaynağa ait sinyaller kendi `Eylem Gerekiyor` veya `Bilgi Akışı` bölümü içinde tek kaynak grubu altında gösterilir; her sinyalin nedeni, kaynak olayı, zamanı ve okunma/kapatılma durumu ayrı korunur.** Kaynak gruplaması farklı dikkat anlamlarını iki bölüm arasında birleştirmez ve olayları tek bildirimmiş gibi yeniden yazmaz.

- **Bildirim bir kaynak olayın dikkat temsilidir; yeni bir iş değildir.** Bildirimi okundu olarak işaretlemek veya kapatmak kaynak kaydın durumunu değiştirmez. Bildirimden kaynağa geçiş, `Bağlam içi kayıt önizleme` altında tanımlanan ortak kaynak gezinme kuralını izler ve kaynak kaydın yalnız genel başlangıcını değil, güvenle çözümlenebiliyorsa sinyali üreten kesin yorum, değişiklik, hatırlatma veya diğer kaynak olayı görünür bağlamda açar. Olay artık çözülemiyorsa kayıt açılır ve kayıp kesin hedef açıklanır; sessizce başka olaya kaydırılmaz.

- **Bildirim Merkezi yalnız alan PRD'lerinin kapalı ve deterministik olarak tanımladığı dikkat sinyallerini üretir.** Alan belgesi tetikleyici, dedupe anahtarı, kapanma koşulu ve negatifleri tanımlar; bu bölüm yalnız kayıtlı sinyal kimliklerinin kapalı dizinini ve `Eylem Gerekiyor`/`Bilgi Akışı` sunumunu yönetir. Kayıtsız sinyal üretilemez. Her sinyal kesin kaynak olayı, gösterilme nedeni ve kullanıcıya açık çözüm yollarını taşır; ürün kapsamadığı riskler olabileceğini saklamaz, `dikkat gerektiren her şeyi gösterir` iddiası, otomatik değişiklik etkisi, proje sağlık hükmü veya AI önem sıralaması üretmez. Aynı kesin Kaynak sürümü değişikliğinin birden fazla kullanım yeri tek Kaynak grubunda gösterilir; her kullanım bağlamının ayrı inceleme kararı korunur.

<a id="dikkat-sinyali-kayitlari"></a>

| Sinyal kimliği | Sunum | Sahip |
| --- | --- | --- |
| `due-date` | `Eylem Gerekiyor` | [Kişisel hatırlatmalar](06-work-management-and-planning.md#kişisel-hatırlatmalar) |
| `reappear-date` | `Eylem Gerekiyor` | [Yeniden görünme tarihi](06-work-management-and-planning.md#yeniden-görünme-tarihi) |
| `personal-reminder` | `Eylem Gerekiyor` | [Kişisel hatırlatmalar](06-work-management-and-planning.md#kişisel-hatırlatmalar) |
| `review-later` | `Eylem Gerekiyor` | [`Yeniden bak`](06-work-management-and-planning.md#kişisel-hatırlatmalar) |
| `open-risk` | `Eylem Gerekiyor` | [Açık Risk](09-discovery-decisions-and-design.md#risk-takibi) |
| `work-blocked` | `Eylem Gerekiyor` | [Blokaj](06-work-management-and-planning.md#iş-bağımlılıkları-ve-blokajlar) |
| `source-version-in-use` | `Eylem Gerekiyor` | [Kaynak sürüm kullanımı](08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması) |
| `external-run-returned` | `Eylem Gerekiyor` | [Dış yürütme devri](06-work-management-and-planning.md#dış-yürütme-devirleri) |
| `release-observation-missing` | `Eylem Gerekiyor` | [Proje Sürümü iletişimi](12-github-and-project-releases.md#proje-sürümü-iletişimi) |
| `github-check-failed` | `Eylem Gerekiyor` | [GitHub geliştirme kayıtları](12-github-and-project-releases.md#github-geliştirme-kayıtları) |
| `work-pr-status-conflict` | `Eylem Gerekiyor` | [GitHub geliştirme kayıtları](12-github-and-project-releases.md#github-geliştirme-kayıtları) |
| `unlinked-open-pr` | `Eylem Gerekiyor` | [GitHub geliştirme kayıtları](12-github-and-project-releases.md#github-geliştirme-kayıtları) |
| `published-release-open-scope` | `Eylem Gerekiyor` | [Sürüm Kanıt Paketi](12-github-and-project-releases.md#sürüm-kanıt-paketi-ve-yayın-hazırlığı) |
| `automation-failed` | `Eylem Gerekiyor` | [Otomasyon](06-work-management-and-planning.md#hafif-uygulama-içi-otomasyon-kuralları) |
| `public-roadmap-review-due` | `Eylem Gerekiyor` | [Bu bölümdeki gözden geçirme süresi](#birleşik-bildirim-merkezi) |
| `unreviewed-test-report` | `Eylem Gerekiyor` | [Test raporu kabulü](10-testing-and-validation.md#güvenli-atomik-ve-idempotent-kabul) |
| `test-result-conflict` | `Eylem Gerekiyor` | [Yerine geçen doğrulama ve çelişki](10-testing-and-validation.md#yerine-geçen-doğrulama-ve-çelişki) |
| `handoff-result-after-cancel` | `Bilgi Akışı` | [Test Handoff'u](10-testing-and-validation.md#test-handoffu) |
| `smart-collection-entry` | `Bilgi Akışı` | [Akıllı Koleksiyon aboneliği](08-search-relations-and-evidence.md#akıllı-koleksiyonlar) |
| `github-activity` | `Bilgi Akışı` | [GitHub geliştirme kayıtları](12-github-and-project-releases.md#github-geliştirme-kayıtları) |

- **Kullanıcı açık `Takip işi oluştur` eylemiyle bildirimden bağımsız bir iş öğesi oluşturabilir.** Oluşacak iş ve kaynak ilişkileri uygulanmadan önce gösterilir; yeni iş bildirime ve bildirimin kaynak kayıtlarına köken ilişkisiyle bağlanır. Eylem bildirimi kapatmaz, kaynak kayıtların durumunu değiştirmez ve aynı bildirimden örtük olarak birden fazla iş üretmez.

- **Bildirim takip işine dönüştürülmeden ayrı bir `Kaydedilenler` veya bookmark kuyruğunda tutulmaz.** Kalıcı bilgi ana kaynakta ya da gerçekleşen olayların zaman çizelgesinde, daha sonra yapılacak eylem ise kaynak bağlantılı takip işinde kalır.

### Proje genel bakışı

- **Proje genel bakışı; projenin amacını, yaşam döngüsü durumunu, aynı anda aktif olabilen aşamalarını, kilometre taşlarını, güncel işlerini, belgelerini, kararlarını, risklerini, aktif Test Handoff'larını, son Test Oturumlarını ve açık Test Açıklarını, önemli üretim olaylarını, blokajlarını, yaklaşan veya geçen hedef tarihlerini ve son değişikliklerini özetler.**

- **Proje yüzeylerinde İş ve Özellik ilerlemesinin yanında açık Risk ve Açık Soru kayıtlarının nasıl gösterildiği [İş Yönetimi ve Planlama](06-work-management-and-planning.md#iş-bağlam-kartı) belgesinde tanımlanır.** Bu belge o görünürlüğü yeniden tanımlamaz ve ondan ayrı bir nitel belirsizlik durumu, otomatik ilerleme hükmü veya proje sağlık göstergesi üretmez.

### Değer Zinciri

- **Her Proje, seçilen Proje Hedefinden problem/fırsat ve kanıt üzerinden Karar, kapsam, İş, desteklenen GitHub geliştirme gerçeği, test/doğrulama, Proje Sürümü ile tarihli Erişim ve Sonuç gözlemlerine uzanan türetilmiş bir `Değer Zinciri` görünümü sunar.** Görünüm yalnız mevcut kesin kayıtları ve kullanıcı tarafından kurulmuş ilişkileri kullanır; yeni ana kayıt, ilişki, özet metni, otomatik çıkarım veya ikinci doğruluk kaynağı oluşturmaz.

- **Kullanıcı bir Proje Hedefini zincir çapası olarak seçer ve aynı hedefe hizmet eden birden fazla dalı veya Proje Sürümünü birlikte inceleyebilir.** Hedefe bağlanmamış ilgili İşler, Kararlar, kanıtlar, testler ve Sürümler gizlenmez; `Hedefe bağlanmamış` bölümünde özgün kayıtlarına açılan parçalar olarak gösterilir. Sistem hangi hedefe ait olduklarını tahmin etmez.

- **Değer Zinciri eksik veya çözülemeyen adımı boşluğu saklamadan ve özel içerik sızdırmadan gösterir.** Kullanıcı boşluktan mevcut kayıt seçme ya da desteklenen normal oluşturma akışını başlatabilir; öneri kendiliğinden ilişki veya kayıt üretmez, zinciri tamamlamak başka kaydın durumunu değiştirmez ve yayın/onay kapısı oluşturmaz.

- **Zincirdeki her düğüm neden gösterildiğini ve onu bağlayan kesin ilişkiyi açar.** Kopukluk kendi başına Bildirim Merkezi sinyali, eksik bağlam hükmü veya sağlık puanı üretmez; yalnız kullanıcının açıkça `Etkisini yeniden değerlendir` eylemine aldığı Proje Sürümünde henüz kaydedilmemiş Erişim veya Sonuç gözlemi kaynak bağlantılı `Eylem Gerekiyor` sinyali olabilir.

### Proje Duvarı

- **Her proje birden fazla düz, adlandırılmış Proje Duvarı görünümü taşıyabilir.** Duvarlar iç içe geçmez ve yalnız proje kapsamındadır; çalışma alanı veya Kişisel Wiki düzeyinde ayrı görsel duvar bulunmaz. Aynı ana kayıt farklı duvarlarda içerik kopyası oluşturmadan referans olarak yer alabilir.

- **Kalıcı içerik öğeleri mevcut ana kayıtların canlı kartlarıdır; duvara özgü bağımsız not, görev veya dosya oluşturulmaz.** Kartın yerleşimini ya da görünümünü değiştirmek kaynak kaydı etkilemez; içerik ve alan düzenlemeleri `Kaynak kaydı aç` eylemiyle ana kayıtta yapılır.

- **Teknik Diyagram kartı aynı ana kayıt ve seçili Diyagram Görünümünü salt okunur canlı önizleme olarak gösterir.** Duvar kartında düğüm, bağlantı, şema alanı veya görünüm düzenlenmez; kesin tarihsel anlatı gerektiğinde kart açıkça seçilmiş Diyagram Sürümüne sabitlenir ve canlı/kesin durumu görünür etiketlenir.

- **Adlandırılmış bir Akıllı Koleksiyon salt okunur canlı özet bloğu olarak eklenebilir.** Blok kaynak görünümün sınırlı sayıda sonucunu gösterir ve `Tümünü kaynakta aç` eylemi sunar; kendi sorgusunu, üyeliğini, sırasını veya doğruluk kaynağını oluşturmaz. Aynı kayıt tekil kartta ve özet içinde görünüyorsa ortak kaynağa dayandığı belirtilir.

- **Kartlar kayıt türüne göre ürünün belirlediği alanları gösteren `Kompakt`, `Önizleme` ve `Ayrıntılı` yoğunluklarını kullanır.** Görünüm-yerel, sınırlı ve erişilebilir vurgu paleti desteklenir; serbest font, özel CSS, keyfî renk seçici veya kart başına alan oluşturucu sunulmaz.

- **Kartlar, iç içe geçmeyen ve kalıcı sınıflandırma oluşturmayan tek seviyeli gruplarda düzenlenebilir.** Kartlar arasındaki yönlü ve etiketli `Görsel bağlantı` çizgileri kayıt ilişkisi sayılmaz; kullanıcı gerekirse çizgiden önizlemeli `Kalıcı ilişki oluştur` eylemini başlatır. Adlandırılmış gruplar aynı duvar içinde doğrudan açılabilir; silinmiş veya erişilemeyen hedef başka gruba yönlendirilmeden açıklanır ve tam duvara güvenli dönüş sunulur.

- **Duvar çoklu seçim, pan/zoom, ekrana sığdırma, klavyeyle taşıma, hizalama/dağıtma, katman sırası ve grup daraltmayı destekler.** Seçili kart veya gruplarda önizlenebilir ve geri alınabilir otomatik yerleşim kullanılabilir. Görünüm-yerel `Konumu kilitle`, manuel ve otomatik yerleşimde öğeyi sabit tutar; kaynak kaydın düzenlenmesini veya yaşam döngüsünü kısıtlamaz.

- **Mekânsal yakınlık, grup üyeliği ve görsel çizgi kendi başına kayıtlı ilişki sayılmaz.** Duvar serbest çizim veya Sketch card sunmaz; kaba çizim ve etkileşim modelleme Wireframe yüzeyinde kalır ve sonucu ana kaynak olarak duvara eklenebilir.

- **`Sunum Kipi` düzenleme araçlarını gizler.** İsteğe bağlı odak sırası yalnız görünüm üstverisidir; ayrı sunum dosyası veya içerik kopyası oluşturmaz. Bağlantıyla sınırlı paylaşım, Build in Public snapshot'ı ve statik dışa aktarma [Paylaşım ve Yayınlama bölümündeki ortak güvenlik sözleşmesini](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) izler.

- **Proje Duvarı seçili grup veya bölge snapshot'ını destekler.** PNG/PDF sayfalama, kapsam önizlemesi ve canlı kaynak sınırı [ortak görsel bölge snapshot sözleşmesini](13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) izler.

### Manuel Proje Güncellemeleri

- **Kullanıcı istediği zaman `Yolunda`, `Riskli` veya `Yolunda değil` sağlık işaretiyle kısa bir Proje Güncellemesi oluşturabilir.** Güncelleme ilgili risk, karar, kilometre taşı veya diğer ana kayıtlara bağlanabilir ve kronolojik geçmişte saklanır.

- **Güncelleme yüzeyinde gösterilen canlı proje özeti blokları kullanıcı güncellemeyi kaydettiğinde zaman damgalı, salt okunur tarihsel snapshot olarak korunur.** Bağlı ana kayıtlar canlı kalır ve güncel hâlleri ayrıca açılabilir; snapshot yalnız kullanıcının o tarihte gördüğü bağlamı ve sağlık değerlendirmesini açıklar, yeni güncel doğruluk kaynağı olmaz.

- **Kullanıcı proje bazında, düzenlenebilir bir refleksiyon sorusu ve tercih ettiği tekrar aralığıyla isteğe bağlı yinelenen `Proje Güncellemesi oluştur` hatırlatması açabilir, duraklatabilir veya kapatabilir.** Zamanı geldiğinde hatırlatma Birleşik Bildirim Merkezi’nden mevcut Manuel Proje Güncellemesi formunu açar. Kullanıcı hatırlatmayı atlayabilir; bir güncelleme ancak kullanıcı formu açıkça kaydettiğinde oluşur.

- **Güncellemeler zorunlu cadence, yalnız zaman geçmesine dayalı staleness bildirimi, otomatik güncelleme, otomatik sağlık tahmini veya AI taslağı oluşturmaz.** Sağlık işareti kullanıcının öznel değerlendirmesidir.

### Çalışmaya Dön özeti

- **Kullanıcı bir projeye veya iş öğesine ara verdikten sonra mevcut kayıt ve veritabanı içeriğine dayanan kısa bir Çalışmaya Dön özetiyle bağlamını yeniden kurabilir.** Özet; son düzenlenen, son görüntülenen, yaklaşan tarihli, açık risk taşıyan veya bekleyen GitHub geliştirme sinyali bulunan kayıtlar arasından az sayıda anlamlı geri dönüş kartı seçer.

- **Kullanıcı proje veya İş bağlamından ayrılmadan önce isteğe bağlı tek bir `Sıradaki somut adım` metni kaydedebilir.** Değer ayrı bir kayıt, İş, kontrol listesi maddesi, Günlük Odak üyeliği, hatırlatma veya ikinci çalışma listesi değildir; ilgili ana Proje veya İş kaydının isteğe bağlı alanıdır. Kullanıcı değeri açıkça ekler, değiştirir veya temizler. Yeni değer mevcut etkin ipucunun yerini alır; önceki değerler kaydın normal değişiklik geçmişinde korunur.

- **`Çalışmaya Dön`, ilgili bağlamda etkin bir `Sıradaki somut adım` varsa metni kaynak kaydı, son güncelleme zamanı ve `Kaynak kaydı aç` eylemiyle belirgin biçimde gösterir.** Alan durum, öncelik, tarih, planlama üyeliği veya proje aşaması değiştiğinde kendiliğinden güncellenmez ya da temizlenmez; sistem olaylardan yeni adım tahmin etmez. Arama ve içe/dışa aktarma aynı kayıt alanını kullanır; bağlantıyla sınırlı paylaşım veya herkese açık yayın ise alanı yalnız ortak kapalı dünya kapsamında ayrıca önizlenip onaylanırsa gösterir.

- **Özet ayrıca kullanıcının ilgili proje veya iş bağlamına son ziyaretinden sonra gerçekleşen tanımlı olayları `Son baktığından beri` bölümünde iş, karar, risk, belge, GitHub ve yayın gibi anlaşılır konu gruplarında gösterir.** İşaret Hesaba aittir ve sunucuda yalnız Proje ile desteklenen İş bağlamı başına en son başarılı görünür açılış zamanını tutar; görüntüleme geçmişi, süre, analytics veya denetim olayı üretmez. Kayıt silinince işaret silinir ve dış yüzeye açılmaz. Her öğe olay zamanını ve ana kaynak kaydı görünür kılar. Gruplama yalnız tanımlı olay türlerine dayanır; AI özeti, açıklanamayan önem sıralaması veya yeni bir özet kaydı üretmez.

- **Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard veya Roadmap hedefi bulunan desteklenen olaylarda kullanıcı `Değişiklikleri görsel olarak gez` eylemini açıkça başlatabilir.** Tur yalnız aynı `Son baktığından beri` kümesindeki tanımlı olayları sırayla kullanır; ilgili kaynak kartı veya desteklenen kesin görsel hedefi vurgular, görünümü konumuna taşır ve olay zamanı ile gösterilme nedenini açıklar. Roadmap turu yeni bir roadmap geçmişi, audit kaydı, snapshot veya önem skoru üretmez; mevcut olayın kesin İş/Kilometre Taşı hedefini güncel görünümde çözümler. Silinmiş, erişilemeyen veya artık konumlandırılamayan hedef atlanırken nedeni gösterilir; başka nesneye sessizce yönelinmez.

- **Görsel tur kullanıcı tarafından her an kapatılabilir.** Tur başladığında geçerli olan viewport güvenle çözümlenebiliyorsa kapanışta geri yüklenir; içerik değişikliği eski konumu anlamsız kılmışsa görünür içeriğe sığan fallback kullanılır. Çok büyük olay kümelerinde açıklanabilir bir üst sınır ve kalan olayları normal listede açma eylemi bulunur. Tur AI yorumu, ayrı kayıt, kalıcı rota, yeni odak sırası veya ikinci çalışma listesi oluşturmaz.

- **Her kart neden gösterildiğini açıklar ve kullanıcıyı ana kaynak kayda götürür.** Özet yeni içerik veya ikinci bir çalışma listesi oluşturmaz.

- **Kullanıcı proje bazında bir durum yaşı eşiği belirlemişse eşiği aşan aktif işler `Uzun süredir aynı durumda` gerekçesiyle nötr geri dönüş adayı olur ve hazır Akıllı Koleksiyonda gösterilir.** Bu aday varsayılan bildirim, `takıldı` hükmü, sağlık veya performans puanı üretmez.

- **Özellik son açık kayıt, sekme, filtre, sıralama, scroll konumu veya yan panel durumunu geri yüklemez.** Büyük canvas'ların kendi kişisel viewport/zoom/collapse üstverisini geri yüklemesi bu özetin değil, yukarıdaki dar görünüm davranışının parçasıdır.

- **Çalışmaya Dön özeti ayrı bir yönlendirilmiş kişisel çalışma seansı, zorunlu gündem, zamanlayıcı veya kayıtların durumunu değiştiren ilerleme akışı oluşturmaz.** Kullanıcı önerilen kaynakları kendi sırasıyla açar; mevcut Aktif Çalışma Seti ve İş bağlamı ikinci bir seans yaşam döngüsü kazanmaz.

### Dış araca kaçış günlüğü

- **Kullanıcı, ürün kapsamında olduğunu düşündüğü bir işi tamamlamak için başka bir araca geçtiğinde `Ürün boşluğu kaydet` eylemini açıkça başlatabilir.** Kayıt, çalışma alanı genelindeki ana `Ürün Boşluğu` altında tarihli bir `Dış Araca Kaçış` olayı oluşturur. Kullanıcı yeni bir boşluk açabilir veya olayı mevcut boşluğa bağlayabilir; benzer başlıklar kendiliğinden birleştirilmez.

- **`Ürün Boşluğu`; karşılanmayan ihtiyacı, isteğe bağlı kapsam açıklamasını, ilgili Proje/İş/Özellik/Karar ilişkilerini ve kullanıcı tarafından yönetilen `Açık`, `Değerlendiriliyor`, `Karşılandı` veya `Bilinçli sınır` durumunu taşır.** Her `Dış Araca Kaçış` olayı; gerçekleşme zamanını, kaynak proje veya kayıt bağlamını, kullanıcının yapmak istediği işi, geçtiği dış aracı, `Eksik yetenek`, `Daha hızlı`, `Daha güvenilir`, `Kullanılabilirlik` veya `Alışkanlık` nedenlerinden uygun olanları ve isteğe bağlı notu korur. İçerik kendiliğinden kopyalanmaz. Yüksek etkili kaçış ancak aynı gerçek iş akışı mevcut Ürün sürüm adayında başarılı olduktan, etkilenen güncel gerçek uygun ve kullanılabilir ürün kayıtlarına manuel yeniden oluşturma veya desteklenen import ile döndükten, dış kopya aktif ya da paralel doğruluk kaynağı olmaktan çıktıktan ve kanıt bu kesin kayıtlara bağlandıktan sonra kapanabilir.

- **Aynı Ürün Boşluğuna bağlı tekrar sayısı yalnız açıkça kaydedilmiş olaylardan türetilir ve sayıyı oluşturan kesin olay kümesini açar.** Dogfooding özeti boşlukları dış araç, neden, proje ve durum bazında filtreleyip tekrarları görünür kılabilir. Tekrar sayısı otomatik öncelik, puan, roadmap kararı, Özellik, İş veya bildirim oluşturmaz; kullanıcı gerekirse boşluktan açık önizlemeyle takip İşi ya da Özellik ilişkisi oluşturur.

- **Ürün uygulama kullanımını, tarayıcı geçmişini, pencere odağını, clipboard'u veya başka araçlardaki davranışı arka planda izlemez; dış araç geçişini otomatik algılamaz veya dış aracı gerçeği geri getirmek için kendiliğinden taramaz.** Bir boşluğun durumunu değiştirmek geçmiş kaçış olaylarını değiştirmez veya bağlı kayıtların yaşam döngüsüne yazmaz. Ürün Boşlukları ve olayları normal arama, ilişki, geçmiş ve içe/dışa aktarma kurallarına uyar; bağlantıyla sınırlı salt okunur paylaşımda ya da herkese açık yayında ancak ortak kapalı dünya önizlemesi ve açık onayla gösterilir.


### Proje yapısını kopyalama

- **Kullanıcı mevcut projenin aşamalarını, etkin alanlarını, iş durumlarını, hazır görünümlerini, İş türlerine göre İş Bağlam Kartı düzenlerini, proje bazlı özel alan şemalarını, öncelik ölçütü tanımlarını ve boş Proje Duvarı iskeletlerini içerik ve çalışma geçmişi olmadan yeni projeye aktarabilir.** Kart düzenleri hedef Projede bağımsız sürümlü yapılandırmalar olur; kaynak İşleri, ilişkileri veya kart sonuçlarını taşımaz.

- **Duvar iskeletinde grup ve başlıklar ile kayıttan bağımsız görünüm ayarları kopyalanabilir.** Kaynak kartlar, karta bağlı görsel çizgiler, odak sırası, kilitler ve çalışma geçmişi taşınmaz; ayrı içerikli duvar şablonu sistemi oluşturulmaz.

- **Özel alan ve öncelik ölçütü tanımları hedef projede bağımsız kopyalar olarak oluşturulur; çalışma alanı genelinde ortak alan veya ölçüt kimliği yaratılmaz.**

- **Proje-bazlı iş öğesi şablonları, Planlı Test Senaryoları ve otomasyon kuralı tanımları proje yapısıyla birlikte kopyalanmaz.** Kullanıcı bunları hedef projede ayrıca oluşturur.

- **İlk ürün bütün Belgeleri, İşleri, ilişkileri, tasarımları ve geçmişi yeni bağımsız doğruluk kaynağına çeviren genel `Projeyi çoğalt` veya içerikli `Proje Fork'u` sunmaz.** Müşteri ve kapsam alternatifleri teklif revision'larında, tasarım alternatifleri kendi akış ve Wireframe sürümlerinde kalır; hizmet kurtarması operasyonel yedek sözleşmesini izler. İçerikli fork'un değerlendirme koşulları [Gelecek Yönleri](18-future-directions.md#icerikli-proje-forku) belgesindedir.

### Komut Paleti ve klavye odaklı kullanım

- **Komut Paleti; içerik arama, kayıt oluşturma, projeler arasında geçiş yapma ve sık işlemleri uygulamanın her yerinden klavyeyle çalıştırır.** Açma kısayolu `Ctrl+K` (macOS’ta `⌘K`) sabittir; palet başlığı `Command Palette`dır ve `Search` değildir.

- **İlk ürünün belgelenmiş klavye kısayolları sabittir ve her komutun görünür arayüz karşılığı bulunur.** Kullanıcı tarafından yeniden eşlenebilen genel kısayol profili ilk üründe veya kanıt bekleyen ticari gelecekte yer almaz; değerlendirme koşulları [Gelecek Yönleri](18-future-directions.md#yeniden-eslenebilir-klavye-kisayollari) belgesindedir.

- **Paletteki temel eylemler ilgili görünür menülerde de bulunur.** Kısayol ipuçları görünürdür. Komut kapsamı, hedefi ve etkilenecek seçim sayısı açıkça gösterilir; geri alınabilir değişiklikler [ortak güvenli geri alma sözleşmesini](02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma) kullanır.
