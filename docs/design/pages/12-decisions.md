# 12 · Decisions

Projenin `Decisions` alanı: Kararlar, Riskler, Varsayımlar, Açık Sorular ve doğrulama kayıtları.

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
- **Label'lar:** `Decisions`, `Risks`, `Assumptions`, `Open Questions`.

### Karar listesi
Bütün yaşamlar tarihsel gezinme için listelenir; satırda başlık ve yaşam.
- **Label'lar:** `Decisions`, `Create`, `Valid`, `Superseded`, `Withdrawn`.

### Başlık bölgesi
Başlık, yaşam, Karar tarihi; eylemler.
- **Label'lar:** `Decision`, `Edit`, `Withdraw`, `Supersede another decision`, `Remove supersession`.

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
`Create`/`Edit`: `Title`, `Decision text`, `Rationale`, `Save`, `Saving…`, `Cancel`. Hata `Decision could not be saved. Retry, or reload to check for changes. Your text is kept here.`; çatışma `Decision changed. Cancel and reopen before saving again. Your text is kept here.`; başarı `Decision saved.`
#### Superseded Karar
Başlıkta doğrudan halef ve son `Valid` Karar, geçiş zamanı ve gerekçesi, `Open current decision`; özgün içerik, kanıt rolleri, ilişkiler ve geçmiş okunur, içerik düzenlenemez.
#### Withdrawn Karar
`Withdrawn` · geri çekme tarihi ve isteğe bağlı gerekçe özgün gerekçeden ayrı; başarı `Decision withdrawn.`
#### Arşivli Proje
Ferry: okunur, yazma eylemi yok.

**Spec:** [38 Kararlar](../../specs/38-decisions/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md) (kanıt bölgeleri).

## 12.2 · Supersede another decision
> Bir veya birkaç eski Kararı yeni geçerli Kararla tam olarak değiştirmeyi önizleyip tek atomik işlemle uygulamak; ya da bir yerine geçme ilişkisini önizlemeyle kaldırmak.

**Artboard'lar**
- `12.2 · Supersede another decision · Preview · 1440`
- `12.2 · Supersede another decision · Remove · 1440`
- `12.2 · Supersede another decision · Stale preview · 1440`

### Seçim
Yeni Karar için yerine geçilecek Kararların seçimi ve isteğe bağlı geçiş gerekçesi.
- **Label'lar:** `Supersession`, `Supersede another decision`, `Decisions to supersede`, `Transition rationale (optional)`, `Preview`, `Cancel`, `Loading…`

### Supersession preview
Her iki tarafın hüküm metni, gerekçesi ve mevcut kanıtı; değişecek yaşamlar; ilişkili kayıtların taşınmadığı açıklaması.
- **Label'lar:** `Supersession preview`, `Supersedes`, `Evidence`, `Valid → Superseded`, `Confirm supersession`, `Saving…`, `Only full replacement uses Supersedes. Related records and their status, …`

### Remove supersession
Aynı önizleme `Superseded → Valid` yönünde; halef ve diğer zincir bağları korunur.
- **Label'lar:** `Remove supersession`, `Superseded → Valid`, `Confirm removal`.

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
Riskler başlık ve yaşamla.
- **Label'lar:** `Risks`, `Create`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`.

### Risk detayı
Başlık, açıklama, etki, olasılık, yanıt, yaşam ve gerekçe.
- **Label'lar:** `Risk`, `Title`, `Description`, `Impact`, `Probability`, `Response/mitigation`, `Status`, `Rationale`, `Edit`.

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
`Title`, `Description`, `Impact`, `Probability`, `Response/mitigation`, `Save`, `Saving…`, `Cancel`; `Check the form.`; `Risk could not be saved. Retry, or reload to check for changes. Your text is kept here.`; çatışma `Risk changed. Cancel and reopen before saving again. Your text is kept here.`; `Risk saved.`
#### Accepted
Başlık altında `A known Risk remains recorded when accepted.` ve kabul gerekçesi.
#### Arşivli Proje
Okunur; yazma yok.

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
Varsayımlar başlık ve yaşamla.
- **Label'lar:** `Assumption`, `Create`, `Open`, `Confirmed`, `Refuted`, `No longer applicable`.

### Detay
Önerme, gerekçe, kanıt (kesin sürüm ve alıntı) veya kanıt yok satırı; yaşam butonları.
- **Label'lar:** `Statement`, `Rationale`, `Evidence`, `Version`, `No evidence linked.`, `Edit`.

### Durumlar
#### Empty
`No Assumptions yet.`
#### Loading
`Loading Assumptions…`; `Loading Documents…`
#### Error
`Assumptions are unavailable.` ve `Retry`; `Assumption is unavailable.`
#### Form
`Title`, `Statement`, `Rationale`, `Save`, `Saving…`, `Cancel`; `Assumption could not be saved. Retry, or reload to check for changes. Your text is kept here.`; `Assumption saved.`
#### Kanıtsız sonuç
`Confirmed` ama kanıt yok: `No evidence linked.` gerekçe olsa bile görünür.
#### Arşivli Proje
Kayıtlar ve kanıtlar okunur.

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
`Assumption or Evidence changed. Cancel and reopen before saving again. Your text is kept here.`

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md).

## 12.8 · Open Questions
> Yanıt bekleyen soruları bağlamıyla tutmak; yanıtı, gerekçeyi ve kanıtı tarihsel korumak.

**Artboard'lar**
- `12.8 · Open Questions · Default · 1440`
- `12.8 · Open Questions · Answered · 1440`
- `12.8 · Open Questions · Empty · 1440`

### Liste
Açık Sorular başlık ve yaşamla.
- **Label'lar:** `Open Question`, `Create`, `Open`, `Answered`, `No longer applicable`.

### Detay
Soru, bağlam, yanıt, gerekçe ve kanıt; yaşam eylemleri.
- **Label'lar:** `Question`, `Context`, `Answer`, `Rationale`, `Evidence`, `No evidence linked.`, `Answered`, `No longer applicable`.

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
Yanıt, isteğe bağlı gerekçe ve kanıt.
- **Label'lar:** `Answer`, `Rationale (optional)`, `Evidence (optional)`, `No new evidence`, `The selected Document text is pinned to this exact …`, `Save`, `Saving…`, `Cancel`.

### Durumlar
#### Error
`Open Question could not be saved. Retry, or reload to check for changes. Your text is kept here.`; `Documents are unavailable. You can save without new evidence.`
#### Conflict
`Open Question or evidence changed. Cancel and reopen before saving. Your text is kept here.`

**Spec:** [41 Varsayımlar ve Açık Sorular](../../specs/41-uncertainty-records/spec.md).

## 12.10 · Evidence by Evidence Role
> Karar, Risk, Varsayım ve Açık Soru detayında açık kanıt bağlarını Kanıt Rolüne göre gruplamak ve bir bağın rolünü ve kurucu yorumunu düzenlemek.

**Artboard'lar**
- `12.10 · Evidence by Evidence Role · Default · 1440`
- `12.10 · Evidence by Evidence Role · Edit role · 1440`

### Rol grupları
`Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified` grupları; her sayı yalnız erişilebilir ilişki kümesini açar. Erişilemeyen kanıt rolü gizlenir.
- **Label'lar:** `Evidence by Evidence Role`, `Evidence Role`, `Supporting`, `Contradicting`, `Provides context`, `Inconclusive`, `Unspecified`, `Unavailable source`, `Version-pinned evidence`, `Open source record`.

### Rol düzenleme
Kapalı rol seçimi, kaynak metinden ayrı kurucu yorumu, önceki değerlerin aktör ve zamanla geçmişi (küçük dialog).
- **Label'lar:** `Evidence Role`, `Founder interpretation`, `Save Evidence Role`, `Evidence Role history`, `Evidence Role could not be saved. Reload and try again.`

### Durumlar
#### Empty
Kanıt bağı yok: bölge yalnız kısa dürüst cümle ve bağlama eylemi.
#### Rol gizlendi
Erişilemeyen veya silinmiş kaynak: satır güvenli neden, rol ve yorum gösterilmez, sayıya karışmaz.
#### Error
Rol kaydı hatası, seçim korunur.

**Spec:** [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md).
