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
| Özellik | `Feature` | İş türü |
| Kullanıcı Akışı | `User Flow` | Kullanıcının arayüz hedefi ve karar yolunu taşıyan tasarım türü |
| Herkese açık | `Public` | Dışarıdan anonim erişilebilen kullanıcı görünürlüğü; `Build in Public` ürün adı, teknik alan ve wire değerleri özgün adını korur |
| Özel | `Private` | Dış erişime kapalı kullanıcı görünürlüğü |
| Dış yüzey | `External Surface` | Ziyaretçi URL'si, erişim anahtarı, parola, süre ve etkinlik durumunu taşıyan paylaşım/yayın ana kaydı |
| Onaylı snapshot revizyonu | `Approved Snapshot Revision` | Dış yüzeyin belirli onay anında göstermesine izin verilen değişmez kesin içerik manifesti; Dış yüzeyden bağımsız yaşayamaz |
| Üstveri | `Metadata` | Teknik şema alanları dışında kullanıcıya gösterilen üstveri kavramı |
| Persona | `Persona` | Hedef kullanıcı profilini taşıyan Belge türü; ayrı ana kayıt türü değildir ve Contact ya da Company'nin yerine geçmez |
| AI ajanı | `AI Agent` | `AI agent` ve `agent` varyantlarının ortak kavramı |
| Repository | `Repository` | GitHub'ın dış sistem kavramıdır; genel “depo” eşanlamlı kayıt türü oluşturmaz |
| Teknik Diyagram | `Technical Diagram` | Veri modeli, teknik mimari veya sistemler arası sıralı etkileşimi bağımsız kimlik ve türlenmiş yapısal modelle taşıyan Proje ana kaydı |
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
| Odak Dönemini kapat | `Close` | Yalnız `Active` dönemden kapanış-kapsamı snapshot’ı ve açık kalan İş kararı |
| Odak Dönemini iptal et | `Cancel` | `Planned` veya `Active` dönemi kapanış hesabı olmadan bitirme |
| Başlangıç tarihi | `Start date` | Odak Dönemi penceresinin ilk günü |
| Bitiş tarihi | `End date` | Odak Dönemi penceresinin son günü |
| Açık kalan İş | `Still-open Work` | Kapanışta toplu karar bekleyen açık İş listesi |
| Odak Dönemi yok | `No Focus Period yet.` | Henüz dönem açılmamış boş durum |
| Odak Dönemi penceresi | `Focus Period must be 1–8 weeks.` | 1–8 hafta dışı oluşturma reddi |
| Başka etkin döneme taşı | `Move` | İşin mevcut etkin Odak Döneminden açıkça başka etkin döneme alınması |
| Zaten etkin dönemde | `Work is already in an active Focus Period. Use Move.` | Örtük ikinci etkin üyelik reddi |
| Amaç gerekli | `Purpose is required.` | Boş Odak Dönemi amacı reddi |
| Açık kalanı gönder | `Send` | Kapanışta seçili açık İşleri toplu kararla gönderme |
| Sonraki dönem | `Next period` | Açık kalan İşin sonraki Odak Dönemine gönderilmesi |
| Başka dönem | `Another period` | Açık kalan İşin seçilen başka Odak Dönemine gönderilmesi |
| Odak Döneminde vazgeç | `Abandon` | Kapanışta açık kalan İşi açık kapatma adımıyla `Abandoned` yapmak |
| Başlangıç snapshot’ında | `In start snapshot` | Kapanış karşılaştırmasında başlangıç kapsamında bulunan İş |
| Sonradan eklenen | `Added later` | Başlangıçtan sonra kapanış kapsamına giren İş |
| Kapsamdan çıkan | `Removed` | Başlangıç kapsamındayken kapanışta bulunmayan İş |
| Dönem değerlendirmesi | `Period evaluation` | Kapanışta atlanabilir öğrenim metni |
| Atla | `Skip` | Dönem değerlendirmesini atlama |
| Sürdür | `Keep` | Değerlendirmede sürdürülecek öğrenim |
| Değiştir | `Change` | Değerlendirmede değiştirilecek öğrenim |
| Sonrakinde dene | `Try next` | Sonraki dönemde denenecek öğrenim |
| Onayla | `Confirm` | Takip İş önizlemesini onaylayıp oluşturma |
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
| Kapsam | `Scope` | İsteğe bağlı Proje profil alanı; Open Source Library hazır aşama adı da `Scope` kullanır |
| Hedef tarihi | `Target date` | İsteğe bağlı Proje hedef tarihi |
| Logo | `Logo` | İsteğe bağlı Proje logosu; Proje rengi, CSS veya font değildir |
| Proje oluştur | `Create Project` | Yeni Projeyi kaydeden eylem |
| Projeler | `Projects` | Çalışma Alanındaki Proje listesi |
| Kısa kodu kaydet | `Save Short code` | İlk İşten önce kısa kodu güncelleme eylemi |
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
| Canlı blok ekle | `Add live block` | Mevcut Belge veya adlandırılmış Akıllı Koleksiyon görünümünü kopyasız referans olarak ekleme |
| Kaydedilmiş çapraz Proje listesi | `Saved lists` | Çalışma Alanı çapında Proje koşullarından canlı üyelik türeten adlandırılmış görünüm; Portfolio veya Akıllı Koleksiyon değildir |
| Listeyi kaydet | `Save list` | Çapraz Proje listesi koşullarını ve görünümünü kaydetme |
| Son bildirilen sağlık | `Last reported health` | Son Manuel Proje Güncellemesinin tarihiyle gösterilen sağlık işareti; güncel Project health alanı değildir |
| Üyelik koşullardan gelir | `Membership comes from list conditions.` | Sürükleyerek liste üyesi eklenemeyeceğini söyleyen metin |
| Kolonlar | `Columns` | Kaydedilmiş çapraz Proje listesinde saklanan desteklenen kolonlar |
| Sıralama | `Sort` | Kaydedilmiş listenin kolon sıralaması |
| A–Z | `A–Z` | Artan sıralama |
| Z–A | `Z–A` | Azalan sıralama |
| Gruplama | `Grouping` | Kaydedilmiş listenin kolon gruplaması |
| Yok | `None` | Gruplama seçilmedi |
| Herhangi | `Any` | Arşiv koşulu uygulanmaz |
| Arşivlenmemiş | `Not archived` | Yalnız arşivde olmayan Projeler |
| Arşivlenmiş | `Archived` | Yalnız arşivdeki Projeler; İş arşiv filtresi değildir |
| Alanlar | `Areas` | Desteklenen Proje alanları koşulu |
| Yaşam durumu | `Lifecycle` | Overview modülü; Proje yaşam durumunun nötr özeti, sağlık skoru değildir |
| Proje Hedefi | `Goals` | Overview girişi; gizlenebilir Proje alanı değildir |
| Kilometre taşları | `Milestones` | Overview kaynak özeti |
| Riskler | `Risks` | Overview kaynak özeti |
| Blokajlar | `Blockers` | Overview kaynak özeti |
| Tarihler | `Dates` | Overview'da yaklaşan veya geçen hedef tarihler |
| Son değişiklikler | `Recent changes` | Overview kaynak özeti |
| Test Handoff'u | `Test Handoff` | Overview Tests özetindeki kaynak türü; Testler alanı ürünü değildir |
| Test Oturumu | `Test Session` | Overview Tests özetindeki kaynak türü |
| Test Açığı | `Test Gap` | Overview Tests özetindeki kaynak türü |
| Kaynak kaydı aç | `Open source record` | Ana kaydı kopyalamadan açan ortak eylem |
| Tüm İşler | `All Work` | Sıfır kurulum hazır tür dizini; İş ana kayıtlarını toplar, saklı sorgu veya yeni sahiplik değildir |
| Tüm Belgeler | `All Documents` | Sıfır kurulum hazır tür dizini; Belgeleri kapsam, tür, klasör ve üstveriyle gezer |
| Tüm Kararlar | `All Decisions` | Sıfır kurulum hazır tür dizini; Karar ana kayıtlarını toplar |
| Tüm Riskler | `All Risks` | Sıfır kurulum hazır tür dizini; Risk ana kayıtlarını toplar |
| Tüm Araştırma Oturumları | `All Research Sessions` | Sıfır kurulum hazır tür dizini; Kullanıcı Araştırması Oturumlarını toplar |
| Tüm Testler | `All Tests` | Sıfır kurulum hazır tür dizini; Planlı Test Senaryosu, Test Handoff'u, Test Oturumu, Oturum Testi, Test Açığı ve Test değerlendirmesini ayırır |
| Tüm Tasarımlar | `All Designs` | Sıfır kurulum hazır tür dizini; Ekran, Kullanıcı Akışı, Moodboard ve Proje Duvarı kayıtlarını toplar |
| Tüm Teknik Diyagramlar | `All Technical Diagrams` | Sıfır kurulum hazır tür dizini; Teknik Mimari, Veri Modeli, Teknik Sıra ve Diyagram otorite kipini ayırır |
| Tüm Proje Sürümleri | `All Project Releases` | Sıfır kurulum hazır tür dizini; Proje Sürümü ana kayıtlarını toplar |
| Tüm Kaynaklar | `All Sources` | Sıfır kurulum hazır tür dizini; Kaynak ana kayıtlarını toplar |
| Tüm Dosyalar | `All Files` | Sıfır kurulum hazır tür dizini; her Dosya Ekini bir kez gösterir |
| Planlı Test Senaryosu | `Planned Test Case` | Test dizini alt türü; bağımsız senaryo ana kaydı |
| Oturum Testi | `Session Test` | Test Oturumunun sahipli deneme öğesi; `All Tests` içinde ayırt edilir |
| Test değerlendirmesi | `Test assessment` | Test dizini alt türü |
| Teknik Mimari | `Technical Architecture` | Teknik Diyagram türü |
| Veri Modeli | `Data Model` | Teknik Diyagram türü |
| Teknik Sıra | `Technical Sequence` | Teknik Diyagram türü |
| All Tools | `All Tools` | Hazır Proje alanlarının keşif yüzeyi; Proje alanı değildir ve kapanmaz |
| Yapılandırma modu | `Configuration Mode` | Yapı değişikliklerini günlük düzenlemeden ayıran görünür sunum durumu; izin veya yönetici rolü değildir |
| Proje bazlı özel alan | `Custom field` | Yalnız bir Projede yaşayan yapılandırılmış sınıflandırma alanı; Yapılandırma modunda açılır |
| İş şablonu | `Work Template` | Proje kapsamlı tekrar kullanılan İş başlangıç bağlamı; Belge şablonu, Başlangıç yapılandırması veya yakalama mini şablonu değildir |
| Kayıt Eylemi | `Record Action` | Kapalı alan ve üyelik adımlarından adlandırılan, tek hedef kayıt üzerinde çalışan birleşik yazma; otomasyon kuralı, Toplu Düzenleme veya betik değildir |
| Start Work | `Start Work` | Durumu `In Progress` yapan ve İşi Günlük Odak’a ekleyen ilk Kayıt Eylemi örneği |
| Günlük Odak | `Daily Focus` | Farklı Projelerden seçili profil gününde ele alınacak İşleri toplayan kişisel görünüm; Odak Dönemi, sprint, Aktif Çalışma Seti veya Takvim olayı değildir |
| Birleşik Takvim | `Calendar` | Desteklenen tarihli kayıtları türleri karışmadan gün, hafta, ay ve Agenda’da gösteren yüzey; durum tahtası, sprint veya Event kaydı değildir |
| Gün | `Day` | Birleşik Takvimde yalnız seçili gündeki tarih konumlarını gösteren görünüm |
| Ay | `Month` | Birleşik Takvimde ay penceresindeki konumlar ve başlangıç–hedef aralığı |
| Hafta görünümü | `Week` | Birleşik Takvimde hafta penceresindeki konumlar ve başlangıç–hedef aralığı; Hesap tercihindeki hafta önizlemesi değildir |
| Agenda | `Agenda` | Birleşik Takvimde aynı kayıtları kapsam ve tarih türü filtreleriyle kronolojik yoğun listede sunan görünüm; Event kaydı, üyelik veya ikinci takvim gerçeği değildir |
| Bütün Projeler | `All Projects` | Birleşik Takvim kapsamının bütün Projeleri kapsayan seçeneği |
| Takvimde tarihli İş yok | `No dated Work in this Calendar view.` | Seçili görünüm penceresinde tarihli İş olmadığında boş durum |
| Seçili gün | `Selected day` | Günlük Odak görünümünün profil saat dilimindeki takvim günü seçici etiketi |
| Seçili gün (Birleşik Takvim) | `Selected day` | Birleşik Takvim `/calendar` `calendarDay` sorgusu; Gün yalnız o günün konumları, Hafta o günü içeren hesap haftası, Ay o günün ayı, Agenda o ayın konumlarını kronolojik yoğun listede. Günlük Odak üyelik günü değildir |
| Günlük Odakta İş yok | `No Work in Daily Focus for this day.` | Seçili günde üyelik olmadığında boş durum |
| Odağı kapat | `Close focus` | Günlük Odak’ta seçili gün için isteğe bağlı sakin kapanış görünümü; açık İşi kapatmaz |
| Hâlâ açık | `Still open` | Kapanış görünümünde Günlük Odak’ta açık kalan İşler grubu |
| Bugün ne oldu? | `What happened today?` | Seçili profil günündeki türetilmiş önemli olaylar; Daily Note veya ikinci olay geçmişi değildir |
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
| Deferred | `Deferred` | Varsayılan Backlog görünümünde gelecek yeniden görünme tarihi taşıyan İşlerin bölümü; durum değildir |
| Yeniden görünme bildirimi | `Notify on Reappear date` | Proje bazında varsayılan kapalı opt-in; tarih gelince `reappear-date` Dikkat sinyali üretir |
| Etiket | `Tags` | Çalışma Alanı genelinde düz sınıflandırma kimliği; klasör, Akıllı Koleksiyon, Favori veya ilişki değildir |
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
| Metin | `Text` | Proje bazlı özel alan türü; Lookup veya Formula değildir |
| Boolean | `Boolean` | Proje bazlı özel alan türü |
| True | `True` | Boolean özel alanın ayarlanmış evet değeri; Değerlendirilmedi değildir |
| False | `False` | Boolean özel alanın ayarlanmış hayır değeri; boş veya Değerlendirilmedi değildir |
| Değerlendirilmedi | `Not evaluated` | Proje bazlı özel alanda boş veya ayarlanmamış değer; Boolean false veya seçim değeri değildir |
| Tek seçim | `Single select` | Proje bazlı özel alan türü; seçenekler tanımda Proje-yereldir |
| Çoklu seçim | `Multi select` | Proje bazlı özel alan türü; seçenekler tanımda Proje-yereldir |
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
| Bu İşi dahil et | `Include this Work` | Sahip İşin kesin sürümünü gidiş paketine alma |
| Üretildi | `Produced at` | Markdown kopyasının üretim zamanı etiketi; kalıcı snapshot zamanı değildir |
| İlgili Karar, Risk ve Açık Soru | `Related Decision, Risk, and Open Question` | Markdown kopyasındaki belirsizlik bölümü |
| Aktif blokajlar | `Active blockers` | Markdown kopyasındaki aktif blokaj bölümü |
| GitHub ve dış bağlantılar | `GitHub and external links` | Markdown kopyasındaki izinli GitHub ve dış bağlantı bölümü |
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
| Öncelik kademesi | `Very low`, `Low`, `Medium`, `High`, `Very high` | Beş sabit sıralı düzey; boş durum bu beşin dışındadır |
| Değerlendirilmemiş | `Unevaluated` | Eksen veya ölçüt değeri henüz seçilmemiş İş |
| Kanıt gücü | `Evidence strength` | Görüşlü Başlangıç yapılandırmasının varsayılan kapalı hazır Öncelik ölçütü |
| Öncelik Haritası | `Priority Map` | İki ölçütü eksen alan karşılaştırma görünümü; skor, otomatik sıra veya Backlog sırası değildir |
| Yatay | `Horizontal` | Öncelik Haritası yatay eksen seçimi |
| Dikey | `Vertical` | Öncelik Haritası dikey eksen seçimi |
| Benzersiz Contact | `Unique Contact` | Haritada isteğe bağlı kanıt bağlamı |
| Benzersiz Company | `Unique Company` | Haritada isteğe bağlı kanıt bağlamı |
| Kayıtlı görünüm | `Saved views` | Yapılandırma modunda adlandırılmış İş görünümü girişi; günlük planlama eylemi değildir |
| Aşamalar | `Stages` | Yapılandırılabilir Proje aşamalarının Yapılandırma modu girişi |
| İş durumları | `Work statuses` | Korunan İş akışı durumlarının kullanıcıya dönük ad girişi |
| Proje alanları | `Project areas` | Kapalı Proje alanı kataloğunun etkinleştirme girişi |
| Navigasyona sabitle | `Pin to navigation` | Proje alanını navigasyon üstverisine sabitleme; alan etkinleştirme değildir |
| Varsayılan navigasyonu geri yükle | `Restore default navigation` | Yalnız pin ve sıra üstverisini Başlangıç yapılandırması varsayılanına döndürme |
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
| Kaydet | `Save` | Yapılandırma modunda aşama adı ve İş durumu görünen adını kaydetme |
| Aşama adı gerekli | `Stage name is required.` | Boş aşama adı reddi |
| İş durumu adı gerekli | `Work status label is required.` | Boş İş durumu görünen adı reddi |
| Oluştur | `Create` | Yapılandırma modu dışında günlük kayıt oluşturma |
| Düzenle | `Edit` | Yapılandırma modu dışında günlük içerik düzenleme |
| Durum | `Status` | Yapılandırma modu dışında günlük durum değiştirme |
| Planlama | `Planning` | Yapılandırma modu dışında günlük planlama |
| Belgeler | `Documents` | Belge kayıtlarını toplayan Proje alanı |
| Discovery | `Discovery` | Geri Bildirim ve araştırma kayıtlarını toplayan Proje alanı veya hazır aşama adı |
| Decisions | `Decisions` | Karar, Risk, Varsayım ve Açık Soruyu toplayan Proje alanı; Research hazır İş Bağlam Kartı bölümü de aynı etiketi kullanır |
| Design | `Design` | Duvar, Ekran ve akış kayıtlarını toplayan Proje alanı veya hazır aşama adı |
| Tests | `Tests` | Test kayıtlarını toplayan Proje alanı; ayrı test ürünü değildir |
| Releases | `Releases` | Proje Sürümü girişini toplayan Proje alanı |
| Production | `Production` | Üretim olayları girişini toplayan Proje alanı |
| GitHub | `GitHub` | GitHub bağlantısı girişini toplayan Proje alanı; oluşturmada zorunlu bağlantı değildir |
| Backlog | `Backlog` | Hazır İş görünümü; tek kalıcı manuel sıra |
| Manuel sıra | `Manual order` | Backlog’un tek kalıcı ele alma sırası; alternatif sunum bunu silmez |
| Öncelik sıralaması | `Priority` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Tarih sıralaması | `Date` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Alan sıralaması | `Field` | Backlog alternatif sunumu; saklı manuel sırayı yazmaz |
| Board | `Board` | Hazır İş görünümü; Kanban sunumu |
| Liste görünümü | `List` | Kanban ile aynı İş taramasının yoğun satır düzeni; Tablo Görünümü değildir |
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
| Şimdi değil | `Not now` | İş üzerindeki sahipli erteleme izi; durum, Parked veya Karar kaydı değildir |
| Şimdi değil uygula | `Apply Not now` | Açık İşte `Not now` izini kaydetme eylemi |
| Yeniden değerlendiriliyor | `Reconsidering` | Etkin `Not now` izini kapatan eylem |
| Yeniden değerlendirme koşulu | `Re-evaluation condition` | Kullanıcının yazdığı serbest metin; sistem izlemez |
| Dayanaklar | `Grounds` | `Not now` izinin Karar, Risk, Geri Bildirim, Kaynak veya Belge dayanakları |
| Yeniden bak | `Review later` | Kaynak bağlantılı kişisel hatırlatma; `Not now` sessiz silmez |
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
| Bug | `Bug` | İş türü |
| Görev | `Task` | İş türü; subtask değildir |
| Araştırma | `Research` | İş türü |
| İyileştirme | `Improvement` | İş türü |
| İş oluştur | `Create Work` | Projede yalnız başlıkla İş oluşturma eylemi |
| Kopya olarak birleştir | `Merge as duplicate` | Gerçek kopya iki İşi tek hayatta kalan ana kayıtta birleştirme; kaybedenin anahtarı emekli kimlik yönlendirmesidir |
| Birleştirme önizlemesi | `Merge Preview` | Hayatta kalan kayıt, alan çatışmaları ve yeniden yazılacak ilişkilerin onay öncesi görünümü |
| Toplu düzenleme | `Bulk Edit` | Açıkça seçilmiş İşlerde mevcut alanların onay öncesi fark önizlemesi; örtük seçim, şema göçü veya içe aktarma değildir |
| Uygula | `Apply` | Toplu düzenlemede seçilen İşlere alan yazmasını başlatma |
| İlerleme | `Progress` | Toplu uygulamanın donmayan ilerleme göstergesi |
| Başarılı | `Succeeded` | Bir seçilen İşin görünür başarı sonucu |
| Başarısız | `Failed` | Bir seçilen İşin görünür başarısızlık sonucu |
| Hayatta kalan kayıt | `Surviving record` | Birleştirmede kalacak kanonik İş |
| Alan çatışmaları | `Field conflicts` | Birleştirmede kullanıcı çözümü isteyen ayrışan alanlar |
| İlişkiler | `Relations` | Birleştirmede hayatta kalana yazılacak ilişkiler |
| Köken | `Origin` | Emekli kimliğin hayatta kalan kayda görünür yönlendirmesi |
| İlgili | `Related` | Anlamsal bağ; kendiliğinden birleştirme değildir |
| Satır içi kayıt referansı | `Inline reference` | Belge gövdesindeki kullanım bağı; standart ilişki değildir |
| Kararlı bölüm referansı | `Section reference` | Kararlı Belge bölümüne kullanım bağı |
| Canlı içerik bloğu | `Live block` | Kaynak kimliğini koruyan canlı gömü |
| Konuma sabitlenmiş bağ | `Pinned bind` | Dosya Eki veya Wireframe konumuna sabitlenmiş kullanım bağı |
| Akış düğümü Ekran referansı | `Screen reference` | Kullanıcı Akışı düğümünün Ekran kullanım bağı |
| Bağı kaldır | `Unlink` | Gömüyü kaldırıp kaynak ana kaydı silmeyen eylem |
| Kullanıldığı yerler | `Used in` | Standart ilişki geri bağlantıları ile kullanım bağlarının kaynak türüne göre ayrı özeti; kopya içerik veya yeni yazma değildir |
| Türetilen | `Derived` | Köken ilişkisinin üretilen uç etiketi; `Related` yerine geçmez |
| Çöp Kutusunda | `In Trash` | Kırık referans nedeni |
| Kalıcı silindi | `Permanently deleted` | Kırık referans nedeni |
| Güvenlik nedeniyle redakte edildi | `Redacted for security` | Kırık referans nedeni |
| Erişim yok | `No access` | Kırık referans nedeni; yetkisiz ad sızdırmaz |
| Kırık referans arşivi | `Archived` | Kırık referans nedeni; İş arşiv filtresiyle aynı İngilizce etiket |
| İlişkiyi onayla | `Confirm relation` | Tür ve iki ucun önizlemesinden sonra ilişki yazma |
| Kaynak öğe artık yok | `Source item is gone` | Köken konumunda sahipli bileşenin çözülemediğini açıklar |
| İlişki yok | `No relations yet.` | Henüz standart ilişki olmadığını söyleyen boş durum |
| Kaldır | `Remove` | Standart ilişkiyi güvenli geri alma ile kaldırma |
| Engeller | `Blocks` | Engelleme ilişkisinin kaynak ucu; serbest ilişki türü değildir |
| Engellenir | `Blocked by` | Engellenen İş ucu; planlama tüketicisinin okuduğu bekletme yönü |
| Aktif engelleme | `Active` | Engelleme ilişkisinin bekleyen durumu; İş akışı durumu `Blocked` değildir |
| Çözülmüş engelleme | `Resolved` | Engelleme ilişkisinin tarihsel durumu; aktif blokaj sinyalinden çıkar |
| Engel çözüldü | `Mark blocker resolved` | Çözüm tarihi ve isteğe bağlı not yazan eylem; kaynak kapanışı değildir |
| Çözüm notu | `Note` | Engel çözüldü eyleminin isteğe bağlı notu |
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
| GitHub ile devam | `Continue with GitHub` | GitHub login OAuth ile Hesaba giriş eylemi |
| Oturumu kapat | `Sign Out` | Geçerli ürün oturumunu sonlandırma eylemi |
| Oturumlar | `Sessions` | Hesap kapsamındaki aktif ürün oturumlarını cihaz ve son etkinlikle listeleme yüzeyi |
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
| Önerilen locale ve saat dilimini kullan | `Use suggested locale and time zone` | İlk girişte tarayıcı önerisini forma alan, kaydetmeden uygulamayan eylem |
| Önizleme | `Preview` | Locale, tarih biçimi ve haftanın ilk gününün gösterim sonucunu kaydetmeden gösteren yüzey |
| Tarih | `Date` | Önizlemede biçimlenmiş tarih |
| Sayı | `Number` | Önizlemede biçimlenmiş sayı |
| Hafta | `Week` | Önizlemede haftanın ilk gününe göre kaymış gün başlıkları |
| Tarihsel olay | `Historical event` | Saklanmış anın Hesap saat dilimindeki gösterimi |
| İş başlığı | `Work title` | Locale’in çevirmediği kullanıcı içeriği örneği |
| Tercihler kaydedildi | `Preferences saved.` | Hesap tercihinin açık Save ile yazıldığını bildiren sistem mesajı |
| Tercihler yükleniyor | `Loading preferences…` | Hesap tercihinin okunmakta olduğunu bildiren durum |
| Tercihler kullanılamıyor | `Preferences are unavailable.` | Hesap tercihinin okunamadığını bildiren durum |
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
| Hedefe katkı | `Contributes to Goal` | İş, Kilometre Taşı veya Proje Sürümünün Proje Hedefine türlenmiş katkı ilişkisidir |
| Çalışma Alanı çıkış paketi | `Workspace Exit Package` | Kullanıcı parolasıyla şifrelenmiş tam Çalışma Alanı arşividir; ürün içi restore değildir |
| Destek referansı | `Support reference` | Başarısız ana akışta secret veya özel içerik taşımayan sunucu takip kimliği |
| Güncelleme gerekli | `Update required` | Süre dışı imzalı masaüstü API sözleşmesinde güvenli olmayan yazmadan önce duran hata |
| Yeniden dene | `Retry` | Başarısız ana akışta güvenli yeniden deneme eylemi |
| Çatışma | `Conflict` | Aynı idempotency veya teslim kimliğinin farklı payload taşıması |
| İptal | `Cancel` | Yalnız commit bariyerinden önceki hazırlama iptali |
| Sonlandırılıyor | `Finalizing` | Commit bariyerinden sonra iptalin uygulanmadığı durum |
| Güncel değer | `Current value` | Güncel olmayan taban revizyonunda reddedilen yazmanın gösterdiği mevcut kayıt değeri |
| Güvenli geri alma | `Undo` | Tersi deterministik hesaplanan alan, ilişki, görünüm üstverisi veya atomik dönüşümde ilgisiz sonraki değişikliği sarmadan uygulanan geri alma |
| Kullanıcı | `User` | Kayıt geçmişine yazılan insan aktör türü |
| Sistem otomasyonu | `System automation` | Kayıt geçmişine yazılan otomasyon aktör türü |
| Yetkili entegrasyon | `Authorized integration` | Kayıt geçmişine yazılan entegrasyon aktör türü |
| Veri yazıldı | `Data was written.` | Başarısız ana akışta yazmanın tamamlandığını bildirir |
| Veri yazılmadı | `Data was not written.` | Başarısız ana akışta yazmanın yapılmadığını bildirir |
| Bir kez yeniden deneyebilirsin | `You can retry once.` | Yazılmamış başarısız akışın güvenli yeniden deneme sınırı |
| Yeniden deneme | `Do not retry.` | Yazılmış başarısız akışta yeniden denemenin güvensiz olduğunu bildirir |
| Bu eylem tamamlanamadı | `This action could not be completed.` | Secret taşıyan veya beklenmeyen hatanın kullanıcıya gösterilen nedeni |
| Yakalama Gelen Kutusu | `Capture Inbox` | Kaydedilmiş fakat henüz kalıcı kayda dönüşmemiş geçici girdi yüzeyi; ana kayıt, Taslak veya kaydedilmiş bookmark değildir |
| Çalışma alanı Yakalama Gelen Kutusu | `Workspace Capture Inbox` | Proje bilinmediğinde geçici yakalamaların durduğu Inbox |
| Workspace Capture Inbox’a kaydet | `Leave empty to save to the Workspace Capture Inbox.` | Project alanı boşken Save’in Workspace Capture Inbox’a yazacağını söyleyen metin |
| Proje Yakalama Gelen Kutusu | `Project Capture Inbox` | Proje bilindiğinde o projenin geçici yakalamalarının durduğu Inbox |
| Bu Inbox’ta yakalama yok | `No captures in this Inbox.` | Boş Workspace veya Proje Yakalama Gelen Kutusu |
| Create Bug kullanılabilirliği | `Create Bug is available when Project is set and type is Bug Capture.` | Create Bug’un yalnız Proje ve Bug Capture (veya tür belirtilmemiş) iken açık olduğunu söyleyen metin |
| Create Bug Inbox’ta kalmaz | `Create Bug does not stay in the Capture Inbox. A Work record is not stored yet.` | Create Bug’un Gelen Kutusu öğesi bırakmadığını ve İş kaydının henüz saklanmadığını söyleyen metin |
| Bug oluştur | `Create Bug` | Proje ve tür kesin olduğunda doğrudan İş oluşturma eylemi; Yakalama Gelen Kutusu öğesi bırakmaz |
| Bug yakalama | `Bug Capture` | `Observed Behavior`, `Expected Behavior` ve `Reproduction Context` yönlendirici alanlarıyla Inbox öğesini biçimlendiren kapalı mini şablon; alanlar isteğe bağlıdır ve ana kayıt oluşturmaz |
| Gözlenen davranış | `Observed Behavior` | Bug Capture yönlendirici alanı |
| Beklenen davranış | `Expected Behavior` | Bug Capture yönlendirici alanı |
| Yeniden üretim bağlamı | `Reproduction Context` | Bug Capture yönlendirici alanı |
| Geri bildirim yakalama | `Feedback Capture` | `Feedback`, `Channel` ve isteğe bağlı `Contact` yönlendirici alanlarıyla Inbox öğesini biçimlendiren kapalı mini şablon; Contact ana kaydı oluşturmaz |
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
| Sıralı triage | `Sequential triage` | Yakalama Gelen Kutusunda tek öğeye odaklanan isteğe bağlı mod; yalnız üç açık çıkıştan biri çözülünce ilerler |
| Diğer Projeler | `Other Projects` | Başka Projelerdeki benzer kayıt önerilerinin adlı ikincil grubu |
| Yakalama köken bağı | `Origin` | Yakalamayı mevcut kayda köken olarak bağlayan ilişki |
| Yakalama kanıt bağı | `Evidence` | Yakalamayı mevcut kayda kanıt olarak bağlayan ilişki |
| Web Yakalama | `Web Capture` | Tarayıcı uzantısından açık eylemle Gelen Kutusuna giden clip; ana kayıt değildir |
| Uzantı bağlantıları | `Extension links` | Hesap güvenlik ekranındaki eşlenmiş tarayıcı uzantısı listesi |
| Eşleme kodu | `Pairing code` | Beş dakika geçerli tek kullanımlık uzantı bağlantı kodu |
| Eşleme kodu üret | `Generate pairing code` | Uygulama içinde tek kullanımlık eşleme kodu üreten eylem |
| Eşleme kodu süresi | `This pairing code expires in five minutes and can be used once.` | Eşleme kodunun beş dakika ve tek kullanımlık olduğunu söyleyen metin |
| Köken URL | `Origin URL` | Web Yakalama gönderim önizlemesindeki sayfa adresi |
| Hedef Inbox | `Target Inbox` | Web Yakalama gönderiminin gideceği Workspace veya Project Capture Inbox |
| Inbox ara | `Search Inbox` | Yetkili Project Inbox’ları ada göre arama; yalnız son açılanlarla sınırlı değildir |
| Gönder | `Send` | Önizlenen Web Yakalama’yı Gelen Kutusuna yazma eylemi |
| Eşle | `Pair` | Uzantının eşleme kodunu kullanarak bağlanma eylemi |
| Gelen Kutusuna gönderildi | `Sent to Capture Inbox.` | Web Yakalama gönderiminin Inbox öğesi yazdığını bildiren durum |
| Desteklenmeyen tarayıcı | `This browser cannot pair with Web Capture.` | Chromium ailesi ve Firefox dışındaki tarayıcıda eşlemeyi reddeden metin |
| Son başarılı kayıt | `Last successful save` | Uzantıda son başarılı gönderimin zamanı |
| Tarayıcı | `Browser` | Uzantı bağlantısı listesindeki tarayıcı adı |
| Son kullanım | `Last use` | Uzantı bağlantısının son yazma zamanı |
| Uzantı bağlantısını iptal et | `Revoke` | Tek bir uzantı bağlantısını iptal etme eylemi |
| Belge | `Document` | Markdown Belgesi dönüşüm hedefi |
| Dosya Eki | `File Attachment` | Dosya Eki dönüşüm hedefi |
| Dosya seç | `Choose file` | Dosya Eki yükleme denetiminin görünür dosya seçme eylemi |
| Dosya seçilmedi | `No file selected` | Dosya Eki yükleme denetiminde henüz dosya seçilmediğini söyleyen durum |
| Dosya Eki seç | `Select a File Attachment` | Gallery listesinde henüz bir Dosya Eki seçilmediğinde önizleme boş durumu |
| Sürümler | `Versions` | Seçili Dosya Ekinin sürüm zinciri başlığı |
| Yakalama eki | `Capture attachment` | Yalnız Yakalama Gelen Kutusu öğesine ait şifreli staging nesnesi; Dosya Eki veya paylaşılmış medya kütüphanesi değildir |
| Taslak | `Draft` | Henüz kaydedilmemiş ayrıntılı İş formu; ana kayıt, Yakalama Gelen Kutusu öğesi veya Belge taslağı değildir |
| Taslaklar | `Drafts` | Kişisel Taslakların sürdürüldüğü veya silindiği yüzey |
| Son kayıt | `Last saved` | Son başarılı otomatik kayıt zamanı; Client Shell online-only kromu |
| Yazılmamış risk | `Unsaved changes may be lost` | Henüz sunucuya yazılmamış değişiklik uyarısı; yalnız unsaved-risk bayrağı varken |
| Komut Paleti | `Command Palette` | Kurucu yüzeylerinde klavyeyle komut, gezinme, kayıt oluşturma ve Proje geçişi çalıştıran yüzey; Evrensel Arama (`Search`) değildir |
| Evrensel Arama | `Search` | Yetkili ana kayıtları deterministik tam metin sırası ve görünür eşleşme bağlamıyla bulan yüzey; Komut Paleti veya ana navigasyon sayfası değildir |
| Evrensel Arama kısayolu | `Ctrl+/` | Evrensel Arama’yı bulunduğu yerde açan sabit kısayol; `Ctrl+K` Komut Paleti’nindir |
| Sorgu | `Query` | Evrensel Arama metin alanı |
| Arşivi dahil et | `Include archived` | Arşivlenmiş kayıtları sonuçlara katan açık arşiv filtresi; varsayılan sıra arşivi dışlar |
| eşleşme | `matches` | Aynı kayıt içindeki eşleşme sayısı |
| Yetkili kayıt ara | `Type to search authorized records.` | Boş sorgu yönlendirmesi |
| Eşleşen kayıt yok | `No matching records.` | Süzgecin yetkili sonuç döndürmediği durum |
| Arama kullanılamıyor | `Search is unavailable.` | Arama yüzeyinin yüklenemediği durum |
| Proje geçişi | `Switch Project` | Palette ve görünür menüden yetkili Projeler arasında geçiş |
| Oluştur | `Create` | Palette ve görünür menüden yetkili kapsamda desteklenen kayıt oluşturma |
| Aç | `Open` | Palette yetkili ana kayda atlama |
| Eşleşen komut yok | `No matching command` | Palet süzgecinin komut döndürmediği durum |
| Burada çalışmaz | `Can't run this here` | Kapsam dışı veya desteklenmeyen palet komutunun görünür başarısızlığı |
| Kapat | `Close` | Paleti kapatma eylemi |

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
