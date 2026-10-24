# 12 · Decisions

Projenin `Decisions` alanı: Kararlar, Riskler, Varsayımlar ve Açık Sorular. Doğrulama kayıtları bu dosyada değildir (→ `11.12 · Validation Records`).

| Ekran | Ne çizilir |
|---|---|
| [12.1 · Decisions](#121--decisions) | Karar listesi, seçili Karar ve zinciri |
| [12.2 · Supersede another decision](#122--supersede-another-decision) | Yerine geçme seçimi ve iki taraflı önizleme |
| [12.3 · Withdraw Decision](#123--withdraw-decision) | Geri çekme formu |
| [12.4 · Risks](#124--risks) | Risk listesi ve Risk detayı |
| [12.5 · Risk Status](#125--risk-status) | Risk yaşamı değiştirme formu |
| [12.6 · Assumptions](#126--assumptions) | Varsayım listesi ve detayı |
| [12.7 · Assumption Transition](#127--assumption-transition) | Varsayım yaşam geçişi formu |
| [12.8 · Open Questions](#128--open-questions) | Açık Soru listesi ve detayı |
| [12.9 · Answer Open Question](#129--answer-open-question) | Yanıt formu |
| [12.10 · Evidence by Evidence Role](#1210--evidence-by-evidence-role) | Rol grupları ve rol düzenleme |

## 12.1 · Decisions
> Projenin Kararlarını yaşamlarıyla listelemek ve seçili Kararın hükmünü, gerekçesini ve zincirini okumak.

**Artboard'lar**
- `12.1 · Decisions · Default · 1440`
- `12.1 · Decisions · Default · 768`
- `12.1 · Decisions · Superseded · 1440`
- `12.1 · Decisions · Withdrawn · 1440`
- `12.1 · Decisions · Empty · 1440`

### Alan başlığı ve tür geçişi
Yerleşim: `Assumptions` ve `Open Questions` bu alanda yer alır (PRD 02 Proje alanı kataloğu, CONTEXT). Spec 41 ve uygulanan kod (`#project-area-discovery`) aynı kayıtları `Discovery` altında açar; bu kaynak çelişkisi çözülene kadar harita PRD'yi izler.
- **Label'lar:** `Decisions`, `Risks`, `Assumptions`, `Open Questions`.

### Karar listesi
Bütün yaşamlar tarihsel gezinme için listelenir; satırda başlık ve yaşam. Başlıkta `Export` (→ `20.5 · Export`) ve `Import` (→ `20.6 · Import`).
- **Label'lar:** `Decisions`, `Create`, `Valid`, `Superseded`, `Withdrawn`, `Export`, `Import`.

### Başlık bölgesi
Başlık, yaşam, Karar tarihi; eylemler. Karar tarihi geçiş zamanından ayrı kalır: `Superseded` Kararda geçiş zamanı `Superseded on`, `Withdrawn` Kararda `Withdrawn on` olarak ayrıca yazılır. Ortak kayıt eylemleri (`Add to Favorites`, `Remind me` ve diğerleri) → `DS.11 · Record Header`; burada yalnız Karara özgü eylemler. Arşivli Projede `Add to Favorites` kullanılabilir kalır, yazma eylemleri gizlidir.
- **Label'lar:** `Decision`, `Decision date`, `Superseded on`, `Withdrawn on`, `Edit`, `Withdraw`, `Supersede another decision`, `Remove supersession`.

### Etiketler
Karara uygulanmış Çalışma Alanı Etiketleri; uygulama ve kaldırma ortak seçiciyle (→ `20.11 · Tag Picker`). Etiket uygulamak Kararın yaşamını, kapsamını veya paylaşımını değiştirmez.
- **Label'lar:** `Tags` (ayrıntı ve hata metinleri `20.11`'dedir).

### Özel alanlar
Karar türüne bağlı Proje özel alanları. Özel alanlar: satır ve boş değer kuralı → DS.12.

### Decision chain
En eski kayıttan güncel `Valid` Karara nesil listesi; her geçişin tarihi ve gerekçesi. İlişkisiz tek Kararda gösterilmez.
- **Label'lar:** `Decision chain`, `Superseded`, `Open current decision`, `No Valid Decision.`

### Hüküm ve gerekçe
Başlık, hüküm metni ve gerekçe.
- **Label'lar:** `Title`, `Decision text`, `Rationale`.

### Kanıt
Hedef tarafı kanıt yüzeyi → `12.10 · Evidence by Evidence Role`; altında katlanır `Evidence Flow` → `11.13`.
- **Label'lar:** `Evidence by Evidence Role`, `Evidence Flow`.

### Durumlar
#### Empty
`No Decisions yet.`
#### Loading
`Loading Decisions…`; zincir `Loading Decision chain…`
#### Error
`Decisions are unavailable.` ve `Retry`; `Decision is unavailable.`; `Decision chain is unavailable.`
#### Form
`Create`/`Edit`: `Title`, `Decision text`, `Rationale`, `Save`, `Saving…`, `Cancel`. Kaydetme hatası ve çatışma kalıbı → DS.16 ve `20.14 › Conflict`; tür adı `Decision`; başarı `Decision saved.`
#### Superseded Karar
Başlıkta doğrudan halef ve son `Valid` Karar, `Superseded on` geçiş zamanı ve gerekçesi, `Open current decision`; özgün içerik, kanıt rolleri, ilişkiler ve geçmiş okunur, içerik düzenlenemez.
#### Withdrawn Karar
`Withdrawn` · `Withdrawn on` geri çekme tarihi ve isteğe bağlı gerekçe özgün gerekçeden ayrı; başarı `Decision withdrawn.`
#### Arşivli Proje
Ferry: bant ve salt okunur metni → `20.21 · Archived Read-only Banner`; yazma eylemi yok, `Add to Favorites` kalır.

**Spec:** [38 Kararlar](../../specs/38-decisions/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md) (kanıt bölgeleri).

## 12.2 · Supersede another decision
> Bir veya birkaç eski Kararı yeni geçerli Kararla tam olarak değiştirmeyi önizleyip tek atomik işlemle uygulamak; ya da bir yerine geçme ilişkisini önizlemeyle kaldırmak.

**Artboard'lar**
- `12.2 · Supersede another decision · Preview · 1440`
- `12.2 · Supersede another decision · Remove · 1440`
- `12.2 · Supersede another decision · Stale preview · 1440`

### Seçim
Yeni Karar için yerine geçilecek Kararların seçimi ve isteğe bağlı geçiş gerekçesi (alan label'ı `Transition rationale`; isteğe bağlılık label'a eklenmez).
- **Label'lar:** `Supersession`, `Supersede another decision`, `Decisions to supersede`, `Transition rationale`, `Preview`, `Cancel`, `Loading…`

### Supersession preview
Her iki tarafın hüküm metni, gerekçesi ve mevcut kanıtı; değişecek yaşamlar; ilişkili kayıtların taşınmadığı açıklaması.
- **Label'lar:** `Supersession preview`, `Supersedes`, `Evidence`, `Valid → Superseded`, `Confirm supersession`, `Saving…`, `Only full replacement uses Supersedes. Related records and their status, …`

### Remove supersession
Aynı önizleme `Superseded → Valid` yönünde; halef ve diğer zincir bağları korunur. Önizlemede isteğe bağlı `Transition rationale` alanı bulunur (seçim formundaki aynı label); girilen gerekçe yerine geçme geçmişinde saklanır.
- **Label'lar:** `Remove supersession`, `Superseded → Valid`, `Transition rationale`, `Confirm removal`.

### Durumlar
#### Loading
`Loading supersession…`
#### Error
`Supersession is unavailable.`; `Supersession could not be saved. Retry to check the same request.`
#### Seçim değişti
`Decisions changed or are unavailable. Review your selection and try again.`
#### Bayat önizleme
`Decisions changed. Cancel and preview again before confirming.`
#### Reddedilen grafik
Kendine bağlama, döngü veya çelişkili çatallanma uygulanmadan reddedilir.

**Spec:** [38 Kararlar](../../specs/38-decisions/spec.md).

## 12.3 · Withdraw Decision
> Kararı halef gerektirmeden, isteğe bağlı tarihli gerekçeyle `Withdrawn` yapmak.

**Artboard'lar**
- `12.3 · Withdraw Decision · Default · 1440`

### Form
Geri çekme gerekçesi ve kaydetme.
- **Label'lar:** `Withdraw`, `Rationale`, `Save`, `Saving…`, `Cancel`.

### Durumlar
#### Error
Metin korunur, aynı istek tekrar edilebilir.

**Spec:** [38 Kararlar](../../specs/38-decisions/spec.md).

## 12.4 · Risks
> Riskleri etki, olasılık, yanıt ve yaşamlarıyla izlemek.

**Artboard'lar**
- `12.4 · Risks · Default · 1440`
- `12.4 · Risks · Accepted · 1440`
- `12.4 · Risks · Empty · 1440`

### Risk listesi
Riskler başlık ve yaşamla. Başlıkta `Export` (→ `20.5 · Export`) ve `Import` (→ `20.6 · Import`).
- **Label'lar:** `Risks`, `Create`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`, `Export`, `Import`.

### Risk detayı
Başlık, açıklama, etki, olasılık, yanıt, yaşam ve gerekçe. Ortak kayıt eylemleri → `DS.11 · Record Header`.
- **Label'lar:** `Risk`, `Title`, `Description`, `Impact`, `Probability`, `Response/mitigation`, `Status`, `Rationale`, `Edit`.

### Özel alanlar
Risk türüne bağlı Proje özel alanları. Özel alanlar: satır ve boş değer kuralı → DS.12.

### Kanıt
→ `12.10 · Evidence by Evidence Role`. Risk Kanıt Akışı göstermez.

### Durumlar
#### Empty
`No Risks yet.`
#### Loading
`Loading Risks…`
#### Error
`Risks are unavailable.` ve `Retry`; `Risk is unavailable.`
#### Form
`Title`, `Description`, `Impact`, `Probability`, `Response/mitigation`, `Save`, `Saving…`, `Cancel`; `Check the form.`; kaydetme hatası ve çatışma kalıbı → DS.16 ve `20.14 › Conflict`, tür adı `Risk`; `Risk saved.`
#### Accepted
Başlık altında `A known Risk remains recorded when accepted.` ve kabul gerekçesi.
#### Arşivli Proje
Okunur; yazma yok → `20.21 · Archived Read-only Banner`.

**Spec:** [40 Riskler](../../specs/40-risks/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md) (kanıt bölgesi).

## 12.5 · Risk Status
> Riskin yaşamını açık kullanıcı eylemiyle değiştirmek.

**Artboard'lar**
- `12.5 · Risk Status · Accepted · 1440`

### Form
Yaşam seçimi ve gerekçe.
- **Label'lar:** `Status`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`, `Rationale`, `Save`, `Cancel`.

### Durumlar
#### Error
Boş kabul gerekçesi alan hatası; aynı duruma geçiş çatışması.
#### Kaydedildi
`Risk status saved.`

**Spec:** [40 Riskler](../../specs/40-risks/spec.md).

## 12.6 · Assumptions
> Doğrulanmamış önermeleri yaşam, gerekçe ve kesin kanıtlarıyla tutmak.

**Artboard'lar**
- `12.6 · Assumptions · Default · 1440`
- `12.6 · Assumptions · No evidence · 1440`
- `12.6 · Assumptions · Empty · 1440`

### Liste
Varsayımlar başlık ve yaşamla. Başlıkta `Export` (→ `20.5 · Export`) ve `Import` (→ `20.6 · Import`).
- **Label'lar:** `Assumption`, `Create`, `Open`, `Confirmed`, `Refuted`, `No longer applicable`, `Export`, `Import`.

### Detay
Önerme, gerekçe, kanıt veya kanıt yok satırı; yaşam butonları. Kanıt satırı yerine `Evidence by Evidence Role` bölgesi çağrılır (→ `12.10 · Evidence by Evidence Role`; kesin sürüm ve alıntı orada); altında katlanır `Evidence Flow` (→ `11.13 · Evidence Flow`). Kanıt yoksa `No evidence linked.` kalır.
- **Label'lar:** `Statement`, `Rationale`, `Evidence by Evidence Role`, `Evidence Flow`, `Version`, `No evidence linked.`, `Edit`.

### Özel alanlar
Varsayım türüne bağlı Proje özel alanları. Özel alanlar: satır ve boş değer kuralı → DS.12.

### Durumlar
#### Empty
`No Assumptions yet.`
#### Loading
`Loading Assumptions…`; `Loading Documents…`
#### Error
`Assumptions are unavailable.` ve `Retry`; `Assumption is unavailable.`
#### Form
`Title`, `Statement`, `Rationale`, `Save`, `Saving…`, `Cancel`; kaydetme hatası kalıbı → DS.16, tür adı `Assumption`; `Assumption saved.`
#### Kanıtsız sonuç
`Confirmed` ama kanıt yok: `No evidence linked.` gerekçe olsa bile görünür.
#### Arşivli Proje
Kayıtlar ve kanıtlar okunur → `20.21 · Archived Read-only Banner`.

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).

## 12.7 · Assumption Transition
> Varsayım yaşamını isteğe bağlı gerekçe ve kesin Belge kanıtıyla değiştirmek.

**Artboard'lar**
- `12.7 · Assumption Transition · Confirmed · 1440`

### Form
Seçilen yaşam; `Confirmed`/`Refuted` için gerekçe ve kanıt; `Open`/`No longer applicable` için mevcut bağlamın korunduğu cümlesi.
- **Label'lar:** `Confirmed`, `Refuted`, `Open`, `No longer applicable`, `Rationale`, `Evidence (optional)`, `No new evidence`, `Evidence is optional.`, `The selected Document text is pinned to this version.`, `Existing Statement, Rationale and Evidence are kept.`, `Save`, `Cancel`.

### Durumlar
#### Error
`Evidence is unavailable. Choose it again before saving.`; `Evidence choices are unavailable. You can save a Rationale or continue …`
#### Conflict
Çatışma kalıbı → `20.14 › Conflict` ve DS.16; tür adları `Assumption or Evidence`.

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md).

## 12.8 · Open Questions
> Yanıt bekleyen soruları bağlamıyla tutmak; yanıtı, gerekçeyi ve kanıtı tarihsel korumak.

**Artboard'lar**
- `12.8 · Open Questions · Default · 1440`
- `12.8 · Open Questions · Answered · 1440`
- `12.8 · Open Questions · Empty · 1440`

### Liste
Açık Sorular başlık ve yaşamla. Başlıkta `Export` (→ `20.5 · Export`) ve `Import` (→ `20.6 · Import`).
- **Label'lar:** `Open Question`, `Create`, `Open`, `Answered`, `No longer applicable`, `Export`, `Import`.

### Detay
Soru, bağlam, yanıt, gerekçe ve kanıt; yaşam eylemleri. Kanıt satırı yerine `Evidence by Evidence Role` bölgesi çağrılır (→ `12.10 · Evidence by Evidence Role`). Açık Soru Kanıt Akışı göstermez (akış İş, Karar ve Varsayımdadır).
- **Label'lar:** `Question`, `Context`, `Answer`, `Rationale`, `Evidence by Evidence Role`, `No evidence linked.`, `Answered`, `No longer applicable`.

### Oluşturma formu
`Create` ile açılan form (kaynak çelişkisi: spec 41 bu yüzeyi `Discovery` altında anar; PRD 02/04 ve CONTEXT `Decisions` der, harita `Decisions`'ta bırakır).
- **Label'lar:** `Title`, `Question`, `Context`, `Save`, `Saving…`, `Cancel`.

### Durumlar
#### Empty
`No Open Questions yet.`
#### Loading
`Loading Open Questions…`, `Loading evidence…`
#### Error
`Open Questions are unavailable. Reload to retry.`; `Open Question is unavailable.`; `Evidence is unavailable. Reload to retry.`; `Open Questions could not be refreshed. Your draft is safe.`
#### Kapalı soru
`Answered` veya `No longer applicable`: soru, yanıt ve kanıt okunur; yeniden yanıtlama yok.

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md) (kanıt bölgesi).

## 12.9 · Answer Open Question
> Açık Soruya zorunlu yanıt, isteğe bağlı gerekçe ve kesin Belge kanıtıyla `Answered` geçişi yapmak.

**Artboard'lar**
- `12.9 · Answer Open Question · Default · 1440`

### Form
Zorunlu yanıt, isteğe bağlı gerekçe (label'ı `Rationale`) ve kanıt. Kanıt seçici `12.7 · Assumption Transition › Form` ile aynıdır (`Evidence (optional)`, `No new evidence` ve sabitleme cümlesi orada tanımlıdır).
- **Label'lar:** `Answer`, `Rationale`, `Save`, `Saving…`, `Cancel`.

### Durumlar
#### Error
Kaydetme hatası kalıbı → DS.16, tür adı `Open Question`; `Documents are unavailable. You can save without new evidence.`
#### Conflict
Çatışma kalıbı → `20.14 › Conflict` ve DS.16; tür adları `Open Question or evidence`.

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md).

## 12.10 · Evidence by Evidence Role
> Karar, Risk, Varsayım ve Açık Soru detayında açık kanıt bağlarını Kanıt Rolüne göre gruplamak ve bir bağın rolünü ve kurucu yorumunu düzenlemek.

**Artboard'lar**
- `12.10 · Evidence by Evidence Role · Default · 1440`
- `12.10 · Evidence by Evidence Role · Edit role · 1440`

### Rol grupları
Rol kataloğunun sahibi bu bölgedir (`11.13` ve `10.2` değerleri yeniden listelemez): `Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified` grupları; her sayı yalnız erişilebilir ilişki kümesini açar. Erişilemeyen kanıt rolü gizlenir (aşağıda `Rol gizlendi`).
- **Label'lar:** `Evidence by Evidence Role`, `Evidence Role`, `Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified`, `Unavailable source`, `Version-pinned evidence`, `Open source record`.

### Rol düzenleme
Kapalı rol seçimi, kaynak metinden ayrı kurucu yorumu, önceki değerlerin aktör ve zamanla geçmişi (küçük dialog).
- **Label'lar:** `Evidence Role`, `Founder interpretation`, `Save Evidence Role`, `Evidence Role history`, `Evidence Role could not be saved. Reload and try again.`

### Durumlar
#### Empty
Kanıt bağı yok: bölge yalnız `No evidence linked.` cümlesi ve bağlama eylemi (09.10, 12.6, 12.8 aynı cümleyi kullanır).
- **Label'lar:** `No evidence linked.`
#### Rol gizlendi
Kırık/erişilemeyen kaynak sunumu → `20.10 · Relation Picker & Used in · Broken targets` (yeniden tarif edilmez). Bu ekrana özgü: kalıcı silinmiş, redakte ve erişimsiz uçlarda `Open source record` gizlenir; rol ve yorum gösterilmez, sayıya karışmaz.
#### Error
Rol kaydı hatası, seçim korunur.

**Spec:** [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).
