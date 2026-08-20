# Test ve Doğrulama

Bu belge ürün dışında yürütülen testlerin planlanması, handoff'u, güvenli rapor kabulü, sonuç yaşam döngüsü, inceleme ve tarihsel bütünlük davranışlarının tek normatif sahibidir. Ürün sürüm adayının test yöntemi ve kabul kanıtı [Ürün Kabulünde](16-product-acceptance.md) yaşar.

## Ürün sınırı ve yönetim amacı

- **`Testler`, test yürüten bir altyapı değil; ürün dışında yürütülen test çalışmalarının planını, handoff'unu, bildirilen sonuçlarını, kanıtlarını, incelemesini, takibini ve tarihsel değerlendirmesini yöneten proje alanıdır.**

- **Testleri kullanıcı; Codex, Claude Code veya benzeri bir AI ajanı; Conductor gibi bir orkestrasyon aracı; CI içinde çalışan Playwright gibi bir test aracı ya da başka bir harici yürütücüyle yapabilir.** Ürün bu araçları başlatmaz, zamanlamaz, sorgulamaz veya kontrol etmez; terminal komutu, test kodu, CI/CD pipeline'ı, tarayıcı/cihaz otomasyonu, güvenlik tarayıcısı, deployment ya da başka bir test runner çalıştırmaz.

Ana akış şudur:

- **`Planlı Test Senaryosu → Test Handoff'u → ürün dışında yürütme → Test Oturumu ve bildirilen sonuçlar → kullanıcı incelemesi → açık takip ve Test Açıkları → isteğe bağlı Test değerlendirmesi`**

- **Akış zorunlu ve doğrusal değildir.** Kullanıcı senaryo veya Handoff oluşturmadan ad hoc manuel sonuç kaydedebilir; dış araç doğrudan yapılandırılmış rapor teslim edebilir. Ürün sonuçları ortak bir dilde düzenler ancak kendi yaptığı doğrulama, nesnel doğruluk, coverage, kalite puanı, ürünün yayıma hazır olduğu hükmü veya yayın kapısı üretmez.

## Test süreç ve sonuç yönetimi

### Proje Testleri alanı

- **Her proje isteğe bağlı etkinleştirilebilen bir `Testler` alanı taşır.** Alan; `Planlı Test Senaryosu`, `Test Handoff'u`, `Test Oturumu`, `Oturum Testi`, `Test Açığı` ve `Test değerlendirmesi` kayıtlarını aynı yönetim bağlamında gösterir.

- **Varsayılan yüzey; `İncelenmemiş raporlar`, `Takip gereken sonuçlar`, `Açık ve planlanmış Test Açıkları`, `Çelişen veya yerine-geçme bekleyen sonuçlar`, `Bağlamı değişmiş sonuçlar`, `Aktif Handoff'lar`, `Son Test Oturumları` ve `Son Test değerlendirmeleri` bölümlerini sunar.** Bölümler aynı ana kayıtlardan ve görünür koşullardan canlı türetilir; ayrı dashboard verisi veya ikinci doğruluk kaynağı oluşturmaz.

- **Her sayı açıldığında onu oluşturan kesin kayıt kümesini ve filtreleri gösterir.** Örneğin `3 incelenmemiş rapor`, kullanıcıyı bu üç Test Oturumuna götürür; sayı kalite skoru veya test coverage oranı değildir.

- **Test kayıtları Özellik, diğer İşler, Birincil spec'in kesin sürüm veya bölümü, Risk, Karar, Proje Sürümü, repository, branch, commit ve PR ile ilişkilendirilebilir.** İlişki kurulması bağlı kaydın durumunu, önceliğini veya yayın uygunluğunu değiştirmez.

### Planlı Test Senaryosu ve sürümleri

- **`Planlı Test Senaryosu`, tekrar kullanılabilir test niyetini başlık, amaç, kapsam, önkoşul, beklenen davranış, isteğe bağlı notlar ve ilişkilerle taşıyan sürümlü proje kaydıdır.** Senaryo kendi başına test çalıştırmaz, canlı adım yürütme yüzeyi açmaz, sonuç taşımaz ve bağlı Özellik ya da Sürümü doğrulanmış saymaz.

- **Her anlamlı senaryo değişikliği yeni sürüm oluşturur.** Oturum Testi, uygulanmışsa kesin senaryo sürümüne bağlanır; başlık, kapsam veya beklenen davranış sonradan değiştiğinde geçmiş sonuç yeni tanımı doğrulamış gibi gösterilmez. Yalnız editoryal bir değişiklik de geçmiş bağı sessizce taşımaz; sürüm farkı açıklanabilir kalır.

- **Ad hoc Oturum Testi senaryoya bağlı olmak zorunda değildir.** Bu durumda test anındaki amaç ve beklenen davranış Oturum Testinde tarihsel olarak korunur. Ad hoc testin sonradan bir Planlı Test Senaryosuna bağlanması geçmiş içeriği yeniden yazmaz veya yeni senaryo sürümünü uygulanmış saymaz.

### Test Handoff'u

- **`Test Handoff'u`, yapılması istenen dış test çalışmasının hazırlığını ve sonucunun geri dönüşünü yöneten hafif, tarihsel proje kaydıdır.** Handoff; amaç ve kapsamı, seçilmiş kesin Planlı Test Senaryosu sürümlerini, isteğe bağlı hedef tarihi, hedef yürütücüyü, teknik bağlamı, oluşturulan paket sürümünü ve bağlı gelen Test Oturumlarını taşır.

- **Hedef yürütücü kullanıcı, Codex, Claude Code, Conductor veya serbestçe adlandırılan başka bir harici araç olabilir.** `Taslak`, `Paylaşıma hazır`, `Paylaşıldı`, `Sonuç alındı`, `Kapatıldı` veya `İptal edildi` durumu testin sonucunu değil, handoff sürecini anlatır. Ürün bağlı rapor geldiğinde `Sonuç alındı` durumunu önerebilir; Handoff'u otomatik kapatmaz.

- **Handoff'tan oluşturulan Markdown/JSON paketi yalnız kullanıcının seçtiği senaryo sürümlerini, güvenli teknik bağlamı ve kararlı Handoff/senaryo kimliklerini taşır.** Paket bir tarihsel snapshot'tır; kaynak senaryo değiştiğinde sessizce güncellenmez. Paketin kapalı içeriği [Test Handoff paketi sözleşmesinde](#test-handoff-paketi) tanımlanır. Aynı senaryolar farklı yürütücülere verilecekse süreç ve bağlamın karışmaması için ayrı Handoff'lar oluşturulur.

- **Handoff harici ajanı veya aracı başlatmaz; komut, zamanlama, tekrar çalıştırma, polling, iptal ya da teslim doğrulama yetkisi vermez.** Kullanıcı hedef tarih için normal kaynak bağlantılı hatırlatma davranışını kullanabilir.

<a id="test-handoff-paketi"></a>
### Test Handoff paketi sözleşmesi

- **Handoff paketi, tek bir `Test Handoff'u` kaydından üretilen ve dış yürütücüye verilen kapalı bağlam ihracıdır.** Paket yalnız aşağıdaki bölümleri taşır; tabloda bulunmayan kayıt türü, alan, özel not veya kullanıcının seçmediği kapsam pakete girmez.

| Paket bölümü | Zorunluluk ve içerik |
| --- | --- |
| `handoff_id` | Zorunlu kararlı Handoff kimliğidir; Handoff içindeki artan paket sürüm numarasıyla birlikte yazılır ve dönen raporda aynı değerle beklenir. |
| `project` | Zorunlu hedef proje kimliği ve görünen adıdır; raporun teslim edilebileceği tek proje kapsamını gösterir. |
| `title` ve `purpose` | Zorunlu Handoff başlığı ile kullanıcının yazdığı amaç ve kapsam metnidir. |
| `created_at` | Zorunlu RFC 3339 paket üretim zamanıdır ve saat dilimi/ofset taşır. |
| `product_build_context` | Kullanıcının Handoff'ta girdiği kesin ürün sürüm bağlamıdır: repository, branch, commit, build, hedef ortam adı veya güvenli URL alanlarından yalnız doldurulmuş olanları taşır. Ürün eksik değeri tahmin etmez, repository veya CI'dan okumaz. |
| `scenarios[]` | Seçilen her `Planlı Test Senaryosu` için `scenario_id` ve `scenario_version` birlikte bulunur; o sürümün başlığı, amacı, kapsamı, önkoşulu, beklenen davranışı ve notları pakete kopyalanır. Kapsam hiçbir bölümde yalnız başlıkla ifade edilmez. |
| `ad_hoc_scope[]` | Senaryoya bağlanmayan istek için kullanıcının açıkça yazdığı niyet ve beklenen davranıştır. Ürün bu metinden senaryo, sürüm veya kimlik üretmez. |
| `work_context[]` | Kullanıcının seçtiği bağlı `İş` ve `Özellik` kayıtlarının kararlı kimlikleri ile başlıklarıdır. |
| `document_context[]` | Seçilen belge ve spec bağlarının kesin sürüm ya da bölüm referanslarıdır; `en güncel sürüm` gibi çözümlenmemiş işaret kullanılmaz. |
| `environment_preconditions` | Kullanıcının yazdığı ortam, erişim ve hazırlık önkoşullarıdır. Ürün ortam hazırlamaz, hesap açmaz, fixture veya test verisi üretmez. |
| `design_references[]` | Kullanıcı eklediyse kesin `Ekran`, `Wireframe` veya Teknik Diyagram sürümlerinin kimlik ve sürüm referanslarıdır. |
| `return_instructions` | Zorunlu dönüş yönergesidir: dış tarafın en az `schema_version`, `project_id`, `external_session_id`, `executor`, `reported_at`, bu paketin `handoff_id` değerini ve her sonuç için `external_test_id` ile uygulanmışsa `scenario_id`/`scenario_version` göndermesi gerektiğini, `context`, `summary`, `raw_report`, `notes`, `evidence` ve `relations` alanlarının isteğe bağlı olduğunu ve tek kabul edilen yapılandırılmış dönüş yolunun [`test-report/1` rapor zarfı](#sürümlü-rapor-zarfı) olduğunu belirtir. |

- **Markdown biçimi paketin insan tarafından okunabilir gösterimi, JSON biçimi makine tarafından okunabilir gösterimidir.** İki biçim de aynı Handoff kaydından ve aynı paket sürümünden üretilir, aynı kapsamı taşır; hiçbiri diğerinde bulunmayan senaryo, sürüm, ilişki veya bağlam eklemez.

- **Paket üretildiği andaki dışa aktarmadır ve kendini yenilemez.** Kaynak senaryo, belge, `Ekran`, `Wireframe` veya diyagram sürümü sonradan değişirse dışarıdaki kopya güncellenmez; kullanıcı yeni paket sürümü üretir ya da yeni Handoff açar. Dış taraftaki paket ürün içindeki güncel gerçeğin doğruluk kaynağı sayılmaz.

- **Paket secret, erişim tokenı, credential ve seçilen kapsam dışındaki özel içeriği taşımaz.** Kullanıcının erişemediği kayıt, seçilmeyen ilişkili kayıt, redakte edilmiş değer ve ayrıca onaylanmamış Dosya Eki pakete girmez; paketin dışarı verilmesi ortak kapalı-dünya önizleme ve onay davranışına uyar.

- **Paketin üretilmesi veya dışarı verilmesi hiçbir harici aracı başlatmaz, sorgulamaz, izlemez ya da yetkilendirmez ve dış tarafa ürüne yazma yetkisi vermez.** Tek dönüş yolu kullanıcının veya dış tarafın açıkça yaptığı rapor teslimidir; paket kimliğinin bilinmesi teslim, okuma ya da değiştirme yetkisi üretmez.

- **Test Handoff paketi [İşteki dış yürütme devrinin gidiş paketinden](06-work-management-and-planning.md#dış-yürütme-devirleri) ayrı sözleşmedir.** Formel test kapsamı, kesin senaryo sürümleri ve yapılandırılmış sonuç dönüşü yalnız bu pakette yaşar; kodlama devrinin paketi test kapsamı tanımlamaz ve Test Oturumu üretmez.

### Test Oturumu ve kaynak ayrımı

- **`Test Oturumu`, aynı dış çalışma bağlamında yürütüldüğü bildirilen testleri ve tarihsel özeti taşıyan proje kaydıdır.** Bir oturum uygulama içindeki manuel girişten, yapılandırılmış Markdown/JSON içe aktarmasından veya dar MCP rapor tesliminden oluşabilir.

Kaynağın ne olduğu ile kaydın ürüne nasıl geldiği ayrı tutulur:

- **`Yürüten türü`:** `Kullanıcı`, `AI ajanı` veya `Harici araç`
- **`Yürüten`:** kullanıcı kimliği ya da Codex, Claude Code, Playwright CI gibi araç adı ve varsa sürümü
- **`Raporlayan`:** raporu teslim eden kullanıcı veya entegrasyon kimliği
- **`Giriş yolu`:** `Uygulama`, `Dosya içe aktarma` veya `MCP`

- **Böylece Conductor içindeki Codex'in yaptığı fakat kullanıcının JSON olarak içe aktardığı test, `Yürüten: Codex`, `Giriş yolu: Dosya içe aktarma`, `Raporlayan: kullanıcı` olarak görünür.** Kaynak veya giriş yolu güven, doğruluk ya da önem puanı üretmez.

- **Oturum; başlık, genel özet, başlangıç/bitiş ve rapor zamanı, bağlı Handoff, ilişkiler, ham rapor veya güvenli dış referans ve alt Oturum Testlerini taşıyabilir.** Repository, branch, commit, build, hedef ortam adı veya güvenli URL, işletim sistemi, cihaz, tarayıcı ve sürümleri, hassas olmayan test verisi/fixture tanımlayıcısı isteğe bağlı yapılandırılmış bağlamdır. Eksik değerler tahmin edilmez ve raporun kabulünü tek başına engellemez.

- **Bu bağlam ayrı `Test Ortamı` veya `Test Verisi Profili` ana kayıtları oluşturmaz.** Ürün ortam hazırlamaz, fixture çalıştırmaz, hesap oluşturmaz, production verisi ya da secret saklamaz.

- **Yeni Test Oturumu `İncelenmedi` inceleme durumuyla başlar.** Kullanıcı oturumu veya tekil sonuçları `İncelendi`, `Takip gerekli` ya da `Kapatıldı` durumuna alabilir. İnceleme durumu kullanıcının yönetim kararını anlatır; bildirilen test sonucunu değiştirmez. Uygulama içinde kullanıcının elle oluşturduğu oturum da aynı durum modeline katılır.

- **Test Oturumu bildirilen tarihsel gerçektir; normalize `Geçti` sonucu veya kullanıcı incelemesi tek başına Ürün kabul kanıtı değildir.** Test değerlendirmesi eksik kanıtı üretemez veya Test Oturumunu geriye dönük doğrulanmış kanıta çeviremez; kabul edilebilir kanıt kökeni ve yeterliliği yalnız [Ürün sürüm adayı kanıtı](16-product-acceptance.md#urun-surum-adayi-kaniti) sözleşmesinde tanımlanır.

### Oturum Testi ve iki katmanlı sonuç

- **`Oturum Testi`, bir Test Oturumu içinde bağımsız olarak denendiği bildirilen davranışı taşır.** Kayıt; neyin denendiğini, yürütücünün ne yaptığını, ham sonucu, normalize edilmiş sonucu, notları, kesin Planlı Test Senaryosu sürümünü, varsa Handoff'u, bildirilen kanıtları ve ilgili proje kayıtlarını içerir.

Sonuç iki katmanda korunur:

- **`Bildirilen ham sonuç`, dış aracın veya kullanıcının ifadesini geriye dönük yeniden yazmadan saklar.**
- **`Normalize edilmiş sonuç`, `Geçti`, `Kaldı`, `Bloke`, `Atlandı`, `Sonuçsuz` veya `Bildirilmedi` değerlerinden biridir.**

- **Yapılandırılmış giriş açık bir sonuç sağlıyorsa desteklenen değere eşlenir.** `Checkout flow looks good` gibi neyin doğrulandığını veya sonucun kesinliğini açıklamayan ifade güvenle `Geçti`ye çevrilmez; `Sonuçsuz` alınır. Manuel girişte normalize sonucu kullanıcı seçer. Bu sınıflandırma yalnız bildirimin ortak sunum dilidir; `ürün tarafından doğrulandı` anlamına gelmez.

- **Aynı senaryonun farklı commit, build, ortam veya cihazdaki sonuçları birbirini otomatik ezmez.** En yeni tarih tek başına güncel doğrulama hükmü üretmez.

### Bildirilen kanıt

- **Test Oturumu veya Oturum Testi; yüklenen desteklenen Dosya Eki/ekran görüntüsü, güvenli dış bağlantı, kısa metin veya log alıntısı, ham rapor içindeki kesin bölüm referansı ve commit/PR/build referansı taşıyabilir.** Her kanıt türü, kaynağı, ekleyen veya raporlayan tarafı ve zamanı gösterir.

- **Kanıtın bulunması sonucun doğru olduğunu kanıtlayan bir güven puanına dönüşmez.** Dış bağlantı ürün tarafından otomatik indirilip kalıcı doğrulanmış kanıt sayılmaz; erişilemez olduğunda tarihsel referans korunur ve içerik mevcutmuş gibi sunulmaz.

- **Kanıtlar normal dosya güvenliği, erişim, paylaşım ve dışa aktarma kurallarına uyar.** İlişkili kayıt paylaşılmış olsa bile kanıt örtük görünür olmaz; her dosya, ham rapor, alıntı ve dış referans kapalı-dünya önizlemesinde ayrıca onaylanır.

### Test Açığı

- **`Test Açığı`, kullanıcının henüz denenmediğini veya yetersiz doğrulandığını düşündüğü alanı başlık, gerekçe ve Özellik/İş/spec bölümü/Risk/Proje Sürümü gibi dayanak ilişkileriyle koruyan hafif proje kaydıdır.** Sistem; eksik senaryo ilişkisi, başarısız test, yürütücü notu, spec değişikliği, GitHub check sonucu veya anlamsal benzerlikten otomatik Test Açığı oluşturmaz.

- **Test Açığı `Açık`, `Planlandı`, `Sonuçla karşılandı` veya `Gerekli değil` durumunu taşır.** Bir Planlı Test Senaryosuna ya da Handoff'a bağlanmak açığı en fazla `Planlandı` yapar; yeni sonucun gelmesi açığı otomatik kapatmaz. `Sonuçla karşılandı` seçiminde kullanıcı açığı karşılayan kesin Oturum Testlerini ve isteğe bağlı gerekçeyi seçer. `Gerekli değil` kapanışı gerekçeyi ve varsa ilgili Kararı korur.

- **Test Açığı başarısız test, Bug, İş, zorunlu kapsam veya Ürün sürüm adayını kendiliğinden bloklayan durum değildir.** Kapanış kaynak açığı silmez; kesin ilişkileri ve kullanıcı kararını geçmişte tutar.

### Test değerlendirmesi

- **`Test değerlendirmesi`, kullanıcının belirli bir Özellik, Handoff veya Proje Sürümü bağlamındaki test kayıtlarını belirli bir anda nasıl yorumladığını koruyan isteğe bağlı tarihsel snapshot'tır.** Değerlendirme; incelenen kesin Test Oturumlarını, açık Test Açıklarını, takip işlerini, bilinen sınırlamaları, değerlendiren kullanıcıyı, zamanı ve `Kabul edilebilir`, `Takip gerekli` veya `Karar verilmedi` kararını taşır.

- **Değerlendirme kalite skoru, otomatik readiness hükmü, test istisnası veya yayın kapısı değildir.** Kullanıcı değerlendirme oluşturmadan Sürümü yayımlayabilir. Değerlendirmeden sonra yeni veya düzeltilmiş sonuç, yeni Test Açığı ya da ilgili bağlam değişikliği oluşursa snapshot yeniden yazılmaz; ürün `Bu değerlendirmeden sonra yeni test bağlamı oluştu` dikkat sinyalini ve kesin kaynakları gösterir.

## Rapor ekleme yolları

Test sonucu üç yoldan eklenebilir:

1. **Kullanıcı uygulama formunda, ürün dışında yaptığı bir veya birden fazla manuel testi Test Oturumu olarak kaydeder.**
2. **Kullanıcı ya da harici araç yapılandırılmış Markdown/JSON raporunu içe aktarır.**
3. **Yetkili harici araç dar ve tek yönlü MCP girişine yeni yapılandırılmış test raporu teslim eder.**

- **Üç yol aynı Test Oturumu ve Oturum Testi modelini oluşturur.** Kaynağa özel paralel kayıt türü yaratılmaz. İçe aktarılan veya MCP ile gelen oturum, zorunlu kabul kuyruğunda beklemeden değiştirilemez tarihsel bildirim olarak kaydedilir ve `İncelenmedi` durumuyla yönetim yüzeyine girer. Bu canlı görünüm ayrı bir onay doğruluk kaynağı değildir.

- **Dar MCP girişi genel MCP/API veya otonom ajan yazma yetkisi değildir.** Yalnız yeni Test Oturumu raporu ekleyebilir; kayıt, senaryo, spec, belge veya proje içeriği okuyamaz; mevcut kaydı, inceleme durumunu veya ilişkiyi değiştiremez; başka kayıt türü oluşturamaz ve ürün içinde komut ya da test başlatamaz. Harici araca verilecek bağlam yalnız kullanıcının açıkça oluşturduğu Handoff paketinden gelir.

### Güvenli, atomik ve idempotent kabul

- **MCP veya yapılandırılmış içe aktarma payload'ı biçim, hedef proje, alanlar, kimlikler, ilişki kapsamı, boyut, Dosya Eki ve secret/hassas veri bakımından uygulanmadan önce doğrulanır.**
- **Oturum ve bütün alt Oturum Testleri atomik kaydedilir:** tamamı kabul edilir ya da hiçbir ana kayıt oluşmaz. Geçersiz alan veya testlerin kesin konumu ve reddedilme nedeni çağıran tarafa ya da içe aktarma önizlemesine döner.
- **Harici rapor `hedef proje + kaynak/yürüten + dış oturum kimliği` ile idempotent kabul edilir.** Aynı kimlik ve aynı içerik tekrar gelirse yeni kayıt veya bildirim oluşturulmaz; önceki başarılı kabul bilgisi döner.
- **Aynı dış kimlikle farklı içerik gelirse mevcut tarihsel rapor sessizce güncellenmez ve kopya oturum oluşturulmaz; kimlik–içerik çakışması reddedilir ve yeni dış oturum kimliği istenir.**
- **Başarılı kabul; kaynak/yürüten, raporlayan, giriş yolu, dış kimlik, rapor zamanı ve içerik parmak izini denetlenebilir üstveri olarak saklar.**

- **Secret taraması kesin bilinen veya yüksek güvenli sağlayıcı token kalıbı bulursa bütün raporu `sensitive_data_detected` ile reddeder; yalnız maskelenmiş alan yolu döner ve ürün kanıtı sessizce düzenlemez.** Belirsiz bulgu dosya veya manuel girişte içeriği göstermeyen maskeli inceleme ister; kullanıcı hassas değeri kaynaktan çıkarıp yeniden gönderir. Gözetimsiz MCP tesliminde belirsiz bulgu da reddedilir ve sanitize edilmiş yeni teslim gerekir.

- **MCP veya dosya içe aktarmasıyla oluşan her yeni Test Oturumu Birleşik Bildirim Merkezinde tek `İncelenmemiş test raporu` sinyali oluşturur.** Alt Oturum Testleri ayrı ayrı bildirim üretmez. Uygulama içinde elle oluşturulan oturum ek bildirim üretmeden Testler alanında `İncelenmedi` olarak görünür. İdempotent tekrar teslim yeni sinyal oluşturmaz.

### Sürümlü rapor zarfı

- **Markdown içe aktarması, JSON içe aktarması ve MCP teslimi ayrıştırıldıktan sonra aynı kanonik rapor zarfına doğrulanır.** Uygulamadaki manuel giriş de kaydedilirken aynı iç modele dönüştürülür; kaynağa göre farklı sonuç semantiği oluşmaz.

- **İlk sözleşmenin açık sürümü `test-report/1`dir.** MCP ve yapılandırılmış dosya teslimi `schema_version` alanını taşımak zorundadır; manuel form desteklenen güncel sürümü kendisi yazar. Desteklenmeyen sürüm sessizce yükseltilmez, alanları tahmin edilmez ve hiçbir kayıt oluşturmadan reddedilir. Yeni sözleşme sürümü açıldığında desteklenen sürümler, geçiş süresi ve kayıpsız dönüşüm kuralları ayrıca yayımlanır; geçmiş rapor alındığı sözleşme sürümünü korur.

| Rapor alanı | Zorunluluk ve davranış |
| --- | --- |
| `schema_version` | MCP ve yapılandırılmış içe aktarmada zorunludur; ilk değer `test-report/1`dir. |
| `project_id` | MCP ve yapılandırılmış içe aktarmada zorunludur; yetkili entegrasyon kapsamındaki tam bir projeyi hedeflemelidir. Proje adıyla tahminî eşleme yapılmaz. |
| `external_session_id` | MCP ve yapılandırılmış içe aktarmada zorunludur; yürüten/kaynak kapsamındaki idempotency anahtarıdır. Manuel formda ürün iç kimliği üretir. |
| `executor` | Zorunludur; `type`, görünen `name` ve varsa `version` taşır. `type`, `user`, `ai_agent` veya `external_tool` değerlerinden biridir. |
| `reported_at` | Zorunlu RFC 3339 rapor zamanıdır ve saat dilimi/ofset taşır. `started_at` ve `ended_at` isteğe bağlıdır; ofsetsiz veya sırası geçersiz zaman raporu reddeder. |
| `handoff_id` | İsteğe bağlı kesin Test Handoff'u kimliğidir. Payload içinde Handoff başlığıyla veya benzerlikle eşleme yapılmaz. |
| `context` | Repository, branch, commit, build, ortam, işletim sistemi, cihaz, tarayıcı, araç ve hassas olmayan fixture tanımlayıcılarını taşıyan isteğe bağlı nesnedir. |
| `summary` ve `raw_report` | İsteğe bağlı tarihsel özet ve ham rapordur. Ham rapor yapılandırılmış testlerin yerine geçmez ve kabul limitleri ile hassas veri kontrolüne tabidir. |
| `tests` | En az bir Oturum Testi adayı taşır. Boş rapor Test Oturumu oluşturmaz. |

- **Her `tests` öğesi en az `external_test_id` ile başlık/denenen davranışı taşır.** `external_test_id` aynı dış oturum içinde benzersizdir. Manuel form iç kimliği üretir. `raw_result` isteğe bağlı ham ifadeyi; `normalized_result` varsa yalnız desteklenen ortak değeri; `notes`, `evidence` ve proje ilişkileri isteğe bağlı bağlamı taşır.

- **Dış kimlikler boş olmayan, kabul limitleri içindeki case-sensitive opaque string'lerdir; ürün bunları kırpmaz, büyük/küçük harf dönüştürmez veya başlıktan yeniden üretmez.** Görünen adlar kimlik değildir. Zamanlar karşılaştırma için UTC'ye normalize edilebilir ancak özgün ofset rapor üstverisinda korunur.

- **`evidence` öğesi yalnız `attachment_ref`, `external_url`, `text_excerpt`, `raw_report_ref` veya `code_ref` türlerinden birini kullanır ve türüne uygun kesin değer ile isteğe bağlı güvenli etiketi taşır.** `attachment_ref`, kullanıcının içe aktarma önizlemesinde seçtiği dosyayı ya da aynı projedeki erişilebilir mevcut Dosya Eki kimliğini gösterebilir. Dar MCP binary dosya veya yeni bağımsız Dosya Eki yükleyemez; base64/blob içeren kanıtı `attachment_rejected` ile reddeder. `relations` öğesi yalnız [ilişki allow-list'indeki](#rapor-iliski-allow-listesi) kayıt türü, tam iç kimlik ve desteklenen ilişki rolünü taşır; serbest tür veya başlığa dayalı hedef kabul etmez.

- **JSON teslimi doğrudan bu zarfı kullanır.** Markdown tesliminde aynı yapı YAML frontmatter içinde bulunur; frontmatter sonrasındaki gövde isteğe bağlı `raw_report` olarak alınır. Başlık yapısından, tablo metninden veya doğal dildeki bölüm adlarından alan tahmin edilmez. Binary kanıt base64 ile zarf içine gömülmez; normal Dosya Eki kabul yoluyla yüklenip güvenli kimliğiyle referans verilir.

- **Markdown frontmatter tam olarak bir YAML 1.2 belgesi olarak ayrıştırılır.** Alias, merge key, custom tag, birden fazla YAML belgesi, yinelenen alan ve izin verilen rapor limitini aşan yapı hiçbir kayıt oluşturmadan reddedilir. Ayrıştırılan değer aynı Zod `test-report/1` şemasına doğrulanır; parser'ın örtük tür dönüşümü rapor sözleşmesindeki alan türlerini genişletemez.

```json
{
  "schema_version": "test-report/1",
  "project_id": "project_123",
  "external_session_id": "codex-checkout-2026-08-06-01",
  "executor": {
    "type": "ai_agent",
    "name": "Codex",
    "version": "example-version"
  },
  "reported_at": "2026-08-06T12:30:00Z",
  "handoff_id": "handoff_456",
  "context": {
    "repository": "example/repository",
    "branch": "feature/coupons",
    "commit": "abc123",
    "build": "842"
  },
  "tests": [
    {
      "external_test_id": "coupon-single-use",
      "title": "Coupon can be used only once",
      "scenario_id": "scenario_789",
      "scenario_version": 3,
      "raw_result": "passed",
      "normalized_result": "passed"
    }
  ]
}
```

- **Planlı senaryo bağı verilecekse `scenario_id` ve `scenario_version` birlikte bulunmalıdır.** Yalnız kimlik, yalnız sürüm veya başlığa dayalı eşleme kabul edilmez. Handoff ve senaryo birlikte veriliyorsa kesin senaryo sürümü Handoff paketinde bulunmalıdır; aksi hâlde bağ sessizce kaldırılmaz ve bütün rapor `reference_scope_mismatch` ile reddedilir. Handoff veya senaryo bağı bulunmayan geçerli test ad hoc Oturum Testi olarak kabul edilebilir.

- **Kimliği doğru fakat `İptal edildi` durumundaki Handoff'a geç gelen rapor tarihsel gerçek olarak bağlanabilir; Handoff yeniden açılmaz ve durumu değişmez, `İptalden sonra sonuç geldi` dikkat sinyali gösterilir.** Arşivlenmiş senaryonun mevcut kesin sürümüne referans kabul edilebilir; kalıcı silinmiş, başka projedeki veya erişilemeyen hedef reddedilir.

- **Kimliği bilinmeyen, yanlış projeye ait veya payload'daki başka referanslarla çelişen Handoff, senaryo, Özellik, İş, Test Açığı, Proje Sürümü, repository, branch, commit ya da PR referansı bütün raporu atomik olarak reddeder.** Ürün geçersiz ilişkiyi düşürüp kalan raporu sessizce kabul etmez.

<a id="rapor-iliski-allow-listesi"></a>
### İlişki allow-list'i

- **Harici teslim edilen raporun `relations` öğeleri yalnız aşağıdaki kayıt türlerini hedefleyebilir.** Liste kapalıdır ve bir test raporunun meşru olarak işaret etmesi gereken en dar kümeyi taşır: denenen planlı niyet, dönüşü beklenen dış test devri, davranışın ait olduğu çalışma kapsamı ve sonucun ilgilendirdiği test takibi.

| İzinli hedef türü | Kabul koşulu ve gerekçe |
| --- | --- |
| `Planlı Test Senaryosu` | `scenario_id` ve `scenario_version` birlikte verilir; raporun hangi planlı test niyetinin kesin sürümünü denediğini gösterir. |
| `Test Handoff'u` | Tam Handoff kimliği verilir; raporun hangi dış test devrinin dönüşü olduğunu gösterir ve Handoff sürecini ilerletmez. |
| `İş` | Denenen davranışın bağlı olduğu çalışma kapsamını gösterir. |
| `Özellik` | Sonucun ilgilendirdiği ürün yeteneğini gösterir. |
| `Test Açığı` | Raporun karşıladığı iddia edilen açığı işaret eder; açığı `Sonuçla karşılandı` durumuna almaz. |
| `Proje Sürümü` | Testin hangi sürüm kapsamında bildirildiğini gösterir; sürümün yayın uygunluğuna karışmaz. |

- **Karar, Risk, Açık Soru, Belge ve spec kayıtları, Kişisel Wiki içeriği, Contact/Company, Geri Bildirim, paylaşım ve Dış yüzey kayıtları, otomasyon kuralları, entegrasyon kimlikleri ile Hesap/Çalışma Alanı yapılandırması allow-list dışındadır.** Harici teslim bu türlere ilişki kuramaz; onlara bağ kurmak yalnız kullanıcının uygulama içindeki açık eylemidir. Repository, branch, commit, build ve PR bağlamı ilişki hedefi değil `context` alanıdır.

- **Geçersiz `relations` öğesi düşürülüp raporun kalanı kabul edilmez; oturum bütün alt testleriyle birlikte atomik reddedilir ve cevap kesin alan yolunu gösterir.** Yeni bir hata stili açılmaz; [kanonik cevap sözleşmesindeki](#kanonik-kimlik-parmak-izi-ve-cevap-sözleşmesi) kararlı kodlar kullanılır:

| Geçersiz `relations` durumu | Kararlı hata kodu |
| --- | --- |
| Allow-list dışındaki kayıt türü veya desteklenmeyen ilişki rolü | `unsupported_field` |
| Hedef projenin kapsamı dışındaki ya da payload'daki diğer referanslarla çelişen kayıt | `reference_scope_mismatch` |
| Var olmayan, kalıcı silinmiş veya erişilemeyen kayıt | `reference_not_found` |
| Eksik `scenario_version`, başlığa dayalı hedef veya biçimi geçersiz iç kimlik | `invalid_field` |

- **Kabul edilen ilişki hedef kaydı oluşturmaz, durumunu, önceliğini veya yaşam döngüsünü değiştirmez ve teslim eden entegrasyonun erişimini genişletmez.** Entegrasyon ilişki üzerinden hedefin içeriğini, adını, sayısını ya da varlığını öğrenmez; başarılı teslim yalnız makbuz döner.

### Sonuç normalizasyon sözleşmesi

- **Normalizasyon yalnız bildirilen sonucu ortak görünümde sınıflandırır.** Komut çıkış kodu, log metni, ekran görüntüsü, test başlığı, Handoff durumu veya oturum özeti tek başına sonuç üretmez. Bir oturumdaki karışık alt sonuçlardan genel oturum `Geçti/Kaldı` hükmü hesaplanmaz.

| Açık bildirilen anlam | Wire değeri | Kullanıcı etiketi |
| --- | --- | --- |
| `passed`, `success`, `ok` gibi testin beklentiyi karşıladığını açıkça söyleyen desteklenen değer | `passed` | `Geçti` |
| `failed`, assertion hatası veya beklenen davranışın karşılanmadığını açıkça söyleyen desteklenen değer | `failed` | `Kaldı` |
| Eksik önkoşul, ortam, erişim veya bağımlılık nedeniyle testin tamamlanamadığını açıkça söyleyen değer | `blocked` | `Bloke` |
| Yürütücü tarafından bilinçli olarak çalıştırılmadığı, atlandığı, yok sayıldığı veya uygulanamaz sayıldığı açıkça bildirilen değer | `skipped` | `Atlandı` |
| `flaky`, `unknown`, `inconclusive`, karışık veya güvenli biçimde sınıflandırılamayan serbest ifade | `inconclusive` | `Sonuçsuz` |
| Hiç sonuç bildirilmemesi | `not_reported` | `Bildirilmedi` |

- **Payload `normalized_result` alanında yalnız tablodaki wire değerlerinden birini taşıyabilir.** Ürün bu bildirimi kullanıcı etiketine eşleyerek korur; ham sonuçla açıkça çelişiyorsa raporu sessizce düzeltmek yerine `result_conflict` ile reddeder. Yalnız ham ifade varsa deterministik ve belgelenmiş eşleme uygulanır; eşleme kesin değilse `inconclusive / Sonuçsuz` seçilir. Manuel girişte kullanıcı etiketi seçer, ürün karşılık gelen wire değerini kaydeder.

### Kanonik kimlik, parmak izi ve cevap sözleşmesi

- **İdempotency karşılaştırması, doğrulanmış kanonik rapor zarfı üzerinden yapılır.** Yetkilendirme tokenı, ağ başlıkları, teslim denemesi zamanı ve benzeri taşıma üstverisi parmak izine girmez; test içeriği, dış kimlikler, zaman/bağlam alanları, ilişkiler ve yüklenen eklerin içerik parmak izleri girer. Alan sırası veya anlamsız JSON whitespace farkı yeni içerik sayılmaz.

- **Aynı dış oturum içindeki yinelenen `external_test_id`, aynı dış oturum kimliğinin farklı kanonik içerikle yeniden kullanılması ya da desteklenmeyen alan/sürüm bütün raporu reddeder.** Bilinmeyen alanlar gizlice başka alana eşlenmez veya ana kayda yazılmaz; hata kesin alan yolunu gösterir. Ham raporda bulunmaları ise ham içeriğin güvenlik ve boyut sınırları içinde tarihsel olarak korunabilir.

- **Başarılı MCP cevabı yalnız teslim makbuzu verir:** iç Test Oturumu kimliği, dış oturum kimliği, kabul zamanı, kanonik içerik parmak izi ve isteğin `created` ya da `duplicate` sonucu. Bu cevap genel okuma yetkisi vermez ve Test Oturumunun özel içeriğini geri döndürmez.

- **Başarısız kabul hiçbir ana kayıt, alt kayıt, bildirim, sayaç, indeks girdisi veya Dosya Eki ilişkisi bırakmaz.** Hata cevabı secret veya özel payload'ı tekrar etmeden en az aşağıdaki kararlı kodlardan birini, güvenli alan yolunu ve düzeltilebilir açıklamayı taşır:

- **`schema_unsupported`**
- **`project_not_authorized`**
- **`payload_too_large`**
- **`invalid_field`**
- **`unsupported_field`**
- **`duplicate_external_test_id`**
- **`identity_conflict`**
- **`reference_not_found`**
- **`reference_scope_mismatch`**
- **`result_conflict`**
- **`sensitive_data_detected`**
- **`attachment_rejected`**

- **İlk `test-report/1` kabul limitleri aşağıdadır.** Limitler kanonik doğrulama öncesi ham taşıma boyutuna ve doğrulanmış öğe sayılarına ayrı ayrı uygulanır; aşım sessiz kırpma veya kısmi kabul üretmez.

| Limit | MCP | Dosya içe aktarma | Manuel form | Hata |
| --- | ---: | ---: | ---: | --- |
| Rapor zarfı | 5 MiB | 5 MiB | 5 MiB | `payload_too_large` |
| `raw_report` | 1 MiB | 1 MiB | 1 MiB | `payload_too_large` |
| Oturum Testi sayısı | 1.000 | 1.000 | 200 | `payload_too_large` |
| Toplam `relations` | 5.000 | 5.000 | 1.000 | `payload_too_large` |
| Test başına `relations` | 50 | 50 | 50 | `invalid_field` |
| Toplam `evidence` | 5.000 | 5.000 | 1.000 | `payload_too_large` |
| Test başına `evidence` | 20 | 20 | 20 | `invalid_field` |
| Tek `text_excerpt` veya log alıntısı | 16 KiB | 16 KiB | 16 KiB | `invalid_field` |
| Binary/base64 kanıt | Reddedilir | Reddedilir; dosya ayrı seçilir | Reddedilir; dosya ayrı yüklenir | `attachment_rejected` |

- **Dosya kanıtları ayrıca ortak [dosya yetenek matrisine](07-documents-and-knowledge.md#dosya-ekleri) uyar.** Bu limitlerin değişmesi yeni rapor şema sürümü gerektirmez; yayımlanmış sözleşme değişikliği ve geriye uyumluluk duyurusu gerektirir. Daha düşük yeni limit mevcut entegrasyonlara en az 30 günlük geçiş süresi verilmeden uygulanmaz.

## İnceleme durumu, yaşam döngüsü ve yetki sözleşmesi

### Manuel kayıt ve inceleme durumlarının bağımsızlığı

- **Manuel Test Oturumu formu kullanıcı `Kaydet` eylemini tamamlayana kadar ana kayıt, dış kimlik veya bildirim oluşturmaz.** Kaydetmeden önce alanlar düzenlenebilir; kaydedildikten sonra ham sonuç tarihsel hâle gelir ve düzeltme/geri çekme sözleşmesine geçer. İlk ürün bu formu kalıcı genel Taslak sistemine veya test yürütme ekranına dönüştürmez.

- **Test Oturumu ile her Oturum Testinin inceleme durumu ayrıdır.** Oturumu `İncelendi` veya `Kapatıldı` yapmak alt testleri sessizce değiştirmez; tekil sonucu kapatmak da üst oturumu kapatmaz. Kullanıcı açık `Oturumu ve seçili sonuçları incelendi işaretle` toplu eylemini kullanırsa değişecek kesin kayıtlar önizlenir ve tek denetlenebilir işlemle güncellenir.

- **İçinde `İncelenmedi` veya `Takip gerekli` alt sonuç bulunan oturum kapatılabilir ancak ürün kalan kesin kayıtları gösterir ve isteğe bağlı kapanış gerekçesini korur; esnek akış gereği zorunlu kapı oluşturmaz.** Sonradan gelen düzeltme, geri çekme, redaksiyon veya yeni ilişki mevcut inceleme durumunu sessizce geri almaz; `Kapanıştan sonra yeni bağlam` sinyali üretir.

- **Handoff durumu Test Oturumu ve sonuç durumlarından bağımsızdır.** Bağlı rapor yalnız `Sonuç alındı` önerisi üretir; Handoff'u kapatmaz, iptali geri almaz veya hedef tarihi değiştirmez. Test değerlendirmesi de kaynak kayıtların durumlarını değiştirmeyen kesin snapshot olarak kalır.

### Arşiv, çöp kutusu ve kalıcı silme

- **Planlı Test Senaryosu, Test Handoff'u, Test Açığı ve Test değerlendirmesi normal arşiv davranışına katılır.** Arşivleme kimliği, sürümleri, ilişkileri ve geçmişi korur; başka kaydın sonucunu veya durumunu değiştirmez.

- **Test Oturumu ile alt Oturum Testleri tek tarihsel bütün olarak arşivlenir, çöp kutusuna taşınır ve geri yüklenir.** Oturum Testi tek başına arşivlenmez veya tarihsel bağlamından koparılarak çöp kutusuna taşınmaz; hatalı tekil sonuç için Düzeltme/Geri çekme kullanılır. Oturum silme önizlemesi alt testleri, düzeltmeleri, kanıt ilişkilerini, Handoff/senaryo/Özellik/Proje Sürümü bağlarını ve etkilenecek özetleri gösterir.

- **Test Oturumunu çöp kutusuna taşımak yalnız bu tarihsel kayıt grubunu etkiler.** Başka kayıtlarda da kullanılan bağımsız Dosya Eklerini veya takip İşlerini otomatik silmez; ilişkilerin etkisi önizlenir. Geri yükleme aynı iç kimlikleri ve üst–alt bütünlüğünü atomik olarak geri getirir. Kalıcı silme ortak veri silme sözleşmesini izler; çözülemeyen dış ilişkiler yeni hedefe yönlendirilmeden tombstone/kayıp kaynak davranışı gösterir.

- **Test kayıtları salt zaman geçtiği için kendiliğinden silinmez veya ham raporu kaybetmez.** Saklama süresi proje/çalışma alanı kayıt politikası ve ortak çöp kutusu kurallarıyla aynıdır. Kanıt Dosya Ekleri ortak dosya saklama kurallarını, dış URL'ler ise garanti edilmeyen canlı referans davranışını izler. Güvenlik redaksiyonu kalıcı silmeden ayrı, yalnız hassas değeri geri döndürülemez kaldıran denetlenebilir işlemdir.

### İlk ürün ve collaboration-ready yetkiler

- **İlk ürün personal-first'tür ve takım rolü yönetim arayüzü sunmaz.** Kullanıcı kendi erişebildiği projede senaryo/Handoff planlama, manuel kayıt, inceleme, ilişkilendirme, düzeltme, arşivleme ve normal paylaşım/export eylemlerini mevcut kullanıcı yetkisiyle yapar. Hassas veri redaksiyonu etkisi açıkça gösterilen ayrı yüksek riskli onay gerektirir.

- **Dar MCP kimliği yalnız açıkça yetkilendirildiği projede `test_report.submit` kabiliyetine sahiptir.** Entegrasyon payload içinden `Raporlayan` kullanıcıyı seçemez; raporlayan kimlik doğrulanmış entegrasyon ve isteği yetkilendiren kullanıcı bağlamından sistem tarafından yazılır. Entegrasyon başka projeye teslim, mevcut kayıt okuma, inceleme durumu değiştirme, düzeltme/geri çekme/redaksiyon, yeni rapor zarfında desteklenen referanslar dışında ilişki oluşturma, mevcut ilişki değiştirme veya export/paylaşım yapamaz.

- **Veri modeli yürüten, raporlayan, inceleyen, düzelten, redakte eden ve dışa aktaran aktörleri ayrı denetim olaylarıyla korur.** Özel kayıt veya kanıta erişemeyen aktör ilişki üzerinden onun adını, sayısını, sonucunu ya da varlığını öğrenemez. Gelecekteki ekip rolü ve ayrıntılı test yetkileri [Gelecek Yönleri](18-future-directions.md#ekip-test-yetkileri) belgesindedir; ilk ürüne rol veya izin arayüzü eklemez.

## Tarihsel bütünlük, çelişki ve takip

### Düzeltme, geri çekme ve güvenlik redaksiyonu

- **Ham rapor ve bildirilen sonuç geriye dönük düzenlenmez.** Hata sonradan anlaşılırsa kullanıcı önceki kayda bağlı, gerekçeli `Düzeltme` ya da `Geri çekme` olayı ekler. Güncel görünüm düzeltmeyi öne çıkarır; özgün bildirim ve değişim zinciri denetim geçmişinde kalır.

- **Secret, kişisel veri veya benzeri hassas içeriğin tarihsel test kaydında kalması değişmez geçmiş kuralının dar istisnasıdır.** Yetkili kullanıcı [güvenlik redaksiyonu sözleşmesini](13-data-security-and-portability.md#database-first-guvenlik-tabani) başlatabilir; bu belge yayılım hedeflerini yeniden tanımlamaz. Test yüzeyi içerik yerine redaksiyon işaretini, zamanı, gerekçeyi ve işlemi yapanı gösterir; redakte edilmiş kanıt güncel değerlendirme veya dışa aktarma için kullanılamaz.

### Yerine geçen doğrulama ve çelişki

- **Kullanıcı kesin Oturum Testleri arasında ortak domain sözleşmesindeki yönlü [`Yerine geçer` / `Yerine geçildi` ilişkisini](02-domain-model-and-lifecycle.md#standart-ilişki-türleri) kurabilir.** Yeni sonuç eskisini silmez veya geçmiş sonucunu değiştirmez; güncel özet geçiş zincirini, her iki sonucu ve teknik bağlam farkını gösterir.

- **Aynı senaryoda farklı sonuçlar bulunup açık bir yerine-geçme ilişkisi yoksa ürün `Çelişen sonuçlar` dikkat sinyali gösterebilir.** Sinyal yalnız kesin ortak senaryo sürümü veya açık ilişki ve farklı normalize sonuçlardan türetilir; metin benzerliğiyle testleri eşlemez ve hangi sonucun doğru olduğuna karar vermez.

### Bağlam değişikliği

- **Bağlı Birincil spec sürümü değişmişse ya da kayıtlı kesin branch/commit/build bağlamı artık hedef bağlamla uyuşmuyorsa ürün açıklanabilir `Bağlam değişti` sinyali gösterebilir.** Eski sonucu otomatik geçersiz, eski veya başarısız saymaz; Test Açığı ya da tekrar Handoff'u oluşturmaz.

- **Salt zaman geçmesi veya repository'de ilgisiz yeni commit bulunması staleness hükmü üretmez.** Teknik bağlam girilmemiş manuel sonuçta ürün yalnız bağlamın bilinmediğini gösterir; semantik kod etki analizi yaptığını iddia etmez.

### Takip işi ve ilişkili kayıtlar

- **`Kaldı`, `Bloke` veya `Sonuçsuz` sonucu otomatik Bug, İş, Risk, Açık Soru, Karar, bildirim veya öncelik oluşturmaz.** Kullanıcı Oturum Testinden `Takip işi oluştur` eylemini başlatabilir veya sonucu mevcut İş, Bug, Risk, Açık Soru ya da Karara bağlayabilir. Önizleme hedef kaydı, başlangıç değerlerini ve kesin köken/kanıt ilişkilerini onaydan önce gösterir.

- **Birden fazla sonuç aynı kök nedene ait tek mevcut İşe bağlanabilir.** İşin kapanması tarihsel sonucu `Geçti` yapmaz; düzeltmenin doğrulanması yeni bir Test Oturumu ve gerekirse `Yerine geçen doğrulama` ilişkisi gerektirir.

## Özellik, Proje Sürümü ve ortak kayıt davranışı

- **Özellik test özeti; açık ilişkilerle bağlı Planlı Test Senaryolarını, Handoff'ları, Test Oturumlarını ve Oturum Testlerini, açık Test Açıklarını, takip işlerini ve son Test değerlendirmesini canlı olarak bir araya getirir.** Proje Sürümü özeti aynı kayıtları Proje Sürümü kapsamındaki Özellik ve İş ilişkilerinden ve doğrudan Proje Sürümü bağlarından gösterir.

- **Özet; bildirilen ham ve normalize sonucu, kaynak Test Oturumunu, yürütücüyü, raporlayanı, zamanı ve teknik bağlamı korur.** GitHub check'leri kendi dış kaynak durumlarıyla ayrı gösterilir; otomatik Test Oturumuna veya Oturum Testine dönüştürülmez. Açıkça yapılandırılmış rapor teslim eden CI/test aracı ise normal `Harici araç` kaynaklı Test Oturumu oluşturabilir.

- **İlişkili test kaydının bulunmaması, bağlam değişikliği, çelişen sonuç, `Kaldı`, `Bloke`, `Sonuçsuz`, `Atlandı` sonucu, incelenmemiş rapor, açık Test Açığı veya değerlendirmeden sonra gelen kayıt; kaynaklarıyla tarafsız dikkat bilgisi olabilir.** Ürün bunlardan coverage, kalite puanı, genel geçti/kaldı hükmü, otomatik test istisnası veya yayın kapısı üretmez; yayın kararını kullanıcı verir.

- **Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Oturum Testi, Test Açığı ve Test değerlendirmesi normal arama, filtreleme, Table, Akıllı Koleksiyon, ilişki, geri bağlantı, değişiklik geçmişi, arşiv/çöp kutusu ve desteklenen standart JSON içe/dışa aktarma davranışına katılır.** Tarihsel ham sonuç Table içinden geriye dönük düzenlenmez; düzeltme ayrı izlenebilir olaydır.

- **Bağlantıyla sınırlı paylaşım veya herkese açık yayın test kayıtlarını ilişki üzerinden görünür yapmaz.** Her kayıt, Handoff paketi, ham rapor/referans, teknik bağlam, not, değerlendirme, düzeltme ve kanıt eki ortak kapalı dünya kapsamında ayrı ayrı önizlenip onaylanır.

## Uçtan uca örnek akışlar

### Harici ajan handoff'u ve kısmi sonuç

- **Kullanıcı checkout için beş kesin Planlı Test Senaryosu sürümünden Codex hedefli bir Test Handoff'u ve Markdown paketi oluşturup durumu `Paylaşıldı` yapar.** Codex dışarıda yalnız üç senaryoyu test eder ve aynı Handoff/senaryo kimlikleriyle yapılandırılmış rapor teslim eder. Ürün bir Test Oturumu ve üç Oturum Testi oluşturur; Handoff'ta iki senaryonun sonucu bulunmadığını gösterir fakat Handoff'u kapatmaz veya Test Açığı oluşturmaz. Kullanıcı eksik kapsam için Test Açığı kaydeder ve oturumu `Takip gerekli` yapar.

### Manuel gerçek cihaz testi

- **Manuel gerçek cihaz testi:** Kullanıcı gerçek iPhone'da kupon akışını ürün dışında elle dener. Uygulamada `Runner: User`, `Input Path: App` olan Test Oturumu oluşturur; `iPhone 15 / iOS 20.1 / Safari / staging build 842` bağlamını, üç Oturum Testini ve bir ekran görüntüsünü kaydeder. Ürün canlı adım uygulama veya cihaz otomasyonu başlatmaz; kayıtlar harici ajan sonuçlarıyla aynı inceleme ve takip davranışına katılır.

### CI raporu ile GitHub check ayrımı

- **Playwright CI yapılandırılmış JUnit/JSON sonucunu dönüştürüp dar MCP girişine yollar.** Ürün `Yürüten: Playwright CI`, `Giriş yolu: MCP` olan Test Oturumu oluşturur. Aynı PR'daki GitHub `checks passed` özeti ayrı dış geliştirme gerçeği olarak kalır; kendiliğinden ikinci Test Oturumu ya da Oturum Testleri üretmez.

### Çelişen ve yerine geçen sonuç

- **Codex ödeme senaryosunu `main@abc123` üzerinde `Geçti`, Claude Code ise `feature/refund@def456` üzerinde `Kaldı` bildirir.** Daha yeni tarih farklı bağlamı ortadan kaldırmadığı için iki kayıt birbirini ezmez. Düzeltme aynı branch'in yeni commit'inde doğrulandığında kullanıcı yeni sonucu seçip önceki başarısız sonuca `Yerine geçen doğrulama` ilişkisi kurar; geçmiş zincir korunur.

### Test Açığı ve takip işi

- **Kullanıcı `Mobil kupon kullanımı denenmedi` Test Açığını bir Handoff'a bağlayıp `Planlandı` yapar.** Android sonucu gelince açık otomatik kapanmaz. iOS sonucu da geldikten sonra kullanıcı iki kesin Oturum Testini seçerek açığı `Sonuçla karşılandı` yapar. Aynı çalışmada bulunan üç checkout hatasını tek mevcut Bug'a bağlar; Bug kapandığında eski test sonuçları değişmez.

### Tarihsel değerlendirme

- **Sürümde 46 `Geçti`, 2 `Atlandı` sonucu ve gerekçesi kabul edilmiş bir uyumluluk açığı vardır.** Kullanıcı kesin kaynakları seçip `Kabul edilebilir` Test değerlendirmesi kaydeder. Sonradan yeni bir `Kaldı` sonucu gelirse değerlendirme sessizce güncellenmez; ürün yeni bağlam sinyalini gösterir ve yayın kararını kullanıcıya bırakır.

## Ürün grili için zorlayıcı senaryolar

- **Aşağıdaki senaryolar ürün sınırını ve yönetim davranışını tasarım, prototip ve dogfooding sırasında stres-test etmek için kullanılır.** Her grill sorusu tek başına ele alınmalı; önerilen yanıt varsayılan ürün sözleşmesini gösterir.

1. **Aynı rapor üç kez teslim edildi**
   - Senaryo: Conductor bağlantı zaman aşımı nedeniyle aynı Codex raporunu üç kez yollar.
   - Grill sorusu: Kullanıcı kaç Test Oturumu ve bildirim görür?
   - Önerilen yanıt: İçerik parmak izi aynıysa bir oturum ve bir bildirim; sonraki teslimler önceki kabulü döndürür.

2. **Aynı dış kimlikte değiştirilmiş içerik geldi**
   - Senaryo: Claude Code aynı dış oturum kimliğiyle önce 8, sonra 10 test gönderir.
   - Grill sorusu: Sistem ilk raporu günceller mi, ikinci kopyayı mı oluşturur?
   - Önerilen yanıt: İkisini de yapmaz; çakışmayı reddeder ve yeni kimlik ister.

3. **Raporun bir alt testi geçersiz**
   - Senaryo: 60 testlik payload'ın bir sonucunda desteklenmeyen değer ve secret bulunur.
   - Grill sorusu: Geçerli 59 test sessizce kaydedilir mi?
   - Önerilen yanıt: Hayır; oturum atomik reddedilir ve kesin hata konumları açıklanır.

4. **Belirsiz başarı ifadesi kullanıldı**
   - Senaryo: Harici araç yalnız `checkout flow looks good` yazar.
   - Grill sorusu: Yönetim özeti bunu `Geçti` sayabilir mi?
   - Önerilen yanıt: Hayır; ham ifade korunur ve normalize sonuç `Sonuçsuz` olur.

5. **Manuel ve ajan sonucu çelişiyor**
   - Senaryo: Codex masaüstünde `Geçti`, kullanıcı gerçek iPhone'da `Kaldı` kaydeder.
   - Grill sorusu: Kaynak türüne göre hangisine daha çok güvenilir?
   - Önerilen yanıt: Ürün güven sıralaması yapmaz; cihaz, build, zaman ve kanıt bağlamıyla iki sonucu birlikte gösterir.

6. **Daha yeni sonuç farklı branch'te**
   - Senaryo: Eski `main` sonucu geçer, daha yeni feature branch sonucu kalır.
   - Grill sorusu: En yeni kayıt eskisini otomatik geçersiz kılar mı?
   - Önerilen yanıt: Hayır; kullanıcı kesin yerine-geçme ilişkisi kurmadıkça iki tarihsel bağlam korunur.

7. **Senaryo kapsamı genişletildi**
   - Senaryo: Web için geçen v1 senaryosuna v2'de mobil ve misafir kullanıcı koşulları eklenir.
   - Grill sorusu: v1 sonucu v2 için geçerli gösterilir mi?
   - Önerilen yanıt: Hayır; sonuç kesin v1 sürümüne bağlı kalır ve yeni kapsam kullanıcı kararıyla planlanır.

8. **Handoff kısmen tamamlandı**
   - Senaryo: Beş senaryoluk paketten yalnız üç sonuç döner.
   - Grill sorusu: Handoff otomatik kapanır veya iki Test Açığı oluşur mu?
   - Önerilen yanıt: Hayır; eksik sonuçlar açıklanabilir biçimde gösterilir, kapanış ve açık oluşturma kullanıcıya kalır.

9. **Başarısız sonuçtan tek kök neden çıktı**
   - Senaryo: Üç Oturum Testi aynı checkout hatası nedeniyle kalır.
   - Grill sorusu: Sistem üç Bug mı oluşturur?
   - Önerilen yanıt: Hayır; otomatik kayıt oluşmaz, kullanıcı üç sonucu tek mevcut İşe bağlayabilir.

10. **Hatalı test verisi kullanıldı**
    - Senaryo: Önce `Geçti` bildirilen testin yanlış fixture kullandığı anlaşılır.
    - Grill sorusu: Eski sonuç düzenlenip `Sonuçsuz` yapılır mı?
    - Önerilen yanıt: Hayır; bağlı düzeltme veya geri çekme olayı eklenir, özgün bildirim denetim geçmişinde kalır.

11. **Ham log secret içeriyor**
    - Senaryo: Rapor içinde API anahtarı vardır.
    - Grill sorusu: Değişmez geçmiş ilkesi secret'ı sonsuza kadar erişilebilir mi tutar?
    - Önerilen yanıt: Hayır; yetkili, geri döndürülemez güvenlik redaksiyonu içeriği kaldırır ve denetim izini korur.

12. **Dış kanıt bağlantısı kayboldu**
    - Senaryo: CI log URL'si üç ay sonra erişilemez olur.
    - Grill sorusu: Ürün kanıtı hâlâ mevcut veya doğrulanmış gibi gösterir mi?
    - Önerilen yanıt: Hayır; tarihsel referans ve erişilemezlik görünür kalır, sonuç kendiliğinden değişmez.

13. **Spec değişti ama kod etkilenmedi**
    - Senaryo: Bağlı spec yeni sürüm alır; değişiklik yalnız açıklama metnindedir.
    - Grill sorusu: Bütün eski sonuçlar geçersiz veya yeniden test zorunlu mu olur?
    - Önerilen yanıt: Hayır; kesin sürüm farkı dikkat sinyali olabilir, etki ve tekrar testi kullanıcı değerlendirir.

14. **Değerlendirme sonrasında yeni başarısızlık geldi**
    - Senaryo: Proje Sürümü için `Kabul edilebilir` Test değerlendirmesinden sonra yeni `Kaldı` sonucu eklenir.
    - Grill sorusu: Eski değerlendirme güncellenir veya Proje Sürümü engellenir mi?
    - Önerilen yanıt: Hayır; snapshot korunur, yeni bağlam görünür olur ve yeni değerlendirme/yayın kararı kullanıcıya kalır.

15. **Harici araç proje içeriğini okumak istiyor**
    - Senaryo: Codex MCP üzerinden bütün spec'leri ve özel test geçmişini talep eder.
    - Grill sorusu: Test raporu girişi bu erişimi verir mi?
    - Önerilen yanıt: Hayır; yalnız kullanıcının oluşturduğu güvenli Handoff paketi dışarı verilir, MCP salt yeni rapor kabul eder.

16. **Kullanıcı yeniden test istiyor**
    - Senaryo: Bir düzeltmeden sonra aynı testlerin yeniden yapılması gerekir.
    - Grill sorusu: Ürün `Yeniden çalıştır` ile Codex'i, CI'ı veya tarayıcıyı başlatır mı?
    - Önerilen yanıt: Hayır; kullanıcı yeni Handoff hazırlar, dış yürütme sonucunda yeni Test Oturumu geri gelir.

17. **Desteklenmeyen rapor sürümü gönderildi**
    - Senaryo: Harici araç `test-report/2` zarfını yalnız `test-report/1` destekleyen ürüne yollar.
    - Grill sorusu: Ürün bildiği alanları alıp kalanlarını yok sayar mı?
    - Önerilen yanıt: Hayır; bütün rapor `schema_unsupported` ile reddedilir ve hiçbir kısmi kayıt oluşmaz.

18. **Handoff ile senaryo kimliği uyuşmuyor**
    - Senaryo: Rapor geçerli Handoff kimliğini fakat o pakette bulunmayan başka senaryo sürümünü taşır.
    - Grill sorusu: Sonuç Handoff bağı düşürülerek ad hoc kabul edilir mi?
    - Önerilen yanıt: Hayır; ilişki sessizce değiştirilmez ve rapor `reference_scope_mismatch` ile atomik reddedilir.

19. **İptal edilen Handoff'a geç sonuç geldi**
    - Senaryo: Kullanıcı Handoff'u iptal ettikten sonra CI geçerli kimlikle sonuç yollar.
    - Grill sorusu: Rapor reddedilir veya Handoff yeniden açılır mı?
    - Önerilen yanıt: İkisi de olmaz; tarihsel sonuç bağlanır, Handoff iptal durumunda kalır ve geç sonuç sinyali gösterilir.

20. **Üst oturum kapatılırken alt sonuçlar açık**
    - Senaryo: Oturumda iki `İncelenmedi` ve bir `Takip gerekli` Oturum Testi varken kullanıcı oturumu kapatır.
    - Grill sorusu: Alt sonuçlar otomatik kapanır veya işlem engellenir mi?
    - Önerilen yanıt: Hayır; kalan sonuçlar önizlenir, oturum gerekçeyle kapatılabilir ve alt durumlar değişmez.

21. **Entegrasyon başka kullanıcı adına raporlamaya çalışıyor**
    - Senaryo: MCP payload'ı `Raporlayan: proje sahibi` alanı gönderir.
    - Grill sorusu: Ürün payload'daki aktörü kabul eder mi?
    - Önerilen yanıt: Hayır; raporlayan doğrulanmış entegrasyon bağlamından sistem tarafından yazılır, sahte aktör alanı reddedilir.

22. **Tekil tarihsel sonuç silinmek isteniyor**
    - Senaryo: Kullanıcı büyük Test Oturumundaki yalnız bir hatalı Oturum Testini çöp kutusuna taşımak ister.
    - Grill sorusu: Alt kayıt oturum bağlamından koparılır mı?
    - Önerilen yanıt: Hayır; tekil hata Düzeltme/Geri çekmeyle yönetilir, çöp kutusu işlemi Test Oturumu ve bütün alt sonuçları tarihsel birim olarak ele alır.

## Ertelenen ve kapsam dışı davranışlar

- **Test alanının tek normatif kapsam dışı listesi [Kod inceleme, doğrulama ve deployment](19-out-of-scope.md#kod-inceleme-doğrulama-ve-deployment) ile [AI, otomasyon ve programatik erişim](19-out-of-scope.md#ai-otomasyon-ve-programatik-erişim) bölümlerindedir.** Bu bölüm yalnız sınırı görünür tutar: ürün dış test çalışmalarını ve bildirilen sonuçları yönetir; test yürütme altyapısının, coding ajanının veya CI/CD sisteminin yerine geçmez.
