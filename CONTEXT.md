# Cantiara — Kişisel Proje İşletim Sistemi

Tek kurucunun yazılım projelerindeki kalıcı bağlamı, sahipliği ve yaşam döngüsünü tek doğruluk kaynağında tutan Cantiara'nın ortak domain dili.

Bu sözlük ürün-geneli ortak dildir, kapsam kaynağı değildir. Bir terimin burada tanımlı olması onu ilk ürün kapsamına almaz; kapsamın tek sahibi [Ürün Vizyonu ve Kapsamı](docs/prd/01-product-vision-and-scope.md#kapsam-dili) ile ilgili ürün alanı belgeleridir. Sözlük ayrıca [gelecek yönlerinde](docs/prd/18-future-directions.md) ve [ticari genişlemede](docs/prd/17-commercial-expansion.md) tartışılan terimleri de taşıyabilir.

Bu sözlüğün açıklama dili Türkçedir; Cantiara'nın ilk ürün arayüzü İngilizcedir. Türkçe domain terimi PRD tartışmasını, [ortak PRD sözlüğündeki İngilizce UI etiketi](docs/prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) kullanıcıya gösterilen kesin adı taşır. Locale tarih, saat ve sayı biçimini değiştirir; arayüz dilini veya kullanıcı içeriğini çevirmez.

## Sahiplik ve kayıt yapısı

**Sahiplik kapsamı**:
Bir ana kaydın erişim, yaşam döngüsü ve taşınabilirlik sınırını belirleyen tek kanonik bağlam. Yalnız Hesap, Çalışma Alanı, Proje veya Kişisel Wiki olabilir.
_Avoid_: Proje bağlantısı kapsamı, kaynak kapsamı, hesap + kaynak kapsamı

**Hesap**:
Kurucunun değişmeyen kimliğini, kişisel tercihlerini ve güvenlik bağlamını taşıyan; çalışma alanı içeriğinden ayrı sahiplik kapsamı.
_Avoid_: Kullanıcı çalışma alanı, profil projesi

**Çalışma Alanı**:
Tek kurucunun projelerini, Kişisel Wiki'sini ve çalışma alanı genelindeki kayıtlarını kapsayan sahiplik sınırı.
_Avoid_: Hesap, organizasyon, ekip

**Proje**:
Belirli bir yazılım ürününe ait iş, belge, karar, risk, tasarım, test, sürüm ve dış geliştirme gerçeklerini kapsayan sahiplik sınırı.
_Avoid_: Repository, çalışma alanı

**Proje kısa kodu**:
Proje adından önerilen, kullanıcı ilk İşi oluşturmadan önce değiştirebildiği ve sonrasında değişmeyen kullanıcıya dönük İş anahtarı öneki. Aynı Çalışma Alanında benzersizdir ve bir Projeye atandıktan sonra değiştirilse veya Proje kalıcı silinse bile başka Projeye verilmez.
_Avoid_: Proje kimliği, değiştirilebilir slug, yeniden kullanılabilir kod

**Proje alanı**:
İlişkili kayıt türlerini tek keşif ve çalışma girişinde toplayan, etkinliği içerik yaşamından ayrı Proje yüzeyi. İlk ürünün yapılandırılabilir kataloğu `Work`, `Documents`, `Discovery`, `Decisions`, `Design`, `Technical Diagrams`, `Tests`, `Releases`, `Production` ve `GitHub` alanlarıdır; `Overview` ile `All Tools` her zaman erişilebilir kalır.
_Avoid_: Kayıt türü, ayrı sahiplik kapsamı, ana menü başına tek tablo

**İşin proje kapsamı**:
Bir İş oluşturulurken seçilen ve İşin yaşamı boyunca değişmeyen kanonik Proje kapsamı. Başka Projeye taşıma, aynı kimliği yeniden kapsamlandırma veya eski Projenin otomasyonunu yeni Projeye sürükleme desteklenmez.
_Avoid_: Taşınabilir İş kapsamı, proje takma adı

**Başka Projede yeniden oluşturma**:
Yanlış Projede oluşturulan bir İşin seçilmiş taşınabilir içeriğinden, hedef Projede yeni kimlikli bir İş oluşturan ve kaynağını görünür biçimde belirten düzeltme. Kaynak İşi taşımaz, silmez veya eski bağlantıları yeni İşe yönlendirmez.
_Avoid_: İşi taşıma, kapsam değiştirme, kimliği koruyan kopya

**Taşınabilir İş ilişkisi**:
Yanlış Projede yeniden oluşturma sırasında hedefi bağımsız yaşayan, türü kapsamlar arası kullanıma açık ve kurucu tarafından açıkça seçilmiş ilişki. Sahiplik, planlama, otomasyon, yayın, ebeveynlik veya kopya-birleştirme yaşam döngüsü taşımaz.
_Avoid_: Bütün ilişkileri kopyalama, Proje bağlamını taşıma, örtük çapraz Proje ilişki

**Proje arşivi**:
Bir Projeyi salt okunur ve hareketsiz duruma getirerek etkin Projelerden ayıran, Proje silmenin yalnızca içinden başlatılabildiği zorunlu ara yaşam döngüsü durumu. Proje ile kapsamındaki kayıtlar aynı sahiplik sınırında kalır; önceden onaylanmış değişmez Dış yüzeyler ayrıca iptal edilmedikçe yaşayabilir.
_Avoid_: Çöp Kutusu, kalıcı silme, Projeyi gizleme filtresi

**Arşiv güvenlik istisnası**:
Arşivli Projede normal yazmalar kapalıyken yalnız erişimi azaltan iptal, secret rotasyonu, oturum sonlandırma, entegrasyon kesme ve güvenlik redaksiyonuna izin veren denetlenebilir sınır.
_Avoid_: Arşivden normal düzenleme, yeni yayın, erişim genişletme

**Proje silme grubu**:
Arşivden silinen Proje ile Projeye ait bütün ana kayıt, sahipli bileşen ve Dış yüzeylerin tek geri yüklenebilir ya da tek kalıcı silinebilir sınırı. Proje Çöp Kutusuna girince kapsanan yüzeyler terminal iptal edilir; geri yükleme eski URL/token'ı yeniden yayımlamaz. Grup içindeki öğeler ayrı yaşam döngüsü kazanmaz.
_Avoid_: Proje kabuğunu silme, bağımsız çocuk silme, kısmi Proje geri yükleme

**Silinmiş hedef işareti**:
Bir ilişkinin sahibi yaşarken karşı ucunun Çöp Kutusunda veya kalıcı silinmiş olduğunu içerik sızdırmadan gösteren güvenli referans durumu. Geri yükleme aynı kimliği yeniden bağlayabilir; kalıcı silme içeriği veya yeni bir hedefi canlandırmaz.
_Avoid_: Yetim kaydı kopyalama, başka hedefe otomatik yönlendirme, silinmiş başlığı gösterme

**Belge kapsam taşıma seçimi**:
Etkin bir Projedeki Belgeyi, yalnız açıkça seçilen çocuk Belgeler ve aynı kaynağın sahip olduğu Dosya Ekleriyle mevcut kimliklerini koruyarak başka kapsama alan taşıma sınırı. Seçilmeyen veya başka kapsamın sahip olduğu kayıtları ilişki yoluyla sürüklemez.
_Avoid_: Bütün ilişki grafiğini taşıma, Belge kopyası, İş kapsamını değiştirme

**Kişisel Wiki**:
Tek bir projeye ait olmayan kalıcı belgeler ve onların dosya ekleri için sahiplik kapsamı.
_Avoid_: Proje belgeleri, ikinci belge sistemi

**Ana kayıt**:
Bağımsız kimliği, kapsamı, geçmişi ve yaşam döngüsü bulunan; kendi başına adreslenebilen ve ilişkilendirilebilen kalıcı domain kaydı.
_Avoid_: Kart, görünüm satırı, sahipli bileşen

## İş ve planlama

**İş**:
Bir Projede yapılması, araştırılması veya iyileştirilmesi amaçlanan şeyi bağımsız kimlik, durum ve geçmişle taşıyan genel ana kayıt. Özellik, Bug, Görev, Araştırma ve İyileştirme bunun türleridir.
_Avoid_: Görev, ticket, yalnız yapılacak madde

**Özellik**:
Bir kullanıcı yeteneğini veya ürün değişikliğini temsil eden İş türü. Bir seviye altında başka bağımsız İşleri kapsayabilir; iç içe epic veya subtask hiyerarşisi değildir.
_Avoid_: Epic, Proje, Kilometre Taşı

**İş akışı durumu**:
Bir İşin Projede tanımlanan akıştaki güncel yerini gösteren değer. İlk ürünün ortak başlangıç durumları `Not Started`, `In Progress`, `Blocked` ve `Closed` olur; terminal olmayan durumlar arasında serbest geçiş vardır. `Closed` geçişi ayrı Kapanış sonucunu, bu durumdan çıkış açık yeniden açmayı gerektirir; özel geçiş grafiği veya durum kapısı yoktur.
_Avoid_: Kapanış sonucu, planlama görünümü, Proje aşaması

**Kapanış sonucu**:
Bir İşin veya Projenin `Tamamlandı` ya da `Vazgeçildi` olarak nasıl kapandığını kalıcı geçmişiyle belirten sonuç. Yeniden açma etkin sonucu kaldırır fakat önceki sonucu geçmişten silmez.
_Avoid_: İş akışı durumu, arşiv, terminal kolon

**İş Bağlam Kartı**:
Bir İşin kendi alanlarıyla açık doğrudan ilişkilerinden gelen kanıt, karar, risk, bağımlılık, GitHub, test ve sürüm bağlamını kaynaklarında canlı gösteren İş türüne özgü düzen. Aynı İş türü bütün Başlangıç yapılandırmalarında aynı hazır düzeni kullanır; kart içerik kopyası, bağımsız sorgu veya oluşturma/durum kapısı değildir.
_Avoid_: Dashboard, ikinci İş özeti, Başlangıç yapılandırmasına göre farklı İş anlamı

**Başlangıç yapılandırması**:
Yeni Projeye örnek içerik üretmeden aşama, İş akışı durumu, etkin alan, hazır görünüm, sabitlenmiş navigasyon ve İş Bağlam Kartı varsayılanlarını bir kez uygulayan kurulum seçimi. İlk ürün kataloğu `Blank Project`, `Solo SaaS`, `Open Source Library` ve `Mobile Application` seçenekleriyle kapalıdır. Seçim sonradan başka yapılandırmayla değiştirilmez; kullanıcı kurulan parçaları tek tek düzenleyebilir veya başka Projeden yapı kopyalayabilir. Çalışma sırası veya durum geçişi kapısı oluşturmaz.
_Avoid_: Örnek Proje, içerik şablonu, zorunlu workflow, ürün türü

**Blank Project**:
Aşama, uzman görünüm veya Başlangıç iskeleti kurmadan ortak İş durumlarını; `Overview`, `Work`, `Documents` navigasyonunu; `Backlog` ve `Board` görünümlerini sağlayan en küçük Başlangıç yapılandırması. Diğer hazır alanları kapatmaz; `All Tools` üzerinden keşfedilip etkinleştirilmelerine izin verir.
_Avoid_: Yapılandırmasız Proje, boş veri modeli, özellikleri kaldırılmış Proje

**Başlangıç iskeleti**:
Sitemap veya Customer Journey için boş Proje Duvarı; Persona, Retrospective veya Launch Plan için boş Belge yapısı ve açıklayıcı başlıklar kuran içeriksiz başlangıç yardımı. Oluşturulduktan sonra normal Proje Duvarı ya da Belge olarak yaşar; özel kayıt türü, ana kayıt örneği, bulgu, görev, kişi profili veya karar üretmez.
_Avoid_: Başlangıç yapılandırması, içerikli şablon, şablon pazarı

**Kapanış özeti taslağı**:
Kullanıcının seçtiği tamamlanmış kayıtlardan yalnız bölüm başlıkları ve okunabilir kaynak bağlantılarıyla üretilen, kullanıcı düzenleyip kaydedene kadar kalıcı olmayan kapanış Belgesi başlangıcı. Kaynakların yerine geçmez ve sistem yorumu, sonucu veya başarı hükmü üretmez.
_Avoid_: Başlangıç iskeleti, otomatik retrospektif, kapanış ana kaydı

**Proje Hedefi**:
Bir Projenin ulaşmak istediği sonucu ve isteğe bağlı başarı göstergesini taşıyan hafif ana kayıt. Bağlı İşlerden otomatik ilerleme, sağlık veya tamamlanma hükmü üretmez.
_Avoid_: Kilometre Taşı, Proje Sürümü, Key Result

**Kilometre Taşı**:
Bir Projedeki önemli ara sonucu temsil eden planlama ana kaydı. Çalışma penceresi veya yayımlanacak kapsam değildir ve bağlı İşlerin durumunu değiştirmez.
_Avoid_: Odak Dönemi, Proje Sürümü, sprint

**Odak Dönemi**:
Seçili İşlerle çalışmak için geçici bir zaman penceresi ve başlangıç/kapanış kapsam snapshot'ı. Kalıcı kapsam grubu, Kilometre Taşı veya Proje Sürümü değildir.
_Avoid_: Sprint, Kilometre Taşı, Proje Sürümü

**Akıllı Koleksiyon**:
Üyeliği kayıtlar üzerindeki açık filtrelerden canlı türetilen, adlandırılmış görünüm. Manuel üyelik listesi, klasör veya ayrı içerik kaydı değildir.
_Avoid_: Statik liste, klasör, etiket

**Yakalama Gelen Kutusu öğesi**:
Kaydedilmiş fakat henüz kalıcı kayıt türüne ve bağlamına dönüştürülmemiş geçici girdi. Kullanıcı triage edene veya açıkça silene kadar korunur; zaman geçtiği için otomatik silinmez. Ana kayıt, Backlog İşi veya uzun süreli bilgi deposu değildir.
_Avoid_: İş, Taslak, kaydedilmiş bookmark

**Yakalama mini şablonu**:
Bir Yakalama Gelen Kutusu öğesine yalnız isteğe bağlı yönlendirici alanlar ekleyen `Bug Capture`, `Feedback Capture` veya `Research Fragment` biçimi. Şablon seçimi kalıcı Bug, Geri Bildirim, Kaynak ya da başka ana kayıt oluşturmaz ve yakalamayı kaydetmek için alan zorunlu kılmaz.
_Avoid_: Kayıt oluşturma formu, otomatik triage, içerik şablonu

**Taslak**:
Kullanıcı oluşturma eylemini tamamlamadan önce korunan, henüz kaydedilmemiş ayrıntılı İş formu. Kullanıcı kaydedene veya açıkça silene kadar zaman sınırı olmadan korunur; Yakalama Gelen Kutusu öğesi veya ana kayıt değildir.
_Avoid_: Yakalama, İş, Belge taslağı

**Ürün Boşluğu**:
Kurucunun Cantiara kapsamında karşılanmadığını düşündüğü ihtiyacı ve bu ihtiyete ilişkin değerlendirme durumunu taşıyan Çalışma Alanı ana kaydı. Tekrarlanma sayısı yalnız ona açıkça bağlanan Dış Araca Kaçış olaylarından türetilir.
_Avoid_: Özellik isteği, otomatik öncelik, dış araç oturumu

**Dış Araca Kaçış**:
Kurucunun Cantiara kapsamında gördüğü gerçek bir işi tamamlamak için başka bir araca geçtiğini açıkça kaydettiği tarihsel olay. Ürün Boşluğuna bağlanır; dış davranışın otomatik izlenmesi veya dış içeriğin kopyası değildir.
_Avoid_: Bilinçli dış sınır, entegrasyon kullanımı, otomatik telemetry

## Bilgi ve kanıt

**Belge**:
Bir Proje veya Kişisel Wiki kapsamında yaşayan, sürümlü Markdown içeriğine sahip ana kayıt. Başka kaydın metin alanı veya dış dosyayla canlı eşitlenen kopya değildir.
_Avoid_: Dosya Eki, harici Markdown dosyası, kayıt açıklaması

**Dosya Eki**:
Tam olarak bir Proje veya Kişisel Wiki kapsamında yaşayan, dosya içeriğini ve sürümlerini taşıyan ana kayıt. Başka kapsamdaki ilişki, sahipliğini veya görünürlüğünü değiştirmez.
_Avoid_: Belge, ilişki eki, paylaşılan global dosya

**Kaynak**:
Dış bilgiyi URL, erişim zamanı ve yakalanan içerikle tarihsel sürümler hâlinde koruyan Proje ana kaydı. Canlı web sayfası, geçici URL önizlemesi veya doğruluğu kendiliğinden onaylanmış kanıt değildir.
_Avoid_: Dış URL önizlemesi, bookmark, canlı web aynası

**Kanıt bağı**:
Kesin bir Kaynak, Belge, Diyagram veya Dosya Eki sürümünün ya da desteklenen tarihsel kaydın belirli bir hedef iddiayı desteklediğini açık rol ve atıfla gösteren ilişki. Kaynağın varlığı tek başına bu bağı veya doğruluk hükmünü oluşturmaz.
_Avoid_: İlgili ilişkisi, belirsiz referans, otomatik doğrulama

**Diyagram otorite kipi**:
Bir diyagram örneğinin kalıcı içeriğinin ve güncellik iddiasının `Üründe yazılmış model`, `Repository’den türetilmiş görünüm`, `İçe aktarılmış bağımsız kopya` veya `Dış kaynak bağlantısı` seçeneklerinden hangisine ait olduğunu belirleyen, kayıt kimliği boyunca değişmeyen tek kanonik sınıflandırma. Snapshot, dışa aktarım ve sürüm bu sınıflandırmayı değiştirmez; başka otoriteye geçiş kaynak ve hedefi kökenle bağlayan yeni Teknik Diyagram kimliği oluşturur.
_Avoid_: Diyagram türü, dosya biçimi, paylaşım kipi

**Üründe yazılmış model**:
İçeriği ürün veritabanında kanonik olan ve yalnız ürünün değişiklik geçmişi ile düzenleme sözleşmesi altında değişen diyagram otorite kipi.
_Avoid_: Repository aynası, dış dosya bağlantısı

**Repository’den türetilmiş görünüm**:
Kullanıcının seçtiği kesin repository kaynakları ve revizyonundan hesaplanan, içeriği ürün içinde bağımsız düzenlenmeyen diyagram otorite kipi. Kaynak değişikliği tarihsel görünümü yeniden yazmaz ve güncellik ayrıca gösterilir.
_Avoid_: AI’ın doğru varsayılan çizimi, ürün-owned diyagram, canlı çift yönlü senkronizasyon

**İçe aktarılmış bağımsız kopya**:
Dış dosyanın açık dönüşüm ve kayıp önizlemesinden sonra ürün veritabanında yeni kimlikli kanonik içeriğe dönüştüğü, dış kaynağın sonraki değişikliklerini izlemeyen diyagram otorite kipi. Köken korunur fakat dış dosya doğruluk kaynağı olarak kalmaz.
_Avoid_: Canlı import, round-trip senkronizasyon, dış kaynağın yeni sürümü

**Dış kaynak bağlantısı**:
Diyagram içeriğinin ürün dışında kanonik kaldığı; ürünün yalnız kesin dış hedefi, bilinen kaynak revizyonunu, kökeni ve proje ilişkilerini koruduğu diyagram otorite kipi.
_Avoid_: İçe aktarılmış kopya, ürün-owned diyagram, embed ile sahiplik

**Teknik Diyagram**:
Bir yazılım Projesinin veri modelini, teknik yapısını veya desteklenen sistem etkileşimini bağımsız kimlik, Diyagram otorite kipi, geçmiş ve ilişkilerle taşıyan proje ana kaydı. Proje Duvarı kartı veya Belgedeki canlı görünümü yeni diyagram içeriği oluşturmaz.
_Avoid_: Mermaid kod bloğu, genel canvas, Proje Duvarı çizgisi

**Belge içi Mermaid diyagramı**:
Tek bir Markdown Belgesine ait Mermaid kaynak kodu ile onun işlenmiş görünümünden oluşan, Belgeden bağımsız kimlik veya yaşam döngüsü taşımayan içerik bloğu. Bağımsız Teknik Diyagrama dönüşmesi açık kullanıcı eylemi ve yeni ana kayıt gerektirir.
_Avoid_: Teknik Diyagram ana kaydı, otomatik çıkarılmış diyagram kaydı

**Tasarlanan şema**:
Kullanıcının amaçladığı veri modelini ürün içinde düzenlediği, henüz repository veya çalışan veritabanı gerçeği olduğu iddiasını taşımayan Teknik Diyagram.
_Avoid_: Uygulanmış şema, Repository şeması, canlı veritabanı introspection’ı

**Repository şeması**:
Seçili schema veya migration kaynaklarının kesin repository revizyonunda ifade ettiği veri modelinden türetilen salt-okunur Teknik Diyagram. Çalışan veritabanına uygulanmış, deploy edilmiş veya runtime’da güncel olduğu iddiasını taşımaz.
_Avoid_: Uygulanmış şema, canlı veritabanı şeması, Tasarlanan şema

**Teknik Mimari Diyagramı**:
Bir yazılım Projesindeki bileşen, servis, veri akışı ve harici sistem bağlantılarını gösteren Teknik Diyagram türü.
_Avoid_: Kullanıcı Akışı, Proje Duvarı, genel flowchart

**Veri Modeli Diyagramı**:
Bir yazılım Projesinin veri varlıklarını, alanlarını, kısıtlarını ve aralarındaki yapısal ilişkileri gösteren Teknik Diyagram türü. Çalışan veritabanına uygulanmış olma veya migration yürütme iddiası taşımaz.
_Avoid_: Veri Varlığı kaydı, canlı DB şeması, genel tablo görünümü

**Şema Görünümü**:
Tek bir Veri Modeli Diyagramındaki kullanıcı tarafından seçilmiş varlık, alan ve ilişkileri gösteren Diyagram Görünümü. Kaynak tanımları kopyalamaz, bağımsız veri modeli veya fiziksel database namespace’i oluşturmaz.
_Avoid_: Customer şeması, Admin şeması, ikinci Veri Modeli Diyagramı, PostgreSQL schema

**Diyagram Görünümü**:
Tek bir Teknik Diyagramın seçilmiş öğelerini adlandırılmış yerleşim ve görünüm notlarıyla gösteren, kaynak öğeleri kopyalamayan sunum yüzeyi. Bağımsız Teknik Diyagram, içerik kaynağı veya erişim kapsamı değildir.
_Avoid_: Alt diyagram, canvas bölgesi, ayrı teknik model, paylaşım izni

**Teknik Diyagram yapısal modeli**:
Bir Teknik Diyagramın türlenmiş düğüm, alan, bağlantı ve semantik kısıtlarını ürün veritabanında taşıyan kanonik içeriği. Görsel yerleşim görünüm üstverisidir; Mermaid, DBML, SQL ve başka metin biçimleri canlı eş kaynak değil, açık dönüşüm girdisi veya çıktısıdır.
_Avoid_: Diyagram DSL’i, render edilmiş görsel, canvas koordinatları

**Diyagram Sürümü**:
Bir Teknik Diyagramın kullanıcı tarafından adlandırılıp değişmez hâle getirilen kesin yapısal model ve görünüm checkpoint’i. Canlı diyagramın yerine geçmez; Karar, İş, Proje Sürümü, kanıt, paylaşım veya dışa aktarımın hangi tasarımı esas aldığını sabitler.
_Avoid_: Autosave, değişiklik geçmişi olayı, canlı diyagram, export dosyası

**PostgreSQL DDL taslağı**:
Kesin bir Veri Modeli Diyagramı Sürümünden ürünün ürettiği; kaynak sürüm/hash, generator sürümü ve uyarı manifestini taşıyan, kullanıcı tarafından incelenip dışarı aktarılabilen tam PostgreSQL şema metni. Ürün içinde çalıştırılmaz, repository’ye yazılmaz ve production-ready ya da uygulanmış şema garantisi taşımaz.
_Avoid_: Migration, uygulanmış SQL, repository şema dosyası, database backup

**Şema Değişiklik Taslağı**:
İki kesin Veri Modeli Diyagramı Sürümü arasındaki türlenmiş ekleme, değiştirme, yeniden adlandırma ve kaldırma operasyonlarını; bağımlılık sırasını ve destructive uyarılarıyla gösteren inceleme taslağı. Çalışan database durumu veya uygulanmış migration değildir.
_Avoid_: Metin diff’i, uygulanmış şema, otomatik migration yürütümü

**Migration Artefaktı**:
Kullanıcının Şema Değişiklik Taslağını inceleyip onaylamasıyla kaynak/hedef Diyagram Sürümleri, generator sürümü, uyarılar ve desteklenen PostgreSQL SQL’iyle değişmez hâle gelen tarihsel artefakt. Ürün içinde çalıştırılmaz, repository’ye yazılmaz ve uygulanmış olma ya da güvenli rollback garantisi taşımaz.
_Avoid_: Migration çalıştırması, deployment, database backup, Diyagram Sürümü

**Güvenli Down taslağı**:
Bir Migration Artefaktındaki bütün desteklenen schema operasyonlarının deterministik ve veri kayıpsız tersinin üretilebildiği durumda sunulan PostgreSQL geri alma taslağı. Veri taşıma, backfill, silinmiş veriyi canlandırma veya genel rollback garantisi değildir.
_Avoid_: Her migration için Down, database restore, güvenli deployment garantisi

**Ajan öneri yaması**:
Bir AI ajanının kesin taban Teknik Diyagram revizyonuna karşı önerdiği düğüm, alan ve bağlantı farklarının, kullanıcı seçip onaylamadan kanonik kayda yazılmadığı değişiklik taslağı. Ajan, başlatan insan ve onaylayan insan ayrı atfedilir.
_Avoid_: Ajan yazması, scoped CRUD, otomatik diyagram güncellemesi

**Statik olarak doğrulanmış SQL**:
Yapısal model invariant’ları, PostgreSQL grammar/parse, bağımlılık sırası ve generator karşıt testlerinden geçen fakat ürün veya kullanıcı database’inde çalıştırılmamış DDL ya da migration SQL’i. Uygulanmış, production-ready veya runtime’da güvenli olduğu iddiasını taşımaz.
_Avoid_: Çalıştırılmış SQL, uygulanmış migration, production-ready SQL

**Teknik Sıra Diyagramı**:
Yazılım bileşenleri, servisler veya dış sistemler arasındaki mesaj ve çağrıların zamansal sırasını gösteren Teknik Diyagram türü. Kullanıcının arayüzdeki hedef ve karar yolunu gösteren Kullanıcı Akışının yerine geçmez.
_Avoid_: Kullanıcı Akışı, Proje Etkinliği, genel flowchart

**Ekran**:
Bir ürün ekranını temsil eden, Proje kapsamında bağımsız kimlik, geçmiş ve yaşam döngüsü taşıyan ana kayıt. Görsel tasarım olmadan yalnız başlıkla var olabilir ve kendi Wireframe yüzeyi ile sürümlerine sahip olur.
_Avoid_: Wireframe kaydı, Ekran bileşeni, flow node'u

**Wireframe yüzeyi**:
Bir Ekranın düşük sadakatli görsel düzenini ve sürüm zincirini taşıyan düzenleme yüzeyi. Bağımsız ana kayıt veya yaşam döngüsü değildir; kesin sürümü kanıt ya da paylaşım snapshot'ı olarak seçilebilir.
_Avoid_: Wireframe ana kaydı, Ekrandan bağımsız Wireframe

**Yüzey metni**:
Kullanıcının geliştirdiği üründe bir Ekranda görünen boş durum, hata veya denetim cümlesinin Ekrana veya kesin Wireframe sürümüne bağlı sahipli öğesi. Çeviri belgesi, e-posta şablonu veya Wireframe düzen metninin ikinci kopyası değildir.
_Avoid_: i18n TMS, copy deck, Wireframe bloğu kopyası

**Sahipli bileşen**:
Tek bir ana kayda ait olan ve sahibinden bağımsız yaşam döngüsü kazanamayan kalıcı domain öğesi. Sahibinin kapsamını ve silme yaşamını izler.
_Avoid_: Ana kayıt, yardımcı kayıt

**Dış yürütme devri**:
Bir İşin AI ajanında veya harici araçta yürütülecek belirli bir kodlama ya da başka test-dışı çalışmaya gönderilen kesin amaç ve bağlamını, dönen sonucu ve kullanıcının uzlaştırma veya iptal kararını tarihsel olarak koruyan sahipli bileşen. Harici aracı çalıştırmaz, dış insana görev vermez, İşten bağımsız yaşam döngüsü kazanmaz ve planlı/formel test için Test Handoff'unun yerine geçmez.
_Avoid_: Coding session, ajan görevi, bağımsız Handoff ana kaydı

**Dış yürütme uzlaştırması**:
Bir Dış yürütme devrinin sonucunu, değişen varsayımlarını, kanıtını ve açık sorularını kullanıcının inceleyip ana proje gerçeğine bağladığı kapanış kararı. Commit, PR veya İş durumundaki değişiklik bu kararı kendiliğinden oluşturmaz.
_Avoid_: Commit geldi, otomatik kapanış, İş tamamlandı

**Kullanıcı başlatmalı İş başarısı**:
Kullanıcının açık kapatma kararıyla bir İşin kalıcı kapanış sonucunun `Tamamlandı` olarak kesinleşmesi. `Vazgeçildi`, kontrol listesi tamamlama, PR merge veya otomatik PR-merge kapanışı, Dış yürütme uzlaştırması, Kilometre Taşına ulaşma ve Proje tamamlama bu başarı değildir.
_Avoid_: Her terminal olay, otomatik kapanış, kapatma girişimi, iyimser tamamlanma

**Bitiriş efekti**:
Kullanıcı başlatmalı İş başarısını duygusal olarak hissedilir kılan, isteğe bağlı ve yalnız ürünün sağladığı özgün temalardan oluşan dekoratif geri bildirim. Başarının kalıcı durumunu veya hareketten bağımsız temel geri bildirimini taşımaz.
_Avoid_: Konfeti, başarı durumu, lisanslı karakter efekti, kullanıcı yüklemeli efekt

**Değer Zinciri**:
Bir Proje Hedefinden problem ve kanıt üzerinden gözlenen sonuca kadar mevcut kesin kayıt ve ilişkileri gösteren, hedefe bağlanmamış parçaları ve kopuk adımları saklamayan türetilmiş Proje görünümü. Ana kayıt, ilişki, özet metni veya sağlık hükmü üretmez.
_Avoid_: Değer Zinciri kaydı, elle güncellenen izlenebilirlik belgesi, sağlık skoru

**Herkese Açık Taahhüt Etki Görünümü**:
Seçili kesin iç kayıt veya sürümün hangi onaylanmış herkese açık snapshot revizyonlarında yer aldığını mevcut manifestlerden hesaplayan, kanıt bekleyen gelecek yönü adayı. Ana kayıt, inceleme durumu, görev veya serbest metinden çıkarılmış vaat üretmez.
_Avoid_: Taahhüt kaydı, anlamsal vaat tarayıcısı, özel paylaşım etki listesi

**Üretim Olayı Önleme Zinciri**:
Bir Üretim Olayını onun için açık anlamla bağlanmış düzeltme, tekrar-önleme kanıtı ve yayımlanma bağlamıyla gösteren, kanıt bekleyen türetilmiş gelecek yönü adayı. Tarih yakınlığından, metin benzerliğinden veya genel `İlgili` ilişkisinden nedensellik ve hazır olma hükmü çıkarmaz.
_Avoid_: Olay kaydı kopyası, otomatik kök neden analizi, sürüm hazır olma kapısı

**Akış Kötüye Kullanım İncelemesi**:
Bir Kullanıcı Akışının kesin sürümünde kötüye kullanılabilecek yolları insan değerlendirmesiyle kaydeden gelecek yönü adayı. Bu yön açılırsa inceleme Kullanıcı Akışına ait kalıcı sahipli bileşendir; bağımsız ana kayıt, backlog veya yaşam döngüsü değildir. Değerli bulgu ancak açık kullanıcı eylemiyle mevcut Risk, Açık Soru ya da Planlı Test Senaryosu kaydına dönüşür.
_Avoid_: Tehdit modeli ana kaydı, güvenlik envanteri, otomatik Risk üretimi

**Çakışma Taslağı**:
Güncel olmayan bir Belge sürümüne yazmaya çalıştığı için kabul edilmeyen metni, kullanıcı açıkça uzlaştırana, aynı kapsamta kökeni görünür bağımsız Belgeye dönüştürene veya silene kadar koruyan sahipli bileşen. Ana Belge sürümü, otomatik yeniden deneme veya ikinci doğruluk kaynağı değildir.
_Avoid_: Otomatik birleştirilmiş sürüm, çevrimdış yazma kuyruğu, Belge geçmişi

**Kayıt birleştirme**:
Birleştirmeyi açıkça destekleyen herhangi bir kayıt türünde, gerçekte aynı şeyi temsil ettiği doğrulanan ana kayıtların içerik, ilişki ve geçmişlerini tek ana kayıtta toplama işlemi. Birleştirme sonrasında kopyalar ayrı yaşayan ana kayıtlar olarak kalmaz; türe özgü alan çakışmaları onay öncesinde çözülür.
_Avoid_: İlgili kayıt, kayıt grubu

**Birleştirmeyi geri alma**:
Emekli kayıt kimliğini özgün kimliğiyle yeniden ana kayda dönüştüren ve yalnız birleşmeye atfedilebilen değerlerle ilişkileri hayatta kalan kayıttan ayıran düzeltme işlemi. Sonraki ilgisiz değişiklikleri geri sarmaz; geri döndürülemez silme veya redaksiyonla kaldırılmış değeri canlandıramaz.
_Avoid_: Geçmişe tam dönüş, yedekten geri yükleme, gizli kopyayı açma

**Emekli kayıt kimliği**:
Bir Kayıt birleştirmesinde yaşamı sona eren ana kaydın, hayatta kalan kayda kalıcı ve görünür biçimde yönlenen eski kimliği. Yeni bir kayıt için tekrar kullanılamaz ve kendi başına yaşayan bir ana kayıt değildir.
_Avoid_: İkinci canlı kayıt, yeniden kullanılabilir anahtar, sessiz takma ad

## Dış görünürlük

**Dış yüzey**:
Ziyaretçinin kararlı bir URL üzerinden eriştiği; erişim anahtarı, parola, süre ve etkinlik durumunu taşıyan, yayın köküyle aynı tek kanonik kapsamda yaşayan ana kayıt. Gösterdiği içeriğin kendisi değildir; iptalden sonra Çöp Kutusuna alınabilir ve Hesap/Çalışma Alanından uzun yaşayamaz.
_Avoid_: Snapshot, yayın sürümü

**Onaylı snapshot revizyonu**:
Bir Dış yüzeyde belirli bir onay anında gösterilmesine izin verilen kesin kayıt, alan, ilişki ve dosya sürümü manifestinin değişmez, Dış yüzeyden bağımsız yaşayamayan revizyonu. Süre dolumu veya iptalde silinmez; Dış yüzeyin yaşamını ve güvenlik redaksiyonlarını izler.
_Avoid_: Paylaşım bağlantısı, canlı görünüm, Dış yüzey

**Herkese açık durum etiketi**:
Bir İşin iç İş akışı durumunu değiştirmeden yalnız herkese açık Roadmap sunumunda gösterilen Proje bazlı ziyaretçi etiketi. Başlangıç eşlemesi `Not Started → Planned`, `In Progress → In Progress` ve `Closed + Completed → Released` olur; `Blocked` ile `Closed + Abandoned` kullanıcı açıkça etiket seçmeden yayımlanmaz.
_Avoid_: İş akışı durumu, ikinci herkese açık İş, otomatik yayın kararı

**Güvenlik nedeniyle redakte edilmiş kanıt**:
Değişmez sürüm manifestini yeniden yazmadan, hassas içeriği kaldırılmış kanıtın özgün hash ve içeriksiz redaksiyon üstverisiyle kalan erişilemez durumu. Yeni bir sürümün kabul kanıtı olarak yeniden kullanılamaz.
_Avoid_: Temizlenmiş kanıt sürümü, erişilebilir şifreli özgün, geçerli devredilmiş kanıt

**Bağlantıyla sınırlı salt okunur paylaşım**:
Kimliği doğrulanmış bir alıcıya değil, kararlı bağlantıyı ve varsa parolayı elinde tutan herkese salt okunur erişim veren Dış yüzey türü.
_Avoid_: Özel paylaşım, kişiye özel paylaşım, kimlik doğrulamalı paylaşım

**Bağlantı süre dolumu**:
Önceden belirlenen zamanda yeni erişimi durduran, içeriği ve geçmişi silmeyen geri açılabilir Dış yüzey durumu. Yeniden açılırken yeni kitle ile önceki bağlantı sahiplerine yeniden erişim verme birbirinden ayrılır.
_Avoid_: İptal, kalıcı silme

**Bağlantı iptali**:
Kurucunun belirli bir bağlantı ve erişim anahtarını geri döndürülemez biçimde geçersiz kıldığı Dış yüzey geçişi. Aynı URL veya anahtar yeniden etkinleştirilemez; sonraki paylaşım yeni Dış yüzeydir.
_Avoid_: Süre dolumu, geçici duraklatma

**Paylaşım erişim oturumu**:
Geçerli paylaşım anahtarı ve varsa parolanın ilk doğrulamasından sonra tek Dış yüzeye sınırlı süre erişim veren tarayıcı oturumu. Temiz sayfa adresini başka tarayıcıda erişim anahtarına dönüştürmez ve parola, süre dolumu veya iptal değişikliğinden uzun yaşayamaz.
_Avoid_: İkinci paylaşım bağlantısı, kalıcı tarayıcı anahtarı, çalışma alanı oturumu

## Test yönetimi

**Planlı Test Senaryosu**:
Tekrar kullanılabilir test niyetini, önkoşullarını ve beklenen davranışını sürümler hâlinde taşıyan Proje ana kaydı. Testi çalıştırmaz, sonuç taşımaz ve bağlı kapsamı doğrulanmış saymaz.
_Avoid_: Test Oturumu, test script'i, kabul sonucu

**Test Handoff'u**:
Ürün dışında yapılması istenen test çalışmasının kesin amacını, seçili senaryo sürümlerini, teknik bağlamını ve dönen Test Oturumlarını yöneten Proje ana kaydı. Testi yürütmez ve sonuç geldiğinde kendiliğinden kapanmaz.
_Avoid_: Dış yürütme devri, Test Oturumu, ajan çalıştırması

**Test Oturumu**:
Aynı dış çalışma bağlamında yürütüldüğü bildirilen testleri ve tarihsel özetini taşıyan Proje ana kaydı. Bildirilen gerçekliği korur; kullanıcı incelemesi veya başarılı sonuç tek başına kabul kanıtı değildir.
_Avoid_: Test Handoff'u, Ürün kabul kanıtı, canlı test çalıştırıcısı

**Oturum Testi**:
Bir Test Oturumu içinde bağımsız olarak denendiği bildirilen davranışı, ham ve normalize sonucu, kesin bağlamı ve kanıtıyla taşıyan kayıt. Planlı bir senaryo sürümüne bağlanabilir veya ad hoc olabilir; üst Test Oturumundan bağımsız yaşamaz.
_Avoid_: Planlı Test Senaryosu, Test Oturumu özeti, GitHub check'i

**Test Açığı**:
Kullanıcının henüz denenmediğini veya yetersiz doğrulandığını düşündüğü alanı ve bu yargının dayanaklarını taşıyan Proje ana kaydı. Başarısız test, Bug veya otomatik yayın engeli değildir; sonuç geldiğinde kendiliğinden kapanmaz.
_Avoid_: Bug, başarısız test sonucu, otomatik coverage açığı

**Test değerlendirmesi**:
Kullanıcının belirli bir Özellik, Test Handoff'u veya Proje Sürümü bağlamındaki kesin test kayıtlarını belirli bir anda nasıl yorumladığını koruyan tarihsel snapshot. Sonraki sonuçlarla güncellenen kalite skoru, istisna veya yayın kapısı değildir.
_Avoid_: Ürün kabul kanıtı, canlı test özeti, otomatik readiness kararı

## Sürüm ve ürün kabulü

**Proje Sürümü**:
Kullanıcının yönettiği yazılım Projesinde kapsamı, hazırlığı ve yayımlanma durumunu taşıyan Sürüm ana kaydı. Yayımlama kararı kullanıcıya aittir; ürünün kendi kabul süreci değildir.
_Avoid_: Ürün sürüm adayı, ürün release'i

**Sürüm iletişim iskeleti**:
Bir Proje Sürümüne ait, kullanıcının seçtiği kayıtlara bağlı ve cümlesini kendisinin yazdığı yayın söylemi maddeleri. Sürüme ait sahipli listedir; otomatik anlatı veya herkese açık changelog değildir.
_Avoid_: Yapım hikâyesi, otomatik blog, changelog yüzeyi

**Erişim gözlemi**:
Bir Proje Sürümünün hedeflenen kullanıcıya belirli bir değerlendirme turunda hangi ölçüde ulaştığına dair, kullanıcı tarafından kaydedilen ve yalnız o gözleme ait kesin kanıta bağlanabilen sahipli değerlendirme. Aynı Sürüm birden fazla tarihli gözlem taşıyabilir; gözlem Sürümden bağımsız yaşamaz ve pazarlama performansı veya ürün başarısı hükmü değildir.
_Avoid_: Kampanya sonucu, erişim skoru, otomatik analytics sonucu

**Sonuç gözlemi**:
Bir Proje Sürümünden sonra hedeflenen davranış veya sonucun belirli bir değerlendirme turunda hangi ölçüde görüldüğüne dair, kullanıcı tarafından kaydedilen ve yalnız o gözleme ait kesin kanıta bağlanabilen sahipli değerlendirme. Aynı Sürüm birden fazla tarihli gözlem taşıyabilir; gözlem Sürümden bağımsız yaşamaz, Erişim gözleminin yerine geçmez ve sistem tarafından başarı hükmüne dönüştürülmez.
_Avoid_: Sürüm başarısı, otomatik etki puanı, Erişim gözlemi

**Ürün sürüm adayı**:
Bu ürünün PRD kabul koşullarına karşı doğrulanan kesin build'i. Kullanıcının yönettiği bir Proje Sürümü değildir.
_Avoid_: Proje Sürümü, kullanıcı Sürümü

**Kabul koşulu**:
Normatif ürün davranışındaki bağımsız ve gözlenebilir bir vaadi, kesin Ürün sürüm adayı, fixture/ortam ve kanıtla tekil geçti/kaldı sonucuna bağlayan doğrulama birimi. Kaynak bölümünde doğal adlı bir madde olarak yaşar; kesin kaynak commit'i, dosya, bölüm bağlantısı ve bölüm içinde tekil doğal ad birlikte izlenebilirliğini kurar.
_Avoid_: Kabul iddiası, bölüm topluca geçti, iç takip kodu, kaynak satır numarası

**Ticari genişleme adayı**:
İlk ürün kabul edildikten sonra açık kapsam kararıyla etkinleştirilen, Ticari Genişleme davranışları ile bunların merkezi kabul koşullarını birlikte zorunlu yapan doğrulama kapsamı. İlk ürünün tamamlanması bu adayı kendiliğinden başlatmaz.
_Avoid_: İlk ürün kapsamı, otomatik sonraki aşama, yalnız Invoice özelliği

**Bildirilen Test Oturumu**:
Bir test aracının belirli bir derleme için gerçekleştiğini ve sonucunu bildirdiği tarihsel kayıt. Tek başına testin gerçekten koştuğunu veya bir sürümün kabul edildiğini kanıtlamaz.
_Avoid_: Doğrulanmış kabul kanıtı, sürüm onayı

**Ürün kabul kanıtı**:
Kesin Ürün sürüm adayına bağlı onaylı koşturucu çıktısı veya belgelenmiş manuel kontrol için açık kurucu beyanıyla bir kabul koşulunu doğrulayan kanıt. Ortamı, fixture'ı, inceleyeni ve içerik hash'ini değişmez kabul manifestine bağlar.
_Avoid_: Proje Sürümü kanıtı, yalnız Passed durumu, Test Değerlendirmesi

**Kurucu öz-beyanı**:
Kurucunun bizzat uyguladığı manuel kullanıcı deneyimi veya erişilebilirlik kontrolünü belgeleyen, bağımsız inceleme sayılmayan Ürün kabul kanıtı. Otomatik doğrulanabilir güvenlik veya veri bütünlüğü koşullarının tek kanıtı olamaz.
_Avoid_: Bağımsız onay, ikinci kişi incelemesi, her iddia için yeterli manuel beyan

**Ürün destek matrisi**:
Bir Ürün sürüm adayının kabul anında doğrulandığı kesin tarayıcı motoru, tarayıcı, işletim sistemi, cihaz veya bulut imajı ve tarih kümesi. Sonraki platform sürümleri geçmiş kabulü yeniden yazmaz.
_Avoid_: Zamana göre anlam değiştiren current/previous etiketi, sonsuza kadar sabit tarayıcı sürümü

**Kanıt bağımlılık manifesti**:
Pahalı bir Ürün kabul kanıtının hangi kod, şema, yapılandırma, runtime, platform imajı, fixture ve koşturucu güven kuralına bağlı olduğunu sürümlü biçimde belirleyen liste. Yalnız tamamı değişmemişse kanıt sonraki Ürün sürüm adayına taşınabilir.
_Avoid_: Geçen ay geçti, rastgele spot kontrol, yalnız commit eşitliği

**Onaylı test koşturucusu**:
Kararlı repository, kesin iş akışı sürümü, derleme, ortam ve sağlayıcı kökenini kapsayan sürümlü güven kuralıyla Ürün kabul kanıtı üretmesine izin verilen otomatik yürütücü. Yalnız artifact adresi veya uzun ömürlü ortak anahtar bu kimliği kurmaz.
_Avoid_: Her CI sonucu, paylaşılan API anahtarlı raporlayıcı, artifact URL'si

## Dış entegrasyonlar

**Bilinçli dış sınır**:
Bir Projedeki belirli gerçeklerin kalıcı kanonik sahibinin neden dışarıda kaldığını, bu gerçekten ürüne neyin geri dönmesi gerektiğini ve varsa açık dönüş yükümlülüğünü belirten kullanıcı kararı. Dış sistemi eşitlemez, çalıştırmaz veya ürün içi ana kaydın sahipliğini dışarı devretmez.
_Avoid_: Entegrasyon envanteri, Dış Araca Kaçış, canlı senkronizasyon

**Dış ana kaynak işareti**:
Mevcut bir kayıtta kullanıcının koyduğu, asıl kopyanın ürün dışında kaldığını gösteren dar işaret. Sözleşme, senkron veya sağlık hükmü değildir.
_Avoid_: Bilinçli dış sınır, entegrasyon durumu, kaçış kapanışı

**Rakip yırtma defteri**:
Bir rakibin iddiası, isteğe bağlı ekranı ve buna verilen cevabın Projede tutulan sahipli karşılaştırması. Moodboard, pazar skoru veya otomatik rakip taraması değildir.
_Avoid_: Moodboard, rekabet zekâsı ürünü, serbest whiteboard

**İlk on dakika vaadi**:
Yeni hesabın ilk dakikalarda görmesi beklenen adımların Ekran veya Kullanıcı Akışına bağlı, kullanıcının işaretlediği vaat listesi. Zorunlu onboarding veya tur çalıştırıcısı değildir.
_Avoid_: Kullanıcı Akışı kopyası, Intercom turu, kurulum kapısı

**Destek oyun kitabı**:
Tekrarlayan bir şikâyette kontrol sırasını taşıyan, Üretim Olayı veya Özelliğe bağlı sahipli maddeler. Helpdesk, ticket veya otomatik yanıt değildir.
_Avoid_: Intercom, önleme zinciri, SLA

**Kullanıcıya veri teslimi**:
Geliştirilen üründeki kullanıcının kendi verisini hangi biçimde alacağına dair Proje vaadi. Cantiara yedeği veya çalıştırılan export değildir.
_Avoid_: Ürün paketi, self-host yedek, hukuki yeterlilik

**Altyapı maliyeti notu**:
Koşturma sağlayıcısı, kabaca tutar ve gerekçenin Projede tutulan notu. Müşteri Invoice’u veya muhasebe defteri değildir.
_Avoid_: Invoice, fiyat paketi, banka uzlaştırma

**GitHub bağlantısı**:
Bir Projeyi GitHub'daki tek kararlı repository kimliğine bağlayan ve yeniden yetkilendirmelerde geçmişini koruyan entegrasyon kaydı. Repository sahibi veya adı kimlik sayılmaz.
_Avoid_: Repository adı eşleşmesi, kurulum takma adı

**GitHub dış kaydı**:
GitHub kaynak kimliğini ve son uzlaştırılmış kaynak durumunu salt okunur taşıyan, GitHub'daki kayıttan bağımsız yerel yaşam döngüsüne sahip Proje ana kaydı. Arşiv kaynak güncellemelerini durdurmaz; Çöp Kutusu yazmayı durdurur ve kalıcı silme otomatik dirilmeyi engeller.
_Avoid_: Canlı GitHub kaydı, GitHub senkron kopyası, bağlantının sahipli bileşeni

**Dış URL önizlemesi**:
Kimlik doğrulaması istemeyen herkese açık bir HTTP(S) adresinden türetilen, ana kayıt veya tarihsel Kaynak snapshot'ı olmayan geçici başlık/alan adı/görsel sunumu. Özel ağı, kullanıcı oturumunu veya kaynağın erişim sınırını kullanamaz.
_Avoid_: Kaynak Kaydı, oturumlu tarayıcı önizlemesi, iç ağ önizlemesi

**Web Yakalama**:
Kurucunun tarayıcı uzantısında açıkça seçtiği URL, metin, görsel veya ekran görüntüsünü Yakalama Gelen Kutusuna getiren tekil girdi. Doğrudan ana kayıt, arka plan taraması veya çevrimdış gönderim kuyruğu değildir.
_Avoid_: Otomatik web taraması, doğrudan İş oluşturma, tarayıcı geçmişi

## Otomasyon

**Dikkat sinyali**:
Ürünün kapalı ve deterministik kurallarla kesin kaynaklardan saptadığı, kullanıcının incelemesine sunulan açıklanabilir olgu. Bütün riskleri kapsadığı veya Projenin sağlığı hakkında hüküm verdiği iddiasını taşımaz.
_Avoid_: Sağlık uyarısı, AI önerisi, eksiksiz risk tespiti

**Otomasyon çatışması**:
Aynı kaynak olaydan eşleşen kuralların aynı hedef kaydın aynı alanına birlikte uygulanamayacak değerler önermesi. Hiçbir öneriyi kazanan ilan etmez ve hedefte otomatik değişiklik oluşturmaz.
_Avoid_: Son yazan kazanır, kural sırası, otomatik uzlaştırma

## Taşınabilirlik

**Aşamalı import**:
Ana kayıt yazmadan şifreli sunucu staging alanında doğrulanan, açık son önizleme ve kullanıcı onayından sonra tek atomik/idempotent commit veya tam rollback makbuzuyla biten CSV/JSON işlemi.
_Avoid_: Arka planda sessiz yazma, kayıt bazlı kısmi başarı, belirsiz son durum

**JSON dışa aktarma şeması**:
Kanonik yapılandırılmış dışa aktarımın alan, kimlik, köken ve ilişki anlamlarını belirleyen açık sürümlü sözleşme. Ürünün daha önce yayımladığı her sürüm içe aktarılabilir kalır.
_Avoid_: Sürümsüz JSON, tahminî eski dosya içe aktarımı, CSV kayıpsızlığı

**Elektronik tablo güvenli CSV**:
Formül gibi yorumlanabilecek kullanıcı metnini elektronik tabloda veri olarak açılacak biçimde işaretleyen ve bu dönüşümü raporlayan kolaylık dışa aktarımı. Ham değerin kayıpsız kanonik temsili değildir.
_Avoid_: Kayıpsız CSV, formül çalıştırabilen ham hücre, kanıtsız apostrof kaldırma

## Veri güvenliği

**GitHub kimliğini yeniden teyit etme**:
Yüksek riskli bir işlem öncesinde PKCE ve GitHub hesap seçimiyle tamamlanan yeni OAuth turundan dönen değişmez GitHub kullanıcı kimliğini mevcut Hesapla eşleyip tek kullanımlık, işleme bağlı ve en fazla on dakika geçerli yetki üretme sınırı. Parola, MFA veya GitHub tarafından zorlanmış yeni credential girişi olduğunu iddia etmez; yıkıcı işlem ayrıca hedef adının yazıldığı açık onay ister.
_Avoid_: Yeniden kimlik doğrulama, MFA, parola doğrulama, genel oturum yenileme

**AB veri sınırı**:
Özel Çalışma Alanı verisinin, bağlantıyla sınırlı içeriğin, yedeklerin ve günlüklerin otomatik kullanılabilirlik geçişi sırasında bile dışına taşınmadığı onaylı bölgesel sınır. Sınırı değiştirmek ayrı ve açık bir veri taşıma kararıdır.
_Avoid_: Küresel otomatik failover, kesinti sonrası onay, herkese açık içerik teslim sınırı

**Güvenlik redaksiyonu**:
Hassas bir değeri güncel içerikten ve onu taşıyan bütün geçmiş revizyonlardan geri döndürülemez biçimde kaldıran, içeriksiz denetim izi bırakan güvenlik işlemi.
_Avoid_: Normal düzenleme, çöp kutusu, kalıcı kayıt silme

**Geri döndürülemez güvenlik olay günlüğü**:
Bir restore sonrasında silme, redaksiyon, erişim iptali ve secret rotasyonu gibi yedekten daha yeni güvenlik kararlarını yeniden uygulamak için ayrı korunan sürümlü olay sınırı.
_Avoid_: Normal kayıt geçmişi, yalnız silme listesi, restore sonrası manuel kontrol listesi

**Hesap kapatma**:
Hesap ile onun tek Çalışma Alanını birlikte geri alınabilir bekleme süresine ve ardından kalıcı silmeye alan birleşik yaşam döngüsü.
_Avoid_: Yalnız çalışma alanını kapatma, oturumu kapatma

**Hesap kapanma dondurması**:
Kapanış tamamlama geçişi bittikten sonra kapanacak veri kümesini sabit güvenlik olay sınırında tutan 30 günlük durum. Yalnız kapatmayı iptal etme ve sabitlenmiş veriyi dışa aktarma normal kullanıcı erişimine açıktır.
_Avoid_: Salt okunur normal Hesap, hareketli silme snapshot'ı, yarım işleri öldürme

**Kapanış tamamlanıyor**:
Hesap kapanma dondurmasından önce normal işleri güvenli bariyerlerinde durdurup başlamış geri döndürülemez güvenlik işlerini kesin makbuza ulaştıran fail-closed geçiş durumu.
_Avoid_: Otuz günlük bekleme, hareketli export dönemi, bütün worker'ları zorla öldürme

## Dogfooding

**Dış Araca Kaçış kapanışı**:
Etkilenen güncel gerçeğin kullanılabilir ürün kayıtlarına dönmesi, dış kopyanın aktif ya da paralel doğruluk kaynağı olmaktan çıkması ve düzeltilmiş gerçek akışın bu kayıtlara bağlı kanıtla doğrulanması.
_Avoid_: Yalnız hata düzeldi notu, dış araç ekran görüntüsü, bekleme süresi

## Geçmiş ve gözlemlenebilirlik

**Kayıt geçmişi**:
Bir ana kaydın içerik sürümleri ile ona yapılan domain değişikliklerinin, ana kayıt yaşadığı sürece korunan kalıcı bağlamı.
_Avoid_: Denetim kaydı, operasyon günlüğü

**Denetim kaydı**:
Kimlik doğrulama, yetkilendirme, paylaşım, yayın, entegrasyon ve yüksek riskli veri işlemlerini güvenlik ve hesap verebilirlik amacıyla süreli olarak belgeleyen olaylar.
_Avoid_: Kayıt geçmişi, operasyon günlüğü

**Operasyon günlüğü**:
Hizmetin çalışmasını teşhis etmek için üretilen, özel içerik veya secret taşımayan kısa ömürlü teknik olay kaydı.
_Avoid_: Kayıt geçmişi, Denetim kaydı
