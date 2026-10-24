# 16 · Releases

Projenin `Releases` alanı: Proje Sürümü planlama, kanıt, notlar ve sonuç.

| Ekran | Ne çizilir |
|---|---|
| [16.1 · Project Releases](#161--project-releases) | durum gruplu sürüm listesi |
| [16.2 · Project Release Detail](#162--project-release-detail) | planlama: kapsam, hipotez, GitHub |
| [16.3 · Create Project Release](#163--create-project-release) | oluşturma dialog'u |
| [16.4 · Change Release Status](#164--change-release-status) | terminal durum onayı |
| [16.5 · Release Evidence Pack](#165--release-evidence-pack) | kaynağa açılan kanıt bölümleri |
| [16.6 · Release Notes](#166--release-notes) | Markdown not editörü + iz |
| [16.7 · Release Publish Preview](#167--release-publish-preview) | tek tek onaylı yayın önizlemesi |
| [16.8 · Changelog](#168--changelog) | kurucu changelog okuma yüzeyi |
| [16.9 · Reassess Impact](#169--reassess-impact) | Access / Outcome gözlem turu |

## 16.1 · Project Releases
> Proje'nin Proje Sürümlerini durum ve kapsam özetiyle taranabilir biçimde listelemek.

**Artboard'lar**
- `16.1 · Project Releases · Default · 1440`
- `16.1 · Project Releases · Empty · 1440`

### Alan başlığı
Başlık eylem alanında `Export` (→ `20.5`) ve `Import` (→ `20.6`; Proje kapsamı önceden dolu).
- **Label'lar:** `Releases`, `Changelog`; `Create Project Release`; `Export`, `Import` (→ `20.5`, `20.6`).

### Sürüm listesi
Durum gruplarıyla liste; satır metası → DS.17. Bu ekrana özgü ek: kapsam sayısı (tamamlanan/açık İş) ve bağlı GitHub Release/tag.
- **Label'lar:** `Project Release`, `Version label`, `Draft`, `Preparing`, `Published`, `Cancelled`; `Scope`.

### Durumlar
#### Empty
Tek cümle: Proje Sürümü yayımlanacak kapsamdır; Kilometre Taşı veya Odak Dönemi değildir. + `Create Project Release`.
#### Loading
Liste yükleniyor satırı (erişilebilir yüklenme durumu; spec bu ekran için ayrı label vermez).
#### Error
Liste okunamadı + `Retry` (→ `20.15`).
#### Archived project
Ferry: salt okunur liste, oluşturma yok.

**Spec:** [63 Proje Sürümü Planlama](../../specs/63-release-planning/spec.md), [65](../../specs/65-release-communication/spec.md)

## 16.2 · Project Release Detail
> Tek Proje Sürümünün planlamasını yönetmek: kapsam, GitHub bağları, hipotez ve durum; kanıt paketi, notlar ve yeniden değerlendirmeye geçiş.

**Artboard'lar**
- `16.2 · Project Release Detail · Default · 1440`
- `16.2 · Project Release Detail · Default · 768`
- `16.2 · Project Release Detail · GitHub Release suggestion · 1440`
- `16.2 · Project Release Detail · Published · 1440`

### Kayıt başlığı
Kayıt türü, ad, `Version label`, durum; kayıt eylemleri.
- **Label'lar:** `Project Release`, `Version label`, `Description`, `Remind me`.

### Alt görünüm gezinmesi
Planlama, kanıt paketi, notlar ve yeniden değerlendirme sekmeleri.
- **Label'lar:** `Planning`; `Release Evidence Pack`, `Release notes`, `Reassess impact` (yalnız `Published` sonrası etkin).

### Kapsam
Yayımlanacak İşler: tamamlanan ve açık olarak iki grup; ekleme/çıkarma.
- **Label'lar:** `Scope`, `Add Work to scope`, `Remove from scope`.

### Erişim ve sonuç hipotezi
İsteğe bağlı, beş ayrı alan: hedef kitle (serbest metin + Persona/Contact/Company ilişkileri), tek birincil erişim yolu, erişim kanıtı, hedeflenen davranış/sonuç, sonuç kanıtı. Kapı olmadığı tek cümleyle belirtilir.
- **Label'lar:** `Audience`, `Primary access path`, `Access evidence`, `Intended outcome`, `Outcome evidence`.

### Özel alanlar
Proje Sürümüne bağlı Proje özel alanları; satır ve boş değer kuralı → DS.12.

### Yan sütun: durum ve GitHub
Mevcut durum ve serbest geçiş; GitHub Release'den öneri; bağlı tag/GitHub Release/ortam bağları (birden çok repository olabilir); `Test Summary` girişi.
- **Label'lar:** `Draft`, `Preparing`, `Published`, `Cancelled`; GitHub dış kayıtları `Tag`, `Release`; `Environment link`; `Test Summary: tidekit 1.0` (bu giriş `15.22 · Test Summary · Project Release` ekranını açar; özet `Release Evidence Pack` yerine geçmez).

### Durumlar
#### Default
`Preparing`, Planning görünümü.
#### GitHub Release suggestion
Bağlı GitHub Release `v1.0.0` yayımlandı: yan sütunda öneri satırı "GitHub Release v1.0.0 was published. Mark this Project Release Published?" — yazmaz, yalnız 16.4'ü açar.
#### Published
`tidekit 0.9`: terminal; durum düzenlenemez; `Reassess impact` etkin.
#### Cancelled
Terminal, salt okunur kapsam.
#### Loading
Kayıt yükleniyor (erişilebilir yüklenme durumu; spec bu ekran için ayrı label vermez).
#### Error
Kayıt bulunamadı veya bu Projeye ait değil → `20.19 · Not Found`.
#### Empty hypothesis
Hipotez alanları boş: tek satır "Optional" açıklaması; uyarı yok.

**Spec:** [63 Proje Sürümü Planlama](../../specs/63-release-planning/spec.md), [64](../../specs/64-release-evidence/spec.md), [65](../../specs/65-release-communication/spec.md), [57](../../specs/57-test-review-and-follow-up/spec.md)

## 16.3 · Create Project Release
> Tek bir Projeye ait yeni Proje Sürümü açmak.

**Artboard'lar**
- `16.3 · Create Project Release · Default · 1440`
- —

### Alanlar
Ad, sürüm etiketi ve açıklama; başlangıç durumu `Draft`, tarih alanı yok.
- **Label'lar:** `Name`; `Version label`, `Description`, `Create Project Release`. Başlangıç durumu `Draft`. Tarih alanı yok.

### Özel alanlar
Proje Sürümüne bağlı Proje özel alanları, formun altında; satır ve boş değer kuralı → DS.12.

### Durumlar
#### Default
`tidekit 1.1` · `v1.1.0` dolu form.
#### Validation error
Ad boş.

**Spec:** [63 Proje Sürümü Planlama](../../specs/63-release-planning/spec.md)

## 16.4 · Change Release Status
> `Draft` ↔ `Preparing` serbest geçişini ve `Published` / `Cancelled` terminal geçişlerini yalnız açık kurucu eylemiyle yapmak.

**Artboard'lar**
- `16.4 · Change Release Status · Publish with open scope · 1440`
- —

### Geçiş
Hedef durum; terminal geçişte geri alınamazlık cümlesi; kapsamda açık İş varsa bilgi satırı (engellemez).
- **Label'lar:** `Draft`, `Preparing`, `Published`, `Cancelled`; `Mark Published`, `Mark Cancelled`.

### Durumlar
#### Free transition
`Draft` → `Preparing`: onay dialog'u gerekmez, yerinde değişir.
#### Publish with open scope
Bilgi satırıyla `Published` onayı.
#### Cancel
`Cancelled` onayı.

**Spec:** [63 Proje Sürümü Planlama](../../specs/63-release-planning/spec.md), [64](../../specs/64-release-evidence/spec.md)

## 16.5 · Release Evidence Pack
> Proje Sürümünün kapsam, PR/check, Karar, Risk, test, Test Açığı, kontrol listesi ve yayın farkını kaynaklarına açılan tek değerlendirme yüzeyinde göstermek.

**Artboard'lar**
- `16.5 · Release Evidence Pack · Default · 1440`
- `16.5 · Release Evidence Pack · Missing sources · 1440`

### Paket başlığı
Başlık ve sabit not: pakette düzenleme yok, düzeltme kaynak kayıtta yapılır; skor veya yayın kapısı yok. Her bölümün her satırı (yalnız Attention değil) `Open source record` ile kaynağına açılır ve gösterilme nedenini taşır: kapsam, PR, Karar/Risk, test ve kontrol listesi satırlarında da (örnek `Shown because: in scope`, `Shown because: linked from LUMA-51`); Attention satırlarındaki neden aynen kalır.
- **Label'lar:** `Release Evidence Pack`, `Open source record`, `Shown because: {reason}`.

### Attention
Eksik veya olumsuz bağlam satırları, her biri neden + kaynak.

### Kapsam
Kapsamdaki İşler ve her biri için `Expected Outcome`.

### Pull request'ler ve check'ler
Sürüm kapsamındaki PR satırları ve check durumları; her satır kaynağa açılır. Rol (`Required for completion` / `Contextual`), check (`Required` / `Unknown`) ve İş–PR tutarsızlığı satırının sunumu `18.7 · Pull Request · PR Context Card`'dadır, burada yeniden tarif edilmez.
- **Label'lar:** → `18.7`; `Open source record`.

### Kararlar ve Riskler
İlgili Karar ve Risk satırları.

### Testler
Nötr test özeti, bölüm içeriği ve sayılı satırlar → `15.22 · Test Summary · Project Release` (burada yeniden tarif edilmez). GitHub check'leri sayılmaz; GitHub check'leri burada değil, PR bölümünde.

### Kontrol listesi
Kurucunun yönettiği isteğe bağlı yayın kontrol listesi; işaretlemek yayını engellemez/açmaz.
- **Label'lar:** `Checklist`, `Add item`.

### Yayın farkı
Hazırlanan changelog ile mevcut onaylı dış snapshot arasındaki farka geçiş satırı.

### Durumlar
#### Default
Bütün bölümler tidekit 1.0 verisiyle; üstte beş attention satırı.
#### Missing sources
Kapsam boş, gerekli PR yok, beklenen sonuç yok: her biri görünür attention satırı; bölüm sessizce gizlenmez.
#### Published
Pakete hâlâ erişilir; `published-release-open-scope` kaynağı olarak açık İşler satırı.
#### Loading / Error
Bölüm bazında yükleniyor / okunamadı satırı; diğer bölümler çalışır.

**Spec:** [64 Sürüm Kanıt Paketi](../../specs/64-release-evidence/spec.md), [57](../../specs/57-test-review-and-follow-up/spec.md), [56](../../specs/56-test-assessments/spec.md), [55](../../specs/55-test-gaps/spec.md), [61](../../specs/61-github-integration/spec.md)

## 16.6 · Release Notes
> Proje Sürümü kapsamındaki İşlere bağlı sürüm notunu Markdown ile hazırlamak ve isteğe bağlı `Why was this done?` kaynak izi eklemek.

**Artboard'lar**
- `16.6 · Release Notes · Draft · 1440`
- `16.6 · Release Notes · Draft · 768`
- —

### Not editörü
Taslak not metni; mevcut Markdown ve görsel ek; genel etiketler (changelog'a özgü ikinci etiket yok).
- **Label'lar:** `Release notes`; etiket seçici → `20.11`.

### Kapsam bağları
Notun dayandığı kapsam İşleri; bağlanmamış paragraf uyarısı değil, kapsam listesi.

### Yayın önizlemesine geçiş
Not hazır olunca `16.7`'yi açan eylem; açılana kadar hiçbir şey yayımlanmaz.
- **Label'lar:** `Preview publish`.

### Why was this done?
Tek tek seçilen kayıtlar (İş, Geri Bildirim, Karar, Kaynak, Belge, Tasarım, Deney/doğrulama). Her kaydın herkese açık alan snapshot'ının ayrı onayı `16.7`'dedir, burada yinelenmez.
- **Label'lar:** `Why was this done?`

### Durumlar
#### Draft
Özel; görünürlük notu "Private until you publish".
#### Published entry
Yayımlanmış not salt okunur; yeni değişiklik yeni yayın önizlemesi ister.
#### No scope
Kapsamda İş yoksa not bağlanamaz; nedeni açıklanır.
#### Offline
→ `20.16 · Offline`.

**Spec:** [65 Sürüm İletişimi ve Sonuç Öğrenimi](../../specs/65-release-communication/spec.md)

## 16.7 · Release Publish Preview
> Sürüm notu/changelog yayımlanmadan önce iç durumları, önerilen herkese açık etiketleri, changelog bağlantılarını, `Why was this done?` snapshot'larını ve Build in Public olaylarını tek yerde gösterip tek tek onaylatmak.

**Artboard'lar**
- `16.7 · Release Publish Preview · Default · 1440`
- `16.7 · Release Publish Preview · Blocking finding · 1440`

### İç durumlar
Kapsamdaki İşlerin mevcut iç durumları (değişmeyeceği belirtilir).

### Önerilen herkese açık değişiklikler
Önerilen herkese açık etiket, changelog bağlantısı, `Why was this done?` alan snapshot'ları, gelişim akışına girecek olaylar; her biri ayrı onay.

### Güvenlik denetimleri
Yer tutucu, hassas veri, kapalı dünya kapsamı ve dolaylı sızıntı bulguları → ortak closed-world önizleme → `20.4 · Share`.

### Eylemler
Onay kutuları işaretli satırları yayımlayan eylem ve vazgeç. Her önerinin kendi onay kutusu, üstte `<n> of <m> approved` özeti. Yayın İş durumunu ve Proje Sürümü durumunu yazmaz; satırda tek cümle: `Publishing does not change Work status or the Project Release status.`
- **Label'lar:** `Publish Release notes`, `Cancel`, `Approve {item}`, `{n} of {m} approved`.

### Durumlar
#### Default
Bütün öneriler onay kutularıyla listelenmiş.
#### Blocking finding
Çözülmemiş yer tutucu: yayın pasif; çöz veya onayla seçeneği. Liste ve onay çizimi `20.4 · Yer tutucu kontrolü` ile aynıdır, yeniden çizilmez.
#### Partially approved
Onaylanmayan öneriler özel ve değişmemiş kalır, özet satırında sayılır.

**Spec:** [65 Sürüm İletişimi ve Sonuç Öğrenimi](../../specs/65-release-communication/spec.md), [64](../../specs/64-release-evidence/spec.md)

## 16.8 · Changelog
> Proje Sürümleri boyunca yayımlanmış sürüm notlarını sürekli changelog olarak kurucuya göstermek ve yayın durumunu açıklamak.

**Artboard'lar**
- `16.8 · Changelog · Default · 1440`
- `16.8 · Changelog · Empty · 1440`

### Girdi listesi
Yeni→eski girdiler; her girdi: Proje Sürümü adı/etiketi, yayın zamanı, not metni, `Why was this done?` izi (yalnız onaylı snapshot'lar), etiketler; taslak notlar ayrı ve özel işaretli.
- **Label'lar:** `Changelog`, `Release notes`, `Why was this done?`.

### Durumlar
#### Empty
Henüz yayımlanmış not yok; özel taslaklar ziyaretçiye görünmez notu.
#### Filtered
Genel etiketle süzülmüş liste.

**Spec:** [65 Sürüm İletişimi ve Sonuç Öğrenimi](../../specs/65-release-communication/spec.md)

## 16.9 · Reassess Impact
> Yayımlanmış Proje Sürümü için Proje Hedefi, hipotez, beklenen/gözlenen sonuç ve önceki gözlemleri yan yana göstermek; tarihli turda `Access observation` ve `Outcome observation`'ı ayrı kaydetmek.

**Artboard'lar**
- `16.9 · Reassess Impact · Round in progress · 1440`
- `16.9 · Reassess Impact · Round in progress · 768`
- `16.9 · Reassess Impact · Two rounds · 1440`
- `16.9 · Reassess Impact · Not started · 1440`

### Bağlam şeridi
Bağlı Proje Hedefi; Sürümün erişim ve sonuç hipotezi; kapsamdaki Özellik/İşlerin `Expected Outcome` ve `Observed outcome / learning`; önceki tarihli gözlemler. Her biri kaynağına açılır.
- **Label'lar:** `Intended outcome`, `Expected Outcome`, `Observed outcome / learning`, `Open source record`.

### Tur formu
İki bağımsız gözlem; her biri değerlendirme, serbest metin, gözlem zamanı, yazar, yalnız o gözleme ait kanıt bağları (Kaynak, Geri Bildirim, Deney/doğrulama, Dosya Eki).
- **Label'lar:** `Reassess impact`, `Access observation`, `Outcome observation`, `Observed`, `Partially observed`, `Not observed`, `Could not learn`, `Close assessment`.

### Tur geçmişi
Tarihli turlar yeni→eski; düzeltmeler yazar, zaman, önceki değerle.

### Durumlar
#### Not started
Yayımlandı, tur yok: tek cümle + tur başlat; atlanabilir olduğu belirtilir.
#### Round in progress
Bir alan değerlendirildi, diğeri boş: `Notification Center`'da tek `release-observation-missing` (→ `00.5`).
#### Round complete
İki alan değerlendirilmiş (`Could not learn` dahil).
#### Two rounds
Çelişen iki tur yan yana; birleşik başarı hükmü yok.
#### Not published
`Draft`/`Preparing` Sürümde görünüm pasif, nedeni açıklanır.

**Spec:** [65 Sürüm İletişimi ve Sonuç Öğrenimi](../../specs/65-release-communication/spec.md), [63](../../specs/63-release-planning/spec.md)
