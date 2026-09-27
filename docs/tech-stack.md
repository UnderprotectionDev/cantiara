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

Normal şema değişiklikleri, kaynak şemadan `drizzle-kit generate` ile sürümlü SQL olarak üretilir. Dağıtılmış veritabanı migration geçmişiyle gerçek şema ayrışmış ve kaynak şema zaten hedef durumu ifade ediyorsa, geçmiş migration'ları değiştirmek veya paylaşılan veritabanında `drizzle-kit push` kullanmak yerine `drizzle-kit generate --custom` ile idempotent bir compatibility migration oluşturulur. Bu migration da `bun run db:migrate` ile uygulanır ve gerekli Drizzle metadata'sını taşır.

Migration çalıştırıcısı Neon için `DATABASE_URL_UNPOOLED` (güvenlik olayı veritabanında `SECURITY_EVENT_DATABASE_URL_UNPOOLED`) değerini tercih eder. Yalnızca havuzlu `DATABASE_URL` verilmişse `.neon.tech` uç noktasındaki `-pooler` soneki kaldırılarak doğrudan bağlantı kullanılır. `NEON_LOCAL=true` iken yerel PostgreSQL bağlantısı yalnızca ilgili `DATABASE_URL` üzerinden seçilir; ayarlı bir `*_UNPOOLED` değeri yerel bağlantının önüne geçmez.

Dar kapsamlı tarihsel Prioritization şeması onarımı yalnızca mevcut veritabanında `0046–0048` önkoşulları ile beklenen şema nesneleri zaten bulunduğunda kullanılır. Bu kip, kanonik migration komutunun `bun run db:migrate -- --repair-prioritization-schema` biçimindeki seçici çalıştırmasıdır; yalnızca `0054_repair_prioritization_schema` girdisini uygular ve bu girdiyi normal Drizzle migration geçmişine kaydeder. Migration beklenen önkoşulları doğrular, eksik bulursa durur. Bu kip ilk kurulum veya olağan migration akışı yerine kullanılmaz; yeni ve normal veritabanlarında bayraksız `bun run db:migrate` çalıştırılır.

Önceden oluşturulmuş `work_external_execution_handoff` tablosu bulunup `0056_work-external-execution-handoff` migration geçmişinde kayıtlı değilse, iptal alanı değişikliği için `bun run db:migrate -- --repair-external-handoff-cancellation` seçici onarımı kullanılır. Yalnızca idempotent `0058_external-handoff-cancellation-compatibility` girdisini çalıştırır; temel Handoff alanlarını doğrular, iptal gerekçesi sütununu ve kısıtını ekler, çelişkili kayıt bulursa durur. Yeni ve normal veritabanlarında standart `bun run db:migrate` yolu `0056` ve `0057` sonrasında bu uyumluluk migration'ını da güvenle no-op olarak kaydeder.

`0059_external-handoff-result-reconciliation` geçmişi eksik görünürken `reconcile_decision` veya `result` sütunlarından en az biri zaten varsa, normal `0059` adımının yinelenen sütunda durmasını önlemek için `bun run db:migrate -- --repair-external-handoff-result-reconciliation` seçici onarımı kullanılır. Yalnızca idempotent `0060_external-handoff-schema-compatibility` girdisini çalıştırıp normal Drizzle migration geçmişine kaydeder; ardından bayraksız `bun run db:migrate` bekleyen `0061` ve sonraki migration'ları uygular. Bu kip ilk kurulumun veya olağan migration akışının yerine geçmez.

### Paralel geliştirmede paylaşılan veritabanı

Her issue kendi şema değişikliğinin migration'ını taşır; birkaç spec veya issue bitene kadar migration biriktirilmez. Paylaşılan geliştirme veritabanının migration geçmişi ise tek bir sıralı hattır: kod paralel ilerlerken bu veritabanına şema uygulama işi sırayla yürür.

1. Bir issue tablo, sütun veya kısıt değiştiriyorsa aynı issue içinde kaynak şemayı değiştir, sürümlü SQL migration'ını üret ve gözden geçir. Migration'ı `bun run db:migrate` ile doğrula; issue'yu bitirmeden hedef veritabanında beklenen şema nesnesini ve migration kaydını kontrol et. Şema değişmiyorsa yeni migration üretme.
2. Hedef paylaşılan geliştirme veritabanıysa önce çalışma dalına en güncel kanonik migration geçmişini al ve journal ile `drizzle.__drizzle_migrations` kayıtlarını zaman damgası, sıra ve SQL hash'i açısından karşılaştır. Veritabanında dalın bilmediği yeni migration veya dalda veritabanının atladığı eski migration varsa uygulamayı durdur; `bun run db:migrate` başarılı dönse bile eski migration'ları atlayabilir.
3. Paylaşılan veritabanına aynı anda yalnız bir issue migration'ı uygula. Henüz ana dala birleşmemiş bir migration uygulandıysa onun SQL'i ve journal girdisi artık kalıcıdır: sonraki issue migration'ından önce bu geçmişi ana dala taşı ve diğer çalışma dallarına aldır. Erken doğrulama gerekiyor ama bu sıralamayı bekleyemiyorsa issue için atılabilir yerel PostgreSQL veritabanında migrate et.
4. Paralel dallarda çakışan journal girdilerini ana dala birleştirirken tek sıraya uzlaştır; paylaşılan veya kalıcı veritabanına uygulanmış migration'ı yeniden adlandırma ya da değiştirme. Uzlaştırılmış geçmişi temiz bir atılabilir veritabanında baştan uygula. Geçmiş ile gerçek şema zaten ayrışmışsa bu bölümdeki migration onarım sınırına göre idempotent compatibility migration hazırla; paylaşılan veritabanında `db:push` ile ayrışmayı gizleme.

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

## Bilinçli olarak eklenmeyenler

- **Ana ürün frontend'i ve ürün yetenekleri:** Next.js (Fumadocs dokümantasyon uygulaması hariç), React Router, TanStack Start, React SSR, nuqs, PWA, i18n/çevrilebilir arayüz (ilk ürün UI dili sabit İngilizcedir; locale yalnız biçimlendirmedir), offline/local DB, ayrı grafik kütüphanesi, OCR, Storybook
- **Wireframe motor alternatifleri:** Excalidraw runtime/fork'u, tldraw SDK, DGM.js, Fabric.js, PixiJS, Moveable/Selecto ve QuickMock fork/dependency'si
- **Backend ve veri:** Express, Fastify, Elysia, Redis, AWS servisleri, Cloudflare Queues
- **Runtime ve paket yönetimi:** Node.js runtime, pnpm, npm
- **Masaüstü ve gerçek zamanlı çalışma:** Electron, Electrobun, Rust backend, SSE, push bildirimleri
- **Monorepo ve geliştirme araçları:** Nx, Vite+, Husky, Oxlint/Oxfmt, OpenTUI, Semgrep/SAST
- **Servisler:** Sentry, e-posta sağlayıcısı
- **Better-T-Stack preset ve add-on'ları:** Native frontend, örnek proje, web/server deployment preset'leri, `skills`, `mcp`

## Daha sonra eklenecekler

| Teknoloji | Amaç |
| --- | --- |
| Trigger.dev veya eşdeğer durable workflow orchestration | Büyük import/export ve dosya işleme pg-boss sınırlarını aşarsa değerlendirme |
| `@zip.js/zip.js` veya eşdeğeri | Ürün paketi ve çok dosyalı ZIP aktarımı |
| ClamAV | Fail-closed zararlı dosya taraması |
| Yjs/CRDT + WebSocket | Tiptap, Custom Wireframe Engine, React Flow ve Moodboard canlı işbirliği; Wireframe entegrasyonu canonical command/model adaptörü üzerinden yapılır |

Ödeme sağlayıcısı ve ürün analitiği sağlayıcısı teknoloji yol haritasına alınmamıştır. Bunlar yalnız [Gelecek Yönlerinde](prd/18-future-directions.md) açık ihtiyaç, gizlilik/veri sınırı ve kabul paketiyle gerçek adaya dönüştürüldükten sonra değerlendirilir; Ticari Genişlemenin ilk paketi ödeme tahsil etmez.
