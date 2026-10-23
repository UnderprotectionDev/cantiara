# 10 · Documents

Projenin `Documents` alanı: Belge listesi, editör, sürümler, şablonlar ve Spec Change Review.

| Ekran | Ne çizilir |
|---|---|
| [10.1 · Documents](#101--documents) | İki kolonlu Belge gezinmesi ve seçim alanı |
| [10.2 · Document Editor](#102--document-editor) | `Write`/`Markdown`/`Preview` editörü, canlı bloklar, kurtarma |
| [10.3 · Create Document](#103--create-document) | Başlangıç iskeleti veya başlık/tür dialog'u |
| [10.4 · Document Versions](#104--document-versions) | Sürüm listesi ve gövde farkı |
| [10.5 · Conflict Draft](#105--conflict-draft) | Reddedilen metin karşılaştırma ve çözüm bölgesi |
| [10.6 · Document Templates](#106--document-templates) | Şablon listesi, iskelet önizlemesi, şablon dialog'u |
| [10.7 · Convert to template](#107--convert-to-template) | Belge sürümünden iskelet çıkarma dialog'u |
| [10.8 · Create Document from template](#108--create-document-from-template) | Şablondan Belge formu |
| [10.9 · Organize Document](#109--organize-document) | Klasör/üst düzenleme ve arşiv önizlemesi |
| [10.10 · Move or Copy Document](#1010--move-or-copy-document) | Kapsam taşıma/kopya seçim ve önizleme dialog'u |
| [10.11 · Export Document](#1011--export-document) | Markdown/PDF dışa aktarma önizlemesi |
| [10.12 · Convert to record](#1012--convert-to-record) | Seçili metinden tek kayıt önizlemesi |
| [10.13 · Convert in bulk](#1013--convert-in-bulk) | Liste satırlarından toplu İş adayları |
| [10.16 · Spec Change Review](#1016--spec-change-review) | Kuyruk, değişen bölümler, adaylar |

## 10.1 · Documents
> Projedeki Belgeleri klasör ve en fazla üç seviyeli üst/çocuk hiyerarşisiyle bulmak ve birini açmak.

**Artboard'lar**
- `10.1 · Documents · Default · 1440`
- `10.1 · Documents · Default · 768`
- `10.1 · Documents · Empty · 1440`
- `10.1 · Documents · Archived filter · 1440`

### Alan başlığı
- **Label'lar:** `Documents`, `Archived`, `Create Document`.

### Belge gezinmesi
Klasör başlıkları (klasörsüz Belgeler başlıksız ilk grupta), her klasörde kök Belge ve altında girintili çocuk/torun Belgeler; satırda başlık ve sessiz kapsam rozeti. Seçili satır `aria-current` taşır.
- **Label'lar:** Klasör adları kullanıcı verisidir; tür değerleri `General`, `PRD`, `Plan`, `Spec`, `Research Note`, `Persona`.

### Seçim yok
Sağ kolonda tek satır boş durum.
- **Label'lar:** `Select a Document.`

### Durumlar
#### Empty
Projede Belge yok: gezinme boş, yalnız `Select a Document.` yerine dürüst boş durum ve `Create Document`. Örnek Belge üretilmez. Başlangıç iskeleti yapılandırılmış Projede bile iskelet Belgeler kullanıcı seçmeden oluşmaz.
#### Loading
`Loading Documents…`
#### Error
`Documents could not be loaded.` (alert); başlık ve `Create Document` görünür kalır.
#### Archived filtresi
`Archived` işaretli: yalnız arşivli Belgeler; arşivli üst altındaki etkin çocuklar kendi durumlarıyla gezinilebilir.
#### Arşivli Proje
Ferry: liste okunur, `Create Document` ve bütün yazma eylemleri yok; salt okunur bandı → `20.21 · Archived Read-only Banner`.
#### Many items
Uzun klasör listesi ve üç seviye girinti; uzun başlıklar satırda kırılır, girinti üç seviyede durur.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md); [14 Dosya Ekleri ve Görsel Kanıt](../../specs/14-file-attachments/spec.md) (alt bölge).

## 10.2 · Document Editor
> Tek Belgeyi uygulama içinde Markdown olarak yazmak, canlı bloklarla birleştirmek ve sürümlü kaydetmek.

**Artboard'lar**
- `10.2 · Document Editor · Write · 1440`
- `10.2 · Document Editor · Write · 768`
- `10.2 · Document Editor · Write · 1440 · Dark`
- `10.2 · Document Editor · Markdown · 1440`
- `10.2 · Document Editor · Preview with live blocks · 1440`
- `10.2 · Document Editor · Broken live content · 1440`
- `10.2 · Document Editor · Find and replace · 1440`
- `10.2 · Document Editor · Focus Mode · 1440`
- `10.2 · Document Editor · Newer version · 1440`
- `10.2 · Document Editor · Offline recovery · 1440`
- `10.2 · Document Editor · Archived Project · 1440`
- `10.2 · Document Editor · Closure Summary · 1440`

### Kayıt başlığı
Köken bildirimi (varsa), büyük düzenlenebilir başlık, `Type` seçimi, `Save`; Favori ve kişisel hatırlatma kontrolleri; Kişisel Wiki Belgesinde sessiz `Personal Wiki` rozeti.
- **Label'lar:** `Title` (görünmez label), `Type`, `Save`, `Conflict Draft origin`, `Copy origin`, `Open source record`, `Personal Wiki`.

### Yönetim eylemleri
Kaydedilmiş sürüme bağlı tek Belge işlemleri ve hiyerarşi düzeni; gövdede kaydedilmemiş değişiklik varken devre dışıdır ve neden açıklanır.
- **Label'lar:** `Move`, `Copy`, `Export`, `Organize Document`, `Archive` / `Unarchive`, `Convert to template`, `Save your changes before organizing or archiving this Document.`

### Belge içi etiketler
Gövdedeki kayıtlı `#tag` tokenlarının Çalışma Alanı Etiketlerine bağlı listesi.
- **Label'lar:** `Tags`

### Görünüm sekmeleri ve araç çubuğu
Birbirini dışlayan üç görünüm; `Write` varsayılan. `Write` görünümünde gruplu araç çubuğu: metin stili, satır içi biçim, bloklar, ekleme, tablo düzenleme (tablo içindeyken), geçmiş.
<details>
<summary>Label'lar</summary>

`Document view`, `Write`, `Markdown`, `Preview`; `Document formatting`, `Text style`, `Paragraph`, `Heading 1`, `Heading 2`, `Heading 3`, `Text formatting`, `Bold`, `Italic`, `Strikethrough`, `Inline code`, `Link`, `Edit link`, `URL`, `Apply link`, `Remove link`, `Block formatting`, `Bullet list`, `Numbered list`, `Quote`, `Code block`, `Code language`, `Auto detect`, `Horizontal rule`, `Insert content`, `Insert table`, `Mermaid block`, `Insert formula`, `LaTeX`, `Placement`, `Inline`, `Block`, `Table editing`, `Add row`, `Add column`, `Delete table`, `Edit history`, `Undo`, `Redo`, `Swipe for more formatting tools →` (yalnız dar ekran).

</details>

### Yazma alanı (`Write`)
Tiptap gövdesi: başlıklar, listeler, tablolar, dil etiketli kod blokları, fenced Mermaid, LaTeX, satır içi kayıt referansları, canlı bloklar.
- **Label'lar:** `Document editor`

### Markdown kaynağı (`Markdown`)
Aynı gövdenin düzenlenebilir kaynağı ve kaynağa ekleme denetimleri: kayıt referansı, `Live Work block`, adlandırılmış Akıllı Koleksiyon görünümü, `Read-only live section`, Teknik Diyagram/Diyagram Görünümü veya kesin Diyagram Sürümü; seçili metin ve liste için dönüşüm eylemleri.
<details>
<summary>Label'lar</summary>

`Markdown source`, `Record reference`, `Insert record reference`, `Choose a record`, `Live Work block`, `Smart Collection`, `Named view`, `Read-only live section`, `Insert Read-only live section`, `Choose a Document`, `Choose a section`, `Technical Diagrams`, `Technical Diagram`, `Diagram View`, `Diagram Version`, `Pin exact Diagram Version`, `Version-pinned evidence`, `Convert to record`, `Convert in bulk`, `Convert to Technical Diagram`; güvensiz dönüşüm uyarısı `This Markdown cannot be safely converted to Write. Continue editing in Markdown, or use Preview; your source is unchanged.`

</details>

### Önizleme (`Preview`) ve canlı bloklar
İşlenmiş Markdown; Mermaid diyagramı, KaTeX formülü, renkli kod. Canlı bloklar kopya değil, kaynağı gösteren sınırlı kartlardır:
  - `Live Work block`: anahtar, başlık, tür, durum, öncelik, planlanan başlangıç/hedef tarihi; `Change status`, `Close`, `Open source record`.
  - `Smart Collection · Named view`: koleksiyonun kendi sunumu, `Membership reason: `.
  - `Read-only live section`: kaynak Belge adı, son güncelleme, güncel bölüm metni, `Open source record`.
  - Teknik Diyagram canlı bloğu: salt okunur görünüm, kaynağı açar; kesin sürüm sabitlenmişse ayrı etiketli.
<details>
<summary>Label'lar</summary>

`Document preview`, `Mermaid diagram`, `Live Work block`, `Change status`, `Close`, `Open source record`, `Smart Collection · Named view`, `Read-only live section`, `Diagram elements`, `Diagram links`, `This section is missing.`, `Diagram could not be rendered.`, `Formula could not be rendered.`, `Loading source record…`, `Source record is unavailable.`

</details>

### İçindekiler ve belge içi bul
Başlık hiyerarşisinden canlı türeyen İçindekiler; desteklenen başlıkta bölüme odaklanma (kaynak yol ve tam Belgeye dönüş görünür); belge içi arama ve `Find and replace` paneli (düz metin varsayılan, açık gelişmiş regex modu, eşleşme önizlemesi ve sayı); `Focus Mode` geçişi.
- **Label'lar:** `Focus Mode`, `Find and replace`. İçindekiler, bölüme odaklan, tam Belgeye dön ve gelişmiş mod için İngilizce label PRD terim tablosunda yok; çizimde yer tutucu bırakılır.

### Belge tarafı kanıt
Bu Belgenin kesin sürümlerinden bağlanmış kanıt kullanımları: hedef kayıt, sürüm, alıntı, `Evidence Role`, `Founder interpretation` ve geçmişi; seçili metin için iki bağlama eylemi.
<details>
<summary>Label'lar</summary>

`Document evidence`, `Version-pinned evidence`, `Bind as evidence to existing record`, `Convert to new record and bind`, `Rebind to new version`, `Newer version exists`, `Open target record`, `Origin Location: this Document`, `Unavailable record`, `Select saved text in the latest version to rebind.`, `Version-pinned evidence could not be loaded.`

</details>

### Sürümler
Editörün altında `Versions` bölgesi; ayrıntısı `10.4 · Document Versions`.
- **Label'lar:** `Versions`

### Durumlar
#### Loading
Seçili Belge açılırken `Loading…`; İçindekiler ve sürümler iskeletle bekler.
#### Error
`Document could not be saved.` alert; metin korunur. Geri yükleme hatası `Document could not be restored.`
#### Markdown görünümü
`Markdown` sekmesi açık, ekleme denetimleri görünür.
#### Preview görünümü
`Preview` sekmesinde canlı Work bloğu, canlı bölüm ve Mermaid diyagramı birlikte.
#### Kırık canlı içerik
Silinmiş bölüm: `This section is missing.`; erişilemeyen kayıt: `Source record is unavailable.`; işlenemeyen Mermaid/LaTeX: hata satırı ve kaynak metin korunur. Eski içerik gösterilmez.
#### Find and replace açık
Panel editör üstünde; eşleşme sayısı ve gruplu önizleme.
#### Focus Mode
Kabuk ve yan kolonlar gizli; yalnız başlık, gövde ve görünür çıkış.
#### Daha yeni sürüm
`A newer Document version is available.` ve `Reload latest version`; yerel taslak korunur, `Save` devre dışı.
#### Offline ve kurtarma
Bağlantı kesik: editör yeni girdi almaz; blok düzeyinde `Offline`, `Last successful save` zamanı, `Unsaved changes may be lost`, bellek tamponunun uygulama kapanınca korunmadığı açıklaması, `Copy` ve `Download`. Yazılmamış değişiklik yoksa `The Document has no unwritten changes.` Genel offline bandı → `20.16 · Offline`.
#### Conflict Draft
Bayat tabanla kayıt: editör üstünde kalıcı `Conflict Draft` toast'ı (→ `10.5 · Conflict Draft`); editörün başında `Conflict Drafts` bölgesi ve açık `Compare` → `10.5 · Conflict Draft`.
#### Arşivli Belge
Belge arşivde: başlıkta sessiz arşiv işareti, `Unarchive` eylemi; içerik okunur ve düzenlenebilir kalır.
#### Arşivli Proje
Ferry: bütün alanlar salt okunur, yönetim eylemleri yok.
#### Long content
Uzun spec: İçindekiler yapışkan kalır; geniş tablo yatay kaydırılır, kod bloğu kendi içinde kaydırılır.
#### Closure Summary
Kaydedilen kapanış özeti olağan sürümlü bir `General` Belgedir: başlık `Project Closure Summary`, köken bağı kaynak Projeye (örnek Ferry · Version 1 · 2026-09-30), gövdede yalnız bölüm başlıkları ve okunabilir kaynak bağlantıları. Sistem cümlesi, başarı hükmü, puan veya özel kapanış kartı yoktur. Arşivli Projede salt okunur. Öğrenimleri Kişisel Wiki'ye kopyalama → `10.10`. Üretim akışı → `08.10`.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md); [45 Kanıt İlişkileri ve Kanıt Akışı](../../specs/45-evidence/spec.md) (Belge tarafı kanıt listesi).

## 10.3 · Create Document
> Kısa bir pencerede başlık ve tür ya da yapılandırılmış bir Başlangıç iskeleti seçip yeni Belgeyi editörde açmak.

**Artboard'lar**
- `10.3 · Create Document · Starter skeleton · 1440`
- `10.3 · Create Document · Skeleton selected · 1440`
- `10.3 · Create Document · Title and type · 1440`

### Başlangıç iskeleti seçimi
Yalnız Proje yapılandırmasında seçili Document iskeletleri listelenir; ilk seçenek olağan akış.
- **Label'lar:** `Starter skeleton`, `No starter skeleton`, `Persona`, `Retrospective`, `Launch Plan`, `Choose a starter skeleton, or give this Document a title and type.`

### Başlık ve tür
`No starter skeleton` seçiliyken veya iskelet yokken görünür.
- **Label'lar:** `Title`, `Type`, `Give this Document a title and choose its type.`

### Eylem satırı
İptal ve oluşturma eylemleri.
- **Label'lar:** `Cancel`, `Create Document`.

### Starter skeleton içerikleri
Proje kabuğunun kataloğunda seçili iskeletler `Starter skeleton` listesinde görünür; `No starter skeleton` olağan başlık/tür yolunu korur. Seçilen iskelet, başlıkları boş normal bir Belge üretir:
- `Persona`: `Context`, `Goals`, `Behaviors`, `Pain Points`, `Constraints`, `Evidence`, `Open Questions`.
- `Retrospective`: `Period`, `What worked?`, `What did not?`, `What did we learn?`, `Decisions`, `Next changes`, `Related records`.
- `Launch Plan`: `Release`, `Audience`, `Scope`, `Readiness`, `Communication`, `Launch steps`, `Risks`, `Observation plan`, `Related records`.

### Durumlar
#### Blank Project
İskelet seçimi yok; yalnız başlık/tür ve kısa yönlendirme.
#### Kişisel Wiki
`Starter skeletons require a Project.` İskelet seçimi görünmez.
#### İskelet seçili
`Launch Plan` seçili; altında oluşacak boş başlıklar sessiz liste: `Release`, `Audience`, `Scope`, `Readiness`, `Communication`, `Launch steps`, `Risks`, `Observation plan`, `Related records`. Örnek içerik yok.
#### Error
`Document could not be created.`; girilen değerler korunur.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.4 · Document Versions
> Belgenin veritabanı sürümlerini listelemek, iki sürümü karşılaştırmak ve seçileni yeni uç olarak geri yüklemek.

**Artboard'lar**
- `10.4 · Document Versions · Compare · 1440`
- —

### Sürüm listesi
Sürümler yeniden eskiye; her satırda sürüm numarası, kayıt zamanı, başlık ve tür.
- **Label'lar:** `Versions`, `Version`

### Karşılaştırma
Eklenen ve kaldırılan satırlar metin önekiyle ayrılmış gövde farkı; başlık/tür farkı.
- **Label'lar:** `Compare`, `Restore`, `Save your current changes before restoring a version.`

### Durumlar
#### Loading
`Loading…`
#### Error
`Versions could not be loaded.`
#### Tek sürüm
Yalnız `Version 1`; karşılaştırma boş ve açıklamalı.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.5 · Conflict Draft
> Bayat tabanla reddedilen metni güncel Belgeyle karşılaştırıp seçili parçaları yeni sürüm olarak uygulamak, ayrı Belge yapmak veya silmek; taslağı ana gerçeğe karıştırmadan çözmek.

**Artboard'lar**
- `10.5 · Conflict Draft · Compare · 1440`
- `10.5 · Conflict Draft · Create Document · 1440`
- `10.5 · Conflict Draft · Toast · 1440`

### Conflict Drafts
Bu Belgenin çözülmemiş taslakları; taslağın geçmişte, aramada, paylaşımda, yayında ve exportta yer almadığı açıklaması.
- **Label'lar:** `Conflict Drafts`, `Conflict Draft`, `Compare`, `Rejected text is not part of Document history, search, share, publish, …`

### Karşılaştırma ve sonuç
Gövde ve başlık farkı; kurucunun düzenlediği birleşik sonuç.
- **Label'lar:** `Current value`, `Body changes`, `Apply parts`, `Create Document`, `Delete`, `Compare a Conflict Draft first.`

### Create Document dialog'u
Reddedilen metinle önceden dolu, başlık ve içerik seçimi; yeni Belge aynı kapsamda ve Çakışma Taslağı kökeniyle.
- **Label'lar:** `Create Document`, `Title`, `Choose a title and keep all or selected rejected text. The new Document stays in the same scope with a Conflict Draft origin.`, `Choose the new Document title and content first.`, `Cancel`.

### Durumlar
#### Loading
`Compare` beklerken karşılaştırma açılmaz; bekleme durumu.
#### Error
`The current Document could not be loaded.` (taslak çözülmemiş kalır, `Compare` yeniden denenebilir); `Conflict Draft could not be resolved.`; `Conflict Drafts could not be loaded.`
#### Değişen revizyon
Karşılaştırmadan sonra Belge yeniden değiştiyse `Apply parts` reddedilir, yeniden `Compare` istenir.
#### Offline / Update required
Bölge eylemleri devre dışı.
#### Conflict Draft toast
Güncel olmayan bir Belge yazmasında metin korunur ve kalıcı bir toast (kapatılana kadar, → `20.15` ile aynı yer) görünür: `Conflict Draft` başlığı, `Your changes were kept in a Conflict Draft. Choose Compare in the Document to resolve it.`, `Compare`; ana kayıt yazma sonucu, yeniden deneme sınırı ve `Support reference`. `Compare` bu ekrandaki çözüm panelini açar. Özel taslak başlığı ve gövdesi toast'a girmez. Taslak eşleşmiyorsa sıradan `This page is out of date.` görünür (→ `20.14`).

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.6 · Document Templates
> Proje veya Kişisel Wiki kapsamındaki Belge şablonlarını listelemek, eklemek, düzenlemek ve şablondan bağımsız Belge başlatmak.

**Artboard'lar**
- `10.6 · Document Templates · Default · 1440`
- `10.6 · Document Templates · Edit dialog · 1440`
- `10.6 · Document Templates · Saved · 1440`

### Şablon listesi
Hazır `Personal Review` (iskeleti: `Period`, `What changed?`, `What worked?`, `What was difficult?`, `Decisions and learnings`, `What will I change next?`, `Related records`) ve kapsamdaki kullanıcı şablonları; açıklama satırı şablonların isteğe bağlı olduğunu ve Belgelerin kendi kimliğini taşıdığını söyler.
- **Label'lar:** `Document Templates`, `Document Template`, `Personal Review`, `Add Document Template`, `Edit Document Template`, `Create from template`, `Select a Document Template.`, `Templates are optional. Each Document has its own identity and never …`

### Şablon dialog'u
Ad, tür ve `Skeleton` gövdesi; dialog.
- **Label'lar:** `Name`, `Type`, `Skeleton`, `Save`, `Saving…`, `Cancel`, `Personal Review copy`, `Save an editable copy of Personal Review in this scope.`, `Document Template saved. Existing Documents are unchanged.`, `Document Template could not be saved.`

### Durumlar
#### Empty
Yalnız hazır `Personal Review` ve `Add Document Template`.
#### Loading
Liste iskeleti.
#### Error
`Document Templates could not be loaded.`
#### Kaydediliyor
Onay butonu `Saving…` ve devre dışı.
#### Kaydedildi
`Document Template saved. Existing Documents are unchanged.` onayı; şablon değişince kaybolur.
#### Bayat kayıt
Dialog ve taslak açık kalır, erişilebilir hata gösterilir.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.7 · Convert to template
> Kaydedilmiş bir Belge sürümünden kaynağı değiştirmeden şablon iskeleti çıkarmak.

**Artboard'lar**
- `10.7 · Convert to template · Preview · 1440`
- —

### Önizleme
Kaynak `Version`, düzenlenebilir iskelet (kayıt referansları okunur düz metne dönmüş, canlı bloklar çıkarılmış), algılanan `{{field_name}}` yer tutucuları.
- **Label'lar:** `Convert to template`, `Name`, `Version`, `Skeleton`, `Placeholders`, `Save`, `Cancel`.

### Durumlar
#### Error
`Document could not be loaded for Convert to template.`
#### Yer tutucu yok
`Placeholders` boş: `None`.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.8 · Create Document from template
> Şablondan başlık ve açık yer tutucu değerleriyle bağımsız bir Belge oluşturmak.

**Artboard'lar**
- `10.8 · Create Document from template · Default · 1440`
- —

### Form
`Title`, her yer tutucu için bir alan; açıklama yeni Belgenin bağımsız olduğunu söyler.
- **Label'lar:** `Create from template`, `Title`, `Create an independent Document from this skeleton.`, `Cancel`.

### Durumlar
#### Error
Hata metni ve korunmuş girdiler.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.9 · Organize Document
> Aynı Projede klasör ve üst Belgeyi önizlemeyle düzenlemek; Belgeyi arşivlemek veya arşivden çıkarmak.

**Artboard'lar**
- `10.9 · Organize Document · Preview · 1440`
- `10.9 · Organize Document · Depth blocked · 1440`
- `10.9 · Organize Document · Archive · 1440`

### Alanlar
Klasör ve üst Belge seçimleri.
- **Label'lar:** `Organize Document`, `Folder`, `Parent Document`, `No Parent Document`, `Preview changes in the same Project. Document identity, content, and …`

### Etki önizlemesi
Etkilenen torunlar; çocukların kendi bağ, klasör ve arşiv durumunu koruduğu açıklaması.
- **Label'lar:** `No child Documents.`, `Children keep their current parent links, folders, and archive state.`

### Durumlar
#### Dördüncü seviye engeli
Önizleme taşımayı reddeder; düzleştirme önerilmez, başka üst seçmesi istenir; `Apply` kapalı.
#### Archive
`Archive` önizlemesi: `The Document will leave normal navigation and remain available through Archived.`
#### Unarchive
`The Document will return to normal navigation.`
#### Error
`Check the form.`

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.10 · Move or Copy Document
> Belgeyi kimliği korunarak başka kapsama taşımak veya seçili sürümden yeni kimlikli kopya oluşturmak; her ikisini önizlemeden sonra uygulamak.

**Artboard'lar**
- `10.10 · Move or Copy Document · Move preview · 1440`
- `10.10 · Move or Copy Document · Copy · 1440`
- `10.10 · Move or Copy Document · External Surface blocked · 1440`
- `10.10 · Move or Copy Document · Assign File Attachments · 1440`
- `10.10 · Move or Copy Document · Wiki target · Move · 1440`
- `10.10 · Move or Copy Document · Wiki target · Copy · 1440`

### Seçimler
`Move` ve `Copy` aynı dialog ailesinin iki başlığıdır. `Move`: hedef kapsam, çocuk Belgelerin tek tek seçimi, sahip olunan Dosya Ekleri. `Copy`: hedef kapsam ve kaynak `Version`; kopya kapsamı kendiliğinden devralmaz.
<details>
<summary>Label'lar</summary>

`Move Document`, `Copy Document`, `Target scope`, `Personal Wiki`, `Child Documents`, `Version`, `File Attachments`, `Assign File Attachments`, `Preview`, `Apply`, `Cancel`, `Preview before Apply.`, `Copy creates a new identity with source origin, without history, …`, `Select File Attachments from this Project. Attachments already owned by …`

</details>

### Önizleme
Taşınacak Belgeler ve ekler, özel görünürlüğün korunduğu cümlesi, her kayıt referansı için kullanılabilirlik ve kaynak kapsamı, seçilmeyen çocukların kaynakta kalıp taşınan üstü kaybettiği açıklaması.
- **Label'lar:** `File Attachments`, `Visibility remains account-only. No content becomes public.`, `Available`, `Unavailable`, `Record references retain their source scope and access requirements:`, `Unselected children remain in the source scope and lose a moved parent …`, `Copy origin`.

### Durumlar
#### Dış yüzey açık
Etkin Dış yüzey taşımayı engeller; önce `Cancel External Surface` gerekir. Tarihsel kapsam ve snapshot zinciri korunur.
#### Bayat önizleme
Önizleme sonrası değişen ek/kaynak/çocuk: `Apply` reddedilir, yeniden `Preview` istenir.
#### Belirsiz yanıt
Yanıt kayboldu: aynı onaylı komut kullanıcı başlatmalı tekrar için korunur; otomatik tekrar yok.
#### Error
`Document transfer preview is unavailable.`
#### Arşivli kaynak Proje
`Move` başlatılamaz; yalnız `Copy`.
#### Wiki hedefi
Hedef kapsam `Personal Wiki` iken: `Target scope` varsayılanı `Personal Wiki`; `Copy` için etkin bir Proje de seçilebilir; `Version` kopyalanacak sürümü seçer. Örnek: Luma'daki `Late-payment etiquette notes` ve çocuğu `Email tone examples` Wiki'ye taşınır. `Starter skeleton` seçeneği Wiki'de yoktur. Kaynakta kalıp üstünü kaybedecek seçilmemiş çocuklar ve `Unavailable` referanslar önizlemede ayrı satırlarla görünür.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md); [14 Dosya Ekleri ve Görsel Kanıt](../../specs/14-file-attachments/spec.md) (sahip olunan ekler).

## 10.11 · Export Document
> Tek Belgenin seçili sürümünü canlı blokları tarihli snapshot'a çevirerek Markdown veya PDF indirmek.

**Artboard'lar**
- `10.11 · Export Document · Preview · 1440`
- —

### Seçim ve önizleme
Seçimler üstte (sürüm, format), hazırlanmış statik önizleme altta.
- **Label'lar:** `Export Document`, `Version`, `Format`, `Markdown`, `PDF`, `Preview`, `Download`, `Cancel`, `Preview before Download.`, `Live blocks become dated, read-only snapshots. No live external copy is …`, `PDF export does not guarantee tagged PDF or WCAG compliance. Markdown …`, `Source unavailable.`

### Durumlar
#### PDF uyarısı
`PDF` seçiliyken erişilebilirlik uyarısı ve Markdown alternatifi.
#### Error
`Document export preview is unavailable.`

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.12 · Convert to record
> Seçili metinden tam olarak bir İş, Karar, Risk, Varsayım veya Açık Soru kaydını kesin Belge sürümüne bağlı kanıtla oluşturmak.

**Artboard'lar**
- `10.12 · Convert to record · Preview · 1440`
- —

### Önizleme
Kayıt türü, başlık, Proje, seçili metnin eşlendiği alan, kesin Belge sürümü.
<details>
<summary>Label'lar</summary>

`Convert to record`, `Record type`, `Work`, `Decision`, `Risk`, `Assumption`, `Open Question`, `Title`, `Description`, `Decision text`, `Statement`, `Question`, `Evidence: selected text · version-pinned`, `Create one record with version-pinned evidence from the selected Document text.`, `No text selected.`, `Cancel`.

</details>

### Durumlar
#### Error
Hata metni; hiçbir kayıt oluşmaz. Kişisel Wiki'de `A Project is required for record conversion.`

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.13 · Convert in bulk
> Kaydedilmiş sürümdeki seçili liste satırlarından hepsi-veya-hiçbiri İş oluşturmak.

**Artboard'lar**
- `10.13 · Convert in bulk · Default · 1440`
- —

### Satır adayları
Her liste satırı ayrı İş adayı; seçim kutusu, başlık; tür bilgisi.
- **Label'lar:** `Convert in bulk`, `Record type: Task`, `Choose saved list rows to create as Work. All selected rows and …`, `Cancel`.

### Durumlar
#### Kaydedilmemiş gövde
`Save the Document and choose list rows first.`
#### Bayat Belge
Hiçbir İş oluşmaz; yeniden açma istenir.

**Spec:** [31 Belge Yazarlığı ve Sürümleri](../../specs/31-documents/spec.md).

## 10.16 · Spec Change Review
> Bir Özelliğin Birincil spec Belgesinde kaydedilen yeni sürümün kesin farkını ve kayıtlı bağlardan bulunan adayları sürüm çifti başına incelemek.

**Artboard'lar**
- `10.16 · Spec Change Review · Default · 1440`
- `10.16 · Spec Change Review · Default · 768`
- `10.16 · Spec Change Review · Empty · 1440`

### Kuyruk
Her sürüm çifti ayrı satır; yeni sürüm eski açık incelemeyi ezmez.
- **Label'lar:** `Spec Change Review`, `Spec Change Review queue`, `Primary spec`, `Version`.

### Değişen bölümler
Sürüm çifti başlığı, başlık değişikliği (varsa), bölüm bazlı satır farkı ve bölümler arası gezinme.
- **Label'lar:** `Changed sections`, `Added: `, `Removed: `, `Text before the first heading`, `Previous change`, `Next change`, `No section text changed in this version.`

### Adaylar
Her aday: kayıt, neden aday olduğu, bağlı bölüm veya `Document-level candidate`, inceleme durumu, kısa not, takip İşi eylemi.
- **Label'lar:** `Candidates`, `Review candidates`, `Why`, `Primary spec`, `Stable section reference`, `Inline reference`, `Live content use`, `Version-pinned evidence`, `Explicit relation`, `Document-level candidate`, `Waiting`, `Reviewed`, `Not affected`, `Save note`, `Create Follow-up Work`.

### Durumlar
#### Empty
`No Spec Change Reviews yet. One opens when a new version of a Feature's Primary spec is saved.`
#### Aday yok
`No recorded links point to this Primary spec.`
#### Loading
`Loading Spec Change Review…`
#### Error
`Spec Change Review is unavailable.` ve `Retry`; açılamayan çift `This Spec Change Review could not be opened.`; durum kaydı `Saving review status…` / `The review status could not be saved. Reload and try again.`
#### Erişilemeyen aday
Ortak kırık referans sunumu; başlık sızmaz → `20.10 · Relation Picker & Used in · Broken targets`.

**Spec:** [52 Spec Değişikliği İnceleme Kuyruğu](../../specs/52-spec-change-review/spec.md).

