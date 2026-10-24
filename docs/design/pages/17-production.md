# 17 · Production

Projenin `Production` alanı: Üretim Olayları.

| Ekran | Ne çizilir |
|---|---|
| [17.1 · Production Incidents](#171--production-incidents) | Durum gruplu olay listesi |
| [17.2 · Production Incident Detail](#172--production-incident-detail) | olay kaydı ve ilişkiler |
| [17.3 · Record Production Incident](#173--record-production-incident) | Kısa oluşturma dialog'u |

## 17.1 · Production Incidents
> Proje'nin Üretim Olaylarını durum ve zamanla listelemek.

**Artboard'lar**
- `17.1 · Production Incidents · Default · 1440`
- `17.1 · Production Incidents · Empty · 1440`

### Alan başlığı
Başlık eylem alanında `Export` (→ `20.5`) ve `Import` (→ `20.6`; Proje kapsamı önceden dolu).
- **Label'lar:** `Production`, `Production Incident`; `Record Production Incident`; `Export`, `Import` (→ `20.5`, `20.6`).

### Olay listesi
Tek liste; `Open` ve `Watching` üstte, `Resolved` altta ayrı grup. Satır metası → DS.17. Bu ekrana özgü ek: `Occurred at`, etki özeti, ilişki sayısı.
- **Label'lar:** `Open`, `Watching`, `Resolved`, `Occurred at`, `Impact`.

### Durumlar
#### Empty
Tek cümle: kayıt bir Bug değildir, olay sonrası öğrenim içindir; otomatik oluşmaz. + oluşturma eylemi.
#### Loading
Liste yükleniyor satırı (erişilebilir yüklenme durumu; spec bu ekran için ayrı label vermez).
#### Error
Liste okunamadı + `Retry` (→ `20.15`).
#### Archived project
Ferry: salt okunur.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

## 17.2 · Production Incident Detail
> Tek Üretim Olayının zaman çizgisini, öğrenimini ve kaynak bağlarını tutmak; takip İşini önizlemeyle açmak.

**Artboard'lar**
- `17.2 · Production Incident Detail · Default · 1440`
- `17.2 · Production Incident Detail · Open · 1440`

### Kayıt başlığı
Kayıt türü, başlık, durum.
- **Label'lar:** `Production Incident`, `Open`, `Watching`, `Resolved`, `Remind me`.

### Olay alanları
Sol geniş sütun, anlatı sırasıyla: zaman, etki, tespit biçimi, çözüm, kök neden, öğrenim; her biri düzenlenebilir metin.
- **Label'lar:** `Occurred at`, `Impact`, `Detected how`, `Resolution`, `Root cause`, `Learning`.

### Özel alanlar
Üretim Olayına bağlı Proje özel alanları; satır ve boş değer kuralı → DS.12.

### İlişkiler
Sağ dar sütun; türlere göre gruplu bağlar: Bug, GitHub PR, Proje Sürümü, Risk, Karar.
- **Label'lar:** `Related records`; tür adları `Bug`, `Pull request`, `Project Release`, `Risk`, `Decision`.

### Takip
Sağ sütunda takip eylemi; önizleme ve onay `20.22 · Create Follow-up Work` (Üretim Olayı kaynağı) ile yapılır, burada yeniden tarif edilmez.
- **Label'lar:** `Create follow-up work`.

### Durumlar
#### Default
`Watching`.
#### Open
Alanların çoğu boş; boşluklar `—`, eksiklik uyarısı yok.
#### Resolved
Çözüm ve öğrenim dolu; kayıt düzenlenebilir kalır.
#### Loading
Kayıt yükleniyor (erişilebilir yüklenme durumu; spec bu ekran için ayrı label vermez).
#### Error
Kayıt bulunamadı veya bu Projeye ait değil → `20.19 · Not Found`.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

## 17.3 · Record Production Incident
> Yeni Üretim Olayını en az başlık ve zamanla açmak.

**Artboard'lar**
- `17.3 · Record Production Incident · Default · 1440`
- —

### Alanlar
Orta boy dialog; kısa form, durum varsayılanı `Open`.
- **Label'lar:** `Title`; `Occurred at`, `Impact`, `Detected how`; durum varsayılanı `Open`.

### Özel alanlar
Üretim Olayına bağlı Proje özel alanları, formun altında; satır ve boş değer kuralı → DS.12.

### Durumlar
#### Default
Boş form, odak başlıkta.
#### Validation error
Başlık veya zaman eksik; alan yanında hata.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

