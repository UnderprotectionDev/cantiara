# Teknoloji Yığını

## Temel uygulama yığını

| Teknoloji | Amaç |
| --- | --- |
| React | Web arayüzü |
| Vite | Web geliştirme ve derleme |
| TanStack Router | Yönlendirme ve URL durumu |
| Hono | API backend'i ve herkese açık HTML/SEO yanıtları |
| Bun | Runtime ve paket yönetimi |
| PostgreSQL | Ana ilişkisel veritabanı; ticari para hesaplarında `numeric` ve kanonik decimal string oracle'ı |
| Neon | Yönetilen PostgreSQL; üretimle aynı pinlenmiş major/extension matrisi kullanan, her DDL doğrulamasından sonra atılan disposable test veritabanları/branch'leri |
| Prisma | ORM ve veri erişimi |
| oRPC | Tip güvenli API katmanı |
| Better Auth | Web, masaüstü ve uzantı kullanıcı kimliği, GitHub login OAuth'u ve ürün oturumları; repository yetkisi taşımaz |
| Turborepo | Monorepo yönetimi |

## Arayüz ve durum yönetimi

| Teknoloji | Amaç |
| --- | --- |
| shadcn/ui | Uygulama bileşenleri |
| Base UI | Erişilebilir bileşen temeli |
| Tailwind CSS | Arayüz stilleri |
| Lucide React | Uygulama ikonları ve Wireframe semantic component ikon kaynağı |
| TanStack Query | Sunucu verisi ve önbellek |
| TanStack Store | İstemci, inspector, toolbar ve Wireframe editör oturumu durumu |
| TanStack Form | Form yönetimi |
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
| Uppy Core | R2 upload yönetimi |
| `file-type` | Dosya türü algılama |
| Sharp | Görsel üstverisi ve thumbnail |
| Papa Parse | CSV ayrıştırma |
| `yaml` | YAML ayrıştırma |
| `canonicalize` | Test raporu canonicalization |
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
| Cloudflare R2 | Nesne, arşiv ve sürüm kabul kanıtı artifact depolama; ham public object URL'si dış yüzey asset sözleşmesi değildir ve bu satır operasyonel yedek mimarisi veya sağlayıcısı seçmez. Ürün sonucu: [operasyonel yedek ve kurtarma](prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma) |
| Cloudflare CDN | Dış yüzey etkinliği edge/origin tarafından her HTML ve asset isteğinde doğrulandıktan sonra payload dağıtımı ve purge hijyeni; stale/offline erişim veya güvenlik bariyeri değildir |
| Cloudflare WAF / Rate Limiting | IP tabanlı edge kötüye kullanım koruması |
| Tauri | İlk sürümde macOS masaüstü uygulaması |
| Tauri Opener eklentisi | Sistem tarayıcısını açma |
| Tauri Deep Link eklentisi | Masaüstü callback bağlantıları |
| Tauri Single Instance eklentisi | Tek uygulama örneği |
| Tauri Stronghold eklentisi | Masaüstü secret saklama |
| Tauri Updater eklentisi | Masaüstü güncellemeleri |
| WXT | React tarayıcı uzantısı |
| Next.js | Yalnız Fumadocs dokümantasyon uygulamasının server/RSC framework'ü; ana ürün web uygulamasını veya API backend'ini taşımaz |
| Fumadocs + Fumadocs MDX | `Next.js: Fumadocs MDX` şablonunu kullanan dokümantasyon sitesi ve repository içi MDX içerik kaynağı |
| GitHub Releases | Masaüstü sürüm dağıtımı |
| Better Stack | Log, metrik, trace, uptime, heartbeat, hata izleme ve alarm |
| Evlog | Yapılandırılmış loglama |

### Dokümantasyon mimari sınırı

- Dokümantasyon uygulaması Fumadocs'un server/RSC tabanlı `Next.js: Fumadocs MDX` şablonunu kullanır; `Next.js Static` şablonu kullanılmaz.
- Next.js yalnız dokümantasyon uygulamasının framework'üdür. Ana ürün web uygulaması React + Vite + TanStack Router, API backend'i Hono olarak kalır; ürün rotaları, kimlik doğrulama ve domain API'leri dokümantasyon uygulamasına taşınmaz.
- Fumadocs içeriğinin kanonik kaynağı repository içindeki MDX dosyalarıdır. Dokümantasyon uygulamasının server gereksinimi ürün backend'ini Next.js'e dönüştürmez.

### Güvenlik verisi ve restore sınırı

- Dinamik GitHub ve entegrasyon token'ları uygulama katmanında envelope encryption ile şifrelenmiş ciphertext olarak PostgreSQL'de tutulur. Sürümlü üst anahtar Railway sealed runtime secret'tan gelir; üretim, entegrasyon, yedek ve export alanları ayrı döndürülebilir veri anahtarı kullanır. Secret düz metni log, arama, export, kanıt veya normal domain kaydına yazılmaz.
- Append-only güvenlik olay günlüğü birincil PostgreSQL + R2 restore biriminin dışında ayrı restore alanında tutulur. Kalıcı silme, redaksiyon, yüzey/token/parola ve oturum iptali ile anahtar/entegrasyon rotasyonu restore sonrasında buradan replay edilir; replay tamamlanmadan dış erişim açılmaz. Kesin deployment topolojisi yeni veri teknolojisi seçmeden bu ayrılığı korur.
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
| GitHub Actions | CI/CD |
| GitHub Dependabot | Bağımlılık güncellemeleri |

## Bilinçli olarak eklenmeyenler

- **Ana ürün frontend'i ve ürün yetenekleri:** Next.js (Fumadocs dokümantasyon uygulaması hariç), React Router, TanStack Start, React SSR, nuqs, PWA, i18n/çevrilebilir arayüz (ilk ürün UI dili sabit İngilizcedir; locale yalnız biçimlendirmedir), offline/local DB, ayrı grafik kütüphanesi, OCR, Storybook
- **Wireframe motor alternatifleri:** Excalidraw runtime/fork'u, tldraw SDK, DGM.js, Fabric.js, PixiJS, Moveable/Selecto ve QuickMock fork/dependency'si
- **Backend ve veri:** Express, Fastify, Elysia, Drizzle, Redis, AWS servisleri, Cloudflare Queues
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
