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
- **Label'lar:** `Production`, `Production Incident`; `Record Production Incident`.

### Olay listesi
Tek liste; `Open` ve `Watching` üstte, `Resolved` altta ayrı grup. Her satır: başlık, durum, `Occurred at`, etki özeti, ilişki sayısı.
- **Label'lar:** `Open`, `Watching`, `Resolved`, `Occurred at`, `Impact`.

### Durumlar
#### Empty
Tek cümle: kayıt bir Bug değildir, olay sonrası öğrenim içindir; otomatik oluşmaz. + oluşturma eylemi.
#### Loading
`Loading source record…` deseni.
#### Error
Liste okunamadı + `Retry`.
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

### İlişkiler
Sağ dar sütun; türlere göre gruplu bağlar: Bug, GitHub PR, Proje Sürümü, Risk, Karar.
- **Label'lar:** `Related records`; tür adları `Bug`, `Pull request`, `Project Release`, `Risk`, `Decision`.

### Takip
Sağ sütunda takip eylemi.
- **Label'lar:** `Create follow-up work`.

### Durumlar
#### Default
`Watching`.
#### Open
Alanların çoğu boş; boşluklar `—`, eksiklik uyarısı yok.
#### Resolved
Çözüm ve öğrenim dolu; kayıt düzenlenebilir kalır.
#### Loading
`Loading source record…`
#### Error
`Source record is unavailable.`

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

## 17.3 · Record Production Incident
> Yeni Üretim Olayını en az başlık ve zamanla açmak.

**Artboard'lar**
- `17.3 · Record Production Incident · Default · 1440`
- —

### Alanlar
Orta boy dialog; kısa form, durum varsayılanı `Open`.
- **Label'lar:** `Title`; `Occurred at`, `Impact`, `Detected how`; durum varsayılanı `Open`.

### Durumlar
#### Default
Boş form, odak başlıkta.
#### Validation error
Başlık veya zaman eksik; alan yanında hata.

**Spec:** [66 Üretim Olayı Öğrenimi](../../specs/66-production-incidents/spec.md)

