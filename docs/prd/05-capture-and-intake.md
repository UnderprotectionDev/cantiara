# Yakalama ve Girdi Yönetimi

Bu belge hızlı yakalama, Yakalama Gelen Kutusu, triage, tarayıcı uzantısı ve tamamlanmamış oluşturma taslaklarının tek normatif sahibidir. Kalıcı kayda dönüşen içeriğin ortak kimlik ve köken kuralları [Domain Modeli ve Yaşam Döngüsünde](02-domain-model-and-lifecycle.md) yaşar.

## Yakalama ve anlamlandırma

### Hızlı yakalama

- **Fikir, not, bağlantı, ekran görüntüsü, geri bildirim veya araştırma parçası hızlıca yakalanabilir.**

- **Varsayılan yakalama serbest biçimlidir.** İlk ürünün isteğe bağlı mini şablon kataloğu aşağıdaki üç biçimle kapalıdır: `Bug Capture` içindeki `Observed Behavior`, `Expected Behavior`, `Reproduction Context`; `Feedback Capture` içindeki `Feedback`, `Channel`, isteğe bağlı `Contact`; `Research Fragment` içindeki `Note or Excerpt`, `Source Context`. Bütün yönlendirici alanlar isteğe bağlıdır ve yakalamayı kaydetmeyi engellemez. Şablon yalnız Yakalama Gelen Kutusu öğesini biçimlendirir; doğrudan Bug, Geri Bildirim, Kaynak veya başka ana kayıt oluşturmaz.

- **Proje ve alan biliniyorsa içerik doğrudan ilgili alana alınabilir.**
- **Yalnız proje biliniyorsa projenin Yakalama Gelen Kutusu’na alınır.**
- **Proje bilinmiyorsa geçici çalışma alanı Yakalama Gelen Kutusu’na alınır.**

- **Geçici yakalamalar ana kayıt, normal arama sonucu, planlama girdisi, kalıcı ilişki ucu, paylaşım/yayın öğesi veya export girdisi olmaz; uzun süreli depolama ya da ikinci Backlog değildir.** `Geçici` otomatik süre sonu anlamına gelmez: Yakalama kullanıcı üç açık triage çıkışından birini seçene veya açıkça silene kadar zaman geçtiği için silinmez.

- **Yakalama Gelen Kutusu odaklı bir triage görünümü sunar.** Bu görünüm özgün yakalamayı ve kökenini, benzer kayıt önerilerini ve aşağıdaki üç çıkışı aynı işlem yüzeyinde bir araya getirir. Geçici yakalamaya iş durumu, öncelik, planlama üyeliği veya kalıcı erteleme davranışı eklemez.

Her yakalamanın üç açık çıkışı vardır:

1. **Yeni kalıcı içeriğe dönüştürmek**
2. **Mevcut ana kayda köken veya kanıt olarak bağlamak/birleştirmek**
3. **Silmek**

- **Kullanıcı isteğe bağlı `Sıralı triage` modunda tek yakalamaya odaklanabilir.** Mod, ancak kullanıcı mevcut yakalamayı yukarıdaki üç çıkıştan biriyle açıkça çözdükten sonra sıradaki öğeye ilerler; önceki öğeye dönme ve moddan liste görünümüne çıkma olanağı sunar. Kaydı yalnız görüntülemek, alan düzenlemek veya öneriyi kapatmak ilerleme sayılmaz. Sıralı mod yeni kuyruk, sahiplik, SLA veya otomatik çözüm üretmez.

- **Kullanıcı tekil triage'a alternatif `Toplu Anlamlandırma` görünümünde birden fazla yakalamayı yan yana getirip geçici görsel kümeler kurabilir.** Küme adları, kart konumları ve yerleşim yakalamalar çözümlenene kadar görünüm üstverisi olarak oturumlar arasında korunur; ana kayıt, etiket, ilişki veya kalıcı sınıflandırma oluşturmaz. Bu üstveri arama, planlama, paylaşım, yayın ve dışa aktarmaya girmez. Her yakalama yine yukarıdaki üç çıkıştan tam olarak biriyle sonuçlanır ve çözümlenen yakalamanın geçici yerleşim üstverisi kaldırılır.

- **Triage sırasında sistem isteğe bağlı ve akışı engellemeyen benzer kayıt önerileri gösterebilir.** Her öneri eşleşmenin başlık, metin, bağlantı veya ilişkili bağlam gibi hangi görünür dayanaklardan üretildiğini açıklar. Kullanıcı öneriyi atlayabilir; sistem kullanıcı onayı olmadan kayıt birleştirmez, yeni ilişki kurmaz veya yakalamanın hedefini değiştirmez.

- **Projesi bilinen bir yakalamada aynı projedeki sonuçlar birincil gösterilir.** Başka projelerdeki olası eşleşmeler proje adları açık, ayrı ve ikincil bir bölümde sunulur; başka projedeki kayda bağlama hedef proje ve oluşacak ilişki önizlenmeden uygulanmaz. Projesi bilinmeyen çalışma alanı Yakalama Gelen Kutusu’nda öneriler proje bazında gruplanır.

- **Yeni kalıcı içeriğe dönüşüm tek seferde tam olarak bir yeni ana kayıt oluşturur.** Markdown Belgesi açık dönüşüm hedeflerinden biridir. Tek onayla bir Araştırma işi ile Kaynak Kaydı gibi birden fazla yeni kayıt üreten sabit dönüşüm reçeteleri ilk üründe bulunmaz. Kullanıcı gerekli diğer kayıtları daha sonra açıkça oluşturup ilk kayda bağlayabilir.

- **Dönüşüm ve birleştirmede özgün mesaj, bağlantı, ek, yakalanma tarihi ve köken korunur.** Geçici yakalama bağımsız planlanamaz, paylaşılamaz veya kalıcı snooze davranışı kazanamaz. Daha sonra ele alınacak konu kalıcı işe dönüştürüldükten sonra işin `Yeniden görünme tarihi` kullanılır.

- **Mevcut ana kayda yapılan birleştirme kayıt geçmişinden geri alınabilir.** Geri alma uygulanmadan önce özgün yakalamanın triage’a hangi metin, bağlantı, ek, tarih ve köken bilgileriyle döneceği ve yalnız bu birleştirmenin oluşturduğu hangi bağların veya alan değişikliklerinin kaldırılacağı gösterilir. Hedef kayıtta birleştirmeden sonra yapılan ilgisiz düzenlemeler geri sarılmaz.

- **Yakalamadan kalıcı kayda ve daha sonra işe uzanan dönüşüm adımları, ilgili kayıt detaylarında tarihli ve kompakt bir köken izi olarak gösterilir.** İz mevcut dönüşüm olayları ve kayıtlı ilişkilerden türetilir; her adım kaynak kaydı açar. Dönüşüm gerekçesi zorunlu değildir ve sıradan dönüşümler bildirim ya da genel proje zaman çizelgesi olayı üretmez.

- **Dönüşüm doğrulamasında özgün metin, bağlantı veya ekran görüntüsü ile önerilen kalıcı kayıt aynı yüzeyde karşılaştırılabilir.** Mini şablon kullanılan yakalamalarda da kalıcı kayıt türü, alan eşlemeleri ve oluşacak ilişkiler dönüşüm uygulanmadan önce önizlenir.

- **İlk üründe yakalama uygulama içinden veya aşağıda tanımlanan dar Web Clipper'dan başlatılır.** E-posta, Slack, Siri veya benzeri diğer uygulama dışı giriş kanalları Yakalama Gelen Kutusu’na içerik göndermez; destek konuşmaları, inceleme kanalları veya başka dış kaynaklar sürekli taranarak otomatik geri bildirim adayı oluşturulmaz.

### Tarayıcı uzantısıyla web yakalama

- **İlk ürün Web Clipper yalnız kullanıcının açık eylemiyle mevcut sayfanın URL'sini, seçili metni, seçili görseli veya kullanıcının başlattığı ekran görüntüsünü yakalar.** Uzantı sayfaları arka planda taramaz, gezinme geçmişini toplamaz, içerikten kendiliğinden geri bildirim ya da kayıt adayı çıkarmaz ve yakalamayı doğrudan ana kayda dönüştürmez.

- **Gönderimden önce yakalanacak içerik, köken URL'si ve hedef proje veya çalışma alanı Yakalama Gelen Kutusu birlikte önizlenir.** Hedef yalnız yakın zamanda açılmış projelerle sınırlı değildir; kullanıcı yetkili projelerini arayabilir. Hassas sayfa veya geniş içerik okuma izni gerektiğinde okunacak kapsam ve risk eylemden önce açıkça gösterilir; reddedilen izin yakalamayı sessizce genişletmez.

- **Web Clipper ilk üründe Chromium ailesini — Chrome, Edge, Brave ve Arc — ve Mozilla Firefox'u destekler.** Safari desteklenmez. İki tarayıcı ailesindeki izin ve paket farkları aynı kullanıcı davranışını ve veri sınırını değiştirmez. Uzantı da online-only sınırına uyar; yerel çevrimdışı gönderim kuyruğu tutmaz.

- **Uzantı hesaba uygulama içinde üretilen, beş dakika geçerli tek kullanımlık bağlantı koduyla bağlanır.** Uzantı bağlantısı hesap güvenlik ekranında cihaz adı, tarayıcı ve son kullanım zamanıyla görünür ve ayrı ayrı iptal edilebilir. Hesabı kapatma bütün uzantı bağlantılarını iptal eder; 30 gün kullanılmayan bağlantı yeniden yetkilendirme ister.

- **Uzantı kalıcı bütün-site okuma izni istemez.** Yalnız kullanıcının açıkça başlattığı yakalamada aktif sekme, seçili metin veya ekran görüntüsü için gereken en dar tarayıcı iznini kullanır. Yetki anahtarı sayfa içeriğine enjekte edilmez, loglanmaz veya yakalama payload'ına eklenmez. Yüklenen görsel ve dosyalar ortak tür, boyut, MIME/uzantı ve kota kurallarına uyar.

- **Her gönderim uzantı bağlantısı kapsamında idempotency anahtarı ve URL, seçili içerik ile eklerin kesin parmak izini taşır.** Aynı anahtar ve aynı parmak iziyle yeniden deneme önceki sonucu döndürür; içerik değişmişse çatışma gösterir. Finalize anında uzantı bağlantısının iptal/yeniden yetkilendirme epoch'u, hedef kapsam ve kota tekrar denetlenir. Bağlantı finalize öncesi iptal edilmişse hiçbir ana kayıt veya Yakalama öğesi yazılmaz; atomik commit tamamlandıktan sonra iptal edilen bağlantı daha önce kabul edilmiş kaydı ve denetim izini silmez fakat yeni yazma veya genişletilmiş erişim vermez.

### Tamamlanmamış oluşturma taslakları

- **Kullanıcı ayrıntılı yeni İş oluşturma formunu doldururken bağlantı mevcut olduğu sürece girdi değişiklikleri hafif bir `Taslak` olarak otomatik korunur.** Taslak yalnız tamamlanmamış form durumudur; kullanıcı açıkça `Oluştur` eylemini tamamlayana kadar kalıcı İş kaydı, iş anahtarı, etkinlik olayı veya Yakalama Gelen Kutusu öğesi oluşmaz.

- **Taslaklar ayrı ve kişisel bir `Taslaklar` yüzeyinden sürdürülebilir veya açıkça silinebilir.** İlk üründe kendiliğinden süre aşımına uğramazlar. Normal arama, Backlog, Kanban, Akıllı Koleksiyon, ilişki, bildirim, paylaşım, yayın ve dışa aktarma yüzeylerine girmez; başka kayıtlar taslağa kalıcı ilişki kuramaz.

- **Yakalama Gelen Kutusu kullanıcının kaydettiği fakat henüz sınıflandırmadığı bir girdiyi, Taslak ise henüz kaydedilmemiş ayrıntılı oluşturma formunu temsil eder.** Taslağı tamamlamak tek bir kalıcı İş kaydı oluşturur ve taslağı kaldırır; taslağı silmek herhangi bir ana kaydı etkilemez. Online-only sınırı geçerlidir: bağlantı kesildiğinde son başarılı otomatik kayıt zamanı ve henüz sunucuya yazılmamış değişiklik riski görünür biçimde gösterilir.
