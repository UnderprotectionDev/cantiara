# Teknik Diyagramlar ve Şema Artefaktları

Bu belge Teknik Diyagram türlerinin, Diyagram otorite kipinin, kanonik yapısal modelin, Diyagram Görünümü ve Sürümünün, Veri Modelinin, PostgreSQL DDL üretiminin, Şema Değişiklik Taslağının ve Migration Artefaktının tek normatif sahibidir. Repository bağlantıları, GitHub geliştirme kayıtları ve Proje Sürümü [GitHub ve Proje Sürümlerinde](12-github-and-project-releases.md) yaşar; dosya biçimi ve dışa aktarma güvenliği [Veri Güvenliği ve Taşınabilirlikte](13-data-security-and-portability.md) tanımlanır.

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

- **PostgreSQL DDL taslağı:** Kullanıcı kesin bir Veri Modeli Diyagramı Sürümünden tam PostgreSQL DDL'ini önizleyebilir ve kopyalayabilir. Kaynak Diyagram Sürümü ve model hash'i, generator sürümü, statik doğrulama sonucu ve uyarı manifesti korunur; `.sql` dışa aktarma biçimi [Teknik SQL çıktısı](13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) sözleşmesini izler. Ürün SQL'i çalıştırmaz, repository'ye yazmaz, database backup veya `production-ready` çıktı olarak sunmaz.

- **Statik SQL doğrulaması:** DDL ve migration SQL'i yapısal model invariant'ları, dependency ordering ve sürümlü generator'ın deterministik karşıt testlerinden sonra üretimle aynı pinlenmiş PostgreSQL major sürümü ve izin verilen extension matrisine sahip her çalışma için yeni disposable veritabanında parse/apply edilir; veritabanı sonuç alındıktan sonra bütünüyle atılır. Bu kontroller geçmeden `Statically Validated` sonucu verilemez. Etiket SQL'in kullanıcının, staging'in veya production'ın veritabanında uygulandığı ya da runtime verisi için güvenli olduğu anlamına gelmez; ürün kullanıcı credential'ı almaz ve dış CI veya Test Oturumu kanıtı ayrıca ilişkilendirilebilir.

- **Şema Değişiklik Taslağı:** Kullanıcı aynı Veri Modeli Diyagramının iki kesin Diyagram Sürümünü seçerek türlenmiş ekleme, değiştirme, yeniden adlandırma ve kaldırma operasyonlarını bağımlılık sırası ve destructive uyarılarıyla karşılaştırabilir. Taslak kaynak ve hedef sürümleri değiştirilemez biçimde sabitler; canlı diyagram farkı veya serbest metin diff'i değildir.

- **PostgreSQL Up taslağı:** Desteklenen schema operasyonları için PostgreSQL `Up` SQL üretilebilir. Kullanıcı onaydan önce SQL'i düzenleyebilir; arayüz generator çıktısı ile kullanıcı farkını ayrı gösterir ve düzenlenmiş metni yeniden statik doğrular. Backfill, veri taşıma ve keyfî veri SQL'i taslağa eklenemez.

- **Koşullu Güvenli Down:** `Down` yalnız bütün desteklenen operasyonların deterministik ve veri kayıpsız tersi kanıtlandığında üretilir. Bu koşul sağlanmıyorsa ürün açıkça `Güvenli Down üretilemedi` gösterir; silinmiş veriyi geri getirme, genel rollback veya deployment güvenliği vaat etmez.

- **Değişmez Migration Artefaktı:** Kullanıcı Şema Değişiklik Taslağını ve desteklenen SQL'i onayladığında kaynak/hedef Diyagram Sürümleri, generator sürümü, statik doğrulama, kullanıcı düzenleme farkı ve uyarı manifestiyle değişmez Migration Artefaktı oluşur. Sonraki düzeltme eski artefaktı yeniden yazmaz; yeni taslak ve onay zinciri oluşturur.

- **Uygulanmışlık iddiası yok:** Ürün Migration Artefaktına `Uygulandı/Uygulanmadı` durumu veya manuel uygulanmış checkbox'ı vermez. Exact commit, pull request, Test Oturumu veya Proje Sürümüyle ilişki kanıt ve devir bağlamıdır; hiçbiri çalışan veritabanına uygulanmışlığı otomatik ya da dolaylı biçimde ilan etmez.

- **Çalıştırma ve repository yazma sınırı:** Ürün database credential almaz, DDL veya migration çalıştırmaz, rollback yürütmez, branch/commit/pull request oluşturmaz ve artefaktı repository'ye yazmaz. Kullanıcı kesin `.sql` çıktısını IDE, CLI veya dış ajan akışına kendisi taşır; dış yürütme ürün içi undo veya uygulanmışlık kanıtı değildir.

<a id="teknik-mimari-ve-sira"></a>
## Teknik mimari ve Teknik Sıra

- **Teknik Mimari nesne dili:** Teknik Mimari; `Bileşen`, `Servis`, `Datastore`, `Queue/Event Bus`, `Dış Sistem` ve `Boundary` gibi küçük sabit öğe kataloğu ile desteklenen türlenmiş bağlantıları kullanır. Etiket ve sınırlı erişilebilir stil değişebilir; keyfî şekil, ikon veya renge ürün semantiği yüklenmez.

- **Teknik Sıra nesne dili:** Teknik Sıra; actor/component lifeline, sync/async/event/return mesajı ve sınırlı control group'larla sistemler arası zamansal etkileşimi modeller. Kullanıcının arayüz hedefi ve karar yolunu gösteren Kullanıcı Akışının, generic flowchart'ın veya üretim olay zaman çizelgesinin yerine geçmez.
