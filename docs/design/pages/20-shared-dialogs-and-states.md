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
| [20.22 · Create Follow-up Work](#2022--create-follow-up-work) | Bildirim, Ürün Boşluğu, Spec adayı, Oturum Testi, Üretim Olayı için tek takip İşi önizlemesi |

## 20.1 · Confirm GitHub Identity
> Yüksek riskli işlemden hemen önce, yeni bir GitHub OAuth turuyla aynı değişmez GitHub kimliğini doğrulayıp tek kullanımlık, en fazla 10 dakikalık işleme bağlı yetkiyi almak; çağıran akışın kendi yazılı ad teyidine geri dönmek.

**Artboard'lar**
- `20.1 · Confirm GitHub Identity · Default · 1440`
- `20.1 · Confirm GitHub Identity · Waiting for GitHub · 1440`
- `20.1 · Confirm GitHub Identity · Mismatch · 1440`
- `20.1 · Confirm GitHub Identity · Confirmed · 1440`

### Yüksek risk adım şeridi
Çağıran dialog'un içinde ayrı numaralı adım; üç sıralı adım: 1) etki önizlemesi (çağıran), 2) `Confirm GitHub Identity`, 3) Hesap veya Proje adını yazma (çağıran). Kayıt başlığı değil, etkilenen Hesap veya Proje adı yazılır.
- **Label'lar:** `Confirm GitHub Identity`, `Confirm GitHub Identity and type the Project name to continue.`, `Type the Project name to confirm`.

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
Kayda bağlı her Dış yüzey satırı: tür (bağlantı paylaşımı / Wiki yayını / Build in Public), durum, son onay zamanı. Varsayılan sonuç: terminal iptal, ziyaretçi oturumları kapanır, URL/token yeniden kullanılmaz.
- **Label'lar:** `Active`, `Expired`, `Revoked`, `Keep approved surface`.

### Eylemler
`Cancel`, `Move to Trash`.
- **Label'lar:** `Cancel`, `Move to Trash`.

### Durumlar
#### Dış yüzey yok
Bağlı Dış yüzeyler bölümü çizilmez.
#### Yapılandırma çöpü
Custom field, öncelik ölçütü, Akıllı Koleksiyon, adlandırılmış görünüm, Önceliklendirme oturumu, otomasyon kuralı, Kayıt Eylemi, şablon: etkilenen saklı değerler ve bağımlı görünüm/kural listesi; "çöpteyken çalışmaz" notu.
#### Grup silme bağlamı
Proje silme grubu (yalnız Arşivden `Delete Project`, 83): grup içeriği tek 30 günlük birim, bütün proje kapsamlı Dış yüzeyler terminal iptal; `Keep approved surface` hiç görünmez. Çalışma Alanı ve Kişisel Wiki kayıtları gruba girmez.
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
→ `20.1` GitHub adımı, sonra Hesap veya Proje adı alanı.
- **Label'lar:** `Confirm GitHub Identity`, `Type the Project name to confirm`.

### Durumlar
#### Engelli
Aktif bir Dış yüzey kaydı hâlâ kullanıyorsa veya hassas içerik güvenle kaldırılmadıysa uygulama eylemi yok; neden ve ilgili yer gösterilir (Dış yüzey yönetimi veya `Redact` → `20.7`).
#### Name mismatch
Alan altında satır içi hata; yazma yok.
#### Finalizing
Bariyerden sonra `Finalizing`, iptal yok (→ `20.14`).
#### Error
→ `20.15`.

**Spec:** [77 Trash](../../specs/77-trash/spec.md), [01 Account Access](../../specs/01-account-access/spec.md)

## 20.4 · Share
> Seçili kök kaydın kapalı dünya önizlemesini kurucuya tek tek onaylatıp bağlantıyla sınırlı salt okunur paylaşım (Dış yüzey + Onaylı snapshot revizyonu) oluşturmak; mevcut bağlantının parola, süre ve iptalini yönetmek.

**Artboard'lar**
- `20.4 · Share · Scope preview · 1440`
- `20.4 · Share · Scope preview · 768`
- `20.4 · Share · Placeholder warning · 1440`
- `20.4 · Share · Approved · 1440`
- `20.4 · Share · Expired · 1440`

### Kapsam önizlemesi
Geniş dialog'un sol sütunu (onay kutulu liste); seçili öğenin ziyaretçi önizlemesi. Çıkacak her kesin kayıt, sürüm, alan, ilişki, gömü ve Dosya Eki sürümü ayrı satır; Proje Duvarı/Moodboard'da kart, yerleşim, grup başlığı, görsel çizgi, görünüm metni, odak sırası, palet, kırpma/döndürme, işaretleme katmanı, canlı Akıllı Koleksiyon bloğu ayrı öğeler. Adlandırılmış görünümden başlanmışsa filtre/düzen yalnız ilk taslaktır.
- **Label'lar:** `Share`, `Approved snapshot`, `Live`, `Some fields live`, `Source visual`, `Marking layer`.

### Canlı alanlar
Varsayılan kapalı izin listesi: kullanıcıya dönük durum/kapanış sonucu, öncelik, planlı tarihler, Roadmap ufku, Kilometre Taşı ve Proje Sürümü durumu, hesaplanmış özetler. Başlık, açıklama, Markdown, yorum, ilişki gerekçesi, Contact/Company, URL, Dosya Eki, Secret, özel alanlar listede hiç yoktur.
- **Label'lar:** `Live`.

### Hariç tutulanlar ve dolaylı sızıntı
Kapsama hiç girmeyenlerin açıklaması: Secret, paylaşım token'ı, bağlantı parolası, Yakalama Gelen Kutusu öğesi, çözülmemiş Toplu Anlamlandırma, kaydedilmemiş Taslak, taranmamış ZIP. Önizleme özel ad, ilişki ucu, iletişim bilgisi, dosya üstverisi ve görünüm boşluğu uyarılarını öğe yanında gösterir.
- **Label'lar:** `Not included`.

### Yer tutucu kontrolü
Çözülmemiş `{{alan_adı}}` listesi: kaynak kayıt, alan, metin bağlamı. Kod bloğu ve satır içi koddaki eşleşmeler listelenmez. Bu bölüm 74 (`Publish Wiki Document`, sayfa 05) ve 75 (Build in Public, sayfa 08) önizlemelerinde aynı çizimle tekrar kullanılır.
- **Label'lar:** `Publish/share anyway`.

### Erişim ayarları
Altta: isteğe bağlı ortak parola (kimlik değildir açıklamasıyla), isteğe bağlı sona erme tarih/saati profil saat diliminde (varsayılan yok). Bağlantının bearer olduğu, elinde tutan herkesin erişebileceği dürüstçe yazılır.
- **Label'lar:** `Password`, `Expires on`, `No expiry`.

### Durumlar
#### Approved (link minted)
Bağlantı metni ve kopyalama, son kapsam onay zamanı, `Approved snapshot` / `Some fields live`.
#### Mevcut bağlantı
Parola ekle/değiştir/kaldır, süreyi uzat, `Revoke` (terminal, geri dönüşsüz uyarı). Sonraki kaynak değişiklikleri yalnız fark önizlemesinde (76 `Review diff`) görünür.
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

### Biçim
Orta genişlikte dialog'un başı: `JSON` ve `CSV` seçimi; JSON'un kanonik round-trip, CSV'nin düz ve kayıplı olduğu.
- **Label'lar:** `Export`, `JSON`, `CSV`.

### Önizleme
Çıkacak kayıtlar, alanlar, kimlikler, yalnız iki ucu seçili ilişkiler; JSON'da şema sürümü, Work-key geçmişi, kapsamdaki custom field tanımları, köken. Erişilemeyen alanlar listelenmez.
- **Label'lar:** `Schema version`, `Scope`, `Filters`, `Visible fields`, `Produced at`.

### CSV kayıp ve formül raporu
CSV'de kaybolacak ilişkiler, türler, kimlikler; `=`, `+`, `-`, `@`, tab, CR ile başlayan hücrelerin veri olarak kaçışlandığı ve hangi hücreler olduğu.
- **Label'lar:** `Lost in CSV`, `Escaped as data`.

### Manifest ve bölge notu
Şema sürümü, kapsam, filtreler, görünür alanlar, üretim zamanı; canlı verinin AB bölgesinde kaldığı, dosyanın kurucunun kopyası olduğu; bunun `Workspace Exit Package` veya yedek olmadığı. Secret, oturum/entegrasyon/paylaşım token'ı ve bağlantı parolası hiçbir çıktıda yoktur.
- **Label'lar:** `Workspace Exit Package` (karşılaştırma notunda).

### Giriş yeri
Bir listenin veya Akıllı Koleksiyonun başlığındaki `Export` eylemi; seçim varsa seçili kayıt sayısı, yoksa kesin görünüm gösterilir. Kayıt eyleminden de açılır (→ [Record Header](design-system.md#ds11--record-header)). Desteklenmeyen tür veya sınır aşımında giriş kapalıdır ve nedeni yazılıdır; eşzamanlı dışa aktarma kapasitesi aşılınca görünür ret verilir. Barındıran ekranlar: `02.4` Saved list, İş listeleri, Akıllı Koleksiyonlar, Belge listesi. Örnek: Luma İş listesinde 4 seçili kayıt.

### Durumlar
#### Limit aşıldı
10.000 satır veya 25 MB aşılırsa indirme yok; kapsamı bölme açıklaması.
#### Kapasite reddi
Eşzamanlı dışa aktarma kapasitesi doluysa görünür ret; sessiz uzun iş yok.
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

### 1 · Dosya ve hedef
Adımlı geniş dialog'un ilk adımı: tek dosya seçimi, kayıt türü, hedef kapsam (Proje veya Kişisel Wiki); 10.000 satır / 25 MB sınırı; klasör, ZIP, çok dosya yok.
- **Label'lar:** `Import`, `Choose file`, `No file selected`.

### 2 · Eşleme
Kaynak sütun → ürün alanı / Proje custom field eşlemesi, kayıplar.
- **Label'lar:** `Source column`, `Product field`, `Skip column`.

### 3 · Fark ve çatışmalar
Yazılacak kesin küme; geçersiz satırlar (düzelt veya açıkça düşür); kararlı köken eşleşmesinde `update existing` / `skip` / `resolve conflict`; kalıcı silinmiş kimliğin yeni kimlik ve önceki kökenle geleceği; ilişkilerin yalnız açık eşlemeyle yeni kimliklere bağlanacağı; kararlı kimlik yoksa tahmin yapılmadığı.
- **Label'lar:** `Update existing`, `Skip`, `Resolve conflict`.

### 4 · Apply Import
Ayrı onay adımı; "ya hepsi bir kez ya hiçbiri".
- **Label'lar:** `Apply Import`, `Cancel`, `Finalizing`.

### 5 · Makbuz
Tam commit veya tam rollback makbuzu; oluşan/güncellenen sayılar; kaynak dosya kapsamı.
- **Label'lar:** `Import receipt`, `Created`, `Updated`, `Rolled back`.

### Giriş yeri
Hedef kapsamdaki `Import` eylemi; tek dosya, tek tür, tek kapsam notu yanında görünür. Barındıran ekranlar: Proje `Documents`, Kişisel Wiki, Saved list. Örnek: `luma-work.csv` · Work · Luma. Desteklenmeyen tür veya sınır aşımında giriş kapalıdır ve nedeni yazılıdır.

### Durumlar
#### Bilinmeyen şema
Bilinmeyen gelecek JSON şema sürümü: yazmadan ret.
#### Reddedilen tür
Teknik Diyagram JSON, DDL/DBML, Draw.io/Visio; `test-report/1` zarfı (54'e devredilir, burada Belge/İş yazılmaz); GitHub-as-truth.
#### Kapanış dondurması
`Closing`/dondurmada yeni import reddi (84).
#### Rollback
Tam rollback makbuzu, hiçbir kayıt görünmez, `Support reference`.

**Spec:** [80 Data Import](../../specs/80-data-import/spec.md), [04 Mutation and Undo](../../specs/04-mutation-and-undo/spec.md) (`Finalizing`)

## 20.7 · Redact
> Hassas bir değeri güncel içerikten ve onu taşıyan her kopyadan geri döndürülemez kaldırmak; önizleme, `Confirm GitHub Identity` ve yazılı Hesap/Proje adıyla.

**Artboard'lar**
- `20.7 · Redact · Spread preview · 1440`
- `20.7 · Redact · Ready · 1440`
- `20.7 · Redact · Result mark · 1440`

### Yayılım önizlemesi
20.1 adım şeridinin adım 1'i; değeri hâlâ taşıyan her yer ayrı satır: güncel alan, kayıt geçmişi revizyonları, Dış yüzey Onaylı snapshot revizyonları, arama indeksi, dışa aktarma staging'i, cache. Serbest Markdown'da secret tespiti iddia edilmediği notu.
- **Label'lar:** `Redact`.

### Teyit
→ `20.1`; sonra Hesap veya Proje adı (kayıt başlığı değil).
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
Dialog'un üstü: mevcut alan seçimi ve yeni değer; `Closed` seçilirse kapanış adımı (`Closure result`, `Reason`).
- **Label'lar:** `Bulk Edit`, `Status`, `Select status`, `Closure result`, `Reason`, `Closure check`, `Close anyway`.

### Preview
; seçili her İş için önce → sonra; seçilmeyenler yok. Arşiv/Çöp İşleri yalnız onları gösteren yüzeyde açıkça seçildiyse.
- **Label'lar:** `Preview`, `No changes to apply.`, `Apply`.

### Progress ve sonuçlar
Sonra `Progress` ve sonuç tablosu: ilk ilerleme bütçe içinde (p95 1 sn); her İş için `Succeeded`, `Failed` (`Support reference` ile), `Canceled`; bariyeri geçmiş satırlar `Finalizing`. Başarılı geri alınabilir değişiklikte satır `Undo`; geri alınınca `Undone`.
- **Label'lar:** `Progress`, `Succeeded`, `Failed`, `Canceled`, `Finalizing`, `Undo`, `Undone`, `Support reference`.

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
#### Fired signal
Tetiklenen sinyalde `Dismiss` ve yeni zaman seçimi — sunum Bildirim Merkezi'nde (`00 · Shared Shell`).

**Spec:** [35 Personal Reminders](../../specs/35-personal-reminders/spec.md)

## 20.10 · Relation Picker & Used in
> İki ana kaydı kapalı tür kataloğundan bir ilişkiyle önizleyerek bağlamak; kaydın nerede kullanıldığını standart ilişki geri bağlantıları ve kullanım bağları olarak ayrı göstermek; kırık ucu sızdırmadan sunmak.

**Artboard'lar**
- `20.10 · Relation Picker & Used in · Relations and Used in · 1440`
- `20.10 · Relation Picker & Used in · Picker preview · 1440`
- `20.10 · Relation Picker & Used in · Broken targets · 1440`

### Seçici
Küçük dialog: ilişki türü (kapalı katalog), hedef kayıt araması, `Relation preview` (iki uç + tür + yön).
- **Label'lar:** `Relation type`, `Related`, `Origin`, `Derived`, `Select a Work`, `Relation preview`, `Review the relation preview before confirming.`

### Relations listesi
Kayıt ayrıntısında; türe göre gruplanmış standart ilişkiler; her satır kaynağı açar.
- **Label'lar:** `Relations`, `Remove relation`, `Remove`, `Relation removed.`, `Undo`, `No relations yet.`, `Loading relations…`

### Used in
İki ayrı grup: standart ilişki geri bağlantıları ve kullanım bağları (satır içi referans, canlı blok, sabitlenmiş dosya/wireframe bağı, akıştan Ekrana). Kullanım bağı satırları "backlink" olarak adlandırılmaz, ilişki sayısına girmez. Erişilemeyen kayıt sayılmaz ve adlandırılmaz.
- **Label'lar:** `Used in`, `Pinned bind`.

### Kırık uç (Silinmiş hedef işareti)
Varlık, neden, kurulma zamanı; gövde/alan/önizleme yok. Başlık yalnız kurucu hedefe hâlâ erişebiliyorsa.
- **Label'lar:** `Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`, `Open source record`.

### Standart ilişki türleri kataloğu
Seçici yalnız bu kapalı katalogdaki türleri sunar; iki uç, yön ve izinli uç türleri her tür için sabittir:
`Related`, `Origin` / `Derived`, `Evidence` / `Provides evidence`, `Contributes to Goal` / `In Goal`, `Blocks` / `Blocked by`, `Includes` / `Included in`, `Contributes to Milestone` / `In Milestone`, `Primary spec`, `Supersedes` / `Superseded by`, `Implements` / `Implemented by`, `Belongs to Company`, `Participant`, `Required for completion` / `Contextual`.

### Durumlar
#### Empty
`No relations yet.`
#### Loading
`Loading relations…`
#### Error
`Relation could not be created.`, `Relation could not be removed.`, `Relation could not be undone.`, `Relation preview failed.`, `This relation is no longer available for Undo.`

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
`Tag could not be applied.`, `Tag could not be created.`, `Tag could not be removed.`, `Tag could not be renamed.`, `Check the tag name.`, `Tag is unavailable.`

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

### Yükleme
Üstte yükleme sırası: dosya seçimi, seçili dosya adı, yükleme; tür/boyut kuralları (görsel 25 MB, PDF 50 MB, CSV 25 MB, metin 10 MB, ses 100 MB, video 250 MB, ZIP 100 MB yalnız indirme). SVG, HTML, çalıştırılabilir, script, makrolu ofis ve bilinmeyen MIME/uzantı reddedilir.
- **Label'lar:** `Choose file`, `No file selected`, `Upload`, `Uploading`, `Cancel`, `Finalizing`, `This file type is not supported.`, `File Attachment upload could not be completed. Try again.`

### Önizleme
Dosya listesi + seçili dosyanın büyük önizlemesi; türe göre: görsel; sayfalı PDF; sınırlı CSV satırları (`Preview is truncated`); güvenli düz metin; kullanıcı başlatmalı ses/video (hız, tam ekran, döngü, altyazı); ZIP önizlemesi yok.
- **Label'lar:** `File Attachment`, `Preview`, `CSV preview`, `PDF preview`, `Loading PDF preview`, `Download`, `Playback speed`, `Fullscreen`, `Loop`, `Captions`, `Unavailable`, `Retry preview`, `Preview is unavailable.`, `PDF preview is unavailable. Download the original file instead.`

### Versions
Aynı kaydın sürüm zinciri; her sürüm özgün hâliyle görüntülenebilir/indirilebilir. `Upload new version` önce hedef kayıt, mevcut sürüm ve gelen dosyayı yan yana gösterir.
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

### Documents alanında ve Belge sahipliği
Dosya Eki Documents alanında Projenin kapsamında `Project File Attachments` bölgesi olarak, ayrıca kayıt eklerinde ve Moodboard'da aynı bileşenle görünür; Belge ya da global havuz değildir. Bölge gövdesi bu kartın klonudur. Satırda eki sahiplenen Belge görünür; sahiplik `Assign File Attachments` ile kurulur (→ `10.10`). Örnek: `etiquette-survey.csv` → `Late-payment etiquette notes`. Luma ekleri: `gmail-alias-bounce.png`, `stripe-webhook-log.txt`, `etiquette-survey.csv`, `beta-onboarding.mp4`, `ferry-assets.zip`.

### Durumlar
#### Empty
Dosya yok: yalnız yükleme sırası ve kısa açıklama.
#### Upload failed
Görünür Dosya Eki yok; neden, yazma sonucu, `Support reference` (→ `20.15`).
#### Quota warning
%80'de uyarı; aşıldığında yeni yükleme/sürüm kapalı, okuma/indirme/silme açık.
#### Preview Unavailable
Decode/kare sınırı aşan görsel: `Unavailable`, `Download` açık, dosya bozuk işaretlenmez.
#### Bind errors
`Location preview is unavailable.`, `Bind as origin could not be completed.`, `A Project is required for a new Work.`
#### Empty (Documents alanı)
`No File Attachments are available in this Project yet.` ve yükleme sırası.
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
Tek yığın; ne değişti cümlesi + `Undo`. Yalnız tersi deterministik değişikliklerde (alan, ilişki, görünüm üstverisi, atomik dönüşüm).
- **Label'lar:** `Undo`, `Relation removed.`, `Tag renamed.`, `Undone`.

### Conflict
Satır içi, düzenlenen alanın yanında: güncel olmayan tabanda yazma reddi; `Current value` gösterilir; aynı idempotency anahtarıyla farklı payload için de `Conflict`. Undo aynı alandaki daha yeni değere çarparsa durur ve açıklar.
- **Label'lar:** `Conflict`, `Current value`, `Retry`, `This page is out of date.`

### Finalizing
Çok adımlı yazma bariyeri geçince `Finalizing`; sahte `Cancel` yok. Sonuç tam commit veya tam rollback makbuzu.
- **Label'lar:** `Finalizing`, `Cancel` (yalnız bariyer öncesi).

### Aktör satırı
Kayıt geçmişinde aktör türü.
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
- `20.15 · Support Reference Error · Session check failed · 1440`
- `20.15 · Support Reference Error · Unreachable · 1440`
- `20.15 · Support Reference Error · Session unavailable · 1440`
- `20.15 · Support Reference Error · Session unavailable · Retry used · 1440`
- `20.15 · Support Reference Error · Session unavailable · Unknown outcome · 1440`

### Hata toast'ı
: neden; isteğe bağlı kurtarma ipucu; yazma sonucu; yeniden deneme sınırı; `Support reference` kodu veya `Support reference unavailable.`
<details>
<summary>Label'lar</summary>

`This action could not be completed.`, `Data was written.`, `Data was not written.`, `Data write outcome is unknown.`, `You can retry once.`, `Do not retry.`, `Support reference`, `Support reference unavailable.`, `Retry`, `Please restart the API and try again.`, `Please restart after applying the latest migration.`

</details>

### Oturum kontrolü durumu
Korunan rotada kabuk içinde tam blok: başlık, referans, yazma sonucu, sınır, `Retry`.
- **Label'lar:** `Cantiara couldn’t be reached.`, `Cantiara couldn’t check your session.`, `Session unavailable`, `Support reference`, `Support reference unavailable.`, `Retry`.

### Tam sayfa varyantı (Session unavailable)
Korunan rotada oturum denetimi geçici başarısız olduğunda içerik yerine uyarı bloğu çizilir; kurucu oturumdan çıkmış sayılmaz. Üst çubukta yalnız wordmark kalır. Blok sırasıyla: `Session unavailable` başlığı, `Support reference` satırı, yazma sonucu, yeniden deneme sınırı, `Retry`.
- **Label'lar:** `Session unavailable`, `Cantiara couldn’t be reached.`, `Cantiara couldn’t check your session.`, `Support reference`, `Support reference unavailable.`, `Data was not written.`, `Data write outcome is unknown.`, `You can retry once.`, `Do not retry.`, `Retry`.

### Durumlar
#### Reference available
Sunucu referansı görünür.
#### Unreachable
Sunucuya ulaşılamadı: `Support reference unavailable.`; ham tarayıcı ağ mesajı hiç gösterilmez.
#### Repeated failure
`Retry` gizlenir, `Do not retry.`
#### Retry used
İkinci başarısızlıkta `Retry` kaybolur, `Do not retry.` görünür.
#### Unknown outcome
`Data write outcome is unknown.` görünür, `Retry` gösterilmez.
#### Retrying
Blok `aria-busy` durumda, düğme pasif.

**Spec:** [03 Web macOS Client](../../specs/03-web-macos-client/spec.md), [01 Account Access](../../specs/01-account-access/spec.md) (`Session unavailable`), [01 Account Access](../../specs/01-account-access/spec.md) (korunan rota)

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
`00 · Shared Shell` içinde, içerik alanında tek blok: tek cümle; nedeni biliniyorsa kırık referans nedeni (yalnız erişim varsa başlık).
- **Label'lar:** `Source record is unavailable.`, `No access`, `Permanently deleted`, `Document or Project is unavailable.`, `Smart Collection is unavailable.`, `Technical Diagram is unavailable.`

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
Account Access giriş yüzeyi; üstte kısa açıklama satırı: oturumun sona erdiğini söyleyen tek satır (`Your session has ended. Sign in again to continue.`), `Continue with GitHub`. Hesap veya Çalışma Alanı varlığı açıklanmaz.
- **Label'lar:** `Continue with GitHub`, `Waiting for GitHub`, `GitHub is taking a moment to respond.`

### Durumlar
#### Revoked
Başka cihazdan `Revoke Session` sonrası: aynı ekran.
#### Waiting for GitHub
GitHub kesintisinde yeni giriş görünür biçimde bekler.
#### Session unavailable (karşıt)
Geçici servis hatası oturum bitişi değildir → `20.15`.

**Spec:** [01 Account Access](../../specs/01-account-access/spec.md)

## 20.21 · Archived Read-only Banner
> Arşivlenmiş Proje (ör. Ferry) ve onun kayıtlarında yüzeyin salt okunur ve hareketsiz olduğunu, hangi güvenlik eylemlerinin hâlâ açık olduğunu her yüzeyde aynı bantla söylemek.

**Artboard'lar**
- `20.21 · Archived Read-only Banner · Project surface · 1440`
- —

### Bant
Yüzey başlığının hemen altında tam genişlik ince bant: arşivde olduğu; normal düzenleme, GitHub eşitlemesi, otomasyon ve hatırlatmanın durduğu; yalnız erişimi azaltan güvenlik eylemlerinin (Dış yüzey iptali, token/parola döndürme, oturum sonlandırma, entegrasyon kesme, `Redact`) açık olduğu.
- **Label'lar:** `Archived`, `Archive`, `Delete Project`; `This Project is archived and read-only.`, `Unarchive`.

### Durumlar
#### Restored from Trash
Silinip geri yüklenen Proje Arşive döner: aynı bant, yayınlar ve GitHub bağı açılmamış notuyla.

**Spec:** [83 Project Retirement](../../specs/83-project-retirement/spec.md), [35 Personal Reminders](../../specs/35-personal-reminders/spec.md) (hatırlatma durur), [77 Trash](../../specs/77-trash/spec.md) (`Delete Project` yalnız Arşivden)

## 20.22 · Create Follow-up Work
> Bir kaynaktan (bildirim, Ürün Boşluğu, Spec Değişikliği adayı, Oturum Testi, Üretim Olayı) tam olarak bir takip İşi önizleyip onayla oluşturmak; kaynağı kapatmamak.

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
- **Label'lar:** `Create Follow-up Work`, `Follow-up Work preview`, `Title`, `Description`, `Work type`, `Target Project`, `Starting status`, `Originates from`, `Confirming creates exactly one Work. Nothing exists until then.`, `Cancel`, `Confirm`.

### Kaynağa göre farklar
| Kaynak | Çağıran ekran | Yalnız bu kaynağa özgü |
|---|---|---|
| Bildirim | `00.5 · Notification Center` | Kaynak `LUMA-51 Stripe webhook retry` · `github-check-failed`; yeni İş Luma'da "Fix failing ci / test on PR #88"; köken: sinyal ve `LUMA-51`. Bildirimi kapatmaz. Bitince satır açık kalır, yanında yeni İşe bağlantı görünür. |
| Ürün Boşluğu | `07.1 · Product Gaps` | Seçim: `Create follow-up work` veya `Relate a Feature`; `Target Project` (`tidekit`), `Feature relation`; önizleme `Create 1 Feature in tidekit.` ya da `Relate Feature <ad> as a follow-up. No Work is created.`; `Preview follow-up`, `Confirm follow-up`, `Discard preview`. Sonuç `Follow-up Work created.` / `Follow-up Feature related.` |
| Spec Değişikliği adayı | `10.16 · Spec Change Review` | Ek alan `Changed spec versions` (Version 4 → Version 5) ve `Why`; örnek `Update reminder copy for 72-hour retries` · Task · Luma · `Not Started`. `The review status of the candidate does not change.` |
| Oturum Testi | `15.10 · Test Session Review` | `Target` (yeni İş / mevcut İş), `Results for follow-up`, `Results to link`; önizlemede `Originates from` (Test Oturumu) ve `Origin Location` (kesin Oturum Testi); mevcut İş seçiliyse `The İş keeps its own Origin; only the results are linked.` Örnek mevcut İş `LUMA-42`; sonuçlar `Bounce on +alias address`, `Retry header present`. |
| Üretim Olayı | `17.2 · Production Incident Detail` | İş alanları (örnek Task "Alert when reminder queue age > 15 min") ve ayrı `İlişki önizlemesi`: `Originates from` → bu Üretim Olayı, varsa ek bağlar. |

### Durumlar
#### Applying
Düğme bekleme durumunda.
#### Loading
`Loading preview…`
#### Error
Önizleme: `The preview could not be loaded. Reload and try again.`; `The follow-up preview is unavailable.`; `Follow-up targets could not be loaded.`. Onay hatası: `The Work could not be created. If the review changed, preview again.`; `The follow-up was not created.`. Hiçbir ilişki yazılmaz. Genel yazma hatası → `20.15`.
#### Applied
Dialog kapanır; kaynak yerinde kalır, yeni İşe bağlantı görünür.

**Spec:** [71 Attention Signals](../../specs/71-attention-signals/spec.md), [58 Product Gaps](../../specs/58-product-gaps/spec.md), [52 Spec Change Review](../../specs/52-spec-change-review/spec.md), [57 Test Review and Follow-up](../../specs/57-test-review-and-follow-up/spec.md), [66 Production Incidents](../../specs/66-production-incidents/spec.md), [09 Work Lifecycle](../../specs/09-work-lifecycle/spec.md).
