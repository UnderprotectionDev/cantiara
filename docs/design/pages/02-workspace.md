# 02 · Workspace

Çalışma Alanı düzeyi yüzeyler: Projeler, Çalışma Alanı ayarları, paylaşım ve yayınlar, içe/dışa aktarma.

| Ekran | Ne çizilir |
|---|---|
| [02.1 · Projects](#021--projects) | Projeler listesi ve Çalışma Alanı genel bakışı |
| [02.2 · Customize overview](#022--customize-overview) | modül düzeni, canlı bloklar, `Saved lists` |
| [02.3 · Overview source set](#023--overview-source-set) | modül sayısının kaynak kümesi |
| [02.4 · Saved list](#024--saved-list) | çapraz Proje liste tablosu |
| [02.5 · Saved list editor](#025--saved-list-editor) | liste koşulları ve görünüm formu |
| [02.6 · Create Project](#026--create-project) | ad ve Başlangıç yapılandırması formu |
| [02.7 · Search](#027--search) | Evrensel Arama sonuç modalı |
| [02.8 · Type index](#028--type-index) | hazır tür dizini satırları |
| [02.9 · Table](#029--table) | tür tablosu ve satır yapıştırma |
| [02.10 · Drafts](#0210--drafts) | kişisel Taslak listesi |
| [02.11 · Trash](#0211--trash) | üç bölümlü Çöp Kutusu |
| [02.12 · Restore conflict preview](#0212--restore-conflict-preview) | geri yükleme çakışma dialog'u |
| [02.13 · Shares and Publications](#0213--shares-and-publications) | Dış yüzey dizin tablosu |
| [02.14 · Workspace Exit Package](#0214--workspace-exit-package) | şifreli çıkış paketi üretimi |

## 02.1 · Projects
> Çalışma Alanı ana sayfası: önce Projelere ulaşılır, sonra kaynak kayıtlardan türetilmiş Çalışma Alanı ufku görülür.

**Artboard'lar**
- `02.1 · Projects · Default · 1440`
- `02.1 · Projects · Default · 768`
- `02.1 · Projects · Empty · 1440`
- `02.1 · Projects · Loading · 1440`
- `02.1 · Projects · Overview error · 1440`
- `02.1 · Projects · Short code editing · 1440`
- `02.1 · Projects · All modules hidden · 1440`

### Sayfa başlığı
`Projects` başlığı, kısa açıklama ("Give each line of work a durable home…"), birincil eylem.
- **Label'lar:** `Projects`, `Create Project`.

### Projeler listesi
`Your Projects` alt başlığı ve sağında Proje sayısı; altında yoğun, ayraçlı satır listesi. Her satırda Proje adı (bağlantı), yaşam durumu rozeti, Başlangıç yapılandırması ve varsa hedef tarih, varsa amaç cümlesi; `Short code` bloğu. Satır eylemi `Copy project structure` → `08.25` (yeni ad ve `Short code` ile önizlemeli kopya; Başlangıç yapılandırması sunulmaz).
- **Label'lar:** `Your Projects`, `Copy project structure`, `Short code`, `Edit Short code`, `Save Short code`, `Cancel`, `Short code is locked after the first Work.`, yaşam durumu `Active` / `Pending` / `Completed` / `Abandoned`.

### Çalışma Alanı genel bakışı başlığı
İnce bir ayraçtan sonra `Workspace overview` başlığı ve "every count stays connected to its source records" açıklaması.
- **Label'lar:** `Workspace overview`.

### Hazır modüller
Dört modül sırasıyla: `Active Projects`, `Attention Required`, `Upcoming`, `Recent Work`. Her modülde başlık (bağlantı), "Source-backed · N" alt satırı, sayıyı taşıyan kare eylem, altında kaynak kayıt satırları. Satır: başlık bağlantısı, alt satırda tür · Proje · durum · tarih, `Open source record`.
- **Label'lar:** `Active Projects`, `Attention Required`, `Upcoming`, `Recent Work`, `Open source record`, "Source-backed".

### Kişisel canlı bloklar
Modüllerin altında, kurucunun eklediği sınırlı sayıda Belge veya adlandırılmış Akıllı Koleksiyon görünümü referansı; her blokta kaynak başlığı, kaynak içeriğinin canlı özeti, `Open source record`.
- **Label'lar:** `Open source record`.

### `Customize overview` açıklaması
En sonda, varsayılan kapalı tek satırlık açıklama. Açık hali → `02.2 · Customize overview`.
- **Label'lar:** `Customize overview`.

### Durumlar
#### Empty
Hiç Proje yok: liste yerine dürüst boş durum "No Projects yet." + "Start with a name and one Starter Configuration…" + `Create your first Project`. `Active Projects` modülü "No Active Projects yet." gösterir (sağlık hatası gibi değil); diğer modüller "No source records yet.".
#### Loading
Projeler listesi iki satırlık iskelet; genel bakış başlık + dört modül iskeleti, ekran okuyucuya "Loading…".
#### Error
Projeler yüklenemezse liste yerinde "Project is unavailable." + "Try loading this page again.". Genel bakış yüklenemezse Projeler listesi yerinde kalır, altında "Workspace overview is unavailable." + "Your Projects are still available above…". Düzen kaydedilemezse alt satırda "Workspace overview settings could not be saved. Try again.".
#### All modules hidden
"All modules are hidden. Use Show to bring a source module back." — kaynak kayıtlar silinmez.
#### Many items
Çok sayıda Proje: liste uzar, sayfalama yok; modüller sınırlı satır gösterir, tam küme sayıdan açılır.

**Spec:** [15 Çalışma Alanı Genel Bakışı](../../specs/15-workspace-overview/spec.md), [07 Proje Kabuğu](../../specs/07-project-shell/spec.md) (Proje satırı ve `Short code`).

## 02.2 · Customize overview
> Dört hazır modülün sunumu kişiselleştirilir, canlı blok eklenir ve Kaydedilmiş çapraz Proje listelerine girilir; hiçbiri kaynak kayıt yazmaz.

**Artboard'lar**
- `02.2 · Customize overview · Default · 1440`
- `02.2 · Customize overview · Empty · 1440`
- `02.2 · Customize overview · Live block limit reached · 1440`

### Modül düzeni
`02.1`'in alt kısmında, açık açıklamanın ilk bloğu: `Arrange modules` başlığı, "Presentation only. Hiding a module never removes its source records." notu; dört modülün sıralı listesi, her satırda yukarı/aşağı taşıma ve göster/gizle.
- **Label'lar:** `Arrange modules`, `Show`, `Hide`, "Move … up/down" (erişilebilir ad).

### Canlı bloklar
`Live blocks` başlığı, referans açıklaması; `Existing source` seçicisi ve `Add live block`; eklenmiş blokların listesi (başlık, `Open source record`, kaldır).
Üst sınıra ulaşılınca `Add live block` pasif olur ve yanında sınırı söyleyen sessiz satır görünür: `Live block limit reached. Remove one to add another.`; sınır sayısı çizime yazılmaz. Mevcut bloklar kaldırılabilir kalır.
- **Label'lar:** `Live blocks`, `Existing source`, `Choose a source`, `Add live block`, `Open source record`, "Remove live block" (erişilebilir ad), `No existing source records`.

### Saved lists
`Saved lists` başlığı, "Cross-Project views stay live from visible Workspace conditions." açıklaması, `New list`; listeler satır olarak (ad, Proje sayısı, `Open list`, düzenle).
- **Label'lar:** `Saved lists`, `New list`, `Open list`, "Edit saved list" (erişilebilir ad).

### Durumlar
#### Empty
`Saved lists`: "No saved lists yet. Create one to keep a live cross-Project view." Canlı blok kaynağı yoksa "No existing Documents or named Smart Collection views are available…".
#### Live block limit reached
`Add live block` pasif, sınır satırı görünür; her blokta kaldırma açık.
#### Error
Kaydetme hatası `02.1` alt satırında.

**Spec:** [15 Çalışma Alanı Genel Bakışı](../../specs/15-workspace-overview/spec.md).

## 02.3 · Overview source set
> Bir modül sayısının arkasındaki kesin kaynak kümesi açılır.

**Artboard'lar**
- `02.3 · Overview source set · Default · 1440`
- —

### Başlık
Modül adı, "Exact source records · N", geri dönüş; Projeler listesi gizlenir.
- **Label'lar:** `Back to Projects`, ör. `Attention Required`.

### Kaynak kayıtlar
`02.1` satır biçiminin tam listesi.
- **Label'lar:** `Open source record`.

### Durumlar
#### Empty
→ `02.1` › Empty (aynı metinler).

**Spec:** [15 Çalışma Alanı Genel Bakışı](../../specs/15-workspace-overview/spec.md).

## 02.4 · Saved list
> Koşullardan canlı türeyen adlandırılmış çapraz Proje listesi tablo olarak görülür.

**Artboard'lar**
- `02.4 · Saved list · Default · 1440`
- `02.4 · Saved list · Default · 768`
- `02.4 · Saved list · Empty · 1440`

### Başlık
`Saved lists` ekmek kırıntısı, liste adı, "N Projects · Membership comes from list conditions.", eylemler.
- **Label'lar:** `Saved lists`, `Edit list`, `Export`, `Back to Projects`.

### Tablo
Tam genişlikte seçili kolonlar, kayıtlı sıralama ve gruplama (gruplama varsa grup başlıkları). Kolon kataloğu → `02.5` › Görünüm. `Last reported health` hücresi son Manual Project Update sağlığını tarihiyle birlikte gösterir; tarihsiz rozet çizilmez.
- **Label'lar:** değerler `Archived` / `Not archived`.

### Durumlar
#### Empty
"No Projects match these conditions yet."
#### Grouped
`Grouping` = `Stage` veya `Status`: grup başlıkları altında satırlar.

**Spec:** [15 Çalışma Alanı Genel Bakışı](../../specs/15-workspace-overview/spec.md), [79 Seçili Kayıt Dışa Aktarma](../../specs/79-data-export/spec.md) (kesin görünüm çıktısı).

## 02.5 · Saved list editor
> Çapraz Proje listesinin adı, koşulları ve görünüm ayarları yazılır.

**Artboard'lar**
- `02.5 · Saved list editor · New · 1440`
- `02.5 · Saved list editor · Error · 1440`

### Başlık
`New list` veya `Edit saved list`; "Membership comes from list conditions. There is no manual membership…".
- **Label'lar:** `New list`, `Edit saved list`.

### Koşullar
Ad alanı ve koşullar: ad, yaşam durumu, ad içerir, aşamalar, arşiv, Proje alanları ve eşleşme, hedef tarih aralığı.
<details>
<summary>Label'lar</summary>

`List name`, `Lifecycle` (`Active`, `Pending`, `Completed`, `Abandoned`; "Leave all four unchecked to include every lifecycle status."), `Project name contains`, `Stages` ("Enter visible stage names separated by commas."), `Archive` (`All Projects`, `Not archived`, `Archived`), `Areas` (desteklenen Proje alanları çoklu seçimi), `Project areas match` (`Any`, `All`), `Target date from`, `Target date to`.

</details>

### Görünüm
Kolon onay kutuları üç sütun; sıralama, yön ve gruplama üç sütun.
- **Label'lar:** `Columns` (`Project`, `Status`, `Stage`, `Target date`, `Project areas`, `Archive`, `Last reported health`), `Sort` (`Project`, `Status`, `Target date`, `Created date`, `Updated date`), `Direction` (tarih ve sayı kolonlarında `Ascending`, `Descending`; metin kolonu `Project` için `A–Z`, `Z–A`), `Grouping` (`None`, `Status`, `Stage`, `Archive`).

### Eylemler
.
- **Label'lar:** `Cancel`, `Save list`.

### Durumlar
#### Error
"Check the list name, conditions, and view settings."

**Spec:** [15 Çalışma Alanı Genel Bakışı](../../specs/15-workspace-overview/spec.md).

## 02.6 · Create Project
> Yalnız `Project Name` ve bir Başlangıç yapılandırmasıyla `Active` bir Proje açılır.

**Artboard'lar**
- `02.6 · Create Project · Default · 1440`
- `02.6 · Create Project · Optional details open · 1440`
- `02.6 · Create Project · Error · 1440`

### Ekmek kırıntısı ve başlık
`Projects` › `Create`; `Create Project`; "Give the work a home. Choose a starting configuration once…".
- **Label'lar:** `Projects`, `Create`, `Create Project`.

### Project profile
Zorunlu profil bölümü: `Project profile` başlığı ve "Start with a name and configuration. A Short code is suggested from the Project Name and can be changed from Projects until the first Work." Ad alanı; altında önerilen `Short code` önizlemesi (salt okunur); Başlangıç yapılandırması seçimi, seçilebilir dört satırlık liste olarak, her satırda ne kurduğunun kısa özeti:
  - `Blank Project`: aşama yok; alanlar `Work`, `Documents`; görünümler `Backlog`, `Board`, `List`.
  - `Solo SaaS`: aşamalar `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate`; bütün Proje alanları; sabitlenenler `Discovery`, `Decisions`, `Design`, `Tests`, `Releases`; görünümler `Backlog`, `Board`, `List`, `Roadmap`.
  - `Open Source Library`: aşamalar `Scope`, `Build`, `Validate`, `Release`, `Maintain`; alanlar `Work`, `Documents`, `Decisions`, `Technical Diagrams`, `Tests`, `Releases`, `GitHub`; sabitlenenler `GitHub`, `Tests`, `Releases`; görünümler `Backlog`, `Board`, `List`, `Roadmap`.
  - `Mobile Application`: aşamalar `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate`; bütün Proje alanları; sabitlenenler `Discovery`, `Design`, `Tests`, `Releases`, `Production`; görünümler `Backlog`, `Board`, `List`, `Roadmap`.
  - Dördü de `Not Started`, `In Progress`, `Blocked`, `Closed` Work durumlarını kurar ve `Overview`, `Work`, `Documents`, `All Tools` erişilebilir kalır. Örnek içerik kurulmaz.
- **Label'lar:** `Project profile`, `Project Name`, `Short code`, `Starter Configuration`, `Blank Project`, `Solo SaaS`, `Open Source Library`, `Mobile Application`, "A one-time starting structure. It does not create sample content."

### Optional profile details
Varsayılan kapalı açıklama: amaç, problem, kapsam, hedef tarih, logo.
- **Label'lar:** `Optional profile details`, `Purpose`, `Problem`, `Scope`, `Target date`, `Clear target date`, `Logo`, "Optional. Choose a PNG, JPEG, WebP, or GIF image up to 750 KB. Project color, CSS, and fonts are not part of the profile."

### Eylemler
Formun altında iptal ve birincil eylem.
- **Label'lar:** `Cancel`, `Create Project` (gönderirken `Creating…`).

### Durumlar
#### Error
Üstte uyarı "Nothing was changed. Review the fields and try again."; genel "Project could not be created. Try again."; logo hataları "Logo must be a PNG, JPEG, WebP, or GIF image." / "Logo could not be read.".
#### Submitting
Birincil düğme `Creating…`, form kilitli.
#### Offline
→ `20.16 · Offline`; oluşturma kapalı.

**Spec:** [07 Proje Kabuğu](../../specs/07-project-shell/spec.md).

## 02.7 · Search
> Yetkili ana kayıtlar deterministik tam metin sırasıyla, neden bulunduğu gösterilerek bulunur.

**Artboard'lar**
- `02.7 · Search · Results · 1440`
- `02.7 · Search · Empty query · 1440`
- `02.7 · Search · No matches · 1440`
- `02.7 · Search · Error · 1440`

### Başlık
Geniş modalın başı: `Search`; "Find authorized records across Projects and the Personal Wiki."; kapatma.
- **Label'lar:** `Search`.

### Discovery view
Tek seçici: `Search`, on bir hazır dizin, `Table`.
- **Label'lar:** `Discovery view`, `Search`, `All Work`, `All Documents`, `All Decisions`, `All Risks`, `All Research Sessions`, `All Tests`, `All Designs`, `All Technical Diagrams`, `All Project Releases`, `All Sources`, `All Files`, `Table`.

### Sorgu ve filtreler
Sorgu alanı; görünür filtrelerle eşleşen sınırlı operatörler otomatik tamamlamayla filtre çipine dönüşür; `Archived` onay kutusu; Karar sonuçlarında `Status`. Proje kapsamında, türe bağlı Proje özel alanları da arama ve filtreye sunulur (alan tanımı → `08.16`); özel alan filtresi ile `Priority criterion` / `Rank` filtresinin kuralı → `09.1 · Filtreler` (kademe skalası → `08.19 › Rank descriptions`). Süzülmüş aramayı koleksiyona çeviren eylem `Save as Smart Collection` (→ `08.12` `Create` formu, koşullar önceden dolu; geçici arama üyelik yazmaz). `All Work` sonuç satırlarında seçim kutuları ve seçim çubuğu → `DS.14 · Seçim` (`Bulk Edit` → `20.8`; Projeler arası alan seçici kuralı da orada).
- **Label'lar:** `Search`, `Scope` (`All scopes`, `Personal Wiki`, `Project: Luma`), `Type` (`All types`), `Folder` (`All folders`), `Archived`, `Status`, `Save as Smart Collection`, `Bulk Edit`. `Type` ve `Folder` yalnız Belge ve Dosya dizinlerinde görünür.

### Search results
Sonuç kartları başlık sırasına göre (başlık/anahtar → güncel Proje → aktif → `Completed`/`Abandoned` → yenilik → kimlik). Her sonuçta başlık, rozetler (tür, durum, varsa kapanış sonucu, kapsam), vurgulu eşleşme parçası, eşleşme sayısı, `Open source record`. Bir sonuç açıldığında tür destekliyorsa eşleşme konumuna inilir; desteklemiyorsa bunu söyleyen kısa açıklama görünür (spec'te label yok; metni tasarım aşamasında yazılır). Sonuç türleri arasında Proje de vardır (tür rozeti `Project`; `Open source record` Projenin `Overview`'ına gider) ve eşleşme parçası `Next concrete step` metninden gelebilir. Workspace kapsamında kimlik defteri sonuç grupları `Contact` ve `Company`; emekli kimlik sonuç olarak listelenmez (→ `06.1` › Redirected from).
- **Label'lar:** `Search results`, `Open source record`, kapsam `Project: Luma` / `Personal Wiki`, "N matches".

### Durumlar
#### Empty
Sorgu yok: "Type to search authorized records."; sonuç yok: "No matching records.".
#### Loading
"Loading…".
#### Error
"Search is unavailable."
#### Archived filter on
Arşivli sonuçlar `Archived` durum rozetiyle; Çöp Kutusu hiçbir zaman.

**Spec:** [33 Kayıt Keşfi](../../specs/33-record-discovery/spec.md).

## 02.8 · Type index
> Bir türün bütün ana kayıtları sıfır kurulumla gezilir.

**Artboard'lar**
- `02.8 · Type index · All Work · 1440`
- `02.8 · Type index · All Documents · 1440`
- `02.8 · Type index · Empty · 1440`
- `02.8 · Type index · All Documents · Wiki scope · 1440`

### Sayfa başlığı
Dizin adı ve eylem alanı. `All Work` çapraz Proje İş listesidir: başlıkta `Export` → `20.5 · Export` (ekranda görülen kesin görünüm; seçim varsa seçili kayıtlar). `Import` yoktur, çünkü çapraz Proje listesi tek kapsam seçemez (→ `20.6`). `All Work` satırlarında seçim kutuları ve seçim çubuğu → `DS.14 · Seçim` (`Bulk Edit` → `20.8`). Diğer dizinlerde `Export` yoktur.
- **Label'lar:** `Export`, `Bulk Edit`.

### Filtreler
`02.7` › Sorgu ve filtreler ile aynı label'lar; modalda sorgu alanı yerine yalnız filtre satırı. Dizine özgü fark: kapsam her dizinde; `Type` ve `Folder` yalnız `All Documents` ve `All Files`'ta; `Status` yalnız `All Decisions`'ta.

### Dizin satırları
Başlık, rozetler (tür, kategori, `All Technical Diagrams`'da otorite kipi, `All Files`'ta dosya adı ve MIME), durum, kapsam, varsa "Folder: …", `Open source record`. Eşleşme parçası/sayısı yok. `All Files` satırlarında küçük resim ve çözülemeyen görselde `Unavailable` kenar durumu → `20.13 · Önizleme`.
- **Label'lar:** `Open source record`.

### Durumlar
#### Empty
"No records in this index."
#### Loading
"Loading…".
#### Error
"Search is unavailable."
#### All Documents (kapsam rozetli)
Proje ve Wiki Belgeleri birlikte listelenir; her satırda `Personal Wiki` veya `Project: Luma` kapsam rozeti hiç atlanmaz. Aynı başlık iki evde olabilir, rozet ayırır. Örnek: `Pricing heuristics` · `Personal Wiki`; `Pricing page copy` · `Project: Luma`; `How I write specs` · `Personal Wiki`; `Release checklist` · `Project: tidekit`. `Open source record` Belgeyi kendi evinde açar (Wiki → `05.1`, Proje → `10.2`); kopya açılmaz. `Scope` = `Personal Wiki` seçiliyken yalnız Wiki satırları görünür.

**Spec:** [33 Kayıt Keşfi](../../specs/33-record-discovery/spec.md).

## 02.9 · Table
> İzinli tek bir tür için aynı ana kayıtlar tabloda görülür, izinli hücreler satır içinde düzenlenir ve satır yapıştırma önizlenip atomik uygulanır.

**Artboard'lar**
- `02.9 · Table · Default · 1440`
- `02.9 · Table · Default · 768`
- `02.9 · Table · Paste review · 1440`
- `02.9 · Table · Error · 1440`

### Seçiciler ve filtre
Üstte `Type` ve `Project` seçicileri ile `Filter rows`.
- **Label'lar:** `Type` (Work, Decision, Risk, Assumption, Open Question, Milestone, Project Release, Production Incident), `Project` (`All Projects`), `Filter rows`.

### Tablo
Tam genişlikte sıralanabilir kolon başlıkları, izinli hücrelerde satır içi düzenleme.
Tablo başlığı eylem alanında `Export` → `20.5 · Export`. `Work` türünde satır seçim kutuları ve seçim çubuğu → `DS.14 · Seçim` (`Bulk Edit` → `20.8`; Projeler arası alan seçici kuralı da orada).
- **Label'lar:** `Title`, `Status`, `Description`, `Target date`, `Impact`, `Probability`… (türe göre); `Export`, `Bulk Edit`; "Sort by …", "Edit … for …" (erişilebilir adlar).

### Paste rows
En altta kapalı bölüm: yapıştırma alanı ve `Preview paste`. Kolon eşleme ve satır inceleme (`Column mapping` etiketleri ve davranışı → `20.6 · Column mapping`; kaynak kolon → alan, `Skip column`, hatalı satırı düzeltme / hariç tutma, "Row N · Create/Update" farkı) `20.6 · Import` › 2 · Eşleme ve 3 · Fark ve çatışmalar ile aynı sözleşmedir; burada yeniden tarif edilmez. `Paste rows` farkı: dosya yok, satırlar bu Tablonun seçili türüne yazılır; eşleme seçeneklerine `Record ID` eklenir (mevcut satırı günceller); onay `Apply Import` değil `Apply changes`.
- **Label'lar:** `Paste rows`, `Preview paste`, `Record ID`, `Review paste`, `Apply changes`, `Applying changes…`, `Changes applied.`

### Durumlar
#### Empty
"No matching records."
#### Loading
"Loading…".
#### Error
"Table is unavailable."; yapıştırma: "Paste a header row and at least one data row.", "Record ID must match a row in this Table.", "Select a Project before creating rows.", "Could not apply these changes.".
#### Paste review
Eşleme + inceleme açık (`20.6` bileşenleri), bir satır düzeltme formunda.

**Spec:** [33 Kayıt Keşfi](../../specs/33-record-discovery/spec.md), [80 Standart Dosyalardan İçe Aktarma](../../specs/80-data-import/spec.md) (aynı önizleme sözleşmesi).

## 02.10 · Drafts
> Yarıda kalmış kişisel İş oluşturma formları sürdürülür veya silinir.

**Artboard'lar**
- `02.10 · Drafts · Default · 1440`
- `02.10 · Drafts · Empty · 1440`
- `02.10 · Drafts · Offline · 1440`

### Başlık
`Drafts`; Taslağın İş olmadığını, süreyle silinmediğini anlatan tek satır.
- **Label'lar:** `Drafts`.

### Taslak listesi
Tek sütun liste; her satırda başlık (yoksa `Untitled Draft`), tür · hedef Proje, son kayıt zamanı, `Resume` ve `Delete`.
- **Label'lar:** `Untitled Draft`, `Resume`, `Delete`, `Last saved`.

### Taslak formu durum şeridi (referans)
→ `09.11` (durum şeridi, `Save` / `Create` ve form gövdesi orada çizilir; burada yeniden yazılmaz).

### Durumlar
#### Empty
"No Drafts yet."
#### Loading
"Loading Drafts…"
#### Error
"Drafts are unavailable. Try loading this page again."
#### Offline
→ `20.16 · Offline`. Burada yalnız `Resume` / `Delete` / `Create` kapalıdır.

**Spec:** [11 Tamamlanmamış İş Taslakları](../../specs/11-work-drafts/spec.md).

## 02.11 · Trash
> Çöp Kutusundaki ana kayıtlar, yapılandırma tanımları ve Proje silme grupları 30 günlük sürede görülür, aynı kimlikle geri yüklenir veya erken kalıcı silinir.

**Artboard'lar**
- `02.11 · Trash · Default · 1440`
- `02.11 · Trash · Empty · 1440`
- `02.11 · Trash · Project group expanded · 1440`
- `02.11 · Trash · Permanent delete blocked · 1440`
- `02.11 · Trash · Restored with kept surface · 1440`

### Başlık
`Trash`; 30 gün sonra kalıcı silindiğini ve Arşiv veya geri yükleme noktası olmadığını söyleyen tek satır; altında ince filtre satırı (tür, kapsam).
- **Label'lar:** `Trash`.

### Ana kayıtlar
Satır: kayıt başlığı, tür, kapsam (Proje / Kişisel Wiki), Çöp Kutusuna alınma tarihi, kalan gün, bağlı Dış yüzey özeti; `Restore`, `Permanently Delete`. Test Oturumu çocuk Oturum Testleriyle tek tarihsel bütün olarak tek satırdır; çocuklarda eylem yoktur. İptal edilmiş Dış yüzey kaydı da `In Trash` satırıdır ve `Restore` / `Permanently Delete` taşır.
- **Label'lar:** `Restore`, `Permanently Delete`, `In Trash`.

### Proje silme grupları
Proje başına tek satır: Proje adı, içerdiği kayıt sayısı, tek 30 günlük saat; satır genişletilince çocuklar salt okunur listelenir (tek tek eylem yok). Geri yükleme Projeyi Aktif'e değil Arşive döndürür ve Dış yüzeyi yeniden yayımlamaz; eylem Proje grubunda `Restore to Archive` (grup dışı kayıtlarda `Restore`); sonuç metni `Restoring returns the Project to Archive. No surface is republished and GitHub stays disconnected.`.
- **Label'lar:** `Restore to Archive`, `Restore`, `Permanently Delete`.

### Yapılandırma çöpü
Tür listesinin ve "çalışmıyor" kuralının tek sahibi burasıdır (`20.2` › Yapılandırma çöpü yalnız taşıma anındaki etki önizlemesini çizer ve buraya bağlanır). Proje bazlı türler: özel alan, öncelik ölçütü, Akıllı Koleksiyon, adlandırılmış görünüm, Önceliklendirme oturumu, otomasyon kuralı, kullanıcı tanımlı Kayıt Eylemi, Belge şablonu, İş şablonu. Satırda tür, Proje, etkilenen saklı değer sayısı ve `Not running` notu: çöpteki tanım çalışmaz, kural tetiklenmez, görünüm ve koleksiyon üyelik üretmez veya listelemez. `Restore` aynı kimliği ve saklı değerleri döndürür; çözülemeyen bağımlılık varsa `02.12` önizlemesi açılır, sessiz yeniden bağlama yoktur.
- **Label'lar:** `Restore`, `Permanently Delete`, `Not running`.

### Durumlar
#### Empty
Dürüst boş durum: `Trash is empty.`; "her şey yolunda" iddiası taşımaz.
#### Loading
Satır iskeletleri.
#### Error
Liste yüklenemedi + yeniden dene.
#### Permanently deleted
Kalıcı silinen kayıt listeden kalkar; ilgili kırık referanslarda `Permanently deleted` nedeni görünür (→ `20.10 · Kırık uç`).
#### Permanent delete blocked
→ `20.3 · Permanently Delete` › Engelli (neden ve ilgili yer orada tanımlıdır).
#### Restored with kept surface
Geri yüklenen Projede korunan (kept) Dış yüzey donmuş kalır, otomatik yeniden bağlanmaz; yayın açık bağla-ve-onayla gerektirir: `Republishing requires a new approval.`.

**Spec:** [77 Çöp Kutusu](../../specs/77-trash/spec.md), [76 Paylaşım ve Yayınları Yönetme](../../specs/76-external-surface-management/spec.md) (iptal edilmiş Dış yüzey satırları).

## 02.12 · Restore conflict preview
> Yapılandırma tanımı geri yüklenirken kalıcı silinmiş veya anlamı değişmiş bağımlılık sessiz yeniden bağlama olmadan gösterilir.

**Artboard'lar**
- `02.12 · Restore conflict preview · Default · 1440`
- —

### Geri dönecekler
Orta boy dialog'un ilk bölümü: aynı kimlik, tanım, saklanan değerler, çözülebilen bağımlılıklar.

### Çakışmalar
Her bağımlılık için ne olduğu ve neden çözülemediği; kullanıcı çözümü seçeneği.

### Eylemler
Dialog'un alt şeridi.
- **Label'lar:** `Restore`, `Cancel`.

### Durumlar
#### Error
Uygulanamadı; hiçbir şey değişmedi.

**Spec:** [77 Çöp Kutusu](../../specs/77-trash/spec.md).

## 02.13 · Shares and Publications
> Bütün Dış yüzeyler (bağlantı paylaşımı, Wiki yayını, Build in Public) tek dizinde görülür ve yaşam döngüleri yönetilir; oluşturma burada değil. Yaşam döngüsü yönetiminin (dizin, `Change expiry`, `Reactivate`, `Revoke` / `Unpublish`) tek sahibi bu ekrandır.

**Artboard'lar**
- `02.13 · Shares and Publications · Default · 1440`
- `02.13 · Shares and Publications · Default · 768`
- `02.13 · Shares and Publications · Empty · 1440`
- `02.13 · Shares and Publications · Project scope · 1440`
- `02.13 · Shares and Publications · Revoke confirmation · 1440`
- `02.13 · Shares and Publications · Unpublish confirmation · 1440`
- `02.13 · Shares and Publications · Purge retry · 1440`

### Başlık
`Shares and Publications`; görüntülenme analitiği tutulmadığını söyleyen tek satır.
- **Label'lar:** `Shares and Publications`.

### Filtreler
Proje (Proje kapsamlı giriş bunu önceden seçer; `Project scope` artboard'ında Proje filtresi seçili ve kilitli, Proje adı başlıkta), görünürlük türü, durum.
- **Label'lar:** `Active`, `Expired`, `Revoked`.

### Dizin
Tam genişlik tablo, satır sonunda eylem menüsü; satır durumuna göre eylemler: `Open source`, `Review diff`, `Change expiry` / `Reactivate`, `Revoke` (yalnız bağlantı paylaşımı), `Unpublish` (Wiki yayını ve Build in Public; PRD 02'de ayrı label'lardır, birbirinin yerine yazılmaz), `Move to Trash`. `Change expiry` ve `Reactivate` satır durumuna göre (`Expired` satırda `Reactivate`); `Revoked` satır terminaldir (URL yeniden kullanılmaz). Kolonlar: kaynak kayıt ve kapsam, görünürlük türü, parola var/yok (asla parola değil), sona erme, durum, son onay zamanı, yayımlanmamış değişiklik işareti, redaksiyon durumu, donmuş/ayrık işareti.
- **Label'lar:** `Active`, `Expired`, `Revoked`.

### Durumlar
#### Empty
Hiç Dış yüzey yok; oluşturmanın kaynak kayıtlarda yapıldığını söyleyen not, oluşturma düğmesi yok.
#### Loading
Satır iskeletleri.
#### Error
Dizin yüklenemedi.
#### Revoke confirmation
Bağlantı paylaşımı satırından `Revoke`: yeni erişim hemen durur, cache temizliği başlar, URL yeniden kullanılmaz; üçüncü taraf kopyaların silindiği iddia edilmez. Kamuya açık `410 Gone` davranışı → `19.9`.
#### Unpublish confirmation
Wiki yayını ve Build in Public satırından `Unpublish`: `Revoke confirmation` ile aynı çizim, ikinci varyant; onay metni ve eylemleri → `20.4 · Yayın ayarları`. `410 Gone` → `19.9`.
#### Purge retry
Cache/indeks temizleme isteği başarısız: satırda görünür yeniden deneme; içerik yeniden açılmaz.
#### Redacted
Redakte revizyon "redacted" olarak, kaldırılan değer olmadan.

**Spec:** [76 Paylaşım ve Yayınları Yönetme](../../specs/76-external-surface-management/spec.md), [77 Çöp Kutusu](../../specs/77-trash/spec.md).

## 02.14 · Workspace Exit Package
> Bütün Çalışma Alanı kurucu parolasıyla şifrelenmiş, manifestli bir arşiv olarak üretilir ve süreli indirilir; yedek veya geri yükleme değildir.

**Artboard'lar**
- `02.14 · Workspace Exit Package · Default · 1440`
- `02.14 · Workspace Exit Package · Producing · 1440`
- `02.14 · Workspace Exit Package · Ready · 1440`
- `02.14 · Workspace Exit Package · Download revoked · 1440`
- `02.14 · Workspace Exit Package · Account closure · 1440`

### Başlık ve sınırlar
`Workspace Exit Package`; uygulama içi geri yükleme olmadığını, AB'deki canlı verinin taşınmadığını ve operasyonel yedek olmadığını söyleyen kısa metin; uygulamasız envelope tanımına bağlantı `Envelope definition`.
- **Label'lar:** `Workspace Exit Package`, `Envelope definition`.

### İçerik özeti
Girecekler: kullanıcı içeriği, ek sürümleri, kimlikler, ilişkiler, geçmiş, yapılandırma (okunabilir Markdown/JSON + özgün dosyalar + tek manifest). Girmeyecekler: oturumlar, secret'lar, dış erişim anahtarları, operasyon logları, türetilmiş cache'ler, Yakalama ekleri.

### Parola
Parola ve tekrar alanı; sunucuda saklanmadığını, unutulursa paketin okunamayacağını, kurtarma kodu veya şifresiz kopya olmadığını söyleyen uyarı. Uyuşmazlıkta alan altında `The passwords do not match.`.
Parola kaybı cümlesinin tek sahibi burasıdır; `01.9` ve `01.10` bu cümleyi referansla gösterir: `If you forget the package password, the Workspace Exit Package cannot be read. There is no recovery code and no unencrypted copy.`.
- **Label'lar:** `Package password`, `Confirm package password`, `The passwords do not match.`, `If you forget the package password, the Workspace Exit Package cannot be read. There is no recovery code and no unencrypted copy.`.

### Üretim ve indirme
Üretim durumu; üretimi başlatan eylem `Produce Workspace Exit Package`; hazır olunca süreli indirme ve sona erme zamanı; indirmeyi iptal etme `Revoke download`.
- **Label'lar:** `Produce Workspace Exit Package`, `Download Workspace Exit Package`, `Revoke download`.

### Durumlar
#### Producing
Üretiliyor; sayfadan ayrılmak üretimi bozmaz.
#### Ready
İndirme ve sona erme görünür.
#### Expired / Revoked
Bağlantı öldü; yeni paket üretilebilir.
#### Download revoked
`Revoke download` sonrası indirme bağlantısı kapalı; durum satırı bunu söyler ve `Produce Workspace Exit Package` yeniden açılır.
#### Error
Üretim başarısız; parola saklanmadığı için yeniden girilmesi gerekir.
#### Account closure
Hesap kapanış dondurmasında (84) zorunlu adım: en az bir başarılı üretim ve 30 gün indirilebilirlik; seçili dışa aktarmanın ayrı eylem olduğu notu.

**Spec:** [82 Çalışma Alanı Çıkış Paketi](../../specs/82-workspace-exit/spec.md).

