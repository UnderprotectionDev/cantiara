# Teknoloji Yığını

## Bağlayıcı seçim sözleşmesi

Bu belge bir teknoloji envanteri değil, teknik sorumluluk sahipliği kararıdır. Her teknoloji burada yazan amacın sahibidir. Implementasyon aynı sorumluluk için seçilmiş teknolojiyi ve repository'deki en yakın mevcut örüntüyü kullanır; aynı yetenek daha düşük seviyeli bir primitive veya alternatif kütüphaneyle yeniden kurulmaz.

Bir sorumluluğun sahibi bu belgede yoksa, birden fazla yoruma açıksa veya seçilmiş teknoloji ihtiyacı karşılamıyorsa kod yazmadan ve dependency eklemeden önce kullanıcıya sorulur. Kullanıcının onayladığı yeni seçim, onu kullanan değişiklikle birlikte bu belgeye eklenir. Bu sözleşme aşağıdaki frontend, backend, veri, platform ve test tablolarının tamamına uygulanır.

## Temel uygulama yığını

| Teknoloji | Amaç |
| --- | --- |
| React | Web arayüzü ve yalnız tek bir component'a ait geçici UI durumu |
| Vite | Web geliştirme ve derleme |
| TanStack Router | Yönlendirme ve URL durumu |
| Hono | API backend'i ve herkese açık HTML/SEO yanıtları |
| Bun | Runtime ve paket yönetimi |
| PostgreSQL | Ana ilişkisel veritabanı; ticari para hesaplarında `numeric` ve kanonik decimal string oracle'ı |
| Neon | Yönetilen PostgreSQL; üretimle aynı pinlenmiş major/extension matrisi kullanan, her DDL doğrulamasından sonra atılan disposable test veritabanları/branch'leri. Bu satır ürünün [statik SQL doğrulaması](prd/11-technical-diagrams-and-schema-artifacts.md#veri-modeli-semalari) çalışma zamanı içindir; repository'nin kendi otomatik testlerinin veritabanı değildir |
| Drizzle ORM + Drizzle Kit | ORM ve veri erişimi; ilk domain modelinden itibaren Drizzle Kit ile üretilen sürümlü SQL migration'ları kullanılır ve `drizzle-kit push` yalnız yerel deneme veritabanında kalır. Kabul manifestindeki `schemaVersion`, migration dizinindeki son migration adı ile dizinin içerik hash'idir |
| oRPC | Tip güvenli API katmanı |
| Better Auth | Web, masaüstü ve uzantı kullanıcı kimliği, GitHub login OAuth'u ve ürün oturumları; repository yetkisi taşımaz |
| Turborepo | Monorepo yönetimi |

### Migration onarım sınırı

Normal şema değişiklikleri, kaynak şemadan `drizzle-kit generate` ile sürümlü SQL olarak üretilir. Kalıcı veritabanının migration geçmişiyle gerçek şeması ayrışmış ve kaynak şema zaten hedef durumu ifade ediyorsa, geçmiş migration'ları değiştirmek veya bu veritabanında `drizzle-kit push` kullanmak yerine `drizzle-kit generate --custom` ile idempotent bir compatibility migration oluşturulur. Bu migration gerekli Drizzle metadata'sını taşır; geliştirmede `bun run db:migrate`, incelenmiş dağıtım hedefinde açık `db:migrate:deploy` sınırı ile uygulanır.

Migration çalıştırıcısı Neon için `DATABASE_URL_UNPOOLED` (güvenlik olayı veritabanında `SECURITY_EVENT_DATABASE_URL_UNPOOLED`) değerini tercih eder. Havuzlu Neon uç noktasının `-pooler` soneki kaldırılır. Override ile uygulama bağlantısının uç noktası, portu, veritabanı ve rolü eşleşmelidir; farklı hedefte durulur. Yerel kipte yalnız ilgili uygulama URL'si kullanılır; ayarlı bir `*_UNPOOLED` değeri yerel bağlantının önüne geçmez. Hedef, Neon dalının `production` adına bakılarak sınıflandırılmaz; dağıtım ayrı açık komut sınırıdır.

Tarihsel seçici onarımlar `--repair-prioritization-schema` (`0054_repair_prioritization_schema`), `--repair-external-handoff-cancellation` (`0058_external-handoff-cancellation-compatibility`) ve `--repair-external-handoff-result-reconciliation` (`0060_external-handoff-schema-compatibility`) bayraklarını korur. Bunlar artık eksik veya ayrışmış geçmişi atlayan bir kaçış yolu değildir: kayıtlı geçmiş kanonik bir önek olmalı, seçilen girdi sıradaki uygulanmamış migration olmalı veya zaten uygulanmış olmalıdır. Eksik önceki adımlar varsa durulur. Daha önce elle oluşturulmuş sütun/tablo nedeniyle normal SQL uygulanamıyorsa önce neden ve güvenilir kanonik geçmiş uzlaştırılır; sahte kayıt eklenmez. Uyumluluk SQL'inin kendi önkoşulları ve veri çatışması kontrolleri de korunur.

### Paralel geliştirmede Neon migration'ları

Her issue kendi şema değişikliğinin migration'ını taşır; birkaç spec veya issue bitene kadar migration biriktirilmez. Conductor Setup yalnız bağımlılıkları kurar. Run, `scripts/local-dev.ts` üzerinden salt okunur hazırlık denetimini geçirip Turbo görevlerini başlatır; Neon dalı oluşturmaz ve migration uygulamaz. API `3000`, web `3001`, dokümantasyon `4000` portunu kullanır. Sabit portlar nedeniyle Run `nonconcurrent` kipindedir. Bu kip başka workspace'ten veritabanı değiştirilmesini engellemez. API geliştirme oturumu iki hedefte de mevcut migration kilidinin paylaşımlı biçimini tutar; kanonik migration komutu aynı kilidin özel biçimini gerektirir. Migration uygulamadan önce bu hedeflere bağlı bütün geliştirme API'leri durdurulur. Aynı şemayı kullanan oturumlar birlikte çalışabilir; ortak DB bağımsız workspace şemaları sağlamaz.

1. Şema değişiyorsa aynı issue içinde kaynak şemayı değiştir, Drizzle Kit ile sürümlü SQL üret, SQL'i gözden geçir ve `bun run db:check` çalıştır. Şema değişmiyorsa yeni migration üretme. Bu kontrol veritabanına bağlanmadan SQL/journal/snapshot zincirini ve yapılandırılmış bütün kaynak şema dosyalarının son snapshot ile eşleşmesini doğrular.
2. Uygulama ve `bun run db:migrate`, `apps/server/.env.local` içindeki aynı ana Neon geliştirme hedefini kullanır (`NEON_LOCAL=false`). Güvenlik olayları ayrı `SECURITY_EVENT_DATABASE_URL` hedefindedir (`SECURITY_EVENT_LOCAL=false`); [ADR-0019](adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md) ayrılığı korunur. Yerel PostgreSQL proxy'si atılabilir test sınırıdır, ürün verisinin ikinci doğruluk kaynağı değildir.
3. `bun run db:doctor`, birincil ve güvenlik olayı hedeflerinin hazırlığını ayrı raporlar: `pending`, `ahead`, `history-mismatch`, `schema-drift`, `target-mismatch`, `connection`, `permission`, `repository`, `migration-running` veya `ready`. `pending` incelenmiş SQL'i kanonik komutla uygulamayı gerektirir; diğer başarısız durumlar otomatik uygulanmaz veya onarılmaz. İki hedef de `ready` olmadan geliştirme süreçleri başlamaz. API'nin doğrudan `dev` komutu `scripts/dev-server.ts` üzerinden oturum kilidini alıp aynı hazırlığı kilit altında doğrular. `--help`, `-h` ve `--version` veritabanına bağlanmadan araç yardımını gösterir.
4. `bun run db:migrate` ve gerektiğinde `bun run db:security:migrate`, kaynak kontrolünü ve tüm uygulanmış kayıtların SQL hash/sıra kontrolünü mevcut özel danışma kilidi altında geçirir. Başarılı uygulama sonrasında geçmişi yeniden, tamamlanmış zincirde gerçek şemayı ayrıntılı doğrular. Kilit alınamazsa, geçmiş ayrışmışsa veya Git dalı DB'den gerideyse SQL uygulanmaz. `db:push` bu geliştirme akışının parçası değildir.
5. Ortak DB bu Git dalından ilerideyse yalnız migration dosyalarını kopyalama: uygulanmış kanonik SQL/journal/snapshot girdilerini **sahip ürün kodu ve şemasıyla birlikte** güvenilir Git geçmişinden bütünleştir. `origin/main` henüz bu işleri taşımıyorsa ilgili owning dalların bütünleştirilmesi gerekir. Uygulanmış SQL, timestamp, snapshot veya hash yeniden üretilmez/değiştirilmez. Yalnız henüz uygulanmamış çakışan adaylar güncel kanonik zincir üzerinde yeniden üretilebilir. Geçmişler uzlaşana kadar durulur; eksik metadata uydurulmaz, ortak DB sıfırlanmaz.
6. Şema değişen issue, doğru hedefte migration uygulaması ve `bun run db:doctor -- --deep` başarılı olmadan manuel teste hazır sayılmaz. Şema değişmeyen DB kullanan issue için de doctor ve etkilenen spec'in DB seam testi geçmelidir. Doğrulama atılabilir PostgreSQL'de entegrasyon sinyali, doğru Neon hedefinde salt okunur denetimdir; biri diğerinin yerine geçmez. Kanıt ve engel close-out'ta açık yazılır.
7. Gerçek dağıtım farklı bir veritabanına, incelenmiş bağlantı ve geçmişle yalnız `bun run --cwd packages/db db:migrate:deploy` veya `db:security:migrate:deploy` üzerinden yapılır. Geliştirme başlangıcı bu izni taşımaz.

### Migration hazırlığı — Testing Decisions

Altyapı sözleşmesinin sahibi bu belgedir; ayrı ürün spec'i yoktur. Test seam'i kanonik migration komutu ve salt okunur hazırlık sonucudur (`packages/db/scripts/migrations.integration.test.ts`); journal/hash/hedef/kaynak sınırlarının birim testleri aynı dizindedir. CI `core-integration`, repository kontrolünü ve bu testleri ayrı, boş `cantiara_migration_test*` PostgreSQL veritabanlarında çalıştırır. Fixture URL'si yerel olmalı ve bu isim önekiyle başlamalıdır; açık fixture URL'si yoksa entegrasyon testleri atlanır, Neon'a yazılmaz.

Gerekli karşılıklar: boş DB'ye tüm zincir ve ayrı güvenlik zinciri; önceki sürümden veri korunarak yükseltme; ikinci uygulamada aynı geçmiş; eksik/ileride/değişmiş kayıt; kilit çatışması; tamamlanmış geçmişe rağmen eksik sütun/index ve değişmiş/ek kısıt; yanlış hedef; erişim ve bağlantı hatası; salt okunur rol ile değişmeden kalan geçmiş; başarısız denetimde API başlamaması; aynı şemalı paralel oturumların açılması ve oturumlar açıkken iki migration hedefinin engellenmesi; bağlantı kopunca denetimin başarısız olması. `scripts/development-session.test.ts` denetim başarısızlığında API'nin durmasını ve kilit temizliğini, `scripts/local-dev-command.test.ts` yardım ve argüman yönlendirmesini doğrular. Etkilenen ürünün DB seam'i ayrıca doğrulanır. Client Shell SQLSTATE sınıflandırmasının sahibi `docs/specs/03-web-macos-client/spec.md`'dir.

Başlangıç denetimi `REPEATABLE READ READ ONLY` transaction ve ortak danışma kilidiyle yalnız migration kayıtlarını ve PostgreSQL kataloglarını okur; tablo/sütun, tür, nullability ve beklenmeyen sütunları yönetilen `public` tablolarında kontrol eder. Her denetim sorgusu 10 saniye ile sınırlıdır. `--deep` buna defaults, primary/foreign/unique/check kısıtları, unique null semantiği, ek yazma kısıtları, index tanımı/sırası/predicate ve enum değerlerini ekler. İfade karşılaştırması `EXPLAIN` ile yapılır; `ANALYZE` yoktur, ürün satırları taranmaz. API oturumu kilidi process ömrü boyunca tutar ve iki saniyede bir bağlantı/geçmiş ile kaynak şema, manifest ve journal dosyalarının değişimini denetler. Bağlantı kopması veya değişim API'yi durdurur; kilitler kapanışta bırakılır. Ağ sorgularının da 10 saniyelik istemci sınırı vardır. Bu oturum sözleşmesi yalnız kanonik kilit kullanan migration'ları engeller: doğrudan DDL, eski kilitsiz süreçler, trigger, RLS policy, rol/yazma yetkileri, collation ve tüm PostgreSQL nesneleri için eksiksiz eşdeğerlik veya sıfır hata penceresi garantisi vermez. Bu tür değişimlerde ayrıntılı denetim yeniden yapılır.

## Arayüz ve durum yönetimi

| Teknoloji | Amaç |
| --- | --- |
| shadcn/ui | Uygulama bileşenleri |
| Base UI | Erişilebilir bileşen temeli |
| cmdk | shadcn/ui Command bileşeninin komut arama ve klavye gezinme primitive'i |
| Embla Carousel | shadcn/ui Carousel bileşeninin kaydırma ve gezinme motoru |
| input-otp | shadcn/ui Input OTP bileşeninin tek kullanımlık kod giriş primitive'i |
| React Resizable Panels | shadcn/ui Resizable bileşeninin panel boyutlandırma primitive'i |
| Tailwind CSS | Arayüz stilleri |
| Lucide React | Uygulama ikonları ve Wireframe semantic component ikon kaynağı |
| TanStack Query | Sunucu verisi ve önbellek |
| TanStack Store | Bileşenler arasında paylaşılan istemci, inspector, toolbar ve Wireframe editör oturumu durumu |
| TanStack Form | Form state'i ve submission yaşam döngüsü |
| Browser Clipboard API | Secure-context metin kopyalama; `apps/web/src/lib/clipboard.ts` üzerinden çalışır ve arka planda clipboard izlemez |
| Zod | Şema/form doğrulama ile sürümlü `WireframeDocument` doğrulaması ve migration sınırları |
| TanStack Pacer | Yoğun etkileşim kontrolü |
| TanStack Table | Veri tabloları |
| TanStack Virtual | Liste sanallaştırma |
| dnd-kit | Sürükle-bırak etkileşimleri |
| React DayPicker | Tarih seçimi |
| date-fns | Tarih işlemleri |

## İçerik ve görsel çalışma alanları

| Teknoloji | Amaç |
| --- | --- |
| Tiptap | Canvas dışındaki zengin metin belgelerini düzenleme |
| TanStack Markdown | Markdown görüntüleme |
| TanStack Highlight | Kod vurgulama |
| `diff` (jsdiff) | Metin ve sürüm karşılaştırma |
| Mermaid.js | Diyagramlar |
| KaTeX | Matematik gösterimi |
| React Flow (xyflow) | İlişki ve akış canvas'ı |
| Custom Wireframe Engine (TypeScript) | Canonical `WireframeDocument` modeli; command/transaction, araç, seçim, history, snapping, binding, constraint, semantic component, state, mirror ve detach davranışları |
| Konva | Wireframe ve görsel/PDF işaretleme için Canvas 2D renderer, katman, hit detection ve geçici transform altyapısı |
| React-Konva | Konva'nın React görünüm adaptörü; canonical veri veya history kaynağı değildir |
| Rough.js | Deterministik hand-drawn Wireframe primitive ve component çizimleri |
| Shantell Sans | Wireframe canvas ve çıktılarında kullanılan, uygulamayla paketlenen OFL-1.1 hand-drawn font; production UI tipografisi değildir |
| perfect-freehand | Wireframe kalem ve highlighter çizgileri |
| RBush | Wireframe mekânsal indeks, viewport culling, alan seçimi ve yakınlık sorguları |
| React-PDF | PDF.js kullanan React görüntüleme adaptörü; ayrı PDF motoru veya worker sürümü taşımaz |
| PDF.js (`pdfjs-dist`) | Tek pinlenmiş PDF parse/render/text-extraction motoru ve worker kaynağı |
| Vidstack React | Ses ve video oynatma |

### Wireframe mimari sınırı

- Wireframe'in kalıcı doğruluk kaynağı sürümlü ve migration destekli `WireframeDocument` modelidir; `Konva.Stage.toJSON()` veya başka bir renderer çıktısı kalıcı belge formatı olamaz.
- React uygulama kabuğunu, toolbar/inspector/layers panellerini ve erişilebilir yapılandırılmış alternatifi taşır. Pointer-move, geçici drag ve frame render döngüsü canonical React state'ine bağlanmaz; tamamlanan etkileşim engine command/transaction'ına dönüşür.
- Canvas metni geçici bir DOM `textarea` veya `contenteditable` overlay ile düzenlenir ve tamamlanan işlem `WireframeDocument` command/transaction'ına yazılır. Tiptap/ProseMirror Wireframe metninin ikinci veri modeli olamaz.
- Button, Input, Card, Table, Navigation, Chart ve benzeri öğeler rastgele primitive grupları değil semantic Wireframe component'leridir. Proje kapsamlı master tanım, canlı instance, etkilenen ekran önizlemesi ve açık detach davranışı engine modelinde yaşar.
- Rough.js yalnız görsel geometriyi üretir. Hit testing, selection, snapping, resize ve constraint hesapları kararlı canonical geometri üzerinden yürür; her öğenin sabit seed'i rerender ve export sırasında görsel titreşimi önler.
- PNG, SVG, PDF ve interaktif HTML çıktıları `WireframeDocument` modelinden ayrı export renderer'larıyla üretilir; Konva JSON'u export sözleşmesi değildir. PDF için mevcut HTML/SVG ve Playwright hattı yeniden kullanılır. Tam ekran Presentation Mode export formatı değil, aynı modelin araçsız ve salt okunur çalışma görünümüdür.
- Uygulamanın kaynak kodu Apache-2.0 ile lisanslanır. Wireframe üretim kodu bağımlılıkları MIT, BSD, Apache-2.0 veya eşdeğer permissive; paketlenen fontlar OFL-1.1 veya eşdeğer açık font lisanslı olmalıdır. GPL/AGPL, ücretli production key, zorunlu watermark veya abonelik isteyen editor SDK'ları kullanılmaz.

## Dosya işleme, arama ve entegrasyonlar

| Teknoloji | Amaç |
| --- | --- |
| Uppy Core | R2 upload yönetimi; istemci yükleme yüzeyinde çalışır, sunucu bu yüzden Uppy'nin multipart POST gönderebildiği Dosya Eki `stage` endpoint'ini sağlar |
| `file-type` | Dosya türü algılama |
| Sharp | Görsel üstverisi ve thumbnail |
| Papa Parse | CSV ayrıştırma |
| `yaml` | YAML ayrıştırma |
| `canonicalize` | Test raporu ve Mutation Contract payload canonicalization |
| `ipaddr.js` | IP adresi doğrulama |
| `undici` | Sunucu tarafı HTTP istemcisi |
| `htmlparser2` | HTML ayrıştırma |
| `pg_trgm` | Benzerlik tabanlı arama |
| GitHub App | Yalnız repository installation, repository seçimi, read-only yetki ve eşitleme; kullanıcı login'i veya ürün oturumu taşımaz |
| Octokit | GitHub API ve webhook entegrasyonu |
| Scalar | API dokümantasyonu |
| T3 Env | Ortam değişkeni doğrulama |
| MCP TypeScript SDK v1 | MCP sunucusu |

## Platform, deployment ve gözlemlenebilirlik

| Teknoloji | Amaç |
| --- | --- |
| Railway | Deployment, worker, operasyonel cron ve sürümlü üst şifreleme anahtarı gibi sealed runtime secret yönetimi; dinamik kullanıcı entegrasyon token kasası değildir |
| pg-boss | PostgreSQL tabanlı durable job, zamanlama, retry ve dead-letter yönetimi |
| Cloudflare R2 | Nesne, arşiv ve ürün/operasyon kabul kanıtı artifact depolama; macOS package acceptance candidate'ın dağıtılabilir kanıtı için GitHub Releases kalıcı release sınırıdır. Ham public object URL'si dış yüzey asset sözleşmesi değildir ve bu satır operasyonel yedek mimarisi veya sağlayıcısı seçmez. Ürün sonucu: [operasyonel yedek ve kurtarma](prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma) |
| Cloudflare CDN | Dış yüzey etkinliği edge/origin tarafından her HTML ve asset isteğinde doğrulandıktan sonra payload dağıtımı ve purge hijyeni; stale/offline erişim veya güvenlik bariyeri değildir |
| Cloudflare WAF / Rate Limiting | IP tabanlı edge kötüye kullanım koruması |
| Tauri | İlk sürümde macOS masaüstü uygulaması |
| Tauri Opener eklentisi | Sistem tarayıcısını açma |
| Tauri Deep Link eklentisi | Masaüstü callback bağlantıları |
| Tauri Single Instance eklentisi | Tek uygulama örneği |
| Tauri Stronghold eklentisi | Masaüstü secret saklama |
| Tauri Process eklentisi | İmzalı updater kurulumu sonrası uygulamayı yeniden başlatma |
| Tauri Updater eklentisi | Masaüstü güncellemeleri |
| WXT | React tarayıcı uzantısı |
| Next.js | Yalnız Fumadocs dokümantasyon uygulamasının server/RSC framework'ü; ana ürün web uygulamasını veya API backend'ini taşımaz |
| Fumadocs + Fumadocs MDX | `Next.js: Fumadocs MDX` şablonunu kullanan dokümantasyon sitesi ve repository içi MDX içerik kaynağı |
| GitHub Releases | Masaüstü sürüm dağıtımı ve imzalı macOS package acceptance candidate ile ham kanıt arşivi için kalıcı release sınırı |
| Better Stack | Log, metrik, trace, uptime, heartbeat, hata izleme ve alarm |
| Evlog | Yapılandırılmış loglama |

### Dokümantasyon mimari sınırı

- Dokümantasyon uygulaması Fumadocs'un server/RSC tabanlı `Next.js: Fumadocs MDX` şablonunu kullanır; `Next.js Static` şablonu kullanılmaz.
- Next.js yalnız dokümantasyon uygulamasının framework'üdür. Ana ürün web uygulaması React + Vite + TanStack Router, API backend'i Hono olarak kalır; ürün rotaları, kimlik doğrulama ve domain API'leri dokümantasyon uygulamasına taşınmaz.
- Fumadocs içeriğinin kanonik kaynağı repository içindeki MDX dosyalarıdır. Dokümantasyon uygulamasının server gereksinimi ürün backend'ini Next.js'e dönüştürmez.

### Yerel geliştirme sınırı

- Yerel geliştirmede Neon serverless sürücüsünü yerel PostgreSQL'e bağlayan proxy shim kullanılabilir. Shim geliştirici kolaylığıdır; ürün davranışının doğrulandığı ortam değildir ve ürettiği hiçbir sonuç [kabul kanıtı](prd/16-product-acceptance.md#urun-surum-adayi-kaniti) sayılmaz.
- R2 kimlik bilgileri olmayan `NODE_ENV=development` sunucusu, Dosya Eki object-store sınırını çalıştırmak için yalnız process ömründe yaşayan Bun adapter'ını kullanır. Bu adapter kalıcı kaynak değildir; production'da Cloudflare R2 zorunlu ve fail-closed kalır.
- [Avrupa Birliği veri bölgesi](prd/03-account-platform-operations.md#ab-veri-bolgesi) sözleşmesinin doğrulanması otomatik bir kontroldür ve production deployment'tan önce çalışır.

### Güvenlik verisi ve restore sınırı

- Dinamik GitHub ve entegrasyon token'ları uygulama katmanında envelope encryption ile şifrelenmiş ciphertext olarak PostgreSQL'de tutulur. Sürümlü üst anahtar Railway sealed runtime secret'tan gelir; üretim, entegrasyon, yedek ve export alanları ayrı döndürülebilir veri anahtarı kullanır. Secret düz metni log, arama, export, kanıt veya normal domain kaydına yazılmaz.
- Append-only güvenlik olay günlüğü birincil PostgreSQL + R2 restore biriminin dışında ayrı restore alanında tutulur; [ADR-0019](adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md) bu alanı ayrı kimlik bilgileriyle erişilen ayrı bir yönetilen PostgreSQL projesi olarak sabitler. Kalıcı silme, redaksiyon, yüzey/token/parola ve oturum iptali ile anahtar/entegrasyon rotasyonu restore sonrasında buradan replay edilir; replay tamamlanmadan dış erişim açılmaz. Kesin deployment topolojisi yeni veri teknolojisi seçmeden bu ayrılığı korur.
- Yüzey kapsamlı HTML, Dosya Eki ve range istekleri ham R2/CDN adresi açıklamaz. Hono/edge sınırı güncel Dış yüzey, ziyaretçi oturumu ve kesin asset sürümünü cache tesliminden önce doğrular; purge yalnız artalan hijyenidir.

## Geliştirme, kalite ve test araçları

| Teknoloji | Amaç |
| --- | --- |
| Biome | Lint ve formatlama |
| Ultracite | Biome kalite preset'i |
| Lefthook | Git hook yönetimi |
| Vitest | Unit ve integration testleri |
| Playwright | E2E test ve PDF üretimi |
| BrowserStack Automate | Gerçek tarayıcı testleri |
| Grafana k6 OSS | Performans testleri |
| GitHub Actions | CI/CD; kabul kanıtının kabul edildiği tek koşturucu. Repository'nin kendi Vitest/Playwright paketleri workflow service container'ındaki geçici PostgreSQL'e bağlanır; ayrı yönetilen test projesi açılmaz |
| GitHub Dependabot | Bağımlılık güncellemeleri |
| Conductor + Bun | Yerel çalışma alanı kurulumu ve geliştirme görevlerini çalıştırma; Neon dalı açma veya migration uygulama Conductor kurulum/çalıştırma betiğinin görevi değildir |

## Bilinçli olarak eklenmeyenler

- **Ana ürün frontend'i ve ürün yetenekleri:** Next.js (Fumadocs dokümantasyon uygulaması hariç), React Router, TanStack Start, React SSR, nuqs, PWA, i18n/çevrilebilir arayüz (ilk ürün UI dili sabit İngilizcedir; locale yalnız biçimlendirmedir), offline/local DB, ayrı grafik kütüphanesi, OCR, Storybook
- **Wireframe motor alternatifleri:** Excalidraw runtime/fork'u, tldraw SDK, DGM.js, Fabric.js, PixiJS, Moveable/Selecto ve QuickMock fork/dependency'si
- **Backend ve veri:** Express, Fastify, Elysia, Redis, AWS servisleri, Cloudflare Queues
- **Runtime ve paket yönetimi:** Node.js runtime, pnpm, npm
- **Masaüstü ve gerçek zamanlı çalışma:** Electron, Electrobun, Rust backend, SSE, push bildirimleri
- **Monorepo ve geliştirme araçları:** Nx, Vite+, Husky, Oxlint/Oxfmt, OpenTUI, Semgrep/SAST
- **Servisler:** Sentry, e-posta sağlayıcısı
- **Better-T-Stack preset ve add-on'ları:** Native frontend, örnek proje, web/server deployment preset'leri, `skills`, `mcp`

## Tek Belge PDF çalışma zamanı

Documents tek-Belge export'u mevcut TanStack Markdown HTML renderer'ını (`@tanstack/markdown/html`) ve Playwright Chromium'u kullanır. Uygulama örneği `apps/server/src/features/documents/server/document-pdf.ts`; oRPC/Zod, atomik Drizzle mutation ve React/TanStack Query seçim örnekleri sırasıyla `packages/api/src/document-transfer.ts`, `document-transfers-database.ts` ve `document-transfer-controls.tsx` dosyalarıdır. Yeni veri teknolojisi yoktur.

Server bağımlılıkları kurulduktan sonra PDF çalışan her geliştirme/deployment imajında `bunx playwright install --with-deps chromium` çalıştırılmalıdır; Chromium cache'i runtime kullanıcısının okuyabildiği konumda kalmalıdır. Server TypeScript/Bun build'i tarayıcı binary'sini gömmez. Integration CI, gerçek PDF seam testinden önce aynı browser sürümünü kurar. Renderer dış HTTP/asset erişimini ve script çalıştırmayı kapatır; PDF dış resimleri yüklemez, özgün Markdown indirme alternatifi korunur. Tagged PDF/WCAG uyumu taahhüt edilmez. Operasyon sınırları ve test bağı `docs/specs/31-documents/spec.md` içindeki Snapshot renderer kararına aittir.

## Daha sonra eklenecekler

| Teknoloji | Amaç |
| --- | --- |
| Trigger.dev veya eşdeğer durable workflow orchestration | Büyük import/export ve dosya işleme pg-boss sınırlarını aşarsa değerlendirme |
| `@zip.js/zip.js` veya eşdeğeri | Ürün paketi ve çok dosyalı ZIP aktarımı |
| ClamAV | Fail-closed zararlı dosya taraması |
| Yjs/CRDT + WebSocket | Tiptap, Custom Wireframe Engine, React Flow ve Moodboard canlı işbirliği; Wireframe entegrasyonu canonical command/model adaptörü üzerinden yapılır |

Ödeme sağlayıcısı ve ürün analitiği sağlayıcısı teknoloji yol haritasına alınmamıştır. Bunlar yalnız [Gelecek Yönlerinde](prd/18-future-directions.md) açık ihtiyaç, gizlilik/veri sınırı ve kabul paketiyle gerçek adaya dönüştürüldükten sonra değerlendirilir; Ticari Genişlemenin ilk paketi ödeme tahsil etmez.
