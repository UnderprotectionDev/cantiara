# 07 · Product Gaps

Başka araçta bitirilen işlerin kaydı: Ürün Boşlukları.

| Ekran | Ne çizilir |
|---|---|
| [07.1 · Product Gaps](#071--product-gaps) | Süzgeçli boşluk listesi ve olay kümeleri |
| [07.2 · Record Product Gap](#072--record-product-gap) | Boşluk ve Dış Araca Kaçış kayıt dialog'u |
| [07.3 · Close Tool Escape](#073--close-tool-escape) | Kanıtlı kapanış formu |

## 07.1 · Product Gaps
> Ürün Boşluklarını dogfooding süzgeçleriyle taramak; her boşluğun karşılanmayan ihtiyacını, durumunu ve kayıtlı kaçışlarını görmek.

**Artboard'lar**
- `07.1 · Product Gaps · Default · 1440`
- `07.1 · Product Gaps · Tool Escapes open · 1440`
- `07.1 · Product Gaps · Filtered · 1440`
- `07.1 · Product Gaps · Empty · 1440`

### Başlık
Sayfa başlığı, kayıt eylemi ve liste eylemleri: `Export` → `20.5 · Export`, `Import` → `20.6 · Import`.
- **Label'lar:** `Product Gaps`, `Record Product Gap`, `Export`, `Import`.

### Dogfooding süzgeçleri
Dört seçici; yalnız seçer, sıralamaz.
- **Label'lar:** `Filter Product Gaps`, `Filter by external tool`, `Any tool`, `Filter by reason`, `Any reason`, `Filter by Project`, `Any Project`, `Filter by status`, `Any status`.

### Boşluk bloğu
Tek kolon listede her boşluk bir blok: başlık; karşılanmayan ihtiyaç; varsa kapsam; ilgili kayıtlar; kaçış sayısı düğmesi; durum seçici; takip eylemi (`Create follow-up work` önizleme ve onayı → `20.22 · Create Follow-up Work` › Ürün Boşluğu); paylaşma eylemi `Share` → `20.4 · Share` (kapalı dünya kapsam önizlemesi ve `Approved snapshot`; Ürün Boşluğu `20.4` kök kayıt türleri arasındadır). Dış Araca Kaçış olayları ve dış araç / neden alanları önizlemede ayrı satırdır: `Tool Escapes are listed separately; nothing is shared until you approve each row.`.
- **Label'lar:** `Scope: …`, `Related records`, `<n> Tool Escapes`, `Status of <title>`, `Open`, `Evaluating`, `Met`, `Conscious boundary`, `Create follow-up work`, `Share`, `Tool Escapes are listed separately; nothing is shared until you approve each row.`.

### Tool Escapes (açılmış olay kümesi)
Sayıyı oluşturan olaylar, aynı süzgeçle; her olay satırı ve varsa kapanış kanıtı ya da kapanış eylemi.
- **Label'lar:** `Tool Escapes of <title>`, `Reasons: …`, `Source …`, `Note: …`, `Close Tool Escape`, `Close evidence`.

### Durumlar
#### Empty
`No Product Gaps recorded yet.`; `Record Product Gap` birincil kalır.
#### Filtered
Bir veya birkaç süzgeç seçili (örn. `Filter by external tool` = bir araç, `Filter by status` = `Open`): liste yalnız eşleşen blokları gösterir, seçili süzgeç değerleri seçicilerde görünür, olay kümesi aynı süzgeçle daralır. Hiçbiri eşleşmezse `No matches`.
#### No matches
`No Product Gaps match these filters.`.
#### Loading
`Loading Product Gaps…`.
#### Error
`Product Gaps are unavailable.` ve `Retry`; olaylar yüklenemezse blok içinde `Tool Escapes could not be loaded.`; durum yazması başarısızsa `Product Gap was not updated.`.
#### Tool Escapes open
Bir bloğun olay kümesi açık; bir olay kapalı (kanıt özetiyle), bir olay açık (`Close Tool Escape`).
#### Conscious boundary
Durum `Conscious boundary`; olaylar ve kapanış kuralı değişmez (yüksek etkili kaçış yine dört koşul ister).
#### Offline
Yazmalar yalnız çevrimiçi → `20.16 · Offline`.

**Spec:** [58 Ürün Boşlukları](../../specs/58-product-gaps/spec.md).

## 07.2 · Record Product Gap
> Bir dış araç geçişini tarihli Dış Araca Kaçış olarak yazmak; yeni Ürün Boşluğu açmak veya olayı kurucunun seçtiği mevcut boşluğa bağlamak.

**Artboard'lar**
- `07.2 · Record Product Gap · New gap · 1440`
- `07.2 · Record Product Gap · Existing gap · 1440`
- `07.2 · Record Product Gap · Error · 1440`

### Boşluk
Orta boy dialog'un üstü: yeni veya mevcut boşluk seçimi; yeni seçiliyse başlık, ihtiyaç, kapsam ve ilgili kayıtlar.
- **Label'lar:** `Product Gap`, `New Product Gap`, `Title`, `Unmet need`, `Scope (optional)`, `Related records`, `Related record type`, `Related record`, `Add related record`, `Selected related records`.

### Tool Escape
Ayraçtan sonra olayın alanları.
- **Label'lar:** `Occurred at`, `External tool`, `Source type`, `Source`, `Intended job`, `Reasons (choose at least one)`, `Missing capability`, `Faster`, `More reliable`, `Usability`, `Habit`, `Note (optional)`.

### Eylem satırı
Kayıt ve vazgeçme.
- **Label'lar:** `Record Product Gap`, `Cancel`.

### Durumlar
#### Existing gap
Boşluk seçicide mevcut boşluk; yalnız kaçış alanları.
#### Error
Alan hataları: `Choose the source Project or record.`, `Choose at least one reason.`; yazma reddi formun üstünde.

**Spec:** [58 Ürün Boşlukları](../../specs/58-product-gaps/spec.md).

## 07.3 · Close Tool Escape
> Bir Dış Araca Kaçışı ayrı, eklemeli kapanış kaydıyla kapatmak; yüksek etkili kaçışta dört koşulun kanıtını kesin kayıtlara bağlamak.

**Artboard'lar**
- `07.3 · Close Tool Escape · High-impact · 1440`
- `07.3 · Close Tool Escape · Refused · 1440`
- `07.3 · Close Tool Escape · Never held parallel truth · 1440`
- `07.3 · Close Tool Escape · Closed evidence · 1440`

### Kaçışın taşıdığı
Orta-geniş dialog'un üstü: kapanışta yapılan yüksek etki yargısı ve kuralı anlatan metin.
- **Label'lar:** `What the escape held`, `Choose`, `Canonical truth moved out`, `Lasting parallel source of truth`, `Never held parallel truth`, `Choosing Never held parallel truth closes without proof, and only you judge it. A high-impact close needs all four: …`.

### Dört koşul
Aynı gerçek iş akışının güncel Ürün sürüm adayında başarısı; gerçeğin ürün kayıtlarına dönüşü; dış kopyanın kapanışı; kesin kayıtlara bağlı kanıt.
- **Label'lar:** `Candidate build`, `Workflow run`, `How the truth returned`, `Manual recreate`, `Supported import`, `Restored product records`, `External copy`, `Closed`, `Active parallel source`, `How the external copy was closed`.

### Eylem satırı
Kapanış ve vazgeçme.
- **Label'lar:** `Close Tool Escape`, `Cancel`.

### Durumlar
#### Refused
Koşul eksikse kapanmaz: `The Tool Escape was not closed. Unmet: <conditions>.`; örn. `External copy` `Active parallel source`.
#### Never held parallel truth
Yalnız yargı ve açıklama; dört alan yok.
#### Closed
Olay satırında `Close evidence`: `Impact judged: Lasting parallel source of truth`, `Workflow succeeded on candidate build 2026.10.22-rc1 (run …).`, `Truth restored by Manual recreate in:` + `Restored product records`, `External copy closed: …`; bildirim `Tool Escape closed.`. Kaçış bir kez kapanır; eylem kalkar.
#### Error
`The Tool Escape was not closed.`; `Choose what the escape held before closing it.`.

**Spec:** [58 Ürün Boşlukları](../../specs/58-product-gaps/spec.md).

