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
- **Label'lar:** `Board`, `List`, `In Progress count`, `Focus threshold`, `Sort by`, `Work number`, `Ascending`.

### Durum sütunları
`Not Started`, `In Progress`, `Blocked`, `Closed`. Her sütun başlığında ad, kart sayısı, `Soft WIP` tanımlıysa sayı/sınır ve `Collapse` kontrolü. Kartlar kayıtlı görünümün sırasıyla dizilir; bağımsız manuel kart sırası yoktur.
- **Label'lar:** `Not Started`, `In Progress`, `Blocked`, `Closed`, `Collapse`, `Expand`, `Soft WIP`, `Over limit`.

### İş kartı
Kayıtlı görünümün görünür alanları; varsayılan sıra: İş anahtarı + tür, başlık, durum ve varsa kapanış sonucu, öncelik ölçütü değerleri, planlanan başlangıç / hedef / yeniden görünme tarihi, blokaj veya risk işareti, kontrol listesi ilerlemesi, aktif kartta durumda geçen süre, varsa `Not now` işareti.
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
Görünüm çubuğunda nötr `Focus threshold exceeded` uyarısı; hareket engellenmez.
#### Column collapsed
`Closed` daraltılmış: dar şerit ad, sayı ve `Open blocker` gibi önemli sinyalleri korur; `Expand` ile açılır. Filtre değildir.
#### Dragging
Sürüklenen kart ve hedef sütun vurgusu; ekran okuyucu duyurusu hedef sütunu söyler.
#### Drop on Closed
Bırakma anında 09.13 açılır; iptal kartı önceki sütuna döndürür.
#### Reappear date backgrounded
Gelecek `Reappear date` taşıyan İş varsayılan tahtada görünmez; tarih bugün veya geçmişse kart `Reappear date 2026-10-22` ile görünür, durum değişmez.
#### Multi-select
Kart seçim kutuları işaretlenince üstte seçim çubuğu: seçili sayı ve `Bulk Edit` girişi (→ 20 · `Bulk Edit`). Dialog burada çizilmez.
#### Work completed
Kapatma sunucuda `Completed` kabul edilince kartın çevresinde efekt katmanı ve `Work completed` bildirimi (→ 09.30).

**Spec:** [25 Kanban](../../specs/25-kanban/spec.md), [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [19 Blokajlar](../../specs/19-blockers/spec.md), [26 Backlog](../../specs/26-backlog/spec.md) (`Reappear date`), [22 Toplu Düzenleme](../../specs/22-bulk-editing/spec.md) (yalnız seçim girişi).

## 09.2 · Work List
> Board ile aynı filtrelenmiş İş taramasını, planlanmamış İşler dahil, yoğun satır düzeninde sunmak.

**Artboard'lar**
- `09.2 · Work List · Default · 1440`
- `09.2 · Work List · Default · 768`
- `09.2 · Work List · Archived filter · 1440`
- `09.2 · Work List · Multi-select · 1440`

### Work alanı başlığı ve görünüm çubuğu
09.1 ile aynı; `List` seçili. `Archived` filtresi var.
- **Label'lar:** `Board`, `List`, `In Progress count`, `Focus threshold`, `Archived`.

### İş satırları
Seçim kutusu, İş anahtarı, başlık, tür, durum + kapanış sonucu, `Time in status`, öncelik ölçütü değerleri, planlanan başlangıç / hedef / `Reappear date`, blokaj/risk, checklist ilerlemesi, `Not now` işareti.
- **Label'lar:** `List Work`, `Open source record`, `Open blocker`, `Not now`.

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
Seçili satırlar ve `Bulk Edit` girişi (→ 20 · `Bulk Edit`).
#### Many items
Uzun liste sabit kolon hizasıyla kayar; başlık satırı yapışkan.

**Spec:** [25 Kanban](../../specs/25-kanban/spec.md) (`List`), [09](../../specs/09-work-lifecycle/spec.md) (`Archive` filtresi), [29](../../specs/29-roadmap-horizon/spec.md) (`Not now` işareti), [22](../../specs/22-bulk-editing/spec.md) (seçim girişi).

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
`Backlog sort` seçimi; `Priority` seçiliyken `Priority criterion`, `Field` seçiliyken `Field to sort by`; kayıtlı sunum kontrolleri.
- **Label'lar:** `Backlog sort`, `Manual order`, `Priority`, `Date`, `Field`, `Priority criterion`, `Field to sort by`, `Title`, `Status`, `Saved presentation`, `Save presentation`, `Use saved presentation`.

### Sıralı liste
Her satırda sürükleme tutamacı (yalnız `Manual order`'da), sıra numarası, İş anahtarı, başlık, durum, varsa `Not now` işareti, `Reappear date` seçici.
- **Label'lar:** `Drag {Work title}`, `Reappear date`, `Clear`, `Not now`, `Open source record`.

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
`Priority` seçili: tutamaçlar gizli, satırlar ölçüt değerine göre; ölçüt değeri olmayanlar `Unevaluated` ile sonda. `Manual order` seçilince eski sıra geri gelir.
#### Reorder announcement
Klavye taşıması sırasında canlı duyurular: "Picked up {Work}.", taşıma, bırakma ve "Moving {Work} was cancelled."
#### Save failures
"Backlog order could not be saved. Try again.", "Backlog presentation could not be saved. Try again.", "Reappear date could not be saved. Try again." — ilgili satırın veya çubuğun yanında.
#### Reappear date arrived
Tarihi bugün olan İş Deferred'dan çıkıp kayıtlı konumuna döner; Proje `Notify on Reappear date` açıksa tek `reappear-date` sinyali Bildirim Merkezinde görünür (→ 00).

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
Adlandırılmış görünüm seçimi, birincil kapsam (`Product direction` / `All Work types`), grup/lane alanı, işaret alanı, `Presentation Mode`.
- **Label'lar:** `Roadmap`, `Product direction`, `All Work types`, `Horizon`, `Type`, `Status`, `No filter`, `Presentation Mode`.

### Roadmap kanvası
`Now`, `Next`, `Later` lane'leri; planlanan başlangıç + hedefi olan İş aralık, yalnız hedefi olan İş nokta; `Product direction` görünümünde Research İşinin `Problem/Opportunity` ve `Expected Outcome` metni birincil, ona `Origin` ile bağlı Feature İşi ikincil; Kilometre Taşları tarih işaretleri; aktif blokaj rozeti; viewport kontrolleri.
- **Label'lar:** `Now`, `Next`, `Later`, `No horizon`, `Primary`, `Secondary`, `Problem/Opportunity`, `Expected Outcome`, `Blocked by`, `Zoom in`, `Zoom out`, `Fit View`, `Roadmap canvas`.

### Planlama listesi
Kanvasla aynı İşler; her satırda `Horizon` seçimi ve tarih alanları; `Not now` işareti.
- **Label'lar:** `Horizon`, `Now`, `Next`, `Later`, `No horizon`, `Target date`, `Save`, `Saving…`, `Not now`.

### Unplanned candidates
Varsayılan daraltılmış; görünüm filtrelerine uyan fakat tarihi ve ufku olmayan İşler.
- **Label'lar:** `Unplanned candidates`, `Place {Work key} on plan`.

### Milestones
Proje Kilometre Taşları: başlık, hedef tarih, durum, bağlı İş sayısı (`In Milestone`).
- **Label'lar:** `Milestones`, `Create Milestone`, `Planned`, `Reached`, `Abandoned`, `Reach`, `Abandon`, `In Milestone`, `No Milestone yet.`

### Durumlar
#### Empty
Kanvasın yerinde planlı İş yoksa dürüst boş durum ve açık `Unplanned candidates`; "No Work yet." İş hiç yoksa.
#### Loading
`Loading Roadmap…`
#### Error
"Roadmap is unavailable. Reload and try again."; viewport hatası "Roadmap viewport could not be fitted."
#### Blocker badge selected
Rozet seçili: engellenen `LUMA-58` ile kaynak `LUMA-63` vurgulu; diğer öğeler sakinleşir; ağ çizilmez.
#### Unplanned candidates expanded
Bölüm açık, aday satırları görünür.
#### All Work types view
Bütün türler birincil; Research/Feature ayrımı yok.

**Spec:** [29 Roadmap Ufku](../../specs/29-roadmap-horizon/spec.md), [19 Blokajlar](../../specs/19-blockers/spec.md) (rozet).

## 09.5 · Roadmap Presentation Mode
> Mevcut adlandırılmış Roadmap görünümünü düzenleme ve yapılandırma araçları olmadan tam ekran sunmak.

**Artboard'lar**
- `09.5 · Roadmap Presentation Mode · Default · 1440`
- `09.5 · Roadmap Presentation Mode · Detail open · 1440`

### Sunum kanvası
09.4 kanvasıyla aynı görünüm ve konum; düzenleme, ufuk seçimi, liste, `Unplanned candidates` yok.
- **Label'lar:** `Presentation Mode`, `Exit Presentation Mode`, `Zoom in`, `Zoom out`, `Fit View`.

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
Yatay ve dikey eksen ölçüt seçimleri (ilk iki etkin ölçüt başlangıç), kanıt sinyali anahtarı.
- **Label'lar:** `Horizontal axis`, `Vertical axis`, `Show evidence signals`.

### Harita düzlemi
Beş kademeli iki eksen (`Very low` … `Very high`); her nokta İş anahtarı ve kısa başlık; kanıt sinyali açıksa yanında `Feedback`, `Unique Contact`, `Unique Company` sayıları. Çeyrek etiketi yoktur.
- **Label'lar:** `Work by selected criteria`, `Very low`, `Low`, `Medium`, `High`, `Very high`, `Feedback`, `Unique Contact`, `Unique Company`, `Not now`.

### Unevaluated
En az bir eksen değeri olmayan İşler.
- **Label'lar:** `Unevaluated`, `Unevaluated Work`, `No unevaluated Work.`

### Durumlar
#### Empty
Ölçüt yoksa: "No priority metrics yet." ve Yapılandırma modu bağlantısı (→ 08); İş yoksa "No Work yet."
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
Feature yoksa yalnız kök Proje ve dürüst tek satır açıklama (spec'te label yok); sahte ağaç çizilmez.
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
- `09.10 · Work Detail · Bug · 1440 · Dark`
- `09.10 · Work Detail · Feature · 1440`
- `09.10 · Work Detail · Empty context section · 1440`
- `09.10 · Work Detail · Closed Abandoned · 1440`
- `09.10 · Work Detail · Archived · 1440`
- `09.10 · Work Detail · Relation preview · 1440`
- `09.10 · Work Detail · Automation suggestion · 1440`

### Kayıt başlığı
İş anahtarı, başlık, tür, durum (+ kapanış sonucu), eylem satırı ve taşma menüsü. Altında varsa `Not now` işareti ve köken satırı.
<details>
<summary>Label'lar</summary>

`Work`, `Feature`, `Bug`, `Task`, `Research`, `Improvement`, `Not Started`, `In Progress`, `Blocked`, `Closed`, `Completed`, `Abandoned`, `Copy Context as Markdown`, `Record Action`, `Start Work`, `Not now`, `Archive`, `Unarchive`, `Duplicate Work`, `Merge as duplicate`, `Recreate in another Project`.

</details>

### Durum ve planlama alanları
Tür seçimi, durum seçimi, planlanan başlangıç, hedef tarih, `Reappear date`, hafif efor, Roadmap ufku. Bug'ın gözlendiği sürümler alanı Bağlam Kartındaki `Affected Releases` bölümünde düzenlenir.
- **Label'lar:** `Type`, `Status`, `Close`, `Reopen`, `Planned start`, `Target date`, `Reappear date`, `Horizon`, `Now`, `Next`, `Later`.

### Öncelik ölçütü değerleri
Her etkin ölçüt ayrı satır; değer veya `Unevaluated`. Toplam veya skor yok.
- **Label'lar:** `Priority metrics for {Work key}`, `Very low`, `Low`, `Medium`, `High`, `Very high`, `Unevaluated`.

### Özel alanlar
İş türüne bağlı Proje özel alanları; boş değer `Not evaluated` olarak `False`'tan ayrı.
- **Label'lar:** `Custom fields`, `Custom field`, `Not evaluated`, `True`, `False`.

### İş Bağlam Kartı
Üstte `Why am I doing this work?` zinciri; altında İş türünün hazır bölümleri Proje düzenindeki sırayla; gizli bölümler `Add Context` menüsünde. Bölüm öğeleri kaynağından canlıdır ve durumu ile kaynağı açar.
<details>
<summary>Label'lar</summary>

`Work Context Card`, `Why am I doing this work?`, `Add Context`, Bug bölümleri `Observed/Expected Behavior`, `Affected Releases`, `Evidence`, `GitHub & Tests`; Feature `Problem/Opportunity`, `Expected Outcome`, `Evidence & Decisions`, `Risks & Open Questions`, `Included Work`, `GitHub & Tests`, `Target Release`; Task `Description`, `Dependencies`, `GitHub & Tests`, `Target Release`; Research `Research Question`, `Sources & Evidence`, `Decisions`, `Related Work`; Improvement `Current Situation`, `Expected Outcome`, `Evidence`, `GitHub & Tests`.

</details>

### Kontrol listesi
Maddeler: tamamlama kutusu, metin, sırala/sil; dönüştürülmüş madde yeni İşe bağlantıyla görünür; altta yeni madde alanı.
- **Label'lar:** `Checklist`, `Item`, `Checklist for {Work key}`, `New item for {Work key}`, `Move item {n} up`, `Move item {n} down`, `Delete item {n}`, `Convert to independent Work`.

### Dış yürütme devirleri
İşteki devirler kronolojik; her satırda amaç, yürütücü, durum, başlangıç tarihi.
- **Label'lar:** `External Execution Handoff`, `Start Handoff`, `View Handoffs`, `Open`, `Result returned`, `Reconciled`, `Canceled`.

### İlişkiler ve blokajlar
Gruplar: blokajlar (`Blocked by`, `Blocks`, her biri `Active`/`Resolved`), standart ilişkiler (`Related`, `Origin`, `Derived`, `Included in`, `Contributes to Milestone`), kırık uçlar ortak sunumla. Ayrı `Used in` bölümü: ilişki geri bağlantıları ve kullanım bağları iki grup.
<details>
<summary>Label'lar</summary>

`Relations`, `Relation type`, `Related`, `Related Work`, `Origin`, `Derived`, `Blocks`, `Blocked by`, `Includes`, `Included in`, `Contributes to Milestone`, `In Milestone`, `Active`, `Resolved`, `Mark blocker resolved`, `Reactivate blocker`, `Blocker history`, `Resolution date`, `Remove relation`, `Undo`, `Used in`, `Open source record`, `Archived`, `In Trash`, `Permanently deleted`, `Redacted for security`, `No access`.

</details>

### Ekler
İşe bağlı dosya ekleri listesi.
- **Label'lar:** → `20 · Shared Dialogs & States` › File attachments.

### Priority Foundations
Hedef, tarih, blokaj, risk, Kilometre Taşı, Geri Bildirim, Karar, Kaynak, efor ve ölçüt değerleri kaynaklarına bağlı; tıklanabilir sayılar. Skor yok.
- **Label'lar:** `Priority Foundations`, `Show {label} source records ({count})`, `Feedback`, `Unique Contact`, `Unique Company`, `Archived`.

### Geçmiş
İşin olağan değişiklik geçmişi: durum ve sütun hareketleri, kapanış/yeniden açma (önceki sonuç korunur), devir olayları, otomasyon değişiklikleri (kural, tanım sürümü, tetikleyici), `Not now` izi.
- **Label'lar:** `History`, `You`, `Handoff started`, `Going package produced`, `Going package copied`.

### Durumlar
#### Loading
`Loading Work…`
#### Error / not found
"Work is unavailable. Try loading this page again."; bulunamayan kayıt → 20 not found.
#### Feature
`LUMA-51`: Bağlam Kartında `Included Work` (kapsanan İşler, türetilen ilerleme `0/1`), `Feature health` güncellemeleri (`On Track` / `At Risk` / `Off Track` + kısa gerekçe, yazar, zaman; kronolojik), `Primary spec` belgesi; `Dependencies` bağlantısı salt okunur görünüm olarak.
#### Bug
`LUMA-42` (varsayılan artboard): `Affected Releases` çoklu seçim ve Bug bölümleri.
#### Empty context section
Görünür boş bölüm: "Nothing here yet." ve tek ekle/bağla eylemi; uyarı rengi veya eksiklik sayısı yok.
#### Closed · Completed / Closed · Abandoned
Durum `Closed`, sonuç metinli; gerekçe varsa altında; `Reopen` görünür.
#### Archived
Başlık altında `Archived` bandı ve `Unarchive`; planlama alanları salt okunur görünür, kimlik ve anahtar aynı.
#### Merged key
Emekli anahtarla açılan kayıt yaşayan kayda yönlenir; üstte "Origin: LUMA-12 → LUMA-42" ve kısa süreli `Undo`.
#### Recreated
Yeni İşte kaynağını gösteren köken satırı (`Origin` → `TIDE-9`); kaynak İş tidekit'te değişmeden kalır, eski anahtar yeni İşe yönlenmez.
#### Relation preview
İlişki eklerken iki uç ve tür önizlenir: "Review the relation preview before confirming."; onay sonrası `Undo · …` receipt.
#### Source closed suggestion
Blokaj kaynağı kapanınca ilişki `Active` kalır; yanında görünür çözüm önerisi ve `Mark blocker resolved`; otomatik çözülmez.
#### Automation suggestion
Hazır PR-merge kuralı kapalı ve bütün `Required for completion` PR'lar merge edilmişse GitHub bölümünde öneri: `Mark as Completed` (→ 09.13 kapatma adımı, sonuç `Completed` seçili gelir).
#### Automation applied
Arayüz açıkken otomasyon İşi değiştirdiyse tek sonuç bildirimi, 10 saniye `Undo`; Bitiriş efekti oynamaz.
#### Copy Context as Markdown
Panoya kopyalandı toast'ı; hata "Context could not be copied." Kopyalanan Markdown üretim zamanını, okunur kaynak kimliklerini/bağlantılarını ve `Primary source is in the app` notunu içerir; sır, erişilemeyen alan ve özel Dosya Eki baytı içermez.
#### Work completed
→ 09.30.
#### Offline
Yazma kontrolleri pasif; → 20 `You're offline`.
#### Long content
Uzun başlık iki satıra kırılır; çok sayıda ilişki grupta "show all" ile kısalır.

**Spec:** [09 İş Yaşam Döngüsü](../../specs/09-work-lifecycle/spec.md), [16 İş Bağlam Kartı](../../specs/16-work-context/spec.md), [10](../../specs/10-custom-fields/spec.md), [12](../../specs/12-relations/spec.md), [18](../../specs/18-work-checklists/spec.md), [19](../../specs/19-blockers/spec.md), [20](../../specs/20-priority/spec.md), [21](../../specs/21-record-actions/spec.md), [24](../../specs/24-external-handoffs/spec.md), [26](../../specs/26-backlog/spec.md), [29](../../specs/29-roadmap-horizon/spec.md), [17](../../specs/17-work-templates/spec.md), [23](../../specs/23-completion-effects/spec.md), [62](../../specs/62-work-automation/spec.md).

## 09.11 · Create Work
> Projede yalnız başlıkla İş oluşturmak; form bağlantı varken kişisel `Draft` olarak otomatik korunur.

**Artboard'lar**
- `09.11 · Create Work · Default · 1440`
- `09.11 · Create Work · Offline · 1440`
- `09.11 · Create Work · Resumed Draft · 1440`

### Form başlığı
`Create` başlığı, otomatik kayıt durumu, `Create from template` girişi.
- **Label'lar:** `Create`, `Draft`, `Saving…`, `Ready`, `Draft saved.`, `Last saved`, `Create from template`.

### Alanlar
Başlık (tek zorunlu), tür, açıklama; altında İş'e bağlı özel alanlar.
- **Label'lar:** `Title`, `Type`, `Description`, `Custom fields`, `Not evaluated`, `Text`, `Number`, `Boolean`, `Date`, `Single select`, `Multi select`.

### Eylem satırı
Birincil `Create`.
- **Label'lar:** `Create`, `Creating…`.

### Drafts özeti
Kişisel Draft'lar; başlık veya `Untitled Draft`, son kayıt zamanı, sürdür/sil.
- **Label'lar:** `Drafts`, `Untitled Draft`, `Draft resumed.`, `Draft deleted.`, `No Drafts yet.`, `Loading Drafts…`

### Durumlar
#### Empty
Boş form; `No Drafts yet.`
#### Saving
`Saving…` sessiz durum metni.
#### Offline
Bağlantı kopunca: `Last saved 14:32` ve `Unsaved changes may be lost`; yerel kuyruk yok. Yeniden bağlanınca gizli tekrar yok (→ 20 offline).
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
Başlık alanı, tür, açıklama iskeleti, seçili alan varsayılanları, hafif kontrol listesi, çözülmüş tarihler.
- **Label'lar:** `Title`, `Type`, `Description`, `Selected field defaults`, `Checklist`, `Relative dates`, `Creation day`, `Planned start`, `Target`, `Resolved dates preview`, `Not set`.

### Durumlar
#### Empty
Şablon yoksa Yapılandırma modu bağlantısı (→ 08).
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
- **Label'lar:** `Reopen {Work key}`, `Not Started`, `In Progress`, `Blocked`, `Reopen`, `Cancel`.

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
- **Label'lar:** `Impact preview`, `Type for {Work key}`, `Feature`, `Included Work`, `Feature health`, `Primary spec`, `Confirm`.

### Durumlar
#### Blocked exit
Çıkış engelli; neyin ayrılması gerektiği listelenir.
#### Entering Feature
Feature'a girişte yalnız bilgilendirici önizleme ve `Confirm`.
#### Error
"Work type could not be changed. Try again."

**Spec:** [09](../../specs/09-work-lifecycle/spec.md).

## 09.16 · Merge as duplicate
> Kopya İşi önizlemeyle tek yaşayan kayda birleştirmek; alan çatışmalarını ve ilişkileri açıkça çözmek.

**Artboard'lar**
- `09.16 · Merge as duplicate · Field conflicts · 1440`
- `09.16 · Merge as duplicate · Ready · 1440`

### Hedef ve yaşayan kayıt
Birleştirilecek İş, yaşayan kayıt seçimi.
- **Label'lar:** `Merge {Work key}`, `Surviving record`, `Merge Preview`.

### Field conflicts
Her çatışan alanda iki değer ve seçim.
- **Label'lar:** `Field conflicts`, `Empty`.

### Relations
Taşınacak ilişkiler listesi.
- **Label'lar:** `Relations`, `No relations yet.`

### Durumlar
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
- **Label'lar:** `Duplicate Work`, `Title`, `Type`, `Description`, `Checklist`, `Custom fields`.

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
- **Label'lar:** `Convert to independent Work`, `Title`, `Project`, `Start status`, `Origin`, `Confirm convert`.

### Durumlar
#### Loading
Önizleme hazırlanıyor.
#### Error
"Conversion preview could not be loaded. Try again.", "Work could not be converted. Try again."

**Spec:** [18 Kontrol Listeleri](../../specs/18-work-checklists/spec.md).

## 09.20 · Record Action run
> Adlandırılmış Record Action'ı tek İş üzerinde açıkça başlatmak, kesin farkı önizlemek ve tek atomik sonuç uygulamak.

**Artboard'lar**
- `09.20 · Record Action run · Preview · 1440`
- `09.20 · Record Action run · Runtime inputs · 1440`
- `09.20 · Record Action run · Finalizing · 1440`

### Runtime inputs
Tasarımda tanımlı `Date`, `Number`, `Select` veya `Related Work` girdileri.
- **Label'lar:** `Record Action inputs`, `Runtime inputs`, `Choose a value`, `Related Work`, `Change inputs`.

### Preview changes
Seçilen girdiler ve hedef kaydın alan farkı: alan, mevcut değer, yeni değer.
- **Label'lar:** `Preview {action}`, `Inputs selected`, `Runtime inputs selected`, `Changes`, `Current value`, `In Daily Focus`, `Not in Daily Focus`, `Apply`.

### Durumlar
#### Preparing
`Preparing preview…`
#### Finalizing
Commit sonrası `Finalizing`; iptal yok.
#### Applied
Receipt ve `Undo` (`Preparing Undo…`); geri alınamazsa açıklama.
#### Error
Neyin yazılıp yazılmadığını açıklayan hata ve `Retry` (aynı anahtar).

**Spec:** [21 Kayıt Eylemleri](../../specs/21-record-actions/spec.md).

## 09.21 · Mark blocker resolved
> Blokaj ilişkisini çözüm tarihi ve isteğe bağlı notla `Resolved` yapmak; ilişki geçmişte kalır.

**Artboard'lar**
- `09.21 · Mark blocker resolved · Default · 1440`
- `09.21 · Mark blocker resolved · History · 1440`

### Çözüm formu
İlişki özeti, çözüm tarihi, not.
- **Label'lar:** `Mark blocker resolved`, `Resolution date`, `Confirm resolution`, `Cancel`.

### Blocker history
Aynı ilişkinin `Active` → `Resolved` → `Active` geçmişi tarihleriyle.
- **Label'lar:** `Blocker history`, `Active`, `Resolved`, `Reactivate blocker`.

### Durumlar
#### Resolve suggested
Blokajı kaynağı olan Karar veya Açık Soru çözüldüğünde ilişki `Active` kalır; kayıtta çözüme dair görünür bir öneri çıkar, ilişkiyi kendiliğinden kapatmaz.
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
Kaydedilecek değerler; durum, öncelik, Backlog sırası, ufuk ve tarihlerin değişmediği notu; değiştirmede `Review later` etkisi.
- **Label'lar:** `Keep Review later`, `Remove Review later`, `Review Later reminders`.

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
- **Label'lar:** `Start Handoff`, `Purpose`, `Executor`, `Expected output`, `Constraints`, `Selected versions`, `Permitted external links`.

### Paket önizlemesi
Okunabilir Markdown: üretim zamanı, İş anahtarı, devir kimliği, `Source of truth is in the app`; serbest metin uyarısı.
- **Label'lar:** `Source of truth is in the app`, `Free text is copied as entered and is not scanned for secrets. Review the package before sharing.`, `Going package produced`, `Going package copied`.

### Durumlar
#### Error
"Check the handoff details."; "Going package could not be copied."; "Going package was copied, but its Work history could not be recorded."

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
Donmuş Markdown ve sürüm listesi; sonraki paket sürümleri tarihli.
- **Label'lar:** `Selected versions`, `Source of truth is in the app`.

### Dönüş
Dönüş formu veya kaydı.
- **Label'lar:** `Record return`, `Executor summary`, `Changed assumptions`, `Produced evidence`, `Permitted external links`, `Open questions`.

### Handoff history
Devir olayları kronolojik.
- **Label'lar:** `Handoff history`, `Handoff started`, `Going package produced`, `Going package copied`, `You`.

### Durumlar
#### Open
Dönüş formu boş; sinyal yok.
#### Result returned
Dönüş görünür; `Reconcile` birincil.
#### Reconciled / Canceled
Salt okunur; iptalde `Reason` görünür; yeniden açma yok.
#### Error
"Check the return details."

**Spec:** [24 Dış Yürütme Devirleri](../../specs/24-external-handoffs/spec.md).

## 09.25 · Reconcile
> Dönen sonucu önizlemeyle İş gerçeğine bağlamak: aynı Projedeki İşlere kesin ilişkiler ve açıkça seçilen takip İşleri.

**Artboard'lar**
- `09.25 · Reconcile · Preview · 1440`
- —

### Proposed relations
Aynı Projedeki İşlere önerilen kesin ilişkiler.
- **Label'lar:** `Proposed relations`, `Related Work`, `Related`, `Origin`, `Blocks`, `Blocked by`, `Add proposed relation`, `Remove proposed relation`.

### Follow-up Work
Açıkça seçilen takip İşleri.
- **Label'lar:** `Follow-up Work`, `Add follow-up Work`, `Remove follow-up Work`.

### Önizleme ve onay
Fark önizlemesi ve karar eylemleri.
- **Label'lar:** `Review each relation and Follow-up Work before confirming.`, `Preview changes`, `Reconcile`, `Reject`.

### Durumlar
#### Error
Seçilen parça kullanılamaz olduysa hiçbiri yazılmaz; açıklama.

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
"Check the cancellation reason."

**Spec:** [24](../../specs/24-external-handoffs/spec.md).

## 09.27 · Edit axis values
> Haritadaki bir İşin iki eksen ölçüt değerini açık eylemle düzenlemek.

**Artboard'lar**
- `09.27 · Edit axis values · Default · 1440`
- —

### Değerler
Noktaya bağlı popover'da iki eksen değeri.
- **Label'lar:** `Edit axis values for {Work key}`, `Horizontal axis`, `Vertical axis`, `Very low`, `Low`, `Medium`, `High`, `Very high`, `Unevaluated`, `Save`.

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
- `09.29 · Milestone · Link Work · 1440`

### Alanlar
Kilometre Taşı başlığı, açıklaması, hedef tarihi ve durumu.
- **Label'lar:** `Create Milestone`, `Milestone`, `Title`, `Description`, `Target date`, `No target date`, `Planned`, `Reached`, `Abandoned`, `Save`.

### Bağlı İşler
Bağlı İşler ve önizlemeli bağlama formu.
- **Label'lar:** `Work in {Milestone}`, `In Milestone`, `Contributes to Milestone`, `Preview relation`, `Confirm relation`, `Review the relation before confirming.`

### Durumlar
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
Ekranın sabit bildirim alanında 10 sn: durum ikonu, metin, `Reopen`.
- **Label'lar:** `Work completed`, `Reopen`.

### Efekt katmanı
İş başlığı veya kart çevresinde en fazla 1,2 sn dekoratif katman; hesapta seçili tema/palet (örnek `Calm` · `Haze`); odak ve girdiyi almaz. Ayarlar → `01 · Account` › Completion effects.

### Durumlar
#### Effect off
Yalnız bildirim.
#### Reduce Motion
Katman yok; bildirim, ikon ve kibar ekran okuyucu duyurusu kalır.
#### Not eligible
`Abandoned`, otomasyon, PR-merge kuralı, Reconcile: efekt yok (otomasyonda 09.10 › Automation applied).
#### Wait period
İlk efektten sonraki 30 saniye içinde gelen yeni başarılar yalnız bildirim alır.
#### Rejected / conflict / undo
Hiçbir şey oynamaz. Kapatma sonucu kendi yüzeyinde gösterilir.
#### Low performance
Dekoratif katman atlanır, bildirim aynı hızda gelir.
#### Efekt kuralları
Katman yalnız kapatılan İşin satırı ya da kartı çevresinde oynar, en fazla 1,2 sn sürer; odağı çalmaz, girdiyi yakalamaz, kaydırmayı ve gezinmeyi engellemez, yüzey değişince temizlenir. Ses, titreşim ve flaş yoktur. Dark ve %200 ölçekte bildirim katmandan bağımsız okunur. Bildirim Merkezine kayıt düşmez.

**Spec:** [23 Bitiriş Efektleri](../../specs/23-completion-effects/spec.md), [09](../../specs/09-work-lifecycle/spec.md).
