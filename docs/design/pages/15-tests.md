# 15 · Tests

Projenin `Tests` alanı: test planı, devir, rapor, kabul, boşluklar ve değerlendirme.

| Ekran | Ne çizilir |
|---|---|
| [15.1 · Tests Overview](#151--tests-overview) | sekiz canlı yönetim bölümü |
| [15.2 · Planned Test Cases](#152--planned-test-cases) | senaryo listesi + sürümlü detay |
| [15.3 · Planned Test Case Editor](#153--planned-test-case-editor) | senaryo oluşturma / yeni sürüm formu |
| [15.4 · Test Handoffs](#154--test-handoffs) | Handoff listesi + süreç detayı |
| [15.5 · Test Handoff Editor](#155--test-handoff-editor) | Handoff formu, sürüm seçimi |
| [15.6 · Handoff Package](#156--handoff-package) | paket önizlemesi ve üretilmiş sürümler |
| [15.7 · Test Sessions](#157--test-sessions) | oturum listesi, giriş eylemleri |
| [15.8 · Record Test Session](#158--record-test-session) | manuel oturum formu |
| [15.9 · Import Test Session File](#159--import-test-session-file) | dosya içe aktarma ve makbuz/ret |
| [15.10 · Test Session Review](#1510--test-session-review) | oturum inceleme, ham/normalize sonuç |
| [15.11 · Mark Reviewed Preview](#1511--mark-reviewed-preview) | toplu inceleme önizlemesi |
| [15.12 · Close Test Session](#1512--close-test-session) | kapanış ve kalan maddeler |
| [15.13 · Result Event](#1513--result-event) | Correction / Withdrawal / Redaction formu |
| [15.14 · Supersedes](#1514--supersedes) | iki sonucu yan yana bağlama |
| [15.16 · Test Gaps](#1516--test-gaps) | Test Açığı listesi ve sayı |
| [15.17 · File Test Gap](#1517--file-test-gap) | Test Açığı formu |
| [15.18 · Close Test Gap](#1518--close-test-gap) | iki kapanış yolu |
| [15.19 · Recent Test Assessments](#1519--recent-test-assessments) | tarihli değerlendirme snapshot'ları |
| [15.20 · Record Test Assessment](#1520--record-test-assessment) | değerlendirme formu |
| [15.21 · Test Summary · Feature](#1521--test-summary--feature) | Özellik detayında nötr özet |

## 15.1 · Tests Overview
> Proje'deki mevcut test kayıtlarını canlı türetilmiş yönetim bölümleriyle göstermek; her sayıyı kesin kayıt kümesine açmak.

**Artboard'lar**
- `15.1 · Tests Overview · Default · 1440`
- `15.1 · Tests Overview · Section expanded · 1440`
- `15.1 · Tests Overview · Empty · 1440`
- `15.1 · Tests Overview · Archived project · 1440`

### Alan başlığı
- **Label'lar:** `Tests`, `Tests overview`, `Live sections over existing records. Each number opens the records behind it. This is not a phase or a CI dashboard.`

### Alt görünüm gezinmesi
Alan içi görünümler: overview ve tür listeleri.
- **Label'lar:** `Tests overview`, `Planned Test Cases`, `Test Handoffs`, `Test Sessions`, `Test Gaps`, `Recent Test Assessments`.

### Yönetim bölümleri
Sekiz bölüm satırı bu sırayla; her satır bölüm adı + sayı; açılınca filtre satırı ve kesin kayıt listesi.
<details>
<summary>Label'lar</summary>

`Unreviewed reports`, `Follow-up needed results`, `Open and planned Test Gaps`, `Conflicting or awaiting-supersede results`, `Context-changed results`, `Active Handoffs`, `Recent sessions`, `Recent assessments`. Filtre etiketleri: `Review state: Unreviewed`, `Review state: Follow-up needed`, `State: Open, Planned`, `Signal: test-result-conflict`, `Signal: Context changed`, `State: Ready to share, Shared, Result received`, `Order: Newest reported first`, `Limit: Latest 10`, `Order: Newest assessed first`. Boş bölüm: `No records.`

</details>

### Durumlar
#### Empty
Alan etkin fakat hiç test kaydı yok: sekiz bölüm yine görünür, her biri `0`; üstte tek dürüst cümle ve iki başlangıç eylemi (`Record Test Session`, `Create Planned Test Case`). Örnek veri veya sahte grafik yok.
#### Loading
`Loading Test Summary…` durum satırı; bölüm iskeleti yok.
#### Error
`Test Summary is unavailable.` + `Retry`.
#### Section expanded
`Unreviewed reports` açık: filtre satırı `Review state: Unreviewed`, altında tek kayıt; diğer bölümler kapalı.
#### Area not enabled
Tests alanı Proje'de etkin değilse kayıt hash'i alanı açmaz; Proje kabuğunun `Enable Tests` alan katalog davranışı geçerlidir (Proje kabuğu sayfası).
#### Archived project
Ferry gibi arşivli Proje'de bölümler okunur; bütün oluşturma ve inceleme eylemleri gizlenir; üstte salt okunur notu.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md), [53](../../specs/53-test-plan-and-handoff/spec.md), [54](../../specs/54-test-report-acceptance/spec.md), [55](../../specs/55-test-gaps/spec.md), [56](../../specs/56-test-assessments/spec.md)

## 15.2 · Planned Test Cases
> Sürümlü Planlı Test Senaryolarını listelemek ve seçili senaryonun güncel sürümünü, sürüm geçmişini ve ilişkilerini göstermek.

**Artboard'lar**
- `15.2 · Planned Test Cases · Default · 1440`
- `15.2 · Planned Test Cases · Empty · 1440`

### Senaryo listesi
Başlık + güncel sürüm numarası; liste başında oluşturma eylemi.
- **Label'lar:** `Planned Test Cases`, `Create Planned Test Case`.

### Senaryo detayı
Başlık, sürüm; alanlar sırayla: amaç, kapsam, önkoşullar, beklenen davranış, notlar; ilişkiler.
- **Label'lar:** `Purpose`, `Scope`, `Preconditions`, `Expected behavior`, `Notes`, `Relations`, `No relations.`, `New version`.

### Sürüm geçmişi
Sürüm satırları yeni→eski: sürüm no, değişiklik türü, tarih.
- **Label'lar:** `Version 3: Meaningful change`, `Version 2: Editorial change`.

### Durumlar
#### Empty
`No Planned Test Cases yet.` + `Create Planned Test Case`.
#### Loading
`Loading Planned Test Cases…`
#### Error
`Planned Test Cases are unavailable.`
#### Broken relation
Erişilemeyen veya silinmiş ilişki hedefi satırda `No access` nedeniyle görünür; sessizce kaybolmaz.
#### Archived
Arşivli senaryo salt okunur; `New version` gizli.

**Spec:** [53 Planlı Test ve Handoff](../../specs/53-test-plan-and-handoff/spec.md)

## 15.3 · Planned Test Case Editor
> Yeni Planlı Test Senaryosu oluşturmak veya mevcut senaryonun yeni sürümünü kaydetmek.

**Artboard'lar**
- `15.3 · Planned Test Case Editor · Create · 1440`
- `15.3 · Planned Test Case Editor · New version · 1440`

### Alanlar
Başlık, amaç, kapsam, önkoşullar, beklenen davranış, isteğe bağlı notlar; yeni sürüm kipinde değişiklik türü seçimi.
- **Label'lar:** `Title`, `Purpose`, `Scope`, `Preconditions`, `Expected behavior`, `Notes (optional)`, `Change kind` (`Meaningful change`, `Editorial change`).

### İlişkiler
İlişki türü seçimi, hedef seçimi, seçili ilişki listesi.
- **Label'lar:** `Relations`, `Relation type` (`Work`, `Document`, `Decision`, `Risk`, `Project Goal`, `Milestone`, `Source`, `Screen`), `Whole Document`, `Selected relations`, `Remove relation <label>`, `This Project has no <type> to relate yet.`

### Form eylemleri
Kaydet ve iptal düğmeleri.
- **Label'lar:** `Create Planned Test Case`, `Save new version`, `Cancel new version`.

### Durumlar
#### Create
Boş form, `Create Planned Test Case`.
#### New version
Önceki sürüm değerleriyle dolu; `Change kind` görünür; altında "Past Session Tests stay bound to v3" bilgisi.
#### Validation error
Zorunlu alan eksik: alan altında hata, odak ilk hatalı alana.

**Spec:** [53 Planlı Test ve Handoff](../../specs/53-test-plan-and-handoff/spec.md)

## 15.4 · Test Handoffs
> Dış test çalışmasının süreç kaydını göstermek: durum, seçili kesin senaryo sürümleri, teknik bağlam, paket sürümü ve gelen Oturum Testleri.

**Artboard'lar**
- `15.4 · Test Handoffs · Default · 1440`
- `15.4 · Test Handoffs · Result suggested · 1440`
- `15.4 · Test Handoffs · Canceled with result · 1440`
- `15.4 · Test Handoffs · Empty · 1440`

### Handoff listesi
Başlık, durum, hedef yürütücü, hedef tarih.
- **Label'lar:** `Test Handoffs`, `Create Test Handoff`, durumlar `Draft`, `Ready to share`, `Shared`, `Result received`, `Closed`, `Canceled`.

### Handoff başlığı ve durum
Başlık, `State:` değeri; öneri kutusu; izin verilen geçiş düğmeleri; altında sabit sınır cümlesi.
<details>
<summary>Label'lar</summary>

`State: Shared`, `Mark as Result received`, `Mark as Closed`, `Mark as Canceled`, `Changes only this record. Nothing outside the product is started, stopped or contacted.`, öneri `2 linked Session Tests arrived. Mark Result received when you have read them; the Test Handoff stays open until you close it.`, iptal sonrası `Result arrived after cancel. The Test Handoff stays Canceled.`

</details>

### Handoff içeriği
Tanım listesi: amaç ve kapsam, hedef yürütücü, hedef tarih, seçili senaryo sürümleri, ad hoc kapsam, paket bağlamı, teknik bağlam, ortam önkoşulları, paket sürümü.
- **Label'lar:** `Purpose and scope`, `Target executor`, `Due date`, `Planned Test Case versions`, `Ad hoc scope`, `Package context`, `Repository`, `Branch`, `Commit`, `Build`, `Target environment`, `Environment preconditions`, `Package version`, `No package produced yet`, `None selected.`

### Gelen Oturum Testleri
Handoff'a bağlı gelen Oturum Testleri; bağlama alanı.
- **Label'lar:** `Linked Session Tests`, `None arrived yet.`, `Link arriving Session Test`, `Choose a Session Test`, `Link Session Test to <handoff>`.

### Durumlar
#### Empty
`No Test Handoffs yet.` + `Create Test Handoff`.
#### Loading
`Loading Test Handoffs…`
#### Error
`Test Handoffs are unavailable.`; geçiş hatası `Test Handoff did not change.`
#### Result suggested
`Shared` + gelen sonuç: öneri kutusu görünür, `Mark as Result received` birincil.
#### Canceled with result
`Canceled` Handoff'a sonuç geldi: `Result arrived after cancel…` notu; geçiş düğmesi yok.
#### Closed
Terminal; düzenleme ve geçiş yok.

**Spec:** [53 Planlı Test ve Handoff](../../specs/53-test-plan-and-handoff/spec.md), [57](../../specs/57-test-review-and-follow-up/spec.md)

## 15.5 · Test Handoff Editor
> Handoff'u amaç, kesin senaryo sürümleri, ad hoc kapsam, hedef yürütücü, teknik ve paket bağlamıyla oluşturmak veya düzenlemek.

**Artboard'lar**
- `15.5 · Test Handoff Editor · Create · 1440`
- `15.5 · Test Handoff Editor · Edit · 1440`

### Temel alanlar
Başlık, amaç ve kapsam, hedef yürütücü, hedef tarih.
- **Label'lar:** `Title`, `Purpose and scope`, `Target executor` (serbest metin; öneriler `Me`, `Codex`, `Claude Code`, `Conductor`), `Due date`.

### Senaryo sürümleri
Her Planlı Test Senaryosu için dahil etme kutusu ve sürüm seçimi; `latest` seçeneği yok.
- **Label'lar:** `Include <title>`, `Version of <title>`, `Version 3`, boş: `No Planned Test Cases yet. Add a Planned Test Case to select versions.`

### Ad hoc kapsam
Numaralı ad hoc maddeler.
- **Label'lar:** `Ad hoc scope`, `Ad hoc intent n`, `Ad hoc expected behavior n`, `Remove ad hoc item n`.

### Teknik bağlam
Kurucunun yazdığı teknik bağlam alanları; ürün doldurmaz.
- **Label'lar:** `Technical context`, `Repository`, `Branch`, `Commit`, `Build`, `Target environment`, `Environment preconditions`.

### Paket bağlamı
Seçilen İş/Özellik, kesin Belge revizyonu/bölümü ve kesin Ekran/Wireframe/Teknik Diyagram sürümleri.
- **Label'lar:** `Package context`, `Context type`, `Context record`, `Choose a version`, `Whole Document`, `Selected context records`, `Remove context <label>`, `No context records.`

### Form eylemleri
Kaydet düğmesi.
- **Label'lar:** `Create Test Handoff`, `Save changes`.

### Durumlar
#### Create
Boş form.
#### Edit
Mevcut değerlerle; `Save changes`.
#### Validation error
Seçili senaryoya sürüm seçilmemiş: alan hatası; `Choose a Wireframe version.` örneği.

**Spec:** [53 Planlı Test ve Handoff](../../specs/53-test-plan-and-handoff/spec.md)

## 15.6 · Handoff Package
> Handoff'tan kapalı Markdown/JSON paketini önizlemek, yeni paket sürümü üretmek ve üretilmiş sürümleri kopyalamak/indirmek.

**Artboard'lar**
- `15.6 · Handoff Package · Preview · 1440`
- `15.6 · Handoff Package · Not shareable yet · 1440`

### Paket önizlemesi
Sonraki paket sürümünün içereceği bölümler; ayrı "asla girmez" listesi; engeller.
<details>
<summary>Label'lar</summary>

`Package`, `Package preview of <title>`, `Package version 3 will contain`, `Included in the package`, `Planned Test Case versions`, `Ad hoc scope`, `Work context`, `Document context`, `Design references`, `Never included in the package` / `Never included` (secrets, tokens, credentials, unselected relations, redacted values, unapproved attachments), `Package blockers`.

</details>

### Üretilmiş paketler
Sürüm satırları; her biri Markdown ve JSON için kopyala/indir.
- **Label'lar:** `Produced packages of <title>`, `Package version 2`, `Markdown package`, `Copy <label> version 2`, `Download <label> version 2`, başarı `Package version 3 produced.`

### Durumlar
#### Not shareable yet
`Draft` Handoff: `A Test Handoff produces a package only while it is Ready to share or Shared. Mark it Ready to share first.`
#### Blockers
`Package blockers` listesi (ör. erişilemeyen kayıt); üretim düğmesi pasif.
#### Error
`The package could not be previewed.` / `The package was not produced.` / `Produced packages could not be loaded.`

**Spec:** [53 Planlı Test ve Handoff](../../specs/53-test-plan-and-handoff/spec.md)

## 15.7 · Test Sessions
> Üç giriş yolundan gelen Test Oturumlarını tek modelde listelemek; yürüten, raporlayan ve giriş yolunu ayrı göstermek.

**Artboard'lar**
- `15.7 · Test Sessions · Default · 1440`
- `15.7 · Test Sessions · Empty · 1440`

### Giriş eylemleri
İki giriş yolu düğmesi.
- **Label'lar:** `Record Test Session`, `Import Test Session file`.

### Oturum listesi
Her satır: başlık/özet, inceleme durumu, yürüten türü, yürüten, raporlayan, giriş yolu, rapor zamanı.
- **Label'lar:** `Test Sessions`, `Unreviewed`, `Executor type`, `Executor`, `Reporter`, `Ingress` (`Application`, `File import`, `MCP`), `Reported at`, `No Test Sessions yet.`

### Durumlar
#### Empty
`No Test Sessions yet.` + iki giriş eylemi.
#### Loading
`Loading Test Sessions…`
#### Error
`Test Sessions are unavailable.`

**Spec:** [54 Test Raporu Kabulü](../../specs/54-test-report-acceptance/spec.md), [57](../../specs/57-test-review-and-follow-up/spec.md)

## 15.8 · Record Test Session
> Ürün dışında elle yapılmış testleri tek Test Oturumu ve Oturum Testleri olarak kaydetmek; Kaydet'e kadar kayıt oluşmaz.

**Artboard'lar**
- `15.8 · Record Test Session · Default · 1440`
- `15.8 · Record Test Session · Sensitive data · 1440`

### Oturum alanları
Yürüten, sürüm, rapor zamanı ve özet.
- **Label'lar:** `Executor type` (`User`, `AI agent`, `External tool`), `Executor`, `Executor version`, `Reported at`, `Summary`.

### Oturum Testleri
Her blok: başlık, sonuç, notlar; isteğe bağlı senaryo bağı.
- **Label'lar:** `Session Test n title`, `Session Test n result` (`Passed`, `Failed`, `Blocked`, `Skipped`, `Inconclusive`, `Not reported`), `Session Test n notes`, `Add Session Test`, `Remove Session Test n`, `Link <title> to a Planned Test Case`.

### Form eylemleri
Kaydet düğmesi.
- **Label'lar:** `Record Test Session`.

### Durumlar
#### Default
İki Oturum Testi bloklu dolu form.
#### Sensitive data
`Nothing was saved. Possible sensitive data in: <paths>. Remove it from the source and send the report again.` — yalnız maskeli alan yolu.
#### Limit
200 Oturum Testi sınırında `Add Session Test` pasif, neden metni.
#### Saved
Kayıt sonrası 15.10 açılır; oturum `Unreviewed`; bildirim üretilmez.

**Spec:** [54 Test Raporu Kabulü](../../specs/54-test-report-acceptance/spec.md), [53](../../specs/53-test-plan-and-handoff/spec.md)

## 15.9 · Import Test Session File
> `test-report/1` JSON veya YAML frontmatter'lı Markdown dosyasını bütün olarak doğrulayıp atomik içe aktarmak.

**Artboard'lar**
- `15.9 · Import Test Session File · Default · 1440`
- `15.9 · Import Test Session File · Accepted · 1440`
- `15.9 · Import Test Session File · Rejected · 1440`
- `15.9 · Import Test Session File · Masked review · 1440`

### Dosya seçimi
Dosya alanı ve biçim ipucu.
- **Label'lar:** `Import Test Session file`, `Test report file`, ipucu `Choose a .json, .md or .markdown file.`

### Kabul sonucu
Başarıda makbuz: iç oturum kimliği, dış oturum kimliği, kabul zamanı, `created` / `duplicate`; retçe sabit hata kodu, güvenli alan yolu, düzeltme açıklaması.
<details>
<summary>Label'lar</summary>

Hata kodları kod olarak görünür: `schema_unsupported`, `project_not_authorized`, `payload_too_large`, `invalid_field`, `unsupported_field`, `duplicate_external_test_id`, `identity_conflict`, `reference_not_found`, `reference_scope_mismatch`, `result_conflict`, `sensitive_data_detected`, `attachment_rejected`; `Field: <path>.`

</details>

### Durumlar
#### Default
Boş seçim.
#### Accepted
Makbuz; oturum `Unreviewed`; `Notification Center`'da tek `unreviewed-test-report` (→ `00 · Shared Shell`).
#### Duplicate
Aynı içerik tekrar: önceki makbuz, `duplicate`; yeni oturum yok.
#### Rejected
Hata kodu + alan yolu; "Nothing was saved." vurgusu; payload içeriği yansıtılmaz.
#### Masked review
Belirsiz secret bulgusu: içerik gösterilmeden maskeli alan yolu listesi ve kaynaktan çıkarıp yeniden gönderme yönergesi.

**Spec:** [54 Test Raporu Kabulü](../../specs/54-test-report-acceptance/spec.md)

## 15.10 · Test Session Review
> Tek Test Oturumunu ve Oturum Testlerini bağımsız incelemek; ham ve normalize sonucu, bağlamı, olay geçmişini ve sinyalleri göstermek.

**Artboard'lar**
- `15.10 · Test Session Review · Unreviewed · 1440`
- `15.10 · Test Session Review · Mixed review · 1440`
- `15.10 · Test Session Review · Conflict · 1440`
- `15.10 · Test Session Review · Context changed · 1440`
- `15.10 · Test Session Review · Withdrawn and redacted · 1440`

### Oturum başlığı ve inceleme
Başlık; oturum inceleme durumu seçimi; toplu eylem; kapatma.
<details>
<summary>Label'lar</summary>

`Test Review`, açıklama `Review is your management decision on top of a reported result. It does not change the result, gate a release, or touch a Handoff.`, `Session review: Unreviewed`, `Reviewed`, `Follow-up needed`, `Closed`, `Mark session and selected results as reviewed`, `Close Test Session`, `New context after close`.

</details>

### Oturum meta
Yürüten, raporlayan, giriş yolu, zaman, teknik bağlam ve bağlı Handoff.
- **Label'lar:** `Executor type`, `Executor`, `Reporter`, `Ingress`, `Reported at`, `Technical context`, `Technical context: unknown (no branch, commit or build recorded).`, bağlı Handoff.

### Oturum Testleri
Her satır: seçim kutusu, başlık, ham sonuç, normalize sonuç, inceleme durumu, senaryo bağı (sürüm farkıyla), satır eylemleri.
<details>
<summary>Label'lar</summary>

`Session Tests`, `Select <title>`, `Raw result`, `Normalized result`, `Reported`, `Current result`, `Current result: withdrawn (Withdrawal)`, `Planned Test Case: <title>`, `Bound to v1, current v3`, `Changes since the bound version`, `Ad hoc, not bound to a Planned Test Case.`, `Purpose when recorded`, `Expected behavior when recorded`, `Correction for <title>`, `Withdrawal for <title>`, `Redact reported result of <title>`, `Supersedes`, `Create follow-up work`, `No Session Tests.`

</details>

### Düzeltme geçmişi
Maddeye bağlı olay zinciri: tür, zaman, gerekçe, yazar; özgün bildirim yerinde.
- **Label'lar:** `Correction history`, `Correction`, `Withdrawal`, `Redaction`, `Redacted`, `Redact content of <kind> <time>`.

### Sinyaller
Çelişen sonuçlar ve bağlam değişikliği bölümleri, yalnız varsa.
<details>
<summary>Label'lar</summary>

`Conflicting results`, açıklama `The same exact scenario version has differing results and no Supersedes relation. The product picks no winner: bind the valid result to close the signal.`, `Bind valid result: <title> by <executor>`, `Context changed`, `Context changed: <title>`, `Primary spec changed`, hata `The result was not bound.`

</details>

### Review history
İnceleme ve kapanış olayları; kapanışta kalan kayıtlar `<title> (<state>)`.
- **Label'lar:** `Review history`.

### Durumlar
#### Unreviewed
Yeni oturum, bütün maddeler `Unreviewed`.
#### Mixed review
Oturum `Reviewed`, bir madde `Follow-up needed` — bağımsızlığı gösterir.
#### Conflict
Çelişen sonuçlar bölümü açık.
#### Context changed
`Context changed: Bounce on +alias address` · `Primary spec changed`; sonuç geçersiz/başarısız işaretlenmez.
#### New context after close
Kapalı oturuma sonradan düzeltme geldi: başlık altında `New context after close`; inceleme durumu geri alınmaz.
#### Withdrawn and redacted
Bir madde `Current result: withdrawn (Withdrawal)`; bir değer `Redacted` işareti, zaman, gerekçe, aktör.
#### Empty
`No Test Sessions to review.` (alan listesinde)
#### Error
`The review was not saved.`; başarı `Review saved.` / `Marked as reviewed.` / `Test Session closed.`

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md), [54](../../specs/54-test-report-acceptance/spec.md), [53](../../specs/53-test-plan-and-handoff/spec.md)

## 15.11 · Mark Reviewed Preview
> Toplu inceleme eyleminin değiştireceği kesin kayıtları önizleyip tek denetlenebilir işlemle uygulamak.

**Artboard'lar**
- `15.11 · Mark Reviewed Preview · Default · 1440`
- —

### Önizleme
Değişecek kesin kayıt listesi; onay ve iptal.
- **Label'lar:** `Preview: Mark session and selected results as reviewed`, `These exact records become Reviewed in one step:`, `Records to change`, `Everything selected is already Reviewed. Nothing would change.`, hata `The preview is unavailable.`

### Durumlar
#### Default
Üç kayıt listesi.
#### Nothing to change
Boş küme metni; onay pasif.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md)

## 15.12 · Close Test Session
> Oturumu kapatırken incelenmemiş veya takip gereken kalan maddeleri göstermek ve isteğe bağlı kapanış gerekçesini almak.

**Artboard'lar**
- `15.12 · Close Test Session · With remaining · 1440`
- —

### Kalan kayıtlar
Kalan maddeler listesi ve isteğe bağlı gerekçe alanı.
- **Label'lar:** `Close Test Session`, `Remaining Session Tests`, `Every Session Test has been reviewed or closed.`, gerekçe alanı.

### Durumlar
#### With remaining
Kalan liste + gerekçe.
#### All reviewed
Tek cümle, liste yok.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md)

## 15.13 · Result Event
> Oturum veya Oturum Testine gerekçeli `Correction`, `Withdrawal` veya güvenlik redaksiyonu olayı eklemek; özgün bildirimi silmeden.

**Artboard'lar**
- `15.13 · Result Event · Correction · 1440`
- `15.13 · Result Event · Redaction · 1440`

### Olay formu
Olay türü, düzeltilmiş değer ve gerekçe; özgün raporun korunduğu sabit açıklama.
<details>
<summary>Label'lar</summary>

`Correction`, `Withdrawal`, `Redaction`, `Corrected summary`, `Note (optional)`, sabit açıklama `This adds a new event. The original report is not edited or deleted.`, redaksiyonda `The value is replaced by a mark with time, reason and actor. It cannot be used as current evidence or export. This is not Trash.`, `Redact a sensitive value`.

</details>

### Durumlar
#### Correction
Normalize sonuç ve gerekçeyle düzeltme formu.
#### Withdrawal
Sonucu geri çeken gerekçeli olay formu.
#### Redaction
Yüksek riskli onay; etkisi açıkça gösterilir → ortak `Redact` dialog'u `20 · Shared Dialogs & States`.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md)

## 15.14 · Supersedes
> Kesin Oturum Testleri arasında yönlü, döngüsüz `Supersedes` ilişkisi kurmak; iki tarihsel sonucu ve teknik bağlam farkını korumak.

**Artboard'lar**
- `15.14 · Supersedes · Default · 1440`
- —

### Seçim ve karşılaştırma
İki sonuç yan yana, teknik bağlam farkı ve supersede zinciri.
- **Label'lar:** `Supersedes`, `Newer result`, `Technical context difference`, `No recorded technical context difference.`, `Supersedes chain`, `Superseded`.

### Durumlar
#### Default
Yeni ve eski sonuç yan yana, teknik bağlam farkıyla.
#### Cycle refused
Döngü oluşturacak seçim reddedilir, neden metni.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md)

## 15.16 · Test Gaps
> Kurucunun açıkça kaydettiği Test Açıklarını durum, dayanak ilişkileri, planlama bağları ve kapanış bilgisiyle göstermek.

**Artboard'lar**
- `15.16 · Test Gaps · Default · 1440`
- `15.16 · Test Gaps · Empty · 1440`

### Sayı satırı
Açık ve planlı Test Açığı sayısı; sayı tam kümeye açılır.
- **Label'lar:** `Open and planned Test Gaps: 2`, `Test Gaps in this count`.

### Test Açığı listesi
Başlık, durum, gerekçe, dayanak ilişkileri, planlama, kapanış.
<details>
<summary>Label'lar</summary>

`Test Gaps`, `Open`, `Planned`, `Met by result`, `Not needed`, `Rationale`, `Support relations`, `No support relations.`, `Planning`, `Not linked to any test plan.`, `Planned Test Case: <title>, version <n>`, `Test Handoff: <title> (<state>)`, `Closure`, `Session Tests that met this Test Gap`, `Session Test: <title>`, `Decision: <label>`, `Decision: unavailable (No access)`, `Open <title>`.

</details>

### Durumlar
#### Empty
`No Test Gaps filed.` — sistem açık üretmediği dürüstçe belirtilir.
#### Loading
`Loading Test Gaps…`
#### Error
`Test Gaps are unavailable.`
#### Met by result
Kapanış: seçili kesin Oturum Testleri ve gerekçe.
#### Archived
Salt okunur; ilişkiler korunur.

**Spec:** [55 Test Açığı](../../specs/55-test-gaps/spec.md)

## 15.17 · File Test Gap
> Başlık, gerekçe ve dayanak ilişkileriyle Test Açığı kaydetmek; isteğe bağlı senaryo veya Handoff'a planlamak.

**Artboard'lar**
- `15.17 · File Test Gap · Default · 1440`
- —

### Alanlar
Başlık, gerekçe ve dayanak ilişkileri.
- **Label'lar:** `Title`, `Rationale`, `Support relations`, `Relation type` (`Feature`, `Work`, `Spec section`, `Risk`, `Project Release`, `Document`), `Whole Document`, `Selected support relations`, `Remove support relation <label>`, `This Project has no <type> to relate yet.`

### Planlama
İsteğe bağlı senaryo sürümü veya Handoff bağı.
- **Label'lar:** `Planning for <title>`, `Planned Test Case version`, `Test Handoff`, `Linked to the Planned Test Case version.`, `Linked to the Test Handoff.`, `Link to <title> removed.`

### Form eylemleri
Kaydet düğmesi.
- **Label'lar:** `File Test Gap`.

### Durumlar
#### Default
Dolu form, `Outlook alias delivery untested`.
#### Validation error
Zorunlu alan eksik: alan altında hata.

**Spec:** [55 Test Açığı](../../specs/55-test-gaps/spec.md)

## 15.18 · Close Test Gap
> Test Açığını `Met by result` (seçili kesin Oturum Testleriyle) veya `Not needed` (gerekçe, isteğe bağlı Karar) olarak kapatmak.

**Artboard'lar**
- `15.18 · Close Test Gap · Met by result · 1440`
- `15.18 · Close Test Gap · Not needed · 1440`

### Kapanış
Kapanış türü, kesin Oturum Testi seçimi veya gerekçe ve Karar.
- **Label'lar:** `Close <title>`, `Close as` (`Met by result`, `Not needed`), `Session Tests that meet this Test Gap`, `Rationale (optional)`, `Rationale`, Decision seçimi, `Mark as Met by result`, `Mark as Not needed`.

### Durumlar
#### Met by result
Seçim kutulu Oturum Testi listesi; en az biri seçilmeden onay pasif.
#### Not needed
Gerekçe zorunlu; Karar isteğe bağlı.

**Spec:** [55 Test Açığı](../../specs/55-test-gaps/spec.md)

## 15.19 · Recent Test Assessments
> Tarihli Test değerlendirmesi snapshot'larını göstermek; sonradan gelen test bağlamını snapshot'ı değiştirmeden bildirmek.

**Artboard'lar**
- `15.19 · Recent Test Assessments · Default · 1440`
- `15.19 · Recent Test Assessments · New test context · 1440`
- `15.19 · Recent Test Assessments · Empty · 1440`

### Snapshot
Bağlam, karar, değerlendiren/zaman, bilinen sınırlamalar, atıf verilen kayıtlar; varsa yeni bağlam bildirimi.
<details>
<summary>Label'lar</summary>

`Recent Test Assessments`, `<kind>: <label>` (`Feature`, `Test Handoff`, `Project Release`), `Decision at the time: `, `Acceptable`, `Follow-up needed`, `Undecided`, `Assessed <time> by <assessor>`, `Known limits: `, `Test Session ids`, `Test Gap ids`, `Follow-up Work ids`, `Unavailable record`, `New test context after this assessment`.

</details>

### Durumlar
#### Empty
`No Test Assessments yet. Publishing never needs one.`
#### Loading
`Loading Test Assessments…`
#### Error
`Test Assessments are unavailable.`
#### New test context
Snapshot hâlâ `Acceptable`; altında `New test context after this assessment` ve kesin kaynaklar.

**Spec:** [56 Test Değerlendirmesi](../../specs/56-test-assessments/spec.md)

## 15.20 · Record Test Assessment
> Bir Özellik, Handoff veya Proje Sürümü bağlamı için kesin kaynaklarla isteğe bağlı tarihli snapshot kaydetmek.

**Artboard'lar**
- `15.20 · Record Test Assessment · Default · 1440`
- —

### Alanlar
Bağlam türü ve kaydı, karar, bilinen sınırlamalar ve kesin kaynak seçimleri.
<details>
<summary>Label'lar</summary>

`Context` (`Feature`, `Test Handoff`, `Project Release`), `Choose a <kind>`, `Decision` (`Acceptable`, `Follow-up needed`, `Undecided`), `Known limits`, `Test Session ids`, `Test Gap ids`, `Follow-up Work ids`, `Record Test Assessment`, hata `Choose a context and a decision.`, `The <kind> list is unavailable.`

</details>

### Durumlar
#### Default
Bağlam seçili, karar ve kaynak seçim listeleri dolu form.
#### Validation error
`Choose a context and a decision.`

**Spec:** [56 Test Değerlendirmesi](../../specs/56-test-assessments/spec.md)

## 15.21 · Test Summary · Feature
> Özellik detayında ilgili senaryo, Handoff, oturum/madde, açık Test Açığı, takip İşi ve son değerlendirmenin nötr canlı manzarasını göstermek.

**Artboard'lar**
- `15.21 · Test Summary · Feature · Default · 1440`
- `15.21 · Test Summary · Feature · No related records · 1440`

### Özet bölümleri
Kapsam satırı, sayılı bölüm satırları ve iki sabit sınır notu.
<details>
<summary>Label'lar</summary>

`Test Summary: <Feature>`, `Scope: Feature: <label>`, `Planned Test Cases`, `Test Handoffs`, `Test Sessions`, `Session Tests`, `Open Test Gaps`, `Follow-up work`, `Latest Test Assessment`; sabit notlar `A neutral view of existing records. It is not a score, a coverage figure, a pass/fail verdict, a waiver, a release gate or a Release Evidence Pack.`, `GitHub checks are external facts. They are not Test Sessions and are not counted here.`

</details>

### Attention
Nötr dikkat satırları listesi.
<details>
<summary>Label'lar</summary>

`Attention`, `No related test records`, `Planned Test Cases without a reported result` (`Bound Session Tests: None`), `Failed results`, `Blocked results`, `Inconclusive results`, `Skipped results`, `Context changed`, `Conflicting results`, `Unreviewed reports`, `New test context after this assessment`.

</details>

### Durumlar
#### Default
`LUMA-51 Stripe webhook retry` sayılarıyla bölümler ve `Failed results 1` attention satırı.
#### No related records
`No related test records` attention satırı; sayılar 0.
#### Loading / Error
`Loading Test Summary…` / `Test Summary is unavailable.` + `Retry`.

**Spec:** [57 Test İnceleme ve Takip](../../specs/57-test-review-and-follow-up/spec.md), [55](../../specs/55-test-gaps/spec.md), [56](../../specs/56-test-assessments/spec.md)
