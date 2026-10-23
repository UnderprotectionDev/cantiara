# 08 · Project Shell & Overview

Tek bir Projenin kabuğu ve Proje düzeyi yüzeyler: başlık, Overview, yapılandırma, geçmiş ve kapanış.

| Ekran | Ne çizilir |
|---|---|
| [08.1 · Project Shell](#081--project-shell) | Proje başlığı, Proje navigasyonu, içerik alanı |
| [08.2 · All Tools](#082--all-tools) | on alanlık Proje alanı kataloğu |
| [08.3 · Project Overview](#083--project-overview) | `Purpose`/`Lifecycle`, alanlar, modül ızgarası |
| [08.4 · Return to Work](#084--return-to-work) | `Next concrete step`, geri dönüş kartları, olaylar |
| [08.5 · Tour the visual changes](#085--tour-the-visual-changes) | Roadmap üstünde tur paneli |
| [08.6 · Project Goals](#086--project-goals) | Hedef listesi ve detayı, `Live summary` |
| [08.7 · Value Chain](#087--value-chain) | Hedeften Sürüme dallı zincir |
| [08.8 · Project History](#088--project-history) | `Story Timeline` ve `Project Activity` |
| [08.9 · Project Updates](#089--project-updates) | tarihli güncelleme listesi ve form |
| [08.10 · Closure Summary Draft](#0810--closure-summary-draft) | kaynak seçimi, önizleme, taslak penceresi |
| [08.11 · Tags](#0811--tags) | etiket formları, liste, etiketli İşler |
| [08.12 · Smart Collections](#0812--smart-collections) | koleksiyon listesi ve seçili görünüm |
| [08.13 · Configuration Mode](#0813--configuration-mode) | host sütunu ve `Project areas` paneli |
| [08.14 · Configuration · Stages](#0814--configuration--stages) | aşama satırları |
| [08.15 · Configuration · Work statuses](#0815--configuration--work-statuses) | dört sabit durum satırı |
| [08.16 · Configuration · Custom fields](#0816--configuration--custom-fields) | alan tanımları, ekleme formu, `Trash` |
| [08.17 · Configuration · Work Templates](#0817--configuration--work-templates) | şablon listesi, form, tarih önizlemesi |
| [08.18 · Configuration · Record Actions](#0818--configuration--record-actions) | eylem listesi ve adım formu |
| [08.19 · Configuration · Priority metrics](#0819--configuration--priority-metrics) | ölçüt listesi, `Add metric`, çöp |
| [08.20 · Configuration · Saved views](#0820--configuration--saved-views) | sıralama ve iki eşik satırı |
| [08.21 · Configuration · Work Context Card layout](#0821--configuration--work-context-card-layout) | bölüm listesi ve `Layout preview` |
| [08.22 · Configuration · Backlog](#0822--configuration--backlog) | tek bildirim onay kutusu |
| [08.23 · Configuration · Automation rules](#0823--configuration--automation-rules) | kural listesi, form, dry run |
| [08.24 · Build in Public](#0824--build-in-public) | yayın ayarları ve `Review publish diff` |
| [08.25 · Copy project structure](#0825--copy-project-structure) | taşınır/taşınmaz önizleme penceresi |
| [08.26 · Archive Project](#0826--archive-project) | arşiv etki önizlemesi penceresi |
| [08.27 · Archive view](#0827--archive-view) | arşivli Projeler ve ayrıntı |
| [08.28 · Delete Project](#0828--delete-project) | silme sonuçları önizlemesi penceresi |

## 08.1 · Project Shell
> Kurucuya hangi Projede olduğunu, kısa kodunu ve Proje navigasyonunu gösterip seçili Proje yüzeyini tek çerçevede açmak.

**Artboard'lar**
- `08.1 · Project Shell · Default · 1440`
- `08.1 · Project Shell · Default · 768`
- `08.1 · Project Shell · First-open explanation · 1440`
- `08.1 · Project Shell · Blank Project · 1440`
- `08.1 · Project Shell · Loading · 1440`
- `08.1 · Project Shell · Error · 1440`
- `08.1 · Project Shell · Archived (Ferry) · 1440`

### Proje başlığı
`Projects` geri bağlantısı; Proje adı ve yanında yaşam durumu rozeti; tek satırlık açıklama ("A durable home for this Project’s work and context."); `Short code` ve `Starter Configuration` okunur bilgi çifti; alt şeritte "Separate Project structure from daily Work editing." ve `Configuration Mode` düğmesi.
- **Label'lar:** `Projects`, `Short code`, `Starter Configuration`, `Configuration Mode` / açıkken `Exit Configuration Mode`; yaşam durumu `Active`, `Pending`, `Completed`, `Abandoned`.

### Proje navigasyonu
Proje alanları, pinli girişler, `All Tools`, `Tags`, `Smart Collection` ve `Configuration Mode` girişinin tamamı [Navigation](00-shared-shell.md#0011--navigation) bölgesinde tek ve eksiksiz tanımlıdır. Bu ekran Projeye özgü başlığı ve içerik alanını çizer; gezinmeyi yeniden tarif etmez.

### İçerik alanı
Seçili yüzey: varsayılan 08.3 Overview; `All Tools` → 08.2; `Tags` → 08.11; `Smart Collection` → 08.12; diğer alanlar kendi sayfalarında çizilir.

### İlk açılış açıklaması
Yalnız ilk açılışta, içerik alanının üstünde kapatılabilir not: seçilen Başlangıç yapılandırmasının hangi varsayımları neden getirdiği ve nereden değiştirilebileceği. Örnek içerik üretmez, tur değildir.
- **Label'lar:** `Starter Configuration applied once`; kapat düğmesi.

### Durumlar
#### Loading
Başlık ve navigasyon iskeleti; içerikte `Loading…`.
#### Error
`Project is unavailable.` ve yeniden deneme; navigasyon çizilmez.
#### Blank Project navigasyonu
Yeni `Blank Project`: navigasyonda yalnız `Overview`, `Tags`, `Smart Collection`, `All Tools`, `Work`, `Documents`; ayırıcı ve pinli alan yok.
#### Gizlenmiş alan
`Discovery` gizlendiğinde navigasyondan düşer; `All Tools`'ta `Hidden` olarak kalır. Kayıtlar silinmez.
#### İlk açılış açıklaması açık
Yukarıdaki not görünür hâlde.
#### Archived / read-only (Ferry)
Ferry · `Abandoned` rozeti yanında arşiv işareti; başlığın altında salt okunur şerit: Proje arşivde, GitHub eşitlemesi, otomasyonlar, hatırlatmalar ve normal düzenleme durdu; yalnız erişimi azaltan güvenlik eylemleri açık. `Configuration Mode` düğmesi pasif; bütün yüzeyler okunur, yazma denetimleri gizli. Şeritte arşivden çıkarmanın GitHub bağlantısını örtük açmadığı notu ve GitHub yeniden bağlama yönlendirmesi. Ayrıntı → 08.27.
#### Offline
→ `20.16 · Offline`.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md), [83 Project Retirement](../../specs/83-project-retirement/spec.md) (arşiv durumu).

## 08.2 · All Tools
> Etkin veya henüz pinlenmemiş bütün hazır Proje alanlarını tek keşif yüzeyinde, görünürlük durumu ve `Pin to navigation` eylemiyle göstermek.

**Artboard'lar**
- `08.2 · All Tools · Default · 1440`
- `08.2 · All Tools · Blank Project · 1440`

### Başlık
Başlık ve tek cümle: her hazır alan burada keşfedilebilir; alanı etkinleştirmek içerik üretmez.
- **Label'lar:** `All Tools`.

### Alan kataloğu
Kapalı on alan, sabit sırada; her satırda alan adı, durum, eylemler.
- **Label'lar:** `Work`, `Documents`, `Discovery`, `Decisions`, `Design`, `Technical Diagrams`, `Tests`, `Releases`, `Production`, `GitHub`; durum `Enabled`, `Hidden`, `Available`; eylemler `Enable {area}`, `Show`, `Hide`, `Pin to navigation`, `Remove pin`, pinli alanda `Move {area} up` / `Move {area} down`.

### Durumlar
#### Blank Project
`Work`, `Documents` `Enabled`; diğer sekizi `Available` ve `Enable {area}` ile.
#### Hidden alan
Satır `Hidden`, eylem `Show`.
#### Error
Değişiklik yazılamazsa satırın altında hata; durum eski hâlinde kalır.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md).

## 08.3 · Project Overview
> Projenin amacını, yaşam durumunu ve kaynak kayıtlarını nötr, sayıları kaynak kümeye açılan modüllerle özetlemek; sağlık skoru üretmemek.

**Artboard'lar**
- `08.3 · Project Overview · Default · 1440`
- `08.3 · Project Overview · Default · 768`
- `08.3 · Project Overview · Empty (Blank Project) · 1440`
- `08.3 · Project Overview · Loading · 1440`
- `08.3 · Project Overview · Module error · 1440`

### Başlık
`Overview` başlığı; "A neutral view of this Project’s source records. Empty sections stay empty until a source record exists."; Favori ve hatırlatma denetimleri.
- **Label'lar:** `Overview`.

### Purpose ve Lifecycle
İki okunur özet.
- **Label'lar:** `Purpose`, `Lifecycle`; boşsa `No Purpose recorded yet.`

### Project areas
Proje Kabuğundan okunan görünür alanlar, adları ve girişleriyle.
- **Label'lar:** `Project areas`, alt not "Visible entries from Project Shell"; boşsa `No Project areas are visible yet.`

### Modüller
Kapalı katalog, bu sırayla: `Goals`, `Stages`, `Milestones`, `Work`, `Documents`, `Decisions`, `Risks`, `Tests`, `Production`, `Blockers`, `Dates`, `Recent changes`. Her modülde başlık, sayı, birkaç kaynak satırı.
- **Label'lar:** Modül adları; sayı bağlantısı `Open source record`; boş metinler `No Project Goals recorded yet.`, `No active stages recorded yet.`, `Work`/`Documents` için `No sample content was created.`, diğerleri `No source records yet.`

### Return to Work
Modüllerin altında 08.4 bölümü olduğu gibi gömülü.

### Yapılandırma özeti
Sessiz okunur listeler: `Stages`, `Work statuses`, `Saved views`; aşama yoksa `No stages prepared.`

### Durumlar
#### Empty (yeni Blank Project)
`Purpose` boş metni; modüller kendi boş metinleriyle, sayı yok; uydurulmuş satır yok.
#### Loading
Modül başlıkları yerinde, satırlar yerine yükleniyor metni.
#### Error
Kaynak okunamayan modül kendi yerinde hata satırı gösterir; diğer modüller çalışır.
#### Many items
Modül en fazla birkaç satır gösterir; kalan sayı bağlantısında.
#### Archived (Ferry)
Aynı modüller okunur; başlıkta arşiv şeridi (08.1).

**Spec:** [08 Project Overview](../../specs/08-project-overview/spec.md), [37 Goals](../../specs/37-goals/spec.md) (`Goals` girişi), [36 Return to Work](../../specs/36-return-to-work/spec.md) (alt bölüm).

## 08.4 · Return to Work
> Ara verdikten sonra güncel kayıtlardan seçilmiş az sayıda gerekçeli geri dönüş kartı, tek `Next concrete step` ve son ziyaretten bu yana olayları göstermek.

**Artboard'lar**
- `08.4 · Return to Work · Default · 1440`
- `08.4 · Return to Work · First visit · 1440`
- `08.4 · Return to Work · Empty · 1440`
- `08.4 · Return to Work · Error · 1440`

### Başlık
Başlık ve not: "Up to five cards from current records. Recent activity covers the last seven days; upcoming dates cover today and the next seven days."
- **Label'lar:** `Return to Work`.

### Next concrete step
Bu Projenin tek etkin ipucu metni; kaynak, son güncelleme zamanı.
- **Label'lar:** `Next concrete step`, `Save` (kaydederken `Saving…`), başarı `Next concrete step saved.`, hata `Next concrete step could not be saved. Try again.`, sınır `Next concrete step must be 4000 characters or fewer.`, `Open source record`.

### Geri dönüş kartları
En fazla beş kart; her kartta kaynak adı, gerekçe(ler) "·" ile, `Open source record`.
- **Label'lar:** Gerekçeler `Recently edited`, `Recently viewed`, `Upcoming date`, `Open risk`, `Pending GitHub development signal`, `Long in the same status`; boşsa `No return cards yet.`

### Since you last looked
Son görünür açılıştan bu yana olaylar, sabit grup sırasında; boş gruplar gizli. Her satır güncel kaynak adı, olay etiketi, Hesap biçiminde zaman, `Open source record`. Grup bloğunun üstünde destekli görsel hedef varsa `Tour the visual changes`.
<details>
<summary>Label'lar</summary>

`Since you last looked`; gruplar `Work`, `Decisions`, `Risks`, `Documents`, `GitHub`, `Publish`; olaylar `Work created`, `Work updated`, `Decision recorded`, `Decision updated`, `Risk recorded`, `Risk updated`, `Document created`, `Document updated`, `GitHub development signal`, `Project Release published`; `Tour the visual changes`.

</details>

### Durumlar
#### İlk ziyaret
`Since you last looked` altında `Changes will appear after your next visit.`
#### Değişiklik yok
`No changes since your last visit.`
#### Empty
Kart yok: `No return cards yet.`; `Next concrete step` boş alan olarak.
#### Loading
`Loading…`
#### Error
`Return to Work is unavailable. Try loading it again.` ve `Retry`; ziyaret işareti yazılamadıysa `The last visit could not be saved.` ve `Retry`. Güncel kaynak yeniden okunana kadar `Next concrete step` formu gösterilmez.
#### Next concrete step kaydediliyor / hata
Alan ve `Save` kilitli `Saving…`; hata alanın yanında kalır, metin korunur.
#### Archived (Ferry)
Kartlar okunur; `Next concrete step` salt okunur metin, `Save` yok.

**Spec:** [36 Return to Work](../../specs/36-return-to-work/spec.md), [34 Smart Collections](../../specs/34-smart-collections/spec.md) (uzun durum hazır görünümü).

## 08.5 · Tour the visual changes
> `Since you last looked` kümesindeki görsel hedefli olayları sırayla vurgulayıp oraya götürmek; kayıp hedefi gerekçesiyle atlamak.

**Artboard'lar**
- `08.5 · Tour the visual changes · Roadmap target · 1440`
- `08.5 · Tour the visual changes · Skipped target · 1440`
- `08.5 · Tour the visual changes · Cap reached · 1440`

### Tur paneli
Kaynak adı, olay etiketi ve zamanı, neden gösterildiği; ilerleme (ör. 2 / 3); üst sınır aşılırsa kalan sayısı.
- **Label'lar:** `Tour the visual changes`, `Next change`, `Close tour`, `Open remaining changes in list`, `Tour complete.`, `Loading visual change…`; atlama gerekçeleri `Skipped: this target cannot be placed in the current view.`, `Skipped: this target is inaccessible.`, `Skipped: this target was deleted.`

### Durumlar
#### Atlanan hedef
Önceki vurgu kalkar, panelde atlama gerekçesi.
#### Tamamlandı
`Tour complete.` ve `Close tour`.
#### Üst sınır
Kalan sayısı ve `Open remaining changes in list`.
#### Error
Görünüm geri yüklenemez ve sığdırılamazsa toast: "The Roadmap viewport could not be restored or fitted."

**Spec:** [36 Return to Work](../../specs/36-return-to-work/spec.md).

## 08.6 · Project Goals
> Projenin ulaşmak istediği sonucu hafif kayıt olarak tutmak; katkı veren kayıtları ve nötr canlı özeti yüzde veya sağlık hükmü olmadan göstermek.

**Artboard'lar**
- `08.6 · Project Goals · Detail · 1440`
- `08.6 · Project Goals · Detail · 768`
- `08.6 · Project Goals · Empty · 1440`
- `08.6 · Project Goals · New Project Goal · 1440`
- `08.6 · Project Goals · Conflict · 1440`

### Hedef listesi
Başlıklar ve `New Project Goal`.
- **Label'lar:** `Goals`, `Overview`, `New Project Goal`; boşsa `No Project Goals recorded yet.`

### Hedef detayı
Başlık, açıklama, `Intended outcome`, `Observed outcome / learning`; `Edit Project Goal`.
- **Label'lar:** `Project Goal`, `Title`, `Description`, `Intended outcome`, `Observed outcome / learning`, `Edit Project Goal`.

### Contributes to Goal ve Related
Katkı veren İş, Kilometre Taşı, Proje Sürümü satırları kaynak bağlantısı olarak; ayrıca açık `Related` bağları ayrı listede.
- **Label'lar:** `Contributes to Goal`, `Related`, `Relation`, `Record`, `Select record`, `Add contribution`, `Remove contribution`, `Add relation`, `Remove relation`, `Unavailable source record`; boşsa `No contributors yet.`

### Live summary
Katkı veren Research, Feature ve Kilometre Taşı kayıtlarının durum dağılımı; ilişkili açık Risk ve Açık Sorular kaynaklarıyla.
- **Label'lar:** `Live summary`, `Status distribution`, `Open Risks and Open Questions`; boşlar `No contributing Research, Feature, or Milestone records.`, `No related open Risks or Open Questions.`

### New Project Goal / Edit Project Goal
Hedef oluşturma ve düzenleme editörü.
#### Editör
`Title`, `Description` zorunlu; iki sonuç alanı isteğe bağlı; `Save` (`Saving…`), `Cancel`; doğrulama `Enter a Title and Description before saving.`

### Durumlar
#### Empty
`No Project Goals recorded yet.` ve `New Project Goal`.
#### Loading
`Loading Goals…`; özet için `Loading live summary…`
#### Error
`Goals are unavailable.` + `Retry`; detay `Project Goal is unavailable.`; özet `Live summary is unavailable.` + `Retry`.
#### Kaydetme hatası
`Project Goal could not be saved. Retry, or reload to check for changes. Your text is kept here.` + `Retry`.
#### Conflict
`Conflict. Project Goal changed. Cancel and reopen the editor before saving again. Your text is kept here.` ve `Current value`.
#### Archived (Ferry)
Detay okunur; yazma denetimleri gizli.

**Spec:** [37 Goals](../../specs/37-goals/spec.md).

## 08.7 · Value Chain
> Seçilen Proje Hedefinden kanıt, Karar, İş, test ve Proje Sürümüne uzanan hattı yalnız açık ilişkilerden türetip kopukluklarıyla göstermek.

**Artboard'lar**
- `08.7 · Value Chain · Default · 1440`
- `08.7 · Value Chain · Default · 768`
- `08.7 · Value Chain · Gap action · 1440`
- `08.7 · Value Chain · Empty · 1440`

### Hedef seçici
Çapa olarak bir Proje Hedefi.
- **Label'lar:** `Value Chain`.

### Zincir
Hedef → problem/fırsat ve kanıt → Karar → kapsam/İş → GitHub gerçeği → test → Proje Sürümü → Erişim/Sonuç gözlemleri sırasında düğümler, birden fazla dal alt alta; her düğümde kayıt adı, türü, durumu ve onu bağlayan kesin ilişki (`Contributes to Goal` veya diğer açık ilişki) ile neden gösterildiği.

### Not linked to goal
Hedefe bağlanmamış ilgili İş, Karar, kanıt, test, Sürüm parçaları; sistem hedef tahmin etmez.
- **Label'lar:** `Not linked to goal`.

### Durumlar
#### Empty
Projede Hedef yok: Hedef oluşturmak için 08.6'ya giden açıklama.
#### Kırık/erişilemeyen adım
Silinmiş hedef işareti veya içeriksiz erişilemez düğüm; başlık sızmaz.
#### Loading
Hedef seçici yerinde, zincir yerine yükleniyor metni.
#### Error
Zincir okunamazsa bölge içinde hata satırı ve yeniden deneme.

**Spec:** [67 Value Chain](../../specs/67-value-chain/spec.md), [37 Goals](../../specs/37-goals/spec.md) (çapa).

## 08.8 · Project History
> "Ürünün hikâyesi ne?" ve "tam olarak ne değişti?" sorularını iki ayrı yüzeyde cevaplamak: `Story Timeline` ve `Project Activity`.

**Artboard'lar**
- `08.8 · Project History · Story Timeline · 1440`
- `08.8 · Project History · Project Activity · 1440`
- `08.8 · Project History · Project Activity · 768`
- `08.8 · Project History · Cluster expanded · 1440`
- `08.8 · Project History · Empty · 1440`

### Story Timeline
Yalnız önemli gerçekleşmiş olaylar: Karar, Belge, tasarım, İş, ulaşılan Kilometre Taşı, yaşam değişikliği, kod değişikliği, Üretim Olayı, deney/doğrulama sonucu, Proje Sürümü. Vazgeçilen işte gerekçe görünür. Alan düzenlemeleri yok.
- **Label'lar:** `Story Timeline`, `Open source record`.

### Project Activity
Mevcut kayıt geçmişlerinden atomik iz; her satırda kaynak, aktör (kullanıcı, sistem otomasyonu, GitHub), olay türü, zaman, desteklenen alanlarda önceki → sonraki değer. Aynı aktörün aynı kayıttaki beş dakika içindeki güvenli alan düzenlemeleri açılır bir kümede.
- **Label'lar:** `Project Activity`, `What changed?`, `Open source record`; filtre değerleri kaynak türü (`Work`, `Document`, `Decision`, `Risk`, otomasyon, GitHub) ve olay türü (oluşturma, alan değişikliği, durum değişikliği, arşiv, ilişki, otomasyon) — filtre etiketlerinin İngilizcesi spec'te tanımlı değil.

### Durumlar
#### Empty
Yeni Projede hikâye ve etkinlik boş; dürüst boş metin.
#### Cluster expanded
Küme açık: her atomik olay zamanı, önceki–sonraki değeri, kökeni ve geri alma sınırıyla ayrı satırda.
#### Redacted value
Gizli değer yerine redaksiyon işareti (→ `20.7 · Redact`).
#### Loading
Görünüm seçici yerinde, liste yerine yükleniyor metni.
#### Error
Geçmiş okunamazsa liste yerinde hata satırı ve yeniden deneme.

**Spec:** [68 Project History](../../specs/68-project-history/spec.md).

## 08.9 · Project Updates
> Kurucunun tarihli öznel hükmünü (`On Track` / `At Risk` / `Off Track`) kısa anlatı ve o anki özet snapshot'ıyla eklemek; eski güncellemeleri silmemek.

**Artboard'lar**
- `08.9 · Project Updates · List · 1440`
- `08.9 · Project Updates · Create Project Update · 1440`
- `08.9 · Project Updates · Empty · 1440`

### Güncelleme listesi
Her girişte tarih, işaret, anlatı, bağlı kayıtlar (canlı), "o gün görülen" salt okunur snapshot (katlanmış).
- **Label'lar:** `Project Update`, `On Track`, `At Risk`, `Off Track`, `Create Project Update`.

### Create Project Update formu
Üç işaretten biri, kısa anlatı, ilişki seçici, kaydetme anında dondurulacak canlı özet blokları önizlemesi.

### Hatırlatma ayarı
İsteğe bağlı yinelenen `Create Project Update` hatırlatması: düzenlenebilir refleksiyon sorusu, aralık, aç/duraklat/kapat.

### Durumlar
#### Empty
Henüz güncelleme yok; zorunlu ritim dili yok.
#### Form open
Form listenin üstünde açık; altında kaydetme anında dondurulacak canlı özet blokları.
#### Reminder opened from Notification Center
Form, hatırlatma sorusu üstte; atlamak kayıt üretmez.
#### Error
Kaydedilemezse form açık kalır, metin korunur, hata satırı.

**Spec:** [69 Project Updates](../../specs/69-project-updates/spec.md).

## 08.10 · Closure Summary Draft
> Tamamlanan veya vazgeçilen Proje için seçilen kayıtlardan yalnız bölüm başlıkları ve kaynak bağlantıları içeren, kaydedilene kadar kalıcı olmayan taslak üretmek.

**Artboard'lar**
- `08.10 · Closure Summary Draft · Select sources · 1440`
- `08.10 · Closure Summary Draft · Preview · 1440`
- `08.10 · Closure Summary Draft · Draft editor · 1440`

### Kaynak seçimi
Karar, Risk, Proje Sürümü, Belge, Üretim Olayı ve tamamlanmış İş kayıtları, türe göre gruplu onay kutuları.

### Önizleme
Hangi kaynağın hangi başlık altına gireceği; isteğe bağlı nötr tarih karşılaştırması (öne alındı, hedefinde/sonrasında, hâlâ açık).
- **Label'lar:** `Closure Summary Draft`.

### Taslak editörü
Başlık varsayılanı `Project Closure Summary`, tür `General`, Kökeni Ferry; gövdede yalnız başlıklar ve bağlantılar; yorum, sonuç veya başarı cümlesi yok.
- **Label'lar:** `Project Closure Summary`, `General`.

### Durumlar
#### No sources selected
Hiç kaynak seçili değil; önizleme boş, ilerleme yok.
#### Preview
Seçili kaynakların başlık eşlemesi görünür.
#### Draft editing
İkinci adım: düzenlenebilir Markdown taslak.
#### Close without saving
Kayıt oluşmadığını söyleyen onay.
#### Error
Taslak kaydedilemezse pencere açık kalır, taslak korunur, hata satırı.

**Spec:** [70 Project Closure Summary](../../specs/70-project-closure-summary/spec.md).

## 08.11 · Tags
> Çalışma Alanı genelindeki düz etiketleri oluşturmak, bu Projenin İşlerine uygulamak/kaldırmak, etikete göre süzmek ve bir etiketi atomik olarak yeniden adlandırmak.

**Artboard'lar**
- `08.11 · Tags · Default · 1440`
- `08.11 · Tags · Empty · 1440`
- `08.11 · Tags · Renamed with Undo · 1440`

### Başlık
`Tags` ve not: Workspace-wide flat tags classify reachable Work records without (klasör/ilişki/koleksiyon olmadan).
- **Label'lar:** `Tags`.

### Create tag
Ad alanı ve oluşturma düğmesi.
- **Label'lar:** `Name`, `Create tag`; hata `Check the tag name.`, `Tag could not be created.`

### Rename Tag
Yeniden adlandırılacak etiket seçimi ve yeni ad.
- **Label'lar:** `Rename Tag`, `Tag to rename`, `Select a tag`, `New name`; başarı `Tag renamed.` + `Undo`; hata `Tag could not be renamed.`, `Tag is unavailable.`

### All tags ve filtre
Bütün etiketler ve etikete göre süzme.
- **Label'lar:** `All tags`, `Filter by tag`; boş `No tags yet.`, `No matching tags.`

### Tagged Work records
Her İş satırında başlık ve etiketleri; `Apply tag`, satır etiketinde `Remove tag`.
- **Label'lar:** `Tagged Work records`, `Apply tag`, `Select a tag`, `Remove tag`; erişilebilir adlar `Tags for {title}`, `Remove tag {tag} from {title}`; boş `No matching records.`

### Durumlar
#### Empty
`No tags yet.`
#### Loading
`Loading Tags…`, `Loading tagged records…`
#### Error
`Tags could not be loaded. Try loading this page again.`; `Tagged records could not be loaded. Try loading this page again.`; uygulama/kaldırma hataları `Tag could not be applied.`, `Tag could not be removed.`
#### Renamed + Undo
`Tag renamed.` makbuzu ve `Undo`; güvenli değilse `Tag could not be undone safely.` / `Tag could not be undone. Reload this page.`
#### Undo unavailable
`Tag rename is no longer available for Undo.`, `Tag rename could not be undone safely.`, `Tag could not be undone safely.`, `Tag could not be undone. Reload this page.` (→ `20.14`)

**Spec:** [13 Tags](../../specs/13-tags/spec.md).

## 08.12 · Smart Collections
> Koşullardan canlı üyelik türeten koleksiyonları oluşturmak, aynı üyeliği `List`/`Table`/`Gallery` olarak sunmak, aboneliği ve İş koleksiyonlarında `Insights`'ı göstermek.

**Artboard'lar**
- `08.12 · Smart Collections · List · 1440`
- `08.12 · Smart Collections · List · 768`
- `08.12 · Smart Collections · Table · 1440`
- `08.12 · Smart Collections · Gallery · 1440`
- `08.12 · Smart Collections · Insights · 1440`
- `08.12 · Smart Collections · Create · 1440`
- `08.12 · Smart Collections · Named view dirty · 1440`
- `08.12 · Smart Collections · Field change preview · 1440`

### Koleksiyon listesi
Kayıtlı koleksiyonlar ve hazır görünümler.

### Oluşturma formu
Ad, kaynak türü ve koşul alanları.
- **Label'lar:** `Name`, `Source type`, `Work type`, `Document type`, `Status`, `Tag`, `Scope`, `Workspace scope`, `Named view`, `Default`, `List`, `None`, `Save`; hata `Check the form.`, `Smart Collection could not be saved.`, `Project scope is unavailable.`

### Görünüm başlığı ve abonelik
Ad, kaynak türü · sunum, koşul özeti; `Subscribe`, `Notify on leave`.
- **Label'lar:** `Smart Collection`, `Subscribe`, `Notify on leave`, ipucu `Turn on Subscribe first.`, hata `Smart Collection subscription could not be updated.`, `New work`, uyarı `This Work may not appear in this Smart Collection.`

### Records
Üyeler; her satırda kaynak adı, `Membership reason: …`, `Open source record`, sürükleme tutamacı.
- **Label'lar:** `Collection view`, `Records`, `Membership reason`, `Drag {record name}`, `Field change preview`, `No membership is written by this preview.`; boş `No {source type} matches this view.` (ör. `No Work matches this view.`).

### Insights (yalnız İş koleksiyonu)
`Count`, `Status`, `Effort`, `Age`, `Time in status` dağılımları; dilimler `0–7 days`, `8–30 days`, `31+ days`, `Not set`.
- **Label'lar:** `Insights`, `Count`, `Status`, `Effort`, `Age`, `Time in status`, `Show all records`.

### Durumlar
#### Table
Aynı üyelik kolonlu tablo; sunum değişimi durum veya sıra yazmaz.
#### Gallery
İzinli türlerde (Belge, Proje Duvarı, Kullanıcı Akışı, Ekran, Moodboard, Teknik Diyagram, Dosya Eki, Kaynak, Geri Bildirim) önizleme ızgarası. `Spec`.
#### Named view dirty
Görünüm değişince `Unsaved changes` ve `Save`, `Save as`, `Revert`; isteğe bağlı tek cümle `Purpose`. `Spec`.
#### Insights slice selected
Seçili dilim işaretli; kayıtlar o alt kümeye süzülmüş, özetler yeniden hesaplanmış; `Show all records`.
#### Field change preview
Sürüklenen kayıt için alan değişikliği önizlemesi ve `No membership is written by this preview.`
#### Empty
`No Work matches this view.`
#### Error
`Smart Collection is unavailable.`

**Spec:** [34 Smart Collections](../../specs/34-smart-collections/spec.md), [36 Return to Work](../../specs/36-return-to-work/spec.md) (`Long in the same status · Default`).

## 08.13 · Configuration Mode
> Proje yapısını günlük düzenlemeden ayıran görünür sunum durumunu açmak ve yapılandırma host'larını `Project` ve `Work` gruplarında sunmak; varsayılan host `Project areas`.

**Artboard'lar**
- `08.13 · Configuration Mode · Project areas · 1440`
- `08.13 · Configuration Mode · Project areas · 768`
- `08.13 · Configuration Mode · No host selected · 1440`
- `08.13 · Configuration Mode · Restore default navigation · 1440`

### Mod başlığı
Başlık ve "Structure changes stay separate from daily content editing. Entering this mode does not change records, view membership, or Project lifecycle."
- **Label'lar:** `Configuration Mode`.

### Host seçici
`Project` grubu: `Project areas`, `Stages`. `Work` grubu: `Work statuses`, `Custom field`, `Work Template`, `Record Action`, `Priority metrics`, `Saved views`, `Work Context Card layout`, `Backlog`, otomasyon kuralları host'u, Build in Public host'u.
- **Label'lar:** `Project`, `Work` ve host adları; 768 seçicide boş seçenek "Choose a surface to inspect its Project-level controls".

### Project areas paneli
Yardım metni "These controls only change Project navigation; they do not create, move, or delete records."; `Restore default navigation`; on alanın satırları (durum, `Enable`, `Show`/`Hide`, `Pin to navigation`/`Remove pin`, pinli sırada yukarı/aşağı).
- **Label'lar:** `Project areas`, `Restore default navigation`, `Navigation preview`, `Current pinned areas`, `Default pinned areas`, `Confirm`, `Cancel`, `None`, `Enabled`, `Hidden`, `Available`, `Pin to navigation`, `Remove pin`.

### Durumlar
#### Host yok (ilk açılış)
Panel yerine "Choose a surface to inspect its Project-level controls. Daily Work editing stays outside this mode."
#### Restore default navigation preview
Satır içi `Navigation preview`: `Current pinned areas` ve `Default pinned areas` yan yana; `Confirm`, `Cancel`.
#### Mutation error
Panel içinde hata satırı; değerler eski hâlinde.
#### Reload while active
Sayfa yenilense mod açık kalır; çıkışta önceki yüzeye dönülür.
#### Archived (Ferry)
Mod açılamaz (08.1).

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md).

## 08.14 · Configuration · Stages
> Proje aşamalarını eklemek, yeniden adlandırmak, sıralamak, kaldırmak ve her birine beş durumdan birini vermek.

**Artboard'lar**
- `08.14 · Configuration · Stages · Default · 1440`
- `08.14 · Configuration · Stages · Remove preview · 1440`

### Aşamalar
Açıklama: "Stages are independent presentation metadata. Several stages can be Active at once, and removing one does not delete main records." Her satırda ad alanı, `Status`, yukarı/aşağı, `Remove stage`.
- **Label'lar:** `Stage name`, `Add stage`, `Status`, `Save`, `Remove stage`, `Cancel`; durumlar `Not Planned`, `Ready`, `Active`, `Completed`, `Abandoned`; boş `No stages prepared.`

### Durumlar
#### Empty
`No stages prepared.` (Blank Project).
#### Remove preview
Satır içinde "{stage} will leave presentation and filters. Main records are not deleted." ve `Cancel`/onay.
#### Error
Değişiklik yazılamazsa panelde hata satırı; değerler eski hâlinde.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md).

## 08.15 · Configuration · Work statuses
> Dört korunan İş durumu semantiğini silmeden görünen adlarını değiştirmek.

**Artboard'lar**
- `08.15 · Configuration · Work statuses · 1440`
_Ayrı artboard yok._

### Durumlar listesi
Dört sabit satır; her satırda semantik, görünen ad alanı, `Save`, `Soft WIP` alanı. Açıklama: görünen adlar değişir, `Not Started`, `In Progress`, `Blocked`, `Closed` semantiği korunur; yeni durum eklenemez.
- **Label'lar:** `Visible label`, `Save`, `Soft WIP`, `Save Soft WIP`.

### Durumlar
#### Error
Kayıt yazılamazsa satırın altında hata; değer eski hâlinde.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md), [25 Kanban](../../specs/25-kanban/spec.md) (`Soft WIP`).

## 08.16 · Configuration · Custom fields
> Yalnız bu Projede yaşayan özel alan tanımlarını altı kapalı türle oluşturmak ve kayıt türlerine bağlamak.

**Artboard'lar**
- `08.16 · Configuration · Custom fields · Default · 1440`
- `08.16 · Configuration · Custom fields · Add Single select · 1440`
- `08.16 · Configuration · Custom fields · Empty · 1440`

### Tanım listesi
Mevcut özel alan tanımları.
- **Label'lar:** `Custom fields`, `Edit`, `Move to Trash`; boş `No Custom fields yet.`

### Add custom field
Ad, tür, seçim türlerinde seçenekler, kayıt türleri.
<details>
<summary>Label'lar</summary>

`Field name`, `Type` (`Text`, `Number`, `Boolean`, `Date`, `Single select`, `Multi select`), `Options` ("One option per line"), `Record types` ("Choose where this field is available."), `Add custom field` (`Adding…`), `Save`, `Cancel`; notlar "Select options stay with this Project and are not Tags.", "The type cannot change after creation.", "Removing an option clears the stored values that used it."

</details>

### Trash
Çöpteki tanımlar.
- **Label'lar:** `Trash`, `Restore`, `Permanently Delete` (→ `20.3 · Permanently Delete`).

### Durumlar
#### Empty
`No Custom fields yet.` ve `Add custom field` formu.
#### Loading
`Loading Custom fields…`
#### Error
`Custom fields could not be loaded. Try loading this page again.`; `Custom field could not be created.`; `Check the form.`
#### Impact preview
Etkilenen kayıt sayısı ve değerlerin silinmeyip gizleneceği/boşalacağı.

**Spec:** [10 Custom Fields](../../specs/10-custom-fields/spec.md), [07 Project Shell](../../specs/07-project-shell/spec.md) (host).

## 08.17 · Configuration · Work Templates
> Proje kapsamlı yeniden kullanılabilir İş başlangıç bağlamı tanımlamak; göreli tarihleri çözülmüş tarihlerle önizlemek.

**Artboard'lar**
- `08.17 · Configuration · Work Templates · Default · 1440`
- `08.17 · Configuration · Work Templates · Edit with preview · 1440`

### Şablon listesi
Kayıtlı şablonlar ve eylemleri.
- **Label'lar:** `Work Templates`, `Create from template`, `Edit`, `Move to Trash`; boş `No Work Templates yet. Define the first reusable starting point below.`

### Şablon formu
Şablon alanları; `Resolved dates preview`.
<details>
<summary>Label'lar</summary>

`Add Work Template` / `Edit Work Template`, `Name`, `Type`, `Description skeleton` ("Use ordinary Work text. Placeholder syntax is not supported."), `Selected field defaults` (boşsa "Add a non-date Custom field for Work to set a default here."), `Checklist` ("One item per line"), `Relative dates`, `Planned start days from creation`, `Target days from creation`, `Enabled`, `Save changes`, `Cancel`.

</details>

### Resolved dates preview
Göreli tarihlerin çözülmüş hâli.
- **Label'lar:** `Resolved dates preview`, `Creation day`, `Planned start`, `Target`, `Not set`.

### Durumlar
#### Empty
`No Work Templates yet. Define the first reusable starting point below.`
#### Loading
`Loading Work Templates…`
#### Error
`Work Templates could not be loaded. Try loading this page again.`; `Work Template could not be saved.`; `Work Template could not be moved to Trash.`; `Check the Work Template.`

**Spec:** [17 Work Templates](../../specs/17-work-templates/spec.md).

## 08.18 · Configuration · Record Actions
> Kapalı adım kataloğundan tek hedef kayıtta çalışan adlandırılmış birleşik eylemler tanımlamak.

**Artboard'lar**
- `08.18 · Configuration · Record Actions · Default · 1440`
- `08.18 · Configuration · Record Actions · Edit · 1440`

### Eylem listesi
Tanımlı eylemler ve adımları.
- **Label'lar:** `Record Actions`, `Enabled`, `Edit`, `Move to Trash`; boş `No Record Actions yet. Define the first action below.`

### Tanım formu
Ad, adım listesi, adım ekleme.
<details>
<summary>Label'lar</summary>

`Record Action`, `Edit Record Action`, `Name`, `Steps`, `Work status`, `Daily Focus`, `Related Work`, `Custom field`, `Add`, `Remove`, `No change`, `Ask when running`, `Add at run time`, `Remove at run time`, `True`, `False`, `Save`, `Save changes`, `Cancel`; boş `No active Custom fields are available for Work.`

</details>

### Durumlar
#### Empty
`No Record Actions yet. Define the first action below.`
#### Loading
`Loading Record Actions…`
#### Error
`Record Actions could not be loaded. Try loading this page again.`; `Record Action could not be saved.`; `Check the Record Action.`; `Check the Custom field step.`

**Spec:** [21 Record Actions](../../specs/21-record-actions/spec.md).

## 08.19 · Configuration · Priority metrics
> Proje öncelik ölçütlerini ad, kısa açıklama ve beş sabit kademe açıklamasıyla tanımlamak; skor üretmemek.

**Artboard'lar**
- `08.19 · Configuration · Priority metrics · Default · 1440`
- `08.19 · Configuration · Priority metrics · Add metric · 1440`
- `08.19 · Configuration · Priority metrics · Permanent delete · 1440`

### Ölçüt listesi
Tanımlı ölçütler ve etkinlik durumu. Görüşlü Başlangıç yapılandırması varsayılan kapalı bir `Evidence strength` ölçütü sunabilir; kurucu onu etkinleştirir ve kademeyi kendisi seçer.
- **Label'lar:** `Project priority metrics`, `Enabled`, `Disabled`, `Enable`, `Disable`, `Edit`, `Move to Trash`; boş `No priority metrics yet.`

### Add metric
Ad, kısa açıklama ve beş kademe açıklaması; not: "The five ranks stay separate and do not create a score or automatic order."
- **Label'lar:** `Add metric`, `Name`, `Short description`, `Rank descriptions` (`Very low`, `Low`, `Medium`, `High`, `Very high`; "Add a short explanation for each fixed rank, or leave it blank."), `Save`, `Cancel`.

### Priority metric Trash
Çöpteki ölçütler; geri yükleme ve kalıcı silme.
- **Label'lar:** `Priority metric Trash`, `Restore`, `Permanently Delete`; kalıcı silme: `Confirm GitHub Identity` (→ `20.1 · Confirm GitHub Identity`) ve `Type the Project name to confirm`.

### Durumlar
#### Empty
`No priority metrics yet.`
#### Loading
`Loading Priority metrics…`; `Loading the Trash effect…`
#### Error
`Priority metrics could not be loaded. Try loading this page again.`; `Priority metric could not be saved.`; `The Trash effect could not be loaded. Try again before moving this criterion.`
#### Permanent delete
GitHub kimliği onaylı, Proje adı yazılı onay hâli.

**Spec:** [20 Priority](../../specs/20-priority/spec.md).

## 08.20 · Configuration · Saved views
> Board ve List'in ortak kayıtlı sıralamasını, odak eşiğini ve `Long in the same status` eşiğini ayarlamak.

**Artboard'lar**
- `08.20 · Configuration · Saved views · 1440`
_Ayrı artboard yok._

### Sıralama
"Board and List use the same saved sort. Focus threshold is a visual signal and never blocks a Work status move."
- **Label'lar:** `Sort by` (`Work number`, `Title`, `Created`, `Updated`, `Reappear date`), `Sort direction` (`Ascending`, `Descending`).

### Focus threshold
Odak eşiği alanı.
- **Label'lar:** `Focus threshold`, `Save Focus threshold`.

### Long in the same status
"Optional days in the current status. Leave blank to turn off."; 1–10000 tam gün.
- **Label'lar:** `Long in the same status`, `Save Long in the same status`.

### Durumlar
#### Invalid value
Kaydet pasif.
#### Error
Taslak korunur, hata satırı.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md), [36 Return to Work](../../specs/36-return-to-work/spec.md) (durum yaşı eşiği), [25 Kanban](../../specs/25-kanban/spec.md) (`Focus threshold`).

## 08.21 · Configuration · Work Context Card layout
> İş türü başına İş Bağlam Kartı bölümlerini göstermek, gizlemek, sıralamak ve desteklenen kaynaktan özel bölüm eklemek; uygulamadan önce farkı göstermek.

**Artboard'lar**
- `08.21 · Configuration · Work Context Card layout · Default · 1440`
- `08.21 · Configuration · Work Context Card layout · Preview · 1440`
- `08.21 · Configuration · Work Context Card layout · Add custom section · 1440`

### Bölümler
"Configure the same Work Context Card presentation for every Work of a" (türü); seçili türün hazır bölümleri, `Show`/`Hide`, yukarı/aşağı.
- **Label'lar:** `Work type`, `Sections`, `Prepared section`, `Show`, `Hide`, `Preview`.

### Layout preview
Etkilenen türler ve bölüm farkı.
- **Label'lar:** `Layout preview`, `Confirm`, sonra makbuzda `Undo`.

### Add custom section
Desteklenen kaynaktan özel bölüm tanımı; not "Only records reachable from the open Work through the selected catalog".
- **Label'lar:** `Add custom section`, `Section name`, `Record type`, `Relation` (`Related`, `Supports`), `Evidence Role`, `Status condition` (`Any status`), `Condition`.

### Durumlar
#### Preview open
`Layout preview` açık: etkilenen türler ve eklenen/çıkan/taşınan bölümler metinle; `Confirm`.
#### Error
`Preview could not be loaded.`; `Work Context Card layout could not be changed.`; `Work Context Card layout could not be undone.`; `This Work Context Card layout is no longer available for Undo.`

**Spec:** [16 Work Context](../../specs/16-work-context/spec.md).

## 08.22 · Configuration · Backlog
> `Reappear date` geldiğinde bu Proje için bildirim üretilip üretilmeyeceğini seçmek (varsayılan kapalı).

**Artboard'lar**
- `08.22 · Configuration · Backlog · 1440`
_Ayrı artboard yok._

### Bildirim
"Choose whether this Project sends a signal when Work reaches its Reappear date."
- **Label'lar:** `Notify on Reappear date`.

### Durumlar
#### On
Onay kutusu işaretli.
#### Error
Kayıt yazılamazsa onay kutusu eski hâline döner, hata satırı.

**Spec:** [26 Backlog](../../specs/26-backlog/spec.md).

## 08.23 · Configuration · Automation rules
> Kapalı katalogdan tetikleyici, koşul ve eylem kuralları tanımlamak, açıkça etkinleştirmek, dry run ile önizlemek ve hazır PR-merge kuralını yönetmek.

**Artboard'lar**
- `08.23 · Configuration · Automation rules · Default · 1440`
- `08.23 · Configuration · Automation rules · Dry run · 1440`
- `08.23 · Configuration · Automation rules · Conflict · 1440`

### Kural listesi
Hazır kurallar üstte; her kuralda ad, etkin/kapalı, son tanım sürümü.
- **Label'lar:** `When required PRs merge, mark Work Completed`.

### Kural formu
Tetikleyici, isteğe bağlı koşullar, eylem — hepsi kapalı listeden; JS, HTTP veya genel GitHub olayı yok. Hazır PR-merge kuralında açıklama: en az bir `Required for completion` PR ve hepsi merge olunca kapanış `Completed`; kural kapalıyken yalnız `Mark as Completed` önerisi.
- **Label'lar:** `Required for completion`, `Completed`, `Mark as Completed`.

### Dry run
Eşleşen kayıtlar ve önerilen değişiklikler; hiçbir şey yazılmaz; zorunlu değil.

### Tanım geçmişi
Kaydedilmiş sürümler karşılaştırılabilir; eski tanımı geri yüklemek yalnız sonraki çalışmaları etkiler.

### Durumlar
#### Empty
Yalnız hazır kurallar, kapalı.
#### Dry run result
Eşleşen kayıtlar ve önerilen değişiklikler; hiçbir şey yazılmadı.
#### Conflict
Aynı hedef alana çelişen öneriler: hiçbir yazma yapılmadı; kurallar, değerler ve çözüm yolu (Bildirim Merkezinde sinyal olarak da → 00).
#### Failed rule
Kural, özgün tetikleyici, başarısız adım ve uygulanabilir neden (Bildirim Merkezi sinyali → 00).
#### Result toast
Kaynak kayıt değiştiğinde tek sonuç bildirimi ve 10 saniyelik geri alma (→ `20.14 · Write Receipts`).

**Spec:** [62 Work Automation](../../specs/62-work-automation/spec.md).

## 08.24 · Build in Public
> Proje bazında Build in Public'i açmak; kapalı dünya önizlemesinde alanları, herkese açık durum eşlemesini ve üstveri farkını onaylayıp tek Onaylı snapshot revizyonu yayımlamak.

**Artboard'lar**
- `08.24 · Build in Public · Settings · 1440`
- `08.24 · Build in Public · Review publish diff · 1440`
- `08.24 · Build in Public · Unresolved placeholders · 1440`
- `08.24 · Build in Public · Disabled · 1440`

### Durum ve etkinleştirme
Etkinleştirme ve yayın durumu (son onaylı revizyon, `Unpublished changes`).
- **Label'lar:** `Build in Public`, `Unpublished changes`, `Review publish diff`, `Public`, `Private`.

### Public Status Label eşlemesi
İç durum → herkese açık etiket tablosu.
- **Label'lar:** `Public Status Label`, `Planned`, `In Progress`, `Completed`, `Released`.

### Roadmap İşleri
Seçili İşlerde `Public title`, `Public summary`, hedef tarih sunumu.
- **Label'lar:** `Public title`, `Public summary`, `Full date`, `Month`, `Quarter`, `Hidden`.

### Review publish diff
Alanlar, durum eşlemeleri, üstveri, ekler, gömülüler, seçili Proje Duvarı öğeleri ayrı satırlar; çözülemeyen `{{alan_adı}}` listesi (kayıt, alan, metin bağlamı); plan okumasını değiştiren farkta isteğe bağlı `Explain the change`.
- **Label'lar:** `Review publish diff`, `Explain the change`, `Publish/share anyway`, `Open source record`.

### Öne çıkarılan kayıt ve indeksleme
En fazla bir önceden onaylı Proje Sürümü veya Karar, bitiş zamanıyla (varsayılan kapalı); indeksleme varsayılan kapalı (`noindex`) ve açmadan önce geri alınamazlık açıklaması.

### Gözden geçirme aralığı
İsteğe bağlı: 7 ile 180 arasında tam gün sayısı. Aralık girilmeden `public-roadmap-review-due` sinyali üretilmez; aralık başına en fazla bir sinyal, yalnız herkese açık etiketli aktif kayıtlar için. Sinyal iç durumu, herkese açık etiketi ve yayın snapshot'ını değiştirmez.
- **Label'lar:** `Review interval (days)`, `Enter a whole number of days from 7 to 180.`

### Durumlar
#### Disabled
Build in Public kapalı, tek açıklama ve açma eylemi.
#### Unpublished changes
`Unpublished changes` sayısı ve `Review publish diff` görünür.
#### Blocked Work without label
İlgili satırda etiket seçilmeden yayımlanamaz notu.
#### Unresolved placeholders
Önizlemede çözülemeyen `{{alan_adı}}` listesi (kayıt, alan, metin bağlamı); içeriğe dön veya `Publish/share anyway`.
#### Error
Yayın yazılamazsa önizleme açık kalır, hata satırı; son onaylı revizyon değişmez.

**Spec:** [75 Build in Public](../../specs/75-build-in-public/spec.md).

## 08.25 · Copy project structure
> Mevcut Projenin yapısını içerik, geçmiş ve ilişki olmadan yeni bir Projeye önizleyerek kopyalamak.

**Artboard'lar**
- `08.25 · Copy project structure · Preview · 1440`
_Ayrı artboard yok._

### Yeni Proje
Yeni ad ve kısa kod.
- **Label'lar:** `Project Name`, `Short code`.

### Önizleme
Taşınır: aşamalar, etkin alanlar, İş durumları, hazır görünümler, İş Bağlam Kartı düzenleri, özel alan tanımları (bağımsız kopya), öncelik ölçütü tanımları, boş duvar iskeleti tanımları. Taşınmaz: kayıtlar, geçmiş, ilişkiler, İş şablonları, Planlı Test Senaryoları, otomasyon kuralları.
- **Label'lar:** `Copy project structure`, `Cancel`.

### Durumlar
#### Short code taken
`Short code` alanının altında kodun kullanımda olduğunu söyleyen hata; kopyalama pasif.
#### Error
Kopyalama başarısızsa pencere açık kalır, girilen değerler korunur, hata satırı.

**Spec:** [07 Project Shell](../../specs/07-project-shell/spec.md).

## 08.26 · Archive Project
> Projeyi salt okunur ve hareketsiz Arşive almadan önce etkisini açıkça göstermek.

**Artboard'lar**
- `08.26 · Archive Project · Preview · 1440`
_Ayrı artboard yok._

### Önizleme
Proje normal çalışma yüzeylerinden kalkar; yaşam durumu değişmez; devam eden import, yükleme, otomasyon ve eşitlemelerin kesin durumu; yaşamaya devam edebilecek önceden onaylı Dış yüzeyler; açık kalacak güvenlik eylemleri (yüzey iptali, token/parola rotasyonu, oturum sonlandırma, entegrasyon kesme/secret rotasyonu, güvenlik redaksiyonu).
- **Label'lar:** `Archive`, `Cancel`.

### Durumlar
#### In-flight work
Devam eden işlem satırında kesin durumu.
#### Error / conflict
Revizyon bariyeri: başka değişiklik olduysa → `10.5 · Conflict Draft`.

**Spec:** [83 Project Retirement](../../specs/83-project-retirement/spec.md).

## 08.27 · Archive view
> Arşivdeki Projeleri, yaşayan Dış yüzeyleri ve açık güvenlik eylemlerini listelemek; `Delete Project` ve arşivden çıkarmayı yalnız burada sunmak.

**Artboard'lar**
- `08.27 · Archive view · Default · 1440`
- `08.27 · Archive view · Empty · 1440`

### Arşivli Projeler
Arşivli Proje satırları.

### Ayrıntı
Yaşayan Dış yüzeyler kaynak durumlarıyla; erişimi azaltan güvenlik eylemleri; arşivden çıkarmanın GitHub bağlantısını örtük açmadığı notu ve yeniden bağlama yönlendirmesi.
- **Label'lar:** `Archive`, `Delete Project`.

### Durumlar
#### Empty
Arşivde Proje yok.
#### Restored from Trash
Çöp Kutusundan geri yüklenen Proje burada `Active` değil Arşivde, yayınları kapalı olarak görünür.

**Spec:** [83 Project Retirement](../../specs/83-project-retirement/spec.md).

## 08.28 · Delete Project
> Arşivdeki Projeyi tek geri yüklenebilir Proje silme grubu olarak 30 günlük Çöp Kutusuna almak ve sonuçlarını önceden göstermek.

**Artboard'lar**
- `08.28 · Delete Project · Preview · 1440`
_Ayrı artboard yok._

### Önizleme
Silinecek grup (Proje ve ona kanonik ait kayıtlar, bileşenler, Dış yüzeyler); hemen terminal iptal edilecek Proje kapsamlı Dış yüzeyler ve ziyaretçi oturumları; duracak entegrasyonlar; başka kapsamlarda yaşayıp silinmiş hedef işareti gösterecek ilişkiler; Çalışma Alanı, Hesap ve Kişisel Wiki kayıtlarının silinmeyeceği; geri yüklemenin Arşive döneceği ve hiçbir yüzeyi yeniden yayımlamayacağı. `Keep approved surface` seçeneği yoktur.
- **Label'lar:** `Delete Project`, `Cancel`.

### Durumlar
#### Error
Silme yazılamazsa pencere açık kalır, Proje Arşivde kalır, hata satırı.

**Spec:** [83 Project Retirement](../../specs/83-project-retirement/spec.md).
