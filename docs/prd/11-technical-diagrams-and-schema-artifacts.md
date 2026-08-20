# Teknik Diyagramlar ve Şema Artefaktları

Bu belge Teknik Diyagram türlerinin, Diyagram otorite kipinin, kanonik yapısal modelin, Diyagram Görünümü ve Sürümünün, Veri Modelinin, yapısal model invariant kataloğunun, izin verilen extension matrisinin, desteklenen schema operasyon kataloğunun, Güvenli Down ters kanıt ölçütünün, model hash kapsamının, PostgreSQL DDL üretiminin, Şema Değişiklik Taslağının ve Migration Artefaktının tek normatif sahibidir. Repository bağlantıları, GitHub geliştirme kayıtları ve Proje Sürümü [GitHub ve Proje Sürümlerinde](12-github-and-project-releases.md) yaşar; dosya biçimi ve dışa aktarma güvenliği [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md) tanımlanır.

<a id="teknik-diyagramlar"></a>
## Teknik Diyagramlar

- **Dar uzman türler:** Kullanıcı Proje kapsamında bağımsız ana kayıt olarak `Teknik Mimari`, `Veri Modeli` ve `Teknik Sıra` türünde Teknik Diyagram oluşturabilir. Generic flowchart anlatımı Belge içi Mermaid'de; state/transition modelleme [kapılı uzman araç yönünde](18-future-directions.md#durum-ve-gecis-modelleyicisi) kalır. BPMN, org chart, mind map, Gantt, git graph ve infographic bu alanın tür kataloğuna girmez.

- **Tek diyagram otoritesi:** Her Teknik Diyagram tam olarak bir `Diyagram otorite kipi` taşır ve bu kip kayıt kimliği boyunca değişmez. İlk üründe düzenlenebilir kanonik model `Üründe yazılmış model`, açık Mermaid dönüşümünün sonucu `İçe aktarılmış bağımsız kopya`, dış araçta kanonik kalan kayıt ise `Dış kaynak bağlantısı`dır. Başka otoriteye geçiş aynı kaydı yerinde yeniden sınıflandırmaz; kaynak ve hedef kipi, yeni kimliği, kaybı ve tarihçe etkisini önizleyip onaylatan açık dönüşüm yeni Teknik Diyagram ve iki yönlü köken ilişkisi oluşturur. `Repository’den türetilmiş görünüm` ilk üründe oluşturulamaz; [Repository şeması yönünün](18-future-directions.md#repository-semasi) sonraki aşama sözleşmesidir. Snapshot, export ve Diyagram Sürümü yeni otorite kipi oluşturmaz.

- **Kanonik yapısal model:** Üründe yazılmış ve içe aktarılmış Teknik Diyagramın türlenmiş düğüm, alan, bağlantı ve semantik kısıtları ürün veritabanındaki tek kanonik içeriktir. Koordinat, daraltma, odak ve benzeri sunum değerleri Diyagram Görünümü üstverisinde kalır. Mermaid, SQL, DBML veya başka DSL/dosya biçimi ikinci canlı kaynak olmaz; açık dönüşüm girdisi veya çıktısıdır.

- **Dış kaynak bağlantısı:** Diyagram dış araçta kanonik kalacaksa ürün kesin HTTP(S) URL'yi, kullanıcı tarafından biliniyorsa dış revision veya `updated-at` değerini, kaynak aracı, son kullanıcı kontrol zamanını ve Proje ilişkilerini taşır. Güvenli bağlantı önizlemesi [Akıllı bağlantı önizlemesinin](08-search-relations-and-evidence.md#akıllı-bağlantı-önizlemesi) URL yalıtımını izler; keyfî iframe, dış edit yetkisi, dış içerik cache'i veya güncellik garantisi oluşturmaz.

- **Görünüm ve kesin sürüm ayrımı:** Aynı Teknik Diyagramın seçilmiş öğeleri ve yerleşimi kopyasız, adlandırılmış Diyagram Görünümü olarak saklanabilir. Canlı diyagram normal değişiklik geçmişiyle düzenlenir; kullanıcı Karar, İş, Proje Sürümü, kanıt, paylaşım veya export için adlandırılmış ve değişmez Diyagram Sürümü oluşturabilir. Bu hedefler canlı Teknik Diyagram ilişkisi yerine veya onun yanında seçilen kesin Diyagram Sürümüne doğrudan sabitlenebilir; eski sürümü geri yüklemek sürümü yeniden yazmaz, canlı Teknik Diyagramda yeni revizyon üretir.

- **Uzman canvas sınırı:** Teknik Diyagram; Proje Duvarı, Kullanıcı Akışı, Wireframe ve Moodboard ile pan, zoom, seçim, hizalama, grid, copy/paste, klavye alternatifi ve güvenli undo gibi ortak canvas mekaniklerini paylaşabilir. Her yüzey kendi nesne dili, kalıcı içerik sahipliği ve yaşam döngüsünü korur; ilk ürün genel amaçlı sonsuz canvas veya serbest whiteboard alanı açmaz.

- **Proje kaydı bağlamı:** Mevcut İş, Karar, Risk ve Açık Soru kayıtları Teknik Diyagrama salt okunur canlı kart olarak yerleştirilebilir; kartı taşımak, gruplamak veya kaldırmak kaynak kaydı değiştirmez. Kullanıcı yerel bir düğüm veya annotation üzerinde `Kayda dönüştür ve bağla` eylemiyle tam bir İş, Karar, Risk veya Açık Soru taslağı oluşturabilir; hedef tür/proje, başlangıç alanları, kesin Diyagram Sürümü ve öğe kimliği ile iki yönlü köken ilişkisi önizlenip onaylanmadan ana kayıt oluşmaz.

- **Teknik kayıt ilişkileri:** Teknik Diyagram ilgili Karar, İş, Risk, repository üstverisi, GitHub dış kaydı, Test Oturumu ve Proje Sürümüyle standart ilişki kurabilir. Teknik Sıra lifeline'ı gerektiğinde kesin bir Teknik Mimari düğümü ve Diyagram Sürümüne referans verebilir; kaynak yeni sürüme geçtiğinde bağ sessizce taşınmaz. Teknik öğeler ortak servis kataloğu veya CMDB ana kaydı değildir.

- **Belge ve Proje Duvarı kompozisyonu:** Teknik Diyagram veya seçili Diyagram Görünümü Belgeye ve Proje Duvarına salt okunur canlı referans olarak yerleşebilir; yerinde düzenleme ikinci editör oluşturmaz. Sunum mevcut Sunum Kipi ile kesin PNG/SVG/PDF snapshot'ını kullanır; Teknik Diyagram kendi slide deck, reveal sırası veya presenter-notes sistemini oluşturmaz.

<a id="veri-modeli-semalari"></a>
## Veri modeli şemaları ve migration artefaktları

- **Sıfırdan Tasarlanan şema:** İlk üründe Veri Modeli Diyagramı kullanıcının ürün içinde sıfırdan oluşturduğu `Tasarlanan şema`dır. Ürün repository dosya içeriği okumaz, çalışan veritabanına bağlanmaz ve schema introspection yapmaz; repository veya runtime gerçeği olduğu iddia edilmez.

- **PostgreSQL fiziksel model:** İlk dialect PostgreSQL'dir. Veri Modeli; table, column, PostgreSQL veri tipi, primary/foreign key, nullability, unique, default, index, cardinality ve referential action semantiğini taşır. Ayrı mantıksal model katmanı, ORM/framework şeması veya başka SQL dialect'i ilk üründe bulunmaz.

- **Şema Görünümü sahipliği:** Kullanıcı tek Veri Modeli Diyagramının seçilmiş table, column ve ilişkilerini adlandırılmış Şema Görünümü olarak düzenleyebilir; `Customer`, `Admin` veya başka ad ürünün sabit şema türü değildir ve kaynak tanımları kopyalamaz. Gerçekten ayrı fiziksel veri mağazası ayrı Veri Modeli Diyagramı olur.

- **PostgreSQL DDL taslağı:** Kullanıcı kesin bir Veri Modeli Diyagramı Sürümünden tam PostgreSQL DDL'ini önizleyebilir ve kopyalayabilir. Kaynak Diyagram Sürümü ve [kapsamı kapalı model hash'i](#model-hash-kapsami), generator sürümü, statik doğrulama sonucu ve uyarı manifesti korunur; `.sql` dışa aktarma biçimi [Teknik SQL çıktısı](13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) sözleşmesini izler. Ürün SQL'i çalıştırmaz, repository'ye yazmaz, database backup veya `production-ready` çıktı olarak sunmaz.

- **Statik SQL doğrulaması:** DDL ve migration SQL'i [yapısal model invariant'ları](#model-invariant-katalogu), dependency ordering ve sürümlü generator'ın deterministik karşıt testlerinden sonra üretimle aynı pinlenmiş PostgreSQL major sürümü ve [izin verilen extension matrisine](#izin-verilen-extension-matrisi) sahip her çalışma için yeni disposable veritabanında parse/apply edilir; veritabanı sonuç alındıktan sonra bütünüyle atılır. Bu kontroller geçmeden `Statically Validated` sonucu verilemez. Etiket SQL'in kullanıcının, staging'in veya production'ın veritabanında uygulandığı ya da runtime verisi için güvenli olduğu anlamına gelmez; ürün kullanıcı credential'ı almaz ve dış CI veya Test Oturumu kanıtı ayrıca ilişkilendirilebilir.

- **Şema Değişiklik Taslağı:** Kullanıcı aynı Veri Modeli Diyagramının iki kesin Diyagram Sürümünü seçerek türlenmiş ekleme, değiştirme, yeniden adlandırma ve kaldırma operasyonlarını bağımlılık sırası ve destructive uyarılarıyla karşılaştırabilir. Taslak kaynak ve hedef sürümleri değiştirilemez biçimde sabitler; canlı diyagram farkı veya serbest metin diff'i değildir.

- **PostgreSQL Up taslağı:** [Desteklenen schema operasyonları](#schema-operasyon-katalogu) için PostgreSQL `Up` SQL üretilebilir. Kullanıcı onaydan önce SQL'i düzenleyebilir; arayüz generator çıktısı ile kullanıcı farkını ayrı gösterir ve düzenlenmiş metni yeniden statik doğrular. Backfill, veri taşıma ve keyfî veri SQL'i taslağa eklenemez.

- **Koşullu Güvenli Down:** `Down` yalnız bütün desteklenen operasyonların deterministik ve veri kayıpsız tersi [ters kanıt ölçütüyle](#guvenli-down-olcutu) kanıtlandığında üretilir. Bu koşul sağlanmıyorsa ürün açıkça `Güvenli Down üretilemedi` gösterir; silinmiş veriyi geri getirme, genel rollback veya deployment güvenliği vaat etmez.

- **Değişmez Migration Artefaktı:** Kullanıcı Şema Değişiklik Taslağını ve desteklenen SQL'i onayladığında kaynak/hedef Diyagram Sürümleri, generator sürümü, statik doğrulama, kullanıcı düzenleme farkı ve uyarı manifestiyle değişmez Migration Artefaktı oluşur. Sonraki düzeltme eski artefaktı yeniden yazmaz; yeni taslak ve onay zinciri oluşturur.

- **Uygulanmışlık iddiası yok:** Ürün Migration Artefaktına `Uygulandı/Uygulanmadı` durumu veya manuel uygulanmış checkbox'ı vermez. Exact commit, pull request, Test Oturumu veya Proje Sürümüyle ilişki kanıt ve devir bağlamıdır; hiçbiri çalışan veritabanına uygulanmışlığı otomatik ya da dolaylı biçimde ilan etmez.

- **Çalıştırma ve repository yazma sınırı:** Ürün database credential almaz, DDL veya migration çalıştırmaz, rollback yürütmez, branch/commit/pull request oluşturmaz ve artefaktı repository'ye yazmaz. Kullanıcı kesin `.sql` çıktısını IDE, CLI veya dış ajan akışına kendisi taşır; dış yürütme ürün içi undo veya uygulanmışlık kanıtı değildir.

<a id="model-invariant-katalogu"></a>
### Yapısal model invariant kataloğu

Aşağıdaki invariant kümesi kapalıdır; Veri Modeli Diyagramının kanonik yapısal modeli bu kümenin bütününü karşılamadan hiçbir DDL veya migration SQL'i statik doğrulamaya girmez:

| Invariant | Kapalı kontrol koşulu |
| --- | --- |
| `Tekil table adı` | Aynı şema içinde her table adı tekildir. Küçük harfe katlandığında veya çift tırnak kaldırıldığında aynı ada çözülen iki table çakışma sayılır. |
| `Tekil column adı` | Aynı table içinde her column adı tekildir; katlanmış ad çakışması reddedilir. Aynı table'da iki constraint veya iki index de aynı adı taşıyamaz. |
| `Geçerli identifier` | Her identifier boş olmayan, `NUL` içermeyen ve UTF-8 kodlamasında 63 baytı aşmayan bir addır. PostgreSQL reserved key word'üyle çakışan, büyük harf veya özel karakter taşıyan ad üretimde çift tırnakla alıntılanır; alıntılamayla da geçerli olmayan ad reddedilir. |
| `Primary key varlığı` | Her table tam olarak bir primary key taşır. PK column'ları aynı table'da mevcut, tekrarsız, sıralı ve `NOT NULL` olur. |
| `Foreign key ucu varlığı` | Her FK'nin kaynak ve hedef column'ları tanımlı table'larda mevcuttur ve hedef column kümesi hedef table'ın primary key'i ya da bir unique constraint'i tarafından aynı sırayla bütünüyle kapsanır. |
| `Foreign key tip uyumu` | FK'nin kaynak ve hedef column sayısı ile sırası eşleşir; karşılık gelen her column çifti aynı temel tipe veya PostgreSQL'de karşılaştırma operatörü bulunan uyumlu tip çiftine çözülür. Enum, domain ve tip parametresi uyumsuzluğu reddedilir. |
| `Composite column listesi geçerliliği` | Composite PK, unique constraint, FK ve index column listeleri boş olmayan, tekrarsız ve anlamlı sırada olur; aynı column bir listede iki kez yer alamaz. |
| `Index column ve method geçerliliği` | Index column'ları aynı table'da mevcuttur; index method [izin verilen extension matrisindeki](#izin-verilen-extension-matrisi) bir method olur ve her column tipi o method'un operator class'ıyla desteklenir. Kısmi index koşulu yalnız aynı table'ın column'larına başvurur. |
| `Yinelenmeyen index tanımı` | Aynı table üzerinde aynı method, aynı sıralı column listesi, aynı uniqueness ve aynı kısmi koşulu taşıyan ikinci index tanımı reddedilir. Primary key veya unique constraint'in kendiliğinden oluşturduğu index elle yeniden tanımlanamaz. |
| `Referential action geçerliliği` | `ON DELETE` ve `ON UPDATE` yalnız `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL` ve `SET DEFAULT` değerlerini alır. `SET NULL` bütün kaynak column'ları `NOT NULL` olan FK'de, `SET DEFAULT` default'u bulunmayan ya da default değeri hedefte karşılığı olmayan column'da reddedilir. |
| `Nullability ve default tutarlılığı` | `NOT NULL` column'un default'u `NULL` olamaz; default ifadesi column tipine kayıpsız çözülür ve yalnız sabit ile izin verilen çekirdek fonksiyon çağrısı içerir. Identity veya generated column'a ayrıca default verilemez. |
| `Enum ve domain değer geçerliliği` | Her enum tipi en az bir label taşır ve label'lar tekildir; her domain temel tipiyle uyumlu kısıt ve default taşır. Bir column'un başvurduğu enum veya domain aynı şemada tanımlı olur; tanımsız tipe başvuru reddedilir. |
| `Sıralanabilir foreign key grafiği` | FK grafiği table oluşturma ve constraint ekleme fazlarına ayrılarak deterministik biçimde sıralanır. Bu ayrımla da sıralanamayan döngü, yani döngüdeki her ucun `NOT NULL` olduğu ve hiçbir sırada karşılanamayan tanım, adlandırılmış hatayla reddedilir. |

- **Adlandırılmış invariant hatası:** Sistem ihlal edilen her invariant'ı adıyla, kesin öğe yoluyla (table, column, constraint, index veya tip) ve düzeltmenin hangi tanımı gerektirdiğiyle gösterir. Aynı modeldeki bütün ihlaller tek raporda toplanır; ilk hatada durup kalan nedenleri gizlemez.

- **Kısmi doğrulanmış çıktı engeli:** Sistem invariant kümesini geçmeyen modelden kısmen üretilmiş, yorum satırıyla işaretlenmiş veya eksik tanım bırakan DDL sunmaz; önizleme, kopyalama ve `.sql` dışa aktarma eylemleri de kapalı kalır.

<a id="izin-verilen-extension-matrisi"></a>
### İzin verilen extension matrisi

Generator ve disposable doğrulama veritabanının paylaştığı extension kümesi kapalıdır:

| Extension yüzeyi | Durum | Kapsam ve gerekçe |
| --- | --- | --- |
| `pg_trgm` | İzinli | Trigram benzerlik operatörleri ile `gin`/`gist` trigram operator class'ı. Ürünün kendi benzerlik tabanlı araması bu extension üzerinde çalıştığı için dogfooding şeması onu ifade edebilmek zorundadır. |
| Çekirdek PostgreSQL yüzeyi | Extension gerektirmez | `text`, `varchar`, `numeric`, `boolean`, `uuid`, `bytea`, `date`, `time`, `timestamptz`, `interval`, `jsonb`, dizi tipleri, kullanıcı enum'ları, domain'ler, `gen_random_uuid()`, `tsvector`/`tsquery` tam metin arama ve `btree`/`hash`/`gin`/`gist`/`brin`/`spgist` index method'ları pinlenmiş major sürümün çekirdeğindedir. |
| Matris dışı extension | Reddedilir | `postgis`, `vector`, `citext`, `hstore`, `uuid-ossp`, `pgcrypto` ve matriste bulunmayan her extension'a bağlı tip, fonksiyon, operator class veya index method'u doğrulama zamanında adlandırılmış hatayla reddedilir. |

- **Matris dışı yüzeyin reddi:** Sistem matris dışı bir yüzeye bağlı tanımı en iyi çaba SQL'i olarak üretmez; farkı hangi öğenin hangi extension'ı gerektirdiğini söyleyen hatayla engeller ve kullanıcıyı çekirdek karşılığını modellemeye yönlendirir.

- **Matris kapalılığı:** Kullanıcı matrise extension ekleyemez; matris yalnız ürün sürümüyle genişler ve genişleme mevcut Migration Artefaktlarını yeniden yazmaz. Aynı matris hem üretim hem statik doğrulama çalışmasında pinlenmiş kalır.

- **Extension kurulum sınırı:** Sistem `CREATE EXTENSION` deyimi üretmez; matristeki bir extension'ın hedef veritabanında kurulu olması gereksinimini uyarı manifestinde taşır. Ürün hedef veritabanının extension durumunu okumaz ve kurulu olduğunu iddia etmez.

<a id="schema-operasyon-katalogu"></a>
### Desteklenen schema operasyon kataloğu

Sistem iki kesin Diyagram Sürümü arasındaki farkı yalnız aşağıdaki kapalı katalogla ifade eder; sınıflar şu anlamı taşır:

- **Yıkıcı değil sınıfı:** Operasyon kaynak sürümde tanımlı hiçbir şema bilgisini ve o bilgiye bağlı veriyi kaldırmaz ya da daraltmaz.
- **Olası yıkıcı sınıfı:** Operasyon veri, tekillik ya da referans garantisi kapsamındaki bilgiyi kaybedebilir; taslak destructive uyarısı taşır ve onay ayrıca istenir.
- **Desteklenmiyor sınıfı:** Sistem bu fark için SQL üretmez, artefakt üretimini adlandırılmış nedenle engeller.
- **Mevcut veri uyarısı:** Yıkıcı olmayan bir operasyon mevcut satır durumuna bağlı olarak başarısız olabiliyorsa taslak bunu ayrı çalıştırma uyarısı olarak gösterir; sistem uyarıyı gidermek için backfill veya veri SQL'i üretmez.

Kapalı operasyon kataloğu:

| Operasyon | Sınıf | Üretim kuralı |
| --- | --- | --- |
| `Table oluşturma` | Yıkıcı değil | Column, tip, nullability, default, PK, unique ve check tanımlarıyla; FK'ler ayrı fazda eklenir. |
| `Table kaldırma` | Olası yıkıcı | Table'ın bütün satırları ve tanımı kaybolur. Bağlı FK'ler önce kaldırılır; `CASCADE` üretilmez. |
| `Table yeniden adlandırma` | Yıkıcı değil | Değişmez öğe kimliğinden tespit edilir, ad benzerliğinden tahmin edilmez; `ALTER TABLE ... RENAME TO` üretilir. |
| `Column ekleme` | Yıkıcı değil | Nullable veya default'lu ekleme koşulsuz üretilir. `NOT NULL` ve default'suz ekleme mevcut veri uyarısı taşır; backfill üretilmez. |
| `Column kaldırma` | Olası yıkıcı | Column verisi ile ona bağlı constraint ve index tanımı kaybolur. |
| `Column yeniden adlandırma` | Yıkıcı değil | Öğe kimliğinden tespit edilir; tanımı değişmeyen constraint ve index'ler PostgreSQL semantiğinde nesneyle birlikte taşınır, yeniden oluşturulmaz. |
| `Column tipi genişletme` | Yıkıcı değil | Kapalı kayıpsız dönüşüm kümesi: `int2`→`int4`→`int8`, `float4`→`float8`, aynı scale'de `numeric` precision artışı, `varchar(n)`→ daha büyük `varchar(m)` ve `varchar(n)`→`text`. `USING` ifadesi gerekmez. |
| `Column tipi daraltma` | Olası yıkıcı | Kayıpsız kümenin ters yönü ile precision/scale düşüşü; kesilme ve taşma uyarısı taşır. |
| `Serbest tip dönüşümü` | Desteklenmiyor | Kayıpsız kümede bulunmayan ve `USING` ifadesi gerektiren tip değişimi keyfî veri ifadesidir. |
| `Nullability gevşetme` | Yıkıcı değil | `DROP NOT NULL` üretilir. |
| `Nullability sıkılaştırma` | Yıkıcı değil | `SET NOT NULL` üretilir; mevcut `NULL` satırlarda başarısız olacağı uyarısı taşınır. |
| `Default ekleme veya değiştirme` | Yıkıcı değil | `SET DEFAULT` üretilir; mevcut satırlar yeniden yazılmaz. |
| `Default kaldırma` | Yıkıcı değil | `DROP DEFAULT` üretilir; `SET DEFAULT` action'ı kalan FK varsa fark invariant kontrolünde reddedilir. |
| `Primary key ekleme` | Yıkıcı değil | PK column'ları aynı değişiklikte `NOT NULL` yapılır; mevcut yinelenen satır uyarısı taşınır. |
| `Primary key kaldırma` | Olası yıkıcı | Tekillik garantisi ve otomatik index kaybolur; garantiyi geri kurmak sonradan yazılmış veriye bağlıdır. |
| `Foreign key ekleme` | Yıkıcı değil | Referential action'lar invariant kontrolünden geçer; mevcut karşılıksız satır uyarısı taşınır. |
| `Foreign key kaldırma` | Olası yıkıcı | Referans garantisi kaybolur; garantiyi geri kurmak sonradan yazılmış veriye bağlıdır. |
| `Referential action değiştirme` | Yıkıcı değil | Aynı FK için tek sıralı kaldır-ekle çifti üretilir; hedef tanım iki Diyagram Sürümünden bütünüyle belirlenir. |
| `Unique constraint ekleme` | Yıkıcı değil | Mevcut yinelenen satır uyarısı taşınır. |
| `Unique constraint kaldırma` | Olası yıkıcı | Tekillik garantisi kaybolur; geri kurulması sonradan yazılmış veriye bağlıdır. |
| `Check constraint ekleme` | Yıkıcı değil | Mevcut koşulu ihlal eden satır uyarısı taşınır. |
| `Check constraint kaldırma` | Olası yıkıcı | Doğrulama garantisi kaybolur; geri kurulması sonradan yazılmış veriye bağlıdır. |
| `Index ekleme` | Yıkıcı değil | Method, column listesi ve kısmi koşul invariant kontrolünden geçer. |
| `Index kaldırma` | Yıkıcı değil | Index tanımı kaynak Diyagram Sürümünde bütünüyle bulunur ve yeniden oluşturulması veriye bağlı değildir. Unique constraint olarak tanımlı index için `Unique constraint kaldırma` uygulanır. |
| `Enum tipi oluşturma` | Yıkıcı değil | Label'lar hedef sürümdeki sırayla üretilir. |
| `Enum değeri ekleme` | Yıkıcı değil | `ADD VALUE` üretilir; konum hedef sürümdeki sıraya göre deterministik `BEFORE`/`AFTER` ile yazılır. |
| `Enum değeri yeniden adlandırma` | Yıkıcı değil | Öğe kimliğinden tespit edilir; `RENAME VALUE` üretilir. |
| `Enum değeri kaldırma` | Desteklenmiyor | PostgreSQL label kaldırmayı desteklemez; tipi yeniden oluşturmak veri bağımlı dönüşüm gerektirir. |
| `Enum tipi kaldırma` | Olası yıkıcı | Yalnız tipe bağlı column kalmadığında ifade edilir; tip ve bütün label'ları kaybolur. |
| `Domain oluşturma` | Yıkıcı değil | Temel tip, kısıt ve default hedef sürümden alınır. |
| `Domain kısıtı ekleme` | Yıkıcı değil | Mevcut koşulu ihlal eden satır uyarısı taşınır. |
| `Domain kısıtı kaldırma` | Olası yıkıcı | Doğrulama garantisi kaybolur; geri kurulması sonradan yazılmış veriye bağlıdır. |
| `Domain kaldırma` | Olası yıkıcı | Yalnız domain'e bağlı column kalmadığında ifade edilir; tanım ve kısıtları kaybolur. |
| `Katalog dışı şema nesnesi` | Desteklenmiyor | View, materialized view, function, trigger, sequence sahipliği, partition, tablespace, role/grant, şema oluşturma ve extension kurulumu bu katalogda yer almaz. |
| `Şema dışı veri operasyonu` | Desteklenmiyor | Satır yazan, güncelleyen veya silen her deyim katalog dışıdır ve kullanıcı düzenlemesiyle de taslağa giremez. |

- **Rename ile bağımlılık sırası çözümü:** Aynı değişiklik kümesinde bir rename ile onu içeren FK, index, unique/check constraint veya enum/domain referansı birlikte değişiyorsa sistem tek deterministik faz sırası uygular: kaldırılacak tanımlar eski adla önce kaldırılır, sonra rename yapılır, eklenecek tanımlar yeni adla sonra eklenir. Aynı ad geçici olarak iki nesneye düşüyorsa (ad takası veya kaldırılan adın yeniden kullanımı) rename deterministik geçici ad üzerinden iki adımda üretilir.

Değişmez faz sırası:

| Faz | Kapsanan operasyonlar |
| --- | --- |
| `Faz 1` | Constraint kaldırma: FK, sonra check, sonra unique, sonra primary key; hepsi eski adlarla. |
| `Faz 2` | Index kaldırma. |
| `Faz 3` | Table yeniden adlandırma, ardından column yeniden adlandırma; gereken geçici ad adımları dahil. |
| `Faz 4` | Enum ve domain oluşturma, enum değeri ekleme ve enum değeri yeniden adlandırma. |
| `Faz 5` | Table oluşturma; FK grafiğinin topolojik sırasında ve FK'siz. |
| `Faz 6` | Column ekleme. |
| `Faz 7` | Column tipi, nullability ve default değişiklikleri. |
| `Faz 8` | Primary key, unique ve check ekleme. |
| `Faz 9` | Index ekleme. |
| `Faz 10` | FK ekleme; referential action değişikliğinin ekleme yarısı dahil. |
| `Faz 11` | Column kaldırma. |
| `Faz 12` | Table kaldırma; FK grafiğinin ters topolojik sırasında. |
| `Faz 13` | Enum tipi ve domain kaldırma. |

- **İfade edilemeyen farkın engellenmesi:** Katalogun ifade edemediği her diyagram farkı artefakt üretimini durdurur. Sistem hangi öğenin hangi katalog satırına çözülemediğini adıyla gösterir; tahmine dayalı, kısmi veya elle tamamlanması beklenen SQL sunmaz.

<a id="guvenli-down-olcutu"></a>
### Güvenli Down ters kanıt ölçütü

- **Ters kanıt ölçütü:** Bir operasyon yalnız katalogda `Yıkıcı değil` sınıfındaysa ve tersi kaynak ile hedef Diyagram Sürümünün tanımlarından bütünüyle belirleniyorsa tersine çevrilebilir sayılır. Şema tanımında bulunmayan hiçbir girdiye — satır değerine, sayıma, dağılıma, dış kaynağa veya kullanıcı tahminine — dayanan ters üretilmez.
- **Uygun olmayan operasyonlar:** `Table kaldırma`, `Column kaldırma`, `Column tipi daraltma`, `Primary key kaldırma`, `Foreign key kaldırma`, `Unique constraint kaldırma`, `Check constraint kaldırma`, `Enum değeri kaldırma`, `Enum tipi kaldırma`, `Domain kısıtı kaldırma`, `Domain kaldırma` ve `Desteklenmiyor` sınıfındaki her fark hiçbir koşulda ters kanıt sağlamaz; bilgi kaybı ya da veri bağımlı yeniden kurulum içerdikleri için ölçüt dışıdır.
- **Tek operasyonun bütün kümeyi düşürmesi:** Değişiklik kümesindeki tek bir uygun olmayan operasyon bütün ters yön üretimini düşürür. Sistem kısmi, seçilmiş operasyonları kapsayan veya en iyi çaba etiketli bir ters SQL sunmaz.
- **Düşüren operasyonun gösterilmesi:** Kullanıcı sonucun yanında hangi operasyonun, hangi öğede ve ölçütün hangi maddesiyle koşulu düşürdüğünü görür; bu gerekçe Migration Artefaktının uyarı manifestinde korunur.
- **Ters yönün kapsam sınırı:** Ters yön yalnız kaynak Diyagram Sürümünün şema durumunu tanımlar. `Up` sonrasında eklenmiş column veya table'a yazılmış veri ters yönde kaybolabiliyorsa taslak bunu ayrı ters yön veri uyarısı olarak gösterir; uyarı gizlenemez ve ürün ters SQL'in çalıştırılmasıyla ilgili hiçbir güvence vermez.

<a id="model-hash-kapsami"></a>
### Model hash kapsamı

Model hash'inin kapsamı kapalıdır ve yalnız üretilen SQL'i belirleyen kanonik yapısal modeli içerir:

| Alan | Hash kapsamı |
| --- | --- |
| `Şema tanımı` | Kapsanır: table adları, sıralı column tanımları, PostgreSQL tipleri ve tip parametreleri, nullability, default ifadeleri, primary key, FK ve referential action'ları, unique ve check constraint'leri, index method/column/uniqueness/kısmi koşulu, enum label'ları ile sırası ve domain tanımları. |
| `Sunum üstverisi` | Kapsanmaz: koordinat, boyut, yerleşim, daraltma, odak, zoom, renk, ikon, açıklama notu, annotation metni ve Diyagram ile Şema Görünümü seçimleri. |
| `İç kimlik ve tarihçe` | Kapsanmaz: öğe kimlikleri, revizyon üstverisi, yazar, zaman damgası, generator sürümü ve statik doğrulama sonucu. Bunlar Diyagram Sürümü ve artefakt üstverisinde ayrı taşınır; rename tespiti kimlikten yapılır. |

- **Deterministik kanonik serileştirme:** Hash, öğeleri kanonik ada ve tanım sırasına göre kararlı biçimde dizen tek serileştirmeden hesaplanır. Mantıksal olarak aynı model, öğelerin oluşturma veya girdi sırasından bağımsız olarak aynı hash'i üretir.
- **Görsel düzenlemenin etkisizliği:** Yalnız sunum üstverisini değiştiren düzenleme model hash'ini değiştirmez; mevcut DDL önizlemesi, statik doğrulama sonucu ve Migration Artefaktı ilişkisi geçersizleşmez. Kapsanan tanımdaki her değişiklik hash'i değiştirir ve doğrulama sonucunun yeniden üretilmesini gerektirir.

<a id="teknik-mimari-ve-sira"></a>
## Teknik mimari ve Teknik Sıra

- **Teknik Mimari nesne dili:** Teknik Mimari; `Bileşen`, `Servis`, `Datastore`, `Queue/Event Bus`, `Dış Sistem` ve `Boundary` gibi küçük sabit öğe kataloğu ile desteklenen türlenmiş bağlantıları kullanır. Etiket ve sınırlı erişilebilir stil değişebilir; keyfî şekil, ikon veya renge ürün semantiği yüklenmez.

- **Teknik Sıra nesne dili:** Teknik Sıra; actor/component lifeline, sync/async/event/return mesajı ve sınırlı control group'larla sistemler arası zamansal etkileşimi modeller. Kullanıcının arayüz hedefi ve karar yolunu gösteren Kullanıcı Akışının, generic flowchart'ın veya üretim olay zaman çizelgesinin yerine geçmez.
