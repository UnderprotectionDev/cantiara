# Ürün Kalitesi

Bu belge ilk ürünün performans, erişilebilirlik, kullanılabilirlik, veri bütünlüğü, gözlemlenebilirlik ve etkileşim tutarlılığı hedeflerinin tek normatif sahibidir. Test yöntemi, fixture ve saklanacak kanıt [Ürün Kabulü](16-product-acceptance.md) belgesinde tanımlanır.

<a id="performans-butcesi"></a>
## Performans ve ölçek bütçesi

- **Süreler 4 çekirdekli güncel bir masaüstü işlemci, 16 GB bellek, desteklenen masaüstü tarayıcı, 50 Mbps bağlantı ve 100 ms ağ gecikmesi altında ölçülür.** Kullanıcı zamanlaması eylemden veya son tuş vuruşundan anlamlı sonucun görünür, kararlı ve etkileşime hazır olmasına kadar uçtan uca alınır; backend span'leri yalnız teşhis içindir. Dış yüzey ilk içerik bütçesi bu laboratuvarın yanı sıra [kabuldeki mobil Safari/Chrome matrisinde](16-product-acceptance.md#uctan-uca-kabul-yolculuklari) de kanıtlanır. Asset yükleme iptal kontrolünü veya kapalı-dünya yetkisini cache uğruna atlayamaz. Yayın isteğinin kabul bütçesi ziyaretçi ilk içeriğinden ayrıdır; iç uygulama soğuk açılışına 2,5/4 sn uygulanmaz.

- **Sunucu ölçüm sırasında normal üretim kapasitesinin yüzde 60'ından fazla CPU veya veritabanı bağlantı kullanamaz.** Her akış tam Ürün sürüm adayı ve tanımlı referans veriyle en az 500 sıcak-cache ve 100 soğuk-cache ölçümüyle değerlendirilir; hata veren istekler süre örneğinden çıkarılmaz. p95 ve p99 değerleri birbirini ikame etmez ve az sayıdaki elle spot kontrol bu örneklemin yerine geçmez.

| Akış | p95 | p99 |
| --- | ---: | ---: |
| Komut Paleti'nin görünür olması | 150 ms | 300 ms |
| Arama ilk sonuçlarının güncellenmesi | 500 ms | 1.000 ms |
| Temel kayıt detayının kullanılabilir olması | 700 ms | 1.500 ms |
| Kayıtlı görünüm veya filtre sonucunun güncellenmesi | 800 ms | 1.750 ms |
| Tek kayıt mutasyonunun sunucu tarafından onaylanması | 800 ms | 1.500 ms |
| Büyük toplu işlemde ilk ilerleme göstergesi | 1.000 ms | 2.000 ms |
| Büyük canvas'ta pan/zoom görsel tepkisi | 16 ms kare hedefi | 33 ms azami kare |
| Soğuk uygulama kabuğunun kullanılabilir olması | 2.500 ms | 4.000 ms |
| 5 MB Markdown Belgesinin açılması | 1.500 ms | 3.000 ms |
| Belge kaydının sunucu tarafından onaylanması | 800 ms | 1.500 ms |
| 25 MB dosyanın yükleme sonrası tür ve bütünlük doğrulamasının tamamlanması | 1.500 ms | 3.000 ms |
| Herkese açık yayın veya kaldırma isteğinin kabul edilmesi | 1.000 ms | 2.000 ms |
| Dış yüzeyde kullanılabilir ilk içerik (küçük snapshot) | 2.500 ms | 4.000 ms |
| Dış yüzeyde kullanılabilir ilk içerik (adversarial büyük snapshot) | 2.500 ms | 4.000 ms |

- **Referans büyük Çalışma Alanı arama, liste ve detay akışları için 25 Proje, 10.000 İş, 5.000 Belge, 2.000 Geri Bildirim, 1.000 Contact/Company, 2.000 Test Oturumu, 250 Teknik Diyagram, 1.000 Diyagram Sürümü, 500 Migration Artefaktı ve 50.000 ilişki içerir.** Dosya kanıtı 5.000 sürüm üstverisi, 25 MB gerçek transfer ve 25 GB kota hesabını doğrular; CI içinde gerçek 20 GB içerik taşıma zorunluluğu yoktur.

- **Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard ve Teknik Diyagram için sert performans sahnesi 500 aynı anda görünür öğe ve 750 görsel bağlantıdır.** 2.000 öğe ve 3.000 bağlantı ayrıca veri güvenliği stresidir: arayüz uyarı, sanallaştırma veya azaltılmış ayrıntıyla çalışabilir fakat çökemez, veriyi bozamaz veya kaybedemez. 500 öğe oluşturma sınırı değildir.

- **Bütçeyi aşan akış `performans kabul edilmedi` sayılır; yalnız “hızlı olmalı” değerlendirmesi veya ortalama süre yeterli değildir.** İlk GitHub eşitlemesi 30 dakika ve kaçan olay uzlaştırması 15 dakika içinde tamamlanır. Bu süreler aşılırsa işlem sessizce çalışıyor gibi gösterilmez.

- **Bitiriş efekti tek kayıt mutasyonunun sunucu onayı bütçesine, İş durumunun görünür olmasına veya sonraki kullanıcı girdisine ek gecikme getiremez.** Desteklenen cihazda kararlı çizim bütçesi korunamıyorsa dekoratif katman oynatılmaz; `İş tamamlandı` sonucu ve hareketten bağımsız başarı geri bildirimi aynı hız ve doğrulukla kalır.

<a id="kullanilabilirlik-hedefi"></a>
## Kullanılabilirlik ve platform desteği

- **Üretim aylık kullanılabilirlik hedefi üç ayrı kullanıcı görünür SLI için `%99,5`tir:** geçerli oturumla özel veri okuma/yazma, yeni kimlik doğrulama ve ürün kontrollü Dış yüzey erişimi. Planlı bakım ve deployment kesintileri hesaba dahildir; GitHub eşitleme tazeliği ayrı ölçülür.

- **Düşük trafikte geçerli ürün oturumuyla sentetik özel okuma/yazma ve herkese açık yüzey probları kullanılır.** OAuth başlangıç/callback ile GitHub erişilebilirliği ürünün kendi kimlik bilgilerini saklamadan ölçülür; gerçek girişimler ve olaylar da hesaba katılır.

- **Kimlik doğrulamalı web uygulamasının birinci sınıf tarayıcı aileleri Chrome, Edge, Firefox ve Safari'dir.** Her Ürün sürüm adayında bu ailelerin o tarihteki güncel kararlı sürümleri kesin tarayıcı, motor, işletim sistemi, cihaz veya bulut imajı ve test tarihiyle Ürün destek matrisine sabitlenir. Brave ve Arc Chromium uyumluluğuyla çalışabilir fakat Web Clipper sözleşmeleri ana web uygulaması için ayrı destek ve kabul taahhüdü oluşturmaz.

- **macOS Tauri paketi [çalışma ve dağıtım modelindeki destek aralığının](03-account-platform-operations.md#calisma-ve-dagitim-modeli) her üyesinde aynı ürün ve güvenlik sözleşmesini karşılar.** Kesin destek matrisi her Ürün sürüm adayına sabitlenir. Daha sonra çıkan tarayıcı veya işletim sistemi sürümü geçmiş kabulü değiştirmez; sonraki Ürün sürüm adayında yeniden değerlendirilir.

<a id="erisilebilirlik"></a>
## Erişilebilirlik

- **Ana kullanıcı akışları WCAG 2.2 AA seviyesini karşılar.** Klavye ile erişilemeyen eylem, görünmeyen odak, yalnız renkle aktarılan anlam, etiketsiz kontrol, anlamsız okuma sırası veya erişilebilir adı olmayan canvas aracı kabul edilmez.

- **Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard ve Teknik Diyagram için piksel jesti gerektirmeyen erişilebilir yapılandırılmış outline veya liste aynı görevleri sunar: oluşturma, seçme, yeniden sıralama, gruplama, bağlama, bağlantıyı kaldırma, inceleme ve kaynak kaydı açma.** Veri Modeli outline'ı table, column, constraint, index ve ilişkiyi; Teknik Mimari ve Teknik Sıra outline'ı kendi türlenmiş öğe ve bağlantılarını düzenleyebilir biçimde sunar. Canvas pan/zoom, seçim, taşıma ve hizalamanın klavye karşılığı bulunur; yapılandırılmış yüzey yalnız salt okunur yedek değildir.

- **İş Bağlam Kartı düzenleme, Kanıt Akışı ve Sürüm Kanıt Paketi yalnız klavye ve ekran okuyucuyla tam kullanılabilir olur.** Bölüm ekleme, gizleme, sıralama ve filtre koşulu seçimi; boş durum ile gösterilme nedeni; Kanıt Rolü, kaynak türü, durum ve `Kaynak kaydı aç` eylemi programatik ad, ilişki ve okunabilir sırayla sunulur. Görsel kart veya zaman akışı düzeni tek erişim yolu değildir.

- **Bitiriş efekti hiçbir başarı bilgisinin tek taşıyıcısı değildir.** Sistem veya tarayıcı azaltılmış hareket tercihi efekti ve hareketli önizlemeyi koşulsuz bastırır; uygulama içi tercih bunu geçersiz kılamaz. [İş Yönetiminde tanımlı](06-work-management-and-planning.md#bitiris-efektleri) temel sonuç bildiriminin metni, görünür durum/simgesi ve nazik ekran okuyucu duyurusu korunur; hareketli önizleme yerine durağan son kare ve kısa hareket açıklaması gösterilir. Efekt ve önizleme ses, haptik, strobe, titreşimli parlaklık, tekrarlı kırmızı/beyaz flaş veya saniyelik teknik flaş eşiğine dayanan başka yanıp sönme üretmez.

<a id="guvenlik-ve-veri-butunlugu"></a>
## Güvenlik ve veri bütünlüğü

Aşağıdaki sonuçlardan biri gözlenirse Ürün sürüm adayı kabul edilmez:

- **Başka Çalışma Alanına veya onaylanmamış Dış yüzeye kayıt adı, sayı, ilişki ucu, ek üstverisi ya da içerik sızması.**
- **Başarısız atomik işlemden kısmi ana kayıt, ilişki, sayaç veya indeks girdisi kalması.**
- **Geri almanın ilgisiz sonraki değişikliği silmesi.**
- **Arşiv, Çöp Kutusu, kapanış sonucu ve yaşam durumunun birbirine yazılması.**
- **Onaylı snapshot'ın kaynak değişikliğiyle sessizce güncellenmesi.**
- **Production Neon, Railway, R2 veya Better Stack kaynağının onaylı Avrupa Birliği bölgesi dışında yapılandırılması.**
- **Güncel olmayan taban revizyonunun mevcut değeri sessizce ezmesi veya aynı idempotency anahtarının farklı payload'a uygulanması.**
- **İptal edilmiş Dış yüzeyin cache, range isteği, eski erişim oturumu veya origin URL üzerinden içerik ya da Dosya Eki sunması.**
- **Teknik Diyagramın birden fazla canlı otorite kipine bağlanması, otorite kipinin aynı kayıt kimliğinde değiştirilmesi, DSL/dosya/repository değişikliğinin kanonik yapısal modeli yeni kimlikli açık dönüşüm olmadan değiştirmesi veya kesin Diyagram Sürümünün geriye dönük yazılması.**
- **PostgreSQL parse, bağımlılık sırası veya model invariant kontrolü geçmeyen SQL'in `Statik olarak doğrulandı` gösterilmesi; veri kayıpsız deterministik ters kanıtı olmayan migration için `Güvenli Down` üretilmesi.**
- **Ürünün çalıştırmadığı DDL veya Migration Artefaktını `Çalıştırıldı`, `Uygulandı`, `Production-ready` ya da eşdeğer runtime doğruluk iddiasıyla sunması.**

- **Kimlik doğrulama, paylaşım, yayın, export/import, kalıcı silme, redaksiyon ve entegrasyon yetkisi olaylarının güvenlik sözleşmesi [Veri Güvenliği ve Taşınabilirlik](13-data-security-and-portability.md) belgesindedir.** Saklama süreleri kalite belgesinde tekrar edilmez.

<a id="gozlemlenebilirlik"></a>
## Gözlemlenebilirlik

- **Her başarısız ana akış kullanıcıya anlaşılır hata nedenini, güvenli yeniden deneme sınırını ve veri yazılıp yazılmadığını bildirir.** Sunucu bir hata takip kimliği üretir; kullanıcıya gizli anahtar veya özel içerik göstermeden destek referansı sunulur.

<a id="etkilesim-tutarliligi"></a>
## Etkileşim tutarlılığı

- **Aynı eylem bütün yüzeylerde aynı ad, hedef ve yan etkiyi taşır.** `Kaynak kaydı aç`, kayıt değişikliği, görünüm değişikliği, yayın onayı ve geri alma birbirinden ayrı etiketlenir.

- **[İş Yönetiminde tanımlı Bitiriş efekti davranışı](06-work-management-and-planning.md#bitiris-efektleri) web ve macOS Tauri'de aynı görünür sonucu üretir.** Kaynak İş veya kart çevresindeki sınırlı katman en fazla 1,2 saniye oynar; odağı değiştirmez, girdiyi yakalamaz, kaydırma veya navigasyonu engellemez ve yüzey değiştiğinde temizlenir. Açık/koyu görünüm, yüzde 200 ölçek, uzun yerelleştirilmiş metin ve desteklenen platformlarda temel sonuç bildirimi efekt katmanından bağımsız doğrulanır. Aynı sonucu çizen renderer ayrıntısı platforma göre değişebilir ve ilgili teknik tasarımda belirlenir.

- **Kayıtlı görünümde geçici filtre veya sunum değişikliği açık kaydetme olmadan kalıcılaşmaz.** Hesaplanmış sayı veya dağılım, onu üreten kesin filtrelenmiş kayıt kümesini açar; manuel değerlendirme aynı kontrolü hesaplanmış veri gibi kullanmaz.

- **İş Bağlam Kartı, Kanıt Akışı ve Sürüm Kanıt Paketi gösterdikleri her öğenin kesin ana kaynağını, durumunu ve gösterilme nedenini tutarlı biçimde açar.** Bu yüzeylerin kaynak kimliği [ortak kimlik sözleşmesini](02-domain-model-and-lifecycle.md#ortak-kimlik), çözülemeyen hedef davranışı [standart ilişki sözleşmesini](02-domain-model-and-lifecycle.md#standart-ilişki-türleri), canlı kaynak ile kesin sürüm veya snapshot ayrımı ise [sürüme sabitlenmiş metin kanıtı](07-documents-and-knowledge.md#sürüme-sabitlenmiş-metin-parçası-kanıtı), [Kaynak sürümü karşılaştırması](08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması), [Ekran ve Wireframe sürümü](09-discovery-decisions-and-design.md#wireframeler), [Teknik Diyagram görünüm ve sürümü](11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar), [Test Handoff'u](10-testing-and-validation.md#test-handoffu) ve [onaylı yayın snapshot'ı](14-sharing-and-public-publishing.md#onaylı-yayın-snapshotı) sözleşmelerini izler; kalite yüzeyi bu davranışları yeniden tanımlamaz, gizlemez veya onlarla çelişen ikinci bir sunum üretmez.

- **İş Bağlam Kartının bütün yapılandırma yüzeyleri [alan sözleşmesindeki](06-work-management-and-planning.md#iş-bağlam-kartı) aynı adları, önizleme sonucunu ve geri alma sınırını tutarlı biçimde sunar.** Arayüz alan sözleşmesinin desteklemediği serbest sorgu, formül veya metriği varmış gibi metin kutusu ya da çalıştırılabilir ifade alanıyla ima etmez; kalite belgesi düzen değişikliğinin domain etkisini yeniden tanımlamaz.

- **Kalite matrisi açık ve koyu görünüm, yüzde 200 ölçek, İngilizce arayüz metni, uzun kullanıcı içeriği, desteklenen locale'larda uluslararası tarih/saat/sayı biçimi ve yalnız klavye kullanımını kapsar.** İlk üründe çevrilebilir arayüz veya RTL yoktur; locale arayüz dilini değiştirmez. Dış yüzeylerin responsive mobil ziyaretçi davranışı [Paylaşım ve Herkese Açık Yayın](14-sharing-and-public-publishing.md) belgesindedir; bu dayanıklılık kimlik doğrulamalı mobil ürün, tema oluşturucu, özel CSS/font, başka native runtime veya çevrimdışı kapsam açmaz.
