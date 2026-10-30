# Domain Modeli ve Yaşam Döngüsü

Bu belge bütün alan PRD'lerinin kullandığı kayıt, kapsam, kimlik, yaşam döngüsü, ilişki, geçmiş, silme ve terminoloji kurallarının ana kaynağıdır. Bir alan PRD'si açık ve gerekçeli bir istisna tanımlamadıkça bu sözleşme geçerlidir.

<a id="terim-sözlüğü"></a>
## Terim sözlüğü

| Türkçe PRD terimi | İngilizce UI etiketi | Normatif kullanım |
| --- | --- | --- |
| Çalışma alanı | `Workspace` | Projeleri, Kişisel Wiki'yi ve ortak yapılandırmayı kapsayan sınır |
| Proje yaşam durumu | `Active`, `Pending`, `Completed`, `Abandoned` | PRD terimleri `Aktif`, `Bekleyen`, `Tamamlandı` ve `Vazgeçildi`nin kullanıcıya gösterilen karşılıkları; çalışma aşamasından ayrıdır |
| İş | `Work` | Genel kayıt; Özellik, Bug, Görev, Araştırma ve İyileştirme bunun türleridir |
| İş arşivi | `Archive` | İş akışı durumu ve kapanış sonucundan bağımsız görünürlük; Çöp Kutusu ve Proje arşivi değildir |
| İş arşiv filtresi | `Archived` | Varsayılan İş listesinden ayrı açık arşiv görünürlüğü |
| İş arşivini geri al | `Unarchive` | Arşivlenen İşi varsayılan listeye kimliği değiştirmeden döndürme |
| Belge arşivi | `Archive` | Belge kimliğini, sürümleri, ilişkileri ve çocuk bağlarını koruyan görünürlük; Çöp Kutusu, Proje arşivi veya Wiki yayını durdurma değildir |
| Belge arşiv filtresi | `Archived` | Varsayılan Belge gezinmesinden ayrı açık arşiv görünürlüğü |
| Belge arşivini geri al | `Unarchive` | Arşivlenen Belgeyi varsayılan gezinmeye kimliği değiştirmeden döndürme |
| Belge kapsam taşıma | `Move` | Etkin Projedeki Belgeyi kimlik koruyarak hedef kapsama alma; İş taşıması değildir |
| Belge kopyası | `Copy` | Yeni kimlikli bağımsız Belge; köken kaynağı gösterir |
| Tek belge dışa aktarma | `Export` | Tek Belgenin Markdown veya PDF snapshot’ı; Word veya Çalışma Alanı çıkış paketi değildir |
| Markdown | `Markdown` | Tek belge dışa aktarma biçimi |
| PDF | `PDF` | Tek belge dışa aktarma biçimi |
| Dış yüzeyi iptal et | `Cancel External Surface` | Taşımadan önce etkin Dış yüzeyi iptal etme onayı |
| Belge klasörü | `Folder` | Aynı sahiplik kapsamında gezinme üstverisi; Akıllı Koleksiyon veya sahiplik kapsamı değildir |
| Belge düzenleme | `Organize Document` | Aynı Projede klasör ve üst Belgeyi önizlemeyle düzenleme; kapsam taşıması değildir |
| Üst Belgeyi kaldır | `No Parent Document` | Belgeyi aynı kapsamda kök seviyeye alma; çocuk bağları korunur |
| Üst belge | `Parent Document` | Aynı kapsamdaki en fazla bir üst Belge; çapraz kapsam ebeveyn yoktur |
| Çocuk Belge kartı | `Card` | Üst Belgedeki otomatik çocuk önizlemesi; ayrı kapak kaydı değildir |
| Belge içi etiket | `#tag` | Belge düz yazısındaki tokenın aynı Çalışma Alanı Etiket kimliğine bağlanması; ikinci sözlük değildir |
| Özellik | `Feature` | İş türü |
| Kullanıcı Akışı | `User Flow` | Kullanıcının arayüz hedefi ve karar yolunu taşıyan tasarım türü |
| Proje Duvarı | `Project Wall` | Mevcut ana kayıtların canlı kartlarıyla proje anlatısını taşıyan Tasarım türü; Wireframe, Moodboard veya Wiki sayfası değildir |
| Kompakt | `Compact` | Proje Duvarı kart yoğunluğu; ürünün seçtiği alanlar |
| Önizleme yoğunluğu | `Preview` | Proje Duvarı kart yoğunluğu |
| Ayrıntılı | `Detailed` | Proje Duvarı kart yoğunluğu |
| Proje Duvarı oluştur | `Create Project Wall` | Adlandırılmış düz Proje Duvarı açma |
| Proje Duvarı yok | `No Project Wall yet.` | Henüz duvar açılmamış boş durum |
| Canlı kart yerleştir | `Place live card` | Mevcut ana kaydı kopyasız canlı kart olarak duvara referanslama |
| Vurgu | `Highlight` | Proje Duvarı kartının sınırlı erişilebilir palet vurgusu; durum, öncelik veya ilişki değildir |
| Duvardan kaldır | `Remove from Project Wall` | Canlı kartı yalnız duvardan çıkarma; kaynak kayıt silinmez ve değişmez |
| Proje Duvarı sil | `Delete Project Wall` | Duvarı ve yerleşimini silme; kaynak kayıtlar değişmez |
| Görsel bağlantı | `Visual link` | Kartlar arasında yönlü etiketli anlatı çizgisi; kayıt ilişkisi değildir |
| Kalıcı ilişki oluştur | `Create Persistent Relation` | Görsel çizgiden önizlemeli katalog ilişkisi yazma |
| Konumu kilitle | `Lock Position` | Görünüm-yerel konum sabiti; kaynak kaydın düzenlenmesini veya yaşamını kısıtlamaz |
| Görsel bağlantı ekle | `Add Visual link` | `From` ve `To` kartı ile etiketten yönlü görsel çizgi çizme; ilişki satırı yazmaz |
| Çizgi başlangıcı | `From` | Görsel bağlantının çıkış kartı; kalıcı ilişkide kaynak uç olur |
| Çizgi hedefi | `To` | Görsel bağlantının varış kartı; kalıcı ilişkide hedef uç olur |
| Çizgiyi çöz | `Unbind` | Yalnız görsel çizgiyi kaldırma; kartlar, kaynak kayıtlar ve ilişkiler değişmez |
| İlişkiyi onayla | `Confirm Create Persistent Relation` | `Create Persistent Relation` önizlemesini okuduktan sonra katalog ilişkisini yazan açık onay |
| Grup | `Group` | Duvardaki tek seviyeli, adlı, kalıcı sınıflandırma olmayan kart kümesi; ilişki değildir |
| Grup oluştur | `Create Group` | Duvara adlı grup ekleme |
| Grubu daralt | `Collapse group` | Grup üyelerini kullanıcının kendi duvar görünümünde gizleme (kişisel viewport durumu, oturumlar arası korunur); kayıt durumu değişmez |
| Grubu aç | `Expand group` | Daraltılmış grubun üyelerini yeniden gösterme |
| Grubu sil | `Delete group` | Yalnız grubu silme; kartlar gruptan çıkar, kaynak kayıtlar değişmez |
| Sitemap iskeletinden oluştur | `Create from Sitemap` | Kabuğun `Sitemap` seçtiği Projede `Primary Navigation`, `Secondary Navigation`, `Utility`, `External` boş gruplarıyla normal Proje Duvarı kurma; örnek içerik üretmez |
| Customer Journey iskeletinden oluştur | `Create from Customer Journey` | Kabuğun `Customer Journey` seçtiği Projede `Awareness`, `Consideration`, `Onboarding`, `Core Use`, `Retention` boş gruplarıyla normal Proje Duvarı kurma; örnek içerik üretmez |
| Sunum Kipi (duvar) | `Presentation Mode` | Proje Duvarı düzenleme araçlarını gizleyen salt okunur kip; çıkışta aynı duvar görünümüne döner, içerik kopyası üretmez |
| Odak sırası | `Focus order` | Proje Duvarı Sunum Kipi'nde isteğe bağlı kart sırası; görünüm üstverisidir, ikinci dosya veya içerik kopyası değildir |
| Duvar snapshot'ı | `Snapshot` | Seçili grup veya bölgenin tarihli PNG/PDF iç çıktısı; `Preview` ile okunur |
| Duvar kartını yukarı taşı | `Move up` | Proje Duvarı `Outline` sıralamasında kartı kendi bölümü içinde bir adım öne alma; konumu ve kaynak kaydı değiştirmez |
| Duvar kartını aşağı taşı | `Move down` | Proje Duvarı `Outline` sıralamasında kartı kendi bölümü içinde bir adım arkaya alma; konumu ve kaynak kaydı değiştirmez |
| Görsel bağlantıyı bağla | `Bind` | `Outline` inceleme panelinde seçili karttan (`From`) seçilen karta (`To`) etiketli görsel bağlantı kurma; ilişki satırı yazmaz |
| Seçimi grupla | `Group selection` | `Outline`'da seçili kartlardan adlı tek seviyeli grup kurma; sınıflandırma veya ilişki değildir |
| Sola hizala / Ortala / Sağa hizala | `Align Left`, `Align Center`, `Align Right` | Seçili duvar kartlarını ortak kenara veya eksene hizalama; `Lock Position` kartları yerinde kalır |
| Üste hizala / Ortaya hizala / Alta hizala | `Align Top`, `Align Middle`, `Align Bottom` | Seçili duvar kartlarını ortak üst, orta veya alt hizaya getirme; `Lock Position` kartları yerinde kalır |
| Yatay dağıt / Dikey dağıt | `Distribute Horizontally`, `Distribute Vertically` | Üç veya daha çok seçili kartı dış iki kart arasında eşit aralıkla yerleştirme; `Lock Position` kartları yerinde kalır |
| En öne getir / En arkaya gönder | `Bring to Front`, `Send to Back` | Seçili kartların z-sırasını (aynı zamanda `Outline` sırası) değiştirme; konum ve kaynak kayıt değişmez |
| Otomatik yerleşimi önizle | `Preview Auto-layout` | Seçili (yoksa tüm) kartların ızgara yerleşimini yazmadan gösterme; `Lock Position` kartları yerinde kalır |
| Otomatik yerleşimi uygula | `Apply Auto-layout` | Önizlenen yerleşimi duvar konumu olarak yazma; kaynak kaydı değiştirmez |
| Otomatik yerleşimi geri al | `Undo Auto-layout` | Uygulanan otomatik yerleşimden önceki konumlara dönme |
| Donmuş kopya | `Frozen copy` | Snapshot'ın adı; paylaşım izni değildir, paylaşım kapsamını genişletmez, duvarı kilitlemez |
| Canlı önizleme | `Live` | Teknik Diyagram kartının seçili Diyagram Görünümünü güncel gösterdiği etiket |
| Kesin önizleme | `Exact` | Teknik Diyagram kartının açıkça seçilmiş Diyagram Sürümüne sabitlendiği etiket |
| Hepsini kaynakta aç | `Open all in source` | Akıllı Koleksiyon bloğunun sınırlı özetinden tüm sonucu koleksiyonun kendisinde açma |
| Grubu aç | `Open group` | Proje Duvarı tuvali ve `Outline`'ı adlı grubun kartlarına odaklayan görünüm-yerel gezinme; kaydedilmez, kaynak kaydı değiştirmez |
| Tam duvarı göster | `Show full wall` | Açılmış gruptan tüm duvara güvenli dönüş |
| Grup artık yok | `This group is no longer available.` | Silinmiş veya erişilemeyen grup hedefinin başka gruba yönlendirmeden yerinde açıklaması |
| Yeniden adlandır | `Rename`, `Rename Project Wall` | Proje Duvarı adını değiştirme; kaynak kayıtları değiştirmez |
| Kart seç / Kayıt seç | `Select a card`, `Select a record` | Görsel bağlantı uçları ve canlı kart yerleştirme için seçim yer tutucuları |
| Grupsuz / Vurgusuz | `No group`, `No highlight` | Proje Duvarı kartının grup ve vurgu seçimi boş değerleri |
| İlişki türü | `Relation kind` | `Create Persistent Relation` önizlemesinde ilişki türü seçimi |
| Snapshot grubu | `Snapshot group` | Duvar snapshot'ı için grup kapsamı seçimi |
| Duvar anlatısı | `Wall narrative` | Görsel bağlantılar ve tek seviyeli grupların bölümü; kayıt ilişkisi değildir |
| Ortak kaynak | `Shared source` | Aynı kaydın duvarda hem kart hem Akıllı Koleksiyon özeti içinde göründüğünü belirten not; iki kayıt değildir |
| Moodboard | `Moodboard` | Proje veya özellik için görsel referans ve seçilen tasarım yönünü toplayan tasarım türü; Kullanıcı Akışı, Wireframe veya tasarım sistemi değildir |
| Moodboard oluştur | `Create Moodboard` | Başlıkla Moodboard açma |
| Moodboard yok | `No Moodboards yet.` | Henüz Moodboard açılmamış boş durum |
| Altyazı | `Caption` | Moodboard görselindeki isteğe bağlı kısa neden; yorum dizisi, reaksiyon, görev, mention veya Dosya Eki açıklaması değildir |
| Dış bağlantı | `External link` | Moodboard görselinin Dosya Eki sürümü olmayan kökeni |
| Dosya Eki sürümü kökeni | `File Attachment version` | Moodboard görselinin kesin Dosya Eki sürümü olan kökeni; sürüm zinciri ve baytlar bu görselden değişmez |
| Görsel ekle | `Add visual` | Moodboard'a Dosya Eki veya dış bağlantı kökenli görsel yerleştirme |
| Renk Örneği | `Color Swatch` | Moodboard birinci sınıf renk öğesi; palet görsel yön bağlamıdır, tema veya token değildir |
| Palet grubu | `Palette group` | Moodboard üzerindeki Renk Örneği grubu |
| Renk Örneği ekle | `Add Color Swatch` | Seçici, kesin görselden Eyedrop, HEX, RGB veya HSL ile Renk Örneği ekleme |
| Palet grubu ekle | `Add palette group` | Moodboard'a palet grubu açma |
| Renk notu | `Note` | Renk Örneğindeki isteğe bağlı kısa açıklama |
| Seçici | `Picker` | Renk Örneği rengi için görsel seçici |
| Eyedrop | `Eyedrop` | Kesin bir Moodboard görselinden renk alma |
| HEX | `HEX` | Renk Örneğinin onaltılık gösterimi |
| RGB | `RGB` | Renk Örneğinin kırmızı-yeşil-mavi gösterimi |
| HSL | `HSL` | Renk Örneğinin ton-doygunluk-parlaklık gösterimi |
| Herkese açık | `Public` | Dışarıdan anonim erişilebilen kullanıcı görünürlüğü; `Build in Public` ürün adı, teknik alan ve wire değerleri özgün adını korur |
| Özel | `Private` | Dış erişime kapalı kullanıcı görünürlüğü |
| Dış yüzey | `External Surface` | Ziyaretçi URL'si, erişim anahtarı, parola, süre ve etkinlik durumunu taşıyan paylaşım/yayın ana kaydı |
| Onaylı snapshot revizyonu | `Approved Snapshot Revision` | Dış yüzeyin belirli onay anında göstermesine izin verilen değişmez kesin içerik manifesti; Dış yüzeyden bağımsız yaşayamaz |
| Üstveri | `Metadata` | Teknik şema alanları dışında kullanıcıya gösterilen üstveri kavramı |
| Persona | `Persona` | Hedef kullanıcı profilini taşıyan Belge türü; ayrı ana kayıt türü değildir ve Contact ya da Company'nin yerine geçmez |
| Contact (kimlik defteri) | `Contact` | Geri bildirimi veren kişiyi geri bildirimler boyunca tanıyan Çalışma Alanı ana kaydı; Feedback Capture yönlendirici alanı değildir |
| Company | `Company` | Contact ve Geri Bildirimi isteğe bağlı ortak kuruluş bağlamında gruplayan hafif ana kayıt |
| Şirkete ait | `Belongs to Company` | Contact başına en fazla bir güncel Company bağı; geçmiş değişiklikte korunur |
| Kaynak kaydı aç | `Open Source Record` | Contact profilinde ilişkili Geri Bildirim, Company ve Persona belgesini kaynağında açma; Proje Duvarı canlı kartında ana kaydı açma |
| Contact oluştur | `Create Contact` | Çalışma Alanında kimlik defteri Contact'ı açma |
| Company oluştur | `Create Company` | İsteğe bağlı kuruluş bağlamı kaydı açma |
| Görünen ad | `Display name` | Contact'ta isteğe bağlı görünen ad; kimlik değildir |
| E-posta | `Email` | Contact'ta isteğe bağlı e-posta takma değeri |
| Yok | `None` | Contact'ın güncel Company bağının olmaması |
| Contact yok | `No Contacts yet.` | Henüz Contact açılmamış boş durum |
| Geçmiş Company'ler | `Past Companies` | Contact profilinde `Belongs to Company` değişikliğinde korunan kapanmış Company bağları |
| Adsız Contact | `Unnamed Contact` | Görünen adı ve e-postası olmayan Contact'ın liste etiketi |
| Contact kaydet | `Save Contact` | Contact görünen adını düzenleyen ve yeni e-posta takma değeri ekleyen eylem |
| Ekran | `Screen` | Proje kapsamında bağımsız kimlik, geçmiş, ilişki ve yaşam döngüsü taşıyan ana kayıt; görsel tasarım olmadan yalnız başlıkla var olabilir |
| Ekran oluştur | `Create Screen` | Yalnız başlıkla Proje kapsamında Ekran açma |
| Ekran yok | `No Screens yet.` | Henüz Ekran açılmamış boş durum |
| Ekran başlığı gerekli | `Title is required.` | Boş başlıkla Ekran açılamaz |
| Ekran oluşturulamadı | `Screen could not be created.` | Başlık dışındaki oluşturma reddi |
| Çöpe taşı | `Move to Trash` | Ekranı Çöp Kutusuna alma |
| Kalıcı sil | `Permanently Delete` | Çöp Kutusundaki Ekranı geri döndürülemez kaldırma |
| Onaylı dış yüzeyi koru | `Keep approved surface` | Çöpe taşıma önizlemesinde, yalnız yaşayan Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynakta sunulan ve bağlı Dış yüzeyi son Onaylı snapshot revizyonunda donduran seçenek; varsayılan iptaldir |
| Çöpte Ekran yok | `No Screens in Trash.` | Çöp Kutusu listesinde Ekran olmaması |
| Ekran yaşamı | `Active`, `Archived`, `In Trash` | Ekranın ortak ana kayıt görünürlüğü; Wireframe bağımsız yaşam değildir |
| Wireframe | `Wireframe` | Ekrana ait düşük sadakatli sürümlü yüzey; bağımsız ana kayıt değildir |
| Bağlı Wireframe bloğu | `Detach Link` | Proje kapsamlı düşük detaylı kaynak tanımını bir Ekran örneğinden ayırıp o andaki içeriği bağımsız block olarak dondurma |
| Kırık canlı metin | `Broken` | Wireframe canlı Markdown bölüm referansı çözülemediğinde boşaltmadan gösterilen durum |
| Company yok | `No Companies yet.` | Henüz Company açılmamış boş durum |
| Kopya adayları | `Duplicate candidates` | Aynı normalize e-posta veya ad/Company benzerliğiyle görünen Contact çiftleri; birleştirme yazması değildir |
| Güçlü kopya adayı | `Strong copy candidate` | Aynı normalize e-posta taşıyan Contact çifti |
| Zayıf öneri | `Weak suggestion` | Ad veya güncel Company benzerliği; kimlik hükmü değildir |
| Kopya adayı yok | `No duplicate candidates.` | Kimlik defterinde güçlü veya zayıf aday çiftinin olmadığı boş durum |
| AI ajanı | `AI Agent` | `AI agent` ve `agent` varyantlarının ortak kavramı |
| Repository | `Repository` | GitHub'ın dış sistem kavramıdır; genel “depo” eşanlamlı kayıt türü oluşturmaz |
| Teknik Diyagram | `Technical Diagram` | Veri modeli, teknik mimari veya sistemler arası sıralı etkileşimi bağımsız kimlik ve türlenmiş yapısal modelle taşıyan Proje ana kaydı |
| Teknik Diyagram kullanılamıyor | `Technical Diagram is unavailable.` | Diyagram kaynağı çözümlenemediğinde salt okunur hata durumu |
| Diyagram Görünümü kaydedilemedi | `Diagram View could not be saved.` | Seçili yapısal öğeleri gösteren adlandırılmış görünüm yazılamadığında hata durumu |
| Diyagram otorite kipi | `Diagram Authority Mode` | Kanonik içeriğin `Product-authored Model`, `Repository-derived View`, `Imported Independent Copy` veya `External Source Link` seçeneklerinden hangisine ait olduğunu kayıt kimliği boyunca değişmez biçimde belirleyen tek sınıflandırma; başka otorite yeni kimlikli açık dönüşüm ister |
| Diyagram Sürümü | `Diagram Version` | Teknik Diyagramın kullanıcı tarafından adlandırılıp değişmez hâle getirilen kesin yapısal model ve görünüm checkpoint'i |
| Migration Artefaktı | `Migration Artifact` | İki kesin Veri Modeli Diyagramı Sürümü arasındaki onaylanmış schema-only değişikliği ve desteklenen PostgreSQL SQL'ini kaynak manifestiyle koruyan değişmez sahipli bileşen |
| Kilometre Taşı | `Milestone` | Projedeki önemli ara sonucu temsil eden Proje ana kaydı; çalışma penceresi veya yayımlanacak kapsam değildir |
| Kilometre Taşı yaşamı | `Planned`, `Reached`, `Abandoned` | Kilometre Taşının İngilizce yaşam etiketleri; Odak Dönemi penceresi veya Proje Sürümü kapsamı değildir |
| Kilometre Taşı oluştur | `Create Milestone` | Başlık, açıklama ve isteğe bağlı hedef tarihiyle ara sonuç kaydı açma |
| Kilometre Taşına ulaş | `Reach` | Kilometre Taşı durumunu açık eylemle `Reached` yapan yazma; bağlı İşleri kapatmaz |
| Kilometre Taşından vazgeç | `Abandon` | Kilometre Taşı durumunu açık eylemle `Abandoned` yapan yazma; bağlı İşleri kapatmaz |
| Kilometre taşına katkı | `Contributes to Milestone` | İşin Kilometre Taşına türlenmiş üyeliği; Hedefe katkı veya yayın kapsamı değildir |
| Kilometre taşı kapsamında | `In Milestone` | Katkı ilişkisinin Kilometre Taşı ucu |
| Kilometre Taşı yok | `No Milestone yet.` | Henüz ara sonuç kaydı açılmamış boş durum |
| Odak Dönemi | `Focus Period` | Seçili çalışmalar için geçici çalışma penceresi ve tarihsel kapsam snapshot'ı; ara sonuç veya yayımlanacak kapsam değildir |
| Odak Dönemi yaşamı | `Planned`, `Active`, `Closed`, `Canceled` | Odak Döneminin İngilizce yaşam etiketleri; sprint kadansı değildir |
| Odak Dönemi oluştur | `Create Focus Period` | Amaç ve başlangıç/bitiş tarihiyle isteğe bağlı dönem açma |
| Odak Dönemine İş ekle | `Add Work` | Seçili İşi dönem üyeliğine ekler; İş durumunu veya Proje aşamasını değiştirmez |
| Odak Döneminden İş çıkar | `Remove` | Seçili İşi dönem üyeliğinden çıkarır; İş durumunu değiştirmez |
| Odak Dönemi amacı | `Purpose` | Dönemin zorunlu çalışma amacı |
| Odak Dönemine İş seç | `Select Work` | Üyelik için İş seçimi |
| Çakışan Odak Dönemi üyeliği | `Work is already in another Focus Period.` | Örtüşen dönem pencerelerine ikinci üyelik reddi |
| Odak Dönemini açık tut | `Keep period open` | Kapanış kapsamı kaydedilmeden döneme dönme |
| Odak Dönemi yükleniyor | `Loading Focus Period…` | Dönem listesi yüklenirken canlı durum iletisi |
| Odak Dönemi kullanılamıyor | `Focus Period is unavailable.` | Dönem listesi okunamadığında hata iletisi |
| Odak Dönemi oluşturulamadı | `Focus Period could not be created.` | Oluşturma yazması başarısız olduğunda hata iletisi |
| Odak Dönemi güncellenemedi | `Focus Period could not be updated.` | Üyelik veya yaşam yazması başarısız olduğunda hata iletisi |
| Açık İş kalmadı | `No Work remains open.` | Kapanış incelemesinde açık İş olmadığında boş durum |
| Odak Dönemini kapat | `Close` | Yalnız `Active` dönemden kapanış-kapsamı snapshot’ı ve açık kalan İş kararı |
| Odak Dönemini iptal et | `Cancel` | `Planned` veya `Active` dönemi kapanış hesabı olmadan bitirme |
| Başlangıç tarihi | `Start date` | Odak Dönemi penceresinin ilk günü |
| Bitiş tarihi | `End date` | Odak Dönemi penceresinin son günü |
| Açık kalan İş | `Still-open Work` | Kapanışta toplu karar bekleyen açık İş listesi |
| Açık İş kararı bölgesi | `Still-open Work decisions` | Kapanıştan sonra açık İşlerin toplu kararını sunan erişilebilir bölüm |
| Odak Dönemi yok | `No Focus Period yet.` | Henüz dönem açılmamış boş durum |
| Odak Döneminde İş yok | `No Work in this Focus Period.` | Dönemde üyelik olmadığında boş durum |
| Odak Döneminde bağımlılık yok | `No dependencies in this Focus Period.` | Dönem kapsamındaki mevcut ilişkilerden blokaj türetilemediğinde salt-okunur boş durum |
| Bağımlılık döngüsünde | `Part of a dependency cycle` | Dönem kapsamında güvenle saptanan döngünün ilişkisi; çözülmüş kenar varsa tüm bekleyişlerin etkin olduğu anlamına gelmez |
| Odak Dönemi penceresi | `Focus Period must be 1–8 weeks.` | 1–8 hafta dışı oluşturma reddi |
| Başka etkin döneme taşı | `Move` | İşin mevcut etkin Odak Döneminden açıkça başka etkin döneme alınması |
| Zaten etkin dönemde | `Work is already in an active Focus Period. Use Move.` | Örtük ikinci etkin üyelik reddi |
| Amaç gerekli | `Purpose is required.` | Boş Odak Dönemi amacı reddi |
| Açık kalanı gönder | `Send` | Kapanışta seçili açık İşleri toplu kararla gönderme |
| Açık kalan İş hedefi | `Destination` | Kapanış kararında seçilen hedef |
| Başka dönem seç | `Select Focus Period` | Kapanışta hedef başka dönemi seçme |
| Açık İşten vazgeçmeyi onayla | `Confirm Abandon selected Work` | Seçili İşler için açık kapatma eylemini onaylama |
| Kapatma denetimine rağmen kapat | `Close anyway if closure checks remain` | Blokaj veya bitmemiş kontrol listesi varken açık vazgeçme kararı |
| Kapatma denetimini gözden geçir | `Review closure checks or select Close anyway.` | Açık İşten vazgeçerken gereken onay verilmediğinde hata iletisi |
| Tamamlanmış İş uyarısı | `Work was already completed.` | Tamamlanmış İşe sonradan vazgeçme kararı verilemediğinde hata iletisi |
| Vazgeçme onayı gerekli | `Confirm Abandon first.` | Açık vazgeçme onayı verilmediğinde hata iletisi |
| Sonraki dönem | `Next period` | Açık kalan İşin sonraki Odak Dönemine gönderilmesi |
| Başka dönem | `Another period` | Açık kalan İşin seçilen başka Odak Dönemine gönderilmesi |
| Odak Döneminde vazgeç | `Abandon` | Kapanışta açık kalan İşi açık kapatma adımıyla `Abandoned` yapmak |
| Başlangıç snapshot’ında | `In start snapshot` | Kapanış karşılaştırmasında başlangıç kapsamında bulunan İş |
| Sonradan eklenen | `Added later` | Başlangıçtan sonra kapanış kapsamına giren İş |
| Kapsamdan çıkan | `Removed` | Başlangıç kapsamındayken kapanışta bulunmayan İş |
| Kapanış karşılaştırması | `Close comparison` | Başlangıç ve kapanış kapsamını, sonradan eklenen, çıkarılan, tamamlanan ve açık kalan işleri tarafsız sayılarla karşılaştırma |
| Dönem değerlendirmesi | `Period evaluation` | Kapanışta atlanabilir öğrenim metni |
| Değerlendirmeyi kaydet | `Save evaluation` | İsteğe bağlı dönem öğrenim metinlerini kaydetme |
| Atla | `Skip` | Dönem değerlendirmesini atlama |
| Sürdür | `Keep` | Değerlendirmede sürdürülecek öğrenim |
| Değiştir | `Change` | Değerlendirmede değiştirilecek öğrenim |
| Sonrakinde dene | `Try next` | Sonraki dönemde denenecek öğrenim |
| Onayla | `Confirm` | Takip İş önizlemesini onaylayıp oluşturma |
| Takip İşini önizle | `Preview Follow-up Work` | Takip İşini ve kaynak dönem öğrenimi bağlantısını onaydan önce gösterme |
| Takip İş önizlemesi | `Follow-up Work preview` | Oluşacak İş, kaynak öğrenim ve kaynak Odak Dönemini gösteren onay bölümü |
| Öğrenim kaynağı | `Learning source` | Takip İşinin bağlanacağı `Keep`, `Change` veya `Try next` dönem öğrenimi |
| Kaynak Odak Dönemi | `Source Focus Period` | Takip İşinin oluşturulduğu döneme kalıcı bağlantısı |
| Tarih karşılaştırması | `Date comparison` | Başlangıç snapshot’ındaki hedef tarihlerin mevcut geçmiş ve kapanış anıyla tarafsız karşılaştırması |
| Hedefi öne alınan | `Moved earlier` | Başlangıçtaki hedef tarihi öne çekilen İş |
| Hedefi ileri alınan | `Moved later` | Başlangıçtaki hedef tarihi ileri alınan İş |
| Hedefinde tamamlanan | `Completed on target` | Başlangıçtaki hedef tarihinde tamamlanan İş |
| Hedefinden sonra tamamlanan | `Completed after` | Başlangıçtaki hedefinden sonra tamamlanan İş |
| Proje Sürümü | `Project Release` | Kullanıcı tarafından yönetilen yayımlanacak kapsam ve onun tarihli erişim/sonuç gözlemleri; Kilometre Taşı, Odak Dönemi veya Ürün sürüm adayı değildir |
| Başlangıç yapılandırması | `Starter Configuration` | Yeni Projeye bir kez uygulanan, içerik üretmeyen kapalı varsayılan yapı seçimi; sonradan başka yapılandırmayla değiştirilmez |
| Proje adı | `Project Name` | Yeni Proje oluştururken zorunlu ad |
| Proje kısa kodu | `Short code` | İş anahtarı öneki; Çalışma Alanında benzersizdir ve ilk İşten sonra değişmez |
| Kısa kod kilitli | `Short code is locked after the first Work.` | İlk İşten sonra kısa kodun değişmeyeceğini bildiren metin |
| Amaç | `Purpose` | İsteğe bağlı Proje profil alanı |
| Problem | `Problem` | İsteğe bağlı çözülmek istenen problem |
| Kapsam | `Scope` | İsteğe bağlı Proje profil alanı; Komut Paletinde komutun çalıştığı kapsamı gösterir; Open Source Library hazır aşama adı da `Scope` kullanır |
| Hedef tarihi | `Target date` | İsteğe bağlı Proje hedef tarihi |
| Logo | `Logo` | İsteğe bağlı Proje logosu; Proje rengi, CSS veya font değildir |
| Proje oluştur | `Create Project` | Yeni Projeyi kaydeden eylem |
| Projeler | `Projects` | Çalışma Alanındaki Proje listesi |
| Projeleri aç | `Open Projects` | Komut Paletinden Çalışma Alanının Projeler yüzeyine gitme eylemi |
| Kısa kodu düzenle | `Edit Short code` | Proje listesindeki mevcut kısa kodu düzenleme alanını açma eylemi |
| Kısa kodu kaydet | `Save Short code` | İlk İşten önce kısa kodu güncelleme eylemi |
| İptal | `Cancel` | Kısa kod düzenlemesini kaydetmeden kapatma eylemi |
| Yükleniyor | `Loading…` | Proje kabuğu okuma durumu |
| Proje kullanılamıyor | `Project is unavailable.` | Proje kabuğu okuma hatası |
| Blank Project | `Blank Project` | Aşama ve uzman görünüm kurmayan en küçük Başlangıç yapılandırması |
| Solo SaaS | `Solo SaaS` | Discovery–Operate aşamaları ve bütün Proje alanlarıyla açılan Başlangıç yapılandırması |
| Open Source Library | `Open Source Library` | Scope–Maintain aşamaları ve GitHub ağırlıklı alanlarla açılan Başlangıç yapılandırması |
| Mobile Application | `Mobile Application` | Discovery–Operate aşamaları ve Production sabitlemesiyle açılan Başlangıç yapılandırması |
| Proje genel bakışı | `Overview` | Proje alanı olmayan daima erişilir yüzey |
| Aktif Projeler | `Active Projects` | Çalışma Alanı genel bakışı hazır modülü; Active Projeleri listeler |
| Dikkat gerekli | `Attention Required` | Çalışma Alanı genel bakışı hazır modülü; kayıtlı Action Required kaynağını toplar |
| Yaklaşan | `Upcoming` | Çalışma Alanı genel bakışı hazır modülü; yaklaşan hedef tarihleri ve hatırlatmalar |
| Son çalışma | `Recent Work` | Çalışma Alanı genel bakışı hazır modülü; son dokunulan İşler |
| Genel bakışı özelleştir | `Customize overview` | Çalışma Alanı genel bakışının kişisel düzenleme araçlarını açan açıklama |
| Canlı blok ekle | `Add live block` | Mevcut Belge veya adlandırılmış Akıllı Koleksiyon görünümünü kopyasız referans olarak ekleme |
| Kaydedilmiş çapraz Proje listesi | `Saved lists` | Çalışma Alanı çapında Proje koşullarından canlı üyelik türeten adlandırılmış görünüm; Portfolio veya Akıllı Koleksiyon değildir |
| Listeyi kaydet | `Save list` | Çapraz Proje listesi koşullarını ve görünümünü kaydetme |
| Yeni liste | `New list` | Kaydedilmiş çapraz Proje listesi oluşturma formunu açma |
| Daha fazla | `More` | Kişisel kabuk çubuğunda Capture, Daily Focus ve Projects dışındaki yüzeyleri gruplayan menü |
| Manuel Proje Güncellemesi | `Project Update`, `Create Project Update`, `On Track`, `At Risk`, `Off Track`, `Open source record`, `Update reminder`, `Reflection question`, `Interval (days)`, `Save reminder`, `Skip reminder`, `Enabled`, `Paused`, `Disabled`, `Lifecycle`, `Purpose`, `Target date`, `None`, `Retry` | Kurucunun tarihli öznel işareti, kısa anlatısı ve kayıt anı özet snapshot'ı; yalnız eklenir, yerinde yeniden yazılmaz, canlı sağlık hükmü veya skor değildir |
| Son bildirilen sağlık | `Last reported health` | Son Manuel Proje Güncellemesinin tarihiyle gösterilen sağlık işareti; güncel Project health alanı değildir |
| Üyelik koşullardan gelir | `Membership comes from list conditions.` | Sürükleyerek liste üyesi eklenemeyeceğini söyleyen metin |
| Liste adı | `List name` | Kaydedilmiş çapraz Proje listesinin kullanıcı tarafından verilen adı |
| Listeyi aç | `Open list` | Kaydedilmiş çapraz Proje görünümünü açma eylemi |
| Listeyi düzenle | `Edit list` | Kaydedilmiş çapraz Proje listesinin koşul veya görünümünü düzenleme eylemi |
| Kaydedilmiş listeyi düzenle | `Edit saved list` | Kaydedilmiş liste formunun düzenleme başlığı |
| Proje adı içerir | `Project name contains` | Proje adına göre canlı liste koşulu |
| Proje alanı eşleşmesi | `Project areas match` | Seçilen Proje alanlarının herhangi biri veya tümüyle eşleşen canlı liste koşulu |
| Kolonlar | `Columns` | Kaydedilmiş çapraz Proje listesinde saklanan desteklenen kolonlar |
| Sıralama | `Sort` | Kaydedilmiş listenin kolon sıralaması |
| Sıralama yönü | `Direction` | Kaydedilmiş listenin artan veya azalan sıralama yönü |
| Artan | `Ascending` | Kaydedilmiş liste sıralamasını küçükten büyüğe veya eskiden yeniye uygulama |
| Azalan | `Descending` | Kaydedilmiş liste sıralamasını büyükten küçüğe veya yeniden eskiye uygulama |
| A–Z | `A–Z` | Artan sıralama |
| Z–A | `Z–A` | Azalan sıralama |
| Gruplama | `Grouping` | Kaydedilmiş listenin kolon gruplaması |
| Yok | `None` | Gruplama seçilmedi |
| Hedef tarih başlangıcı | `Target date from` | Kaydedilmiş liste için kapsayıcı hedef tarih aralığının başlangıcı |
| Hedef tarih bitişi | `Target date to` | Kaydedilmiş liste için kapsayıcı hedef tarih aralığının bitişi |
| Oluşturulma tarihi | `Created date` | Kaydedilmiş listenin Proje oluşturulma tarihine göre sıralama seçeneği |
| Güncellenme tarihi | `Updated date` | Kaydedilmiş listenin Proje güncellenme tarihine göre sıralama seçeneği |
| Herhangi | `Any` | Arşiv koşulu uygulanmaz |
| Arşivlenmemiş | `Not archived` | Yalnız arşivde olmayan Projeler |
| Arşivlenmiş | `Archived` | Yalnız arşivdeki Projeler; İş arşiv filtresi değildir |
| Alanlar | `Areas` | Desteklenen Proje alanları koşulu |
| Yaşam durumu | `Lifecycle` | Overview modülü; Proje yaşam durumunun nötr özeti, sağlık skoru değildir |
| Proje Hedefi | `Goals` | Overview girişi; gizlenebilir Proje alanı değildir |
| Proje Hedefi | `Project Goal` | Proje kapsamlı hedef ana kaydı |
| Hedeflenen sonuç | `Intended outcome` | Proje Hedefinin isteğe bağlı kullanıcı alanı |
| Gözlenen sonuç / öğrenim | `Observed outcome / learning` | Proje Hedefinde kullanıcı tarafından sonradan girilen sonuç |
| Kilometre taşları | `Milestones` | Overview kaynak özeti |
| Riskler | `Risks` | Overview kaynak özeti |
| Blokajlar | `Blockers` | Overview kaynak özeti |
| Tarihler | `Dates` | Overview'da yaklaşan veya geçen hedef tarihler |
| Son değişiklikler | `Recent changes` | Overview kaynak özeti |
| Test Handoff'u | `Test Handoff` | Overview Tests özetindeki kaynak türü; Testler alanı ürünü değildir |
| Test Oturumu | `Test Session` | Overview Tests özetindeki kaynak türü |
| Test Açığı | `Test Gap` | Overview Tests özetindeki kaynak türü |
| Kaynak kaydı aç | `Open source record` | Ana kaydı kopyalamadan açan ortak eylem |
| Çalışmaya Dön | `Return to Work` | Güncel kayıtlardan seçilen geri dönüş özeti; sekme veya son bağlam geri yükleme değildir |
| Sıradaki somut adım | `Next concrete step` | Proje veya İş kaydındaki isteğe bağlı tek metin ipucu |
| Son baktığından beri | `Since you last looked` | Son ziyaret işaretinden sonraki tanımlı olayların konu grupları; analytics veya yeni özet kaydı değildir |
| Değişiklikleri görsel olarak gez | `Tour the visual changes` | Aynı Son baktığından beri kümesindeki desteklenen görsel hedefleri gezen açık eylem; kayıp hedefe sessiz kayma veya canvas sahipliği değildir |
| Turu kapat | `Close tour` | Görsel turu durdurur; başlangıç viewport’u hâlâ anlamlıysa geri yükler |
| Atla | `Skip` | Turda bir sonraki görsel hedefe geçer |
| Kalanı listede aç | `Open remainder in the list` | Üst sınırı aşan görsel değişiklikleri normal Son baktığından beri listesinde açar |
| Uzun süredir aynı durumda | `Long in the same status` | İsteğe bağlı Proje durum yaşı eşiğini aşan aktif İş için nötr geri dönüş gerekçesi ve hazır Akıllı Koleksiyon üyeliği; varsayılan bildirim veya sağlık puanı değildir |
| Durum yaşı eşiğini kaydet | `Save Long in the same status` | İsteğe bağlı Proje durum yaşı eşiğini mevcut yapılandırma mutasyonuyla kaydetme |
| Tüm İşler | `All Work` | Sıfır kurulum hazır tür dizini; İş ana kayıtlarını toplar, saklı sorgu veya yeni sahiplik değildir |
| Tüm Belgeler | `All Documents` | Sıfır kurulum hazır tür dizini; Belgeleri kapsam, tür, klasör ve üstveriyle gezer |
| Tüm Kararlar | `All Decisions` | Sıfır kurulum hazır tür dizini; Karar ana kayıtlarını toplar ve varsayılan `Valid` öne çıkarır |
| Tüm Riskler | `All Risks` | Sıfır kurulum hazır tür dizini; Risk ana kayıtlarını toplar |
| Tüm Araştırma Oturumları | `All Research Sessions` | Sıfır kurulum hazır tür dizini; Kullanıcı Araştırması Oturumlarını toplar |
| Tüm Testler | `All Tests` | Sıfır kurulum hazır tür dizini; Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Oturum Testi, Test Açığı ve Test değerlendirmesini ayırır |
| Tüm Tasarımlar | `All Designs` | Sıfır kurulum hazır tür dizini; Ekran, Kullanıcı Akışı, Moodboard ve Proje Duvarı kayıtlarını toplar |
| Tüm Teknik Diyagramlar | `All Technical Diagrams` | Sıfır kurulum hazır tür dizini; Teknik Mimari, Veri Modeli, Teknik Sıra ve Diyagram otorite kipini ayırır |
| Tüm Proje Sürümleri | `All Project Releases` | Sıfır kurulum hazır tür dizini; Proje Sürümü ana kayıtlarını toplar |
| Tüm Kaynaklar | `All Sources` | Sıfır kurulum hazır tür dizini; Kaynak ana kayıtlarını toplar |
| Kaynak | `Source` | Dış bilgiyi URL, erişim zamanı ve yakalanan içerikle tarihsel sürümler hâlinde koruyan Proje ana kaydı |
| Kaynak oluştur | `Create Source` | Adres, başlık ve yakalanan içerikle Kaynak açma |
| Adres | `Address` | Kaynağın dış URL’si |
| Erişim zamanı | `Accessed at` | Yakalamanın tarihli erişim anı |
| Yakalanan içerik | `Captured content` | Erişim anında saklanan içerik; canlı sayfa değildir |
| Alıntı | `Excerpt` | Kaynak üzerindeki isteğe bağlı kısa alıntı |
| Sağlayıcı | `Provider` | Yalnız URL biçimi veya açık girişle yazılan isteğe bağlı dış sağlayıcı |
| Dış kayıt türü | `External record type` | İsteğe bağlı dış kayıt türü |
| Dış kayıt kimliği | `External id` | İsteğe bağlı dış kayıt kimliği |
| Yeni Kaynak sürümü olarak kaydet | `Save as new Source version` | Yeni yakalamayı tarihli sürüm olarak ekleme; eski sürümü silmez |
| Onaylı sürüm | `Approved version` | Kaynağın güncel onaylı tarihli sürümü |
| Sürümler | `Versions` | Kaynağın tarihsel yakalama listesi |
| Kaynak yok | `No Sources yet.` | Henüz Kaynak açılmamış boş durum |
| Tüm Dosyalar | `All Files` | Sıfır kurulum hazır tür dizini; her Dosya Ekini bir kez gösterir |
| Planlı Test Senaryosu | `Planned Test Case` | Test dizini alt türü; bağımsız senaryo ana kaydı |
| Oturum Testi | `Session Test` | Test Oturumunun sahipli deneme öğesi; `All Tests` içinde ayırt edilir |
| Test Oturumu kaydet | `Record Test Session` | Uygulama içi manuel form; Kaydet'e kadar oturum üretmez |
| Test Oturumu dosyasını içe aktar | `Import Test Session file` | JSON ya da YAML frontmatter'lı Markdown rapor dosyası; aynı model, `File import` giriş yolu |
| Yürüten türü | `Executor type` | `User`, `AI agent` veya `External tool`; güven puanı değildir |
| Yürüten | `Executor` | Testi yürüten kullanıcı ya da araç adı ve sürümü; tarihsel atıf |
| Raporlayan | `Reporter` | Raporu teslim eden doğrulanmış kullanıcı ya da entegrasyon |
| Giriş yolu | `Ingress` | `Application`, `File import` veya `MCP`; saklanan olgu, puan değildir |
| Test incelemesi | `Test Review` | Test Oturumu ve Oturum Testi inceleme bölümü; sonuç, yayın kapısı veya Proje Sürümü sonucu değildir |
| İncelenmedi | `Unreviewed` | Test Oturumunun ve her Oturum Testinin başlangıç inceleme durumu |
| İncelendi | `Reviewed` | Kullanıcının oturum ya da maddeye verdiği inceleme durumu; bildirilen sonucu değiştirmez |
| Takip gerekli | `Follow-up needed` | Oturum ya da madde için inceleme durumu; otomatik İş, Bug veya Test Açığı üretmez |
| Kapatıldı | `Closed` | Test Oturumu ya da Oturum Testi inceleme durumu; kalan açık maddeler kapıyı engellemez, alt maddeleri kapatmaz |
| Oturumu ve seçili sonuçları incelendi işaretle | `Mark session and selected results as reviewed` | Önizleme gerektiren, tek atomik ve idempotent toplu inceleme eylemi |
| Düzeltme | `Correction` | Önceki Test Oturumu ya da Oturum Testi kaydına bağlı, gerekçeli yeni olay; güncel görünümde öne çıkar, özgün bildirim yerinde kalır |
| Geri çekme | `Withdrawal` | Önceki kayda bağlı, gerekçeli yeni olay; sonucu güncel kanıt olmaktan çıkarır, özgün bildirim silinmez |
| Güvenlik redaksiyonu | `Redact` | Hassas değerin etkisini önizleyip `Confirm GitHub Identity` grant'ini tüketen ve etkilenen Hesap veya Proje adının yazıldığı geri döndürülemez kaldırma eylemi; parola, MFA veya oturum yenileme değildir, Çöp Kutusu veya yerinde düzenleme değildir. İnceleme metinleri `Value to remove`, `Preview`, `Places that hold the value`, `No places found.`, `Not searched yet:`, `GitHub identity confirmed.`; ad istemi `Type the <Hesap veya Proje> name to confirm` |
| Güvenlik redaksiyonu gerekçesi | `Reason` | Kurucunun redaksiyonu uygularken yazdığı gerekçe; işaret, zaman ve aktörle birlikte olay günlüğünde ve sonuçta gösterilir |
| Güvenlik redaksiyonu işareti | `Redact value` | Hassas değerin yerine içeriksiz işaret, zaman, gerekçe ve aktör gösterir; Çöp Kutusu veya yerinde yeniden yazma değildir |
| Güvenlik redaksiyonu sonucu | `Redacted for security` | Redaksiyon uygulandıktan sonra sonuç durumu ve kırık referans nedeni; yalnız işaret, zaman, gerekçe ve aktörü gösterir, son bilinen gövdeyi göstermez |
| Kapanıştan sonra yeni bağlam | `New context after close` | Kapalı kayda sonradan gelen düzeltme, geri çekme veya redaksiyon sinyali; inceleme durumunu geri almaz |
| Yerine geçer (Oturum Testi) | `Supersedes` | Aynı uzman türdeki kesin Oturum Testleri arasında yönlü, döngüsüz ilişki; iki tarihsel sonucu ve teknik bağlam farkını korur, hiçbirini yazmaz |
| Yerine geçildi (Oturum Testi) | `Superseded` | `Supersedes` ilişkisinin eski ucu; sonuç silinmez, çelişki karşılaştırmasından çıkar |
| Çelişen sonuç sinyali | `test-result-conflict` | Aynı kesin senaryo sürümünde farklı normalize sonuç ve yerine-geçme yokluğundan türetilen Dikkat sinyali; kazananı sistem seçmez, kullanıcı geçerli sonucu bağlayınca kapanır |
| Bağlam değişti | `Context changed` | Bağlı Birincil spec sürümü ya da kayıtlı branch/commit/build hedef bağlamla uyuşmadığında görünen açıklanabilir sinyal; sonucu geçersiz, eski veya başarısız saymaz |
| Takip işi oluştur (Test İnceleme) | `Create follow-up work` | Oturum Testinden önizlemeli takip İşi; hedefi, `Originates from` (Test Oturumu) ve değişmez `Origin Location` (kesin Oturum Testi) bağını onaydan önce gösterir, sonucu yazmaz |
| Geçerli sonucu bağla | `Bind valid result` | Çelişen sonuçlardan kullanıcının geçerli saydığı kesin Oturum Testini kaydeder; çelişki sinyalini kapatır |
| Test özeti | `Test Summary` | Özellik ve Proje Sürümü detayındaki canlı, türetilmiş, nötr test manzarası; skor, coverage, genel geçti/kaldı, istisna, yayın kapısı veya Sürüm Kanıt Paketi değildir ve ikinci kayıt yazmaz |
| Dikkat (test özeti) | `Attention` | Test özetinde eksik test, bağlam değişikliği, çelişki, `Failed`/`Blocked`/`Inconclusive`/`Skipped`, incelenmemiş rapor, açık Test Açığı ve değerlendirme sonrası yeni bağlamı kaynaklarıyla listeleyen nötr bilgi; hüküm veya sıra taşımaz |
| Testler genel görünümü | `Tests overview` | Testler alanındaki canlı türetilmiş bölümler: `Unreviewed reports`, `Follow-up needed results`, `Open and planned Test Gaps`, `Conflicting or awaiting-supersede results`, `Context-changed results`, `Active Handoffs`, `Recent sessions`, `Recent assessments`; her sayı kesin kümeyi açar, faz veya CI panosu değildir |
| Geçti | `Passed` | Normalize bildirilen sonuç; Ürün kabul kanıtı değildir |
| Kaldı | `Failed` | Normalize bildirilen sonuç |
| Bloke | `Blocked` | Normalize bildirilen sonuç |
| Atlandı | `Skipped` | Normalize bildirilen sonuç |
| Sonuçsuz | `Inconclusive` | Normalize bildirilen sonuç |
| Bildirilmedi | `Not reported` | Normalize bildirilen sonuç; katalog dışı ya da eksik ham sonuç |
| Test değerlendirmesi | `Test assessment` | Test dizini alt türü |
| Teknik Mimari | `Technical Architecture` | Teknik Diyagram türü |
| Veri Modeli | `Data Model` | Teknik Diyagram türü |
| Teknik Sıra | `Technical Sequence` | Teknik Diyagram türü |
| Klasör | `Folder` | Belge ve Dosya Eki dizininde gezinme konumu; sahiplik veya Search değildir |
| Dizinde kayıt yok | `No records in this index.` | Hazır tür dizini boş durumu |
| All Tools | `All Tools` | Hazır Proje alanlarının keşif yüzeyi; Proje alanı değildir ve kapanmaz |
| Yapılandırma modu | `Configuration Mode`; açıkken `Exit Configuration Mode` | Yapı değişikliklerini günlük düzenlemeden ayıran görünür sunum durumu; izin veya yönetici rolü değildir |
| Proje gezinmesi | `Project navigation` | Proje kabuğunda Overview, Work, All Tools ve etkin Proje alanları arasında geçiş sağlayan kalıcı gezinme bölgesi |
| Proje bazlı özel alan | `Custom field` | Yalnız bir Projede yaşayan yapılandırılmış sınıflandırma alanı; Yapılandırma modunda açılır |
| İş şablonu | `Work Template` | Proje kapsamlı tekrar kullanılan İş başlangıç bağlamı; Belge şablonu, Başlangıç yapılandırması veya yakalama mini şablonu değildir |
| Belge şablonu | `Document Template` | Proje veya Kişisel Wiki kapsamında tekrar kullanılan Belge başlangıç iskeleti; İş şablonu veya şablon pazarı değildir |
| Şablona dönüştür | `Convert to template` | Mevcut Belgeden iskelet çıkarma; kaynak Belgeyi taşımaz, arşivlemez veya değiştirmez |
| Şablondan oluştur | `Create from template` | Şablondan bağımsız kimlikli Belge açma; sonraki şablon düzeni eski örnekleri güncellemez |
| Belge şablonu ekle | `Add Document Template` | Proje veya Kişisel Wiki kapsamında yeni Belge şablonu oluşturma |
| Belge şablonunu düzenle | `Edit Document Template` | İskeletin ve yer tutucuların sonraki Belgeler için değiştirilmesi; hazır Personal Review düzenlemesi bağımsız kullanıcı şablonu oluşturur |
| İskelet | `Skeleton` | Belge şablonunun başlangıç gövdesi; canlı bağ veya örnek kayıt değildir |
| Yer tutucular | `Placeholders` | Şablon iskeletindeki `{{field_name}}` alanları |
| Personal Review | `Personal Review` | İsteğe bağlı hazır Belge şablonu; toplantı türü veya zorunlu kullanım sıklığı değildir |
| Kayıt Eylemi | `Record Action` | Kapalı alan ve üyelik adımlarından adlandırılan, tek hedef kayıt üzerinde çalışan birleşik yazma; otomasyon kuralı, Toplu Düzenleme veya betik değildir |
| Start Work | `Start Work` | Durumu `In Progress` yapan ve İşi Günlük Odak’a ekleyen ilk Kayıt Eylemi örneği |
| Çalışma anı girdileri | `Runtime inputs` | Kayıt Eyleminin tasarımda tanımlanıp çalıştırmada seçilen alan değerleri ve mevcut Work ilişkisi |
| Çalıştırırken sor | `Ask when running` | Özel alan adımında sabit değer yerine çalıştırma sırasında değer isteme seçeneği |
| Seçilen girdiler | `Inputs selected` | Önizlemede seçilen çalışma anı girdilerini gösteren özet |
| Değişiklikleri önizle | `Preview changes` | Çalışma anı girdileri veya dış yürütme önerileri seçildikten sonra kesin farkı gösterme eylemi |
| Girdileri değiştir | `Change inputs` | Yeni önizleme için seçilen çalışma anı girdilerine geri dönme eylemi |
| Günlük Odak | `Daily Focus` | Farklı Projelerden seçili profil gününde ele alınacak İşleri toplayan kişisel görünüm; Odak Dönemi, sprint, Aktif Çalışma Seti veya Takvim olayı değildir |
| Günlük Odağa ekle | `Add to Daily Focus` | Seçili profil gününe İş üyeliği ekler; kaynak İş alanlarını değiştirmez |
| Günlük Odaktan çıkar | `Remove from Daily Focus` | Seçili profil günündeki İş üyeliğini kaldırır; İşin durumunu değiştirmez |
| İş seç | `Select Work` | Günlük Odağa eklenecek erişilebilir İşi seçme alanının boş seçeneği |
| Favoriler | `Favorites` | Desteklenen kayda Hesap/Çalışma Alanı kişisel sık erişim işareti; kaydın Projesini, türünü veya durumunu değiştirmez |
| Favorilere ekle | `Add to Favorites` | Proje, Belge, İş, Karar veya Akıllı Koleksiyonu Favorilere alma; kaynak yazmaz |
| Favorilerden çıkar | `Remove from Favorites` | Favori üyeliğini kaldırma; kaynağı silmez veya arşivlemez |
| Birleşik Takvim | `Calendar` | Desteklenen tarihli kayıtları türleri karışmadan gün, hafta, ay ve Agenda’da gösteren yüzey; durum tahtası, sprint veya Event kaydı değildir |
| Gün | `Day` | Birleşik Takvimde yalnız seçili gündeki tarih konumlarını gösteren görünüm |
| Ay | `Month` | Birleşik Takvimde ay penceresindeki konumlar ve başlangıç–hedef aralığı |
| Hafta görünümü | `Week` | Birleşik Takvimde hafta penceresindeki konumlar ve başlangıç–hedef aralığı; Hesap tercihindeki hafta önizlemesi değildir |
| Agenda | `Agenda` | Birleşik Takvimde seçili ayın kayıtlarını kapsam ve tarih türü filtreleriyle kronolojik yoğun listede sunan görünüm; Event kaydı, üyelik veya ikinci takvim gerçeği değildir |
| Tarih türleri | `Date kinds` | Birleşik Takvimde Planned start, Target date ve Reappear date filtre grubu; seçimi Day, Week, Month ve Agenda boyunca korunur |
| Bütün Projeler | `All Projects` | Birleşik Takvim kapsamının ve Table proje filtresinin bütün yetkili Projeleri kapsayan seçeneği |
| Takvimde tarihli İş yok | `No dated Work in this Calendar view.` | Seçili görünüm penceresinde tarihli İş olmadığında boş durum |
| Seçili gün | `Selected day` | Günlük Odak görünümünün profil saat dilimindeki takvim günü seçici etiketi |
| Seçili gün (Birleşik Takvim) | `Selected day` | Birleşik Takvim `/calendar` `calendarDay` sorgusu; Gün yalnız o günün konumları, Hafta o günü içeren hesap haftası, Ay o günün ayı, Agenda o ayın konumlarını kronolojik yoğun listede. Günlük Odak üyelik günü değildir |
| Günlük Odakta İş yok | `No Work in Daily Focus for this day.` | Seçili günde üyelik olmadığında boş durum |
| Odağı kapat | `Close focus` | Günlük Odak’ta seçili gün için isteğe bağlı sakin kapanış görünümü; açık İşi kapatmaz |
| Hâlâ açık | `Still open` | Kapanış görünümünde Günlük Odak’ta açık kalan İşler grubu; Planlanan tarih geçmişinde tamamlanma olayı olmayan kayıt değeri |
| Bugün ne oldu? | `What happened today?` | Seçili profil günündeki türetilmiş önemli olaylar; Daily Note veya ikinci olay geçmişi değildir |
| Bugün önemli olay yok | `No notable events for this day.` | Seçili profil gününde desteklenen önemli olay olmadığında boş durum |
| Karar kaydı olayı | `Recorded` | `What happened today?` içinde kaynak Kararın oluşturulduğu günü gösterir |
| Kaynak kaydı yükleniyor | `Loading source record…` | Proje kabuğunda seçilen kaynak kaydı okunurken erişilebilir yüklenme durumu |
| Kaynak kaydı kullanılamıyor | `Source record is unavailable.` | Kaynak kaydı bulunamadığında veya geçerli Projeye ait olmadığında salt okunur hata durumu |
| Favoriler yükleniyor | `Loading Favorites…` | Favoriler listesinin geçici yükleme durumu |
| Favoriler boş | `No Favorites yet.` | Henüz kişisel favori bulunmadığında gösterilen durum |
| Favoriler kullanılamıyor | `Favorites are unavailable.` | Favoriler listesinin okunamadığını bildiren hata durumu |
| Kaynak açıklaması | `Description` | Kilometre Taşı veya Proje Sürümünün isteğe bağlı açıklama alanı; İş açıklamasıyla aynı gövde alanı değildir |
| Sürüm etiketi | `Version label` | Proje Sürümünde isteğe bağlı kullanıcı tanımlı sürüm metni |
| Olay zamanı | `Occurred at` | Üretim Olayının gerçekleşme zamanı; Geri Bildirim özgün mesaj zamanıyla aynı etiketi bağlamında kullanır |
| Olay etkisi | `Impact` | Üretim Olayının kullanıcı veya sistem üzerindeki etkisi; Risk etkisi değildir |
| Tespit biçimi | `Detected how` | Üretim Olayının nasıl fark edildiği |
| Çözüm | `Resolution` | Üretim Olayının nasıl çözüldüğü |
| Kök neden | `Root cause` | Üretim Olayının kullanıcı tarafından kaydedilen kök neden açıklaması |
| Öğrenim | `Learning` | Üretim Olayından çıkarılan kullanıcı tarafından kaydedilen öğrenim |
| Adaylar | `Candidates` | Günlük Odak’ta hedef tarihi yaklaşan veya yeniden görünme tarihi gelen az sayıda İş önerisi; üyelik değildir |
| Günlük Odakta aday yok | `No Candidates for this day.` | Seçili günde önerilecek aday olmadığında boş durum |
| Aday kuralı | `Work appears here when Target date is this day through the next 7 days, or Reappear date is on or before this day.` | Aday listesinin hangi tarih alanlarıyla dolduğunu açıklayan metin |
| Kabul | `Accept` | Adayı seçili günün Günlük Odak üyeliğine ekleme; durum yazmaz |
| Ret | `Reject` | Adayı o günün odağından dışarıda bırakma; durum veya üyelik yazmaz |
| Hedef tarihi yaklaştı | `Target date is near` | Adayın hedef tarihi nedeniyle önerildiğini açıklayan neden |
| Yeniden görünme tarihi geldi | `Reappear date has arrived` | Adayın yeniden görünme tarihi nedeniyle önerildiğini açıklayan neden |
| İş hedef tarihi | `Target date` | İşin isteğe bağlı hedef günü; Proje hedef tarihi ve yeniden görünme tarihi değildir |
| Çalışma anı girdisi | `Date`, `Number`, `Select`, `Relation` | Kayıt Eyleminin tasarımda tanımlı çalışma anı girdileri; formül, serbest metin makro veya yeni kayıt seçimi değildir |
| Kayıt eylemini başlat | `Start` | Kayıt Eylemini açıkça başlatıp kesin alan farkını önizlemeye açma |
| Kayıt eylemini uygula | `Apply` | Önizlenen Kayıt Eylemi farkını tek atomik sonuç olarak yazma |
| Şablondan oluştur | `Create from template` | Şablondan bağımsız yeni İş açma; şablona canlı bağ değildir ve zorunlu workflow kapısı değildir |
| İşi kopyala | `Duplicate Work` | Mevcut İşi aynı Projede şablona dönüştürmeden tek seferlik kopyalama |
| Planlanan başlangıç | `Planned start` | İşin ne zaman başlamasının düşünüldüğü tarih; göreli şablon kuralı oluşturma gününe göre çözülür |
| Yeniden görünme tarihi | `Reappear date` | İşin en erken ne zaman yeniden değerlendirileceğini belirten isteğe bağlı tarih; hedef tarihi veya hatırlatma değildir |
| Yeniden görünme tarihini temizle | `Clear` | Backlog tarih seçicisindeki yeniden görünme tarihini kaldırır |
| Yeniden görünme tarihi kayıt hatası | `Reappear date could not be saved. Try again.` | Backlog'daki tarih değişikliği kaydedilemediğinde gösterilen geri bildirim |
| Deferred | `Deferred` | Varsayılan Backlog görünümünde gelecek yeniden görünme tarihi taşıyan İşlerin bölümü; durum değildir |
| Yeniden görünme bildirimi | `Notify on Reappear date` | Proje bazında varsayılan kapalı opt-in; tarih gelince `reappear-date` Dikkat sinyali üretir |
| Akıllı Koleksiyon | `Smart Collection` | Koşullardan canlı üyelik türeten adlandırılmış görünüm; statik liste veya klasör değildir |
| Üyelik nedeni | `Membership reason` | Kaydın Akıllı Koleksiyona kapsam ve eşleşen filtre koşullarıyla neden girdiğini açıklayan, canlı üyelik sonucundan türetilen metin |
| Koleksiyon kaydını sürükle | `Drag {record name}` | Üyeyi başka bir Akıllı Koleksiyon görünümüne sürüklemek için erişilebilir eylem adı |
| Alan değişikliği önizlemesi | `Field change preview` | Doğrudan eşitlik koşulunu karşılamak için gereken alan değerini sürükleme sırasında gösteren, yazma yapmayan önizleme |
| Önizleme üyelik yazmaz | `No membership is written by this preview.` | Önizlemenin manuel üyelik veya pin oluşturmadığını açıklar |
| Akıllı Koleksiyon kaynak türü | `Source type` | Koleksiyonun filtrelediği kayıt türü; yalnız kapalı tür matrisindeki kaynaklar seçilebilir |
| İş türü | `Work type` | İş kaynaklı koleksiyonda üyeliği belirleyen doğrudan İş türü eşitliği |
| Belge türü | `Document type` | Belge kaynaklı koleksiyonda yapılandırılmış Belge türü eşitliği |
| Çalışma Alanı kapsamı | `Workspace scope` | Wiki Belgesi koleksiyonunun aynı Çalışma Alanındaki Belgelerle sınırlı canlı kapsamı |
| Proje kapsamı kullanılamıyor | `Project scope is unavailable.` | Proje kapsamı seçimi yüklenemediğinde gösterilen hata durumu |
| Görünümde eşleşen kayıt yok | `No {source type} matches this view.` | Canlı koşullar kaynak türünde kayıt bulamadığında gösterilen boş durum |
| Abone ol | `Subscribe` | Kaydın Akıllı Koleksiyona ilk girişinde `smart-collection-entry` Dikkat sinyali açma |
| Ayrılınca bildir | `Notify on leave` | Aboneliğe ek, kaydın koleksiyondan çıkışında aynı sinyal kimliğiyle ayrılma nedeni |
| Önce Abone ol | `Turn on Subscribe first.` | `Subscribe` kapalıyken `Notify on leave` neden tıklanamadığını söyleyen ipucu |
| Akıllı Koleksiyon aboneliği güncellenemedi | `Smart Collection subscription could not be updated.` | Abonelik ayarı kaydedilemediğinde gösterilen hata iletisi |
| Etiket | `Tags` | Çalışma Alanı genelinde düz sınıflandırma kimliği; klasör, Akıllı Koleksiyon, Favori veya ilişki değildir |
| Hafif İçgörüler | `Insights` | İş koleksiyonunun mevcut filtre sonucundan sayı ve dağılım özeti; skor, coverage veya yayın kapısı değildir |
| Koleksiyon panel grubu | `Collection view` | Ekran okuyucu için `Records` ve `Insights` panel seçimlerini adlandıran grup etiketi |
| İçgörü kapsamındaki kayıtlar | `Records` | İş koleksiyonunun mevcut filtre veya seçili Insights dilimiyle eşleşen kayıt listesini gösterme |
| İçgörü kayıt sayısı | `Count` | Insights özetindeki geçerli yetkili kayıt adedi; skor değildir |
| Kayıt yaşı | `Age` | İş kaydının oluşturulmasından bu yana geçen süre özeti; skor değildir |
| Tüm kayıtları göster | `Show all records` | Insights dilimini kaldırıp koleksiyonun mevcut koşul sonucuna dönme |
| Ayarlanmadı | `Not set` | Eforu boş kaydın Insights dilimi; skor değildir |
| Yaş ve time-in-status dilimleri | `0–7 days`, `8–30 days`, `31+ days` | Hafif İçgörüler gün aralığı özeti; performans eşiği değildir |
| Tüm etiketler | `All tags` | Etiket süzgecinin süzmeyi kaldırma seçeneği |
| Etiket uygula | `Apply tag` | Erişilebilir kayda mevcut Etiketi bağlama |
| Etiket oluştur | `Create tag` | Çalışma Alanı sözlüğüne düz Etiket ekleme |
| Etikete göre süz | `Filter by tag` | Erişilebilir kayıt listesini Etiket kimliğiyle daraltma |
| Etiket adı | `Name` | Etiket görünen adı |
| Eşleşen etiket yok | `No matching tags.` | Seçicide uygulanacak öneri kalmadığında boş durum |
| Etiket yok | `No tags yet.` | Kayıtta henüz Etiket olmadığını söyleyen boş durum |
| Etiketi kaldır | `Remove tag` | Etiketi kayıttan ayırma; kimliği silmez |
| Etiketi yeniden adlandır | `Rename Tag` | Çalışma Alanı etiket kimliğini koruyarak görünen adı atomik güncelleme |
| Bu Projede önerilen | `Suggested in this Project` | Proje seçicisinde sık kullanılanları önce gösteren kişisel öneri; kapsam değildir |
| Etiket seç | `Select a tag` | Erişilebilir İş kaydına uygulanacak mevcut Etiketi seçme |
| Etiket yükleniyor | `Loading Tags…` | Etiket seçicisi ve kimlik listesi yüklenirken gösterilen durum |
| Etiketler yüklenemedi | `Tags could not be loaded. Try loading this page again.` | Etiket kimlikleri yüklenemediğinde gösterilen hata durumu |
| Etiket oluşturulamadı | `Tag could not be created.` | Yeni Etiket kaydı başarısız olduğunda gösterilen hata durumu |
| Etiket uygulanamadı | `Tag could not be applied.` | Etiket üyeliği yazılamadığında gösterilen hata durumu |
| Etiket kaldırılamadı | `Tag could not be removed.` | Etiket üyeliği kaldırılamadığında gösterilen hata durumu |
| Etiket adı kontrolü | `Check the tag name.` | Etiket adı doğrulanamadığında gösterilen form uyarısı |
| Etiket | `Tag` | Rename Tag formunda yeniden adlandırılacak tekil Workspace kimliği |
| Yeniden adlandırılacak etiket | `Tag to rename` | Rename Tag formunda hedef Etiketi seçme alanı |
| Yeni etiket adı | `New name` | Hedef Etiketin yeni görünen adı |
| Etiket yeniden adlandırıldı | `Tag renamed.` | Atomik rename başarıyla tamamlandığında gösterilen durum |
| Geri al | `Undo` | Revision korumalı Etiket rename işlemini güvenli biçimde tersine çevirme |
| Etiket kullanılamıyor | `Tag is unavailable.` | Hedef Etiket bulunamadığında gösterilen hata durumu |
| Etiket yeniden adlandırılamadı | `Tag could not be renamed.` | Rename Tag komutu başarısız olduğunda gösterilen hata durumu |
| Etiket değişti | `Tag changed since it was loaded. Reload before renaming it.` | Etiket yüklendikten sonra değiştiğinde rename öncesi yeniden yükleme isteyen durum |
| Etiket geri alma kaydı yok | `Tag rename is no longer available for Undo.` | Rename kaydı artık bulunamadığında Undo'nun kullanılamadığını söyleyen durum |
| Etiket güvenli geri alınamadı | `Tag rename could not be undone safely.` | Rename Undo güvenli biçimde uygulanamadığında gösterilen hata durumu |
| Etiket geri alınamadı | `Tag could not be undone safely.` | Undo isteği sunucudan açıklamasız döndüğünde gösterilen hata durumu |
| Etiket geri alma için yenileme | `Tag could not be undone. Reload this page.` | Undo için Etiket güncel listede bulunamadığında istenen sayfa yenileme |
| Etiketli kayıtlar yükleniyor | `Loading tagged records…` | Etiketli İş kayıtları listesi yüklenirken gösterilen durum |
| Etiketli kayıtlar yüklenemedi | `Tagged records could not be loaded. Try loading this page again.` | Etiketli İş kayıtları yüklenemediğinde gösterilen hata durumu |
| Etiketli İş kayıtları | `Tagged Work records` | Etiket yüzeyindeki erişilebilir İş kayıtları listesinin ekran okuyucu adı |
| Kayıt etiketleri | `Tags for {record title}` | Bir İş kaydının Etiket listesi için erişilebilir ad |
| Kayıttan etiketi kaldır | `Remove tag {tag name} from {record title}` | Belirli Etiketi belirli İş kaydından ayıran erişilebilir eylem adı |
| Metin | `Text` | Proje bazlı özel alan türü; Lookup veya Formula değildir |
| Boolean | `Boolean` | Proje bazlı özel alan türü |
| True | `True` | Boolean özel alanın ayarlanmış evet değeri; Değerlendirilmedi değildir |
| False | `False` | Boolean özel alanın ayarlanmış hayır değeri; boş veya Değerlendirilmedi değildir |
| Değerlendirilmedi | `Not evaluated` | Proje bazlı özel alanda boş veya ayarlanmamış değer; Boolean false veya seçim değeri değildir |
| Tek seçim | `Single select` | Proje bazlı özel alan türü; seçenekler tanımda Proje-yereldir |
| Çoklu seçim | `Multi select` | Proje bazlı özel alan türü; seçenekler tanımda Proje-yereldir |
| Özel alan adı | `Field name` | Yapılandırma modunda tanımlanan Proje bazlı özel alanın kullanıcı adı |
| Tür | `Type` | Proje bazlı özel alanın kapalı tür kataloğundaki seçimi |
| Seçenekler | `Options` | Tek seçim veya çoklu seçim tanımına ait Proje-yerel seçenekler |
| Kayıt türleri | `Record types` | Proje bazlı özel alanın görüneceği desteklenen kayıt türleri |
| Özel alanlar | `Custom fields` | Geçerli Projedeki özel alan tanımlarının listesi |
| Özel alan ekle | `Add custom field` | Yeni Proje bazlı özel alan tanımını kaydetme eylemi |
| Özel alan yükleniyor | `Loading Custom field…` | Proje bazlı özel alan değer yüzeyi yüklenirken gösterilen durum metni |
| Özel alan değerleri yüklenemedi | `Custom field values could not be loaded. Try loading this page again.` | Özel alan değer yüzeyi yüklenemediğinde gösterilen hata durumu |
| Özel alan değerleri kaydedilemedi | `Custom field values could not be saved.` | Özel alan değeri yazması başarısız olduğunda gösterilen hata durumu |
| Takvim günü seçin | `Choose a calendar date.` | Özel alan Tarih seçicinin açıklaması; Tarih değeri takvim günüdür |
| Tarihi temizle | `Clear date` | Özel alan Tarih değerini Değerlendirilmedi durumuna döndürme eylemi |
| İş Bağlam Kartı düzeni | `Work Context Card layout` | İş Bağlam Kartı bölüm düzeninin Yapılandırma modu girişi; şema veya düzen motoru değildir |
| Özel bölüm ekle | `Add custom section` | Desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolüyle adlandırılmış İş Bağlam Kartı bölümü ekleme; serbest sorgu değildir |
| Göster | `Show` | Yapılandırma modunda gizlenen İş Bağlam Kartı bölümünü yeniden gösterme |
| Kanıt Rolü | `Evidence Role` | Kanıt ilişkisinin kapalı rolü; İş Bağlam Kartı özel bölüm koşuludur |
| Kayıt türü | `Record type` | İş Bağlam Kartı özel bölümünün kapalı kayıt türü koşulu |
| İlişki | `Relation` | İş Bağlam Kartı özel bölümünün kapalı doğrudan ilişki koşulu; serbest ilişki türü değildir |
| Onayla | `Confirm` | İş Bağlam Kartı düzen farkını sürümlü yapılandırma geçmişine yazma |
| Bağlam ekle | `Add Context` | Gizli hazır İş Bağlam Kartı bölümünü aşamalı açma; oluşturma veya durum kapısı değildir |
| Neden bu işi yapıyorum? | `Why am I doing this work?` | İş Bağlam Kartında en yakın anlamlı kaynakları görünür adlarıyla bağlayan türetilmiş neden zinciri; yeni kayıt veya ilişki değildir |
| Öncelik dayanakları | `Priority Foundations` | İş Bağlam Kartında kaynaklara bağlı taranabilir öncelik özeti; skor, WSJF, otomatik sıra veya Önceliklendirme oturumu değildir |
| Benzersiz Contact | `Unique Contact` | Öncelik dayanaklarında Geri Bildirim kayıt sayısından ayrı tutulan benzersiz Contact sayısı |
| Benzersiz Company | `Unique Company` | Öncelik dayanaklarında Company kullanıldığında Geri Bildirim ve Contact sayılarından ayrı tutulan benzersiz Company sayısı |
| Efor | `Effort` | İsteğe bağlı efor tahmini; zaman takibi veya öncelik skoru değildir |
| Henüz bir şey yok | `Nothing here yet.` | Yapılandırılmış görünür boş İş Bağlam Kartı bölümünün tarafsız boş durumu; sağlık veya tamlık skoru değildir |
| Ekle | `Add` | Görünür boş bölümde desteklenen kaynak alanı ekleme eylemi; Bağlam kaydı üretmez |
| İlişkilendir | `Link` | Görünür boş bölümde desteklenen doğrudan ilişki eylemi; kartın kendisi ilişki yazmaz |
| Bağlamı Markdown kopyala | `Copy Context as Markdown` | İş Bağlam Kartı bağlamını panoya okunabilir Markdown olarak aktarma; kayıt veya kalıcı snapshot üretmez |
| Ana kaynak uygulamadadır | `Primary source is in the app` | Kopyalanan Markdown'ın asıl kaydın uygulamada kaldığını belirten not |
| Dış yürütme devri | `External Execution Handoff` | İşe ait test-dışı dış yürütme bileşeni; bağımsız Handoff ana kaydı değildir |
| Devir başlat | `Start Handoff` | Dış yürütme devri başlatma eylemi |
| Devirleri görüntüle | `View Handoffs` | Arşivlenmiş İşteki tarihsel dış yürütme devirlerini salt okunur açma eylemi |
| Devir geçmişi | `Handoff history` | Başlatma, paket üretimi ve dışa aktarma, dönüş, uzlaştırma ve iptal olaylarının `You` atfıyla gösterilen içeriksiz İş geçmişi görünümü |
| Devir başlatıldı | `Handoff started` | İş geçmişinde Dış yürütme devri başlatma olayı |
| Gidiş paketi üretildi | `Going package produced` | İş geçmişinde tarihli gidiş paketi üretim olayı |
| Gidiş paketi kopyalandı | `Going package copied` | İş geçmişinde başarılı panoya kopyalama olayı |
| Devir geçmişi aktörü | `You` | İş sahibinin kendi İşine ait devir geçmişi olaylarındaki aktör atfı |
| Serbest metin güvenlik notu | `Free text is copied as entered and is not scanned for secrets. Review the package before sharing.` | Gidiş paketi önizlemesinde serbest metin taraması yapılmadığını ve paylaşmadan önce inceleme gerektiğini açıklayan uyarı |
| Devir iptal | `Cancel Handoff` | Gerekçeli iptal eylemi; geçmişi silmez |
| Devir açık | `Open` | Dış yürütme devrinin açık, henüz terminal olmayan durumu |
| Devir iptal edildi | `Canceled` | Gerekçeli iptalin terminal durumu |
| Devir yazılamadı | `This handoff could not be written.` | Dış yürütme devri yazmasının reddedildiği veya uygulanamadığı durum |
| Uzlaştır | `Reconcile` | Dönen dış yürütmeyi ana kayıt bağlarına ve takip İşlerine bağlayan kapanış kararı |
| Sonuç döndü | `Result returned` | Dönüş kaydedilmiş, henüz uzlaştırılmamış Dış yürütme devri durumu |
| Uzlaştırıldı | `Reconciled` | Kullanıcının uzlaştırma onayından sonraki terminal Dış yürütme devri durumu |
| Dönüşü kaydet | `Record return` | Yürütücü özetini aynı devre yazan eylem; ana kayıt üretmez |
| Yürütücü özeti | `Executor summary` | Dönen dış çalışmanın yürütücü özeti |
| Değişen varsayımlar | `Changed assumptions` | Dönen dış çalışmada değişen varsayımlar |
| Üretilen kanıt | `Produced evidence` | Dönen dış çalışmada üretilen kanıt veya not; onaydan önce Kanıt kaydı değildir |
| İzinli dış bağlantılar | `Permitted external links` | Dönüşte kaydedilen izinli dış bağlantılar |
| Kapanmamış sorular | `Open questions` | Dönüşte duran kapanmamış sorular; onaydan önce Açık Soru kaydı değildir |
| Takip İşi | `Follow-up Work` | Uzlaştırma onayında açıkça oluşturulacak yeni İş |
| Önerilen ilişkiler | `Proposed relations` | Uzlaştırma formunda kurulması önerilen desteklenen İş ilişkileri grubu |
| Uzlaştırma önizlemesi açıklaması | `Review each relation and Follow-up Work before confirming.` | Seçilen ilişkiler ve takip İşlerinin onaydan önce incelenmesini ister |
| Önerilen ilişki ekle | `Add proposed relation` | Uzlaştırma önizlemesine kurulacak ilişki adayı ekleme |
| Önerilen ilişkiyi kaldır | `Remove proposed relation` | Uzlaştırma önizlemesinden ilişki adayını çıkarma |
| Takip İşi ekle | `Add follow-up Work` | Uzlaştırma önizlemesine takip İş adayı ekleme |
| Takip İşini kaldır | `Remove follow-up Work` | Uzlaştırma önizlemesinden takip İş adayını çıkarma |
| İlgili İş | `Related Work` | Uzlaştırmada bağlanacak mevcut İş |
| Reddet | `Reject` | Uzlaştırma önizlemesini yazmadan kapatan eylem |
| Devir paketi doğruluk notu | `Source of truth is in the app` | Gidiş paketinin kanonik kaynağın uygulamada kaldığını belirten not |
| Yeni paket sürümü | `New package version` | Aynı Dış yürütme devrinde yeni tarihli gidiş paketi üretme; gönderilmiş kopyayı ezmez |
| Paket sürümü | `Package version` | Aynı Dış yürütme devrindeki tarihli gidiş paketi sürümü |
| Yürütücü | `Executor` | Dış yürütme devrindeki yürütücünün görünen adı |
| Kısıtlar | `Constraints` | Dış yürütme devrindeki kısıtlar |
| Beklenen çıktı | `Expected output` | Dış yürütme devrindeki beklenen çıktı veya kabul beklentisi |
| Seçilen sürümler | `Selected versions` | Gidiş paketine alınan kesin sürümler |
| Seçilen sürüm ekle | `Add selected version` | Gidiş paketi manifestine kesin sürüm satırı ekleme |
| Seçilen sürümü kaldır | `Remove selected version` | Gidiş paketi manifestinden kesin sürüm satırını çıkarma |
| Gidiş paketi | `Going package` | Seçilen kesin sürümlerden üretilen tarihli Markdown kopyası; canlı senkron değildir |
| Gidiş paketini kopyala | `Copy going package` | İşe ait tarihli gidiş paketi Markdown'ını panoya kopyalama eylemi |
| Bu İşi dahil et | `Include this Work` | Sahip İşin kesin sürümünü gidiş paketine alma |
| Üretildi | `Produced at` | Markdown kopyasının üretim zamanı etiketi; kalıcı snapshot zamanı değildir |
| Amaç | `Purpose` | Dış yürütme devrinin nedenini açıklayan kullanıcı metni |
| İlgili Karar, Risk ve Açık Soru | `Related Decision, Risk, and Open Question` | Markdown kopyasındaki belirsizlik bölümü |
| Aktif blokajlar | `Active blockers` | Markdown kopyasındaki aktif blokaj bölümü |
| GitHub bağlamı | `GitHub context` | Gidiş paketindeki izinli GitHub kimlikleri; diğer kayıt kaynakları sürüm sözleşmeleri hazır olduğunda seçilir |
| Problem/Fırsat | `Problem/Opportunity` | Feature hazır İş Bağlam Kartı bölümü |
| Beklenen sonuç | `Expected Outcome` | Feature ve Improvement hazır İş Bağlam Kartı bölümü |
| Kanıt ve kararlar | `Evidence & Decisions` | Feature hazır İş Bağlam Kartı bölümü |
| Riskler ve açık sorular | `Risks & Open Questions` | Feature hazır İş Bağlam Kartı bölümü |
| GitHub ve testler | `GitHub & Tests` | Feature, Bug, Task ve Improvement hazır İş Bağlam Kartı bölümü |
| Hedef sürüm | `Target Release` | Feature ve Task hazır İş Bağlam Kartı bölümü |
| Gözlenen/beklenen davranış | `Observed/Expected Behavior` | Bug hazır İş Bağlam Kartı bölümü |
| Etkilenen sürümler | `Affected Releases` | Bug hazır İş Bağlam Kartı bölümü |
| Kanıt | `Evidence` | Bug ve Improvement hazır İş Bağlam Kartı bölümü |
| Bağımlılıklar | `Dependencies` | Task hazır İş Bağlam Kartı bölümü; Özellik ve Odak Dönemi detayında salt-okunur blokaj görünümü |
| Araştırma sorusu | `Research Question` | Research hazır İş Bağlam Kartı bölümü |
| Kaynaklar ve kanıt | `Sources & Evidence` | Research hazır İş Bağlam Kartı bölümü |
| İlgili iş | `Related Work` | Research hazır İş Bağlam Kartı bölümü |
| Mevcut durum | `Current Situation` | Improvement hazır İş Bağlam Kartı bölümü |
| Öncelik ölçütü | `Priority metrics` | İş önceliğini ifade eden Proje yapılandırması; skaler öncelik alanı değildir |
| Öncelik ölçütü ekle | `Add metric` | Proje'ye bağımsız öncelik ölçütü tanımı ekleme eylemi |
| Kısa açıklama | `Short description` | Öncelik ölçütünün kapsamını anlatan kısa metin |
| Kademe açıklamaları | `Rank descriptions` | Beş sabit öncelik kademesinin Proje bazında düzenlenebilir açıklamaları |
| Ölçütü devre dışı bırak | `Disable` | Öncelik ölçütünü silmeden Work değerleri için kullanılamaz duruma getirme |
| Ölçüt devre dışı | `Disabled` | Ölçütün silinmeden Work değerleri için kapalı olduğunu gösteren durum |
| Silme için Proje adını doğrula | `Type the Project name to confirm` | Ölçütü kalıcı silmeden önce kesin Proje adını tekrar girdirme |
| Öncelik kademesi | `Very low`, `Low`, `Medium`, `High`, `Very high` | Beş sabit sıralı düzey; boş durum bu beşin dışındadır |
| Değerlendirilmemiş | `Unevaluated` | Eksen veya ölçüt değeri henüz seçilmemiş İş |
| Kanıt gücü | `Evidence strength` | Görüşlü Başlangıç yapılandırmasının varsayılan kapalı hazır Öncelik ölçütü |
| Öncelik Haritası | `Priority Map` | İki ölçütü eksen alan karşılaştırma görünümü; skor, otomatik sıra veya Backlog sırası değildir |
| Yatay | `Horizontal axis` | Öncelik Haritası yatay eksen seçimi |
| Dikey | `Vertical axis` | Öncelik Haritası dikey eksen seçimi |
| Kanıt sinyallerini göster | `Show evidence signals` | Öncelik Haritası'nda Feedback ve benzersiz Contact/Company sayılarını yalnızca bağlam olarak gösteren, varsayılan kapalı kontrol |
| Eksen değerlerini düzenle | `Edit axis values` | Öncelik Haritası'nda seçili eksenlerin aynı İş için Öncelik ölçütü değerlerini açık kullanıcı eylemiyle düzenleme |
| Benzersiz Contact | `Unique Contact` | Haritada isteğe bağlı kanıt bağlamı |
| Benzersiz Company | `Unique Company` | Haritada isteğe bağlı kanıt bağlamı |
| Kayıtlı görünüm | `Saved views` | Yapılandırma modunda adlandırılmış İş görünümü girişi; günlük planlama eylemi değildir |
| Aşamalar | `Stages` | Yapılandırılabilir Proje aşamalarının Yapılandırma modu girişi |
| İş durumları | `Work statuses` | Korunan İş akışı durumlarının kullanıcıya dönük ad girişi |
| Proje alanları | `Project areas` | Kapalı Proje alanı kataloğunun etkinleştirme girişi |
| Kullanılabilir | `Available` | Henüz etkinleştirilmemiş Proje alanı kataloğu durumu |
| Gizli | `Hidden` | Etkin olup navigasyondan gizlenen Proje alanı durumu |
| Etkin | `Enabled` | Etkin ve görünür Proje alanı kataloğu durumu |
| Navigasyona sabitle | `Pin to navigation` | Proje alanını navigasyon üstverisine sabitleme; alan etkinleştirme değildir |
| Sabitlemeyi kaldır | `Remove pin` | Proje alanının navigasyon üstverisindeki sabitlemesini kaldırma |
| Varsayılan navigasyonu geri yükle | `Restore default navigation` | Yalnız pin ve sıra üstverisini Başlangıç yapılandırması varsayılanına döndürme |
| Navigasyon önizlemesi | `Navigation preview` | Varsayılan navigasyon geri yüklenmeden önce mevcut ve hedef sabitleme üstverisini gösteren onay yüzeyi |
| Mevcut sabitlenmiş alanlar | `Current pinned areas` | Geri yükleme önizlemesinde o anki ek sabitlenmiş Proje alanı sırası |
| Varsayılan sabitlenmiş alanlar | `Default pinned areas` | Geri yükleme önizlemesinde Başlangıç yapılandırmasının hedef ek sabitlenmiş Proje alanı sırası |
| Proje yapısını kopyalama | `Copy project structure` | Aşama, etkin alan, durum, hazır görünüm, düzen, özel alan tanımı, öncelik ölçütü ve boş duvar iskeletini içeriksiz yeni Projeye aktarma; kayıt, şablon, test senaryosu ve otomasyon kopyalamaz |
| Planlanmadı | `Not Planned` | Proje aşaması durumu; İş akışı durumu değildir |
| Hazır | `Ready` | Proje aşaması durumu; İş akışı durumu değildir |
| Gizle | `Hide` | Kapalı katalogdaki Proje alanını gizleme; kayıt silmez |
| Etkinleştir | `Enable` | Gizlenmiş Proje alanını yeniden gösterme; içerik üretmez |
| Aşama ekle | `Add stage` | Yapılandırılabilir Proje aşaması ekleme |
| Aşamayı kaldır | `Remove stage` | Aşamayı sunum ve filtrelerden kaldırma; ana kayıt silmez |
| Yukarı taşı | `Move up` | Aşama sunum sırasını öne alma |
| Aşağı taşı | `Move down` | Aşama sunum sırasını sona alma |
| Aşama kaldırma önizlemesi | `{name} will leave presentation and filters. Main records are not deleted.` | Aşama kaldırılırken sunum/filtre önizlemesi |
| Aşama adı | `Stage name` | Yapılandırılabilir Proje aşamasının görünen adı |
| Aşama hazırlanmadı | `No stages prepared.` | Yapılandırmada henüz aşama olmadığını belirten boş durum |
| Aşamalar yapılandırması | `Stages configuration` | Yapılandırma modundaki aşama listesi ve sunum düzeni bölümü |
| İş durumu yapılandırması | `Work status configuration` | Yapılandırma modundaki korunan İş durumu görünen adları bölümü |
| Görünen ad | `Visible label` | Korunan İş durumu semantiğinin kullanıcıya dönük adı |
| İş durumu etiketi | `Work status label` | Korunan İş durumu semantiğinin görünen adını düzenleme alanı |
| Kaydet | `Save` | Yapılandırma modunda aşama adı ve İş durumu görünen adını kaydetme |
| Aşama adı gerekli | `Stage name is required.` | Boş aşama adı reddi |
| İş durumu adı gerekli | `Work status label is required.` | Boş İş durumu görünen adı reddi |
| Oluştur | `Create` | Yapılandırma modu dışında günlük kayıt oluşturma |
| Düzenle | `Edit` | Yapılandırma modu dışında günlük içerik düzenleme |
| Durum | `Status` | Yapılandırma modu dışında günlük durum değiştirme |
| Planlama | `Planning` | Yapılandırma modu dışında günlük planlama |
| Belgeler | `Documents` | Belge kayıtlarını toplayan Proje alanı |
| Belgeler yükleniyor | `Loading Documents…` | Proje Belgeleri alanı yüklenirken gösterilen ilerleme durumu |
| Belge oluştur | `Create Document` | Projede yeni Belge kaydı oluşturma eylemi |
| Başlangıç iskeleti seç | `Starter skeleton` | Proje yapılandırmasında seçili bir Belge başlangıç iskeletini oluşturma seçeneği |
| Başlangıç iskeleti olmadan oluştur | `No starter skeleton` | Başlangıç iskeleti yerine olağan başlık/tür akışını kullanma seçeneği |
| Belge oluşturma açıklaması | `Choose a starter skeleton, or give this Document a title and type.`; iskelet seçimi yoksa `Give this Document a title and choose its type.` | Oluşturma penceresindeki yapılandırmaya bağlı kısa yönlendirme |
| İptal | `Cancel` | Belge oluşturma penceresini kayıt oluşturmadan kapatma |
| Belge düzenleyici | `Document editor` | Belgenin zengin metin düzenleme alanı |
| Belge görünümü | `Document view` | Aynı Belgenin yazma, Markdown ve önizleme sekmeleri |
| Yaz | `Write` | Belgeyi Tiptap ile görsel düzenleme görünümü |
| Önizleme | `Preview` | Belgenin işlenmiş Markdown görünümü sekmesi |
| Markdown kaynağı | `Markdown source` | Aynı Belgenin düzenlenebilir Markdown metni |
| Güvenli dönüşüm yok | `This Markdown cannot be safely converted to Write. Continue editing in Markdown, or use Preview; your source is unchanged.` | Kayıpsız görsel dönüşüm mümkün olmadığında kaynak metnin korunduğunu söyleyen uyarı |
| Belge biçimlendirme | `Document formatting` | Belge düzenleyicisindeki biçimlendirme araç çubuğu |
| Diğer biçimlendirme araçları | `Swipe for more formatting tools →` | Dar ekranda araç çubuğunun yatay kaydırılabildiğini gösteren ipucu |
| Metin stili | `Text style` | Paragraf ve başlık düzeyi seçimi |
| Paragraf | `Paragraph` | Düz metin bloğu |
| Başlık düzeyleri | `Heading 1`, `Heading 2`, `Heading 3` | Belgedeki üç başlık düzeyi |
| Metin biçimlendirme | `Text formatting` | Satır içi biçimlendirme grubu |
| Kalın | `Bold` | Seçili metni kalınlaştırma |
| İtalik | `Italic` | Seçili metni italikleştirme |
| Üstü çizili | `Strikethrough` | Seçili metnin üstünü çizme |
| Satır içi kod | `Inline code` | Seçili metni kod olarak biçimlendirme |
| Bağlantı | `Link` | Seçili metne bağlantı ekleme veya bağlantıyı düzenleme |
| Bağlantıyı düzenle | `Edit link` | Bağlantı adresini düzenleme penceresi |
| Adres | `URL` | Bağlantı adresi alanı |
| Bağlantıyı uygula | `Apply link` | Geçerli bağlantı adresini uygulama |
| Bağlantıyı kaldır | `Remove link` | Seçili metindeki bağlantıyı kaldırma |
| Geçerli adres gerekli | `Use an http, https, or mailto URL.` | Desteklenmeyen bağlantı adresi uyarısı |
| Blok biçimlendirme | `Block formatting` | Liste, alıntı ve kod bloğu grubu |
| Madde işaretli liste | `Bullet list` | Geçerli bloğu madde işaretli listeye dönüştürme |
| Numaralı liste | `Numbered list` | Geçerli bloğu numaralı listeye dönüştürme |
| Alıntı | `Quote` | Geçerli bloğu alıntıya dönüştürme |
| Kod bloğu | `Code block` | Geçerli bloğu kod bloğuna dönüştürme |
| Kod dili | `Code language` | Kod bloğunun vurgulama dilini seçme |
| Otomatik dil algılama | `Auto detect` | Kod bloğunda belirli dil seçilmediğinde algılama kullanma |
| Kod dilleri | `TypeScript`, `JavaScript`, `JSON`, `SQL`, `Bash`, `Python` | Kod bloğunda açıkça seçilebilen vurgulama dilleri |
| İçerik ekle | `Insert content` | Tablo, diyagram ve ayraç ekleme grubu |
| Tablo ekle | `Insert table` | İmleç konumuna tablo ekleme |
| Mermaid bloğu | `Mermaid block` | Diyagram kod bloğu ekleme |
| Formül ekle | `Insert formula` | Satır içi veya blok LaTeX formülü ekleme |
| Formül | `Formula` | LaTeX formülü oluşturma penceresi |
| LaTeX | `LaTeX` | Formül kaynak alanı |
| Yerleşim | `Placement` | Formülün satır içi veya blok görünümünü seçme |
| Satır içi | `Inline` | Formülü metin akışı içinde yerleştirme |
| Blok | `Block` | Formülü ayrı blokta yerleştirme |
| LaTeX gerekli | `LaTeX is required.` | Boş formül kaynağı uyarısı |
| Yatay çizgi | `Horizontal rule` | İmleç konumuna ayraç ekleme |
| Düzenleme geçmişi | `Edit history` | Geri alma ve yeniden yapma grubu |
| Geri al | `Undo` | Son düzenlemeyi geri alma |
| Yeniden yap | `Redo` | Geri alınan düzenlemeyi yineleme |
| Tablo düzenleme | `Table editing` | Seçili tablonun satır ve sütun araçları |
| Satır ekle | `Add row` | Seçili tablodaki konuma satır ekleme |
| Sütun ekle | `Add column` | Seçili tablodaki konuma sütun ekleme |
| Tabloyu sil | `Delete table` | Seçili tabloyu kaldırma |
| Belge önizlemesi | `Document preview` | Belgenin Markdown, diyagram ve formül görünümü |
| Belge seç | `Select a Document.` | Belge seçilmediğinde gösterilen boş durum |
| Mermaid diyagramı | `Mermaid diagram` | Belge önizlemesinde işlenen diyagram için erişilebilir ad |
| Belge kaydedilemedi | `Document could not be saved.` | Belge güncelleme isteği başarısız olduğunda gösterilen genel hata |
| Belge oluşturulamadı | `Document could not be created.` | Yeni Belge oluşturma isteği başarısız olduğunda gösterilen genel hata |
| Belgeler yüklenemedi | `Documents could not be loaded.` | Proje Belge listesi yüklenemediğinde gösterilen hata durumu |
| Belge veya Proje kullanılamıyor | `Document or Project is unavailable.` | Belge veya Proje hedefi bulunamadığında gösterilen hata durumu |
| Diyagram işlenemedi | `Diagram could not be rendered.` | Mermaid diyagramı işlenemediğinde gösterilen genel hata |
| Formül işlenemedi | `Formula could not be rendered.` | LaTeX formülü işlenemediğinde gösterilen genel hata |
| Discovery | `Discovery` | Geri Bildirim ve araştırma kayıtlarını toplayan Proje alanı veya hazır aşama adı |
| Decisions | `Decisions` | Karar, Risk, Varsayım ve Açık Soruyu toplayan Proje alanı; Research hazır İş Bağlam Kartı bölümü de aynı etiketi kullanır |
| Karar hükmü | `Decision text` | Kararın yürürlükteki seçim metni |
| Karar gerekçesi | `Rationale` | Kararın alınma veya geri çekilme gerekçesi; kapanış `Reason` değildir |
| Geçerli | `Valid` | Kararın yürürlükteki yaşamı; durumsuz içe aktarım da böyle okunur |
| Yerine geçildi | `Superseded` | Yalnız açık yerine-geçme ilişkisiyle oluşan Karar yaşamı |
| Geri çekildi | `Withdrawn` | Halef gerektirmeyen açık geri çekme yaşamı |
| Geri çek | `Withdraw` | Kararı `Withdrawn` yapan açık eylem |
| Başka kararın yerine geçir | `Supersede another decision` | Önizleme üzerinden tam yerine-geçme eylemi |
| Yerine geçilecek Kararlar | `Decisions to supersede` | Bir veya birden fazla eski Kararın açık seçimi |
| Yerine geçmeyi onayla | `Confirm supersession` | Önizlenen yönlü ilişki ve yaşamları atomik kesinleştirme |
| Yerine geçmeyi kaldır | `Remove supersession` | İlişkiyi ve eski Kararın yaşamını önizleme |
| Kaldırmayı onayla | `Confirm removal` | Eski Kararı açık onayla yeniden `Valid` yapma |
| Geçiş gerekçesi | `Transition rationale` | Yerine-geçme veya kaldırma olayının isteğe bağlı gerekçesi |
| Yerine-geçme bölümü | `Supersession` | Decision detayındaki ilişki ve işlem bölgesi |
| Yerine-geçme önizlemesi | `Supersession preview` | Yaşam değişikliklerinin onay öncesi bölgesi |
| Yerine-geçme yükleniyor | `Loading supersession…` | İlişki okuması beklenirken görünür durum |
| Yerine-geçme kullanılamıyor | `Supersession is unavailable.` | İlişki okuması hatası |
| Güncel kararı aç | `Open current decision` | Yerine geçilmiş Karardan nihai `Valid` kaydı açma |
| Karar yok | `No Decisions yet.` | Projede henüz Karar olmadığını söyleyen boş durum |
| Design | `Design` | Duvar, Ekran ve akış kayıtlarını toplayan Proje alanı veya hazır aşama adı |
| Tests | `Tests` | Test kayıtlarını toplayan Proje alanı; ayrı test ürünü değildir |
| Releases | `Releases` | Proje Sürümü girişini toplayan Proje alanı |
| Production | `Production` | Üretim olayları girişini toplayan Proje alanı |
| GitHub | `GitHub` | GitHub bağlantısı girişini toplayan Proje alanı; oluşturmada zorunlu bağlantı değildir |
| Backlog | `Backlog` | Hazır İş görünümü; tek kalıcı manuel sıra |
| Backlog yükleniyor | `Loading Backlog…` | Hazır Backlog koleksiyonu yüklenirken erişilebilir ilerleme mesajı |
| Backlog kullanılamıyor | `Backlog is unavailable. Try loading this page again.` | Hazır koleksiyon sorgusu başarısız olduğunda gösterilen, yazma yapıldığını ima etmeyen hata mesajı |
| Boş Backlog | `No active Work to consider.` | Değerlendirilecek etkin İş olmadığında gösterilen boş durum |
| Manuel sıra | `Manual order` | Backlog’un tek kalıcı ele alma sırası; alternatif sunum bunu silmez |
| Backlog sıralama seçimi | `Backlog sort` | Geçici sıralama sunumunu seçer; manuel sırayı yazmaz |
| Backlog kayıtlı sunumu | `Saved presentation`, `Save presentation`, `Use saved presentation` | Projedeki tek kayıtlı alternatif sıralamayı saklar ve yeniden seçer; manuel sırayı yazmaz |
| Kayıtlı Backlog sunumu özeti | `Saved presentation: {sort}[ · {detail}]` | Kayıtlı sıralamanın türünü ve varsa seçilmiş ölçüt veya alanı gösterir |
| Backlog sunumu kaydedilemedi | `Backlog presentation could not be saved. Try again.` | Kayıtlı alternatif sunum yazma hatası |
| Öncelik sıralama ölçütü | `Priority criterion` | Öncelik sunumunun hangi açık ölçüte göre sıralanacağını seçer |
| Alan sıralama seçimi | `Field to sort by` | Alan sunumunun `Title` veya `Status` temelini seçer |
| Backlog sürükleme tutamacı | `Drag {Work title}` | İş adını taşıyan klavye ve işaretçi sıralama kontrolü |
| Backlog sürükleme duyuruları | `Picked up {Work title}.`, `{Work title} is over {Work title}.`, `{Work title} is outside the Backlog.`, `{Work title} was dropped over {Work title}.`, `{Work title} was not moved.`, `Moving {Work title} was cancelled.` | Ekran okuyucuya sürükleme durumunu İş adıyla bildirir |
| Backlog sırası kaydedilemedi | `Backlog order could not be saved. Try again.` | Manuel sıra yazma hatasını bildirir; görünür sıra son kaydedilen değerde kalır |
| Öncelik sıralaması | `Priority` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Tarih sıralaması | `Date` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Alan sıralaması | `Field` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Board | `Board` | Hazır İş görünümü; Kanban sunumu |
| Kanban kartını taşı | `Move` | Kartı korunan İş akışı durumu sütunları arasında sürükleme denetimi; `Status` kontrolü tıklama ve klavye alternatifi sunar ([Kanban test seam'i](../specs/25-kanban/spec.md#testing-decisions)) |
| Liste görünümü | `List` | Kanban ile aynı İş taramasının yoğun satır düzeni; Tablo Görünümü değildir |
| Sıralama alanı | `Sort by` | `Board` ve `List` için ortak kayıtlı İş sıralama alanını seçme |
| Sıralama yönü | `Sort direction` | `Board` ve `List` için ortak kayıtlı sıralama yönünü seçme |
| İş numarası | `Work number` | İşleri Projedeki değişmeyen numarasına göre sıralama seçeneği |
| Oluşturulma | `Created` | İşleri oluşturulma zamanına göre sıralama seçeneği |
| Güncellenme | `Updated` | İşleri son güncellenme zamanına göre sıralama seçeneği |
| Gallery | `Gallery` | Akıllı Koleksiyon adlandırılmış görünüm sunumu; Dosya Eki kütüphanesi, Moodboard veya ayrı kapak kaydı değildir |
| Varsayılan görünüm | `Default` | İş koleksiyonunda ilk adlandırılmış görünüm adı |
| Adlandırılmış görünüm | `Named view` | Aynı Akıllı Koleksiyon üyeliği üzerindeki saklı sunum; ikinci üyelik kümesi değildir |
| Akıllı Koleksiyon kaydedilemedi | `Smart Collection could not be saved.` | Yeni koleksiyon ve ilk adlandırılmış görünüm birlikte kaydedilemediğinde hata durumu |
| Akıllı Koleksiyon kullanılamıyor | `Smart Collection is unavailable.` | Kaynak görünüm çözümlenemediğinde salt okunur hata durumu |
| Yok | `None` | Adlandırılmış görünümde sıra alanı seçilmedi |
| Yeni iş | `New work` | İş koleksiyonundaki doğrudan `Work type` eşitliğini `Type` alanında önceden dolduran oluşturma; diğer koşulları yeni İşe uygulamaz |
| Yeni İş eşleşmeme uyarısı | `This Work may not appear in this Smart Collection.` | Seçili `Type` veya varsayılan `Status` koleksiyon koşullarını karşılamadığında gösterilen uyarı |
| Kaydedilmemiş değişiklikler | `Unsaved changes` | Adlandırılmış görünümde henüz kaydedilmemiş sunum; üyelik koşulunu yazmaz |
| Yeni görünüm olarak kaydet | `Save as` | Kirli sunumu yeni adlandırılmış görünüme yazma |
| Geri dön | `Revert` | Kirli sunumu kayıtlı adlandırılmış görünüme döndürme |
| Soft WIP | `Soft WIP` | Durum bazlı isteğe bağlı sayı sınırı; aşıldığında nötr işaret, hareket kapısı değildir |
| Odak eşiği | `Focus threshold` | Proje veya ilgili Akıllı Koleksiyon için isteğe bağlı kişisel devam eden İş sayısı eşiği |
| Sınır aşıldı | `Over limit` | Soft WIP veya odak eşiği aşımının yalnız renge dayanmayan işareti |
| Mevcut durumda geçen süre | `Time in status` | Aktif kartın mevcut İş akışı durumunda geçirdiği süre |
| Devam eden İş sayısı | `In Progress count` | Tahtadaki `In Progress` İş adedi |
| Daralt | `Collapse` | Kanban sütununu yalnız görünümde sıkıştırma; filtre değildir |
| Genişlet | `Expand` | Daraltılmış Kanban sütununu açma |
| Açık blokaj | `Open blocker` | Daraltılmış sütunda kalan önemli blokaj sinyali |
| Roadmap | `Roadmap` | Hazır İş görünümü |
| Şimdi | `Now` | İsteğe bağlı Roadmap ufku |
| Sırada | `Next` | İsteğe bağlı Roadmap ufku |
| Sonra | `Later` | İsteğe bağlı Roadmap ufku |
| Ufuk | `Horizon` | İşin isteğe bağlı Roadmap ufku alanı |
| Ürün yönü | `Product direction` | Varsayılan Roadmap görünümü; Araştırma birincil, kökenli Özellik ikincil |
| Tüm İş türleri | `All Work types` | Bütün İş türlerini birincil gösteren adlandırılmış Roadmap görünümü |
| Ufka yerleştir | `Place on horizon` | İsteğe bağlı ufku yazma eylemi |
| Ufuk yok | `No horizon` | Ufku boşaltma |
| Adlandırılmış görünümü kaydet | `Save named view` | Roadmap filtre ve grup üstverisini kaydetme |
| Roadmap grup alanı | `Group by` | Adlandırılmış görünümde mevcut alanı grup ekseni seçme |
| Roadmap işareti | `Mark by` | Adlandırılmış görünümde ikinci alanı renk ve metin işareti seçme |
| Roadmap filtresiz değer | `No filter` | Seçili alanla kapsamı daraltmama |
| Roadmap boş görünüm | `No Work matches this view.` | Adlandırılmış görünüm filtresine uyan İş yok |
| Roadmap tarihsiz İş | `No target date` | İşe hedef tarihi verilmediğini anlatır; ufuk yazması tarih üretmez |
| Roadmap yükleme hatası | `Roadmap is unavailable. Reload and try again.` | İç Roadmap sorgusu kullanılamıyor |
| Ufuk kaydetme hatası | `Horizon could not be saved. Reload and try again.` | Ufuk yazması başarısız oldu |
| Görünüm kaydetme hatası | `Named view could not be saved.` | Adlandırılmış görünüm yazması başarısız oldu |
| Araştırma yönü kaydetme hatası | `Research direction could not be saved.` | Araştırma bağlamı yazması başarısız oldu |
| Kayıtlı olmayan araştırma bağlamı | `Not recorded` | Araştırma problem/fırsat veya beklenen sonuç değeri boş |
| Şimdi değil | `Not now` | İş üzerindeki sahipli erteleme izi; durum, Parked veya Karar kaydı değildir |
| Şimdi değil gerekçesi | `Reason` | `Not now` karar izinin kısa gerekçesi |
| Yeniden değerlendirme koşulu | `Re-evaluation condition` | Kullanıcının yazdığı serbest metin; sistem izlemez |
| Dayanak kayıtlar | `Supporting records` | `Not now` izinin Karar, Risk, Geri Bildirim, Kaynak veya Belge dayanakları |
| Önizleme | `Preview` | `Not now` kaydından önce gösterilen gerekçe, koşul ve dayanaklar |
| Şimdi değil onayı | `Confirm Not now` | Önizlenen `Not now` izini kaydetme eylemi |
| Yeniden değerlendiriliyor | `Reconsidering` | Etkin `Not now` izini kapatan eylem |
| Yerine konmuş | `Replaced` | Önceki etkin `Not now` izini yeni bir iz ile kapatan geçmiş durumu |
| Geçmiş | `History` | Önceki `Not now` izlerinin gerekçe, koşul, dayanak, yazar ve zaman kayıtları |
| Yeniden bak | `Review Later` | Kaynak bağlantılı kişisel hatırlatma; `Not now` sessiz silmez; `Review later` aynı etikettir |
| Hatırlatma yok | `No reminders.` | Kaynak kayıtta henüz Hatırlatma bulunmadığını bildiren boş durum |
| Hatırlat | `Remind me` | Desteklenen kayda Hesap kapsamında kişisel zaman bağlama eylemi; `Target date` yazmaz |
| Hatırlatma yaşamı | `Planned`, `Triggered`, `Cancelled` | Hatırlatmanın İngilizce yaşam etiketleri; kaynak İş akışı durumu değildir |
| Hatırlatma zamanı | `When` | Hatırlatmanın kişisel zaman alanı; İş `Target date` değildir |
| Hatırlatma koşulu | `Condition` | Zamanı gelince açık/çözülmüş kaynak yaşamını değerlendirme seçimi |
| Hatırlatmayı iptal et | `Cancel` | `Planned` Hatırlatmayı `Cancelled` yapan açık eylem |
| Hatırlatma oluştur | `Set reminder` | Desteklenen kayda kaynak bağlantılı Hatırlatma kurma eylemi |
| Hatırlatmayı kapat | `Dismiss` | Tetiklenmiş Hatırlatma sinyalini kapatan açık eylem; İş veya kopya üretmez |
| Her durumda | `In any case` | Hatırlatmanın varsayılan koşulsuz açık kalma koşulu |
| Yalnız hâlâ açıksa | `Only if still open` | Zamanı gelince kaynağın açık/çözülmüş yaşamını okuyan kapalı koşul; genel sorgu değildir |
| Bölüm | `Section` | Belge `Review Later` hedefinin kararlı Markdown başlık kimliği |
| Tüm Belge | `Entire document` | Belge hatırlatmasında bölüm hedefi olmayan seçim |
| Bu bölüm yok | `This section is missing.` | Silinmiş veya çözülemeyen bölüm hedefinin açıklaması; sessiz başka başlık yoktur |
| Yeniden bakı koru | `Keep Review later` | İz kapanınca bağlı hatırlatmayı bırakma |
| Yeniden bakı kaldır | `Remove Review later` | İz kapanınca bağlı hatırlatmayı açıkça kaldırma |
| Planlanmamış adaylar | `Unplanned candidates` | Görünüm filtresine uyan fakat tarih ve ufku olmayan canlı aday alanı |
| Plana al | `Place on plan` | Adayı tarih veya ufuk yazarak plana alma; önizleme ve onay ister |
| Sunum Kipi | `Presentation Mode` | Roadmap düzenleme ve yapılandırmayı gizleyen salt okunur tam ekran kip |
| Sunum Kipinden çık | `Exit Presentation Mode` | Sunum Kipini kapatıp aynı görünüm ve konuma dönme |
| Build | `Build` | Hazır Proje aşaması adı |
| Validate | `Validate` | Hazır Proje aşaması adı |
| Release | `Release` | Hazır Proje aşaması adı; `Releases` alanı veya Proje Sürümü değildir |
| Operate | `Operate` | Hazır Proje aşaması adı |
| Maintain | `Maintain` | Hazır Proje aşaması adı |
| Not Started | `Not Started` | Korunan İş akışı durumu |
| In Progress | `In Progress` | Korunan İş akışı durumu |
| Blocked | `Blocked` | Korunan İş akışı durumu |
| Closed | `Closed` | Korunan İş akışı durumu |
| Kapanış sonucu | `Closure result` | Kapalı İşin `Completed` veya `Abandoned` sonucunu açıkça seçen alan etiketi |
| Bug | `Bug` | İş türü |
| Görev | `Task` | İş türü; subtask değildir |
| Araştırma | `Research` | İş türü |
| İyileştirme | `Improvement` | İş türü |
| İş oluştur | `Create Work` | Projede yalnız başlıkla İş oluşturma eylemi |
| Kopya olarak birleştir | `Merge as duplicate` | Gerçek kopya iki İşi tek hayatta kalan ana kayıtta birleştirme; kaybedenin anahtarı emekli kimlik yönlendirmesidir |
| Birleştirme önizlemesi | `Merge Preview` | Hayatta kalan kayıt, alan çatışmaları ve yeniden yazılacak ilişkilerin onay öncesi görünümü |
| Contact'ları birleştir | `Merge Contacts` | Güçlü kopya adayından kullanıcı başlatmalı Contact birleştirmesini açan eylem; Company birleştirmesi değildir |
| Hayatta kalan Contact | `Surviving Contact` | Contact birleştirmesinde kullanıcının seçtiği, kopyanın değerlerini ve bağlarını devralan ana kayıt |
| Birleştirmeyi onayla | `Confirm Merge` | Güncel Merge Preview'u tek atomik yazmayla uygulayan onay |
| Birleştirmeyi geri al | `Undo Merge` | Emekli Contact kimliğini yeniden ana kayıt yapan düzeltme eylemi; geçmişe tam dönüş değildir |
| Geri alma önizlemesi | `Undo Merge Preview` | Geri verilecek değer ve bağların, çatışmaların ve geri gelemeyen içeriğin onay öncesi görünümü |
| Geri almayı onayla | `Confirm Undo Merge` | Güncel Undo Merge Preview'u tek atomik yazmayla uygulayan onay |
| Geri yüklenemez | `Cannot be restored` | Redaksiyon veya kalıcı silmeyle yok olduğu için geri alma sonrası dönemeyecek içeriği gösteren önizleme satırı |
| Güncel değeri koru | `Keep current value` | Birleştirmeden sonra değişmiş alanda sonraki değeri koruyan geri alma kararı |
| Önceki değeri geri yükle | `Restore previous value` | Birleştirmeden sonra değişmiş alanı birleştirme öncesi değerine döndüren geri alma kararı |
| Geri yüklenecek e-posta takma adları | `Email aliases restored` | Geri almada emekli Contact'a dönecek normalize e-posta takma adları |
| Geri yüklenen Geri Bildirim | `Feedback restored` | Geri almada emekli Contact'a yeniden bağlanacak Geri Bildirim sayısı |
| Geri yüklenen Persona bağları | `Persona links restored` | Geri almada emekli Contact'a dönecek Persona Document bağları |
| Geri Bildirim bağı | `Feedback link` | Geri gelemeyen Geri Bildirim bağının türü; `Cannot be restored` altında listelenir |
| Persona bağı | `Persona link` | Geri gelemeyen Persona Document bağının türü; `Cannot be restored` altında listelenir |
| Company bağı | `Company link` | Geri gelemeyen Company bağının türü; `Cannot be restored` altında listelenir |
| Ad devralındı | `Display name adopted` | Hayatta kalanın adı boşsa kopyanın adının devralınacağını gösteren önizleme satırı |
| E-posta takma adları eklenir | `Email aliases added` | Kopyadan hayatta kalan Contact'a eklenecek normalize e-posta takma adları |
| Geri Bildirim taşınır | `Feedback moved` | Kopyadan hayatta kalan Contact'a bağlanacak Geri Bildirim sayısı |
| Persona bağları eklenir | `Persona links added` | Kopyadan hayatta kalan Contact'a eklenecek Persona Document bağları |
| Hayatta kalanı koru | `Keep survivor` | Birleştirmede hayatta kalanın güncel Company bağının korunduğunu gösteren Belongs to Company sonucu |
| Kopyayı devral | `Adopt retired` | Hayatta kalanda Company yokken kopyanın güncel Company bağının devralındığını gösteren Belongs to Company sonucu |
| Yönlendirilen kimlik | `Redirected from` | Emekli kayıt kimliğinden açılan Contact'ta eski kimliğin görünür kökeni; içeriksiz yönlendirmedir |
| Birleştirmeyi geri alma önizlemesi | `Undo Preview` | Birleştirmeyi geri almada ayrılacak değerler ve restor edilemeyen içeriğin onay öncesi görünümü |
| Toplu düzenleme | `Bulk Edit` | Açıkça seçilmiş İşlerde mevcut alanların onay öncesi fark önizlemesi; örtük seçim, şema göçü veya içe aktarma değildir |
| Uygula | `Apply` | Toplu düzenlemede seçilen İşlere alan yazmasını başlatma |
| İlerleme | `Progress` | Toplu uygulamanın donmayan ilerleme göstergesi |
| Başarılı | `Succeeded` | Bir seçilen İşin görünür başarı sonucu |
| Başarısız | `Failed` | Bir seçilen İşin görünür başarısızlık sonucu |
| Hayatta kalan kayıt | `Surviving record` | Birleştirmede kalacak kanonik İş |
| Alan çatışmaları | `Field conflicts` | Birleştirmede kullanıcı çözümü isteyen ayrışan alanlar |
| Birleştirme değeri | `Choose a value` | Alan çatışmasında hayatta kalan veya kopya değeri seçen kontrol |
| Hayatta kalanın değeri | `Use surviving record` | Çatışan alanda hayatta kalan kaydın değerini koruma seçimi |
| Kopyanın değeri | `Use duplicate` | Çatışan alanda kopya kaydın değerini taşıma seçimi |
| Çakışmayan alanlar | `Fields without conflicts` | Önizlemede kullanıcı çözümü gerektirmeyen, aynı kalan alanlar |
| Kapanış gerekçesi | `Closure reason` | Birleştirme önizlemesinde kapanış gerekçesi alanının görünümü; kapanış adımındaki `Reason` değerinin kendisidir |
| Yakalama köken izi | `Capture provenance` | Yakalamadan dönüşen İşte korunan dönüşüm kökeni bilgisi; `Origin` ilişkisi değildir |
| Seçimi düzenle | `Edit selection` | Güncel Merge Preview onaylanmadan alan seçimlerini yeniden açma |
| İlişkiler | `Relations` | Birleştirmede hayatta kalana yazılacak ilişkiler |
| Kaynağı yeniden yaz | `Rewrite source` | Kopya kaydın kaynak ucunu hayatta kalan kayda yönlendirme |
| Hedefi yeniden yaz | `Rewrite target` | Kopya kayda giden hedef ucunu hayatta kalan kayda yönlendirme |
| Kendine ilişkiyi kaldır | `Remove self relation` | Birleştirme sonrası hayatta kalan kayda dönen ilişkiyi kaldırma |
| Included in bağını yeniden yaz | `Rewrite Included in` | Kopya Feature altındaki Work bağını hayatta kalan Feature’a taşıma |
| Köken | `Origin` | Emekli kimliğin hayatta kalan kayda görünür yönlendirmesi |
| İlgili | `Related` | Anlamsal bağ; kendiliğinden birleştirme değildir |
| Satır içi kayıt referansı | `Inline reference` | Belge gövdesindeki kullanım bağı; standart ilişki değildir |
| Kararlı bölüm referansı | `Section reference` | Kararlı Belge bölümüne kullanım bağı |
| Canlı içerik bloğu | `Live block` | Kaynak kimliğini koruyan canlı gömü |
| Konuma sabitlenmiş bağ | `Pinned bind` | Dosya Eki veya Wireframe konumuna sabitlenmiş kullanım bağı |
| Akış düğümü Ekran referansı | `Screen reference` | Kullanıcı Akışı düğümünün Ekran kullanım bağı |
| Bağı kaldır | `Unlink` | Gömüyü kaldırıp kaynak ana kaydı silmeyen eylem |
| Kullanıldığı yerler | `Used in` | Standart ilişki geri bağlantıları ile kullanım bağlarının kaynak türüne göre ayrı özeti; kopya içerik veya yeni yazma değildir |
| Kullanım bağları | `Usage links` | `Used in` yüzeyindeki standart ilişki grubundan ayrı gösterilen gömülü kullanım bağları grubu |
| Türetilen | `Derived` | Köken ilişkisinin üretilen uç etiketi; `Related` yerine geçmez |
| Çöp Kutusunda | `In Trash` | Kırık referans nedeni |
| Kalıcı silindi | `Permanently deleted` | Kırık referans nedeni |
| Güvenlik nedeniyle redakte edildi | `Redacted for security` | Kırık referans nedeni |
| Erişim yok | `No access` | Kırık referans nedeni; yetkisiz ad sızdırmaz |
| Kırık referans arşivi | `Archived` | Kırık referans nedeni; İş arşiv filtresiyle aynı İngilizce etiket |
| İlişkiyi onayla | `Confirm relation` | Tür ve iki ucun önizlemesinden sonra ilişki yazma |
| Kaynak öğe artık yok | `Source item is gone` | Köken konumunda sahipli bileşenin çözülemediğini açıklar |
| İlişki yok | `No relations yet.` | Henüz standart ilişki olmadığını söyleyen boş durum |
| İş ilişkileri bölümü | `Relations` | İş detayındaki ilişki bölümünün başlığı; birleştirme satırındaki aynı etiketten ayrı kavram |
| İlişki türü | `Relation type` | İlişki oluşturmada kapalı katalogdan tür seçimi |
| İlişkiyi önizle | `Preview relation` | Tür ve iki uçla önizleme üreten eylem |
| İlişki kaldırıldı | `Relation removed.` | İlişki kaldırıldıktan sonra geri alma fırsatını bildiren durum |
| İlişkiler yükleniyor | `Loading relations…` | İlişki listesinin yüklenme durumu |
| İlişkiler yüklenemedi | `Relations could not be loaded. Try loading this page again.` | İlişki listesi yüklenemediğinde gösterilen hata |
| Kırık uç | `Broken —` | Çözülemeyen ilişki ucunun kırık neden öneki |
| Bu kayıt | `(current)` | İlişki ucunun güncel açık kayıt olduğunu belirten ek |
| İş seç | `Select a Work` | İlişki hedefi seçilmemiş boş seçenek |
| Kaldır | `Remove` | Standart ilişkiyi güvenli geri alma ile kaldırma |
| Engeller | `Blocks` | Engelleme ilişkisinin kaynak ucu; serbest ilişki türü değildir |
| Engellenir | `Blocked by` | Engellenen İş ucu; planlama tüketicisinin okuduğu bekletme yönü |
| Aktif engelleme | `Active` | Engelleme ilişkisinin bekleyen durumu; İş akışı durumu `Blocked` değildir |
| Çözülmüş engelleme | `Resolved` | Engelleme ilişkisinin tarihsel durumu; aktif blokaj sinyalinden çıkar |
| Engel çözüldü | `Mark blocker resolved` | Çözüm tarihi ve isteğe bağlı not yazan eylem; kaynak kapanışı değildir |
| Çözümü onayla | `Confirm resolution` | Çözüm tarihini ve isteğe bağlı notu kaydeden eylemi onaylar |
| Çözüm notu | `Note` | Engel çözüldü eyleminin isteğe bağlı notu |
| Blokaj geçmişi | `Blocker history` | Aynı engelleme ilişkisindeki Active ve Resolved geçişlerini, Undo işaretlerini ve geri yüklenen çözüm tarihini gösterir |
| Geri alma | `Undo` | Blokaj geçmişindeki geri alınmış geçişi belirtir |
| Çözüm tarihi | `Resolution date` | Undo ile geri yüklenen çözüm tarihini gösterir |
| Engeli yeniden etkinleştir | `Reactivate blocker` | Çözülmüş aynı ilişkiyi yeniden aktif beklemeye döndürür |
| İlişkiyi kaldır | `Remove relation` | Yanlış kurulmuş engelleme bağını silme; çözüm geçmişi değildir |
| Açıklama | `Description` | İşin taşınabilir gövde alanı; Task hazır İş Bağlam Kartı bölümü de aynı etiketi kullanır |
| Hafif kontrol listesi | `Checklist` | İşteki metin maddeleri; bağımsız İş değildir |
| Kontrol listesi maddesi | `Item` | Hafif listedeki metin alanı; İş başlığı değildir |
| Madde ekle | `Add item` | Hafif kontrol listesine metin maddesi ekleme |
| Bağımsız işe dönüştür | `Convert to independent Work` | Maddeyi aynı Projede tam İşe dönüştürme; onaydan önce yazılmaz |
| Dönüşümü onayla | `Confirm convert` | Dönüşüm önizlemesini onaylayıp yazma |
| Proje | `Project` | Dönüşüm önizlemesinde hedef Proje |
| Başlangıç durumu | `Start status` | Yeni İşin Proje varsayılanı; `Not Started` semantiği |
| Başka Projede yeniden oluştur | `Recreate in another Project` | Yanlış Projede oluşan İşten hedefte yeni kimlikli İş üretme; taşıma değildir |
| Başlık | `Title` | İş oluştururken zorunlu alan |
| Tür | `Type` | İş türü alanı |
| Anahtar | `Key` | Kullanıcıya dönük `{shortCode}-{n}` İş anahtarı |
| Türü değiştir | `Change type` | Feature dışı tür değişimi |
| Etki önizlemesi | `Impact preview` | Feature’a giriş veya çıkış önizlemesi |
| Kapsanan iş | `Included Work` | Özellik kapsamındaki bağımsız İşler; Feature hazır İş Bağlam Kartı bölümü de aynı etiketi kullanır |
| Kapsar | `Includes` | Özellikten kapsanan İşe birincil kapsam yazması |
| Kapsanır | `Included in` | İşin birincil Özellik kapsamı |
| Kapsam Ağacı | `Scope Tree` | Mevcut Proje → Özellik → Kapsanan işler ilişkisinin salt okunur görünümü; sürükleme kapsam yazmaz |
| İlgili | `Related` | İkinci kapsam sayımı üretmeyen standart ilişki |
| Yolunda | `On Track` | Özellik sağlığı işareti |
| Riskli | `At Risk` | Özellik sağlığı işareti |
| Yolunda değil | `Off Track` | Özellik sağlığı işareti |
| Özellik sağlığını kaydet | `Record Feature health` | Özellikte sağlık güncellemesi yazma |
| Ayır | `Detach` | Kapsanan İş, sağlık geçmişi veya Birincil spec’i Özellikten ayırma |
| Birincil spec | `Primary spec` | Özelliğe bağlı belge |
| Özellik sağlığı | `Feature health` | Yalnız Özellikte tutulan sağlık geçmişi |
| Tür değişimini onayla | `Confirm type change` | Feature etki önizlemesini onaylayan eylem |
| Feature çıkışı engelli | `Detach included Work, Feature health history, and Primary spec before leaving Feature.` | Kapsanan İş, sağlık geçmişi veya Birincil spec varken Feature’dan çıkışı durduran metin |
| İş yok | `No Work yet.` | Projede henüz İş olmadığını söyleyen boş durum |
| Kapanış kontrolü | `Closure check` | Kapatma adımında tamamlanmamış kontrol listesi veya aktif blokaj uyarısı; zorunlu kapı değildir |
| İşe dön | `Return to work` | Kapanış kontrolünden kapatmayı iptal eden eylem |
| Yine de kapat | `Close anyway` | Kapanış kontrolündeki uyarıya rağmen kapatmayı uygulayan eylem |
| Kalıcı bağlamı koru | `Keep lasting context` | Kapatma adımında Karar veya Kişisel Wiki oluşturma komutunu önizleyen isteğe bağlı bölüm |
| Yeniden aç | `Reopen` | Kapanmış İşi terminal olmayan duruma döndürme |
| Yeniden açmayı onayla | `Confirm reopen` | Yeniden açmayı onaylayan eylem |
| Gerekçe | `Reason` | Kapatma adımındaki isteğe bağlı gerekçe; `Cancel Handoff` için zorunlu iptal gerekçesi |
| Açıklamayı kapat | `Dismiss` | İlk açılış açıklamasını kapatan eylem |
| Herkese açık durum etiketi | `Public Status Label` | İş akışı durumunu değiştirmeyen, yalnız herkese açık Roadmap sunumunda kullanılan ziyaretçi etiketi |
| GitHub kimliğini yeniden teyit etme | `Confirm GitHub Identity` | Yüksek riskli işlem için yeni OAuth turunda aynı değişmez GitHub kimliğini doğrulayan fakat parola/MFA girişi iddia etmeyen güvenlik eylemi |
| GitHub bekleniyor | `Waiting for GitHub` | GitHub kesintisinde yeni giriş ve `Confirm GitHub Identity` için görünür bekleme durumu |
| Hesap menüsü | `Account menu` | Oturum açmış kurucunun Hesap ve oturum eylemlerini açan erişilebilir gezinme kontrolü |
| GitHub ile devam | `Continue with GitHub` | GitHub login OAuth ile Hesaba giriş eylemi |
| Oturumu kapat | `Sign Out` | Geçerli ürün oturumunu sonlandırma eylemi |
| Oturumlar | `Sessions` | Hesap kapsamındaki aktif ürün oturumlarını cihaz ve son etkinlikle listeleme yüzeyi |
| Oturum kullanılamıyor | `Session unavailable` | Geçici oturum servis hatasının hesabı oturumdan çıkarmadığını ve yeniden deneme gerektiğini bildiren durum |
| Hesap tercihleri | `Preferences` | Locale, saat dilimi, tarih biçimi, haftanın ilk günü ve Appearance yüzeyi |
| Locale | `Locale` | Tarih, saat ve sayı biçimini seçen Hesap tercihi; arayüz dili değildir |
| Saat dilimi | `Time zone` | Takvim gün sınırı, tarih girişi ve tarihsel gösterim dilimi |
| Tarih biçimi | `Date format` | Tarih yazımı; seçilmezse locale varsayılanını izler |
| Locale varsayılanı | `Locale default` | Tarih biçiminin locale yazımını izlediği seçenek |
| Haftanın ilk günü | `First day of week` | Hafta ızgarası ve hafta sınırının başladığı gün |
| Appearance | `Appearance` | Hesabın Light veya Dark okunabilirlik tercihi; tema sistemi değildir |
| Light | `Light` | Appearance değeri |
| Dark | `Dark` | Appearance değeri |
| Kaydet | `Save` | Hesap tercihini açıkça yazan eylem |
| Kaydediliyor | `Saving…` | Hesap tercihi yazılırken Save eyleminin geçici durum etiketi |
| Önerilen locale ve saat dilimini kullan | `Use suggested locale and time zone` | İlk girişte tarayıcı önerisini forma alan, kaydetmeden uygulamayan eylem |
| Tarayıcı önerisi | `Browser suggestion` | İlk girişte tarayıcının locale ve saat dilimi değerlerini kaydetmeden öneren yüzey |
| Önizleme | `Preview` | Locale, tarih biçimi ve haftanın ilk gününün gösterim sonucunu kaydetmeden gösteren yüzey |
| Kaydetmeden önce | `Before saving` | Önizlemenin Hesap tercihlerini yazmadan önceki sonucu gösterdiğini belirten yardımcı etiket |
| Tarih | `Date` | Önizlemede biçimlenmiş tarih |
| Örnek sayı | `Example number` | Locale’in sayı gösterimini anlatan önizleme örneği; bir Hesap tercihi değildir |
| Hafta | `Week` | Önizlemede haftanın ilk gününe göre kaymış gün başlıkları |
| Tarihsel olay | `Historical event` | Saklanmış anın Hesap saat dilimindeki gösterimi |
| İş başlığı | `Work title` | Locale’in çevirmediği kullanıcı içeriği örneği |
| Tercihler kaydedildi | `Preferences saved.` | Hesap tercihinin açık Save ile yazıldığını bildiren sistem mesajı |
| Tercihler yükleniyor | `Loading preferences…` | Hesap tercihinin okunmakta olduğunu bildiren durum |
| Tercihler kullanılamıyor | `Preferences are unavailable.` | Hesap tercihinin okunamadığını bildiren durum |
| Tercihler kaydedilemedi | `Preferences could not be saved.` | Hesap tercihi yazılamadığında gösterilen hata durumu |
| Bağlantı kesildi | `Disconnected` | Online-only çalışmada tercih yazısının geçici olarak kullanılamadığını bildiren durum |
| Yeniden bağlanarak kaydet | `Reconnect to save.` | Bağlantı geri gelmeden tercih kaydının yapılamayacağını bildiren metin |
| Son başarılı kaydetme | `Last successful save` | Hesap tercihinin en son başarılı yazıldığı zamanı gösteren durum |
| Kaydedilmemiş risk | `Unsaved risk` | Bağlantı yokken sayfadan ayrılmanın değişiklikleri kaybettirebileceğini bildiren durum |
| Hiçbir zaman | `Never` | Hesap tercihinin henüz başarılı biçimde kaydedilmediğini bildiren değer |
| Tekrar kaydetmeyi dene | `Try Save again.` | Başarısız tercih yazısından sonra yeniden denemeyi öneren metin |
| Cihaz | `Device` | Ürün oturumunun tanındığı istemci türü |
| Son etkinlik | `Last activity` | Ürün oturumunun en son kullanıldığı zaman |
| Geçerli oturum | `Current` | Listelenen satırın bu tarayıcıdaki ürün oturumu olduğunu gösteren durum |
| Oturumu iptal et | `Revoke Session` | Tek bir ürün oturumunu derhal yetkisiz bırakma eylemi |
| Diğer oturumları iptal et | `Revoke Other Sessions` | Geçerli oturum dışındaki bütün ürün oturumlarını derhal yetkisiz bırakma eylemi |
| Kullanıcı başlatmalı İş başarısı | `User-initiated Work Success` | Kullanıcının açık kapatma eylemiyle başlattığı ve sunucuda PRD terimi `Tamamlandı` (`UI: Completed`) kapanış sonucu olarak kesinleşen İş geçişi; otomatik kapanış ve başka terminal olaylar değildir |
| Bitiriş efekti | `Completion effects` | Kullanıcı başlatmalı İş başarısı için isteğe bağlı, Hesap düzeyinde etkinleştirilen özgün birinci taraf dekoratif katalog |
| Deneysel | `Experimental` | Bitiriş efektinin ilk üründe açıkça etkinleştirilen kişisel geri bildirim olduğunu gösteren durum |
| Etkinleştir | `Enable` | Bitiriş efektini Hesap düzeyinde açan denetim |
| Tema | `Theme` | Kapalı Bitiriş efekti arşetipi |
| Palet | `Palette` | Seçili temanın dört hazır renk/hareket düzeninden biri |
| Calm | `Calm` | Sakin varsayılan Bitiriş efekti teması |
| Weave | `Weave` | Soyut bağ/örgü Bitiriş efekti teması |
| Arc | `Arc` | Işık/ark Bitiriş efekti teması |
| Nova | `Nova` | Kozmik enerji Bitiriş efekti teması |
| Haze | `Haze` | Calm paleti |
| Pebble | `Pebble` | Calm paleti |
| Linen | `Linen` | Calm paleti |
| Moss | `Moss` | Calm paleti |
| Loom | `Loom` | Weave paleti |
| Cord | `Cord` | Weave paleti |
| Lattice | `Lattice` | Weave paleti |
| Knot | `Knot` | Weave paleti |
| Gleam | `Gleam` | Arc paleti |
| Trace | `Trace` | Arc paleti |
| Halo | `Halo` | Arc paleti |
| Span | `Span` | Arc paleti |
| Ember | `Ember` | Nova paleti |
| Pulse | `Pulse` | Nova paleti |
| Orbit | `Orbit` | Nova paleti |
| Flare | `Flare` | Nova paleti |
| Bitiriş efektleri kaydedildi | `Completion effects saved.` | Bitiriş efekti tercihinin yazıldığını bildiren sistem mesajı |
| Bitiriş efektleri yükleniyor | `Loading completion effects…` | Bitiriş efekti tercihinin okunmakta olduğunu bildiren durum |
| Bitiriş efektleri kullanılamıyor | `Completion effects are unavailable.` | Bitiriş efekti tercihinin okunamadığını bildiren durum |
| Köken konumu | `Origin Location` | Sahipli bileşenden üretilen kaydın kesin kaynak öğe işaretidir; bağımsız ilişki ucu değildir |
| İşaretleme katmanı | `Marking layer` | Kesin Dosya Eki sürümüne bağlı, özgün dosyadan ayrı geri alınabilir görsel not |
| Kaynak görsel | `Source visual` | Paylaşım/yayın önizlemesinde işaretlemeden ayrı onaylanan görsel öğe |
| İşaretlenen kaynak konumu | `Marked source location` | Dosya Eki sürümünde seçilen Nokta veya Bölgenin görsel köken işareti |
| İşaretleme kaydedilemedi | `Marking could not be saved. Try again.` | Görsel işaretleme yazımı başarısız olduğunda yeniden denemeyi bildiren hata |
| İşaretleme geri alınamadı | `Marking could not be undone. Try again.` | Görsel işaretleme geri alımı başarısız olduğunda yeniden denemeyi bildiren hata |
| Kalem | `Pen` | İşaretleme katmanı aracı |
| Vurgulayıcı | `Highlighter` | İşaretleme katmanı aracı |
| Ok | `Arrow` | İşaretleme katmanı aracı |
| Dikdörtgen | `Rectangle` | İşaretleme katmanı aracı |
| Köken olarak bağla | `Bind as origin` | Seçilen nokta veya bölgeyi İşe Köken konumu olarak bağlama |
| Nokta | `Point` | Görsel veya PDF üzerinde tek konum seçimi |
| Bölge | `Region` | Görsel veya PDF üzerinde dikdörtgen konum seçimi |
| Yeni İş | `New Work` | Köken konumunu yeni tam İşe bağlama |
| Mevcut İş | `Existing Work` | Köken konumunu var olan tam İşe bağlama |
| Onayla | `Confirm` | Köken konumu önizlemesini uygulayan eylem |
| Proje alanı | `Project ID` | Yeni İş köken bağında hedef Projeyi belirleyen doğrulanmış alan |
| İş alanı | `Work ID` | Mevcut İş köken bağında hedef İş kaydını belirleyen alan |
| Sayfa | `Page` | PDF köken konumunun veya işaretlemesinin pozitif sayfa numarası |
| X koordinatı | `X (0–1)` | Nokta veya bölge için yatay normalize konum alanı |
| Y koordinatı | `Y (0–1)` | Nokta veya bölge için dikey normalize konum alanı |
| Genişlik | `Width (0–1)` | Bölge seçiminin normalize genişliği |
| Yükseklik | `Height (0–1)` | Bölge seçiminin normalize yüksekliği |
| Konum önizlemesi kullanılamıyor | `Location preview is unavailable.` | Köken konumu bağ önizlemesinin üretilemediğini bildiren hata |
| Köken olarak bağlama başarısız | `Bind as origin could not be completed.` | Önizlemeli İş köken bağının kesinleştirilemediğini bildiren hata |
| Yeni İş için Proje gerekli | `A Project is required for a new Work.` | Yeni İş köken bağında hedef Projenin zorunlu olduğunu bildiren doğrulama |
| Konum seçimi yönergesi | `Click a Point or drag a Region on the preview, then click Preview.` | Önizleme yüzeyinde nokta veya bölge seçimini açıklayan yönerge |
| Köken bağı incelemesi | `Review the selected Point or Region, then confirm the Work bind.` | Onaydan önce seçili köken konumu ve İş hedefini gözden geçirme yönergesi |
| Hedefe katkı | `Contributes to Goal` | İş, Kilometre Taşı veya Proje Sürümünün Proje Hedefine türlenmiş katkı ilişkisidir |
| Hedef kapsamında | `In Goal` | Hedefe katkı ilişkisinin Proje Hedefi ucu |
| Çalışma Alanı çıkış paketi | `Workspace Exit Package` | Kullanıcı parolasıyla şifrelenmiş tam Çalışma Alanı arşividir; ürün içi restore değildir |
| Destek referansı | `Support reference` | Başarısız ana akışta secret veya özel içerik taşımayan sunucu takip kimliği |
| Destek referansı kullanılamıyor | `Support reference unavailable.` | Sunucuya ulaşılamayan başarısız ana akışta destek referansının üretilemediğini bildirir |
| Cantiara'ya ulaşılamıyor | `Cantiara couldn’t be reached.` | Korunan rota oturum kontrolünde sunucuya ulaşılamadığını bildirir ve yeniden deneme sunar |
| Oturum kontrol edilemiyor | `Cantiara couldn’t check your session.` | Korunan rota oturum kontrolünde sunucunun hata yanıtı verdiğini bildirir ve yeniden deneme sunar |
| Güncelleme gerekli | `Update required` | Süre dışı imzalı masaüstü API sözleşmesinde güvenli olmayan yazmadan önce duran hata |
| Yeniden dene | `Retry` | Başarısız ana akışta güvenli yeniden deneme eylemi |
| Çatışma | `Conflict` | Aynı idempotency veya teslim kimliğinin farklı payload taşıması |
| İptal | `Cancel` | Yalnız commit bariyerinden önceki hazırlama iptali |
| Sonlandırılıyor | `Finalizing` | Commit bariyerinden sonra iptalin uygulanmadığı durum |
| Güncel değer | `Current value` | Güncel olmayan taban revizyonunda reddedilen yazmanın gösterdiği mevcut kayıt değeri |
| Revizyon | `Revision` | Hedef kaydın Kayıt geçmişindeki güncel değişiklik sırası; Mutation Contract yazmasının taban güncelliği bu değerle karşılaştırılır |
| Güvenli geri alma | `Undo` | Tersi deterministik hesaplanan alan, ilişki, görünüm üstverisi veya atomik dönüşümde ilgisiz sonraki değişikliği sarmadan uygulanan geri alma; aynı alandaki yeni değer `Conflict` üretir, kalıcı silme, güvenlik redaksiyonu, dış sistem mutasyonu ve yayınlanmış statik export geri alınmaz |
| Kullanıcı | `User` | Kayıt geçmişine yazılan insan aktör türü |
| Sistem otomasyonu | `System automation` | Kayıt geçmişine yazılan otomasyon aktör türü |
| Yetkili entegrasyon | `Authorized integration` | Kayıt geçmişine yazılan entegrasyon aktör türü |
| Veri yazıldı | `Data was written.` | Başarısız ana akışta yazmanın tamamlandığını bildirir |
| Veri yazılmadı | `Data was not written.` | Başarısız ana akışta yazmanın yapılmadığını bildirir |
| Yazma sonucu bilinmiyor | `Data write outcome is unknown.` | Başarısız ana akışta yazmanın sonucunun güvenle belirlenemediğini bildirir |
| Bir kez yeniden deneyebilirsin | `You can retry once.` | Yazılmamış başarısız akışın güvenli yeniden deneme sınırı |
| Yeniden deneme | `Do not retry.` | Yazılmış başarısız akışta yeniden denemenin güvensiz olduğunu bildirir |
| Bu eylem tamamlanamadı | `This action could not be completed.` | Secret taşıyan veya beklenmeyen hatanın kullanıcıya gösterilen nedeni |
| Yakalama Gelen Kutusu | `Capture Inbox` | Kaydedilmiş fakat henüz kalıcı kayda dönüşmemiş geçici girdi yüzeyi; ana kayıt, Taslak veya kaydedilmiş bookmark değildir |
| Yakalama kütüphanesi | `Capture Library` | Workspace ve Project Capture Inbox öğelerini tek listede gösteren yüzey; yeni yakalama formu modal olarak açılır ve ayrı bir kayıt türü değildir |
| Çalışma alanı Yakalama Gelen Kutusu | `Workspace Capture Inbox` | Proje bilinmediğinde geçici yakalamaların durduğu Inbox |
| Workspace Capture Inbox’a kaydet | `Leave empty to save to the Workspace Capture Inbox.` | Project alanı boşken Save’in Workspace Capture Inbox’a yazacağını söyleyen metin |
| Proje Yakalama Gelen Kutusu | `Project Capture Inbox` | Proje bilindiğinde o projenin geçici yakalamalarının durduğu Inbox |
| Bu Inbox’ta yakalama yok | `No captures in this Inbox.` | Boş Workspace veya Proje Yakalama Gelen Kutusu |
| Özgün yakalama | `Original capture` | Dönüşüm veya bağlama önizlemesinde tüketilecek Yakalama Gelen Kutusu öğesinin özgün metin, bağlantı, ek, zaman ve köken görünümü |
| Work dönüşümü için Project | `Work conversion requires a Project.` | Çalışma alanı Yakalama Gelen Kutusu öğesinin Work olarak dönüştürülmesi için hedef Project seçilmesi gerektiğini bildiren metin |
| Dönüşüm önizlemesi | `Conversion Preview` | Yakalama öğesinin tek yeni ana kayda dönüşmeden önce özgün içeriği ve önerilen kaydı karşılaştıran görünüm |
| Önerilen kayıt | `Proposed record` | Dönüşüm önizlemesinde seçilen kayıt türü, başlık, alanlar ve kapsamla gösterilen henüz yazılmamış ana kayıt |
| Alan eşlemeleri | `Field mappings` | Yakalama mini şablonu alanlarının önerilen kayda taşınacak ad ve değer karşılıkları |
| Hedef kapsam | `Target scope` | Dönüşümün yeni kaydı hangi Workspace veya Project kapsamında açacağını gösteren önizleme bilgisi |
| Bağlama önizlemesi | `Attach Preview` | Yakalamanın mevcut kayda Origin veya Evidence olarak yazılmadan önce hedef ve ilişkiyi gösteren görünüm |
| İlişki önizlemesi | `Relation preview` | Mevcut kayda yazılacak ilişkinin türünü ve hedef kimliğini onaydan önce gösteren görünüm |
| Yalnız bu birleştirme | `Only this merge` | Geri alma önizlemesinde hedeften yalnız mevcut birleştirmenin yazdığı bağ ve alanları kaldırma kapsamı |
| Cross-Project bind | `Cross-Project bind` | Yakalama ile hedefin farklı Project kapsamında olduğu ve açık hedef kapsamı onayı gerektiren bağlama |
| Öneriler | `Suggestions` | Benzer ana kayıtları bağlama yapmadan önce dayanaklarıyla sunan isteğe bağlı görünüm |
| Aynı Proje | `Same Project` | Önerilerde yakalamanın Project kapsamıyla eşleşen birincil grup |
| Dayanak | `Basis` | Bir benzer kayıt önerisinin hangi içerik veya bağlam karşılaştırmasına dayandığını açıklayan görünür bilgi |
| Önerileri göster | `Show suggestions` | Yakalama için benzer kayıt önerilerini ve görünür dayanaklarını isteme eylemi |
| Hedefi kullan | `Use target` | Seçilen önerinin kimliğini bağlama önizlemesindeki mevcut kayıt hedefine aktarma eylemi |
| Create Bug kullanılabilirliği | `Create Bug is available when Project is set and type is Bug Capture.` | Create Bug’un yalnız Proje ve Bug Capture (veya tür belirtilmemiş) iken açık olduğunu söyleyen metin |
| Create Bug Inbox’ta kalmaz | `Create Bug does not stay in the Capture Inbox. A Work record is not stored yet.` | Create Bug’un Gelen Kutusu öğesi bırakmadığını ve İş kaydının henüz saklanmadığını söyleyen metin |
| Bug oluştur | `Create Bug` | Proje ve tür kesin olduğunda doğrudan İş oluşturma eylemi; Yakalama Gelen Kutusu öğesi bırakmaz |
| Bug yakalama | `Bug Capture` | `Observed Behavior`, `Expected Behavior` ve `Reproduction Context` yönlendirici alanlarıyla Inbox öğesini biçimlendiren kapalı mini şablon; alanlar isteğe bağlıdır ve ana kayıt oluşturmaz |
| Gözlenen davranış | `Observed Behavior` | Bug Capture yönlendirici alanı |
| Beklenen davranış | `Expected Behavior` | Bug Capture yönlendirici alanı |
| Yeniden üretim bağlamı | `Reproduction Context` | Bug Capture yönlendirici alanı |
| Geri bildirim yakalama | `Feedback Capture` | `Feedback`, `Channel` ve isteğe bağlı `Contact` yönlendirici alanlarıyla Inbox öğesini biçimlendiren kapalı mini şablon; Contact ana kaydı oluşturmaz |
| Geri Bildirim | `Feedback` | Özgün mesajı, kanalı ve zamanı koruyan uzman ana kayıt; Kaynak alt türü değildir |
| Geri Bildirim yaşamı | `New`, `Reviewed`, `Archived` | Geri Bildirim durumları; ilişkili İş durumunu, önceliğini veya planlama üyeliğini yazmaz |
| Geri Bildirim oluştur | `Create Feedback` | Özgün mesaj, kanal ve zamanla Geri Bildirim açma |
| Mevcut kaynaktan oluştur | `Create from Source` | Mevcut Kaynaktan köken kopyalayarak Geri Bildirim açma; Kaynak alt türü yapmaz |
| İsteğe bağlı İletişim | `Contact (optional)` | Geri Bildirimde yalnız mevcut Contact seçilir; seçilmezse `Unknown` kalır ve Contact oluşturulmaz |
| İsteğe bağlı Kuruluş | `Company (optional)` | Geri Bildirimde yalnız mevcut Company seçilir; kimlik zorunlu değildir |
| Köken görünümü | `Origin of` | Geri Bildirim kaydında, kökeni olduğu İşleri listeleyen başlık; sayı, oy veya öncelik değildir |
| Hedef Proje | `Target Project` | Geri Bildirimden İş dönüşümünün hedefi; Geri Bildirimin kendi Projesidir |
| Özgün mesaj | `Original message` | Geri Bildirimin asıl metni; özet bunun yerine geçmez |
| Geri Bildirim zamanı | `Occurred at` | Özgün mesajın zamanı |
| Geri Bildirim bağlantısı | `Link` | İsteğe bağlı URL |
| Geri Bildirim ekleri | `Attachments` | İsteğe bağlı ekler |
| Geri Bildirim yok | `No Feedback yet.` | Henüz Geri Bildirim açılmamış boş durum |
| Geri Bildirim ve Kaynak Feed'i | `Feed` | Aynı Geri Bildirim ve uzun gövdeli Kaynak ana kayıtlarının yoğun okuma görünümü; ikinci kayıt, sosyal gönderi veya Bildirim Merkezi değildir |
| Feed yok | `No Feed records yet.` | Feed'de gösterilecek Geri Bildirim veya uzun gövdeli Kaynak olmadığında boş durum |
| İşe dönüştür | `Convert to Work` | Geri Bildirimi önizleyerek tam olarak bir İşe dönüştürme; kayıt silinmez veya arşivlenmez |
| Geri Bildirim Contact | `Contact` | Geri Bildirimdeki isteğe bağlı katılımcı; bilinmeyen gönderende zorunlu değildir |
| Geri Bildirim Company | `Company` | Geri Bildirimdeki isteğe bağlı kuruluş bağlamı |
| Kanıt niteliği | `Evidence quality` | İş–Geri Bildirim kanıt bağındaki isteğe bağlı bağlam; özgün mesajın yerine geçmez |
| Bildirilen problem | `Reported problem` | Kanıt niteliği alanı |
| Önerilen çözüm | `Suggested solution` | Kanıt niteliği alanı |
| Mevcut workaround | `Current workaround` | Kanıt niteliği alanı |
| Etki şiddeti | `Impact severity` | Kanıt niteliği alanı; kaynakta yoksa kurucu yorumudur |
| Kullanım sıklığı | `Usage frequency` | Kanıt niteliği alanı; kaynakta yoksa kurucu yorumudur |
| Bağımsızlık | `Independence` | Kanıt niteliği alanı; kaynakta yoksa kurucu yorumudur |
| Hedef profil uyumu | `Audience fit` | Kanıt niteliği alanı; kaynakta yoksa kurucu yorumudur |
| Bilinmiyor | `Unknown` | Kanıt niteliği alanında boş olmayan belirsiz değer; ilişkiyi engellemez |
| Kurucu yorumu | `Founder interpretation` | Kaynakta söylenmeyen niteliğin yazar ve zaman etiketli yorumu |
| Geri dönülecek | `Follow up` | Yalnız İş–Geri Bildirim kanıt bağındaki takip niyeti |
| Geri dönüldü | `Followed up` | Yalnız o kanıt bağındaki takip niyeti |
| Sonuç doğrulandı | `Outcome verified` | Yalnız o kanıt bağındaki takip niyeti |
| Takip niyeti alanı | `Follow-up` | İş–Geri Bildirim kanıt bağında `Follow up` / `Followed up` / `Outcome verified` seçen isteğe bağlı alan; boş bırakılabilir |
| Kanıt niteliğini kaydet | `Save Evidence quality` | İş–Geri Bildirim bağındaki nitelik, rol ve takip niyetini yalnız o bağa yazar |
| Kanıt olarak bağla | `Bind as evidence to existing record` | Geri Bildirimi mevcut İşe kanıt olarak bağlama; Kanıt Akışı değildir |
| İletişim (yakalama alanı) | `Contact` | Feedback Capture isteğe bağlı yönlendirici alanı; Contact ana kaydı oluşturmaz |
| Geri bildirim (yakalama alanı) | `Feedback` | Feedback Capture yönlendirici alanı |
| Kanal | `Channel` | Feedback Capture yönlendirici alanı |
| Araştırma parçası | `Research Fragment` | `Note or Excerpt` ve `Source Context` yönlendirici alanlarıyla Inbox öğesini biçimlendiren kapalı mini şablon |
| Not veya alıntı | `Note or Excerpt` | Research Fragment yönlendirici alanı |
| Kaynak bağlamı | `Source Context` | Research Fragment yönlendirici alanı |
| Dönüştür | `Convert` | Yakalama Gelen Kutusu öğesini tek yeni ana kayda dönüştürme çıkışı |
| Mevcut kayda bağla | `Attach to existing` | Öğeyi mevcut ana kayda köken veya kanıt olarak bağlama/birleştirme çıkışı |
| Yakalama silme çıkışı | `Delete` | Yakalama Gelen Kutusu öğesini tüketen silme çıkışı |
| Toplu Anlamlandırma | `Bulk sense-making` | Birden fazla yakalamayı yan yana getiren, geçici küme adı ve yerleşimini görünüm üstverisi olarak tutan isteğe bağlı triage görünümü; küme ana kayıt, etiket veya ilişki değildir |
| Gruplanmamış | `Ungrouped` | Toplu Anlamlandırmada henüz adlandırılmış bir görsel kümede durmayan yakalamaların sütun başlığı ve yerleşim seçimi |
| Yeni küme adı | `New cluster name` | Toplu Anlamlandırmada geçici görsel küme oluştururken kullanılan alan etiketi |
| Küme adlandır | `Name a cluster` | Yeni geçici görsel kümeye ad vermek için kullanılan alan yer tutucusu |
| Küme ekle | `Add cluster` | Toplu Anlamlandırma görünümüne geçici görsel küme ekleyen eylem |
| Sütunu sola taşı | `Move left` | Geçici görsel kümenin görünüm konumunu bir sütun sola alan eylem |
| Sütunu sağa taşı | `Move right` | Geçici görsel kümenin görünüm konumunu bir sütun sağa alan eylem |
| Düzen kaydediliyor | `Saving layout…` | Toplu Anlamlandırma ad ve yerleşim üstverisinin sunucuya yazıldığını belirten durum |
| Sıralı triage | `Sequential triage` | Yakalama Gelen Kutusunda tek öğeye odaklanan isteğe bağlı mod; yalnız üç açık çıkıştan biri çözülünce ilerler |
| Diğer Projeler | `Other Projects` | Başka Projelerdeki benzer kayıt önerilerinin adlı ikincil grubu |
| Yakalama köken bağı | `Origin` | Yakalamayı mevcut kayda köken olarak bağlayan ilişki |
| Yakalama kanıt bağı | `Evidence` | Yakalamayı mevcut kayda kanıt olarak bağlayan ilişki |
| Web Yakalama | `Web Capture` | Tarayıcı uzantısından açık eylemle Gelen Kutusuna giden clip; ana kayıt değildir |
| URL yakala | `Capture URL` | Etkin sekmenin URL’sini önizlemeli Web Yakalama olarak seçme eylemi |
| Seçili metni yakala | `Capture selected text` | Kullanıcının etkin sekmede seçtiği metni Web Yakalama içeriği olarak seçme eylemi |
| Seçili görseli yakala | `Capture selected image` | Kullanıcının etkin sekmede seçtiği görsel bağlantısını Web Yakalama olarak seçme eylemi |
| Ekran görüntüsü yakala | `Capture screenshot` | Kullanıcı tarafından başlatılan etkin sekme ekran görüntüsünü Web Yakalama eki olarak seçme eylemi |
| Uzantı bağlantıları | `Extension links` | Hesap güvenlik ekranındaki eşlenmiş tarayıcı uzantısı listesi |
| Eşleme kodu | `Pairing code` | Beş dakika geçerli tek kullanımlık uzantı bağlantı kodu |
| Eşleme kodu üret | `Generate pairing code` | Uygulama içinde tek kullanımlık eşleme kodu üreten eylem |
| Eşleme kodu süresi | `This pairing code expires in five minutes and can be used once.` | Eşleme kodunun beş dakika ve tek kullanımlık olduğunu söyleyen metin |
| Köken URL | `Origin URL` | Web Yakalama gönderim önizlemesindeki sayfa adresi |
| Hedef Inbox | `Target Inbox` | Web Yakalama gönderiminin gideceği Workspace veya Project Capture Inbox |
| Inbox ara | `Search Inbox` | Yetkili Project Inbox’ları ada göre arama; yalnız son açılanlarla sınırlı değildir |
| Gönder | `Send` | Önizlenen Web Yakalama’yı Gelen Kutusuna yazma eylemi |
| Eşle | `Pair` | Uzantının eşleme kodunu kullanarak bağlanma eylemi |
| Bu tarayıcıyı eşle | `Pair this browser` | Eşleme kodunu bu tarayıcı uzantısına uygulama yüzeyi |
| Gelen Kutusuna gönderildi | `Sent to Capture Inbox.` | Web Yakalama gönderiminin Inbox öğesi yazdığını bildiren durum |
| Desteklenmeyen tarayıcı | `This browser cannot pair with Web Capture.` | Chromium ailesi ve Firefox dışındaki tarayıcıda eşlemeyi reddeden metin |
| Son başarılı kayıt | `Last successful save` | Uzantıda son başarılı gönderimin zamanı |
| Tarayıcı | `Browser` | Uzantı bağlantısı listesindeki tarayıcı adı |
| Son kullanım | `Last use` | Uzantı bağlantısının son yazma zamanı |
| Uzantı bağlantısını iptal et | `Revoke` | Tek bir uzantı bağlantısını iptal etme eylemi |
| Belge | `Document` | Markdown Belgesi dönüşüm hedefi |
| Belge sürümü | `Version` | Belgenin veritabanındaki uygulama değişikliği; Git commit değildir |
| Spec değişikliği inceleme kuyruğu | `Spec Change Review` | Özelliğin Birincil spec Belge sürüm çiftinin inceleme kuyruğu; spec gövdesi, Git diff veya dış review aracı değildir |
| Belge düzeyinde aday | `Document-level candidate` | Kesin bölüm bağı olmayan Spec Change Review adayı; belirli bir metin değişikliğine yorulmaz |
| Aday nedeni (Spec Change Review) | `Why` | Adayın kayıtlı bağ türü: `Primary spec`, `Stable section reference`, `Inline reference`, `Live content use`, `Version-pinned evidence`, `Explicit relation`; benzerlik veya AI nedeni yoktur |
| Bekliyor (Spec Change Review) | `Waiting` | Spec Change Review adayının bu sürüm çiftindeki inceleme üstverisi; İş akışı durumu veya Geri Bildirim `İncelendi` değildir |
| Gözden geçirildi (Spec Change Review) | `Reviewed` | Spec Change Review adayının bu sürüm çiftindeki inceleme üstverisi; Geri Bildirim `İncelendi` veya İş durumu değildir |
| Etkilenmedi (Spec Change Review) | `Not affected` | Spec Change Review adayının bu sürüm çiftindeki inceleme üstverisi; hedef kaydı yazmaz |
| Takip işi oluştur (Spec Change Review) | `Create Follow-up Work` | Spec Change Review adayında önizlemeli tek İş oluşturma; inceleme sonucunu kapatmaz |
| Başlangıç durumu (Spec Change Review takip İşi) | `Starting status` | Takip İşi önizlemesinde yeni İşin açılacağı İş akışı durumu |
| Değişen spec sürümleri | `Changed spec versions` | Takip İşi önizlemesinde Birincil spec Belgesinin önceki ve yeni sürümü; İş bu sürümlere `Köken konumu` ile bağlanır |
| Karşılaştır | `Compare` | İki Belge sürümünün gövde farkını gösterme |
| Geri yükle | `Restore` | Seçilen Belge sürümünü yeni uç olarak yazma; geçmişi silmez |
| Canlı İş bloğu | `Live Work block` | Belgeye gömülen, kaynak İş kimliğini kopyasız izleyen eyleme açık kart |
| Canlı koleksiyon görünümü | `Smart Collection · Named view` | Belgedeki kaynak adlandırılmış görünümün salt okunur canlı bloğu |
| Durumu değiştir | `Change status` | Canlı İş bloğunda olağan İş durum yazması |
| Kapat | `Close` | Canlı İş bloğunda olağan İş kapanışı |
| Kaynak kaydı aç | `Open source record` | Canlı gömmenin kaynak kaydını açma |
| Salt okunur canlı içerik bölümü | `Read-only live section` | Kararlı bölüm kimliğini izleyen kopyasız gömme |
| Sürüme sabitlenmiş metin parçası kanıtı | `Version-pinned evidence` | Kesin Belge sürümündeki metin parçasının Kanıt bağı; canlı bölüm değildir |
| Toplu dönüştür | `Convert in bulk` | Liste satırlarından atomik İş dönüşümü |
| Kayda dönüştür | `Convert to record` | Seçili metinden tam bir kayıt üretme |
| Teknik Diyagrama dönüştür | `Convert to Technical Diagram` | Fenced Mermaid’den İçe aktarılmış bağımsız kopya |
| Bağımsız Mermaid bloğu | `Original Mermaid block stays independent.` | Dönüşüm önizlemesinde kaynak bloğun Belge içinde korunacağını bildirir |
| İçe aktarılmış bağımsız kopya | `Imported Independent Copy` | Mermaid dönüşümünün 59’da oluşan kanonik diyagram kopyası |
| Dosya Eki | `File Attachment` | Dosya Eki dönüşüm hedefi |
| Dosya seç | `Choose file` | Dosya Eki yükleme denetiminin görünür dosya seçme eylemi |
| Dosya seçilmedi | `No file selected` | Dosya Eki yükleme denetiminde henüz dosya seçilmediğini söyleyen durum |
| Dosya Eki seç | `Select a File Attachment` | Gallery listesinde henüz bir Dosya Eki seçilmediğinde önizleme boş durumu |
| Sürümler | `Versions` | Seçili Dosya Ekinin sürüm zinciri başlığı |
| Önizlemeyi yeniden dene | `Retry preview` | İşlenemeyen bir Dosya Eki önizlemesini aynı güvenli sınır içinde yeniden isteme eylemi |
| Oynatma hızı | `Playback speed` | Ses veya video önizlemesinde kullanıcı tarafından seçilen oynatma hızı |
| Tam ekran | `Fullscreen` | Ses veya video önizlemesini tam ekran yüzeyine alma eylemi |
| Döngü | `Loop` | Ses veya video oynatmasını kullanıcı seçimine göre tekrarlama denetimi |
| Altyazılar | `Captions` | Ses veya video önizlemesinin erişilebilir altyazı kanalı |
| Yakalama eki | `Capture attachment` | Yalnız Yakalama Gelen Kutusu öğesine ait şifreli staging nesnesi; Dosya Eki veya paylaşılmış medya kütüphanesi değildir |
| Taslak | `Draft` | Henüz kaydedilmemiş ayrıntılı İş formu; ana kayıt, Yakalama Gelen Kutusu öğesi veya Belge taslağı değildir |
| Taslaklar | `Drafts` | Kişisel Taslakların sürdürüldüğü veya silindiği yüzey |
| Son kayıt | `Last saved` | Son başarılı otomatik kayıt zamanı; Client Shell online-only kromu |
| Yazılmamış risk | `Unsaved changes may be lost` | Henüz sunucuya yazılmamış değişiklik uyarısı; yalnız unsaved-risk bayrağı varken |
| Komut Paleti | `Command Palette` | Kurucu yüzeylerinde klavyeyle komut, gezinme, kayıt oluşturma ve Proje geçişi çalıştıran yüzey; Evrensel Arama (`Search`) değildir |
| Yetkili ürün komutu çalıştır | `Run an authorized product command.` | Komut Paleti başlığının, yüzeyin yalnız yetkili ürün komutlarını çalıştırdığını açıklayan kısa amacı |
| Komutları süz | `Filter Command Palette commands` | Komut Paleti girişinin komut ve yetkili kayıtları süzen erişilebilir etiketi |
| Komutlar | `Commands` | Kayıt olmayan gezinme ve ürün komutlarının Komut Paletindeki grubu |
| Yetkili kayıtlar | `Authorized records` | Kurucunun erişebildiği ana kayıtların Komut Paletindeki grubu |
| Hedef | `Target` | Komutun çalıştıracağı kayıt, tür veya bağlamı gösteren önizleme alanı |
| Seçim | `Selection` | Komutun etkileyeceği kayıt sayısını gösteren önizleme alanı |
| Menü karşılığı | `Menu:` | Komutun görünür ürün menüsündeki karşılığını belirten önizleme etiketi |
| Komut listesi | `Command Palette commands` | Komut Paletindeki erişilebilir liste etiketi |
| Komutlara dön | `Back to commands` | Komut hedefi alt listesinden üst komut listesine dönen eylem |
| Hedef seç | `Choose a target` | Birden fazla Proje veya kayıt türü arasından seçim isteyen alt liste başlığı |
| Komut veya yetkili kayıt yaz | `Type a command or authorized record…` | Boş Komut Paleti girişinin komut ya da yetkili kayıt yazma yönlendirmesi |
| Evrensel Arama | `Search` | Yetkili ana kayıtları deterministik tam metin sırası ve görünür eşleşme bağlamıyla bulan yüzey; Komut Paleti veya ana navigasyon sayfası değildir |
| Evrensel Arama kısayolu | `Ctrl+/` | Evrensel Arama’yı bulunduğu yerde açan sabit kısayol; `Ctrl+K` Komut Paleti’nindir |
| Sorgu | `Query` | Evrensel Arama metin alanı |
| Arşivi dahil et | `Include archived` | Arşivlenmiş kayıtları sonuçlara katan açık arşiv filtresi; varsayılan sıra arşivi dışlar |
| eşleşme | `matches` | Aynı kayıt içindeki eşleşme sayısı |
| Yetkili kayıt ara | `Type to search authorized records.` | Boş sorgu yönlendirmesi |
| Eşleşen kayıt yok | `No matching records.` | Süzgecin yetkili sonuç döndürmediği durum |
| Arama kullanılamıyor | `Search is unavailable.` | Arama yüzeyinin yüklenemediği durum |
| Tablo Görünümü | `Table` | Tek kayıt türü üzerinde mevcut ana kayıt sahibinin izinli alanlarını sıralama, süzme, düzenleme ve çok satırlı yapıştırma yüzeyi |
| Satırları süz | `Filter rows` | Yalnızca geçerli Table satırlarını geçici metin süzgeciyle daraltma |
| Satır yapıştır | `Paste rows` | Başlık ve veri satırlarından oluşan sekmeyle ayrılmış çok satırlı giriş alanı |
| Yapıştırmayı önizle | `Preview paste` | Sütun eşlemesi ve satır sonuçlarını herhangi bir kayıt yazmadan inceleme |
| Sütun eşlemesi | `Column mapping` | Yapıştırılan her sütunu aynı tür Table alanına veya atlama seçeneğine bağlama |
| Sütunu atla | `Skip column` | Yapıştırılan sütunu yazmalardan çıkarma |
| Kayıt kimliği | `Record ID` | Mevcut satırı güncellemek için kullanılan ana kayıt kimliği; yeni kayıt oluşturmaz |
| Yapıştırmayı gözden geçir | `Review paste` | Eşlenen satırları, doğrulama hatalarını ve dahil edilme durumunu yazma öncesi inceleme |
| Satırı düzelt | `Correct row` | Hatalı yapıştırma satırını açıkça düzeltme denetimi |
| Satırı dışla | `Exclude row` | Yapıştırma uygulanırken satırı atlama |
| Satırı dahil et | `Include row` | Önceden dışlanan satırı yapıştırma kapsamına döndürme |
| Değişiklikleri uygula | `Apply changes` | Önizlemedeki geçerli ve dahil edilen satırları tek atomik, idempotent yazma olarak uygulama |
| Değer seç | `Select a value` | Seçenekli düzeltme alanında geçerli değere geçmeden önceki boş seçenek |
| Satır numarası | `Row <n>` | Yapıştırma önizlemesinde kaynağın sırasını koruyan satır göstergesi |
| Kayıt oluşturma eylemi | `Create` | Yapıştırma önizlemesinde yeni ana kayıt satırını belirtir |
| Kayıt güncelleme eylemi | `Update` | Yapıştırma önizlemesinde mevcut ana kayıt satırını belirtir |
| Planlanan başlangıç tarihi | `Planned start date` | İşin isteğe bağlı başlangıç günü |
| Karar alanı | `Decision` | Karar ana kaydının yürürlükteki seçim metni |
| Karar yaşamı | `Life` | Table'da düzenlenebilen Kararın `Valid` veya `Withdrawn` yaşamı; `Superseded` açık yerine-geçme ilişkisiyle oluşur |
| Risk olasılığı | `Probability` | Risk ana kaydının olasılık alanı |
| Risk yanıtı | `Response` | Risk ana kaydının yanıt/azaltma alanı |
| Varsayım ifadesi | `Statement` | Varsayım ana kaydının kullanıcı tarafından doğrulanacak ifadesi |
| Açık soru | `Question` | Açık Soru ana kaydındaki kullanıcı sorusu |
| Soru bağlamı | `Context` | Açık Soru ana kaydının isteğe bağlı bağlamı |
| Soru yanıtı | `Answer` | Açık Soru ana kaydının isteğe bağlı yanıtı |
| Sıralama alanı | `Sort by <field>` | Table sütununu artan veya azalan biçimde sıralayan erişilebilir başlık eylemi |
| Yapıştırma sütunu eşleme denetimi | `Map column <header>` | Belirtilen yapıştırma başlığının hedef alanını seçen erişilebilir denetim |
| Satır düzeltme alanı | `Correct <field> in row <n>` | Belirtilen önizleme satırındaki alan değerini düzeltmeye yönelik erişilebilir denetim |
| Kayıt kimliği eşleşme hatası | `Record ID must match a row in this Table.` | Güncelleme kimliği geçerli Table satırıyla eşleşmediğinde gösterilir |
| Proje seçme hatası | `Select a Project before creating rows.` | Proje kapsamlı yeni satır oluşturmadan önce hedef Proje seçilmesi gerektiğini belirtir |
| Satır değerlerini gözden geçir | `Review this row's values.` | Satır önizlemesinde alan doğrulaması başarısız olduğunda gösterilen genel hata |
| Başlık ve veri satırı gerekli | `Paste a header row and at least one data row.` | Yapıştırma girişi sütun eşleme ve önizleme için yetersiz olduğunda gösterilen hata |
| Seçili satırları gözden geçir | `Review the selected rows.` | Uygulama önizlemesinde dahil edilen satırlar geçersiz kaldığında gösterilen hata |
| Hücre kaydedilemedi | `Could not save this cell.` | Hücre düzenlemesi başarısız olduğunda gösterilen genel hata |
| Yapıştırma uygulanamadı | `Could not apply these changes.` | Çok satırlı yazma başarısız olduğunda gösterilen genel hata |
| Değişiklikler uygulandı | `Changes applied.` | Çok satırlı yazmanın başarıyla tamamlandığını belirtir |
| Değişiklikler uygulanıyor | `Applying changes…` | Çok satırlı yazma sürerken gösterilen durum |
| Tablo kullanılamıyor | `Table is unavailable.` | Table verisi yüklenemediğinde gösterilen hata durumu |
| Kilometre Taşıının Planned'a dönüşü yok | `A Milestone cannot return to Planned.` | Milestone Reached veya Abandoned olduktan sonra Table'dan `Planned` durumuna geçişi reddeden doğrulama hatası |
| Keşif görünümü | `Discovery view` | Aynı geçici keşif yüzeyinde Search ile hazır tür dizini arasında seçim |
| Bütün sahiplik kapsamları | `All scopes` | Yetkili Proje ve Kişisel Wiki kayıtlarının kapsamlarını değiştirmeden birlikte gösterilmesi |
| Bütün Belge türleri | `All types` | Belge keşfindeki geçici tür filtresini kaldırır |
| Bütün Belge klasörleri | `All folders` | Belge keşfindeki geçici klasör filtresini kaldırır; yeni sahiplik oluşturmaz |
| Belge araması açıklaması | `Find Documents in their Project or Personal Wiki scope.` | Search içindeki teslim edilmiş Belge türü karşılığını açıklar |
| Kayıt eşleşme sayısı | `<count> matches` | Yetkili Belge başlık/gövdesindeki eşleşen terimlerin toplam sayısı |
| Tam sayfa aç | `Open full page` | Derin çalışma için kaynağı tam sayfada açma; geçici önizleme paneli veya kalıcı yerleşim değildir |
| Belge önizlemesi yükleniyor | `Loading document preview…` | Belge önizlemesi yüklenirken gösterilen durum metni |
| Geçici önizleme açıklaması | `Temporary preview that keeps the current source view in place.` | Geçici önizlemenin mevcut kaynak görünümünü koruduğunu açıklayan panel metni |
| Yakalama Gelen Kutusu öğesi | `Capture Inbox item` | Henüz ana kayda dönüşmemiş geçici girdi; Evrensel Arama sonucu değildir |
| GitHub dış kaydı | `GitHub external record` | GitHub kaynak kimliğini taşıyan salt okunur Proje ana kaydı; Evrensel Arama sonucu değildir |
| Secret | `Secret` | Kapalı alandan gelen gizli değer; arama, export, paylaşım ve yayın kapsamına girmez |
| Paylaşım token'ı | `Share token` | Dış yüzey erişim anahtarı; Evrensel Arama indeksine girmez |
| Bağlantı parolası | `Link password` | Bağlantıyla sınırlı paylaşım parolası; Evrensel Arama indeksine girmez |
| Proje geçişi | `Switch Project` | Palette ve görünür menüden yetkili Projeler arasında geçiş |
| Oluştur | `Create` | Palette ve görünür menüden yetkili kapsamda desteklenen kayıt oluşturma |
| Aç | `Open` | Palette yetkili ana kayda atlama |
| Eşleşen komut yok | `No matching command` | Palet süzgecinin komut döndürmediği durum |
| Burada çalışmaz | `Can’t run this here` | Kapsam dışı veya desteklenmeyen palet komutunun görünür başarısızlığı |
| Kapat | `Close` | Paleti kapatma eylemi |
| Ürün boşluğu kaydet | `Record Product Gap` | Kurucunun açıkça başlattığı Çalışma Alanı Ürün Boşluğu kaydı; otomatik telemetry, benzer başlık birleştirmesi veya İş dönüşümü değildir |
| Ürün Boşluğu | `Product Gap` | Karşılanmayan ihtiyaç için Çalışma Alanı ana kaydı; İş veya özellik isteği değildir |
| Karşılanmayan ihtiyaç | `Unmet need` | Ürün Boşluğunun zorunlu metni |
| Kapsam | `Scope` | Ürün Boşluğunun isteğe bağlı kapsam açıklaması |
| İlgili kayıtlar | `Related records` | Ürün Boşluğuna bağlı Proje, İş, Özellik ve Karar ilişkileri; ilişki bağlı kaydın yaşam döngüsüne yazmaz |
| Açık | `Open` | Ürün Boşluğu durumu `Açık`; kurucu seçer, tekrar sayısı yazmaz |
| Değerlendiriliyor | `Evaluating` | Ürün Boşluğu durumu `Değerlendiriliyor` |
| Karşılandı | `Met` | Ürün Boşluğu durumu `Karşılandı` |
| Bilinçli sınır | `Conscious boundary` | Ürün Boşluğu durumu `Bilinçli sınır`; yüksek etkili kaçışın kapanış kanıtını kaldırmaz |
| Takip İşi oluştur | `Create follow-up work` | Ürün Boşluğundan açık önizleme ve onayla tek İş açar veya mevcut Özellik ilişkisi kurar; kendiliğinden dönüşmez |
| Dış Araca Kaçış | `Tool Escape` | Ürün Boşluğuna bağlı tarihli, eklemeli olay; GitHub bağlantısı, Test Handoff'u veya Dış yürütme devri değildir; şiddet veya `High-impact` bayrağı taşımaz; sayısı yalnız kayıtlı olaylardan türetilir ve sıralama ya da öncelik üretmez |
| Gerçekleşme zamanı | `Occurred at` | Dış Araca Kaçışın gerçekleştiği zaman |
| Dış araç | `External tool` | Kullanıcının geçtiği aracın adı; dış içerik veya oturum kopyası değildir |
| Kaynak | `Source` | Dış Araca Kaçışın kaynak Proje, İş, Özellik veya Karar bağlamı |
| Yapılmak istenen iş | `Intended job` | Kullanıcının dış araçta bitirmek istediği iş |
| Nedenler | `Reasons` | Dış Araca Kaçış için bir veya daha fazla kapalı neden |
| Eksik yetenek | `Missing capability` | Dış Araca Kaçış nedeni `Eksik yetenek` |
| Daha hızlı | `Faster` | Dış Araca Kaçış nedeni `Daha hızlı` |
| Daha güvenilir | `More reliable` | Dış Araca Kaçış nedeni `Daha güvenilir` |
| Kullanılabilirlik | `Usability` | Dış Araca Kaçış nedeni `Kullanılabilirlik` |
| Alışkanlık | `Habit` | Dış Araca Kaçış nedeni `Alışkanlık` |
| Dış Araca Kaçışı kapat | `Close Tool Escape` | Dış Araca Kaçışa ayrı, eklemeli kapanış kaydı yazar; olayı yeniden yazmaz, bir kaçış için yalnız bir kez yapılır; hesap kapatma veya Dış yüzey iptali değildir |
| Kaçışın taşıdığı | `What the escape held` | Kapanışta yapılan yüksek etki yargısı: `Canonical truth moved out` (`Kanonik gerçek dışarı taşındı`), `Lasting parallel source of truth` (`Kalıcı paralel doğruluk kaynağı`) veya `Never held parallel truth` (`Paralel doğruluk taşımadı`); son seçenek dört koşullu kapanışı kullanmaz; saklanan şiddet bayrağı değildir |
| Aday build | `Candidate build` | Aynı akışın başarıyla çalıştığı güncel Ürün sürüm adayının kesin build'i |
| İş akışı çalıştırması | `Workflow run` | Aynı gerçek iş akışının aday üzerindeki doğrulanabilir çalıştırma başvurusu; serbest not veya dış ekran görüntüsü değildir |
| Gerçeğin dönüş yolu | `How the truth returned` | `Manual recreate` (`Manuel yeniden oluşturma`) veya `Supported import` (`Desteklenen import`) |
| Geri dönen ürün kayıtları | `Restored product records` | Etkilenen güncel gerçeğin döndüğü kesin Proje, İş, Özellik veya Karar kayıtları; kanıt bu kayıtlara bağlanır |
| Dış kopya | `External copy` | `Closed` (`Kapandı`) veya `Active parallel source` (`Aktif paralel kaynak`); yalnız `Closed` koşulu karşılar |
| Dış kopya nasıl kapatıldı | `How the external copy was closed` | Dış kopyanın paralel doğruluk kaynağı olmaktan çıkışının okunur açıklaması |
| Kapanış kanıtı | `Close evidence` | Kapanmış Dış Araca Kaçışın görünür kanıtı: aday build, çalıştırma, dönüş yolu, bağlı kayıtlar ve dış kopya açıklaması |
| Araca, nedene, Projeye veya duruma göre süz | `Filter by external tool`, `Filter by reason`, `Filter by Project`, `Filter by status` | Dogfooding özetinin yalnız seçen süzgeçleri; sıralama veya puan üretmez |
| Web Capture boş seçim | `No selected text` | Uzantıda seçili metin yokken önizleme satırı; yakalama oluşturmaz |
| Web Capture bekleme | `Sending…`, `Pairing…` | Gönderme ve eşleme sürerken düğme durumu |
| Tamamlandı olarak işaretle | `Mark as Completed` | Otomasyon önerisi; kapatma adımını `Completed` seçili açar, kendiliğinden kapatmaz |
| Proje Sürümü oluştur | `Create Project Release` | Tek bir Projeye ait yeni Proje Sürümü açma eylemi |
| Proje Sürümü kapsamı | `Scope`, `Add Work to scope`, `Remove from scope` | Yayımlanacak İş kümesi; Kilometre Taşı veya Odak Dönemi değildir |
| Proje Sürümü planlaması | `Planning` | Proje Sürümü ayrıntısında kapsam, bağlar ve hipotez bölümü |
| Erişim ve sonuç hipotezi | `Audience`, `Primary access path`, `Access evidence`, `Intended outcome`, `Outcome evidence` | Proje Sürümü için isteğe bağlı hipotez alanları |
| Ortam bağlantısı | `Environment link` | Proje Sürümüne bağlı dış ortam kaydı |
| Sürüm durumu eylemleri | `Mark Published`, `Mark Cancelled` | `Published` ve `Cancelled` terminal durumlarına yalnız açık eylemle geçiş |
| Üretim Olayı kaydet | `Record Production Incident` | Yeni Üretim Olayını başlık ve zamanla açma eylemi |
| Üretim Olayı bağları | `Linked records`, `Link record`, `Remove link` | Üretim Olayına aynı Projenin Bug, GitHub PR, Proje Sürümü, Risk ve Kararını bağlama; bağlanan kaydın durumunu yazmaz |
| Üretim Olayı Takip İşi | `Follow-up work`, `Create follow-up work`, `Preview`, `Preview changed` | Üretim Olayından yalnız önizleme sonrası onayla İş oluşturma; önizleme değişirse yeniden önizlenir, olay ve Bug yazılmaz |
| GitHub bağlantı eylemleri | `Connect repository`, `Install GitHub App`, `Connect selected repositories`, `GitHub records` | Repository bağlama akışı ve bağlı salt okunur GitHub kayıtları |
| GitHub eşitleme durumu | `Last synced`, `Last error`, `Retry after`, `Source not found` | Eşitleme sağlığı; `No access` erişim kaybını gösterir |
| İlk bağlantı triage | `Skip triage`, `Preview Work to create` | Issue'lardan İş oluşturmayı atlama veya önizleme |
| PR inceleme durumu | `Pending`, `Approved`, `Changes requested`, `Commented` | GitHub'dan gelen salt okunur inceleme durumu |
| Salt okunur Proje bandı | `This Project is archived and read-only.` | Arşivli Projede ve kayıtlarında salt okunur ve hareketsiz olduğunu söyleyen bant |
| Proje arşivini geri al | `Unarchive` | Arşivlenen Projeyi çalışma yüzeyine kimliği değiştirmeden döndürme |
| Çıkış paketi parolası | `Package password`, `Confirm package password` | Workspace Exit Package şifreleme parolası; sunucuda saklanmaz |
| Paylaşım parolası ve süre | `Password`, `Expires on`, `No expiry` | Bağlantı paylaşımı erişim ayarları |
| Parola kapısı | `Enter the password to view this page.`, `Password`, `View` | Parolalı bağlantıyı açan ziyaretçi metni |
| Bağlantı süresi doldu | `This link has expired.` | Süresi dolmuş bağlantıya gelen ziyaretçi; yüzeyin var olup olmadığını açığa vurmaz |
| Rota bulunamadı | `This page is unavailable.` | Varlığını ya da başlığını sızdırmayan genel bulunamadı metni |
| Oturum sona erdi | `Your session has ended. Sign in again to continue.` | Giriş yüzeyinde oturum bitişi açıklaması |
| İçe aktarma kararı | `Update existing`, `Skip`, `Resolve conflict` | Kararlı köken eşleşmesinde seçenekler |
| Boş sinyal bölümü | `No signals in this section.` | Bildirim Merkezi bölümü boşken; her şey yolunda iddiası taşımaz |
| Yeniden bak boş durumu | `Nothing to look at again.` | `Look again` yüzeyi boşken |
| Yeniden bak yüzeyi | `Look again` | `review-later` kaynak grubunu listeleyen yüzeyin adı |
| Kişisel erişim kabuğu tetikleyicisi | `Personal` | Üst çubuktaki, Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve Yeniden bak geçici panelini açan düğme; panelin başlığı seçili yüzeyin adıdır |
| Kişisel erişim kabuğu açıklaması | `Personal surfaces open above your current work.` | Panel altındaki Proje, kayıt ve kaynak görünüm konumunun korunduğunu söyler |
| Çalışma Oturumu kümesi açıklaması | `Held for this session only.` | `Active Working Set` kalıcı olmadığını söyler |
| Hesap adı uyuşmazlığı | `The name does not match.` | Hesabı kapatma ve silme onayında yazılan ad uyuşmadığında |
| Dış yüzey dizin eylemleri | `Open source`, `Review diff`, `Change expiry`, `Reactivate`, `Revoke`, `Unpublish` | Shares and Publications satır eylemleri; durum ve yüzey türüne göre görünür |
| Yayın gözden geçirme aralığı | `Review interval (days)`, `Save interval`, `Public Roadmap review`, `Enter a whole number of days from 7 to 180.`, `The interval was not saved.` | Notification Center'ın `Public Roadmap review` bölümündeki isteğe bağlı gün aralığı; `public-roadmap-review-due` sinyalini türetir |
| YouTube yükleme | `Load YouTube`, `Loading YouTube contacts a third-party server.` | Tıklayınca yüklenen YouTube kartı ve gizlilik uyarısı |
| Dondurulmuş canlı blok etiketi | `Snapshot`, `As of` | Ziyaretçi yüzeyinde onaylı snapshot kaynağı ve tarihi |
| Ziyaretçi alt bilgisi | `This page is read-only.` | Herkese açık yüzeyde salt okunur olduğunu söyleyen tek satır |
| Herkese açık gezinme ve akış | `Project`, `Featured`, `Development feed` | Build in Public Proje görünümü sekmesi, öne çıkan kayıt ve gelişim akışı başlığı |
| Paylaşım kapsam dışı bölümü | `Not included` | Paylaşım önizlemesinde kapsama girmeyenlerin başlığı |
| Dışa aktarma manifesti | `Schema version`, `Scope`, `Filters`, `Visible fields`, `Produced at` | Her çıktıdaki kaynak manifesti alanları |
| CSV kayıp raporu | `Lost in CSV`, `Escaped as data` | CSV'de kaybolan ilişki/tür/kimlik ve formül kaçışı raporu |
| İçe aktarma eşleme ve makbuz | `Source column`, `Product field`, `Import receipt`, `Created`, `Updated`, `Rolled back` | İçe aktarma eşleme adımı ve tam commit/rollback makbuzu |
| Tekrar bak öğeleri yükleniyor | `Loading Look again items…` | Tekrar bak listesi yüklenirken gösterilen durum metni |
| Tekrar bak öğeleri kullanılamıyor | `Look again items are unavailable.` | Tekrar bak listesi alınamadığında gösterilen hata metni |
| Etkin Çalışma Setine ekle / çıkar | `Add to Active Working Set`, `Remove from Active Working Set` | İş ve Belge kayıt başlığının taşma menüsünde Etkin Çalışma Setine üye ekleme ve çıkarma eylemleri |
| Etkin Çalışma Seti tepsi başlığı | `Active Working Set` | Oturum boyunca tutulan İş ve Belge tepsisinin başlığı; tepsi boşken hiç görünmez |
| Tepsiyi daralt | `Collapse` | Etkin Çalışma Seti tepsisini üyeleri koruyarak tek düğmeye daraltan görünür eylem |
| Tepsiyi göster | `Show tray` | Küçültülmüş Etkin Çalışma Seti tepsisinin yeniden açma tetiği |
| Okundu işaretle / okunmadı işaretle | `Mark as read`, `Mark as unread` | Bildirim Merkezi satırında okundu işaretleme ve geri alma eylemleri |
| Bildirim kapatma ve yeniden açma | `Close`, `Reopen` | Bildirim Merkezi satırında kapama ve yeniden açma eylemleri |
| Bildirim eylemi sonuçları | `Follow-up work created. The notification stays open.`, `Follow-up work already exists for this attempt.`, `The action could not be completed.`, `The follow-up preview changed; preview it again.`, `That attempt already created work for a different notification.`, `Project is unavailable.`, `Notification is unavailable.`, `Archived Projects are read-only.` | Bildirim Merkezi satır eylemlerinin uygulanma sonuçları ve hata metinleri |
| Kişiler'i aç | `Open Contacts` | Komut paletinde Kişiler yüzeyini açan komut |
| Kişiler | `Contacts` | Kişi ve Şirket yüzeyinin gezinti etiketi; `More` altında yer alır |
| Canlı blok sınırı doldu | `Live block limit reached. Remove one to add another.` | Canlı blok üst sınırına ulaşılınca `Add live block` yanında gösterilen sessiz satır |
| Arşive geri yükle | `Restore to Archive` | Çöp Kutusu'ndaki Proje grubunu Aktif'e değil Arşive döndüren eylem |
| Arşive geri yükleme sonucu | `Restoring returns the Project to Archive. No surface is republished and GitHub stays disconnected.` | Proje grubu geri yüklenirken gösterilen sonuç metni |
| Çalışmıyor | `Not running` | Çöp Kutusu'ndaki kuralın çalışmadığını söyleyen durum etiketi |
| Çöp Kutusu boş | `Trash is empty.` | Çöp Kutusu'nun dürüst boş durum metni |
| Yeniden yayın için yeni onay | `Republishing requires a new approval.` | Geri yüklenen Projede korunan Dış yüzeyin yeniden yayımlanması için açık onay gerektiğini söyleyen metin |
| Zarf tanımı | `Envelope definition` | Çalışma Alanı Çıkış Paketi ekranında uygulamasız envelope tanımına bağlantı |
| Parolalar eşleşmiyor | `The passwords do not match.` | Paket parolası ve tekrar alanı uyuşmadığında alan altında gösterilen hata |
| Paket parolası kaybı uyarısı | `If you forget the package password, the Workspace Exit Package cannot be read. There is no recovery code and no unencrypted copy.` | Parola kaybının sonucunu söyleyen tek sahipli cümle |
| Çalışma Alanı Çıkış Paketi üret | `Produce Workspace Exit Package` | Çalışma Alanı Çıkış Paketi üretimini başlatan eylem |
| İndirmeyi iptal et | `Revoke download` | Hazır paketin süreli indirmesini iptal eden eylem |
| İzin gerekli | `Permission needed` | Yakalama uzantısında okuma izni istenirken gösterilen başlık |
| Erişim riski | `Access risk` | Yakalama uzantısında izin isteminin riskini gösteren etiket |
| İzin ver | `Allow` | Yakalama uzantısında okuma iznini veren eylem |
| İzin reddedildi | `Permission declined. Nothing was sent.` | Okuma izni reddedilince hiçbir şeyin gönderilmediğini söyleyen metin |
| Oturum iptal edildi | `Session revoked.` | Tek oturum iptal edilince gösterilen sonuç bildirimi |
| Diğer oturumlar iptal edildi | `Other sessions revoked.` | `Revoke Other Sessions` sonrası gösterilen sonuç bildirimi |
| Dondurulmuş | `Frozen` | Hesap kapanma sürecinin 30 günlük dondurma aşaması |
| Kapanış dondurması açıklaması | `Only Cancel closing and export are available.` | Dondurma aşamasında yalnız kapanışı iptal etme ve dışa aktarmanın açık olduğunu söyleyen açıklama |
| Dondurma bitiş tarihi | `Freeze ends {date}` | Hesap kapanma zaman çizelgesinde dondurmanın bitiş tarihi satırı |
| Kalıcı silme tarihi | `Permanent deletion on {date}` | Hesap kapanma zaman çizelgesinde kalıcı silme tarihi satırı |
| Dış araç kaçışları ayrı listelenir | `Tool Escapes are listed separately; nothing is shared until you approve each row.` | Ürün Boşluğu paylaşım önizlemesinde Dış Araca Kaçış satırlarını açıklayan metin |
| Şirketi kaydet | `Save Company` | Şirket adını kaydeden eylem |
| Kişisel veri uyarısı | `Health, biometric, government ID, payment card and children's data are not stored as a first-product type. Do not enter them.` | Kişi oluşturma dialogunda alanların altındaki sessiz uyarı |
| Aynı e-posta adresi | `Same email address` | Güçlü kopya adayında gösterilen neden satırı |
| Benzer ad | `Similar name` | Zayıf öneride gösterilen neden satırı |
| Benzer Şirket | `Similar Company` | Zayıf öneride gösterilen neden satırı |
| İlgili kanıt | `Related evidence` | Kişisel veri dışa aktarma dialogunda ilgili kanıt kayıtlarını kapsayan seçenek |
| Paylaşılan ve yayımlanan kopyalar kaldırıldı | `Shared and published copies were removed. Cache cleanup is queued.` | Kişisel veri silme sonrası paylaşım ve yayın kopyalarının kaldırıldığını ve cache temizliğinin kuyruğa alındığını söyleyen satır |
| Gömme kodu desteklenmiyor | `Embed code is not supported. Paste the page URL instead.` | Kaynak eklerken gömme kodu yapıştırılınca gösterilen hata |
| Ekran görüntüsü | `Screenshot` | Yakalanan içerik bölümündeki ekran görüntüsü etiketi |
| Kaynak Kontrolü kaydedildi | `Source Check saved.` | `Keep current version` sonrası gösterilen sonuç; onaylı sürüm değişmez |
| Kaynak sürümü kaydedildi | `Source version saved.` | `Save as new Source version` sonrası gösterilen sonuç; eski sürüm ve bağlar yerinde kalır |
| Dosya Eki transkript değildir | `A file is not a transcript or an evidence bind.` | Dosya Ekleri bölümünde bir dosyanın transkript ya da kanıt bağı sayılmadığını söyleyen not |
| Katılımcı alıntısı yönergesi | `The participant’s own words. Use an anonymous Speaker label; do not copy Contact details.` | `Participant quote` türü seçiliyken gösterilen yönerge |
| Kişi veya Şirket değiştirilemedi | `Contact or Company could not be changed. Reload and try again.` | Araştırma Oturumu ve Geri Bildirim kaydında ilişki değişmediğinde gösterilen hata |
| Durum değişikliği İş'i değiştirmez | `Changing the status does not change any Work.` | Geri Bildirim durumu değişirken gösterilen not |
| Kanıt kalitesi geçmişi | `Evidence quality history` | Geri Bildirimde kanıt kalitesi değişikliklerinin geçmişi |
| Kanıt kalitesi geçersiz | `Evidence quality is invalid.` | Kanıt kalitesi kaydedilirken gösterilen doğrulama hatası |
| Kaynak olay zamanı | `Source event time` | Kanıtın kaynağında olayın gerçekleştiği zaman |
| Kanıt zamanı | `Evidence time` | Kanıtın kaydedildiği zaman |
| Tek dosya, tek tür, tek kapsam | `One file · one type · one scope` | İçe aktarma girişinin yanındaki not |
| İçindekiler | `Contents` | Odak Modunda Belge bölümlerini listeleyen kontrol |
| Bölüme odaklan | `Focus on section` | Odak Modunda tek bölüme odaklanan eylem |
| Tam Belgeye dön | `Back to full Document` | Bölüm odağından tam Belgeye dönen eylem |
| Odak Modundan çık | `Exit Focus Mode` | Odak Modunu kapatan eylem |
| Gelişmiş | `Advanced` | Bul ve değiştir içinde düz metin varsayılanından ayrı regex anahtarı |
| Kalıp geçerli değil | `This pattern is not valid.` | Bul ve değiştirde geçersiz regex kalıbı hatası |
| Sürüm 5 için Spec Değişiklik İncelemesi açıldı | `Spec Change Review opened for Version 5.` | Sürümler listesinde bir sürümden Spec Değişiklik İncelemesi açılınca gösterilen sonuç |
| Proje görünümleri | `Project views` | Proje Genel Bakışında görünümlere giden bölümün başlığı |
| Değer Zinciri | `Value Chain` | Seçilen Proje Hedefinden gözlenen sonuca uzanan türetilmiş görünümün başlığı |
| Hedefe bağlanmamış | `Not linked to goal` | Değer Zincirinde Hedefe katkı yolu olmayan ilgili kayıtların bölüm başlığı |
| Erişilemeyen kayıt | `Unavailable record` | Değer Zincirinde içeriği gösterilemeyen ucun yer tutucusu |
| Bağlayan ilişki türü | `Bound by {relation type}` | Değer Zinciri düğümünde bağın ilişki türünü gösteren etiket |
| İlişkili bağ katkı sayılmaz | `A Related link does not count as a contribution to this goal.` | `Related` bağının Hedefe katkı sayılmadığını söyleyen not |
| Bu boşluğu doldur | `Fill this gap` | Değer Zincirinde eksik veya çözülemeyen adımın yanındaki eylem |
| Mevcut kaydı seç | `Choose an existing record` | Boşluk panelinde ilişki seçiciyi açan yol |
| Yeni kayıt başlat | `Start a new record` | Boşluk panelinde ilgili özelliğin oluşturma akışına giden yol |
| Boşluk paneli notu | `Nothing is written until you save the relation in the owning feature. No other record changes status.` | Boşluk panelinde hiçbir şeyin sahip özellikte kaydedilene kadar yazılmadığını söyleyen sabit not |
| Kayıt açılamadı | `The record could not be opened.` | Boşluk panelinde kaydın açılamaması hatası |
| Düğüm gösterim nedeni | `Shown because: {relation}` | Değer Zinciri düğümünde neden gösterildiğini söyleyen etiket |
| Boşluk bölümü | `Gaps` | Değer Zincirinde eksik adımların sayısıyla listelendiği bölüm başlığı |
| Boş hedef boşluğu | `No Work, Milestone or Project Release contributes to this goal.` | Hedefe hiç katkı bağlı olmadığında gösterilen boşluk |
| İş boşluk cümlesi | `No {stage} is bound to this Work.` | Zincir İşinde eksik aşamayı adlandıran boşluk |
| Boşluk yok notu | `No step is missing on the explicit relations. This is not a verdict.` | Boşluk bulunmadığında gösterilen not |
| Zincir türetme notu | `Derived from explicit records and relations. Nothing here is written, scored or inferred.` | Zincir başlığının altındaki türetme notu |
| Zincir yükleniyor | `Loading Value Chain…` | Zincir okunurken gösterilen durum |
| Zincir okunamadı | `Value Chain is unavailable.` | Zincir okunamadığında gösterilen hata |
| Erişilemeyen Hedef notu | `This Project Goal is unavailable: {reason}. Records still bound to it are shown.` | Hedef çözümlenemediğinde gösterilen durum |
| Diğer daldan tekrar | `Also reached from another branch; shown in full there.` | Zincirde ikinci kez ulaşılan düğümün notu |
| Zincir dışı ilişkili not | `Related to a record in this chain, but no Contributes to Goal path reaches it.` | `Not linked to goal` satırının gösterilme nedeni |
| Bağlanmamış İş eki notu | `Attached to {record}, which itself has no Contributes to Goal path from this goal.` | Bağlanmamış bir İşin Karar, kanıt veya test ekinin gösterilme nedeni |
| Kilometre Taşına ulaşıldı | `Milestone reached` | Proje Hikâyesi zaman çizelgesinde olay türü |
| Yaşam döngüsü değişikliği | `Lifecycle change` | Proje Hikâyesi zaman çizelgesinde olay türü |
| Kod değişikliği | `Code change` | Proje Hikâyesi zaman çizelgesinde olay türü |
| Deney sonucu | `Experiment result` | Proje Hikâyesi zaman çizelgesinde olay türü |
| Vazgeçme gerekçesi | `Abandonment rationale`, `Abandonment rationale: {text}` | Vazgeçilen İşin Proje Hikâyesi olayındaki gerekçe etiketi ve gerekçeli satır |
| Kaynağa göre süz | `Filter by source`, `Any source` | Proje etkinlik akışında kaynak süzgeci ve tüm kaynakları kapsayan seçenek |
| Olay türüne göre süz | `Filter by event type`, `Any event type` | Proje etkinlik akışında olay türü süzgeci ve tüm olay türlerini kapsayan seçenek |
| Alan değişikliği | `Field change` | Etkinlik akışında olay türü süzgeci değeri |
| Durum değişikliği | `Status change` | Etkinlik akışında olay türü süzgeci değeri |
| Önceki / sonraki değer | `Previous` | Etkinlik satırında önceki ve sonraki alan değerini gösteren etiketler |
| Geri alma sınırı | `Undo boundary` | Küme açıkken geri alma sınırını gösteren satır |
| Değişiklik kümesi | `{n} changes by {actor} within 5 minutes` | Beş dakika içindeki aynı aktörün değişikliklerini kümeleyen satır |
| Hikâye boş | `No story events yet.` | Yeni Projede Proje Hikâyesi boş durum metni |
| Etkinlik boş | `No activity yet.` | Yeni Projede etkinlik akışı boş durum metni |
| Durum işareti | `Status mark` | Proje Güncellemesinde durum işareti alanı |
| Anlatı | `Narrative` | Proje Güncellemesinde serbest anlatı alanı |
| Kayıt anındaki canlı özet | `Live summary at save time` | Proje Güncellemesinde kayıt anında katlanan canlı özet alanı |
| Proje Güncellemesi kaydedildi | `Project Update saved.` | Proje Güncellemesi kaydedilince gösterilen başarı bildirimi |
| Yazıldığı andaki özet | `Summary when written` | Proje Güncellemesi liste girişinde katlanmış snapshot |
| Kaydedilmiş güncelleme düzenlenmez | `A saved update cannot be edited. Write a new update instead.` | Kaydedilmiş Proje Güncellemesinin düzenlenmediğini ve silinmediğini söyleyen not |
| Tekrarlayan hatırlatma | `Repeating reminder` | Tekrarlayan Kişisel Planlama hatırlatması türü |
| Düşünme sorusu | `Reflection question` | Tekrarlayan hatırlatmaya bağlanan düşünme sorusu |
| Aralık | `Interval` | Tekrarlayan hatırlatmanın tekrar aralığı |
| Hatırlatmayı duraklat | `Pause reminder` | Tekrarlayan hatırlatmayı duraklatan eylem |
| Hatırlatmayı kapat | `Turn off reminder` | Tekrarlayan hatırlatmayı kapatan eylem |
| Kapanış Özeti Taslağı notu | `The draft contains only headings and links to your records. It writes no conclusions.` | Kapanış Özeti Taslağının yalnız başlık ve bağlantı içerdiğini söyleyen not |
| Kaynak seç | `Select sources` | Kapanış Özeti Taslağında kaynak seçim adımı |
| Tamamlanan İş | `Completed Work` | Kapanış Özeti Taslağında kaynak grubu |
| Başlıkları önizle | `Preview headings` | Kapanış Özeti Taslağında oluşacak başlıkları gösteren eylem |
| Taslak oluştur | `Generate draft` | Kapanış Özeti Taslağını üreten eylem |
| Planlanan tarih geçmişi | `Planned date history` | Kapanış Özeti Taslağında planlanan tarih değişikliklerinin geçmişi |
| Taşındı | `Moved` | Planlanan tarih geçmişinde hedefin taşındığını gösteren değer |
| Hedeften önce | `Before target` | Planlanan tarih geçmişinde hedeften önce biten değer |
| Hedefte | `On target` | Planlanan tarih geçmişinde hedefte biten değer |
| Hedeften sonra | `After target` | Planlanan tarih geçmişinde hedeften sonra biten değer |
| Geçmiş okumasıdır, puan değildir | `This is a reading of existing history. It is not a score.` | Planlanan tarih geçmişi notu |
| Belge olarak kaydet | `Save as Document` | Kapanış özetini `General` Belge olarak kaydeden eylem |
| Kapanış özeti Belge olarak kaydedildi | `Project Closure Summary saved as a Document.` | Açık kayıttan sonra gösterilen onay; Belgeye bağlantı verir |
| Kişisel Wiki kopyası işaretçisi | `Use Copy Document on the Document to copy it to the Personal Wiki.` | Kayıt sonrası onayda mevcut `Copy Document` Belge kopyalama eylemine yönlendiren cümle |
| Planlanan tarihi olan seçili kayıt yok | `No selected record has a planned date.` | Planlanan tarih geçmişinde karşılaştırılacak kayıt yoksa gösterilen durum |
| Kapanış özeti isteği tamamlanamadı | `The request could not be completed. Try again.` | Taslak, kayıt veya tarih geçmişi okuması başarısız olunca gösterilen uyarı |
| Kapanış Özeti Taslağı yüzeyi | `Closure Summary Draft` | Kapanış özeti taslağının kaynak seçimi, önizleme ve düzenleyici bölümlerinin ortak adı |
| Başlık önizlemesi | `Heading preview` | Seçilen kaynakların hangi başlığa gireceğini gösteren önizleme listesi |
| Kaynak seçilmedi | `No sources selected.` | Önizlemede hiç kaynak seçilmediğinde gösterilen durum |
| Seçilecek kayıt yok | `No {heading} to select.` | Kaynak grubunda seçilebilir kayıt olmadığında gösterilen durum |
| Kapanış Özeti Taslağı yükleniyor | `Loading Closure Summary Draft…` | Kapanış Özeti Taslağının kaynak listesi yüklenirken gösterilen durum |
| Kapanış Özeti Taslağı kullanılamıyor | `Closure Summary Draft is unavailable.` | Kapanış Özeti Taslağının kaynak listesi okunamadığında gösterilen hata durumu |
| Taslağı at | `Discard draft` | Kapanış özeti taslağını kaydetmeden atan eylem |
| Etkilenen Belgeler yeni sürüm alır | `Affected Documents get a new version. Undo restores them together.` | Etiket yeniden adlandırma makbuzunda etkilenen Belgelerin sürümlü değiştiğini söyleyen satır |
| Eşleşecek alan değişikliği yok | `No field change can make this record match.` | Sürükleme önizlemesi doğrudan alan eşitliği olmayan koşulda gösterilen metin |
| Çöpteki kural çalışmaz | `A rule in Trash does not run.` | Çöpteki otomasyon kuralları için not |
| Yeni otomasyon kuralı | `New automation rule` | Otomasyon kuralı formunun başlığı |
| Tetikleyici | `Trigger` | Otomasyon kuralı formunda tetikleyici alanı |
| Koşullar (isteğe bağlı) | `Conditions (optional)` | Otomasyon kuralı formunda koşul alanı |
| Kapalı liste notu | `Triggers, conditions and actions come from a closed list. There is no scripting.` | Otomasyon formunda tetikleyici, koşul ve eylemlerin kapalı listeden geldiğini söyleyen not |
| Tekrarlayan İş | `Repeating Work` | Hazır otomasyon kuralı türü |
| Tekrarlayan İş açıklaması | `Each repeat creates a new, independent Work. The same Work is never reopened.` | Tekrarlayan İş kuralı açıklaması |
| Her şu kadar tekrarla | `Repeat every` | Tekrarlayan İş kuralında tekrar aralığı alanı |
| Deneme çalıştırması | `Dry run` | Otomasyon kuralını yazmadan deneyen düğme |
| Deneme çalıştırması sonucu | `Dry run result` | Deneme çalıştırması sonuç başlığı |
| Hiçbir şey yazılmadı | `Nothing was written.` | Deneme çalıştırması sonrası gösterilen not |
| Tanım geçmişi | `Definition history` | Otomasyon kuralı tanım sürümlerinin geçmişi |
| Sürüm {n} | `Version {n}` | Tanım geçmişinde sürüm satırı |
| Bu tanımı geri yükle | `Restore this definition` | Eski kural tanımını geri yükleyen eylem |
| Tanım geri yükleme notu | `Restoring a definition affects future runs only.` | Tanım geri yüklemenin yalnız gelecek çalıştırmaları etkilediğini söyleyen not |
| Çelişen öneri notu | `No change was written. These rules propose different values for the same field.` | Aynı hedef alana çelişen kural önerilerinde gösterilen sabit metin |
| Önerilen değer | `Proposed value` | Çelişen öneri tablosunda sütun |
| Çöz | `Resolve` | Çelişen öneriyi çözme eylemi |
| Başarısız adım | `Failed step` | Başarısız otomasyon çalıştırmasında başarısız adımı gösteren alan |
| Build in Public'i etkinleştir | `Enable Build in Public` | Build in Public yüzeyini açan eylem |
| Yayımla | `Publish` | Build in Public onaylı revizyonunu yayımlayan birincil eylem |
| Önerilen: Yayımlandı | `Suggested: Released` | Yayımlanmış Proje Sürümü üyesi İş için önerilen etiket |
| Released'ı kullan | `Use Released` | Önerilen etiketi kabul eden eylem |
| Öne çıkarma bitişi | `Featured until` | Öne çıkarılan kaydın bitiş tarihi alanı |
| Starter Configuration sunulmaz | `Starter Configuration is not offered; the copied structure is the structure.` | Proje yapısını kopyalarken Starter Configuration sunulmadığını söyleyen not |
| Oluşturuluyor… | `Creating…` | Proje oluşturulurken onay düğmesinin kaydetme durumu |
| Arama açıklaması | `Search description` | Kişisel Wiki Belgesi yayın önizlemesinde arama açıklaması alanı |
| Tam Diyagram Sürümü | `Exact Diagram Version`, `Diagram View` | Dışa aktarma önizlemesinde dışa aktarılan Diyagram Sürümü veya görünümü |
| Bu dışa aktarmada dışarıda kalanlar | `Left out of this export` | Dışa aktarma önizlemesinde dışarıda kalan öğeler satırı |
| Statik çıktı notu | `Static output. It is not a live link or an editable source.` | Diyagram dışa aktarmasının canlı bağlantı veya düzenlenebilir kaynak olmadığını söyleyen not |
| JSON içe aktarılamaz | `This JSON cannot be imported.` | Diyagram dışa aktarma önizlemesinde JSON'ın içe aktarılamayacağını söyleyen not |
| Model hash'i | `Model hash` | DDL manifestinde model özeti |
| Üretici sürümü | `Generator version` | DDL manifestinde üretici sürümü |
| Uyarı manifesti | `Warning manifest` | DDL ile birlikte üretilen uyarı manifesti |
| .sql olarak dışa aktar | `Export .sql` | DDL'i .sql dosyası olarak dışa aktaran eylem; manifest eşlik eder |
| DDL kopyalandı | `DDL copied.` | DDL panoya kopyalanınca gösterilen başarı bildirimi |
| DDL üretilemedi | `DDL could not be generated.` | DDL üretimi başarısız olunca gösterilen hata |
| Statically Validated notu | `Statically Validated means the SQL passed parse and apply on a disposable database that was destroyed afterwards. It does not mean the SQL ran on any of your databases.` | `Statically Validated` durumunun anlamını sınırlayan sabit not |
| CREATE EXTENSION üretilmez | `CREATE EXTENSION is never generated.` | DDL üretiminde extension oluşturma komutunun üretilmediğini söyleyen not |
| Yıkıcı olmayan | `Non-destructive` | Migration operasyon sınıfı |
| Olası yıkıcı | `Potentially destructive` | Migration operasyon sınıfı |
| Desteklenmeyen | `Unsupported` | Migration operasyon sınıfı |
| Faz <n> | `Phase <n>` | Migration planında operasyonun fazı |
| Mevcut veri uyarısı | `Existing data warning` | Migration satırında mevcut veriye etkisi uyarısı |
| Geri dönüş veri uyarısı | `Reverse data warning` | Migration satırında geri dönüşte veri kaybı uyarısı |
| Extension gerekli | `Extension required` | Migration satırında extension gerektiren operasyon etiketi |
| Migration operasyonları | `Create table`, `Rename table`, `Rename column`, `Widen column type`, `Relax nullability`, `Tighten nullability`, `Add or change default`, `Drop default`, `Add primary key`, `Add foreign key`, `Change referential action`, `Add unique constraint`, `Add check constraint`, `Add index`, `Drop index`, `Create enum type`, `Add enum value`, `Rename enum value`, `Create domain`, `Add domain constraint` | Yıkıcı olmayan migration operasyonlarının PRD 11 sırasındaki İngilizce adları |
| Yeniden doğrula | `Revalidate` | Düzenlenen Up SQL'i yeniden doğrulayan eylem |
| Olası yıkıcı satır onayı | `I understand this can lose data or guarantees` | Olası yıkıcı satırlar için gösterilen ek onay kutusu |
| Manifesti dışa aktar | `Export manifest` | `.sql` ile eşlik eden manifesti dışa aktaran eylem |
| Beklenen davranış | `Expected behavior` | Planlı Test Senaryosu alanı; Bug Capture'ın `Expected Behavior` alanından ayrı kavramdır |
| Taslak olarak işaretle | `Mark as Draft` | Paketi henüz üretilmemiş `Ready to share` Test Devrini Taslağa döndüren eylem |
| Hatırlatma normal hatırlatmadır | `A reminder is a normal reminder on this record. It is not a runner deadline.` | Test Devrinde `Remind me` kontrolünün yanındaki not |
| Dönüş yönergeleri | `Return instructions` | Test Devri paketinde raporların `test-report/1` olarak döneceğini söyleyen bölüm satırı |
| Oturum Testi sınırı | `A manual Test Session holds up to 200 Session Tests.` | 200 Oturum Testi sınırında `Add Session Test` pasifken gösterilen neden |
| Dosya boyutu ipucu | `Up to 5 MiB; up to 1,000 Session Tests.` | Test Oturumu dosyası içe aktarılırken boyut ve Oturum Testi sınırı ipucu |
| Madde incelemesi | `Review of <title>` | Test İncelemesinde madde düzeyi inceleme durumu seçicisi |
| Oturum Testinin Çöpü veya arşivi yok | `A Session Test has no Trash or archive of its own.` | Oturum Testi listesinde Oturum Testinin kendi Çöp Kutusu veya arşivi olmadığını söyleyen not |
| Kapatma gerekçesi (isteğe bağlı) | `Close reason (optional)` | Test Oturumu kapatma dialogunda isteğe bağlı gerekçe alanı |
| Eski sonuç | `Older result` | Supersedes ilişkisi seçiminde eski sonuç |
| Supersedes ilişkisi oluştur | `Create Supersedes relation` | Supersedes ilişkisini onaylayan eylem |
| Döngü reddi | `This would create a cycle. A result cannot supersede itself through the chain.` | Supersedes zincirinde döngü oluşturacak seçim reddedilince gösterilen metin |
| Planlama: başlık | `Planning for <title>` | Test Açığının planlama bağlantıları dialogunun başlığı |
| Kapsam kaynağı | `In scope through Work: <key>`, `Linked directly to this Project Release` | Test Özetinde Proje Sürümü delta satırının kapsam kaynağı |
| Bu Release Evidence Pack değildir | `This is not the Release Evidence Pack.` | Test Özetinin Release Evidence Pack olmadığını söyleyen not |
| Proje Etkinliği | `Project Activity` | Mevcut Kayıt geçmişinden türetilen filtrelenebilir atomik değişiklik görünümü |
| Ne değişti? | `What changed?` | Proje Etkinliğinin cevapladığı soru etiketi |
| Etkinlik filtreleri | `Source type`, `Event type`, `Apply filters`, `Clear filters` | Proje Etkinliğinin kaynak veya sistem türü ile olay türü filtre grupları ve eylemleri |
| Eski değişiklikleri göster | `Show older changes` | Proje Etkinliğinde sonraki sayfayı yükleme |
| Güvenlik redaksiyonu işareti | `Redacted for security. No content is shown.` | Proje Etkinliğinde redakte geçmiş satırının içeriksiz işareti |
| Kaynak kapsamı | `Source coverage` | Proje Etkinliğinde kısmi veya eksik kaynakların nedenini listeleyen not |
| Kayda atfedilmeyen geçmiş | `History not attributed to a Project record` | Proje Etkinliğinde bir Proje kaydına atfedilemeyen sahip geçmişini açan özet |
| Her değişikliği göster / gizle | `Show each change`, `Hide each change` | Beş dakikalık sunum kümesindeki atomik satırları açıp kapatan düğme |
| Kayıt geçmişi görünümü | `Record history`, `Older changes could not be loaded.` | Açık İş kaydının kendi Kayıt geçmişi bölümü ve daha eski değişiklikler yüklenemediğinde görünen uyarı |
| Redakte değer satırı | `value redacted` | Proje Etkinliğinde gizli benzeri bir alanın değer yerine gösteren içeriksiz satırı |
| Desteklenmeyen değer çifti | `changed (previous and next values are not shown for this field)` | Etkinlik akışında önceki–sonraki sunumu desteklenmeyen yapısal değerin satırı |
| Süzgece uyan değişiklik yok | `No changes match these filters.` | Proje Etkinliğinde süzgeçlere uyan satır olmadığındaki boş durum |
| Kaydın değişikliği yok | `No changes are recorded for this record yet.` | Kayıt geçmişi görünümünde henüz değişiklik olmadığındaki boş durum |
| Yalnız en yeni geçmiş | `Only the newest history is read. Older changes are not listed.` | Proje Etkinliğinde kaynak penceresine ulaşıldığında gösterilen not |
| Kaynak tesliminden | `from a source delivery` | Etkinlik satırında kökeni kaynak teslimi olan değişikliğin notu |
| Önceki değişikliğin geri alınması | `undo of an earlier change` | Etkinlik satırında bir önceki değişikliğin geri alma girdisi olduğunun notu |
| Etkinlik yükleme durumları | `Loading Project Activity…`, `Project Activity is unavailable.`, `Loading Record history…`, `Record history is unavailable.`, `Loading Story Timeline…`, `Story Timeline is unavailable.` | Proje geçmişi yüzeylerinin yükleme ve hata durumları |
| Sunum kümesi başlığı | `<n> field changes`, `fields not shown` | Beş dakikalık sunum kümesinin satır sayısı başlığı ve alan adları gösterilmediğindeki özet |
| Etkinlik erişilebilirlik adları | `Filter Project Activity`, `Previous and next values`, `Each change in <n> field changes` | Filtre formunun, önceki–sonraki değerler listesinin ve küme açılış listesinin erişilebilirlik adları |
| Karar tarihi | `Decision date` | Karar kaydında kararın verildiği tarih alanı |
| Yerine geçilen tarih | `Superseded on` | Yerine yeni Karar geçen Kararın tarih etiketi |
| Geri çekilme tarihi | `Withdrawn on` | Geri çekilen Kararın tarih etiketi |
| Yeni bağlantı iste | `Ask the person who sent the link for a new link.` | Süresi dolmuş bağlantı sayfasındaki yönlendirme |
| Gösterilme nedeni | `Shown because: {reason}` | Release Evidence Pack satırında kaydın gösterilme nedeni |
| Yayını önizle | `Preview publish` | Yayın öncesi önizlemeyi açan eylem |
| Release notes'u yayımla | `Publish Release notes` | Release notes yayınını onaylayan eylem |
| Öğeyi onayla | `Approve {item}` | Release notes yayın dialogunda öğe onay eylemi |
| Onaylanan sayısı | `{n} of {m} approved` | Release notes yayın dialogunda onay ilerleme göstergesi |
| Davranışlar | `Behaviors`, `Add behavior` | Tasarım prototipinde davranış listesi ve ekleme eylemi |
| Davranış türleri | `Show / hide`, `Two-state transition`, `Hover / press`, `Sequential steps`, `Screen transition` | Tasarım prototipinde davranış türleri |
| Süre | `Duration`, `Fast`, `Normal`, `Slow`, `Slower` | Davranış süresi alanı ve değerleri |
| Hedef Ekran | `Target Screen` | Davranışın hedef ekranı alanı |
| Metin kaynağı | `Text source`, `Placeholder`, `Live section` | Tasarım metninin kaynağı alanı ve değerleri |
| Bölüm seç | `Choose a section` | Canlı bölüm kaynağı için bölüm seçimi |
| Kaydedildiğinde görülen metin | `Text seen when saved` | Kayıtlı sürümde canlı kaynaktan görülen metin |
| Güncel kaynağı aç | `Open current source` | Canlı bölüm kaynağının güncel hâlini açan eylem |
| Seçili bloklar | `Selected blocks` | Tasarım seçiminde seçili bloklar etiketi |
| Ekranın seçimi | `Selection of <Screen>` | Tasarım seçiminde ekrana ait seçim etiketi |
| Başlangıç Ekranı | `Start Screen` | Prototipin başlangıç ekranı |
| Çözülemeyen hedef | `Unresolved: <target>` | Çözülemeyen davranış hedefi etiketi |
| Özgünü indir | `Download original` | Görselin özgün Dosya Eki sürümünü kırpmasız indiren eylem |
| Dışa aktarma notu | `Export uses the presented view. The original file is unchanged and can be downloaded separately.` | Tasarım dışa aktarma açıklaması |
| Dışa aktarma kapasitesi dolu | `Export capacity is full. Try again in a moment.` | Eşzamanlı dışa aktarma kapasitesi dolunca gösterilen ret metni |
| Önceki köken | `Previous origin` | İçe aktarma önizlemesinde önceki köken |
| İlişkiyi eşle | `Map relation` | İçe aktarma önizlemesinde ilişki eşleme eylemi |
| İçe aktarma önizleme notu | `Preview does not change any record. The uploaded file is kept for at most 24 hours.` | İçe aktarma önizlemesinin kayıt değiştirmediğini söyleyen not |
| Redakte edilecek değer | `Value to redact` | Değer redakte etme dialogunda alan etiketi |
| Seçili İş sayısı | `{n} Work selected` | Toplu düzenleme dialogunda seçili İş sayısı |
| Toplu düzenleme notu | `Only the selected Work is changed.` | Toplu düzenlemede yalnız seçili İşin değiştiğini söyleyen not |
| Yalnız hâlâ açıksa kullanılamaz | `Only if still open is not available for this record type.` | Document, Decision ve Project Release kaynaklarında `Condition` açıklaması |
| Özellik reddi | `This Work is already included in a Feature.` | İkinci birincil Feature ilişkisi reddi |
| Sabitlenmiş bağlar notu | `Pinned binds and approved snapshots stay on the current version.` | Yeni sürüm yükleme önizlemesinde sabitlenmiş bağlar ve onaylı snapshot notu |
| Depolama %80 dolu | `Workspace storage is 80% full.` | Çalışma Alanı depolaması %80'e ulaşınca gösterilen uyarı |
| Depolama kotası aşıldı | `Storage quota exceeded. New uploads and versions are blocked; existing files stay readable, downloadable, and deletable.` | Kota aşılınca yeni yükleme ve sürümün kapalı olduğunu söyleyen metin |
| Kayıt değişti | `{Record type} changed. Cancel and reopen before saving again. Your text is kept here.` | Kayıt formlarında çatışma cümlesi deseni |
| Hesap kapanıyor | `This Account is closing. Only cancelling the closure and exporting are available.` | Hesap kapanırken ilgili ekranlarda gösterilen sabit metin |
| Sıra | `Rank` | Work filtresinde öncelik ölçütü kademesi |
| Zaman ölçeği | `Time scale` | Roadmap görünümünde zaman ölçeği seçicisi |
| Yoğunluk | `Density` | Roadmap görünümünde yoğunluk seçicisi |
| Kilometre Taşını düzenle | `Edit Milestone` | Roadmap Kilometre Taşı satırında düzenleme girişi |
| Bu Projede henüz Özellik yok | `No Features in this Project yet.` | Özellik ağacında Özellik yoksa gösterilen açıklama |
| Bağlam kopyalandı | `Context copied.` | İş Bağlam Kartı panoya kopyalanınca gösterilen toast |
| Dönüş kaydedildi | `Return recorded` | Devir geçmişi olay etiketi |
| Devir uzlaştırıldı | `Handoff reconciled` | Devir geçmişi olay etiketi |
| Devir iptal edildi | `Handoff canceled` | Devir geçmişi olay etiketi |
| Önizleme değişti | `Preview changed. Review it again.` | Önizleme kimliği bayatsa onay verilemeyeceğini söyleyen metin |
| GitHub kaydını yeniden dahil et | `Re-include`, `Confirm re-include` | Silinmiş GitHub kaydının tombstone satırından yeniden dahil edilmesi ve onayı |
| Yeniden dahil etme uyarısı | `Re-including creates a new record. It originates from the deleted GitHub record and is not the same identity.` | Yeniden dahil etmenin yeni kayıt ürettiğini söyleyen uyarı |
| Geri yükleme uyarısı | `Restoring syncs the record with GitHub now. Review the difference.` | Çöpten geri yüklenen GitHub kaydının hemen eşitleneceğini söyleyen uyarı |
| GitHub'da aç | `Open on GitHub` | Kaydı GitHub'daki sayfasında açma |
| GitHub inceleme ve birleştirme notu | `Review and merge happen on GitHub.` | İnceleme ve birleştirmenin GitHub'da yapıldığını belirten not |
| Öneriyi yok say | `Dismiss suggestion` | GitHub bağlama önerisini reddetme |
| GitHub kaydını bağla / bağı kaldır | `Link GitHub record`, `Unlink GitHub record` | İş ile GitHub kaydı arasındaki bağı kurma ve kaldırma |
| Proje Geçmişi | `Project History` | Hikâye ve etkinlik yüzeylerini birlikte taşıyan Proje geçmişi modülünün başlığı |
| Gerçekleşen olayların zaman çizelgesi | `Story Timeline` | Proje veya Özellik türündeki İşte önemli gerçekleşmiş olayları kronolojik gösteren hikâye görünümü |
| Gerçekleşmiş olay yok | `No realized events yet.` | Story Timeline'da gösterilecek gerçekleşmiş olay olmadığında boş durum metni |
| Hikâye olayı durumları | `Decided`, `Result recorded` | Story Timeline'da Karar olayının ve Deney/Doğrulama sonucu olayının durum etiketi |

- **Türkçe PRD terimi ile İngilizce UI etiketi iki ürün etiketi değildir.** PRD açıklaması ve domain tartışması Türkçe terimi, arayüz ve kesin kullanıcı metni İngilizce etiketi kullanır. Backtick/kod biçimi tek başına kesin UI copy'si olduğunu göstermez; kesin kullanıcı metni sözlükte veya açık `UI:` işaretiyle İngilizce verilir. Ürün adı, protokol, dış sağlayıcı alanı ve wire değeri kod biçiminde özgün adını koruyabilir; aynı arayüz bağlamında aynı kavram için iki İngilizce etiket kullanılmaz.

<a id="kapsam-ve-sahiplik"></a>
## Kapsam ve sahiplik

- **Her ana kayıt tam olarak bir sahiplik kapsamı taşır.** Kapsamların kapalı listesi `Hesap`, `Çalışma alanı`, `Proje` ve `Kişisel Wiki`dir:

- **`Hesap`:** Değişmeyen kimlik, profil tercihleri, oturumlar ve hesap güvenliği kayıtları.
- **`Çalışma alanı`:** Proje, Kişisel Wiki kabuğu, çalışma alanı genelindeki Etiket, Contact, Company, Ürün Boşluğu ve kişisel görünüm/yapılandırma kayıtları.
- **`Proje`:** İş, Proje Hedefi, Belge, Karar, Risk, Varsayım, Açık Soru, araştırma, tasarım, Teknik Diyagram, test, Kilometre Taşı, Proje Sürümü ve Üretim Olayı gibi proje kayıtları.
- **`Kişisel Wiki`:** Wiki Belgesi ve onun altında sahiplenilen Dosya Eki.

- **Hesap profili çalışma alanı içeriği değildir.** Değişmeyen GitHub hesap kimliği, GitHub kullanıcı adı ve görünen profil bilgisi; locale, saat dilimi, tarih biçimi, haftanın ilk günü, Appearance, deneysel Bitiriş efekti tercihi ile oturum listesi Hesap kapsamında tutulur. İngilizce arayüz dili kullanıcı tercihi değildir. Tercihlerin kullanıcı davranışı [Hesap profil tercihlerinde](03-account-platform-operations.md#hesap-profil-tercihleri), Bitiriş efektinin etkinleştirme ve tema davranışı ise [İş Yönetiminde](06-work-management-and-planning.md#bitiris-efektleri) yaşar; bu bölüm yalnız sahiplik kapsamını belirler.

- **Her kalıcı domain öğesi ya bu kapsamlardan tam olarak birinde yaşayan ana kayıttır ya da tek ana kaydın sahipli bileşenidir.** Sahipli bileşen sahibinden bağımsız erişim, kapsam veya yaşam döngüsü kazanamaz. GitHub bağlantısı ve dış GitHub kayıtları Proje kapsamındadır; bağlantı köken bilgisidir, sahiplik kapsamı değildir. `Proje bağlantısı`, `kaynak kapsamı` ve `Hesap + kaynak kayıt` kanonik kapsam değildir.

- **Dosya Eki tam olarak bir proje veya Kişisel Wiki kapsamına aittir.** Başka kapsamlardaki kayıtlar aynı eke standart ilişki kurabilir; bu ilişki ekin sahipliğini veya görünürlüğünü değiştirmez. Ekin başka kapsama taşınması ayrı `Taşı` eylemi, erişim etkisi ve kırılabilecek ilişkiler önizlemesi gerektirir. Aynı dosyanın iki kapsamda bağımsız yaşamı gerekiyorsa `Kopyala` yeni kimlik üretir.

- **Kapsam, görünürlük değildir.** Bir kaydın başka kayıtla ilişkisi, klasörü, üst belgesi, Akıllı Koleksiyon üyeliği veya görünümde bulunması erişim ya da yayın izni vermez.

<a id="ortak-kimlik"></a>
## Ortak kimlik

Her ana kayıt:

- **Değişmeyen, kullanıcıya anlam yüklemeyen iç teknik kimlik,**
- **Sahiplik kapsamı,**
- **Oluşturan aktör ve oluşturma zamanı,**
- **Son değiştiren aktör ve değiştirme zamanı,**
- **Arşiv ve çöp kutusu durumu,**
- **Denetlenebilir değişiklik geçmişi**

- **taşır.**

- **İş anahtarı, dış sistem kimliği, slug, e-posta ve başlık iç teknik kimliğin yerine geçmez.** Alias ve yönlendirmeler yalnız açıkça desteklenen kayıt birleştirmesinde emekli kimliği hayatta kalan kayda çözmek içindir; bir kaydı başka kapsama taşımak veya yeni kaydı eski kimliğe dönüştürmek için kullanılmaz. Silinen ya da emekli kimlik başka kayıt için yeniden kullanılmaz.

- **Kullanıcının başlattığı her durum değiştiren komut hedefin taban revizyonunu ve istemci tarafından üretilmiş idempotency anahtarını taşır.** Aynı anahtarla aynı istek önceki sonucu döndürür; farklı payload çatışma olur. Güncel olmayan taban revizyonu hiçbir zaman sessizce son yazan kazanır davranışıyla mevcut değerin üzerine yazmaz. Kayıt türünün tanımladığı çatışma veya uzlaştırma akışı çalışır; böyle bir akış yoksa yazma reddedilir ve güncel değer gösterilir.

- **GitHub webhook'u, Yetkili entegrasyon teslimi, Sistem otomasyonu, import finalize'ı ve restore replay'i insan istemcisi gibi sahte taban revizyonu üretmez.** Her giriş doğrulanmış kaynak kimliği, kaynak kapsamındaki kararlı olay/teslim kimliği, payload parmak izi ve ilgili hedefin commit anındaki revizyon koşuluyla eşdeğer tekrar-teslim ve kayıp-yazma koruması sağlar. Aynı kaynak kimliğiyle aynı payload önceki makbuzu döndürür; farklı payload çatışma veya güvenlik hatasıdır. Alan belgesi daha dar bir kaynak tekilleştirme ya da uzlaştırma kuralı tanımlıyorsa bu ortak garantileri korur.

<a id="ortak-yaşam-döngüsü"></a>
## Ortak yaşam döngüsü

| Mekanik | Ortak anlam |
| --- | --- |
| Aktif yaşam durumu | Kayıt türünün kendi iş akışı veya değerlendirme durumu |
| Kapanış sonucu | Tamamlanan veya vazgeçilen İş/Proje gibi türlerde kapanmanın nasıl gerçekleştiği |
| Arşiv | Kaydı normal çalışma yüzeylerinden kaldırır; kimliği, ilişkileri ve geçmişi korur |
| Çöp kutusu | Kaydı [güvenlik politikasındaki geri alınabilir silme süresine](13-data-security-and-portability.md#saklama-ve-guvenli-silme-sureleri) alır; aktif kural ve görünüm üyeliği üretmez |
| Kalıcı silme | Süre sonunda veya yüksek riskli açık kullanıcı eylemiyle içeriği geri döndürülemez kaldırır; gerekli tombstone kimliği ve denetim olayı kalabilir |
| Yeniden açma | Kayıt türünün açık eylemiyle etkin yaşama dönmesi; önceki kapanış geçmişte kalır |

- **Arşivleme yaşam durumunu değiştirmez.** Kapatma otomatik arşivlemez. Çöp kutusuna alma ilişkili bağımsız kayıtları kullanıcı onayı olmadan silmez. Kalıcı silme öncesinde bağımlılıklar ve dış görünürlük etkisi gösterilir.

- **Proje arşivi genel kayıt arşivinden daha güçlü bir yaşam sınırıdır:** Proje salt okunur ve hareketsiz olur; GitHub eşitlemesi, otomasyonlar, hatırlatmalar ve normal mutasyonlar durur. Daha önce açıkça onaylanmış değişmez Dış yüzeyler listelenerek yaşamaya devam edebilir. Salt okunur sınır yalnız erişimi azaltan denetlenebilir yüzey iptali, token/parola rotasyonu, oturum sonlandırma, entegrasyon kesme/secret rotasyonu ve güvenlik redaksiyonunu engellemez; yayın, reaktivasyon, parola kaldırma, içerik düzenleme ve erişim genişletme kapalı kalır. Proje silme yalnız Arşiv içinden başlatılır ve Proje ile yalnız ona kanonik olarak ait ana kayıt, sahipli bileşen ve Dış yüzeyleri tek geri yüklenebilir silme grubuna alır. Proje Çöp Kutusuna girdiği anda bu yüzeyler terminal olarak iptal edilir ve mevcut ziyaretçi oturumları kapatılır; `Onaylı dış yüzeyi koru` istisnası Proje, Çalışma Alanı veya Hesap silmede kullanılamaz. Çalışma alanı, Hesap veya Kişisel Wiki kapsamındaki kayıtlar silinmez; yaşayan ilişkiler silinen hedef işareti gösterir. Geri yükleme aynı kimlik ve içerikleri Arşiv durumuna getirir ve güvenli hedef işaretlerini yeniden bağlar, fakat iptal edilmiş yüzeyi yeniden etkinleştirmez; yeniden yayın yeni Dış yüzey, URL/token ve açık onay gerektirir. Grubun saklama süresi, erken ve süre sonundaki kalıcı silme ile kalabilecek içeriksiz denetim işaretleri [Veri Güvenliği ve Taşınabilirlik](13-data-security-and-portability.md#cop-kutusu-ve-geri-yukleme) belgesinde tanımlanır.

- **Arşivleme, silme ve Hesap kapatma gibi yüksek riskli yaşam geçişleri tek revizyon bariyerinde seri yürütülür.** Bariyerden önceki işlem iptal edilebiliyorsa iptal edilir; commit bariyerini geçmiş işlem bütünüyle commit veya rollback sonucuna ulaşır. Hesap kapatma ayrıca [Hesap kapatma sözleşmesindeki](03-account-platform-operations.md#hesap-kapatma) `Kapanış tamamlanıyor` geçişinde başlamış geri döndürülemez güvenlik işlerini kesin makbuza ulaştırmadan 30 günlük dondurmayı ve export'u açmaz. Sonraki normal mutasyonlar donmuş revizyona yazamaz.

<a id="korunan-urun-semantigi"></a>
## Korunan ürün semantiği

Kullanıcı aşağıdaki anlamları silemez veya başka anlam için yeniden kullanamaz:

- **İç teknik kimlik ve sahiplik kapsamı**
- **Kayıt türü**
- **Aktör ve zaman atfı**
- **Arşiv/çöp kutusu/kalıcı silme ayrımı**
- **İş ve Proje kapanış sonucu**
- **İlişki yönü ve ilişki uçları**
- **Proje Sürümü, Dış yüzey ve Onaylı snapshot revizyonu kimliği**
- **Teknik Diyagram türü, Diyagram otorite kipi ve kesin Diyagram Sürümü kimliği**
- **Dış kaynak sağlayıcı/kimlik/köken atfı**
- **Denetim ve güvenlik redaksiyonu olayları**
- **İş akışı durumu değerleri** (`Not Started`, `In Progress`, `Blocked`, `Closed`)

- **Kullanıcı alan görünürlüğünü, kullanıcıya dönük iş akışı durumu adlarını, özel alanları ve sunum sırasını alan PRD'lerinin izin verdiği ölçüde yapılandırabilir.** Yeni İş akışı durumu değeri eklenemez; yalnız korunan dört değerin görünen adı değişebilir.

<a id="ana-kayıt-türleri-ve-asgari-sözleşmeler"></a>
## Ana kayıt türleri ve asgari sözleşmeler

| Kayıt | Sahiplik | Asgari alanlar | Yaşam durumu |
| --- | --- | --- | --- |
| Proje | Çalışma alanı | Ad, kısa kod; isteğe bağlı amaç, problem ve kapsam | `Aktif`, `Bekleyen`, `Tamamlandı`, `Vazgeçildi` |
| Kişisel Wiki | Çalışma alanı | Ad, klasör ve belge kökleri | Aktif; çalışma alanıyla birlikte silinir |
| Proje Hedefi | Proje | Başlık, açıklama | Açık/kapanmış durum üretmez; sonuç kullanıcı alanlarında değerlendirilir |
| İş | Proje | Anahtar, başlık, tür, durum | Başlangıçta `Not Started`, `In Progress`, `Blocked`, `Closed`; Proje tanımlı kullanıcı adları + `Tamamlandı`/`Vazgeçildi` kapanış sonucu |
| Kilometre Taşı | Proje | Başlık, açıklama, isteğe bağlı hedef tarihi | `Planlandı`, `Ulaşıldı`, `Vazgeçildi`; durum İşleri değiştirmez |
| Belge | Proje veya Wiki | Başlık, Markdown gövdesi, sürüm | Aktif/arşiv/çöp kutusu |
| Dosya Eki | Proje veya Wiki | Dosya adı, MIME, boyut, içerik parmak izi, sürüm | Aktif/arşiv/çöp kutusu |
| Karar | Proje | Başlık, karar, gerekçe | `Geçerli`, `Yerine geçildi`, `Geri çekildi` |
| Risk | Proje | Başlık, açıklama, etki, olasılık, yanıt/azaltma | `Açık`, `Azaltılıyor`, `Gerçekleşti`, `Çözüldü`, `Kabul edildi` |
| Varsayım | Proje | İfade, gerekçe, kanıt ilişkileri | `Açık`, `Doğrulandı`, `Çürütüldü`, `Geçersiz kaldı` |
| Açık Soru | Proje | Soru, bağlam | `Açık`, `Yanıtlandı`, `Geçersiz kaldı` |
| Geri Bildirim | Proje | Özgün mesaj, zaman, kanal | `Yeni`, `İncelendi`, `Arşivlendi`; ilişkili İş durumunu değiştirmez |
| Kaynak | Proje | URL/başlık, erişim zamanı, yakalanan içerik | Aktif/arşiv; sürümler tarihsel kalır |
| Contact | Çalışma alanı | İsteğe bağlı ad, e-posta takma değerleri | Aktif/arşiv/çöp kutusu; birleştirilen kopya ana kayıt olarak sona erer ve kimliği içeriksiz yönlendirme olur |
| Company | Çalışma alanı | Ad | Aktif/arşiv/çöp kutusu |
| Ürün Boşluğu | Çalışma alanı | Karşılanmayan ihtiyaç, durum | `Açık`, `Değerlendiriliyor`, `Karşılandı`, `Bilinçli sınır` |
| Dış Araca Kaçış | Çalışma alanı | Zaman, kaynak proje/kayıt, dış araç, neden, etki | Tarihsel olay; ilişkili Ürün Boşluğunu köken olarak gösterir, silme ortak kurallara uyar |
| Kullanıcı Araştırması Oturumu | Proje | Amaç, soru rehberi, tarih, not ve izin bağlamı | `Planlandı`, `Tamamlandı`, `İptal edildi` |
| Deney/Doğrulama | Proje | Yöntem, sonuç, ilişkili varsayım/soru | Aktif/arşiv/çöp kutusu |
| Tasarım | Proje | Tür, sürüm, yapı ve görünüm üstverisi | Aktif/arşiv/çöp kutusu; tür `Proje Duvarı`, `Kullanıcı Akışı` veya `Moodboard` |
| Ekran | Proje | Başlık, Wireframe sürümleri | Aktif/arşiv/çöp kutusu; görsel tasarım olmadan oluşturulabilir |
| Teknik Diyagram | Proje | Başlık, tür, Diyagram otorite kipi; ürün-owned kiplerde türlenmiş yapısal model ve görünüm üstverisi, dış bağlantı kipinde kesin köken üstverisi | Aktif/arşiv/çöp kutusu; tür `Teknik Mimari`, `Veri Modeli` veya `Teknik Sıra` |
| Akıllı Koleksiyon/kayıtlı görünüm | Çalışma alanı veya Proje | Ad, kaynak tür, filtre, sıralama ve sunum | Aktif/arşiv/çöp kutusu; üyelik sorgudan türetilir |
| Şablon | Proje veya Kişisel Wiki | Tür, ad, içerik/yapı tanımı | Aktif/arşiv/çöp kutusu; üretilen kayıt bağımsız kimlik alır |
| Otomasyon kuralı/kayıt eylemi | Proje | Ad, etkin tanım ve sürüm | Etkin/devre dışı/arşiv/çöp kutusu |
| Hatırlatma | Hesap | Zaman, kaynak kimliği | `Planlandı`, `Tetiklendi`, `İptal edildi`; kaynak sahiplik değil köken referansıdır |
| Üretim Olayı | Proje | Zaman, etki, tespit, çözüm | `Açık`, `İzleniyor`, `Çözüldü` |
| Proje Sürümü | Proje | Ad/sürüm etiketi, kapsam, yayın kontrol listesi | `Taslak`, `Hazırlanıyor`, `Yayımlandı`, `İptal edildi` |
| GitHub bağlantısı | Proje | Kararlı repository kimliği, yetki ve eşitleme durumu | `Bağlı`, `Duraklatıldı`, `Bağlantı kesildi`; ad/sahip kimlik değildir |
| GitHub dış kaydı | Proje | Sağlayıcı kimliği, tür, URL, kaynak durumu, eşitleme zamanı | Salt okunur dış gerçek ve bağımsız yerel Arşiv/Çöp Kutusu yaşamı; bağlantı kalkarsa son yakalanan durum tarihsel kalır |
| Dış yüzey | Yayın köküyle aynı Çalışma alanı, Proje veya Kişisel Wiki kapsamı | Kararlı URL/anahtar, erişim türü, parola, süre ve etkinlik durumu | `Aktif`, `Süresi doldu`, `İptal edildi`; iptal terminaldir, kaynak yaşam durumunu değiştirmez |

- **Yakalama Gelen Kutusu öğesi ve tamamlanmamış İş Taslağı geçici varlıklardır; ana kayıt kimliği, kalıcı ilişki, arşiv veya export davranışı kazanmaz.** `Geçici` zaman aşımı anlamına gelmez: kullanıcı triage edip tamamlayana ya da açıkça silene kadar otomatik silinmezler. Sahiplikleri hedef seçilene kadar hesap/çalışma alanı, hedef proje seçildiğinde proje bağlamıdır. Ana kayda dönüşüm yeni kimlik üretir ve kökeni korur.

- **Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Test Açığı ve Test değerlendirmesi Proje kapsamındaki ana kayıtlardır; uzman alanları ve yaşam durumları [Test ve Doğrulama](10-testing-and-validation.md) tarafından tanımlanır.** Oturum Testi ana kayıt değil, Test Oturumunun sahipli bileşenidir; kendi inceleme durumunu taşır fakat bağımsız arşiv, çöp kutusu, geri yükleme veya paylaşım yaşamı kazanmaz. Dış yüzey ve Onaylı snapshot revizyonunun ayrıntılı kapsamı [Paylaşım ve Yayınlama](14-sharing-and-public-publishing.md) tarafından tanımlanır.

- **Bu envanter ve açıkça yönlendirilen test alt türleri ilk ürünün desteklenen kalıcı kayıt kümesidir.** İlk ürün belgelerinde `desteklenen diğer kayıt`, `desteklenen alan` veya benzeri açık uçlu ifade yeni yetenek oluşturmaz; izin verilen tür ve alanlar aynı cümlede kesin olarak listelenir. Yeni ana kayıt türü ilk üründe bu tabloya, sonraki kapılı genişlemede ise etkinleştiren alan belgesindeki açık domain uzantısına sahiplik, asgari alan ve yaşam durumuyla eklenmeden kapsama alınamaz.

Ana kaydın yanında yaşayan kalıcı yardımcı varlıklar da aşağıdaki kapalı listeyle sınırlıdır:

| Yardımcı varlık | Sahibi | Yaşam ve silme davranışı |
| --- | --- | --- |
| Proje aşaması, İş durumu, özel alan ve öncelik ölçütü tanımı | Proje | Sürümlü yapılandırmadır; yapılandırma çöp kutusuna girer, kayıt değerleri etki önizlemesi olmadan silinmez |
| İş Bağlam Kartı düzeni | Proje | İş türüne göre desteklenen modül, doğrudan ilişki filtresi ve sunum sırasını taşıyan sürümlü yapılandırmadır; İş içeriği veya ikinci bağlam kaydı değildir |
| Odak Dönemi ve başlangıç/kapanış snapshot'ı | Çalışma alanı | `Planlandı`, `Etkin`, `Kapandı`, `İptal edildi`; kapanan kapsam tarihsel kalır |
| Oturum Testi | Test Oturumu | Oturumda bağımsız olarak denendiği bildirilen davranışı ve iki katmanlı sonucunu taşır; kendi inceleme durumu vardır fakat oturumla tek tarihsel bütün olarak arşivlenir, çöp kutusuna girer ve geri yüklenir |
| Backlog manuel sırası | Proje | Projedeki tek kalıcı manuel İş sıralamasını taşır; İş alanı veya planlama görünümü üyeliği değildir ve alternatif sıralama seçildiğinde arka planda korunur |
| Günlük Odak üyeliği | Çalışma alanı | Kullanıcının seçili gün için bilinçli olarak seçtiği İşleri taşıyan kişisel görünüm kaydıdır; İş durumunu, önceliğini, proje aşamasını veya Backlog sırasını değiştirmez |
| Önceliklendirme oturumu | Proje | Adlandırılmış karar görünümünün İş kapsamını ve görünüm-yerel manuel sırasını taşır; Backlog sırasını, öncelik ölçütü değerlerini veya İş durumunu değiştirmez, normal arşiv/çöp kutusu kurallarına uyar |
| `Şimdi değil` karar izi | İş | Etkin erteleme gerekçesini, isteğe bağlı yeniden değerlendirme koşulunu ve dayanak ilişkilerini taşır; ayrı yaşam durumu, kapanış sonucu, planlama üyeliği veya Karar kaydı oluşturmaz |
| Manuel Proje Güncellemesi | Proje | Tarihli ve değişmez özet snapshot'ı taşır; normal arşiv/çöp kutusu kurallarına uyar |
| Proje kapanış özeti | Proje | Kullanıcı tarafından kaydedilen sürümlü Belgedir; Projenin durumunu değiştirmez |
| Dış yürütme devri | İş | Belirli bir test-dışı araç çalışmasının kesin gidiş bağlamını, dönüşünü, uzlaştırmasını veya gerekçeli iptalini tarihsel tutar; İşten bağımsız aranamaz, paylaşılamaz, taşınamaz veya yaşam döngüsü kazanamaz |
| Erişim gözlemi | Proje Sürümü | Belirli bir değerlendirme turunda hedef kitleye erişim değerlendirmesini, yazarını ve yalnız o gözleme ait kesin kanıt bağlarını taşır; Sürümden bağımsız yaşamaz ve Sürümün genel kanıt bağlarıyla birleşmez |
| Sonuç gözlemi | Proje Sürümü | Belirli bir değerlendirme turunda hedeflenen davranış/sonuç değerlendirmesini, yazarını ve yalnız o gözleme ait kesin kanıt bağlarını taşır; Sürümden bağımsız yaşamaz, Erişim gözleminin yerine geçmez ve Sürümün genel kanıt bağlarıyla birleşmez |
| Kaynak Kontrolü olayı ve aday snapshot | Kaynak | Tarihsel kontrol sonucudur; ana Kaynak sürümünü açık onay olmadan değiştirmez |
| Düzeltme, geri çekme ve redaksiyon olayı | Test veya hassas kayıt | Özgün olayla birlikte tarihsel kalır; redakte edilen değer geri getirilemez |
| Bildirim sinyali ve okundu/kapatıldı durumu | Hesap | Kaynak kimliği köken referansıdır; yeni doğruluk kaynağı değildir, kaynak silinirse içerik yerine güvenli tombstone gösterir |
| Değişiklik/denetim olayı | Değiştirilen kayıt | Normal geçmiş ve saklama süresini izler; ana içerik gibi düzenlenmez |
| İlişki üstverisi ve Kanıt Rolü | İlişki | İlişkinin yazarını, zamanını, rolünü ve yorumunu taşır; iki uçtan bağımsız ana kayıt değildir |
| Akış düğümü/görsel kart | Tasarım | Kaynak kimliği, görünüm-yerel konum ve sunumdur; ana içerik değildir, kaynak silinirse kırık referans olur |
| Diyagram Görünümü | Teknik Diyagram | Aynı yapısal modelin seçilmiş öğelerini, adlandırılmış yerleşim ve görünüm notlarıyla gösterir; kaynak öğeleri kopyalamaz, bağımsız erişim kapsamı veya içerik kaynağı olmaz |
| Diyagram Sürümü | Teknik Diyagram | Kullanıcının adlandırdığı değişmez yapısal model ve görünüm checkpoint'idir; canlı diyagramı değiştirmez, kesin ilişki/paylaşım/export kaynağı olabilir |
| Şema Değişiklik Taslağı | Veri Modeli Diyagramı | İki kesin Diyagram Sürümü arasındaki türlenmiş operasyonları, bağımlılık sırasını ve destructive uyarıları taşır; onaylanmadan kesin artefakt veya uygulanmış migration değildir |
| Migration Artefaktı | Veri Modeli Diyagramı | Onaylanmış Şema Değişiklik Taslağını kaynak/hedef Diyagram Sürümü, generator sürümü, `Migration Artifact Digest`, statik doğrulama ve uyarı manifestiyle değişmez korur; çalıştırılma veya uygulanmışlık durumu taşımaz. Aynı diyagram içinde sonraki düzeltme artefaktı değişmez `Supersedes Migration Artifact` pointer'ı taşır; eski kanıtı miras almaz |
| Onaylı snapshot revizyonu | Dış yüzey | Kesin içerik ve Dosya Eki sürümü manifestidir; Dış yüzey yaşadığı sürece içte korunur, bağımsız paylaşılamaz |
| Çakışma Taslağı | Belge | Güncel olmayan yazmayı kullanıcı uzlaştırana, aynı kapsamta köken bağı taşıyan bağımsız Belgeye dönüştürene veya silene kadar korur; çözülmeden arama, paylaşım, export ve Belge geçmişine girmez |
| Emekli kimlik yönlendirmesi | Çalışma alanı | Eski kimliği hayatta kalan kayıt veya içeriksiz silinmiş-hedef işaretine çözer; içerik veya bağımsız yaşam döngüsü taşımaz ve Çalışma Alanından uzun yaşayamaz |
| Köken konumu | Hedef ana kayıt | Sahipli bileşen kaynağının sahip kimliğini, bileşen kimliğini ve kesin sürümünü değişmez taşır; bağımsız uç değildir |
| Yakalama staging eki | Yakalama Gelen Kutusu öğesi | Şifreli geçici nesnedir; arama, paylaşım, yayın ve export dışındadır. Dönüşümde atomik Dosya Ekine terfi eder veya yakalamayla silinir |
| Son ziyaret işareti | Hesap | Proje ve desteklenen İş bağlamı başına yalnız son başarılı görünür açılış zamanıdır; görüntüleme geçmişi, süre, analytics veya denetim olayı değildir |
| Proje silme grubu | Silinen Proje | Proje ve ona ait kayıtları tek geri yükleme/kalıcı silme sınırında tutar; çocuklara bağımsız yaşam vermez |

- **Liste dışındaki görünüm düğümü, kart, sayaç, arama sonucu, takvim satırı ve özet yalnız ana kayıtların sunumudur; kendi bağımsız yaşam döngüsünü kazanmaz.**

<a id="proje-aşaması-sözleşmesi"></a>
## Proje aşaması sözleşmesi

- **Her proje aşaması `Planlanmadı`, `Hazır`, `Aktif`, `Tamamlandı` veya `Vazgeçildi` durumlarından birini taşır.** Birden fazla aşama `Aktif` olabilir. Aşama durumu içerik erişimini, İş durumunu veya başka aşamayı otomatik değiştirmez. Aşama kaldırılırken ona bağlı sunum ve filtreler önizlenir; ana kayıtlar silinmez.

<a id="standart-ilişki-türleri"></a>
## Standart ilişki türleri

| İlişki | İzin verilen uçlar | Kardinalite ve silme davranışı | Anlam |
| --- | --- | --- | --- |
| `İlgili` | Herhangi iki ana kayıt; kesin Diyagram Sürümü ↔ İş/Karar/Proje Sürümü; Migration Artefaktı ↔ GitHub dış kaydı/Test Oturumu/Proje Sürümü | Çoktan çoğa; bir uç veya sahip ana kayıt silinirse kalan uçta kırık/tarihsel bağ görünür | Semantik bağ; yaşam döngüsü veya migration uygulanmışlığı etkisi yoktur |
| `Kökeni` / `Türetilen` | Kaynak, Belge, Yakalama, Geri Bildirim, Teknik Diyagram, İş, Test Oturumu, Kullanıcı Araştırması Oturumu veya Test Açığı → üretilen ana kayıt | Bir kayıt birden fazla köken taşıyabilir; köken silinirse atıf tombstone'a döner. Sahipli bileşen bağımsız uç değildir; hedef ayrıca `Köken konumu` taşıyabilir | Kaydın hangi kaynak veya açık dönüşümden doğduğunu gösterir; genel `İlgili` kesin provenance yerine geçmez. Teknik Diyagram otorite dönüşümü kaynak ve yeni kimliği bu bağla ayırır |
| `Kanıtı` / `Kanıt sağlar` | Kesin Kaynak sürümü, Belge sürümü veya Diyagram Sürümü, Geri Bildirim, Kullanıcı Araştırması Oturumu, Deney/Doğrulama, Oturum Testi veya Dosya Eki sürümü → İş/Karar/Risk/Varsayım/Soru/Test/Proje Sürümü ya da ona ait Erişim/Sonuç gözlemi | Çoktan çoğa; gözlem hedefli bağ yalnız o sahipli gözlemde yaşar, kesin sürüm silinemezse redaksiyon işareti kalır | Hedef kayda veya belirtilen gözleme kanıt bağını gösterir; gözlem kanıtı üst Proje Sürümünün genel kanıtı sayılmaz, test sonucu yalnız bildirildiği kesin bağlamla kanıttır |
| `Hedefe katkı` / `Hedef kapsamında` | İş, Kilometre Taşı veya Proje Sürümü → Proje Hedefi | Çoktan çoğa; uç silinirse tarihsel bağ | Hedefe katkı üyeliği; Karar, kanıt ve test Hedefe doğrudan bağlanmaz, ilgili İş/Sürüm zincirinden gelir. Yaşam durumu veya kapanış sonucu etkisi yoktur |
| `Engeller` / `Engellenir` | İş, Karar veya Açık Soru → İş | Çoktan çoğa; `Aktif`/`Çözüldü` durumlu ilişki, uç silinirse tarihsel bağ | Planlama blokajı |
| `Kapsar` / `Kapsanır` | Özellik → İş | Bir İşin en fazla bir birincil Özelliği, ek Özelliklerle `İlgili` bağı olabilir | Açık kapsam üyeliği |
| `Kilometre taşına katkı` / `Kilometre taşı kapsamında` | İş → Kilometre Taşı | Çoktan çoğa; uç silinirse tarihsel bağ | Ara sonuca katkı üyeliği; hiçbir uçta yaşam durumu, kapanış sonucu veya hedef tarihi etkisi yoktur |
| `Birincil spec` | İş/Özellik → kesin Belge sürümü | Kaynak başına en fazla bir güncel bağ; önceki bağ geçmişte korunur | Uygulama için ana tanım |
| `Yerine geçer` / `Yerine geçildi` | Aynı uzman türde Karar, Deney/Doğrulama veya kesin Oturum Testi | Yönlü ve döngüsüz; eski kayıt silinmeden tarihsel kalır | Tarihsel geçiş; Oturum Testleri arasındaki yerine-geçme de bu türü kullanır ve ayrı uzman ilişki adı üretmez |
| `Uygular` / `Uygulanır` | İş/PR/Proje Sürümü → Karar veya spec | Çoktan çoğa; uç silinirse tarihsel bağ | Karar/spec ile uygulama kaydı bağlamı |
| `Şirkete ait` | Contact → Company | Contact başına en fazla bir güncel Company; geçmiş değişiklikte korunur | Hafif kuruluş bağlamı |
| `Katılımcısı` | Kullanıcı Araştırması Oturumu/Geri Bildirim → Contact | Kayıt başına sıfır veya bir Contact; Contact silinirse kişisel değer redakte edilir | Katılımcı/geri bildirim kaynağı kimliği |
| `Tamamlanma için gerekli` / `Bağlamsal` | İş ↔ GitHub PR | Çoktan çoğa; bağlantı kaldırma dış PR'ı değiştirmez | PR'ın İş kapanışındaki rolü |

- **İlişki türü kullanıcı tarafından serbestçe oluşturulmaz.** Tabloda bulunmayan uzman ilişki ilk ürün davranışı olamaz; yeni tür bu tabloya uçları, kardinalitesi ve silme etkisiyle eklenir. İlişki eklemek kaynak kayıtların durumunu değiştirmez; alan PRD'sindeki açık blokaj, yerine-geçme veya etkin PR otomasyonu istisnadır. Kesin provenance `Kökeni`, kanıt `Kanıtı`, hedef üyeliği `Hedefe katkı` kullanır; genel `İlgili` bunların yerine geçmez.

<a id="koken-konumu"></a>
## Köken konumu

- **İki uç da ana kayıtsa köken yalnız standart `Kökeni` ilişkisidir.** Kaynak bir sahipli bileşense — kontrol listesi maddesi, Wireframe düğümü, Oturum Testi veya eşdeğer öğe — hedef ana kayıt ayrıca değişmez `Köken konumu` taşır: sahip ana kayıt kimliği, bileşen kimliği ve kesin kaynak sürümü. Sahipli bileşen bağımsız ilişki ucu, arama sonucu veya ana kayıt olmaz.

- **Kaynak öğe silinir, redakte edilir veya çözülemezse sahip ana kayıtla `Kökeni` ilişkisi yaşar; `Köken konumu` `Kaynak öğe artık yok` olarak açıklanır.** Sistem başka maddeye, en yeni sürüme veya benzer öğeye sessizce kaymaz.

<a id="kullanim-baglari"></a>
## Kullanım bağları

- **Kullanım bağı semantik ilişki değildir; bir içeriğin hangi yüzeyde kullanıldığını gösteren türetilmiş bağdır.** Kapalı listesi Belge gövdesindeki satır içi kayıt referansı, kararlı Belge bölümü referansı, canlı içerik bloğu, Dosya Eki veya Wireframe yüzeyindeki konuma sabitlenmiş bağ ve akış düğümünün Ekran referansıdır. Yeni bir kullanım bağı türü bu listeye eklenmeden ilk ürün davranışı olamaz.

- **Kullanım bağı standart ilişki tablosuna girmez.** İlişki üstverisi veya Kanıt Rolü taşımaz, kardinalite kuralı dayatmaz ve iki uçtan hiçbirinin yaşam durumunu, kapanış sonucunu ya da planlama üyeliğini değiştirmez.

- **Kaydın `Kullanıldığı yerler` yüzeyi standart ilişkilerden türeyen geri bağlantıları ve kullanım bağlarını kaynak türüne göre ayrı gösterir.** İki küme tek liste hâlinde birleştirilmez ve kullanım bağı ilişki olarak adlandırılmaz.

- **Kullanım bağı kurmak veya kaldırmak kalıcı ilişki oluşturmaz.** Kalıcı ilişki yalnız açık kullanıcı eylemi, kesin iki uç ve fark önizlemesiyle standart ilişki türlerinden biri olarak kurulur.

<a id="kirik-referans-sunumu"></a>
## Kırık referans sunumu

- **Hedefi çözülemeyen her kullanım bağı, canlı blok, canlı kart ve ilişki ucu ortak kırık referans sunumunu kullanır.** Sunum bağın var olduğunu, hedefin neden çözülemediğini ve bağın kurulduğu zamanı gösterir; çözülememe nedeni `Arşivlendi`, `Çöp Kutusunda`, `Kalıcı silindi`, `Güvenlik nedeniyle redakte edildi` ve `Erişim yok` değerlerinden biridir.

- **Hedefin son bilinen içeriği, gövdesi, alan değerleri veya görsel önizlemesi kırık durumda gösterilmez.** Kullanıcıya güncelmiş gibi görünen hiçbir değer sunulmaz ve eski içerik cache'ten yeniden çizilmez.

- **Hedefin başlığı yalnız kullanıcının o hedefe hâlâ erişim yetkisi varken gösterilir.** Kalıcı silinmiş hedefte içeriksiz tombstone işareti; güvenlik redaksiyonunda yalnız redaksiyon işareti, zamanı, gerekçesi ve işlemi yapan aktör; kapsam dışı hedefte ise ad, sayı ve ilişki ucu sızdırmayan nötr işaret gösterilir.

- **Kırık referans başka bir kayda çözülmez.** Emekli kimlik yönlendirmesi yalnız desteklenen kayıt birleştirmesinde çalışır; ürün en yakın, en yeni veya en benzer kaydı hedef olarak sunmaz.

- **Arşivlenmiş veya Çöp Kutusundaki hedefte `Kaynak kaydı aç` eylemi korunur ve kullanıcıyı hedefin güncel yaşam durumundaki görünümüne götürür.** Kalıcı silinmiş, redakte edilmiş veya erişilemeyen hedefte bu eylem gösterilmez.

- **Kırık referans hedefin içeriğiyle arama sonucuna, Akıllı Koleksiyon üyeliğine, hesaplanmış sayıya veya dışa aktarmaya girmez.** Dış yüzeyde davranışı [ortak snapshot ve dış görünürlük güvenliği](14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi) belirler; kırık hedef hiçbir durumda paylaşım kapsamını genişletmez.

- **Kırık referans kendiliğinden dikkat sinyali, takip işi veya sağlık hükmü üretmez.** Hedef geri yüklenirse bağ aynı kimlikle yeniden çözülür ve önceki kırık durum geçmişte kalır.

<a id="değişiklik-geçmişi-aktör-ve-geri-alma"></a>
## Değişiklik geçmişi, aktör ve geri alma

- **Aktör türleri `Kullanıcı`, `Sistem otomasyonu`, `GitHub` ve `Yetkili entegrasyon`dur.** AI ajanı veya harici araç, doğrulanmış entegrasyon kimliği ve onu yetkilendiren kullanıcıdan ayrı gösterilir.

- **Her değişiklik hedef kaydı, aktörü, zamanı, kökeni ve desteklenen alanlarda önceki/sonraki değeri taşır.** Geri alma:

- **Yalnız ürünün ters işlemi deterministik hesaplayabildiği alan, ilişki, görünüm üstverisi ve atomik dönüşümlerde `güvenli` sayılır.**
- **Kalıcı silme, güvenlik redaksiyonu, dış sistem mutasyonu, yayınlanmış statik export ve aynı alanda daha yeni değerle çatışan değişiklik güvenli otomatik geri alma değildir.**
- **İlgisiz sonraki değişiklikleri geri sarmaz; aynı alandaki çatışmayı kullanıcıya gösterip durur.**

- **Birleştirmeyi açıkça destekleyen İş ve Contact kayıtlarında gerçek kopyalar fiziksel olarak tek hayatta kalan ana kayıtta konsolide edilir.** Onay önizlemesi hayatta kalanı, alan çakışmalarını ve yeniden yazılacak ilişkileri gösterir. İç referanslar aynı atomik işlemde hayatta kalana yazılır; kopyalar ayrı `Birleştirildi` kayıtları olarak yaşamaz. Emekli kimlik yönlendirmesi eski bağlantı ve anahtarı kalıcı, görünür kökenle çözer; emekli kimlik yeniden kullanılmaz ve ayrı arama sonucu oluşturmaz. Birleştirilmiş geçmiş, özgün kayıt ve aktör atfını korur.

- **Birleştirmeyi geri alma özgün emekli kimliği yeniden ana kayıt yapar ve yalnız birleştirme olayına atfedilebilen değer ve ilişkileri ayırır.** Birleştirme sonrasındaki ilgisiz değişiklikleri geri sarmaz; aynı alanda çakışan sonraki değer kullanıcı kararı ister. Kalıcı silme veya güvenlik redaksiyonuyla yok olmuş içerik tam geri alma vaadini kaldırır ve eksik kalan kısım önizlemede açıklanır.

- **Ana kayıt içeriği ve domain geçmişi ana kayıt yaşadığı sürece korunur.** Denetim ve operasyon kayıtlarının süreleri ile geri döndürülemez güvenlik redaksiyonu [Veri Güvenliği ve Taşınabilirlik](13-data-security-and-portability.md#saklama-ve-guvenli-silme-sureleri) belgesinin sorumluluğundadır.
