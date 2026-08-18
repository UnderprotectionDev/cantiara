# Keşif, Kararlar ve Tasarım

Bu belge Karar, Risk, Varsayım, Açık Soru, kullanıcı araştırması, Ekran, Kullanıcı Akışı, Wireframe yüzeyi ve Moodboard davranışlarının tek normatif sahibidir. Proje Duvarı davranışları [Çalışma Alanı ve Projelerde](04-workspace-and-projects.md#proje-duvarı), Teknik Diyagram ve veri modeli/migration davranışları [Teknik Diyagramlar ve Şema Artefaktlarında](11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar), ortak kayıt ve ilişki invariantları [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md) yaşar. Ortak canvas mekanikleri bu yüzeylerin nesne dilini veya kalıcı içerik sahipliğini birleştirmez.

## Kararlar, belirsizlikler ve iş bağlamı

### Karar kayıtları

- **Karar kayıtları alınmış önemli ürün, tasarım ve geliştirme seçimlerini; gerekçelerini, ilişkilerini ve değişim geçmişini korur.**

- **Kullanıcı değerlendirdiği alternatifleri gerekçe içinde anlatabilir ve mevcut ana kayıtlara standart ilişkiler kurabilir.** İlk ürün ayrı bir yapılandırılmış alternatif seti, seçenek oylaması, puanlama veya otomatik kazanan üretmez.

- **Karar `Geçerli`, `Yerine geçildi` veya `Geri çekildi` yaşam durumunu taşır.** Mevcut ve içe aktarılan durum değeri bulunmayan Kararlar `Geçerli` kabul edilir. `Yerine geçildi` durumu yalnız aşağıdaki açık tam yerine-geçme ilişkisiyle oluşur; doğrudan seçilip ilişkisiz eski Karar üretilemez. `Geri çekildi`, yerine yeni Karar alınmadan kullanıcının seçimi artık yürürlükte tutmadığını tarihli ve isteğe bağlı gerekçeyle belirtir.

- **Kullanıcı yeni veya mevcut `Geçerli` Kararda `Başka kararın yerine geçir` eylemini başlatabilir.** Önizleme yeni Kararı, tamamen yerine geçilecek bir veya birden fazla eski Kararı, her iki tarafın gerekçe ve kanıt özetlerini, değişecek yaşam durumlarını ve isteğe bağlı geçiş gerekçesini gösterir. Açık onay tek atomik işlemde yönlü `Yerine geçer / Yerine geçildi` ilişkisini kurar ve eski Kararları `Yerine geçildi` yapar. Yeni Kararın tarihi ile geçiş olayının zamanı ayrı korunur.

- **Her eski Kararın en fazla bir doğrudan yerine geçen Kararı olabilir; yeni Karar birbiriyle uyumlu birden fazla eski Kararı tamamen yerine alabilir.** Sistem kendi üzerine ilişkiyi, döngüyü veya aynı zincirde çelişkili fork'u uygulamadan önce engeller. Yalnız kararın bir kısmı değişiyorsa tam yerine-geçme ilişkisi kullanılmaz; kullanıcı kapsamı ayrı Kararda açıklar ve normal `İlgili` ilişkisini kullanır.

- **Karar detayı en eski kayıttan güncel `Geçerli` Karara kadar açılabilir kronolojik zinciri gösterir.** `Yerine geçildi` Kararın üst bölümünde güncel doğrudan/nihai Karar, geçiş zamanı, gerekçesi ve `Güncel kararı aç` eylemi görünür; eski içerik, kanıt rolleri, kullanıcı yorumları, ilişkiler ve değişiklik geçmişi salt okunur tarihsel bağlam olarak erişilebilir kalır. Arama ve `Tüm Kararlar` varsayılan olarak Geçerli Kararları öne çıkarır; eski ve geri çekilmiş Kararlar durum filtresiyle bulunabilir.

- **Yerine-geçme ilişkisi eski Kararın bağlı İş, Özellik, Risk, Varsayım, Açık Soru, Test, Proje Sürümü, belge, GitHub kaydı veya başka ilişkilerini yeni Karara kopyalamaz ya da taşımaz.** Bu kayıtların durumu, önceliği, içeriği, planlaması, otomasyonu ve bildirimleri değişmez. `Çelişiyor` Kanıt Rolü yerine-geçme işlemini başlatmaz; sistem kanıttan yeni Karar veya geçiş önerisi üretmez.

- **Kullanıcı ilişkiyi kaldırmak isterse önizleme etkilenecek zinciri ve yaşam durumlarını gösterir.** İlişki kaldırıldığında eski Karar ancak başka doğrudan halefi yoksa açık onayla yeniden `Geçerli` olur; yeni Karar silinmez ve ilgisiz sonraki düzenlemeler geri alınmaz. Kurma, kaldırma ve geri çekme olayları kullanıcı, zaman, gerekçe ve önceki–sonraki değerlerle değişiklik geçmişinde korunur.

- **Bağlantıyla sınırlı paylaşım veya herkese açık yayın eski Karar, güncel Karar ve yerine-geçme ilişkisini ortak kapalı dünya kapsamında ayrı ayrı önizler.** Daha önce yayımlanmış bir Karar yeni geçiş nedeniyle sessizce güncellenmez veya yönlendirilmez; yeni snapshot açık fark ve onay gerektirir. Desteklenen yapılandırılmış JSON içe/dışa aktarma seçili Kararların kimliklerini, yaşam durumlarını, döngüsüz zincirini ve geçiş olaylarını korur.

### Risk takibi

- **Risk kaydı başlık, açıklama, etki, olasılık, yanıt/azaltma planı ve ilgili kayıtları taşır.** Durumu [ortak domain sözleşmesindeki](02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler) `Açık`, `Azaltılıyor`, `Gerçekleşti`, `Çözüldü` veya `Kabul edildi` değerlerinden biridir. Durum yalnız açık kullanıcı eylemiyle değişir; bir Riskin gerçekleşmesi veya çözülmesi ilişkili İş, Proje Sürümü ya da Projeyi otomatik değiştirmez.

- **Riskler Proje Genel Bakışı, Manuel Proje Güncellemeleri, planlama ve yayın hazırlığı bağlamında görünür olur.** `Kabul edildi` durumu riskin ortadan kalktığını değil, kullanıcının bilinen riski açık gerekçeyle kabul ettiğini gösterir.

### Varsayım ve açık soru takibi

- **Doğrulanmamış kabuller `Varsayım`, yanıt bekleyen belirsizlikler `Açık Soru` olarak ilişkili içeriklerle izlenir.** Varsayım `Açık`, `Doğrulandı`, `Çürütüldü` veya `Geçersiz kaldı`; Açık Soru `Açık`, `Yanıtlandı` veya `Geçersiz kaldı` durumunu taşır. `Doğrulandı`, `Çürütüldü` ve `Yanıtlandı` geçişlerinde kullanıcı kesin kanıt veya isteğe bağlı gerekçe ekleyebilir; eksik kanıt geçişi engellemez ancak açıkça görünür kalır.

- **Bu kayıtlar kullanıcı eylemi olmadan Riske, Karara veya İşe dönüşmez.** Durum değişikliği ilişkili kayıtların yaşam döngüsünü değiştirmez.

### İş bağlamı

- **Bir işin problem kaynağı, ilgili araştırması, beklenen sonucu ve sonradan edinilen öğrenimi iş bağlamında birlikte saklanabilir.** Bu alanlar zengin bağlam sağlar ancak yeni iş oluşturmayı engelleyen zorunlu form alanları değildir.

- **İş detayı `Kanıt ve Bağlam` alanında `Birincil spec`, `İlişkili belgeler`, `Dosya ekleri` ve `Kanıt ve kararlar` gruplarını birlikte sunar.** Son grup Kaynak, Geri Bildirim, araştırma, Varsayım, Açık Soru, Risk ve Karar ilişkilerinden türetilir. Alan “bu iş hangi belge, kanıt ve karardan doğdu?” sorusunu taranabilir biçimde yanıtlar; içeriği kopyalamaz ve her öğeyi mevcut özgün kaydında açar.

- **Kullanıcı aynı alandan mevcut belge veya eki ilişkilendirebilir ve yeni proje belgesi oluşturabilir.** Boş gruplar kısa ekleme eylemleriyle gösterilir; arşivlenmiş öğeler durumlarıyla görünür, çöp kutusundaki veya erişilemeyen öğeler içerik sızdırmadan çözülemeyen ilişki olarak belirtilir. Alan ayrı fikir/Insight yaşam döngüsü, Spark sohbeti, oy, otomatik puan veya yeni bir doğruluk kaynağı oluşturmaz.

### Deney ve doğrulama kayıtları

- **Bir varsayım veya açık sorunun hangi yöntemle doğrulandığı, elde edilen sonuç ve sonuçla ilişkili karar bağlam içinde saklanabilir.** Bu kayıtlar ürün varsayımlarını ve kullanıcı problemine ilişkin belirsizlikleri doğrulamaya yöneliktir; [test süreç ve sonuç yönetimi kayıtlarının](10-testing-and-validation.md#test-süreç-ve-sonuç-yönetimi) yerine geçmez.

- **Bu kayıtlar kullanıcının uygulama dışında yürüttüğü doğrulamayı belgeleyebilir; ürün ilk üründe dış katılımcı anketi, süreli oy toplama veya sürekli geri bildirim döngüsü yürütmez.**

### Kullanıcı Araştırması Oturumları

- **`Kullanıcı Araştırması Oturumu`, tek bir kullanıcı görüşmesi veya yönlendirilmiş araştırma temasının amaç–katılımcı–not–kanıt bütünlüğünü proje kapsamında koruyan ana kayıttır.** Oturum; başlık, araştırma amacı, soru rehberi, isteğe bağlı tarih/saat ve süre, kanal, kolaylaştırıcı, kapsam notu ve ilgili Araştırma türündeki İş, Varsayım, Açık Soru, Geri Bildirim, Persona Belgesi, Özellik ve Karar ilişkilerini taşıyabilir.

- **Katılımcı biliniyorsa oturum mevcut Contact ve isteğe bağlı Company kaydına bağlanabilir; kimliği bilinmeyen veya saklanmaması gereken görüşme Contact oluşturmaya zorlanmaz.** Oturum `Planlandı`, `Tamamlandı` veya `İptal edildi` durumunu taşır. Bu durum takvim etkinliği, davet, attendance, CRM aşaması, araştırma ilerleme puanı veya zorunlu görüşme süreci oluşturmaz.

- **Oturum, notların veya katılımcıya ait özgün ifadelerin üründe saklanmasına ilişkin `Sorulmadı`, `İzin verildi`, `İzin verilmedi` veya `Uygulanamaz` izin bağlamını; isteğe bağlı kısa açıklama, kaydeden kullanıcı ve zamanla korur.** `İzin verilmedi` seçildiğinde katılımcıya atfedilen özgün ifade, tanımlayıcı kişisel not veya dosya eki kaydedilemez ve paylaşım/yayın kapsamına alınamaz. İzin alanı hukuki uygunluk hükmü üretmez; kullanıcı yürürlükteki yükümlülüklerinden sorumludur.

- **Kullanıcı görüşme sırasında veya sonrasında kronolojik notlar, gözlenen davranışlar, katılımcının özgün ifadeleri ve kendi yorum/öğrenimlerini kaydedebilir.** `Katılımcı ifadesi`, `Gözlem` ve `Kullanıcı yorumu/öğrenimi` içerik türleri görsel ve dilsel olarak ayrılır; sistem bir yorumu katılımcının sözü gibi sunmaz, nottan duygu/tema çıkarmaz veya otomatik öğrenim üretmez. Katılımcıya atfedilen ifade isteğe bağlı konuşmacı etiketi taşır ancak Contact bilgisi erişim sınırı dışında sızdırılmaz.

- **Desteklenen bir not bölümü veya özgün ifade, mevcut sürüme sabit metin kanıtı mekanizmasıyla Geri Bildirim, Varsayım, Açık Soru, Özellik/İş veya Karara bağlanabilir.** Bağ kesin Oturum sürümünü ve metin aralığını sabitler; oturum notu sonradan değiştiğinde eski kanıt sessizce güncellenmez. Kullanıcı açık dönüşüm önizlemesiyle seçili nottan Geri Bildirim, Varsayım, Açık Soru, İş veya Karar oluşturabilir; hedef tür/proje, alan eşlemesi ve köken bağı onaylanmadan kayıt oluşmaz.

- **İlk ürün kapsamı ses/video kaydı başlatmaz, toplantı planlamaz, davet veya hatırlatma göndermez, otomatik transkripsiyon/özet/tema analizi yapmaz ve araştırma katılımcısı paneli oluşturmaz.** Dışarıda üretilmiş desteklenen dosya yalnız normal Dosya Eki olarak açık yükleme, erişim ve izin kurallarıyla ilişkilendirilebilir; dosyanın varlığı transkript veya kanıt bağı üretmez.

- **Kullanıcı Araştırması Oturumu arama, filtreleme, Table, Akıllı Koleksiyon, ilişki, geri bağlantı, değişiklik geçmişi ve desteklenen standart JSON içe/dışa aktarma kurallarına katılır.** Bağlantıyla sınırlı paylaşım veya herkese açık yayın; Contact/Company kimliği, izin bağlamı, her not bölümü, kesin kanıt ve eki ortak kapalı dünya kapsamında ayrı ayrı önizler. İzin verilmeyen ya da onaylanmayan içerik, konuşmacı etiketi, boşluk, sayı veya ilişki ipucuyla sızdırılmaz.

## Tasarım bağlamı

<a id="wireframeler"></a>
### Ekranlar ve Wireframe yüzeyi

- **Kullanıcı kuşbakışı deneyim adımlarını Kullanıcı Akışı editöründe, tek ekranın içerik ve etkileşim düzenini ise Ekrana ait düşük görsel sadakatli Wireframe yüzeyinde tasarlayabilir.** Kullanıcı Akışı ve Wireframe yüzeyi ayrı fakat sıkı bağlı editörlerdir: akış hedefe giden davranış ve karar yolunu, Wireframe yüzeyi tek Ekranın görsel düzenini çözer.

- **`Ekran`, Proje kapsamında bağımsız kimlik, geçmiş, ilişki ve yaşam döngüsü taşıyan ana kayıttır; yalnız başlıkla, henüz görsel tasarımı olmadan oluşturulabilir.** Wireframe Ekranın düşük sadakatli görsel düzenleme yüzeyi ve sürüm zinciridir; bağımsız ana kayıt, ayrı kapsam veya Ekrandan ayrı arşiv/silme yaşamı kazanmaz. Ekranı arşivleme, Çöp Kutusuna alma ve geri yükleme ortak ana kayıt davranışını izler; kesin Wireframe sürümleri tarihsel olarak Ekrana bağlı kalır.

- **Bir ekranı temsil eden Kullanıcı Akışı düğümü bağımsız Ekran kopyası oluşturmaz; aynı Ekran ana kaydına canlı referans verir, varsa seçilen güncel Wireframe sürümünün küçük önizlemesini gösterebilir ve tek eylemle Ekranın Wireframe editörünü açar.** Akışa özgü açıklama, geçiş, koşul ve karar bilgisi düğümde kalır. Kaynak Ekran arşivlenirse düğüm onu `Arşivlendi` durumuyla göstermeye ve kaynağı açmaya devam eder. Ekran Çöp Kutusuna alınır, kalıcı silinir veya erişilemez olursa düğüm sessizce boşalmaz ya da başka Ekrana bağlanmaz; ortak kırık/çözülemeyen referans davranışını gösterir.

- **Kullanıcı Akışı `Ekran`, `Eylem`, `Karar`, `Durum/Sonuç` ve `Bölüm` gibi küçük, sabit bir semantik öğe kümesi kullanır.** Metin ve sınırlı erişilebilir görsel stil değiştirilebilir; keyfî şekil veya renge ürün semantiği yüklenmez. Çoklu seçim, pan, zoom, görünümü/seçimi sığdırma, hizalama, katman sırası, grid desteği, copy/paste, klavye alternatifleri ve güvenli undo bu uzman editörlerin ortak kabul davranışlarıdır.

- **Koşullar, durum değişimleri, form davranışları, basit animasyonlar ve değişkenler prototiplenebilir.** Deneyim uygulamada tıklanabilir biçimde önizlenebilir ve Ekran paylaşımı [bağlantıyla sınırlı paylaşım sözleşmesini](14-sharing-and-public-publishing.md#bağlantıyla-sınırlı-salt-okunur-paylaşım) izler. Düşük detaylı adımlar daha ayrıntılı Ekranlara dönüştürülebilir; ekran geçişleri, alternatif akışlar, sürümler ve ilgili kararlar birlikte korunabilir.

- **Wireframe Presentation Mode, editör araçlarını gizleyerek seçilen başlangıç Ekranından bağlantıları izleyen tam ekran ve salt okunur prototip gezinmesi sunar.** PNG ve SVG çıktısı seçili öğeleri veya Ekranı; PDF ve tek dosyalı interaktif HTML çıktısı seçilen Ekranları ve aralarındaki desteklenen bağlantıları kesin Wireframe sürümlerinden üretir. Sunum görünümü veya export yeni içerik doğruluk kaynağı oluşturmaz; çözülemeyen hedefi sessizce başka bir Ekrana yönlendirmez.

- **İlk ürün ayrı desktop/mobile varyant yönetimi sunmaz.** Olası cihaz varyantlarının sınırı [Gelecek Yönleri](18-future-directions.md#wireframe-cihaz-varyantlari) belgesindedir.

- **Proje kapsamlı düşük detaylı bağlı Wireframe block'ları tekrar eden header, navigation veya benzeri yapıları birden fazla ekranda aynı kaynak tanımıyla gösterebilir.** Kaynak block değişikliği uygulanmadan önce etkilenecek ekranlar görünür olur; her örnek açık `Bağlantıyı ayır` eylemiyle o andaki içeriği taşıyan bağımsız block'a dönüştürülebilir. Bu mekanik production component, tasarım token'ı veya projeler arasında canlı component bağlantısı oluşturmaz.

- **Wireframe metin block'u bağımsız placeholder metni taşıyabilir veya bir Markdown belge bölümüne canlı referans verebilir.** Canlı referans ikinci bir metin doğruluk kaynağı oluşturmaz. Kaynak bölüm silinir veya çözülemezse block sessizce boşalmaz; kırık referansı gösterir. Kaydedilmiş tasarım sürümü o anda gösterilen metni okunabilir tarihsel bağlam olarak korur ve güncel canlı kaynağa ayrıca geçiş sunar.

- **Kullanıcı seçili Kullanıcı Akışı yapısını veya Ekranın kesin Wireframe sürümünü projeler arasında kullanılabilen özel şablon olarak saklayabilir.** Şablon; yapı, yer tutucu ve düşük detaylı bağlı block tanımlarını taşıyabilir; kaynak projenin İş, Karar, Risk, ilişki, yayın durumu veya çalışma geçmişini taşımaz. Wireframe şablonundan üretim hedef Projede yeni Ekran ana kaydı oluşturur; üretilen tasarım kaynak projeyle canlı bağlantı kurmaz.

- **Desteklenen Ekranların Wireframe yüzeylerine ve Kullanıcı Akışı yüzeylerine mevcut İş, Karar veya Risk kaydı salt okunur canlı kart olarak yerleştirilebilir.** Kart başlık, durum ve az sayıda temel sinyali ana kayıttan gösterir ve ortak `Kaynak kaydı aç` eylemiyle kaynağa gider. Kartı tuvalde taşımak ya da kaldırmak kaynak kaydın alanlarını, planlamasını, durumunu veya diğer ilişkilerini değiştirmez.

- **Kullanıcı mevcut ana Kullanıcı Akışı düğümü, Ekranın kesin Wireframe sürümündeki block veya desteklenen kesin görsel konumunda ortak `Kayda dönüştür ve bağla` eylemini başlatabilir.** Akış tam olarak bir yeni İş, Karar, Risk veya Açık Soru taslağı oluşturur; uygulamadan önce hedef tür ve proje, başlangıç başlık/gövde eşlemesi, kesin kaynak tasarım/dosya sürümü, düğüm/block/konum kimliği ve oluşacak iki yönlü köken ilişkisi gösterilir. Kullanıcı taslağı düzenleyip onaylamadan ana kayıt oluşmaz; kaynak tasarım öğesi yerinde kalır ve görünümü, semantiği veya içeriği değiştirilmez.

- **Dönüşüm AI kullanmaz, tek eylemde birden fazla kayıt üretmez ve normal tür/alan kurallarını atlamaz.** Kaynak tasarımın yeni sürümü oluştuğunda ilişki sessizce taşınmaz; eski kesin köken okunabilir kalır ve yeniden bağlama açık önizleme gerektirir. Bu ortak eylem Proje Duvarına geçici sticky note, Aha! shape, duvara özgü kayıt veya kaydın alanlarını mekânsal hareketle değiştiren smart-zone davranışı eklemez.

- **Karar, Risk ve Açık Soru kayıtları bir Ekranın kesin Wireframe sürümündeki block'a veya akış düğümünün kesin sürümüne bağlanabilir.** Yeni Wireframe veya akış sürümü bu bağı sessizce güncele taşımaz; eski sürümde okunabilir tutar ve kullanıcıya kaynak ile hedef sürümü gösteren açık yeniden bağlama sunar.

- **Wireframe yüzeyi düşük sadakatli akış, durum ve davranış modellemesinde uzmanlaşır.** Canlı kayıt kartları yüzeyi genel amaçlı whiteboard’a veya planlama panosuna dönüştürmez. Nihai renk/font/ikon sistemi, pixel-perfect yüksek detaylı görsel tasarım, production component’leri, tasarım token’ları, Figma aktarımı ve geliştirici handoff üretmez. AI destekli Kullanıcı Akışı/Wireframe üretimi ilk üründe yoktur; yalnız [kapılı gelecek değerlendirme adayı](18-future-directions.md#ai-destekli-wireframe-ve-prototype-taslağı), manuel tasarım akışı ve ilk dar AI adayının dogfooding kanıtından sonra ayrıca açılabilir.

### Moodboard ve görsel yön

- **Moodboard proje veya özellik türündeki iş için görsel referansları ve seçilen tasarım yönünü toplar.** Ekran akışı veya etkileşim prototipi üretmez; görsel referans bağlamını korur.

- **Her görsel isteğe bağlı kısa altyazı ve kaynak bağlamı taşıyabilir.** Altyazı yorum dizisi, reaksiyon, görev, mention veya ikinci bir dosya açıklaması doğruluk kaynağı oluşturmaz.

- **Moodboard birinci sınıf `Renk Örneği` öğeleri ve palet grupları taşır.** Kullanıcı renk seçiciyle veya kesin bir Moodboard görselinden eyedropper ile renk alabilir, HEX/RGB/HSL değerlerinden seçtiğini gösterebilir ve kısa açıklama ekleyebilir. Palet görsel yön bağlamıdır; proje teması, özel CSS, production tasarım token'ı, kalıcı özel alan veya Proje Duvarı kart vurgusu oluşturmaz. Moodboard içeriğinden otomatik renk önerme ve yerleşik stok görsel arama ilk üründe bulunmaz.

- **Kullanıcı Moodboard'daki görselin yalnız bu görünümdeki sunumunu geri alınabilir biçimde kırpabilir ve 90 derecelik adımlarla döndürebilir.** Dönüşüm kesin Dosya Eki sürümüne bağlı görünüm üstverisidir; özgün dosyayı, sürüm zincirini veya aynı eki kullanan diğer görünümleri değiştirmez. Moodboard PNG/PDF çıktısı düzenlenmiş görünümü kullanır, özgün dosya indirilebilir kalır.

- **Moodboard düzenleme araçlarını gizleyen Sunum Kipini ve isteğe bağlı görünüm-yerel odak sırasını destekler.** Odak sırası ayrı sunum belgesi veya içerik kopyası oluşturmaz.

- **Moodboard seçili grup veya bölge snapshot'ını destekler.** PNG/PDF sayfalama, kapsam önizlemesi ve canlı kaynak sınırı [ortak görsel bölge snapshot sözleşmesini](13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) izler; çıktı Moodboard'a özgü kırpma ve döndürme üstverisini kullanır.
