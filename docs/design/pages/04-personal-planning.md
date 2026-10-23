# 04 · Personal Planning

Projeler arası kişisel planlama: Günlük Odak, Odak Dönemi ve Birleşik Takvim.

| Ekran | Ne çizilir |
|---|---|
| [04.1 · Daily Focus](#041--daily-focus) | Günün İşleri, olaylar ve adaylar |
| [04.2 · Close focus](#042--close-focus) | Günün gruplu kapanış okuması |
| [04.3 · Focus Periods](#043--focus-periods) | Dönem listesi ve seçili dönem detayı |
| [04.4 · Close Focus Period](#044--close-focus-period) | Kapanış incelemesi, karşılaştırma ve takip |
| [04.5 · Calendar](#045--calendar) | Gün/hafta/ay tarih ızgarası |

## 04.1 · Daily Focus
> Kurucunun farklı Projelerden seçili gün için ele alacağı İşleri toplamak; adayları önermek ve günün gerçekleşen olaylarını salt okunur göstermek.

**Artboard'lar**
- `04.1 · Daily Focus · Default · 1440`
- `04.1 · Daily Focus · Empty · 1440`
- `04.1 · Daily Focus · Loading · 1440`
- `04.1 · Daily Focus · Error · 1440`

### Başlık satırı
Sayfa başlığı, gün seçici, isteğe bağlı kapanış eylemi.
- **Label'lar:** `Daily Focus`, `Selected day`, `Close focus`.

### Günün İşleri
Seçili güne üye İşlerin listesi; sıra eklenme sırasıdır. Bir İş birden çok Projeden gelebilir.
- **Label'lar:** `Remove from Daily Focus`, `Open source record` (satır bağlantısı).

### What happened today?
Seçili gündeki desteklenen olayların kronolojik, salt okunur listesi; düzenleme alanı yoktur.
- **Label'lar:** `What happened today?`, `Open source record`, `No notable events for this day.`.

### Candidates
En çok beş öneri; üye değildir. Bölüm başında kuralı açıklayan sabit metin.
- **Label'lar:** `Candidates`, `Work appears here when Target date is this day through the next 7 days, or Reappear date is on or before this day.`, `Target date is near`, `Reappear date has arrived`, `Accept`, `Reject`, `No Candidates for this day.`.

### Add to Daily Focus
İş seçici ve ekleme düğmesi.
- **Label'lar:** `Add to Daily Focus`, `Work`, `Select Work`.

### Durumlar
#### Empty
Günün İşleri yerinde `No Work in Daily Focus for this day.`; `What happened today?` altında `No notable events for this day.`; `Candidates` altında `No Candidates for this day.`. Üçü de aynı sakin tonda, eylem dayatmaz. Ertesi gün (2026-10-23) önceki günün üyeliği yuvarlanmadığı için bu durumdadır.
#### Loading
Liste yerinde `Loading Work…` canlı durum metni.
#### Error
`Daily Focus is unavailable. Try loading this page again.`; ekleme/çıkarma yazması başarısızsa ekleme bölgesinde `Daily Focus could not be updated. Try again.`.
#### Many items
Beşten çok aday olsa da yalnız beş satır; üye listesi uzun olduğunda bölüm başlıkları sabit sırada kalır.
#### Geçmiş gün
`Selected day` 2026-10-21: aynı yapı; `What happened today?` o günün olaylarını gösterir. Başlık değişmez.

**Spec:** [27 Günlük Odak](../../specs/27-daily-focus/spec.md); [72 Kişisel kabuk](../../specs/72-personal-shell/spec.md) (giriş noktası).

## 04.2 · Close focus
> Seçili günün Günlük Odak İşlerini kaynak kayıtlardan gruplayarak sakin bir kapanış okuması vermek; hiçbir şeyi kapatmadan, taşımadan.

**Artboard'lar**
- `04.2 · Close focus · Default · 1440`
- `04.2 · Close focus · Empty · 1440`

### Başlık satırı
Başlık, seçili gün, aynı güne dönüş.
- **Label'lar:** `Close focus`, `Selected day`, `Daily Focus`.

### Gruplar
Sırasıyla dört grup; boş grup hiç çizilmez.
- **Label'lar:** `Completed`, `Abandoned`, `Deferred`, `Still open`, `Open source record`.

### Durumlar
#### Empty
Dört grup da boşsa yalnız başlık satırı kalır; sahte metin eklenmez.
#### Loading
`Loading Work…`.
#### Error
`Daily Focus is unavailable. Try loading this page again.`.

**Spec:** [27 Günlük Odak](../../specs/27-daily-focus/spec.md); [23 Bitiriş efektleri](../../specs/23-completion-effects/spec.md) (karşı sınır: burada efekt yoktur).

## 04.3 · Focus Periods
> İsteğe bağlı 1–8 haftalık Odak Dönemlerini açmak, birini seçip üyeliğini yönetmek ve kapsamındaki bağımlılıkları salt okunur incelemek.

**Artboard'lar**
- `04.3 · Focus Periods · Active · 1440`
- `04.3 · Focus Periods · Active · 768`
- `04.3 · Focus Periods · Planned · 1440`
- `04.3 · Focus Periods · Empty · 1440`
- `04.3 · Focus Periods · Dependencies open · 1440`
- `04.3 · Focus Periods · Membership rejected · 1440`

### Sayfa başlığı ve oluşturma
Başlık, tek satır açıklama, oluşturma formu.
- **Label'lar:** `Focus Period`, `Choose Work from any Project for a 1–8 week window.`, `Purpose`, `Start date`, `End date`, `Create Focus Period`.

### Dönem listesi
Bütün dönemler; seçili olan işaretli.
- **Label'lar:** Navigasyon adı `Focus Period`; durum değerleri `Planned`, `Active`, `Closed`, `Canceled`.

### Dönem detayı başlığı
Amaç, tarih aralığı ve durum; yaşam eylemleri.
- **Label'lar:** `Close` (yalnız `Active`), `Cancel` (`Planned` veya `Active`).

### Üyelik kontrolü
Açık (Planned/Active) dönemde İş seçici ve tek eylem.
- **Label'lar:** `Select Work`, `Add Work`, `Move`.

### Work
Dönem üyesi İşler.
- **Label'lar:** `Work`, `Remove`, `No Work in this Focus Period.`.

### Dependencies
Başlangıçta kapalı, açılıp kapanabilen salt okunur bölüm; dönem kapsamındaki İşler arasındaki mevcut `Active` ve `Resolved` blokaj ilişkileri.
- **Label'lar:** `Dependencies`, `Open source record`, `Active`, `Resolved`, `Part of a dependency cycle`, `No dependencies in this Focus Period.`.

### Durumlar
#### Empty
Hiç dönem yokken liste ve detay yerine tek satır `No Focus Period yet.`; oluşturma formu üstte kalır. Seçili dönemde üye yoksa `No Work in this Focus Period.`.
#### Loading
`Loading Focus Period…`.
#### Error
`Focus Period is unavailable.`; yazma hatası `Focus Period could not be updated.`; oluşturma reddi `Focus Period could not be created.`, alan hataları `Purpose is required.` ve `Focus Period must be 1–8 weeks.` ilgili alanın altında.
#### Üyelik reddi
Örtük ikinci etkin üyelik: `Work is already in an active Focus Period. Use Move.`; örtüşen pencere: `Work is already in another Focus Period.`.
#### Planned
Detayda yalnız `Cancel`; üyelik kontrolü açık; `Dependencies` mevcut.
#### Canceled
Eylem yok, üyelik kontrolü yok; liste salt okunur. Kapanış karşılaştırması çizilmez.
#### Dependencies açık
Bölüm genişlemiş; bir satır `Part of a dependency cycle` taşır; bir satır `Resolved`.
#### Dependencies boş
Bölüm açık, içinde `No dependencies in this Focus Period.`.

**Spec:** [30 Odak Dönemi](../../specs/30-focus-period/spec.md); [19 Blokajlar](../../specs/19-blockers/spec.md) (`Dependencies` kaynağı).

## 04.4 · Close Focus Period
> `Active` dönemi kapatmak; başlangıç ve kapanış kapsamını tarafsız karşılaştırmak, açık kalan İşler için toplu karar almak, isteğe bağlı değerlendirme ve önizlemeli takip İşi sunmak.

**Artboard'lar**
- `04.4 · Close Focus Period · Close review · 1440`
- `04.4 · Close Focus Period · Closed with decisions · 1440`
- `04.4 · Close Focus Period · Abandon selected · 1440`
- `04.4 · Close Focus Period · Closed account · 1440`
- `04.4 · Close Focus Period · Follow-up preview · 1440`

### Kapanış incelemesi
`Close` tıklandıktan sonra açılan bölüm (yalnız kapatmadan önce); açık kalacak İşlerin listesi ve açıklama.
- **Label'lar:** `Still-open Work`, `No Work remains open.`, `Closing keeps this Work open. No Work moves to another Focus Period automatically.`, `Close`, `Keep period open`.

### Still-open Work decisions
`Closed` dönemde kararı verilmemiş açık İşler için toplu karar formu.
- **Label'lar:** `Still-open Work`, `Select Work and choose where it goes. Nothing moves automatically.`, `Destination`, `Next period`, `Backlog`, `Another period`, `Abandon`, `Select Focus Period`, `Confirm Abandon selected Work`, `Close anyway if closure checks remain`, `Send`.

### Close comparison
Beş grup, her biri tarafsız sayı ve altında İş listesi.
- **Label'lar:** `Close comparison`, `In start snapshot`, `Added later`, `Removed`, `Completed`, `Still-open Work`, `Open source record`, `Work is unavailable.`.

### Date comparison
İsteğe bağlı; başlangıç snapshot'ındaki hedef tarihleri değişiklik geçmişi ve kapanış anıyla karşılaştıran gruplar.
- **Label'lar:** `Date comparison`, `Moved earlier`, `Moved later`, `Completed on target`, `Completed after`, `Still-open Work`.

### Period evaluation
Atlanabilir üç serbest metin alanı.
- **Label'lar:** `Period evaluation`, `Optional learning notes. Leave the fields blank to skip.`, `Keep`, `Change`, `Try next`, `Save evaluation`, `Skip`.

### Follow-up Work
Bir öğrenimden takip İşi formu, önizleme bölümü ve bağlı takip İşleri listesi.
- **Label'lar:** `Follow-up Work`, `Add follow-up Work`, `Learning source`, `Project`, `Select Project`, `Title`, `Description`, `Preview Follow-up Work`, `Follow-up Work preview`, `Source Focus Period`, `Confirm`, `Change`, `No Follow-up Work linked to this Focus Period.`.

### Dependencies
`04.3` ile aynı salt okunur bölüm, akışın en altında.

### Durumlar
#### Kapanış incelemesi açık
`Active` dönem; inceleme bölümü görünür, diğer bölümler altta.
#### Closed · karar bekliyor
`Still-open Work decisions` en üstte; karşılaştırma altında.
#### Abandon seçili
`Destination` = `Abandon`; iki onay kutusu; `Send` devre dışı.
#### Error
Karar hataları formun üstünde: `Confirm Abandon first.`, `Review closure checks or select Close anyway.`, `Work was already completed.`.
#### Closed · karar tamam
Karar bölümü kalkar; karşılaştırma, değerlendirme, takip İşleri kalır.
#### Work is unavailable
Karşılaştırmada bir satır bağlantısız ve `Work is unavailable.` taşır.
#### Follow-up preview
Önizleme bölümü açık, `Confirm` birincil.

**Spec:** [30 Odak Dönemi](../../specs/30-focus-period/spec.md); [26 Backlog](../../specs/26-backlog/spec.md) (gönderim hedefi); [09 İş yaşamı](../../specs/09-work-lifecycle/spec.md) (vazgeçme).

## 04.5 · Calendar
> İşlerin `Planned start`, `Target date` ve `Reappear date` tarihlerini türleri karışmadan gün, hafta ve ay ızgarasında göstermek; bir tarih işaretini sürükleyerek yalnız o alanı güncellemek.

**Artboard'lar**
- `04.5 · Calendar · Month · 1440`
- `04.5 · Calendar · Month · 768`
- `04.5 · Calendar · Week · 1440`
- `04.5 · Calendar · Day · 1440`
- `04.5 · Calendar · Dragging with preview · 1440`
- `04.5 · Calendar · Saved with Undo · 1440`
- `04.5 · Calendar · Empty · 1440`
- `04.5 · Calendar · Agenda · 1440`
- `04.5 · Calendar · Agenda · 768`
- `04.5 · Calendar · Agenda · Empty · 1440`

### Başlık
Başlık ve tek satır açıklama.
- **Label'lar:** `Calendar`, `Explore Work dates across Projects.`.

### Kontrol çubuğu
Tek satır: görünüm seçimi, tarih türü filtreleri, gün seçimi, kapsam, gezinme.
- **Label'lar:** `Day`, `Week`, `Month`, `Agenda`, `Date kinds`, `Planned start`, `Target date`, `Reappear date`, `Selected day`, `Project`, `All Projects`, `Previous`, `Next`.

### Takvim ızgarası
Görünür her gün için bir hücre (Month ve Week yedi kolon, Day tek kolon); hücre başlığı gün adı + tarih. Hücrede önce aralıklar, sonra tek tarih işaretleri.
- **Label'lar:** `Planned start · Target date` (aralık alt satırı), `Open source record`.

### Tarih değişikliği önizlemesi
Izgaranın üstünde, sürükleme veya seçim sırasında görünen tek satırlık şerit.
- **Label'lar:** `Save`, `Cancel`.

### Geri bildirim satırı
Izgara altında yazma sonucu.
- **Label'lar:** `Calendar date updated.`, `Undo`, `Calendar date could not be saved. Try again.`, `This Work date change is no longer available for Undo.`.

### Agenda görünümü
`Agenda` seçildiğinde (`/calendar?view=Agenda`) ızgara yerine dört kolonlu yoğun satır listesi çizilir: tarih + tarih seçici, tür, İş, `Open source record`. Seçili ayın her tarih işareti için bir satır, tarihe göre sıralı; aynı İşin iki türü iki ayrı satırdır. Kapsam ve tür filtreleri aynıdır.
- **Label'lar:** `Agenda`, `Planned start`, `Target date`, `Reappear date`, `Open source record`.
- **768:** satır iki satıra kırılır; tarih ve tür üstte, İş ve eylem altta.

### Durumlar
#### Empty
Izgara üstünde `No dated Work in this Calendar view.`; boş hücreler yine çizilir.
#### Loading
`Loading Calendar…`.
#### Error
`Calendar is unavailable. Try loading this page again.`.
#### Week
Yedi günlük tek satır; aralıklar her güne yayılır.
#### Day
Tek gün; aralık boyanmaz, yalnız o günün konumları; her işarette tarih seçici düğmesi.
#### Dragging
Bir işaret sürükleniyor; hedef hücre vurgulu; önizleme şeridi görünür.
#### Saved with Undo
Geri bildirim satırında `Calendar date updated.` + `Undo`.
#### Filtered
Yalnız `Target date` seçili; diğer türlerin işaretleri yok, aralıklar da yok (aralık iki tür birlikte seçiliyken çizilir).
#### Offline
Yazma yalnız çevrimiçi; tutamaçlar devre dışı → `20.16 · Offline`.
#### Agenda · Many items
Uzun ay; satırlar yoğun kalır, tarih kolonu hizalı.


**Spec:** [28 Birleşik Takvim](../../specs/28-unified-calendar/spec.md); [04 Mutasyon ve geri alma](../../specs/04-mutation-and-undo/spec.md) (Undo).

