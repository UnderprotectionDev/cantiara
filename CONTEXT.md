# Cantiara — Kişisel Proje İşletim Sistemi

Tek kurucunun yazılım projelerindeki kalıcı bağlamı, sahipliği ve yaşam döngüsünü tek doğruluk kaynağında tutan Cantiara'nın ortak domain dili.

Bu sözlük ürün-geneli ortak dildir, kapsam kaynağı değildir. Bir terimin burada tanımlı olması onu ilk ürün kapsamına almaz; kapsamın tek sahibi [Ürün Vizyonu ve Kapsamı](docs/prd/01-product-vision-and-scope.md#kapsam-dili) ile ilgili ürün alanı belgeleridir. Sözlük ayrıca [gelecek yönlerinde](docs/prd/18-future-directions.md) ve [ticari genişlemede](docs/prd/17-commercial-expansion.md) tartışılan terimleri de taşıyabilir.

Sözlük yalnız terim anlamı taşır. Kapalı değer katalogları, varsayılanlar, eşikler, durum eşlemeleri ve güvenlik mekanikleri ilgili PRD bölümüne aittir; burada yalnız o bölüme bağlantı verilir.

Bu sözlüğün açıklama dili Türkçedir; Cantiara'nın ilk ürün arayüzü İngilizcedir. Türkçe domain terimi PRD tartışmasını, [ortak PRD sözlüğündeki İngilizce UI etiketi](docs/prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) kullanıcıya gösterilen kesin adı taşır. Locale tarih, saat ve sayı biçimini değiştirir; arayüz dilini veya kullanıcı içeriğini çevirmez.

## Sahiplik ve kayıt yapısı

**Sahiplik kapsamı**:
Bir ana kaydın erişim, yaşam döngüsü ve taşınabilirlik sınırını belirleyen tek kanonik bağlam; hangi kapsamların bulunduğunu [kapsam ve sahiplik sözleşmesi](docs/prd/02-domain-model-and-lifecycle.md#kapsam-ve-sahiplik) belirler.
_Avoid_: Proje bağlantısı kapsamı, kaynak kapsamı, hesap + kaynak kapsamı

**Hesap**:
Kurucunun değişmeyen kimliğini, kişisel tercihlerini ve güvenlik bağlamını taşıyan; çalışma alanı içeriğinden ayrı sahiplik kapsamı.
_Avoid_: Kullanıcı çalışma alanı, profil projesi

**Hesap tercihleri**:
Hesap kapsamındaki locale, saat dilimi, tarih biçimi, haftanın ilk günü ve Appearance; çalışma alanı içeriği veya Proje yapılandırması değildir ([Hesap profil tercihleri](docs/prd/03-account-platform-operations.md#hesap-profil-tercihleri)). UI: `Preferences`.
_Avoid_: i18n language pack, dil tercihi, per-Project locale, tema sistemi

**Appearance**:
Hesabın Light veya Dark okunabilirlik tercihi; tasarım tokenı, tema sistemi, Proje rengi veya white-label ürünü değildir ([Hesap profil tercihleri](docs/prd/03-account-platform-operations.md#hesap-profil-tercihleri)). UI: `Appearance`.
_Avoid_: tema sistemi, System, Bitiriş efekti teması, Proje rengi

**Locale**:
Tarih, saat ve sayı biçimini seçen Hesap tercihi; arayüz dilini veya kullanıcı içeriğini çevirmez. UI: `Locale`.
_Avoid_: dil tercihi, i18n language pack, çeviri

**Saat dilimi**:
Takvim gün sınırı, tarih girişi ve tarihsel gösterimin Hesap dilimi; saklanmış kesin zaman damgasını yeniden yazmaz. UI: `Time zone`.
_Avoid_: saklanmış anı kaydırma, Proje saat dilimi

**Tarih biçimi**:
Tarihin nasıl yazıldığını seçen Hesap tercihi; seçilmezse locale varsayılanını izler. UI: `Date format`.
_Avoid_: kayıt semantiği, locale çevirisi

**Haftanın ilk günü**:
Hafta ızgarası ve hafta sınırının başladığı gün. UI: `First day of week`.
_Avoid_: saklanmış zaman damgası, Proje takvim tercihi

**Ürün oturumu**:
Hesap kapsamındaki kimlik doğrulanmış ürün erişimi; cihaz ve son etkinlikle listelenir ve iptal edilir ([oturum güvenliği](docs/prd/03-account-platform-operations.md#oturum-guvenligi)). UI listesi: `Sessions`.
_Avoid_: Paylaşım erişim oturumu, Test Oturumu, Kullanıcı Araştırması Oturumu

**Çalışma Alanı**:
Tek kurucunun projelerini, Kişisel Wiki'sini ve çalışma alanı genelindeki kayıtlarını kapsayan sahiplik sınırı.
_Avoid_: Hesap, organizasyon, ekip

**Proje**:
Belirli bir yazılım ürününe ait geliştirme gerçeklerini kapsayan sahiplik sınırı; [repository'den geniştir](docs/prd/01-product-vision-and-scope.md#repositoryden-daha-geniş-proje-anlayışı), Çalışma Alanından dardır.
_Avoid_: Repository, çalışma alanı

**Proje kısa kodu**:
Proje adından önerilen ve ilk İş oluşturulduktan sonra değişmeyen, kullanıcıya dönük İş anahtarı öneki ([benzersizlik ve yeniden kullanım sözleşmesi](docs/prd/04-workspace-and-projects.md#proje-profili)).
_Avoid_: Proje kimliği, değiştirilebilir slug, yeniden kullanılabilir kod

**Proje alanı**:
İlişkili kayıt türlerini tek keşif ve çalışma girişinde toplayan, etkinliği içerik yaşamından ayrı Proje yüzeyi ([Proje alanları](docs/prd/04-workspace-and-projects.md#proje-alanlarını-etkinleştirme)).
_Avoid_: Kayıt türü, ayrı sahiplik kapsamı, ana menü başına tek tablo

**Proje aşaması**:
Kurucunun ekleyip, yeniden adlandırıp, sıralayıp kaldırabildiği Proje çalışma dönemi; sıralı state machine değildir, her biri Planlanmadı, Hazır, Aktif, Tamamlandı veya Vazgeçildi taşır ve birden fazlası aynı anda Aktif olabilir ([yapılandırılabilir aşamalar](docs/prd/04-workspace-and-projects.md#yapılandırılabilir-ve-paralel-proje-aşamaları)). UI: `Stages`.
_Avoid_: İş akışı durumu, sprint, zorunlu geçiş, çalışma kapısı

**İşin proje kapsamı**:
Bir İş oluşturulurken seçilen ve [İşin yaşamı boyunca değişmeyen](docs/prd/06-work-management-and-planning.md#işin-değişmeyen-proje-kapsamı) kanonik Proje kapsamı.
_Avoid_: Taşınabilir İş kapsamı, proje takma adı

**Başka Projede yeniden oluşturma**:
Yanlış Projede oluşturulan bir İşin seçilmiş taşınabilir içeriğinden hedef Projede yeni kimlikli bir İş üreten ve kaynağını görünür kılan düzeltme; kaynak İşi taşımaz veya silmez.
_Avoid_: İşi taşıma, kapsam değiştirme, kimliği koruyan kopya

**Taşınabilir İş ilişkisi**:
Başka Projede yeniden oluşturma sırasında kurucunun tek tek seçtiği ve hedefi bağımsız yaşamaya devam eden ilişki; sahiplik veya yaşam döngüsü bağları taşınabilir değildir.
_Avoid_: Bütün ilişkileri kopyalama, Proje bağlamını taşıma, örtük çapraz Proje ilişki

**Proje arşivi**:
Bir Projeyi salt okunur ve hareketsiz duruma getirerek etkin Projelerden ayıran, Proje silmenin yalnız içinden başlatılabildiği zorunlu ara [yaşam döngüsü durumu](docs/prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü).
_Avoid_: Çöp Kutusu, kalıcı silme, Projeyi gizleme filtresi

**Çöp Kutusu**:
Ana kaydı veya yapılandırma varlığını [geri alınabilir silme süresine](docs/prd/13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme) alan yaşam sınırı; kimliği korur, aktif kural ve görünüm üyeliği üretmez. UI: `Trash`.
_Avoid_: Arşiv, gizleme filtresi, restore-point, kalıcı silme

**Yapılandırma çöpü**:
Özel alan, adlandırılmış görünüm, otomasyon kuralı, şablon ve benzeri yapı tanımlarının Çöp Kutusu uygulaması; çöpteki tanım [etkin çalışmaz](docs/prd/13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme).
_Avoid_: kayıt Çöp Kutusu, Arşiv, restore-point

**Arşiv güvenlik istisnası**:
Arşivli Projede normal yazmalar kapalıyken yalnız [erişimi azaltan güvenlik işlemlerine](docs/prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) izin veren denetlenebilir sınır.
_Avoid_: Arşivden normal düzenleme, yeni yayın, erişim genişletme

**Proje silme grubu**:
Arşivden silinen Proje ile yalnız ona kanonik olarak ait ana kayıt, sahipli bileşen ve Dış yüzeylerin tek geri yüklenebilir ya da tek kalıcı silinebilir [sınırı](docs/prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü).
_Avoid_: Proje kabuğunu silme, bağımsız çocuk silme, kısmi Proje geri yükleme

**Silinmiş hedef işareti**:
Bir ilişkinin sahibi yaşarken karşı ucunun çözülemediğini içerik sızdırmadan gösteren güvenli referans durumu ([kırık referans sunumu](docs/prd/02-domain-model-and-lifecycle.md#kirik-referans-sunumu)).
_Avoid_: Yetim kaydı kopyalama, başka hedefe otomatik yönlendirme, silinmiş başlığı gösterme

**Standart ilişki**:
Kapalı katalogdaki türlenmiş bağ; iki uç, yön ve anlam taşır ve kullanıcı yeni tür icat etmez; gömülü kullanım veya Kanıt bağı uzmanlığı değildir ([standart ilişki türleri](docs/prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri)). UI: `Related`.
_Avoid_: related-pile, serbest etiket grafiği, otomatik grafik, kullanım bağı

**Engeller / Engellenir**:
İş, Karar veya Açık Soru ile bir İş arasındaki türlenmiş bekletme bağı; `Active` veya `Resolved` taşır ve Kanban sütunu, etiket veya öncelik puanı değildir ([iş bağımlılıkları ve blokajlar](docs/prd/06-work-management-and-planning.md#iş-bağımlılıkları-ve-blokajlar)). UI: `Blocks` / `Blocked by`.
_Avoid_: Kanban sütunu olarak blokaj, tag-as-blocker, priority score, serbest ilişki türü

**Kullanım bağı**:
Gömülü canlı kart, blok veya konumun kaynak kimliğini kopyasız izleyen türetilmiş bağ; semantik ilişki, `Related` veya Kanıt bağı değildir ([kullanım bağları](docs/prd/02-domain-model-and-lifecycle.md#kullanim-baglari)).
_Avoid_: Related, geri bağlantı, Kanıt Rolü, ilişki sayısı

**Kullanıldığı yerler**:
Kayıt detayındaki türetilmiş özet; standart ilişki geri bağlantıları ile kullanım bağlarını kaynak türüne göre ayrı listeler. Kopya içerik, ikinci sahiplik veya yeni ilişki yazması değildir ([içerik ilişkileri ve geri bağlantılar](docs/prd/08-search-relations-and-evidence.md#içerik-ilişkileri-ve-geri-bağlantılar)). UI: `Used in`.
_Avoid_: related-pile, otomatik grafik, paylaşım grafiği, kullanım-as-relation

**Türetilen**:
Köken ilişkisinin üretilen uç için gösterilen etiketi; genel `Related` veya Kanıt bağı değildir.
_Avoid_: Related, Kanıt bağı, otomatik dönüşüm

**Belge kapsam taşıma seçimi**:
Etkin bir Projedeki Belgeyi yalnız açıkça seçilen çocuk Belgeler ve aynı kaynağın sahip olduğu Dosya Ekleriyle kimliklerini koruyarak başka kapsama alan [taşıma sınırı](docs/prd/07-documents-and-knowledge.md#belge-kapsamı-taşıma-ve-kopyalama).
_Avoid_: Bütün ilişki grafiğini taşıma, Belge kopyası, İş kapsamını değiştirme

**Kişisel Wiki**:
Tek bir projeye ait olmayan kalıcı belgeler ve onların dosya ekleri için sahiplik kapsamı.
_Avoid_: Proje belgeleri, ikinci belge sistemi

**Ana kayıt**:
Bağımsız kimliği, kapsamı, geçmişi ve yaşam döngüsü bulunan; kendi başına adreslenebilen ve ilişkilendirilebilen kalıcı domain kaydı.
_Avoid_: Kart, görünüm satırı, sahipli bileşen

## İş ve planlama

**İş**:
Bir Projede yapılması, araştırılması veya iyileştirilmesi amaçlanan şeyi bağımsız kimlik, durum ve geçmişle taşıyan genel ana kayıt; [İş türleri](docs/prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) onun altında yaşar.
_Avoid_: Görev, ticket, yalnız yapılacak madde

**Şablon**:
Bir Projede tekrar kullanılan İş başlangıç bağlamı; tür, açıklama iskeleti, seçili alan varsayılanları, hafif kontrol listesi ve isteğe bağlı göreli planlanan başlangıç/hedef tarihi kuralları taşır. Üretilen İş bağımsız kimlik alır; şablon geçmiş, ilişki, kapanış sonucu, mevcut durum veya mutlak tarih taşımaz ([iş öğesi şablonları](docs/prd/06-work-management-and-planning.md#iş-öğesi-şablonları-ve-tek-seferlik-kopyalama)). UI: `Work Template`. Şablondan İş açma eylemi UI: `Create from template`; şablona canlı bağ veya zorunlu workflow kapısı değildir.
_Avoid_: live-bound fleet, marketplace, workflow gate, Project fork, Belge şablonu, Başlangıç yapılandırması, Yakalama mini şablonu

**Tek seferlik kopya**:
Mevcut bir İşi şablona dönüştürmeden aynı Projede yeni kimlik ve anahtarla kopyalama; geçmiş, ilişki, kapanış, durum, planlama üyeliği ve mutlak tarih taşınmaz ([iş öğesi şablonları](docs/prd/06-work-management-and-planning.md#iş-öğesi-şablonları-ve-tek-seferlik-kopyalama)). UI: `Duplicate Work`.
_Avoid_: Başka Projede yeniden oluşturma, şablona çevirme, canlı bağlı kopya

**Hafif kontrol listesi**:
İş üzerindeki, yalnız metin ve tamamlanma işareti taşıyan sahipli bileşen; bağımsız ana kayıt, İş durumu veya planlama üyeliği değildir ([Hafif iş kontrol listeleri](docs/prd/06-work-management-and-planning.md#hafif-iş-kontrol-listeleri)). UI: `Checklist`.
_Avoid_: subtask, epic, checklist-as-Work, Test Scenario, Handoff

**Kontrol listesi maddesi**:
Hafif kontrol listesindeki metin ve tamamlanma işareti; ana kayıt, İş durumu veya planlama üyeliği değildir. UI: `Item`.
_Avoid_: subtask, bağımsız İş, checklist-as-Work

**Özellik**:
Bir kullanıcı yeteneğini veya ürün değişikliğini temsil eden ve [başka bağımsız İşleri kapsayabilen](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı) İş türü; iç içe epic veya subtask hiyerarşisi değildir.
_Avoid_: Epic, Proje, Kilometre Taşı

**Özellik sağlığı**:
Yalnız Özellikte tutulan isteğe bağlı `On Track` / `At Risk` / `Off Track` güncellemesi ve gerekçesi; türetilen ilerleme, bildirim veya Manuel Proje Güncellemesi değildir ([İş öğeleri](docs/prd/06-work-management-and-planning.md#iş-öğeleri)). UI: `Feature health`.
_Avoid_: Proje skoru, İş akışı durumu, Manuel Proje Güncellemesi

**İş akışı durumu**:
Bir İşin Projede tanımlanan akıştaki güncel yerini gösteren, Kapanış sonucundan ayrı [değer](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı).
_Avoid_: Kapanış sonucu, planlama görünümü, Proje aşaması

**Kapanış sonucu**:
Bir İşin veya Projenin kapanmasının nasıl gerçekleştiğini kalıcı geçmişiyle belirten, İş akışı durumundan ayrı [sonuç](docs/prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü).
_Avoid_: İş akışı durumu, arşiv, terminal kolon

**İş arşivi**:
İş akışı durumu ve kapanış sonucundan bağımsız görünürlük durumu; kaydı silmez, varsayılan planlama yüzeylerinden çeker, açık arşiv filtresiyle bulunur ve kimliği değiştirmeden geri alınır ([İş öğesi arşivi](docs/prd/06-work-management-and-planning.md#iş-öğesi-arşivi)). UI: `Archive`.
_Avoid_: Çöp Kutusu, Proje arşivi, kapanış sonucu, otomatik arşiv

**Planlama üyeliği**:
İşin Backlog, Board, Roadmap veya benzeri bir planlama yüzeyindeki görünürlüğü; [durum yazmaz](docs/prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı) ve kapatma adımının yerine geçmez.
_Avoid_: İş akışı durumu, kapanış sonucu, terminal kolon

**İş Bağlam Kartı**:
Bir İşin kendi alanlarıyla açık doğrudan ilişkilerinden gelen bağlamı kaynaklarında canlı gösteren, [İş türüne özgü sunum düzeni](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı); içerik kopyası, bağımsız sorgu veya durum kapısı değildir.
_Avoid_: Dashboard, ikinci İş özeti, Başlangıç yapılandırmasına göre farklı İş anlamı

**Öncelik dayanakları**:
İş Bağlam Kartında hedef, tarih, blokaj, risk, kilometre taşı, Geri Bildirim, Karar, Kaynak, efor ve varsa öncelik ölçütü değerlerini kaynaklarına bağlı toplayan taranabilir özet; skor, otomatik sıra veya Önceliklendirme oturumu değildir ([İş Bağlam Kartı](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı)). UI: `Priority Foundations`.
_Avoid_: WSJF, öncelik puanı, otomatik sıralama, talep sayısı, Backlog sırası

**Neden zinciri**:
İş Bağlam Kartında en yakın anlamlı kaynakları görünür adlarıyla bağlayan türetilmiş zincir; yeni kayıt, ilişki veya özet metni değildir. UI: `Why am I doing this work?`.
_Avoid_: ikinci doğruluk kaynağı, özet paragrafı, Bağlam kaydı

**Bağlam ekle**:
Gizli hazır İş Bağlam Kartı bölümünü aşamalı açan eylem; oluşturma veya durum geçişi kapısı değildir ([İş Bağlam Kartı](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı)). UI: `Add Context`.
_Avoid_: zorunlu alan, durum kapısı, dashboard widget

**Bağlamı Markdown kopyala**:
İş Bağlam Kartının canlı bağlamını panoya okunabilir Markdown olarak aktaran eylem; yeni kayıt, kalıcı snapshot veya paylaşım nesnesi değildir ([İş Bağlam Kartı](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı)). UI: `Copy Context as Markdown`.
_Avoid_: kart snapshot'ı, paylaşım kapsamı, ikinci doğruluk kaynağı

**Ana kaynak uygulamadadır**:
Kopyalanan Markdown'ın asıl kaydın uygulamada kaldığını belirten not; dış snapshot veya paylaşım izni değildir. UI: `Primary source is in the app`.
_Avoid_: dış doğruluk kaynağı, paylaşım şablonu

**Özel bölüm ekle**:
Yalnız desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolü ve durum koşuluyla adlandırılmış İş Bağlam Kartı bölümü kurma; serbest sorgu değildir ([İş Bağlam Kartı](docs/prd/06-work-management-and-planning.md#iş-bağlam-kartı)). UI: `Add custom section`.
_Avoid_: serbest sorgu, formül, grafik, dashboard widget

**Başlangıç yapılandırması**:
Yeni Projeye örnek içerik üretmeden yapı ve sunum varsayılanlarını bir kez uygulayan [kurulum seçimi](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları); çalışma sırası veya durum geçişi kapısı oluşturmaz.
_Avoid_: Örnek Proje, içerik şablonu, zorunlu workflow, ürün türü

**Blank Project**:
Aşama, uzman görünüm veya Başlangıç iskeleti kurmayan en küçük [Başlangıç yapılandırması](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları); diğer hazır alanları kapatmaz, yalnız kurmaz.
_Avoid_: Yapılandırmasız Proje, boş veri modeli, özellikleri kaldırılmış Proje

**Solo SaaS**:
Discovery’den Operate’e aşamalar, bütün Proje alanları, sabitlenmiş Discovery/Decisions/Design/Tests/Releases ve Backlog/Board/Roadmap kuran [Başlangıç yapılandırması](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları).
_Avoid_: ürün türü, zorunlu workflow, örnek Proje

**Open Source Library**:
Scope’tan Maintain’e aşamalar ve GitHub/Tests/Releases ağırlıklı alanlarla açılan [Başlangıç yapılandırması](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları); GitHub bağlantısı oluşturma anında zorunlu değildir.
_Avoid_: repository kimliği, örnek Proje, zorunlu GitHub

**Mobile Application**:
Discovery’den Operate’e aşamalar, bütün Proje alanları ve sabitlenmiş Production yüzeyiyle açılan [Başlangıç yapılandırması](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları).
_Avoid_: ürün türü, zorunlu workflow, örnek Proje

**Başlangıç iskeleti**:
Yeni Projede yalnız boş başlık yapısı kuran ve oluşturulduktan sonra normal Proje Duvarı ya da Belge olarak yaşayan [içeriksiz başlangıç yardımı](docs/prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları); ana kayıt örneği, bulgu, görev veya karar üretmez.
_Avoid_: Başlangıç yapılandırması, içerikli şablon, şablon pazarı

**Kapanış özeti taslağı**:
Kullanıcının seçtiği tamamlanmış kayıtlardan yalnız bölüm başlıkları ve okunabilir kaynak bağlantılarıyla üretilen, kullanıcı kaydedene kadar kalıcı olmayan [kapanış Belgesi başlangıcı](docs/prd/06-work-management-and-planning.md#proje-kapanış-özeti).
_Avoid_: Başlangıç iskeleti, otomatik retrospektif, kapanış ana kaydı

**Proje Hedefi**:
Bir Projenin ulaşmak istediği sonucu ve isteğe bağlı başarı göstergesini taşıyan hafif ana kayıt; bağlı İşlerden otomatik ilerleme veya sağlık hükmü üretmez.
UI: `Goals` (Overview girişi; gizlenebilir Proje alanı değildir).
_Avoid_: Kilometre Taşı, Proje Sürümü, Key Result

**Hedefe katkı**:
İş, Kilometre Taşı veya Proje Sürümünün bir Proje Hedefine türlenmiş üyeliği; Karar, kanıt veya testi Hedefe doğrudan bağlayan genel ilişki değildir.
_Avoid_: İlgili, Hedef kanıtı, otomatik hedef ilerlemesi

**Kilometre Taşı**:
Bir Projedeki önemli ara sonucu temsil eden planlama ana kaydı; Odak Döneminin çalışma penceresi veya Proje Sürümünün yayımlanacak kapsamı değildir.
UI: `Milestone`. Overview modülü: `Milestones`.
_Avoid_: Odak Dönemi, Proje Sürümü, sprint

**Odak Dönemi**:
Seçili İşlerle çalışmak için açılan geçici zaman penceresi; kalıcı kapsam grubu, Kilometre Taşının ara sonucu veya Proje Sürümünün yayın kapsamı değildir.
_Avoid_: Sprint, Kilometre Taşı, Proje Sürümü

**Kanban**:
İşleri İş akışı durumuna göre sütunlarda gösteren planlama yüzeyi; sütunlar arası kart hareketi duruma yansır, kapanış sonucu veya ikinci kayıt listesi değildir ([Kanban](docs/prd/06-work-management-and-planning.md)).
_Avoid_: Sprint tahtası, kapanış kolonu, bağımsız manuel sıra

**Backlog**:
Henüz planlanmamış İşler dahil değerlendirilecek İşlerin hazır dinamik koleksiyonu ve Projedeki tek kalıcı manuel sıra; üyelik durum yazmaz ([Backlog](docs/prd/06-work-management-and-planning.md#backlog)).
_Avoid_: Klasör, etiket, statik liste, Kanban sırası

**Günlük Odak**:
Kullanıcının farklı Projelerden bugün ele almak istediği İşleri toplayan kişisel görünüm; durum, öncelik veya proje aşaması yazmaz ([Günlük Odak](docs/prd/06-work-management-and-planning.md#günlük-odak)).
_Avoid_: Odak Dönemi, sprint, Aktif Çalışma Seti, Takvim olayı

**Kayıt Eylemi**:
Kullanıcının kapalı alan ve üyelik adımlarından adlandırdığı, tek hedef kayıt üzerinde çalışan birleşik yazma tanımı; otomasyon kuralı, Toplu Düzenleme veya betik pazarı değildir ([kullanıcı başlatmalı kayıt eylemleri](docs/prd/06-work-management-and-planning.md#kullanıcı-başlatmalı-kayıt-eylemleri)). UI: `Record Action`.
_Avoid_: macro marketplace, otomasyon kuralı, Toplu Düzenleme, script, çok kayıtlı düğme

**Start Work**:
Durumu `In Progress` yapan ve İşi Günlük Odak üyeliğine ekleyen ilk Kayıt Eylemi örneği. UI: `Start Work`.
_Avoid_: otomasyon kuralı, çok kayıtlı düğme, arka plan kuralı

**Birleşik Takvim**:
Desteklenen tarihli kayıtları türleri karışmadan gün, hafta, ay ve Agenda'da gösteren yüzey; yeni İş türü veya durum üretmez ([Birleşik Takvim](docs/prd/06-work-management-and-planning.md#birleşik-takvim)).
_Avoid_: Dış takvim senkronu, Event kaydı, durum tahtası

**Liste görünümü**:
Filtrelenen İşleri alanlarıyla yoğun ve taranabilir düzende sunan aynı İş taraması; satır ayrı kayıt değildir ([Liste görünümü](docs/prd/06-work-management-and-planning.md#liste-görünümü)).
_Avoid_: Tablo Görünümü, ikinci kayıt sistemi, Backlog

**Kapsam Ağacı**:
Mevcut `Proje → Özellik → Kapsanan işler` ilişkisini salt okunur açan görünüm; sürükleme parent–child üretmez ([Kapsam Ağacı](docs/prd/06-work-management-and-planning.md#kapsam-ağacı)). UI: `Scope Tree`.
_Avoid_: Epic hiyerarşisi, subtask ağacı, planlama üyeliği

**Proje genel bakışı**:
Tek Projenin amacı, yaşamı, işi, bilgisi, belirsizliği, testi ve olaylarını kaynaklarından nötr özetleyen yüzey; otomatik sağlık skoru değildir ([Proje genel bakışı](docs/prd/04-workspace-and-projects.md#proje-genel-bakışı)). UI: `Overview`. Proje alanı değildir ve kapanmaz. Modül adları: `Purpose`, `Lifecycle`, `Goals`, `Stages`, `Milestones`, `Work`, `Documents`, `Decisions`, `Risks`, `Tests`, `Production`, `Blockers`, `Dates`, `Recent changes`.
_Avoid_: Dashboard skoru, Çalışma Alanı genel bakışı, Manuel Proje Güncellemesi

**Çalışma Alanı genel bakışı**:
Tek Çalışma Alanının `Active Projects`, `Attention Required`, `Upcoming` ve `Recent Work` hazır modülleriyle açılan ufku; özetler kaynak kayıtlardan türetilir ve sağlık hükmü, Portfolio veya ikinci dashboard değildir ([Çalışma alanı genel bakışı](docs/prd/04-workspace-and-projects.md#çalışma-alanı-genel-bakışı)).
_Avoid_: Workspace dashboard, Portfolio, Mission Control, Home board, Proje genel bakışı

**Kişisel canlı blok**:
Çalışma Alanı genel bakışına eklenen mevcut Belge veya adlandırılmış Akıllı Koleksiyon görünümü referansı; gövde, üyelik kuralı, serbest widget veya kopya kayıt değildir ([Çalışma alanı genel bakışı](docs/prd/04-workspace-and-projects.md#çalışma-alanı-genel-bakışı)). UI: `Add live block`.
_Avoid_: widget, dashboard kartı, kopya Belge, sorgu bloğu

**Kaydedilmiş çapraz Proje listesi**:
Çalışma Alanı çapında Proje yaşam durumu, aşama, tarih, arşiv ve desteklenen Proje alanları gibi görünür koşullardan canlı üyelik türeten adlandırılmış görünüm; Portfolio, Program, klasör, üst Proje, Proje skoru veya Akıllı Koleksiyon değildir ([Kaydedilmiş çapraz proje listeleri](docs/prd/04-workspace-and-projects.md#kaydedilmiş-çapraz-proje-listeleri)). UI: `Saved lists`.
_Avoid_: Portfolio, Program, Smart Collection, statik üyelik, rapor doğruluk kaynağı

**Son bildirilen sağlık**:
Son Manuel Proje Güncellemesinin tarihiyle gösterilen sağlık işareti; güncel Project health alanı, otomatik hüküm veya tarihsiz rozet değildir ([Kaydedilmiş çapraz proje listeleri](docs/prd/04-workspace-and-projects.md#kaydedilmiş-çapraz-proje-listeleri)). UI: `Last reported health`.
_Avoid_: Project health, Mission Control, tarihsiz sağlık rozeti

**Kaynak kaydı aç**:
Ana kaydı kopyalamadan açan ortak eylem; ikinci doğruluk kaynağı veya kayıt yazması değildir ([etkileşim tutarlılığı](docs/prd/15-product-quality.md#etkilesim-tutarliligi)). UI: `Open source record`.
_Avoid_: Open record, View details, ikinci kayıt kopyası

**All Tools**:
Etkin veya henüz navigasyona sabitlenmemiş hazır Proje alanlarını tek keşif yüzeyinde gösteren, Proje alanı olmayan daima erişilir giriş ([Proje alanlarını etkinleştirme](docs/prd/04-workspace-and-projects.md#proje-alanlarını-etkinleştirme)). UI: `All Tools`.
_Avoid_: ana menü, gizli alan silme, Overview

**Yapılandırma modu**:
Aşama, İş durumu adı, etkin alan, özel alan, öncelik ölçütü, kayıtlı görünüm ve İş Bağlam Kartı düzenini günlük içerik düzenlemesinden ayıran görünür sunum durumu; izin veya yönetici rolü değildir ([yapılandırma modu](docs/prd/04-workspace-and-projects.md#yapılandırma-modu)). UI: `Configuration Mode`.
_Avoid_: yönetici rolü, izin duvarı, ayarlar sayfası, workflow kapısı

**Proje yapısını kopyalama**:
Aşama, etkin alan, durum, hazır görünüm, İş Bağlam Kartı düzeni, özel alan tanımı, öncelik ölçütü tanımı ve boş duvar iskelet tanımını içeriksiz yeni Projeye aktarma; kayıt, geçmiş, ilişki, şablon, Planlı Test Senaryosu veya otomasyon kopyalamaz ([proje yapısını kopyalama](docs/prd/04-workspace-and-projects.md#proje-yapısını-kopyalama)). UI: `Copy project structure`.
_Avoid_: Projeyi çoğalt, Duplicate project, içerikli fork, şablon pazarı, ortak Workspace alan kimliği

**Öncelik ölçütü**:
İşin önceliğini ifade eden Proje yapılandırması; skaler öncelik alanı veya otomatik skor değildir ([öncelik ölçütleri](docs/prd/06-work-management-and-planning.md#öncelik-ölçütleri)). UI: `Priority metrics`.
_Avoid_: öncelik puanı, otomatik sıralama, skaler öncelik alanı, özel alan, İş alanı

**Öncelik kademesi**:
Öncelik ölçütünün beş sabit sıralı düzeyi; boş veya henüz değerlendirilmemiş durum bu beşin dışındadır ([öncelik ölçütleri](docs/prd/06-work-management-and-planning.md#öncelik-ölçütleri)). UI: `Very low`, `Low`, `Medium`, `High`, `Very high`. Boş gösterim: `Unevaluated`.
_Avoid_: Medium varsayılanı, serbest sayı, formül kademesi

**Öncelik Haritası**:
Aynı Projede iki sıralı Öncelik ölçütünü eksen seçerek İşleri karşılaştıran görünüm; skor, otomatik sıra, çeyrek etiketi, Backlog sırası veya Kanban durumu yazmaz ([Öncelik Haritası](docs/prd/06-work-management-and-planning.md#öncelik-haritası)). UI: `Priority Map`. Boş gösterim: `Unevaluated`.
_Avoid_: öncelik puanı, otomatik sıralama, çeyrek kararı, analitik dashboard, Backlog sırası

**Kanıt gücü**:
Görüşlü Başlangıç yapılandırmasının varsayılan kapalı hazır Öncelik ölçütü; kurucu etkinleştirir ve kademeyi eliyle seçer ([öncelik ölçütleri](docs/prd/06-work-management-and-planning.md#öncelik-ölçütleri)). UI: `Evidence strength`.
_Avoid_: otomatik kanıt skoru, Geri Bildirim sayısı, popülerlik puanı

**Önceliklendirme oturumu**:
Proje kapsamlı, adlandırılmış karar görünümü; seçili İş kapsamı ile görünüm-yerel manuel sıra tutar, Backlog sırası, ölçüt değeri veya İş durumu yazmaz ([önceliklendirme oturumları](docs/prd/06-work-management-and-planning.md#önceliklendirme-oturumları)). UI: `Create Prioritization Session`.
_Avoid_: Günlük Odak, Odak Dönemi, oturum skoru, otomatik kazanan, Karar kaydı, ikinci öncelik gerçeği

**Kayıtlı görünüm**:
Proje kabuğunda adlandırılmış İş görünümü; günlük planlama eylemi veya ikinci üyelik listesi değildir ([yapılandırma modu](docs/prd/04-workspace-and-projects.md#yapılandırma-modu)). UI: `Saved views`.
_Avoid_: Planning, ikinci Backlog, klasör üyeliği

**Manuel Proje Güncellemesi**:
Kurucunun tarihli öznel sağlık işareti, kısa anlatı ve o anki özet snapshot'ıyla kaydettiği Proje yardımcı varlığı; güncel otomatik sağlık hükmü değildir ([Manuel Proje Güncellemeleri](docs/prd/04-workspace-and-projects.md#manuel-proje-güncellemeleri)).
_Avoid_: Canlı sağlık skoru, Mission Control, Proje genel bakışı

**Kişisel erişim kabuğu**:
Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve Yeniden bak öğelerini kaynak görünümünü kaybetmeden açan ortak kişisel yüzey; planlama gerçeği üretmez ([kişisel erişim kabuğu](docs/prd/04-workspace-and-projects.md#bağlamı-koruyan-kişisel-erişim-kabuğu)).
_Avoid_: Workspace dashboard, ikinci Backlog, Favori üyeliği

**Aktif Çalışma Seti**:
Açık oturum boyunca üzerinde durulan İş ve Belgeleri kaynak bağlamını kaybetmeden tutan kişisel seçim; oturum bitince geri yüklenmez ([Aktif Çalışma Seti](docs/prd/04-workspace-and-projects.md#oturumluk-aktif-çalışma-seti)).
_Avoid_: Favori, Günlük Odak, bookmark kuyruğu, planlama üyeliği

**Çalışmaya Dön**:
Ara verilen Proje veya İşe güncel kayıtlardan seçilen geri dönüş kartlarıyla bağlamı yeniden kuran özet; seans, bildirim yığını veya sekme geri yükleme değildir ([Çalışmaya Dön](docs/prd/04-workspace-and-projects.md#çalışmaya-dön-özeti)).
_Avoid_: Bildirim, hatırlatma, recent-tabs, ikinci çalışma listesi

**Son ziyaret işareti**:
Hesapta Proje ve desteklenen İş bağlamı başına son başarılı görünür açılış zamanı; görüntüleme geçmişi, süre, analytics veya denetim olayı değildir ([Çalışmaya Dön özeti](docs/prd/04-workspace-and-projects.md#çalışmaya-dön-özeti)).
_Avoid_: oturum süresi, Denetim kaydı, Dış yüzey yayını

**Birleşik Bildirim Merkezi**:
Kapalı registrydeki dikkat sinyallerini Eylem Gerekiyor ve Bilgi Akışı olarak toplayan merkez; bildirimi okumak kaynak sorunu çözmez ([Birleşik Bildirim Merkezi](docs/prd/04-workspace-and-projects.md#birleşik-bildirim-merkezi)).
_Avoid_: E-posta ürünü, Geri Bildirim feed'i, serbest bildirim

**Favori**:
Kaydın Projesini, türünü veya durumunu değiştirmeden kişisel sık erişim listesine alınan işaret ([Favoriler](docs/prd/04-workspace-and-projects.md#favoriler)).
_Avoid_: Bookmark kuyruğu, Aktif Çalışma Seti, planlama üyeliği

**Hatırlatma**:
Desteklenen kayda Hesap kapsamında kişisel zaman bağlayan ana kayıt; kaynak sahiplik değil köken referansıdır ve kaynak yaşamı veya planlama üyeliği yazmaz ([kişisel hatırlatmalar](docs/prd/06-work-management-and-planning.md#kişisel-hatırlatmalar)). UI: `Remind me`.
_Avoid_: Target date, Yeniden görünme tarihi, standalone reminder, Save for Later kuyruğu

**Akıllı Koleksiyon**:
Üyeliği kayıtlar üzerindeki açık filtrelerden canlı türetilen, adlandırılmış görünüm; manuel üyelik listesi, klasör veya ayrı içerik kaydı değildir.
_Avoid_: Statik liste, klasör, etiket

**Etiket**:
Çalışma Alanı genelinde yaşayan düz sınıflandırma kimliği; kayıt içeriği, klasör üyeliği veya süzme görünümü değildir ([Etiketler](docs/prd/08-search-relations-and-evidence.md#etiketler)). UI: `Tags`.
_Avoid_: Klasör, Akıllı Koleksiyon, Proje-yerel etiket sözlüğü, hiyerarşi

**Proje bazlı özel alan**:
Yalnız bir Projede yaşayan, Metin, Sayı, Boolean, Tarih, tek seçim veya çoklu seçim türünde yapılandırılmış sınıflandırma alanı ([proje bazlı özel alanlar](docs/prd/08-search-relations-and-evidence.md#proje-bazlı-özel-alanlar)).
_Avoid_: Lookup, Formula, çalışma alanı genelinde şema, etiket hiyerarşisi

**Yakalama Gelen Kutusu öğesi**:
Kaydedilmiş fakat henüz kalıcı kayıt türüne ve bağlamına dönüştürülmemiş [geçici girdi](docs/prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler); ana kayıt, Backlog İşi veya uzun süreli bilgi deposu değildir.
_Avoid_: İş, Taslak, kaydedilmiş bookmark

**Çalışma alanı Yakalama Gelen Kutusu**:
Proje bilinmediğinde Yakalama Gelen Kutusu öğesinin durduğu Inbox kapsamı; ayrı bir ürün yüzeyi değildir ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)).
UI: `Workspace Capture Inbox`
_Avoid_: ikinci Gelen Kutusu ürünü

**Proje Yakalama Gelen Kutusu**:
Proje bilindiğinde o Projenin Yakalama Gelen Kutusu öğelerinin durduğu Inbox kapsamı ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)).
UI: `Project Capture Inbox`
_Avoid_: ayrı Proje ürünü

**Yakalama mini şablonu**:
Bir Yakalama Gelen Kutusu öğesine yalnız isteğe bağlı yönlendirici alanlar ekleyen [biçim](docs/prd/05-capture-and-intake.md#hızlı-yakalama); kalıcı ana kayıt oluşturmaz ve yakalamayı kaydetmek için alan zorunlu kılmaz.
_Avoid_: Kayıt oluşturma formu, otomatik triage, içerik şablonu

**Sıralı triage**:
Yakalama Gelen Kutusunda tek öğeye odaklanan, yalnız üç açık çıkıştan biri çözülünce sıradakine ilerleyen [isteğe bağlı mod](docs/prd/05-capture-and-intake.md#hızlı-yakalama). UI: `Sequential triage`.
_Avoid_: Yeni kuyruk, SLA, otomatik çözüm

**Toplu Anlamlandırma**:
Birden fazla yakalamayı yan yana getirip geçici görsel kümeler kuran, kalıcı sınıflandırma üretmeyen [isteğe bağlı triage görünümü](docs/prd/05-capture-and-intake.md#hızlı-yakalama). UI: `Bulk sense-making`. Adlandırılmamış yakalamalar bu görünümde `Ungrouped` altında durur; kart, küme adını seçerek o görsel kümeye yerleşir.
_Avoid_: Etiket, ilişki, kalıcı küme kaydı

**Yakalama eki**:
Yalnız Yakalama Gelen Kutusu öğesine ait şifreli staging nesnesi; kalıcı kayda dönüşümde hedef kapsamda [Dosya Ekine terfi eder](docs/prd/05-capture-and-intake.md#hızlı-yakalama).
UI: `Capture attachment`
_Avoid_: Dosya Eki, paylaşılmış ek, kalıcı medya kütüphanesi

**Dönüştür**:
Yakalama Gelen Kutusu öğesini tek yeni ana kayda dönüştüren triage çıkışı; sahiplik ilgili kayıt feature’ına geçer ve bu feature İş, Belge veya Dosya Ekini tamamlamış saymaz ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Convert`.
_Avoid_: Create Bug, otomatik triage, çoklu kayıt tarifi

**Mevcut kayda bağla**:
Yakalama Gelen Kutusu öğesini mevcut ana kayda köken veya kanıt olarak bağlayan triage çıkışı; öneri onaysız birleştirmez ve başka Projedeki hedef önizlemesiz bağlanmaz ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Attach to existing`.
_Avoid_: otomatik birleştirme, sessiz çapraz Proje bağ, Create Bug

**Yakalama silme çıkışı**:
Yakalama Gelen Kutusu öğesini tüketen silme; Çöp Kutusu, Arşiv veya dördüncü örtük triage durumu değildir ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Delete`.
_Avoid_: Çöp Kutusu, Arşiv, gizleme filtresi

**Diğer Projeler**:
Aynı Proje önerilerinden ayrı, başka Projelerdeki benzer kayıt önerilerinin adlı ikincil grubu ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Other Projects`.
_Avoid_: birincil öneri, sessiz çapraz Proje bağ

**Yakalama köken bağı**:
Yakalamayı mevcut kayda köken olarak bağlayan ilişki; Kanıt bağı uzmanlığı veya Köken konumu değildir ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Origin`.
_Avoid_: Köken konumu, Kanıt bağı, otomatik ilişki

**Yakalama kanıt bağı**:
Yakalamayı mevcut kayda kanıt olarak bağlayan ilişki; Kanıt bağı uzmanlığının link type’ını bu feature tamamlamaz ([hızlı yakalama](docs/prd/05-capture-and-intake.md#hızlı-yakalama)). UI: `Evidence`.
_Avoid_: Kanıt bağı uzmanlığı, otomatik doğrulama, İlgili ilişkisi

**Taslak**:
Kullanıcı oluşturma eylemini tamamlamadan önce korunan, henüz kaydedilmemiş ayrıntılı İş formu; Yakalama Gelen Kutusu öğesi veya ana kayıt değildir. UI: `Draft`.
_Avoid_: Yakalama, İş, Belge taslağı

**Taslaklar**:
Kişisel Taslakların sürdürüldüğü veya açıkça silindiği yüzey; ana kayıt listesi, arama veya planlama yüzeyi değildir. UI: `Drafts`.
_Avoid_: İş listesi, Yakalama Gelen Kutusu, Belge taslağı

**Son kayıt**:
Son başarılı otomatik kaydın zamanı; bağlantı kesilince Client Shell kromunda gösterilir. UI: `Last saved`.
_Avoid_: yerel kuyruk satırı, Last successful save (uzantı gönderimi)

**Yazılmamış risk**:
Henüz sunucuya yazılmamış değişiklik uyarısı; yalnız unsaved-risk bayrağı varken. UI: `Unsaved changes may be lost`.
_Avoid_: çevrimdışı kuyruk, gizli replay

**Ürün Boşluğu**:
Kurucunun Cantiara kapsamında karşılanmadığını düşündüğü ihtiyacı ve bu ihtiyaca ilişkin değerlendirme durumunu taşıyan Çalışma Alanı ana kaydı; tekrar sayısı [Dış araca kaçış günlüğünde](docs/prd/04-workspace-and-projects.md#dış-araca-kaçış-günlüğü) yaşar.
_Avoid_: Özellik isteği, otomatik öncelik, dış araç oturumu

**Dış Araca Kaçış**:
Kurucunun Cantiara kapsamında gördüğü gerçek bir işi tamamlamak için başka bir araca geçtiğini açıkça kaydettiği tarihsel olay; dış davranışın otomatik izlenmesi veya dış içeriğin kopyası değildir.
_Avoid_: Bilinçli dış sınır, entegrasyon kullanımı, otomatik telemetry

## Keşif ve belirsizlik

**Karar**:
Alınmış ürün, tasarım veya geliştirme seçimini gerekçe ve ilişkileriyle taşıyan Proje ana kaydı; toplantı notu, Belge paragrafı veya oylama değildir ([Karar kayıtları](docs/prd/09-discovery-decisions-and-design.md#karar-kayıtları)). UI: `Decision`.
_Avoid_: toplantı notu, oylama, otomatik kazanan, Risk, Varsayım

**Risk**:
Etki, olasılık, yanıt ve durumla belirsiz zararı izleyen Proje ana kaydı; Bug, Test Açığı veya Üretim Olayı değildir ([Risk takibi](docs/prd/09-discovery-decisions-and-design.md#risk-takibi)). UI: `Risk`.
_Avoid_: Bug, Test Açığı, Üretim Olayı, öncelik puanı, yayın kapısı

**Varsayım**:
Doğrulanmamış önermeyi kanıt bağlamıyla taşıyan Proje ana kaydı; Açık Soru veya Deney/Doğrulama değildir ([Varsayım ve açık soru takibi](docs/prd/09-discovery-decisions-and-design.md#varsayım-ve-açık-soru-takibi)). UI: `Assumption`.
_Avoid_: Açık Soru, Deney kaydı, otomatik Karar

**Açık Soru**:
Yanıt bekleyen proje belirsizliği; araştırma notu veya Geri Bildirim değildir ([Varsayım ve açık soru takibi](docs/prd/09-discovery-decisions-and-design.md#varsayım-ve-açık-soru-takibi)). UI: `Open Question`.
_Avoid_: Varsayım, Geri Bildirim, araştırma notu

**Deney/Doğrulama**:
Ürün dışında yürütülen varsayım veya soru doğrulamasının yöntemini, sonucunu ve karar bağlamını taşıyan Proje ana kaydı; formal test veya yayın kapısı değildir ([Deney ve doğrulama kayıtları](docs/prd/09-discovery-decisions-and-design.md#deney-ve-doğrulama-kayıtları)). UI: `Validation Record`.
_Avoid_: Test Oturumu, Planlı Test Senaryosu, Kullanıcı Araştırması Oturumu

**Kullanıcı Araştırması Oturumu**:
Bir görüşme veya yönlendirilmiş araştırma temasının amaç, izin, türlenmiş not ve sürüme sabit kanıt bütünlüğünü taşıyan Proje ana kaydı ([Kullanıcı Araştırması Oturumları](docs/prd/09-discovery-decisions-and-design.md#kullanıcı-araştırması-oturumları)). UI: `Research Session`.
_Avoid_: Geri Bildirim, Test Oturumu, Deney/Doğrulama

## Bilgi ve kanıt

**Belge**:
Bir Proje veya Kişisel Wiki kapsamında yaşayan, sürümlü Markdown içeriğine sahip ana kayıt; başka kaydın metin alanı veya dış dosyayla canlı eşitlenen kopya değildir.
_Avoid_: Dosya Eki, harici Markdown dosyası, kayıt açıklaması

**Dosya Eki**:
Tam olarak bir Proje veya Kişisel Wiki kapsamında yaşayan, dosya içeriğini ve sürümlerini taşıyan ana kayıt; başka kapsamdaki ilişki sahipliğini veya görünürlüğünü değiştirmez.
_Avoid_: Belge, ilişki eki, paylaşılan global dosya

**Görsel türevi**:
Kesin bir Dosya Eki sürümünün özgün parmak izinden üretilen, küçük ve orta Gallery thumbnail cache'i; ayrı Dosya Eki, dosya sürümü veya kaynak dosya değildir ([görsel sunum](docs/prd/07-documents-and-knowledge.md#dosya-ekleri)). UI: `Unavailable` fallback kaynak kaydı bozuk saymaz.
_Avoid_: ikinci Dosya Eki, kapak görseli, ham nesne URL'si

**Kaynak görsel**:
Paylaşım/yayın önizlemesinde işaretleme katmanından ayrı onaylanan Dosya Eki görseli; katmanı onaylamaz.
_Avoid_: otomatik paylaşım, ikinci Dosya Eki

**İşaretleme katmanı**:
Kesin bir Dosya Eki sürümüne bağlı, özgün byte'tan ayrı geri alınabilir üstveri; kalem, vurgulayıcı, ok ve dikdörtgen ile sınırlı kanıt notu. Yeni Dosya Eki, dosya sürümü, yorum veya ilişki üretmez ve sonraki sürüme taşınmaz.
_Avoid_: üretim tasarım aracı, Wireframe belgesi, yorum dizisi

**Komut Paleti**:
Kurucu yüzeylerinde klavyeyle komut, gezinme, kayıt oluşturma ve Proje geçişi çalıştıran [yüzey](docs/prd/04-workspace-and-projects.md#komut-paleti-ve-klavye-odaklı-kullanım); Evrensel Arama sonuç listesi değildir. UI: `Command Palette`.
_Avoid_: Search, Universal Search, komut pazarı, yeniden eşlenebilir kısayol profili

**Evrensel Arama**:
Yetkili ana kayıtları deterministik tam metin sırası ve görünür eşleşme bağlamıyla [bulan yüzey](docs/prd/08-search-relations-and-evidence.md#evrensel-arama); Taslak, Yakalama Gelen Kutusu öğesi ve Dış yüzey arama sonucu değildir. UI: `Search`.
_Avoid_: Komut Paleti, anlamsal sıralama, AI arama

**Kayıt Keşfi**:
Evrensel Arama, hazır tür dizinleri ve tür kapsamlı tablo görünümüyle kaydı yerinde bulma; [keşif, karar ve tasarım alanından](docs/prd/09-discovery-decisions-and-design.md) ayrıdır.
_Avoid_: Discovery alanı, ürün keşfi, ayrı belge kütüphanesi

**Kaynak**:
Dış bilgiyi URL, erişim zamanı ve yakalanan içerikle tarihsel sürümler hâlinde koruyan Proje ana kaydı; canlı web sayfası, geçici bağlantı önizlemesi veya kendiliğinden onaylanmış kanıt değildir.
_Avoid_: Akıllı bağlantı önizlemesi, bookmark, canlı web aynası

**Geri Bildirim**:
Özgün mesajı, kanalı ve zamanı koruyan uzman ana kayıt; Kaynak alt türü, özellik isteği veya destek ticket'ı değildir ([Geri Bildirim Kaydı](docs/prd/08-search-relations-and-evidence.md#geri-bildirim-kaydı)).
_Avoid_: Kaynak Kaydı, sosyal gönderi, CRM fırsatı

**Contact**:
Geri bildirimi veren kişiyi geri bildirimler boyunca aynı kimlikle tanıyan Çalışma Alanı ana kaydı; ticari hesap veya CRM kartı değildir ([Contact ve Company kimliği](docs/prd/08-search-relations-and-evidence.md#contact-ve-company-kimliği)).
_Avoid_: Kullanıcı Hesabı, Persona, müşteri kaydı

**Company**:
Birden fazla Contact ve Geri Bildirimi isteğe bağlı ortak kuruluş bağlamında gruplayan hafif ana kayıt; gelir, sözleşme veya satış aşaması taşımaz.
_Avoid_: CRM hesabı, ticari Hesap, Invoice müşterisi

**Kanıt bağı**:
Kesin bir Kaynak, Belge, Diyagram veya Dosya Eki sürümünün belirli bir hedef iddiayı desteklediğini açık rol ve atıfla gösteren ilişki; Kaynağın varlığı tek başına bu bağı veya doğruluk hükmünü oluşturmaz.
_Avoid_: İlgili ilişkisi, belirsiz referans, otomatik doğrulama

**Kanıt Rolü**:
Bir Kanıt bağının hedefe göre kapalı kullanım rolü; kaynak metin veya kullanıcı yorumu değildir ([Kanıt Rolü](docs/prd/08-search-relations-and-evidence.md#kanit-rolu-ve-iliski-ustverisi)).
_Avoid_: otomatik sınıflandırma, kanıt kalitesi skoru, Geri Bildirim niteliği

**Kanıt Akışı**:
İş, Karar ve Varsayım detayında yalnız açık Kanıtı ilişkilerini zaman sırasıyla gösteren türetilmiş görünüm; yeni kanıt uydurmaz ([Kanıt Akışı](docs/prd/08-search-relations-and-evidence.md#kanıt-akışı)). UI: `Evidence Flow`.
_Avoid_: Geri Bildirim feed'i, Proje Etkinliği, bildirim tüneli

**Kaynak Kontrolü**:
Kullanıcının açık yeniden kontrolünün tarihli sonucu ve aday snapshot'ı; onaylı Kaynak sürümünü kendiliğinden değiştirmez ([Kaynağı yeniden kontrol etme](docs/prd/08-search-relations-and-evidence.md#kaynağı-yeniden-kontrol-etme-ve-sürüm-karşılaştırması)). UI: `Source Check`.
_Avoid_: canlı sayfa yenileme, webhook senkronu, otomatik Kanıt bağı

**Çürütülen Varsayım İnceleme Kuyruğu**:
`Çürütüldü` bir Varsayımın `Dayanır` / `Dayanağıdır` ile bağlı `Geçerli` Karar ve kapanmamış İş satırlarından oluşan [inceleme listesi](docs/prd/18-future-directions.md#çürütülen-varsayım-inceleme-kuyruğu); gelecek yönü adayıdır, ilk ürün davranışı veya etki analizi değildir. UI: `Refuted Assumption Review`.
_Avoid_: Çalışma alanı bölmesi, bildirim, otomatik kapanış, etki hükmü

**Dayanır / Dayanağıdır**:
İş veya Kararın bir Varsayıma dayandığını gösteren uzman ilişki; Kanıt bağı veya genel `İlgili` değildir. UI: `Based on` / `Basis for`.
_Avoid_: Kanıt bağı, İlgili, paylaşılan kanıttan çıkarılan bağ

**Diyagram otorite kipi**:
Bir diyagram örneğinin kalıcı içeriğinin nerede kanonik olduğunu ve güncellik iddiasını belirleyen, kayıt kimliği boyunca değişmeyen tek [sınıflandırma](docs/prd/11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar).
_Avoid_: Diyagram türü, dosya biçimi, paylaşım kipi

**Üründe yazılmış model**:
İçeriği ürün veritabanında kanonik olan ve yalnız ürünün değişiklik geçmişi ile düzenleme sözleşmesi altında değişen diyagram otorite kipi.
_Avoid_: Repository aynası, dış dosya bağlantısı

**Repository’den türetilmiş görünüm**:
Kullanıcının seçtiği kesin repository kaynakları ve revizyonundan hesaplanan, içeriği ürün içinde bağımsız düzenlenmeyen diyagram otorite kipi.
_Avoid_: AI’ın doğru varsayılan çizimi, ürün-owned diyagram, canlı çift yönlü senkronizasyon

**İçe aktarılmış bağımsız kopya**:
Dış dosyanın açık dönüşümünden sonra ürün veritabanında yeni kimlikli kanonik içeriğe dönüştüğü, dış kaynağın sonraki değişikliklerini izlemeyen diyagram otorite kipi.
_Avoid_: Canlı import, round-trip senkronizasyon, dış kaynağın yeni sürümü

**Dış kaynak bağlantısı**:
Diyagram içeriğinin ürün dışında kanonik kaldığı; ürünün yalnız kesin dış hedefi, bilinen kaynak revizyonunu, kökeni ve proje ilişkilerini koruduğu diyagram otorite kipi.
_Avoid_: İçe aktarılmış kopya, ürün-owned diyagram, embed ile sahiplik

**Teknik Diyagram**:
Bir yazılım Projesinin veri modelini, teknik yapısını veya desteklenen sistem etkileşimini bağımsız kimlik, Diyagram otorite kipi, geçmiş ve ilişkilerle taşıyan proje ana kaydı.
_Avoid_: Mermaid kod bloğu, genel canvas, Proje Duvarı çizgisi

**Belge içi Mermaid diyagramı**:
Tek bir Markdown Belgesine ait Mermaid kaynak kodu ile onun işlenmiş görünümünden oluşan, Belgeden bağımsız kimlik veya yaşam döngüsü taşımayan içerik bloğu.
_Avoid_: Teknik Diyagram ana kaydı, otomatik çıkarılmış diyagram kaydı

**Tasarlanan şema**:
Kullanıcının amaçladığı veri modelini ürün içinde düzenlediği, henüz repository veya çalışan veritabanı gerçeği olduğu iddiasını taşımayan Teknik Diyagram.
_Avoid_: Uygulanmış şema, Repository şeması, canlı veritabanı introspection’ı

**Repository şeması**:
Seçili schema veya migration kaynaklarının kesin repository revizyonunda ifade ettiği veri modelinden türetilen salt-okunur Teknik Diyagram; çalışan veritabanına uygulanmışlık iddiası taşımaz.
_Avoid_: Uygulanmış şema, canlı veritabanı şeması, Tasarlanan şema

**Teknik Mimari Diyagramı**:
Bir yazılım Projesindeki bileşen, servis, veri akışı ve harici sistem bağlantılarını gösteren Teknik Diyagram türü.
_Avoid_: Kullanıcı Akışı, Proje Duvarı, genel flowchart

**Veri Modeli Diyagramı**:
Bir yazılım Projesinin veri varlıklarını, alanlarını, kısıtlarını ve aralarındaki yapısal ilişkileri gösteren Teknik Diyagram türü; uygulanmışlık veya migration yürütme iddiası taşımaz.
_Avoid_: Veri Varlığı kaydı, canlı DB şeması, genel tablo görünümü

**Şema Görünümü**:
Tek bir Veri Modeli Diyagramındaki kullanıcı tarafından seçilmiş varlık, alan ve ilişkileri gösteren Diyagram Görünümü; bağımsız veri modeli veya fiziksel database namespace'i oluşturmaz.
_Avoid_: Customer şeması, Admin şeması, ikinci Veri Modeli Diyagramı, PostgreSQL schema

**Diyagram Görünümü**:
Tek bir Teknik Diyagramın seçilmiş öğelerini adlandırılmış yerleşim ve görünüm notlarıyla gösteren, kaynak öğeleri kopyalamayan sunum yüzeyi; bağımsız Teknik Diyagram veya erişim kapsamı değildir.
_Avoid_: Alt diyagram, canvas bölgesi, ayrı teknik model, paylaşım izni

**Teknik Diyagram yapısal modeli**:
Bir Teknik Diyagramın türlenmiş düğüm, alan, bağlantı ve semantik kısıtlarını ürün veritabanında taşıyan [kanonik içeriği](docs/prd/11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar); görsel yerleşim ise görünüm üstverisidir.
_Avoid_: Diyagram DSL’i, render edilmiş görsel, canvas koordinatları

**Diyagram Sürümü**:
Bir Teknik Diyagramın kullanıcı tarafından adlandırılıp değişmez hâle getirilen kesin yapısal model ve görünüm checkpoint'i; canlı diyagramın yerine geçmez, hangi tasarımın esas alındığını sabitler.
_Avoid_: Autosave, değişiklik geçmişi olayı, canlı diyagram, export dosyası

**PostgreSQL DDL taslağı**:
Kesin bir Veri Modeli Diyagramı Sürümünden ürünün [ürettiği](docs/prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari), incelenip dışarı aktarılabilen tam PostgreSQL şema metni; ürün içinde çalıştırılmaz ve uygulanmış şema garantisi taşımaz.
_Avoid_: Migration, uygulanmış SQL, repository şema dosyası, database backup

**Şema Değişiklik Taslağı**:
İki kesin Veri Modeli Diyagramı Sürümü arasındaki türlenmiş schema farkını [inceleme için gösteren taslak](docs/prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari); çalışan database durumu veya uygulanmış migration değildir.
_Avoid_: Metin diff’i, uygulanmış şema, otomatik migration yürütümü

**Migration Artefaktı**:
Onaylanmış bir Şema Değişiklik Taslağını kaynak manifestiyle koruyan, Veri Modeli Diyagramına ait [değişmez sahipli bileşen](docs/prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler); ürün içinde çalıştırılmaz ve uygulanmışlık iddiası taşımaz.
_Avoid_: Migration çalıştırması, deployment, database backup, Diyagram Sürümü, bağımsız ana kayıt

**Migration Artifact Digest**:
Migration Artefaktının generator çıktısından bağımsız, değişmez içerik özeti; yapısal model hash'inin yerine geçmez.
_Avoid_: Model hash, uygulanmışlık kanıtı, şema kimliği

**Supersedes Migration Artifact**:
Aynı diyagramdaki sonraki düzeltme artefaktının önceki artefakta değişmez pointer'ı; eski kanıtı miras almaz.
_Avoid_: Kanıt devri, sessiz değiştirme, uygulanmışlık güncellemesi

**Güvenli Down taslağı**:
Bir Migration Artefaktındaki bütün desteklenen operasyonların deterministik ve veri kayıpsız tersi kanıtlandığında sunulan [PostgreSQL geri alma taslağı](docs/prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari); veri taşıma veya genel rollback garantisi değildir.
_Avoid_: Her migration için Down, database restore, güvenli deployment garantisi

**Ajan öneri yaması**:
Bir AI ajanının kesin taban Teknik Diyagram revizyonuna karşı önerdiği ve kullanıcı seçip onaylamadan kanonik kayda [yazılmayan değişiklik taslağı](docs/prd/18-future-directions.md#read-first-programatik-erişim-yönü).
_Avoid_: Ajan yazması, scoped CRUD, otomatik diyagram güncellemesi

**Statik olarak doğrulanmış SQL**:
Ürünün [statik doğrulama kontrollerinden](docs/prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari) geçen fakat kullanıcının veritabanında çalıştırılmamış DDL ya da migration SQL'i; uygulanmış, production-ready veya runtime'da güvenli olduğu iddiasını taşımaz.
_Avoid_: Çalıştırılmış SQL, uygulanmış migration, production-ready SQL

**Teknik Sıra Diyagramı**:
Yazılım bileşenleri, servisler veya dış sistemler arasındaki mesaj ve çağrıların zamansal sırasını gösteren Teknik Diyagram türü; kullanıcının arayüzdeki hedef ve karar yolunu gösteren Kullanıcı Akışının yerine geçmez.
_Avoid_: Kullanıcı Akışı, Proje Etkinliği, genel flowchart

**Ekran**:
Bir ürün ekranını temsil eden, Proje kapsamında bağımsız kimlik, geçmiş ve yaşam döngüsü taşıyan ana kayıt; görsel tasarım olmadan yalnız başlıkla var olabilir.
_Avoid_: Wireframe kaydı, Ekran bileşeni, flow node'u

**Kullanıcı Akışı**:
Kullanıcının arayüz hedefi ve karar yolunu canlı Ekran referanslarıyla taşıyan tasarım ana kaydı; Ekran kopyası, teknik sıra veya durum makinesi değildir.
_Avoid_: Wireframe belgesi, Teknik Sıra, flowchart

**Wireframe yüzeyi**:
Bir Ekranın düşük sadakatli görsel düzenini ve sürüm zincirini taşıyan düzenleme yüzeyi; bağımsız ana kayıt veya yaşam döngüsü değildir.
_Avoid_: Wireframe ana kaydı, Ekrandan bağımsız Wireframe

**Yüzey metni**:
Kullanıcının geliştirdiği üründe bir Ekranda görünen boş durum, hata veya denetim cümlesinin Ekrana ya da kesin Wireframe sürümüne bağlı sahipli öğesi; çeviri belgesi veya düzen metninin ikinci kopyası değildir.
_Avoid_: i18n TMS, copy deck, Wireframe bloğu kopyası

**Sahipli bileşen**:
Tek bir ana kayda ait olan ve sahibinden bağımsız erişim, kapsam veya yaşam döngüsü kazanamayan kalıcı domain öğesi.
_Avoid_: Ana kayıt, yardımcı kayıt

**Dış yürütme devri**:
Bir İşin AI ajanında veya harici araçta yürütülecek test-dışı çalışmasının kesin bağlamını, dönen sonucunu ve kullanıcı kararını tarihsel koruyan [sahipli bileşen](docs/adr/0015-dis-yurutme-devrini-ise-ait-bilesen-olarak-tut.md); planlı ya da formel test için Test Handoff'unun yerine geçmez.
_Avoid_: Coding session, ajan görevi, bağımsız Handoff ana kaydı

**Dış yürütme uzlaştırması**:
Bir Dış yürütme devrinin sonucunu, kanıtını ve açık sorularını kullanıcının inceleyip ana proje gerçeğine bağladığı kapanış kararı; commit, PR veya durum değişikliği bu kararı kendiliğinden oluşturmaz.
_Avoid_: Commit geldi, otomatik kapanış, İş tamamlandı

**Kullanıcı başlatmalı İş başarısı**:
Kullanıcının açık kapatma kararıyla bir İşin kalıcı kapanış sonucunun kesinleşmesi; [başka terminal olaylar ve otomatik kapanışlar](docs/prd/06-work-management-and-planning.md#bitiris-efektleri) bu başarı değildir.
_Avoid_: Her terminal olay, otomatik kapanış, kapatma girişimi, iyimser tamamlanma

**Bitiriş efekti**:
Kullanıcı başlatmalı İş başarısını duygusal olarak hissedilir kılan, isteğe bağlı ve [ürünün kendi özgün kataloğuyla sınırlı](docs/adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md) dekoratif geri bildirim; başarının kalıcı durumunu veya temel geri bildirimini taşımaz.
_Avoid_: Konfeti, başarı durumu, lisanslı karakter efekti, kullanıcı yüklemeli efekt

**Değer Zinciri**:
Bir Proje Hedefinden problem ve kanıt üzerinden gözlenen sonuca kadar mevcut kesin kayıt ve ilişkileri gösteren [türetilmiş Proje görünümü](docs/prd/04-workspace-and-projects.md#değer-zinciri); ana kayıt, ilişki, özet metni veya sağlık hükmü üretmez.
_Avoid_: Değer Zinciri kaydı, elle güncellenen izlenebilirlik belgesi, sağlık skoru

**Herkese Açık Taahhüt Etki Görünümü**:
Seçili kesin iç kayıt veya sürümün hangi onaylanmış herkese açık snapshot revizyonlarında yer aldığını mevcut manifestlerden hesaplayan, [kanıt bekleyen gelecek yönü adayı](docs/prd/18-future-directions.md#herkese-acik-taahhut-etki-gorunumu).
_Avoid_: Taahhüt kaydı, anlamsal vaat tarayıcısı, özel paylaşım etki listesi

**Üretim Olayı Önleme Zinciri**:
Bir Üretim Olayını onun için açık anlamla bağlanmış düzeltme, tekrar-önleme kanıtı ve yayımlanma bağlamıyla gösteren, [kanıt bekleyen türetilmiş gelecek yönü adayı](docs/prd/18-future-directions.md#uretim-olayi-onleme-zinciri); nedensellik hükmü çıkarmaz.
_Avoid_: Olay kaydı kopyası, otomatik kök neden analizi, sürüm hazır olma kapısı

**Akış Kötüye Kullanım İncelemesi**:
Bir Kullanıcı Akışının kesin sürümünde kötüye kullanılabilecek yolları insan değerlendirmesiyle kaydeden [gelecek yönü adayı](docs/prd/18-future-directions.md#akis-kotuye-kullanim-incelemesi); bağımsız ana kayıt veya backlog değildir.
_Avoid_: Tehdit modeli ana kaydı, güvenlik envanteri, otomatik Risk üretimi

**Çakışma Taslağı**:
Güncel olmayan bir Belge sürümüne yazıldığı için kabul edilmeyen metni kullanıcı açıkça çözene kadar koruyan sahipli bileşen; ana Belge sürümü, otomatik yeniden deneme veya ikinci doğruluk kaynağı değildir.
_Avoid_: Otomatik birleştirilmiş sürüm, çevrimdış yazma kuyruğu, Belge geçmişi

**Kayıt birleştirme**:
Gerçekte aynı şeyi temsil ettiği doğrulanan ana kayıtların içerik, ilişki ve geçmişlerini tek ana kayıtta toplama [işlemi](docs/prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma).
_Avoid_: İlgili kayıt, kayıt grubu

**Birleştirmeyi geri alma**:
Emekli kayıt kimliğini özgün kimliğiyle yeniden ana kayda dönüştüren [düzeltme işlemi](docs/prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma); geçmişe tam dönüş veya yedekten geri yükleme değildir.
_Avoid_: Geçmişe tam dönüş, yedekten geri yükleme, gizli kopyayı açma

**Emekli kayıt kimliği**:
Bir Kayıt birleştirmesinde yaşamı sona eren ana kaydın, hayatta kalan kayda kalıcı ve görünür biçimde yönlenen eski kimliği.
_Avoid_: İkinci canlı kayıt, yeniden kullanılabilir anahtar, sessiz takma ad

## Dış görünürlük

**Dış yüzey**:
Ziyaretçinin kararlı bir URL üzerinden eriştiği ve yayın köküyle aynı tek kanonik kapsamda yaşayan [paylaşım/yayın ana kaydı](docs/adr/0001-dis-yuzey-ve-snapshot-kimligi.md); gösterdiği içeriğin kendisi değildir.
_Avoid_: Snapshot, yayın sürümü

**Onaylı snapshot revizyonu**:
Bir Dış yüzeyde belirli bir onay anında gösterilmesine izin verilen kesin sürüm manifestinin değişmez ve [Dış yüzeyden bağımsız yaşayamayan revizyonu](docs/adr/0001-dis-yuzey-ve-snapshot-kimligi.md).
_Avoid_: Paylaşım bağlantısı, canlı görünüm, Dış yüzey

**Herkese açık durum etiketi**:
Bir İşin iç İş akışı durumunu değiştirmeden yalnız herkese açık Roadmap sunumunda gösterilen Proje bazlı ziyaretçi etiketi ([eşleme sözleşmesi](docs/prd/14-sharing-and-public-publishing.md#iç-durumların-herkese-açık-sunumu)).
_Avoid_: İş akışı durumu, ikinci herkese açık İş, otomatik yayın kararı

**Güvenlik nedeniyle redakte edilmiş kanıt**:
Değişmez sürüm manifestini yeniden yazmadan hassas içeriği [kaldırılmış kanıtın](docs/prd/10-testing-and-validation.md#düzeltme-geri-çekme-ve-güvenlik-redaksiyonu) erişilemez durumu; yeni bir sürümün kabul kanıtı olarak yeniden kullanılamaz.
_Avoid_: Temizlenmiş kanıt sürümü, erişilebilir şifreli özgün, geçerli devredilmiş kanıt

**Bağlantıyla sınırlı salt okunur paylaşım**:
Kimliği doğrulanmış bir alıcıya değil, kararlı bağlantıyı ve varsa parolayı elinde tutan herkese salt okunur erişim veren Dış yüzey türü.
_Avoid_: Özel paylaşım, kişiye özel paylaşım, kimlik doğrulamalı paylaşım

**Bağlantı süre dolumu**:
Önceden belirlenen zamanda yeni erişimi durduran, içeriği ve geçmişi silmeyen geri açılabilir Dış yüzey durumu.
_Avoid_: İptal, kalıcı silme

**Bağlantı iptali**:
Kurucunun belirli bir bağlantı ve erişim anahtarını geri döndürülemez biçimde geçersiz kıldığı Dış yüzey geçişi; sonraki paylaşım yeni Dış yüzeydir.
_Avoid_: Süre dolumu, geçici duraklatma

**Paylaşım erişim oturumu**:
Geçerli paylaşım anahtarı ve varsa parolanın ilk doğrulamasından sonra tek Dış yüzeye sınırlı süre erişim veren [tarayıcı oturumu](docs/prd/14-sharing-and-public-publishing.md#bağlantıyla-sınırlı-salt-okunur-paylaşım).
_Avoid_: İkinci paylaşım bağlantısı, kalıcı tarayıcı anahtarı, çalışma alanı oturumu

## Test yönetimi

**Planlı Test Senaryosu**:
Tekrar kullanılabilir test niyetini, önkoşullarını ve beklenen davranışını sürümler hâlinde taşıyan Proje ana kaydı; testi çalıştırmaz, sonuç taşımaz ve bağlı kapsamı doğrulanmış saymaz.
_Avoid_: Test Oturumu, test script'i, kabul sonucu

**Test Handoff'u**:
Ürün dışında yapılması istenen test çalışmasının amacını, seçili senaryo sürümlerini ve dönen Test Oturumlarını yöneten Proje ana kaydı; testi yürütmez ve sonuç geldiğinde kendiliğinden kapanmaz.
UI: `Test Handoff`.
_Avoid_: Dış yürütme devri, Test Oturumu, ajan çalıştırması

**Test Oturumu**:
Aynı dış çalışma bağlamında yürütüldüğü bildirilen testleri ve tarihsel özetini taşıyan Proje ana kaydı; bildirilen gerçekliği korur, kabul kanıtı üretmez.
UI: `Test Session`.
_Avoid_: Test Handoff'u, Ürün kabul kanıtı, canlı test çalıştırıcısı

**Oturum Testi**:
Bir Test Oturumu içinde bağımsız olarak denendiği bildirilen davranışı, sonucunu, bağlamını ve kanıtını taşıyan kayıt; üst Test Oturumundan bağımsız yaşamaz.
_Avoid_: Planlı Test Senaryosu, Test Oturumu özeti, GitHub check'i

**Test Açığı**:
Kullanıcının henüz denenmediğini veya yetersiz doğrulandığını düşündüğü alanı ve bu yargının dayanaklarını taşıyan Proje ana kaydı; başarısız test, Bug veya otomatik yayın engeli değildir.
UI: `Test Gap`.
_Avoid_: Bug, başarısız test sonucu, otomatik coverage açığı

**Test değerlendirmesi**:
Kullanıcının belirli bir bağlamdaki kesin test kayıtlarını belirli bir anda nasıl yorumladığını koruyan tarihsel snapshot; sonraki sonuçlarla güncellenen kalite skoru veya yayın kapısı değildir.
_Avoid_: Ürün kabul kanıtı, canlı test özeti, otomatik readiness kararı

## Sürüm ve ürün kabulü

**Proje Sürümü**:
Kullanıcının yönettiği yazılım Projesinde kapsamı, hazırlığı ve yayımlanma durumunu taşıyan Sürüm ana kaydı; ürünün kendi kabul süreci değildir.
_Avoid_: Ürün sürüm adayı, ürün release'i

**Sürüm iletişim iskeleti**:
Bir Proje Sürümüne ait, kullanıcının seçtiği kayıtlara bağlı ve cümlesini kendisinin yazdığı yayın söylemi maddeleri; otomatik anlatı veya herkese açık changelog değildir.
_Avoid_: Yapım hikâyesi, otomatik blog, changelog yüzeyi

**Erişim gözlemi**:
Bir Proje Sürümünün hedeflenen kullanıcıya belirli bir değerlendirme turunda hangi ölçüde ulaştığına dair kullanıcı tarafından kaydedilen sahipli değerlendirme; pazarlama performansı hükmü değildir.
_Avoid_: Kampanya sonucu, erişim skoru, otomatik analytics sonucu

**Sonuç gözlemi**:
Bir Proje Sürümünden sonra hedeflenen davranış veya sonucun belirli bir değerlendirme turunda hangi ölçüde görüldüğüne dair kullanıcı tarafından kaydedilen sahipli değerlendirme; Erişim gözleminin yerine geçmez.
_Avoid_: Sürüm başarısı, otomatik etki puanı, Erişim gözlemi

**Ürün sürüm adayı**:
Bu ürünün PRD kabul koşullarına karşı doğrulanan kesin build'i; kullanıcının yönettiği bir Proje Sürümü değildir.
_Avoid_: Proje Sürümü, kullanıcı Sürümü

**Kabul koşulu**:
Normatif ürün davranışındaki bağımsız ve gözlenebilir bir vaadi kesin Ürün sürüm adayı, fixture/ortam ve kanıtla tekil geçti/kaldı sonucuna bağlayan [doğrulama birimi](docs/prd/16-product-acceptance.md#kapsam-izlenebilirligi).
_Avoid_: Kabul iddiası, bölüm topluca geçti, iç takip kodu, kaynak satır numarası

**Ticari genişleme adayı**:
Kanıt bekleyen ticari gelecekte, tetikleyici oluşunca açık kapsam kararıyla etkinleştirilen [Proposal doğrulama kapsamı](docs/prd/16-product-acceptance.md#ticari-genisleme-kabulu); ilk ürünün tamamlanması bu adayı kendiliğinden başlatmaz ve Invoice taahhüdü oluşturmaz.
_Avoid_: İlk ürün kapsamı, otomatik sonraki aşama, kararlaştırılmış Invoice paketi

**Çalışma Alanı çıkış paketi**:
Kullanıcı parolasıyla şifrelenmiş, manifestli tam Çalışma Alanı arşivi; ürün içi restore veya zamanlanmış yedek değildir.
_Avoid_: Tam yedek, restore paketi, şifresiz arşiv

**Köken konumu**:
Sahipli bileşenden üretilen ana kaydın değişmez kaynak öğe işaretidir; bağımsız ilişki ucu veya ana kayıt değildir.
_Avoid_: Sahipli bileşen ilişkisi, sahte ana kayıt ucu

**Bildirilen Test Oturumu**:
Bir test aracının belirli bir derleme için gerçekleştiğini ve sonucunu bildirdiği tarihsel kayıt; testin gerçekten koştuğunu veya bir sürümün kabul edildiğini kanıtlamaz.
_Avoid_: Doğrulanmış kabul kanıtı, sürüm onayı

**Ürün kabul kanıtı**:
Kesin Ürün sürüm adayına bağlı onaylı koşturucu çıktısı veya belgelenmiş manuel kontrol beyanıyla bir Kabul koşulunu doğrulayan [kanıt](docs/prd/16-product-acceptance.md#urun-surum-adayi-kaniti).
_Avoid_: Proje Sürümü kanıtı, yalnız Passed durumu, Test Değerlendirmesi

**Kurucu öz-beyanı**:
Kurucunun bizzat uyguladığı manuel kullanıcı deneyimi veya erişilebilirlik kontrolünü belgeleyen, bağımsız inceleme sayılmayan Ürün kabul kanıtı.
_Avoid_: Bağımsız onay, ikinci kişi incelemesi, her iddia için yeterli manuel beyan

**Ürün destek matrisi**:
Bir Ürün sürüm adayının kabul anında doğrulandığı kesin [platform ve tarih kümesi](docs/prd/15-product-quality.md#kullanilabilirlik-hedefi); sonraki platform sürümleri geçmiş kabulü yeniden yazmaz.
_Avoid_: Zamana göre anlam değiştiren current/previous etiketi, sonsuza kadar sabit tarayıcı sürümü

**Kanıt bağımlılık manifesti**:
Pahalı bir Ürün kabul kanıtının hangi bağımlılıklara dayandığını sürümlü biçimde belirleyen [liste](docs/prd/16-product-acceptance.md#urun-surum-adayi-kaniti); yalnız tamamı değişmemişse kanıt sonraki Ürün sürüm adayına taşınabilir.
_Avoid_: Geçen ay geçti, rastgele spot kontrol, yalnız commit eşitliği

**Onaylı test koşturucusu**:
Sürümlü güven kuralıyla Ürün kabul kanıtı üretmesine izin verilen [otomatik yürütücü](docs/prd/16-product-acceptance.md#urun-surum-adayi-kaniti); her CI sonucu bu kimliği taşımaz.
_Avoid_: Her CI sonucu, paylaşılan API anahtarlı raporlayıcı, artifact URL'si

## Dış entegrasyonlar

**Bilinçli dış sınır**:
Bir Projedeki belirli gerçeklerin kalıcı kanonik sahibinin neden dışarıda kaldığını ve üründe neyin korunacağını belirten [kullanıcı kararı](docs/prd/18-future-directions.md#bilinçli-dış-sınır-sözleşmesi); dış sistemi eşitlemez veya çalıştırmaz.
_Avoid_: Entegrasyon envanteri, Dış Araca Kaçış, canlı senkronizasyon

**Dış ana kaynak işareti**:
Mevcut bir kayıtta kullanıcının koyduğu, asıl kopyanın ürün dışında kaldığını gösteren dar işaret; sözleşme, senkron veya sağlık hükmü değildir.
_Avoid_: Bilinçli dış sınır, entegrasyon durumu, kaçış kapanışı

**Rakip yırtma defteri**:
Bir rakibin iddiası, isteğe bağlı ekranı ve buna verilen cevabın ürün içinde tutulan [sahipli karşılaştırması](docs/prd/18-future-directions.md#rakip-ve-konumlandirma-alani); moodboard, pazar skoru veya otomatik rakip taraması değildir.
_Avoid_: Moodboard, rekabet zekâsı ürünü, serbest whiteboard

**İlk on dakika vaadi**:
Yeni hesabın ilk dakikalarda görmesi beklenen adımların Ekran veya Kullanıcı Akışına bağlı, [kullanıcının işaretlediği vaat listesi](docs/prd/18-future-directions.md#ilk-on-dakika-vaadi); zorunlu onboarding veya tur çalıştırıcısı değildir.
_Avoid_: Kullanıcı Akışı kopyası, Intercom turu, kurulum kapısı

**Destek oyun kitabı**:
Tekrarlayan bir şikâyette kontrol sırasını taşıyan, Üretim Olayı veya Özelliğe bağlı [sahipli maddeler](docs/prd/18-future-directions.md#destek-oyun-kitabı); helpdesk, ticket veya otomatik yanıt değildir.
_Avoid_: Intercom, önleme zinciri, SLA

**Kullanıcıya veri teslimi**:
Geliştirilen üründeki kullanıcının kendi verisini hangi biçimde alacağına dair [Proje vaadi](docs/prd/18-future-directions.md#kullanıcıya-veri-teslimi); Cantiara yedeği veya çalıştırılan export değildir.
_Avoid_: Ürün paketi, self-host yedek, hukuki yeterlilik

**Altyapı maliyeti notu**:
Koşturma sağlayıcısı, kabaca tutar ve gerekçenin Projede tutulan [notu](docs/prd/18-future-directions.md#altyapı-maliyeti-notu); müşteri Invoice'u veya muhasebe defteri değildir.
_Avoid_: Invoice, fiyat paketi, banka uzlaştırma

**GitHub bağlantısı**:
Bir Projeyi GitHub'daki tek kararlı repository kimliğine bağlayan ve yeniden yetkilendirmelerde geçmişini koruyan [entegrasyon kaydı](docs/adr/0006-github-entegrasyon-guven-siniri.md); repository sahibi veya adı kimlik sayılmaz.
_Avoid_: Repository adı eşleşmesi, kurulum takma adı

**GitHub dış kaydı**:
GitHub kaynak kimliğini ve son uzlaştırılmış kaynak durumunu salt okunur taşıyan, GitHub'daki kayıttan bağımsız yerel yaşam döngüsüne sahip [Proje ana kaydı](docs/prd/12-github-and-project-releases.md#github-geliştirme-kayıtları).
_Avoid_: Canlı GitHub kaydı, GitHub senkron kopyası, bağlantının sahipli bileşeni

**Akıllı bağlantı önizlemesi**:
Kimlik doğrulaması istemeyen herkese açık bir HTTP(S) adresinden türetilen, ana kayıt veya tarihsel Kaynak snapshot'ı olmayan [geçici sunum](docs/prd/08-search-relations-and-evidence.md#akıllı-bağlantı-önizlemesi) (bu sözlükte daha önce `Dış URL önizlemesi` olarak geçiyordu).
_Avoid_: Kaynak Kaydı, oturumlu tarayıcı önizlemesi, iç ağ önizlemesi

**Web Yakalama**:
Kurucunun tarayıcı uzantısında açıkça seçtiği içeriği Yakalama Gelen Kutusuna getiren [tekil girdi](docs/prd/05-capture-and-intake.md#tarayıcı-uzantısıyla-web-yakalama); doğrudan ana kayıt, arka plan taraması veya gönderim kuyruğu değildir.
_Avoid_: Otomatik web taraması, doğrudan İş oluşturma, tarayıcı geçmişi

**Uzantı bağlantısı**:
Hesaba beş dakikalık tek kullanımlık kodla bağlanan tarayıcı uzantısı yetkisi; cihaz, tarayıcı ve son kullanımla listelenir ve tek tek iptal edilir ([tarayıcı uzantısıyla web yakalama](docs/prd/05-capture-and-intake.md#tarayıcı-uzantısıyla-web-yakalama)). UI: `Extension links`.
_Avoid_: Ürün oturumu, tarayıcı clip arşivi, Safari Web Clipper

## Otomasyon

**Dikkat sinyali**:
Ürünün kapalı ve deterministik kurallarla kesin kaynaklardan saptadığı, kullanıcının incelemesine sunulan açıklanabilir olgu; bütün riskleri kapsadığı veya sağlık hükmü verdiği iddiasını taşımaz.
_Avoid_: Sağlık uyarısı, AI önerisi, eksiksiz risk tespiti

**Otomasyon çatışması**:
Aynı kaynak olaydan eşleşen kuralların aynı hedef alana birlikte uygulanamayacak değerler önermesi; hiçbir öneriyi kazanan ilan etmez ve hedefte otomatik değişiklik oluşturmaz ([otomasyon kuralları](docs/prd/06-work-management-and-planning.md#hafif-uygulama-içi-otomasyon-kuralları)).
_Avoid_: Son yazan kazanır, kural sırası, otomatik uzlaştırma

## Taşınabilirlik

**Aşamalı import**:
Ana kayıt yazmadan doğrulanan, açık son önizleme ve kullanıcı onayından sonra tek [atomik ve idempotent kesinleştirme](docs/adr/0004-atomik-idempotent-kesinlestirme.md) ya da tam rollback makbuzuyla biten CSV/JSON işlemi.
_Avoid_: Arka planda sessiz yazma, kayıt bazlı kısmi başarı, belirsiz son durum

**JSON dışa aktarma şeması**:
Kanonik yapılandırılmış dışa aktarımın alan, kimlik, köken ve ilişki anlamlarını belirleyen [açık sürümlü sözleşme](docs/adr/0005-json-tasinabilirlik-sozlesmesi.md).
_Avoid_: Sürümsüz JSON, tahminî eski dosya içe aktarımı, CSV kayıpsızlığı

**Elektronik tablo güvenli CSV**:
Formül gibi yorumlanabilecek kullanıcı metnini elektronik tabloda veri olarak açılacak biçimde işaretleyen ve bu dönüşümü [raporlayan kolaylık dışa aktarımı](docs/prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma); ham değerin kayıpsız kanonik temsili değildir.
_Avoid_: Kayıpsız CSV, formül çalıştırabilen ham hücre, kanıtsız apostrof kaldırma

## Veri güvenliği

**GitHub kimliğini yeniden teyit etme**:
Yüksek riskli bir işlem öncesinde yeni bir GitHub OAuth turundan dönen değişmez kullanıcı kimliğini mevcut Hesapla eşleyip yalnız o işleme bağlı geçici yetki üreten [sınır](docs/prd/03-account-platform-operations.md#github-kimliğini-yeniden-teyit-etme); parola, MFA veya genel oturum yenileme değildir.
_Avoid_: Yeniden kimlik doğrulama, MFA, parola doğrulama, genel oturum yenileme

**GitHub bekleniyor**:
GitHub kesintisinde yeni giriş ve GitHub kimliğini yeniden teyit etmenin görünür bekleme durumu (`Waiting for GitHub`); mevcut geçerli ürün oturumunu uzatmaz ve teyit isteyen yüksek riskli yazmayı fail-closed bırakır.
_Avoid_: GitHub eşitleme bekletme, App kurulumu, oturum yenileme

**Online-only çalışma**:
Belge okuma ve düzenleme ile kayıt yazmanın aktif internet bağlantısı gerektirdiği [çalışma modeli](docs/prd/03-account-platform-operations.md#calisma-ve-dagitim-modeli); yerel yazma kuyruğu, offline cache veya otomatik eşitleme yoktur.
_Avoid_: yerel-first, offline-first, senkron kuyruğu

**İmzalı masaüstü API sözleşmesi**:
Yayımlanmış imzalı macOS paketinin backend'in kabul ettiği masaüstü API sınırı ([çalışma ve dağıtım modeli](docs/prd/03-account-platform-operations.md#calisma-ve-dagitim-modeli)); web istemcisi veya User-Agent değildir.
_Avoid_: User-Agent, web API sürümü, semver eşlemesi

**Güncelleme gerekli**:
Süre dışı imzalı masaüstü API sözleşmesinin güvenli olmayan yazmadan önce durduğu açık hata ([çalışma ve dağıtım modeli](docs/prd/03-account-platform-operations.md#calisma-ve-dagitim-modeli)). UI: `Update required`.
_Avoid_: otomatik rollback, App Store güncellemesi, sessiz yükseltme

**Operasyonel yedek**:
Hizmetin `RPO ≤ 5 dakika` ve `RTO ≤ 8 saat` hedefli [kurtarma kopyası](docs/prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma); kullanıcıya dönük restore-point veya Çalışma Alanı çıkış paketi değildir.
_Avoid_: Çıkış paketi, ürün içi restore, Çöp Kutusu geçmişi

**Avrupa Birliği veri bölgesi**:
Özel Çalışma Alanı verisinin, bağlantıyla sınırlı içeriğin, yedeklerin ve günlüklerin otomatik kullanılabilirlik geçişi sırasında bile dışına taşınmadığı [onaylı bölgesel sınır](docs/adr/0009-ab-veri-siniri.md) (bu sözlükte daha önce `AB veri sınırı` olarak geçiyordu).
_Avoid_: Küresel otomatik failover, kesinti sonrası onay, herkese açık içerik teslim sınırı

**Güvenlik redaksiyonu**:
Hassas bir değeri güncel içerikten ve onu taşıyan bütün geçmiş revizyonlardan geri döndürülemez biçimde kaldıran, içeriksiz denetim izi bırakan güvenlik işlemi.
_Avoid_: Normal düzenleme, çöp kutusu, kalıcı kayıt silme

**Geri döndürülemez güvenlik olay günlüğü**:
Bir restore sonrasında yedekten daha yeni güvenlik kararlarını yeniden uygulamak için [ayrı korunan sürümlü olay sınırı](docs/adr/0003-restore-guvenlik-olay-gunlugu.md).
_Avoid_: Normal kayıt geçmişi, yalnız silme listesi, restore sonrası manuel kontrol listesi

**Hesap kapatma**:
Hesap ile onun tek Çalışma Alanını birlikte geri alınabilir bekleme süresine ve ardından kalıcı silmeye alan [birleşik yaşam döngüsü](docs/prd/03-account-platform-operations.md#hesap-kapatma).
_Avoid_: Yalnız çalışma alanını kapatma, oturumu kapatma

**Hesap kapanma dondurması**:
Kapanış tamamlama geçişi bittikten sonra kapanacak veri kümesini sabit güvenlik olay sınırında tutan [bekleme durumu](docs/prd/03-account-platform-operations.md#hesap-kapatma); yalnız kapatmayı iptal etme ve sabitlenmiş veriyi dışa aktarma açık kalır.
_Avoid_: Salt okunur normal Hesap, hareketli silme snapshot'ı, yarım işleri öldürme

**Kapanış tamamlanıyor**:
Hesap kapanma dondurmasından önce normal işleri güvenli bariyerlerinde durdurup başlamış geri döndürülemez güvenlik işlerini kesin makbuza ulaştıran fail-closed geçiş durumu.
_Avoid_: Otuz günlük bekleme, hareketli export dönemi, bütün worker'ları zorla öldürme

## Dogfooding

**Dış Araca Kaçış kapanışı**:
Etkilenen güncel gerçeğin kullanılabilir ürün kayıtlarına dönmesi, dış kopyanın paralel doğruluk kaynağı olmaktan çıkması ve düzeltilmiş akışın bu kayıtlara bağlı kanıtla doğrulanması.
_Avoid_: Yalnız hata düzeldi notu, dış araç ekran görüntüsü, bekleme süresi

## Geçmiş ve gözlemlenebilirlik

**Kayıt geçmişi**:
Bir ana kaydın içerik sürümleri ile ona yapılan domain değişikliklerinin, ana kayıt yaşadığı sürece korunan kalıcı bağlamı.
_Avoid_: Denetim kaydı, operasyon günlüğü

**Proje Etkinliği**:
Mevcut Kayıt geçmişinden türetilen, kaynak ve önceki–sonraki değerle incelenen atomik değişiklik görünümü; ürün hikâyesi veya Bildirim Merkezi değildir ([Proje Etkinliği](docs/prd/06-work-management-and-planning.md#proje-etkinliği)).
_Avoid_: GitHub Activity, e-posta günlüğü, zaman çizelgesi hikâyesi, ikinci olay deposu

**Güvenli geri alma**:
Ürünün ters işlemi deterministik hesaplayabildiği alan, ilişki, görünüm üstverisi ve atomik dönüşümlerde ilgisiz sonraki değişikliği sarmadan uygulanan geri alma ([değişiklik geçmişi](docs/prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma)). UI: `Undo`.
_Avoid_: Genel undo yığını, yayın geri alma, güvenlik redaksiyonunu geri alma

**Denetim kaydı**:
Kimlik doğrulama, yetkilendirme, paylaşım, yayın, entegrasyon ve yüksek riskli veri işlemlerini güvenlik ve hesap verebilirlik amacıyla süreli olarak belgeleyen olaylar.
_Avoid_: Kayıt geçmişi, operasyon günlüğü

**Operasyon günlüğü**:
Hizmetin çalışmasını teşhis etmek için üretilen, özel içerik veya secret taşımayan kısa ömürlü teknik olay kaydı.
_Avoid_: Kayıt geçmişi, Denetim kaydı

**Destek referansı**:
Başarısız ana akışta kullanıcıya gösterilen, sunucu hata takip kimliğinden türetilen ve secret veya Çalışma Alanı gövdesi taşımayan referans ([gözlemlenebilirlik](docs/prd/15-product-quality.md#gozlemlenebilirlik)). UI: `Support reference`.
_Avoid_: pager, S1 alarm, müşteri kuyruğu, Denetim kaydı

**Yeniden dene**:
Başarısız ana akışta güvenli yeniden deneme eylemi. UI: `Retry`.
_Avoid_: otomatik senkron, kuyruk replay

**Çatışma**:
Aynı idempotency veya teslim kimliğinin farklı payload taşıması. UI: `Conflict`.
_Avoid_: sessiz son yazan kazanır, örtük birleştirme

**Hazırlama alanı**:
Çok adımlı yazmanın canlı ana kayıtlardan yalıtıldığı, commit bariyerine kadar görünür kayıt, ilişki, sayaç veya indeks üretmeyen geçici alan.
_Avoid_: canlı taslak, restore-point, kısmi ana kayıt

**Commit bariyeri**:
Hazırlama alanındaki çok adımlı yazmayı taban revizyonu, idempotency anahtarı, payload parmak izi, güncel yetki, hedef kapsam ve kota ile yeniden doğrulayan tek kesinleştirme anı.
_Avoid_: kademeli commit, kayıt bazlı kısmi başarı

**İşlem makbuzu**:
Commit bariyerinin yalnız tam commit veya tam rollback sonucu; kayıp bağlantıda yeniden açılabilen kalıcı sonuç.
_Avoid_: kısmi başarı, belirsiz commit durumu

**Sonlandırılıyor**:
Commit bariyerinden sonra iptalin uygulanmadığı durum. UI: `Finalizing`.
_Avoid_: sahte Cancel, bariyer sonrası İptal

**İptal**:
Yalnız commit bariyerinden önceki hazırlama iptali. UI: `Cancel`.
_Avoid_: bariyer sonrası iptal, Finalizing yerine Cancel
