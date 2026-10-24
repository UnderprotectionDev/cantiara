# 14 · Technical Diagrams

Projenin `Technical Diagrams` alanı: Teknik Mimari, Veri Modeli ve Teknik Sıra diyagramları.

| Ekran | Ne çizilir |
|---|---|
| [14.1 · Technical Diagrams](#141--technical-diagrams) | Diyagram listesi |
| [14.2 · New Technical Diagram](#142--new-technical-diagram) | Yeni diyagram dialog'u |
| [14.3 · Technical Diagram Editor](#143--technical-diagram-editor) | Outline + tuval editörü, görünüm ve sürüm |
| [14.4 · Convert Authority](#144--convert-authority) | Otorite dönüşümü önizlemesi |
| [14.5 · Convert to record and link](#145--convert-to-record-and-link) | Düğümden kayıt açma önizlemesi |
| [14.6 · Convert to Technical Diagram](#146--convert-to-technical-diagram) | Mermaid dönüşüm dialog'u |
| [14.7 · Schema Artifacts](#147--schema-artifacts) | DDL taslağı ve doğrulama sonucu |
| [14.8 · Schema Change Draft](#148--schema-change-draft) | Operasyon planı, Up/Down SQL |
| [14.9 · Migration Artifact](#149--migration-artifact) | Değişmez artefakt ve manifest |

## 14.1 · Technical Diagrams
> Projenin Teknik Diyagramlarını tür ve otorite kipiyle listelemek ve yenisini açmak.

**Artboard'lar**
- `14.1 · Technical Diagrams · Default · 1440`
- `14.1 · Technical Diagrams · Empty · 1440`

### Alan başlığı
- **Label'lar:** `Technical Diagrams`, `New Technical Diagram`.

### Diyagram listesi
Tür grupları değil tek liste; her satır bir Teknik Diyagram kimliği: başlık, tür; satır metası (otorite kipi, son Diyagram Sürümü, köken) → `DS.17`.
- **Label'lar:** `Technical Architecture`, `Data Model`, `Technical Sequence`, `Product-authored Model`, `Imported Independent Copy`, `External Source Link`, `Diagram Version`, `Originates from`, `Derived from`.

### Durumlar
#### Empty
Liste yerine tek cümle ve `New Technical Diagram`; örnek diyagram üretilmez.
#### Error
`Technical Diagram is unavailable.`
#### Archived Project
Ferry: `New Technical Diagram` gizli; satırlar salt okunur editöre açılır.

**Spec:** [59 Teknik Diyagramlar](../../specs/59-technical-diagrams/spec.md).

## 14.2 · New Technical Diagram
> Başlık, tür ve değişmez otorite kipiyle yeni Teknik Diyagram açmak.

**Artboard'lar**
- `14.2 · New Technical Diagram · Product-authored · 1440`
- `14.2 · New Technical Diagram · External Source Link · 1440`

### Alanlar
Alanlar alt alta; `External Source Link` seçilince ek alan grubu açılır.
- **Label'lar:** `New Technical Diagram`, `Title`, `Type`, `Technical Architecture`, `Data Model`, `Technical Sequence`, `Diagram Authority Mode`, `Product-authored Model`, `External Source Link`, `HTTPS URL`, `Source tool`, `Known revision (optional)`, `Create`.

### Durumlar
#### Error
`Technical Diagram could not be created.`; URL HTTPS değilse alan hatası.

**Spec:** [59](../../specs/59-technical-diagrams/spec.md).

## 14.3 · Technical Diagram Editor
> Bir Teknik Diyagramın türlenmiş yapısal modelini outline ve tuvalde düzenlemek; Diyagram Görünümü ve Diyagram Sürümünü yönetmek.

**Artboard'lar**
- `14.3 · Technical Diagram Editor · Technical Architecture · 1440`
- `14.3 · Technical Diagram Editor · Technical Architecture · 768`
- `14.3 · Technical Diagram Editor · Data Model · 1440`
- `14.3 · Technical Diagram Editor · Technical Sequence · 1440`
- `14.3 · Technical Diagram Editor · External Source Link · 1440`
- `14.3 · Technical Diagram Editor · Empty model · 1440`
- `14.3 · Technical Diagram Editor · Diagram Versions · 1440`
- `14.3 · Technical Diagram Editor · Export preview · 1440`

### Kayıt başlığı
Başlık, tür · otorite kipi, köken listesi, kayıt eylemleri; `External Source Link` için dış kaynak ayrıntısı. Data Model türünde başlıkta `Schema Artifacts` bölüm bağlantısı (→ `14.7`).
- **Label'lar:** `Technical Diagram`, `Origin`, `Originates from`, `Derived from`, `External Source Link`, `Open external source`, `URL`, `Tool`, `Revision`, `Unknown`, `Last checked`.

### Yapılandırılmış outline
Türe göre kanonik model: Architecture `Nodes` + `Links`; Data Model `Tables` (column'lar, index'ler) + `Relations`; Sequence `Participants` (bağlı Architecture düğümü ve sürümüyle) + `Steps`. Görünüm-yerel daraltılmış gruplar.
<details>
<summary>Label'lar</summary>

`Technical Diagram outline`, `Nodes`, `Links`, `Architecture nodes`, `Architecture links`, `Tables`, `Relations`, `Data Model tables`, `Data Model relations`, `<table> columns`, `<table> indexes`, `Participants`, `Steps`, `Sequence participants`, `Sequence steps`, `bound to <node> (<version>)`, `Expand group`, `Collapse group`.

</details>

### Tuval
React Flow görünümü; düğüm konumları Diyagram Görünümü üstverisidir, model outline'dır. Yerleştirilmiş salt okunur kayıt kartları. Açıklama satırı. Zoom ve görünüm grubu (`Zoom in`, `Zoom out`, `Fit View`) ve kişisel viewport → `13.2`.
- **Label'lar:** `Technical Diagram canvas`, "Canvas view of the structured outline. Positions are saved on the Diagram View; the model is the outline. Your zoom, position and collapsed groups are personal and not part of the diagram."

### Edit structural model
Türe özgü kapalı formlar ve kaldırma listeleri.
<details>
<summary>Label'lar</summary>

`Edit structural model`. Architecture: `Add node`, `Node kind`, `Node label`, `Component`, `Service`, `Datastore`, `Queue/Event Bus`, `External System`, `Boundary`, `Add link`, `Link from`, `Link to`, `Link kind`, `Calls`, `Reads from`, `Writes to`, `Publishes to`, `Subscribes to`, `Depends on`, `Contains`, `Remove nodes`. Data Model: `Add table`, `Table name`, `Add column`, `Column table`, `Column name`, `PostgreSQL type`, `Nullable`, `Primary key`, `Unique`, `Default`, `Add relation`, `From table`, `From column`, `To table`, `To column`, `Cardinality`, `One to one`, `One to many`, `On delete`, `On update`, `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`, `Add index`, `Index name`, `Index column`, `Unique index`, `Remove tables`. Sequence: `Add participant`, `Participant label`, `Participant kind`, `Actor`, `Bind to Architecture node`, `No bind`, `Add message`, `Message from`, `Message to`, `Message label`, `Message kind`, `Sync`, `Async`, `Event`, `Return`, `Add control group`, `Group kind`, `Alt`, `Opt`, `Loop`, `Group condition`, `Remove steps and participants`.

</details>

### Diagram View
Adlandırılmış görünümler (seçili öğeler + yerleşim; kopya değil); yeni görünüm formu.
- **Label'lar:** `Diagram View`, `Name`, `Save`, `Default`.

### Diagram Version
Açıklama, değişmez checkpoint listesi (ad, numara, alındığı canlı revizyon, `Restore`), yeni sürüm formu.
- **Label'lar:** `Diagram Version`, `Diagram Versions`, "A Diagram Version is an immutable checkpoint. Live revision <n>.", `<name> · version <n> · taken at live revision <r>`, `Restore`, `Restore Diagram Version <name>`, "Restore writes a new live revision; the Diagram Version stays unchanged.", `Diagram Version name`.

### Record cards
Salt okunur yerleştirilmiş İş/Karar/Risk/Açık Soru kartları; yerleştirme formu; yerel düğümü kayda dönüştürme girişi (→ `14.5`).
- **Label'lar:** `Record cards`, `Placed record cards`, `Existing record`, `Choose a record`, `Place live card`, `Remove from diagram`, `Open source record`, `Archived`, `Convert to record and link`.
Kaynağı Çöpte, kalıcı silinmiş veya erişilemeyen kart kırık hedef olarak gösterilir; neden kümesi ve başlık/gövde sızmaması `20.10` Kırık uç'tadır (→ `20.10`), yeniden tarif edilmez.

### Convert authority
Açıklama ve dönüşüm başlatma → `14.4`.
- **Label'lar:** `Convert authority`, "Diagram Authority Mode never changes in place. Converting creates a new Technical Diagram that Originates from this one."

### Dışa aktarma
Kayıt başlığındaki ortak `Export` kayıt eylemi (DS.11 → `20.5`) bu ekranda Teknik Diyagrama özgü bir önizleme açar. Kaynak: kesin Diyagram Sürümü veya Diyagram Görünümü. Biçimler: görsel çıktı `PNG`, `SVG`, `PDF` (okunabilir sayfalanmış snapshot; büyük diyagram tek okunamaz sayfaya sıkıştırılmaz) ve yapısal `JSON`. Önizleme kaynak Teknik Diyagramı, otorite kipini, kesin sürüm veya görünümü ve kapsam dışı öğeleri gösterir; görsel çıktı için statik çıktının canlı bağlantı veya editable round-trip kaynağı olmadığını söyler. `JSON` yapısal modeli, otorite kipini, Diyagram Görünümlerini ve seçili Diyagram Sürümü manifestini taşır; import edilemez, bu yüzden `Import` yoktur. Dış kaynak bağlantısı içerik sahiplenmez; JSON yalnız izin verilen kesin köken üstverisini taşır.
- **Label'lar:** `Export`, `PNG`, `SVG`, `PDF`, `JSON` (biçim adları `13.7` ve `20.5` ile aynı).
- **Önizleme metinleri:** `Source`, `Exact Diagram Version` / `Diagram View`, `Left out of this export`, `Static output. It is not a live link or an editable source.`, `This JSON cannot be imported.`

### Durumlar
#### Export preview
Dışa aktarma bölgesi açık: kaynak seçimi, biçim seçimi ve önizleme metinleri; `Export` onayı.
#### Empty model
Yeni diyagram: outline boş grup başlıkları, tuval boş, `Edit structural model` formları tek giriş.
#### Loading
Editör iskelet satırı yerine tek yüklenme metni.
#### Error
`Structural model could not be saved.`, `Element position could not be saved.`, `Diagram View could not be saved.`, `Diagram Version could not be created.`, `Diagram Version could not be restored.`, `The Technical Diagram changed after it was shown.`, `Your personal view could not be saved.`
#### Data Model
Outline `Tables`/`Relations`; başlıkta `Schema Artifacts` girişi.
#### Technical Sequence
Outline `Participants`/`Steps`; tuval lifeline ve mesaj sırası.
#### External Source Link
Tuval, `Edit structural model` ve sürüm formu yok: "The structural model stays in the external tool." ve "An External Source Link keeps its content in the external tool, so it has no Diagram Version."; dış kaynak ayrıntısı ve `Open external source` baskın. Ürün iframe veya cache göstermez.
#### Read-only
Arşivli Proje veya Çöpteki diyagram: formlar gizli, outline ve tuval okunur.

**Spec:** [59](../../specs/59-technical-diagrams/spec.md); Data Model türünde [60](../../specs/60-schema-artifacts/spec.md) giriş noktası.

## 14.4 · Convert Authority
> Başka otorite kipine geçişi, kaynağı yerinde yeniden sınıflandırmadan yeni kimlik ve iki yönlü kökenle önizleyip onaylamak.

**Artboard'lar**
- `14.4 · Convert Authority · Preview · 1440`

### Hedef
Hedef kip ve yeni kimliğin alanları; alan seti `14.2 · Alanlar` ile aynıdır (yeniden yazılmaz → `14.2`).
- **Label'lar:** `Preview conversion`.

### Önizleme
Kaynak → hedef kip, kayıp satırları, tarihçe etkisi.
- **Label'lar:** `<source mode> to <target mode>: a new Technical Diagram that Originates from this one.`, `Confirm conversion`.

### Durumlar
#### Error
Önizleme veya onay hatası satırı.

**Spec:** [59](../../specs/59-technical-diagrams/spec.md).

## 14.5 · Convert to record and link
> Kesin Diyagram Sürümündeki yerel bir düğümden önizlemeyle tam olarak bir İş, Karar, Risk veya Açık Soru açmak; diyagram ve otorite kipi değişmez.

**Artboard'lar**
- `14.5 · Convert to record and link · Preview · 1440`
- `14.5 · Convert to record and link · No version · 1440`

### Seçim
Kesin Diyagram Sürümü, düğüm ve hedef tür seçimi.
<details>
<summary>Label'lar</summary>

`Convert to record and link`, `Diagram Version`, `Choose a Diagram Version`, `Node`, `Choose a node`, `Target type`, `Work`, `Decision`, `Risk`, `Open Question`, `Work type`, `Preview conversion`, "A local node becomes one record only from an exact Diagram Version. Nothing is written before you confirm the preview."

</details>

### Önizleme
Oluşacak tek kaydın dökümü.
- **Label'lar:** `Conversion Preview`, `Target type`, `Work type`, `Project`, `Title`, `Body`, `Exact version`, `Origin`, `Authority mode`, `Cancel`, `Confirm`.

### Durumlar
#### No version
"Create a Diagram Version first."
#### External Source Link
"An External Source Link has no Diagram Version, so none of its elements can be converted."; form yok.
#### Error
`The conversion could not be previewed.`, `The conversion could not be confirmed.`

**Spec:** [59](../../specs/59-technical-diagrams/spec.md).

## 14.6 · Convert to Technical Diagram
> Belgedeki kesin bir Mermaid bloğunu, kayıp ve otorite etkisini önizledikten sonra atomik olarak yeni `Imported Independent Copy` Teknik Diyagrama dönüştürmek; round-trip yoktur.

**Artboard'lar**
- `14.6 · Convert to Technical Diagram · Preview with lost lines · 1440`
- `14.6 · Convert to Technical Diagram · Replace with live reference · 1440`

### Başlık
Dialog adı ve hedef kip.
- **Label'lar:** `Convert to Technical Diagram`, `Imported Independent Copy`.

### Seçimler
Başlık ve özgün bloğun sonucu.
- **Label'lar:** `Title`, `Original Mermaid block`, `Keep independent`, `Replace with live reference`.

### Önizleme
Kaynak Belge ve revizyonu, blok konumu, hedef tür, köken ilişkisi, blok sonucu, ayrıştırılamayan satırlar (her biri ayrı), round-trip olmadığı.
- **Label'lar:** `Technical Architecture · Imported Independent Copy`, `No live round-trip: later edits never sync back.`, `Unparseable items (left out of the diagram)`.

### Durumlar
#### Stale preview
Belge veya seçim değiştiyse onay reddedilir, hiçbir şey yazılmaz; önizleme yenilenir.
#### Unsupported block
Mermaid `flowchart` dışındaki blok türleri reddedilir, açıklama gösterilir.
#### Error
`Preview failed.`, `Conversion failed.`
#### Kenar yok
Dönüştürülebilir kenar yoksa onay kapalıdır.
#### Sonuç
Onaydan sonra editörde oluşan diyagramın adı ve `Open source record`; Markdown görünümünde `Technical Diagrams` bağlantısı görünür.
#### Hata metinleri
`Preview the Mermaid conversion again.`, `No Mermaid block selected.`

**Spec:** [59](../../specs/59-technical-diagrams/spec.md); host Belge editörü [PRD 07](../../prd/07-documents-and-knowledge.md#uygulama-içi-markdown-belge-yönetimi).

## 14.7 · Schema Artifacts
> Veri Modeli Diyagramının kesin bir Diyagram Sürümünden tam PostgreSQL DDL taslağını önizlemek, statik doğrulama sonucunu göstermek, kopyalamak ve `.sql` olarak dışa aktarmak; ürün SQL'i hiçbir hedefe uygulamaz.

**Artboard'lar**
- `14.7 · Schema Artifacts · Statically Validated DDL · 1440`
- `14.7 · Schema Artifacts · Invariant failures · 1440`
- `14.7 · Schema Artifacts · Extension rejected · 1440`

### DDL taslağı başlığı
Kaynak Diyagram Sürümü seçimi, model hash'i, generator sürümü, statik doğrulama sonucu, uyarı manifesti.
- **Label'lar:** `Diagram Version`, `Statically Validated`, `Model hash`, `Generator version`, `Warning manifest`.
- **Eylemler:** `Preview DDL` (sürüm seçildikten sonra üretim), `Copy DDL`, `Export .sql` (manifest eşlik eder); başarı `DDL copied.`, hata `DDL could not be generated.`.

### DDL
Tam PostgreSQL DDL, sabit genişlikli kod bloğunda; bağımlılık sırasında. `CREATE EXTENSION` yoktur.

### Statik doğrulama açıklaması
Sabit not: `Statically Validated means the SQL passed parse and apply on a disposable database that was destroyed afterwards. It does not mean the SQL ran on any of your databases.`. `Statically Validated`'ın anlamı: yapısal invariant'lar, bağımlılık sırası ve üretimle aynı pinlenmiş PostgreSQL major'ında yeni disposable Neon veritabanında parse/apply geçti; veritabanı atıldı. Herhangi bir kullanıcı, staging veya production veritabanında çalıştığı anlamına gelmez; `Applied`, `Ran` veya `Production-ready` değildir. Ürün credential istemez.

### Durumlar
#### Invariant failures
DDL gösterilmez, kopyalama ve dışa aktarma kapalı; tek raporda bütün ihlaller: invariant adı (spec'teki kapalı katalog, verbatim: `Unique table name`, `Unique column name`, `Valid identifier`, `Primary key present`, `Foreign key end exists`, `Foreign key type match`, `Composite column list validity`, `Index column and method validity`, `Non-duplicate index definition`, `Referential action validity`, `Nullability and default consistency`, `Enum and domain value validity`, `Sortable foreign key graph`), kesin öğe yolu (`invoices.client_id`) ve gereken düzeltme. İlk hatada durmaz; kısmi veya yorumlanmış SQL yok.
#### Extension rejected
Matris dışı yüzey adıyla reddedilir: `vector` gerektiren `embeddings.vector` öğesi; çekirdek karşılığını modelleme yönlendirmesi. İzinli extension yalnız `pg_trgm`; reddedilenler `postgis`, `vector`, `citext`, `hstore`, `uuid-ossp`, `pgcrypto`. `CREATE EXTENSION is never generated.`
#### Validating
Disposable doğrulama sürerken sonuç alanında ilerleme satırı; DDL beklemede.
#### Validation unavailable
Disposable veritabanı oluşturulamazsa `Statically Validated` verilmez; nedeni ve yeniden deneme.
#### No version
Sürümü olmayan Veri Modeli: önce `Diagram Version` oluşturma yönlendirmesi (→ `14.3`).

**Spec:** [60 PostgreSQL Şeması ve Migration Artefaktları](../../specs/60-schema-artifacts/spec.md); [PRD 11 veri modeli şemaları](../../prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari).

## 14.8 · Schema Change Draft
> Aynı Veri Modeli Diyagramının iki kesin Diyagram Sürümü arasında türlenmiş operasyon planını, yıkıcı uyarıları ve Up/Güvenli Down SQL'ini önizleyip onaylamak.

**Artboard'lar**
- `14.8 · Schema Change Draft · Destructive, no Safe Down · 1440`
- `14.8 · Schema Change Draft · Destructive, no Safe Down · 768`
- `14.8 · Schema Change Draft · Safe Down available · 1440`
- `14.8 · Schema Change Draft · Edited Up · 1440`
- `14.8 · Schema Change Draft · Unsupported difference · 1440`

### Sürüm sabitleri
Kaynak → hedef Diyagram Sürümü; ikisi de değiştirilemez sabittir.
- **Label'lar:** `Schema Change Draft`, `Diagram Version`.

### Operasyon planı
Kapalı katalogdan türlenmiş operasyonlar, faz sırasıyla; her satırda faz, sınıf, öğe, mevcut veri uyarısı.
<details>
<summary>Label'lar</summary>

Yıkıcı operasyon adları spec'ten: `Drop table`, `Drop column`, `Narrow column type`, `Drop primary key`, `Drop foreign key`, `Drop unique constraint`, `Drop check constraint`, `Drop enum value`, `Drop enum type`, `Drop domain constraint`, `Drop domain`. 
Sınıflar (PRD 11 sınıflarının İngilizce karşılığı): `Non-destructive`, `Potentially destructive`, `Unsupported`. Faz: `Phase <n>`. Satır etiketleri: `Existing data warning`, `Reverse data warning`, `Extension required`.

`Non-destructive` operasyonlar (PRD 11 sırası): `Create table`, `Rename table`, `Add column`, `Rename column`, `Widen column type`, `Relax nullability`, `Tighten nullability`, `Add or change default`, `Drop default`, `Add primary key`, `Add foreign key`, `Change referential action`, `Add unique constraint`, `Add check constraint`, `Add index`, `Drop index`, `Create enum type`, `Add enum value`, `Rename enum value`, `Create domain`, `Add domain constraint`. `Unsupported`: `Free-form type conversion`, `Unsupported schema object`, `Data operation`. Enum değeri kaldırma spec label'ı `Drop enum value` olarak kalır.

</details>

### Up SQL
Generator çıktısı ve kurucu düzenlemesi ayrı gösterilir (fark görünümü); düzenlenmiş metin yeniden statik doğrulanır. Veri SQL'i ve katalog dışı operasyon reddedilir.
- **Label'lar:** `Statically Validated`, `Generated Up SQL`, `Your edit`, `Edited Up`, `Revalidate`.

### Down
Bütün operasyonlar yıkıcı değil ve ters yön iki sürümden tam belirleniyorsa Güvenli Down SQL'i; aksi halde Down yoktur.
Kurucu düzenlemesi geçerli olsa bile `Edited Up` Down'ı düşürür: Down'ın tersi iki sürümden artık tam belirlenmez. Yıkıcı olmayan `Add enum value` de ters yönü ifade edilemediği için Down'ı düşürür. Nedeni uyarı manifestinde adlandırılan öğeyle gösterilir; kısmi Down yoktur.
- **Label'lar:** `Safe Down could not be produced`.

### Uyarı manifesti ve onay
Yıkıcı uyarılar, mevcut veri uyarıları, ters yön veri uyarısı, extension gereksinimi, Down'ı düşüren operasyon.
- **Label'lar:** `Migration Artifact`, onay `Confirm Schema Change` (`Migration Artifact` oluşturur), vazgeç `Cancel`.

### Durumlar
#### Safe Down available
Yalnız yıkıcı olmayan operasyonlar: Down sekmesi SQL'i gösterir.
#### Edited Up drops Down
Yıkıcı olmayan operasyonlar, geçerli düzenlenmiş Up: Down sekmesi `Safe Down could not be produced` gösterir; neden düzenlemedir, hata değildir.
#### Unsupported difference
Katalogun ifade edemediği fark (ör. enum değeri kaldırma, serbest tip dönüşümü) artefakt üretimini adlandırılmış öğeyle durdurur; SQL yok.
#### Edited Up invalid
Kurucu düzenlemesi veri SQL'i içeriyor veya doğrulanamıyor: hata satırı, onay kapalı.
#### Destructive confirmation
Olası yıkıcı satırlar için ek onay kutusu görünür: `I understand this can lose data or guarantees`.

**Spec:** [60](../../specs/60-schema-artifacts/spec.md).

## 14.9 · Migration Artifact
> Onaylanmış schema-only değişikliği değişmez artefakt olarak göstermek ve `.sql` + manifest olarak dışa aktarmak; uygulanmışlık durumu yoktur.

**Artboard'lar**
- `14.9 · Migration Artifact · Default · 1440`
- `14.9 · Migration Artifact · Superseded · 1440`

### Kimlik
Artefakt kimliği, kaynak/hedef sürüm, digest ve oluşturma tarihi.
- **Label'lar:** `Migration Artifact`, `Migration Artifact Digest`, `Supersedes Migration Artifact`.
- **Dışa aktarma:** `Export .sql`, `Export manifest` (`.sql` ve eşlik eden manifest; `14.7` ile aynı sabit `Statically Validated` notu).

### Manifest
Tanım listesi: kaynak/hedef sürümler, generator sürümü, statik doğrulama (`Statically Validated`), kurucu düzenleme farkı, uyarı manifesti, model hash'leri. Digest yalnız tam Up/varsa Down baytlarına ve operasyon planına bağlıdır; yalnız görsel yerleşim değişikliği onu değiştirmez.

### SQL
Up; Down veya `Safe Down could not be produced`.

### İlişkiler
Commit, pull request, Test Oturumu, Proje Sürümü bağları kanıt bağlamıdır; hiçbiri uygulanmışlık ilan etmez. `Applied` / `Not applied` alanı veya onay kutusu yoktur.

### Durumlar
#### Superseded
Sonraki düzeltme yeni artefakttır; eskisi okunur kalır, yenisi `Supersedes Migration Artifact` ile eskiyi gösterir ve eski bağları miras almaz. Eski artefaktta yeni olana bağlantı.
#### Read-only
Artefakt her durumda değiştirilemez; düzenleme eylemi yoktur.

**Spec:** [60](../../specs/60-schema-artifacts/spec.md).
