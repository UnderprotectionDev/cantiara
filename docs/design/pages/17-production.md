# 17 · Production

Projenin `Production` alanı: Üretim Olayları.

| Ekran | Ne çizilir |
|---|---|
| [17.1 · Production Incidents](#171--production-incidents) | durum gruplu olay listesi |
| [17.2 · Production Incident Detail](#172--production-incident-detail) | olay kaydı ve ilişkiler |
| [17.3 · Record Production Incident](#173--record-production-incident) | kısa oluşturma dialog'u |

## 17.1 · Production Incidents
> Proje'nin Üretim Olaylarını durum ve zamanla listelemek.

**Artboard'lar**
- `17.1 · Production Incidents · Default · 1440`

### Alan başlığı
Başlık iskeleti → DS.10 (Area). Başlık eylem alanında `Export` (→ `20.5`) ve `Import` (→ `20.6`; Proje kapsamı önceden dolu).
- **Label'lar:** `Production`, `Production Incident`; `Record Production Incident`; `Export`, `Import` (→ `20.5`, `20.6`).

### Olay listesi
Tek liste; `Open` ve `Watching` bir grupta, `Resolved` ayrı grupta. Satır metası → DS.17. Bu ekrana özgü ek: `Occurred at`, etki özeti, ilişki sayısı. TTD/TTI/TTR, kesinti süresi, güvenilirlik grafiği veya trend yoktur (spec 66 #11).
- **Label'lar:** `Open`, `Watching`, `Resolved`, `Occurred at`, `Impact`.

### Durumlar
#### Empty
Tek cümle: kayıt bir Bug değildir, olay sonrası öğrenim içindir; alarm veya Sentry olayından otomatik oluşmaz. + `Record Production Incident`.
- **Label'lar:** `No Production Incidents yet. An incident is a learning record, not a Bug, and is never created from an alert or Sentry event.`, `Record Production Incident`.
#### Loading
`Loading Production Incidents…`
#### Error
`Production Incidents are unavailable.` + `Retry` (→ `20.15`).
#### Archived project
Ferry: salt okunur, oluşturma yok; bant → `20.21`.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

## 17.2 · Production Incident Detail
> Tek Üretim Olayının zaman çizgisini, öğrenimini ve kaynak bağlarını tutmak; takip İşini önizlemeyle açmak.

**Artboard'lar**
- `17.2 · Production Incident Detail · Default · 1440`
- `17.2 · Production Incident Detail · Open · 1440`

### Kayıt başlığı
Kayıt türü, başlık, durum; kayıt eylemleri → DS.11 (`Remind me` → `20.9`). Durum değişikliği kimseyi çağırmaz (pager/nöbet yok).
- **Label'lar:** `Production Incident`, `Open`, `Watching`, `Resolved`, `Remind me`.

### Olay alanları
Zaman, etki, tespit biçimi, çözüm, kök neden, öğrenim; her biri düzenlenebilir metin.
- **Label'lar:** `Occurred at`, `Impact`, `Detected how`, `Resolution`, `Root cause`, `Learning`.

### Özel alanlar
Üretim Olayına bağlı Proje özel alanları; satır ve boş değer kuralı → DS.12.

### Bağlı kayıtlar
Aynı Projenin Bug, GitHub PR, Proje Sürümü, Risk ve Kararına türlere göre gruplu bağlar. Seçim → `20.10 · Relation Picker & Used in`. Bağlamak veya bağı kaldırmak bağlanan kaydın durumunu yazmaz; olay otomatik Bug veya Risk üretmez.
- **Label'lar:** `Linked records`, `Link record`, `Remove link` (PRD 02 › Üretim Olayı bağları); grup başlıkları `Bug`, `GitHub PR`, `Project Release`, `Risk`, `Decision`. PR satırı GitHub dış kaydıdır (→ `18.7`).

### Takip İşi
Takip eylemi ve bu olaydan doğmuş takip İşlerinin listesi. Önizleme, onay ve `Preview changed` durumu `20.22 · Create Follow-up Work` (Üretim Olayı kaynağı) ile yapılır, burada yeniden tarif edilmez. Takip İşi olayın durumunu değiştirmez.
- **Label'lar:** `Follow-up work`, `Create follow-up work` (önizleme → `20.22`).

### Durumlar
#### Default
`Watching`.
#### Open
Alanların çoğu boş; boşluklar `—`, eksiklik uyarısı yok.
#### Resolved
Çözüm ve öğrenim dolu; kayıt düzenlenebilir kalır.
#### Loading
`Loading Production Incident…`
#### Error
Kayıt bulunamadı veya bu Projeye ait değil → `20.19 · Not Found`.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

## 17.3 · Record Production Incident
> Yeni Üretim Olayını en az başlık ve zamanla açmak.

**Artboard'lar**
- `17.3 · Record Production Incident · Default · 1440`

### Alanlar
Kısa form; durum varsayılanı `Open`. Bug, Risk veya İş olmadan da oluşturulur.
- **Label'lar:** `Record Production Incident` (dialog başlığı ve onay eylemi), `Title`, `Occurred at`, `Impact`, `Detected how`, `Cancel`.

### Özel alanlar
Üretim Olayına bağlı Proje özel alanları, formun altında; satır ve boş değer kuralı → DS.12.

### Durumlar
#### Default
Boş form, odak başlıkta.
#### Validation error
Başlık veya zaman eksik; alan yanında hata.
- **Label'lar:** `Enter a title and when the incident began.`

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

