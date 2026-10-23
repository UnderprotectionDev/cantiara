# 13 · Design

Projenin `Design` alanı: Proje Duvarı, Ekranlar ve Wireframe, Kullanıcı Akışı, Moodboard.

| Ekran | Ne çizilir |
|---|---|
| [13.1 · Design](#131--design) | Dört bölümlü tasarım dizini |
| [13.2 · Canvas Chrome](#132--canvas-chrome) | Ortak tuval kabuğu anatomisi |
| [13.3 · Wireframe Editor](#133--wireframe-editor) | Ekranın Wireframe tuvali ve outline'ı |
| [13.4 · Convert and Bind](#134--convert-and-bind) | Block/düğümden kayıt açma önizlemesi |
| [13.5 · Rebind](#135--rebind) | Bağı yeni sürüme taşıma dialog'u |
| [13.6 · Wireframe Presentation Mode](#136--wireframe-presentation-mode) | Tam ekran prototip |
| [13.7 · Presentation and Export](#137--presentation-and-export) | Ekran/sürüm seçimi ve HTML çıktısı |
| [13.8 · User Flow Editor](#138--user-flow-editor) | Kullanıcı Akışı tuvali |
| [13.9 · Moodboard](#139--moodboard) | Görsel ve renk örneği tuvali |
| [13.10 · Color Swatch](#1310--color-swatch) | Renk örneği ekleme formu |
| [13.11 · Visual Region Snapshot](#1311--visual-region-snapshot) | Donmuş kopya önizlemesi |
| [13.12 · Project Wall](#1312--project-wall) | Canlı kartlı Proje Duvarı |
| [13.13 · Create Persistent Relation](#1313--create-persistent-relation) | Görsel bağlantıdan ilişki önizlemesi |

## 13.1 · Design
> Projenin tasarım kayıtlarını dört bölümde listeler ve her birini kendi tuvalinde açar; kendisi tuval değildir.

**Artboard'lar**
- `13.1 · Design · Default · 1440`
- `13.1 · Design · Empty · 1440`
- `13.1 · Design · Archived Project · 1440`

### Alan başlığı ve bölüm dizini
- **Label'lar:** `Design`, `Project Wall`, `Screen`, `User Flow`, `Moodboard`.

### Project Wall bölümü
Oluşturma formu; kabuk iskelet seçtiyse iskelet butonları; adlandırılmış düz duvarların listesi (her biri kart sayısıyla).
- **Label'lar:** `Project Wall`, `Project Wall name`, `Create Project Wall`, `Create from Sitemap`, `Create from Customer Journey`, `No Project Wall yet.`

### Screen bölümü
`Create Screen` formu (yalnız başlık); `Create Screen from Template` formu; `Active` Ekran listesi; varsa `Archived` alt başlığı ve listesi; `In Trash` alt başlığı ve listesi; listenin altında `13.7 · Presentation and Export` paneli.
<details>
<summary>Label'lar</summary>

`Screen`, `Title`, `Create Screen`, `Create Screen from Template`, `Template`, `Template name`, `Save as Template`, `Open Wireframe`, `Close Wireframe`, `Archive`, `Unarchive`, `Move to Trash`, `Restore`, `Active`, `Archived`, `In Trash`, `No Screens yet.`, `No Screens in Trash.`, `Title is required.`, `Screen could not be created.`

</details>

### User Flow bölümü
Kullanıcı Akışı listesi; oluşturma formu; şablondan oluşturma formu.
- **Label'lar:** `User Flow`, `Title`, `Create from template`, `Select a template`, `No User Flows yet.`

### Moodboard bölümü
`Create Moodboard` formu; Moodboard listesi.
- **Label'lar:** `Moodboard`, `Title`, `Create Moodboard`, `No Moodboards yet.`, `Check the title.`

### Durumlar
#### Empty
Yeni bir Projede dört bölüm de kendi boş metnini gösterir (`No Project Wall yet.`, `No Screens yet.`, `No User Flows yet.`, `No Moodboards yet.`); örnek kayıt veya sahte tuval üretilmez.
#### Loading
Her bölüm kendi yüklenme satırını gösterir (`Loading Project Walls…`, `Loading Screens…`, `Loading User Flows…`); diğer bölümler beklemez.
#### Error
Bölüm düzeyinde: `Project Walls are unavailable.`, `Screens are unavailable.` + `Retry`, `User Flows are unavailable.` + `Retry`, `Moodboard is unavailable.` Bir bölümün hatası diğerlerini gizlemez.
#### Archived Project (read-only)
Ferry: bütün oluşturma formları ve yaşam eylemleri gizli; listeler okunur, tuvaller salt okunur açılır. Arşiv bandı → `20` Archived / read-only banner.
#### Area disabled
`Design` alanı etkin değilse sayfa açılmaz; etkinleştirme `08 · Project Shell & Overview` Configuration Mode'dadır.

**Spec:** [51 Proje Duvarı](../../specs/51-project-wall/spec.md), [48 Ekranlar ve Wireframe](../../specs/48-screens-and-wireframes/spec.md), [49 Kullanıcı Akışı](../../specs/49-user-flow/spec.md), [50 Moodboard](../../specs/50-moodboards/spec.md).

## 13.2 · Canvas Chrome
> Dört Design tuvalinin (Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard) ortak kabuğunu bir kez tanımlar; her tuval ekranı yalnız kendi nesne dilini ekler.

**Artboard'lar**
- `13.2 · Canvas Chrome · Anatomy · 1440`
- `13.2 · Canvas Chrome · Anatomy · 768`
- `13.2 · Canvas Chrome · Outline item inspected · 1440`
- `13.2 · Canvas Chrome · Presentation frame · 1440`

### Araç çubuğu
Tuvale özgü oluşturma araçları (ilgili ekranda); `Undo`, `Redo`; çoklu seçimde hizalama/katman sırası; görünüm grubu: `Zoom In`, `Zoom Out`, `Fit View`; tuval destekliyorsa `Fit Selection`; kaydetme eylemi (Wireframe ve Kullanıcı Akışı sürüm kaydeder); `Presentation Mode`.
- **Label'lar:** `Undo`, `Redo`, `Zoom In`, `Zoom Out`, `Fit View`, `Fit Selection`, `Align Left`, `Align Center`, `Align Right`, `Align Top`, `Align Middle`, `Align Bottom`, `Bring to Front`, `Send to Back`, `Presentation Mode`.

### Outline
Tuvaldeki bütün öğelerin yapılandırılmış listesi; gruplar daraltılabilir başlık satırı (üye sayısıyla); her satırda seçim, sıralama, gruplama, inceleme ve `Open Source Record`. Tuvalin işlevsel eşdeğeridir, salt okunur yedek değildir: oluşturma, seçme, sıralama, gruplama, bağlama, bağı kaldırma, inceleme ve kaynak kaydı açma işaretçi olmadan buradan yapılır.
- **Label'lar:** `Outline`, `Inspect`, `Move up`, `Move down`, `Expand`, `Collapse`, `Open Source Record`.

### Tuval
Tuvale özgü nesneler; seçim çerçevesi; bağlantı çizgileri; daraltılmış grup özeti; canlı kayıt kartları.

### Kişisel viewport
Görünür eleman yoktur; davranış: kurucunun son merkez, zoom ve görünüm-yerel daraltılmış grupları bu tuval için oturumlar arasında geri gelir. İçerik, arama alanı, paylaşım snapshot'ı, export girdisi veya başka kullanıcının görünümü değildir.

### Sunum çerçevesi
`Presentation Mode` açıkken araç çubuğu, Outline ve inceleme paneli tamamen gizlenir; tam ekran salt okunur içerik + ince üst şerit (kayıt adı, konum) + `Exit Presentation Mode`. Odak sırası olan tuvallerde (Moodboard, Proje Duvarı) alt şeritte `Previous` / `Next`; Wireframe'de prototip bağlantıları.
- **Label'lar:** `Presentation Mode`, `Exit Presentation Mode`, `Previous`, `Next`, `Focus order`, `Nothing to present yet.`

### Durumlar
#### Restored viewport
Tuval kurucunun son konumunda açılır; Outline'da daraltılmış gruplar daraltılmış görünür.
#### Fitted after meaningless position
Kayıtlı konum boş bölgeye düşmüş; tuval görünür içeriğe sığmış olarak açılır, ayrı uyarı gösterilmez.
#### Unsaved changes
Sürüm kaydeden tuvallerde (Wireframe, Kullanıcı Akışı) kaydedilmemiş değişiklik durum satırı ve `Discard changes`.
#### Hard scene (500 / 750)
500 görünür öğe ve 750 bağlantı akıcı kalır; 2.000 / 3.000'de tuval ayrıntıyı azaltabilir veya uyarı gösterebilir ama bozulmaz. Bu durum çizimde yoğun bir tuval örneğiyle gösterilir; yoğunluk skoru veya sayaç widget'ı eklenmez.

**Spec:** [48](../../specs/48-screens-and-wireframes/spec.md), [49](../../specs/49-user-flow/spec.md), [50](../../specs/50-moodboards/spec.md), [51](../../specs/51-project-wall/spec.md) (personal viewport, outline, 500/750 sahne); [PRD 04 kişisel çalışma konumu](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu), [PRD 15](../../prd/15-product-quality.md).

## 13.3 · Wireframe Editor
> Bir Ekranın düşük sadakatli düzenini sürümlü Wireframe yüzeyinde çizmek; Wireframe Ekranın yüzeyidir, ayrı kayıt değildir.

**Artboard'lar**
- `13.3 · Wireframe Editor · Default · 1440`
- `13.3 · Wireframe Editor · Default · 768`
- `13.3 · Wireframe Editor · Empty · 1440`
- `13.3 · Wireframe Editor · Block inspected · 1440`
- `13.3 · Wireframe Editor · Linked block change preview · 1440`
- `13.3 · Wireframe Editor · Broken live text · 1440`
- `13.3 · Wireframe Editor · Multi-select · 1440`
- `13.3 · Wireframe Editor · Behavior (Spec) · 1440`
- `13.3 · Wireframe Editor · Read-only · 1440`

### Ekran başlığı
Ekran adı, yaşam durumu, son kaydedilen sürüm.
- **Label'lar:** `Wireframe`, `Saved version`, `Close Wireframe`.

### Bileşen araçları
Kapalı semantik bileşen kümesi, her biri ikon + adla; yanında `Place live card`.
- **Label'lar:** `Button`, `Input`, `Card`, `Table`, `Navigation`, `Chart`, `Text`, `Place live card`, `Save Version`.

### Wireframe tuvali
El çizimi çizgiyle block'lar (anlam canonical geometride, çizgi yalnız görünüş); canlı kartlar (başlık, durum, az sinyal); metin block'ları (placeholder veya canlı Markdown bölüm referansı); bağlı block'ların bağ işareti.

### Wireframe outline ve block inceleme
`13.2` Outline'ı; gruplar (`Collapse <grup> group (n)`); çoklu seçimde `Align selection`; tek seçili block'ta inceleme paneli: tür, etiket, konum, boyut, bağlı block durumu; satır eylemleri; bağlı block kontrolleri; `13.4 · Convert and Bind` paneli yalnız seçili block satırında.
<details>
<summary>Label'lar</summary>

`Wireframe outline`, `Inspect block`, `Kind`, `Label`, `Position`, `Size`, `Linked block`, `Not linked`, `Linked to <ad>`, `Move up`, `Move down`, `Remove Block`, `Open Source Record`, `Create Linked Block`, `Detach Link`, `Source label`, `Preview Change`, `Apply Change`, `Affected Screens`, `No Screens affected.`, `No blocks yet.`

</details>

### Kapalı animasyon ve prototip bağlantısı (Spec)
Seçili block için davranış listesi: göster/gizle, iki durum arasında sabit süreli geçiş, hover/press, sıralı adım, Ekranlar arası geçiş (hedef Ekran seçimi). Süre ürünün kapalı değer kümesinden seçilir (dört sabit seçenek); zaman çizelgesi, keyframe, easing eğrisi alanı yoktur.
- **Label'lar:** Spec'te İngilizce label tanımlı değil; ilk gösterimde terim tablosuna eklenmeli.

### Durumlar
#### Empty
Yalnız başlıkla açılmış `Pricing`: tuval boş, Outline `No blocks yet.`; bileşen araçları tek giriş noktası.
#### Loading
`Loading Wireframe…` tuval alanında.
#### Error
`Wireframe is unavailable.` + `Retry`.
#### Linked block change preview
`Preview Change` sonrası `Affected Screens` listesi ve `Apply Change`; hata: `Linked block could not be updated.`, `Link could not be detached.`
#### Broken live text
Kaynak bölüm silinmiş metin block'u boş görünmez: `Broken reference` işareti ve son görülen metin; `Open Source Record` yerine kırık hedef açıklaması (→ `20` kırık hedef).
#### Saved version text
Eski sürüm açıkken canlı metin block'u o anda görülen metni tarihsel bağlam olarak gösterir ve güncel canlı kaynağa ayrı geçiş sunar.
#### Multi-select
İki veya daha çok block seçili: `Align selection` grubu (`Align Left` … `Align Bottom`) Outline üstünde.
#### Live card unavailable
Kaynağı Çöp Kutusundaki canlı kart: `Work unavailable`; başlık ve gövde sızdırılmaz.
#### Read-only
Arşivli Ekran veya arşivli Proje: bileşen araçları, `Save Version`, satır düzenleme ve `Convert and Bind` gizli; `Fit View` ve Outline gezintisi kalır.

**Spec:** [48 Ekranlar ve Wireframe](../../specs/48-screens-and-wireframes/spec.md).

## 13.4 · Convert and Bind
> Wireframe block'undan veya Kullanıcı Akışı düğümünden önizlemeyle tam olarak bir İş, Karar, Risk veya Açık Soru açmak; Ekran üretmez, kaynak öğe yerinde kalır.

**Artboard'lar**
- `13.4 · Convert and Bind · Wireframe preview · 1440`
- `13.4 · Convert and Bind · Wireframe target · 1440`
- `13.4 · Convert and Bind · User Flow dialog preview · 1440`
- `13.4 · Convert and Bind · Source item gone · 1440`

### Hedef seçimi
Hedef tür; tür İş ise İş türü; başlık (boşsa block etiketinden).
- **Label'lar:** `Convert and Bind`, `Target type` (Wireframe) / `Record type` (Kullanıcı Akışı), `Work`, `Decision`, `Risk`, `Open Question`, `Work type`, `Task`, `Bug`, `Research`, `Improvement`, `Title`, `Preview`, `Cancel`.

### Önizleme
Oluşacak tek kaydın salt okunur dökümü.
- **Label'lar:** `Convert and Bind preview`, `Target type`, `Target Project` / `Project`, `Title`, `Body`, `Originates from` (kod: `Origin` / `Relation`), `Origin Location`, `No Screen is created.`, `Confirm`.

### Durumlar
#### Preview stale
`The preview is out of date. Preview again.` (Wireframe) / `The preview could not be loaded. Save or discard edits and try again.` (akış).
#### Preview unavailable
`Preview is unavailable.`
#### Created
Panel kapanır; oluşan kayıt kendi listesinde `Originates from` `Invoices` ile görünür. Kaynak block değişmeden kalır.
#### Source item gone
Kaynak block silinmiş veya redakte edilmiş: oluşan kayıt yaşar, `Originates from` Ekrana bağlı kalır; Origin Location `Source item is gone` okur ve başka block'a kaymaz.

**Spec:** [48](../../specs/48-screens-and-wireframes/spec.md) (block), [49](../../specs/49-user-flow/spec.md) (düğüm); [PRD 02 Köken konumu](../../prd/02-domain-model-and-lifecycle.md#koken-konumu).

## 13.5 · Rebind
> Kesin sürüme bağlı Karar, Risk veya Açık Soru bağını yeni tasarım sürümüne açık önizlemeyle taşımak; yeni sürüm bağı sessizce taşımaz.

**Artboard'lar**
- `13.5 · Rebind · Preview · 1440`

### Önizleme
Bağın şu anki sürümü, hedef sürüm, Origin Location; açıklama.
- **Label'lar:** `Rebind`, `Rebind preview`, `Bound version`, `Origin Location`, `Only the version this bind follows moves.`, `Cancel`, `Confirm`.

### Durumlar
#### Error
`The preview could not be loaded. Reload.`; onay reddi: `The bind could not be moved. If it changed, preview again.`

**Spec:** [49](../../specs/49-user-flow/spec.md), [48](../../specs/48-screens-and-wireframes/spec.md) (yeni Wireframe sürümü bağı taşımaz).

## 13.6 · Wireframe Presentation Mode
> Seçilen kesin Wireframe sürümlerini, seçilen başlangıç Ekranından bağlantıları izleyen tam ekran salt okunur prototip olarak sunmak.

**Artboard'lar**
- `13.6 · Wireframe Presentation Mode · Default · 1440`
- `13.6 · Wireframe Presentation Mode · Default · 768`
- `13.6 · Wireframe Presentation Mode · Unresolved target · 1440`

### Üst şerit
`13.2` sunum çerçevesinin üst şeridi: Ekran adı ve sürüm, çıkış.
- **Label'lar:** `Presentation Mode`, `Exit Presentation Mode`.

### Prototip
Kesin sürümün render'ı; tıklanabilir block'lar bağlantıyı veya göster/gizle davranışını çalıştırır. Editör aracı, inceleme paneli yoktur.

### Prototip bağlantıları
Bu Ekrandaki tetikleyici block'ların klavye yolu.
- **Label'lar:** `Prototype links`.

### Durumlar
#### Unresolved target
Hedef Ekran sunuma dahil değil veya silinmiş: `Unresolved: <hedef>` durum satırı; başka Ekrana yönlendirme yok.
#### No version
`This Screen has no Wireframe version to present.`

**Spec:** [48](../../specs/48-screens-and-wireframes/spec.md).

## 13.7 · Presentation and Export
> Sunulacak veya dışa aktarılacak Ekranları ve kesin Wireframe sürümlerini seçmek; çıktı yeni doğruluk kaynağı değildir.

**Artboard'lar**
- `13.7 · Presentation and Export · Screens chosen · 1440`
- `13.7 · Presentation and Export · HTML file · 1440`

### Ekran seçimi
Çöpte olmayan ve sürümü olan Ekranlar; işaretlenince sürüm seçimi (varsayılan en son).
- **Label'lar:** `Presentation and Export`, `Wireframe version of <Ekran>`.

### Eylemler
`Presentation Mode` ve dört biçim butonu.
- **Label'lar:** `Presentation Mode`, `Export`, `PNG`, `SVG`, `PDF`, `HTML`.

### Tek dosyalı HTML çıktısı
İndirilen `.html` dosyasının kendisi: Ekranlar arası tıklanabilir prototip ve okunur `Manifest` bölümü (Ekran ve Wireframe sürümleri). Ağ isteği, ürün URL'si, analytics yoktur; dahil edilmeyen hedef nötr biçimde çözülemedi olarak görünür.
- **Label'lar:** `Manifest`, `Wireframe export`.

### Durumlar
#### Empty
Sürümü olan Ekran yoksa panel görünmez.
#### Busy
Üretim sürerken butonlar pasif.
#### Error
Panel içinde hata satırı.

**Spec:** [48](../../specs/48-screens-and-wireframes/spec.md).

## 13.8 · User Flow Editor
> Kuşbakışı deneyim yolunu, canlı Ekran kayıtlarına bağlanan kapalı öğe kümesiyle çizmek.

**Artboard'lar**
- `13.8 · User Flow Editor · Default · 1440`
- `13.8 · User Flow Editor · Default · 768`
- `13.8 · User Flow Editor · Empty · 1440`
- `13.8 · User Flow Editor · Outline inspected · 1440`
- `13.8 · User Flow Editor · Unsaved changes · 1440`
- `13.8 · User Flow Editor · Archived and broken Screen · 1440`
- `13.8 · User Flow Editor · Promote to Screen · 1440`

### Araç çubuğu
`13.2` araç çubuğu, akışa özgü düzenleme ve sürüm eylemleriyle.
<details>
<summary>Label'lar</summary>

`User Flow editor tools`, `Undo`, `Redo`, `Select All`, `Copy`, `Paste`, `Delete`, `Zoom In`, `Zoom Out`, `Fit View`, `Fit Selection`, `Align Left` … `Align Bottom`, `Bring to Front`, `Bring Forward`, `Send Backward`, `Send to Back`, `Snap Selection to Grid`, `Snap to grid`, `Save version`, `Discard changes`.

</details>

### Akış tuvali
Beş kapalı öğe türü; her düğüm türünü metinle yazar (renk tek anlam taşıyıcısı değildir); `Section` üyelerini çerçeveler; yönlü bağlantılar; `Screen` düğümü canlı Ekran referansı ve varsa seçilen güncel Wireframe sürümünün küçük önizlemesi; salt okunur canlı kartlar.
- **Label'lar:** `Screen`, `Action`, `Decision`, `State/Outcome`, `Section`, `Open Source Record`, `Archived`, `Remove card`.

### Seçili düğüm
Düğüme özgü metin (açıklama, geçiş, koşul, karar metni düğümde kalır, Ekrana yazılmaz); sınırlı erişilebilir stil seçimi.
- **Label'lar:** `Selected node text`, `Style`.

### Outline
`13.2` Outline'ı; `Section` başlıkları altında üyeler; düğüm ekleme formu; seçimi gruplama; satırda `Select`, `Move up`, `Move down`, `Collapse`/`Expand (n hidden)`, `Inspect`, Section seçimi; inceleme: tür, metin, stil, Section, gelen/giden bağlantılar; bağlama ve bağı kaldırma.
<details>
<summary>Label'lar</summary>

`Outline`, `Outline nodes`, `Add a node to the outline`, `Outline node type`, `Outline node text`, `Outline Screen`, `Group selection into Section`, `Select`, `Selected`, `Inspect`, `Type`, `Text`, `Style`, `Section`, `Ungrouped`, `Leads to`, `Comes from`, `Nothing`, `No text`, `Bind to…`, `Bind`, `Unbind`, `The outline is empty`.

</details>

### Düğüm yerleştirme ve Ekrana yükseltme
`Place node` formu (varsayılan tür `Action`; `Screen` seçilince Ekran zorunlu). Ekran referansı olmayan düğümde `Promote to Screen`: mevcut Ekranı seç veya başlıkla yeni Ekran aç; ikisi de canlı referans verir, kopya üretmez. Düğüm satırında `Convert and Bind` → `13.4`.
- **Label'lar:** `Place node`, `Node type`, `Screen`, `Node text`, `Choose a Screen for a Screen node.`, `Promote to Screen`, `Select a Screen`, `Create a new Screen`, `Screen title`, `Convert and Bind`.

### Binds, canlı kartlar, şablon
Kesin düğüm sürümüne bağlı Karar/Risk/Açık Soru listesi (`Rebind` → `13.5`); canlı kart listesi; `Place live card` formu; `Save as template` (düğüm seçimi + ad).
- **Label'lar:** `Binds`, `Rebind`, `Live cards`, `Remove card`, `Place live card`, `Record`, `Save as template`, `Template name`, `Nodes in the template`.

### Durumlar
#### Empty
Düğümsüz akış: tuval boş, tek giriş `Place node`; `This User Flow has no nodes yet.`
#### Loading
`Loading canvas…`
#### Error
`User Flows are unavailable.` + `Retry`; kaydetme: `User Flow could not be saved.`
#### Unsaved changes
`Unsaved changes. Save or discard them before placing a node.` + `Save version` / `Discard changes`.
#### Archived Screen
`Screen` düğümü `Archived · Client detail` gösterir ve kaynağı açmaya devam eder.
#### Broken Screen
Çöpteki, kalıcı silinmiş veya erişilemeyen Ekran: `Broken — In Trash` / `Broken — Permanently deleted`, bağın kurulma zamanı (`Linked 2026-09-14`); başlık ve gövde sızmaz, başka Ekrana bağlanmaz. Kırık hedef aramada, sayımlarda ve export'ta yer almaz.
#### Template placeholder
Şablondan açılmış akışta `Screen` düğümleri Ekran kimliği taşımayan yer tutucu; Wireframe önizlemesi ve editör açma bekler.

**Spec:** [49 Kullanıcı Akışı](../../specs/49-user-flow/spec.md).

## 13.9 · Moodboard
> Bir Proje veya özellik için görsel referansları, altyazıları, renk örneklerini ve sunum sırasını tek tuvalde tutmak.

**Artboard'lar**
- `13.9 · Moodboard · Default · 1440`
- `13.9 · Moodboard · Default · 768`
- `13.9 · Moodboard · Empty · 1440`
- `13.9 · Moodboard · Crop editing · 1440`
- `13.9 · Moodboard · Presentation Mode · 1440`

### Başlık ve araçlar
Moodboard adı, ekleme araçları ve görünüm araçları.
- **Label'lar:** `Moodboard`, `Presentation Mode`, `Add visual`, `Add Color Swatch`, `Zoom in`, `Zoom out`, `Fit View`.

### Board
Görseller (sunulan görünümle: kırpma ve döndürme uygulanmış), altyazı, köken işareti; renk örnekleri.

### Görsel ekleme ve görsel görünüm araçları
`Add visual`: köken seçimi (Dosya Eki sürümü veya dış bağlantı), referans, altyazı. Görsel satırında `Caption` düzenleme ve görünüm-yerel `Crop`, `Rotate 90°`, `Reset view`; kırpma kesin Dosya Eki sürümüne bağlı üstveridir, özgün dosyayı ve diğer görünümleri değiştirmez.
- **Label'lar:** `Add visual`, `Origin`, `File Attachment version`, `External link`, `Caption`, `Save`, `Crop`, `Rotate 90°`, `Reset view`, `Apply`, `Crop must leave part of the image.`, `Check the Visual details.`, `Check the Caption.`

### Color Swatch bölümü
Palet grupları ve her grubun renk örnekleri; grupsuz örnekler `No Palette group` altında; `Add palette group`. Ekleme formu → `13.10 · Color Swatch`.
- **Label'lar:** `Color Swatch`, `Palette group`, `No Palette group`, `Add palette group`, `Check the Palette group name.`

### Outline
`13.2` Outline'ı (`Outline (n)`); satır: tür + etiket; inceleme: `Kind`, `Origin`, `Caption`/`Note`; renk örneğinde `Group` seçimi; sürükleme tutamacı.
- **Label'lar:** `Outline`, `Inspect`, `Kind`, `Visual`, `Color Swatch`, `Origin`, `None`, `Group`, `Move up`, `Move down`, `Open Source Record`, `No items yet.`

### Focus order
Sunum Kipi için isteğe bağlı görünüm-yerel sıra; içerik kopyası değildir.
- **Label'lar:** `Focus order`, `Move up`, `Down`.

### Durumlar
#### Empty
`No items yet.`; tuval boş, `Add visual` ve `Add Color Swatch` görünür.
#### Loading
`Loading board…`
#### Error
`Moodboard is unavailable.`; yazma hatası `Moodboard could not be saved.`
#### Crop editing
Görsel üzerinde kırpma çerçevesi, `Apply` / `Reset view`.
#### Presentation Mode
`13.2` sunum çerçevesi: odak sırasına göre tek görsel/renk örneği, `Previous` / `Next`, `Presented view: <altyazı>`; içerik yoksa `Nothing to present yet.`

**Spec:** [50 Moodboard](../../specs/50-moodboards/spec.md).

## 13.10 · Color Swatch
> Moodboard'a açık bir renk örneği eklemek; palet görsel yön bağlamıdır, tema veya token yazmaz.

**Artboard'lar**
- `13.10 · Color Swatch · Form · 1440`
- `13.10 · Color Swatch · Eyedrop sampling · 1440`

### Renk girişi
Görsel seçici; HEX, RGB veya HSL kabul eden tek değer alanı; kesin bir Moodboard görselinden renk alma.
- **Label'lar:** `Add Color Swatch`, `Picker`, `Color`, `HEX, RGB, or HSL`, `Eyedrop`, `HEX`, `RGB`, `HSL`.

### Not ve grup
Renk örneğinin notu ve palet grubu.
- **Label'lar:** `Note`, `Palette group`, `No Palette group`, `Check the Color Swatch details.`

### Durumlar
#### Eyedrop sampling
Board'da görseller örneklenebilir işaretli; tarayıcı desteklemiyorsa `Eyedrop` gizlenir, seçici ve değer alanı kalır.
#### Invalid value
Alan altında hata metni.

**Spec:** [50](../../specs/50-moodboards/spec.md).

## 13.11 · Visual Region Snapshot
> Moodboard veya Proje Duvarında seçili grup ya da bölgeden tarihli PNG/PDF donmuş kopya üretmek; kaynakları değiştirmez, paylaşım kapsamını genişletmez.

**Artboard'lar**
- `13.11 · Visual Region Snapshot · Moodboard preview · 1440`
- `13.11 · Visual Region Snapshot · Project Wall preview · 1440`

### Kapsam
Bir grup veya seçili öğeler (duvarda `Region of selected cards`).
- **Label'lar:** `Snapshot`, `Snapshot group`, `Region of selected cards`, `Preview`.

### Önizleme
Sayfalama (PNG seçimleri ayrı görseller, PDF grupları ayrı okunur sayfalar; tüm tuval tek sayfaya sıkışmaz), görünüm anı, uygulanacak görünüm-yerel üstveri, canlı bağlantı yokluğu.
<details>
<summary>Label'lar</summary>

`Snapshot preview`, `Frozen copy`, `PNG`, `PDF`, Moodboard: "This snapshot carries no live source links. Later changes to the Moodboard or its files do not update it.", "Visuals that come from an external link are not embedded; they appear as placeholders and their Crop or Rotate 90° is not applied.", "No view-local Crop or Rotate 90° applies to the selected visuals.", "Static output. It is not a public share, an External Surface, or an Approved Snapshot Revision, and it is not a live brand guide."; Duvar: "Frozen copy. It is not a share grant and does not widen share scope. It does not lock the Project Wall, live cards keep working, and it is not an External Surface or Build in Public.", "This snapshot carries no live source links. Later changes to the cards or their source records do not update it."

</details>

### Durumlar
#### Error
`Snapshot could not be created.`; duvarda kapsam sınırı aşılırsa (100 kart) üretim reddedilir, kesilmez.

**Spec:** [50](../../specs/50-moodboards/spec.md), [51](../../specs/51-project-wall/spec.md); [PRD 13 görsel bölge snapshot'ı](../../prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma).

## 13.12 · Project Wall
> Proje anlatısını mevcut ana kayıtların canlı kartları ve uzamsal yerleşimle kurmak; yerleşim kaynak kaydı, ilişki, durum veya öncelik yazmaz.

**Artboard'lar**
- `13.12 · Project Wall · Default · 1440`
- `13.12 · Project Wall · Default · 768`
- `13.12 · Project Wall · Default · 1440 · Dark`
- `13.12 · Project Wall · Empty · 1440`
- `13.12 · Project Wall · Customer Journey skeleton · 1440`
- `13.12 · Project Wall · Card densities · 1440`
- `13.12 · Project Wall · Group opened · 1440`
- `13.12 · Project Wall · Auto-layout preview · 1440`
- `13.12 · Project Wall · Broken card · 1440`
- `13.12 · Project Wall · Presentation Mode · 1440`

### Duvar seçimi ve başlık
Projenin düz duvarları (iç içe duvar yok); seçili duvar adı ve yönetim eylemleri.
- **Label'lar:** `Project Wall`, `Project Walls`, `Rename`, `Rename Project Wall`, `Delete Project Wall`, `Presentation Mode`.

### Kart yerleştirme
Kaynak kayıt seçimi (İş, Karar, Risk, Teknik Diyagram, Akıllı Koleksiyon); zaten duvardakiler işaretli.
- **Label'lar:** `Place live card`, `Source record`, `Select a record`.

### Tuval ve araçlar
`13.2` araçlarına ek: `Distribute Horizontally`, `Distribute Vertically`, `Preview Auto-layout` (önizleme → `Apply Auto-layout` / `Cancel preview`, uygulandıktan sonra `Undo Auto-layout`). Kartlar tek seviyeli gruplarda; yönlü etiketli görsel bağlantılar; kilitli kartlar `Position locked` işaretli.
<details>
<summary>Label'lar</summary>

`Canvas tools`, `Fit View`, `Zoom in`, `Zoom out`, `Align`, `Distribute Horizontally`, `Distribute Vertically`, `Bring to Front`, `Send to Back`, `Preview Auto-layout`, `Auto-layout preview`, `Auto-layout moves <n> card`, `Apply Auto-layout`, `Cancel preview`, `Undo Auto-layout`, `Auto-layout: nothing to rearrange.`, `Expand group`, `Collapse group`.

</details>

### Canlı kart
Yoğunluğa göre ürünün seçtiği alanlar (`Key`, `Status`, `Type`, `Description`, `Decision`, `Probability`, `Impact`); kart ayarları: yoğunluk, sınırlı erişilebilir vurgu paleti, grup, `Lock Position`, kaldırma. Teknik Diyagram kartı seçili Diyagram Görünümünün salt okunur önizlemesi + `Live`/`Exact` etiketi + `Pin exact Diagram Version` / `Follow live diagram`. Akıllı Koleksiyon kartı sınırlı sonuç + `Open all in source`; aynı kayıt hem kart hem özette ise `Shared source` işareti.
<details>
<summary>Label'lar</summary>

`Compact`, `Preview`, `Detailed`, `Density`, `Highlight`, `No highlight`, `Group`, `No group`, `Lock Position`, `Remove from Project Wall`, `Open Source Record`, `Live`, `Exact`, `Pin exact Diagram Version`, `Follow live diagram`, `Diagram preview: <görünüm>`, `Default`, `Collection summary: <ad>`, `Open all in source`, `Shared source`.

</details>

### Grup gezinmesi
Grup açma ve tam duvara dönüş.
- **Label'lar:** `Open group`, `Open group: <ad>`, `Show full wall`.

### Wall narrative
Görsel bağlantı listesi, grup listesi, ekleme formları. Açıklama: görsel bağlantı, grup ve yakınlık kayıt ilişkisi değildir.
- **Label'lar:** `Wall narrative`, `Visual links`, `No Visual links.`, `Add Visual link`, `From`, `To`, `Label`, `Select a card`, `Bind`, `Unbind`, `Create Persistent Relation` (→ `13.13`), `Groups`, `Create Group`, `Group name`, `Group selection`, `Delete group`.

### Outline
`13.2` Outline'ı (`Outline rows (n)`); inceleme paneli `Inspector: <kart>` kart ayarlarını ve kartın görsel bağlantılarını (`Visual links of this card`) taşır.
- **Label'lar:** `Outline`, `Outline rows`, `Select: <kart>`, `Inspect: <kart>`, `Move up: <kart>`, `Move down: <kart>`, `Group: <kart>`, `Open Source Record: <kart>`.

### Focus order
Sunum Kipi için görünüm-yerel kart sırası.
- **Label'lar:** `Focus order`, `Move up`, `Down`.

### Durumlar
#### Empty
`No Project Wall yet.`; seçili boş duvar: `No cards yet.` ve `Place live card`.
#### Skeleton wall
`Customer Journey` iskeletinden: boş gruplar `Awareness`, `Consideration`, `Onboarding`, `Core Use`, `Retention`; kart veya örnek kayıt yok. `Sitemap`: `Primary Navigation`, `Secondary Navigation`, `Utility`, `External`.
#### Loading
`Loading Project Walls…`, `Loading Project Wall…`
#### Error
`Project Walls are unavailable.`; yazma hatası `Project Wall change failed.`
#### Group no longer available
Açılmış grup silinmiş: `This group is no longer available.` + `Show full wall`; başka gruba yönlendirme yok.
#### Broken card
Kaynağı arşivli kart `Archived`; çöpteki/kalıcı silinmiş `Broken — Permanently deleted` (`Unavailable record`), eski içerik gösterilmez.
#### Auto-layout preview
Önerilen konumlar hayalet olarak; kilitli kartlar yerinde. "Nothing is saved until you apply".
#### Presentation Mode
`13.2` sunum çerçevesi; odak sırasıyla kart kart `Previous`/`Next`.
#### Dark
Varsayılan durumun Dark örneği (Start Here › Dark örnekleri).

**Spec:** [51 Proje Duvarı](../../specs/51-project-wall/spec.md); Teknik Diyagram kartı [59](../../specs/59-technical-diagrams/spec.md).

## 13.13 · Create Persistent Relation
> Bir görsel bağlantıdan önizlemeli olarak katalog ilişkisi yazmak; çizgi tek başına ilişki değildir.

**Artboard'lar**
- `13.13 · Create Persistent Relation · Preview · 1440`

### Önizleme
`From` kart, `To` kart, ilişki türü, yazılacak ilişki.
- **Label'lar:** `Create Persistent Relation`, `Persistent relation preview`, `From`, `To`, `Relation kind`, `Related`, `Confirm Create Persistent Relation`, `Cancel`.

### Durumlar
#### Error
`Project Wall change failed.`

**Spec:** [51](../../specs/51-project-wall/spec.md).
