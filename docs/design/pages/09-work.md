# 09 · Work

Projenin `Work` alanı: planlama yüzeyleri, İş detayı ve İşe ait bileşenler.

| Ekran | Ne çizilir |
|---|---|
| [09.1 · Work Board](#091--work-board) | Dört durumlu Kanban tahtası |
| [09.2 · Work List](#092--work-list) | Aynı taramanın yoğun satır listesi |
| [09.3 · Backlog](#093--backlog) | Tek manuel sıralı aktif İş listesi ve `Deferred` |
| [09.4 · Roadmap](#094--roadmap) | Ufuk lane'li kanvas, planlama listesi, Milestones |
| [09.5 · Roadmap Presentation Mode](#095--roadmap-presentation-mode) | Tam ekran salt okunur kanvas |
| [09.6 · Priority Map](#096--priority-map) | İki ölçüt eksenli harita ve `Unevaluated` kolonu |
| [09.7 · Prioritization Sessions](#097--prioritization-sessions) | Oturum oluşturma formu ve oturum listesi |
| [09.8 · Prioritization Session](#098--prioritization-session) | Oturum sırası ve Backlog sırası karşılaştırması |
| [09.9 · Scope Tree](#099--scope-tree) | Proje → Feature → İş salt okunur ağacı |
| [09.10 · Work Detail](#0910--work-detail) | Tek İşin iki kolonlu tam yüzeyi |
| [09.11 · Create Work](#0911--create-work) | Otomatik Draft'lı İş oluşturma formu |
| [09.12 · Create Work from template](#0912--create-work-from-template) | Şablon listesi ve önizleme dialog'u |
| [09.13 · Close Work](#0913--close-work) | Sonuç seçimli kapatma dialog'u |
| [09.14 · Reopen Work](#0914--reopen-work) | Hedef durumlu yeniden açma onayı |
| [09.15 · Change Work type](#0915--change-work-type) | Feature tür değişimi etki önizlemesi |
| [09.16 · Merge as duplicate](#0916--merge-as-duplicate) | Alan çatışmalı birleştirme dialog'u |
| [09.17 · Recreate in another Project](#0917--recreate-in-another-project) | Başka Projede yeniden oluşturma önizlemesi |
| [09.18 · Duplicate Work](#0918--duplicate-work) | Kopyalanacak/kopyalanmayacak listesi |
| [09.19 · Convert to independent Work](#0919--convert-to-independent-work) | Checklist maddesini İşe dönüştürme |
| [09.20 · Record Action run](#0920--record-action-run) | Girdiler ve fark önizlemesi dialog'u |
| [09.21 · Mark blocker resolved](#0921--mark-blocker-resolved) | Blokaj çözüm formu ve geçmişi |
| [09.22 · Not now](#0922--not-now) | Gerekçeli `Not now` formu, önizleme, geçmiş |
| [09.23 · Start Handoff](#0923--start-handoff) | Devir formu ve paket önizlemesi |
| [09.24 · External Execution Handoff](#0924--external-execution-handoff) | Devir paneli: paket, dönüş, geçmiş |
| [09.25 · Reconcile](#0925--reconcile) | Önerilen ilişkiler ve takip İşleri önizlemesi |
| [09.26 · Cancel Handoff](#0926--cancel-handoff) | Gerekçeli iptal dialog'u |
| [09.27 · Edit axis values](#0927--edit-axis-values) | Harita noktasına bağlı eksen popover'ı |
| [09.28 · Place on plan](#0928--place-on-plan) | Plana alma önizleme dialog'u |
| [09.29 · Milestone](#0929--milestone) | Kilometre Taşı alanları ve bağlı İşler |
| [09.30 · Work completed](#0930--work-completed) | `Work completed` bildirimi ve efekt katmanı |

## 09.1 · Work Board
> Proje İşlerini dört korunan İş akışı durumu sütununda taramak ve kart taşıyarak durumu yazmak.

**Artboard'lar**
- `09.1 · Work Board · Default · 1440`
- `09.1 · Work Board · Default · 768`
- `09.1 · Work Board · Empty · 1440`
- `09.1 · Work Board · Loading · 1440`
- `09.1 · Work Board · Soft WIP over limit · 1440`
- `09.1 · Work Board · Column collapsed · 1440`
- `09.1 · Work Board · Dragging · 1440`
- `09.1 · Work Board · Multi-select · 1440`

### Work alanı başlığı
Alan başlığı, tek cümlelik açıklama, planlama yüzeyi gezintisi, `Priority Map` bağlantısı ve günlük eylemler.
- **Label'lar:** `Work`, `Roadmap`, `Backlog`, `Priority Map`, `Create`, `Edit`, `Planning`, `Status`.

### Görünüm çubuğu
`Board` / `List` geçişi; `In Progress count`; odak eşiği aşıldığında uyarı; aktif kayıtlı görünüm sıralamasının salt okunur özeti.
- **Label'lar:** `Board`, `Kanban`, `List`, `In Progress count`, `Focus threshold`, `Sort by`, `Work number`, `Ascending`, `Over limit`.

### Filtreler
Board ve List'in ortak filtre satırı (→ 09.2 aynı filtreleri kullanır). Özel alan filtresi: Proje seçiliyken her özel alan için bir filtre; türe göre `True` / `False` / `Not evaluated`, seçenek ya da tarih aralığı; filtre etiketi alanın adının kendisidir. Öncelik ölçütü filtresi: ölçüt seçimi ve kademe (beş sabit kademe → 08.19 › Rank descriptions; ek olarak `Unevaluated`); filtre değer yazmaz, ölçüt tanımı yoksa kontrol çizilmez.
- **Label'lar:** `Custom fields`, `Priority criterion`, `Rank`, `Unevaluated`, `True`, `False`, `Not evaluated`.

### Durum sütunları
`Not Started`, `In Progress`, `Blocked`, `Closed`. Her sütun başlığında ad, kart sayısı, `Soft WIP` tanımlıysa sayı/sınır ve `Collapse` kontrolü. Kartlar kayıtlı görünümün sırasıyla dizilir; bağımsız manuel kart sırası yoktur.
- **Label'lar:** `Not Started`, `In Progress`, `Blocked`, `Closed`, `Collapse`, `Expand`, `Soft WIP`, `Over limit`.

### İş kartı
Kayıtlı görünümün görünür alanları; çekirdek ve satır metası → DS.17 (Work satırı; kart ilk ikisini taşır, burada yeniden listelenmez). Ekrana özgü fark: durum sütunu başlıkta olduğundan kartta yalnız varsa kapanış sonucu, blokaj veya risk işareti ve `Not now` işareti öne çıkar.
- **Label'lar:** `Move`, `Status`, `Time in status`, `Open blocker`, `Reappear date`, `Completed`, `Abandoned`, `Open source record`, `Not now`.

### Durumlar
#### Empty
Hiç İş yoksa sütunlar başlıklarıyla durur; içerikte "No Work yet." ve `Create`. Sahte kart çizilmez.
#### Loading
`Loading Work…` metni; sütun iskeleti.
#### Error
"Work is unavailable. Try loading this page again." Durum yazma hatası kartın yanında: "Work status could not be changed. Try again."; kart eski sütununa döner.
#### Soft WIP over limit
`In Progress 4 / 3` ve `Over limit In Progress` metinli işaret; renk tek başına taşımaz. Kartlar taşınmaya devam eder; bildirim veya sağlık hükmü yoktur.
#### Focus threshold exceeded
Görünüm çubuğunda nötr `Focus threshold exceeded` uyarısı ve renge dayanmayan `Over limit` işareti; hareket engellenmez. Aynı eşik İş kaynaklı Akıllı Koleksiyon görünümünde de ayarlanır (→ 08.12).
#### Column collapsed
`Closed` daraltılmış: dar şerit ad, sayı ve `Open blocker` gibi önemli sinyalleri korur; `Expand` ile açılır. Filtre değildir.
#### Dragging
Sürüklenen kart ve hedef sütun vurgusu; ekran okuyucu duyurusu hedef sütunu söyler.
#### Drop on Closed
Bırakma anında 09.13 açılır; iptal kartı önceki sütuna döndürür.
#### Drag out of Closed
`Closed` kartı açık sütuna bırakılınca 09.14 `Reopen` adımı hedef durum bırakılan sütun olarak açılır; iptal kartı `Closed`'a döndürür.
#### Reappear date backgrounded
Gelecek `Reappear date` taşıyan İş varsayılan tahtada görünmez; tarih bugün veya geçmişse kart `Reappear date 2026-10-22` ile görünür, durum değişmez.
#### Multi-select
Kart seçim kutuları işaretlenince üstte seçim çubuğu → DS.14 › Seçim; `Bulk Edit` dialog'u → 20.8, burada çizilmez.
#### Work completed
Kapatma sunucuda `Completed` kabul edilince kartın çevresinde efekt katmanı ve `Work completed` bildirimi (→ 09.30).

**Spec:** [25 Kanban](../../specs/25-kanban/spec.md), [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [19 Blokajlar](../../specs/19-blockers/spec.md), [26 Backlog](../../specs/26-backlog/spec.md) (`Reappear date`), [22 Toplu Düzenleme](../../specs/22-bulk-editing/spec.md) (yalnız seçim girişi), [20 Önceliklendirme](../../specs/20-priority/spec.md) (ölçüt filtresi), [10 Özel Alanlar](../../specs/10-custom-fields/spec.md) (alan filtresi).

## 09.2 · Work List
> Board ile aynı filtrelenmiş İş taramasını, planlanmamış İşler dahil, yoğun satır düzeninde sunmak.

**Artboard'lar**
- `09.2 · Work List · Default · 1440`
- `09.2 · Work List · Default · 768`
- `09.2 · Work List · Archived filter · 1440`
- `09.2 · Work List · Multi-select · 1440`

### Work alanı başlığı ve görünüm çubuğu
→ 09.1 › Work alanı başlığı, Görünüm çubuğu ve Filtreler; `List` seçili. Fark: `Archived` filtresi.
- **Label'lar:** `Archived`.

### Dışa ve içe aktarma girişleri
Liste başlığı eylem alanında `Export` (→ 20.5) ve `Import` (→ 20.6). Fark: `Import` hedef kapsamı Proje ve türü Work olarak önceden doldurur; Proje kapanış dondurmasında `Import` pasif ve nedeni yazılıdır.
- **Label'lar:** `Export`, `Import`.

### İş satırları
Çekirdek ve satır metası → DS.17 (Work satırı); alanlar 09.1 › İş kartı ile aynı kayıtlı görünüm alanlarıdır, yeniden tarif edilmez. Satıra özgü fark: başta seçim kutusu, sabit kolon hizası.
- **Label'lar:** `List Work`.

### Durumlar
#### Empty
"No Work yet."; arşiv filtresinde "No archived Work."
#### Loading
`Loading Work…`
#### Error
"Work is unavailable. Try loading this page again."
#### Archived filter
Arşivli satırlar `Archived` etiketiyle; satırda `Unarchive` eylemi kayıt detayında kalır.
#### Multi-select
Seçili satırlar; seçim çubuğu → DS.14 › Seçim, `Bulk Edit` → 20.8.
#### Many items
Uzun liste sabit kolon hizasıyla kayar; başlık satırı yapışkan.

**Spec:** [25 Kanban](../../specs/25-kanban/spec.md) (`List`), [09](../../specs/09-work-lifecycle/spec.md) (`Archive` filtresi), [29](../../specs/29-roadmap-horizon/spec.md) (`Not now` işareti), [22](../../specs/22-bulk-editing/spec.md) (seçim girişi), [79 Veri Dışa Aktarma](../../specs/79-data-export/spec.md), [80 Veri İçe Aktarma](../../specs/80-data-import/spec.md).

## 09.3 · Backlog
> Değerlendirilecek bütün aktif İşleri durumdan bağımsız görmek ve tek kalıcı manuel sırayla "önce hangisini ele alacağım?" kararını tutmak.

**Artboard'lar**
- `09.3 · Backlog · Manual order · 1440`
- `09.3 · Backlog · Alternative sort · 1440`
- `09.3 · Backlog · Empty · 1440`
- `09.3 · Backlog · Reorder in progress · 1440`

### Başlık
`Backlog` başlığı ve açıklama.
- **Label'lar:** `Backlog`.

### Sıralama çubuğu
`Backlog sort` seçimi; `Priority` seçiliyken `Priority criterion`, `Field` seçiliyken `Field to sort by`; kayıtlı sunum kontrolleri; kayıtlı sunum özeti `Saved presentation: {sort}[ · {detail}]` (ayrıntı yalnız `Priority` ve `Field` için).
`Export` (→ 20.5) Backlog'un kesin görünümünü (aktif İşler, seçili `Backlog sort`, kayıtlı sunum) kapsar.
- **Label'lar:** `Export`, `Backlog sort`, `Manual order`, `Priority`, `Date`, `Field`, `Priority criterion`, `Field to sort by`, `Title`, `Status`, `Saved presentation`, `Save presentation`, `Use saved presentation`.

### Sıralı liste
Her satırda sürükleme tutamacı ve klavye alternatifi `Move up` / `Move down` (ikisi de yalnız `Manual order`'da; tutamaç spec 26, `Move up`/`Move down` spec 20 Backlog order; ikisi aynı kalıcı sırayı yazar), sıra numarası, İş anahtarı, başlık, durum, varsa aktif blokaj işareti, varsa `Not now` işareti, `Reappear date` seçici. Etkin her Öncelik ölçütünün değeri ayrı hücrede (kademeler → 08.19 › Rank descriptions, ya da `Unevaluated`); toplam veya skor yok. Ölçüt filtresi → 09.1 › Filtreler.
- **Label'lar:** `Unevaluated`, `Drag {Work title}`, `Move up`, `Move down`, `Reappear date`, `Clear`, `Open blocker`, `Not now`, `Open source record`.

### Deferred
Gelecek `Reappear date` taşıyan İşler; tarihe göre.
- **Label'lar:** `Deferred`, `Reappear date`.

### Durumlar
#### Empty
"No active Work to consider."
#### Loading
`Loading Backlog…`
#### Error
"Backlog is unavailable. Try loading this page again."; sıra yüklenemezse "Backlog order is unavailable."; sunum yüklenemezse "Backlog presentation is unavailable."
#### Alternative sort
`Priority` seçili: tutamaçlar ve `Move up` / `Move down` gizli, satırlar ölçüt değerine göre; ölçüt değeri olmayanlar `Unevaluated` ile sonda. `Manual order` seçilince eski sıra geri gelir.
#### Reorder announcement
Klavye taşıması sırasında canlı duyurular İş adını söyler: "Picked up {Work title}.", "{Work title} is over {Work title}.", "{Work title} is outside the Backlog.", "{Work title} was dropped over {Work title}.", "{Work title} was not moved.", "Moving {Work title} was cancelled."
#### Save failures
"Backlog order could not be saved. Try again.", "Backlog presentation could not be saved. Try again.", "Reappear date could not be saved. Try again." — ilgili satırın veya çubuğun yanında.
#### Reappear date arrived
Tarihi bugün olan İş Deferred'dan çıkıp kayıtlı konumuna döner; Proje `Notify on Reappear date` açıksa tek `reappear-date` sinyali Bildirim Merkezinde görünür (→ 00.5).

**Spec:** [26 Backlog](../../specs/26-backlog/spec.md), [20 Önceliklendirme](../../specs/20-priority/spec.md) (`Priority` sıralaması), [29](../../specs/29-roadmap-horizon/spec.md) (`Not now` işareti).

## 09.4 · Roadmap
> Aynı İş gerçeğini ufuk, tarih ve Kilometre Taşları üzerinden gelecek yönü olarak anlatmak; durum, öncelik veya Backlog sırası yazmadan.

**Artboard'lar**
- `09.4 · Roadmap · Default · 1440`
- `09.4 · Roadmap · Default · 768`
- `09.4 · Roadmap · Blocker badge selected · 1440`
- `09.4 · Roadmap · Unplanned candidates expanded · 1440`
- `09.4 · Roadmap · Empty · 1440`

### Görünüm çubuğu
Adlandırılmış görünüm seçimi, birincil kapsam (`Product direction` / `All Work types`), grup/lane alanı, işaret alanı, `Presentation Mode`; görünüme kaydedilen zaman ölçeği ve görsel yoğunluk seçicisi (durum, öncelik veya Backlog sırası yazmaz).
- **Label'lar:** `Roadmap`, `Product direction`, `All Work types`, `Horizon`, `Type`, `Status`, `No filter`, `Presentation Mode`, `Time scale`, `Density`.

### Roadmap kanvası
`Now`, `Next`, `Later` lane'leri; planlanan başlangıç + hedefi olan İş aralık, yalnız hedefi olan İş nokta; `Product direction` görünümünde Research İşinin `Problem/Opportunity` ve `Expected Outcome` metni birincil, ona `Origin` ile bağlı Feature İşi ikincil; Kilometre Taşları tarih işaretleri; aktif blokaj rozeti; viewport kontrolleri (zoom, `Fit View`) → 13.2 › Araç çubuğu.
- **Label'lar:** `Now`, `Next`, `Later`, `No horizon`, `Primary`, `Secondary`, `Problem/Opportunity`, `Expected Outcome`, `Blocked by`, `Open source record`, `Roadmap canvas`.

### Planlama listesi
Kanvasla aynı İşler; her satırda `Horizon` seçimi ve tarih alanları; `Not now` işareti.
- **Label'lar:** `Horizon`, `Now`, `Next`, `Later`, `No horizon`, `Target date`, `Save`, `Saving…`, `Not now`.

### Unplanned candidates
Varsayılan daraltılmış; görünüm filtrelerine uyan fakat tarihi ve ufku olmayan İşler.
- **Label'lar:** `Unplanned candidates`, `Place {Work key} on plan`.

### Milestones
Proje Kilometre Taşları: başlık, hedef tarih, durum, bağlı İş sayısı (`In Milestone`); her satırda düzenleme girişi `Edit Milestone` (→ 09.29).
Bölüm başlığında `Export` (→ `20.5`) ve `Import` (→ `20.6`, kapsam: seçili Proje). Arşivli Projede `Import` kapalıdır (→ `20.21`).
- **Label'lar:** `Milestones`, `Export`, `Import`, `Create Milestone`, `Edit Milestone`, `Planned`, `Reached`, `Abandoned`, `Reach`, `Abandon`, `In Milestone`, `No Milestone yet.`

### Durumlar
#### Empty
Kanvasın yerinde planlı İş yoksa dürüst boş durum ve açık `Unplanned candidates`; "No Work yet." İş hiç yoksa.
#### Loading
`Loading Roadmap…`
#### Error
"Roadmap is unavailable. Reload and try again."; viewport hatası "Roadmap viewport could not be fitted."
#### Blocker badge selected
Rozet seçili: engellenen `LUMA-58` ile kaynak `LUMA-63` vurgulu; diğer öğeler sakinleşir; ağ çizilmez. Rozet iki ayrı açılabilir hedef taşır: engellenen kayıt (`LUMA-58`) ve kesin blokaj kaynağı (`LUMA-63`); her biri `Open source record`.
#### Unplanned candidates expanded
Bölüm açık, aday satırları görünür.
#### All Work types view
Bütün türler birincil; Research/Feature ayrımı yok.

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md), [19 Blokajlar](../../specs/19-blockers/spec.md) (rozet), [79 Veri Dışa Aktarma](../../specs/79-data-export/spec.md) ve [80 Veri İçe Aktarma](../../specs/80-data-import/spec.md) (Milestones).

## 09.5 · Roadmap Presentation Mode
> Mevcut adlandırılmış Roadmap görünümünü düzenleme ve yapılandırma araçları olmadan tam ekran sunmak.

**Artboard'lar**
- `09.5 · Roadmap Presentation Mode · Default · 1440`
- `09.5 · Roadmap Presentation Mode · Detail open · 1440`

### Sunum kanvası
09.4 kanvasıyla aynı görünüm ve konum; viewport kontrolleri → 13.2 › Araç çubuğu; düzenleme, ufuk seçimi, liste, `Unplanned candidates` yok.
- **Label'lar:** `Presentation Mode`, `Exit Presentation Mode`.

### Salt okunur detay
Seçili İşin başlığı, türü, durumu, tarihleri, ufku; düzenleme kontrolü yok.
- **Label'lar:** `Open source record`.

### Durumlar
#### Detail open
Salt okunur panel açık.

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md).

## 09.6 · Priority Map
> İki Öncelik ölçütünü eksen seçip İşlerin göreli konumunu skor veya sıra üretmeden karşılaştırmak.

**Artboard'lar**
- `09.6 · Priority Map · Default · 1440`
- `09.6 · Priority Map · Default · 768`
- `09.6 · Priority Map · Evidence signals on · 1440`
- `09.6 · Priority Map · Empty · 1440`

### Eksen çubuğu
Yatay ve dikey eksen ölçüt seçimleri (ilk iki etkin ölçüt başlangıç), kanıt sinyali anahtarı; noktadan `Edit axis values` açılır (→ 09.27).
- **Label'lar:** `Horizontal axis`, `Vertical axis`, `Show evidence signals`, `Edit axis values`.

### Harita düzlemi
Beş kademeli iki eksen (kademeler → 08.19 › Rank descriptions); her nokta İş anahtarı ve kısa başlık; kanıt sinyali açıksa yanında `Feedback`, `Unique Contact`, `Unique Company` sayıları. Çeyrek etiketi yoktur.
- **Label'lar:** `Work by selected criteria`, `Feedback`, `Unique Contact`, `Unique Company`, `Not now`.

### Unevaluated
En az bir eksen değeri olmayan İşler.
- **Label'lar:** `Unevaluated`, `Unevaluated Work`, `No unevaluated Work.`

### Durumlar
#### Empty
Ölçüt yoksa: "No priority metrics yet." ve Yapılandırma modu bağlantısı (→ 08.19); İş yoksa "No Work yet."
#### Loading
`Loading…`
#### Error
"Priority metric value could not be saved." (düzenleme sonrası).
#### Evidence signals on
Sayılar noktaların yanında; bağlam olarak sessiz.
#### One criterion only
Tek etkin ölçüt varsa harita çizilmez; iki ölçüt gerektiği açıkça söylenir.

**Spec:** [20 Önceliklendirme](../../specs/20-priority/spec.md), [29](../../specs/29-roadmap-horizon/spec.md) (`Not now` işareti).

## 09.7 · Prioritization Sessions
> Projenin adlandırılmış Önceliklendirme oturumlarını listelemek ve yenisini açıkça oluşturmak.

**Artboard'lar**
- `09.7 · Prioritization Sessions · Default · 1440`
- `09.7 · Prioritization Sessions · Empty · 1440`

### Başlık
Bölüm başlığı ve oturumun Backlog sırası yazmadığını söyleyen açıklama.
- **Label'lar:** `Prioritization`, `Prioritization Sessions`, `Project decision views`.

### Oluşturma formu
Oturum adı, İş kapsamı seçimi.
- **Label'lar:** `Create Prioritization Session`, `Session name`, `Work scope`, `Select Work`.

### Oturum listesi
Ad, oluşturma tarihi, kapsam sayısı, açık/kapalı.
- **Label'lar:** `Close session`, `Trash`, `Restore`.

### Durumlar
#### Empty
Oturum yoksa yalnız form ve tek satır açıklama.
#### Loading
`Loading Prioritization…`
#### Error
"The Prioritization change could not be saved."; form hatası "Check the form."

**Spec:** [20 Önceliklendirme](../../specs/20-priority/spec.md).

## 09.8 · Prioritization Session
> Seçili İş kapsamını görünüm-yerel manuel sırada dizmek ve Backlog sırasıyla yan yana karşılaştırmak.

**Artboard'lar**
- `09.8 · Prioritization Session · Default · 1440`
- `09.8 · Prioritization Session · Closed · 1440`

### Oturum başlığı
Ad, tarih, kapsam sayısı, `Add Work`, `Close session`.
- **Label'lar:** `Session name`, `Add Work`, `Work to add`, `Close session`.

### Session order
Sıralı kartlar; her kartta canlı İş alanları: başlık, ölçüt değerleri, hedef tarih, Risk ve kanıt sayıları, `Not now` işareti.
- **Label'lar:** `Session order`, `Move up`, `Move down`, `Remove from session`, `Target date`, `Risk`, `Evidence`, `Unevaluated`, `Not set`.

### Backlog order karşılaştırması
Aynı İşlerin Backlog sırası; Backlog'da olmayanlar belirtilir.
- **Label'lar:** `Backlog order`, `Not in Backlog`.

### Durumlar
#### Loading
`Loading live Work context…`
#### Closed session
Kapanmış oturum: tarih ve son sıra salt okunur; `Move up`/`Move down`/`Remove from session` yok.
#### Error
"The Prioritization change could not be saved."

**Spec:** [20 Önceliklendirme](../../specs/20-priority/spec.md), [29](../../specs/29-roadmap-horizon/spec.md) (`Not now` işareti).

## 09.9 · Scope Tree
> `Project → Feature → included Work` kapsamını salt okunur açılır ağaçta göstermek.

**Artboard'lar**
- `09.9 · Scope Tree · Default · 1440`
- `09.9 · Scope Tree · Empty · 1440`

### Ağaç
Kök Proje; altında Feature İşleri; her Feature altında birincil kapsamdaki İşler. Satırda durum, aktif blokaj, ilgili Kilometre Taşı, Feature'da türetilen ilerleme.
- **Label'lar:** `Scope Tree`, `Scope Tree records`, `Progress:`, `Status:`, `Blocked by:`, `In Milestone:`, `Open source record`.

### Durumlar
#### Empty
Feature yoksa yalnız kök Proje ve tek satır açıklama `No Features in this Project yet.`; sahte ağaç çizilmez.
#### Loading
`Loading Work…`
#### Error
"Work is unavailable. Try loading this page again."

**Spec:** [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [19](../../specs/19-blockers/spec.md) (blokaj bağlamı).

## 09.10 · Work Detail
> Tek İşin kimliğini, durumunu, günlük planlama alanlarını ve canlı bağlamını tek yüzeyde göstermek; yaşam döngüsü eylemlerini buradan başlatmak.

**Artboard'lar**
- `09.10 · Work Detail · Bug · 1440`
- `09.10 · Work Detail · Bug · 768`
- `09.10 · Work Detail · Bug · Dark · 1440`
- `09.10 · Work Detail · Feature · 1440`
- `09.10 · Work Detail · Empty context section · 1440`
- `09.10 · Work Detail · Closed Abandoned · 1440`
- `09.10 · Work Detail · Archived · 1440`
- `09.10 · Work Detail · Relation preview · 1440`
- `09.10 · Work Detail · Automation suggestion · 1440`
- `09.10 · Work Detail · Converted from capture · 1440`
- `09.10 · Work Detail · Custom section · 1440`
- `09.10 · Work Detail · Copied Markdown preview · 1440`

### Kayıt başlığı
İş anahtarı, başlık, tür, durum (+ kapanış sonucu), eylem satırı ve taşma menüsü. Altında varsa `Not now` işareti ve köken satırı. Ortak başlık eylemleri (`Add to Favorites`, `Remind me`, `Archive`, `Move to Trash` ve taşma menüsü) → DS.11; burada yalnız İşe özgü eylemler. Köken satırı: yakalamadan dönüşen İşte `Capture provenance` (özgün metin, bağlantı, yakalama zamanı, köken; `Origin` ilişkisi değildir); kontrol listesi maddesinden dönüşen İşte `Origin` ve `Origin Location`.
<details>
<summary>Label'lar</summary>

`Work`, `Feature`, `Bug`, `Task`, `Research`, `Improvement`, `Not Started`, `In Progress`, `Blocked`, `Closed`, `Completed`, `Abandoned`, `Copy Context as Markdown`, `Record Action`, `Start Work`, `Not now`, `Unarchive`, `Duplicate Work`, `Merge as duplicate`, `Recreate in another Project`, `Capture provenance`, `Origin`, `Origin Location`, `Source item is gone`.

</details>

### Durum ve planlama alanları
Tür seçimi, durum seçimi, planlanan başlangıç, hedef tarih, `Reappear date`, hafif efor, Roadmap ufku. Bug'ın gözlendiği sürümler alanı Bağlam Kartındaki `Affected Releases` bölümünde düzenlenir.
- **Label'lar:** `Type`, `Status`, `Close`, `Reopen`, `Planned start`, `Target date`, `Reappear date`, `Horizon`, `Now`, `Next`, `Later`.

### Öncelik ölçütü değerleri
Her etkin ölçüt ayrı satır; değer veya `Unevaluated`. Toplam veya skor yok.
- **Label'lar:** `Priority metrics for {Work key}`, `Unevaluated`. Kademeler → 08.19 › Rank descriptions.

### Özel alanlar
İş türüne bağlı Proje özel alanları; satır ve boş değer kuralı → DS.12.
Tarih değeri düzenleyicisi takvim günü seçer; Select ve Multi select düzenleyicisi seçenekleri Proje özel alan tanımından alır.
- **Label'lar:** `Custom fields`, `Custom field`, `Not evaluated`, `True`, `False`, `Choose a calendar date.`, `Clear date`.

### İş Bağlam Kartı
Üstte `Why am I doing this work?` zinciri; altında İş türünün hazır bölümleri Proje düzenindeki sırayla; gizli bölümler `Add Context` menüsünde. Bölüm öğeleri kaynağından canlıdır ve durumu ile kaynağı açar. Zincirde çözülemeyen veya erişilemeyen adım içerik sızdırmadan açıklanır. Görünür boş bölüm → DS.13 › Boş bölüm. Yapılandırılmış özel bölüm hazır bölümlerle aynı yerleşimde `Section name` başlığıyla durur; rozet eklenmez.
<details>
<summary>Label'lar</summary>

`Work Context Card`, `Why am I doing this work?`, `Add Context`, Bug bölümleri `Observed/Expected Behavior`, `Affected Releases`, `Evidence`, `GitHub & Tests`; Feature `Problem/Opportunity`, `Expected Outcome`, `Evidence & Decisions`, `Risks & Open Questions`, `Included Work`, `GitHub & Tests`, `Target Release`; Task `Description`, `Dependencies`, `GitHub & Tests`, `Target Release`; özel bölüm `Section name`; Research `Research Question`, `Sources & Evidence`, `Decisions`, `Related Work`; Improvement `Current Situation`, `Expected Outcome`, `Evidence`, `GitHub & Tests`.

</details>

### Kontrol listesi
Maddeler: tamamlama kutusu, metin, sırala/sil; dönüştürülmüş madde yeni İşe bağlantıyla görünür; altta yeni madde alanı.
- **Label'lar:** `Checklist`, `Item`, `Checklist for {Work key}`, `New item for {Work key}`, `Move item {n} up`, `Move item {n} down`, `Delete item {n}`, `Add item`, `Convert to independent Work`.

### Dış yürütme devirleri
İşteki devirler kronolojik; her satırda amaç, yürütücü, durum, başlangıç tarihi.
Durum label'ları ve devir ayrıntısı 09.24'te tanımlıdır; burada yeniden tarif edilmez.
- **Label'lar:** `External Execution Handoff`, `Start Handoff`, `View Handoffs`.

### İlişkiler ve blokajlar
Gruplar: blokajlar (`Blocked by`, `Blocks`, her biri `Active`/`Resolved`; çözme ve geçmiş → 09.21), standart ilişkiler (`Related`, `Origin`, `Derived`, `Included in`, `Contributes to Milestone`). İlişki ekleme önizlemesi, `Remove relation`, `Used in`, kırık uç sunumu ve ikinci birincil Feature reddi → 20.10. Bir İş en çok bir birincil Feature kapsamında olabilir (`Included in`).
- **Label'lar:** `Relations`, `Blocks`, `Blocked by`, `Includes`, `Included in`, `Contributes to Milestone`, `In Milestone`, `Active`, `Resolved`, `Mark blocker resolved`, `Reactivate blocker`, `Blocker history`, `Resolution date`. Kalanı → 20.10.

### Ekler
İşe bağlı dosya ekleri listesi.
- **Label'lar:** → 20.13.

### Etiketler
İşe uygulanmış Çalışma Alanı etiketleri; uygulama ve kaldırma ortak seçiciyle (→ 20.11).
- **Label'lar:** `Tags`, `Tag`.

### Priority Foundations
Hedef, tarih, blokaj, risk, Kilometre Taşı, Geri Bildirim, Karar, Kaynak, efor ve ölçüt değerleri kaynaklarına bağlı; tıklanabilir sayılar. Skor yok.
- **Label'lar:** `Priority Foundations`, `Show {label} source records ({count})`, `Feedback`, `Unique Contact`, `Unique Company`, `Archived`.

### Return to Work
URL'de açıkça seçilmiş İş bağlamında kaynağa bağlı kısa özet: isteğe bağlı sonraki adım alanı ve son açılıştan beri olan olaylar.
- **Label'lar:** `Return to Work`, `Next concrete step`, `Since you last looked`, `Open source record`.

### Evidence by Evidence Role
İşe bağlı kanıtın Kanıt Rolüne göre gruplanmış, sayılı bölgesi (→ 12.10). Boş durum `No evidence linked.`
- **Label'lar:** `Evidence by Evidence Role`, `No evidence linked.`

### Evidence Flow
İşe açıkça `Provides evidence` ile bağlı öğeler zaman sırasıyla, kaynak türüne göre süzülebilir; `Related` ilişkisi veya metin benzerliği satır üretmez.
- **Label'lar:** `Evidence Flow`, `Open source record`.

### Geçmiş
İşin olağan değişiklik geçmişi: durum ve sütun hareketleri, kapanış/yeniden açma (önceki sonuç korunur), devir olayları, otomasyon değişiklikleri (kural, tanım sürümü, tetikleyici), `Not now` izi.
Devir olayı label'ları ve `You` aktörü → 09.24 › Handoff history. Aynı kayıtta beş dakika içindeki güvenli alan değişiklikleri açılabilir tek bir sunum kümesinde toplanır; açınca her değişiklik ayrı görünür.
Geçmiş satırı: aktör, zaman, köken ve desteklenen alanlarda önceki → sonraki değer. Aktör türü ortak Aktör satırıyla gösterilir (→ 20.14 › Aktör satırı); `You` yalnız 09.24 › Handoff history içindedir.
- **Label'lar:** `History`.

### Durumlar
#### Loading
`Loading Work…`
#### Error / not found
"Work is unavailable. Try loading this page again."; bulunamayan kayıt → 20.19.
#### Custom fields states
`Loading Custom field…`; yükleme hatası `Custom field values could not be loaded. Try loading this page again.`; yazma hatası `Custom field values could not be saved.` (satırın altında).
#### Feature
`LUMA-51`: Bağlam Kartında `Included Work` (kapsanan İşler, türetilen ilerleme `0/1`), `Feature health` güncellemeleri (`On Track` / `At Risk` / `Off Track` + kısa gerekçe, yazar, zaman; kronolojik) ve `Record Feature health` eylemi, `Primary spec` belgesi (bu spec için `Spec Change Review` kuyruğu varsa satırda `Spec Change Review` bağlantısı → 10.16; `Primary spec`'siz Feature'da kuyruk açılmaz ve bağlantı yoktur); `GitHub & Tests` bölümünde yalnız Feature için `Test Summary: LUMA-51` bağlantısı (→ 15.21; Bug, Task ve Improvement'ta yok); `Dependencies` bağlantısı salt okunur görünüm olarak; Feature bağlamında `Story Timeline` (→ 08.8 `Project History`).
#### Bug
`LUMA-42` (varsayılan artboard): `Affected Releases` çoklu seçim ve Bug bölümleri.
#### Empty context section
Görünür boş bölüm → DS.13 › Boş bölüm (`Nothing here yet.` ve ekle/bağla eylemi).
#### Custom section
Özel bölüm `Section name` başlığıyla; satırlar kaynağında canlı (durum + `Open source record`); yalnız açık İşten erişilen kayıtlar; boşsa `Nothing here yet.`
#### Closed · Completed / Closed · Abandoned
Durum `Closed`, sonuç metinli; gerekçe varsa altında; `Reopen` görünür.
#### Archived
Başlık altında `Archived` işareti ve `Unarchive`; arşivli kayıt davranışı → DS.11 › Durumlar (kayıt düzenlenebilir kalır); kimlik ve anahtar aynı. Salt okunur yüzey yalnız Arşivli Projede (→ `20.21`).
#### Merged key
Emekli anahtarla açılan kayıt yaşayan kayda yönlenir; üstte "Origin: LUMA-12 → LUMA-42" ve kısa süreli `Undo`.
#### Converted from capture
Yakalamadan dönüşen İşte köken satırı `Capture provenance`: özgün metin, bağlantı, yakalama zamanı, köken. `Origin` ilişkisi üretmez.
#### Converted from checklist item
Kontrol listesi maddesinden dönüşen yeni İşte `Origin` satırı kaynak İşi açar; yanında `Origin Location` (kaynak İş + madde metni, kararlı sürüm). Madde sonradan silinse bile konum sabit okunur; çözülemeyen konumda `Source item is gone`.
#### Recreated
Yeni İşte kaynağını gösteren köken satırı (`Origin` → `TIDE-9`); kaynak İş tidekit'te değişmeden kalır, eski anahtar yeni İşe yönlenmez.
#### Relation preview
İlişki ekleme önizlemesi ve onay receipt'i → 20.10 › Seçici; ikinci birincil Feature reddi → 20.10 › Durumlar.
#### Source closed suggestion
→ 09.21 › Resolve suggested.
#### Automation suggestion
GitHub bölümünde `Mark as Completed` önerisi (koşul → 08.23 › Kural formu); eylem 09.13 kapatma adımını `Completed` seçili açar.
#### Automation applied
Arayüz açıkken otomasyon İşi değiştirdiyse tek sonuç bildirimi (→ 20.14 Write Receipts, `Undo`); Bitiriş efekti oynamaz.
#### Copy Context as Markdown
Panoya kopyalandı toast'ı `Context copied.`; hata "Context could not be copied." Kopyalanan Markdown bölümleri: İş anahtarı, başlık, tür, durum, `Description`, `Checklist`, `Why am I doing this work?`, `Primary spec`, `Related Decision, Risk, and Open Question`, `Active blockers`, `GitHub context`, `Produced at`, `Primary source is in the app`. Kopyalanan Markdown üretim zamanını, okunur kaynak kimliklerini/bağlantılarını ve `Primary source is in the app` notunu içerir; sır, erişilemeyen alan ve özel Dosya Eki baytı içermez.
#### Work completed
→ 09.30.
#### Offline
Yazma kontrolleri pasif; → 20.16.
#### Long content
→ DS.15 › Long content; ek olarak çok sayıda ilişki grupta "show all" ile kısalır.

**Spec:** [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [16 İş Bağlam Kartı](../../specs/16-work-context/spec.md), [45 Kanıt](../../specs/45-evidence/spec.md), [52 Spec Değişikliği İnceleme Kuyruğu](../../specs/52-spec-change-review/spec.md), [57 Test İnceleme](../../specs/57-test-review-and-follow-up/spec.md), [35 Kişisel Hatırlatıcılar](../../specs/35-personal-reminders/spec.md), [39 Favoriler](../../specs/39-favorites/spec.md), [10](../../specs/10-custom-fields/spec.md), [12](../../specs/12-relations/spec.md), [18](../../specs/18-work-checklists/spec.md), [19](../../specs/19-blockers/spec.md), [20](../../specs/20-priority/spec.md), [21](../../specs/21-record-actions/spec.md), [24](../../specs/24-external-handoffs/spec.md), [26](../../specs/26-backlog/spec.md), [29](../../specs/29-roadmap-horizon/spec.md), [17](../../specs/17-work-templates/spec.md), [23](../../specs/23-completion-effects/spec.md), [62](../../specs/62-work-automation/spec.md).

## 09.11 · Create Work
> Projede yalnız başlıkla İş oluşturmak; form bağlantı varken kişisel `Draft` olarak otomatik korunur.

**Artboard'lar**
- `09.11 · Create Work · Default · 1440`
- `09.11 · Create Work · Offline · 1440`
- `09.11 · Create Work · Resumed Draft · 1440`

### Form başlığı
`Create` başlığı, otomatik kayıt durumu (Draft form durum şeridinin sahibi bu ekran; 02.10 referans verir), `Create from template` girişi.
- **Label'lar:** `Create`, `Draft`, `Saving…`, `Ready`, `Draft saved.`, `Create from template`. Durum şeridi metni: "Changes save automatically while you are online. Create turns this Draft into one Work."; `Save` ve `Create`. `Last saved` → 20.16.

### Alanlar
Başlık (tek zorunlu), tür, açıklama; altında İş'e bağlı özel alanlar.
Özel alan türleri → 08.16; değer satırı → DS.12.
- **Label'lar:** `Title`, `Type`, `Description`, `Custom fields`.

### Eylem satırı
Birincil `Create`.
- **Label'lar:** `Create`, `Creating…`.

### Drafts özeti
Kişisel Draft'lar; liste ve durum metinleri 02.10'da tanımlıdır (yeniden tarif edilmez). Burada yalnız form içi sürdür/sil geri bildirimi.
- **Label'lar:** `Drafts`, `Draft resumed.`, `Draft deleted.`

### Durumlar
#### Empty
Boş form; Draft listesi boşken → 02.10 › Empty.
#### Saving
`Saving…` sessiz durum metni.
#### Offline
Bağlantı kopunca → 20.16 (`Last saved 14:32`, `Unsaved changes may be lost`); yerel kuyruk yok, yeniden bağlanınca gizli tekrar yok.
#### Error
"Draft could not be saved. Try again.", "Draft could not be saved. Check the form.", "Work could not be created. Try again."; alan hatası "Check the form."
#### Type warning
Projede kapalı tür seçilirse alan altında uyarı metni.

**Spec:** [11 Taslaklar](../../specs/11-work-drafts/spec.md), [09](../../specs/09-work-lifecycle/spec.md), [10](../../specs/10-custom-fields/spec.md), [17](../../specs/17-work-templates/spec.md) (giriş).

## 09.12 · Create Work from template
> Proje `Work Template`'inden bağımsız yeni İş oluşturmak; göreli tarihler gerçek tarih olarak önizlenir.

**Artboard'lar**
- `09.12 · Create Work from template · Default · 1440`
- `09.12 · Create Work from template · Unresolved date · 1440`

### Şablon listesi
Projenin etkin şablonları.
- **Label'lar:** `Work Templates`.

### Önizleme
Başlık alanı, tür, açıklama iskeleti, seçili alan varsayılanları, hafif kontrol listesi, çözülmüş tarihler. `Resolved dates preview` bileşeni (`Creation day`, `Planned start`, `Target`, `Not set`) → 08.17 › Resolved dates preview; burada yalnız çözülemeyen tarihte onayın pasif olması.
- **Label'lar:** `Title`, `Type`, `Description`, `Selected field defaults`, `Checklist`.

### Eylem satırı
Onay ve iptal; çözülemeyen tarihte onay pasif. Giriş düğmesi `Create from template` (→ 09.11), dialog onayı `Create Work`.
- **Label'lar:** `Create Work`, `Cancel`.

### Durumlar
#### Empty
Şablon yoksa Yapılandırma modu bağlantısı (→ 08.17).
#### Error
"Work could not be created from this template."; tarih çözülemezse önizleme kapalı kalır ve onay pasif; "Check the Work title."
#### Unavailable field
Varsayılanı olan alan artık yoksa `Unavailable Custom field`.

**Spec:** [17 İş Şablonları](../../specs/17-work-templates/spec.md).

## 09.13 · Close Work
> `Closed`'a her geçişte `Completed` veya `Abandoned` sonucunu açıkça seçtirmek; engellemeyen `Closure check` ve isteğe bağlı `Keep lasting context` göstermek.

**Artboard'lar**
- `09.13 · Close Work · Default · 1440`
- `09.13 · Close Work · Closure check · 1440`
- `09.13 · Close Work · Keep lasting context · 1440`

### Sonuç seçimi
İki seçenek, isteğe bağlı gerekçe.
- **Label'lar:** `Close {Work key}`, `Closure result for {Work key}`, `Completed`, `Abandoned`, `Reason for {Work key}`.

### Closure check
Yalnız tamamlanmamış checklist maddesi veya aktif blokaj varsa: kalan maddeler ve kesin aktif ilişkiler kaynaklarıyla.
- **Label'lar:** `Closure check`, `Return to work`, `Close anyway`, `Blocks`, `Blocked by`.

### Keep lasting context
İşte not varsa koşullu, atlanabilir bölüm: seçilen içeriği yeni Karar veya Kişisel Wiki belgesi olarak önizleme.
- **Label'lar:** `Keep lasting context`, `Decision · Personal Wiki`.

### Eylem satırı
Kapatma onayı ve iptal.
- **Label'lar:** `Close`, `Cancel`.

### Durumlar
#### Default
Yalnız sonuç seçimi.
#### Closure check
Kalan madde + aktif blokaj listesi görünür.
#### Keep lasting context
Bölüm açık.
#### Error
"Work status could not be changed. Try again."

**Spec:** [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [18](../../specs/18-work-checklists/spec.md), [19](../../specs/19-blockers/spec.md), [25](../../specs/25-kanban/spec.md) (sütuna bırakma).

## 09.14 · Reopen Work
> Kapalı İşi açık onay ve terminal olmayan hedef durumla yeniden açmak; önceki sonuç geçmişte kalır.

**Artboard'lar**
- `09.14 · Reopen Work · Default · 1440`
- —

### Onay
Hedef durum seçimi ve onay cümlesi.
- **Label'lar:** `Reopen {Work key}`, `Not Started`, `In Progress`, `Blocked`, `Confirm reopen`, `Cancel`.

### Durumlar
#### Error
"Work status could not be changed. Try again."

**Spec:** [09](../../specs/09-work-lifecycle/spec.md), [25](../../specs/25-kanban/spec.md).

## 09.15 · Change Work type
> Feature'a giriş veya Feature'dan çıkışta etkiyi önizlemek; kapsanan İş, sağlık geçmişi veya `Primary spec` varken çıkışı engellemek.

**Artboard'lar**
- `09.15 · Change Work type · Blocked exit · 1440`
- `09.15 · Change Work type · Entering Feature · 1440`

### Impact preview
Eski → yeni tür, etkilenen kapsanan İşler, Feature health geçmişi, `Primary spec`.
- **Label'lar:** `Impact preview`, `Type for {Work key}`, `Feature`, `Included Work`, `Feature health`, `Primary spec`, `Confirm type change`, `Detach`.

### Durumlar
#### Blocked exit
Çıkış engelli: `Detach included Work, Feature health history, and Primary spec before leaving Feature.`; her kalem için `Detach`.
#### Entering Feature
Feature'a girişte yalnız bilgilendirici önizleme ve `Confirm type change`.
#### Error
"Work type could not be changed. Try again."

**Spec:** [09](../../specs/09-work-lifecycle/spec.md).

## 09.16 · Merge as duplicate
> Kopya İşi önizlemeyle tek yaşayan kayda birleştirmek; alan çatışmalarını ve ilişkileri açıkça çözmek.

**Artboard'lar**
- `09.16 · Merge as duplicate · Field conflicts · 1440`
- `09.16 · Merge as duplicate · Ready · 1440`
- `09.16 · Merge as duplicate · Relations · 1440`

### Hedef ve yaşayan kayıt
Birleştirilecek İş, yaşayan kayıt seçimi.
- **Label'lar:** `Merge {Work key}`, `Surviving record`, `Merge Preview`, `Confirm Merge`, `Edit selection`.

### Field conflicts
Her çatışan alanda iki değer ve seçim.
- **Label'lar:** `Field conflicts`, `Choose a value`, `Use surviving record`, `Use duplicate`, `Fields without conflicts`, `Empty`. Kapanış gerekçesi satırı `Closure reason` kapanış adımındaki `Reason` değerinin kendisidir.
- **Label'lar (ek):** `Closure reason`.

### Relations
Taşınacak ilişkiler listesi (boş metin `No relations yet.` → `20.10`); her satırda düzeltme eylemi: kopyanın kaynak ucu için `Rewrite source`, kopyaya giden hedef ucu için `Rewrite target`, birleştirme sonrası kendine dönen ilişki için `Remove self relation`, kopya Feature altındaki İş bağı için `Rewrite Included in`.
- **Label'lar:** `Relations`, `Rewrite source`, `Rewrite target`, `Remove self relation`, `Rewrite Included in`.

### Durumlar
#### Field conflicts
Çatışan alanlar çözülene kadar `Confirm Merge` pasif.
#### Ready
Çatışma yok; önizleme tamam, `Confirm Merge` etkin.
#### Relations
Taşınacak ilişkiler satır düzeltmeleriyle listelenir.
#### Error
"Work could not be merged. Try again."
#### Merged receipt
09.10 Durumlar › Merged key ("Origin: LUMA-12 → LUMA-42" + `Undo`); geri alınamıyorsa "This Work merge is no longer available for Undo."

**Spec:** [09](../../specs/09-work-lifecycle/spec.md).

## 09.17 · Recreate in another Project
> Yanlış Projedeki İşi taşımadan hedef Projede yeni kimlik ve anahtarla yeniden oluşturmak.

**Artboard'lar**
- `09.17 · Recreate in another Project · Default · 1440`
- —

### Hedef Proje
Kaynak İş ve hedef Proje seçimi.
- **Label'lar:** `Recreate {Work key}`, `Project`.

### Portable content
Tek tek seçilen alanlar; varsayılan başlık, tür, açıklama, hafif checklist. Taşınmayanlar (durum, kapanış, tarih tipli alanlar, planlama, GitHub, geçmiş) gri açıklamayla listelenir.
- **Label'lar:** `Portable content`, `Title`, `Type`, `Description`, `Checklist`.

### Portable relations
Taşınabilir ilişkiler tek tek.
- **Label'lar:** `Relations`, `Related`.

### Recreate preview
Yeni anahtar yer tutucusu, `Not Started`, kaynak değişmez notu.
- **Label'lar:** `Recreate preview`, `Confirm`.

### Durumlar
#### Error
"Work could not be recreated. Try again."

**Spec:** [09](../../specs/09-work-lifecycle/spec.md).

## 09.18 · Duplicate Work
> Mevcut İşi şablona çevirmeden aynı Projede bir kez kopyalamak.

**Artboard'lar**
- `09.18 · Duplicate Work · Default · 1440`
- —

### Kopya önizlemesi
Başlık (düzenlenebilir), kopyalanacaklar (tür, açıklama, tarih dışı özel alanlar, checklist), kopyalanmayacaklar (geçmiş, ilişkiler, kapanış, durum, planlama, bütün mutlak tarihler).
Bütün mutlak tarihler, tarih tipli özel alan değerleri dahil, kopyalanmaz. Eylem satırı: onay `Duplicate Work`, `Cancel`.
- **Label'lar:** `Duplicate Work`, `Title`, `Type`, `Description`, `Checklist`, `Custom fields`, `Cancel`.

### Durumlar
#### Error
"Work could not be duplicated. Try again."; "Check the Work title."

**Spec:** [17 İş Şablonları](../../specs/17-work-templates/spec.md).

## 09.19 · Convert to independent Work
> Büyüyen checklist maddesini aynı Projede kökeni korunan tam İşe dönüştürmek.

**Artboard'lar**
- `09.19 · Convert to independent Work · Default · 1440`
- —

### Önizleme
Başlık, Proje, başlangıç durumu; köken açıklaması (kaynak İş ve madde).
- **Label'lar:** `Convert to independent Work`, `Title`, `Project`, `Start status`, `Origin`, `Origin Location`, `Confirm convert`, `Cancel`. Üretilen İşte köken gösterimi → 09.10 › Converted from checklist item.

### Durumlar
#### Loading
Önizleme hazırlanıyor.
#### Error
"Conversion preview could not be loaded. Try again.", "Work could not be converted. Try again."

**Spec:** [18 Kontrol Listeleri](../../specs/18-work-checklists/spec.md).

## 09.20 · Record Action run
> Adlandırılmış Record Action'ı tek İş üzerinde açıkça başlatmak, kesin farkı önizlemek ve tek atomik sonuç uygulamak.

**Artboard'lar**
- `09.20 · Record Action run · Start · 1440`
- `09.20 · Record Action run · Preview · 1440`
- `09.20 · Record Action run · Runtime inputs · 1440`
- `09.20 · Record Action run · Finalizing · 1440`

### Başlatma
Seçilen Kayıt Eylemi yalnız açık `Start` ile başlar: girdi yoksa doğrudan `Preview changes`'a, girdi varsa `Runtime inputs` adımına götürür. Arka planda çalıştırma yoktur; örnek eylem `Start Work`.
- **Label'lar:** `Start`, `Start Work`.

### Runtime inputs
Tasarımda tanımlı `Date`, `Number`, `Select` veya `Related Work` girdileri.
- **Label'lar:** `Record Action inputs`, `Runtime inputs`, `Choose a value`, `Related Work`, `Change inputs`.

### Preview changes
Seçilen girdiler ve hedef kaydın alan farkı: alan, mevcut değer, yeni değer.
- **Label'lar:** `Preview changes`, `Inputs selected`, `Runtime inputs selected`, `Changes`, `Current value`, `In Daily Focus`, `Not in Daily Focus`, `Apply`.

### Durumlar
#### Preparing
`Preparing preview…`
#### Finalizing
Commit sonrası `Finalizing`; iptal yok.
#### Applied
Receipt ve `Undo` (`Preparing Undo…`); geri alınamazsa açıklama.
#### Error
Neyin yazılıp yazılmadığını açıklayan hata ve `Retry` (aynı anahtar).
#### Stale revision
Apply sırasında kayıt değişmişse bütün eylem reddedilir, hiçbir adım yazılmaz: `Conflict`, `Current value`, `This page is out of date.` (→ 20.14 › Conflict); `Change inputs` ile yeniden önizleme.

**Spec:** [21 Kayıt Eylemleri](../../specs/21-record-actions/spec.md).

## 09.21 · Mark blocker resolved
> Blokaj ilişkisini çözüm tarihi ve isteğe bağlı notla `Resolved` yapmak; ilişki geçmişte kalır.

**Artboard'lar**
- `09.21 · Mark blocker resolved · Default · 1440`
- `09.21 · Mark blocker resolved · History · 1440`
- `09.21 · Mark blocker resolved · History after Undo · 1440`

### Çözüm formu
İlişki özeti, çözüm tarihi, isteğe bağlı not. Çözme ve yeniden etkinleştirme sonrası makbuzda `Undo` (→ 20.14).
- **Label'lar:** `Mark blocker resolved`, `Resolution date`, `Note`, `Confirm resolution`, `Undo`, `Cancel`.

### Blocker history
Aynı ilişkinin `Active` → `Resolved` → `Active` geçmişi tarihleriyle. Geri alınmış geçişte `Undo` işareti; `Reactivate blocker` geri alınınca özgün `Resolution date` geri yüklenmiş görünür.
- **Label'lar:** `Blocker history`, `Active`, `Resolved`, `Reactivate blocker`, `Undo`, `Resolution date`.

### Durumlar
#### Resolve suggested
Blokajı kaynağı olan Karar veya Açık Soru çözüldüğünde (veya kaynak İş kapandığında) ilişki `Active` kalır; kayıtta görünür öneri çıkar, ilişkiyi kendiliğinden kapatmaz. 09.10 › Source closed suggestion buraya bağlanır.
#### Error
"Blocker could not be resolved.", "Blocker could not be reactivated."

**Spec:** [19 Blokajlar](../../specs/19-blockers/spec.md).

## 09.22 · Not now
> Açık İş veya Feature için gerekçeli `Not now` izi kaydetmek, değiştirmek veya `Reconsidering` ile kapatmak; durum ve plan yazmadan.

**Artboard'lar**
- `09.22 · Not now · Form · 1440`
- `09.22 · Not now · Preview · 1440`
- `09.22 · Not now · History · 1440`

### Kayıt formu
Gerekçe, yeniden değerlendirme koşulu ve dayanak kayıtlar.
- **Label'lar:** `Not now`, `Reason`, `Re-evaluation condition`, `Supporting records`, `Preview`, `Confirm Not now`.

### Önizleme
Kaydedilecek değerler; durum, öncelik, Backlog sırası, ufuk ve tarihlerin değişmediği notu; değiştirmede veya `Reconsidering` ile kapatmada `Review later` etkisi (`Keep Review later` / `Remove Review later`).
- **Label'lar:** `Keep Review later`, `Remove Review later`, `Review later reminders`.

### History
Etkin ve eski izler; yazar, zaman; değiştirilen iz `Replaced`.
- **Label'lar:** `History`, `Replaced`, `Reconsidering`, `by You`.

### Durumlar
#### Active mark
İşaret: `Not now: Waiting for Stripe API v2 GA`; tıklanınca bu dialog.
#### No supporting records
"No supporting records."
#### Error
"Not now could not be saved."; "Check the Not now details."

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md).

## 09.23 · Start Handoff
> İşte test-dışı dış yürütme için Dış yürütme devri başlatmak ve seçilen kesin sürümlerden donmuş gidiş paketi üretmek.

**Artboard'lar**
- `09.23 · Start Handoff · Default · 1440`
- —

### Form
Devir amacı, yürütücü, beklenen çıktı, kısıtlar, sürümler ve izinli bağlantılar.
- **Label'lar:** `Start Handoff`, `Purpose`, `Executor`, `Expected output`, `Constraints`, `Selected versions`, `Permitted external links`, `Include this Work`, `Add selected version`, `Remove selected version`, `GitHub context` (izinli GitHub kimlikleri).

### Paket önizlemesi
Okunabilir Markdown: üretim zamanı, İş anahtarı, devir kimliği, `Source of truth is in the app`; serbest metin uyarısı.
- **Label'lar:** `Source of truth is in the app`, `Free text is copied as entered and is not scanned for secrets. Review the package before sharing.`, `Going package produced`, `Going package copied`, `Going package`, `Package version`, `Produced at`, `Related Decision, Risk, and Open Question`, `Active blockers`, `Copy going package`.

### Durumlar
#### Error
"Check the handoff details."; "Going package could not be copied."; "Going package was copied, but its Work history could not be recorded."; `This handoff could not be written.`

**Spec:** [24 Dış Yürütme Devirleri](../../specs/24-external-handoffs/spec.md).

## 09.24 · External Execution Handoff
> Tek devrin donmuş gidiş paketini, dönüşünü ve geçmişini İş üzerinden göstermek; dönüş kaydı, `Reconcile` ve `Cancel Handoff` buradan başlar.

**Artboard'lar**
- `09.24 · External Execution Handoff · Open · 1440`
- `09.24 · External Execution Handoff · Result returned · 1440`
- `09.24 · External Execution Handoff · Canceled · 1440`

### Devir başlığı
Devir amacı, yürütücü, durum ve sonraki eylemler.
- **Label'lar:** `External Execution Handoff`, `Open`, `Result returned`, `Reconciled`, `Canceled`, `Reconcile`, `Cancel Handoff`.

### Gidiş paketi
Donmuş Markdown ve sürüm listesi; sonraki paket sürümleri tarihli, `New package version` gönderilmiş kopyayı ezmez.
`Selected versions`, `Source of truth is in the app` ve `Package version` etiketleri → 09.23 › Paket önizlemesi.
- **Label'lar:** `New package version`.

### Dönüş
Dönüş formu veya kaydı.
- **Label'lar:** `Record return`, `Executor summary`, `Changed assumptions`, `Produced evidence`, `Permitted external links`, `Open questions`.

### Handoff history
Devir olayları kronolojik; hepsi `You` ile, içerik veya gerekçe metni olmadan (iptal gerekçesi geçmişe girmez, yalnız devirde `Reason` görünür).
- **Label'lar:** `Handoff history`, `Handoff started`, `Going package produced`, `Going package copied`, `Return recorded`, `Handoff reconciled`, `Handoff canceled`, `You`.

### Durumlar
#### Open
Dönüş formu boş; sinyal yok.
#### Result returned
Dönüş görünür; `Reconcile` birincil.
#### Reconciled / Canceled
Salt okunur; iptalde `Reason` görünür; yeniden açma yok.
#### Error
"Check the return details."; `This handoff could not be written.`

**Spec:** [24 Dış Yürütme Devirleri](../../specs/24-external-handoffs/spec.md).

## 09.25 · Reconcile
> Dönen sonucu önizlemeyle İş gerçeğine bağlamak: aynı Projedeki İşlere kesin ilişkiler ve açıkça seçilen takip İşleri.

**Artboard'lar**
- `09.25 · Reconcile · Preview · 1440`
- —

### Proposed relations
Aynı Projedeki İşlere önerilen kesin ilişkiler; `Related Work` seçici yalnız aynı Projenin arşivsiz diğer İşlerini sunar (sahip İş ve arşivli İş yok).
- **Label'lar:** `Proposed relations`, `Related Work`, `Related`, `Origin`, `Blocks`, `Blocked by`, `Add proposed relation`, `Remove proposed relation`.

### Follow-up Work
Açıkça seçilen takip İşleri. Ortak önizleme ve onay (tek İş oluşturma, kaynağı değiştirmeme) → 20.22 (kaynak satırı: Reconcile); burada yalnız seçim girişi.
- **Label'lar:** `Follow-up Work`, `Add follow-up Work`, `Remove follow-up Work`.

### Önizleme ve onay
Fark önizlemesi ve karar eylemleri.
- **Label'lar:** `Review each relation and Follow-up Work before confirming.`, `Preview changes`, `Reconcile`, `Reject`.

### Durumlar
#### Error
Seçilen parça kullanılamaz olduysa hiçbiri yazılmaz; açıklama. Genel yazma hatası `This handoff could not be written.`
#### Preview changed
Önizleme kimliği bayatsa onay verilemez: `Preview changed. Review it again.`.

**Spec:** [24 Dış Yürütme Devirleri](../../specs/24-external-handoffs/spec.md).

## 09.26 · Cancel Handoff
> Devri zorunlu gerekçeyle `Canceled` yapmak; geçmiş ve paket kalır.

**Artboard'lar**
- `09.26 · Cancel Handoff · Default · 1440`
- —

### Form
Zorunlu iptal gerekçesi.
- **Label'lar:** `Cancel Handoff`, `Reason`.

### Durumlar
#### Error
"Check the cancellation reason."; `This handoff could not be written.`

**Spec:** [24](../../specs/24-external-handoffs/spec.md).

## 09.27 · Edit axis values
> Haritadaki bir İşin iki eksen ölçüt değerini açık eylemle düzenlemek.

**Artboard'lar**
- `09.27 · Edit axis values · Default · 1440`
- —

### Değerler
Noktaya bağlı popover'da iki eksen değeri.
- **Label'lar:** `Edit axis values for {Work key}`, `Horizontal axis`, `Vertical axis`, `Unevaluated`, `Save`. Kademeler → 08.19 › Rank descriptions.

### Durumlar
#### Error
"Priority metric value could not be saved."

**Spec:** [20 Önceliklendirme](../../specs/20-priority/spec.md).

## 09.28 · Place on plan
> Planlanmamış adayı plana alırken değişecek tarih veya ufuk alanını önizleyip açıkça onaylamak.

**Artboard'lar**
- `09.28 · Place on plan · Preview · 1440`
- —

### Yerleşim
Ufuk ve tarih alanları, değişiklik önizlemesi.
- **Label'lar:** `Place {Work key} on plan`, `Horizon`, `Now`, `Next`, `Later`, `Planned start`, `Target date`, `Clear date`, `Preview`, `Confirm`.

### Durumlar
#### Error
"Check the form."; "Choose a calendar date."

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md).

## 09.29 · Milestone
> Kilometre Taşını oluşturmak/düzenlemek ve İşi `Contributes to Milestone` ile önizleyerek bağlamak.

**Artboard'lar**
- `09.29 · Milestone · Create · 1440`
- `09.29 · Milestone · Edit · 1440`
- `09.29 · Milestone · Link Work · 1440`

### Alanlar
Kilometre Taşı başlığı, açıklaması, hedef tarihi ve durumu. `Edit` formu mevcut değerlerle dolu açılır (`Edit Milestone`, → 09.4 › Milestones). Durum yalnız gösterilir; geçiş `Reach` / `Abandon` açık eylemleriyle olur (→ 09.4), form durumu elle seçtirmez. Ortak başlık eylemleri (`Export` dahil) → DS.11 → `20.5`; `Import` bu tek kayıt ekranında yoktur. Türe bağlı Proje özel alanları: satır ve boş değer kuralı → DS.12.
- **Label'lar:** `Create Milestone`, `Edit Milestone`, `Milestone`, `Title`, `Description`, `Target date`, `No target date`, `Planned`, `Reached`, `Abandoned`, `Reach`, `Abandon`, `Save`, `Cancel`, `Custom fields` (satır ve `Not evaluated` boş değer kuralı → DS.12).

### Bağlı İşler
Bağlı İşler ve önizlemeli bağlama formu.
- **Label'lar:** `Work in {Milestone}`, `In Milestone`, `Contributes to Milestone`, `Preview relation`, `Confirm relation`. Önizleme metni ve ilişki seçici → 20.10 › Seçici (`Review the relation preview before confirming.`).

### Durumlar
#### Create
Boş form; `Planned` başlangıç durumu.
#### Edit
Form mevcut değerlerle dolu.
#### Link Work
Bağlı İşler ve önizlemeli bağlama formu.
#### Error
"Check the form."; "This action could not be completed."

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md).

## 09.30 · Work completed
> Kullanıcı başlatmalı İş başarısını sunucu `Completed` kabulünden sonra bir kez göstermek: her zaman `Work completed` bildirimi, açıksa Bitiriş efekti.

**Artboard'lar**
- `09.30 · Work completed · Effect on · 1440`
- `09.30 · Work completed · Reduce Motion · 1440`
- `09.30 · Work completed · Effect off · 1440`

### Bildirim
Ekranın sabit bildirim alanında 10 sn: durum ikonu, metin, `Reopen`. `Reopen` 09.14 onay adımını açar; kapanış sonucunu sessizce silmez.
- **Label'lar:** `Work completed`, `Reopen`.

### Efekt katmanı
İş başlığı veya kart çevresinde en fazla 1,2 sn dekoratif katman; hesapta seçili tema/palet (örnek `Calm` · `Haze`); odak ve girdiyi almaz. Ayarlar → `01.7 · Completion effects` › Başlık.

### Durumlar
#### Effect off
Yalnız bildirim.
#### Reduce Motion
Katman yok; bildirim, ikon ve kibar ekran okuyucu duyurusu kalır.
#### Not eligible
`Abandoned`, kontrol listesi maddesi tamamlama, PR merge, otomasyon, PR-merge kuralı, Reconcile, Daily Focus kapama (`04.2` `Close focus`), Odak Dönemi kapama (`04.4` `Close`), Kilometre Taşı ulaşma (09.29 `Reach`), Proje veya aşama tamamlama ve Proje Sürümü yayımlama: efekt yok (otomasyonda 09.10 › Automation applied).
#### Wait period
İlk efektten sonraki 30 saniye içinde gelen yeni başarılar yalnız bildirim alır.
#### Rejected / conflict / undo
Hiçbir şey oynamaz. Kapatma sonucu kendi yüzeyinde gösterilir.
#### Low performance
Dekoratif katman atlanır, bildirim aynı hızda gelir.
#### Efekt kuralları
Katman yalnız kapatılan İşin satırı ya da kartı çevresinde oynar, en fazla 1,2 sn sürer; odağı çalmaz, girdiyi yakalamaz, kaydırmayı ve gezinmeyi engellemez, yüzey değişince temizlenir. Ses, titreşim ve flaş yoktur. Bildirimin katmandan bağımsız okunması Light ve Dark ayrı doğrulanır (→ DS.0 #4, DS.1); %200 ölçekte de aynı. Bildirim Merkezine kayıt düşmez.

**Spec:** [23 Bitiriş Efektleri](../../specs/23-completion-effects/spec.md), [09](../../specs/09-work-lifecycle/spec.md).
