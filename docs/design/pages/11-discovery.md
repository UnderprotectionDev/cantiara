# 11 · Discovery

Projenin `Discovery` alanı: kaynaklar, araştırma oturumları, kanıt ve geri bildirim.

| Ekran | Ne çizilir |
|---|---|
| [11.1 · Sources](#111--sources) | Tür geçişi, URL oluşturucu, Kaynak listesi |
| [11.2 · Source Detail](#112--source-detail) | Snapshot, sürümler, kontrol geçmişi, kanıt kullanımları |
| [11.3 · Recheck source](#113--recheck-source) | Ön kontrol ve snapshot karşılaştırma dialog'u |
| [11.4 · Rebind to new version](#114--rebind-to-new-version) | Tek kanıt bağını yeni sürüme taşıma önizlemesi |
| [11.5 · Research Sessions](#115--research-sessions) | Oturum listesi, izin bağlamı, türlenmiş notlar |
| [11.6 · Research Session Form](#116--research-session-form) | Oturum oluşturma/düzenleme formu |
| [11.7 · Evidence Bind](#117--evidence-bind) | Mevcut kayda bağla / yeni kayda dönüştür dialog'u |
| [11.8 · Feedback](#118--feedback) | Geri Bildirim listesi, özgün mesaj, kanıt niteliği |
| [11.9 · Create Feedback](#119--create-feedback) | Geri Bildirim oluşturma dialog'u |
| [11.10 · Convert to Work](#1110--convert-to-work) | Geri Bildirimden tek İş önizlemesi |
| [11.11 · Feed](#1111--feed) | Yoğun okuma görünümü ve filtreler |
| [11.12 · Validation Records](#1112--validation-records) | Doğrulama listesi, detay, form |
| [11.13 · Evidence Flow](#1113--evidence-flow) | Host detayında katlanır kanıt akışı paneli |

## 11.1 · Sources
> Projenin Kaynaklarını görmek ve yapıştırılan bir URL'nin güvenli önizlemesini açıkça Kaynak olarak kaydetmek.

**Artboard'lar**
- `11.1 · Sources · Default · 1440`
- `11.1 · Sources · Default · 768`
- `11.1 · Sources · Live preview · 1440`
- `11.1 · Sources · YouTube · 1440`
- `11.1 · Sources · Empty · 1440`

### Alan başlığı ve tür geçişi
- **Label'lar:** `Discovery`, `Sources`, `Research Sessions`, `Feedback`, `Feed`, `Validation Records`.

### URL oluşturucu ve canlı önizleme
URL alanı; yapıştırınca geçici canlı önizleme: başlık, alan adı, varsa güvenli görsel. Önizlemenin Kaynak veya tarihsel kanıt olmadığı açık cümle. Kayıt sonrası aynı kart `Historical snapshot` olarak ayrılır.
- **Label'lar:** `Source URL`, `Preview`, `Live preview`, `Smart link preview`, `This preview is not a Source or historical evidence.`, `Save as Source`, `Saving…`, `Source saved.`, `Historical snapshot`.

### YouTube canlı kartı
Yalnız YouTube için; `Live external source` etiketi, özgün URL, üçüncü taraf uyarısı, tıklayınca yüklenen oynatıcı (autoplay yok). Yalnız video başlığı yakalanır.
- **Label'lar:** `Live external source`, `Load YouTube`, `Loading YouTube…`, `Loading YouTube contacts a third-party service. This live player is not …`, `Only the video title is captured; playback is live.`, `YouTube live player`, `Video unavailable. Open the original URL.`

### Kaynak listesi
Kaynaklar; her satırda başlık, alan adı, onaylı sürüm, erişim zamanı, varsa `Newer Source version exists`.
- **Label'lar:** `Source`, `Version`, `Newer Source version exists`.

### Durumlar
#### Empty
`No Sources yet.` ve oluşturucu.
#### Loading
`Loading Sources…`; önizleme `Loading preview…`.
#### Error
`Sources are unavailable. Try loading this page again.`; önizleme `Preview unavailable. Try Preview again.` ve özgün URL güvenli metin kalır; kayıt hatası `Source could not be saved. Try Save as Source again.` Başarısız önizleme kaydedilemez.
#### Güvenli fallback
Özel/yerel ağ, HTTP(S) dışı, 20 MB üstü veya çalıştırılabilir içerik: görselsiz düz bağlantı.
#### YouTube kullanılamıyor
Kaldırılmış/özel/kısıtlı video: oynatıcı kaldırılır, `Video unavailable. Open the original URL.`; URL ve uyarı kalır.
#### Arşivli Proje
`Archived Project. Sources are read-only.`; oluşturucu yok.

**Spec:** [44 Kaynaklar ve Kanıt Tazeliği](../../specs/44-sources-and-freshness/spec.md).

## 11.2 · Source Detail
> Bir Kaynağın onaylı tarihli sürümünü, sürüm geçmişini, Kaynak Kontrolü olaylarını ve her kanıt kullanımının tazeliğini göstermek.

**Artboard'lar**
- `11.2 · Source Detail · Default · 1440`
- `11.2 · Source Detail · Partial review · 1440`

### Kayıt başlığı
Başlık, adres, erişim zamanı, isteğe bağlı sağlayıcı/dış kayıt türü/kimliği; birincil eylem `Recheck source`.
- **Label'lar:** `Historical snapshot · Version 2`, `Address`, `Accessed at`, `Provider`, `External record type`, `External id`, `Recheck source`.

### Yakalanan içerik
Erişim anında saklanan metin; kısa alıntılar, ekran görüntüleri, ekler.
- **Label'lar:** `Captured content`, `Excerpt`, `No text was captured.`

### Versions
Tarihli sürümler; eski sürüm silinmez.
- **Label'lar:** `Versions`, `Approved version`.

### Source Check geçmişi
Her kontrol: zaman, kullanıcı, başlangıç ve son URL, HTTP sonucu, içerik türü, parmak izi, karşılaştırılan temel sürüm, karar.
- **Label'lar:** `Source Check`, `Compare`, `No response`, `Unknown content type`.

### Kanıt kullanımları
Her kullanım ayrı satır: hedef kayıt, kesin sürüm, erişim tarihi, aralık; daha yeni sürüm varsa bilgi ve iki karar.
- **Label'lar:** `Version-pinned evidence`, `Newer Source version exists`, `Reviewed; keep current version`, `Rebind to new version`, `Compare`, `Archived. Evidence is read-only.`

### Durumlar
#### Loading
`Loading Source Checks…`, `Loading evidence uses…`
#### Error
`Source Checks are unavailable. Reload this page.`; `Evidence uses are unavailable. Reload this page.`
#### Kısmi inceleme
Üç kullanımın biri incelendi, ikisi `Newer Source version exists` taşıyor; `source-version-in-use` sinyali → `00.5 · Notification Center`.
#### Başarısız son kontrol
Olayda neden kalır; eski içerik güncel gibi sunulmaz.
#### Arşivli Proje
Bütün kararlar ve `Recheck source` yok.

**Spec:** [44 Kaynaklar ve Kanıt Tazeliği](../../specs/44-sources-and-freshness/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).

## 11.3 · Recheck source
> Kullanıcı başlatmalı Kaynak Kontrolünü önizlemek, aday snapshot'ı onaylı sürümle karşılaştırmak ve mevcut sürümü korumak ya da yeni sürüm kaydetmek.

**Artboard'lar**
- `11.3 · Recheck source · Preflight · 1440`
- `11.3 · Recheck source · Compare · 1440`
- `11.3 · Recheck source · Failed check · 1440`

### Ön kontrol
İstek yapılacak adres, mevcut onaylı sürüm, üçüncü taraf bağlantı uyarısı.
- **Label'lar:** `Recheck source`, `This connects to a third-party server.`, `Close`.

### Karşılaştırma
Onaylı sürüm, aday; altında satır farkı; sabit kanıt aralıklarının adayda eşleşmesi.
- **Label'lar:** `Historical snapshot`, `Candidate snapshot`, `Compare`, `Added: `, `Removed: `, `Unchanged: `, `No match in candidate version`, `Exact text match available for explicit preview`, `Line comparison unavailable. Use the snapshots above.`

### Karar eylemleri
Önizlemeden sonra: onaylı sürüm değişmeden kontrol geçmişte kalır, ya da aday yeni Kaynak sürümü olarak eklenir. Eski sürüm ve Karar/İş/Geri Bildirim bağları durur; yeni sürüm bağları devralmaz, İş/Risk/Test Boşluğu üretmez.
- **Label'lar:** `Keep current version`, `Save as new Source version`.

### Durumlar
#### Loading
`Saving Source Check…`
#### Başarısız kontrol
HTTP/erişim nedeni gösterilir, aday yok, eski içerik güncel sunulmaz.
#### Bayat
`The Source or Source Check changed. Reload before deciding.`
#### Error
`Source Check could not be saved. Reload before retrying if the Source changed.`

**Spec:** [44 Kaynaklar ve Kanıt Tazeliği](../../specs/44-sources-and-freshness/spec.md).

## 11.4 · Rebind to new version
> Tek bir kanıt kullanımını eski sürümden yeni onaylı sürümdeki kesin aralığa önizlemeyle taşımak.

**Artboard'lar**
- `11.4 · Rebind to new version · Preview · 1440`
- —

### Önizleme
Eski sürüm ve aralık, yeni sürümde seçilen aralık, etkilenecek tek kullanım bağı, mevcut `Evidence Role` ve `Founder interpretation` ayrı.
- **Label'lar:** `Rebind to new version`, `Evidence preview`, `Source text`, `Evidence target`, `Version-pinned evidence`, `No match in candidate version`, `Preview`, `Cancel`, `Rebind to new version saved.`

### Durumlar
#### Error
`Evidence preview is unavailable. Reload if the Source or target changed.`; `Evidence could not be saved. Reload if the Source, target or bind changed, then preview again.`

**Spec:** [44 Kaynaklar ve Kanıt Tazeliği](../../specs/44-sources-and-freshness/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).

## 11.5 · Research Sessions
> Kullanıcı Araştırması Oturumlarını amaç, izin bağlamı ve türlenmiş notlarıyla okumak ve not eklemek.

**Artboard'lar**
- `11.5 · Research Sessions · Default · 1440`
- `11.5 · Research Sessions · Not allowed · 1440`
- `11.5 · Research Sessions · Empty · 1440`

### Oturum listesi
Başlık, durum, zaman, kanal, katılımcı (izinliyse).
- **Label'lar:** `Research Sessions`, `Create Research Session`, `Planned`, `Completed`, `Cancelled`.

### Oturum bilgileri
Seçili oturumun üst bilgileri ve ilişkileri.
- **Label'lar:** `Research Session`, `Title`, `Purpose`, `Question guide`, `Channel`, `Facilitator`, `Scope note`, `Status`, `Time`, `Duration`, `Edit`.

### İzin bağlamı
İzin değeri, not, kaydeden kullanıcı ve zaman; kapanan kapıların açıklaması; hukuki uygunluk hükmü olmadığı cümlesi.
<details>
<summary>Label'lar</summary>

`Consent`, `Consent note`, `Not asked`, `Allowed`, `Not allowed`, `Not applicable`, `Consent is context, not a legal compliance judgment. You …`, `Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed.`, `Consent permits protected content. Convert still requires a preview.`

</details>

### Notlar
Türlenmiş notlar ayrı başlıklarla: `Participant quote` alıntı bloğunda ve isteğe bağlı konuşmacı etiketiyle; `Observation`; `Founder interpretation`. Her notta kanıt bağları ve eylemler.
<details>
<summary>Label'lar</summary>

`Notes`, `Add note`, `Edit note`, `Note type`, `Choose note type`, `Contains personal information`, `Participant quote`, `Observation`, `Founder interpretation`, `Speaker label (optional)`, `Version-pinned evidence`, `Newer version exists`, `Open source record`, `Bind as evidence to existing record`, `Convert to new record and bind`, `Note saved.`, `Evidence bound.`

</details>

### Durumlar
#### Empty
`No Research Sessions yet.`
#### Loading
`Loading Research Sessions…`
#### Error
`Research Sessions are unavailable.` ve `Retry`.
#### Not allowed
İzin `Not allowed`: `Participant quote` seçeneği ve kişisel not kontrolleri kapalı, açıklama görünür; yalnız açıkça kişisel olmayan gözlem/yorum kaydedilebilir.
#### Bağlı kanıt yaşamı
Hedef `Archived`, `In Trash`, `Permanently deleted` veya `No access`: satır ve `Bound at` zamanı kalır, başlık sızmaz; Feedback hedefi salt okunur dialogda açılır (`Feedback`, `Read-only source record.`, `Loading source record…`, `Source record is unavailable.`).
#### Arşivli Proje
`This Project is archived. Research Sessions are read-only.`

**Spec:** [43 Kullanıcı Araştırması Oturumları](../../specs/43-research-sessions/spec.md).

## 11.6 · Research Session Form
> Oturumu oluşturmak veya düzenlemek; izni kaydetmek.

**Artboard'lar**
- `11.6 · Research Session Form · Create · 1440`
- —

### Form
Detay kolonunda oturum alanları; izin alanı form sonunda ayrı grup.
- **Label'lar:** `Title`, `Purpose`, `Question guide`, `Channel`, `Facilitator`, `Scope note`, `Status`, `Time (optional)`, `Duration (minutes, optional)`, `Consent`, `Consent note`, `Save`, `Saving…`, `Cancel`, `Retry`.

### Durumlar
#### Error
`Research Session could not be saved. Retry or reload to check for changes. Your text is kept here.`; `Check the Research Session fields.`; `Enter a valid Time.` (mevsimsel saat atlaması dahil).
#### Conflict
`Research Session changed. Cancel and reopen before saving. Your text is kept here.`
#### Kaydedildi
`Research Session saved.`

**Spec:** [43 Kullanıcı Araştırması Oturumları](../../specs/43-research-sessions/spec.md).

## 11.7 · Evidence Bind
> Seçili metni kesin kaynak sürümüne pinleyerek mevcut kayda kanıt olarak bağlamak veya tam olarak bir yeni kayıt oluşturup bağlamak.

**Artboard'lar**
- `11.7 · Evidence Bind · Bind existing · 1440`
- `11.7 · Evidence Bind · Convert preview · 1440`

### Seçim ve hedef
İki kip aynı dialog: mevcut kayda bağla / yeni kayda dönüştür ve bağla. Kaynak metin, aralık, hedef türü ve Projesi, hedef kayıt veya yeni başlık, İş için tür.
<details>
<summary>Label'lar</summary>

`Bind as evidence to existing record`, `Convert to new record and bind`, `Selected text`, `Selection start`, `Selection end`, `Target type`, `Choose target type`, `Target Project`, `Target record`, `Choose target record`, `Title`, `Work type`, `Choose Work type`, `Task`, `Bug`, `Research`, `Improvement`, `Work`, `Feature`, `Feedback`, `Decision`, `Risk`, `Assumption`, `Open Question`, `Preview`, `Cancel`.

</details>

### Önizleme
Kaynak ve kesin sürüm, aralık, alan eşleme, `Origin`, `Origin Location`, oluşacak ilişki; kaynak notun yerinde kaldığı cümlesi.
- **Label'lar:** `Evidence source`, `Field mappings`, `Origin`, `Origin Location`, `Version-pinned evidence`, `The original note stays in this Research Session.`, `Confirm`, `Confirming…`, `Retry`.

### Durumlar
#### Error
`Preview is unavailable. Retry or cancel; your draft is kept.`; `Binding could not be confirmed. Retry with this same preview; your draft is kept.`; `Choose the target and complete its fields.`
#### Süresi dolmuş önizleme
`Research Session changed or preview expired. Cancel and reopen the preview.`
#### İzin kapalı
`Not asked`/`Not allowed` altında korumalı metin dönüştürülemez.

**Spec:** [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md); [43](../../specs/43-research-sessions/spec.md), [44](../../specs/44-sources-and-freshness/spec.md), [31](../../specs/31-documents/spec.md) (çağıran yüzeyler).

## 11.8 · Feedback
> Geri Bildirimin özgün mesajını kanal, zaman ve isteğe bağlı kimlikle okumak; durumunu yönetmek ve İş köken bağlarını görmek.

**Artboard'lar**
- `11.8 · Feedback · Default · 1440`
- `11.8 · Feedback · Evidence quality open · 1440`
- `11.8 · Feedback · Empty · 1440`

### Liste
Başlık, kanal, zaman, durum, kimlik.
- **Label'lar:** `Feedback`, `Create Feedback`, `New`, `Reviewed`, `Archived`.

### Özgün mesaj ve üstveri
Özgün mesaj kelimesi kelimesine, ayrı blokta; kanal, zaman, bağlantı, ek referansları.
- **Label'lar:** `Original message`, `Channel`, `Occurred at`, `Link`, `Attachments`, `Status`.

### Kimlik
İsteğe bağlı Contact ve Company.
- **Label'lar:** `Contact (optional)`, `Company (optional)`, `Unknown`, `Unnamed Contact`.

### Origin of ve kanıt niteliği
Bu Geri Bildirimin köken olduğu İşler; her İş bağında katlanabilir kanıt niteliği formu: yedi ayrı alan, alan başına `Unknown` ve `Founder interpretation` (yazar, zaman), `Evidence Role`, takip durumu, geçmiş.
<details>
<summary>Label'lar</summary>

`Origin of`, `Origin of Work`, `Reported problem`, `Suggested solution`, `Current workaround`, `Impact severity`, `Usage frequency`, `Independence`, `Audience fit`, `Unknown`, `Founder interpretation`, `Evidence Role`, `Follow-up`, `Follow up`, `Followed up`, `Outcome verified`, `None`, `Save Evidence quality`, `History`, `Evidence quality saved.`, `Optional. Leave a field blank or enter Unknown. These values describe …`

</details>

### Durumlar
#### Empty
`No Feedback yet.`
#### Loading
`Loading Feedback…`
#### Error
`Feedback is unavailable.` ve `Retry`; `Status could not be changed. Reload and try again.`; `Contact or Company could not be changed. Reload and try again.`; `Evidence quality could not be saved. Reload and try again.`
#### Arşivli Proje
Salt okunur; form ve durum eylemleri yok.

**Spec:** [47 Geri Bildirim Kaydı ve Feed](../../specs/47-feedback/spec.md).

## 11.9 · Create Feedback
> Özgün mesajı, kanalı ve zamanı kaybetmeden Geri Bildirim kaydı açmak.

**Artboard'lar**
- `11.9 · Create Feedback · Default · 1440`
- —

### Form
Özgün mesaj formun ana alanı; kanal, zaman, bağlantı, ekler ve isteğe bağlı kimlik.
- **Label'lar:** `Create Feedback`, `Title`, `Original message`, `Channel`, `Occurred at`, `Link`, `Attachments`, `Contact (optional)`, `Company (optional)`, `Saving…`, `Cancel`.

### Durumlar
#### Error
`Enter a Title, an Original message and Occurred at.`; `Feedback could not be saved. Check the Link and Attachments, then retry. Your text is kept here.`

**Spec:** [47 Geri Bildirim Kaydı ve Feed](../../specs/47-feedback/spec.md).

## 11.10 · Convert to Work
> Geri Bildirimden önizlemeyle tam olarak bir İş oluşturmak; Geri Bildirimi silmeden ve değiştirmeden.

**Artboard'lar**
- `11.10 · Convert to Work · Preview · 1440`
- —

### Önizleme
İş türü seçimi ve oluşacak tek İşin salt okunur önizlemesi.
<details>
<summary>Label'lar</summary>

`Convert to Work`, `Convert to Work preview`, `Work type`, `Task`, `Bug`, `Research`, `Improvement`, `Preview`, `Target Project`, `Title`, `Description`, `Relation`, `Origin: this Feedback to the new Work`, `Confirming creates exactly one Work. Nothing exists until then.`, `The Feedback stays as it is. Its status does not change.`, `Cancel`, `Confirm`.

</details>

### Durumlar
#### Error
`The preview could not be loaded. Reload and try again.`; `The Work could not be created. If the Feedback changed, preview again.`

**Spec:** [47 Geri Bildirim Kaydı ve Feed](../../specs/47-feedback/spec.md).

## 11.11 · Feed
> Geri Bildirim ve uzun gövdeli Kaynak ana kayıtlarını özgün metni öne çıkaran yoğun bir okuma görünümünde taramak.

**Artboard'lar**
- `11.11 · Feed · Default · 1440`
- `11.11 · Feed · Empty · 1440`

### Filtre ve sıralama
Tür, durum ve sıra seçimleri.
- **Label'lar:** `Feed`, `Source type`, `All`, `Feedback`, `Source`, `Status`, `Any`, `New`, `Reviewed`, `Archived`, `Sort`, `Newest first`, `Oldest first`.

### Satırlar
Tür, kimlik veya kanal/sağlayıcı, zaman, özgün mesaj veya yakalanan içerik, ekler, Proje, ilgili İş/Karar.
- **Label'lar:** `Type`, `Channel`, `Provider`, `Time`, `Attachments`, `Project`, `Related`, `Open Source Record`.

### Durumlar
#### Empty
`No Feed records yet.`
#### Loading
`Loading Feed…`
#### Error
`Feed is unavailable.` ve `Retry`.

**Spec:** [47 Geri Bildirim Kaydı ve Feed](../../specs/47-feedback/spec.md).

## 11.12 · Validation Records
> Ürün dışında yürütülen bir doğrulamanın yöntemini, sonucunu ve Varsayım/Açık Soru/Karar bağlamını kaydetmek.

**Artboard'lar**
- `11.12 · Validation Records · Default · 1440`
- `11.12 · Validation Records · Edit · 1440`
- `11.12 · Validation Records · Empty · 1440`

### Liste
`Status` filtreli doğrulama kayıtları.
- **Label'lar:** `Validation Record`, `Create`, `Status`, `Active`, `Archived`, `Trash`.

### Detay
Yöntem, sonuç ve ilgili bağlam kayıtları.
- **Label'lar:** `Title`, `Method`, `Result`, `Related`, `Edit`, `Archive`, `Move to Trash`, `Restore`, `No context linked.`, `Record unavailable`.

### Form
Detay kolonunda düzenleme formu.
- **Label'lar:** `Title`, `Method`, `Result`, `Related`, `Save`, `Saving…`, `Cancel`, `Retry`, `Saving a Result keeps related Assumption, Open Question and Decision life unchanged.`, `No context records available.`

### Durumlar
#### Empty
`No Validation Records in this view.`
#### Loading
`Loading Validation Records…`
#### Error
`Validation Records are unavailable.` ve `Retry`; `Enter a Title and Method before saving.`; `Validation Record could not be saved. Retry or reload to check for changes. Your text is kept here.`
#### Conflict
Güncel kayıt ve bağlam yenilenir, açık taslak korunur.
#### Arşivli kayıt
Salt okunur, yalnız `Restore`.
#### Arşivli Proje
`This Project is archived and read-only.`

**Spec:** [42 Deney ve Doğrulama Kayıtları](../../specs/42-validation-records/spec.md).

## 11.13 · Evidence Flow
> Bir İş, Karar veya Varsayıma açık `Kanıtı` bağıyla bağlanmış kesin kanıtları zaman sırasıyla ve kaynak türüne göre süzülebilir göstermek.

**Artboard'lar**
- `11.13 · Evidence Flow · Open · 1440`
- `11.13 · Evidence Flow · Broken sources · 1440`

### Filtre
Kaynak türüne göre süzme.
- **Label'lar:** `Evidence Flow`, `Source type`, `All`, `Document`, `Source`, `Feedback`, `Research Session`, `Validation Record`, `Session Test`, `File Attachment`.

### Akış
Her satır: kaynak türü ve adı, kesin sürüm, kaynak olay zamanı, ilişki zamanı, `Evidence Role`, `Founder interpretation`, kaynak durumu; birbirine karışmayan ayrı alanlar.
- **Label'lar:** `Newer version exists`, `Open source record`, `Archived`, `Source element no longer exists`, `Unavailable source`, `No access`, `In Trash`, `Permanently deleted`, `Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified`.

### Durumlar
#### Kapalı
Panel başlığı yalnız; açılmadan sorgu yapılmaz.
#### Loading
`Loading Evidence Flow…`
#### Empty
`No explicit evidence for this filter.`
#### Error
`Evidence Flow is unavailable.`
#### Kırık kaynak
Silinmiş/erişilemeyen kaynak: güvenli neden, pin/rol/yorum gizli; kaldırılmış bileşen `Source element no longer exists`.

**Spec:** [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).
