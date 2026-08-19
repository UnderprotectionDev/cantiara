# GitHub ve Proje Sürümleri

Bu belge repository bağlantılarının, GitHub kaynaklı geliştirme kayıtlarının, Proje Sürümünün, yayın hazırlığının ve yayımdan sonraki Üretim Olayı öğrenim kaydının tek normatif sahibidir. Teknik Diyagramlar ve şema artefaktları [Teknik Diyagramlar ve Şema Artefaktlarında](11-technical-diagrams-and-schema-artifacts.md) yaşar. Ürün sürüm adayının kabulüyle kullanıcı tarafından yönetilen Proje Sürümü birbirinden ayrıdır.

## Repository, GitHub ve sürümler

### Repository bağlantıları

- **Bir proje sıfır, bir veya birden fazla repository ile ilişkilendirilebilir.** Repository dosyaları kendi konumlarında kalır ve ilgili proje kayıtlarına bağlanabilir.

- **Her bağlantı GitHub'ın kararlı repository kimliğiyle tanımlanır; repository adı veya sahibi kimlik değildir.** Ad/sahip değişikliği aynı bağlantının geçmişinde kalır. Erişim kaybı veya yeniden yetkilendirmede kullanıcı aynı kararlı kimliği açıkça yeniden bağlar, credential döndürülür ve son güvenli durum güncel desteklenen kaynakla uzlaştırılır. Farklı kararlı kimlik her zaman yeni GitHub bağlantısıdır; ada göre otomatik eşleme yapılmaz.

- **Repository bağlantısının yetki sahibi GitHub App installation'ıdır; GitHub login OAuth yetkisi değildir.** Login bağlantısının kaldırılması repository installation'ını, repository seçimini veya tarihsel dış kayıtları değiştirmez. GitHub App'in kaldırılması ya da repository izninin geri çekilmesi eşitlemeyi durdurur fakat Hesap kimliğini ve geçerli ürün oturumunu değiştirmez; Hesap kapatma iki yetkiyi de iptal eder.

- **Mevcut GitHub repository'si ilk kez bağlandığında ürün kullanıcının atlayabileceği bir toplu triage sunar.** Açık/kapalı durum, son güncelleme, milestone ve PR bağlantısı gibi yalnız açıklanabilir GitHub alanlarıyla adaylar gruplanır; AI kullanılmaz. Kullanıcı seçilen Issue'lar için oluşturulacak ana İşleri, aktarılacak alanları ve kurulacak kaynak bağlantılarını topluca önizleyip onaylar. Hiçbir Issue sessizce İşe dönüşmez, İş durumu kazanmaz veya planlama yüzeyine yerleştirilmez; triage atlanırsa kayıtlar aranabilir dış GitHub kayıtları olarak kalır.

- **GitHub dış kayıtları salt okunur kaynak gerçeği taşırken normal yerel Arşiv ve Çöp Kutusu yaşamını GitHub'daki kayıttan bağımsız izler.** Tekil dış kaydı Arşivlemek onu normal listelerden kaldırır fakat aktif Projedeki bağlantı sağlıklıyken kaynak durumunun ve son eşitleme zamanının güncellenmesini durdurmaz. GitHub'daki kaydı kapatmak, silmek veya yeniden açmak yerel kaydı otomatik arşivlemez, Çöp Kutusuna almaz ya da geri yüklemez.

- **Tekil GitHub dış kaydı Çöp Kutusundayken ürün kayda yeni kaynak durumu yazmaz ve onu arama, ilişki önerisi, otomasyon veya planlama girdisi yapmaz.** Geri yükleme aynı yerel kimliği önceki kaynak durumuyla açar; bağlantı aktifse kullanıcıya açık fark/uzlaştırma gösterilmeden arada kaçan GitHub gerçeği sessizce uygulanmaz. Kalıcı silme sonraki webhook, uzlaştırma veya yeniden bağlamanın aynı kaydı otomatik diriltmesini [veri güvenliği belgesindeki içeriksiz yeniden oluşturma tombstone'uyla](13-data-security-and-portability.md#saklama-ve-guvenli-silme-sureleri) engeller. Kullanıcı kaynağı açıkça yeniden dahil ederse yeni ürün kimlikli dış kayıt oluşur ve önceki kalıcı silme kökeni görünür kalır.

- **GitHub bağlantısını kaldırmak daha önce yakalanmış dış kayıtları silmez veya onların yerel yaşam durumunu değiştirmez.** Kayıtlar son kaynak durumu ve artık eşitlenmediği bilgisiyle tarihsel kalır; yeniden bağlama ancak aynı kararlı repository kimliğiyle yeni kaynak farkını açıkça uzlaştırır.

### GitHub geliştirme kayıtları

- **İlk ürünün tek geliştirme sağlayıcısı GitHub’dır.** Bağlantı, GitHub App üzerinden repository bazında açıkça seçilir ve yalnız `Metadata: read`, `Contents: read`, `Issues: read`, `Pull requests: read`, `Checks: read` ve `Commit statuses: read` izinlerini ister; hiçbir GitHub yazma izni istemez. `Contents: read` yalnız release, tag ve kesin commit çözümlemek için sürümlü endpoint/query izin listesiyle kullanılır. Dosya içeriği, tree, blob, archive, diff ve tam check logu uçları engellenir, izlenir ve karşıt testlerle doğrulanır. Kullanıcı arayüzü GitHub’ın issue, branch, commit, pull request, check, tag ve Release kavramlarını doğru adlarıyla gösterir. İç entegrasyon sınırı yalnız ürünün gerçekten kullandığı ortak kimlik, bağlantı, senkronizasyon durumu ve kaynak URL’sini ayırır; sağlayıcıya özel üstveri kaybolmadan saklanır. GitLab veya Bitbucket adaptörü ve kullanılmayan genel sağlayıcı soyutlamaları ilk üründe uygulanmaz.

- **Kalıcı GitHub alan izin listesi repository'nin kararlı kimliği/adı/sahibi/URL'si, issue/PR/branch/commit/tag/Release kararlı kimlik ve URL'leri, başlık, açık-kapalı/merge durumu, seçili label/milestone/reviewer özeti, commit SHA, check/status adı-sonucu ve sağlayıcı zaman damgalarıyla sınırlıdır.** Dosya ağacı, blob, diff, tam check logu veya serbest webhook payload'ı ana kayıtlara yazılmaz. Yeni alan listeye güvenlik ve veri minimizasyon incelemesiyle eklenir.

- **GitHub eşitlemesinin birincil yolu imzası doğrulanan webhook'lardır.** Kaçan olayları yakalamak için bağlantı aktifken en geç 15 dakikada bir artımlı read-only uzlaştırma yapılır; kullanıcı ayrıca açık `Şimdi eşitle` eylemi başlatabilir. GitHub rate limit'i aşıldığında ürün `Retry-After`/reset zamanına uyar, yazma yapmaz, eski veriyi son başarılı eşitleme zamanıyla gösterir ve sessiz yoğun polling uygulamaz.

- **Webhook endpoint'i geçerli imzayı doğruladıktan ve teslimi durable inbox'a tekil olarak kaydettikten sonra GitHub'a 10 saniyeden kısa sürede başarı yanıtı verir; alan senkronizasyonunu HTTP isteği içinde tamamlamaya çalışmaz.** Worker retry sınırını aşan teslimi kaybetmez, dead-letter durumunda görünür operasyonel alarm üretir ve uzlaştırma aynı kaynak gerçeğini daha sonra güvenle uygulayabilir.

- **Webhook teslim kimliği veya payload hash'i ve işleme sonucu aynı bağlantı kapsamında 30 gün tutulur; aynı teslim tekrar gelirse ikinci olay veya ilişki oluşturulmadan önceki sonuç döndürülür.** Başarıyla işlenmiş şifreli ham payload en fazla 24 saat, başarısız/dead-letter payload en fazla 7 gün tutulur ve sonra fiziksel silinir. Olaylar geliş sırasına göre değil GitHub kaynak kimliği, kaynak `updated_at` zamanı ve uzlaştırma sonucu ile uygulanır. Daha eski olay yeni durumu geriye sarmaz. Aynı zaman damgasında çelişki varsa uzlaştırmadan alınan güncel kaynak durumu üstün gelir ve çelişki bağlantı geçmişine yazılır.

- **GitHub App kaldırılır, repository erişimi geri çekilir, repository silinir veya başka hesaba taşınırsa bağlantı `Yetki yok` ya da `Kaynak bulunamadı` olur; yeni eşitleme durur ve son yakalanan kayıtlar tarihsel kaynak olarak kalır.** Kullanıcıdan yeniden yetkilendirme istenir, başka repository'ye otomatik bağ kurulmaz. Webhook secret'ı en geç 90 günde bir ve şüpheli erişimde hemen döndürülür; geçişte eski ve yeni secret en fazla 15 dakika birlikte doğrulanabilir, ardından eski secret reddedilir.

- **Proje Arşivlendiğinde GitHub bağlantısı duraklatılır ve son veriler zamanı görünür eski durum olarak kalır.** Arşivden çıkarma bağlantıyı otomatik sürdürmez veya kaçırılan olayları gerçekleşmiş gibi üretmez; kararlı repository kimliği, son ve güncel durum, yetki ile yeniden kurulamayan boşluklar önizlendikten sonra açık yeniden bağlama gerekir. Doğrulama başarısızsa Proje etkin fakat GitHub bağlantısı kesilmiş kalır.

- **Her GitHub bağlantısı yetkilendirilen hesap/organizasyon ve repository kapsamıyla birlikte son başarılı eşitleme zamanını, devam eden veya son başarısız eşitlemeyi, son hata açıklamasını, rate-limit nedeniyle beklenen yeniden deneme zamanını, yeniden yetkilendirme gereksinimini ve `Yeniden bağla` ile `Bağlantıyı kaldır` eylemlerini gösterir.** Son başarılı eşitlemenin üzerinden 30 dakikadan fazla geçtiğinde bağlantı `Güncel değil` olarak işaretlenir. Proje ve ilgili GitHub kayıtları bağlantının güncel olmadığını görünür kılar; eski veri sessizce güncelmiş gibi sunulmaz. Yeniden deneme dış kaydı değiştirmez. Bağlantıyı kaldırmadan önce etkilenecek repository ve kayıt bağlantıları önizlenir; daha önce yakalanmış geçmiş olaylar kaynak ve artık eşitlenmediği bilgisiyle korunur, yeni eşitleme durur ve secret iptal edilir.

- **GitHub issue, branch, commit ve pull request kayıtları ilgili proje öğelerine bağlanabilir.** Uygulamadaki iş öğesi planlamanın ana kaydı, GitHub kayıtları dış geliştirme gerçekleridir.

- **Bağlı GitHub Issue üzerinde açık `İş oluştur ve bağla` eylemi, kullanıcı tarafından seçilen başlık, açıklama ve desteklenen kaynak alanlarını uygulanmadan önce göstererek bir defaya mahsus ana İş taslağı oluşturur.** Kullanıcı onayladığında tek bir İş oluşur; köken ve canlı GitHub bağlantısı korunur. Bu işlem İş ile GitHub Issue arasında sürekli çift yönlü alan senkronizasyonu kurmaz.

- **Pull request ile İş bağlantısı çoktan çoğadır:** bir PR birden fazla İşe, bir İş birden fazla PR'a bağlanabilir. Her bağlantı bağımsız, görünür ve kaldırılabilir olur; bağlantı kurulması ya da kaldırılması İş durumunu, başka PR'ları veya diğer bağlı İşleri örtük değiştirmez. PR bağlantısı `Tamamlanma için gerekli` veya `Bağlamsal` rolü taşır. Manuel bağlantıda kullanıcı rolü seçer.

- **Projeye bağlı repository’de branch adı, commit mesajı, issue veya PR başlığı/açıklaması gibi desteklenen alanlarda tam ve tekil bir güncel iş anahtarı veya iş anahtarı geçmişindeki bir anahtar eşleştiğinde kayıt ilgili işe otomatik bağlanır.** Eşleşmenin hangi anahtardan üretildiği görünür olur ve bağlantı uygulama içinden kaldırılabilir; bu işlem GitHub kaydını değiştirmez. PR'daki kesin anahtar yalnız desteklenen `Fixes`, `Closes` veya `Resolves` closing-intent ifadesiyle birlikteyse `Tamamlanma için gerekli`, diğer kesin eşleşmelerde `Bağlamsal` bağlantı kurar. Eksik, birden fazla veya proje dışı eşleşme otomatik bağ kurmaz, yalnız kullanıcıya öneri sunar.

- **Branch, commit ve PR durumları görünür ve aranabilir olur; varsayılan olarak İş durumunu değiştirmez.** PR rollerinden türeyen kapatma önerisinin koşulları, hazır kuralın etkisi ve olumsuz durumları yalnız [Hafif uygulama içi otomasyon kuralları](06-work-management-and-planning.md#hafif-uygulama-içi-otomasyon-kuralları) altında tanımlanır; bu bölüm GitHub kaynak gerçeklerini ve bağlantı rollerini sağlar, aynı davranışı ikinci kez tanımlamaz.

- **Bağlı PR’ın GitHub build/check sonucu kaynak durumu ve GitHub bağlantısıyla salt okunur gösterilir.** Ürün check’i çalıştırmaz veya yeniden başlatmaz, tam check loglarını yönetmez ve sonucu ayrı bir uygulama içi doğrulama kaydına dönüştürmez.

- **`Tamamlandı` sonuçlu iş + açık PR gibi yalnız doğrudan mevcut durumlardan doğrulanabilen iş–PR çelişkileri tarafsız dikkat sinyali üretir.** Sinyal kaynak kayıtları gösterir; otomatik durum değişikliği veya değişiklik etki analizi yapmaz.

- **Bağlı PR check’inin başarısız olması `Eylem Gerekiyor` sinyali üretir.** Sinyal kesin PR/check kaynağını açar ve kullanıcıya normal kaynak bağlantılı takip eylemlerini sunar; İş kapatma ve yeniden açma üzerindeki bütün otomasyon etkileri yalnız [hazır PR-merge kuralında](06-work-management-and-planning.md#hafif-uygulama-içi-otomasyon-kuralları) tanımlanır.

- **Projeye bağlı repository’de açık olup hiçbir iş öğesine bağlanmamış PR için tekilleştirilmiş ve kapatılabilir bir Bildirim Merkezi sinyali üretilir.** Commit ve branch’ler yalnız bağlanmamış oldukları için aynı sinyali üretmez.

- **Review requested, changes requested, approval ve sıradan PR yorumları ayrı bir dikkat sinyali üretmez.** İnceleme, yorum ve onay işlemleri GitHub veya IDE’de kalır; mevcut genel GitHub aktivitesi görünürlüğü bu olaylar için yeterlidir. Atanmış reviewer'ların `Bekliyor`, `Onaylandı`, `Değişiklik istendi` ve `Yalnız yorumlandı` durumları veri GitHub'dan alınabildiğinde PR Bağlam Kartında salt okunur, kompakt bir özet olarak gösterilir.

- **`Kod merge edildi`, `İş tamamlandı` ve `Proje Sürümü yayımlandı` ayrı olaylar olarak izlenir.**

- **İlk ürün bağlı PR’ın yukarıda tanımlanan salt okunur build/check özeti dışında bağımsız build kaydı, deployment, feature flag veya vulnerability durumu içeri almaz; PR cycle-time ve deployment-frequency gibi geliştirme performans metrikleri üretmez.**

- **Uygulama branch oluşturmaz, commit yazmaz, pull request oluşturmaz veya düzenlemez ve hiçbir Git/GitHub geliştirme mutasyonu yürütmez.** Bu işlemler IDE, CLI veya GitHub’da kalır; ürün izleme, bağlama, bağlam gösterme, öneri ve dikkat sinyalleriyle sınırlıdır.

### PR Bağlam Kartı

- **Bağlı GitHub pull request’in uygulama içindeki detayında ana kayıtlardan türetilen bir PR Bağlam Kartı gösterilir.**

- **Kart problem kaynağı, beklenen sonuç, ilgili kararlar, açık riskler, geri bildirimler, hedef sürüm, bağlantının gerekli/bağlamsal rolü, son GitHub build/check sonucu ve reviewer durumlarının kompakt salt okunur özetini gösterir.** Her madde asıl kayda bağlanır. Kart elle sürdürülen ikinci açıklama veya yeni doğruluk kaynağı oluşturmaz.

- **Diff review, approve ve merge işlemleri GitHub’da kalır.**

### Proje Sürümü planlama

- **Proje Sürümü bir Çalışma Alanı veya Projeler arası kayıt değil, tam olarak bir Projeye ait ana kayıttır.** Kullanıcı bir Proje Sürümüne girecek İşleri birlikte yönetebilir; aynı Projenin birden fazla repository’sinden ilgili tag’leri, GitHub Release kayıtlarını ve ortam bağlantılarını tek Proje Sürümüne ekleyebilir. Projeler arası ortak Proje Sürümü ilk üründe yoktur.

- **Proje Sürümü ortak domain sözlüğündeki yayımlanacak kapsam anlamını kullanır.** Odak Dönemi ve Kilometre Taşıyla kavramsal ayrımı yalnız [ortak terim sözlüğünde](02-domain-model-and-lifecycle.md#terim-sözlüğü) tanımlanır.

- **Proje Sürümleri alanı kayıtları taranabilir bir genel görünümde sunar.** Her Proje Sürümünün detayındaki `Sürüm Kanıt Paketi`; kapsamdaki İşleri, bunların beklenen sonuçlarını, ilgili Karar ve açık Riskleri, Belgeleri ve tasarımları, bağlı PR ve check durumlarını, tag/GitHub Release bağlantılarını, test kanıtı ile açık Test Açıklarını ve hazırlanmış yayın çıktısını ana kaynaklarından bir araya getirir.

- **Kullanıcı Proje Sürümünde isteğe bağlı bir erişim ve sonuç hipotezi tanımlayabilir.** Hipotez hedef kitleyi serbest açıklama ve varsa Persona/Contact/Company ilişkileriyle, bu Sürüm için kullanılacak tek birincil erişim yolunu, erişimin gözlendiğini gösterecek kanıtı, hedeflenen davranış/sonucu ve onu gösterecek kanıtı birbirinden ayrı tutar. Alanlar yayın kapısı değildir; ürün kampanya yürütmez, hedef kitleyi dış sisteme göndermez, analytics sorgulamaz veya erişim/sonuç değerini kendiliğinden ölçmez.

- **İlk ürün, Proje Sürümü kaydına ayrı yerleşik hedef yayın tarihi veya gerçek yayın tarihi alanı eklemez.** GitHub Release kaydındaki zaman dış geliştirme gerçeği olarak bağlı kaydında kalır.

### Sürüm Kanıt Paketi ve yayın hazırlığı

- **Kullanıcı Proje Sürümü düzeyindeki yayın kontrol listesini yönetebilir.** Sürüm Kanıt Paketi tamamlanan ve açık kapsamı; gerekli ve bağlamsal PR’ları; bağlı PR’lardaki bekleyen veya başarısız GitHub check’lerini; doğrudan İş–PR tutarsızlıklarını; ilişkili Kararları ve açık Riskleri; kapsamdaki İşlerin beklenen sonuçlarını; Proje Sürümü kapsamıyla ilişkili Planlı Test Senaryolarını, Test Handoff'larını, Test Oturumlarını ve bunların Oturum Testlerini; açık Test Açıklarını; son Test değerlendirmesini; kontrol listesi durumunu ve hazırlanmış changelog ile mevcut onaylı dış snapshot arasındaki yayın farkına geçişi kaynakları görünür, açıklanabilir tek değerlendirme yüzeyinde birleştirir. Yayın farkının kesin kapsam ve güvenlik davranışı [Paylaşım ve Herkese Açık Yayının](14-sharing-and-public-publishing.md#onaylı-yayın-snapshotı) sorumluluğundadır.

- **Sürüm Kanıt Paketi İş, test, PR, Risk, Karar veya Proje Sürümü durumunu değiştirmez ve yayını otomatikleştirmez.** Oturum Testi sonucu gösterildiğinde yürütücünün bildirdiği ham ifadeyi, normalize sonucu, kaynak Test Oturumunu ve mevcut teknik/zaman bağlamını korur. Bağlı PR check’lerini kaynak durumlarıyla ayrı gösterir; bunları Test Oturumuna dönüştürmez, test runner, doğrulama, CI/CD veya deployment işlemi yürütmez ve readiness, kalite skoru, genel `Hazır/Hazır değil` hükmü ya da zorunlu yayın kapısı çıkarmaz.

- **Paketteki her satır kendi ana kaydını ve gösterilme nedenini açar.** Kullanıcı bir alanı, ilişkiyi, test incelemesini, Risk yanıtını, kontrol listesi maddesini veya yayın metnini düzeltmek istediğinde özgün kayıt yüzeyine gider; paket kaynak alanları düzenleyen karma bir form, düzeltme kopyası, kabul istisnası veya ikinci yayın checklist'i oluşturmaz.

- **İlişkili test kaydının, gerekli PR/check'in, beklenen sonucun veya yapılandırılmış başka paket bağlamının bulunmaması; kesin spec/commit/build bağlamının değişmesi; yürütücünün olumsuz ya da belirsiz sonuç bildirmesi; incelenmemiş rapor; açık Risk veya Test Açığı; ya da son Test değerlendirmesinden sonra yeni bağlam gelmesi kaynaklarıyla tarafsız dikkat bilgisi olarak gösterilir.** Salt zaman geçmesi testi kendiliğinden eski ya da geçersiz yapmaz. Eksiklik puan, bildirim veya zorunlu alan üretmez; yayın kararını kullanıcı verir.

- **Proje Sürümü yayımlandığında kapsamında açık İşler kalmışsa Proje Sürümünü ve açık İşleri gösteren tekilleştirilmiş, kapatılabilir bir Bildirim Merkezi sinyali üretilir.** Sinyal yayımlamayı engellemez ve Proje Sürümü veya İş durumlarını değiştirmez.

### Proje Sürümü iletişimi

- **Tek Proje Sürümü kapsamındaki İşlere dayanarak sürüm notları hazırlanabilir.** Yayımlanan sürüm notları değişiklikleri Proje Sürümleri boyunca hedef kitlenin okuyacağı sürekli changelog görünümünde bir araya getirir.

- **Changelog girdileri mevcut Markdown yazımı ve görsel ek kabiliyetlerini kullanır.** Kullanıcı mevcut genel etiketlerle yayımlanmış girdileri filtreleyebilir; changelog’a özgü ikinci bir etiket doğruluk kaynağı oluşturulmaz.

- **Kullanıcı bir changelog girdisine isteğe bağlı, kompakt bir `Neden yapıldı?` kaynak izi ekleyebilir.** İş, Geri Bildirim, Karar, Kaynak/araştırma, Belge, Tasarım ve Deney/doğrulama gibi ürünün desteklediği kanıt kayıt türleri sabit bir üçlüyle sınırlandırılmaz; ancak yalnız kullanıcının tek tek seçtiği kayıtlar ve ayrıca herkese açık olarak onayladığı alan snapshot’ları gösterilir. Bir kaydın seçilmesi ilişkili başka kaydı, kayıt türünü veya özel alanı kendiliğinden yayımlamaz. Kaynak izi olmadan yalnız metin içeren changelog girdisi yayımlanabilir.

- **Hazırlanan sürüm notu taslakları ve ilişkili özel Proje Sürümü bağlamı yayın onayına kadar özel kalır.** Sürekli herkese açık changelog yalnız onaylanmış yayın snapshot’larından oluşur; kimlik doğrulamalı ayrı bir özel changelog kitlesi yaratmaz. Özel inceleme gerektiğinde seçili Belge veya Roadmap için mevcut iptal edilebilir salt-okunur paylaşım bağlantısı kullanılabilir.

- **Proje Sürümü notu veya changelog yayımlanmadan önce yayın kapanış önizlemesi gösterilir.** Önizleme ilgili işlerin mevcut iç durumlarını ve mevcut ya da önerilen herkese açık etiketlerini, changelog bağlantılarını, `Neden yapıldı?` için önerilen kaynak kayıt ve alan snapshot’larını ve herkese açık gelişim akışına girecek olayları tek yerde sunar. Kullanıcı kapsamı ve önerilen herkese açık değişiklikleri açıkça onaylar; yayın eylemi işlerin iç durumunu, Proje Sürümü kaydını, herkese açık etiketi veya gelişim akışı kapsamını kendiliğinden değiştirmez.

- **Yayın kapanış önizlemesi [ortak snapshot ve dış görünürlük güvenlik sözleşmesinin](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) yer tutucu, hassas veri, kapalı dünya kapsamı ve dolaylı sızıntı denetimlerini kullanır.**

- **Önizlemede tek tek onaylanan herkese açık etiket, changelog bağlantısı ve gelişim akışı kapsamı aynı yayın eylemiyle yeni herkese açık snapshot’a uygulanabilir.** Onaylanmayan öneriler özel ve değişmemiş kalır; yayın kapatılması ilgili ana kayıtları otomatik tamamlamaz.

- **Yayın tamamlandıktan sonra kullanıcıya atlanabilir `Etkisini yeniden değerlendir` eylemi sunulur.** Eylem; bağlı Proje Hedefini, Sürümün erişim ve sonuç hipotezini, kapsamdaki ilgili Özellik/İş kayıtlarının mevcut `Beklenen sonuç` ile `Gözlenen sonuç/öğrenim` içeriğini ve önceki tarihli gözlemleri kaynaklarına geri açılan bölümlerde yan yana gösterir.

- **Her açık yeniden değerlendirme turu birbirinden bağımsız bir `Erişim gözlemi` ve `Sonuç gözlemi` alanı sunar; kullanıcı birini veya ikisini aynı anda ya da farklı zamanlarda kaydedebilir.** Her gözlem `Gözlendi`, `Kısmen gözlendi`, `Gözlenmedi` veya `Öğrenilemedi` değerlendirmesini; serbest açıklamayı, gözlem zamanını, yazarı ve yalnız o gözleme ait seçilmiş kesin Kaynak/Geri Bildirim/Deney-doğrulama/Dosya Eki kanıt bağlarını taşıyabilir. Gözlem kanıtı üst Proje Sürümünün genel kanıt bağlarına eklenmiş sayılmaz. Erişim gözlemi ürün davranışının gerçekleştiğini, Sonuç gözlemi yeterli kullanıcıya ulaşıldığını ima etmez; ürün ikisinden birleşik başarı hükmü çıkarmaz.

- **Bir Proje Sürümü farklı tarihlerde birden fazla yeniden değerlendirme turu ve her turda sıfır veya bir Erişim ile sıfır veya bir Sonuç gözlemi taşıyabilir.** Gözlemler Sürüme ait sahipli bileşenlerdir; bağımsız ana kayıt, ayrı etki değerlendirme yaşam döngüsü veya İş/Özellik alanlarının ikinci doğruluk kaynağı olmaz. Yeni tur ve sonraki gözlem öncekini yeniden yazmaz; düzeltme normal değişiklik geçmişinde yazarı, zamanı ve önceki değeri korur.

- **Etkisini yeniden değerlendirme isteğe bağlıdır; Özellik veya Proje Sürümü kapatmayı engellemez, scorecard, otomatik ölçüm, sabit kadans ya da takip işi üretmez.** Kullanıcı tarih seçerse aynı eylem mevcut kişisel `Yeniden bak` hatırlatmasını kaynak Proje Sürümü için kurar. Hatırlatmanın tetiklenmesi yalnız normal hatırlatma sinyalidir; yeni tur başlatmaz veya eksik gözlem sinyali üretmez. Kullanıcı yeniden değerlendirme turunu açıkça başlattığında Erişim ya da Sonuç alanlarından biri açıkça değerlendirilmemişse tek kaynak bağlantılı `Eylem Gerekiyor` sinyali gösterilir; `Öğrenilemedi` tamamlanmış değerlendirme sayılır. Sinyal ancak turun iki alanı da açıkça değerlendirildiğinde veya kullanıcı turu bilinçli olarak `Değerlendirmeyi kapat` eylemiyle kapattığında kapanır; yalnız yayından sonra zaman geçmesi ya da tek gözlem kaydetmek sinyali kapatmaz.

- **Proje Sürümü notu ve changelog metni kullanıcı tarafından hazırlanır ve açık yayın onayını izler.** Genel otomatik dönemsel veya herkese açık anlatı yasağı [Kapsam Dışı Hükümlerde](19-out-of-scope.md#ai-otomasyon-ve-programatik-erişim) yaşar.

<a id="uretim-olaylari"></a>
### Üretim Olayları

- **`Üretim Olayı`, yayımlanmış üründe gerçekleşen önemli operasyonel olayı normal Bug işinden ayıran hafif bir olay sonrası öğrenim kaydıdır.** Olayın zamanı, kullanıcı veya sistem üzerindeki etkisi, nasıl fark edildiği, nasıl çözüldüğü, kök neden ve öğrenim bağlamını tutabilir; ilgili Bug, GitHub PR’ı, Proje Sürümü, Risk ve Karar kayıtlarına bağlanabilir.

- **Takip işi yalnız kullanıcının açık eylemiyle ve oluşacak kaynak ilişkileri önizlenerek oluşturulur.** Üretim Olayı canlı incident müdahalesi, pager veya Slack koordinasyonu, nöbet/owner yönetimi, downtime takibi, TTD/TTI/TTR hesabı ya da güvenilirlik trend dashboard’u oluşturmaz.
