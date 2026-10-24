# 20 · Shared Dialogs & States

Birden çok yüzeyin çağırdığı dialog'lar ve sistem durumları. Her biri burada bir kez tanımlıdır.

| Ekran | Ne çizilir |
|---|---|
| [20.1 · Confirm GitHub Identity](#201--confirm-github-identity) | Yüksek risk adım şeridi ve GitHub adımı |
| [20.2 · Move to Trash](#202--move-to-trash) | Etki ve Dış yüzey listeli dar dialog |
| [20.3 · Permanently Delete](#203--permanently-delete) | Etki önizlemesi + kimlik + ad teyidi |
| [20.4 · Share](#204--share) | kapsam önizlemesi ve erişim |
| [20.5 · Export](#205--export) | Biçim, önizleme, kayıp raporu, manifest |
| [20.6 · Import](#206--import) | Beş adımlı içe aktarma dialog'u |
| [20.7 · Redact](#207--redact) | Yayılım önizlemesi ve teyit |
| [20.8 · Bulk Edit](#208--bulk-edit) | Alan, `Preview`, `Progress` tabloları |
| [20.9 · Remind me / Review Later](#209--remind-me--review-later) | Küçük form ve `History` |
| [20.10 · Relation Picker & Used in](#2010--relation-picker--used-in) | Seçici, `Relations`, `Used in`, kırık uçlar |
| [20.11 · Tag Picker](#2011--tag-picker) | Kayda etiket uygulama ve kaldırma seçicisi |
| [20.12 · Add to Favorites Control](#2012--add-to-favorites-control) | Tek geçiş kontrolü |
| [20.13 · File Attachment Viewer](#2013--file-attachment-viewer) | Yükleme, önizleme, `Versions`, işaretleme |
| [20.14 · Write Receipts](#2014--write-receipts) | Undo toast, `Conflict`, `Finalizing` |
| [20.15 · Support Reference Error](#2015--support-reference-error) | Hata toast'ı ve oturum kontrolü bloğu |
| [20.16 · Offline](#2016--offline) | Satır içi bant ve boş durum |
| [20.17 · Update Required](#2017--update-required) | Durum bloğu |
| [20.19 · Not Found](#2019--not-found) | Kabuk içinde tek durum bloğu |
| [20.20 · Session Ended](#2020--session-ended) | Açıklama satırlı giriş yüzeyi |
| [20.21 · Archived Read-only Banner](#2021--archived-read-only-banner) | Yüzey başlığı altında ince bant |
| [20.22 · Create Follow-up Work](#2022--create-follow-up-work) | Bildirim, Geri Bildirim, Odak Dönemi, Reconcile, Ürün Boşluğu, Spec adayı, Oturum Testi, Üretim Olayı için tek takip İşi önizlemesi |
| [20.23 · Account Closing Banner](#2023--account-closing-banner) | Dondurmada yüzey başlığı altında ince bant |

## 20.1 · Confirm GitHub Identity
> Yüksek riskli işlemden hemen önce, yeni bir GitHub OAuth turuyla aynı değişmez GitHub kimliğini doğrulayıp tek kullanımlık, en fazla 10 dakikalık işleme bağlı yetkiyi almak; çağıran akışın kendi yazılı ad teyidine geri dönmek.

**Artboard'lar**
- `20.1 · Confirm GitHub Identity · Default · 1440`
- `20.1 · Confirm GitHub Identity · Waiting for GitHub · 1440`
- `20.1 · Confirm GitHub Identity · Mismatch · 1440`
- `20.1 · Confirm GitHub Identity · Confirmed · 1440`

### Yüksek risk adım şeridi
Çağıran dialog'un içinde ayrı numaralı adım; üç sıralı adım: 1) etki önizlemesi (çağıran), 2) `Confirm GitHub Identity`, 3) Hesap veya Proje adını yazma (çağıran). Kayıt başlığı değil, etkilenen Hesap veya Proje adı yazılır.
- **Label'lar:** `Confirm GitHub Identity`, `Confirm GitHub Identity and type the Project name to continue.`; adım 3 yalnız adım olarak anılır, ad yazma etiketleri ve `The name does not match.` metni → `20.3` (Hesap adı yazdıran çağıranlar: `Erase Personal Data`, `Close Account`, Hesap düzeyi erken kalıcı silme).

### GitHub adımı
Ne kanıtlandığını dürüstçe söyleyen tek cümle (aynı GitHub hesabıyla yeniden onay; parola, MFA veya yeni kimlik bilgisi değil), `Confirm GitHub Identity` eylemi. Tur sistem tarayıcısında / açılır pencerede GitHub hesap seçimiyle açılır.
- **Label'lar:** `Confirm GitHub Identity`, `GitHub identity confirmed.`

### Durumlar
#### Default
Adım 2 etkin, adım 3 kilitli.
#### Waiting
Tur açıkken adım "GitHub'da bekleniyor" hâlinde; dialog kapanmaz.
#### Waiting for GitHub
GitHub kesintisi: `Waiting for GitHub` ve `Confirm GitHub Identity is waiting because GitHub is unavailable.`; uygulama eylemi kilitli kalır. Erişimi azaltan eylemler (oturum veya Dış yüzey iptali) bu durumdan etkilenmez.
#### Pop-up blocked
`Allow pop-ups to confirm your GitHub identity.`
#### Cancelled / timed out
`GitHub identity confirmation was cancelled or timed out.` — adım 2 yeniden denenebilir.
#### Identity mismatch / expired / reused
Farklı GitHub kimliği, süresi dolmuş tur, state/PKCE hatası veya tekrar kullanılan grant: genel ret, hiçbir yazma yok, `Support reference` (→ `20.15`).
#### Confirmed
`GitHub identity confirmed.`; adım 3 açılır. Grant süresi dolarsa adım 2 tekrar "gerekli" hâline döner.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md); tüketiciler [77 Trash](../../specs/77-trash/spec.md) (erken kalıcı silme), [78 Security Redaction](../../specs/78-security-redaction/spec.md), [81 Personal Data](../../specs/81-personal-data/spec.md) (`Erase Personal Data`), [83 Project Retirement](../../specs/83-project-retirement/spec.md), [84 Account Closure](../../specs/84-account-closure/spec.md) (`Close Account`, `Cancel closing`).

## 20.2 · Move to Trash
> Desteklenen ana kaydı veya yapılandırma tanımını kimliği korunarak 30 günlük `Trash`'e almak; önce bağlı Dış yüzeyleri ve etkiyi göstermek.

**Artboard'lar**
- `20.2 · Move to Trash · With External Surfaces · 1440`
- `20.2 · Move to Trash · Keep approved surface selected · 1440`
- `20.2 · Move to Trash · Configuration · 1440`
- `20.2 · Move to Trash · Project delete group · 1440`

### Başlık ve etki
Dar dialog'un başı: "`LUMA-58 Onboarding checklist copy` → Trash" sorusu; 30 gün sonra kalıcı silineceği; aktif kural, Akıllı Koleksiyon ve adlandırılmış görünüm üyeliğinden çıkacağı; sahipli bileşenlerin birlikte gideceği; bağımsız ilişkili kayıtların gitmeyeceği.
- **Label'lar:** `Move to Trash`, `Trash`.

### Bağlı Dış yüzeyler
Artboard `With External Surfaces`: kayda bağlı her Dış yüzey satırı: tür (bağlantı paylaşımı / Wiki yayını / Build in Public), durum, son onay zamanı. Varsayılan sonuç: terminal iptal, ziyaretçi oturumları kapanır, URL/token yeniden kullanılmaz.
- **Label'lar:** `Active`, `Expired`, `Revoked`, `Keep approved surface`.

### Eylemler
`Cancel`, `Move to Trash`.
- **Label'lar:** `Cancel`, `Move to Trash`.

### Durumlar
#### Dış yüzey yok
Bağlı Dış yüzeyler bölümü çizilmez.
#### Yapılandırma çöpü
Artboard `Configuration`. Tür listesi ve "çalışmıyor" notu → `02.11 · Yapılandırma çöpü`. Bu dialog'a özgü: etkilenen saklı değerler ve bağımlı görünüm/kural listesi.
#### Grup silme bağlamı
Proje silme grubu (yalnız Arşivden `Delete Project`): önizleme içeriği → `08.28`; bu dialog'da `Keep approved surface` hiç görünmez.
#### Test Oturumu
Test Oturumu ve Oturum Testleri tek bütün olarak listelenir; çocuk tek başına seçilemez.
#### Error
→ `20.15`.

**Spec:** [77 Trash](../../specs/77-trash/spec.md), [83 Project Retirement](../../specs/83-project-retirement/spec.md) (grup bağlamı)

## 20.3 · Permanently Delete
> `Trash`'teki kaydı veya Proje silme grubunu 30 gün dolmadan geri döndürülemez kaldırmak; etki önizlemesi, `Confirm GitHub Identity` ve yazılı ad teyidiyle.

**Artboard'lar**
- `20.3 · Permanently Delete · Default · 1440`
- `20.3 · Permanently Delete · Blocked by active surface · 1440`
- `20.3 · Permanently Delete · Ready · 1440`

### Etki önizlemesi
20.1 adım şeridinin adım 1'i: kaldırılacak içerik, Proje silme grubunda bütün grup; kalacak içeriksiz kimlik ve denetim işaretleri; geri alınamaz olduğu; GitHub kaydı varsa içeriksiz tombstone'un otomatik dirilişi engelleyeceği.
- **Label'lar:** `Permanently Delete {name}?`, `Permanently Delete`.

### Teyit
Artboard `Ready`: adım 3 doldurulmuş, uygulama eylemi etkin. → `20.1` GitHub adımı, sonra Hesap veya Proje adı alanı (`20.1` şeridinin adım 3'ü; etiketlerin ve hata metninin sahibi bu ekrandır).
- **Label'lar:** `Confirm GitHub Identity`, `Type the Project name to confirm`, `Type the Account name to confirm`, `The name does not match.`

### Durumlar
#### Engelli
Artboard `Blocked by active surface`. Aktif bir Dış yüzey kaydı hâlâ kullanıyorsa veya hassas içerik güvenle kaldırılmadıysa uygulama eylemi yok; neden ve ilgili yer gösterilir (Dış yüzey yönetimi veya `Redact` → `20.7`).
#### Name mismatch
Yazılan Hesap veya Proje adı uyuşmazsa alan altında sessiz satır içi hata `The name does not match.`; yazma yok. Metnin sahibi burasıdır: `01.9` ve `06.8` buraya yönlendirir.
#### Finalizing
Bariyerden sonra `Finalizing`, iptal yok (→ `20.14`).
#### Error
→ `20.15`.

**Spec:** [77 Trash](../../specs/77-trash/spec.md), [01 Account Access](../../specs/01-account-access/spec.md)

## 20.4 · Share
> Seçili kök kaydın kapalı dünya önizlemesini kurucuya tek tek onaylatıp bağlantıyla sınırlı salt okunur paylaşım (Dış yüzey + Onaylı snapshot revizyonu) oluşturmak; mevcut bağlantının parola, süre ve iptalini yönetmek.

Paylaşılabilir kök kayıt türleri arasında Ürün Boşluğu da vardır (spec 58: paylaşım kapalı dünya önizlemesi ve açık onay ister); bu ekran kayıt türüne göre değişmez, Ürün Boşluğu girişi `07.1`'dedir.

**Artboard'lar**
- `20.4 · Share · Scope preview · 1440`
- `20.4 · Share · Scope preview · 768`
- `20.4 · Share · Placeholder warning · 1440`
- `20.4 · Share · Approved · 1440`
- `20.4 · Share · Expired · 1440`

### Kapsam önizlemesi
Geniş dialog'un sol sütunu (onay kutulu liste); seçili öğenin ziyaretçi önizlemesi. Çıkacak her kesin kayıt, sürüm, alan, ilişki, gömü ve Dosya Eki sürümü ayrı satır; Proje Duvarı/Moodboard'da kart, yerleşim, grup başlığı, görsel çizgi, görünüm metni, odak sırası, palet, kırpma/döndürme, işaretleme katmanı, canlı Akıllı Koleksiyon bloğu ayrı öğeler. Adlandırılmış görünümden başlanmışsa filtre/düzen yalnız ilk taslaktır. Ekran paylaşılırken kesin Wireframe sürümü seçilir (sonraki sürümler görünmez); ürün-sahipli Teknik Diyagramda kesin Diyagram Sürümü ve Diyagram Görünümü seçilir; dış kaynak bağlantılı diyagramda iframe yoktur, yalnız origin snapshot (URL, bilinen revizyon/zaman, son kontrol, sağlayıcı) önizlenir.
- **Label'lar:** `Share`, `Approved snapshot`, `Live`, `Some fields live`, `Source visual`, `Marking layer`.

### Canlı alanlar
Varsayılan kapalı izin listesi: kullanıcıya dönük durum/kapanış sonucu, öncelik, planlı tarihler, Roadmap ufku, Kilometre Taşı ve Proje Sürümü durumu, hesaplanmış özetler. Başlık, açıklama, Markdown, yorum, ilişki gerekçesi, Contact/Company, URL, Dosya Eki, Secret, özel alanlar listede hiç yoktur.
- **Label'lar:** `Live`.

### Hariç tutulanlar ve dolaylı sızıntı
Kapsama hiç girmeyenlerin açıklaması: Secret, paylaşım token'ı, bağlantı parolası, Yakalama Gelen Kutusu öğesi, çözülmemiş Toplu Anlamlandırma, kaydedilmemiş Taslak, taranmamış ZIP. Önizleme özel ad, ilişki ucu, iletişim bilgisi, dosya üstverisi ve görünüm boşluğu uyarılarını öğe yanında gösterir.
- **Label'lar:** `Not included`.

### Yer tutucu kontrolü
Çözülmemiş `{{field_name}}` listesi: kaynak kayıt, alan, metin bağlamı. Kod bloğu ve satır içi koddaki eşleşmeler listelenmez. Bu bölüm 74 (`Publish Wiki Document`, sayfa 05) ve 75 (Build in Public, sayfa 08) önizlemelerinde aynı çizimle tekrar kullanılır.
- **Label'lar:** `Publish/share anyway`.

### Erişim ayarları
Altta: isteğe bağlı ortak parola (kimlik değildir açıklamasıyla), isteğe bağlı sona erme tarih/saati profil saat diliminde (varsayılan yok). Bağlantının bearer olduğu, elinde tutan herkesin erişebileceği dürüstçe yazılır.
- **Label'lar:** `Password`, `Expires on`, `No expiry`.

### Yayın ayarları
Wiki yayını (`05.4`) ve Build in Public (`08.24`) ortak bölgesi; bağlantı paylaşımı artboard'larında çizilmez. Sahibi burasıdır, `05.4`, `05.5` ve `08.24` yalnız kendi farkını ekler.
- **Adres:** yayın adresi Çalışma Alanında benzersizdir; çakışmada `This address is already in use.` Adres değişirse `Redirect preview` eski adresin yenisine yönlendirildiğini söyler: `The old address redirects to the new one until you unpublish. It never points at private content.`
- **İndeksleme:** varsayılan `noindex` ve sitemap dışı; ayrı açık anahtar `Allow indexing` ve açmadan önce geri alınamazlık uyarısı: üçüncü taraf kopyalar tamamen geri çağrılamaz.
- **Unpublish onayı:** küçük onay dialog'u; yeni erişim hemen durur, cache temizliği başlar, URL yeniden kullanılmaz; ziyaretçi sonucu (`410 Gone`) → `19.9`; yaşam döngüsü yönetimi (dizin, `Change expiry`, `Reactivate`, `Revoke`/`Unpublish`) → `02.13`. Sahip ekran canlı kaydın silinmediğini ekler (Wiki Belgesi ve geçmişi `05.5`; iç Roadmap `08.24`).
- **Label'lar:** `Address`, `This address is already in use.`, `Redirect preview`, `Allow indexing`, `Unpublish`, `Cancel` (mevcut ad).

### Durumlar
#### Approved (link minted)
Bağlantı metni ve kopyalama, son kapsam onay zamanı, `Approved snapshot` / `Some fields live`.
#### Mevcut bağlantı
Parola ekle/değiştir/kaldır, süreyi uzat, `Revoke` (yalnız bağlantı paylaşımı; terminal, geri dönüşsüz uyarı; ziyaretçi sonucu `410 Gone` → `19.9`; yaşam döngüsü → `02.13`). Sonraki kaynak değişiklikleri yalnız fark önizlemesinde (76 `Review diff`) görünür.
#### Expired
İki ayrı eylem: varsayılan `Reshare with a new link`; `Reopen the same link` bütün eski bağlantı sahiplerinin yeniden erişeceği uyarısı ve ek onayla.
#### Revoked
Bağlantı satırı salt okunur `Revoked`; yeni paylaşım yeni Dış yüzey ister.
#### Placeholder warning
Yer tutucu listesi açık, onay `Publish/share anyway` olmadan tamamlanamaz.
#### Error
→ `20.15`. GitHub kesintisi iptali engellemez.

**Spec:** [73 Link Sharing](../../specs/73-link-sharing/spec.md), [14 File Attachments](../../specs/14-file-attachments/spec.md) (ZIP seçilemez, kesin sürüm)

## 20.5 · Export
> Tek kayıt ailesini ve tek seçili kapsamı, kapalı dünya önizlemesi ve kaynak manifestiyle JSON (kayıpsız) veya elektronik tablo güvenli CSV (kayıplı) olarak indirmek.

**Artboard'lar**
- `20.5 · Export · JSON · 1440`
- `20.5 · Export · CSV with loss report · 1440`
- `20.5 · Export · Limit exceeded · 1440`
- `20.5 · Export · PDF snapshot · 1440`
- `20.5 · Export · Capacity refused · 1440`

### Biçim
Orta genişlikte dialog'un başı: `JSON` ve `CSV` seçimi; JSON'un kanonik round-trip, CSV'nin düz ve kayıplı olduğu. `PDF` seçeneği yalnız İş listeleri, Akıllı Koleksiyonlar ve Projeler arası listeler için sunulur; başka kapsamda seçenek görünmez.
- **Label'lar:** `Export`, `JSON`, `CSV`, `PDF`.

### Önizleme
Çıkacak kayıtlar, alanlar, kimlikler, yalnız iki ucu seçili ilişkiler; JSON'da şema sürümü, Work-key geçmişi, kapsamdaki custom field tanımları, köken. Erişilemeyen alanlar listelenmez.
- **Label'lar:** `Schema version`, `Scope`, `Filters`, `Visible fields`, `Produced at`.

### CSV kayıp ve formül raporu
Artboard `CSV with loss report`. CSV'de kaybolacak ilişkiler, türler, kimlikler; `=`, `+`, `-`, `@`, tab, CR ile başlayan hücrelerin veri olarak kaçışlandığı ve hangi hücreler olduğu.
- **Label'lar:** `Lost in CSV`, `Escaped as data`.

### PDF anlık görüntü
Artboard `PDF snapshot`. Desteklenen İş listeleri, Akıllı Koleksiyonlar ve Projeler arası listeler için ekrandaki kesin kapsamı yakalayan okunabilir PDF; adlandırılmış görünüm veya canlı abonelik oluşturmaz. PDF'in erişilebilirlik sınırı (etiketli PDF/WCAG değil) açıklanır ve Markdown alternatifi sunulur; bu, tek Belge Markdown/PDF yolu (`10.2`) değildir.
- **Label'lar:** `PDF`, `Markdown`.

### Manifest ve bölge notu
Şema sürümü, kapsam, filtreler, görünür alanlar, üretim zamanı; canlı verinin AB bölgesinde kaldığı, dosyanın kurucunun kopyası olduğu; bunun `Workspace Exit Package` veya yedek olmadığı. Secret, oturum/entegrasyon/paylaşım token'ı ve bağlantı parolası hiçbir çıktıda yoktur.
- **Label'lar:** `Workspace Exit Package` (karşılaştırma notunda).

### Giriş yeri
Bir listenin veya Akıllı Koleksiyonun başlığındaki `Export` eylemi; seçim varsa seçili kayıt sayısı, yoksa kesin görünüm gösterilir. Kayıt eyleminden de açılır (→ [Record Header](design-system.md#ds11--record-header)). Desteklenmeyen tür veya sınır aşımında giriş kapalıdır ve nedeni yazılıdır; eşzamanlı dışa aktarma kapasitesi aşılınca görünür ret verilir. Sahibi burasıdır; ekranlar yalnız `Export` yazıp `20.5`'e bağlanır. Barındıran ekranlar: `02.4` Saved list (çizili giriş), `02.9`, `06.1`, `07.1`, `08.12`, `09.2`, `09.3`, Project Goals `08.6`, Roadmap `Milestones` bölümü `09.4`, Discovery listeleri `11.1`, `11.5`, `11.8`, `11.12`, Decisions listeleri `12.1`, `12.4`, `12.6`, `12.8`, `16.1` ve `17.1`; spec 79 İş listeleri ve Akıllı Koleksiyonlar için de ister. Belge bu katalogda değildir (tek Belge `Export` → `10.2`). Örnek: Luma İş listesinde 4 seçili kayıt.

### Durumlar
#### Limit aşıldı
10.000 satır veya 25 MB aşılırsa indirme yok; kapsamı bölme açıklaması.
#### Kapasite reddi
Eşzamanlı dışa aktarma kapasitesi doluysa görünür ret; sessiz uzun iş yok. Metin: `Export capacity is full. Try again in a moment.`.
#### Desteklenmeyen aile
Belge (→ tek Belge `Export` Markdown/PDF, Belge sayfası), Ekran/Duvar/Moodboard listede yok; Teknik Diyagram JSON yalnız dışa aktarım notuyla.
#### Hesap kapanma dondurması
Dialog açık kalır (84).
#### Error
→ `20.15`.

**Spec:** [79 Data Export](../../specs/79-data-export/spec.md)

## 20.6 · Import
> Tek bir Markdown, Cantiara Belge JSON'u veya tek tür/tek kapsamlı CSV/JSON dosyasını eşleme ve fark önizlemesinden sonra `Apply Import` ile atomik, idempotent yazmak.

**Artboard'lar**
- `20.6 · Import · Diff and conflicts · 1440`
- `20.6 · Import · Diff and conflicts · 768`
- `20.6 · Import · File and target · 1440`
- `20.6 · Import · Mapping · 1440`
- `20.6 · Import · Finalizing · 1440`
- `20.6 · Import · Receipt · 1440`
- `20.6 · Import · Receipt reopened · 1440`

### 1 · Dosya ve hedef
Adımlı geniş dialog'un ilk adımı: tek dosya seçimi, kayıt türü, hedef kapsam (Proje veya Kişisel Wiki); 10.000 satır / 25 MB sınırı; klasör, ZIP, çok dosya yok.
- **Label'lar:** `Import`, `Choose file`, `No file selected`.

### 2 · Eşleme
Kaynak sütun → ürün alanı / Proje custom field eşlemesi, kayıplar. Tek Markdown dosyası (Proje veya Kişisel Wiki Belgesi) sütun eşlemesi yerine üç alan gösterir: Belge başlığı, Belge türü ve hedef kapsam (Proje / Kişisel Wiki). Cantiara Belge JSON'u eşleme istemez; aynı Belge ailesi olarak önizlenir.
Tablo yapıştırma (`02.9 · Paste rows`) eşleme ve inceleme adımının sahibi olarak burayı kullanır: kaynak kolon → alan (`Column mapping`, `Skip column`, `Record ID`), sonra satır incelemesi (`Review paste`: "Row N · Create/Update", hatalı satırda `Correct row`, `Exclude row` / `Include row`). `02.9` yalnız yapıştırma girişi ve `Paste rows` / `Preview paste` / `Apply changes` farkını tutar.
- **Label'lar:** `Source column`, `Product field`, `Skip column`; Markdown için `Title`, `Document type`, `Target` (mevcut ad, yeni bağlam: Belge hedef kapsamı; Komut Paleti önizleme alanı `Target`'tan ayrı anlam); yapıştırma için `Column mapping`, `Record ID`, `Review paste`, `Include row` (etiket ayrıntısı `02.9`).

### 3 · Fark ve çatışmalar
Artboard `Diff and conflicts` (1440 ve 768). Yazılacak kesin küme; geçersiz satırlar (düzelt veya açıkça düşür); kararlı köken eşleşmesinde `Update existing` / `Skip` / `Resolve conflict`; kalıcı silinmiş kimliğin yeni kimlik ve önceki kökenle geleceği (köken sütununda görünür); ilişkilerin yalnız açık eşlemeyle yeni kimliklere bağlanacağı (her ilişki için eşleme satırı); kararlı kimlik yoksa tahmin yapılmadığı. Önizleme hiçbir kaydı değiştirmez; yüklenen dosya en çok 24 saat tutulur.
- **Label'lar:** `Update existing`, `Skip`, `Resolve conflict`; `Correct row`, `Exclude row`, `Previous origin`, `Map relation`; `Preview does not change any record. The uploaded file is kept for at most 24 hours.`.

### 4 · Apply Import
Ayrı onay adımı; "ya hepsi bir kez ya hiçbiri".
- **Label'lar:** `Apply Import`, `Cancel`, `Finalizing`.

### 5 · Makbuz
Tam commit veya tam rollback makbuzu; oluşan/güncellenen sayılar; kaynak dosya kapsamı. Makbuz kalıcıdır: bağlantı koptuktan sonra yeniden açılınca aynı sonuç görünür (`Receipt reopened`). Oluşan veya güncellenen kayıtlar Work türündeyse makbuz satırlarında seçim kutuları ve seçim çubuğu (seçili sayı + `Bulk Edit`, → `20.8`) bulunur; seçim çubuğu import sonucu kayıtlarını toplu düzenlemeye açar.
- **Label'lar:** `Import receipt`, `Created`, `Updated`, `Rolled back`; `Bulk Edit` (→ `20.8`).

### Giriş yeri
Hedef kapsamdaki `Import` eylemi; `One file · one type · one scope` notu yanında görünür. Sahibi burasıdır; ekranlar yalnız `Import` yazıp `20.6`'ya bağlanır. Barındıran ekranlar: Kişisel Wiki (`05.1`), Contacts (`06.1`), Product Gaps (`07.1`), Work listesi (`09.2`), Proje `Documents` (`10.1`), Project Goals (`08.6`), Roadmap `Milestones` bölümü (`09.4`, kapsam seçili Proje), Discovery listeleri `11.1` (Source metadata), `11.5`, `11.8`, `11.12`, Decisions listeleri `12.1`, `12.4`, `12.6`, `12.8`, `16.1` ve `17.1`; giriş her ekranın sayfa başlığındadır. Liste, spec 80 kataloğundaki kayıt türleriyle sınırlıdır; katalogda olmayan türlerin liste başlığında `Import` yoktur. Arşivli Projede `Import` kapalı ve nedeni yazılıdır. Projeler arası Saved list tek kapsam seçemediği için giriş değildir. Örnek: `luma-work.csv` · Work · Luma. Desteklenmeyen tür veya sınır aşımında giriş kapalıdır ve nedeni yazılıdır.

### Durumlar
#### Bilinmeyen şema
Bilinmeyen gelecek JSON şema sürümü: yazmadan ret.
#### Reddedilen tür
Teknik Diyagram JSON, DDL/DBML, Draw.io/Visio; `test-report/1` zarfı (54'e devredilir, burada Belge/İş yazılmaz); GitHub-as-truth.
#### Kapanış dondurması
`Closing`/dondurmada yeni import reddi (84).
#### Rollback
Tam rollback makbuzu, hiçbir kayıt görünmez, `Support reference`.
#### Receipt reopened
Bağlantı koptuktan sonra makbuz yeniden açılır: aynı `Import receipt`, aynı sayılar; yeniden yazma yapılmaz.

**Spec:** [80 Data Import](../../specs/80-data-import/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md) (`Finalizing`)

## 20.7 · Redact
> Hassas bir değeri güncel içerikten ve onu taşıyan her kopyadan geri döndürülemez kaldırmak; önizleme, `Confirm GitHub Identity` ve yazılı Hesap/Proje adıyla.

**Artboard'lar**
- `20.7 · Redact · Choose value · 1440`
- `20.7 · Redact · Spread preview · 1440`
- `20.7 · Redact · Ready · 1440`
- `20.7 · Redact · Result mark · 1440`

### Değer seçimi
Akışın başı: kurucunun kayıt içinde hangi değeri redakte edeceğini seçtiği adım; kayıt + alan seçici veya metin aralığı, seçili kayıt ve alan adı salt okunur gösterilir. Değerin kendisi bu adımda ve sonraki önizlemede maskeli görünür. `Redact` kayıt başlığı taşma menüsünden (`DS.11`) açılır.
- **Label'lar:** `Value to redact`.

### Yayılım önizlemesi
Artboard `Spread preview`. 20.1 adım şeridinin adım 1'i; değeri hâlâ taşıyan her yer ayrı satır: güncel alan, kayıt geçmişi revizyonları, Dış yüzey Onaylı snapshot revizyonları, arama indeksi, dışa aktarma staging'i, cache. Serbest Markdown'da secret tespiti iddia edilmediği notu.
- **Label'lar:** `Redact`.

### Teyit
Artboard `Ready`. → `20.1`; sonra Hesap veya Proje adı (kayıt başlığı değil).
- **Label'lar:** `Confirm GitHub Identity`, `Redact`.

### Sonuç
İçeriksiz işaret: özgün olay türü, zaman, aktör, gerekçe; ad/e-posta/özgün mesaj yok. Dış yüzey `Active`'e dönmez, yeni URL üretmez.
- **Label'lar:** `Redacted for security`, `Redact value`.

### Durumlar
#### Waiting for GitHub
20.1 ile aynı; uygulama kilitli.
#### Test Oturumu bağlamı
Redaksiyonun `Correction` ve `Withdrawal`'dan ayrı üçüncü olay olduğu ve redakte kanıtın değerlendirme/export'ta kullanılamayacağı notu.
#### Error
→ `20.15`.

**Spec:** [78 Security Redaction](../../specs/78-security-redaction/spec.md), [01 Account Access](../../specs/01-account-access/spec.md); çağıranlar [81](../../specs/81-personal-data/spec.md), [84](../../specs/84-account-closure/spec.md)

## 20.8 · Bulk Edit
> Açıkça seçilmiş İşlerin mevcut alanlarını fark önizlemesi, donmayan ilerleme ve kayıt bazlı sonuçla güncellemek.

**Artboard'lar**
- `20.8 · Bulk Edit · Preview · 1440`
- `20.8 · Bulk Edit · Progress · 1440`
- `20.8 · Bulk Edit · Results with failure · 1440`

### Alan ve değer
Dialog'un üstü: mevcut alan seçimi ve yeni değer. Alan seçici Calendar/Backlog'daki mevcut İş alanlarını sunar: `Status`, `Planned start`, `Target date`, `Reappear date`; özel alanlar ve Tür değişimi kapsam dışıdır (Feature giriş/çıkış önizlemesi ayrı akıştır). Başlık altında seçili sayı ve dokunulmayan kayıt notu. `Closed` seçilirse kapanış adımı `09.13 · Close Work` ile aynıdır (sonuç seçimi, `Closure check`, `Close anyway`), burada yeniden tarif edilmez.
- **Label'lar:** `Bulk Edit`, `Status`, `Select status`; kapanış label'ları → `09.13`; `Field`, `Planned start`, `Target date`, `Reappear date`, `{n} Work selected`, `Only the selected Work is changed.`.

### Preview
Seçili her İş için önce → sonra; seçilmeyenler yok. Arşiv/Çöp İşleri yalnız onları gösteren yüzeyde açıkça seçildiyse.
- **Label'lar:** `Preview`, `No changes to apply.`, `Apply`.

### Progress ve sonuçlar
Artboard `Results with failure`: en az bir satır `Failed`. Sonra `Progress` ve sonuç tablosu: ilk ilerleme bütçe içinde (p95 1 sn); her İş için `Succeeded`, `Failed` (`Support reference` ile), `Canceled`; bariyeri geçmiş satırlar `Finalizing`. Başarılı geri alınabilir değişiklikte satır `Undo`; geri alınınca `Undone`. İlerleme sürerken `Cancel` kuyruktaki, bariyere varmamış yazmaları durdurur (satırlar `Canceled`); bariyeri geçmişler `Finalizing`'te kalır ve iptal edilemez.
- **Label'lar:** `Progress`, `Cancel`, `Succeeded`, `Failed`, `Canceled`, `Finalizing`, `Undo`, `Undone`, `Support reference`.

### Durumlar
#### Route return
Sayfadan ayrılıp dönünce ilerleme ve sonuçlar aynen görünür.
#### Partial
Bazı satırlar `Failed`: hepsi listelenir, gizli kısmi başarı yok.
#### Error
→ `20.15`.

**Spec:** [22 Bulk Editing](../../specs/22-bulk-editing/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 20.9 · Remind me / Review Later
> Desteklenen kayda veya Belge bölümüne Hesap kapsamında kişisel zaman bağlamak; kaynağın yaşamını ve planlama üyeliğini yazmadan.

**Artboard'lar**
- `20.9 · Remind me / Review Later · Form · 1440`
- `20.9 · Remind me / Review Later · Document section · 1440`
- `20.9 · Remind me / Review Later · With history · 1440`

### Form
Kaydın yanında küçük popover/form: eylem türü (`Remind me` / `Review Later`), zaman, koşul, Belgede bölüm hedefi.
- **Label'lar:** `Remind me`, `Review Later`, `Set reminder`, `When`, `Condition`, `In any case`, `Only if still open`, `Section`, `Entire document`, `Cancel`.

### Hatırlatma listesi ve History
Formun altında; kayda bağlı Hatırlatmalar yaşamıyla; geçmişte tetiklenme ve bastırma nedeni (kaynak artık açık değil).
- **Label'lar:** `Planned`, `Triggered`, `Cancelled`, `History`, `No reminders.`

### Durumlar
#### Empty
`No reminders.`
#### Validation
`Choose a valid time.`, `Reminder must be scheduled for a future time.`, `Check the reminder.`
#### Error
`Reminder could not be saved.` + → `20.15`.
#### Missing section
Belge açılır, `This section is missing.`; başka başlığa kaydırılmaz.
#### Archived Project
Arşivli Proje kayıtlarında oluşturma ve yeniden zamanlama kapalı (→ `20.21`).
#### Deleted source
Kaynağı kalıcı silinmiş Hatırlatma satırı içerik veya başlık göstermez; ortak kırık referans sunumu (label'lar `20.10 · Kırık uç` ve `20.19 · Durum bloğu`'ndadır; `00.4` ile aynı). `Triggered` geçmişi zamanı ve nedeni korur; yeniden zamanlama kapalıdır.
#### Condition not available
`Document`, `Decision` ve `Project Release` kaynaklarında `Condition` yalnız `In any case` sunar (`Only if still open` seçilemez; `Only if still open` yalnız Proje, İş, Risk, Kilometre Taşı ve Üretim Olayı için vardır). Varsayılan her zaman `In any case` seçilidir. Açıklama: `Only if still open is not available for this record type.`.
#### Fired signal
Tetiklenen sinyalde `Dismiss` ve yeni zaman seçimi — sunum `00.5 · Notification Center`'da.

**Spec:** [35 Personal Reminders](../../specs/35-personal-reminders/spec.md)

## 20.10 · Relation Picker & Used in
> İki ana kaydı kapalı tür kataloğundan bir ilişkiyle önizleyerek bağlamak; kaydın nerede kullanıldığını standart ilişki geri bağlantıları ve kullanım bağları olarak ayrı göstermek; kırık ucu sızdırmadan sunmak.

**Artboard'lar**
- `20.10 · Relation Picker & Used in · Relations and Used in · 1440`
- `20.10 · Relation Picker & Used in · Picker preview · 1440`
- `20.10 · Relation Picker & Used in · Broken targets · 1440`

### Seçici
Küçük dialog: ilişki türü (kapalı katalog), hedef kayıt araması, `Relation preview` (iki uç + tür + yön). `Blocked by` türü seçiliyken hedef araması Work, Decision ve Open Question kayıtlarını sunar; `Blocks` yönü yalnız Work hedefler. Work hedefli türlerde boş seçenek `Select a Work` kalır; Decision / Open Question seçilebilen türlerde `Select a record`. Önizleme iki ucu ve `Active` başlangıç durumunu gösterir; çift gönderim ikinci bir `Active` bekleyiş üretmez. Work'ün zaten bir `Included in` ucu (birincil Feature) varsa seçici ikinci birincil Feature'ı reddeder (diğer Feature'lar `Related` olarak kalabilir).
- **Label'lar:** `Relation type`, `Related`, `Origin`, `Derived`, `Select a Work`, `Select a record`, `Relation preview`, `Review the relation preview before confirming.`

### Relations listesi
Kayıt ayrıntısında; türe göre gruplanmış standart ilişkiler; her satır kaynağı açar.
- **Label'lar:** `Relations`, `Remove relation`, `Remove`, `Relation removed.`, `Undo`, `No relations yet.`, `Loading relations…`

### Used in
İki ayrı grup: standart ilişki geri bağlantıları ve kullanım bağları (satır içi referans, canlı blok, sabitlenmiş dosya/wireframe bağı, akıştan Ekrana). Kullanım bağı satırları "backlink" olarak adlandırılmaz, ilişki sayısına girmez. Erişilemeyen kayıt sayılmaz ve adlandırılmaz.
- **Label'lar:** `Used in`, `Usage links`, `Pinned bind`.

### Kırık uç (Silinmiş hedef işareti)
Varlık, neden, kurulma zamanı; gövde/alan/önizleme yok. Başlık yalnız kurucu hedefe hâlâ erişebiliyorsa. `Open source record` yalnız `Archived` ve `In Trash` uçlarında görünür; `Permanently deleted`, `Redacted for security` ve `No access` uçlarında gizlenir.
- **Label'lar:** `Broken —`, `(current)`, `Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`, `Open source record`. Kırık uç satırı `Broken —` önekiyle başlar (örnek `Broken — Redacted for security`); ucun güncel kayıt olduğu satırda `(current)` eki taşınır.

### Standart ilişki türleri kataloğu
Seçici yalnız bu kapalı katalogdaki türleri sunar; iki uç, yön ve izinli uç türleri her tür için sabittir:
`Related`, `Origin` / `Derived`, `Evidence` / `Provides evidence`, `Contributes to Goal` / `In Goal`, `Blocks` / `Blocked by`, `Includes` / `Included in`, `Contributes to Milestone` / `In Milestone`, `Primary spec`, `Supersedes` / `Superseded by`, `Implements` / `Implemented by`, `Belongs to Company`, `Participant`, `Required for completion` / `Contextual`.

### Durumlar
#### Empty
Boş metin yukarıdaki `Relations listesi` label'ıdır.
#### Loading
Yükleme metni yukarıdaki `Relations listesi` label'ıdır.
#### Error
`Relation could not be created.`, `Relation could not be removed.`, `Relation could not be undone.`, `Relation preview failed.`, `This relation is no longer available for Undo.`, `Relations could not be loaded. Try loading this page again.` (liste yükleme hatası); ikinci birincil Feature reddi: `This Work is already included in a Feature.` + `Remove relation` yönlendirmesi.

**Spec:** [12 Relations](../../specs/12-relations/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 20.11 · Tag Picker
> Tek Çalışma Alanı etiket ad alanından düz etiketi bir kayda uygulamak ve kayıttan kaldırmak. Yeniden adlandırma ve etikete göre süzme Proje `Tags` yüzeyindedir (→ `08.11`).

**Artboard'lar**
- `20.11 · Tag Picker · Picker · 1440`
- —

### Seçici
Kayıt başlığı altında etiket sırası + seçici popover: arama alanı; önce bu Projede sık kullanılanlar, sonra diğerleri; yeni etiket oluşturma. `/` hiyerarşi değildir, düz metindir.
- **Label'lar:** `Tags`, `Tag`, `Select a tag`, `Apply tag`, `Suggested in this Project`, `Create tag`, `No matching tags.`, `No tags yet.`

### Durumlar
#### Error
`Tag could not be applied.`, `Tag could not be created.`, `Tag could not be removed.`, `Check the tag name.`, `Tag is unavailable.` Yeniden adlandırma hataları `08.11`'dedir.

**Spec:** [13 Tags](../../specs/13-tags/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 20.12 · Add to Favorites Control
> Proje, Belge, İş, Karar veya Akıllı Koleksiyonu kaynağı yazmadan kişisel Favorilere eklemek/çıkarmak.

**Artboard'lar**
- `20.12 · Add to Favorites Control · Off and On · 1440`
- —

### Kontrol
Kayıt başlığı eylem sırasında tek geçiş kontrolü; durumu metin etiketiyle.
- **Label'lar:** `Add to Favorites`, `Remove from Favorites`.

### Durumlar
#### Loading / Saving
Üyelik okunurken veya yazılırken kontrol devre dışı.
#### Error
Başarısızlıkta önceki üyelik korunur + → `20.15`.
#### Read-only source
Arşivli veya salt okunur kaynakta da kullanılabilir (kişisel üyelik kaynağı düzenlemez).

**Spec:** [39 Favorites](../../specs/39-favorites/spec.md)

## 20.13 · File Attachment Viewer
> Dosya Ekini yüklemek, türüne göre yalıtılmış önizlemede göstermek, sürüm zincirini (`Versions`, `Upload new version`) yönetmek, ayrı katmanda işaretlemek ve bir nokta/bölgeyi İşe köken olarak bağlamak; bütün yüzeylerin paylaştığı tek bileşen.

**Artboard'lar**
- `20.13 · File Attachment Viewer · Image preview · 1440`
- `20.13 · File Attachment Viewer · Image preview · 768`
- `20.13 · File Attachment Viewer · PDF with marking · 1440`
- `20.13 · File Attachment Viewer · Upload new version · 1440`
- `20.13 · File Attachment Viewer · Bind as origin · 1440`
- `20.13 · File Attachment Viewer · Upload failed · 1440`
- `20.13 · File Attachment Viewer · Gallery · 1440`

### Yükleme
Üstte yükleme sırası: dosya seçimi, seçili dosya adı, yükleme; tür/boyut kuralları (görsel 25 MB, PDF 50 MB, CSV 25 MB, metin 10 MB, ses 100 MB, video 250 MB, ZIP 100 MB yalnız indirme). SVG, HTML, çalıştırılabilir, script, makrolu ofis ve bilinmeyen MIME/uzantı reddedilir.
- **Label'lar:** `Choose file`, `No file selected`, `Upload`, `Uploading`, `Cancel`, `Finalizing`, `This file type is not supported.`, `File Attachment upload could not be completed. Try again.`

### Önizleme
Dosya listesi + seçili dosyanın büyük önizlemesi; türe göre: görsel; sayfalı PDF; sınırlı CSV satırları (`Preview is truncated`); güvenli düz metin; kullanıcı başlatmalı ses/video (hız, tam ekran, döngü, altyazı); ZIP önizlemesi yok. Liste ve galeri satırlarında küçük resim bulunur; çözülemeyen veya sınırı aşan görselde küçük resim yerine `Unavailable` görünür ve `Download` açık kalır. Galeri küçük resimleri özgün dosyayı değil türetilmiş küçük sürümü yükler.
- **Label'lar:** `File Attachment`, `Preview`, `CSV preview`, `PDF preview`, `Loading PDF preview`, `Download`, `Playback speed`, `Fullscreen`, `Loop`, `Captions`, `Unavailable`, `Retry preview`, `Preview is unavailable.`, `PDF preview is unavailable. Download the original file instead.`

### Versions
Aynı kaydın sürüm zinciri; her sürüm özgün hâliyle görüntülenebilir/indirilebilir. `Upload new version` önce hedef kayıt, mevcut sürüm ve gelen dosyayı yan yana gösterir. Önizleme notu: `Pinned binds and approved snapshots stay on the current version.`.
- **Label'lar:** `Versions`, `Upload new version`, `Select a File Attachment`.

### İşaretleme katmanı
Sağ sütunda araçlar; kesin sürüme bağlı ayrı katman: `Pen`, `Highlighter`, `Arrow`, `Rectangle`; `Undo`. Özgün dosyaya yazmaz; yorum/mention/görev üretmez.
- **Label'lar:** `Marking layer`, `Pen`, `Highlighter`, `Arrow`, `Rectangle`, `Undo`, `Marking could not be saved. Try again.`, `Marking could not be undone. Try again.`

### Köken olarak bağla
Görsel/PDF üzerinde `Point` veya `Region` seçimi; `New Work` (Proje gerekli) veya `Existing Work`; önizleme ve onay; seçilen kesin sürüme bağlı.
<details>
<summary>Label'lar</summary>

`Bind as origin`, `Point`, `Region`, `New Work`, `Existing Work`, `Project ID`, `Work ID`, `Page`, `X (0–1)`, `Y (0–1)`, `Width (0–1)`, `Height (0–1)`, `Preview`, `Confirm`, `Click a Point or drag a Region on the preview, then click Preview.`, `Review the selected Point or Region, then confirm the Work bind.`, `Marked source location`.

</details>

### Kullanım yerleri ve Belge sahipliği
Dosya Eki kayıt eklerinde ve Moodboard'da aynı bileşenle görünür; Belge ya da global havuz değildir. `Documents` alanındaki `Project File Attachments` bölgesinin yerleşimi → `10.1`. Sahiplik (`Assign File Attachments`) ve örnek ekler → `10.1`, `10.10`.

### Durumlar
#### Empty
Dosya yok: yalnız yükleme sırası ve kısa açıklama.
#### Upload failed
Görünür Dosya Eki yok; neden, yazma sonucu, `Support reference` (→ `20.15`). Bağlantı yükleme sırasında koparsa devam edilmez: yükleme baştan (sıfırıncı bayttan) yeniden başlar ve durum görünür.
#### Copy
`Copy` yeni kimlikli bir Dosya Eki üretir; kaynak ek değişmez. `Move` gösteriliyorsa etki önizlemelidir.
#### Quota warning
%80'de uyarı: `Workspace storage is 80% full.`; aşıldığında yeni yükleme/sürüm kapalı, okuma/indirme/silme açık: `Storage quota exceeded. New uploads and versions are blocked; existing files stay readable, downloadable, and deletable.`.
#### Gallery
Dosya listesi galeri sunumunda: her dosya küçük resim kartı; çözülemeyen görselde `Unavailable`.
#### Preview Unavailable
Decode/kare sınırı aşan görsel: `Unavailable`, `Download` açık, dosya bozuk işaretlenmez.
#### Bind errors
`Location preview is unavailable.`, `Bind as origin could not be completed.`, `A Project is required for a new Work.`
#### ZIP
`ZIP files are available for download only.`
#### Arşivli Proje
Yükleme yok; okuma ve indirme açık (→ `20.21`).

**Spec:** [14 File Attachments](../../specs/14-file-attachments/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md) (`Finalizing`)

## 20.14 · Write Receipts
> Mutation Contract'ın ortak görünür sonuçlarını tek yerde tanımlamak: güvenli geri alma toast'ı, güncel olmayan tabanda `Conflict` / `Current value` ve commit bariyerinden sonra `Finalizing`.

**Artboard'lar**
- `20.14 · Write Receipts · Undo toast · 1440`
- `20.14 · Write Receipts · Conflict current value · 1440`
- `20.14 · Write Receipts · Finalizing · 1440`

### Undo toast
Tek yığın; ne değişti cümlesi + `Undo` (toast geri bildirim satırının sahibi burasıdır; ekranlar satır içi `Undo` metni yazmaz, buraya bağlanır, ör. `04.5`). Yalnız tersi deterministik değişikliklerde (alan, ilişki, görünüm üstverisi, atomik dönüşüm).
Örnek cümleler sahip ekranlardadır (`20.10`, `08.11`); burada yalnız desen.
- **Label'lar:** `Undo`, `Undone`.

### Conflict
Satır içi, düzenlenen alanın yanında: güncel olmayan tabanda yazma reddi; `Current value` gösterilir; aynı idempotency anahtarıyla farklı payload için de `Conflict`. Undo aynı alandaki daha yeni değere çarparsa durur ve açıklar.
Kayıt formlarındaki çatışma cümlesi desenidir; ekranlar yalnız tür adını verir: `{Record type} changed. Cancel and reopen before saving again. Your text is kept here.`. Kaydetme hatası deseni sahibi `DS.16`'dır.
- **Label'lar:** `Conflict`, `Current value`, `Retry`, `This page is out of date.`

### Finalizing
Çok adımlı yazma bariyeri geçince `Finalizing`; sahte `Cancel` yok. Sonuç tam commit veya tam rollback makbuzu.
Devam eden işlem satırı (in-flight): her işlem satırı kesin durumunu (`Finalizing`, tam commit / tam rollback makbuzu) bu ortak etiketle gösterir; bariyerden önce iptal edilen iş makbuzuyla listelenir. `01.10` (Closing) ve `08.26` (Archive) bu satır etiketini yazmaz, `20.14`'e bağlanır ve yalnız kendi iş türü ayrıntısını tutar.
- **Label'lar:** `Finalizing`, `Cancel` (yalnız bariyer öncesi).

### Aktör satırı
Kayıt geçmişinde aktör türü; dört türün sahibi burasıdır (`08.8` ve `09.10` yalnız referans verir). Tür, yazan kaynağı söyler: kurucu, kural motoru, GitHub olayı ya da yetkili dış araç.
- **Label'lar:** `User`, `System automation`, `GitHub`, `Authorized integration`.

### Durumlar
#### Undo conflict
Aynı alan sonradan değişmişse Undo yerine açıklama + `Current value`.
#### Rollback receipt
Tam rollback: hiçbir kısmi kayıt yok; → `20.15`.

**Spec:** [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md)

## 20.15 · Support Reference Error
> Başarısız ana akışta açık neden, yazma sonucu, güvenli yeniden deneme sınırı ve secret içermeyen `Support reference` göstermek; korunan rotada oturum kontrolü hatasını oturumdan çıkarma gibi sunmamak.

**Artboard'lar**
- `20.15 · Support Reference Error · Toast not written · 1440`
- `20.15 · Support Reference Error · Toast outcome unknown · 1440`
- `20.15 · Support Reference Error · Toast data was written · 1440`
- `20.15 · Support Reference Error · Toast list failure · 1440`
- `20.15 · Support Reference Error · Toast Retry used · 1440`
- `20.15 · Support Reference Error · Unreachable · 1440`
- `20.15 · Support Reference Error · Session unavailable · 1440`
- `20.15 · Support Reference Error · Session unavailable · Retry used · 1440`
- `20.15 · Support Reference Error · Session unavailable · Unknown outcome · 1440`

### Hata toast'ı
İçerik: neden; isteğe bağlı kurtarma ipucu; yazma sonucu; yeniden deneme sınırı; `Support reference` kodu veya `Support reference unavailable.` Yazılmamış yazma toast'ı kurucu kapatana veya `Retry` seçene kadar kalır (kapatma kontrolü vardır), böylece `Retry` ve `Support reference` erişilebilir kalır; kendiliğinden kapanmaz (kapanma kuralları: `Auto-dismiss`).
<details>
<summary>Label'lar</summary>

`This action could not be completed.`, `Data was written.`, `Data was not written.`, `Data write outcome is unknown.`, `You can retry once.`, `Do not retry.`, `Support reference`, `Support reference unavailable.`, `Retry`, `Please restart the API and try again.`, `Please restart after applying the latest migration.`

</details>

### Oturum kontrolü durumu (Session unavailable)
Korunan rotada oturum denetimi geçici başarısız olduğunda içerik yerine kabuk içinde tam uyarı bloğu çizilir; kurucu oturumdan çıkmış sayılmaz. Kabuk durumu (üst çubukta yalnız wordmark) `00.1`'dedir. Blok sırasıyla: `Session unavailable` başlığı, `Support reference` satırı, yazma sonucu, yeniden deneme sınırı, `Retry`.
- **Label'lar:** `Session unavailable`, `Cantiara couldn’t be reached.`, `Cantiara couldn’t check your session.`; `Support reference`, yazma sonucu, yeniden deneme sınırı ve `Retry` label'ları hata toast'ındakilerdir (aynı metinler, burada yeniden tanımlanmaz).

### Durumlar
#### Reference available
Sunucu referansı görünür.
#### Data was written
Yazma tamamlandığı hâlde sonuç hatalıysa (`Data was written.`) toast bunu söyler; `Retry` yoktur ve `Support reference` görünür.
#### List failure
Sorgu/liste hatası toast'ı: `Data was not written.` ve `Support reference`.
#### Auto-dismiss
Süre kuralının tek sahibi burasıdır: yazılmış (`Data was written.`) ve sorgu/liste hatası toast'ları kendiliğinden kapanır, kapatma kontrolü zorunlu değildir; yazılmamış yazma toast'ı yalnız kapatma ya da `Retry` ile kapanır.
#### Schema drift
Şema kayması listesi hatası: neden satırı (`Please restart after applying the latest migration.` veya `Please restart the API and try again.`) ile birlikte `Data was not written.` ve `Support reference` görünür; ham SQLSTATE (`42P01`, `42703`) ve "404 Not Found" görünmez.
#### Unreachable
Sunucuya ulaşılamadı: `Support reference unavailable.`; ham tarayıcı ağ mesajı hiç gösterilmez.
#### Retry used
İkinci (tekrarlanan) başarısızlıkta `Retry` kaybolur, `Do not retry.` görünür (hem toast'ta hem `Session unavailable` bloğunda).
#### Unknown outcome
`Data write outcome is unknown.` görünür, `Retry` gösterilmez.
#### Retrying
Blok `aria-busy` durumda, düğme pasif.

**Spec:** [03 Web macOS Client](../../specs/03-web-macos-client/spec.md), [01 Account Access](../../specs/01-account-access/spec.md) (`Session unavailable`, korunan rota)

## 20.16 · Offline
> Bağlantı kesildiğinde yazmanın kuyruğa alınmadığını, son başarılı kaydın zamanını ve gerekiyorsa kaydedilmemiş riski göstermek.

**Artboard'lar**
- `20.16 · Offline · Inline banner · 1440`
- `20.16 · Offline · Inline with unsaved risk · 1440`
- `20.16 · Offline · Empty state · 1440`

### Bant / boş durum
Sayfa içeriğinin üstünde satır içi bant; içerik okunamıyorsa tam boş durum bloğu. Başlık, tek cümle açıklama, `Last saved` zamanı, koşullu risk satırı, `Retry`.
- **Label'lar:** `You’re offline`, `Last saved`, `Not yet`, `Unsaved changes may be lost`, `Retry`.

### Durumlar
#### Inline
Bant, içerik görünür ama yazma kapalı.
#### Empty
Tam boş durum: içerik okunamıyor.
#### Unsaved risk
`Unsaved changes may be lost` yalnız risk bayrağı varken.

**Spec:** [03 Web macOS Client](../../specs/03-web-macos-client/spec.md)

## 20.17 · Update Required
> 30 günlük imzalı masaüstü API penceresinin dışındaki macOS istemcisini güvensiz bir yazmadan önce açıkça durdurmak.

**Artboard'lar**
- `20.17 · Update Required · Default · 1440`
- —

### Durum bloğu
İçerik yerine tek blok: başlık ve tek cümle.
- **Label'lar:** `Update required`, `This desktop version must be updated before you can save changes.`

### Durumlar
#### Status
Kabuk içinde bant olarak (`layout=status`).

**Spec:** [03 Web macOS Client](../../specs/03-web-macos-client/spec.md)

## 20.19 · Not Found
> Kaynak kaydı veya rota çözümlenemediğinde, varlığını ya da başlığını sızdırmadan salt okunur bir durum göstermek.

**Artboard'lar**
- `20.19 · Not Found · Source record unavailable · 1440`
- —

### Durum bloğu
`00.1 · App Frame` içinde, içerik alanında tek blok: tek cümle; nedeni biliniyorsa kırık referans nedeni ve başlık sızmama kuralı `20.10 · Kırık uç`'taki gibidir (neden label'ları orada).
- **Label'lar:** `Source record is unavailable.`, `Document or Project is unavailable.`, `Smart Collection is unavailable.`, `Technical Diagram is unavailable.`

### Durumlar
#### Generic
Genel rota bulunamadı metni: `This page is unavailable.`
#### Typed
Tür bazlı metinler yukarıdaki gibi.

**Spec:** [12 Relations](../../specs/12-relations/spec.md) (kırık referans dili), [39 Favorites](../../specs/39-favorites/spec.md)

## 20.20 · Session Ended
> İptal edilmiş veya süresi dolmuş (12 saat boşta / 30 gün mutlak) ürün oturumunda yazmayı fail-closed durdurup kurucuyu korunan kabuğu göstermeden Account Access'e döndürmek.

**Artboard'lar**
- `20.20 · Session Ended · Default · 1440`
- —

### Giriş
Giriş yüzeyi, düğme ve bekleme durumları → `01.1 · Login`; bu ekranın tek farkı üstte oturumun sona erdiğini söyleyen tek açıklama satırıdır. Hesap veya Çalışma Alanı varlığı açıklanmaz.
- **Label'lar:** `Your session has ended. Sign in again to continue.`; diğerleri → `01.1`.

### Durumlar
#### Revoked
Başka cihazdan `Revoke Session` sonrası: aynı ekran.
#### Waiting for GitHub
→ `01.1`.
#### Session unavailable (karşıt)
Geçici servis hatası oturum bitişi değildir → `20.15`.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md)

## 20.21 · Archived Read-only Banner
> Arşivlenmiş Proje (ör. Ferry) ve onun kayıtlarında yüzeyin salt okunur ve hareketsiz olduğunu, hangi güvenlik eylemlerinin hâlâ açık olduğunu her yüzeyde aynı bantla söylemek.

**Artboard'lar**
- `20.21 · Archived Read-only Banner · Project surface · 1440`
- —

### Bant
Yüzey başlığının hemen altında tam genişlik ince bant: arşivde olduğu; normal düzenleme, GitHub eşitlemesi, otomasyon ve hatırlatmanın durduğu; yalnız erişimi azaltan güvenlik eylemlerinin (Dış yüzey iptali, token/parola döndürme, oturum sonlandırma, entegrasyon kesme, `Redact`) açık olduğu. `Delete Project` ve `Archive` bantta bulunmaz; `Delete Project` yalnız Arşiv görünümünde sunulur (→ `08.27`).
Arşivli Proje metni ve bantın sahibi burasıdır: `11.1`, `11.5`, `11.12`, `12.x`, `15.1` gibi yüzeyler `Archived project` durumunda yüzeye özgü metin yazmaz, bu banta bağlanır; yalnız yüzeyin neyi kapattığını (ör. oluşturma yok) ekler.
- **Label'lar:** `Archived`, `This Project is archived and read-only.`, `Unarchive`.

### Durumlar
#### Restored from Trash
Silinip geri yüklenen Proje Arşive döner: aynı bant, yayınlar ve GitHub bağı açılmamış notuyla; arşivden çıkarma da GitHub'ı açmaz, yeniden bağlama akışı `18.5`'tedir.

**Spec:** [83 Project Retirement](../../specs/83-project-retirement/spec.md), [35 Personal Reminders](../../specs/35-personal-reminders/spec.md) (hatırlatma durur), [77 Trash](../../specs/77-trash/spec.md) (`Delete Project` yalnız Arşivden)

## 20.22 · Create Follow-up Work
> Bir kaynaktan (bildirim, Geri Bildirim, Odak Dönemi, Reconcile, Ürün Boşluğu, Spec Değişikliği adayı, Oturum Testi, Üretim Olayı) tam olarak bir takip İşi önizleyip onayla oluşturmak; kaynağı kapatmamak.

**Artboard'lar**
- `20.22 · Create Follow-up Work · From notification · 1440`
- `20.22 · Create Follow-up Work · From notification · 768`
- `20.22 · Create Follow-up Work · From Product Gap · Create · 1440`
- `20.22 · Create Follow-up Work · From Product Gap · Relate a Feature · 1440`
- `20.22 · Create Follow-up Work · From Spec Change Review · 1440`
- `20.22 · Create Follow-up Work · From Test Session · New Work · 1440`
- `20.22 · Create Follow-up Work · From Test Session · Link to existing · 1440`
- `20.22 · Create Follow-up Work · From Production Incident · 1440`
- `20.22 · Create Follow-up Work · Error · 1440`

### Ortak önizleme
Oluşacak tek İşin salt okunur önizlemesi: başlık, tür, hedef Proje, başlangıç durumu ve köken ilişkileri. Onaydan önce hiçbir şey yazılmaz; onay tek İş oluşturur, kaynağın durumunu ve inceleme sonucunu değiştirmez.
- **Label'lar:** dialog başlığı `Create Follow-up Work`; eylem label'ı `Create follow-up work` (Ürün Boşluğu, Oturum Testi, Üretim Olayı; spec 58/57/66). Bildirim (spec 71) ve Spec Değişikliği adayı (spec 52) giriş eylemini de `Create Follow-up Work` yazar. Yazım kuralının tek sahibi burasıdır; `Follow-up Work preview`, `Title`, `Description`, `Work type`, `Target Project`, `Starting status`, `Originates from`, `Confirming creates exactly one Work. Nothing exists until then.`, `Cancel`, `Confirm`.

### Kaynağa göre farklar
| Kaynak | Çağıran ekran | Yalnız bu kaynağa özgü |
|---|---|---|
| Bildirim | `00.5 · Notification Center` | Kaynak `LUMA-51 Stripe webhook retry` · `github-check-failed`; yeni İş Luma'da "Fix failing ci / test on PR #88"; köken: sinyal ve `LUMA-51`. Bildirimi kapatmaz. Bitince satır açık kalır, yanında yeni İşe bağlantı görünür. |
| Geri Bildirim | `11.10 · Convert to Work` | Giriş `Convert to Work`; `Feature` seçilemez, hedef Proje Geri Bildirimin kendi Projesidir; köken: bu Geri Bildirim → yeni İş; Geri Bildirimin değişmediği cümlesi `11.10`'da. |
| Odak Dönemi | `04.4 · Close Focus Period` | Giriş `Add follow-up Work` (Period evaluation öğreniminden); ek alanlar `Learning source`, `Source Focus Period`; hedef Proje seçilir (`Select Project`). Dönemin durumu ve kapanışı değişmez. |
| Related Work (Reconcile) | `09.25 · Reconcile` | Giriş `Add follow-up Work`; önerilen ilişkilerle (`Proposed relations`) birlikte açıkça seçilen takip İşleri; kaynak Devir/dönen sonuç değişmez, `Reconcile` ayrı onaydır. |
| Ürün Boşluğu | `07.1 · Product Gaps` | Seçim: `Create follow-up work` veya `Relate a Feature`; `Target Project` (`tidekit`), `Feature relation`; önizleme `Create 1 Feature in tidekit.` ya da `Relate Feature <ad> as a follow-up. No Work is created.`; `Preview follow-up`, `Confirm follow-up`, `Discard preview`. Sonuç `Follow-up Work created.` / `Follow-up Feature related.` |
| Spec Değişikliği adayı | `10.16 · Spec Change Review` | Ek alan `Changed spec versions` (Version 4 → Version 5) ve `Why`; örnek `Update reminder copy for 72-hour retries` · Task · Luma · `Not Started`. `The review status of the candidate does not change.` |
| Oturum Testi | `15.10 · Test Session Review` | Eylem `Create follow-up work`; `Target` (yeni İş / mevcut İş), `Results for follow-up`, `Results to link`; önizlemede `Originates from` (Test Oturumu) ve `Origin Location` (kesin Oturum Testi); mevcut İş seçiliyse `The Work keeps its own Origin; only the results are linked.` Örnek mevcut İş `LUMA-42`; sonuçlar `Bounce on +alias address`, `Retry header present`. |
| Üretim Olayı | `17.2 · Production Incident Detail` | Eylem `Create follow-up work`; Work alanları (örnek Task "Alert when reminder queue age > 15 min") ve ayrı `Relation preview`: `Originates from` → bu Üretim Olayı, varsa ek bağlar. |

### Durumlar
#### Applying
Düğme bekleme durumunda.
#### Loading
`Loading preview…`
#### Error
Önizleme: `The preview could not be loaded. Reload and try again.`; `The follow-up preview is unavailable.`; `Follow-up targets could not be loaded.`. Onay hatası: `The Work could not be created. If the review changed, preview again.`; `The follow-up was not created.`. Hiçbir ilişki yazılmaz. Genel yazma hatası → `20.15`.
#### Applied
Dialog kapanır; kaynak yerinde kalır, yeni İşe bağlantı görünür.

**Spec:** [71 Attention Signals](../../specs/71-attention-signals/spec.md), [58 Product Gaps](../../specs/58-product-gaps/spec.md), [52 Spec Change Review](../../specs/52-spec-change-review/spec.md), [57 Test Review and Follow-up](../../specs/57-test-review-and-follow-up/spec.md), [66 Production Incidents](../../specs/66-production-incidents/spec.md), [09 Work Lifecycle](../../specs/09-work-lifecycle/spec.md), [47 Feedback](../../specs/47-feedback/spec.md), [30 Focus Period](../../specs/30-focus-period/spec.md), [24 External Handoffs](../../specs/24-external-handoffs/spec.md).

## 20.23 · Account Closing Banner
> Hesap `Closing` dondurmasında kurucunun gördüğü her yüzeyde normal yazmaların reddedildiğini ve yalnız kapanışı iptal etmenin ile dışa aktarmanın açık olduğunu aynı bantla söylemek.

**Artboard'lar**
- `20.23 · Account Closing Banner · Workspace surface · 1440`
- —

### Bant
Yüzey başlığının hemen altında tam genişlik ince bant; yalnız dondurmada görünür. Yazma eylemleri pasiftir ve nedeni bantla aynı cümleyi izler; kurucu oturumu `Closing` geçişinde sona erdiği için dondurmada dönen kurucu bu bantlı yüzeyleri görür. Bant iki eylem sunar: kapanışı iptal etmek ve `Workspace Exit Package` ekranına (`02.14`) gitmek. `Closing` geçişinin kendisi `01.10`'dadır; burada yeniden çizilmez.
- **Label'lar:** `This Account is closing. Only cancelling the closure and exporting are available.`, `Cancel closing`, `Workspace Exit Package`.

### Durumlar
#### Frozen write
Dondurmada yazma eylemi seçilince eylem yazmaz; nedeni bantla aynı cümledir. `Export` ve `Import` için dialog notları `20.5 · Hesap kapanma dondurması` ve `20.6 · Kapanış dondurması`'ndadır.

**Spec:** [84 Account Closure](../../specs/84-account-closure/spec.md), [82 Workspace Exit](../../specs/82-workspace-exit/spec.md)
