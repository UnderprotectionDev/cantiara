# Kapsam Dışı Hükümler

Bu belge ilk üründe uygulanmayacak davranışların ve yanlış kapsam yorumlarını engelleyen negatif sınırların tek normatif sahibidir. Bir hükmün gelecek yönüne veya teslim kapsamına taşınması açık ürün kararı ve aynı değişiklikte güncellenmiş kabul bağlantıları gerektirir.

## Kapsam belgeleri arasındaki ilişki

- **Bir özelliğin kabul örneğinde, gelecek anlatısında veya başka dosyada anılması teslim kapsamını değiştirmez.** Kapsamın anlamı aşağıdaki belge sahiplikleriyle korunur:

| Belge alanı | Teslim anlamı |
| --- | --- |
| [Ürün amacı ve ilk ürün kapsamı](01-product-vision-and-scope.md), [domain modeli](02-domain-model-and-lifecycle.md), [hesap ve platform](03-account-platform-operations.md) ile ürün alanı belgeleri | İlk ürün tamamlanmadan önce eksiksiz uygulanması gereken davranışlar, kısıtlar ve güvenlik sınırları |
| [Ürün kabulü](16-product-acceptance.md) | İlk ürün kapsamının tamamlandığını gösterecek test yöntemleri ve kanıt paketi |
| [Ticari genişleme](17-commercial-expansion.md) | İlk ürün tamamlandıktan sonra yapılması kararlaştırılmış ayrı ürün alanı |
| [Gelecek yönleri](18-future-directions.md) | Yalnız yeni kanıt ve açık ürün kararıyla kapsama alınabilecek adaylar |
| Bu belgedeki hükümler | Mevcut ürün kapsamında uygulanmayacak davranışlar; kendiliğinden gelecek taahhüdüne dönüşmez |

- **Kapsam değişikliği ilgili ana sahip belgesini, kabul bağlantılarını ve gerekirse bu belgeyi aynı değişiklikte güncelleyen açık ürün kararıyla yapılır.** Burada kapsam dışında olmak kalıcı yasak anlamına gelmez; gelecekte değerlendirilen bir yön de yapılacağı anlamına gelmez.

## İlk üründe kapsam dışı

- **Bu liste kalıcı ürün yasağı değil, mevcut sürüm sınırıdır.** Uzman araçlarla rekabet, kurucu dogfooding’i veya sonraki ekip aşaması yeni kanıt ürettiğinde maddeler ayrı ürün kararlarıyla yeniden değerlendirilebilir.

### Ekip, yönetişim ve kurumsal planlama

- **Ekip daveti, roller, izin yönetimi ve çok kullanıcılı çalışma arayüzleri**
- **Gerçek zamanlı veya sürüm kontrollü ortak belge düzenleme**
- **Kurumsal Initiative/goal roll-up katmanı**
- **Projeler arasında ortak kimlikle izlenen kişisel çalışma alanı hedefi**
- **Cross-team resource planning, karmaşık bağımlılık grafikleri ve kritik yol planlaması**
- **Team sahipliği, triage nöbeti ve requester konuşması senkronizasyonu**
- **Takım kapasitesi, kişi performansı ve gelişmiş kurumsal raporlama**
- **İş schedule, availability, allocation, skill/role request ve staffing tabanlı kaynak planlaması; bunlar ancak sonraki ekip genişlemesinde yeniden değerlendirilir**

- **Temel veri modeli gelecekteki ekip genişlemesini engellemeyecek biçimde collaboration-ready kalır.**

- **Gerçek zamanlı ortak Proje Duvarı düzenleme şimdiden taahhüt edilmiş gelecek yönü değildir.** Küçük ekip doğrulamasında asenkron bağlantıyla sınırlı paylaşım, bağlama sabitlenmiş geri bildirim ve anlatımlı handoff mekaniklerinin yetersiz kaldığına; ortak yerleşim sahipliği ve eşzamanlı katkının tekrar eden zorunlu ihtiyaç olduğuna dair kanıt oluşursa izin, çakışma, imleç, audit ve geri alma modeliyle sıfırdan değerlendirilir.

### İş modeli ve üretkenlik

- **Kullanıcı tanımlı ek üst düzey içerik alanları**
- **Kullanıcı tanımlı keyfî kayıt türü/şema oluşturucu ve serbest ilişki türü tanımları**
- **Çalışma alanı genelindeki paylaşılan özel alan kimliği ve ortak özel alan şemaları**
- **Kullanıcı tanımlı Lookup ve Formula özel alanları**
- **Genel amaçlı spreadsheet hücreleri, hesaplama formülleri ve ikinci bir tablo doğruluk kaynağı**
- **İş Bağlam Kartında açık İşten desteklenen doğrudan ilişki, Kanıt Rolü ve durum filtresiyle kurulan proje/İş-türü düzenlerinin ötesinde Proje veya Çalışma Alanını bağımsız tarayan serbest sorgu, formül, grafik, metrik, keyfî veri kaynağı ve genel dashboard builder**
- **Proje Duvarına özgü görev/not kartları, senkronize not kopyaları, Map/konum kartları, iç içe duvarlar ve çalışma alanı `Home board`**
- **Ayrı fikir/Insight yaşam döngüsü, zorunlu Post–Idea çift kaydı, product discovery alanı, oylama ve puanlama matrisi**
- **Karar kayıtlarında ayrı yapılandırılmış alternatif seti, seçenek oylaması, puanlama veya otomatik kazanan**
- **Ayrı Theme nesnesi, AI ile otomatik tema etiketleme ve tema trend ürünü**
- **Contact/Company kimlik ve geri bildirim geçmişi çekirdeğinin ötesinde CRM katmanı, plan, abonelik, satış, sözleşme ve gelir alanlarıyla ticari değer puanlaması**
- **Portal/Autopilot geri bildirim hacmi, müşteri talebi, ticari değer veya tema trendi için gelişmiş feedback raporlama dashboard’ları**
- **Kullanıcı tanımlı veya proje bazlı Geri Bildirim yakalama formu/şablonu; ilk ürün hazır Hızlı Yakalama mini şablonlarıyla kalır**
- **Harici ürün kullanım analitiği dosyasını yapılandırılmış ölçüm Kaynağına alma, kalıcı analytics sağlayıcı bağlantısı, canlı event/cohort dashboard'u ve ölçümden otomatik sonuç ya da nedensellik hükmü çıkarma**
- **Sürümlü Anket Aracı, yapılandırılmış Yanıt Kümesi import'u, survey builder/dağıtım, branching, quota, respondent portalı ve yanıtlardan otomatik tema, Contact, İş veya öncelik üretme**
- **Kullanıcı Araştırması Oturumunda davet/no-show/teşvik/re-contact operasyon alanları, e-posta veya mesaj gönderimi, takvim daveti/senkronizasyonu, katılımcı recruitment ve otomatik takip**
- **Doğrusal geliştirme süreci ve onay kapıları**
- **Özellik türündeki işin bir seviye altında kapsadığı tam iş öğeleri ve metin/tamamlanma işaretli hafif kontrol listesi dışında alt işler, iç içe iş hiyerarşisi ve kontrol listesi maddelerine bağımsız durum, tarih, öncelik veya planlama yaşamı verme**
- **Evrensel Arama’daki görünür filtrelerle birebir sınırlı operatörlerin ötesinde serbest yazılabilir gelişmiş sorgu dili; Belge içi `Bul ve değiştir` yüzeyindeki açık ve güvenli regex modu bu yasağın dışındadır**
- **Zorunlu WIP limitleri**
- **Cycle-time ve throughput performans raporları**
- **Zorunlu Cycle kadansı, velocity/kapasite tahmini ve kullanıcı etkinleştirmeli olanlar dahil otomatik rollover kuralları**
- **İş veya Özellik üzerinde Hill Chart benzeri, elle ayrıca güncellenen nitel belirsizlik durumu**
- **Aktif projelerin son manuel sağlık işaretlerini tek Mission Control benzeri çalışma alanı modülünde toplama**
- **Projeye planlanan başlangıç tarihi ekleyen ve projeleri ortak başlangıç/bitiş şeridinde gösteren Lineup görünümü**
- **Gantt görünümü, otomatik yeniden zamanlama ve kritik yol hesabı**
- **Genel SLA sayaçları, yaklaşan ihlal/breach yaşam döngüsü ve SLA bildirimleri; dış müşteri yanıt taahhüdü gerçek ihtiyaç olarak doğrulanırsa hedef tarihten ayrı bir ürün kararıyla değerlendirilir**
- **Roadmap'i kaynak plan alanlarından bağımsız ikinci bir manuel üyelikle kürate etme ve Roadmap'i PNG/PDF/Gantt sunumu olarak dışa aktarma**
- **Planlama görünümüne eklemenin işi örtük biçimde durum değiştirmesi**
- **İş, kilometre taşı ve diğer ana kayıtlardan bağımsız saatli, tüm günlük, çok günlük veya yinelenen takvim Event kaydı**
- **Proje/Wiki kapsamından bağımsız otomatik tarihli ve düzenlenebilir Daily Notes; zaman bağlamını kopyasız `Bugün ne oldu?` görünümü sağlar**
- **Ana kaynakla ilişkisi olmayan standalone reminder ve tarihsiz `Save for Later` hatırlatma kuyruğu; geçici içerik Yakalama Gelen Kutusu'nda, kalıcı dikkat kaynak bağlantılı hatırlatma veya İşte kalır**
- **Saat bazlı zaman bloklama veya iç takvimde çalışma oturumu planlama**
- **Odak zamanlayıcısı, zaman takibi ve timesheet**
- **Otomatik değişiklik etki analizi ve etki uyarıları**
- **Duruma göre yapılandırılabilen zorunlu alanlar, genel `Eksik bağlam` geçiş uyarıları ve durum geçişlerini engelleyen kullanıcı tanımlı doğrulama/onay süreç kapıları; kapanış sonucu ve yayın hazırlığı gibi mevcut bağlama özel kontroller bu yasağın dışındadır**
- **Sabit 7/14/30 günlük değerlendirme adımları veya Proje Sürümünden bağımsız ayrı yapılandırılmış lansman sonrası etki değerlendirme ana kaydı; mevcut isteğe bağlı `Etkisini yeniden değerlendir`, Sürüme ait tarihli Erişim/Sonuç gözlemleri ve kaynak Proje Sürümüne bağlı `Yeniden bak` hatırlatması yeterlidir**
- **İçerik ve çalışma geçmişi üreten kapsamlı proje şablonları**
- **Klasör, üst belge, etiket, Akıllı Koleksiyon ve Favorilerden ayrı elle üyelikli Belge Koleksiyonu/Sub-Collection sistemi**
- **Kullanıcı tarafından yeniden eşlenebilen genel klavye kısayolu profili; ilk ürün sabit, görünür ve belgelenmiş kısayollar ile Komut Paleti kullanır**
- **Bütün proje içeriği ve geçmişi için günlük `Projeyi çoğalt` kısayolu veya desteklenen paralel Proje Fork'u**
- **Son kayıt, sekme, filtre, sıralama, scroll veya panel konumunu genel olarak kalıcı geri yükleyen recent-context özelliği; Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi ve Moodboard için tanımlanan dar kişisel viewport/zoom/collapse istisnası bu yasağın dışındadır**
- **Salt zaman geçmesine dayalı proje/belge staleness bildirimleri**

- **Görüşlü başlangıç yapılandırmaları içerik üretmediği için kapsamlı şablon yasağının dışındadır.** Hafif İçgörüler kişi veya takım performansı ölçmediği için gelişmiş raporlama sayılmaz.

- **Değer Zincirinin yalnız açık ilişkilerden türettiği kopukluklar ile Birleşik Bildirim Merkezinin alan PRD'lerinde tek tek tanımlanmış deterministik olayları otomatik değişiklik etki analizi veya sağlık hükmü değildir.** Kullanıcının onayladığı yeni Kaynak sürümünün eski kanıt kullanımında gösterilmesi de salt zaman geçmesine dayalı staleness bildirimi sayılmaz.

- **[`Herkese Açık Taahhüt Etki Görünümü`](18-future-directions.md#herkese-acik-taahhut-etki-gorunumu) bu yasağı ilk ürün için gevşetmez.** Adayın kapsamı ve doğrulama kapısı yalnız Gelecek Yönleri belgesinde yaşar.

- **Bu kategoride ilk ürün dışında kalan ve sınırları başka bir bölümde tanımlanan maddeler için [`Gelecekte değerlendirilecek ürün yönleri`](18-future-directions.md#gelecekte-değerlendirilecek-ürün-yönleri) altındaki [`Adlandırılmış Backlog bölümleri`](18-future-directions.md#adlandırılmış-backlog-bölümleri), [`Keyfî geçmiş tarihli plan baseline karşılaştırması`](18-future-directions.md#keyfî-geçmiş-tarihli-plan-baseline-karşılaştırması), [`Alternatif planlama senaryoları`](18-future-directions.md#alternatif-planlama-senaryoları) ve [`Proje Sürümü kontrol listesini önceki Proje Sürümünden kopyalama`](18-future-directions.md#proje-surumu-kontrol-listesini-onceki-surumden-kopyalama) başlıklarına bakılır.** Müşteri teklifi, Invoice ve birleşik proje sunumunun durumu ise yalnız [`İlk ürün sonrası kararlaştırılmış ticari genişleme`](17-commercial-expansion.md#ilk-urun-sonrasi-ticari-genisleme) bölümünde tanımlanır; bu başlıklar ilk ürün kapsamına girmez.
- **Ölçüm, anket ve hafif araştırma operasyonu adayları ilk ürün kapsamına girmez.** Ayrıntılı değerlendirme sırası ve ilk dar sınırlar yalnız [`Yapılandırılmış ölçüm Kaynağı`](18-future-directions.md#yapılandırılmış-ölçüm-kaynağı), [`Sürümlü Anket Aracı ve Yanıt Kümesi`](18-future-directions.md#sürümlü-anket-aracı-ve-yanıt-kümesi) ve [`Hafif araştırma katılımcısı operasyonları`](18-future-directions.md#hafif-araştırma-katılımcısı-operasyonları) gelecek yönlerinde tanımlanır; bu referans canlı analytics, survey yürütme veya dış iletişim taahhüdü oluşturmaz.

- **Bu bölümde ilk ürün dışında tutulan üretkenlik ve karar adaylarının kanıt kapıları [`Tek Sonuca Kilitlenen Çalışma Kipi`](18-future-directions.md#tek-sonuca-kilitlenen-çalışma-kipi), [`Kanıtlı Çapraz-Proje Öğrenme Hafızası`](18-future-directions.md#kanıtlı-çapraz-proje-öğrenme-hafızası), [`Kayıt Değil Soru Odaklı Proje İşletimi`](18-future-directions.md#kayıt-değil-soru-odaklı-proje-işletimi), [`Proje-Öncesi Fikir İnkübatörü`](18-future-directions.md#proje-öncesi-fikir-inkübatörü), [`Geri Döndürülebilirliğe Göre Karar Disiplini`](18-future-directions.md#geri-döndürülebilirliğe-göre-karar-disiplini), [`Önceden Taahhüt Edilmiş Devam/Bırakma Koşulları`](18-future-directions.md#önceden-taahhüt-edilmiş-devam-bırakma-koşulları) ve [`Canlı Projenin Operasyonel Yükümlülükleri`](18-future-directions.md#canlı-projenin-operasyonel-yükümlülükleri), [`Doğrulanabilir Yapım Hikâyesi ve Sürüm İletişim İskeleti`](18-future-directions.md#doğrulanabilir-yapım-hikâyesi), [`Bilinçli Dış Sınır Sözleşmesi ve Dış Ana Kaynak İşareti`](18-future-directions.md#bilinçli-dış-sınır-sözleşmesi), [`Yüzey Metni Envanteri`](18-future-directions.md#yüzey-metni-envanteri) ve [`Kullanıcıya Veri Teslimi`](18-future-directions.md#kullanıcıya-veri-teslimi) başlıklarında yaşar.** Bu adayların hiçbiri ilk ürün kapsamına girmez; ayrıntılı davranış ve eşikler bu belgede yeniden tanımlanmaz.

### AI, otomasyon ve programatik erişim

- **AI destekli proje asistanı**
- **GitHub repository veya branch’ini indeksleyerek kod tabanına dayalı spec taslağı üretme**
- **Repository veya codebase'i AI ile tarayıp Teknik Diyagramı, ERD'yi ya da kaynak gerçeğini otomatik güncelleme; deterministik ve allow-list'li olası Repository şeması yalnız ayrı gelecek yönünde değerlendirilebilir**
- **Linear Ajan/Loops benzeri kayıt değiştiren otonom ajanlar**
- **Coding Sessions veya AI ile kod yazma oturumları**
- **AI ile otomatik ilişki, karar, değişiklik etkisi veya ilerleme anlatısı çıkarma**
- **Kayıtları içerik benzerliğine göre kendiliğinden bağlayan genel auto-linking**
- **Destek konuşmaları, incelemeler veya başka dış kaynakları sürekli tarayarak otomatik geri bildirim/fikir adayı çıkarma**
- **Gerçekleşmiş olaylardan otomatik dönemsel veya Build in Public taslağı üretme**
- **Otomasyon çalıştırmalarını tek run altında tutan özel run günlüğü ve run bazlı toplu geri alma**
- **Kullanıcı davranışını izleyerek otomasyon veya kayıt eylemi önerme**
- **Kullanıcı tanımlı, tekrar kullanılabilir çok kayıtlı birleşik eylem düğmeleri**
- **Kullanıcı tanımlı JavaScript, serbest script veya harici istek çalıştıran otomasyon ve kayıt eylemleri**
- **Hazır `Bağlı gerekli PR'lar merge edildiğinde işi Tamamlandı say` kuralı dışındaki harici servis olaylarını kullanan genel otomasyon tetikleyicileri**
- **Dar ve tek yönlü yapılandırılmış test raporu girişi dışındaki CLI, MCP, genel API, webhook, Shortcuts ve diğer programatik erişim yüzeyleri**
- **URL parametreleriyle alanları önceden dolduran harici kayıt oluşturma formu; uygulama içi Hızlı Yakalama yeterlidir**

- **Genel CLI, MCP ve programatik erişim ilk üründe kapsam dışıdır.** Tek istisna, [test süreç ve sonuç yönetimine](10-testing-and-validation.md#rapor-ekleme-yolları) yalnız yeni yapılandırılmış test raporu ekleyen dar ve tek yönlü MCP girişidir. Gelecekteki erişim fazları yalnız [`Read-first programatik erişim yönünde`](18-future-directions.md#read-first-programatik-erişim-yönü), AI adayları ise yalnız [AI değerlendirme alanında](18-future-directions.md#ai-değerlendirme-alanı) tanımlanır.

- **Çok kayıtlı kontrollü öneri ilk üründe kapsam dışıdır.** Olası gelecek değerlendirmesi yalnız [`Bir Kez Söyle, Kontrollü Olarak Her Yere İşle`](18-future-directions.md#bir-kez-söyle-kontrollü-olarak-her-yere-işle) yönünde tanımlanır; bu referans ilk ürüne çok kayıtlı eylem, AI çıkarımı veya ajan yazma yetkisi eklemez.

- **İşteki Dış yürütme devri Coding Session, programatik erişim veya ajan kontrolü değildir.** Yalnız kullanıcının seçtiği kesin bağlamdan tarihsel bir gidiş paketi üretir ve kullanıcının elle getirdiği dönüşü uzlaştırır; harici aracı başlatmaz, sorgulamaz, izlemez, iptal etmez veya ürüne yazma yetkisi vermez.

- **Changelog ve herkese açık Roadmap embed/SDK yönleri programatik erişim kapsamını genişletmez; ilk ürün dışı durumları ve değerlendirme kapıları yalnız [`Ürün içine gömülebilen changelog`](18-future-directions.md#ürün-içine-gömülebilen-changelog) ile [`Ürün içine gömülebilen herkese açık Roadmap`](18-future-directions.md#ürün-içine-gömülebilen-herkese-açık-roadmap) gelecek yönlerinde tanımlanır.**

### Kod inceleme, doğrulama ve deployment

- **IDE veya kod düzenleme**
- **Branch oluşturma, commit yazma, pull request oluşturma/düzenleme veya başka Git/GitHub geliştirme mutasyonları**
- **Teknik Diyagram, DDL veya Migration Artefaktını repository dosyasına yazma, Git sync ile çift yönlü kanonik kaynak kurma ya da kullanıcı adına PR açma**
- **Çalışan veya ephemeral database'e bağlanma, credential saklama, schema introspection, DDL/migration çalıştırma, rollback yürütme veya runtime drift izleme**
- **Migration Artefaktına manuel ya da GitHub olayından türetilen `Uygulandı/Uygulanmadı` durumu verme; commit veya PR merge'ini database uygulanmışlığı sayma**
- **Veri migration'ı, backfill ve keyfî veri SQL'i üretme veya çalıştırma; deterministik ve veri kayıpsız ters kanıtı olmadan `Down` ya da güvenli rollback sunma**
- **Uygulama içinde diff görüntüleme, inline comment, approve/request changes ve merge**
- **Merge queue yönetimi**
- **Bağlı PR’ın salt okunur build/check özeti dışındaki bağımsız build/check kayıtlarını, tam check loglarını, deployment, feature flag ve vulnerability durumlarını geliştirme kaydı olarak içeri alma**
- **CI/CD pipeline kontrolü**
- **Uygulama içinden CI/CD, test komutu veya otomatik test runner, tarayıcı/cihaz otomasyonu, güvenlik tarayıcısı ya da deployment yürütme; dışarıda kullanıcı, AI ajanı veya harici araç tarafından yapılmış testlerin açık yapılandırılmış raporunu Test Oturumu olarak eklemek bu yasağın dışındadır**
- **PR cycle-time, deployment-frequency ve benzeri geliştirme performans metrikleri**
- **Yalnız zaman geçmesine dayanan `stuck PR` uyarıları**

- **GitHub kayıtları, PR Bağlam Kartı, Testler alanı, sürüm planlama ve yayın hazırlığı bu sınırlar içinde kapsamda kalır.** Testler alanı planlı senaryoları, dış yürütme Handoff'larını, manuel/AI ajanı/harici araç Test Oturumlarını, tekil bildirilen sonuçları, kanıtları, test açıklarını, takibi ve tarihsel değerlendirmeleri yönetir; harici test altyapısının yerini almaz ve testi kendisi çalıştırmaz.

### Platform ve entegrasyonlar

- **Çevrimdışı çalışma**
- **Tauri dışındaki native masaüstü runtime'ları, Windows/Linux masaüstü paketi ve bilgisayara kurulabilir PWA; ilk ürünün desteklenen native paketi yalnız macOS için Tauri'dir.** Windows Tauri yalnız kanıt oluşursa gelecek yönünde değerlendirilir
- **Genel fail-closed zararlı yazılım taraması ve dosya karantinası; ilk ürün tür/MIME, boyut, kota ve güvenli önizleme sınırlarıyla kalır.** Taranmamış ZIP'in bağlantıyla sınırlı veya herkese açık Dış yüzeye girmesi ise zorunlu güvenlik sözleşmesiyle fail-closed engellenir
- **Son kullanıcıya yönelik self-host dağıtımı ile kurulum/yükseltme/sağlık/log/yedekleme/geri yükleme operatör yüzeyleri; bunlar dağıtım sırasının son aşamasıdır**
- **Bilgisayarda canlı proje klasörü ve fiziksel Markdown doğruluk kaynağı**
- **VS Code, Obsidian veya harici editörlerle canlı belge senkronizasyonu**
- **Kimlik doğrulamalı mobil uygulama, mobil yardımcı ürün yüzeyi ve mobil hızlı yakalama; Dış yüzeylerin responsive salt okunur iOS Safari/Android Chrome ziyaretçi deneyimi bu yasağın dışındadır**
- **Harici takvim entegrasyonu ve takvim dosyası dışa aktarma**
- **Akıllı Koleksiyon veya filtre sonuçlarının periyodik e-posta özeti**
- **Belirli harici proje yönetimi araçlarına özel taşıma sihirbazları**
- **Nextcloud, OneDrive, SharePoint veya XWiki ile canlı, permission-aware dosya/bilgi sağlayıcısı entegrasyonu**
- **OpenAPI dosyasını sürümlü Kaynak olarak alma, okunabilir API referansı üretme ve yayımlama; canlı Git/URL senkronizasyonu, request playground'u, mock server, SDK üretimi ve ayrı developer portalı**
- **Macro-enabled Excel çift yönlü senkronizasyonu; ilk ürün kesin görünüm için CSV/PDF snapshot ve standart CSV/JSON içe aktarmayla kalır**
- **GitLab ve Bitbucket entegrasyonları; ilk ürünün tek geliştirme sağlayıcısı GitHub’dır**
- **Sentry entegrasyonu ve hata olaylarından otomatik Üretim Olayı oluşturma; kayıt manueldir ve kullanıcı ihtiyacı açıkça değişmedikçe Sentry öncelikli sonraki ürün yönü olarak yeniden açılmaz**
- **Draw.io, keyfî iframe/embed, çalıştırılabilir HTML ve AI belge blokları; açıkça tanımlanan tıklayınca yüklenen YouTube kartı bu genel embed yasağının tek ilk ürün istisnasıdır**
- **Vimeo ve diğer sağlayıcılar için interaktif oynatıcı, otomatik oynatma veya kullanıcı tarafından sağlanan çalıştırılabilir dış medya kodu**
- **Word belge dışa aktarımı**
- **Kesin görünüm dışa aktarımında XLS ve Atom biçimleri**
- **Power-Up/eklenti pazarı ve genel amaçlı üçüncü taraf genişletme ekosistemi**
- **Kullanıcı tanımlı custom app/runtime ve uygulama içine serbest kodla yeni yüzey ekleme**

- **Uygulama düzeyinde MFA ilk üründe kapsam dışıdır.** Dış kullanıma açılma tetikleyicisi, tehdit incelemesi ve olası zorunlu güvenlik kapsamı yalnız [`Uygulama düzeyinde MFA`](18-future-directions.md#uygulama-duzeyinde-mfa) gelecek yönünde tanımlanır.

- **E-posta, Slack, Siri veya benzeri uygulama dışı hızlı yakalama girişleri ve taahhütlü Slack connector'ı ilk üründe kapsam dışıdır.** Yeni bir kanal kendiliğinden taahhütlü aday sayılmaz; yalnız kanıt oluşursa [ortak dış kaynak girişi yönünde](18-future-directions.md#dış-kaynaklardan-geri-bildirim-adayı-çıkarma) sıfırdan değerlendirilir.

- **Bu kategorideki ayrıntılı ve kanıta bağlı gelecek adayları için [`Gelecekte değerlendirilecek ürün yönleri`](18-future-directions.md#gelecekte-değerlendirilecek-ürün-yönleri) altındaki [`Cihaz-yerel editör kurtarma tamponu`](18-future-directions.md#cihaz-yerel-editör-kurtarma-tamponu), [`DOCX belge göçü`](18-future-directions.md#docx-belge-göçü), [`Safari Web Clipper`](18-future-directions.md#safari-web-clipper) ve bilgi tabanı altındaki [`OpenAPI referans sayfası`](18-future-directions.md#openapi-referans-sayfası) başlıkları ana kaynaktır.** [Build in Public özel alan adı](18-future-directions.md#build-in-public-özel-alan-adı) paylaşım/herkese açık kategorisindeki gelecek yönü referansıyla izlenir. Bu adayların hiçbiri ilk ürün kapsamına girmez.

- **Genel araç-özel migration veya entegrasyon kataloğu ilk üründe kapsam dışıdır.** Bu sınırın gelecek adayları [`Tek Seferlik Gerçeklik Devir Teslimi`](18-future-directions.md#tek-seferlik-gerçeklik-devir-teslimi) ile [`Bilinçli Dış Sınır Sözleşmesi ve Dış Ana Kaynak İşareti`](18-future-directions.md#bilinçli-dış-sınır-sözleşmesi) başlıklarında tanımlanır.

### Paylaşım ve herkese açık etkileşim

- **Herkese açık yorum, oylama, cevap dizisi, changelog aboneliği ve gelişim akışı aboneliği**
- **Paylaşılan Proje Duvarı veya Moodboard üzerinde ziyaretçi yorumu, reaksiyonu, çizimi ya da düzenlenebilir kopya oluşturması**
- **İç içe paylaşım kapsamı, üst duvardan/klasörden izin kalıtımı ve ilişki üzerinden görünürlük genişlemesi**
- **Projeler arası ortak çalışma alanı Sürümü**
- **Proje logosu dışındaki favicon, herkese açık vurgu rengi, tema, özel CSS, font ve tam white-label özelleştirmeleri**
- **Herkese açık yüzeyler için ayrı custom social image, gelişmiş SEO schema/structured-data editörü, keyword yönetimi ve analytics**
- **Yapılandırılmış ölçüm veya anket kanıtını dışarı paylaşma; bu kanıt biçimleri ilk üründe bulunmaz ve ileride açılırsa ham yanıt, kişi kimliği ve gizli cohort bilgisi için ayrı kapalı dünya onayı gerekir**
- **FullStory, Hotjar veya benzeri oturum tekrarı sağlayıcısındaki session/zaman aralığını kanıt olarak bağlama, videoyu ya da event akışını ürüne kopyalama ve oturum tekrarı kanıtını herhangi bir Dış yüzeyde yayımlama**
- **Herkese açık projeyi statik site veya taşınabilir herkese açık içerik paketi olarak dışa aktarma**
- **Roadmap görünümünü PNG, PDF veya başka statik görsel plan çıktısı olarak dışa aktarma; iptal edilebilir canlı bağlantı ve onaylı herkese açık snapshot kullanılır.** Bu sınır, onaylanan seçili Proje Duvarı grubu/bölgesi ile Moodboard PNG/PDF çıktısını kapsamaz
- **Otomatik blog veya herkese açık ilerleme anlatısı üretme**
- **Herkese açık proje şablonu galerisi veya şablon pazarı**

- **Bu kategorideki ayrıntılı gelecek adaylarının ilk ürün dışı durumu yalnız [`Harici geri bildirim toplama yüzeyi`](18-future-directions.md#harici-geri-bildirim-toplama-yüzeyi), [`Proje Duvarı karşılama mesajı ve harici embed`](18-future-directions.md#proje-duvarı-karşılama-mesajı-ve-harici-embed), [`Kimlik doğrulamalı özel salt-okunur paylaşım`](18-future-directions.md#kimlik-doğrulamalı-özel-salt-okunur-paylaşım), [`Paylaşılan içerikte bağlama sabitlenmiş asenkron geri bildirim`](18-future-directions.md#paylaşılan-içerikte-bağlama-sabitlenmiş-asenkron-geri-bildirim), [`Zaman uyumlu anlatımlı görsel tur`](18-future-directions.md#zaman-uyumlu-anlatımlı-görsel-tur), [`Kesin zaman aralıklı ses/video kanıtı`](18-future-directions.md#kesin-zaman-aralıklı-sesvideo-kanıtı), [`Dış oturum tekrarı kanıtı`](18-future-directions.md#dış-oturum-tekrarı-kanıtı), [`Çok sayfalı yayımlanabilir bilgi tabanı`](18-future-directions.md#çok-sayfalı-yayımlanabilir-bilgi-tabanı), [`Ürün içine gömülebilen changelog`](18-future-directions.md#ürün-içine-gömülebilen-changelog), [`Ürün içine gömülebilen herkese açık Roadmap`](18-future-directions.md#ürün-içine-gömülebilen-herkese-açık-roadmap), [`Build in Public özel alan adı`](18-future-directions.md#build-in-public-özel-alan-adı), [`Herkese açık içerik çevirisi`](18-future-directions.md#herkese-açık-içerik-çevirisi) ve [`Zamanlanmış changelog yayını`](18-future-directions.md#zamanlanmış-changelog-yayını) başlıklarında tanımlanır.** Bu referans, herkese açık yorum/oylama, ölçüm/anket paylaşımı veya düzenlenebilir paylaşım gibi ayrıca kapsam dışı kalan davranışları geleceğe taahhüt etmez.

- **[`Doğrulanabilir Yapım Hikâyesi ve Sürüm İletişim İskeleti`](18-future-directions.md#doğrulanabilir-yapım-hikâyesi), [`Dış İncelemeyi Geri Getiren Paylaşım`](18-future-directions.md#dış-incelemeyi-geri-getiren-paylaşım) ve [`Ekip Kurmadan Sınırlı İnsan Delegasyonu`](18-future-directions.md#ekip-kurmadan-sınırlı-insan-delegasyonu) ilk üründe kapsam dışıdır.** Bu referans otomatik blog, herkese açık yorum, ekip üyeliği veya dış kullanıcının ana kayda yazması anlamına gelmez; ayrıntılı önkoşullar yalnız Gelecek Yönlerinde yaşar.

### Tasarım

- **Web'e özgü Visual Sitemap/Page ontolojisi, Main Tree, Header/Footer/Separate Page ve site crawler/XML sitemap modeli**
- **Proje Duvarı, Kullanıcı Akışı, Wireframe, Moodboard, Mermaid ve Teknik Diyagramı tek genel amaçlı sonsuz canvas/whiteboard veya tek evrensel dosya modelinde birleştirme**
- **Birinci sınıf Teknik Diyagram olarak BPMN, org chart, mind map, Gantt, git graph ve infographic kataloğu; generic flowchart Belge içi Mermaid'de kalır**
- **Teknik Mimari düğümlerini bağımsız servis kataloğu/CMDB ana kayıtlarına dönüştürme, keyfî şekil/ikon/renge ürün semantiği yükleme veya ayrı Teknik Diyagram Slides/deck sistemi**
- **Yapısal Teknik Diyagram modeliyle Mermaid/SQL/DBML/Git/dış araç dosyasını iki eş canlı kanonik kaynak olarak senkronize etme**
- **Draw.io, Visio, Eraser veya Koboyo native editable import'u; görselden ya da keyfî dosyadan AI ile Teknik Diyagram rekonstrüksiyonu**
- **İçerik, proje ilişkisi, geçmiş, dış bağlantı, DDL/migration veya Diyagram Sürümü taşıyan Teknik Diyagram şablonu ve herkese açık şablon pazarı**
- **Yüksek detaylı pixel-perfect görsel tasarım**
- **Production component ve tasarım token sistemi**
- **Proje Duvarında serbest çizim, sketch veya genel amaçlı whiteboard araçları; bu ihtiyaç Wireframe yüzeyinde kalır**
- **İçerik, örnek araştırma bulgusu veya çalışma geçmişi taşıyan Milanote benzeri Board şablonları**
- **Gerçek servislere bağlı prototipler**
- **Bağımsız prototip paketleri**
- **Geliştirici handoff ve CSS/spec üretimi**
- **Figma'ya veya başka yüksek detaylı tasarım aracına düzenlenebilir aktarım**
- **Aynı Ekran için ayrı desktop/mobile varyant yönetimi; gelecekte açılırsa aynı Ekran ana kaydı altında modellenir**

- **Moodboard içi görsel arama ile AI destekli Wireframe/Prototype taslağının ilk ürün dışı durumu ve olası değerlendirme kapıları yalnız `Moodboard içinde yerleşik görsel arama` ve `AI destekli Wireframe ve Prototype taslağı` gelecek yönlerinde tanımlanır.** Bu referans otomatik renk önerisi, production tasarım token'ı, yüksek detaylı tasarım veya kod üretimini kapsama almaz.

- **Teknik Diyagramın kanıta bağlı gelecek adayları [Repository şeması](18-future-directions.md#repository-semasi), [PostgreSQL DDL ve DBML import'u](18-future-directions.md#teknik-diyagram-ddl-dbml-importu), [AI Teknik Diyagram taslağı](18-future-directions.md#ai-teknik-diyagram-taslagi), [Teknik Diyagram şablonları](18-future-directions.md#teknik-diyagram-sablonlari), [ek SQL dialect'leri](18-future-directions.md#ek-sql-dialectleri) ve [inceleme/ortak düzenleme](18-future-directions.md#teknik-diyagram-inceleme-isbirligi) başlıklarında yaşar.** Bu referanslar ilk ürüne repository okuma, başka SQL dialect'i, AI, editable provider import'u, yorum veya ortak düzenleme eklemez.

### Yedekleme

- **Kullanıcıya sunulan otomatik yedek zaman çizelgesi**
- **Geçmiş restore-point’lerinden ayrı kurtarma projesi oluşturma**
- **Tam Wiki, Proje veya Çalışma Alanı yedeği ve geri yüklenebilir ürün paketi ilk üründe kapsam dışıdır.** İlk ürünün seçili kayıt taşınabilirliği [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md#kullanıcı-kontrollü-yedekleme-sınırı), olası tam paket yönü ise [`Tam ürün paketi ve geri yükleme doğrulaması`](18-future-directions.md#tam-ürün-paketi-ve-geri-yükleme-doğrulaması) altında tanımlanır.
