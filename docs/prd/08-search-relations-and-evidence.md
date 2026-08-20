# Arama, İlişkiler ve Kanıt

Bu belge arama, sınıflandırma, ilişkiler, kanıt semantiği ve geri bildirim kimliği davranışlarının tek normatif sahibidir. Belge düzenleme, dosya, metnin belge sürümüne sabitlenmesi ve Kişisel Wiki davranışları [Belgeler ve Bilgi](07-documents-and-knowledge.md) belgesinde tanımlanır.

## İlişkiler, arama ve bilgi yönetimi

### Çalışma alanı genelindeki hazır tür dizinleri

- **Kullanıcı desteklenen temel kayıt türleri için `Tüm İşler`, `Tüm Belgeler`, `Tüm Kararlar`, `Tüm Riskler`, `Tüm Araştırma Oturumları`, `Tüm Testler`, `Tüm Tasarımlar`, `Tüm Teknik Diyagramlar`, `Tüm Proje Sürümleri`, `Tüm Kaynaklar` ve `Tüm Dosyalar` gibi sıfır kurulumlu Çalışma Alanı genelindeki dizinler açabilir.** `Tüm Testler`, Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Oturum Testi, Test Açığı ve Test değerlendirmesi alt türlerini; `Tüm Teknik Diyagramlar` ise Teknik Mimari, Veri Modeli ve Teknik Sıra türleriyle Diyagram otorite kipini görünür biçimde ayırır. Dizinlere ayrı kalıcı navigasyon öğeleri eklemek yerine ortak bir tür seçici üzerinden erişilir.

- **Hazır tür dizini yalnız seçilen türdeki mevcut ana kayıtları toplar; koşul, manuel üyelik, kayıtlı sorgu veya yeni kayıt kümesi saklamaz.** Proje, durum, tarih ve arşiv gibi desteklenen filtreler geçici sunumu daraltabilir. Kalıcı koşullu bir görünüm gerektiğinde kullanıcı açıkça Akıllı Koleksiyon oluşturur.

- **`Tüm Dosyalar` her Dosya Ekinin ana kaydını bir kez gösterir; önceki dosya sürümleri ek detayındaki sürüm geçmişinde kalır.** Her dizin ortak `Kaynak kaydı aç` eylemini kullanır ve kayıtları ait oldukları ana proje veya Kişisel Wiki kapsamından çıkarmaz.

### Tür-kapsamlı Table görünümü

- **İş, Proje Hedefi, Geri Bildirim, Contact, Company, Kullanıcı Araştırması Oturumu, Risk, Varsayım, Karar, Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Oturum Testi, Test Açığı, Test değerlendirmesi, Üretim Olayı, Kilometre Taşı ve Proje Sürümü gibi yapılandırılmış kayıt türleri tek tür kapsamlı yoğun Table görünümünde incelenebilir.** Görünüm hazır tür dizinlerinde ve ilgili Akıllı Koleksiyonlarda mevcut filtre, sıralama ve görünür alan kurallarını kullanır; her satır aynı ana kaydı temsil eder ve ortak `Kaynak kaydı aç` eylemini korur. Yürütücü tarafından bildirilen tarihsel test sonucu Table içinden geriye dönük düzenlenmez; düzeltme ayrı ve izlenebilir bir kayıt olayıyla yapılır.

- **Desteklenen alanlar hücre içinde düzenlenebilir.** Çok satırlı yapıştırma önce sütun eşlemesini, oluşturulacak veya güncellenecek satırları ve geçersiz hücreleri önizler. Kullanıcı geçersiz satırı düzeltir veya kesin kapsamdan açıkça çıkarır; tek onay seçilen nihai kümeyi atomik ve idempotent uygular. Ya bütün satırlar yazılır ya da hiçbir satır yazılmaz; doğrulanmamış değer veya kısmi başarı sessizce bırakılmaz. Her Table tek kayıt türüyle sınırlıdır; yeni tür, alan şeması, çapraz tür join’i veya ayrı tablo doğruluk kaynağı oluşturmaz.

### Evrensel Arama

- **Evrensel Arama bütün projelerdeki İşleri, güncel ve geçmiş kullanıcıya dönük İş anahtarlarını, hafif kontrol listesi metinlerini, Proje Hedeflerini, Belgeleri ve desteklenen Dosya Eklerini bulur.**

- **Evrensel Arama ayrıca Karar, Risk, Varsayım, Kullanıcı Araştırması Oturumu ve izinli notu, Geri Bildirim, Contact, Company, Ürün Boşluğu, Dış Araca Kaçış, Ekran, tasarım, Kilometre Taşı ve Kişisel Wiki Belgesi ile ilişkili eklerini bulur.**

- **Evrensel Arama ayrıca Planlı Test Senaryosu, Test Handoff'ı, Test Oturumu, Oturum Testi, Test Açığı, Test Değerlendirmesi, Üretim Olayı, Proje Sürümü ve bağlı geliştirme kayıtlarını bulur.** Bu kayıt türlerinin ayrı maddelerde gruplandırılması bağımsız teslim aşaması, kısmi kabul veya özellik erişim kapısı oluşturmaz; tamamı ilk Ürün sürüm adayının arama kapsamındadır.

- **Evrensel Arama Teknik Diyagramları başlık, tür, otorite kipi, düğüm/öğe etiketi, Veri Modelinde table/column adı ve değişmez Migration Artefaktı manifestindeki kullanıcıya dönük adlarla bulur.** Diyagram Görünümü, Diyagram Sürümü ve Migration Artefaktı sahibinden bağımsız arama sonucu veya yeni ana kayıt türü olmaz; sonuç kesin sahibi ve ilgili görünüm/sürüm/öğe konumunu açar. Üretilmiş SQL gövdesi varsayılan genel metin indeksine girmez ve arama sonucu üzerinden gizli model alanı sızdırmaz.

- **Varsayılan sıralama önce metin eşleşmesini, sonra aşağıdaki kapalı ve bu sırayla uygulanan eşitlik-bozucu sinyalleri kullanır.** Sıra dışında başka sinyal, öğrenen model, kullanım sayacı, tıklama geçmişi veya AI önem sıralaması kullanılmaz:

| Sıra | Sinyal | Değer |
| --- | --- | --- |
| 1 | Metin eşleşme yeri | Başlık ve anahtar eşleşmesi gövde eşleşmesinden önce gelir |
| 2 | Mevcut proje bağlamı | Kullanıcının açık Projesindeki kayıtlar diğer Projelerdekilerden önce gelir |
| 3 | Yaşam durumu | Aktif kayıtlar; sonra kapanmış kayıtlar; arşivlenmişler yalnız açık arşiv filtresiyle |
| 4 | Kapanış sonucu | `Tamamlandı` sonuçlu kayıtlar `Vazgeçildi` sonuçlulardan önce gelir |
| 5 | Son değiştirme zamanı | Daha yeni değiştirilen kayıt önce gelir |
| 6 | Kararlı iç kimlik | Aynı değerlerde sıra deterministik ve tekrarlanabilir kalır |

- **Tamamlanmış ve vazgeçilmiş kayıtlar erişilebilir fakat ikincil gruplarda gösterilir.** Arşivlenmiş kayıtlar yalnız açık arşiv filtresiyle sonuçlara katılır; çöp kutusundaki ve erişilemeyen kayıtlar hiçbir sıralamada görünmez.

- **Sonuç rozetleri kaydın tür, durum, varsa kapanış sonucu ve kapsamını görünür kılar.** Kullanıcı kapsam, arşiv filtresi ve alternatif tarih/metin sıralamasıyla varsayılan sıralamayı geçersiz kılabilir.

- **Metin içeriği nedeniyle bulunan sonuç, erişim izni bulunan indekslenmiş kaynaktan kısa eşleşme bağlamını, eşleşen terim vurgusunu ve aynı kayıt içindeki toplam eşleşme sayısını gösterir.** Rozetler kaydın ne olduğunu, metin parçası neden bulunduğunu açıklar. Sonuç açıldığında desteklenen metin, tablo veya ek türünde mümkünse kesin eşleşme konumuna gidilir; kesin konum desteklenmiyorsa kayıt açılır ve bu sınır açıklanır. Parça üretimi özel alanı, paylaşılmamış snapshot'ı veya indekse alınmayan içeriği sonuçta göstermez.

- **Arama sonuçları sorgu metni, görünür filtre veya kapsam değiştikçe canlı güncellenir.** Canlı filtreleme yeni bir sorgu kaydı oluşturmaz; kullanıcının henüz kaydetmediği arama ve filtre durumu geçici kalır.

- **Kullanıcı mevcut görünür filtrelerle birebir eşleşen sınırlı operatörleri arama alanına yazabilir.** Otomatik tamamlama desteklenen operatör ve değerleri gösterir; yazılan ifadeler görünür filtre çiplerine dönüşür ve aynı sorgu yalnız görünür kontrollerle de kurulabilir. İş anahtarı, proje, tür, durum, kapanış sonucu, tarih, arşiv ve kontrol listesi içeriği gibi desteklenen filtreler operatör karşılığı taşıyabilir. İç içe mantıksal ifadeler, serbest sorgu dili veya yalnız klavyeden erişilen yetenekler sunulmaz.

- **İş, Geri Bildirim ve Kaynak kayıtlarındaki dış bağlantının özgün URL'si ile deterministik olarak çıkarılmış dış kayıt kimliği tam eşleşmeyle aranabilir.** `Dış bağlantısı var` filtresi sağlayıcı tanınmasa da bu üç türde özgün dış URL taşıyan kayıtları bulur; sağlayıcı ve dış kayıt türü filtreleri yalnız aşağıdaki ortak üstveri güvenle mevcut olduğunda sunulur. Bu operatörler görünür filtre çipleriyle aynı anlamı taşır ve dış servise canlı sorgu göndermez.

- **Kullanıcı filtrelenmiş aramayı açık `Akıllı Koleksiyon olarak kaydet` eylemiyle kalıcılaştırabilir.** Dönüşümden önce koşullar okunabilir biçimde gösterilir ve koleksiyon adı için onay alınır; geçici arama kendiliğinden koleksiyona dönüşmez.

### Etiketler

- **İçerikler proje alanından bağımsız olarak sınıflandırılmak ve bulunmak için etiketlenebilir.** Etiketler filtreleme, arama ve Akıllı Koleksiyon koşullarında kullanılabilir.

- **İlk ürün tek bir çalışma alanı genelindeki ana etiket ad alanı kullanır.** Aynı görünen adla ayrı çalışma alanı ve proje-yerel etiket kimlikleri oluşturulmaz. Proje içindeki seçici o projede sık kullanılan etiketleri önce önerebilir; bu yalnız kişisel öneri/sıralama davranışıdır ve etiketin kapsamını değiştirmez.

- **Markdown Belgesi metninde `#etiket` biçiminde eklenen inline token aynı çalışma alanı etiketini hedefler; ikinci metin-yerel etiket sistemi oluşturmaz.** Token paragraf, başlık ve liste gibi normal yazı bağlamlarında çalışır; fenced/inline code içinde, URL parçasında veya kaçışla düz metin olarak işaretlenen içerikte etiket olarak yorumlanmaz. Belge etiket filtresine girdiğinde kullanıcı etiketin geçtiği kesin satır bağlamını görebilir ve kaynağı o konumda açabilir.

- **Etiketler düz ad alanında kalır; `/` karakteri parent/child hiyerarşisi, kapsam veya kalıtım oluşturmaz.** Kesişen anlam birden fazla düz etiketle, yalnız projeye özgü yapılandırılmış sınıflandırma proje-bazlı özel alanlarla kurulur.

- **Ana etiket yeniden adlandırma bütün yapılandırılmış alan ve inline kullanımları tek atomik işlemde günceller; etkilenen Belgelerde sürümlü değişiklik oluşturur ve güvenli geri alma sağlar.** Markdown export inline `#etiket` metnini korur; manifest ana kimlik eşlemesini taşır. Import, tanınan inline etiketleri açık önizlemede mevcut etiketle eşler veya yeni düz ana etiket adayı olarak gösterir; sessiz kopya kimlik üretmez.

- **Yalnız tek Projeye özgü yapılandırılmış sınıflandırma Proje bazlı özel alanlarla kurulur.** İlk ürün ikinci bir Proje-yerel etiket ad alanı veya gelişmiş etiket bakım yüzeyi oluşturmaz; olası bakım araçları [Gelecek Yönleri](18-future-directions.md#gelismis-etiket-bakimi) altında değerlendirilir.

### Proje bazlı özel alanlar

- **Kullanıcı proje bazında en az `Metin`, `Sayı`, `Boolean`, `Tarih`, `Tek seçim` ve `Çoklu seçim` türlerinde özel alan oluşturabilir.**

- **İlk ürün kullanıcı tanımlı `Lookup` veya `Formula` alanı sunmaz.** Kayıtlar arası değerler kayıtlı ilişkilerle görünür kılınır; ürünün tanımladığı türetilmiş özetler ile Akıllı Koleksiyon koşulları kullanıcı formülü veya yeni alan doğruluk kaynağına dönüşmez.

- **Her alan bir veya daha fazla yapılandırılmış kayıt türüne bağlanır.** İş, Geri Bildirim, Kullanıcı Araştırması Oturumu, Risk, Varsayım, Karar, Test Handoff'u, Test Oturumu, Planlı Test Senaryosu, Test Açığı, Üretim Olayı, Kilometre Taşı ve Proje Sürümü kayıtları özel alan destekleyebilir. Tarihsel Oturum Testi kullanıcı tanımlı özel alan taşımaz; yürütücünün bildirdiği test ve sonuç şemasını korur. Tarihsel snapshot niteliğindeki Test değerlendirmesi de kullanıcı tanımlı özel alan taşımaz. Alan yalnız seçilen türlerin oluşturma, düzenleme, arama ve filtreleme yüzeylerinde görünür. Markdown belge gövdesi ve ham ekler özel alan formuna dönüştürülmez.

- **Özel alanlar arama, filtreleme, Akıllı Koleksiyonlar, ilgili planlama sunumları, içe/dışa aktarma, proje yapısı kopyalama ve herkese açık görünürlük denetimleriyle tutarlı çalışır.**

- **Alan tanımı yalnız kendi projesinde yaşar.** İki projedeki aynı adlı alan bağımsız tanımlardır. Çalışma alanı genelindeki Akıllı Koleksiyon, aynı adlı proje alanlarını tek alanmış gibi varsayamaz; filtre proje ve alan kapsamını açıkça gösterir.

### İçerik ilişkileri ve geri bağlantılar

- **İçerikler standart ilişki türleri ve isteğe bağlı gerekçelerle birbirine bağlanabilir.** İlişkiler veritabanındaki ana kayıtlarda tutulur; geri bağlantılar yalnız standart ilişkilerden otomatik üretilir. Satır içi referans, bölüm referansı, canlı blok ve konum bağı ilişki değil [kullanım bağıdır](02-domain-model-and-lifecycle.md#kullanim-baglari); geri bağlantı üretmez ve ilişki sayılarına girmez.

- **Desteklenen kayıt detayları mevcut standart ilişkiler, satır içi referanslar, canlı içerik/görünüm kullanımları ve geri bağlantılardan türetilen kategorili bir `Kullanıldığı yerler` özeti sunar.** Her öğe asıl kaynağı açar; özet yeni ilişki, manuel üyelik veya kopyalanmış kullanım kaydı oluşturmaz. Kullanıcının erişemediği kaydın adı, türü, sayısı veya varlığı sızdırılmaz.

- **Yapılandırılmış JSON dışa aktarımı, seçili kayıtlarda bulunan ilişki ve kimlik eşlemelerini açık alanlarda taşır.** İlişkiler canlı Markdown frontmatter’ına dayanmaz.

### Bağlam içi kayıt önizleme

- **Kullanıcı bir liste, Akıllı Koleksiyon, Özellik kapsamı, iş bağlamı veya başka bir kaynak görünümden ilişkili uygulama kaydını ya da belgeyi varsayılan olarak geçici yan panelde açar.** Panel kaynak görünümü ve kullanıcının mevcut konumunu korur; derin çalışma gerektiğinde açık bir `Tam sayfa aç` eylemi sunar.

- **Yan panel yeni bir içerik kopyası oluşturmaz.** Açık panel ve panel içi gezinme durumu oturumlar arasında recent-context olarak geri yüklenmez.

- **Kanban, Birleşik Takvim, Roadmap, Kapsam Ağacı, Akıllı Koleksiyon ve Bildirim Merkezi ana kaynağa geçiş için görünür ve anlamsal olarak aynı `Kaynak kaydı aç` eylemini kullanır.** Bu eylem kaynağı varsayılan olarak yukarıda tanımlanan geçici yan panelde açar; hiçbir yüzey farklı etiket, hedef veya yan etki tanımlamaz.

### Akıllı Koleksiyonlar

- **Akıllı Koleksiyonlar; işleri, proje hedeflerini, belgeleri, kararları, riskleri, varsayımları, geri bildirimleri, Contact/Company kayıtlarını, Planlı Test Senaryolarını, Test Handoff'larını, Test Oturumlarını, Oturum Testlerini, Test Açıklarını, Test değerlendirmelerini, üretim olaylarını, Ekranları, tasarımları ve diğer içerikleri tür, etiket, durum, sonuç, tarih, özel alan veya ilişki koşullarına göre dinamik olarak bir araya getirir.** Tek proje içinde veya projeler arasında çalışabilir ve koşullar değiştikçe güncellenir.

- **Üyelik yalnız kayıt koşullarından türetilir.** Manuel üyelik, pin veya filtre dışı istisna kabul edilmez. Kullanıcı bir kaydı koleksiyona sürüklediğinde ürün, mümkünse kaydı koşula uygun hâle getirecek alan değişikliğini açıkça önizleyip önerebilir.

- **Koşullar görsel oluşturucuyla kurulur ve kullanıcıya okunabilir biçimde özetlenir.** Her kayıt için hangi koşullar nedeniyle koleksiyona girdiği açıklanabilir. Evrensel Arama’daki görünür filtre karşılığı sınırlı operatörler bu oluşturucuyu hızlandırabilir; ilk ürün serbest yazılabilir gelişmiş sorgu dili sunmaz.

- **İş koleksiyonundaki `Yeni iş` eylemi proje, tür veya durum gibi doğrudan ve tekil alan eşitliğine çevrilebilen üyelik koşullarını oluşturma yüzeyinde görünür ve değiştirilebilir değerler olarak önceden doldurur.** Kullanıcı bir değeri değiştirdiğinde yeni işin koleksiyonda görünmeyebileceği açıklanır. Tarih aralığı, olumsuz koşul veya karmaşık ilişki gibi doğrudan alana çevrilemeyen koşullar otomatik uygulanmaz.

- **İş koleksiyonları aynı üyelik koşulları üzerinde bir varsayılan görünümle birlikte birden fazla adlandırılmış görünüm taşıyabilir.** Her görünüm Kanban, liste, roadmap veya desteklenen kayıt türlerinde Gallery sunumunu; gruplama, sıralama, görünür alanlar ve ilgili görünüm ayarlarını saklar. Adlandırılmış roadmap görünümü ayrıca zaman ölçeğini, sınırlı görsel yoğunluğu, iki görsel eksen eşlemesini ve grup/sütunların yalnız o görünüme ait sunum sırasını saklayabilir. Bu ayarlar kartların önceliğini, alan değerlerini, durumunu, Backlog sırasını veya başka görünümleri değiştirmez; yeni grup değeri görünür varsayılan konumda eklenir ve kullanıcı isterse yalnız bu görünüm için yeniden sıralar. Görünümler koleksiyonun üyelik koşullarını kopyalamaz veya ayrı kayıt kümesi oluşturmaz.

- **Her adlandırılmış görünüm isteğe bağlı tek cümlelik `Kullanım amacı` taşıyabilir.** Açıklama görünüm seçicide erişilebilir olur; üyelik koşulunu, sıralamayı, otomasyonu veya kaynak kayıtları değiştirmez ve yalnız görünümün hangi rutin ya da karar için kurulduğunu korur.

- **Gallery yalnız Belge, Proje Duvarı, Kullanıcı Akışı, Ekran, Moodboard, Teknik Diyagram, Dosya Eki, Kaynak ve Geri Bildirim kayıtlarında seçilebilir.** Ekran önizlemesi varsa güncel olarak seçilmiş Wireframe sürümünden, Teknik Diyagram önizlemesi seçilmiş Diyagram Görünümünden, diğer önizlemeler kayıt türüne göre kesin Dosya Eki sürümündeki desteklenen görsel, Belgedeki ilk erişilebilir desteklenen görsel, güvenli bağlantı önizlemesi veya kısa metin yedeğinden bu sırayla türetilir. Kullanıcı Gallery için ayrı küçük görsel kaydı, serbest kart stili, ikinci özet alanı veya görünüm-özel içerik oluşturamaz.

- **Kayıtlı görünüm açıkken yapılan filtre, gruplama, sıralama, kolon ve diğer sunum değişiklikleri kullanıcı açıkça kaydedene kadar geçici kalır.** Arayüz kaydedilmemiş değişikliği gösterir; kullanıcı yeni hâli mevcut görünüme kaydedebilir, yeni bir adlandırılmış görünüm oluşturabilir veya tek hareketle kayıtlı hâle dönebilir. Geçici alan sıralaması kaydedilmiş grup/sütun sunum sırasını silmez; görünüm tekrar yerel sunum sırasına döndüğünde önceki düzen geri gelir.

### Akıllı Koleksiyon abonelikleri

- **Kullanıcı bir kaydın seçili koleksiyonun koşullarına ilk kez girmesi için Bildirim Merkezi sinyali açabilir.** Koşuldan çıkış bildirimi ayrıca seçilebilir.

- **Aynı üyelik dönemi boyunca bildirim tekrarlanmaz.** Abonelik yeni kayıt oluşturmaz ve kaynak kaydın durumunu, tarihini veya alanlarını değiştirmez.

### Hafif İçgörüler

- **İş öğelerine yönelik Akıllı Koleksiyonlar mevcut filtre sonucundan türetilen İçgörüler sekmesi sunar.** Kayıt sayısı, durum dağılımı, efor dağılımı, kayıt yaşı ve time-in-status açıklanabilir biçimde özetlenir.

- **Özet bölümleri aynı koleksiyonu ilgili alt kümeye filtreleyebilir.** Filtre değiştiğinde içgörüler aynı ana veri kümesinden yeniden hesaplanır.

- **Özellik kişi karşılaştırması, kapasite puanlaması, cycle-time/throughput performans yönetimi, serbest dashboard oluşturucu veya ayrı analitik doğruluk kaynağı oluşturmaz.**

### Kaynak kaydı ve köken bilgisi

- **Dış bağlantı ve araştırma kaynakları için adres, başlık, erişim tarihi ve yakalandığı içerik saklanabilir.** Kısa alıntı, ekran görüntüsü ve ekler kaynak kaydına eklenebilir. Kaynağın projede nerede, hangi amaçla ve hangi bağlamda kullanıldığı izlenebilir.

- **Bir İşe, Geri Bildirime, Kaynak Kaydına veya desteklenen başka kayda bağlanan dış sistem adresi isteğe bağlı `sağlayıcı`, `dış kayıt türü` ve `dış kayıt kimliği` üstverisi taşıyabilir.** Bu alanlar yalnız URL biçiminden veya kullanıcının açık girişinden deterministik olarak çözümlendiğinde kaydedilir; tanınmayan bağlantı normal dış URL olarak kalır. Desteklenen sağlayıcı simgesi ve aynı kayıttaki dış bağlantı sayısı kompakt bağlam olarak gösterilebilir. Bu tanıma credential, sağlayıcı API çağrısı, durum/alan senkronizasyonu, otomatik içe aktarma veya dış kaydı ana İşe dönüştürme yetkisi vermez.

### Akıllı bağlantı önizlemesi

- **Kimlik doğrulaması istemeyen, herkese açık HTTP(S) URL uygulamadaki bağlantı alanına yapıştırıldığında ürün başlık, alan adı ve varsa güvenli görselden oluşan taranabilir bir önizleme gösterir.** Önizleme tek başına ana Kaynak Kaydı oluşturmaz. Başka protokol, özel/ağ-yerel adres, 20 MB'tan büyük yanıt veya çalıştırılabilir içerik önizlenmez; özgün bağlantı güvenli metin olarak kalır.

- **Önizleme ve yeniden kontrol istekleri uygulamanın özel ağından ayrılmış, ayrıcalıksız egress bileşeninde çalışır.** Her DNS çözümünde ve her yönlendirmede hedef yeniden doğrulanır ve güvenli çözümleme isteğe pinlenir; loopback, özel, link-local ve ayrılmış ağlar engellenir. Yalnız HTTP(S), kullanıcı credential'ı veya özel header olmadan çağrılır; yönlendirme sayısı, toplam süre, indirilen ve açılmış byte ile işleme CPU/belleği katı sınır taşır. İçerik çalıştırılmaz ve güvenli alt kümeye temizlenir. Güvenli biçimde önizlenemeyen adres özgün bağlantıyı kaybetmeden görselsiz fallback gösterir.

- **Kullanıcı önizleme görselini, özgün URL'yi ve açıklamayı kart bazında ayrı ayrı gösterebilir veya gizleyebilir; kaynak alan adı ve `Kaynak olarak kaydet` eylemi yanıltıcı olmayacak kadar görünür kalır.** İlk ürün kullanıcı tarafından değiştirilmiş thumbnail kabul etmez; yalnız sağlayıcıdan güvenli biçimde alınan görseli veya görselsiz fallback'i kullanır.

- **Kullanıcı `Kaynak olarak kaydet` eylemiyle bağlantıyı açıkça Kaynak Kaydına dönüştürebilir.** Canlı önizleme verileri ile erişim tarihi ve yakalanan içeriği taşıyan tarihsel kaynak anlık görüntüsü görsel ve dilsel olarak ayrılır; dış kaynaktaki sonraki değişiklikler saklanmış anlık görüntüyü sessizce güncellemez.

- **Canlı dış oynatıcı ilk üründe yalnız YouTube bağlantıları için desteklenir.** Kart `Canlı dış kaynak` olarak etiketlenir, oynatıcı kullanıcı tıklamadan ve üçüncü taraf içeriğin yükleneceği açık olmadan başlatılmaz, autoplay kullanmaz ve özgün YouTube adresini görünür tutar. Kaldırılmış, özel, yaş veya bölge kısıtlı video güvenli bağlantı fallback'i ve uygulanabilir hata açıklaması gösterir; boş veya bozuk embed bırakmaz.

- **YouTube kartı tarihsel kanıt değildir.** Bağlantı Kaynak Kaydına dönüştürüldüğünde canlı oynatıcı ile erişim tarihinde yakalanan içerik ayrı gösterilir. Vimeo ve diğer sağlayıcılar oynatıcıya dönüşmeden güvenli zengin bağlantı önizlemesi olarak kalır; kullanıcı tarafından yapıştırılan iframe veya çalıştırılabilir embed kodu kabul edilmez.

### Kaynağı yeniden kontrol etme ve sürüm karşılaştırması

- **Kullanıcı, yeniden alınması desteklenen HTTP(S) Kaynak Kaydında `Kaynağı yeniden kontrol et` eylemini açıkça başlatabilir.** Önizleme istek yapılacak görünür adresi, mevcut kayıtlı Kaynak sürümünü ve üçüncü taraf sunucuyla yeni bağlantı kurulacağını gösterir. Ürün arka planda periyodik tarama, salt zaman geçmesine dayalı kontrol, otomatik yenileme veya değişiklik bildirimi başlatmaz.

- **Her kullanıcı başlatmalı kontrol; zamanı, kullanıcıyı, başlangıç ve güvenli yönlendirmeler sonrası son adresi, HTTP/erişim sonucunu, desteklenen içerik türünü ve içerik parmak izini taşıyan tarihli `Kaynak Kontrolü` olayı oluşturur.** Başarılı kontrolde alınan içerik çalıştırılabilir koddan arındırılmış, kesin bir `aday snapshot` olarak korunur ve karşılaştırmanın sağ tarafını oluşturur; mevcut onaylı Kaynak sürümünü kendiliğinden değiştirmez. Kimlik doğrulaması isteyen, silinmiş, engellenmiş, desteklenmeyen veya erişilemeyen kaynakta eski içerik güncelmiş gibi gösterilmez; kesin başarısızlık nedeni olayda kalır.

- **Karşılaştırma mevcut onaylı Kaynak sürümü ile aday snapshot'ı yan yana ve yapı destekliyorsa satır/bölüm bazlı fark görünümünde gösterir.** Eklenen, kaldırılan ve değişen içerik; değişen başlık/üstveri, erişim zamanı ve yakalama yöntemi görünür kalır. Önceki sürüme sabit kanıt aralıkları yeni adayda kesin olarak bulunamıyorsa `Aday sürümde eşleşme bulunamadı` diye gösterilir; sistem benzer metne sessizce yeniden bağlamaz, anlamsal değişiklik veya etki hükmü çıkarmaz.

- **Kullanıcı `Mevcut sürümü koru` seçeneğiyle Kaynak Kontrolü olayını ve aday karşılaştırmasını geçmişte tutarken ana Kaynak sürümünü değiştirmeyebilir.** `Yeni Kaynak sürümü olarak kaydet` eylemi; yeni içeriği, son adresi, erişim zamanını, kontrol olayını ve önceki sürüm farkını önizleyip açık onaydan sonra yeni sürüm oluşturur. Eski sürüm silinmez; ona bağlı Karar, İş, Geri Bildirim ve diğer kesin kanıt bağları eski sürüm ve metin aralığında kalır. Yeni sürüm mevcut bağları taşımaz, İş/Karar/Risk/Test Açığı oluşturmaz ve ilişkili kayıtları otomatik güncellemez.

- **Kullanıcı yeni sürümü kaydettikten sonra eski kanıtı güncel sürümde yeniden kurmak isterse kaynak ve hedef metin aralığını gösteren mevcut açık yeniden bağlama akışını kullanır.** Birden fazla Kaynak Kontrolü tek bir değişiklik olayı gibi birleştirilmez; her kontrolün zamanı, sonucu, parmak izi ve karşılaştırdığı kesin temel sürüm korunur.

- **İş, Karar, Risk, Varsayım, Açık Soru, Test veya Proje Sürümü bir Kaynağı kanıt olarak kullandığında kullanım yeri kesin Kaynak sürümünü, erişim tarihini ve varsa kesin metin aralığını gösterir.** Aynı Kaynağın kullanıcı tarafından onaylanmış daha yeni sürümü varsa kullanım yeri `Daha yeni Kaynak sürümü var` bilgisini ve iki sürümün karşılaştırmasını açar; eski sürümü sessizce geçersiz, yanlış veya güncel dış gerçek olarak etiketlemez.

- **Kullanıcı her kesin kanıt kullanımında `İncelendi; mevcut sürüm korunuyor` ya da `Yeni sürümle yeniden bağla` kararını açıkça verir.** Mevcut sürümü koruma kararı inceleyen kullanıcıyı, zamanı, karşılaştırılan yeni sürümü ve isteğe bağlı gerekçeyi ilişki geçmişinde tutar. Yeniden bağlama eski ilişkiyi yeniden yazmaz; eski ve yeni sürümü, hedef metin aralığını ve etkilenecek tek kullanım bağını önizleyip yalnız o bağı yeni sürüme taşır. Başka kullanımlar kendi inceleme kararlarını korur.

- **Yeni onaylı Kaynak sürümü, eski sürümün hâlâ kanıt olarak kullanıldığı hedefler varsa tek Kaynak grubunda `Eylem Gerekiyor` dikkat sinyali üretir.** Grup her kullanım hedefini ve kesin sürümünü ayrı açar; bir hedefte verilen karar diğer hedefi kapatmaz. Bütün kullanımlar incelendiğinde sinyal kapanır; Kaynak yaşı, zamanın geçmesi, aday snapshot veya başarısız kontrol tek başına bu sinyali üretmez.

- **Kanıt tazeliği bir geçiş kapısı veya otomatik etki analizi değildir.** İncelenmemiş yeni sürüm İş, Karar, Risk, Test, Proje Sürümü veya yayın durumunu değiştirmez; kayıt oluşturmaz, hedefleri bloklamaz, ilişkili başka kayıtların etkilenmiş olduğuna karar vermez ve kullanıcı adına kanıt bağını taşımaz.

- **Yeniden alma; özel/ağ-yerel adreslere erişimi, güvenli olmayan yönlendirmeleri, desteklenmeyen protokolleri, çalıştırılabilir embed/script'i, aşırı boyutları ve ürünün ortak güvenli dış içerik sınırlarını engeller.** Kullanıcı credential, session cookie veya header veremez; ürün oturum açılmış tarayıcı durumunu yeniden kullanmaz. Kaynak sahibi erişimi veya içeriği kısıtlıyorsa kontrol bu sınırı aşmaz.

- **Kaynak Kontrolü olayları ve aday snapshot'lar normal erişim, saklama, arşiv/çöp kutusu, değişiklik geçmişi ve desteklenen standart JSON içe/dışa aktarma kurallarına katılır ancak Evrensel Arama'da güncel Kaynak içeriğini çoğaltan bağımsız sonuçlar olmaz.** Bağlantıyla sınırlı paylaşım veya herkese açık yayın; aday snapshot'ı, farkı ve her yeni Kaynak sürümünü ortak kapalı dünya kapsamında ayrı öğeler olarak önizler; geçmiş herkese açık snapshot yeni kontrol ya da yeni Kaynak sürümü nedeniyle değişmez.

### Geri Bildirim Kaydı

- **Geri Bildirim Kaydı, [ortak kanıt ve köken sözleşmesini](02-domain-model-and-lifecycle.md#standart-ilişki-türleri) kullanan ayrı bir uzman ana kayıttır; Kaynak Kaydının alt türü değildir ve onun URL yeniden kontrolü, aday snapshot ya da sürüm yaşamını kendiliğinden miras almaz.** İsteğe bağlı Contact ve Company ilişkisini, kanalı, özgün mesajı, zamanı, bağlantıyı, ekleri ve ilişkili proje, iş ve karar bağlarını korur. Kimliği bilinmeyen geri bildirim Contact oluşturmaya zorlanmaz.

- **Birden fazla geri bildirim aynı ana işe ayrı kökenler olarak bağlanabilir.** Geri bildirim oy, otomatik öncelik veya roadmap talimatı değildir.

- **Her İş–Geri Bildirim kanıt ilişkisi isteğe bağlı `Kanıt niteliği` bağlamı taşıyabilir.** Bağlam; `Bildirilen problem`, `Kullanıcının önerdiği çözüm`, `Mevcut workaround`, kullanıcının bildirdiği veya kanıtta açıkça bulunan `Etki şiddeti` ile `Kullanım sıklığı`, `Kaynak bağımsızlığı/tekrar bağlamı` ve kullanıcı tarafından değerlendirilen `Hedef kullanıcı profiline uygunluk` alanlarını birbirinden ayrı tutar. Her alan boş veya `Bilinmiyor` kalabilir; eksik değer ilişki kurmayı engellemez.

- **Özgün Geri Bildirim mesajı ile kanıt niteliği yorumu aynı metinmiş gibi sunulmaz.** Kaynakta açıkça söylenmeyen şiddet, sıklık, bağımsızlık veya hedef kullanıcı uyumu kullanıcı yorumu olarak etiketlenir; yazarı ve zamanı gösterilir. Sistem mesajdan bu alanları kendiliğinden çıkarmaz, birden fazla kaynağı bağımsız saymaz ve aynı kampanya, konuşma veya kök kaynaktan gelen kayıtları otomatik olarak benzersiz kanıt ilan etmez.

- **Kanıt niteliği İşin `Öncelik dayanakları` ve [İş Bağlam Kartı](06-work-management-and-planning.md#iş-bağlam-kartı) yüzeylerinde özgün Geri Bildirime geri açılan, karşılaştırılabilir bağlam olarak gösterilir.** Desteklenen alanlar Geri Bildirim kanıtı listesinde filtrelenebilir; ancak tek puana, ağırlığa, talep hacmine, otomatik öncelik sırasına, roadmap kararına veya nesnel kanıt kalitesi hükmüne dönüştürülmez. Aynı Geri Bildirimin farklı İşlerle ilişkilerinde bağlam farklı olabilir; bir ilişkideki yorum diğerine sessizce kopyalanmaz.

- **İş–Geri Bildirim ilişkisi genel `Kanıt Rolü` alanını da taşıyabilir.** `Kanıt niteliği` kaynağın problem, etki, sıklık ve bağımsızlık bağlamını; Kanıt Rolü ise bu Geri Bildirimin söz konusu İşte `Destekliyor`, `Çelişiyor`, `Bağlam sağlıyor` veya `Sonuçsuz` olarak nasıl kullanıldığını anlatır. Biri diğerinden türetilmez ve hiçbir birleşik puan oluşturmaz.

- **İş–Geri Bildirim ilişkisi isteğe bağlı ve elle yönetilen `Geri dönülecek`, `Geri dönüldü` veya `Sonuç doğrulandı` takip durumunu taşıyabilir.** Bu durum yalnız söz konusu kanıt bağındaki takip niyetini gösterir; Geri Bildirimin veya İşin yaşam döngüsünü değiştirmez. Ürün mesaj gönderme, konuşma dizisi, e-posta senkronizasyonu veya requester CRM'i oluşturmaz.

- **İlk üründe geri bildirim uygulama içindeki manuel Hızlı Yakalama ve mevcut kaynaklardan oluşturulur; herkese açık form, yorum, oy veya çift yönlü requester konuşması yoktur.**

### Contact ve Company kimliği

- **`Contact`, geri bildirimi veren kişiyi geri bildirimler boyunca aynı kimlikle tanımak ve kanıt geçmişini incelemek için kararlı iç kimlik taşıyan ana kayıttır.** Görünen ad ve e-posta isteğe bağlıdır; normalize edilmiş e-posta adresleri kimliğin takma değerleri olarak tutulabilir. `Company`, birden fazla Contact ve Geri Bildirimi isteğe bağlı ortak kuruluş bağlamında gruplayan hafif ana kayıttır. Contact bir Company ve Persona belgesiyle standart ilişki kurabilir; Company kullanımı zorunlu değildir.

- **Contact profili ilişkili Geri Bildirimleri ve Company/Persona bağlarını kaynağında açar.** Contact ve Company; plan, abonelik seviyesi, ARR/MRR, gelir, sözleşme, satış aşaması, coğrafi segment veya ticari değer skoru taşımaz ve genel CRM'e dönüşmez.

- **Contact kopyaları yalnız kullanıcı tarafından başlatılan birleştirmeyle çözülür.** Aynı normalize edilmiş e-posta güçlü kopya adayı, ad veya Company benzerliği ise zayıf öneri olabilir; sistem hiçbir koşulda otomatik birleştirme yapmaz. Kullanıcı ana Contact'ı seçer ve çatışan alanları, e-posta takma değerlerini, Geri Bildirim geçmişini, Company ve Persona ilişkilerini önizler.

- **Contact'a özgü aday seçimi, e-posta takma değeri, Company, Persona ve Geri Bildirim çatışmaları bu bölümün sorumluluğundadır.** Atomik konsolidasyon, emekli kimlik ve güvenli geri alma [ortak birleştirme sözleşmesini](02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma) izler.

### Geri Bildirim ve Kaynak Feed görünümü

- **Geri Bildirim kayıtları ile uzun metin gövdesi taşıyan Kaynak kayıtları, özgün mesajı veya yakalanan içeriği öne çıkaran yoğun bir Feed görünümünde incelenebilir.** Görünüm aynı ana kayıtları; kimlik veya kanal, zaman, ekler, proje ve ilişkili İş/Karar bağlarıyla gösterir ve Akıllı Koleksiyonların mevcut filtre ve sıralama koşullarını kullanabilir.

- **Feed satırı ayrı bir kayıt, sosyal gönderi, yorum dizisi, oy, kendine ait kronoloji veya ikinci durum yaşam döngüsü değildir.** Görünüm sırası kaynak kaydın durumunu ya da önceliğini değiştirmez; kullanıcı ayrıntıyı ortak `Kaynak kaydı aç` eylemiyle ana kayıtta inceler.

<a id="kanit-rolu-ve-iliski-ustverisi"></a>
### Kanıt Rolü ve kanıt ilişkisi üstverisi

- **Her kanıt ilişkisi hedef kayda göre kullanıcı tarafından seçilen isteğe bağlı `Kanıt Rolü` taşıyabilir: `Destekliyor`, `Çelişiyor`, `Bağlam sağlıyor` veya `Sonuçsuz`.** Rol seçilmeyen mevcut ve yeni ilişkiler `Belirtilmedi` olarak görünür; ilişki kurmayı engellemez. Aynı Kaynak sürümü bir Kararı desteklerken başka bir Varsayımla çelişebilir; rol Kaynağın kendisine yazılmaz ve diğer ilişkilere kopyalanmaz.

- **Rolü yalnız kullanıcı ekler, değiştirir veya temizler.** Değer; rolü seçen kullanıcıyı, zamanı ve değişiklik geçmişini korur; kaynak metnin parçası, nesnel doğruluk hükmü veya kanıt kalitesi skoru gibi sunulmaz. Sistem metinden rol çıkarmaz, yeni Kaynak sürümünde rolü yeniden yorumlamaz ve `Çelişiyor` rolünden Karar/Risk/Varsayım/İş durumu, bildirim, takip işi veya yeniden değerlendirme olayı üretmez.

- **Her kanıt ilişkisi isteğe bağlı, kaynaktan açıkça ayrılan `Kullanıcı yorumu/öğrenimi` taşıyabilir.** Alan kaynakta söyleneni değiştirmez veya alıntının parçası gibi sunmaz; yorumu yazan kullanıcıyı ve zamanı gösterir. Yorum düzenlendiğinde önceki değer kanıt ilişkisinin geçmişinde korunur. Bu alan ayrı Öğrenim/Insight kaydı, durum akışı, puan veya ana kaynak metin oluşturmaz; AI tarafından doldurulmaz ve kanıt ilişkisi olmadan bağımsız içerik olarak yaşamaz.

- **`Kanıt niteliği`, kullanıcı yorumu/öğrenimi ve Kanıt Rolü birbirinin yerine geçmeyen ayrı üstveridir.** İlki Geri Bildirim kanıtının bağlamını, ikincisi kullanıcının yorumunu, rol ise kanıtın belirli hedefte hangi yönde kullanıldığını açıklar; hiçbiri diğerinden türetilmez.

- **Hedef kaydın kanıt yüzeyi kanıtları role göre gruplayabilir ve filtreleyebilir.** Her rol sayısı varsa onu oluşturan kesin erişilebilir ilişki kümesini açar; tek toplam puan, çoğunluk sonucu, otomatik güven seviyesi veya önerilen karar üretmez. Bağlantıyla sınırlı paylaşım, herkese açık yayın ve dışa aktarma rolü kaynak, hedef, kesin sürüm/aralık ve yorumdan ayrı ilişki üstverisi olarak korur; erişilemeyen kanıtın rolü veya rol sayısı sızdırılmaz.

### Kanıt Akışı

- **İş, Karar ve Varsayım detayı, hedefe açık `Kanıtı / Kanıt sağlar` ilişkisiyle bağlanmış kesin kanıtları zaman sıralı ve kaynak türüne göre filtrelenebilir `Kanıt Akışı`nda gösterebilir.** Akış; kesin Kaynak veya Belge sürümünü, Geri Bildirimi, Kullanıcı Araştırması Oturumunu, Deney/Doğrulamayı, Oturum Testini ve Dosya Eki sürümünü kendi olay/gerçekleşme zamanı, ilişki zamanı, Kanıt Rolü, kullanıcı yorumu ve kaynak durumunu birbirine karıştırmadan gösterir. Her öğe kesin kaynak kaydı veya sürümünü açar.

- **Kanıt Akışına yalnız açık kanıt ilişkisi taşıyan öğeler girer.** Genel `İlgili` ilişkisi, metin benzerliği, aynı etiket, aynı Contact/Company veya aynı İş bağlamında bulunmak bir kaydı kendiliğinden kanıt yapmaz. Ürün akıştan tema, Insight, özet, ilişki, İş, Karar, öncelik, kanıt gücü ya da otomatik hüküm üretmez; kullanıcı Kanıt Rolünü `Destekliyor`, `Çelişiyor`, `Bağlam sağlıyor` veya `Sonuçsuz` olarak açıkça yönetir.

- **Kanıt Akışı aynı ana kayıt ve ilişkilerin türetilmiş görünümüdür.** Sıralama veya filtreleme kaynak kaydı, ilişkiyi ya da hedef yaşam durumunu değiştirmez ve ayrı akış kaydı, snapshot veya kronoloji doğruluk kaynağı oluşturmaz. Arşivli kaynak durumuyla görünür; Çöp Kutusundaki, kalıcı silinmiş, redakte edilmiş veya erişilemeyen kaynak ortak güvenli işaret davranışıyla içerik sızdırmadan açıklanır.

### Persona belgeleri

- **Persona ayrı yapılandırılmış kayıt türü değildir.** Kullanıcı, hazır Persona Markdown belge şablonundan kalıcı bir proje belgesi oluşturur ve bu belgeyi Contact, Company, Kullanıcı Araştırması Oturumu, Özellik, Geri Bildirim ve Kararla standart ilişkiler üzerinden bağlar. Sistem Contact'ı personaya otomatik atamaz, persona skoru veya ikinci bir persona veri modeli üretmez.

### Bilgi güncelliği

- **Bozuk bağlantı, silinen dış kaynak veya geçersiz içerik yalnız kullanıcının açık `Kaynağı yeniden kontrol et` eyleminin son tarihli sonucunda görünür kılınır.** Sistem arka planda geçerlilik izlemez, zamanlanmış istek göndermez veya kendiliğinden durum değiştirmez. Kullanıcı desteklenen Kaynaklarda bu eylemle tarihli erişim sonucu ve sürüm karşılaştırması oluşturur; sonuç otomatik değişiklik etkisi çıkarmaz, yeni Kaynak sürümü kaydetmez veya kanıt bağlarını taşımaz.

- **Salt zaman geçmesine dayanarak proje profili, varsayım veya belge için staleness bildirimi ya da zorunlu gözden geçirme cadence’i üretmez.**
