# 06 · Contacts

Kimlik defteri: Contact ve Company kayıtları.

| Ekran | Ne çizilir |
|---|---|
| [06.1 · Contacts](#061--contacts) | Liste ve Contact profili |
| [06.2 · Company](#062--company) | Company profili |
| [06.3 · Create Contact](#063--create-contact) | Contact / Company oluşturma dialog'u |
| [06.4 · Duplicate candidates](#064--duplicate-candidates) | Kopya aday çiftleri |
| [06.5 · Merge Contacts](#065--merge-contacts) | Birleştirme önizlemesi |
| [06.6 · Undo Merge](#066--undo-merge) | Birleştirmeyi geri alma önizlemesi |
| [06.7 · Export Personal Data](#067--export-personal-data) | Kişi paketi önizlemesi |
| [06.8 · Erase Personal Data](#068--erase-personal-data) | Adımlı redaksiyon onayı |

## 06.1 · Contacts
> Contact ve Company listesini taramak, bir Contact'ın profilini kimlik merkezi olarak açmak ve ilişkili kayıtlara kaynağında gitmek.

**Artboard'lar**
- `06.1 · Contacts · Default · 1440`
- `06.1 · Contacts · List · 768`
- `06.1 · Contacts · Redirected from · 1440`
- `06.1 · Contacts · Profile · 768`

### Sayfa başlığı
Başlık, açıklama, oluşturma, içe aktarma ve dışa aktarma eylemleri. `Export` → `20.5 · Export`, `Import` → `20.6 · Import`.
- **Label'lar:** `Contacts` (sayfa başlığı, PRD 02 gezinti etiketi), `People who give Feedback, with an optional Company.` (açıklama), `Create Contact`, `Create Company`, `Duplicate candidates`, `Export`, `Import`

### Liste kolonu
`Contacts` listesi, altında `Companies` listesi.
- **Label'lar:** `Contacts`, `Companies` (Company listesi başlığı), `Unnamed Contact`

### Contact profili · başlık
Contact etiketi ve kayıt eylemleri.
`Archive` ve `Move to Trash` ortak kayıt eylemleridir → `DS.11 · Record Header`; burada yalnız Contact'a özgü eylemler.
- **Label'lar:** `Export Personal Data`, `Erase Personal Data` (spec 81); `Merge Contacts` (spec 46)

### Contact profili · kimlik alanları
Düzenlenebilir görünen ad ve e-posta takma adları; Company bağı; geçmiş Company'ler; Persona bağları. Kimlik alanlarının altında tek satır sessiz özel kategori veri uyarısı (metin ve davranış → `06.3 · Contact formu`). Company ve Persona bağları kaynağında `Open source record` ile açılır (CONTEXT.md ortak eylemi).
- **Label'lar:** `Display name`, `Email`, `Add an email` (e-posta takma adı ekleme), `Save Contact`, `Belongs to Company`, `None`, `Past Companies`, `Persona`, `Open source record`

### Contact profili · ilişkili Geri Bildirimler
Bu Contact'a bağlı Geri Bildirimlerin kısa listesi; gövde kopyalanmaz, yalnız başlık/tarih/Proje.
- **Label'lar:** `Feedback` (spec 47), `Open source record` (spec 46)

### Durumlar
#### Empty
Liste kolonunda `No Contacts yet.` ve `No Companies yet.`; profil kolonu boş, `Create Contact` birincil kalır.
#### Loading
Liste ve profil yerinde iskelet satırlar.
#### Error
Profil okunamaz veya yazma reddedilir: `Contact is unavailable.`, `Contact could not be saved.`, `Belongs to Company could not be updated.`, `Contact is invalid.`
#### Redirected from
Emekli kimlikten açılan profilde başlık altında `Redirected from` ve eski kimlik satırı ile `Undo Merge` eylemi (→ `06.6`). Eski kimlik ayrı satır veya arama sonucu olarak listede görünmez.
#### No Company
`Belongs to Company` `None`; `Past Companies` satırı yok.
#### Archived
Arşivli ve çöpteki kayıt davranışı, `Unarchive` ve geri yükleme eylemi → `DS.11 · Record Header` (Archived, In Trash) ve `02.11 · Trash` (`Restore`). Bu ekrana özgü: arşivli Contact'ta kişisel veri eylemleri erişilebilir kalır.
#### Profile · 768
Dar yerleşimde liste ve profil iki ayrı görünümdür: önce `Contacts` / `Companies` listesi, bir satır seçilince profil tam genişlikte açılır ve listeye dönüş vardır. Profil bölümlerinin sırası değişmez (başlık, kimlik alanları, ilişkili `Feedback`).
#### Unnamed Contact
Adsız ve e-postasız Contact: başlık `Unnamed Contact`.
#### Many items
Uzun liste; liste kolonu kendi içinde kaydırılır.

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md) (sahip); [81 Kişisel Veri](../../specs/81-personal-data/spec.md) (profil eylemleri); [47 Geri Bildirim](../../specs/47-feedback/spec.md) (ilişkili Geri Bildirimler); [79 Data Export](../../specs/79-data-export/spec.md) ve [80 Data Import](../../specs/80-data-import/spec.md) (`Export` / `Import`, Contact ve Company aileleri).

## 06.2 · Company
> Bir Company'ye bağlı Contact'ları ve Geri Bildirimleri ortak kuruluş bağlamında göstermek.

**Artboard'lar**
- `06.2 · Company · Default · 1440`

### Company profili
Liste → `06.1` › Liste kolonu. Profilde düzenlenebilir ad; bağlı güncel Contact'lar; Company'ye bağlı Geri Bildirimler; Persona bağları. Ad `Save Company` ile kaydedilir. Contact'ı Company'ye bağlama ve ayırma `Belongs to Company` ile (ilişki seçici → `20.10`). `Persona` bölümünde bağ ekleme ve kaldırma ilişki seçiciyle yapılır; otomatik atama yoktur. Ortak kayıt eylemleri ve arşiv/çöp durumları (`Archive`, `Move to Trash`, `Unarchive`, `Restore`) → `DS.11 · Record Header` ve `02.11 · Trash`.
- **Label'lar:** `Company`, `Belongs to Company`, `Open source record` (spec 46); `Company name` (ad alanı), `Save Company`, `Contacts` (PRD 02); `Feedback` (spec 47); `Persona` (PRD 02)

### Durumlar
#### Empty
Bağlı Contact veya Geri Bildirim yoksa ilgili bölüm `None`.
#### Error
Düzenleme reddedilir (`Company is invalid.`) veya profil okunamaz (`Company is unavailable.`).

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md); [47 Geri Bildirim](../../specs/47-feedback/spec.md).

## 06.3 · Create Contact
> Yalnız bilinen bilgiyle Contact veya Company açmak; ad ve e-posta isteğe bağlıdır.

**Artboard'lar**
- `06.3 · Create Contact · Contact · 1440`
- `06.3 · Create Contact · Company · 1440`

### Contact formu
Küçük dialog; alanlar ve gönderim; alanların altında tek satır sessiz özel kategori veri uyarısı (metnin sahibi burasıdır, `06.1` buraya bağlanır). Company alanı mevcut Company'lerden seçer, varsayılanı `None`.
- **Label'lar:** `Create Contact`, `Display name`, `Email`, `Belongs to Company`, `None`, uyarı `Health, biometric, government ID, payment card and children's data are not stored as a first-product type. Do not enter them.` (PRD 02)

### Company formu
Aynı dialog, tek alan.
- **Label'lar:** `Create Company`, `Company name` (→ `06.2`)

### Durumlar
#### Error
Oluşturma reddi: `Contact could not be created.`, `Company could not be created.`, `Contact is invalid.`, `Company is invalid.`

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md).

## 06.4 · Duplicate candidates
> Olası kopya Contact çiftlerini göstermek; güçlü adayı birleştirmeye açmak, hiçbirini kendiliğinden birleştirmemek.

**Artboard'lar**
- `06.4 · Duplicate candidates · Default · 1440`

### Aday listesi
`06.1` profilinin yerinde; çift başına bir satır: güç etiketi, iki Contact, neden satırı (güçlü aday için `Same email address`; zayıf öneri için `Similar name` veya `Similar Company`), güçlüyse birleştirme başlatıcı.
- **Label'lar:** `Merge Contacts` (spec 46); `Duplicate candidates`, `Strong copy candidate`, `Weak suggestion`, `Same email address`, `Similar name`, `Similar Company`, `Surviving Contact`, `No duplicate candidates.` (PRD 02)

### Durumlar
#### Empty
`No duplicate candidates.`

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md).

## 06.5 · Merge Contacts
> Hayatta kalan Contact'ı ve yeniden yazılacak her şeyi onaydan önce göstermek; tek atomik yazmayla birleştirmek.

**Artboard'lar**
- `06.5 · Merge Contacts · Default · 1440`
- `06.5 · Merge Contacts · Field conflicts · 1440`

### Merge Preview
Orta boy dialog: özet cümlesi ve yazılacak değişikliklerin özellik listesi, eylem satırı.
- **Label'lar:** `Merge Preview`, `Belongs to Company` (spec 46); `Surviving Contact`, `Field conflicts`, `Display name adopted`, `Email aliases added`, `Feedback moved`, `Keep survivor`, `Adopt retired`, `Persona links added`, `None`, `Confirm Merge` (PRD 02); `Cancel`

### Durumlar
#### Field conflicts
`Field conflicts` satırı dolu: görünen ad çatışması, örnek `Emma Clark` ve `E. Clark`. Satır metni biçimi `Display name: keeps {kept}, drops {dropped}` (örn. `Display name: keeps Emma Clark, drops E. Clark`).
#### Error
Hiçbir kısmi yazma yok; önizleme yenilenmiş hâliyle kalır: `Contacts could not be merged. The Merge Preview was refreshed; review it and confirm again.`
#### Merged
Dialog kapanır; `06.1` hayatta kalan profili açar. Geri alma `20.14` Undo toast'ıyla değil, önizlemeli `Undo Merge` ile yapılır (→ `06.6`); birleştirme tam geri dönüş değildir. Sonuç bildirimi: `Contacts merged.`

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md).

## 06.6 · Undo Merge
> Emekli Contact'ı yeniden ana kayıt yapmak; yalnız o birleştirmenin yazdıklarını geri ayırmak ve geri gelemeyeni açıkça söylemek.

**Artboard'lar**
- `06.6 · Undo Merge · Default · 1440`
- `06.6 · Undo Merge · Unrestorable and conflict · 1440`

### Undo Merge Preview
Orta boy dialog: geri verilecekler listesi, varsa geri gelemeyen uyarısı, varsa çatışma kararı, eylem satırı.
- **Label'lar:** `Belongs to Company` (spec 46); `Undo Merge Preview`, `Display name`, `Email aliases restored`, `Feedback restored`, `Persona links restored`, `Confirm Undo Merge` (PRD 02); `Cancel`

### Geri gelemeyen içerik
Redakte veya kalıcı silinmiş bağların sayımı.
- **Label'lar:** `This is not a full undo: redacted or permanently deleted content stays gone.` (uyarı); `Cannot be restored`, `Feedback link`, `Persona link`, `Company link` (PRD 02)

### Sonraki değişiklik çatışması
Birleştirmeden sonra değişmiş alan için karar.
- **Label'lar:** `Keep current value`, `Restore previous value` (PRD 02)

### Durumlar
#### Unrestorable content
Uyarı bölümü görünür.
#### Conflict
Çatışma kararı görünür.
#### Error
Hiçbir kısmi yazma yok; önizleme yenilenir. `Merge could not be undone. The Undo Merge Preview was refreshed; review it and confirm again.` Geri alma artık mümkün değilse `06.1`'de `This merge can no longer be undone from here.` satırı görünür.
#### Done
`06.1`'de sonuç bildirimi geri gelemeyen bağları `Cannot be restored` ile sayar. Bildirim: `Undo Merge finished. Cannot be restored: {links}.` (örn. `Undo Merge finished. Cannot be restored: Feedback link.`).

**Spec:** [46 Contact ve Company](../../specs/46-contact-and-company/spec.md); [78 Güvenlik redaksiyonu](../../specs/78-security-redaction/spec.md) (geri gelemeyen içerik).

## 06.7 · Export Personal Data
> Tek bir Contact'ın kişisel verisini okunabilir bir kişi paketinde indirmek; Çalışma Alanı çıkış paketi değildir.

**Artboard'lar**
- `06.7 · Export Personal Data · Preview · 1440`

### Paket önizlemesi
Orta boy dialog: pakete girecek kaynaklar türlere göre gruplu; girmeyecekler için tek açıklama satırı (Secret, oturum, token, başka Contact'lar, ilgisiz Çalışma Alanı geçmişi girmez; geri yükleme biçimi değildir); biçim; eylem satırı. Kaynak kalemleri arasında ilişkili kanıt da vardır. Biçim seçimi `JSON` / `Markdown`; birincil eylem `Download` (`10.11` ile aynı).
- **Label'lar:** `Export Personal Data` (spec 81); `Contact`, `Email`, `Related evidence` (PRD 02); `Feedback` (spec 47); `JSON` (spec 79); `Research`, `Markdown`, `Download`, `Cancel`
- **Spec etiketleri:** `Markdown` → PRD 02 (dışa aktarma biçimi); `Download` → `10.11` ile aynı eylem adı; `Research` kişi paketinde mevcut ad, yeni bağlam (Araştırma notları kaynak grubu; İş türü değildir).

### Durumlar
#### Preview
Paket önizlemesi açık: kaynak grupları, biçim seçimi ve `Download` hazır; henüz indirme başlamadı.
#### Preparing
Paket hazırlanırken ilerleme görünür: `Preparing personal data package…`; dialog kapanabilir.
#### Error
Hazırlanamazsa → `20.15 · Support Reference Error`.
#### Offline
→ `20.16 · Offline`.

**Spec:** [81 Kişisel Veri](../../specs/81-personal-data/spec.md); [79 Veri dışa aktarma](../../specs/79-data-export/spec.md) (önizleme deseni).

## 06.8 · Erase Personal Data
> Bir Contact'ın ad, e-posta ve özgün mesajlarını, aktif paylaşım ve yayındaki kopyalarıyla birlikte geri döndürülemez redakte etmek.

**Artboard'lar**
- `06.8 · Erase Personal Data · Preview · 1440`
- `06.8 · Erase Personal Data · Confirm with Account name · 1440`
- `06.8 · Erase Personal Data · Erased profile · 1440`

### Etki önizlemesi
Orta-geniş adımlı dialog'un ilk adımı. Yayılım önizlemesi ve adım şeridi → `20.7 · Redact` ve `20.1`; burada yalnız Contact'a özgü kaynak listesi: Contact alanları, e-posta takma adları, Geri Bildirim mesajları, Araştırma notları, aktif paylaşım ve yayındaki değerler.
- **Label'lar:** `Erase Personal Data` (spec 81), `Cancel`

### Kimlik teyidi
→ `20.1 · Confirm GitHub Identity` (bu silme işlemine bağlı; ikinci bir kart açılmaz).
- **Label'lar:** `Confirm GitHub Identity` (→ `20.1`)

### Hesap adı onayı
→ `20.3 · Permanently Delete` (Hesap adı varyantı; eşleşmeden onay devre dışı). Adım şeridi → `20.1`.
- **Label'lar:** `Type the Account name to confirm` (→ `20.3`)

### Durumlar
#### Preview
Etki önizlemesi adımı açık: Contact'a özgü kaynak listesi ve `Cancel`; kimlik teyidi ve Hesap adı adımları henüz açılmadı.
#### Grant missing
→ `20.1` (teyit yapılmadan son adım kilitli; hiçbir şey yazılmaz).
#### Waiting for GitHub
→ `20.1 · Waiting for GitHub`. Silme kapalı başarısız kalır.
#### Name mismatch
→ `20.3 · Permanently Delete` › Name mismatch (`The name does not match.`, onay devre dışı, alan altında kısa açıklama).
#### Erased profile
Dialog kapanır; aktif paylaşım ve yayındaki değerlerin aynı işlemde kaldırıldığı ve cache temizliğinin kuyruğa alındığı tek satırla söylenir: `Shared and published copies were removed. Cache cleanup is queued.`; temizlik başarısızsa `02.13 · Purge retry` ile aynı görünür yeniden deneme (içerik yeniden açılmaz). `06.1` profilinde Contact içeriksiz tombstone olarak görünür (ad ve e-posta yerinde `Redacted for security`, işaret → `20.7` › Sonuç); ilişkili Geri Bildirim satırları aynı işaretle.
#### Error
Redaksiyon başarısızsa hiçbir kısmi yazma yok; → `20.15 · Support Reference Error`.

**Spec:** [81 Kişisel Veri](../../specs/81-personal-data/spec.md) (sahip); [78 Güvenlik redaksiyonu](../../specs/78-security-redaction/spec.md) (yayılım); [01 Hesap erişimi](../../specs/01-account-access/spec.md) (`Confirm GitHub Identity` grant).
