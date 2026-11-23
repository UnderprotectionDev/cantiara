# Teknoloji yığını kullanım denetimi

Durum: **4. aşama tamamlandı. Sahiplik kararları 2026-11-19’da onaylandı (#553, §16).**

Tarih: 2026-11-18. Branch: `chore/audit-spec-stack`.

## Amaç ve kurallar

Her spec'in tarif ettiği işe göre hangi `docs/tech-stack.md` teknolojisinin kullanılması gerektiğine karar verilir. Ardından kod üç tür soruna karşı taranır:

1. Teknoloji kullanılması gereken yerde elle yazılmış bir çözüm var.
2. İş yanlış teknolojiyle yapılmış.
3. Bağımlılık kurulu ama hiçbir yerde kullanılmıyor.

Bağlayıcı kurallar:

- Teknoloji, spec'in adını vermesine bakılmadan, spec'te tarif edilen davranıştan seçilir. Örnek: kart sürükleme → dnd-kit.
- Üretim kodunda React `useState` kullanılmaz. Tek istisna `packages/ui` içindeki shadcn üretilmiş dosyalardır. Her kullanım için hedef çözüm yazılır:

  | Durum | Hedef çözüm |
  |---|---|
  | Mutation/query hata, bekleme ve sonuç durumu | oRPC + TanStack Query |
  | Form alanları ve gönderim durumu | TanStack Form |
  | Bileşenler arası paylaşılan istemci durumu | TanStack Store |
  | Filtre, sekme, seçim gibi URL'de durması gereken durum | TanStack Router search |
  | Açılır pencere açık/kapalı durumu | Base UI kontrolsüz API, `actionsRef`, `createHandle` |
  | Hiçbirine uymayan | "Sahipsiz" bölümüne yazılır, kullanıcıya sorulur |

- Kütüphane kalıpları resmi dokümandan ve işe göre seçilir. Tek tip kural ("her yerde X") yoktur.
- Kapsam: `apps/web`, `apps/server`, `apps/extension`, Tauri, `packages/*`. Test dosyaları ve spec'te olup henüz yazılmamış özellikler kapsam dışıdır.
- Önem dereceleri:
  - **Yüksek**: güvenlik veya veri sınırı.
  - **Orta**: yanlış sahip ve davranış etkisi.
  - **Düşük**: tutarlılık.
- tech-stack'te sahibi olmayan veya belirsiz işler için seçim yapılmaz. Bunlar "Sahipsiz" bölümüne yazılır.

Aşamalar:

1. Araştırma.
2. Kullanıcı kararları.
3. Yükseltme (`main`'den ayrı branch'ler).
4. Kullanım denetimi.
5. Düzeltme issue'ları.

---

## 1. Acil güvenlik bulgusu

**oRPC 1.15.1, GHSA-4p2c-m292-ghmh açığından etkileniyor.** Açık yüksek önem dereceli, kimlik doğrulaması gerektirmeyen bir DoS. `RPCHandler` içindeki `meta` deserializasyonunda bulunuyor ve auth middleware'inden önce çalışıyor.

- Yama: `@orpc/server` ve `@orpc/client` 1.15.2.
- Kaynak: [advisory](https://github.com/middleapi/orpc/security/advisories/GHSA-4p2c-m292-ghmh) (GitHub API ile doğrulandı).
- Etkilenen yer: `apps/server/src/app.ts` `/rpc` için `RPCHandler` kullanıyor.
- Çözüm: Catalog aralığı `^1.15.0` olduğu için 1.16.3'e geçiş yalnız lockfile'ı değiştirir. Beş `@orpc/*` paketi birlikte güncellenir.

**Öneri:** diğer kararları beklemeden ayrı bir PR.

---

## 2. oRPC v2 kararı

İki model bu soruyu bağımsız inceledi: Claude Opus 5.5 ve GPT-6.2 Sol. **İkisi aynı öneriye vardı.**

### Bulgular

| Kriter | Bulgu | Risk |
|---|---|---|
| Stable takvimi | `latest`=1.16.3, `beta`=2.0.0-beta.51, RC yok, tarih yok. Maintainer "close to stable" diyor. [#2446](https://github.com/middleapi/orpc/discussions/2446) "Stable is the last chance to rename or reshape APIs" diyor. | Orta |
| API kararlılığı | Son 10 betanın 8'i kırıcı değişiklik içeriyor. Son kırıcı değişiklik beta.51'de (2026-11-17). Ortalama 3–5 günde bir beta çıkıyor. | Yüksek |
| Yayımlanmış beta'daki güvenlik | GHSA-p4q5'in v2 yaması ([#2490](https://github.com/middleapi/orpc/pull/2490)) beta.51'den sonra `main`'e alındı. Yayımlanmış bir v2 sürümünde olduğu doğrulanamadı. Bizim handler kurulumumuz bu açıktan etkilenmiyor. | Orta |
| Açık bug | Kritik açık v2 bug'ı yok. Tek açık bug'ı ([#2488](https://github.com/middleapi/orpc/issues/2488)) maintainer "intended" olarak işaretledi. | Düşük |
| TanStack Query | `@orpc/tanstack-query@beta` paketi `@tanstack/query-core >=5.105.0` istiyor. Bizde 5.102.8 kurulu. | Orta |
| `ORPCError({ defined: true })` | v2'de bu seçenek yok. `defined` artık `.errors()` eşleşmesinden türetiliyor. **Resmi geçiş rehberinde geçmiyor.** Repoda 271 kullanım var: `packages/api/src/routers/index.ts` (257), `project-retirement-handlers.ts` (8), `link-sharing.ts` (4), `personal-data-rights-handlers.ts` (1), `data-export-handlers.ts` (1). | Orta |
| HTTP durum eşlemesi | v2'de `ORPCError.status` kalktı. `support-failure-http.ts` içindeki `errorStatus()` `error.status` okumuyor ve 500'e düşüyor. Bu yüzden 401/409 yanıtları 500'e dönüşebilir. | Yüksek |
| Wire formatı ve macOS | v1 `RPCLink` v2 sunucusuyla konuşamıyor. Spec 03 önceki imzalı masaüstü istemcisine 30 günlük API penceresi tanıyor. | Yüksek |
| Etkilenen dosya | Yaklaşık 8–15 doğrudan dosya ve 271 satırlık `defined` temizliği. Etkilenecek ana dosyalar: `app.ts` (`experimental_RethrowHandlerPlugin` → `RethrowHandlerPlugin`, `OpenAPIReferencePlugin` → `OpenAPIReferenceHandlerPlugin` + `OpenAPIGenerator`, `@orpc/zod/zod4` → `@orpc/zod`), `utils/orpc.ts` (`RPCLink` `origin` + `url`, özel `fetch` imzası), `completion-effects.e2e.ts`, `document-work-action-dialog.tsx` (`QueryOptionsBase` export'u yok), iki `support-reference.ts`. | Orta |
| v1 bakımı | Yazılı EOL politikası yok. Güvenlik yamaları 1.x'e fiilen geliyor (1.15.2 ve 1.16.3). | Orta |

Kaynaklar: [from-v1 rehberi](https://orpc.dev/docs/migrations/from-v1), [orpc-migrate skill](https://github.com/middleapi/orpc/blob/main/skills/orpc-migrate/SKILL.md), [releases](https://github.com/middleapi/orpc/releases).

### Öneri

**Şimdi 1.16.3'e yamala, v2'ye şu koşullar birlikte gerçekleşince geç:**

1. Beş paketin npm `latest` etiketi aynı kararlı 2.x sürümünü göstermeli ve bu sürüm #2490'ı içermeli.
2. Stable/RC sonrası en az 2 hafta kırıcı değişiklik çıkmamalı.
3. Ön işler bitmiş olmalı:
   - `@tanstack/react-query` ≥ 5.105.
   - `defined: true` kararı verilmiş olmalı: `.errors()` tanımlarına mı geçilecek, yoksa kaldırılacak mı?
   - `errorStatus()` v2 hata modeline uyarlanmış olmalı.
4. Spec 03 penceresindeki önceki imzalı Tauri istemcisi, yeni sunucuyla oturum, okuma ve yazma testlerini geçmeli. Pencere dışındaki istemci yazmadan önce `Update required` almalı.

Resmi oRPC skill'leri (`middleapi/orpc/skills`) v2'yi hedefliyor ve v1 projesinde ajanları yanlış yönlendirir. Bu yüzden v2'ye geçilene kadar kurulmaz.

---

## 3. Rate limit (ertelendi, #553)

- tech-stack'te rate limit'in tek sahibi Cloudflare WAF. Bu kural IP tabanlı.
- Spec'ler zaten uygulama katmanında karşılanıyor:
  - Spec 01: sign-in sayacı Better Auth/Hono'da tutuluyor (`packages/auth/src/index.ts`, `account-admission.ts`).
  - Spec 73: ziyaretçi kapısı Hono `/s/:token` + `link_share_gate_attempt`.
  - Spec 74: spec 73'e atıf yapıyor.
  - Spec 61: GitHub'ın giden API limitine uyuyor.
- **Bugün oRPC rate limit'ine ihtiyaç duyan bir spec bulunmadı.**
- oRPC seçenekleri:
  - v1: `@orpc/experimental-ratelimit` (deneysel).
  - v2: `@orpc/ratelimit@beta`.
- Adaptörler memory, Redis, Upstash, Bun Redis ve Cloudflare. **PostgreSQL adaptörü yok.** tech-stack Redis'i bilinçli olarak eklemiyor (`docs/tech-stack.md` "Bilinçli olarak eklenmeyenler"). Bu yüzden oturumlu oRPC procedure'lerinde kullanıcı bazlı limit gerekirse özel bir `RateLimiter` (PostgreSQL) yazmak gerekir.

**Öneri:** Şimdilik ekleme. İhtiyaç doğarsa v2 `@orpc/ratelimit` arayüzüne uyan, PostgreSQL destekli özel limiter yazılır. Bu yeni bir stack kararıdır.

**Karar (#553, 2026-11-19):** Genel uygulama içi rate limiter somut bir owning spec ihtiyacına kadar ertelendi; yeni issue açılmadı. Account Access sign-in sayacı, Link Sharing ziyaretçi kapısı ve kurucu sınırı, GitHub giden API limiti, Smart Link egress ve Cloudflare WAF korumaları kendi sınırlarında kalır. İhtiyaç doğduğunda limiter seçimi yukarıdaki öneriye göre yeni stack kararı olarak getirilir. Kayıt: `docs/tech-stack.md` Cloudflare WAF / Rate Limiting satırı ve bu belgenin 16. bölümü.

---

## 4. Diğer bağımlılıklar

### 4.1 Yama ve minor güncellemeler (toplu PR)

Kırıcı değişiklik beklenmiyor. Tam test, tip kontrolü ve `check:conventions` geçmek şartıyla toplu yapılır:

- **Uygulama paketleri:**
  - React/React DOM 19.3.1
  - `@tanstack/react-query` 5.108.0 ve devtools
  - `@tanstack/react-router` 1.170.46 ve plugin/devtools
  - `@tanstack/react-virtual` 3.14.26
  - `@tanstack/react-store` 0.11.2
  - `@dnd-kit/react` 0.5.3
  - Hono 4.13.19
  - drizzle-orm 0.45.4, drizzle-kit 0.31.11
  - lucide-react 1.75.0
  - pdfjs-dist 6.5.438
  - mermaid 12.3.0
  - pg-boss 12.38.2
  - evlog 2.35.1
  - `@modelcontextprotocol/sdk` 1.32.2
  - Tauri api/plugin'leri ve cli 2.12.x
  - `@base-ui/react` 1.9.0, `shadcn` 4.23.0, `react-day-picker` 10.0.2, `react-resizable-panels` 4.24.0
  - Tiptap paketleri 3.34.0, `react-pdf` 11.1.0, `katex` 0.18.11
  - `konva` 10.9.1, `react-konva` 19.3.2, `@uppy/core` 6.3.1
  - `@neondatabase/serverless` 1.2.1, `zod` 4.6.7
  - `undici` 7.30.2 (7.x hattında güvenlik yaması; major geçiş değil)
- **Araçlar:**
  - `postcss` 8.5.33
  - Vite 8.3.8, `@vitejs/plugin-react` 6.3.0
  - Vitest 5.1.1
  - Turbo 2.11.12
  - tsdown 0.23.7
  - Tailwind 4.3.5
  - wxt 0.21.5, web-ext 10.8.0
  - `@axe-core/playwright` 4.14.0
  - `@types/*`

Not: TanStack Query 5.108'de `queryClient.query()` gelip `fetchQuery` ve `ensureQueryData` deprecated olmuş olabilir. Bu doğrulanamadı. Yükseltmeden sonra tip dosyasına bakılır ve 6. bölümdeki sözleşme buna göre güncellenir.

### 4.2 Major ve sabitlenmiş sürümler

| Paket | Kurulu → hedef | Bize dokunan değişiklik | Risk | Öneri |
|---|---|---|---|---|
| happy-dom | 20.14.6 → 21.0.4 | SSRF ve kod enjeksiyonu güvenlik yamaları. CSS ve iframe yükleme varsayılan kapalı (2 web testi olası). | Düşük | **Geç, öncelikli** |
| lefthook | 2.1.14 → 2.2.2 | Yok. Worktree patch adı düzeltmesi bize faydalı. | Düşük | Geç |
| @tanstack/pacer-lite | 0.1.1 → 0.3.0 | Yalnız ESM/ES2022. 7 dosya `LiteDebouncer` kullanıyor. | Düşük | Geç |
| @tanstack/markdown | 0.0.15 → 1.2.0 | "0.0.16 çağrıları göç gerektirmez". `renderHtml({ allowHtml: false })` güvenlik testi gerekli. | Düşük | Geç (Highlight ile) |
| @tanstack/highlight | 0.1.0 → 1.2.12 | 1.0'da JS/TS vurgu çıktısı değişti. Alt yol export'ları derlemede kontrol edilmeli. | Düşük–orta | Geç (Markdown ile) |
| @tanstack/react-table | 8.21.3 → 9.3.1 | `useReactTable`→`useTable`, `tableFeatures`, `ColumnDef<TFeatures,T>`, `table.state`. 2 dosya etkileniyor. | Düşük | Geç |
| file-type | 21.3.4 → 22.3.0 | Yok (stream API ve alt export kullanılmıyor). | Düşük | Geç |
| ipaddr.js | 1.9.1 → 2.5.0 | Daha sıkı sınıflandırma (yalnız red yönünde). Tip uyumu derlemede kontrol edilmeli. | Düşük | Geç |
| htmlparser2 | 10.1.0 → 12.0.0 | v12'de `iframe`/`noframes`/`textarea` içeriği ham metin. Smart Link önizleme metnine sızabilir. | Düşük–orta | Geç, önce karakterizasyon testi |
| papaparse (+types) | 5.5.3 → 5.7.1 | Yok. | Düşük | Geç |
| sharp | 0.35.4 → 0.35.5 | Yok. | Düşük | Geç |
| playwright, @playwright/test | 1.63.0 → 1.65.1 | `devices[...]` artık `screen` iletiyor (ekran boyutuna duyarlı e2e). Chromium 159 yeniden kurulumu gerekiyor. | Orta | Geç, ikisi birlikte |
| next | 16.3.4 → 16.4.6 | Yok. | Düşük | Geç (Fumadocs ile) |
| cn | 0.2.6 → 0.5.2 | Sınıf birleştirme semantiği değişti. `packages/ui` 44 dosyada kullanıyor. | Düşük / orta | Fumadocs'ta geç, `packages/ui` ayrı karar |
| fumadocs-core, base-ui, mdx | 16.15.10 → 16.19.4 | `includeProcessedMarkdown` çıktısı değişebilir. Sürüm dün çıktı. | Düşük–orta | **Bekle** (bir yama veya 1 hafta) |
| ultracite | 7.12.0 → 8.3.0 | Biome ≥ 2.6.2 zorunlu. `biome.base.json` `useSortedClasses`→`useTailwindSortedClasses`. Geniş stil diff'i bekleniyor. 8.3.0 bir günlük. | Orta | **Bekle**: Biome 2.6 ile tek PR, 8.2.1 düşünülebilir, `ultracite init` çalıştırılmaz |
| undici | 7.29.1 → 8.12.4 | H2 varsayılan açık, dispatcher izolasyonu. Smart Link SSRF egress worker'ı etkileniyor. `undici/index.js` yolu doğrulanmalı. | Orta–yüksek | **Bekle**: ayrı PR, egress smoke testi |
| typescript | 6.0.3 → 7.0.2 | **7.0'da programatik API yok.** `scripts/convention-check.ts` `import ts from "typescript"` kullanıyor, bu yüzden `check:conventions` her commit'i bloklar. Ayrıca `types`/`rootDir` varsayılanları değişti. | Orta | **Bekle**: önce stack kararı |

### 4.3 Henüz araştırılmamışlar

İlk taramada gözden kaçtılar. Yükseltme adımında önce araştırılır, ardından kullanıcıya sorulur. Onay gelmeden yükseltilmez.

| Paket | Kurulu → hedef | Neden dikkat |
|---|---|---|
| `@xyflow/react` | 12.12.0 → 13.0.2 | Major. Roadmap canvas'ı, `roadmap-viewport.ts` ve Return to Work görsel turu buna bağlı. |
| `diff` | 8.0.4 → 9.0.0 | Major. Metin ve sürüm karşılaştırması için kullanılıyor. |
| `katex` | 0.18 → 0.19 | 0.x minor olduğu için kırıcı olabilir. Tiptap mathematics ile uyumu kontrol edilmeli. |
| `better-auth` | 1.7.3 → 1.7.25 | Sürümü sabitlenmiş, güvenlik açısından hassas. AGENTS.md'nin Authentication kuralı ve Account Access seam testleri uygulanmalı. |
| `@vidstack/react` | 1.15.6 → 1.15.7 | Sabitlenmiş bir yama. |
| Tauri Rust crate'leri | `apps/web/src-tauri/Cargo.toml` | `bun outdated` bunları göstermiyor. `@tauri-apps/*` 2.12.x ile uyumlu olmalı. |
| Bun | `packageManager: bun@1.3.13` | Runtime sürümü ayrıca kontrol edilmeli. |

Pinler hakkında: Sabitlenmiş sürümlerin hiçbiri için belgelenmiş bir "bu sürümde kal" gerekçesi yok. Hepsi paketi ekleyen commit'te tam sürümle eklenmiş.

Önerilen sıra:

1. oRPC 1.16.3 ve happy-dom (güvenlik).
2. Yama/minor toplu PR.
3. lefthook, pacer-lite, file-type, ipaddr.js, papaparse, sharp.
4. Markdown + Highlight.
5. react-table 9.
6. htmlparser2 (karakterizasyon testiyle).
7. Playwright.
8. Next + Fumadocs + cn (bekleme süresinden sonra).
9. Biome 2.6 + Ultracite.
10. undici.
11. 4.3'teki paketler (önce araştırma ve kullanıcı onayı).
12. TypeScript 7 (stack kararından sonra).

---

## 5. Kullanıcı kararları

Hepsi 2026-11-18'de "Öneri" sütunundaki gibi onaylandı.

| # | Karar | Öneri (onaylandı) |
|---|---|---|
| K1 | oRPC 1.16.3 güvenlik yaması şimdi ayrı PR olarak yapılsın mı? | Evet |
| K2 | oRPC v2'ye şimdi mi, 2. bölümdeki koşullar gerçekleşince mi geçilsin? | Koşullar gerçekleşince |
| K3 | 4.2'deki "geç" önerileri ve önerilen sıra onaylanıyor mu? | Evet |
| K4 | TypeScript 7 için `check:conventions` nasıl taşınsın? Seçenekler: (a) `@typescript/typescript6` takma adıyla 6.0 API'sini tutmak, (b) TS 7.1 API'sini beklemek, (c) aracı TS API'siz yeniden yazmak. | (b). 7.1'e kadar TS 6'da kalınır. |
| K5 | Ultracite 8 + Biome 2.6 ne zaman yapılsın? | Diğer yükseltmeler bittikten sonra, stil diff'i ayrı commit |
| K6 | dnd-kit: `project-backlog.tsx`, `moodboard-outline.tsx`, `unified-calendar.tsx` legacy `@dnd-kit/core|sortable|utilities` kullanıyor. `@dnd-kit/react`'e taşınıp legacy paketler kaldırılsın mı? | Evet, 5. aşamada ayrı issue |
| K7 | Base UI `createHandle` `apps/web`'den nasıl erişilsin? Seçenekler: (a) `packages/ui` içinden yeniden export etmek, (b) `apps/web`'e `@base-ui/react` bağımlılığı eklemek. | (a). shadcn sarmalayıcısıyla tutarlı kalır. |
| K8 | `cn` 0.5'e `packages/ui`'da da geçilsin mi? | Fumadocs'tan sonra, görsel kontrolle ayrı PR |
| K9 | Rate limit için oRPC middleware'i şimdilik eklenmesin mi? | Eklenmesin (3. bölüm) |
| K10 | Kullanım sözleşmeleri (6. bölüm) bu haliyle `docs/tech-stack.md`'ye yazılsın mı? | Yükseltmeler bittikten sonra, hedef sürüme göre son haliyle |

---

## 6. Kütüphane kullanım sözleşmeleri (taslak)

Bu taslaklar resmi dokümandan ve kurulu tip tanımlarından çıkarıldı. 4. aşamadaki tarama ajanları bunlara göre değerlendirme yapar. Onaydan sonra `docs/tech-stack.md`'ye kısa sözleşme olarak yazılır (K10).

### 6.1 oRPC (v1.16; v2 farkları not edildi)

| İş | API | Yerine geçtiği kalıp |
|---|---|---|
| Kimlik, sahiplik, loglama, rate limit | `.use(middleware)`. Sahiplik için typed-input middleware (v1 `.use(mw, i => i.id)`, v2 `.use(mw.adaptInput(...))`). | Handler başında tekrar eden kontrol |
| Beklenen iş hataları | `.errors({ CODE: { data, message } })` + `throw errors.CODE(...)`. İstemcide `isDefinedError(e)`. | Mesaj metni ayrıştırma, `useState` hata metni |
| React dışı çağrı | `client.x()` veya `safe(client.x())` (v2'de `safe` dönüşü `[error, data, definedError, isSuccess]`). | Ham `fetch` |
| Okuma | `useQuery(orpc.x.queryOptions({ input }))`. Koşullu okuma için `input: cond ? … : skipToken`. Sonsuz liste için `infiniteOptions`. | `useEffect` + `setState` |
| Yazma | `useMutation(orpc.x.mutationOptions({ onSuccess, onError }))`. `mutationFn` içinde `client.x()` yalnız birden çok çağrıyı birleştirmek gibi gerekçeli durumlarda. | `useState(isSaving)` + `try/finally` |
| Geçersizleme | `orpc.x.key()` (kısmi), `orpc.x.queryKey({ input })` (tam). | Elle string anahtar |
| Prosedür bazlı varsayılanlar | `experimental_defaults` (v2'de `scoped`). | 14 kez tekrarlanan `staleTime: 0` |
| Canlı veri | async generator + `experimental_liveOptions` / `experimental_streamedOptions` (v2'de öneksiz). | Elle SSE, `setInterval` |

Mevcut durum:

- `.errors()`, `isDefinedError`, `safe` ve `liveOptions` hiç kullanılmıyor.
- `mutationOptions` yalnız 3 dosyada.
- Doğru örnek: `features/project-closure-summary/hooks/use-save-closure-summary.ts`.
- Sonsuz liste örneği: `features/project-history/hooks/use-project-activity.ts`.

### 6.2 TanStack Query

- Bekleme, hata ve başarı durumu `useMutation` sonucundan okunur (`isPending`, `error`, `isSuccess`, `reset`, `variables`). Başka bileşende bekleyen mutation `useMutationState` ile okunur.
- İyimser görünüm: tek yerde gösteriliyorsa `variables`. Birden çok görünüm aynı veriyi paylaşıyorsa cache yaklaşımı (`onMutate` snapshot, `onError` geri alma, `onSettled` invalidate).
- Mutation sonrası varsayılan yol `invalidateQueries({ queryKey: orpc.x.key() })`. `setQueryData` yalnız yanıt güncel nesnenin tamamını içeriyorsa kullanılır.
- Olay içi okuma `fetchQuery`, yalnız cache'te yoksa okuma `ensureQueryData` ile yapılır. `staleTime`/`gcTime` tek bir ortak yardımcıda tanımlanır. 5.108'de `queryClient.query()` doğrulanırsa bu madde güncellenir.
- Türetme `select` ile yapılır. Sorgu sonucu `useState`'e kopyalanmaz.

Doğru global örnek: `features/web-macos-client/lib/client-shell.ts` (`MutationCache`).

### 6.3 TanStack Form (1.33.5, güncel)

- Gönderim durumu `useStore(form.store, s => s.isSubmitting | isSubmitSuccessful)` veya `form.Subscribe` ile okunur.
- Form seviyesi hata `formApi.setErrorMap({ onSubmit })` ile yazılır ve `form.Subscribe selector={s => s.errorMap.onSubmit}` ile gösterilir. Sunucu kaynaklı alan hataları `validators.onSubmitAsync` ile `{ form, fields }` olarak döner.
- `onSubmit` içinde `await mutateAsync(...)` çağrılır. `formApi.reset()` yalnız başarıdan sonra çalışır. Mevcut Zod `safeParse` kuralı korunur.
- Dinamik satırlar `mode="array"` (`pushValue`, `removeValue`, `moveValue`) ile yapılır. Birden çok gönderim biçimi `onSubmitMeta` ile ayrılır.

Mevcut durum: tam doğru örnek yok. Baskın kalıp `useForm` kullanıyor ama hata, başarı ve bekleme durumunu hâlâ `useState` ile tutuyor. Kısmi örnekler: `test-report/ui/forms/test-session-record-form.tsx`, `moodboards/ui/forms/moodboard-snapshot-form.tsx`.

### 6.4 TanStack Store (0.11.x)

- Paylaşılan istemci durumu `createStore` ile `store/` altında tutulur ve `useSelector(store, selector)` ile okunur. `useStore` deprecated alias'tır, yerine `useSelector` kullanılır (5 dosya hâlâ `useStore` kullanıyor).
- Bileşen ömrüne bağlı store `useCreateStore` ile, alt ağaca kapsamlı store `createStoreContext` ile oluşturulur. `useState(createX)` ile store saklanmaz. İhlal örnekleri: `bulk-editing/hooks/use-bulk-work-selection.ts`, `roadmap-horizon/store/roadmap-session.tsx`.
- Sunucu verisi Store'a kopyalanmaz.

Doğru örnekler: `personal-shell/store/active-working-set.ts`, `bulk-editing/store/bulk-edit-operation.ts`.

### 6.5 TanStack Router search

- Filtre, sekme, sıralama, seçili kayıt ve panel açıklığı URL search'te tutulur. Route'ta `validateSearch` doğrudan bir Zod 4 şeması alır, değerler `.catch(varsayılan)` ile güvenceye alınır. Okuma `Route.useSearch()` / `getRouteApi().useSearch()`, yazma `navigate({ search: prev => … })` ile yapılır.
- Varsayılan değerler `stripSearchParams`, sayfalar arası korunacak parametreler `retainSearchParams` ile yönetilir.
- Geçici ve paylaşılmayan durum search'e değil Store'a gider.

Örnek: `routes/_auth/daily-focus.tsx` (kısmen; Zod doğrudan şema olarak verilmiyor). `calendar.tsx` hâlâ elle `typeof` kontrolü yapıyor.

### 6.6 Base UI açık/kapalı durumu (1.8.0)

- Önce kontrolsüz API kullanılır: `defaultOpen`/`defaultValue` ve kapatmak için `*Close` parçaları.
- Asenkron işlem başarılı olunca `actionsRef.current?.close()` çağrılır. Hata olursa diyalog açık kalır.
- Satırdan veya menü öğesinden açılan paylaşılan diyalog için `createHandle<Payload>()` kullanılır: `Trigger handle payload` veya `openWithPayload`. Select, Collapsible ve Tabs'ta `createHandle` yok.
- Gerçekten dış durum gereken kontrollü `open` için kaynak:
  - Paylaşılabilir veya geri tuşuyla değişmesi gereken durum: Router search.
  - Geçici ve birden çok bileşenin kullandığı durum: Store.

Mevcut durum: `actionsRef` ve `createHandle` hiç kullanılmıyor. Doğru örnek: `account-access/ui/components/revoke-confirmation.tsx`. İhlal örneği: `work-templates/ui/components/work-duplicate-action.tsx`.

### 6.7 TanStack Pacer (`pacer-lite`)

- Debounce, throttle, rate limit, kuyruk ve toplu işleme için `LiteDebouncer`, `LiteThrottler`, `LiteRateLimiter`, `LiteQueuer`, `LiteBatcher` kullanılır. Elle `setTimeout` debounce'u ve `useEffect` debounce'u yazılmaz.
- Örnek `useMemo` içinde bir kez oluşturulur. Unmount'ta son değer korunacaksa `flush()`, vazgeçilecekse `cancel()` çağrılır.
- Zaman aşımı, saat güncellemesi ve odak için `setTimeout`/`requestAnimationFrame` serbesttir.
- Async, retry veya hook gerekirse lite yetmez. Tam pakete geçmek stack kararıdır.

Örnek: `moodboards/hooks/use-personal-moodboard-view.ts`.

### 6.8 TanStack Table

- Sıralama, filtre, sayfalama, seçim veya sütun görünürlüğü olan liste TanStack Table ile yazılır, markup için `@cantiara/ui` `Table` kullanılır. Sabit satır listesi Table gerektirmez.
- Sıralama ve filtre `getSortedRowModel`/`getFilteredRowModel` ile yapılır, sunucu tarafında `manual*` kullanılır.
- Tablo durumu `useState` ile tutulmaz: tablo içinde kalacaksa `initialState`, paylaşılıyorsa Store (v9'da `atoms`). `record-table.tsx:597-598` bu kuralı ihlal ediyor.
- İnceleme adayları (elle yazılmış tablolar): `data-import/ui/components/import-preview-panel.tsx`, `priority-metrics/ui/components/priority-map.tsx`.

### 6.9 TanStack Virtual

- Sınırsız büyüyebilen kayıt listeleri `useVirtualizer` ile, sayfanın kendisi kayıyorsa `useWindowVirtualizer` ile sanallaştırılır. `getItemKey` kayıt kimliği döner. Değişken yükseklikte `measureElement` + `data-index` kullanılır.
- Küçük sabit listeler sanallaştırılmaz. Resmi doküman sayısal bir eşik vermiyor.

Örnek: `bulk-editing/ui/components/bulk-edit-dialog.tsx`.

### 6.10 dnd-kit (`@dnd-kit/react`)

- Sürükle-bırak yalnız `@dnd-kit/react` ile yapılır. Konva ve React Flow kendi düğüm sürüklemelerini yapar, bu kuralın dışındadır.
- Sıralanabilir liste `useSortable` + `@dnd-kit/helpers` `move()` ile, kolonlar arası taşıma ortak `group` ile yapılır. `onDragEnd` içinde `event.canceled` kontrol edilir.
- `sensors` dizi olarak verilirse `KeyboardSensor` mutlaka eklenir.
- İyimser sıralamada yerel sıra `useState` ile değil, Query cache (`onMutate`) veya Store ile tutulur.

Örnek: `kanban/ui/components/kanban-board.tsx` (yeni API; `useSortable`/`move` yok). Legacy kullanan dosyalar için K6'ya bakın.

---

## 7. PR #540'tan devralınan girdiler (4. aşama için)

- PR #540'ta düzeltilen formlar temel alınır, yeniden taranmaz: `safeParse`, `useForm` dönüşümleri ve API'den türetilen şemalar.
- Code review'da açık kalan bulgular:
  - `fetchQuery({ ...queryOptions(), staleTime: 0 })` 14 yerde tutarsız ayarlarla tekrar ediyor.
  - "İlk hata mesajı, yoksa yedek metin" mantığı yaklaşık 23 kez yazılmış.
  - `FormParse` tipi iki ayrı dosyada tanımlı.
  - build-in-public, wiki ve release-note yayın uçlarının web'de çağıranı yok.
- O PR'da "uyumlu" sayılan `useState` kullanımları (hata ve logo okuma) yeni kurala göre ihlal olarak yeniden işaretlenir.

## 8. Doğrulanamayanlar

- v2 stable tarihi ve stable sonrası v1 destek süresi.
- `@tanstack/react-query` 5.108'de `queryClient.query()` ve deprecation durumu.
- TypeScript 7'nin Vite, Vitest, tsdown ve Router plugin ile uyumu. `composite` projelerde `rootDir` etkisi.
- `undici/index.js` yolunun v8'de varlığı ve undici 8'in Bun üzerinde davranışı.
- Highlight 0.1→1.0 ara değişiklikleri, pacer-lite 0.2.x notları, dnd-kit 0.5.0→0.5.3 farkları.
- Base UI `handle.isOpen` reaktifliği ve `Menu.Item closeOnClick` adı.

## 9. Kaynak araştırmalar

- oRPC v2: Claude Opus 5.5 ve GPT-6.2 Sol, bağımsız.
- Major sürümler: Claude Sonnet 5.5, iki grup.
- Kullanım tabloları: Claude Sonnet 5.5, üç grup.
- Kritik iddialar ayrıca doğrudan kontrol edildi:
  - GHSA-4p2c sürüm aralıkları (GitHub API).
  - `defined: true` sayıları (grep).
  - `apps/web/package.json` içindeki dnd-kit paketleri.
  - `app.ts` plugin import'ları.

---

## 10. Güncel sürümlerin 6. bölüme etkisi

Sürüm kaynağı `bun.lock`, API kanıtı kurulu paketlerin kaynak veya tip tanımları ve aşağıdaki resmî belgelerdir. Bu bölüm 6. bölüm için değişiklik önerir.

| Madde | Kurulu sürüm | Sözleşmeye yansıtılacak ayrım |
| --- | --- | --- |
| 6.1 oRPC | 1.16.3 | v1 yöntemleri geçerli. Tipli iş hatalarında `.errors()` ve `isDefinedError`, sahiplik girdisini uyarlamada v1 `.use(mw, mapInput)`, varsayılanlarda `experimental_defaults`. `scoped`, `adaptInput` ve öneksiz akış API'leri v2’ye ait. [v1 Query entegrasyonu](https://v1.orpc.dev/docs/integrations/tanstack-query), [v1 middleware](https://v1.orpc.dev/docs/middleware), [1.16.3](https://github.com/middleapi/orpc/releases/tag/v1.16.3). |
| 6.2 Query | 5.108.0 | Olay içi okuma `queryClient.query(options)`; yalnız cache'te yoksa okuma eski `ensureQueryData` yolunun yerine `query({...options, staleTime: 'static'})`. Eski `revalidateIfStale` davranışı varsa arka plan yenilemesini ayrıca tasarla. Prefetch için `query` ve eski davranış gerektiriyorsa reddi yutan `.catch`; sonsuz karşılığı `infiniteQuery`. Taze okuma ve bellek süresi ayrı politikalar. [5.108.0](https://github.com/TanStack/query/releases/tag/@tanstack%2Freact-query%405.108.0), [QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient). |
| 6.3 Form | 1.33.5 | Eski `useStore` örneklerini resmî React adaptöründeki `useSelector(form.store, selector)` veya `form.Subscribe` ile güncelle. `setErrorMap`, `mode="array"` ve `await mutateAsync` korunur. [Reactivity](https://tanstack.com/form/latest/docs/framework/react/guides/reactivity), [1.33.5 paket bildirimi](https://registry.npmjs.org/@tanstack/react-form/1.33.5). |
| 6.4 Store | 0.11.2 (Form’un kendi bağımlılığı 0.11.1) | `useStore` eski okuyucu alias’ı; `useSelector` seçici okuma, `useCreateStore` bileşen kapsamı, `createStoreContext` alt ağaç için. Kullanım sayısı yeniden sayılmalı. [React Store kaynak export’ları](https://github.com/TanStack/store/blob/main/packages/react-store/src/index.ts), [0.11.2 paket bildirimi](https://registry.npmjs.org/@tanstack/react-store/0.11.2). |
| 6.5 Router | 1.170.46 | Zod 4 şemasını doğrudan ver, çıkış ve giriş tipinin ayrı varsayılan anlamı önemli olduğunda şema/default tipini doğrula. `useSearch`, işlevsel `navigate({search})` ve search middleware geçerli. [Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params), [1.170.46 paket bildirimi](https://registry.npmjs.org/@tanstack/react-router/1.170.46). |
| 6.6 Base UI | 1.9.0 (taslak 1.8.0) | `Dialog.createHandle`, `openWithPayload`, `actionsRef.close`, `*Close` geçerli. `handle.isOpen` kurulu sürümde imperative getter; UI aboneliği olarak değerlendirme. Açık UI’nin seçili öğeyi bilmesi gerekirse Root’un render prop’u veya belgelenmiş dış sahip kullanılır. [Dialog](https://base-ui.com/react/components/dialog), [1.9.0](https://base-ui.com/react/overview/releases/v1-9-0). |
| 6.7 Pacer Lite | 0.3.0 (Form iç bağımlılığı 0.1.1) | Kurulu LiteDebouncer’da `maybeExecute`, `flush`, `cancel` var. Flush, yalnız kapanışta işin korunması gereken akış için. Arama örneğinde zamanlanan eşzamanlı terim ve asenkron Query işi ayrılabilir. Async Pacer seçimi proje kararı gerektirir. [0.3.0 paket ve kaynak](https://registry.npmjs.org/@tanstack/pacer-lite/0.3.0), [Pacer kapsamı](https://tanstack.com/pacer/latest/docs/overview). |
| 6.8 Table | 9.3.1 (taslak v8 row-model adları kullanıyor) | Yeni React yolu `useTable`, `tableFeatures`, gerek duyulan row model slotlarında `createSortedRowModel()` ve `createFilteredRowModel()`, render için `table.state`/abonelik, dış dilim için `atoms`. v8 bağdaştırıcı paketin geçiş yolu; yeni koda v8 stub önermeyin. Table’ın desteklediği kontrollü API, yerel React state yasağını değiştirmez. [9.3.1](https://github.com/TanStack/table/releases/tag/@tanstack%2Freact-table%409.3.1), [React v9 migration](https://tanstack.com/table/latest/docs/framework/react/guide/migrating). |
| 6.9 Virtual | 3.14.26 | `useVirtualizer`/ `useWindowVirtualizer`, `getItemKey`, ölçülen satırda `measureElement` ve `data-index` devam eder. Gerçekte render edilen pencerenin sınırı değerlendirilir. [Virtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer), [3.14.26 paket bildirimi](https://registry.npmjs.org/@tanstack/react-virtual/3.14.26). |
| 6.10 dnd-kit | 0.5.3 | Yeni API’de `DragDropProvider` ve `useSortable` geçerli. Sensör dizisi varsayılanları değiştirir; özelleştirirken klavye sensörünü koru. Sürükleme iptali kontrolü işlemin yazma ve geri alma semantiğine dahil. 0.5.3 paketinde sensör güncellemesi eşitlik kontrolü kullanıyor. [React değişiklik günlüğü](https://github.com/clauderic/dnd-kit/blob/main/packages/react/CHANGELOG.md), [Sensör rehberi](https://dndkit.com/react/guides/sensors/). |

Ayrıca `undici` 8.12.4 kurulu. Node veya Undici tiplerinde bulunan bir uyarı, aynı isimli Bun yerleşik API’sinin kendiliğinden deprecated olduğu anlamına gelmez. Kullanılan somut adapter ve yayınlanan çalışma zamanı sınırı ayrı incelendi. [Undici Fetch referansı](https://github.com/nodejs/undici/blob/main/docs/docs/api/Fetch.md).

## 11. Spec → gereken teknolojiler → bulgu sayısı

Başlangıç `a548a2c810b0`, temiz çalışma ağacı ve 85 spec. Sayılar Yüksek/Orta/Düşük (Y/O/D) sırasıyla. Doğrulanmış ortak bulgu aynı kimlikle birden çok satıra bağlanabilir. 12. bölümdeki toplam her kimliği bir kez sayar. Kod henüz bağlı değilse teknoloji eşlemesi, spec’in beklediği sınırı gösterir.

| Spec | Davranışın gerektirdiği teknolojiler | Y/O/D | Bulgu kimlikleri |
| --- | --- | ---: | --- |
| [01-account-access](../specs/01-account-access/spec.md) | Better Auth/GitHub login OAuth, Tauri Opener/Deep Link/Stronghold, Hono auth taşıması, oRPC + Query Sessions ve revoke, TanStack Router auth guard, Base UI AlertDialog, TanStack Virtual; sunucuda Drizzle/PostgreSQL, ayrı güvenlik olay deposu ve Evlog; IP/Hesap hız sınırı bağımsız politika kararı. | 0/2/4 | TK-001, TK-103, TK-108, TK-109, TK-110, TK-116 |
| [02-account-preferences](../specs/02-account-preferences/spec.md) | Better Auth oturumu, oRPC + Query, TanStack Form + Zod, date-fns/Intl ve mevcut takvim primitive’leri, Client Shell bağlantı Store’u, ortak görünüm uygulayıcısı, Drizzle/PostgreSQL. | 0/0/4 | TK-111, TK-112, TK-113, TK-376 |
| [03-web-macos-client](../specs/03-web-macos-client/spec.md) | React/TanStack Store ve Query Cache/MutationCache, TanStack Router, oRPC HTTP, Tauri Opener/Deep Link/Single Instance/Stronghold/Process/Updater, GitHub Releases; sunucuda Hono ve support reference sözleşmesi. | 0/3/0 | TK-002, TK-103, TK-105 |
| [04-mutation-and-undo](../specs/04-mutation-and-undo/spec.md) | oRPC, Zod ve Mutation Contract, Drizzle/PostgreSQL işlemleri, gerektiğinde pg-boss; web makbuz ve hata için Query, onay için Form/Base UI. | 0/3/2 | TK-007, TK-014, TK-103, TK-376, TK-377 |
| [05-command-palette](../specs/05-command-palette/spec.md) | shadcn/ui Command + cmdk, Base UI Dialog, TanStack Router navigasyonu, paylaşılan komut oturumu için TanStack Store. Gerçek sunucu araması devreye girerse oRPC/Query ve yüksek sıklık için TanStack Pacer. | 0/0/2 | TK-114, TK-115 |
| [06-capture-triage](../specs/06-capture-triage/spec.md) | oRPC + Query, TanStack Form + Zod, Base UI, TanStack Store ve Virtual, WXT, Drizzle/PostgreSQL ve Mutation Contract; ek/staging için R2 ve Dosya Eki sahipliği. | 0/5/5 | TK-003, TK-004, TK-005, TK-006, TK-007, TK-116, TK-117, TK-118, TK-119, TK-120 |
| [07-project-shell](../specs/07-project-shell/spec.md) | TanStack Router hash/search, oRPC + Query ve Mutation Contract, TanStack Form + Zod, Base UI, React DayPicker, TanStack Store/Virtual, Drizzle/PostgreSQL. | 0/2/7 | TK-008, TK-009, TK-121, TK-122, TK-123, TK-124, TK-125, TK-126, TK-378 |
| [08-project-overview](../specs/08-project-overview/spec.md) | oRPC + Query kaynak okumaları, TanStack Router kaynak bağlantıları, date-fns/Intl biçimleme, TanStack Virtual büyüyen modül satırları. | 0/1/1 | TK-010, TK-127 |
| [09-work-lifecycle](../specs/09-work-lifecycle/spec.md) | oRPC + Query ve Mutation Contract, TanStack Form + Zod, TanStack Router search, Table 9 ve Virtual, Base UI, toplu seçim için TanStack Store, Drizzle/PostgreSQL. | 0/8/6 | TK-007, TK-011, TK-012, TK-013, TK-014, TK-015, TK-016, TK-103, TK-128, TK-129, TK-130, TK-376, TK-377, TK-379 |
| [10-custom-fields](../specs/10-custom-fields/spec.md) | TanStack Form + Zod; React DayPicker + date-fns; Base UI, oRPC + Query/Mutation Contract, Drizzle/PostgreSQL, büyüyen alan listesi için Virtual. | 0/2/4 | TK-016, TK-017, TK-131, TK-132, TK-133, TK-134 |
| [11-work-drafts](../specs/11-work-drafts/spec.md) | TanStack Form + Zod; TanStack Pacer (LiteDebouncer, autosave); oRPC + TanStack Query (yazma useMutation, okuma useQuery); Base UI Popover; Client Shell online-only | 0/2/3 | TK-018, TK-103, TK-135, TK-136, TK-376 |
| [12-relations](../specs/12-relations/spec.md) | oRPC + TanStack Query (preview/create/remove/undo mutation, relations/usedIn query); TanStack Form + Zod (create-relation, resolve-blocker); Base UI açık/kapalı | 0/1/4 | TK-104, TK-137, TK-138, TK-139, TK-376 |
| [13-tags](../specs/13-tags/spec.md) | oRPC + TanStack Query; TanStack Form + Zod (create/apply/rename); TanStack Router search (etiket filtresi); TanStack Virtual (sınırsız etiketli kayıt listesi) | 0/3/4 | TK-019, TK-020, TK-104, TK-140, TK-141, TK-142, TK-376 |
| [14-file-attachments](../specs/14-file-attachments/spec.md) | Uppy Core (R2 upload); Konva/React-Konva (işaretleme); React-PDF/PDF.js; Video.js React; oRPC + TanStack Query; TanStack Form + Zod (upload, location bind); Base UI | 0/2/8 | TK-021, TK-104, TK-143, TK-144, TK-145, TK-146, TK-147, TK-148, TK-149, TK-376 |
| [15-workspace-overview](../specs/15-workspace-overview/spec.md) | TanStack Router (route + seçili modül/liste search); TanStack Query (özet okuma, sunum kaydı); TanStack Table (kayıtlı listeler); TanStack Form + Zod (saved-list editor, live block) | 0/3/3 | TK-022, TK-023, TK-024, TK-150, TK-151, TK-378 |
| [16-work-context](../specs/16-work-context/spec.md) | oRPC + TanStack Query (relations, workContext, layout preview/apply/undo); TanStack Form (layout editor, custom section); Browser Clipboard API (lib/clipboard.ts); Base UI (Accordion/Collapsible) | 0/2/4 | TK-025, TK-026, TK-152, TK-153, TK-154, TK-376 |
| [17-work-templates](../specs/17-work-templates/spec.md) | oRPC + TanStack Query; TanStack Form + Zod (template, instantiate, duplicate); Base UI (duplicate paneli createHandle/Collapsible) | 0/1/5 | TK-104, TK-155, TK-156, TK-157, TK-158, TK-376 |
| [18-work-checklists](../specs/18-work-checklists/spec.md) | oRPC + TanStack Query (update/convert mutation, setQueryData tam WorkProfile ile); TanStack Form (PR #540 formu, yeniden taranmadı) | 0/0/2 | TK-159, TK-376 |
| [19-blockers](../specs/19-blockers/spec.md) | oRPC + TanStack Query (resolve/reactivate mutation, Relations seam); TanStack Form + Zod (resolve-blocker-form); Base UI Collapsible | 0/0/1 | TK-376 |
| [20-priority](../specs/20-priority/spec.md) | oRPC + TanStack Query; TanStack Form + Zod (metric create/edit/trash/permanent delete, session create/add work); Move up/Move down butonları (spec: dnd yok); TanStack Store (geçici eksen seçimi); TanStack Virtual (Backlog sırası); skipToken | 0/2/6 | TK-027, TK-104, TK-160, TK-161, TK-162, TK-163, TK-164, TK-376 |
| [21-record-actions](../specs/21-record-actions/spec.md) | oRPC + TanStack Query, TanStack Form + Zod, Base UI Dialog, Work Lifecycle ve Daily Focus kontratları; atomik/idempotent sunucu yazması (ADR-0004). | 0/1/5 | TK-028, TK-165, TK-166, TK-167, TK-376, TK-377 |
| [22-bulk-editing](../specs/22-bulk-editing/spec.md) | TanStack Store (seçim ve SPA ilerleme), Form + Zod, Base UI Dialog; oRPC + Query ve Work Lifecycle receipts; kayıt seçimi için Table, büyüyen preview/results için Virtual. | 0/2/5 | TK-029, TK-030, TK-168, TK-169, TK-170, TK-171, TK-377 |
| [23-completion-effects](../specs/23-completion-effects/spec.md) | oRPC + TanStack Query Account tercihleri, TanStack Form + Zod, Store ile oturum ve gösterim, matchMedia/animasyon zamanlaması. | 0/0/6 | TK-172, TK-173, TK-174, TK-175, TK-176, TK-376 |
| [24-external-handoffs](../specs/24-external-handoffs/spec.md) | oRPC + TanStack Query, TanStack Form + Zod, Base UI disclosure, Clipboard API (ortak helper), Virtual; Work’a bağlı bileşen (ADR-0015) ve atomik reconcile (ADR-0004). | 0/2/6 | TK-031, TK-032, TK-177, TK-178, TK-179, TK-180, TK-181, TK-376 |
| [25-kanban](../specs/25-kanban/spec.md) | @dnd-kit/react, oRPC + Query / Work Lifecycle, TanStack Table row modeli, TanStack Virtual, Base UI Collapsible ve Account tarih/tz. | 0/2/3 | TK-033, TK-034, TK-182, TK-183, TK-376 |
| [26-backlog](../specs/26-backlog/spec.md) | TanStack Router search sıralama parametreleri, Table row modeli, Virtual, @dnd-kit/react; oRPC + Query ile Project sırası/presentation ve Work tarih yazması, Form + Zod ve Base UI/DayPicker. | 0/3/6 | TK-035, TK-036, TK-037, TK-184, TK-185, TK-186, TK-187, TK-188, TK-376 |
| [27-daily-focus](../specs/27-daily-focus/spec.md) | TanStack Router/Zod day/close search, TanStack Query + oRPC, TanStack Form + Zod, Virtual, Store ve date-fns/tz. | 0/1/4 | TK-038, TK-189, TK-190, TK-191, TK-376 |
| [28-unified-calendar](../specs/28-unified-calendar/spec.md) | TanStack Router/Zod, oRPC + TanStack Query, @dnd-kit/react, Base UI Popover + React DayPicker, date-fns ve büyüyen Agenda/Work listeleri için Virtual. | 0/1/8 | TK-039, TK-192, TK-193, TK-194, TK-195, TK-196, TK-197, TK-376, TK-377 |
| [29-roadmap-horizon](../specs/29-roadmap-horizon/spec.md) | React Flow viewport, Project TanStack Store, Form + Zod, oRPC + Query, Router search, Virtual, Base UI ve yoğun canlı projeksiyonda Pacer. | 0/1/8 | TK-040, TK-198, TK-199, TK-200, TK-201, TK-202, TK-203, TK-204, TK-376 |
| [30-focus-period](../specs/30-focus-period/spec.md) | TanStack Router search, oRPC + TanStack Query, Form + Zod, Table seçim modeli, Virtual ve Base UI; Drizzle/PostgreSQL dönem snapshot sınırı server grubunda. | 0/4/7 | TK-002, TK-041, TK-042, TK-105, TK-205, TK-206, TK-207, TK-208, TK-209, TK-376, TK-377 |
| [31-documents](../specs/31-documents/spec.md) | TanStack Form + Zod; oRPC + TanStack Query; TanStack Store (edit session); Base UI Dialog/Popover/Tabs; TanStack Router (hash seçim, archived filtre); TanStack Pacer (önizleme girdisi); Tiptap/TanStack Markdown, Mermaid, KaTeX, jsdiff | 0/6/8 | TK-043, TK-044, TK-045, TK-046, TK-047, TK-103, TK-210, TK-211, TK-212, TK-213, TK-214, TK-215, TK-376, TK-377 |
| [32-personal-wiki](../specs/32-personal-wiki/spec.md) | 31 Documents yüzeyini (`DocumentsSurface`, projectId=null) yeniden kullanır; Router hash seçimi; Query | 0/1/0 | TK-043 |
| [33-record-discovery](../specs/33-record-discovery/spec.md) | oRPC + Query (searchRecords, tableRecords); TanStack Pacer (arama); TanStack Table v9 + @cantiara/ui Table; Base UI Dialog/Sheet createHandle; Router search filtreleri; TanStack Form (paste/cell) | 0/5/6 | TK-048, TK-049, TK-050, TK-051, TK-103, TK-216, TK-217, TK-218, TK-219, TK-220, TK-254 |
| [34-smart-collections](../specs/34-smart-collections/spec.md) | @dnd-kit/react (useDroppable/DragDropProvider, canceled kontrolü var); TanStack Form + Zod; oRPC + Query; Base UI Tabs | 0/1/6 | TK-045, TK-220, TK-221, TK-222, TK-223, TK-224, TK-378 |
| [35-personal-reminders](../specs/35-personal-reminders/spec.md) | oRPC + Query (personalReminderSignals); paylaşılan PersonalReminderControl (ortak grup); context preview | 0/0/0 | — |
| [36-return-to-work](../specs/36-return-to-work/spec.md) | oRPC + Query (fresh returnToWork); TanStack Form + Zod; TanStack Store (roadmap session); Base UI Dialog; React Flow viewport API | 0/2/5 | TK-103, TK-107, TK-225, TK-226, TK-227, TK-228, TK-254 |
| [37-goals](../specs/37-goals/spec.md) | TanStack Form + Zod; oRPC + Query | 0/1/3 | TK-103, TK-229, TK-230, TK-231 |
| [38-decisions](../specs/38-decisions/spec.md) | TanStack Form + Zod; oRPC + Query; (supersession preview/commit) | 0/3/5 | TK-052, TK-103, TK-107, TK-232, TK-233, TK-234, TK-235, TK-236 |
| [39-favorites](../specs/39-favorites/spec.md) | oRPC + Query (favoritesList, setQueryData tam nesne ile uygun); paylaşılan context preview | 0/0/2 | TK-220, TK-376 |
| [40-risks](../specs/40-risks/spec.md) | TanStack Form + Zod; oRPC + Query (tech-stack’te Source okuma emsali olarak anılan project-risks-surface) | 0/1/3 | TK-103, TK-237, TK-238, TK-239 |
| [41-uncertainty-records](../specs/41-uncertainty-records/spec.md) | Varsayım, Açık Soru, Kanıt bağı. Project Discovery, exact record hash/Router, TanStack Form + Zod, oRPC + Query, TanStack Store ve Virtual. Shared Project source records ile ADR-0004 mutation ve Document pin; ADR-0013 gelecek yönü sınırı. | 0/3/4 | TK-053, TK-060, TK-103, TK-240, TK-241, TK-242, TK-243 |
| [42-validation-records](../specs/42-validation-records/spec.md) | Deney/Doğrulama. Discovery, Router detail ve Status, TanStack Form + Zod, oRPC + Query, Table ve Virtual. Project source records, PostgreSQL/Drizzle ve ADR-0004 ortak mutation sınırı. | 0/2/5 | TK-054, TK-103, TK-244, TK-245, TK-246, TK-247, TK-248 |
| [43-research-sessions](../specs/43-research-sessions/spec.md) | Kullanıcı Araştırması Oturumu, Kanıt bağı. TanStack Form/Zod, Query/oRPC, Base UI, TanStack Store/Virtual, Account Preferences saat dilimi ve ortak exact-record navigasyonu. PostgreSQL/Drizzle ve ADR-0001/0002/0004/0021 sınırları sunucu grubunda. | 0/6/7 | TK-002, TK-055, TK-056, TK-057, TK-103, TK-107, TK-249, TK-250, TK-251, TK-252, TK-253, TK-254, TK-377 |
| [44-sources-and-freshness](../specs/44-sources-and-freshness/spec.md) | Kaynak, Akıllı bağlantı önizlemesi. oRPC/Zod + Query, TanStack Form ve Virtual, Base UI, jsdiff ve Account Preferences. ADR-0008 ayrı egress Bun/Hono, undici, ipaddr.js, htmlparser2 ve Sharp; ADR-0004 Source Check/kanıt yazma sınırı sunucu grubunda. | 0/3/4 | TK-058, TK-059, TK-103, TK-255, TK-256, TK-257, TK-377 |
| [45-evidence](../specs/45-evidence/spec.md) | Kanıt bağı, Kanıt Rolü, Kanıt Akışı. oRPC/Query, Router, Base UI, Table/Virtual. Work, Decision ve Assumption tüketir. Evidence sunucu ve Document pin adaptörü diğer sahiplerde; Feedback niteliği 47. | 0/3/2 | TK-060, TK-103, TK-107, TK-258, TK-259 |
| [46-contact-and-company](../specs/46-contact-and-company/spec.md) | Contact, Company, Kayıt birleştirme, Birleştirmeyi geri alma. oRPC/Query, TanStack Form/Zod, Router record URL, Store, Virtual, ortak Table ve Universal Search. Workspace kimliği, merge ve privacy persistence sunucu grubunda. | 0/2/5 | TK-061, TK-096, TK-260, TK-261, TK-262, TK-376, TK-378 |
| [47-feedback](../specs/47-feedback/spec.md) | Geri Bildirim, Feed, Kanıt niteliği ve Kökeni. TanStack Form/Zod, oRPC/Query, Base UI, Router, Table/Virtual. Feed read-only Projection ve Smart Collection filtre sözlüğü; Work dönüşümü mutation sınırı sunucu grubunda. | 0/3/4 | TK-056, TK-062, TK-103, TK-263, TK-264, TK-265, TK-266 |
| [48-screens-and-wireframes](../specs/48-screens-and-wireframes/spec.md) | Ekran, Wireframe yüzeyi. Sürümlü Zod wireframe modeli, Konva/React-Konva, Rough.js, perfect-freehand, RBush, TanStack Store ve Pacer, oRPC/Query, TanStack Form ve Base UI, Router navigasyon ve Virtual. SVG/PNG/HTML ayrı renderer, PDF Print yolu; ADR-0016 modeli. | 0/4/8 | TK-063, TK-064, TK-065, TK-103, TK-267, TK-268, TK-269, TK-270, TK-271, TK-272, TK-273, TK-274 |
| [49-user-flow](../specs/49-user-flow/spec.md) | Kullanıcı Akışı. React Flow 13 canvasta, durable flow belgesi oRPC/Zod, Query, TanStack Form, Base UI, Router, Pacer viewport ve Store editor session. Outline dinamik liste için Virtual, ADR-0016 Screen kimliğinin tüketicisi. | 0/3/6 | TK-066, TK-067, TK-103, TK-275, TK-276, TK-277, TK-278, TK-279, TK-280 |
| [50-moodboards](../specs/50-moodboards/spec.md) | Moodboard, Dosya Eki, Color Swatch. oRPC/Query, TanStack Form/Zod, Store, Base UI, Pacer, dnd-kit/react ve TanStack Virtual. Tarayıcı görüntü örnekleme; Sharp/Playwright Snapshot sunucu grubunda. ADR-0004 revision/command, ADR-0017 Bitiriş paleti sınırı. | 0/2/8 | TK-068, TK-069, TK-281, TK-282, TK-283, TK-284, TK-285, TK-286, TK-287, TK-376 |
| [51-project-wall](../specs/51-project-wall/spec.md) | React Flow (canvas, kendi düğüm sürüklemesi), oRPC + Query, TanStack Form + Zod, Pacer (LiteDebouncer viewport/klavye), Virtual (Outline >150), Store (paylaşılan seçim), Router search (seçili duvar/sunum) | 0/1/10 | TK-103, TK-288, TK-289, TK-290, TK-291, TK-292, TK-293, TK-294, TK-295, TK-296, TK-376 |
| [52-spec-change-review](../specs/52-spec-change-review/spec.md) | oRPC + Query (skipToken detay okuma), Base UI Dialog, Form, Router search (seçili inceleme), diff (jsdiff; diff-walk.ts saf) | 0/3/5 | TK-070, TK-071, TK-103, TK-297, TK-298, TK-299, TK-300, TK-376 |
| [53-test-plan-and-handoff](../specs/53-test-plan-and-handoff/spec.md) | oRPC + Query, TanStack Form + Zod (array ilişki alanı), Base UI disclosure, clipboard (lib/clipboard) | 0/2/6 | TK-102, TK-103, TK-301, TK-302, TK-303, TK-304, TK-305, TK-306 |
| [54-test-report-acceptance](../specs/54-test-report-acceptance/spec.md) | oRPC + Query, TanStack Form + Zod (manuel kayıt ve dosya içe aktarma) | 0/2/1 | TK-072, TK-103, TK-307 |
| [55-test-gaps](../specs/55-test-gaps/spec.md) | oRPC + Query, TanStack Form + Zod, Base UI disclosure | 0/2/4 | TK-102, TK-103, TK-308, TK-309, TK-310, TK-311 |
| [56-test-assessments](../specs/56-test-assessments/spec.md) | oRPC + Query, TanStack Form + Zod; spec'teki Table katılımı ortak Table yüzeyine ait (bu grupta uygulama yok) | 0/2/1 | TK-102, TK-103, TK-312 |
| [57-test-review-and-follow-up](../specs/57-test-review-and-follow-up/spec.md) | oRPC + Query (queryClient.query olay içi okuma), TanStack Form + Zod, Router search (panel), Base UI Collapsible (summary) | 0/1/5 | TK-103, TK-313, TK-314, TK-315, TK-316, TK-377 |
| [58-product-gaps](../specs/58-product-gaps/spec.md) | oRPC + Query (keepPreviousData filtre listesi), TanStack Form + Zod, Router search (dogfooding filtreleri), Base UI disclosure | 0/1/5 | TK-103, TK-317, TK-318, TK-319, TK-320, TK-321 |
| [59-technical-diagrams](../specs/59-technical-diagrams/spec.md) | React Flow, oRPC + Query, TanStack Form + Zod, Pacer (kişisel viewport kaydı), Store (paylaşılan tablo seçimi), Mermaid (dönüştürme; bu grupta UI yok) | 0/2/4 | TK-073, TK-107, TK-322, TK-323, TK-324, TK-376 |
| [60-schema-artifacts](../specs/60-schema-artifacts/spec.md) | oRPC + Query, TanStack Form + Zod, Router search (seçili sürümler; route zaten diagramId taşıyor), clipboard + SQL indirme | 0/1/5 | TK-107, TK-325, TK-326, TK-327, TK-328, TK-378 |
| [61-github-integration](../specs/61-github-integration/spec.md) | GitHub App ve Octokit (ADR-0006), ADR-0004 inbox + Hono + pg-boss + Drizzle; web oRPC + Query, Form + Zod, Router, Base UI, Virtual. | 0/4/4 | TK-074, TK-075, TK-076, TK-103, TK-329, TK-330, TK-331, TK-377 |
| [62-work-automation](../specs/62-work-automation/spec.md) | oRPC/Zod, Drizzle/PostgreSQL ve Mutation Contract (ADR-0004); tekrar işleri için pg-boss sahipliği; Bitiriş efekti ayrımı ADR-0017. Web kural formu olursa Form + Zod ve oRPC + Query. | 0/0/0 | — |
| [63-release-planning](../specs/63-release-planning/spec.md) | oRPC + Query, TanStack Form + Zod, Base UI, Router ile kayıt açma, TanStack Virtual ve date-fns ile ortak tarih gösterimi; Mutation Contract ve Drizzle sunucuda. | 0/2/3 | TK-077, TK-103, TK-332, TK-333, TK-334 |
| [64-release-evidence](../specs/64-release-evidence/spec.md) | oRPC + Query ve kontrol listesi Form + Zod; kaynaklar Router, büyüyen kanıt listesi Virtual. Sunucu Drizzle ve ADR-0007 güven sınırı. | 0/2/1 | TK-078, TK-103, TK-335 |
| [65-release-communication](../specs/65-release-communication/spec.md) | oRPC + Query, TanStack Form + Zod, Base UI yayın onayı, TanStack Markdown; snapshot/write/idempotency Drizzle ve PRD 14 sınırı. | 0/0/0 | — |
| [66-production-incidents](../specs/66-production-incidents/spec.md) | oRPC + Query (ayrı önizleme ve yazma), TanStack Form + Zod, Base UI, Router, Virtual ve ortak date-fns biçimleme; sunucuda Drizzle ve Mutation Contract. | 0/4/2 | TK-079, TK-080, TK-081, TK-103, TK-336, TK-337 |
| [67-value-chain](../specs/67-value-chain/spec.md) | oRPC + Query salt okunur türetim, Base UI açıklık, Router kaynak navigasyonu, büyüyen kayıt listesi Virtual; Drizzle okumaları sunucuda. | 0/1/1 | TK-082, TK-338 |
| [68-project-history](../specs/68-project-history/spec.md) | oRPC + Query infiniteOptions, Router search, Form + Zod, Base UI, Table ve büyüyen listelerde Virtual; date-fns ve sunucu Drizzle. | 0/1/2 | TK-083, TK-339, TK-340 |
| [69-project-updates](../specs/69-project-updates/spec.md) | oRPC + Query, TanStack Form + Zod, Router, Virtual, date-fns; hatırlatma ve snapshot Drizzle/pg-boss üzerinden sunucuda. | 0/2/2 | TK-084, TK-103, TK-341, TK-342 |
| [70-project-closure-summary](../specs/70-project-closure-summary/spec.md) | oRPC + Query, TanStack Form + Zod, geçici oturum Store, Router kaynak bağlantıları, date-fns; Belgeler Mutation Contract ve Drizzle. | 0/2/4 | TK-085, TK-086, TK-343, TK-344, TK-345, TK-346 |
| [71-attention-signals](../specs/71-attention-signals/spec.md) | oRPC + TanStack Query (useQuery/useMutation/invalidate key()), TanStack Form + Zod (review interval), TanStack Virtual (birikebilen sinyal listesi), native <details> bölüm | 0/2/3 | TK-087, TK-088, TK-347, TK-348, TK-349 |
| [72-personal-shell](../specs/72-personal-shell/spec.md) | TanStack Store (Active Working Set: createStore/useSelector — uyumlu, 6.4 doğru örneği), Base UI Sheet/Tabs, Router (oturumlar arası geri yükleme yasağı nedeniyle search dışlandı) | 0/0/2 | TK-350, TK-351 |
| [73-link-sharing](../specs/73-link-sharing/spec.md) | oRPC + Query (preview query, approve/access yazmaları), TanStack Form + Zod (scope, expiry onSubmitMeta, password), Base UI (onaylar), Router search (seçili kayıt), clipboard (lib/clipboard) | 0/4/5 | TK-002, TK-089, TK-103, TK-105, TK-352, TK-353, TK-354, TK-355, TK-356 |
| [74-wiki-publishing](../specs/74-wiki-publishing/spec.md) | TanStack Form + Zod (publish/indexing — PR540 uyumlu), Base UI Dialog, oRPC + Query (bağlanmamış) | 0/0/1 | TK-357 |
| [75-build-in-public](../specs/75-build-in-public/spec.md) | TanStack Form + Zod (preview/slug/indexing — PR540 uyumlu), Base UI AlertDialog (unpublish onayı), oRPC + Query (bağlanmamış) | 0/2/2 | TK-002, TK-105, TK-358, TK-359 |
| [76-external-surface-management](../specs/76-external-surface-management/spec.md) | oRPC + Query (directory useQuery uyumlu; remove yazması), @cantiara/ui Table (sıralama/filtre yok → TanStack Table gerekmez, uyumlu), Base UI AlertDialog (kaldırma onayı) | 0/1/2 | TK-103, TK-360, TK-361 |
| [77-trash](../specs/77-trash/spec.md) | oRPC + Query (queryClient.query taze önizleme, idempotent yazmalar), TanStack Form + Zod (move/permanent delete), Base UI (inceleme panelleri), TanStack Virtual (aday listesi) | 0/2/3 | TK-103, TK-107, TK-362, TK-363, TK-377 |
| [78-security-redaction](../specs/78-security-redaction/spec.md) | oRPC + Query (preview/apply), oRPC `.errors()`/`isDefinedError`, TanStack Form + Zod (redact formu), Account Access grant (lib) | 0/3/2 | TK-002, TK-103, TK-105, TK-364, TK-365 |
| [79-data-export](../specs/79-data-export/spec.md) | oRPC + Query (catalog/projects useQuery uyumlu; preview/produce), TanStack Form + Zod, TanStack Virtual (10.000 satır önizleme), Base UI Collapsible, TanStack Store (liste→Export handoff), oRPC errors | 0/5/3 | TK-090, TK-091, TK-092, TK-103, TK-105, TK-366, TK-367, TK-368 |
| [80-data-import](../specs/80-data-import/spec.md) | oRPC + Query (preview/apply/receipt), TanStack Form + Zod (dosya formu, excludedRows array), @cantiara/ui Table, Pacer (satır geçişleri) | 0/4/5 | TK-093, TK-094, TK-095, TK-103, TK-369, TK-370, TK-371, TK-372, TK-377 |
| [81-personal-data](../specs/81-personal-data/spec.md) | TanStack Router, @cantiara/ui, TanStack Form 1.33.5 + Zod 4.6.7, oRPC 1.16.3 + TanStack Query 5.108.0, TanStack Store 0.11.2 (geçici Account Access akışı), TanStack Virtual 3.14.26, Hono/oRPC korumalı prosedürler, Neon/Drizzle, Account Access grant’i, Security Redaction/ayrı güvenlik olay günlüğü. | 0/7/1 | TK-002, TK-096, TK-097, TK-098, TK-099, TK-103, TK-105, TK-373 |
| [82-workspace-exit](../specs/82-workspace-exit/spec.md) | ADR-0023/0009, sunucuda node:crypto scryptSync + AES-256-GCM parola zarfı, Zod manifest, kaynak ve şifreli artifact/depolama portları; bağlanacak kullanıcı akışı için TanStack Router, Form + Zod ve oRPC + Query. Export kapsamı, süreli indirme ve kalıcı başarı kaydı ayrı sorumluluklar. | 0/0/0 | — |
| [83-project-retirement](../specs/83-project-retirement/spec.md) | TanStack Router, @cantiara/ui/Base UI 1.9.0, TanStack Store 0.11.2 (geçici satır seçimi), oRPC 1.16.3 + TanStack Query 5.108.0, TanStack Virtual 3.14.26, Zod, Neon/Drizzle ve Mutation Contract; Trash, External Surface ve GitHub adaptörleri. | 0/5/3 | TK-002, TK-100, TK-101, TK-105, TK-107, TK-374, TK-375, TK-376 |
| [84-account-closure](../specs/84-account-closure/spec.md) | Account Access/Better Auth session ve grant sınırı, Zod komut sözleşmesi, Security Redaction/ayrı güvenlik olay günlüğü, Workspace Exit Package portu. Uygulama bağlantısında Neon/Drizzle ve pg-boss dayanıklı işler; kullanıcı yüzeyinde TanStack Router, Form + Zod ve oRPC + Query. ADR-0003/0009/0023. | 0/0/0 | — |
| [85-operator-backup-and-alarms](../specs/85-operator-backup-and-alarms/spec.md) | Neon/PostgreSQL snapshot ve ayrı AB güvenlik olay günlüğü, R2 özgün nesne manifesti, Railway dağıtım/sealed anahtar yönetimi, pg-boss durable job, Better Stack alarm/metrik, node:crypto AES-256-GCM backup zarfı; ADR-0003/0009/0010/0019. | 0/0/0 | — |

## 12. Doğrulanmış ihlaller

**Toplam 399 benzersiz bulgu (Y/O/D: 0/107/292).**

| Kategori | Y/O/D | Toplam |
| --- | ---: | ---: |
| useState | 0/20/262 | 282 |
| eksik-kullanım | 0/68/14 | 82 |
| yanlış-sahip | 0/19/9 | 28 |
| kullanılmayan-bağımlılık | 0/0/7 | 7 |
| deprecated | 0/0/0 | 0 |

### Orta

#### TK-001 · 01-account-access · Kontrolsüz AlertDialog, normal onay düğmesi, actionsRef.close() ve mutation.isPending/error.

- **Kanıt:** `apps/web/src/features/account-access/ui/components/revoke-confirmation.tsx:48`, `<AlertDialogCancel onClick={handleConfirm} variant="destructive">`. **Kural:** 6.6, Base UI 1.9.0 AlertDialog actionsRef.
- **Kullanım ve etki:** Onay AlertDialogCancel üzerinden senkron kapanır. SessionsSection iki işlem için de mutate verir; ağ veya RPC hatasında onay bağlamı ve seçili cihaz kapanmıştır.
- **Beklenen ve önerilen düzeltme:** Kontrolsüz AlertDialog, normal onay düğmesi, actionsRef.close() ve mutation.isPending/error.. Onayı mutateAsync ile bekle, başarılı işlemde kapat ve hata halinde aynı hedefte yeniden denemeyi göster.
- **Diğer konumlar:** `apps/web/src/features/account-access/ui/components/sessions-section.tsx:43`, `apps/web/src/features/account-access/ui/components/sessions-section.tsx:107`.
- **Güven:** yüksek. 6.6 ilk basımı bu dosyayı örnek veriyordu; Trigger ve Cancel hattı doğru, asenkron onay hattı ise aynı maddenin başarıda kapanma şartını karşılamıyor.

#### TK-002 · 03-web-macos-client · Sözleşmede tanımlı hata = istemciye açık hata. Prosedürlerde .errors() ile tanımlanan kodlar (oRPC 1.16 `ORPCError…

- **Kanıt:** `apps/server/src/app.ts:844`, `const response = createSupportFailureResponse({`. **Kural:** 6.1 oRPC: beklenen iş hataları .errors({ CODE: { data, message } }) + istemcide isDefinedError(e); 03 spec 'Every failed main flow that reaches the server shows a clear reason'.
- **Kullanım ve etki:** Her iki handler'da experimental_RethrowHandlerPlugin({ filter: () => true }) (app.ts:631, 636) prosedür hatalarını Hono app.onError'a yeniden fırlatıyor. /rpc yolunda onError createSupportFailureResponse'u yalnız error+status ile çağırıyor; gövdedeki code `options.code ?? preserved?.code ?? "INTERNAL_SERVER_ERROR"`, data `{...preserved?.data, reasonCode, ...}`, message destek metni, defined `preserved?.defined ?? false` oluyor (support-reference.ts:347-362). preservedMutationResponseFrom (support-reference.ts:178-248) yalnız üç şekli koruyor: data.code=CONFLICT+targetId, EXPORT_ERROR_CODES, STALE_BASE_REVISION. support-reference.test.ts:281 'keeps an unknown BAD_REQUEST code out of the Support envelope' bu silmenin bilinçli olduğunu gösteriyor. Sonuç: router'daki 270 `defined: true` hatanın allowlist dışındakileri HTTP durumunu koruyup code=INTERNAL_SERVER_ERROR, data.code yok, message=destek metni olarak istemciye gidiyor.
- **Beklenen ve önerilen düzeltme:** Sözleşmede tanımlı hata = istemciye açık hata. Prosedürlerde .errors() ile tanımlanan kodlar (oRPC 1.16 `ORPCError.defined` bayrağı .errors() eşleşmesinden gelir) zarfta code, data ve message ile korunur; allowlist elle şekil eşleştirme yerine `error instanceof ORPCError && error.defined` (v2'de .errors() eşleşmesi) üzerinden türetilir. Tanımsız hatalar bugünkü gibi silinir.. 1) SERVER-2 kapsamında kodları .errors() ile tanımla. 2) support-reference.ts preservedMutationResponseFrom'a 'defined ORPCError → {code, data, message}' dalı ekle (data yalnız .errors() data şemasından geçen alanlar; cause ve stack asla). 3) app.ts onError'da code/data/defined/message'ı bu tek yardımcıdan geçir. 4) app.test.ts'e security-redaction NAME_MISMATCH ve personal-data refusal için /rpc üzerinden zarf testi ekle (03 spec Testing Decisions seam'i).
- **Etkilenen spec’ler:** 03-web-macos-client, 30-focus-period, 43-research-sessions, 73-link-sharing, 75-build-in-public, 78-security-redaction, 81-personal-data, 83-project-retirement.
- **Diğer konumlar:** `apps/server/src/app.ts:631`, `apps/server/src/app.ts:636`, `apps/server/src/app.ts:825`, `apps/server/src/features/web-macos-client/server/support-reference.ts:178`, `apps/server/src/features/web-macos-client/server/support-reference.ts:347`, `apps/server/src/features/web-macos-client/server/tests/support-reference.test.ts:281`, `packages/api/src/routers/index.ts:4936`, `packages/api/src/routers/index.ts:989`, `packages/api/src/routers/index.ts:1169`, `packages/api/src/routers/index.ts:1387`, `packages/api/src/personal-data-rights-handlers.ts:52`, `packages/api/src/project-retirement-handlers.ts:52`, `packages/api/src/link-sharing.ts:552`, `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:27`, `apps/web/src/features/personal-data-rights/lib/personal-data-refusal.ts:17`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:112`, `apps/web/src/features/research-sessions/ui/forms/research-session-form.tsx:107`.
- **Güven:** orta. Statik iz; backend çalıştırılmadı. Sunucu tarafı silme test ile kanıtlı (yüksek güven); istemci etkisi tüketici kodundan çıkarıldı: use-security-redaction-flow.ts:27-35 data.code okur → UNKNOWN; personal-data-refusal.ts:17 → genel 'could not be completed. Try again.'; focus-periods-view.tsx:109-117 code==='CONFLICT' && mesaj eşleşmesi → hiç eşleşmez; research-session-form.tsx:104-107 cause.code==='CONFLICT' → code INTERNAL_SERVER_ERROR olduğu için eşleşmez (rethrowResearchSessionError CONFLICT'i targetId'siz atıyor). Allowlist'in güvenlik amacı (özel içerik sızdırmama) korunmalı; düzeltme yalnız sözleşmede tanımlı, sabit metinli hataları açar. Yanlış pozitif riski: e2e ortamı farklı bir zarf kullanıyorsa etki daha dar olabilir.

#### TK-003 · 06-capture-triage · @tanstack/pacer-lite 0.3.0 LiteDebouncer.maybeExecute/cancel ile normalize edilmiş arama girdisi. TanStack Query 5…

- **Kanıt:** `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:83`, `listWebCaptureTargets(link.token, targetSearch)`. **Kural:** docs/tech-stack.md TanStack Pacer; denetim 6.7; spec 06 aranabilir Target Inbox.
- **Kullanım ve etki:** Search Inbox her değişimde yeni GET başlatıyor. Effect temizliği yalnız eski yanıtın ekrana yazılmasını engelliyor. İstek iptal edilmiyor. Link nesnesi son kayıt zamanı değişince aynı arama da yeniden yapılıyor.
- **Beklenen ve önerilen düzeltme:** @tanstack/pacer-lite 0.3.0 LiteDebouncer.maybeExecute/cancel ile normalize edilmiş arama girdisi. TanStack Query 5.108.0 useQuery ile bağlantı kimliği ve terime bağlı, AbortSignal tüketen GET.. Yazı alanı anında güncellensin. Pacer yalnız sorgu terimini güncellesin, popup kapanışında bekleyen işi iptal etsin. Query fonksiyonunun signal değerini WXT HTTP adaptörüne geçir ve bağlantı değişince eski sorguyu temizle.
- **Diğer konumlar:** `apps/extension/src/features/capture-triage/ui/forms/web-capture-send-form.tsx:95`, `apps/extension/src/features/capture-triage/lib/web-capture.ts:159`, `apps/extension/src/features/capture-triage/lib/web-capture.ts:104`.
- **Güven:** yüksek. Pacer’ın zamanladığı iş eşzamanlı terim güncellemesi. HTTP işi Query yaşam döngüsüne ait. Kurulu API kanıtı apps/web/node_modules/@tanstack/pacer-lite/dist/lite-debouncer.d.ts ve bun.lock:986.

#### TK-004 · 06-capture-triage · TanStack Virtual. Inbox için grup başlığı ve kartları içeren useWindowVirtualizer, Bulk için kaydırma düzenine uyg…

- **Kanıt:** `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:227`, `group.items.map((item) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Inbox query bütün geçerli Yakalama öğelerini döndürüyor ve otomatik sona erme yok. Her öğe detay, komut satırı ve hook montajı yapıyor. Bulk görünümü de tüm sütun ve kartları bağlıyor.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual. Inbox için grup başlığı ve kartları içeren useWindowVirtualizer, Bulk için kaydırma düzenine uygun useVirtualizer.. Ölçülen görünür kartları öğe kimliğiyle render et. Gruplama ve sıra bilgisi modelde kalır, tek kartlık Sequential triage aynı kalır.
- **Diğer konumlar:** `apps/web/src/features/capture-triage/ui/components/bulk-sense-making.tsx:215`, `apps/server/src/features/capture-triage/server/capture-inbox-database.ts:747`.
- **Güven:** yüksek. Bulk yerleştirme native seçim ve ok düğmeleridir. Uygulamada sürükleme tespit edilmedi.

#### TK-005 · 06-capture-triage · React state → oRPC / Query

- **Kanıt:** `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:43`, `const [targets, setTargets] = useState<WebCaptureTarget[]>([]);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 5 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Aranabilir yetkili Inbox listesi sunucu verisi. Effect/setTargets ve eski listeyi koruma mekanizmasının yerine sorgu sonucu ile fetching durumunu kullan. WXT HTTP adaptörünü koru.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. TanStack Query useQuery({queryKey, queryFn, enabled}); queryFn signal; Undo önizlemesi için useMutation veya olay içi Query sorgusu; mergeId için variables, sonuç için data, iptal veya başarıda reset. Satırdan sayfa paneline giden seçimi koru.; generatePairingCode.data ve reset. Tek kullanımlık kod için kalıcı cache, dehydrate veya log kullanmadan ekran ömründe göster.; oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-006 · 06-capture-triage · Kesinleşmiş sonuç için doğrulanmış HTTP makbuzu, yerel Last successful save bilgisi için WXT storage. Form/Query g…

- **Kanıt:** `apps/extension/src/features/capture-triage/lib/web-capture.ts:197`, `const stored = await getStoredWebCaptureLink();`. **Kural:** Spec 06 idempotent Web Yakalama gönderimi ve ADR-0004 kesinleştirme makbuzu.
- **Kullanım ve etki:** Sunucu yanıtı sent:true olarak doğrulanıyor. Sonraki browser.storage.local okuma/yazma başarısız olursa adaptör başarılı sonucu döndürmüyor ve popup Capture could not be sent. No local queue was created. gösteriyor.
- **Beklenen ve önerilen düzeltme:** Kesinleşmiş sonuç için doğrulanmış HTTP makbuzu, yerel Last successful save bilgisi için WXT storage. Form/Query gönderim sonucu HTTP makbuzunu izlemeli.. Makbuz alındığında gönderimi başarıyla tamamla. Yerel kayıt zamanı güncellemesini kendi hata yolu olan ikincil işlem olarak ele al ve yalnız aynı Uzantı bağlantısına uygula.
- **Diğer konumlar:** `apps/extension/src/features/capture-triage/lib/web-capture.ts:179`, `apps/extension/src/features/capture-triage/lib/web-capture.ts:203`, `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:173`.
- **Güven:** yüksek.

#### TK-007 · 06-capture-triage · Form onSubmitMeta ile Save/Create Bug komutu; ortak Zod doğrulaması, form.isSubmitting ve query mutation sonucu.

- **Kanıt:** `apps/web/src/features/capture-triage/ui/forms/capture-inbox-form.tsx:165`, `function handleCreateBug() {`. **Kural:** 6.3, TanStack Form 1.33.5 onSubmitMeta ve await mutateAsync.
- **Kullanım ve etki:** Save form.handleSubmit yolundayken Create Bug aynı alanları ayrı onClick işleyicisinden okuyup doğruluyor ve gönderiyor. Formun gönderim yaşam döngüsü ikinci yola uygulanmıyor.
- **Beklenen ve önerilen düzeltme:** Form onSubmitMeta ile Save/Create Bug komutu; ortak Zod doğrulaması, form.isSubmitting ve query mutation sonucu.. İkinci gönderme düğmesini form.handleSubmit(meta) üzerinden geçir ve değişen taslağı koruyan reset koşulunu ortak onSubmit içinde tut.
- **Etkilenen spec’ler:** 06-capture-triage, 04-mutation-and-undo, 09-work-lifecycle.
- **Güven:** yüksek. Mevcut shell.runWrite ile son kayıt ve çevrimdışı davranışı korunur.

#### TK-008 · 07-project-shell · useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index

- **Kanıt:** `apps/web/src/features/project-shell/ui/views/projects-view.tsx:65`, `data.map((project) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Workspace Project sorgusu bütün kayıtları döndürür ve her Project satırı Short code form/observer örneği de kurar.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index. Project kimliğine göre görünür satırları ölç. Satır düzenleme sırasında form odağını ve taslağı koruyacak aralık yönetimi ekle.
- **Diğer konumlar:** `apps/web/src/features/project-shell/ui/components/project-row.tsx:34`, `apps/server/src/features/project-shell/server/project-shell-database.ts:166`.
- **Güven:** yüksek.

#### TK-009 · 07-project-shell · Form async onSubmit ile Project configuration mutation.mutateAsync, formApi.reset başarıdan sonra.

- **Kanıt:** `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:584`, `formApi.reset();`. **Kural:** 6.3, TanStack Form onSubmit + Query mutateAsync; reset başarıdan sonra..
- **Kullanım ve etki:** Add stage için Zod başarısından hemen sonra reset yapılır. submitConfigurationChange true döndürmeden önce yalnız onChange çağırır; üst callback mutation.mutate ile döner. Ağ hatasında girilen ad silinmiş olur.
- **Beklenen ve önerilen düzeltme:** Form async onSubmit ile Project configuration mutation.mutateAsync, formApi.reset başarıdan sonra.. Gönderim callback sözleşmesini Promise yap, ekleme sonucunu await et ve sunucu reddinde stage adını formda bırak.
- **Diğer konumlar:** `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:42`, `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:101`.
- **Güven:** yüksek.

#### TK-010 · 08-project-overview · useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index

- **Kanıt:** `apps/web/src/features/project-overview/ui/components/project-overview-sections.tsx:157`, `records.map((record) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Özet, Query ile gelen tüm Goals, Milestones ve Risks kayıtlarını liste satırı yapıyor. Üç kaynak RPC adaptöründe sonuç sınırı yok; modül sayısının sabit oluşu kayıt sayısını sınırlamıyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index. Sabit modül başlıkları, tam sayım ve drill-down korunurken kaynak satırlarını pencerele. Hesap görünümünde kaydırılan kapsayıcı varsa useVirtualizer kullan.
- **Diğer konumlar:** `apps/web/src/features/project-overview/ui/components/project-overview-surface.tsx:19`, `apps/server/src/features/project-goals/server/project-goals-database.ts:219`, `apps/server/src/features/project-source-records/server/project-source-records-database.ts:1362`, `apps/server/src/features/roadmap-horizon/server/roadmap-horizon-database.ts:538`.
- **Güven:** yüksek.

#### TK-011 · 09-work-lifecycle · useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:289`, `query.data.map((work) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** projectWorks bütün aktif veya arşivlenmiş Work kayıtlarını döndürüyor. Her kayıt seçim, favori, iş eylemleri ve form alt ağaçlarıyla render ediliyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index. Work id ve scrollToIndex ile hash bağlantısını koru. Değişken satırları ölç ve editör/klavye odağını sanal aralıkla koordine et.
- **Diğer konumlar:** `apps/server/src/features/work-lifecycle/server/work-lifecycle-database.ts:1544`.
- **Güven:** yüksek.

#### TK-012 · 09-work-lifecycle · useTable, tableFeatures({ rowSelectionFeature }), getRowId, manualFiltering ve kontrol edilen rowSelection.

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:297`, `<WorkSelectionCheckbox`. **Kural:** 6.8, TanStack Table 9.3.1 — https://tanstack.com/table/latest/docs/framework/react/guide/migrating.
- **Kullanım ve etki:** İş listesi Archived sorgu filtresini ve Work satır seçimini yönetiyor; seçim ayrı Store, görünür kayıt seçimi ve toplu eylem girdisi elle eşleştiriliyor.
- **Beklenen ve önerilen düzeltme:** useTable, tableFeatures({ rowSelectionFeature }), getRowId, manualFiltering ve kontrol edilen rowSelection.. Satır seçimini TanStack Table row modeline bağla. Bulk Editing ile paylaşılan seçimin tek sahibi Store olarak kalabilir. Sunucu Archived filtresini Router search ile Query girdisine bağla.
- **Diğer konumlar:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:105`, `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:458`.
- **Güven:** yüksek. Work satır seçimi, statik Select seçeneklerini seçmekten farklı bir kayıt işlemi. Bu bulgu Virtual montaj sorunundan ayrı.

#### TK-013 · 09-work-lifecycle · TanStack Virtual useWindowVirtualizer; görünür hiyerarşi satırlarını düz görünüm modeline aç, kayıt kimliği ve der…

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/scope-tree.tsx:38`, `scopeTree.features.map((feature) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Scope Tree bütün Feature ve Included Work kayıtlarını ağaç halinde render ediyor. Server, project Work listesini archived: all ile okur ve bütün Feature düğümlerini döndürür.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer; görünür hiyerarşi satırlarını düz görünüm modeline aç, kayıt kimliği ve derinlik koru.. Odağı, hiyerarşi etiketini, Open source record ve liste gezintisini koruyarak Feature ve dahil Work satırlarını pencerele.
- **Diğer konumlar:** `apps/web/src/features/work-lifecycle/ui/components/scope-tree.tsx:92`, `apps/server/src/features/work-lifecycle/server/work-lifecycle.ts:1787`.
- **Güven:** yüksek. Dört draggable adayı draggable={false}; tasarımın salt okunur şartını uygular, dnd-kit gerektirmez.

#### TK-014 · 09-work-lifecycle · queryClient.invalidateQueries({ queryKey: orpc.scopeTree.queryKey({ input: { projectId } }) })

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:115`, `await Promise.all([`. **Kural:** 6.2, Query prosedür anahtarını kullanarak değişen tüketicileri invalidate et..
- **Kullanım ve etki:** Merge yaşayan duplicate Work kaydını kaldırabilir ve Feature inclusion değişebilir. Merge ve Undo mutation sonrası projectWorks anahtarlarını yeniler; açık Project Shell içindeki ayrı scopeTree sorgusu eskimiş döner.
- **Beklenen ve önerilen düzeltme:** queryClient.invalidateQueries({ queryKey: orpc.scopeTree.queryKey({ input: { projectId } }) }). Merge ve Undo başarı yollarına proje bazında scopeTree invalidate ekle; Archive/Type Change mevcut örnektir.
- **Etkilenen spec’ler:** 09-work-lifecycle, 04-mutation-and-undo.
- **Diğer konumlar:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:193`, `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:606`, `apps/web/src/features/project-shell/hooks/use-project-shell-data.ts:12`, `apps/server/src/features/work-lifecycle/server/work-lifecycle-database.ts:944`.
- **Güven:** yüksek.

#### TK-015 · 09-work-lifecycle · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:101`, `useState<WorkMergeResult | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 8 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Merge mutation.data veya üstte useMutationState ile son başarı makbuzu; çalıştırılan Undo'nun kimliği variables, makbuzun tüketimi reset.; undoMerge.error ve reset; değişen merge kimliği eski hatayı taşımaz.; Archive/unarchive mutation.error içinden kullanıcıya dönük mesajı türet.; previewTypeChange.data; requiresImpactPreview, geçerli seçim ve başarılı update koşuluna göre göster, iptal veya apply'da reset.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-016 · 10-custom-fields · TanStack Virtual, yüzeyin kaydırma sahibine uygun useVirtualizer veya useWindowVirtualizer.

- **Kanıt:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:424`, `items.map((item) => {`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Proje bazlı özel alan tanımı adedi sunucu listesinde sınırlı değil. Her bağlı alan kendi girdi kontrolleriyle render ediliyor; Work listesinde bu alt ağaç Work satırı başına oluşuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual, yüzeyin kaydırma sahibine uygun useVirtualizer veya useWindowVirtualizer.. Work satırı sanallaştırmasıyla birlikte ölç. Büyük tanım seti için tek kayıt editöründe de görünür alan aralığını yönet ve düzenlenen alanın odak/taslağını koru.
- **Etkilenen spec’ler:** 10-custom-fields, 09-work-lifecycle.
- **Diğer konumlar:** `apps/server/src/features/custom-fields/server/custom-fields-database.ts:252`.
- **Güven:** yüksek. Bir Single select/Multi select alanının seçenek dizisi Zod ile 100 değerle sınırlanır. Bulgu alan tanımı adedi içindir.

#### TK-017 · 10-custom-fields · TanStack Form alan değeri, dirty ve hata meta; Zod Custom Field payload; mevcut TanStack Query set/clear mutation.

- **Kanıt:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:153`, `onBlur={() => {`. **Kural:** 6.3, TanStack Form ve Zod. 10-custom-fields › Values storage..
- **Kullanım ve etki:** Text ve Number alanlarının yazı taslağı manuel state ve blur callback ile yönetiliyor. Number boş veya sonlu olmayan girdiyi null olarak değer silme yoluna gönderir; doğrulama hatası ve açık temizleme aynı yola düşer. Değişmemiş değer blur olduğunda da mutate çağrılabilir.
- **Beklenen ve önerilen düzeltme:** TanStack Form alan değeri, dirty ve hata meta; Zod Custom Field payload; mevcut TanStack Query set/clear mutation.. Blur kaydında değişimi ve geçerliliği kontrol et. Yalnız açıkça boşaltılan alanı clearValue yoluna gönder. Hatalı veya reddedilen taslağı girdi üzerinde tut.
- **Diğer konumlar:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:120`, `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:362`.
- **Güven:** yüksek. Browser Input ayrıntıları çalışma zamanında denenmedi. Kod, boş/sonlu olmayan değeri açıkça tek null dalına indiriyor.

#### TK-018 · 11-work-drafts · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:549`, `const [actionMessage, setActionMessage] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. spec-2-1: MutationCache dışı yazma
- **Beklenen ve önerilen düzeltme:** oRPC / Query. saveDraft/deleteDraft mutation isSuccess + variables; finalizeMutation.data?.key; saveDraft/finalize/delete .error; doğrulama için setErrorMap; finalizeMutation.isPending
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-019 · 13-tags · TanStack Table 9.3.1, sunucu filtreli kayıt modeli

- **Kanıt:** `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:84`, `const { recordsQuery, tagsQuery } = useTags(`. **Kural:** §6.8: kayıt filtresi olan liste için TanStack Table, sunucu filtresinde manualFiltering.
- **Kullanım ve etki:** Filter by tag, Query ile Project Work kayıt kümesini değiştirir ve TagRecordList sonucu doğrudan map eder; bu kontrol yalnız bir Tag seçmek için yerel form girdisi değildir.
- **Beklenen ve önerilen düzeltme:** TanStack Table 9.3.1, sunucu filtreli kayıt modeli. Tag kimliğine göre oRPC filtresini koru ve sonucu Table’ın sunucu filtreli Work satır modeline bağla.
- **Diğer konumlar:** `apps/web/src/features/tags/hooks/use-tags.ts:7`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:235`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:389`.
- **Güven:** yüksek.

#### TK-020 · 13-tags · TanStack Virtual: sayfa kayıyorsa useWindowVirtualizer({ count, estimateSize, getItemKey: i => records[i].record.i…

- **Kanıt:** `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:388`, `<ul aria-label="Tagged Work records" className="space-y-3">`. **Kural:** Karar tablosu: sınırsız birikebilen liste → TanStack Virtual; 6.9 useVirtualizer/useWindowVirtualizer + getItemKey.
- **Kullanım ve etki:** Etiket filtresi yokken Projedeki bütün erişilebilir Work kayıtları, her satırda TagApplyForm ile tek seferde render ediliyor; sayfalama/sanallaştırma yok.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual: sayfa kayıyorsa useWindowVirtualizer({ count, estimateSize, getItemKey: i => records[i].record.id }) + measureElement/data-index (değişken yükseklik).. Kayıt listesini sanallaştır; satır içi formlar yalnız görünür satırlarda mount olur.
- **Güven:** orta. Liste Proje Work sayısıyla büyüyor (tagRecords filtre olmadan bütün kayıtları döndürüyor; sunucu tarafı limit doğrulanamadı → 19. bölüm). Örnek: bulk-editing/ui/components/bulk-edit-dialog.tsx.

#### TK-021 · 14-file-attachments · query: useQuery({ queryKey: ['file-attachment-asset', path], queryFn: ({ signal }) => fetchFileAttachmentAsset(pat…

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:519`, `useEffect(() => {`. **Kural:** 6.1 Okuma: useQuery(...) — useEffect + setState yerine; 6.2 Sorgu sonucu useState'e kopyalanmaz.
- **Kullanım ve etki:** Ürün asset (blob) okuması useEffect + useState({status,url}) ile; yeniden deneme retry query parametresi ve assetRetryToken useState ile.
- **Beklenen ve önerilen düzeltme:** query: useQuery({ queryKey: ['file-attachment-asset', path], queryFn: ({ signal }) => fetchFileAttachmentAsset(path, signal), enabled: Boolean(path) }); retry için refetch(); object URL yaşam döngüsü useMemo/useEffect cleanup ile blob'dan türetilir.. useFileAttachmentAsset'i useQuery'ye çevir; status→query.status, retry→query.refetch(); assetRetryToken ve state useState'lerini kaldır; createObjectURL/revoke'u data'ya bağlı effect'te tut.
- **Diğer konumlar:** `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:514`, `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:577`.
- **Güven:** yüksek. Ham fetch değil: fetchFileAttachmentAsset Client Shell request + origin/path guard'ından geçiyor (binary asset için oRPC dışı yol meşru). Bulgu yalnız okuma durumunun sahibi. Panel kapatılınca previewQuery verisi korunduğu için yeniden indirme etkisi gözlenmedi; etki tutarlılık.

#### TK-022 · 15-workspace-overview · Table 9.3.1: columnGroupingFeature + createGroupedRowModel (state.grouping=[groupBy]); sunucu sıralaması korunur (…

- **Kanıt:** `apps/web/src/features/workspace-overview/ui/components/saved-project-lists.tsx:137`, `return projects`. **Kural:** 6.8 TanStack Table: sıralama/gruplama row model ile; spec 15 Stack: TanStack Table for saved lists.
- **Kullanım ve etki:** useTable (v9, columnVisibilityFeature) kullanılıyor ama groupBy elle .sort + previousGroups Set ile grup başlığı satırları üretiliyor.
- **Beklenen ve önerilen düzeltme:** Table 9.3.1: columnGroupingFeature + createGroupedRowModel (state.grouping=[groupBy]); sunucu sıralaması korunur (sort zaten API'de sortSavedListProjects).. tableFeatures({ columnVisibilityFeature, columnGroupingFeature }) ve grouped row model ile grupları Table'dan üret; elle sort/Set mantığını kaldır.
- **Güven:** orta. Kurulu table-core 9.3.1 dist'inde columnGroupingFeature ve createGroupedRowModel export'ları doğrulandı. Grup başlığı sunumu grouped row'la birebir aynı olmayabilir; sunum farkı kabul edilebilirliği kullanıcı kararı olabilir.

#### TK-023 · 15-workspace-overview · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:338`, `const [selectedSources, setSelectedSources] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Modelden başlıyor fakat lokalde düzenlenen seçim; hesaplanan değer tek başına değişikliği korumaz. Query optimizmi veya Form taslağı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables.; workspaceOverview sorgu verisi + saveWorkspaceOverview onMutate/onError (iyimser); aynı; aynı (şu an elle geri alma var)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-024 · 15-workspace-overview · query: görünüm doğrudan workspaceOverview sorgu verisini okur; saveWorkspaceOverview mutation'ına onMutate (cancel…

- **Kanıt:** `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:478`, `const [layout, setLayout] = useState<WorkspaceOverviewLayout>(() =>`. **Kural:** 6.2 Sorgu sonucu useState'e kopyalanmaz; birden çok görünüm paylaşıyorsa onMutate snapshot / onError geri alma / onSettled invalidate.
- **Kullanım ve etki:** layout, liveBlockSources, savedLists (ve LiveBlocks içindeki selectedSources) sorgu modelinin useState kopyası; değişiklik yerelde uygulanıp onPresentationChange (projects-view saveWorkspaceOverview mutateAsync) çağrılıyor. layout ve liveBlockSources için hata durumunda geri alma yok (settle hatayı yutuyor); yalnız savedLists elle geri alınıyor. useState başlatıcısı sonraki sorgu verisini izlemiyor.
- **Beklenen ve önerilen düzeltme:** query: görünüm doğrudan workspaceOverview sorgu verisini okur; saveWorkspaceOverview mutation'ına onMutate (cancelQueries + setQueryData snapshot), onError (snapshot geri yükle), onSettled (invalidate) eklenir.. Üç yerel kopyayı ve selectedSources'ı kaldır; iyimser güncellemeyi project-shell/ui/views/projects-view.tsx içindeki mutation'a taşı; view model + mutation.variables'tan okur.
- **Diğer konumlar:** `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:481`, `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:484`, `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:338`, `apps/web/src/features/project-shell/ui/views/projects-view.tsx:95`.
- **Güven:** yüksek. Somut etki: layout veya live block kaydı başarısız olunca ekranda kaydedilmemiş düzen kalır, sunucu durumuyla ayrışır (projects-view yalnız genel hata metni gösterir). Mutation dosyası project-shell grubuna ait; düzeltme orada yapılır, bulgu kaydı burada.

#### TK-025 · 16-work-context · form: useForm({ defaultValues: { workType, layout } }); sectionOrder için form.Field mode="array" + moveValue; hid…

- **Kanıt:** `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:40`, `const [draft, setDraft] = useState<WorkContextLayout>(() =>`. **Kural:** tech-stack TanStack Form satırı: gönderilen her form useForm ile yazılır, form state'i ham useState ile tutulmaz (muafiyetsiz); 6.3 dinamik satırlar mode="array" (moveValue).
- **Kullanım ve etki:** Work Context Card layout editörü (göster/gizle, Move up/down, Preview, Apply ile updateProjectConfiguration'a gönderim) workType ve draft'ı useState'te tutuyor; useForm yok; prop değişince useEffect ile draft sıfırlanıyor.
- **Beklenen ve önerilen düzeltme:** form: useForm({ defaultValues: { workType, layout } }); sectionOrder için form.Field mode="array" + moveValue; hiddenSections checkbox alanı; Preview/Apply ayrımı onSubmitMeta; isDirty → form.state.isDirty.. Editörü TanStack Form'a taşı; preview/apply/undo mevcut mutation'larla kalır, sonuçları mutation.data/error'dan oku.
- **Güven:** yüksek. PR #540 dosya listesinde yok; yeniden tarama kısıtı uygulanmaz.

#### TK-026 · 16-work-context · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:43`, `const [currentRevision, setCurrentRevision] = useState(baseRevision);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Otoriter configuration veya başarılı makbuz revision’ı; eski prop’a dönüş stale yazma üretebilir.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables.; applyMutation.data.receiptId; undo/değişiklikte applyMutation.reset(); previewMutation.data; preview/apply/undo .error; custom section doğrulaması için form setErrorMap
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-027 · 20-priority · TanStack Virtual useWindowVirtualizer + getItemKey(work.id); sıra işlemleri mevcut Move up/Move down butonlarıyla …

- **Kanıt:** `apps/web/src/features/prioritization-sessions/ui/components/prioritization-surface.tsx:212`, `<ol aria-label="Backlog order" className="space-y-2">`. **Kural:** Karar tablosu: sınırsız birikebilen liste → TanStack Virtual (6.9).
- **Kullanım ve etki:** Backlog sırası Projedeki bütün aktif Work'ü (her satırda WorkReviewLaterControl, WorkNotNowControl, metrik listesi, Move up/down) sanallaştırmadan render ediyor.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer + getItemKey(work.id); sıra işlemleri mevcut Move up/Move down butonlarıyla kalır (spec dnd istemiyor).. Backlog order listesini sanallaştır; satır başı priorityValues.values.find yerine Map ile türet.
- **Güven:** orta. Spec 20: Backlog Proje kapsamlı kalıcı sıra, yeni aktif Work sona eklenir → sınırsız büyür. Session order listesi seçili kapsamla sınırlı, aday değil.

#### TK-028 · 21-record-actions · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:70`, `const [preview, setPreview] = useState<RecordActionPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sunucudan gelen diff UI ve apply komutuna kopyalanıyor; Change inputs, Close ve yeni run’da mutation sıfırlanmalı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewMutation.data/reset; applyMutation.data; Birleşik Undo useMutation.isPending; undoMutation.data/reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-029 · 22-bulk-editing · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:701`, `const [preview, setPreview] = useState<BulkEditPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Birleşik oRPC önizlemesi; onaydan sonra seçili Work/revizyon çıktısı mevcut operasyon store’una dondurulur.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. useMutation({ mutationFn: buildBulkEditPreview }).data/reset; previewMutation.error + buildSupportReferenceFailure; previewMutation.isPending
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-030 · 22-bulk-editing · TanStack Query 5.108 queryClient.query ve bileşik useMutation; orpc.workClosePreview.queryOptions

- **Kanıt:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:280`, `await client.workClosePreview({ workId: work.id }),`. **Kural:** §6.1–6.2, React kullanıcı olayı içinden sunucu okuması.
- **Kullanım ve etki:** Preview düğmesi closure preview okumalarını Promise.all ile ham client.workClosePreview üzerinden başlatıp sonucu yerel preview/pending/error alanlarına koyuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Query 5.108 queryClient.query ve bileşik useMutation; orpc.workClosePreview.queryOptions. Güncel kapanış kontrolü garantisini koruyarak typed query seçenekleriyle her Work önizlemesini oku. Preview değişken ve durumlarını birleşik mutation’dan al, onaylı operasyonu mevcut Store’a geçir.
- **Diğer konumlar:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:757`, `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:771`.
- **Güven:** yüksek. Apply/Undo işçisi React dışında Store üzerinden çalışan farklı bir bileşik akış. Ham fetch yok.

#### TK-031 · 24-external-handoffs · useWindowVirtualizer veya ilişkili kaydırma kapsayıcısında useVirtualizer

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:305`, `{query.data?.map((handoff) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Work içinde tüm handoff’lar ayrıntı, frozen Markdown ve durum formlarıyla aynı anda mount oluyor. Sahipli bileşen tekrarlanabilir ve list cevabında satır sınırı yok. History de ayrı tam liste.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya ilişkili kaydırma kapsayıcısında useVirtualizer. Handoff ve history satırlarını kalıcı kimlikle ölçerek sanallaştır. Açık form taslağı ve klavye odağı viewport dışına çıkınca korunmalı.
- **Diğer konumlar:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:299`.
- **Güven:** yüksek.

#### TK-032 · 24-external-handoffs · oRPC queryOptions ve TanStack Query 5.108.0 query()/koşullu useQuery

- **Kanıt:** `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:87`, `const previewReconcile = useMutation({`. **Kural:** §6.1–6.2: salt okunur önizleme Query; MutationCache yazma yaşam döngüsü.
- **Kullanım ve etki:** Reconcile Preview, DB’de sahip Work ve hedefleri doğrulayan salt okunur RPC. useMutation bunu global destek zarfında yazma işlemi olarak işler.
- **Beklenen ve önerilen düzeltme:** oRPC queryOptions ve TanStack Query 5.108.0 query()/koşullu useQuery. Kullanıcı Preview changes basınca tam plan girdisiyle Query’den oku. Confirm Reconcile ayrı mutation ve fingerprint/kimlik sahibi olarak kalır.
- **Diğer konumlar:** `apps/server/src/features/external-handoffs/server/external-handoffs-database.ts:923`, `apps/server/src/features/external-handoffs/server/external-handoffs-database.ts:398`, `packages/api/src/routers/index.ts:7951`.
- **Güven:** yüksek.

#### TK-033 · 25-kanban · TanStack Table v9 useTable + createSortedRowModel ve özel comparator’lar

- **Kanıt:** `apps/web/src/features/kanban/lib/kanban-view.ts:27`, `return [...works].sort((left, right) => {`. **Kural:** §6.8 TanStack Table, sıralanabilir kayıt listesi.
- **Kullanım ve etki:** Kullanıcının yapılandırdığı Work number/Title/Created/Updated/Reappear date sırası ve yönü elle comparator ile hem Board hem List’e uygulanıyor.
- **Beklenen ve önerilen düzeltme:** TanStack Table v9 useTable + createSortedRowModel ve özel comparator’lar. Tek sorted row model’den her iki sunumu besle. Work number boş/beraberlik davranışını ve mevcut Card/List görsel sözleşmesini koru.
- **Diğer konumlar:** `apps/web/src/features/kanban/ui/components/project-work-kanban.tsx:121`.
- **Güven:** yüksek. Spec 25’in List sunumu ürün düzeyinde Record Discovery Table View’a dönüşmez; bu öneri row model içindir.

#### TK-034 · 25-kanban · Kolon ve List görünümünde useVirtualizer/useWindowVirtualizer

- **Kanıt:** `apps/web/src/features/kanban/ui/components/kanban-board.tsx:243`, `{statusWorks.map((work) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Her Work için kart ve draggable mount ediliyor; kapalı kolonda ul hidden olsa da kartlar mount kalıyor. Aynı sınırsız tarama List satırlarını da doğrudan mount ediyor.
- **Beklenen ve önerilen düzeltme:** Kolon ve List görünümünde useVirtualizer/useWindowVirtualizer. Work kimliğiyle sanallaştır. Sayı, soft WIP ve Open blocker özetini tam koleksiyondan üret. Drag hedefleri, klavye hareketi ve erişilebilir alternatif Status kontrolünü koru.
- **Diğer konumlar:** `apps/web/src/features/kanban/ui/components/kanban-board.tsx:237`, `apps/web/src/features/kanban/ui/components/kanban-list.tsx:27`.
- **Güven:** yüksek. Kanban status kolonları sabit, kolonların içindeki Work sayısı sınırsız.

#### TK-035 · 26-backlog · TanStack Table v9 useTable + createSortedRowModel ve özel sortFns

- **Kanıt:** `apps/web/src/features/backlog/lib/backlog-presentation.ts:28`, `.sort((left, right) => {`. **Kural:** §6.8 TanStack Table, kullanıcı seçmeli sıralama.
- **Kullanım ve etki:** Priority, Date ve Field kayıt sırası .sort ile yönetiliyor. Gösterilen ve export edilen sıra aynı elle yazılmış modele bağlı.
- **Beklenen ve önerilen düzeltme:** TanStack Table v9 useTable + createSortedRowModel ve özel sortFns. Alternatif sunumların modelini Table’a ver. Manual order sunucu sırasını ve eşitlikte önceki sıra ile Deferred kurallarını koru.
- **Diğer konumlar:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:388`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:455`.
- **Güven:** yüksek.

#### TK-036 · 26-backlog · useWindowVirtualizer veya scroll kapsayıcısında useVirtualizer

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:536`, `{current.map((work) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Hazırlanmış Backlog koleksiyonundaki tüm Work kartları ve Deferred kartları mount ediliyor; Work ile büyüyen iki liste de sanallaştırılmamış.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya scroll kapsayıcısında useVirtualizer. Work id anahtarı ve dinamik satır ölçümüyle görünür kartları render et. Tüm sırayı DnD, kaydetme ve export’ta koru.
- **Diğer konumlar:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:747`.
- **Güven:** yüksek.

#### TK-037 · 26-backlog · useForm, onSubmit ve saveBacklogPresentation input şeması

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:600`, `onClick={() => savePresentation.mutate(currentSaved)}`. **Kural:** docs/tech-stack.md › TanStack Form + Zod, Save presentation gönderimi.
- **Kullanım ve etki:** Üç Backlog sort kontrolünün seçtiği değerler tek Save presentation düğmesiyle sunucuya yazılıyor. Gönderim çevresinde useForm veya Zod komut doğrulaması yok.
- **Beklenen ve önerilen düzeltme:** useForm, onSubmit ve saveBacklogPresentation input şeması. Aktif URL sunumu ile form doğrulamasını bağla; yalnız alternatif kaydedilebilirken explicit submit yap, Saved presentation sorgusunu ve Manual order kaydını ayrı tut.
- **Diğer konumlar:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:485`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:312`.
- **Güven:** yüksek. Reappear date seçim anındaki action, form bulgusu bu akışı kapsamıyor.

#### TK-038 · 27-daily-focus · useWindowVirtualizer veya mevcut kaydırma yüzeyinde useVirtualizer

- **Kanıt:** `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:326`, `{dailyFocus.data.members.map((work) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Seçilen güne ait tüm üyeler ve kaynak olaylar DOM’a map ediliyor. Gün sabit bir aralık olsa da üye/olay sayısının üst sınırı yok.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya mevcut kaydırma yüzeyinde useVirtualizer. Work ve event kimliğiyle üyeleri, olayları ve Close focus gruplarını listelerde sanallaştır. Candidates en çok beş olduğu için kendi normal render’ını korur.
- **Diğer konumlar:** `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:199`, `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:377`.
- **Güven:** yüksek.

#### TK-039 · 28-unified-calendar · Agenda useWindowVirtualizer, Day/grid içindeki büyüyen Work listeleri için uygun eksende useVirtualizer

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:628`, `{rows.map(({ date, field, label, work }) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Agenda seçilen ayın tüm tarih işaretlerini satıra çeviriyor; ayın gün sayısı sabit olsa da Work sayısı ve her günün mark/range sayısı sınırsız. Grid de tüm gün içeriklerini mount ediyor.
- **Beklenen ve önerilen düzeltme:** Agenda useWindowVirtualizer, Day/grid içindeki büyüyen Work listeleri için uygun eksende useVirtualizer. Satır kimliği Work id + tarih alanı, grid için gerekirse gün de anahtara dahil olsun. Kapsam ve Date kinds filtreleri ile drag hedefleri korunmalı.
- **Diğer konumlar:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:457`, `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:479`, `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:930`.
- **Güven:** yüksek. Sabit gün başlıklarının sayısı sanallaştırma gerekçesi değil; büyüyen Work öğeleri gerekçe.

#### TK-040 · 29-roadmap-horizon · Gruplanmış listelerde useWindowVirtualizer/virtual rows, ölçülen yükseklik ve kalıcı kayıt anahtarları

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/roadmap-results.tsx:344`, `{items.map(({ work, secondary }) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Work büyüdükçe hem gruplardaki tüm planned kartlar hem kapalı details içindeki tüm Unplanned candidates ve bunların form kontrolleri React ağacına mount ediliyor. Milestones, linked Work ve Not now geçmişi de sınırsız kayıt sayısıyla büyüyor.
- **Beklenen ve önerilen düzeltme:** Gruplanmış listelerde useWindowVirtualizer/virtual rows, ölçülen yükseklik ve kalıcı kayıt anahtarları. Grup başlıkları ile Work satırlarını aynı görünürlük modeline al; kapalı içeriği gerektiğinde mount et. React Flow canvas viewport sahibi olarak kalır ve grupların tam veri modeli korunur.
- **Diğer konumlar:** `apps/web/src/features/roadmap-horizon/ui/components/roadmap-results.tsx:375`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:298`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:372`, `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:103`.
- **Güven:** yüksek.

#### TK-041 · 30-focus-period · TanStack Table v9 rowSelectionFeature ve sabit getRowId; Form gönderim seçim değerini alır

- **Kanıt:** `apps/web/src/features/focus-period/ui/forms/focus-period-leftover-form.tsx:169`, `{undecided.map((item) => (`. **Kural:** §6.8 TanStack Table, kayıt satırı seçimi.
- **Kullanım ve etki:** Kapanış sonrası açık kayıtların seçimi form.selectedWorkIds dizisi ve elle checkbox map ile yönetiliyor. Üye listesi seçili set ayrı ayrı Work işlemi olarak gönderiliyor.
- **Beklenen ve önerilen düzeltme:** TanStack Table v9 rowSelectionFeature ve sabit getRowId; Form gönderim seçim değerini alır. Sadece işareti olan erişilebilir Work kimliklerini form gönderimine aktar. Başarılı satırları seçimden düşür, başarısızların yeniden deneme seçimini koru.
- **Diğer konumlar:** `apps/web/src/features/focus-period/ui/forms/focus-period-leftover-form.tsx:166`, `apps/web/src/features/focus-period/ui/forms/focus-period-leftover-form.tsx:123`, `apps/web/src/features/focus-period/ui/forms/focus-period-leftover-form.tsx:143`.
- **Güven:** yüksek.

#### TK-042 · 30-focus-period · useWindowVirtualizer veya kaydırılır alt panel için useVirtualizer

- **Kanıt:** `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:398`, `{period.members.map((item) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Tüm dönemler, güncel üyeler, kapanış karşılaştırmaları, Still-open Work ve toplu karar satırları doğrudan render ediliyor. 1–8 hafta sınırı satır sayısını sınırlamıyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya kaydırılır alt panel için useVirtualizer. Dönem/Work id ve grup anahtarıyla satırları sanallaştır; tarihsel snapshot satırlarının görünürlüğünü, seçili Work checkbox’larını ve kaynak bağlantılarının klavye erişimini koru.
- **Diğer konumlar:** `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:158`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:282`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:345`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:459`, `apps/web/src/features/focus-period/ui/forms/focus-period-leftover-form.tsx:169`, `apps/web/src/features/focus-period/ui/components/focus-period-dependencies.tsx:15`.
- **Güven:** yüksek.

#### TK-043 · 31-documents · Documents sahibi altında TanStack Virtual 3.14.26 ve stabil Document id

- **Kanıt:** `apps/web/src/features/documents/ui/components/document-navigation.tsx:111`, `{ordered(folder).map((record) => (`. **Kural:** §6.9 ve denetim karar tablosu: birikebilen kayıt listelerinde TanStack Virtual.
- **Kullanım ve etki:** Wiki projectId:null ile DocumentsSurface’i açıyor. Documents list’i sahiplik scope’unda tüm uygun kayıtları okuyor; navigation Folder/parent gruplarındaki tüm satırları mount ediyor.
- **Beklenen ve önerilen düzeltme:** Documents sahibi altında TanStack Virtual 3.14.26 ve stabil Document id. Görünür hiyerarşi satırlarını mevcut ownership/Folder düzeninden türetip sanallaştır; scope rozetleri, seçili belge odağı ve hash gezinmesi korunur.
- **Etkilenen spec’ler:** 31-documents, 32-personal-wiki.
- **Diğer konumlar:** `apps/web/src/features/personal-wiki/ui/components/personal-wiki-surface.tsx:13`, `apps/server/src/features/documents/server/documents-database.ts:1160`.
- **Güven:** yüksek. Paylaşılan Documents renderer kökü. Wiki karşılığı ayrı bir bulgu olarak sayılmaz.

#### TK-044 · 31-documents · TanStack Pacer `LiteDebouncer` (veya form listener `onChangeDebounceMs`) ile debounced preview girdisi; değer form…

- **Kanıt:** `apps/web/src/features/documents/ui/forms/document-diagram-conversion-form.tsx:121`, `onChange: ({ value }) => {`. **Kural:** Pacer (6.7): yoğun etkileşimin tetiklediği iş debounce edilir.
- **Kullanım ve etki:** Title alanının her değişimi parent `conversionTitle` state’ini değiştirir; bu değer `previewMermaidConversion` sorgusunun input’unda (`document-editor-form.tsx:213`) olduğu için her tuşta yeni sunucu önizleme isteği gider
- **Beklenen ve önerilen düzeltme:** TanStack Pacer `LiteDebouncer` (veya form listener `onChangeDebounceMs`) ile debounced preview girdisi; değer formdan `useSelector(form.store)` ile okunur. Parent’taki `conversionTitle`/`originalBlockOutcome` aynalamasını kaldır; preview input’unu debounced form değerinden üret.
- **Diğer konumlar:** `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:213`, `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:155`.
- **Güven:** yüksek. Her önizleme sunucuda Mermaid parse yapıyor; yazarken istek yağmuru.

#### TK-045 · 31-documents · TanStack Form `onSubmitMeta: { action: "preview" | "apply" }` + `form.handleSubmit({ action })`; `await mutation.m…

- **Kanıt:** `apps/web/src/features/documents/ui/forms/document-organization-form.tsx:129`, `if (submitAction.current === "apply") {`. **Kural:** 6.3: `onSubmit` içinde `await mutateAsync(...)`; birden çok gönderim biçimi `onSubmitMeta` ile ayrılır.
- **Kullanım ve etki:** Gönderim türü `useRef` ile ayrılıyor ve `mutate()` beklenmiyor → `isSubmitting` istek sürerken false; aynı kalıp smart-collection create ve diagram conversion formunda
- **Beklenen ve önerilen düzeltme:** TanStack Form `onSubmitMeta: { action: "preview" | "apply" }` + `form.handleSubmit({ action })`; `await mutation.mutateAsync(...)`. submitAction ref’ini `onSubmitMeta` ile değiştir; onSubmit’lerde `mutateAsync` bekle.
- **Etkilenen spec’ler:** 31-documents, 34-smart-collections.
- **Diğer konumlar:** `apps/web/src/features/documents/ui/forms/document-organization-form.tsx:76`, `apps/web/src/features/smart-collections/ui/forms/smart-collection-create-form.tsx:122`, `apps/web/src/features/documents/ui/forms/document-diagram-conversion-form.tsx:74`.
- **Güven:** orta.

#### TK-046 · 31-documents · React state → Router search

- **Kanıt:** `apps/web/src/features/documents/ui/components/project-documents-surface.tsx:36`, `const [archived, setArchived] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. DocumentNavigation tıklaması URL’yi güncellemiyor; yenileme/geri tuşunda seçim kayboluyor
- **Beklenen ve önerilen düzeltme:** Router search. `validateSearch` Zod `archived: z.boolean().catch(false)` + `Route.useSearch()` / `navigate({ search: prev => ... })`; Seçili Document zaten route hash (`selectedDocumentId`) kaynaklı; useEffect ile yerel kopyaya aynalanıyor. Seçim `navigate({ hash: documentRecordHash(id) })` ile yazılmalı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-047 · 31-documents · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:103`, `const [editSession] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. 6.4 açık ihlal kalıbı: store `useState(createX)` içinde
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. `useCreateStore` / `createStoreContext` ile editör oturumu; okuma `useSelector(store, selector)` (şu an `useSyncExternalStore(editSession.subscribe, editSession.get)`); Editör oturum store alanı `view` (toolbar, efektler ve Tabs paylaşıyor); alternatif Router search sekmesi; Editör oturum store alanı; Editör oturum store alanı (`DocumentVersionHistory` ile paylaşılıyor)
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-048 · 33-record-discovery · TanStack Pacer `LiteDebouncer` (useMemo içinde bir kez) ile gecikmeli sorgu metni; input değeri anında güncellenir

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:555`, `const searchResults = useQuery({`. **Kural:** Pacer: arama gibi yoğun etkileşimin ürettiği iş TanStack Pacer (`@tanstack/pacer-lite`) ile kontrol edilir (6.7).
- **Kullanım ve etki:** `Search` input’u her tuşta `setQuery` → sorgu anahtarı değişir → her tuşta `searchRecords` RPC isteği; debounce yok (`utils/orpc.ts:68` helper’ında da yok)
- **Beklenen ve önerilen düzeltme:** TanStack Pacer `LiteDebouncer` (useMemo içinde bir kez) ile gecikmeli sorgu metni; input değeri anında güncellenir. Input değerini anlık tut, `new LiteDebouncer(setDebouncedQuery, { wait: 250 })` ile sorgu girdisini besle; unmount’ta `cancel()`. Arama metni Router search’e taşınırsa debounced değer `navigate({ search })` ile yazılır.
- **Diğer konumlar:** `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:459`, `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:468`.
- **Güven:** yüksek. Etki: yazılan her karakter için cross-project arama isteği ve sonuç titremesi.

#### TK-049 · 33-record-discovery · TanStack Virtual 3.14.26 ve mevcut TanStack Table 9.3.1 modelinin birlikte kullanımı

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/record-table.tsx:750`, `{table.getRowModel().rows.map((row) => (`. **Kural:** §6.9 ve denetim karar tablosu: birikebilen kayıt listelerinde TanStack Virtual.
- **Kullanım ve etki:** Table modeli birden fazla Project’in Work satırını alabilir. Server records.flat() ile tümü döner. Grid tüm row/cell bileşenlerini ve inline edit kontrollerini mount eder.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26 ve mevcut TanStack Table 9.3.1 modelinin birlikte kullanımı. Mevcut sorted/filtered row modelini sanallaştır. Kayıt odak ve aktif inline edit davranışını, export sırasını ve stabil row id’yi koru.
- **Diğer konumlar:** `apps/server/src/features/record-discovery/server/record-table.ts:810`, `apps/server/src/features/record-discovery/server/record-table.ts:834`, `apps/web/src/features/record-discovery/ui/components/record-table.tsx:684`.
- **Güven:** yüksek.

#### TK-050 · 33-record-discovery · TanStack Virtual 3.14.26, type/id ve ölçülen snippet yüksekliği

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/universal-search-results.tsx:186`, `{results.map((result) => (`. **Kural:** §6.9 ve denetim karar tablosu: birikebilen kayıt listelerinde TanStack Virtual.
- **Kullanım ve etki:** Search ve All … sonuç renderer’ı her hit için DOM kurar. Search DB adaptörü aile adaylarının tümünü sıralayıp döndürür; toplu UI sonucu kesilmez.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26, type/id ve ölçülen snippet yüksekliği. Sıralamayı sunucu sahipliğinde tutup görünür hit’leri sanallaştır. Search ve hazırlanmış indekslerin ortak renderer’ı iki modu da kapsamalı.
- **Diğer konumlar:** `apps/server/src/features/record-discovery/server/universal-search-database.ts:1258`, `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:555`, `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:634`.
- **Güven:** yüksek.

#### TK-051 · 33-record-discovery · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/record-table.tsx:510`, `const [error, setError] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Hücre yazma `useMutation(orpc.updateTableCell.mutationOptions())` → `error`; apply mutation `isSuccess` (`Changes applied.`); `useMutation(orpc.applyTablePaste.mutationOptions())` → `isPending`
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-052 · 38-decisions · TanStack Virtual 3.14.26, kayıt kimliği ve ölçülmüş değişken yükseklik

- **Kanıt:** `apps/web/src/features/decisions/ui/components/project-decisions-panel.tsx:93`, `{decisions.map((record) => (`. **Kural:** §6.9 ve denetim karar tablosu: birikebilen kayıt listelerinde TanStack Virtual.
- **Kullanım ve etki:** Project Decisions sorgusu tüm yaşam durumlarının kayıtlarını alır. Panel tüm Decision satırlarını kurar; ayrı Decision chain paneli zincir nesillerini de doğrudan map eder.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26, kayıt kimliği ve ölçülmüş değişken yükseklik. Project listesinde görünür satır penceresi kur. Zinciri bağımsız ölç ve Open current decision/gezinme odağını koru.
- **Diğer konumlar:** `apps/server/src/features/project-source-records/server/project-source-records-database.ts:148`, `apps/web/src/features/decisions/ui/components/project-decisions-surface.tsx:33`, `apps/web/src/features/decisions/ui/components/decision-chain-panel.tsx:83`.
- **Güven:** yüksek.

#### TK-053 · 41-uncertainty-records · useWindowVirtualizer veya yerel scroll varsa useVirtualizer; getItemKey ve measureElement

- **Kanıt:** `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-panel.tsx:137`, `context.records.map((record) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Discovery bütün Assumption kartlarını ve her kartın kanıt/eylem içeriğini tek seferde mount ediyor; Açık Soru listesi de tüm soruları mount ediyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya yerel scroll varsa useVirtualizer; getItemKey ve measureElement. Kartları kimlik ve dinamik yükseklikle sanallaştır; kaynak hash’inde indeks çöz ve kaydır/odakla. Detay görünümü ile editörün konumunu koru.
- **Diğer konumlar:** `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:157`.
- **Güven:** yüksek. Kayıt koleksiyonu kullanıcıyla büyür, geçiş seçeneklerinin sabit listesi kapsam dışıdır.

#### TK-054 · 42-validation-records · TanStack Table createLegacyTable / getFilteredRowModel ya da v9 table features ve useWindowVirtualizer

- **Kanıt:** `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:72`, `const visible = records.filter((record) =>`. **Kural:** §6.8 TanStack Table 9.3.1; §6.9 TanStack Virtual.
- **Kullanım ve etki:** Status kontrolüne göre bütün Project kayıtları elle filtreleniyor ve uygun kartlar birlikte mount ediliyor. Bu kayıt listesi filtresi; Related seçimindeki sabit türler farklı.
- **Beklenen ve önerilen düzeltme:** TanStack Table createLegacyTable / getFilteredRowModel ya da v9 table features ve useWindowVirtualizer. Liste filtresini Table’a bağla, değişken yükseklikteki kartları virtualize et. Seçili id’ye ait bağımsız detay kaydını ve önceki Status’u koru.
- **Diğer konumlar:** `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:95`, `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:132`.
- **Güven:** yüksek. Table satırı render’ı mevcut kart görünümünü koruyabilir.

#### TK-055 · 43-research-sessions · useWindowVirtualizer / useVirtualizer; getItemKey, measureElement

- **Kanıt:** `apps/web/src/features/research-sessions/ui/views/research-sessions-view.tsx:75`, `records.map((record) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Project oturumları listesi tüm kartları aynı anda mount ediyor. Bir oturumun not ve binding satırları da büyüyebiliyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer / useVirtualizer; getItemKey, measureElement. Liste satırlarını kimlikle sanallaştır; not ve geçmişi mount scope’una göre ayrı ölç ve editörleri gerektiğinde pencere dışına taşı.
- **Diğer konumlar:** `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:136`, `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:259`.
- **Güven:** yüksek. Server list Project satırlarını sayfalama olmadan döndürüyor.

#### TK-056 · 43-research-sessions · Tek useQuery(orpc.projectResearchSessionBindings.queryOptions(...)) ve tek researchSessionBindingFeedback Query

- **Kanıt:** `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:244`, `queryKey: [`. **Kural:** §6.1 oRPC queryOptions/queryKey; §6.2 Query.
- **Kullanım ve etki:** History ve ilişkili Feedback için el anahtarlı dış Query, read action içinde ayrıca queryClient.query ile aynı RPC’yi çağırıyor. Dış cache oRPC invalidation anahtarıyla eşleşmiyor ve dış tazelik politikası içteki taze okumayı atlayabiliyor.
- **Beklenen ve önerilen düzeltme:** Tek useQuery(orpc.projectResearchSessionBindings.queryOptions(...)) ve tek researchSessionBindingFeedback Query. RPC girdisini doğrudan Query’ye geçir; session revision değişiminde güncelle ve bind/consent değişiminde oRPC anahtarını invalidate et. Feedback popup’ı mount edilince fresh oku; hata halinde önceki satır gövdesini gösterme.
- **Etkilenen spec’ler:** 43-research-sessions, 47-feedback.
- **Diğer konumlar:** `apps/web/src/features/feedback/ui/components/research-binding-feedback.tsx:26`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:29`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:45`.
- **Güven:** yüksek. Sonuçları yetkisiz bir kullanıcıya veren kanıt yok. Dış cache’in yaşam döngüsü ayrıdır.

#### TK-057 · 43-research-sessions · Kimlik kontrolü yalnız requireAuth middleware'inde; sahiplik ya hesap kapsamlı tek kayıt okuma portu (`researchSes…

- **Kanıt:** `packages/api/src/routers/index.ts:962`, `async function readOwnedResearchSession(`. **Kural:** 6.1 oRPC: kimlik ve sahiplik .use(middleware) ile (v1 typed-input middleware `.use(mw, i => i.id)`); handler başında tekrar eden kontrol yerine.
- **Kullanım ve etki:** previewResearchSessionSnapshot ve previewResearchSessionConvert (11394-11413) protectedProcedure altında olmasına rağmen requireAuth'u handler'da tekrarlıyor ve tek kaydın sahipliğini projenin tüm Research Session listesini çekip bellekte bularak doğruluyor.
- **Beklenen ve önerilen düzeltme:** Kimlik kontrolü yalnız requireAuth middleware'inde; sahiplik ya hesap kapsamlı tek kayıt okuma portu (`researchSessions.read(accountId, projectId, id)`) ya da typed-input middleware `.use(ownedResearchSession, (input) => input)` ile context'e kaydı ekleyerek.. UNAUTHORIZED dalını sil; ResearchSessionsAccess'e kapsamlı `read` ekle veya iki prosedürü paylaşan bir sahiplik middleware'i tanımla.
- **Diğer konumlar:** `packages/api/src/routers/index.ts:11397`, `packages/api/src/routers/index.ts:11403`.
- **Güven:** yüksek. Güvenlik açığı yok: list() accountId ile kapsamlı, yani kontrol doğru sonuç veriyor; etki tutarlılık ve gereksiz liste okuması.

#### TK-058 · 44-sources-and-freshness · useWindowVirtualizer; ölçülen Source satırı ve getItemKey

- **Kanıt:** `apps/web/src/features/sources-and-freshness/ui/components/project-sources-surface.tsx:83`, `records.map((source) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Project Discovery’de bütün Source kartları açılıyor; her biri tarihsel snapshot gövdesi ve erişim kontrolleri oluşturabiliyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer; ölçülen Source satırı ve getItemKey. Kart mount sayısını sınırla, hash/odak navigasyonunu önce satırı görünür kılarak sürdür. Check ve bind bölümleri talep üzerine mount kalsın.
- **Diğer konumlar:** `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:228`.
- **Güven:** yüksek. İlk ürün Source foundation’da UI yoktu; bulgu güncel Discovery yüzeyi içindir.

#### TK-059 · 44-sources-and-freshness · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:96`, `const [pending, setPending] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 10 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sunucu önizlemesi kopyalanıyor. Paste/Preview tetikleme, URL değişince temizleme ve requestNumber’ın yarış koruması korunmalı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. bindSourceEvidence / reviewSourceEvidence mutation.isPending; bindSourceEvidence / reviewSourceEvidence mutation.error; mutation.isSuccess / variables; recheckSource / decideSourceCheck mutation.isPending
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-060 · 45-evidence · TanStack Table v9 manualFiltering/manualSorting + useWindowVirtualizer veya panel içi useVirtualizer

- **Kanıt:** `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:56`, `orpc.evidenceFlow.queryOptions({`. **Kural:** §6.8 TanStack Table; §6.9 TanStack Virtual.
- **Kullanım ve etki:** Evidence Flow’da Source type kayıt filtresi ve ilişki-zamanı sırası RPC sonucuyla çalışıyor, tamamı bir ordered list olarak mount ediliyor. Sunucu hedefin açık bağlarını sayfalamadan seçiyor.
- **Beklenen ve önerilen düzeltme:** TanStack Table v9 manualFiltering/manualSorting + useWindowVirtualizer veya panel içi useVirtualizer. Filtreyi kontrollü tablo row modeline bağla; oRPC olarak sunucuda erişim ve zaman sırasını koru. Değişken yükseklikli erişilebilir listenin kimliğini ve sürüme açma yolunu koru.
- **Etkilenen spec’ler:** 45-evidence, 41-uncertainty-records.
- **Diğer konumlar:** `apps/web/src/features/evidence/ui/components/evidence-flow.tsx:67`, `apps/web/src/features/evidence/ui/components/evidence-role-groups.tsx:25`, `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:55`.
- **Güven:** yüksek. Tablo HTML semantiği zorunlu değil. Work, Decision ve Assumption tüketicileri aynı paneli kullanıyor.

#### TK-061 · 46-contact-and-company · useWindowVirtualizer veya panel useVirtualizer / getItemKey

- **Kanıt:** `apps/web/src/features/contacts/ui/views/contacts-view.tsx:224`, `contacts.data?.map((contact) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Workspace düzeyindeki tüm Contact ve Company listeleri ve Duplicate Candidates satırları DOM’da. RPC aktif workspace listelerinde global satır tavanı yok.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer veya panel useVirtualizer / getItemKey. Kimlik profili seçimlerini ve source link odak davranışını koruyarak kayıt kartlarını sanallaştır.
- **Diğer konumlar:** `apps/web/src/features/contacts/ui/views/contacts-view.tsx:242`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:352`.
- **Güven:** yüksek. Contact/Company’nin ortak Table/Universal Search’e katılımı başka yüzey. Bu basit listelere Table sıralama özelliği varsayılmadı.

#### TK-062 · 47-feedback · Table v9 manualFiltering/manualSorting ve useWindowVirtualizer (değişken yükseklik)

- **Kanıt:** `apps/web/src/features/feedback/ui/views/feed-view.tsx:205`, `<FeedFilters onChange={onChangeQuery} query={query} />`. **Kural:** §6.8 Table 9.3.1; §6.9 Virtual.
- **Kullanım ve etki:** Feed kayıtlarını Source type/Status ile filtreliyor ve Sort ile sıralıyor. Sunucu sonuç kümesi bütün Project Source ve Feedback satırlarını kapsıyor; uzun gövdeli kartların tamamı mount ediliyor.
- **Beklenen ve önerilen düzeltme:** Table v9 manualFiltering/manualSorting ve useWindowVirtualizer (değişken yükseklik). Feed sorgusu sunucu doğruluğunu korusun; Table row model ve kontrollü Router filtrelerini bağla, Feed ve Feedback master kartlarını ölçerek sanallaştır. Open source record önce hedefi mount ve focus etmeli.
- **Diğer konumlar:** `apps/web/src/features/feedback/ui/views/feed-view.tsx:210`, `apps/web/src/features/feedback/ui/views/feedback-view.tsx:267`, `apps/web/src/features/feedback/ui/components/feed-surface.tsx:10`.
- **Güven:** yüksek. Fixed select seçeneklerine Table önerilmiyor.

#### TK-063 · 48-screens-and-wireframes · LiteThrottler.maybeExecute / cancel veya flush

- **Kanıt:** `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:84`, `const observer = new ResizeObserver(measure);`. **Kural:** §6.7 Pacer; tech-stack Wireframe render/geometry sınırı.
- **Kullanım ve etki:** Pencere/pane resize bildirimleri ölçüm + yeni boyut state değeri üretip Konva Stage ve görünür geometriyi her bildirimde tekrar hesaplatıyor.
- **Beklenen ve önerilen düzeltme:** LiteThrottler.maybeExecute / cancel veya flush. İlk pozitif ölçümü hemen al, sonraki eş boyutları at ve resize bildiriminin renderer işini Pacer ile sınırla; final ölçümü koru.
- **Diğer konumlar:** `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:76`.
- **Güven:** yüksek. Native ResizeObserver gerekli; kapsam callback’in tetiklediği render işidir.

#### TK-064 · 48-screens-and-wireframes · useWindowVirtualizer / useVirtualizer, getItemKey ve measureElement

- **Kanıt:** `apps/web/src/features/screens/ui/views/screens-view.tsx:156`, `items.map((item) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Tüm Project Screen kartları yaşam bölümlerinde mount ediliyor; Output seçici de aynı Screen kümesini ayrı listeliyor.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer / useVirtualizer, getItemKey ve measureElement. Yaşam bölümü başlıklarıyla sanallaştır, açık aktif Wireframe oturumunu viewport dışına kaydırınca unmount edip taslağı kaybettirme. Çıktı seçiminde sürüm seçiminin erişilebilirliğini koru.
- **Diğer konumlar:** `apps/web/src/features/screens/ui/forms/screens-output-form.tsx:38`.
- **Güven:** yüksek. Konva sahnesi kayıt listesi sayılmaz; lifecycle bölümleri kullanıcı filtre state’i taşımıyor.

#### TK-065 · 48-screens-and-wireframes · LiteDebouncer.flush() veya editor kapanmadan tamamlanan flush/close sınırı

- **Kanıt:** `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:115`, `debouncer.cancel();`. **Kural:** §6.7 Pacer son değer korunacaksa flush; Wireframe engine ve autosave stack satırları.
- **Kullanım ve etki:** Son engine command, debounce penceresinde Close Wireframe ile component unmount olunca iptal ediliyor. Başlamamış yazı başarısızlık işaretini de tetiklemiyor. Convert preview’in ayrı flush’ı normal kapanışa uygulanmıyor.
- **Beklenen ve önerilen düzeltme:** LiteDebouncer.flush() veya editor kapanmadan tamamlanan flush/close sınırı. Bilinçli discard yolu dışında bekleyen değişikliği kaydet; bekleyen ve uçuş halindeki yazı ile hata/retry durumunu engine revision’a bağla. Mevcut oRPC online-only korumasını sürdür.
- **Diğer konumlar:** `apps/web/src/features/screens/ui/views/screens-view.tsx:104`, `apps/web/src/features/screens/ui/views/screens-view.tsx:111`, `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:103`.
- **Güven:** yüksek. Normal kapanış kod zinciri statik doğrulandı.

#### TK-066 · 49-user-flow · useQuery(orpc.previewUserFlowRebind.queryOptions({ input })) / skipToken

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:67`, `.then((next) => active && setPlan(next))`. **Kural:** §6.1 oRPC Query okuma; §6.2 server state.
- **Kullanım ve etki:** Mounted dialog effect içinde Rebind planı istemciden doğrudan çağrılıyor; elle active flag ile plan/hatayı bir bileşene taşıyor.
- **Beklenen ve önerilen düzeltme:** useQuery(orpc.previewUserFlowRebind.queryOptions({ input })) / skipToken. Dialog payload’ından tam input üret, mount only preview ve fresh policy korunsun; confirm için mutationOptions ve invalidate.
- **Diğer konumlar:** `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:171`, `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:65`.
- **Güven:** yüksek. RPC çağrısı UI dışında tek seferlik değil; sonuç diyaloğun render girdisi.

#### TK-067 · 49-user-flow · useVirtualizer; getItemKey, measureElement; section sibling indeksini tek geçişte üret

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/user-flow-outline.tsx:314`, `{rows.map((row) => {`. **Kural:** §6.9 Virtual; PRD 15 ve spec 49 büyük sahne.
- **Kullanım ve etki:** Outline, desteklenen 500 görünür node’da her satır için bütün node dizisini tarayıp bütün satırları mount ediyor. Canvas’ın onlyRenderVisibleElements ayarı bu paralel DOM Outline’ı kapsamıyor.
- **Beklenen ve önerilen düzeltme:** useVirtualizer; getItemKey, measureElement; section sibling indeksini tek geçişte üret. Canvas ve Outline’ın ortak editor modelini koru; Outline klavye odağını scrollToIndex ile kur ve satır sıra metadatasını ölçülebilir hâle getir.
- **Diğer konumlar:** `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:757`.
- **Güven:** yüksek. Sahne benchmark’ının başarısız olduğu ölçülmedi. Görünür kullanıcı yüzeyindeki algoritma statik.

#### TK-068 · 50-moodboards · LiteThrottler.maybeExecute ve cleanup

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-board.tsx:38`, `const observer = new ResizeObserver(([entry]) => {`. **Kural:** §6.7 Pacer.
- **Kullanım ve etki:** Resize ile yeni ölçüm her seferinde görsel board koordinatlarını ve render’ını yeniden üretir; büyüyen board’da tüm kartlara etki eder.
- **Beklenen ve önerilen düzeltme:** LiteThrottler.maybeExecute ve cleanup. Açılış ölçümünü ayrı koru, aynı boyutu at ve art arda resize işlemlerini sınırla. ResizeObserver tarayıcı adaptörü olarak kalır.
- **Güven:** yüksek. Viewport persistence zaten LiteDebouncer kullanıyor.

#### TK-069 · 50-moodboards · @dnd-kit/react DragDropProvider / sortable useSortable, @dnd-kit/helpers move()

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:27`, `} from "@dnd-kit/core";`. **Kural:** §6.10 dnd-kit react 0.5.3.
- **Kullanım ve etki:** 150 satıra kadar Outline sıralaması legacy DndContext/sortable/utilities kullanıyor; büyük listede virtual ve keyboard move kullanılıyor.
- **Beklenen ve önerilen düzeltme:** @dnd-kit/react DragDropProvider / sortable useSortable, @dnd-kit/helpers move(). Aynı section sınırı, busy koruması, KeyboardSensor ve event.canceled kontrolüyle yeni API’ye taşı. Virtual branch’teki pointer-free hareketi koru.
- **Diğer konumlar:** `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:28`, `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:34`, `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:346`, `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:20`.
- **Güven:** yüksek. Legacy paketler bu kullanımda otomatik olarak deprecated kabul edilmedi.

#### TK-070 · 52-spec-change-review · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:118`, `useState<SpecChangeReviewFollowUpPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. useQuery(orpc.previewSpecChangeReviewFollowUp.queryOptions({ input: { candidate, reviewId, workType } })) — useEffect+setState okuma (S6-4); preview query error + confirm mutation error; preview.isPending || confirm.isPending
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-071 · 52-spec-change-review · useQuery(orpc.previewSpecChangeReviewFollowUp.queryOptions({ input: { candidate, reviewId, workType } })); pending…

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:128`, `useEffect(() => {`. **Kural:** 6.1 Okuma useQuery(orpc.x.queryOptions({ input })) — yerine geçtiği kalıp useEffect + setState; 6.2 sorgu sonucu useState'e kopyalanmaz.
- **Kullanım ve etki:** Salt okunur Follow-up Work önizlemesi useEffect içinde elle çekilip yarış bayrağıyla useState'e yazılıyor (preview/error/pending).
- **Beklenen ve önerilen düzeltme:** useQuery(orpc.previewSpecChangeReviewFollowUp.queryOptions({ input: { candidate, reviewId, workType } })); pending/error query sonucundan.. Önizlemeyi query'ye taşı; workType'ı dialog formunun alanı yap; confirm'i useMutation'a al (S6-1).
- **Güven:** yüksek.

#### TK-072 · 54-test-report-acceptance · TanStack Virtual 3.14.26 için oturum ve test kimlikleri, değişken yükseklik

- **Kanıt:** `apps/web/src/features/test-report/ui/views/test-sessions-view.tsx:113`, `{sessions.map((session) => (`. **Kural:** §6.9 ve denetim karar tablosu: birikebilen kayıt listelerinde TanStack Virtual.
- **Kullanım ve etki:** DB bütün Project oturumlarını ve çocuklarını okur. Her oturum DOM’da, her File import/MCP oturumu 1.000 Session Test gösterebilir ve not gövdeleri de mount olur.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26 için oturum ve test kimlikleri, değişken yükseklik. Oturum ve Session Test satırlarını ölçülebilir gruplar halinde sanallaştır. Reported result ile review yaşamsal ayrımını koru.
- **Diğer konumlar:** `apps/web/src/features/test-report/ui/views/test-sessions-view.tsx:61`, `apps/server/src/features/test-report/server/test-report-database.ts:356`, `packages/api/src/test-report.ts:101`.
- **Güven:** yüksek.

#### TK-073 · 59-technical-diagrams · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:45`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. saveStructure/saveLayout/DiagramViewForm create mutation error (useMutationState ile toplanabilir); previewConvert.data; iptal için previewConvert.reset(); previewMutation.data; eskimiş yanıt kontrolü previewMutation.variables ile form değerleri karşılaştırılarak; listeners.onChange → previewMutation.reset()
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-074 · 61-github-integration · TanStack Virtual useWindowVirtualizer veya panel scroll sahibi ise useVirtualizer

- **Kanıt:** `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:157`, `{group.records.map((record) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** İlk triage, Repository için tüm aktif Issue adaylarını mount eder. PR Context Card ve check özeti de Project’in geçerli PR kümelerini sınır veya sayfalama olmadan çizer. Arama sonuçları ayrı SEARCH_LIMIT=200 sözleşmesine tabidir.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer veya panel scroll sahibi ise useVirtualizer. Büyüyen Issue ve PR koleksiyonlarını kimlikli sanal satırlara dönüştür. Grup etiketleri, klavye ile kaynak bağlantılarına erişim ve güncel head ayrımı korunmalı.
- **Diğer konumlar:** `apps/server/src/features/github-integration/server/github-integration.ts:1481`, `apps/web/src/features/github-integration/ui/components/github-pr-context-card.tsx:271`, `apps/server/src/features/github-integration/server/github-pr-context.ts:65`, `apps/web/src/features/github-integration/ui/components/github-checks-panel.tsx:118`, `apps/server/src/features/github-integration/server/github-checks.ts:158`.
- **Güven:** yüksek.

#### TK-075 · 61-github-integration · oRPC completeGitHubAppInstall.mutationOptions + useMutation

- **Kanıt:** `apps/web/src/features/github-integration/hooks/use-complete-github-install.ts:13`, `return useQuery({`. **Kural:** §6.1–6.2 yazma için mutation.
- **Kullanım ve etki:** Callback tamamlaması useQuery queryFn içinde. Sunucu kurulum satırı ekler/günceller ve tokenı yeniler. Sonsuz staleTime ve retry:false ile okuma kaydına yaklaşılır; gcTime:0 sonrası yeniden mount yazmayı yeniden çalıştırabilir.
- **Beklenen ve önerilen düzeltme:** oRPC completeGitHubAppInstall.mutationOptions + useMutation. Callback dönüşü başına bir açık işlem tetiklemesi kur; isPending/error/data kullan. Geçersiz callback reddini, sunucu kapsam denetimini ve yeniden giriş davranışını koru.
- **Diğer konumlar:** `apps/web/src/features/github-integration/hooks/use-complete-github-install.ts:21`, `apps/server/src/features/github-integration/server/github-integration.ts:1197`, `apps/server/src/features/github-integration/server/github-integration.ts:1230`.
- **Güven:** yüksek.

#### TK-076 · 61-github-integration · oRPC searchGitHubRecords, gitHubAppRepositories, gitHubTriagePreview, previewGitHubReconnect/Disconnect queryOptio…

- **Kanıt:** `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:328`, `queryKey: ["github-record-search", search.text],`. **Kural:** §6.1 oRPC queryOptions / queryKey.
- **Kullanım ve etki:** Alt yüzeyler elle string anahtarla cache tutar. Arama anahtarında projectId yok, aynı metin iki Project için aynı cache kimliğine sahip. Repository seçiminde installationId aynı olsa bile linked sonucu Project kapsamına bağlıdır.
- **Beklenen ve önerilen düzeltme:** oRPC searchGitHubRecords, gitHubAppRepositories, gitHubTriagePreview, previewGitHubReconnect/Disconnect queryOptions. Query seçeneklerini surface/feature hook içinde tam RPC girdisinden üret ve select ile records/repositories seç. Önizleme alternatifi için doğru prosedür veya skipToken kullan.
- **Diğer konumlar:** `apps/web/src/features/github-integration/ui/forms/link-repository-form.tsx:76`, `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:108`, `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:212`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:133`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:147`.
- **Güven:** yüksek. Anahtar çakışması cache kimliği düzeyinde statik olarak doğrulandı; gcTime:0 normal ayrılmada kalıcılığı azaltır. Hesaplar arası sızıntı iddiası yok.

#### TK-077 · 63-release-planning · TanStack Virtual useWindowVirtualizer + getItemKey ve measureElement

- **Kanıt:** `apps/web/src/features/project-release-planning/ui/components/project-release-list.tsx:53`, `{releases.map(`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Proje Sürümleri durum gruplarına ayrılır ve API Project altındaki tüm sürümleri limitsiz döndürür. Tüm kartlar aynı anda DOM üzerinde.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer + getItemKey ve measureElement. Durum başlığını ve sürüm kartlarını kimlikli satırlara eşle. Sıra ve kaynak bağlantıları korunsun.
- **Diğer konumlar:** `apps/server/src/features/project-release-planning/server/project-release-planning-database.ts:923`.
- **Güven:** yüksek.

#### TK-078 · 64-release-evidence · TanStack Virtual useWindowVirtualizer + ölçülen satır yüksekliği

- **Kanıt:** `apps/web/src/features/release-evidence/ui/views/release-evidence-pack-view.tsx:178`, `{pack.attention.map((row) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Attention ve kanıt bölümlerindeki kaynak satırları için kayıt sayısını sınırlayan Pack sözleşmesi yok; üretilen kaynak satırları aynı anda DOM üzerinde. Kontrol listesi ayrı bir üst sınıra tabi.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer + ölçülen satır yüksekliği. Kanıt bölümleri ve kaynak satırları için kararlı anahtarlar üret; bölüm başlıkları, açıklama ve Open source record yolları korunmalı.
- **Diğer konumlar:** `apps/web/src/features/release-evidence/ui/views/release-evidence-pack-view.tsx:223`, `packages/api/src/release-evidence.ts:134`, `apps/server/src/features/release-evidence/server/release-evidence.ts:150`.
- **Güven:** yüksek.

#### TK-079 · 66-production-incidents · TanStack Virtual useWindowVirtualizer + getItemKey ve measureElement

- **Kanıt:** `apps/web/src/features/production-incidents/ui/components/production-incident-list.tsx:53`, `{incidents.map(({ incident, linkCount }) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Project kapsamındaki Üretim Olayları topluca alınır ve durum başlıkları altında tüm satırlar çizilir.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer + getItemKey ve measureElement. Durum ve olay satırlarını sanallaştır; doğal sırayı ve kaynak bağlantılarını koru.
- **Diğer konumlar:** `apps/server/src/features/production-incidents/server/production-incidents-database.ts:902`.
- **Güven:** yüksek.

#### TK-080 · 66-production-incidents · oRPC previewProductionIncidentFollowUp.queryOptions + queryClient.query veya diyaloğa kapsamlı koşullu useQuery

- **Kanıt:** `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:70`, `client.previewProductionIncidentFollowUp({ ...base, ...values }),`. **Kural:** §6.1–6.2 oRPC okuma + Query; spec 66 Testing Decisions takip İşi önizlemesi.
- **Kullanım ve etki:** Önizleme client çağrısının sonucunu diyalog state’ine kopyalar. Kapatmak bekleyen okumayı ve çözümün tekrar state’e yazılmasını engellemez.
- **Beklenen ve önerilen düzeltme:** oRPC previewProductionIncidentFollowUp.queryOptions + queryClient.query veya diyaloğa kapsamlı koşullu useQuery. Sonucun aktif diyalog oturumu ve form değerleriyle eşleşmesini sağla. Geç gelen yanıtı eski oturumda bırak; stale fingerprint reddi sonrası güncel önizleme al.
- **Diğer konumlar:** `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:53`, `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:123`, `packages/api/src/routers/index.ts:5386`.
- **Güven:** yüksek. Sunucu tarafı preview fingerprint kontrolü korunuyor; bulgu istemci yanlış bağlamı ve yeniden inceleme yüküyle sınırlı.

#### TK-081 · 66-production-incidents · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:49`, `useState<ProductionIncidentFollowUpPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kapatılan diyalogdaki bekleyen sonuç daha sonra setPreview ile geri yazılabilir; yeniden açılan oturumda eski önizleme görünür. Yeni oturumla eşle ve geri dönüşte yeniden onay iste.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. oRPC previewProductionIncidentFollowUp.queryOptions + Query data / reset veya queryClient.query; oRPC createProductionIncidentFollowUp.mutationOptions + useMutation.isPending; useMutation.error / reset; beklenen stale sonucu oRPC tanımlı hata olarak ele al; TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-082 · 67-value-chain · TanStack Virtual useWindowVirtualizer; kararlı kaynak türü/kimliği ve ölçüm

- **Kanıt:** `apps/web/src/features/value-chain/ui/views/value-chain-view.tsx:231`, `{chain.notLinked.map((item) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Not linked to goal listesi mevcut ilişkilerden türetilen kayıtları limitsiz render eder; dal ve boşluk satırları da aynı görünümde büyür.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual useWindowVirtualizer; kararlı kaynak türü/kimliği ve ölçüm. Önce düz ve büyüyen Not linked to goal listesini sanallaştır. Dal/boşluk grupları için erişilebilir doğal sırayı koruyan satır eşlemesi değerlendir.
- **Diğer konumlar:** `apps/web/src/features/value-chain/ui/views/value-chain-view.tsx:192`, `apps/web/src/features/value-chain/ui/views/value-chain-view.tsx:211`, `apps/server/src/features/value-chain/server/value-chain-database.ts:715`.
- **Güven:** yüksek.

#### TK-083 · 68-project-history · TanStack Table 9 useLegacyTable (React) veya v9 useTable; manualFiltering/manualPagination

- **Kanıt:** `apps/web/src/features/project-history/ui/views/project-activity-view.tsx:162`, `{entries.map((entry) =>`. **Kural:** §6.8 filtrelenebilir ve sayfalı kayıt listesi TanStack Table.
- **Kullanım ve etki:** Proje Etkinliği kaynak/olay filtreleri ve cursor sayfalarını yönetiyor; sonuçlar yalnız liste map ile çiziliyor. Filtering ve pagination zaten sunucu ve Query katmanında doğru sınırda yürütülüyor.
- **Beklenen ve önerilen düzeltme:** TanStack Table 9 useLegacyTable (React) veya v9 useTable; manualFiltering/manualPagination. Sorgu filtresi ve cursor sayfalarını koru; Table modeline atomik kayıt veya açıklanabilir küme satırlarını ver, grup içeriğine erişimi kaybetme.
- **Diğer konumlar:** `apps/web/src/features/project-history/ui/components/project-activity-surface.tsx:20`, `apps/web/src/features/project-history/ui/components/project-activity-surface.tsx:60`, `apps/web/src/features/project-history/hooks/use-project-activity.ts:35`.
- **Güven:** yüksek. Etki ortak liste sözleşmesiyle sınırlı. Table mevcut cursor protokolünü veya kümeleri ikinci kez hesaplamamalı.

#### TK-084 · 69-project-updates · useWindowVirtualizer + update.id ve measureElement

- **Kanıt:** `apps/web/src/features/project-updates/ui/components/project-update-list.tsx:36`, `{updates.map((update) => (`. **Kural:** §6.9 TanStack Virtual.
- **Kullanım ve etki:** Append-only Manuel Proje Güncellemesi geçmişi tüm kayıtları ve iç bağlantılarını aynı anda DOM’a koyar; DB Project güncellemelerini sayfalama veya limit olmadan okur.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer + update.id ve measureElement. Değişken yükseklikteki kronoloji satırlarını sanallaştır ve eski kayıtların kaynak bağlantılarını koru.
- **Diğer konumlar:** `apps/server/src/features/project-updates/server/project-updates-database.ts:193`, `apps/server/src/features/project-updates/server/project-updates.ts:399`.
- **Güven:** yüksek.

#### TK-085 · 70-project-closure-summary · oRPC queryOptions + queryClient.query veya geçici anahtarlı useQuery, Query data/error ve Form pending

- **Kanıt:** `apps/web/src/features/project-closure-summary/hooks/use-closure-summary-draft.ts:10`, `return useMutation(orpc.projectClosureSummaryDraft.mutationOptions());`. **Kural:** §6.1–6.2 okuma için queryOptions/QueryClient.query.
- **Kullanım ve etki:** Generate/Preview ve Planned date history salt okunur RPC’leri MutationCache üzerinden çalıştırır ve UI sonuçları ayrıca React state’ine kopyalar. Hata globalde yazma hatası olarak sunulur; önceki taslağın geç dönen tarih sonucu yeni taslağa taşınabilir.
- **Beklenen ve önerilen düzeltme:** oRPC queryOptions + queryClient.query veya geçici anahtarlı useQuery, Query data/error ve Form pending. Proje, kaynaklar ve etkin taslak oturumu ile sonucu eşle. Discard yeni taslaktan eski sonucu ayırsın; belge kaydı mevcut saveProjectClosureSummary mutationOptions üzerinde kalsın.
- **Diğer konumlar:** `apps/web/src/features/project-closure-summary/hooks/use-closure-summary-date-comparison.ts:7`, `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:104`, `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:139`, `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:205`, `packages/api/src/routers/index.ts:9187`.
- **Güven:** yüksek.

#### TK-086 · 70-project-closure-summary · TanStack Form async onSubmit + form.Subscribe isSubmitting + setErrorMap; oRPC mutateAsync / QueryClient.query

- **Kanıt:** `apps/web/src/features/project-closure-summary/ui/forms/closure-summary-editor-form.tsx:41`, `onSubmit: ({ value }) => {`. **Kural:** §6.3 gönderim yaşam döngüsünde Promise await ve TanStack Form hata durumu.
- **Kullanım ve etki:** Save ve kaynak Preview/Generate formları onSubmit içinden async işlemi beklemiyor. Zod başarısızlığında boş dönüş var, örneğin boş başlık yerinde hata göstermiyor. Bekleme üst görünümde ayrı state.
- **Beklenen ve önerilen düzeltme:** TanStack Form async onSubmit + form.Subscribe isSubmitting + setErrorMap; oRPC mutateAsync / QueryClient.query. Form callback sözleşmesini Promise döndürecek şekilde değiştir, hata ve beklemeyi formdan oku, iki kaynak eylemi için mevcut onSubmitMeta davranışını koru.
- **Diğer konumlar:** `apps/web/src/features/project-closure-summary/ui/forms/closure-summary-source-form.tsx:39`, `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:76`, `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:154`.
- **Güven:** yüksek.

#### TK-087 · 71-attention-signals · `useWindowVirtualizer` (sayfa kayıyor) gruplu düz satır modeli + `measureElement`

- **Kanıt:** `apps/web/src/features/attention-signals/ui/components/notification-center-list.tsx:228`, `{section.groups.map((group) => (`. **Kural:** Kural tablosu: birikebilen liste → TanStack Virtual (6.9).
- **Kullanım ve etki:** Merkez bütün sinyalleri (kapalılar dahil) tek seferde render ediyor; sunucu `list(accountId)` sınırsız (apps/server/src/features/attention-signals/server/attention-signals-database.ts:173) ve kapalı sinyaller silinmiyor.
- **Beklenen ve önerilen düzeltme:** `useWindowVirtualizer` (sayfa kayıyor) gruplu düz satır modeli + `measureElement`. Bölüm/grup/sinyal satırlarını düz bir sanal listeye çevir veya sunucu tarafında sayfalama/infiniteOptions ekle (sunucu kısmı server grubunda).
- **Diğer konumlar:** `apps/server/src/features/attention-signals/server/attention-signals-database.ts:173`.
- **Güven:** orta. Birikme hızı üretici feature'lara bağlı; gerçek veri hacmi doğrulanmadı.

#### TK-088 · 71-attention-signals · Üretimi sunucuda `notificationCenter` okumasının içine katlamak veya `useMutation(orpc.refreshPublicRoadmapReviewS…

- **Kanıt:** `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:39`, `useEffect(() => {`. **Kural:** 6.1 Okuma `useEffect` yerine `useQuery`; yazma `useMutation`.
- **Kullanım ve etki:** Sinyal üreten bir yazma mount'ta useEffect içinde düz client çağrısıyla yapılıyor; hata sessizce yutuluyor, runOnlineOnlyWrite/MutationCache atlanıyor, StrictMode'da iki kez çalışıyor (sunucu dedupe'u maskeliyor).
- **Beklenen ve önerilen düzeltme:** Üretimi sunucuda `notificationCenter` okumasının içine katlamak veya `useMutation(orpc.refreshPublicRoadmapReviewSignals.mutationOptions({ onSuccess: invalidate }))` + mount tetikleyici. Tercihen sunucu tarafında okuma öncesi kuralı çalıştır; değilse useMutation ile sar ve hatayı görünür kıl.
- **Güven:** orta.

#### TK-089 · 73-link-sharing · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:35`, `const [notice, setNotice] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. revoke mutation `isSuccess`; rotate mutation `isSuccess`; kopyalama sonucu için `useMutation({ mutationFn: writeTextToClipboard })` ya da sahipsiz; rotate/copy mutation `error`; setExpiry/reopen/reshare/revoke mutation `isSuccess` + `variables`
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-090 · 79-data-export · oRPC exportPreview.queryOptions + Query 5.108.0 query()/kapsamlı observer

- **Kanıt:** `apps/web/src/features/data-export/hooks/use-export-requests.ts:7`, `return client.exportPreview(request);`. **Kural:** §6.1–6.2: React etkileşimi oRPC + Query okuması.
- **Kullanım ve etki:** Export preview doğrudan RPC çağrısı ile okunur ve useExportFlow sonucu, pending’i ve refusal’ı React state’te saklar. Ayrı confirm/produce çağrısı bunun okuma sınıfını değiştirmez.
- **Beklenen ve önerilen düzeltme:** oRPC exportPreview.queryOptions + Query 5.108.0 query()/kapsamlı observer. Önizlemeyi hesap ve etkin inceleme kapsamında Query sahibiyle yönet. Önizleme fingerprint’i ile confirm’i bağla ve export verisi için kısa ömür kullan.
- **Diğer konumlar:** `apps/web/src/features/data-export/hooks/use-export-flow.ts:32`, `apps/server/src/features/data-export/server/selected-export.ts:567`.
- **Güven:** yüksek.

#### TK-091 · 79-data-export · @tanstack/react-virtual 3.14.26 `useVirtualizer({ count, getScrollElement, estimateSize, getItemKey: i => records[…

- **Kanıt:** `apps/web/src/features/data-export/ui/components/export-preview-panel.tsx:77`, `{records.map((record) => (`. **Kural:** Kural tablosu: sınırsız/büyük liste → TanStack Virtual; 6.9 `useVirtualizer`, `getItemKey`.
- **Kullanım ve etki:** Önizleme limiti 10.000 satır; liste açıldığında 10.000'e kadar <li> tek seferde max-h-48 kaydırma kutusuna basılıyor.
- **Beklenen ve önerilen düzeltme:** @tanstack/react-virtual 3.14.26 `useVirtualizer({ count, getScrollElement, estimateSize, getItemKey: i => records[i].id })`. RecordsSection içindeki ul'yi useVirtualizer ile sanallaştır; kapalıyken render etmemeyi Base UI Collapsible.Panel'e bırak.
- **Güven:** yüksek. Bileşen yorumu 10.000 satırı açıkça hedefliyor; DOM maliyeti somut.

#### TK-092 · 79-data-export · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/data-export/hooks/use-export-flow.ts:23`, `const [pending, setPending] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. preview/produce `useMutation` `isPending`; mutation `error` → `exportRefusalMessage` (hedefte `isDefinedError`); preview mutation `data` + `variables` (request); produce mutation `data`
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-093 · 80-data-import · applyImport useMutation `onSuccess`: projectWorks/documents/projectRisks/... `key()` geçersizlemesi (trash'teki et…

- **Kanıt:** `apps/web/src/features/data-import/ui/views/import-view.tsx:46`, `const apply = useCallback(`. **Kural:** 6.2 Mutation sonrası varsayılan yol `invalidateQueries({ queryKey: orpc.x.key() })`.
- **Kullanım ve etki:** Apply Import kayıt yazdığı hâlde hiçbir sorgu geçersizlenmiyor.
- **Beklenen ve önerilen düzeltme:** applyImport useMutation `onSuccess`: projectWorks/documents/projectRisks/... `key()` geçersizlemesi (trash'teki etkilenen anahtar listesi örneği). Apply başarısında içe aktarılan aileye ait anahtarları geçersizle.
- **Güven:** orta. Varsayılan staleTime 0 olduğundan /import dışındaki listeler mount'ta yeniden okunuyor; etki o oturumda mount kalmış yüzeylerle sınırlı.

#### TK-094 · 80-data-import · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/data-import/ui/components/import-apply-panel.tsx:41`, `const [state, setState] = useState<ApplyState>({ kind: "idle" });`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. S8-4: eski `shown.input` üzerinden kurulan hızlı satır geçişleri birbirini eziyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. applyImport `useMutation`: `isPending`, `data.status === 'finalizing'`, `data.receipt`, `error`; `useQuery(orpc.reopenImportReceipt.queryOptions({ input: { idempotencyKey } }), enabled:false)` + `refetch()` veya useMutation: `isPending`/`data`/`error`; preview `useQuery(orpc.previewImport.queryOptions({ input }))` (son anahtar kazanır) veya mutation `data`/`variables`; `excludedRows` Form array alanı; preview/cancel mutation `error`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-095 · 80-data-import · excludedRows için Form array alanı (`pushValue`/`removeValue`); önizleme `useQuery(orpc.previewImport.queryOptions…

- **Kanıt:** `apps/web/src/features/data-import/ui/views/import-view.tsx:74`, `excludedRows: toggleExcludedRow(`. **Kural:** TanStack Form `mode="array"` (6.3) + oRPC/Query okuma (6.1/6.2); yoğun etkileşim → Pacer (6.7).
- **Kullanım ve etki:** Final set'ten satır düşürme seçimi sunucu önizleme girdisi olarak useState'te; her tık dosya içeriğinin tamamını (content ≤ IMPORT_MAX_BYTES*4) yeniden yükleyip yeni staging oluşturuyor. İstek dönmeden yapılan ikinci tık eski `shown.input`'tan kurulduğu için ilk düşürme kayboluyor; sıra dışı yanıt eski seçimi gösterebilir.
- **Beklenen ve önerilen düzeltme:** excludedRows için Form array alanı (`pushValue`/`removeValue`); önizleme `useQuery(orpc.previewImport.queryOptions({ input }))` (anahtar değişince eski istek iptal, son anahtar kazanır) veya `LiteDebouncer` ile toplanan geçişler; ideal olarak stagingId üzerinden yeniden önizleme. Seçimi form alanında tut, önizlemeyi anahtarlı query'ye bağla; dosya içeriğini her tıkta yeniden göndermek yerine sunucuda `reopenImportPreview`/stagingId tabanlı yeniden hesap (sunucu kısmı server grubunda).
- **Diğer konumlar:** `apps/web/src/features/data-import/ui/views/import-view.tsx:67`.
- **Güven:** orta. Kayıp seçim kullanıcıya önizlemede görünür ve Apply gösterilen fingerprint'i yazar; veri bozulması değil, etkileşim kaybı ve gereksiz büyük yükleme.

#### TK-096 · 81-personal-data · TanStack Query 5.108 mutation başarı callback’inde `invalidateQueries({ queryKey: orpc.contacts.key() })` ve etkis…

- **Kanıt:** `apps/web/src/features/personal-data-rights/hooks/use-personal-data-erase-flow.ts:61`, `setResult(await onErase(preview, { grant, typedName }));`. **Kural:** Denetim §6.2 mutation sonrası hedefli invalidation ve spec 81’in isim/takma e-posta kaldırma sözleşmesi..
- **Kullanım ve etki:** Silme başarılı olunca makbuz görünür ancak bu akış `contacts` cache’ini değiştirmez. Surface `contactLabel` ile ad veya ilk e-postayı gösterir. Sunucu aynı Contact satırında adı null yapar ve e-posta takma değerleri silinir; açık Contact seçicisi sonraki başarılı refetch’e kadar eski değeri gösterir.
- **Beklenen ve önerilen düzeltme:** TanStack Query 5.108 mutation başarı callback’inde `invalidateQueries({ queryKey: orpc.contacts.key() })` ve etkisi doğrulanmış Contact/önizleme anahtarları.. Silme sonucu geldiğinde etkilenen anahtarları geçersiz kıl. Eski etiketin refetch boyunca görünmemesi gerekiyorsa hassas etiketi cache’den çıkar veya yenileme bitene kadar ilgili seçeneği gizle. Tüm kayıtmış gibi tombstone makbuzunu cache’e yazma.
- **Etkilenen spec’ler:** 81-personal-data, 46-contact-and-company.
- **Diğer konumlar:** `apps/web/src/features/personal-data-rights/ui/components/personal-data-surface.tsx:15`, `apps/web/src/features/personal-data-rights/ui/components/personal-data-surface.tsx:29`, `apps/web/src/features/contacts/lib/contact-label.ts:3`, `apps/server/src/features/personal-data-rights/server/personal-data-erase-database.ts:57`.
- **Güven:** yüksek. Statik olarak cache’in yazmadan sonra açık Contact yüzeyinde eski bilgiyi tutabileceği görülüyor. Yetkisiz bir alıcıya açıklama kanıtı yok. Yenileme, cache güncellemesi veya açık kullanıcılarca görülen türetilmiş cache anahtarları incelenmeli.

#### TK-097 · 81-personal-data · TanStack Virtual 3.14.26 `useVirtualizer` veya ana sayfa kaydırıyorsa `useWindowVirtualizer`; `getItemKey` ve deği…

- **Kanıt:** `apps/web/src/features/personal-data-rights/ui/forms/personal-data-preview-form.tsx:102`, `source.items.map((item) => (`. **Kural:** Denetim §6.9. https://tanstack.com/virtual/latest/docs/api/virtualizer.
- **Kullanım ve etki:** Dışa aktarma ve silme önizlemeleri her kaynak kaydı ve silmede her bulunan kopya için DOM satırı açıyor. Sunucudan bir Contact’ın Feedback, Research ve ilişkili evidence kayıtları adet sınırı olmadan geliyor. Kaynak türlerinin sayısı sabit olsa da iç satır sayısı büyüyor.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26 `useVirtualizer` veya ana sayfa kaydırıyorsa `useWindowVirtualizer`; `getItemKey` ve değişken yükseklikte `measureElement` ile `data-index`.. Kategorileri ve toplamları koruyup büyüyen ayrıntı satırlarını sanallaştır. Kaynak satırında tür + kayıt id, kopyalarda sabit konum kimliği kullan. Klavye ve ekran okuyucuyla tam önizleme erişimini koru.
- **Diğer konumlar:** `apps/web/src/features/personal-data-rights/ui/forms/personal-data-erase-form.tsx:98`, `apps/web/src/features/personal-data-rights/ui/forms/personal-data-erase-form.tsx:113`, `apps/server/src/features/personal-data-rights/server/personal-data-database.ts:62`, `apps/server/src/features/personal-data-rights/server/personal-data-database.ts:111`, `apps/server/src/features/personal-data-rights/server/personal-data-package.ts:334`.
- **Güven:** yüksek. Öğe sayısı büyüdükçe DOM işinin arttığı statik olarak doğrulandı; zaman ölçümü yapılmadı.

#### TK-098 · 81-personal-data · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/personal-data-rights/hooks/use-personal-data-action.ts:13`, `const [pending, setPending] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Export ve Erase’ın ana RPC çağrılarını, ayrıca ayrı identity çağrısını elle sayıyor. Tek boolean eşzamanlı işler için görev kimliği taşımıyor, kapanan incelemenin işi sonradan durumu yazabiliyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. `useQuery`/Query observer `isFetching` ve `useMutation(...).isPending`; popup kolunda Account Access’e kapsamlı Store `useSelector`.; Query/Mutation `error` değerinden görünür metni türet; mutation `reset()` ve yeni preview gözlemcisi/temizliği. Popup hatası Account Access akışında kalır.; `orpc.previewPersonalDataErase.queryOptions({ input })` ve koşullu `useQuery`, `data`.; `useMutation(orpc.erasePersonalData.mutationOptions()).data` ve `reset()`.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-099 · 81-personal-data · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/personal-data-rights/hooks/use-personal-data-erase-flow.ts:29`, `const [grant, setGrant] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Popup çağrısı jestten başlar ve tek kullanımlık grant erase’e kadar elde tutulur. Identity pending, ana busy hesabına katılmıyor. Kullanıcı başka Contact önizlemesine geçtiğinde bekleyen popup yanıtı reset’ten sonra grant’i yazabiliyor. Callback’i aktif inceleme nesline bağla, iptal veya settlement’ta tüket/temizle ve persistence kullanma.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Kısa ömürlü Account Access işlem akışı `useCreateStore`/`createStore` ve `useSelector`; formda yalnız `hasGrant` türet.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-100 · 83-project-retirement · TanStack Virtual 3.14.26 `useVirtualizer` ve veri kimliğine dayalı `getItemKey`.

- **Kanıt:** `apps/web/src/features/project-retirement/ui/components/delete-preview-panel.tsx:48`, `items={preview.group.map(`. **Kural:** Denetim §6.9. https://tanstack.com/virtual/latest/docs/api/virtualizer.
- **Kullanım ve etki:** Delete Project önizlemesi Projeye ait bütün grup kayıtlarını ve dış ilişkileri, Archive önizlemesi de büyüyebilen işler ve Dış yüzeyleri her öğe için bir DOM satırı olarak oluşturuyor. Üretim adaptörü grup ve ilişkileri sayfa sınırı olmadan okur; in-flight adapter etkin kuralları ve hazırlanan dosyaları da listeler.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26 `useVirtualizer` ve veri kimliğine dayalı `getItemKey`.. Grup ve ilişkiler dahil büyüyebilen ayrıntıları sınırlı kaydırma bölgesinde göster. Grup üyeleri için `recordKind + recordId`, ilişki ve iş satırlarında gerekiyorsa contract’a gerçek kimlik ekle. Sabit notices, leaves ve stops normal listede kalabilir.
- **Diğer konumlar:** `apps/web/src/features/project-retirement/ui/components/delete-preview-panel.tsx:77`, `apps/web/src/features/project-retirement/ui/components/archive-preview-panel.tsx:56`, `apps/web/src/features/project-retirement/ui/components/archive-preview-panel.tsx:60`, `apps/server/src/features/project-retirement/server/project-retirement-delete-group-database.ts:36`, `apps/server/src/features/project-retirement/server/project-retirement-delete-group-database.ts:82`, `apps/server/src/features/project-retirement/server/project-retirement-database.ts:224`.
- **Güven:** yüksek. Delete preview `List` şu anda etiket metnini React key yapıyor; aynı etiket mümkün. Sanallaştırmada gerçek satır kimliğini koru.

#### TK-101 · 83-project-retirement · TanStack Virtual 3.14.26. `getItemKey` olarak Project id, `measureElement` + `data-index`.

- **Kanıt:** `apps/web/src/features/project-retirement/ui/views/archive-view.tsx:197`, `{projects.map((entry) => (`. **Kural:** Denetim §6.9. https://tanstack.com/virtual/latest/docs/api/virtualizer.
- **Kullanım ve etki:** Archive bütün arşivlenmiş Projeleri sorgular ve her sonuç için değişken boylu kartı, Dış yüzeyleri ve güvenlik eylemlerini tek DOM ağacına bağlar. Üretim sorgusunda limit/sayfalama yok ve arşiv geçmişi birikebilir.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14.26. `getItemKey` olarak Project id, `measureElement` + `data-index`.. Archive kartlarını kaydırma sahibinde `useWindowVirtualizer` veya `useVirtualizer` ile sanallaştır. Açık preview ve değişken içerik yüksekliğini ölç; kullanıcı odağı olan kartın görünürlüğünü koru. Sunucunun bütün arşiv için yaptığı okuma, DOM sanallaştırmadan ayrı maliyet olarak kalır.
- **Diğer konumlar:** `apps/web/src/features/project-retirement/ui/views/archive-view.tsx:110`, `apps/web/src/features/project-retirement/ui/views/archive-view.tsx:127`, `apps/server/src/features/project-retirement/server/project-retirement-database.ts:140`, `apps/server/src/features/project-retirement/server/project-retirement.ts:396`.
- **Güven:** yüksek. TanStack Table tetikleyicisi yok. Archive’da kullanıcı yönetimli sıralama, filtre, sayfalama veya satır seçimi bulunmuyor; `Delete Project` bir satır eylemi.

#### TK-102 · ortak · useQuery({ ...orpc.plannedTestRelationTargets.queryOptions({ input: { projectId, targetType } }) }) (product-gaps/…

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:40`, `queryKey: ["planned-test-relation-targets", targetType],`. **Kural:** 6.1 Okuma useQuery(orpc.x.queryOptions({ input })); Geçersizleme orpc.x.key() — elle string anahtar yerine.
- **Kullanım ve etki:** Hedef seçicileri enjekte edilen loader'ı elle yazılmış dizi anahtarıyla sorguluyor; oRPC anahtarlarıyla geçersizlenemiyor ve aynı prosedürün anahtarı değişik yerlerde farklı.
- **Beklenen ve önerilen düzeltme:** useQuery({ ...orpc.plannedTestRelationTargets.queryOptions({ input: { projectId, targetType } }) }) (product-gaps/hooks/use-product-gap-link-targets.ts kalıbı: orpc queryOptions + enjekte queryFn).. Beş seçicide queryKey'i orpc.<proc>.queryOptions({ input }).queryKey'den al; gerekirse queryFn enjeksiyonunu use-product-gap-link-targets.ts gibi koru.
- **Etkilenen spec’ler:** 53-test-plan-and-handoff, 55-test-gaps, 56-test-assessments.
- **Diğer konumlar:** `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:46`, `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:49`, `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:453`, `apps/web/src/features/test-assessments/ui/forms/record-test-assessment-form.tsx:66`.
- **Güven:** yüksek.

#### TK-103 · ortak · oRPC + TanStack Query 5.108: useMutation(orpc.<proc>.mutationOptions({ meta: { writeOutcome }, onSuccess: () => in…

- **Kanıt:** `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:51`, `await runOnlineOnlyWrite(() =>`. **Kural:** 6.1 Yazma: useMutation(orpc.x.mutationOptions()); 6.2 bekleme/hata useMutation sonucundan; spec 03 başarısız ana akış support reference + retry gösterir.
- **Kullanım ve etki:** React yüzeylerinden yapılan doğrudan oRPC yazmaları Query MutationCache yaşam döngüsüne katılmıyor. Bu yüzden bazı ekranlarda destek referansı, doğrulanabilir retry, yazmanın tamamlanması ve ortak cache güncellemesi ayrı ayrı yönetiliyor. group refs ve konumlar doğrulanan çağrı zincirlerini gösterir.
- **Beklenen ve önerilen düzeltme:** oRPC + TanStack Query 5.108: useMutation(orpc.<proc>.mutationOptions({ meta: { writeOutcome }, onSuccess: () => invalidateQueries({ queryKey: orpc.<list>.key() }) })); formlar mutateAsync çağırır.. Her bağlanan prosedürü oRPC mutationOptions veya gerekçeli çoklu mutationFn ile Query yaşam döngüsüne al. Formlar mutateAsync’i beklesin. Online-only / Update required, kesinleştirme makbuzu, idempotency, cache süresi ve hassas parametre sınırları korunsun. Salt okunur preview’ları ayrı query() veya useQuery olarak ele al.
- **Etkilenen spec’ler:** 03-web-macos-client, 09-work-lifecycle, 04-mutation-and-undo, 11-work-drafts, 38-decisions, 31-documents, 33-record-discovery, 36-return-to-work, 37-goals, 40-risks, 47-feedback, 41-uncertainty-records, 42-validation-records, 43-research-sessions, 44-sources-and-freshness, 45-evidence, 48-screens-and-wireframes, 49-user-flow, 61-github-integration, 63-release-planning, 64-release-evidence, 66-production-incidents, 69-project-updates, 73-link-sharing, 76-external-surface-management, 77-trash, 78-security-redaction, 79-data-export, 80-data-import, 81-personal-data, 01-account-access, 51-project-wall, 52-spec-change-review, 53-test-plan-and-handoff, 54-test-report-acceptance, 55-test-gaps, 56-test-assessments, 57-test-review-and-follow-up, 58-product-gaps.
- **Diğer konumlar:** `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:105`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:112`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:137`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:147`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:166`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:180`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:194`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:232`, `apps/web/src/features/planned-tests/ui/components/planned-tests-surface.tsx:240`, `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:104`, `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:115`, `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:142`, `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:149`, `apps/web/src/features/project-wall/ui/components/project-wall-surface.tsx:62`, `apps/web/src/features/test-assessments/ui/components/test-assessments-surface.tsx:50`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:84`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:110`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:122`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:131`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:140`, `apps/web/src/features/test-gaps/ui/components/test-gaps-surface.tsx:149`, `apps/web/src/features/test-report/ui/components/test-sessions-surface.tsx:45`, `apps/web/src/features/test-report/ui/components/test-sessions-surface.tsx:60`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:80`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:99`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:110`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:123`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:134`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:156`, `apps/web/src/features/spec-change-review/ui/components/spec-change-review-surface.tsx:74`, `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:113`, `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:85`, `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:87`, `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:127`, `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:674`, `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:809`, `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:877`, `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:552`, `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:553`, `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:63`, `apps/web/src/features/decisions/ui/components/project-decisions-surface.tsx:73`, `apps/web/src/features/decisions/ui/components/project-decisions-surface.tsx:102`, `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:58`, `apps/web/src/features/project-goals/ui/components/project-goals-surface.tsx:35`, `apps/web/src/features/project-goals/ui/components/project-goal-membership.tsx:22`, `apps/web/src/features/risks/ui/components/project-risks-surface.tsx:59`, `apps/web/src/features/documents/ui/forms/document-evidence-form.tsx:125`, `apps/web/src/features/documents/ui/forms/document-evidence-form.tsx:160`, `apps/web/src/features/documents/ui/forms/document-evidence-role-form.tsx:49`, `apps/web/src/features/return-to-work/ui/forms/next-concrete-step-form.tsx:37`, `apps/web/src/features/return-to-work/ui/components/return-to-work.tsx:39`, `apps/web/src/features/record-discovery/hooks/use-record-table-writes.ts:22`, `apps/web/src/features/feedback/ui/components/feedback-surface.tsx:36`, `apps/web/src/features/feedback/ui/components/feedback-surface.tsx:42`, `apps/web/src/features/feedback/ui/components/feedback-surface.tsx:59`, `apps/web/src/features/feedback/ui/components/feedback-surface.tsx:83`, `apps/web/src/features/feedback/ui/components/feedback-surface.tsx:109`, `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-surface.tsx:84`, `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-surface.tsx:90`, `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-surface.tsx:123`, `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:75`, `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:88`, `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:113`, `apps/web/src/features/validation-records/ui/components/validation-records-surface.tsx:86`, `apps/web/src/features/validation-records/ui/components/validation-records-surface.tsx:92`, `apps/web/src/features/validation-records/ui/components/validation-records-surface.tsx:107`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:55`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:65`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:110`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:139`, `apps/web/src/features/sources-and-freshness/ui/components/source-recheck-controls.tsx:56`, `apps/web/src/features/sources-and-freshness/ui/components/source-recheck-controls.tsx:88`, `apps/web/src/features/sources-and-freshness/ui/components/project-sources-surface.tsx:46`, `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:137`, `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:150`, `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:98`, `apps/web/src/features/screens/ui/components/screens-surface.tsx:22`, `apps/web/src/features/screens/ui/components/screens-surface.tsx:32`, `apps/web/src/features/screens/ui/components/screens-surface.tsx:38`, `apps/web/src/features/screens/ui/components/screens-surface.tsx:57`, `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:151`, `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:155`, `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:173`, `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:202`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:62`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:69`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:80`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:111`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:132`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:158`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:179`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:197`, `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:232`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:151`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:63`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:76`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:88`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:108`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:121`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:141`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:153`, `apps/web/src/features/project-release-planning/hooks/use-project-release-command.ts:36`, `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:75`, `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:112`, `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:154`, `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:193`, `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:216`, `apps/web/src/features/project-release-planning/ui/components/project-releases-surface.tsx:44`, `apps/web/src/features/release-evidence/ui/components/release-evidence-pack-surface.tsx:48`, `apps/web/src/features/release-evidence/ui/components/release-evidence-pack-surface.tsx:54`, `apps/web/src/features/release-evidence/ui/components/release-evidence-pack-surface.tsx:60`, `apps/web/src/features/release-evidence/ui/components/release-evidence-pack-surface.tsx:66`, `apps/web/src/features/release-evidence/ui/views/release-evidence-pack-view.tsx:96`, `apps/web/src/features/release-evidence/ui/views/release-evidence-pack-view.tsx:106`, `apps/web/src/features/release-evidence/ui/views/release-evidence-pack-view.tsx:158`, `apps/web/src/features/production-incidents/hooks/use-production-incident-command.ts:41`, `apps/web/src/features/production-incidents/ui/components/production-incidents-surface.tsx:44`, `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:85`, `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:109`, `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:127`, `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:147`, `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:167`, `apps/web/src/features/project-updates/hooks/use-create-project-update.ts:24`, `apps/web/src/features/project-updates/ui/components/project-updates-surface.tsx:127`, `apps/web/src/features/project-updates/ui/components/project-updates-surface.tsx:136`, `apps/web/src/features/link-sharing/hooks/use-share-access.ts:14`, `apps/web/src/features/link-sharing/hooks/use-approve-share-scope.ts:16`, `apps/web/src/features/external-surface-management/hooks/use-remove-external-surface.ts:8`, `apps/web/src/features/trash/hooks/use-idempotent-trash-write.ts:50`, `apps/web/src/features/data-import/hooks/use-apply-import.ts:7`, `apps/web/src/features/data-import/hooks/use-preview-import.ts:6`, `apps/web/src/features/data-export/hooks/use-export-requests.ts:6`, `apps/web/src/features/data-export/hooks/use-export-requests.ts:13`, `apps/web/src/features/security-redaction/hooks/use-security-redaction.ts:12`, `apps/web/src/features/link-sharing/ui/forms/share-password-form.tsx:49`, `apps/web/src/features/external-surface-management/ui/components/remove-surface-control.tsx:52`, `apps/web/src/features/personal-data-rights/hooks/use-personal-data-requests.ts:13`, `apps/web/src/features/personal-data-rights/hooks/use-personal-data-requests.ts:23`, `apps/web/src/features/personal-data-rights/hooks/use-personal-data-requests.ts:34`, `apps/web/src/features/personal-data-rights/hooks/use-personal-data-requests.ts:58`, `apps/web/src/features/personal-data-rights/hooks/use-personal-data-action.ts:16`, `apps/web/src/features/personal-data-rights/ui/forms/personal-data-erase-form.tsx:46`.
- **Güven:** yüksek. React dışı tek kullanım, platform HTTP ve açıkça ayrılmış transport işleri kapsam dışı. State envanteri doğrudan hangi bekleme, sonuç ve hata alanlarının taşınacağını gösterir.

#### TK-104 · ortak · query: anahtar çağrı yerinde üretilip variables içinde taşınır (work-duplicate-form.tsx:46 ve work-checklist-edito…

- **Kanıt:** `apps/web/src/features/work-templates/hooks/use-work-templates.ts:41`, `clientIdempotencyKey: crypto.randomUUID(),`. **Kural:** 6.2 bekleme/sonuç `variables` üzerinden; global MutationCache retry `mutation.execute(mutation.state.variables)` ile aynı variables'ı yeniden yürütür. Spec 17/ADR-0004: kullanıcı komutu idempotency anahtarı taşır.
- **Kullanım ve etki:** Work Template oluşturma/instantiate, Priority yazmaları ve Tag Undo, clientIdempotencyKey’i mutationFn içinde üretiyor. Global Retry aynı variables ile execute etse de yeni UUID oluşturuluyor; aynı komut için makbuz kimliği korunmuyor.
- **Beklenen ve önerilen düzeltme:** query: anahtar çağrı yerinde üretilip variables içinde taşınır (work-duplicate-form.tsx:46 ve work-checklist-editor conversion pendingConversion örneği doğru); mutationFn yalnız variables.clientIdempotencyKey kullanır.. UUID’yi kullanıcı komutu kurulurken üret ve onay/tekrar boyunca mutation variables içinde aynı tut. Sunucu Mutation Contract kapsamı ve baseRevision girişlerini koru.
- **Etkilenen spec’ler:** 13-tags, 17-work-templates, 20-priority, 12-relations, 14-file-attachments.
- **Diğer konumlar:** `apps/web/src/features/work-templates/hooks/use-work-templates.ts:29`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:40`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:83`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:147`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:221`, `apps/web/src/features/web-macos-client/lib/client-shell.ts:59`, `packages/api/src/routers/index.ts:10448`.
- **Güven:** orta. Bağımsız kontrol Y önerdi. Support Reference yalnız kesin not-written için Retry verir; belirsiz sonuç tekrar edilmiyor. Bu yol için iki commit kanıtı olmadığından O.

#### TK-105 · ortak · Ortak hatalar base builder'da: `const base = os.$context<Context>().errors({ CONFLICT: { data: conflictDataSchema …

- **Kanıt:** `packages/api/src/routers/index.ts:1387`, `throw new ORPCError(status, {`. **Kural:** 6.1 oRPC: 'Beklenen iş hataları: .errors({ CODE: { data, message } }) + throw errors.CODE(...). İstemcide isDefinedError(e).' Yerine geçtiği kalıp: mesaj metni ayrıştırma.
- **Kullanım ve etki:** Repoda .errors(), isDefinedError ve safe hiç yok. 670 new ORPCError'ın 270'i elle `defined: true` ile atılan typed iş hatası (165'i data.code taşıyor); bunlar ~60 rethrow*/map*/run*Operation yardımcısında domain hatasından eşleniyor (mapWorkLifecycleError 23, mapRelationsError 10, refusal 8, rethrowRecordActionError 7, rethrowPriorityMetricMutationError 7, ...). Ayrıca 32 typed-olmayan iş hatası (CONFLICT/BAD_REQUEST, data yok; örn. technical diagrams 7069-7466, rethrowFocusPeriodError mesajla ayrım) var. İstemciler hatayı tipsiz okuyor: `(error as { data?: { code?: unknown } })?.data?.code` (export-refusal.ts:9, personal-data-refusal.ts:17), `isRecord(error.data) ? error.data : error` (use-security-redaction-flow.ts:26), mesaj eşleştirme (focus-periods-view.tsx:101-117). Kalan kök dağılımı: 186 dependency-guard (SERVER-3), 156 status-only NOT_FOUND (standart, ihlal değil), 23 feature adaptöründe transport hatası (SERVER-4), 2 UNAUTHORIZED.
- **Beklenen ve önerilen düzeltme:** Ortak hatalar base builder'da: `const base = os.$context<Context>().errors({ CONFLICT: { data: conflictDataSchema }, PRECONDITION_FAILED: { data: staleRevisionDataSchema } })`; feature'a özel kodlar prosedürde `.errors({ SECURITY_REDACTION_TYPED_NAME_MISMATCH: { status: 400, message: ... } })` ve handler'da `throw errors.X(...)`. İstemci `isDefinedError(error) && error.code === ...` ile daraltır. `defined: true` elle yazılmaz (v2'de seçenek kalkıyor, bkz. 2. bölüm).. Feature bazlı kademeli geçiş: önce istemcinin kod okuduğu akışlar (78 security-redaction, 81 personal-data, 79 data-export, 83 project-retirement, 73 link-sharing, 30 focus-period mesaj eşleşmesi), sonra mutation çakışmaları için base .errors(); rethrow* yardımcıları `errors` nesnesini alacak şekilde daraltılır. SERVER-1 ile birlikte yapılmalı; aksi halde tanımlanan kodlar yine zarfta silinir.
- **Etkilenen spec’ler:** 03-web-macos-client, 30-focus-period, 73-link-sharing, 75-build-in-public, 78-security-redaction, 79-data-export, 81-personal-data, 83-project-retirement.
- **Diğer konumlar:** `packages/api/src/routers/index.ts:2384`, `packages/api/src/routers/index.ts:2933`, `packages/api/src/routers/index.ts:1160`, `packages/api/src/routers/index.ts:4925`, `packages/api/src/routers/index.ts:7069`, `packages/api/src/project-retirement-handlers.ts:52`, `packages/api/src/personal-data-rights-handlers.ts:47`, `packages/api/src/data-export-handlers.ts:30`, `packages/api/src/link-sharing.ts:513`, `apps/web/src/features/data-export/lib/export-refusal.ts:9`, `apps/web/src/features/account-preferences/lib/account-preferences-mutation-error.ts:26`, `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:63`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:110`, `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:22`, `apps/web/src/features/data-export/lib/export-refusal.ts:8`, `packages/api/src/routers/index.ts:4936`.
- **Güven:** yüksek. Ayrı önem: tek başına etki tip güvenliği ve tutarlılık; kullanıcıya görünen etki SERVER-1'de sayıldı. Sınıflandırma AST ile yapıldı (/tmp/cantiara-audit-a548a2c8/server-work/orpc-cls.ndjson). 'İlk hata mesajı, yoksa yedek metin' (PR #540, ~23 tekrar) istemci tarafı tekrarının kökü bu tipsiz hata sözleşmesidir; web grupları bu kimliğe atıf yapabilir.

#### TK-106 · ortak · React state → oRPC / Query

- **Kanıt:** `apps/web/src/components/work-status-form.tsx:89`, `const [selectedStatus, setSelectedStatus] = useState<WorkStatus>(work.status);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Mutation sonucu state'e kopyalanıyor (6.2).
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Normal Status eyleminde mutation.variables ve güncel Work verisi; gönderilen Close girdileri Form’da.; previewClose.data; iptal/başarıda previewClose.reset(); updateStatus/previewClose/closeWork/reopenWork .error; closeForm safeParse hatası için setErrorMap({ onSubmit })
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-107 · ortak · TanStack Query 5.108 invalidateQueries({ queryKey: orpc.technicalDiagrams.key() }) ve ilgili orpc.technicalDiagram…

- **Kanıt:** `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:59`, `const invalidate = () => queryClient.invalidateQueries();`. **Kural:** 6.2 Mutation sonrası varsayılan yol invalidateQueries({ queryKey: orpc.x.key() }); 6.1 Geçersizleme orpc.x.key().
- **Kullanım ve etki:** Technical Diagrams layout kaydı, Decision/kanit değişiklikleri ve Project Archive ailesi anahtarsız invalidateQueries çağırıyor. Aynı QueryClient üzerindeki etkin ve ilgisiz okumalara da yeniden istek gider. Layout sürükleme bitişi sık çalışabilen tetikleyici.
- **Beklenen ve önerilen düzeltme:** TanStack Query 5.108 invalidateQueries({ queryKey: orpc.technicalDiagrams.key() }) ve ilgili orpc.technicalDiagramViews/Versions/RecordCards.key(); schema-artifacts için orpc.migrationArtifacts.key().. Her mutasyonun etkilediği prosedürlerin .key() öneklerini ve gerekli çapraz üyelikleri tanımla. Ortak geçersizleme işlevine yalnız sahibi belli anahtarları ver.
- **Etkilenen spec’ler:** 45-evidence, 38-decisions, 59-technical-diagrams, 83-project-retirement, 43-research-sessions, 36-return-to-work, 77-trash, 60-schema-artifacts.
- **Diğer konumlar:** `apps/web/src/features/technical-diagrams/ui/forms/diagram-authority-conversion-form.tsx:133`, `apps/web/src/features/technical-diagrams/ui/forms/new-technical-diagram-form.tsx:65`, `apps/web/src/features/technical-diagrams/ui/forms/diagram-view-form.tsx:29`, `apps/web/src/features/schema-artifacts/ui/components/change-draft.tsx:132`, `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:77`, `apps/web/src/features/return-to-work/ui/forms/next-concrete-step-form.tsx:66`, `apps/web/src/features/project-retirement/hooks/use-project-retirement.ts:41`, `apps/web/src/features/project-retirement/hooks/use-project-retirement.ts:60`, `apps/web/src/features/project-retirement/hooks/use-project-retirement.ts:85`.
- **Güven:** yüksek. Somut etki: her diyagram düzen kaydı, yapı kaydı, kart taşıma ve sürüm işleminde uygulamadaki tüm aktif sorgular (kabuk, tercihler, diğer feature listeleri) yeniden çekiliyor. Aynı kalıp gruplar dışı: research-sessions, project-retirement, uncertainty-records, decisions, return-to-work (ilgili gruplara ait).

### Düşük

#### TK-108 · 01-account-access · TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/account-access/lib/auth-session-check.ts:97`, `let sessionCheckRetryConsumed = false;`. **Kural:** Raporun React state kuralı.
- **Kullanım ve etki:** AST listesi dışı render durumu. AuthRouteErrorView satır 50 değeri canRetry için doğrudan okur.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Account Access store ve useSelector; Retry hakkı tüketilince hata görünümü güncellenir, loader başarıyla tamamlandığında sıfırlanır. Router yükleme durumu ayrı seçilir.
- **Güven:** yüksek.

#### TK-109 · 01-account-access · React state → Router search

- **Kanıt:** `apps/web/src/features/account-access/ui/views/auth-route-error-view.tsx:21`, `const [isRetrying, setIsRetrying] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. useRouterState({ select: state => state.isLoading }); loader yenilemesi router.invalidate() olarak kalır. Retry hakkı ilgili deneme kimliğiyle ayrı izlenir.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-110 · 01-account-access · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/account-access/ui/views/github-sign-in-view.tsx:16`, `const [isWaitingForGitHub, setIsWaitingForGitHub] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Better Auth SDK kalır; kullanılırsa yalnız Query mutation yaşam döngüsü sarmalar. GitHub OAuth oRPC’ye taşınmaz.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Better Auth taşıması korunur; TanStack Query mutation yalnız bekleme ve sonuç yaşam döngüsünü sarmalar.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-111 · 02-account-preferences · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:117`, `const [isOnline, setIsOnline] = useState(getOnlineState);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useClientShellConnection; online/offline olaylarının ikinci aboneliği yerine Client Shell bağlantı durumunu oku.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-112 · 02-account-preferences · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:258`, `useState<AccountPreferencesMutationError | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Şema hatasını formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile göster. Uzaktaki çatışma biçimini savePreferences.error üzerinden türet.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-113 · 02-account-preferences · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:259`, `const [suggestion, setSuggestion] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. getBrowserPreferenceSuggestion çıktısını tarayıcı ortamından hesapla. SSR gerekirse sabit sunucu snapshot'ı ve aynı tarayıcı girdisinin istemci snapshot'ı kullanılır.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-114 · 05-command-palette · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/command-palette/ui/components/command-palette.tsx:98`, `const [commandStack, setCommandStack] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Alt komut katmanları ve geri düğmesi için paletin geçici oturum Store'u ve useSelector.; Genel komut çalıştırıcısının sonuç durumu; ortak palet oturumu Store'u ve useSelector. Gerçek RPC komutunun hatası kendi mutation'ında kalır.; Palet oturum Store'u ve useSelector; executeCommand navigasyon ve eşzamanlı komut da çalıştırdığından bütün komutları Query mutation'ına dönüştürme.; Palet oturum Store'u/useSelector; başlangıç komutu ve komut arama girdisi, URL'ye taşınmaz.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-115 · 05-command-palette · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/command-palette/ui/components/command-palette.tsx:103`, `const [recordsReady, setRecordsReady] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. İlk paint sonrasına ertelenen sonuç montajı; requestAnimationFrame odak işi meşru. Paint sonrası render kapısı için stack'te açık sahip yok.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-116 · 06-capture-triage · useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index

- **Kanıt:** `apps/web/src/features/capture-triage/ui/components/extension-links-section.tsx:98`, `links.data.map((link) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Liste yalnız revokedAt filtresini uygulayan veri yolundan geliyor. Yaş nedeniyle yeniden eşleştirme gerekmesi listedeki kaydı kaldırmıyor ve bağlantı sayısı için cap yok.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index. Uzantı bağlantısı kimliğini sabit key yap ve görünür satırları ölçerek render et.
- **Etkilenen spec’ler:** 06-capture-triage, 01-account-access.
- **Diğer konumlar:** `apps/server/src/features/capture-triage/server/web-capture-database.ts:186`.
- **Güven:** yüksek. Az sayıda tarayıcı kullanımında etkisi sınırlı. WXT tarafında çift kayıt yok.

#### TK-117 · 06-capture-triage · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:41`, `const [link, setLink] = useState<StoredWebCaptureLink | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Popup, pairing ve send formu yerel Uzantı bağlantısı özetini paylaşır. Kalıcı bağlantı tarayıcı deposunda kalır. Bağlantı kimliğini, başarı zamanını ve sunucu hedef sorgusunun kapsamını ayır. Tokenı sorgu anahtarına veya TanStack cache içine kopyalama.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. TanStack Store createStore, useSelector; WXT browser.storage.local; TanStack Store createStore/useSelector; popup ömrü için useCreateStore; TanStack Store createStore + useSelector(s => s.linkLoadStatus); useCreateStore ve useSelector; satırdaki üç çıkış, öneri, kurulum ve önizleme panelleri arasında geçici triage adımını koordine et.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-118 · 06-capture-triage · React state → TanStack Form

- **Kanıt:** `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:44`, `const [targetSearch, setTargetSearch] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Search Inbox girdisi Send formunda. Ham terim form alanı olur; gecikmeli normalize terim Pacer ile sorgunun girdisi olur. URL durumu gerekmiyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form form.Field ve form.Subscribe veya Form useSelector; TanStack Form form.Subscribe(s => s.isSubmitting); Kurulum useForm örneğini adım geçişlerinde yaşat; form.Field ve reset ile seçili Project/tür. Önizleme değişkenleri ayrıca useMutation.variables üzerinden okunabilir.; Kurulum useForm örneğinde relation ve targetId; öneri seçiminde setFieldValue, apply için onaylanan preview değişkenlerini kullan.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-119 · 06-capture-triage · React state → Hesaplanan değer

- **Kanıt:** `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:45`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Tek metin bağlantı yükleme, aktif sekme, hedef listesi, yerel doğrulama ve pair/send hatalarını karıştırıyor. Görünür hata ilgili işlemin türlenmiş durumundan türetilir; öncelik ve temizlenme olayı açık kalır.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. Form setErrorMap ve form.Subscribe; Query useQuery/useMutation error; yerel WXT işlem hatasına Store useSelector; TanStack Query useMutation().isSuccess/data/reset; Oturum Store'unda yalnız sıralı öğe kimlikleri ve çözülenleri tut; geçerli kayıt için Inbox cache seçicisi. Çözülmüş kartı görme garantisi gerekiyorsa o kayıt için sınırlı oturum snapshot'ı tasarla.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-120 · 06-capture-triage · React state → Base UI

- **Kanıt:** `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:460`, `const [captureComposerOpen, setCaptureComposerOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. DialogTrigger veya Dialog.createHandle ile aç, başarılı onSaved sonrasında Dialog actionsRef.close(); hata halinde açık kalır.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-121 · 07-project-shell · useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index

- **Kanıt:** `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:648`, `configuration.preparedStages.map((stage, index) => (`. **Kural:** 6.9, TanStack Virtual 3.14.26 — https://tanstack.com/virtual/latest/docs/framework/react/react-virtual.
- **Kullanım ve etki:** Hazır aşamalar kullanıcı ekledikçe büyür. projectStagesSchema kimlik eşsizliğini denetler, uzunluk sınırı yoktur. Her aşama ayrı StageNameForm ve düzenleme kontrolleri bağlar.
- **Beklenen ve önerilen düzeltme:** useWindowVirtualizer, getItemKey ve değişken satır için measureElement/data-index. Yalnız görünür aşama satırlarını ölç ve kimlikle anahtarla. Sıra oklarının anlamını modelin tam sırası üzerinden koru.
- **Diğer konumlar:** `packages/api/src/project-shell.ts:248`.
- **Güven:** yüksek. Ok düğmeleri sürükleme değildir. Aşama sırası ortak sunucu verisidir.

#### TK-122 · 07-project-shell · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-shell/hooks/use-project-area-enable.ts:10`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. mutation.error üzerinden sabit kullanıcı metnini türet, gerektiğinde mutation.reset.; mutation.error üzerinden geçerli hatayı türet; mutation başladığında önceki sonuç doğal olarak değişir.; updateShortCode.error içindeki yapılandırılmış etiketi oku ve düzenleme açılışında mutation.reset.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-123 · 07-project-shell · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:556`, `const [showExplanation, setShowExplanation] = useState(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore/useSelector ve Project kimliğiyle kalıcı kapatma tercihine bağla; yerel depolama burada sekme sonrası tercihin kalıcılık sınırı.; useCreateStore/useSelector ve Configuration Mode başına başlangıç Project areas; alt masaüstü/mobil seçiciler ve içerik bu geçici seçimi paylaşır. Modun hash sözleşmesini koru.; Project Work oturumu Store'u; useCreateStore/useSelector ile Kanban'dan Work kaydına tek tüketimli kapanış isteği. Kaydın kimliği URL hash'inde kalır.; Project aşama düzenleme yüzeyi Store'u; useCreateStore/useSelector ile aynı anda tek satırın inline silme onayı. Diyalog olursa Base UI createHandle<stageId> uygun.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-124 · 07-project-shell · React state → Router search

- **Kanıt:** `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:931`, `const [selectedWorkView, setSelectedWorkView] = useState<"Board" | "List">(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Project route validateSearch ve Zod Board/List enum, Route.useSearch + navigate({ search }); geri/reload sonrası aynı görünüm.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-125 · 07-project-shell · React state → Base UI

- **Kanıt:** `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:92`, `const [restorePreviewOpen, setRestorePreviewOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Inline Navigation preview için kontrolsüz Collapsible veya doğrulama diyalogu açılırsa Dialog Trigger/actionsRef.close; yazma başarısına bağlı kapanış.; Inline editör açılımını Collapsible veya uygun Dialog primitive'ine ver; başarılı Short code kaydı ve Cancel ile kapat.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-126 · 07-project-shell · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/project-shell/ui/forms/project-create-form.tsx:88`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. formApi.setErrorMap ve form.Subscribe; sunucu hatasını mutation.error, dosya hatasını logo alanı hata haritası üzerinden dağıt.; FileReader taşıması korunur. Dosya işini Form alanının async doğrulama akışına al ve field meta.isValidating veya form.Subscribe ile düğme durumunu türet.; shortCode alan doğrulaması veya formApi.setErrorMap({ onSubmit }); form.Field ve form.Subscribe hatayı gösterir.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-127 · 08-project-overview · Kaynak feature lib/ altında saf route hedefi veya ortak route helper.

- **Kanıt:** `apps/web/src/features/project-overview/ui/components/project-overview-surface.tsx:5`, `import { projectGoalsHref } from "@/features/project-goals/ui/components/project-goals-view";`. **Kural:** structure.md › Imports.
- **Kullanım ve etki:** Proje genel bakışı, Goals ve Risks ekran modüllerine yalnız derin bağlantı fonksiyonları için bağımlı. Kaynak ekran değişiklikleri Overview bağımlılığına dönüşüyor.
- **Beklenen ve önerilen düzeltme:** Kaynak feature lib/ altında saf route hedefi veya ortak route helper.. projectGoalsHref ve riskHref fonksiyonlarını kaynak feature lib/ yoluna al ve UI ile Overview aynı saf fonksiyonu tüketsin.
- **Diğer konumlar:** `apps/web/src/features/project-overview/ui/components/project-overview-surface.tsx:8`.
- **Güven:** yüksek.

#### TK-128 · 09-work-lifecycle · React state → Router search

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:97`, `const [showArchived, setShowArchived] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Project route validateSearch ile archived filtresi, useSearch ve navigate({ search }); hash ile açılan kayıt için arşiv durumu bir kez normalize edilir.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-129 · 09-work-lifecycle · React state → Base UI

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:99`, `const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. BulkEditDialog içinde kontrolsüz Dialog, gerektiğinde harici trigger için Dialog.createHandle; seçili Work kimlikleri zaten Store'da kalır.; Merge inline paneli için kontrolsüz Collapsible veya Dialog trigger/actionsRef.close; başarılı apply sonrasında kapat, iptalde formu sıfırla.; Recreate inline paneli için kontrolsüz Collapsible veya Dialog trigger ve Close; adım değişiminde form ve preview reset sürdürülür.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-130 · 09-work-lifecycle · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:639`, `const [selectedType, setSelectedType] = useState<WorkType>(work.type);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Type seçenek girdisi; RPC pending/preview verisi değildir.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form form.Field ve form.Subscribe; gerekirse setErrorMap.; Alan çözümlemesi ve payload hatası formApi.setErrorMap, ulaşım hatası preview/apply mutation.error.; Zod hatası formApi.setErrorMap, preview/apply hataları ilgili mutation.error.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-131 · 10-custom-fields · orpc.customFieldValues.queryOptions({ input: recordId ? { projectId, recordId, recordType } : skipToken }) + enabl…

- **Kanıt:** `apps/web/src/lib/use-custom-fields.ts:130`, `recordId: recordId ?? "new-record",`. **Kural:** 6.1 Okuma: koşullu okuma için input: cond ? … : skipToken.
- **Kullanım ve etki:** Kayıt yokken sahte 'new-record' input'u ile queryKey üretilip enabled ile kapatılıyor; invalidate de bu sahte anahtarı hedefliyor.
- **Beklenen ve önerilen düzeltme:** orpc.customFieldValues.queryOptions({ input: recordId ? { projectId, recordId, recordType } : skipToken }) + enabled: options.enabled ?? true. skipToken'a geç; invalidate'te recordId yoksa customFieldValues anahtarını atla veya orpc.customFieldValues.key({ input: { projectId } }) kısmi anahtarını kullan.
- **Güven:** yüksek. Fonksiyonel hata yok; sahte input tip güvenli koşullu okumayı atlıyor.

#### TK-132 · 10-custom-fields · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:108`, `const [value, setValue] = useState(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. useForm ve form.Field; Text taslağını geçerli kayıt sürümünden ayrı koru, değiştiğinde doğrula ve blur kaydını await et.; useForm ve form.Field; Number taslağı ve sayısal doğrulama, boş değer ile geçersiz sayıyı ayır ve blur kaydının hatasını alanda göster.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-133 · 10-custom-fields · React state → Base UI

- **Kanıt:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:185`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Kontrolsüz Popover ve actionsRef.current?.close(); mevcut PopoverTrigger korunur. Popover.Close da uygun düğmeler için primitive olarak kullanılabilir.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-134 · 10-custom-fields · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:312`, `const [actionError, setActionError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. values.setValue.error/clearValue.error ve reset; en son girişime ait hatayı göster. Taslak callback sunucu hatası üretmiyor.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-135 · 11-work-drafts · React state → Base UI

- **Kanıt:** `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:171`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Popover kontrolsüz + seçimde Popover.Close / actionsRef.current?.close()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-136 · 11-work-drafts · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:233`, `const [text, setText] = useState(externalText);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Ham sayı metni form alanı (customFieldValues yanında raw text alanı); render sırasında setState senkronu kaldırılır; Taslak kimliği gizli form alanı (draftIdRef ile çift kaynak); render yalnız truthy kontrolü; Spec 11: hedef Proje form üzerinde seçilir → form alanı; prop senkronu useEffect yerine form.reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-137 · 12-relations · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/relations/ui/components/work-relations.tsx:46`, `const [preview, setPreview] = useState<RelationPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewMutation.data (reset() ile temizleme); removeMutation.data + variables (Undo makbuzu); undo sonrası removeMutation.reset(); previewMutation/createMutation/removeMutation/resolveMutation/reactivateMutation/undoMutation .error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-138 · 12-relations · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/relations/ui/components/work-relations.tsx:47`, `const [createIdempotencyKey, setCreateIdempotencyKey] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sabit command kimliği render’a girmiyor; preview ile beraber resetlenir.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-139 · 12-relations · React state → Base UI

- **Kanıt:** `apps/web/src/features/relations/ui/components/work-relations.tsx:686`, `const [isResolving, setIsResolving] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Spec 19 'Mark blocker resolved'
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible (Mark blocker resolved satır içi formu); başarıda kapanma kontrollü open gerektirir
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-140 · 13-tags · React state → Router search

- **Kanıt:** `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:78`, `const [filterTagId, setFilterTagId] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. validateSearch (Zod tagId .catch) + Route.useSearch() + navigate({ search: prev => ({ ...prev, tagId }) }) — spec 13 etiket filtresi
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-141 · 13-tags · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:79`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. CreateTagForm setErrorMap + create.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-142 · 13-tags · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:80`, `const [actionError, setActionError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. apply.error / remove.error; rename.error / undoRename.error; rename.data (receiptId, tag.revision); undo sonrası rename.reset()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-143 · 14-file-attachments · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:312`, `const [surfaceSize, setSurfaceSize] = useState(fallbackSize);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Canlı canvas ölçümü; tanımlı hedef yok
- **Beklenen ve önerilen düzeltme:** Sahipsiz. ResizeObserver ile ölçülen DOM boyutu; Konva Stage width/height girdisi. Sahibi yok (Pacer gerekmez: tetiklenen iş yalnız yeniden çizim).; Sahip kararı gerekli; 16. bölüm.; img naturalWidth/canvas boyutu (load + ResizeObserver) ölçümü; objectContainBox girdisi; Konva pointer çizim taslağı (canlı imleç etkileşimi); tamamlanınca onCreateMarking mutation'ına dönüşür
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-144 · 14-file-attachments · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:578`, `const [tool, setTool] = useState<FileAttachmentMarkingTool>("pen");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Açılır pencere değil, satır içi panel
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore (bileşen ömrü) veya createStoreContext: araç çubuğu, MarkupSurface ve PDF sayfaları (render prop) aynı değeri paylaşıyor; Binder paneli + yüzey seçim modu paylaşıyor: tool ile aynı useCreateStore; panel tek başına olsaydı Base UI Collapsible; Video.js React 10.5 player store'u (PlaybackRate / PlaybackRateRadioGroup UI) — TanStack Store değil, stack'teki Video.js sahibi
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-145 · 14-file-attachments · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:579`, `const [markingError, setMarkingError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Alt aşama için Uppy/Query'de hazır alan yok; kısmen sahipsiz
- **Beklenen ve önerilen düzeltme:** oRPC / Query. createMarkingMutation.error / undoMarkingMutation.error (file-attachment-preview.tsx) — reset() ile temizleme; useQuery({queryKey,queryFn:({signal})=>fetchFileAttachmentAsset(path,signal)}) — bkz. spec-2-2; query.refetch() — bkz. spec-2-2; previewLocationMutation.data (file-attachment-preview.tsx:648) — onPreview mutateAsync sonucu kopyalanıyor
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-146 · 14-file-attachments · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:581`, `const [locationKind, setLocationKind] = useState<LocationKind>("point");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. file-attachment-location-form useForm alanı (point/region); yüzey seçimi form.setFieldValue ile yazar; Bind as origin konumu gönderilen formun değeri: location form'un x/y/width/height/page alanları tek kaynak; şu an useState + useEffect setFieldValue ile çift kaynak; formApi.setErrorMap({ onSubmit }) + form.Subscribe errorMap.onSubmit; sunucu hatası mutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-147 · 14-file-attachments · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-pdf.tsx:52`, `const [loadedPages, setLoadedPages] = useState<number | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. React-PDF Document onLoadSuccess numPages; yerel kütüphane geri çağrısı; Page onRenderSuccess sayacı; hazır durum türetimi için; React-PDF hata geri çağrısı; Document/Page `error` render prop'ları mesajı sahiplenebilir (kısmi)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-148 · 14-file-attachments · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:394`, `const [loop, setLoop] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Video.js sahipliği kullanıcı kararına
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Video.js React 10.5 player'da loop özelliği/UI'ı bulunamadı; native media loop prop'u
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-149 · 14-file-attachments · React state → Base UI

- **Kanıt:** `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:735`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible (kontrolsüz defaultOpen, Collapsible.Trigger); panel açıklığı paylaşılacaksa Router search
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-150 · 15-workspace-overview · React state → Router search

- **Kanıt:** `apps/web/src/features/workspace-overview/ui/components/saved-project-lists.tsx:299`, `const [editing, setEditing] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Panel açıklığı/seçili kayıt: mevcut selectedListId search'ünün yanına edit=list-id|new (validateSearch + navigate)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-151 · 15-workspace-overview · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/workspace-overview/ui/forms/saved-list-editor-form.tsx:103`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. formApi.setErrorMap({ onSubmit }) + form.Subscribe
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-152 · 16-work-context · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:39`, `const [workType, setWorkType] = useState<WorkType>("Feature");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Layout editör formunun workType alanı — bkz. spec-2-12; useForm layout alanı, sectionOrder mode="array" moveValue — bkz. spec-2-12
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-153 · 16-work-context · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/work-context/ui/components/work-context-card.tsx:84`, `const [contextState, setContextState] = useState<WorkContextState>({`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kullanıcı kararı: Store mu sahipsiz mi
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Add Context ile kademeli açılan bölümler; tek kart görünüm durumu, paylaşılmıyor, URL'e ait değil; İstemci içi async clipboard yazımı; Query 'sunucu verisi' sahibi olduğundan hedef yok (useMutation seçeneği kullanıcı kararı); copyState ile aynı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-154 · 16-work-context · React state → Base UI

- **Kanıt:** `apps/web/src/features/work-context/ui/components/work-context-card.tsx:636`, `const [openCountId, setOpenCountId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Accordion (tek açık öğe, kontrolsüz defaultValue) — Priority Foundations sayım listeleri
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-155 · 17-work-templates · React state → Base UI

- **Kanıt:** `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:22`, `const [open, setOpen] = useState(defaultOpen);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible/Popover kontrolsüz (defaultOpen) + başarıda actionsRef.close(); 6.6 ihlal örneği doğrulandı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-156 · 17-work-templates · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:23`, `const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. duplicate.data?.key; duplicate.error; doğrulama için WorkDuplicateForm setErrorMap (setError prop'u kaldırılır); instantiate.data?.key; create/update/instantiate .error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-157 · 17-work-templates · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:48`, `const [editing, setEditing] = useState<WorkTemplate | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Düzenlenen şablon WorkTemplateForm defaultValues'ı; form.reset(draftFromTemplate(t)) ile değiştirilir; key ile yeniden mount hilesi → form.reset()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-158 · 17-work-templates · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:49`, `const [instantiating, setInstantiating] = useState<WorkTemplate | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Satır içi 'Create from template' hedefi → useCreateStore; dialog'a dönerse createHandle<WorkTemplate>()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-159 · 18-work-checklists · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/work-checklists/ui/components/work-checklist-editor.tsx:25`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. mutation/previewConversionMutation/conversionMutation .error; previewConversionMutation.variables (6.2 variables); previewConversionMutation.isPending || conversionMutation.isPending (üst bileşende zaten var); previewConversionMutation.data
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-160 · 20-priority · query: orpc.priorityMetricTrashImpactPreview.queryOptions({ input: metricId ? { metricId } : skipToken })

- **Kanıt:** `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:138`, `input: { metricId: metricId ?? "" },`. **Kural:** 6.1 Okuma: koşullu okuma için input: cond ? … : skipToken.
- **Kullanım ve etki:** Koşullu sorgu boş string input + enabled:false ile kuruluyor; '' anahtarlı sahte bir cache girdisi oluşuyor.
- **Beklenen ve önerilen düzeltme:** query: orpc.priorityMetricTrashImpactPreview.queryOptions({ input: metricId ? { metricId } : skipToken }). skipToken'a geç, enabled'ı kaldır.
- **Güven:** yüksek. Davranış etkisi yok; tutarlılık.

#### TK-161 · 20-priority · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/prioritization-sessions/ui/forms/prioritization-session-create-form.tsx:26`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. formApi.setErrorMap({ onSubmit }) / form.Subscribe
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-162 · 20-priority · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/priority-metrics/ui/components/priority-map.tsx:47`, `const [horizontalMetricId, setHorizontalMetricId] = useState<string | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Açılır pencere değil
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Spec 20: eksen seçimi geçici görünüm durumu, kaydedilmez → 6.5 'geçici ve paylaşılmayan → Store' (useCreateStore); paylaşılabilir görünüm istenirse Router search; horizontalMetricId ile aynı store; Geçici görünüm anahtarı (Show evidence signals başta kapalı); aynı store; Satır içi düzenleme hedefi; satırlar arasında paylaşılıyor → useCreateStore
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-163 · 20-priority · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:152`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. PriorityMetricCreateForm içinde setErrorMap({ onSubmit }) — prop ile yukarı taşınıyor; formApi.setErrorMap({ onSubmit }) (PR #540 formu; yalnız state kuralı)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-164 · 20-priority · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:153`, `const [actionError, setActionError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. update/trash/restore/deletePermanently .error (ve doğrulama için edit form setErrorMap); requestGitHubIdentityGrant'ı useMutation ile sar → grantMutation.data; grantMutation.isPending; setValue.error / clearValue.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-165 · 21-record-actions · React state → Base UI

- **Kanıt:** `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:41`, `const [active, setActive] = useState<ActiveRecordAction | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçilen Work ve Record Action payload’u aynı runner’da diyalog açıklığına bağlanıyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.createHandle<Payload>(), openWithPayload ve popup eylem kapsamı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-166 · 21-record-actions · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:42`, `const [runVersion, setRunVersion] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Runtime input hook’undaki effect değişen runVersion ile form.reset() çağırıyor. Dialog oturumu aynı reset sınırını sağlayabiliyorsa sayaç kaldırılabilir.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Aynı payload ile yeni çalıştırma gerekiyorsa kapsamlı useCreateStore veya Dialog oturum kimliği
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-167 · 21-record-actions · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:72`, `useState<ApplyRecordActionInput | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Komut, callback içinde yeniden kullanılmak üzere okunur; JSX tüketmez.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-168 · 22-bulk-editing · useVirtualizer({ getItemKey }) ile Work kimliği

- **Kanıt:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:447`, `const virtualizer = useVirtualizer({`. **Kural:** §6.9 TanStack Virtual getItemKey.
- **Kullanım ve etki:** Preview ve Results sanallaştırılmış ve değişken satırlar ölçülüyor. getItemKey verilmediği için ölçüm ve virtual item kimliği listedeki sıra numarasına bağlı. Yeni seçili küme/operasyon aynı bileşende gösterildiğinde aynı indeks farklı Work anlamına gelebilir.
- **Beklenen ve önerilen düzeltme:** useVirtualizer({ getItemKey }) ile Work kimliği. Preview için changedRecords[index].work.id, Results için bulkEditResultAt(resultPages, index).workId ile getItemKey sağla. React satırları zaten Work id kullanıyor; ölçüm anahtarını da sabit tut.
- **Diğer konumlar:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:549`, `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:492`, `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:580`.
- **Güven:** yüksek. data-index ve measureElement mevcut.

#### TK-169 · 22-bulk-editing · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/bulk-editing/hooks/use-bulk-work-selection.ts:37`, `const [selection] = useState(createBulkWorkSelection);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Store zaten Work satırları ile Bulk Edit arasında paylaşılıyor. React state yalnız store örneğinin ömrünü tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore(initialValue, actions) + useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-170 · 22-bulk-editing · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:698`, `const [formKey, setFormKey] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Reset akışı formu key artırarak yeniden mount ediyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form.reset(), gerekirse reset eden Dialog yaşam döngüsü; form.Subscribe selector ve form.state.values
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-171 · 22-bulk-editing · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:705`, `const [progress, setProgress] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Yerel başlangıç sayacı yalnız sıfıra ayarlanıyor; operasyon zaten kayıt adedi ile tamamlanma sayısını taşıyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. useSelector(bulkEditOperationStore, selector) ile kaydedilmiş completed/total
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-172 · 23-completion-effects · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/completion-effects/hooks/use-user-initiated-work-success.ts:78`, `const [feedbackByWorkId, setFeedbackByWorkId] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Birden çok Work satırı ve kapanış yüzeyi için notice ve efekt süresi okunuyor; tekrar engelleyen mevcut oturum store’u ayrı bir sorumluluk.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore(initialValue, actions) + useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-173 · 23-completion-effects · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:88`, `const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sistem tercihi media-query değişimlerinde kopyalanıyor; kaynak değeri doğrudan izlenebilir.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. matchMedia snapshot için useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot); Preview evresi ve prefersReducedMotion üzerinden hesaplanan canlı mesaj
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-174 · 23-completion-effects · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:89`, `const [previewing, setPreviewing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Örnek efekti tıklama başlatıyor, süre bitince kapatılıyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Animasyonun yerel yaşam döngüsü; kabul edilmiş render sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-175 · 23-completion-effects · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:91`, `const [saveError, setSaveError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Zod ve sunucu hatası aynı state’e yazılıyor ve girdiler düzenlenince temizleniyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form.setErrorMap({ onSubmit }) + form.Subscribe, ağ hatası mutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-176 · 23-completion-effects · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:92`, `const [hasSaved, setHasSaved] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Başarılı kaydetme işareti alan değişince temizleniyor, mutation zaten sonucu tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. savePreferences.isSuccess + reset veya mutation.variables ile güncel değer karşılaştırması
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-177 · 24-external-handoffs · React state → Base UI

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:210`, `const [expanded, setExpanded] = useState(defaultExpanded);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Açıklık Start Handoff veya View Handoffs düğmesiyle set ediliyor ve üç sorgunun çalışmasını belirliyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root defaultOpen; açık içerikte alt sorgu bileşenini mount et
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-178 · 24-external-handoffs · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:211`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Zod hatası form dışına callback ile alınıp geriye prop olarak geçiliyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. StartHandoffForm form.setErrorMap({ onSubmit }) ve form.Subscribe; form.setErrorMap({ onSubmit }) + form.Subscribe
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-179 · 24-external-handoffs · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:212`, `const [writeError, setWriteError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Start Handoff RPC hatası mutation zaten varken üst state’e kopyalanıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. start.error/reset ve form seviyesinde gösterim; previewReconcile.data/reset; previewId doğrulama girdisi
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-180 · 24-external-handoffs · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:213`, `const [copiedHandoffId, setCopiedHandoffId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kopyalama başarısı RPC’den önce görünür. Kayıt başarısız olsa bile doğru kopyalama sonucunu koru.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Yerel Clipboard sonucu için kabul edilmiş sahip yok; Clipboard hatasının yerel sahibi açık; kayıt hatası recordPackageExport.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-181 · 24-external-handoffs · form.Field mode="array", pushValue/removeValue ve öğe alt alanları

- **Kanıt:** `apps/web/src/features/external-handoffs/ui/forms/handoff-reconcile-form.tsx:228`, `<form.Field name="relations">`. **Kural:** §6.3 TanStack Form mode="array".
- **Kullanım ve etki:** Reconcile öneri ve Follow-up Work listeleri ekleme/silme ve düzenlemeyi bütün diziye yeni değer vererek elle yapıyor. Form dizi öğelerinin yaşam döngüsünü yönetmiyor.
- **Beklenen ve önerilen düzeltme:** form.Field mode="array", pushValue/removeValue ve öğe alt alanları. Mevcut Work ve öneri kimliğini satır anahtarı olarak koru, dizileri Form array API’ye taşı. Confirm yalnız preview’de gösterilen seçili kimliklerden kurulmaya devam etsin.
- **Diğer konumlar:** `apps/web/src/features/external-handoffs/ui/forms/handoff-reconcile-form.tsx:238`, `apps/web/src/features/external-handoffs/ui/components/handoff-follow-up-fields.tsx:106`, `apps/web/src/features/external-handoffs/ui/components/handoff-relation-fields.tsx:94`.
- **Güven:** yüksek.

#### TK-182 · 25-kanban · React state → Base UI

- **Kanıt:** `apps/web/src/features/kanban/ui/components/kanban-board.tsx:57`, `const [collapsedStatuses, setCollapsedStatuses] = useState<Set<WorkStatus>>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Üyelik değişmeden yalnız kolon gövdesi kapanır; başlık, sayılar, sinyaller ve droppable hedefi korunur.
- **Beklenen ve önerilen düzeltme:** Base UI. Her kolon için kontrolsüz Collapsible.Root/Trigger/Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-183 · 25-kanban · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/kanban/ui/components/project-work-kanban.tsx:54`, `const [today, setToday] = useState(() => currentDateInTimeZone(timeZone));`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Bugün, Reappear date uygunluğunu değiştiriyor. Saat intervali meşru.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Tarayıcı saati ve Account zaman dilimi; kabul edilmiş render sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-184 · 26-backlog · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:80`, `const [reappearDate, setReappearDate] = useState(work.reappearDate ?? "");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Prop değişince yeniden eşitleniyor, seçimden hemen sonra iyimser gösteriliyor, hata geri alıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. saveReappearDate.variables + isPending, sunucu alanı için query verisi
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-185 · 26-backlog · React state → Base UI

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:81`, `const [dateOpen, setDateOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Tarih seçilince kapanıyor; yazma hatasında tarihi geri alıyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Popover.Root actionsRef.current?.close() ve kontrolsüz Popover
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-186 · 26-backlog · React state → Router search

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:255`, `useState<BacklogPresentation>("Manual order");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Backlog sort seçimi listedeki sıralamayı ve dışa aktarma sırasını belirliyor; Project kaydı olan Saved presentation ayrı.
- **Beklenen ve önerilen düzeltme:** Router search. Project route validateSearch + navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-187 · 26-backlog · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:272`, `const [now, setNow] = useState(() => new Date());`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Dakika tick’i Deferred ayrımının tarih geldiğinde güncellenmesini sağlıyor. Interval meşru.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Tarayıcı saati ve zaman dilimi; kabul edilmiş render sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-188 · 26-backlog · @dnd-kit/react DragDropProvider ve @dnd-kit/react/sortable useSortable, @dnd-kit/helpers move

- **Kanıt:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:25`, `import {`. **Kural:** §6.10 ve K6, @dnd-kit/react.
- **Kullanım ve etki:** DndContext, SortableContext, useSortable ve arrayMove eski core/sortable/utils ailesinden. Work kartının Manual order etkileşimi bu yoldan sunucuya yeni sıra yazıyor.
- **Beklenen ve önerilen düzeltme:** @dnd-kit/react DragDropProvider ve @dnd-kit/react/sortable useSortable, @dnd-kit/helpers move. event.canceled erken dönüşü, klavye sensörünü/duyuruları, Deferred üyelerin sırasını ve tek Project manuel sıra mutasyonunu koru.
- **Diğer konumlar:** `apps/web/src/features/backlog/ui/components/project-backlog.tsx:34`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:41`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:115`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:411`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:511`.
- **Güven:** yüksek. Klavye sensörü mevcut. Sürüm notunda açık @deprecated kanıtı gerekmiyor; proje DnD sahibi ihlali. helpers doğrudan app bağımlılığı olarak kurulu değil. K6, 5. aşama geçişi için mevcut karar.

#### TK-189 · 27-daily-focus · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:35`, `const [now, setNow] = useState(() => new Date());`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Dakika tick’i URL’de day yokken bugünü yeniden hesaplıyor. Interval meşru.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Tarayıcı saati ve Account zaman dilimi; kabul edilmiş render sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-190 · 27-daily-focus · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:245`, `const [rejectedCandidateIdsByDay, setRejectedCandidateIdsByDay] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Reject geçici istemci kararını gün anahtarıyla tutuyor; sunucu adayları Query’de kalır, görünür liste iki kaynaktan türetilir.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore(initialValue, actions) + useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-191 · 27-daily-focus · validateSearch: z.object({ day: z.iso.date().optional().catch(undefined), view: z.literal("close").optional().catc…

- **Kanıt:** `apps/web/src/routes/_auth/daily-focus.tsx:6`, `validateSearch: (search) => {`. **Kural:** §6.5 Router, doğrudan Zod 4 validateSearch.
- **Kullanım ve etki:** Route day için tekil safeParse ve view için elle eşitlik kullanıyor. URL doğru katmanda ama doğrudan Zod şeması yok.
- **Beklenen ve önerilen düzeltme:** validateSearch: z.object({ day: z.iso.date().optional().catch(undefined), view: z.literal("close").optional().catch(undefined) }). Bozuk day/view parçalarının ayrı düşmesi ve URL varsayılan günü korunmalı.
- **Güven:** yüksek.

#### TK-192 · 28-unified-calendar · React state → Base UI

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:249`, `const [datePickerOpen, setDatePickerOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Tarih seçimi ve açık kapatma kullanıcı aksiyonlarına bağlı.
- **Beklenen ve önerilen düzeltme:** Base UI. Kontrolsüz Popover + actionsRef.current?.close()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-193 · 28-unified-calendar · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:732`, `const [draggedDate, setDraggedDate] = useState<CalendarDateDrag | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Alan, revizyon ve kaynak Work hem aktif drag hem ayrı onay yolu için tutuluyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Etkin drag için @dnd-kit/react useDragOperation().source; Date Picker onay taslağı için açık sahip kararı; Etkin drag için useDragOperation().target; Date Picker onay taslağı için açık sahip kararı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-194 · 28-unified-calendar · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:735`, `useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Boolean yalnız önizleme kaynağını tekrar ediyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. Önizlemenin türünden hesapla; Date Picker taslağı onay ister, drag hover istemez
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-195 · 28-unified-calendar · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/views/unified-calendar-view.tsx:113`, `const [dateChangeUndo, setDateChangeUndo] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Başarı cevabının receiptId/workId alanları kopyalanıyor ve sonraki hata ya da Undo’da temizleniyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. updateCalendarDate.data ve undoCalendarDate durumundan türet; reset ile kapsamı temizle; updateCalendarDate.error ve undoCalendarDate.error/reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-196 · 28-unified-calendar · @dnd-kit/react DragDropProvider/useDraggable/useDroppable/useDragOperation ve KeyboardSensor

- **Kanıt:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:10`, `import {`. **Kural:** §6.10 ve K6, @dnd-kit/react.
- **Kullanım ve etki:** Calendar drag alma, hedef gün, klavye koordinatı, hover önizlemesi ve drop işlemi eski core ve utilities üzerinden iki DndContext ile çalışıyor.
- **Beklenen ve önerilen düzeltme:** @dnd-kit/react DragDropProvider/useDraggable/useDroppable/useDragOperation ve KeyboardSensor. Hedef gün metadata ve tek tarih alanına Revision/Undo sözleşmesini koru. Pointer ve klavye için önizleme, duyuru, iptal ve Date Picker onay yolunu ayır.
- **Diğer konumlar:** `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:29`, `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:741`, `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:792`, `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:872`.
- **Güven:** yüksek. onDragStart bir dnd-kit olay prop’u. Native HTML DnD kullanımı değil. Açık upstream deprecation iddiası yok.

#### TK-197 · 28-unified-calendar · Doğrudan z.object ile z.iso.date(), görünüm enum ve search alanlarına catch

- **Kanıt:** `apps/web/src/routes/_auth/calendar.tsx:11`, `validateSearch: (search) => ({`. **Kural:** §6.5 Router, doğrudan Zod 4 validateSearch.
- **Kullanım ve etki:** calendarDay için typeof/regex/parseISO; dateKinds, projectId ve view için elle guard. URL sahipliği doğru, Zod sözleşmesi uygulanmıyor.
- **Beklenen ve önerilen düzeltme:** Doğrudan z.object ile z.iso.date(), görünüm enum ve search alanlarına catch. Mevcut aylık varsayılan ve dateKinds boş/tümü anlamlarını koru, Project yetki kapsamı görüntüde sunucu verisinden doğrulanmaya devam etsin.
- **Güven:** yüksek.

#### TK-198 · 29-roadmap-horizon · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/roadmap-horizon/store/roadmap-session.tsx:18`, `const [session] = useState(createRoadmapSession);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Project ömründe aynı Store ile named view ve viewport paylaşılıyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore(initialValue, actions) ve createStoreContext().StoreProvider; Project kapsamlı roadmap-session useSelector veya kapsamlı useCreateStore; Project roadmap-session üzerinden useSelector ve oturum eylemi; Kapsamlı useCreateStore ve useSelector; preview evresi form ile eşgüdümlü
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-199 · 29-roadmap-horizon · React state → Base UI

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:50`, `const [editing, setEditing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kilometre Taşı satırında edit formu açılıp kapanıyor; sunucu hatasında form açık kalır.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root veya Dialog.Root, başarı için actionsRef.close(); Collapsible.Root/Trigger veya kontrolsüz Dialog ve başarıda close; Dialog.Root / Trigger, ayrı mount için createHandle veya Dialog popup içeriği
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-200 · 29-roadmap-horizon · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:51`, `const [preview, setPreview] = useState<RelationPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Onaydan önce oRPC bağ önizlemesi, kaynak etiketi ve revisionı saklıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewRelation.data/reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-201 · 29-roadmap-horizon · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:52`, `const [relationIdempotencyKey, setRelationIdempotencyKey] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Onay komutu handler’ında kullanılır; render gerektirmez.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-202 · 29-roadmap-horizon · React state → Router search

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/project-roadmap.tsx:183`, `const [selection, setSelection] = useState<ViewSelection>("direction");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Named view veya All Work seçimi kanonik veriyi filtreliyor. URL değişimi için Project içi geçici viewport otomatik kalıcılaştırılmaz.
- **Beklenen ve önerilen düzeltme:** Router search. Project route validateSearch + navigate({ search }), view kaydı Query’de
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-203 · 29-roadmap-horizon · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/roadmap-canvas.tsx:66`, `const [flow, setFlow] = useState<ReactFlowInstance<RoadmapNode> | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Instance buton erişilebilirliğini ve Return to Work adapter kaydını tetikliyor; ref tek başına render güncellemez.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. React Flow instance ve onInit sahibi; hazır olma state’i için stack’te belirlenmiş değiştirme yolu yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-204 · 29-roadmap-horizon · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/roadmap-horizon/ui/components/roadmap-placement.tsx:25`, `useState<RoadmapPlacementChoice | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 5 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Roadmap placement önizlemesi seçeneği onaya kadar donduruyor; düzenlemede temizleniyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form.Subscribe/submit meta veya form-owned preview değeri; Tek useForm örneği, form.Subscribe ve setFieldValue; Form onSubmit aşamasında ayrıştırılmış komut snapshot’ı ve form.Subscribe; Form setErrorMap({ onSubmit }) ve iki mutation.error/reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-205 · 30-focus-period · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/focus-period/ui/forms/focus-period-follow-up-form.tsx:41`, `const [clientIdempotencyKey, setClientIdempotencyKey] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Form snapshot başına bir kimlik; yalnız confirm girdisinde kullanılır.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-206 · 30-focus-period · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/focus-period/ui/forms/focus-period-follow-up-form.tsx:44`, `const [showPreview, setShowPreview] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. İlk gönderim yerel önizlemeyi açıyor ve düzenleme kapatıyor; ikinci gönderim Work oluşturuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form.Subscribe ve onSubmitMeta ile preview/confirm evresi
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-207 · 30-focus-period · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:32`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Genel aksiyon hataları ve Create alan hataları tek metinde saklanıp belirli metinlerle ayrılıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Mutation error/reset ve form doğrulaması için form.setErrorMap({ onSubmit })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-208 · 30-focus-period · React state → Router search

- **Kanıt:** `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:33`, `const [selectedId, setSelectedId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçilen Odak Dönemi detayı değiştiriyor. Yaratma sonrası da yeni döneme gidilmeli ve bulunamazsa ilk kayıt varsayımı korunmalı.
- **Beklenen ve önerilen düzeltme:** Router search. /focus-periods validateSearch, Route.useSearch ve navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-209 · 30-focus-period · React state → Base UI

- **Kanıt:** `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:231`, `const [showCloseReview, setShowCloseReview] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kapanış öncesi inline inceleme açılıp iptal ediliyor; gerçek kapatma ayrı mutation.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root + Trigger + Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-210 · 31-documents · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:102`, `const [comparison, setComparison] = useState<DraftComparison | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 11 çağrı, 6 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Preview read ise query/fetch tarafında bırak; hazırlık kaydı yazıyorsa mutation kullan. Bağlamı değiştiğinde resetle.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. `compare.data` (zaten `useMutation`); temizleme `compare.reset()`; `compare.error ?? resolve.error`; `convertDiagram.data`; Salt okunur önizleme için query(); hazırlık kaydı yazılıyorsa mutation. Bağlam değişince sonucu sıfırla.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-211 · 31-documents · React state → Base UI

- **Kanıt:** `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:104`, `const [independentSeed, setIndependentSeed] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 16 çağrı, 9 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Dialog `createHandle<{ initial; result }>()` + `handle.openWithPayload(...)`; başarıda `actionsRef.current?.close()`; Base UI Dialog `createHandle<{ mode; rebind; range }>()`; satırdan/butondan `Trigger handle payload`; Açılış anındaki seçim aralığı aynı handle payload içinde taşınır; Base UI Dialog `createHandle<"hierarchy" | "archive">()` + Trigger payload; başarıda `actionsRef.close()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-212 · 31-documents · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/documents/ui/components/document-preview.tsx:296`, `const [rendered, setRendered] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Query yalnız sunucu verisi olarak tanımlı; karar kullanıcıya
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Yerel async Mermaid render (sunucu verisi değil); stack sahibi yok. Seçenek: yerel `queryFn` ile Query veya ayrı karar; Mermaid render hatası; 296 ile aynı sahipsiz iş
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-213 · 31-documents · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/documents/ui/components/document-preview.tsx:344`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. `katex.renderToString` try/catch ile render sırasında (`useMemo`) türetilir; effect + setState gerekmez; Edit session store `baseRevision` alanından `useSelector` ile; useEffect aynalaması kalkar; Edit session store `saved` buffer’ından türetilir (store zaten tutuyor)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-214 · 31-documents · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/documents/ui/forms/document-create-form.tsx:52`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 14 çağrı, 8 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. spec-4-2 ile bağlantılı
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; save/restore `mutation.error`; Ekleme araç çubuğu seçimleri `useForm` alanı (`lib/document-insert-form.ts` şeması); Ekleme araç çubuğu formu alanı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-215 · 31-documents · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:139`, `const [selection, setSelection] = useState<string>(personalReviewTemplate.id);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Gönderilmeyen tekli şablon seçimi (NativeSelect); açılışta payload’a girer. Seçenek: küçük `useForm` alanı veya handle payload; karar kullanıcıya
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-216 · 33-record-discovery · `@cantiara/ui/components/table` (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`) + `ini…

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/record-table.tsx:729`, `<table className="min-w-full border-collapse text-sm">`. **Kural:** 6.8: sıralama/filtre olan liste TanStack Table ile yazılır, markup için `@cantiara/ui` `Table` kullanılır.
- **Kullanım ve etki:** TanStack Table v9 `useTable` doğru kullanılıyor ama markup elle yazılmış `<table>/<thead>/<tr>`; ayrıca tablo durumu dışarıda `useState` (622-623) ile tutuluyor
- **Beklenen ve önerilen düzeltme:** `@cantiara/ui/components/table` (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`) + `initialState` ile iç tablo durumu. Markup’ı ui Table bileşenlerine çevir; `state`/`onSortingChange`/`onGlobalFilterChange` + useState yerine `initialState` kullan, filtre input’u `table.setGlobalFilter` ile yazsın.
- **Diğer konumlar:** `apps/web/src/features/record-discovery/ui/components/record-table.tsx:622`, `apps/web/src/features/record-discovery/ui/components/record-table.tsx:623`.
- **Güven:** yüksek. Table 9.3.1 kurulu; `createLegacyTable` kullanılmıyor, deprecated sorun yok.

#### TK-217 · 33-record-discovery · React state → Base UI

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/context-record-preview.tsx:152`, `const [record, setRecord] = useState<SourceRecordPreviewTarget | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Context yalnız bu state’i dağıtmak için var (spec-4-8)
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Dialog(Sheet) `createHandle<SourceRecordPreviewTarget>()`; tüketiciler `handle.openWithPayload(target)` / `Trigger handle payload`; Kontrolsüz Dialog (`DialogTrigger` zaten var) + kaynak açılınca `actionsRef.current?.close()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-218 · 33-record-discovery · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:257`, `const [status, setStatus] = useState<DecisionStatus>("Valid");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 11 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Search diyalog seçimi spec 33 ve 32’ye göre geçici ve resetlenebilir; URL kalıcılığı çıkarılmaz.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Bileşen kapsamlı TanStack useCreateStore ve useSelector.; DiscoverySurface ömürlü useCreateStore + useSelector; yalnız sorgu girdisini Pacer ile geciktir.; TanStack Table v9 iç durumu: `initialState: { globalFilter: "" }` (paylaşılırsa `atoms`); dışarıdan `state` + `useState` verilmez; TanStack Table v9 iç durumu: `initialState: { sorting: [] }`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-219 · 33-record-discovery · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/record-table.tsx:509`, `const [value, setValue] = useState(displayValue(currentValue));`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 11 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Hücre başına `useForm` (onBlur gönderim) + Zod `parseRecordTableFieldValue`; Remount anahtarı yerine `formApi.reset()`; Paste review formu: `mode="array"` alanları (`pushValue`/`removeValue`); Paste review formu array alanı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-220 · 33-record-discovery · Base UI Dialog (Sheet) `Dialog.createHandle<SourceRecordPreviewTarget>()`; tüketiciler `handle.openWithPayload(tar…

- **Kanıt:** `apps/web/src/features/record-discovery/ui/components/context-record-preview.tsx:68`, `createContext<SourceRecordPreviewContextValue | null>(null);`. **Kural:** 6.6: satırdan/menü öğesinden açılan paylaşılan diyalog için `createHandle<Payload>()`; React state kuralı: useState ile kurulan context ihlaldir.
- **Kullanım ve etki:** Paylaşılan `Open source record` Sheet’i Context + `useState<SourceRecordPreviewTarget>` (152) ile açılıyor; Kanban, Calendar, Roadmap, Scope Tree, Smart Collection, Favorites ve Document preview tüketiyor
- **Beklenen ve önerilen düzeltme:** Base UI Dialog (Sheet) `Dialog.createHandle<SourceRecordPreviewTarget>()`; tüketiciler `handle.openWithPayload(target)` veya `<Trigger handle payload>`. Modül düzeyinde handle dışa aktar; provider yalnız `<Sheet handle={handle}>` render etsin, `useOpenSourceRecord` handle’ı döndürsün.
- **Etkilenen spec’ler:** 33-record-discovery, 39-favorites, 34-smart-collections.
- **Güven:** yüksek. Spec 33 (#268) "open target is held in component state" diyor; denetim kuralı spec metnine istisna tanımıyor → spec metni de güncellenmeli (uncertain).

#### TK-221 · 34-smart-collections · React state → Base UI

- **Kanıt:** `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:453`, `const [activePanel, setActivePanel] = useState<"records" | "insights">(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Tabs/ToggleGroup `defaultValue`; programatik geçiş (`showAllRecords`) gerekiyorsa kontrollü kaynak Store
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-222 · 34-smart-collections · React state → Router search

- **Kanıt:** `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:456`, `const [selectedSlices, setSelectedSlices] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kart başına çoklu filtre; Router vs Store kararı uncertain
- **Beklenen ve önerilen düzeltme:** Router search. Insight dilim filtresi search param (view id ile anahtarlı)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-223 · 34-smart-collections · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:564`, `useState<SmartCollectionMembershipPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. dnd-kit sürükleme önizlemesi; sürükleme sırasında `useDragOperation()` ile türetilebilir, bırakma sonrası önizlemenin sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-224 · 34-smart-collections · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/smart-collections/ui/forms/smart-collection-create-form.tsx:89`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-225 · 36-return-to-work · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/return-to-work/ui/components/return-to-work.tsx:24`, `const [visitError, setVisitError] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. `useMutation(orpc.markReturnContextViewed.mutationOptions())` → `isError`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-226 · 36-return-to-work · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:47`, `const [view] = useState(() => session?.state.view ?? null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Düşük güven: kasıtlı sabit snapshot
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Roadmap session store’dan bir kez okunan görünüm; reaktif değilse `useRef(session?.state.view)` veya store snapshot; Tour driver durumunu `createStore` ile yayınlar, `useSelector(tour.store)`; elle `setState({ ...tour.state })` aynalaması kalkar
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-227 · 36-return-to-work · React state → Base UI

- **Kanıt:** `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:109`, `const [activeChanges, setActiveChanges] = useState<SinceLastLooked | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Dialog `createHandle<SinceLastLooked>()` payload; Base UI Dialog kontrolsüz + `actionsRef.close()`; async kapanış `onOpenChangeComplete`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-228 · 36-return-to-work · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/return-to-work/ui/forms/next-concrete-step-form.tsx:32`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; `isSubmitSuccessful` (`form.Subscribe`) veya mutation `isSuccess`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-229 · 37-goals · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:48`, `const [pending, setPending] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. `useMutation(orpc.setProjectGoalRelation.mutationOptions())` → `isPending`; oRPC + Query: `useMutation(orpc.x.mutationOptions())` sonucu `error` (beklenen hata için `isDefinedError`); `isSuccess` + `variables.attached`; save `useMutation` → `isSuccess`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-230 · 37-goals · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:51`, `const [settledChanges, setSettledChanges] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Sayaç + useEffect yerine çocuk formda `await mutateAsync()` sonrası `formApi.reset()`; TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı; `setErrorMap({ onSubmit: conflictError })`; current value hata değerinden gösterilir
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-231 · 37-goals · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/project-goals/ui/components/project-goals-view.tsx:38`, `const [editing, setEditing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Satır içi editör modu (popup değil); Router search (`editing`) veya Base UI Collapsible seçenekleri; karar kullanıcıya
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-232 · 38-decisions · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:30`, `const [selection, setSelection] = useState<DecisionSupersessionSelection>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. UI içindeki seçim birden çok satır içi hazırlık ve onay yüzeyine taşınıyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Bileşen kapsamlı useCreateStore + useSelector.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-233 · 38-decisions · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:31`, `const [prepared, setPrepared] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. `useMutation(orpc.previewDecisionSupersession.mutationOptions())` → `data`; iptal `reset()`; idempotency anahtarı `useRef`; commit için `useMutation(orpc.commitDecisionSupersession.mutationOptions())` → `isPending`; oRPC + Query: `useMutation(orpc.x.mutationOptions())` sonucu `error` (beklenen hata için `isDefinedError`); save/withdraw `useMutation` → `isSuccess` + `variables` (operation) ile durum metni
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-234 · 38-decisions · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:37`, `const [conflict, setConflict] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. `commit.error` üzerinden CONFLICT kodundan türetilir
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-235 · 38-decisions · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/decisions/ui/components/project-decisions-panel.tsx:53`, `const [editing, setEditing] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Satır içi editör modu (popup değil); Router search (`editing`) veya Base UI Collapsible seçenekleri; karar kullanıcıya
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-236 · 38-decisions · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/decisions/ui/forms/decision-editor-form.tsx:39`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; `setErrorMap({ onSubmit: { conflict: true, ... } })` ile form hata değerinden okunur; Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-237 · 40-risks · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/risks/ui/components/project-risks-surface.tsx:25`, `const [savedMessage, setSavedMessage] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. save/transition `useMutation` → `isSuccess` + `variables`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-238 · 40-risks · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/risks/ui/components/project-risks-view.tsx:36`, `const [editingMode, setEditingMode] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Satır içi editör modu (popup değil); Router search (`editing`) veya Base UI Collapsible seçenekleri; karar kullanıcıya
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-239 · 40-risks · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/risks/ui/forms/risk-form.tsx:45`, `const [baseRecord] = useState(record);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı; TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; `setErrorMap` hata değerinden türetilir
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-240 · 41-uncertainty-records · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:37`, `const [editing, setEditing] = useState<"create" | "answer" | undefined>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Inline Create veya Answer editörü, seçili kayıt navigasyonundan ayrı.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-241 · 41-uncertainty-records · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:40`, `const [saved, setSaved] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kayıt veya cevap başarısı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. createProjectSourceRecord / transitionProjectSourceRecord mutation.isSuccess / reset; create/update/transition mutation.isSuccess / reset; transitionProjectSourceRecord mutation.isPending; transitionProjectSourceRecord mutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-242 · 41-uncertainty-records · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:54`, `const [baseRecord] = useState(record);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Refetch sonrası taslak eski revision ile conflict üretmeli.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form defaultValues baz id/revision; formApi.setErrorMap / form.Subscribe errorMap.onSubmit; form defaultValues edit oturumu exact Document teklifleri
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-243 · 41-uncertainty-records · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:56`, `const [conflict, setConflict] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Yeniden açma kilidi yazma hatasının türünden elde edilir.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. mutation.error üstünden CONFLICT hesapla
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-244 · 42-validation-records · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/validation-records/ui/forms/validation-record-editor-form.tsx:35`, `const [baseRecord] = useState(record);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Refetch’e rağmen düzenleme başlangıcındaki revision sabit.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form defaultValues baz id/revision; setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-245 · 42-validation-records · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/validation-records/ui/forms/validation-record-editor-form.tsx:37`, `const [conflict, setConflict] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Conflict sonrası yeniden Edit açma gereğini hata türünden çıkar.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. save mutation.error üstünden CONFLICT hesapla
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-246 · 42-validation-records · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:40`, `const [editing, setEditing] = useState<{ record?: ValidationRecord } | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Create/edit inline editörünün seçilen kaydı; başlangıç snapshot’ını Form sahiplenir.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-247 · 42-validation-records · React state → Router search

- **Kanıt:** `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:43`, `const [status, setStatus] = useState<ValidationRecord["status"]>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Status listesi dönüşte korunmalı; seçili detay kayıt statüsü mevcut filtreden bağımsız kalmalı.
- **Beklenen ve önerilen düzeltme:** Router search. Zod validateSearch / useSearch / navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-248 · 42-validation-records · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:46`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Doğrudan lifecycle eyleminin hata durumu.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. transitionProjectSourceRecord mutation.error; transitionProjectSourceRecord mutation.isPending; save/transition mutation.isSuccess / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-249 · 43-research-sessions · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:51`, `const [editing, setEditing] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Inline note editörü için kullanıcı seçimi. Oturum ve not referansındaki baz sürüm korunmalı.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector; useCreateStore / useSelector ve targets query.data
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-250 · 43-research-sessions · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:55`, `const [saved, setSaved] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Not kaydının editör kapanınca görünen başarı durumu.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. saveResearchSessionNote mutation.isSuccess / reset; researchSessionBindingTargets query.isFetching; researchSessionBindingTargets query.error; confirmResearchSessionBinding mutation.isSuccess / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-251 · 43-research-sessions · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:63`, `const [confirmationKey, setConfirmationKey] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Aynı prepared preview için olay callback’inde kullanılan kararlı key; ekrana basılmaz.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-252 · 43-research-sessions · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:65`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Doğrulama, preview ve confirm hata metinleri.
- **Beklenen ve önerilen düzeltme:** TanStack Form. setErrorMap / form.Subscribe ve aşamaya göre mutation.error; form defaultValues / formApi.state.values; form defaultValues içindeki entryTimeZone; setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-253 · 43-research-sessions · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:66`, `const [conflict, setConflict] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Stale hazırlıkta yeniden açma gereği hatayla aynı bilgiden geliyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. confirm mutation.error üstünden CONFLICT veya typed reason hesapla; save mutation.error üstünden CONFLICT hesapla; note mutation.error üstünden CONFLICT hesapla
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-254 · 43-research-sessions · Feature server kodu domain hatası (örn. `ResearchSessionNotFoundError`, mevcut ResearchSessionConsentError kalıbı)…

- **Kanıt:** `apps/server/src/features/research-sessions/server/research-sessions-database.ts:273`, `throw new ORPCError("NOT_FOUND");`. **Kural:** structure.md Rules › Server: 'HTTP and RPC entries are thin adapters; behavior lives in the feature's server/ and depends on ports, not adapters'; oRPC sınırı packages/api/src/routers/index.ts.
- **Kullanım ve etki:** 23 ORPCError apps/server feature davranış/veri adaptörlerinde atılıyor: research-sessions (research-sessions-database.ts 12, research-binding-targets.ts 3, research-binding-commit.ts 1), return-to-work-database.ts 4, record-discovery/server/record-table.ts 3. Diğer feature'lar domain hatası atıp router'daki rethrow*() ile eşliyor; bu dosyalar RPC transport'una bağımlı. record-table.ts:849 wiring eksikliğini de transport hatasıyla bildiriyor.
- **Beklenen ve önerilen düzeltme:** Feature server kodu domain hatası (örn. `ResearchSessionNotFoundError`, mevcut ResearchSessionConsentError kalıbı) veya null döner; RPC'ye çeviri router'da (SERVER-2 sonrası errors.X ile) yapılır.. Bu beş dosyada ORPCError'ı feature'a ait hata sınıflarıyla değiştir, rethrowResearchSessionError ve return-to-work/record-table router dallarında eşle; @orpc/server import'unu feature server/ klasörlerinden kaldır.
- **Etkilenen spec’ler:** 43-research-sessions, 33-record-discovery, 36-return-to-work.
- **Diğer konumlar:** `apps/server/src/features/research-sessions/server/research-sessions-database.ts:42`, `apps/server/src/features/research-sessions/server/research-binding-targets.ts:40`, `apps/server/src/features/research-sessions/server/research-binding-commit.ts:84`, `apps/server/src/features/return-to-work/server/return-to-work-database.ts:58`, `apps/server/src/features/record-discovery/server/record-table.ts:57`, `apps/server/src/features/record-discovery/server/record-table.ts:849`.
- **Güven:** yüksek. Davranış etkisi yok (status-only NOT_FOUND aynı kalır). Bunlar typed değil; SERVER-1 zarfında zaten yalnız durum kodu korunuyor.

#### TK-255 · 44-sources-and-freshness · React state → Base UI

- **Kanıt:** `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:92`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Source evidence panelinin açılması, kapalıyken alt listeleri render etme.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-256 · 44-sources-and-freshness · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:93`, `const [editor, setEditor] = useState<{ use?: SourceEvidenceUse } | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Mevcut bind veya yeni seçim için inline editor modu; Store’a yalnız id ve edit başlangıcı girdisi.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-257 · 44-sources-and-freshness · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:43`, `const [range, setRange] = useState(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. UTF-16 aralığı gönderilen planın girdisi; edit, klavye ve text selection aynı Form alanını güncellemeli.
- **Beklenen ve önerilen düzeltme:** TanStack Form. form.Field / setFieldValue; form.Subscribe isSubmitting; formApi.setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-258 · 45-evidence · React state → Base UI

- **Kanıt:** `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:18`, `const [expanded, setExpanded] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Elle açılan panel yalnız açıkken Query bileşenini mount ediyor. Kapalıyken okuma yapılmamalı.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-259 · 45-evidence · React state → Router search

- **Kanıt:** `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:52`, `const [sourceType, setSourceType] = useState<EvidenceFlowSourceType | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Work, Decision ve Assumption detayındaki Source type filtresi evidenceFlow girdisini değiştiriyor. Parametreyi hedefe uygun kapsamla taşı.
- **Beklenen ve önerilen düzeltme:** Router search. validateSearch / useSearch / navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-260 · 46-contact-and-company · React state → Router search

- **Kanıt:** `apps/web/src/features/contacts/ui/views/contacts-view.tsx:54`, `const [selectedId, setSelectedId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Liste seçimleri, create ve merge sonrası profil URL’deki mevcut contact anahtarına yazılmıyor. Dışarıdan açılmış profil önceliği ile birleştirilmeli.
- **Beklenen ve önerilen düzeltme:** Router search. Route.useSearch / navigate({ search })
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-261 · 46-contact-and-company · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/contacts/ui/views/contacts-view.tsx:55`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Create, Company affiliation, update, merge ve undo sonuçlarının ortak hata metni. Zod hatası ilgili formun setErrorMap alanında kalmalı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. useMutation / error ve reset; undoMerge mutation.data / isSuccess / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-262 · 46-contact-and-company · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/contacts/ui/views/contacts-view.tsx:91`, `const [mergePair, setMergePair] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Satırdaki kullanıcı seçimi önizlemenin survivor ve retired girdisini ve panel görünümünü belirliyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-263 · 47-feedback · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/feedback/ui/components/convert-to-work-dialog.tsx:80`, `const [plan, setPlan] = useState<FeedbackWorkPlan | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kullanıcının seçtiği Work türüne ait sunucu planı kopyalanıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewFeedbackWork.queryOptions / skipToken / data; preview query.error / convert mutation.error; query.isFetching / mutation.isPending; setFeedbackIdentity / setFeedbackStatus mutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-264 · 47-feedback · React state → Router search

- **Kanıt:** `apps/web/src/features/feedback/ui/components/feed-surface.tsx:9`, `const [query, setQuery] = useState<FeedQuery>({ sort: "Newest first" });`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Source type, Status, Sort RPC girdisi. Discovery’den çıkıp dönünce veya bağlantı açınca seçimler varsayılana dönüyor.
- **Beklenen ve önerilen düzeltme:** Router search. Zod validateSearch / useSearch / navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-265 · 47-feedback · React state → Base UI

- **Kanıt:** `apps/web/src/features/feedback/ui/components/research-binding-feedback.tsx:25`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Denetimsiz Dialog içindeki mount edilen Query bileşeni yalnız açıkken okumalı.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.Root / Dialog.Trigger / Dialog.Popup; Dialog.Trigger / Dialog.Close / actionsRef.close()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-266 · 47-feedback · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/feedback/ui/forms/create-feedback-form.tsx:46`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Zod ve sunucu hataları gönderilen taslakla birlikte tutulmalı.
- **Beklenen ve önerilen düzeltme:** TanStack Form. formApi.setErrorMap / form.Subscribe selector errorMap.onSubmit; formApi.setErrorMap / form.Subscribe isSubmitSuccessful
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-267 · 48-screens-and-wireframes · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/screens/ui/components/canvas-text-overlay.tsx:21`, `const [draft, setDraft] = useState(initialValue);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sadece geçici metin ve keyboard commit; render state kaldırılabilir, kabul edilen overlay ve engine transaction sınırı sürer.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Dokümante DOM textarea overlay / defaultValue ve commit anında DOM okuma
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-268 · 48-screens-and-wireframes · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/screens/ui/components/linked-block-controls.tsx:76`, `const [preview, setPreview] = useState<LinkedBlockChangeResult>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 9 çağrı, 5 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Bağlı bloğun etki önizlemesi sunucudan geliyor; Edit ve Apply sonrasında reset.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewLinkedBlockChange.queryOptions / data veya mutation.data; applyLinkedBlockChange mutation.error / detach için engine sonucu; useMutation, isPending ve variables (çoklu sürüm okuma + çıktı); useMutation.error / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-269 · 48-screens-and-wireframes · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/screens/ui/components/presentation-mode.tsx:30`, `const [state, setState] = useState<PresentationState | null>(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Renderer dışındaki salt okunur Presentation State mevcut Snapshot ve etkileşimli hotspot geçmişini tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Sunum gezinmesi ve gizli blokları için tanımlı sahip yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-270 · 48-screens-and-wireframes · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:69`, `const [size, setSize] = useState({ height: 600, width: 960 });`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Boyut Konva Stage ve viewport hesaplamasını besliyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. ResizeObserver ölçümü; renderer durumunun sahibi belirlenmemiş
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-271 · 48-screens-and-wireframes · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:70`, `const [measured, setMeasured] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Varsayılan Stage boyutundan ayrılan gerçek pozitif ölçüm ilk restore işaretini belirliyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. null ölçümden hasMeasured türet
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-272 · 48-screens-and-wireframes · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:125`, `const [session] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Zaten gerçek TanStack Store olan tek Canvas viewport oturumunun kimliği React state içinde saklanıyor; 0.11 useCreateStore callback overload’u salt okunur derived Store döndürür, mevcut fabrika initializer’ı diye doğrudan geçme.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore ile atomik oturum verisi, ya da bir kez oluşturulan engine Store’unu scope’a bağla; Wireframe editor.store / useSelector; useCreateStore(initialValue, actions) / useSelector veya mount-scope engine Store
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-273 · 48-screens-and-wireframes · React state → Base UI

- **Kanıt:** `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:47`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Convert and Bind açık/kapalı, başarı veya iptal kapatır.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.Trigger / actionsRef.close(); Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-274 · 48-screens-and-wireframes · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:50`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Girdi ve önizleme hatası ile onay hatası farklı adımlarda.
- **Beklenen ve önerilen düzeltme:** TanStack Form. setErrorMap / form.Subscribe ve confirm mutation.error; setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-275 · 49-user-flow · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:60`, `const [plan, setPlan] = useState<UserFlowRebindPlan | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Mount edildiğinde useEffect ile alınan sunucu planı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. previewUserFlowRebind.queryOptions / useQuery.data; preview query.error / rebind mutation.error; rebindUserFlowBind mutation.isPending; saveUserFlowVersion mutation.error / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-276 · 49-user-flow · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:225`, `const [collapsed, setCollapsed] = useState<string[]>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kişisel viewport kapsamına dahil olan Section collapse hem Outline hem viewport kaydına gidiyor.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector; User Flow editor Store selector
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-277 · 49-user-flow · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:269`, `const [textDraft, setTextDraft] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Node metni komut uygulanana kadar yerel, seçim değişimi/iptal semantiği korunmalı; gönderilen form modellenirse Form sahibi olur.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Inspector canlı metin taslağı için tanımlı sahip yok; React Flow 13 renderer adapter geçici node değişiklikleri
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-278 · 49-user-flow · React state → Router search

- **Kanıt:** `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:23`, `const [selectedId, setSelectedId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçili akış liste, detay, viewport ve binds Query girdisini belirliyor; navigation dirty guard korunmalı.
- **Beklenen ve önerilen düzeltme:** Router search. validateSearch / useSearch / navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-279 · 49-user-flow · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/user-flow/ui/forms/convert-and-bind-form.tsx:111`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 7 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Preview/confirm hatalarını Form hatası olarak göstermek.
- **Beklenen ve önerilen düzeltme:** TanStack Form. setErrorMap / form.Subscribe ve confirm mutation.error; setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-280 · 49-user-flow · React state → Base UI

- **Kanıt:** `apps/web/src/features/user-flow/ui/views/user-flow-view.tsx:141`, `const [converting, setConverting] = useState<UserFlowNodeView | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Tıklanan düğümün Convert and Bind diyalog payload’ı.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.createHandle<Payload> / Trigger handle payload
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-281 · 50-moodboards · useVirtualizer({ getItemKey: index => rowKey(rows[index]), … })

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:409`, `const virtualizer = useVirtualizer({`. **Kural:** §6.9 getItemKey.
- **Kullanım ve etki:** Virtual Outline data-index, measureElement ve React key’i doğru veriyor, ancak virtualizer kendi ölçüm/cache kimliği için varsayılan index kullanıyor. Reorder veya collapse sonrası farklı satır eski indeks ölçüsünü devralabiliyor.
- **Beklenen ve önerilen düzeltme:** useVirtualizer({ getItemKey: index => rowKey(rows[index]), … }). Virtualizer kimliğini mevcut rowKey’e bağla; ölçülen inspector satırları ve section collapse/reorder durumlarını koru.
- **Güven:** yüksek. Ölçüm tekrar tetiklenirse sapma geçici olabilir.

#### TK-282 · 50-moodboards · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-board.tsx:32`, `const [size, setSize] = useState(DEFAULT_SIZE);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Ölçüm kart koordinatları ve ilk viewport hesabını etkiliyor. Pacer bildirim sıklığını yönetebilir.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Tarayıcı ölçümü / ResizeObserver; render durumunun sahibi belirlenmemiş; Canlı kamera veya viewport için renderer oturumu sahibi belirlenmemiş
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-283 · 50-moodboards · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:283`, `const [inspectedId, setInspectedId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Outline içindeki satırlar arasında tek açık inspector kimliği.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. useCreateStore / useSelector; createStoreContext / useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-284 · 50-moodboards · React state → Base UI

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-view-tools.tsx:104`, `const [cropOpen, setCropOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Crop düzenleyicisinin inline açılma durumu; yalnız başarılı kayıt kapatmalı. Başarı sonrası programatik kapatma gerekiyorsa Store kontrollü kaynak olarak kullanılabilir.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-285 · 50-moodboards · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/moodboards/ui/components/moodboard-view-tools.tsx:255`, `const [index, setIndex] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Presentation Mode içinde önceki/sonraki odak adımının indeksi.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Sunum gezinmesi için belgelenmiş durum sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-286 · 50-moodboards · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/moodboards/ui/forms/add-color-swatch-form.tsx:37`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 6 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Renk ve not doğrulama hatası.
- **Beklenen ve önerilen düzeltme:** TanStack Form. setErrorMap / form.Subscribe errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-287 · 50-moodboards · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/moodboards/ui/forms/moodboard-snapshot-form.tsx:42`, `const [preview, setPreview] = useState<MoodboardSnapshotPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sunucu preview sonucu form değişince siliniyor; reset/variables ile seçili kapsamla eşleşmesi korunmalı.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. snapshotPreview mutation.data / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-288 · 51-project-wall · TanStack Virtual 3.14 useVirtualizer({ getItemKey: (index) => rowKey(rows[index]) , ... })

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-outline.tsx:313`, `const virtualizer = useVirtualizer({`. **Kural:** 6.9 getItemKey kayıt kimliği döner; değişken yükseklikte measureElement + data-index.
- **Kullanım ve etki:** Değişken yükseklikli ve yeniden sıralanabilen (Move up/down) Outline satırlarında getItemKey yok; ölçüm cache'i indekse bağlı.
- **Beklenen ve önerilen düzeltme:** TanStack Virtual 3.14 useVirtualizer({ getItemKey: (index) => rowKey(rows[index]) , ... }). getItemKey ekle; rowKey zaten mevcut.
- **Güven:** orta. Sıralama/grup daraltma sonrası ölçülen yükseklikler yanlış satıra atfedilebilir; görsel kayma kanıtı çalıştırılarak doğrulanmadı.

#### TK-289 · 51-project-wall · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/project-wall/hooks/use-personal-project-wall-view.ts:53`, `const [saveError, setSaveError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. save.isError (useMutation sonucu); yeni mutate durumu zaten sıfırlar; preview?.moves.length === 0 iken metin hesaplanır
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-290 · 51-project-wall · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:173`, `const [preview, setPreview] = useState<AutoLayoutPreview | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Konva/React Flow kendi düğüm sürüklemesi kuralı
- **Beklenen ve önerilen düzeltme:** Sahipsiz. İstemcide hesaplanan Auto-layout önerisi; canlı canvas etkileşimi, stack sahibi yok; Auto-layout geri alma kaydı; yerel canvas komutu; React Flow kontrollü node durumu (sürükleme/seçim RF'nin kendi işi); useEffect ile modelNodes aynalaması gereksiz render yaratıyor, RF onNodesChange/applyNodeChanges akışı kendi sorumluluğunda
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-291 · 51-project-wall · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:175`, `const [optimistic, setOptimistic] = useState<`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Outline ve canvas aynı wall verisini okuyor; overlay yalnız canvas'ta
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Taşıma mutation'ı: onMutate'te orpc.projectWall queryKey setQueryData snapshot, onError geri alma, onSettled invalidate (6.2 / 6.10); write() yardımcısı yerine useMutation(orpc.x.mutationOptions()).error; sayfa düzeyi için useMutationState; Kişisel görünüm sorgusunun cache'i: schedule anında queryClient.setQueryData(orpc.projectWallViewport.queryKey(...)) ile iyimser collapse; Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-292 · 51-project-wall · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-outline.tsx:458`, `const [inspectedId, setInspectedId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçili kayıt Router kuralı ile spec'in 'never persisted' kuralı çelişiyor; kullanıcı kararı
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Spec gereği oturumluk, kalıcı/geri yüklenmez → Router search uygun değil; tek bileşen
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-293 · 51-project-wall · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-presentation.tsx:43`, `const [index, setIndex] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Sunum modunda geçici adım imleci
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-294 · 51-project-wall · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-scene.tsx:52`, `const [selection, setSelection] = useState<string[]>([]);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Wall içi geçici grup gezintisi; restore veya link gereği yoksa component scope.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Canvas ve Outline arasında paylaşılan oturumluk seçim: createStoreContext / useCreateStore + useSelector; Bileşen kapsamlı TanStack useCreateStore ve useSelector.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-295 · 51-project-wall · React state → Router search

- **Kanıt:** `apps/web/src/features/project-wall/ui/components/project-wall-surface.tsx:41`, `const [chosenId, setChosenId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Seçili Proje Duvarı: proje kabuğu route search'üne wallId (validateSearch Zod .catch(undefined)), navigate({ search })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-296 · 51-project-wall · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/project-wall/ui/views/project-wall-view.tsx:112`, `const [presenting, setPresenting] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Base UI popup değil; View dalı bütün düzenleme araçlarını gizliyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Presentation Mode tam görünüm değişimi. Görünüm sahibi için karar gerekli.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-297 · 52-spec-change-review · React state → Base UI

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/components/spec-change-review-candidates.tsx:50`, `const [followUpOpen, setFollowUpOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.Trigger ile kontrolsüz Dialog veya createHandle<Candidate>(); başarıda actionsRef.current?.close()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-298 · 52-spec-change-review · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:116`, `const [workType, setWorkType] = useState<SpecFollowUpWorkType>("Task");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Dialog içi useForm field; önizleme sorgusu useSelector(form.store, s => s.values.workType) ile anahtarlanır
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-299 · 52-spec-change-review · React state → Router search

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/components/spec-change-review-surface.tsx:29`, `const [selectedId, setSelectedId] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Seçili inceleme reviewId search'te
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-300 · 52-spec-change-review · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/spec-change-review/ui/views/spec-change-review-view.tsx:89`, `const [current, setCurrent] = useState<number | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Paylaşılabilir bölüm bağlantısı istenirse Router; spec istemiyor
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Diff bölümleri arasında yürüme imleci (klavye gezinme)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-301 · 53-test-plan-and-handoff · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:36`, `useState<PlannedTestRelationTargetType>("Work");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 12 çağrı, 5 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array"); useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-302 · 53-test-plan-and-handoff · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:45`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-303 · 53-test-plan-and-handoff · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:52`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok; 'Choose a Wireframe version.' doğrulama metni alt form validator'ına (form) taşınabilir
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-304 · 53-test-plan-and-handoff · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:42`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Pano kopyalama sonucu duyurusu
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-305 · 53-test-plan-and-handoff · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:127`, `const [preview, setPreview] = useState<TestHandoffPackagePreview>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset(); useMutation(orpc.x.mutationOptions()).error / isError; produce mutation isSuccess + data.packageVersion; useMutation(...).isPending
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-306 · 53-test-plan-and-handoff · React state → Base UI

- **Kanıt:** `apps/web/src/features/planned-tests/ui/views/planned-tests-view.tsx:74`, `const [editing, setEditing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-307 · 54-test-report-acceptance · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/test-report/ui/forms/test-session-import-form.tsx:23`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Dosya seçimi doğrulaması field validator (onChange), ayrıştırma/sunucu hatası setErrorMap({ onSubmit }); useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-308 · 55-test-gaps · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:45`, `useState<TestGapRelationTargetType>("Feature");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array"); useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-309 · 55-test-gaps · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:54`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-310 · 55-test-gaps · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:202`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Plan/unplan eylemleri için mutation isSuccess + variables; useMutation(orpc.x.mutationOptions()).error / isError
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-311 · 55-test-gaps · React state → Base UI

- **Kanıt:** `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:430`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan; decisions useQuery Panel içine taşınınca enabled gerekmez
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-312 · 56-test-assessments · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/test-assessments/ui/forms/record-test-assessment-form.tsx:42`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-313 · 57-test-review-and-follow-up · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/test-review/ui/components/test-review-signals.tsx:41`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 9 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. useMutation(orpc.x.mutationOptions()).error / isError; useMutation(...).isPending; Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset(); useMutation(...).isSuccess / data (veya variables)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-314 · 57-test-review-and-follow-up · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/test-review/ui/forms/test-review-supersedes-form.tsx:31`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden; isSubmitSuccessful (form.reset() sonrası korunup korunmadığı doğrulanmalı; değilse mutation isSuccess); Toplu inceleme için seçili Session Test'ler: useForm array field (mode="array"), previewBulk onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-315 · 57-test-review-and-follow-up · React state → Router search

- **Kanıt:** `apps/web/src/features/test-review/ui/views/test-review-view.tsx:381`, `const [panel, setPanel] = useState<Panel | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Panel payload'ı sunucu önizlemesi taşıyor; yalnız kimlik/kip URL'ye gider
- **Beklenen ve önerilen düzeltme:** Router search. Açık panel türü ve hedef kimlikleri search'te; panel önizleme verisi query/mutation data'dan
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-316 · 57-test-review-and-follow-up · React state → Base UI

- **Kanıt:** `apps/web/src/features/test-review/ui/views/test-summary-view.tsx:132`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible kontrolsüz (defaultOpen=false)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-317 · 58-product-gaps · React state → Base UI

- **Kanıt:** `apps/web/src/features/product-gaps/ui/components/dogfooding-summary.tsx:154`, `const [opened, setOpened] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible; escapes useQuery'si yalnız açıkken mount olan Panel içindeki bileşene taşınırsa enabled bayrağına gerek kalmaz; Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-318 · 58-product-gaps · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/product-gaps/ui/components/product-gap-links-field.tsx:46`, `useState<ProductGapLinkTargetType>("Project");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. closeErrorText error.data.conditions ayrıştırıyor; bkz. S6-5
- **Beklenen ve önerilen düzeltme:** TanStack Form. Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array"); useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden; isSubmitSuccessful (form.Subscribe)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-319 · 58-product-gaps · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/product-gaps/ui/components/product-gap-links-field.tsx:50`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-320 · 58-product-gaps · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/product-gaps/ui/components/product-gaps-board.tsx:55`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. useMutation(orpc.x.mutationOptions()).error / isError; setStatus mutation isSuccess + variables.status; Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset(); preview/confirm mutation error; doğrulama metni form errorMap
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-321 · 58-product-gaps · React state → Router search

- **Kanıt:** `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:58`, `const [filter, setFilter] = useState<GapFilterValues>(EMPTY_GAP_FILTER);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Spec 58 dogfooding filtreleri; yenilemede/paylaşımda filtre kayboluyor
- **Beklenen ve önerilen düzeltme:** Router search. /_auth/product-gaps route'una validateSearch: Zod şeması (.catch('')), Route.useSearch(), navigate({ search: prev => ({...prev, ...patch}) }), varsayılanlar için stripSearchParams
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-322 · 59-technical-diagrams · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/technical-diagrams/hooks/use-personal-technical-diagram-view.ts:31`, `const [saveError, setSaveError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. save.isError; createVersion.error ?? restoreVersion.error; placeCard/moveCard/removeCard/previewConvert/confirmConvert error'larından hesaplanır; previewMutation.error ?? confirmMutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-323 · 59-technical-diagrams · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:78`, `const [opening] = useState(() =>`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. State mekanizması olarak kullanılıyor ama hiç güncellenmiyor
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Setter'sız mount anlık görüntüsü (viewport açılış kararı); render'ı yalnız ilk değerle etkiliyor
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-324 · 59-technical-diagrams · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:130`, `const [collapsed, setCollapsed] = useState(opening.collapsed);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Yerel grup görünürlüğü; Query snapshot varsayılan olabilir, güncel seçim UI sahibindedir.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. Bileşen kapsamlı TanStack useCreateStore ve useSelector.; AddColumnForm ve AddIndexForm arasında paylaşılan geçici tablo seçimi: useCreateStore + useSelector
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-325 · 60-schema-artifacts · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/schema-artifacts/ui/components/change-draft.tsx:102`, `const [confirmError, setConfirmError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. confirm.error (useMutation sonucu)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-326 · 60-schema-artifacts · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/schema-artifacts/ui/components/change-draft.tsx:135`, `const [edited, setEdited] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Alternatif: Store; form sahipliği daha yakın
- **Beklenen ve önerilen düzeltme:** TanStack Form. UpEditForm'un gönderilmiş Up SQL değeri; form ChangeDraft'a taşınıp schemaChangePreview girdisi useSelector(form.store, s => submitted value) ile okunur
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-327 · 60-schema-artifacts · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/schema-artifacts/ui/components/sql-output.tsx:22`, `const [message, setMessage] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Pano kopyalama duyurusu
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Ekle/kaldır/kopyala sonrası aria-live duyurusu; stack'te sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-328 · 60-schema-artifacts · React state → Router search

- **Kanıt:** `apps/web/src/features/schema-artifacts/ui/views/schema-artifacts-view.tsx:20`, `const [versionId, setVersionId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Router search. Route zaten diagramId search'ü taşıyor; versionId/sourceId/targetId aynı validateSearch'e (Zod .catch(undefined))
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-329 · 61-github-integration · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/github-integration/ui/components/github-work-links-panel.tsx:97`, `const [notice, setNotice] = useState<GitHubNoticeState>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Öneri kabulü, bağ kaldırma ve sinyal kapatma aynı status/alert alanını yazar. Hata ve başarıyı komut türüyle eşle; eşzamanlı çağrıda eski tamamlanma yeni bildirimin üzerine yazabilir.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data; oRPC previewGitHubCreateWork.queryOptions ve Query data / select; adımı seçili Issue ile bağla
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-330 · 61-github-integration · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/github-integration/ui/forms/create-work-form.tsx:43`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 7 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. İş taslağı doğrulama veya oluşturma hatasını form içinde gösterir.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit; TanStack Form form.Subscribe ile isSubmitSuccessful; TanStack Form ile gönderilmiş değer; oRPC searchGitHubRecords.queryOptions + skipToken veya olay içi queryClient.query
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-331 · 61-github-integration · React state → Base UI

- **Kanıt:** `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:103`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Triage açıklığını ve tembel okumayı yönetir. Sorguyu yalnız açık panelde etkinleştir.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible.Root / Trigger / Panel; Base UI Dialog.createHandle<Action>(), Trigger payload ve actionsRef.close(); önizleme oRPC queryOptions
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-332 · 63-release-planning · React state → Base UI

- **Kanıt:** `apps/web/src/features/project-release-planning/ui/components/project-release-planning-detail.tsx:262`, `const [editing, setEditing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Hipotez editörünü gösterir; iptalde veya kayıtta kapanır. Satır içi açıklık korunacaksa Collapsible uygun.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close(); Base UI AlertDialog.createHandle<TerminalStatus>(), Trigger payload ve Root actionsRef.close()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-333 · 63-release-planning · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:27`, `const [savedMessage, setSavedMessage] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Proje Sürümü yazma başarısını işlemin kimliğinden ve sonucundan türet; birden fazla komut ortak panele yazıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data; oRPC transitionProjectSourceRecord.mutationOptions + useMutation.isPending; useMutation.error / reset
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-334 · 63-release-planning · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/project-release-planning/ui/forms/project-release-audience-form.tsx:24`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 5 çağrı, 5 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kitle bağlantısı seçimini doğrulama ve ilişki yazma hatasını gösterir.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-335 · 64-release-evidence · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/release-evidence/ui/forms/add-checklist-item-form.tsx:19`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sürüm kontrol listesi metni ve ekleme hatası.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-336 · 66-production-incidents · React state → Base UI

- **Kanıt:** `apps/web/src/features/production-incidents/ui/components/production-incident-detail.tsx:64`, `const [editing, setEditing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 3 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Mevcut Üretim Olayı editörünün açılması, iptali ve başarılı kayıtta kapanması. Satır içi editör tasarımı kalacaksa Collapsible Root, kayıt sonrası kapanış için Dialog actionsRef.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close(); Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() ve onOpenChange eventDetails.cancel()
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-337 · 66-production-incidents · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:45`, `const [values, setValues] = useState<ProductionIncidentFollowUpValues | null>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Onaylanan Work türü ve başlığını geri dönülen formun varsayılanına ve confirm girdisine kopyalar. Alan değerini formda tut, onayı veriyle aynı sorgu girdisine bağla.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form Field ve form.state.values; aynı değerleri preview Query input olarak kullan; TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-338 · 67-value-chain · React state → Base UI

- **Kanıt:** `apps/web/src/features/value-chain/ui/views/value-chain-view.tsx:77`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Fill this gap sahip yüzeye giden iki bağlantıyı açığa çıkarır.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-339 · 68-project-history · React state → Router search

- **Kanıt:** `apps/web/src/features/project-history/ui/components/project-activity-surface.tsx:60`, `const [filters, setFilters] = useState<ProjectActivityFilters>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Uygulanmış kaynak türü ve olay türü Query girdisini ve sayfa sıfırlamayı yönetiyor; yeniden yükleme ve geri gezinme seçimleri korumuyor. Form geçici alanların sahibi kalır.
- **Beklenen ve önerilen düzeltme:** Router search. TanStack Router validateSearch (Zod), Route.useSearch ve navigate({ search })
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-340 · 68-project-history · React state → Base UI

- **Kanıt:** `apps/web/src/features/project-history/ui/views/project-activity-view.tsx:109`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Proje Etkinliği ve Kayıt geçmişi kümesinin atomik olaylarını açar; küme veri birleştirme sınırı aynen korunur.
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI Collapsible.Root / Trigger / Panel
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-341 · 69-project-updates · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/project-updates/ui/forms/project-update-form.tsx:45`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Manuel Proje Güncellemesi işareti/anlatısı doğrulaması ve kaydetme hatası.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit; TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit; Skip hatası için skip mutation.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-342 · 69-project-updates · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-updates/ui/forms/project-update-reminder-form.tsx:48`, `const [busy, setBusy] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kaydetme ve Skip aynı bayrakla kilitlenir; her birinin gerçek işlem durumunu kullan.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. form.Subscribe isSubmitting ve useMutation.isPending (Skip); gerekiyorsa mutation scope.id ile seri çalıştır
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-343 · 70-project-closure-summary · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:64`, `const [stage, setStage] = useState<Stage>({`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçim ve editör adımını, sunucu taslağını, başlangıç markdown değerini ve kaydedilmiş Belge kimliğini bir araya getirir. Form seçim/metin sahibi, Query taslak ve save sonuç sahibi, yerel ömürlü Store yalnız adım ve yeni taslak niyetinin sahibi.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. TanStack Store useCreateStore + useSelector ile yalnız seç/generate geçişi; Query data ve Form values ayrı
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-344 · 70-project-closure-summary · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:69`, `const [failed, setFailed] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Generate/Preview, Save ve Planned date history aynı hata bayrağını değiştirir; eski istek yeni adımın uyarısını etkileyebilir.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. Her komut için Query error + reset; form doğrulaması için setErrorMap; oRPC projectClosureSummaryDateComparison.queryOptions; key girdisinde seçili Work kaynakları, yaşam döngüsünde mevcut taslak kimliği
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-345 · 70-project-closure-summary · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:70`, `const [pending, setPending] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçim ve belge formu kendi gönderimini await etmiyor; dış bayrak iki formun gönderim durumunu taklit ediyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form onSubmit içinden Promise await ve form.Subscribe isSubmitting; Query isFetching/isPending alt işlemler için
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-346 · 70-project-closure-summary · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:71`, `const [generation, setGeneration] = useState(0);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sayaç yalnız React key üretir; gerçek taslak kimliği zaten oluşturuluyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. Editör key değerini mevcut taslak saveKey üzerinden türet; form.reset() ile seçimi ve editör değerlerini sıfırla
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-347 · 71-attention-signals · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:22`, `const [opened, setOpened] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. open mutation `data` (mutationFn zaten { output, signalRowId } döndürüyor); previewFollowUp `data`; create başarısında `previewFollowUp.reset()`; createFollowUp `isSuccess` + `data.created`; mark/open/previewFollowUp/createFollowUp `error` (ilk dolu olan)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-348 · 71-attention-signals · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:27`, `const [attempt, setAttempt] = useState(() => crypto.randomUUID());`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Sadece komut kimliği, JSX okuması yok; aynı attempt boyunca kalıcı.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-349 · 71-attention-signals · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/attention-signals/ui/forms/public-roadmap-review-form.tsx:25`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; Zod hatası `validators.onSubmit`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-350 · 72-personal-shell · React state → Base UI

- **Kanıt:** `apps/web/src/features/personal-shell/ui/components/personal-shell.tsx:35`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Sheet(Dialog) kontrolsüz + `actionsRef.current?.close()` (renderSurface/Open full page kapatması)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-351 · 72-personal-shell · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/personal-shell/ui/components/personal-shell.tsx:36`, `const [surface, setSurface] = useState<PersonalShellSurface>(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kullanıcı kararı: sahipsiz mi bileşen ömürlü Store mu.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Router search spec 72 'panel içi gezinme geri yüklenmez' kuralıyla dışlanıyor; Base UI Tabs kontrolsüz SheetTitle/Link'i besleyemez; alternatif `useCreateStore`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-352 · 73-link-sharing · `orpc.previewShareScope.queryOptions({ input: root ? { root } : skipToken })`

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:39`, `input: { root: root ?? { id: "", kind: "Document" } },`. **Kural:** 6.1 Koşullu okuma: `input: cond ? … : skipToken`.
- **Kullanım ve etki:** Sahte girdi + `enabled` ile koşullu sorgu; sahte anahtar cache'e tip dışı bir input koyar.
- **Beklenen ve önerilen düzeltme:** `orpc.previewShareScope.queryOptions({ input: root ? { root } : skipToken })`. skipToken'a geç, `enabled`'ı kaldır.
- **Diğer konumlar:** `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:37`.
- **Güven:** yüksek.

#### TK-353 · 73-link-sharing · React state → Router search

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:28`, `const [selectedKey, setSelectedKey] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Paylaşılacak seçili kayıt; secret değil.
- **Beklenen ve önerilen düzeltme:** Router search. /_auth/projects/$projectId `validateSearch` (Zod `.catch`) + `useSearch` + `navigate({ search })`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-354 · 73-link-sharing · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:34`, `const [issued, setIssued] = useState<IssuedShareLink | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Bir kez gösterilen Secret; default Query mutation cache veya persist edilen Store üzerinden taşınmamalı.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Sahip kararı gerekli; 16. bölüm.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-355 · 73-link-sharing · React state → Base UI

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:45`, `const [confirming, setConfirming] = useState<Confirming>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Bugün satır içi fieldset; satır içi kalırsa sahipsiz (uncertain).
- **Beklenen ve önerilen düzeltme:** Base UI. AlertDialog `createHandle<'reopen' | 'revoke'>()` payload + başarıda `actionsRef.close()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-356 · 73-link-sharing · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:158`, `const [pendingExpiry, setPendingExpiry] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 6 çağrı, 4 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. ShareExpiryForm `expiry` alan değeri; reopen onayı `onSubmitMeta` ile aynı form gönderiminden; TanStack Form boolean alanı + `form.Subscribe` ile disabled; `setErrorMap({ onSubmit })`; Zod `validators.onSubmit`; `setErrorMap({ onSubmit })`; remove yolu için setLinkPassword mutation `error`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-357 · 74-wiki-publishing · React state → Base UI

- **Kanıt:** `apps/web/src/features/wiki-publishing/ui/forms/wiki-publication-form.tsx:50`, `const [unpublishOpen, setUnpublishOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog kontrolsüz: `DialogTrigger` + `DialogClose`; Dialog kontrolsüz + onSetIndexing başarısında `actionsRef.current?.close()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-358 · 75-build-in-public · React state → Base UI

- **Kanıt:** `apps/web/src/features/build-in-public/ui/forms/build-in-public-publication-form.tsx:46`, `const [confirmUnpublish, setConfirmUnpublish] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. AlertDialog kontrolsüz: `AlertDialog.Trigger` + `AlertDialog.Close`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-359 · 75-build-in-public · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/build-in-public/ui/forms/build-in-public-slug-form.tsx:30`, `const [slugError, setSlugError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. slug alanında `validators.onSubmit` (parseSetSlug) + `setErrorMap`; Preview düğmesi için `form.validateField('slug','submit')`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-360 · 76-external-surface-management · React state → Base UI

- **Kanıt:** `apps/web/src/features/external-surface-management/ui/components/remove-surface-control.tsx:18`, `const [confirming, setConfirming] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. AlertDialog + başarıda `actionsRef.current?.close()`; hata olursa açık kalır
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-361 · 76-external-surface-management · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/external-surface-management/ui/components/remove-surface-control.tsx:19`, `const [failed, setFailed] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. removeExternalSurface mutation `error`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-362 · 77-trash · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/trash/hooks/use-move-to-trash-flow.ts:22`, `const [pending, setPending] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 10 çağrı, 3 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. preview/move mutation `isPending` + `variables` (aday anahtarı); mutation `error` + `variables`; preview mutation `data` + `variables.candidate`; preview mutation `data`, confirmIdentity mutation `data` (grant) / `isPending`; başarısız silmede `confirmIdentity.reset()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-363 · 77-trash · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/trash/ui/forms/permanently-delete-form.tsx:63`, `const [invalid, setInvalid] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. `validators.onSubmit` (permanentlyDeleteFromTrashInputSchema) + `setErrorMap`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-364 · 78-security-redaction · React state → oRPC / Query

- **Kanıt:** `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:56`, `const [review, setReview] = useState<{`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 4 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Hassas değer zaten form alanında; kopyası state'e alınmamalı ve Query cache'e (queryKey/variables) girmemeli.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. preview mutation `data`, confirmIdentity mutation `data` (grant) + `isPending` (identityPending); sensitiveValue RedactForm alanında kalır; apply mutation `data`; preview/apply `isPending`; mutation `error` + `isDefinedError` (S8-6)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-365 · 78-security-redaction · React state → Base UI

- **Kanıt:** `apps/web/src/features/security-redaction/ui/components/security-redaction-panel.tsx:32`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible (kontrolsüz, iptal için kontrollü gerekir) veya AlertDialog + `actionsRef.close()`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-366 · 79-data-export · React state → Base UI

- **Kanıt:** `apps/web/src/features/data-export/ui/components/export-preview-panel.tsx:60`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Collapsible Root/Trigger/Panel (kapalı Panel varsayılan olarak unmount); liste için useVirtualizer (S8-1)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-367 · 79-data-export · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/data-export/ui/components/export-surface.tsx:19`, `const [handoff] = useState(takeExportHandoff);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Setter hiç kullanılmıyor; useState tek seferlik sessionStorage okumasını sabitlemek için. Yüzlerce id taşıyabildiği için Router search uygun değil.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. `data-export/store` altında createStore; liste ekranı yazar, Export yüzeyi `useSelector` ile okuyup unmount'ta temizler
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-368 · 79-data-export · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/data-export/ui/forms/export-form.tsx:134`, `const [refusal, setRefusal] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. `setErrorMap({ onSubmit })` / `validators.onSubmit` (exportRequestSchema)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-369 · 80-data-import · `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` (@cantiara/ui/components/table)

- **Kanıt:** `apps/web/src/features/data-import/ui/components/import-preview-panel.tsx:36`, `<table className="w-full text-left text-sm">`. **Kural:** Stack shadcn/ui satırı (uygulama bileşenleri); 6.8 markup için `@cantiara/ui` Table.
- **Kullanım ve etki:** Sıralama/filtre yok (TanStack Table gerekmez, satırlar 50 ile sınırlı) ama ham <table> markup'ı kullanılıyor; aynı gruptaki shares-and-publications-view.tsx `@cantiara/ui` Table kullanıyor.
- **Beklenen ve önerilen düzeltme:** `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` (@cantiara/ui/components/table). İki tabloyu @cantiara/ui Table'a çevir.
- **Diğer konumlar:** `apps/web/src/features/data-import/ui/components/import-preview-panel.tsx:148`.
- **Güven:** orta. 6.8 maddesi markup'ı TanStack Table bağlamında söylüyor; düz tablo için zorunluluk yorum gerektiriyor.

#### TK-370 · 80-data-import · React state → Render dışı useRef

- **Kanıt:** `apps/web/src/features/data-import/ui/components/import-apply-panel.tsx:42`, `const [key] = useState(newApplyKey);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Apply key yalnız olayda kullanılır. Ayrı reopen key, saklı makbuzu seçen görünüm girdisi olarak prop/receipt kimliğine bağlanır.
- **Beklenen ve önerilen düzeltme:** Render dışı useRef. useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-371 · 80-data-import · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/features/data-import/ui/components/import-receipt-reopen.tsx:20`, `const [key] = useState(() => lastApplyKey() ?? undefined);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 2 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Bugün import-view appliedCount remount'u ile yeniden okunuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. Apply mutation `variables.idempotencyKey` prop olarak; yoksa `lastApplyKey()` bir kez useRef; Remount sayacı yerine apply mutation `variables.idempotencyKey` ImportReceiptReopen'a prop
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-372 · 80-data-import · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/data-import/ui/forms/import-file-form.tsx:44`, `const [error, setError] = useState<string>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. `setErrorMap({ onSubmit })` + files alanı `validators.onSubmit`
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-373 · 81-personal-data · React state → TanStack Form

- **Kanıt:** `apps/web/src/features/personal-data-rights/ui/forms/personal-data-contact-form.tsx:28`, `const [refusal, setRefusal] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. İki düğmenin Contact Zod doğrulama hatası. Kullanıcıya gösterilen mesajı Form errorMap’e taşı. https://tanstack.com/form/latest/docs/reference/classes/FormApi#seterrormap
- **Beklenen ve önerilen düzeltme:** TanStack Form. TanStack Form 1.33.5 `form.setErrorMap({ onSubmit })` ve `form.Subscribe`; iki preview için uygun `onSubmitMeta`.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-374 · 83-project-retirement · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/features/project-retirement/ui/components/archive-surface.tsx:23`, `const [deleting, setDeleting] = useState<ArchivedProjectEntry | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Satır seçimi geçici, kart içinde inline ve tek seçim. State bütün server kaydının snapshot’ını saklıyor; preview güncel revision verirken onay seçilen eski satırın revision’ını gönderebiliyor. Onayı gösterilen preview revision’ına bağla. Base UI Collapsible kontrollü panel olursa `open` id eşitliğinden türetilir.
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. `useCreateStore` + `useSelector` ile yalnız `projectId`; geçerli Archive satırı ve Delete Project preview ayrı Query `data` değerlerinden türetilir.
- **Güven:** yüksek. Çağrı bazında etkiler 13. bölümde.

#### TK-375 · 83-project-retirement · React state → Base UI

- **Kanıt:** `apps/web/src/features/project-retirement/ui/components/project-archive-control.tsx:27`, `const [previewing, setPreviewing] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Boolean yalnız inline Archive önizlemesinin açıklığını ve query etkinliğini tutuyor. Collapsible için `createHandle` veya `actionsRef.close()` API’si yok. https://base-ui.com/react/components/collapsible
- **Beklenen ve önerilen düzeltme:** Base UI. Base UI 1.9 `Collapsible.Root` + `Trigger` + `Panel`; iptal/başarı ile dışarıdan kapama gerekiyorsa `open`/`onOpenChange` kaynağı bileşen kapsamlı Store.
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-376 · ortak · query: useMutation({ ...orpc.x.mutationOptions(), onSuccess }) ; online kapısı lib/client-shell.ts MutationCache.o…

- **Kanıt:** `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:34`, `const createSession = useMutation({`. **Kural:** 6.1 Yazma: useMutation(orpc.x.mutationOptions({ onSuccess, onError })); mutationFn içinde client.x() yalnız gerekçeli durumlarda. Geçersizleme: orpc.x.queryKey({ input }) / orpc.x.key().
- **Kullanım ve etki:** Sadece bir RPC çağrısı yapan mutation’ların bir kısmı ortak prosedür anahtarı ve varsayılanlarını aktarmadan tanımlanıyor. runOnlineOnlyWrite içindeki updateRequired kontrolü ve idempotency girdisi ayrı sorumluluk. Query’nin zaten çalıştığı bu formlarda başlıca eksi prosedürel anahtar ve aynı sözleşmenin tekrarı.
- **Beklenen ve önerilen düzeltme:** query: useMutation({ ...orpc.x.mutationOptions(), onSuccess }) ; online kapısı lib/client-shell.ts MutationCache.onMutate'te zaten var, runOnlineOnlyWrite gerekiyorsa ortak bir mutation varsayılanına/MutationCache'e taşınır; anahtar için orpc.x.queryKey({ input }).. v1.16.3 mutationOptions çıktısının mutationKey ve varsayılanlarını koruyan ortak sarmalayıcı. Gerekli yerlerde üretilen mutationFn’i runOnlineOnlyWrite ile sar veya mutationOptions({mutationFn: …}) ver. Parametre dönüşümü, ADR-0004 idempotency anahtarı ve Update required politikası korunmalı. Çok prosedürlü kompozisyonlar ve dış/native servisler ayrı kalır.
- **Etkilenen spec’ler:** 11-work-drafts, 12-relations, 13-tags, 14-file-attachments, 16-work-context, 17-work-templates, 18-work-checklists, 19-blockers, 20-priority, 02-account-preferences, 04-mutation-and-undo, 09-work-lifecycle, 21-record-actions, 23-completion-effects, 24-external-handoffs, 25-kanban, 26-backlog, 27-daily-focus, 28-unified-calendar, 29-roadmap-horizon, 30-focus-period, 31-documents, 39-favorites, 46-contact-and-company, 50-moodboards, 51-project-wall, 52-spec-change-review, 59-technical-diagrams, 83-project-retirement.
- **Diğer konumlar:** `apps/web/src/features/file-attachments/hooks/use-bind-file-attachment-location.ts:17`, `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:632`, `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:638`, `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:648`, `apps/web/src/features/file-attachments/ui/forms/file-attachment-upload-form.tsx:78`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:47`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:63`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:75`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:87`, `apps/web/src/features/prioritization-sessions/hooks/use-prioritization-sessions.ts:99`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:77`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:89`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:100`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:111`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:122`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:156`, `apps/web/src/features/priority-metrics/hooks/use-priority-metrics.ts:168`, `apps/web/src/features/relations/ui/components/work-relations.tsx:93`, `apps/web/src/features/relations/ui/components/work-relations.tsx:106`, `apps/web/src/features/relations/ui/components/work-relations.tsx:147`, `apps/web/src/features/relations/ui/components/work-relations.tsx:177`, `apps/web/src/features/relations/ui/components/work-relations.tsx:208`, `apps/web/src/features/relations/ui/components/work-relations.tsx:235`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:89`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:101`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:113`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:125`, `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:142`, `apps/web/src/features/work-checklists/ui/components/work-checklist-editor.tsx:30`, `apps/web/src/features/work-checklists/ui/components/work-checklist-editor.tsx:62`, `apps/web/src/features/work-checklists/ui/components/work-checklist-editor.tsx:81`, `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:71`, `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:95`, `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:127`, `apps/web/src/features/work-templates/hooks/use-work-templates.ts:23`, `apps/web/src/features/work-templates/hooks/use-work-templates.ts:34`, `apps/web/src/features/work-templates/hooks/use-work-templates.ts:51`, `apps/web/src/features/work-templates/hooks/use-work-templates.ts:66`, `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:32`, `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:265`, `apps/web/src/features/account-preferences/lib/account-preferences-mutation-error.ts:23`, `packages/api/src/routers/index.ts:13970`, `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:687`, `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:145`, `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:155`, `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:169`, `apps/web/src/features/record-actions/hooks/use-record-actions.ts:17`, `apps/web/src/features/record-actions/hooks/use-record-actions.ts:28`, `apps/web/src/features/record-actions/hooks/use-record-actions.ts:43`, `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:95`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:32`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:49`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:57`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:74`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:87`, `apps/web/src/features/external-handoffs/hooks/use-external-handoffs.ts:92`, `apps/web/src/features/kanban/ui/components/project-work-kanban.tsx:69`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:86`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:284`, `apps/web/src/features/backlog/ui/components/project-backlog.tsx:312`, `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:254`, `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:266`, `apps/web/src/features/unified-calendar/ui/views/unified-calendar-view.tsx:153`, `apps/web/src/features/unified-calendar/ui/views/unified-calendar-view.tsx:180`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:60`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:78`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:96`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:108`, `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:254`, `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:385`, `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:397`, `apps/web/src/features/roadmap-horizon/ui/forms/horizon-form.tsx:22`, `apps/web/src/features/roadmap-horizon/ui/forms/research-direction-form.tsx:16`, `apps/web/src/features/roadmap-horizon/ui/forms/roadmap-view-form.tsx:79`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:41`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:52`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:57`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:62`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:67`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:72`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:77`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:83`, `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:89`, `apps/web/src/features/documents/ui/forms/document-organization-form.tsx:81`, `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:255`, `apps/web/src/features/documents/ui/forms/document-transfer-form.tsx:153`, `apps/web/src/features/favorites/ui/components/favorites-list.tsx:30`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:73`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:81`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:86`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:101`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:119`, `apps/web/src/features/contacts/ui/views/contacts-view.tsx:136`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:24`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:37`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:55`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:73`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:93`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:106`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:124`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:143`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:156`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:170`, `apps/web/src/features/moodboards/hooks/use-moodboards.ts:175`, `apps/web/src/features/moodboards/hooks/use-personal-moodboard-view.ts:24`, `apps/web/src/features/project-wall/hooks/use-personal-project-wall-view.ts:36`, `apps/web/src/features/technical-diagrams/hooks/use-personal-technical-diagram-view.ts:32`, `apps/web/src/features/spec-change-review/ui/components/spec-change-review-surface.tsx:38`, `apps/web/src/features/technical-diagrams/ui/forms/diagram-authority-conversion-form.tsx:91`, `apps/web/src/features/project-retirement/hooks/use-project-retirement.ts:33`, `apps/web/src/features/project-retirement/hooks/use-project-retirement.ts:48`, `apps/web/src/features/web-macos-client/store/client-shell.ts:182`.
- **Güven:** orta. 6.1 yalnız basit tek çağrılar için uygulanır. Online-only, sıralama, override veya kompozisyon gerekçesi olan her inline mutation otomatik ihlal değildir.

#### TK-377 · ortak · TanStack Query queryClient.query ile ortak taze okuma ilkesi.

- **Kanıt:** `apps/web/src/lib/fetch-current-work.ts:8`, `return queryClient.query({`. **Kural:** §6.2, PR #540 §7; [Query 5.108.0](https://github.com/TanStack/query/releases/tag/@tanstack%2Freact-query%405.108.0).
- **Kullanım ve etki:** 12 olay içi okuma 10 dosyada ayrı ayrı staleTime: 0 veriyor. Work mevcut yardımcıdan okurken Import Receipt ve Research Binding ayrıca gcTime: 0 geçiriyor. Biçim ve önbellek politikasını anlamak için çağrı yerlerini tek tek incelemek gerekiyor.
- **Beklenen ve önerilen düzeltme:** TanStack Query queryClient.query ile ortak taze okuma ilkesi.. Tipi koruyan fetchFresh yardımcısına taşı. Önce her prosedürün neden taze veri istediğini ve gcTime: 0 kısıtını kaydet. Silinmesi gereken kısa ömürlü veriyi açık ayrı seçenek olarak koru.
- **Etkilenen spec’ler:** 04-mutation-and-undo, 09-work-lifecycle, 31-documents, 43-research-sessions, 44-sources-and-freshness, 57-test-review-and-follow-up, 61-github-integration, 77-trash, 80-data-import, 21-record-actions, 22-bulk-editing, 28-unified-calendar, 30-focus-period.
- **Diğer konumlar:** `apps/web/src/features/data-import/hooks/use-reopen-import-receipt.ts:8`, `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:261`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:100`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:29`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:37`, `apps/web/src/features/research-sessions/ui/components/research-sessions-surface.tsx:45`, `apps/web/src/features/sources-and-freshness/hooks/use-smart-link-preview.ts:15`, `apps/web/src/features/test-review/ui/components/test-review-surface.tsx:66`, `apps/web/src/features/trash/hooks/use-move-to-trash-preview.ts:9`, `apps/web/src/features/trash/hooks/use-permanent-delete-from-trash.ts:40`, `apps/web/src/features/trash/hooks/use-preview-restore-from-trash.ts:13`, `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:75`, `apps/web/src/features/github-integration/ui/components/github-integration-surface.tsx:104`.
- **Güven:** yüksek. query() geçerli API. Bir veri sızıntısı ya da API kullanımdan kalkma bulgusu değil.

#### TK-378 · ortak · validateSearch: z.object({ configurationReturn: z.string().min(1).optional().catch(undefined), ... }) (TanStack Ro…

- **Kanıt:** `apps/web/src/routes/_auth/projects/$projectId/index.tsx:22`, `validateSearch: (search) => {`. **Kural:** 6.5 validateSearch doğrudan Zod 4 şeması alır, değerler .catch(varsayılan) ile güvenceye alınır.
- **Kullanım ve etki:** Paylaşılan gruptaki dört route search'ü elle typeof kontrolüyle (contacts.tsx'te fonksiyon içinde safeParse) doğruluyor.
- **Beklenen ve önerilen düzeltme:** validateSearch: z.object({ configurationReturn: z.string().min(1).optional().catch(undefined), ... }) (TanStack Router 1.170.46 Standard Schema doğrulayıcıyı doğrudan kabul eder). Her route için Zod şemasını route dosyasında veya feature lib/ altında tanımla ve doğrudan validateSearch'e ver; smartCollectionWorkPrefillFromSearch'ü şema parçasına çevir.
- **Etkilenen spec’ler:** 07-project-shell, 34-smart-collections, 46-contact-and-company, 60-schema-artifacts, 15-workspace-overview.
- **Diğer konumlar:** `apps/web/src/routes/_auth/contacts.tsx:7`, `apps/web/src/routes/_auth/projects/$projectId/schema-artifacts.tsx:9`, `apps/web/src/routes/_auth/projects/index.tsx:7`.
- **Güven:** orta. 6.5 taslak sözleşme; davranış doğru, etki tutarlılık.

#### TK-379 · ortak · export const projectWorksQueryPrefix = orpc.projectWorks.key();

- **Kanıt:** `apps/web/src/utils/orpc.ts:87`, `export const projectWorksQueryPrefix = orpc.projectWorks`. **Kural:** 6.1 Geçersizleme: orpc.x.key() (kısmi), elle anahtar kurulmaz.
- **Kullanım ve etki:** Prosedür öneki sahte input ile tam anahtar üretip dilimlenerek elle kuruluyor. @orpc/tanstack-query 1.16.3 generateOperationKey [path, {...}] döndürür; orpc.projectWorks.key() aynı kapsamı ([path, {}]) resmi API ile verir.
- **Beklenen ve önerilen düzeltme:** export const projectWorksQueryPrefix = orpc.projectWorks.key();. Dilimlemeyi orpc.projectWorks.key() ile değiştir; 22 tüketici dosya değişmeden kalır.
- **Etkilenen spec’ler:** 09-work-lifecycle.
- **Güven:** yüksek. Hesap kapsamlı yardımcılar (accountPreferences, workspaceOverview, captureInbox, discovery) üretilen anahtara accountId ekliyor; bu bilinçli hesap izolasyonu ve oRPC queryOptions({ queryKey }) seçeneği var, bulgu sayılmadı.

#### TK-380 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `apps/fumadocs/package.json:18`, `"lucide-react": "1.75.0",`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** lucide-react için yerel kaynak/test/config importu sıfır. MDX ve Next app dosyalarında import yok. Fumadocs UI 16.19.4, lucide-react paketini kendi dependencies alanında bildiriyor.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. apps/fumadocs/package.json içindeki doğrudan lucide-react kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-381 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `package.json:54`, `"zod": "catalog:"`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** zod için yerel kaynak/test/config importu sıfır. Kök kod, config ve scriptlerde Zod importu yok. Tarayıcı, API ve diğer gerçek tüketiciler kendi manifestlerinde bağımlılığı bildiriyor. Root catalog girdisi ayrı tutulabilir.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. package.json içindeki doğrudan zod kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-382 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `packages/api/package.json:23`, `"@orpc/client": "catalog:",`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** @orpc/client için yerel kaynak/test/config importu sıfır. API sözleşmesi RouterClient tipini @orpc/server üzerinden alıyor (packages/api/src/routers/index.ts). Uygulamadaki gerçek istemcinin manifesti apps/web/package.json. API kaynak/test/declaration dosyalarında doğrudan istemci referansı yok.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. packages/api/package.json içindeki doğrudan @orpc/client kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-383 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `packages/api/package.json:24`, `"@orpc/openapi": "catalog:",`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** @orpc/openapi için yerel kaynak/test/config importu sıfır. OpenAPI sunucu adaptörü apps/server/src/app.ts:138–139 içinde ve apps/server kendi manifestinde ilan ediyor. API kontratı üretimde, testte ve mevcut declaration çıktısında bu pakete başvurmuyor.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. packages/api/package.json içindeki doğrudan @orpc/openapi kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-384 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `packages/api/package.json:26`, `"@orpc/zod": "catalog:",`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** @orpc/zod için yerel kaynak/test/config importu sıfır. ZodToJsonSchemaConverter apps/server/src/app.ts:143 tarafında ve apps/server kendi manifestini kullanıyor. API kontratı Zod şemalarını doğrudan zod üzerinden kuruyor. API içinde kaynak ve declaration referansı yok.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. packages/api/package.json içindeki doğrudan @orpc/zod kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-385 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `packages/auth/package.json:21`, `"zod": "catalog:"`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** zod için yerel kaynak/test/config importu sıfır. Auth kaynakları Zod import etmiyor. Better Auth 1.7.25 kendi bağımlılığında Zod bildiriyor. Auth manifestindeki declaration/build veya script bu paketi istemiyor.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. packages/auth/package.json içindeki doğrudan zod kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-386 · ortak · Bağımlılık, tüketen workspace manifestinde.

- **Kanıt:** `packages/ui/package.json:22`, `"date-fns": "^4.4.0",`. **Kural:** § Amaç ve kurallar, bağımlılığın kendi manifestinde doğrulanmış tüketicisi.
- **Kullanım ve etki:** date-fns için yerel kaynak/test/config importu sıfır. UI kaynak ve config dosyalarında import yok. Takvim bileşeni react-day-picker import ediyor; react-day-picker 10.0.2 date-fns paketini kendi dependencies alanında bildiriyor.
- **Beklenen ve önerilen düzeltme:** Bağımlılık, tüketen workspace manifestinde.. packages/ui/package.json içindeki doğrudan date-fns kaydını kaldırmayı öner. Daha sonra ilgili workspace build ve tip kontrolü ile doğrula.
- **Güven:** yüksek. Bu denetimde manifest veya kurulum değiştirilmedi; öneri statik kanıta dayanıyor.

#### TK-387 · ortak · React state → TanStack Form

- **Kanıt:** `apps/web/src/components/custom-field-editor-form.tsx:121`, `const [formError, setFormError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. safeParse hatası için elle form hata metni (6.3).
- **Beklenen ve önerilen düzeltme:** TanStack Form. onSubmit içinde formApi.setErrorMap({ onSubmit: issue.message }) + form.Subscribe selector={s => s.errorMap.onSubmit}
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-388 · ortak · React state → oRPC / Query

- **Kanıt:** `apps/web/src/components/custom-field-editor-form.tsx:122`, `const [actionError, setActionError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Dört mutation'ın catch bloğunda error kopyalanıyor (6.2); create hatası zaten create.error ile okunuyor (satır 342).
- **Beklenen ve önerilen düzeltme:** oRPC / Query. update.error ?? moveToTrash.error ?? restore.error ?? deletePermanently.error; yeni denemede mutation.reset()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-389 · ortak · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/components/custom-field-editor-form.tsx:123`, `const [editingId, setEditingId] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Router search'e taşımak spec 10 davranışı gerektirmiyor; karar 16. bölüme.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Satır içi düzenleme modu; yalnız bu editör ve prop ile alt liste kullanıyor, URL/Store/Form sahibi tanımlı değil
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-390 · ortak · React state → Base UI

- **Kanıt:** `apps/web/src/components/date-picker.tsx:58`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Kontrollü open yalnız seçimden sonra kapatmak için tutuluyor.
- **Beklenen ve önerilen düzeltme:** Base UI. Kontrolsüz Popover + Popover.Root actionsRef; onSelect ve Clear içinde actionsRef.current?.close() (Base UI 1.9.0 PopoverRoot.actionsRef)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-391 · ortak · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/components/date-picker.tsx:170`, `const [draftTime, setDraftTime] = useState("");`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Seçenek: kontrolsüz time Input + ref (render dışı) — kullanıcı kararı.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Bileşik kontrolün tarih seçilmeden yazılan saat taslağı; form değeri sözleşmesi tek 'yyyy-MM-ddTHH:mm' dizesi olduğu için Form alanı değil
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-392 · ortak · React state → Base UI

- **Kanıt:** `apps/web/src/components/personal-reminder-control.tsx:48`, `const [open, setOpen] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. @cantiara/ui dialog.tsx createHandle dışa aktarmıyor; eklenmesi gerekir.
- **Beklenen ve önerilen düzeltme:** Base UI. Dialog.createHandle<PersonalReminderAction>() + iki DialogTrigger handle payload; Dialog.Root children ({ payload }); sorgular popup içeriğine taşınınca enabled: open gereksizleşir; Aynı createHandle payload'ı (Remind me / Review Later)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-393 · ortak · React state → oRPC / Query

- **Kanıt:** `apps/web/src/components/personal-reminder-control.tsx:50`, `const [error, setError] = useState<string | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. onError callback'leriyle mutation hatası kopyalanıyor ve form doğrulama hatası prop ile üst bileşene yazılıyor.
- **Beklenen ve önerilen düzeltme:** oRPC / Query. create.error ?? cancel.error; PersonalReminderForm yerel doğrulaması için formApi.setErrorMap({ onSubmit })
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-394 · ortak · React state → TanStack Store / Table atomları

- **Kanıt:** `apps/web/src/components/personal-shell-host.tsx:15`, `const [day, setDay] = useState<string | undefined>();`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Panel içi Daily Focus seçili günü; spec 72 panel durumunu oturumluk tutar, URL'e yazılmaz (tam sayfa /daily-focus zaten Router search kullanıyor).
- **Beklenen ve önerilen düzeltme:** TanStack Store / Table atomları. personal-shell/store altında oturumluk createStore (active-working-set.ts örüntüsü) veya host'ta useCreateStore + useSelector; Aynı oturumluk store alanı (view: 'close' | undefined)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-395 · ortak · React state → TanStack Form

- **Kanıt:** `apps/web/src/components/record-action-form.tsx:213`, `const [editing, setEditing] = useState<RecordAction | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 2 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** TanStack Form. actionId/baseRevision'ı form değerine koy: form.reset(draftFromAction(action)) ve onSubmit value'dan oku; başlık için useSelector(form.store, s => s.values.actionId); stepResult/safeParse için setErrorMap({ onSubmit }); kaydetme ve Move to Trash hataları create.error/update.error/moveToTrash.error
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-396 · ortak · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/components/work-status-form.tsx:93`, `const [reopenTarget, setReopenTarget] = useState<WorkOpenStatus | null>(null);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. Setter WorkCompletionNotice alt bileşenine prop olarak geçiyor (satır 530+).
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Satır içi role="dialog" onay paneli; açılır pencere olmadığı için Base UI sahibi kesin değil. Seçenek: AlertDialog + createHandle<WorkOpenStatus>()
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-397 · ortak · React state → Hesaplanan değer

- **Kanıt:** `apps/web/src/components/youtube-preview-player.tsx:80`, `const [requested, setRequested] = useState(false);`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor.
- **Beklenen ve önerilen düzeltme:** Hesaplanan değer. status !== "idle" (load() iki state'i birlikte yazar, status idle'a dönmez)
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-398 · ortak · React state → Sahibi kararlaştırıldı (#553, §16.1)

- **Kanıt:** `apps/web/src/components/youtube-preview-player.tsx:81`, `const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(`. **Kural:** Raporun React state kuralı; §6.2–6.8 içinden duruma ait sözleşme.
- **Kullanım ve etki:** 1 çağrı, 1 dosyada aynı sorumluluk için React içinde ayrı state tutuyor. setTimeout'lar zaman aşımı (6.7 meşru); message dinleyicisi origin+source+Zod kontrolü yapıyor.
- **Beklenen ve önerilen düzeltme:** Sahipsiz. Üçüncü taraf iframe/YT Player yaşam döngüsünün emir kipli canlı durumu; Query/Store/Base UI sahibi yok
- **Güven:** yüksek. Bu grubun çağrıları ve ayrı hedefleri 13. bölümde.

#### TK-399 · ortak · Yerel proxy ayarı doğrulanmış env'den gelir: DatabaseConfig (packages/db/src/config.ts) `{ DATABASE_URL, localProx…

- **Kanıt:** `packages/db/src/local-postgres.ts:3`, `if (process.env.NEON_LOCAL === "true") {`. **Kural:** docs/tech-stack.md T3 Env: 'sunucuda process.env yalnız apps/server/src/env.ts ve ... smart-link-egress-env.ts dosyasında okunur'.
- **Kullanım ve etki:** @cantiara/db index.ts ve security-events.ts bu modülü yan etkiyle import ediyor; sunucu çalışma zamanında NEON_LOCAL ve NEON_LOCAL_PROXY doğrulamasız okunuyor. apps/server/src/env.ts:101 NEON_LOCAL_PROXY'yi zaten Zod ile doğruluyor ve :201'de NEON_LOCAL'ı okuyor; iki ayrı okuma kaynağı var. Mekanik raw-process-env kuralı yalnız apps/server/src/ kapsıyor (scripts/convention-check.ts:946), bu yüzden yakalanmıyor.
- **Beklenen ve önerilen düzeltme:** Yerel proxy ayarı doğrulanmış env'den gelir: DatabaseConfig (packages/db/src/config.ts) `{ DATABASE_URL, localProxy?: string }` alır, createDb/createSecurityEventDb neonConfig'i bu değerle kurar; apps/server/src/services.ts değeri env.ts'den geçirir.. local-postgres.ts'i `configureLocalPostgres(proxy: string | undefined)` fonksiyonuna çevir, yan etkili import'ları kaldır, services.ts'den env.NEON_LOCAL_PROXY ile çağır; scripts/ (CLI) tüketicileri kendi process.env okumalarını koruyabilir.
- **Diğer konumlar:** `packages/db/src/local-postgres.ts:7`, `packages/db/src/index.ts:4`, `packages/db/src/security-events.ts:4`, `apps/server/src/env.ts:101`.
- **Güven:** orta. Gizli değer istemciye taşınmıyor; etki doğrulama tutarlılığı. packages/db/src/env.ts yalnız drizzle.config.ts (Drizzle Kit CLI) tarafından import ediliyor, packages/db/scripts/* CLI; bunlar istisna sayıldı. Güven 'orta': tech-stack cümlesi 'sunucuda' diyor, packages/db'nin bu kurala dahil olup olmadığı yorum gerektiriyor.

## 13. React state envanteri

AST envanterinde **720 `useState`**, **0 `useReducer`** çağrısı var. Aynı kapsamda elle tutulan eşdeğer render state ayrı satır olarak görünür. shadcn istisnaları gösterilir ve ihlal toplamına girmez. Bir grubun önemi en ağır doğrulanmış çağrı etkisini, bu tablo her çağrının kendi önemini gösterir.

| Dosya:satır | Değişken | Hedef çözüm | Y/O/D | Bulgu |
| --- | --- | --- | --- | --- |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:41` | `link` | Store — TanStack Store createStore, useSelector; WXT browser.storage.local | D | TK-117 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:42` | `draft` | Store — TanStack Store createStore/useSelector; popup ömrü için useCreateStore | D | TK-117 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:43` | `targets` | Query — TanStack Query useQuery({queryKey, queryFn, enabled}); queryFn signal | O | TK-005 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:44` | `targetSearch` | Form — TanStack Form form.Field ve form.Subscribe veya Form useSelector | D | TK-118 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:45` | `error` | Türetilen — Form setErrorMap ve form.Subscribe; Query useQuery/useMutation error; yerel WXT işlem hatasına Store useSelector | D | TK-119 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:46` | `status` | Türetilen — TanStack Query useMutation().isSuccess/data/reset | D | TK-119 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:47` | `isPairing` | Form — TanStack Form form.Subscribe(s => s.isSubmitting) | D | TK-118 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:48` | `isSending` | Form — TanStack Form form.Subscribe(s => s.isSubmitting) | D | TK-118 |
| `apps/extension/src/features/capture-triage/ui/views/web-capture-view.tsx:49` | `isReading` | Store — TanStack Store createStore + useSelector(s => s.linkLoadStatus) | D | TK-117 |
| `apps/web/src/components/custom-field-editor-form.tsx:121` | `formError` | Form — onSubmit içinde formApi.setErrorMap({ onSubmit: issue.message }) + form.Subscribe selector={s => s.errorMap.onSubmit} | D | TK-387 |
| `apps/web/src/components/custom-field-editor-form.tsx:122` | `actionError` | Query — update.error ?? moveToTrash.error ?? restore.error ?? deletePermanently.error; yeni denemede mutation.reset() | D | TK-388 |
| `apps/web/src/components/custom-field-editor-form.tsx:123` | `editingId` | Karar #553 — Yerel edit Store. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-389 |
| `apps/web/src/components/date-picker.tsx:58` | `open` | Base UI — Kontrolsüz Popover + Popover.Root actionsRef; onSelect ve Clear içinde actionsRef.current?.close() (Base UI 1.9.0 PopoverRoot.actionsRef) | D | TK-390 |
| `apps/web/src/components/date-picker.tsx:170` | `draftTime` | Karar #553 — Kontrol Store: draftTime ve son yayılan değer. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-391 |
| `apps/web/src/components/personal-reminder-control.tsx:48` | `open` | Base UI — Dialog.createHandle<PersonalReminderAction>() + iki DialogTrigger handle payload; Dialog.Root children ({ payload }); sorgular popup içeriğine taşınınca enabled: open gereksizleşir | D | TK-392 |
| `apps/web/src/components/personal-reminder-control.tsx:49` | `action` | Base UI — Aynı createHandle payload'ı (Remind me / Review Later) | D | TK-392 |
| `apps/web/src/components/personal-reminder-control.tsx:50` | `error` | Query — create.error ?? cancel.error; PersonalReminderForm yerel doğrulaması için formApi.setErrorMap({ onSubmit }) | D | TK-393 |
| `apps/web/src/components/personal-shell-host.tsx:15` | `day` | Store — personal-shell/store altında oturumluk createStore (active-working-set.ts örüntüsü) veya host'ta useCreateStore + useSelector | D | TK-394 |
| `apps/web/src/components/personal-shell-host.tsx:16` | `view` | Store — Aynı oturumluk store alanı (view: 'close' \| undefined) | D | TK-394 |
| `apps/web/src/components/record-action-form.tsx:213` | `editing` | Form — actionId/baseRevision'ı form değerine koy: form.reset(draftFromAction(action)) ve onSubmit value'dan oku; başlık için useSelector(form.store, s => s.values.actionId) | D | TK-395 |
| `apps/web/src/components/record-action-form.tsx:214` | `error` | Form — stepResult/safeParse için setErrorMap({ onSubmit }); kaydetme ve Move to Trash hataları create.error/update.error/moveToTrash.error | D | TK-395 |
| `apps/web/src/components/work-status-form.tsx:89` | `selectedStatus` | Query — Normal Status eyleminde mutation.variables ve güncel Work verisi; gönderilen Close girdileri Form’da. | D | TK-106 |
| `apps/web/src/components/work-status-form.tsx:90` | `closePreview` | Query — previewClose.data; iptal/başarıda previewClose.reset() | O | TK-106 |
| `apps/web/src/components/work-status-form.tsx:93` | `reopenTarget` | Karar #553 — Satır içi onay Store; uygun ARIA, odak ve Escape. Reset, yönlendirme ve güncel durum: §16.1 G2 | D | TK-396 |
| `apps/web/src/components/work-status-form.tsx:94` | `error` | Query — updateStatus/previewClose/closeWork/reopenWork .error; closeForm safeParse hatası için setErrorMap({ onSubmit }) | D | TK-106 |
| `apps/web/src/components/youtube-preview-player.tsx:80` | `requested` | Türetilen — status !== "idle" (load() iki state'i birlikte yazar, status idle'a dönmez) | D | TK-397 |
| `apps/web/src/components/youtube-preview-player.tsx:81` | `status` | Karar #553 — YouTube adapter yerel Store. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-398 |
| `apps/web/src/features/account-access/lib/auth-session-check.ts:97` | `sessionCheckRetryConsumed` | Store — Account Access store ve useSelector; Retry hakkı tüketilince hata görünümü güncellenir, loader başarıyla tamamlandığında sıfırlanır. Router yükleme durumu ayrı seçilir. | D | TK-108 |
| `apps/web/src/features/account-access/ui/views/auth-route-error-view.tsx:21` | `isRetrying` | Router — useRouterState({ select: state => state.isLoading }); loader yenilemesi router.invalidate() olarak kalır. Retry hakkı ilgili deneme kimliğiyle ayrı izlenir. | D | TK-109 |
| `apps/web/src/features/account-access/ui/views/github-sign-in-view.tsx:16` | `isWaitingForGitHub` | Query — Better Auth taşıması korunur; TanStack Query mutation yalnız bekleme ve sonuç yaşam döngüsünü sarmalar. | D | TK-110 |
| `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:117` | `isOnline` | Store — useClientShellConnection; online/offline olaylarının ikinci aboneliği yerine Client Shell bağlantı durumunu oku. | D | TK-111 |
| `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:258` | `saveError` | Form — Şema hatasını formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile göster. Uzaktaki çatışma biçimini savePreferences.error üzerinden türet. | D | TK-112 |
| `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx:259` | `suggestion` | Türetilen — getBrowserPreferenceSuggestion çıktısını tarayıcı ortamından hesapla. SSR gerekirse sabit sunucu snapshot'ı ve aynı tarayıcı girdisinin istemci snapshot'ı kullanılır. | D | TK-113 |
| `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:22` | `opened` | Query — open mutation `data` (mutationFn zaten { output, signalRowId } döndürüyor) | D | TK-347 |
| `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:26` | `preview` | Query — previewFollowUp `data`; create başarısında `previewFollowUp.reset()` | D | TK-347 |
| `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:27` | `attempt` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-348 |
| `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:28` | `message` | Query — createFollowUp `isSuccess` + `data.created` | D | TK-347 |
| `apps/web/src/features/attention-signals/ui/components/notification-center-surface.tsx:29` | `error` | Query — mark/open/previewFollowUp/createFollowUp `error` (ilk dolu olan) | D | TK-347 |
| `apps/web/src/features/attention-signals/ui/forms/public-roadmap-review-form.tsx:25` | `error` | Form — `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; Zod hatası `validators.onSubmit` | D | TK-349 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:80` | `reappearDate` | Query — saveReappearDate.variables + isPending, sunucu alanı için query verisi | D | TK-184 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:81` | `dateOpen` | Base UI — Popover.Root actionsRef.current?.close() ve kontrolsüz Popover | D | TK-185 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:255` | `presentation` | Router — Project route validateSearch + navigate({ search }) | D | TK-186 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:256` | `priorityMetricId` | Router — Project route validateSearch + navigate({ search }) | D | TK-186 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:257` | `field` | Router — Project route validateSearch + navigate({ search }) | D | TK-186 |
| `apps/web/src/features/backlog/ui/components/project-backlog.tsx:272` | `now` | Karar #553 — Görünüm ömürlü saat Store; tarih Hesap saat diliminden türetilir. Reset, yönlendirme ve güncel durum: §16.1 G3 | D | TK-187 |
| `apps/web/src/features/build-in-public/ui/forms/build-in-public-publication-form.tsx:46` | `confirmUnpublish` | Base UI — AlertDialog kontrolsüz: `AlertDialog.Trigger` + `AlertDialog.Close` | D | TK-358 |
| `apps/web/src/features/build-in-public/ui/forms/build-in-public-slug-form.tsx:30` | `slugError` | Form — slug alanında `validators.onSubmit` (parseSetSlug) + `setErrorMap`; Preview düğmesi için `form.validateField('slug','submit')` | D | TK-359 |
| `apps/web/src/features/bulk-editing/hooks/use-bulk-work-selection.ts:37` | `selection` | Store — useCreateStore(initialValue, actions) + useSelector | D | TK-169 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:698` | `formKey` | Form — form.reset(), gerekirse reset eden Dialog yaşam döngüsü | D | TK-170 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:699` | `input` | Form — form.Subscribe selector ve form.state.values | D | TK-170 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:701` | `preview` | Query — useMutation({ mutationFn: buildBulkEditPreview }).data/reset | O | TK-029 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:703` | `previewError` | Query — previewMutation.error + buildSupportReferenceFailure | D | TK-029 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:704` | `isPreviewing` | Query — previewMutation.isPending | D | TK-029 |
| `apps/web/src/features/bulk-editing/ui/components/bulk-edit-dialog.tsx:705` | `progress` | Türetilen — useSelector(bulkEditOperationStore, selector) ile kaydedilmiş completed/total | D | TK-171 |
| `apps/web/src/features/capture-triage/hooks/use-capture-inbox.ts:32` | `undoPreview` | Query — Undo önizlemesi için useMutation veya olay içi Query sorgusu; mergeId için variables, sonuç için data, iptal veya başarıda reset. Satırdan sayfa paneline giden seçimi koru. | D | TK-005 |
| `apps/web/src/features/capture-triage/hooks/use-extension-links.ts:11` | `pairingCode` | Query — generatePairingCode.data ve reset. Tek kullanımlık kod için kalıcı cache, dehydrate veya log kullanmadan ekran ömründe göster. | D | TK-005 |
| `apps/web/src/features/capture-triage/ui/components/bulk-sense-making.tsx:50` | `layout` | Query — oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables. | O | TK-005 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:404` | `mode` | Store — useCreateStore ve useSelector; satırdaki üç çıkış, öneri, kurulum ve önizleme panelleri arasında geçici triage adımını koordine et. | D | TK-117 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:405` | `preview` | Query — previewConversion.data ile previewAttachment.data; aktif adıma ve son değişkenlere göre oku, adım değişince reset. | D | TK-005 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:407` | `suggestionData` | Query — suggestions.data; ilgili satır ve modla eşleştir, panel kapandığında reset. | D | TK-005 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:409` | `conversionValues` | Form — Kurulum useForm örneğini adım geçişlerinde yaşat; form.Field ve reset ile seçili Project/tür. Önizleme değişkenleri ayrıca useMutation.variables üzerinden okunabilir. | D | TK-118 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:414` | `attachmentValues` | Form — Kurulum useForm örneğinde relation ve targetId; öneri seçiminde setFieldValue, apply için onaylanan preview değişkenlerini kullan. | D | TK-118 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-item-actions.tsx:418` | `actionMessage` | Query — Aktif preview/apply/suggestions mutation.error değerinden inline metni üret, adım değişince ilgili mutation.reset(). | D | TK-005 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:460` | `captureComposerOpen` | Base UI — DialogTrigger veya Dialog.createHandle ile aç, başarılı onSaved sonrasında Dialog actionsRef.close(); hata halinde açık kalır. | D | TK-120 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:461` | `viewMode` | Store — useCreateStore/useSelector ile Inbox listesi ile Bulk sense-making yüzeyi arasındaki geçici oturum seçimi; spec URL veya kayıt paylaşımı istemiyor. | D | TK-117 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:463` | `sequentialTriageState` | Store — Capture Inbox oturum Store'u; useCreateStore/useSelector, görünüm ile Undo arasında sıra, geçerli öğe ve çözülen ID'ler. | D | TK-117 |
| `apps/web/src/features/capture-triage/ui/components/capture-inbox-surface.tsx:464` | `sequentialItems` | Türetilen — Oturum Store'unda yalnız sıralı öğe kimlikleri ve çözülenleri tut; geçerli kayıt için Inbox cache seçicisi. Çözülmüş kartı görme garantisi gerekiyorsa o kayıt için sınırlı oturum snapshot'ı tasarla. | D | TK-119 |
| `apps/web/src/features/capture-triage/ui/forms/capture-inbox-form.tsx:82` | `actionMessage` | Form — Şema hataları formApi.setErrorMap ve form.Subscribe, başarı ve sunucu hatası mutation.data/error/variables. Create Bug ve Save için onSubmitMeta. | D | TK-118 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:98` | `commandStack` | Store — Alt komut katmanları ve geri düğmesi için paletin geçici oturum Store'u ve useSelector. | D | TK-114 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:101` | `failureReason` | Store — Genel komut çalıştırıcısının sonuç durumu; ortak palet oturumu Store'u ve useSelector. Gerçek RPC komutunun hatası kendi mutation'ında kalır. | D | TK-114 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:102` | `isRunning` | Store — Palet oturum Store'u ve useSelector; executeCommand navigasyon ve eşzamanlı komut da çalıştırdığından bütün komutları Query mutation'ına dönüştürme. | D | TK-114 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:103` | `recordsReady` | Karar #553 — Palette oturumu Store; mevcut rAF zamanlaması korunur. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-115 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:104` | `query` | Store — Palet oturum Store'u/useSelector; başlangıç komutu ve komut arama girdisi, URL'ye taşınmaz. | D | TK-114 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:554` | `paletteStore` | Store — useCreateStore ile bileşen ömrüne bağlı store, useSelector ile okuma. | D | TK-114 |
| `apps/web/src/features/command-palette/ui/components/command-palette.tsx:564` | `registeredCommands` | Store — createStoreContext/useCreateStore ve useSelector; alt Project bileşenleri tarafından kaydedilen komutlar ortak Store'da, token ref'i kayıt temizleme kimliği olabilir. | D | TK-114 |
| `apps/web/src/features/completion-effects/hooks/use-user-initiated-work-success.ts:78` | `feedbackByWorkId` | Store — useCreateStore(initialValue, actions) + useSelector | D | TK-172 |
| `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:88` | `prefersReducedMotion` | Türetilen — matchMedia snapshot için useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot) | D | TK-173 |
| `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:89` | `previewing` | Karar #553 — Önizleme Store; timer ref içinde. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-174 |
| `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:90` | `previewStatus` | Türetilen — Preview evresi ve prefersReducedMotion üzerinden hesaplanan canlı mesaj | D | TK-173 |
| `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:91` | `saveError` | Form — form.setErrorMap({ onSubmit }) + form.Subscribe, ağ hatası mutation.error | D | TK-175 |
| `apps/web/src/features/completion-effects/ui/forms/completion-effects-form.tsx:92` | `hasSaved` | Query — savePreferences.isSuccess + reset veya mutation.variables ile güncel değer karşılaştırması | D | TK-176 |
| `apps/web/src/features/contacts/ui/views/contacts-view.tsx:54` | `selectedId` | Router — Route.useSearch / navigate({ search }) | D | TK-260 |
| `apps/web/src/features/contacts/ui/views/contacts-view.tsx:55` | `error` | Query — useMutation / error ve reset | D | TK-261 |
| `apps/web/src/features/contacts/ui/views/contacts-view.tsx:91` | `mergePair` | Store — useCreateStore / useSelector | D | TK-262 |
| `apps/web/src/features/contacts/ui/views/contacts-view.tsx:110` | `undoRetiredId` | Store — useCreateStore / useSelector | D | TK-262 |
| `apps/web/src/features/contacts/ui/views/contacts-view.tsx:111` | `undoNotice` | Query — undoMerge mutation.data / isSuccess / reset | D | TK-261 |
| `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:108` | `value` | Form — useForm ve form.Field; Text taslağını geçerli kayıt sürümünden ayrı koru, değiştiğinde doğrula ve blur kaydını await et. | D | TK-132 |
| `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:141` | `value` | Form — useForm ve form.Field; Number taslağı ve sayısal doğrulama, boş değer ile geçersiz sayıyı ayır ve blur kaydının hatasını alanda göster. | D | TK-132 |
| `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:185` | `open` | Base UI — Kontrolsüz Popover ve actionsRef.current?.close(); mevcut PopoverTrigger korunur. Popover.Close da uygun düğmeler için primitive olarak kullanılabilir. | D | TK-133 |
| `apps/web/src/features/custom-fields/ui/components/custom-field-values-form.tsx:312` | `actionError` | Query — values.setValue.error/clearValue.error ve reset; en son girişime ait hatayı göster. Taslak callback sunucu hatası üretmiyor. | D | TK-134 |
| `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:35` | `now` | Karar #553 — Görünüm ömürlü saat Store. Reset, yönlendirme ve güncel durum: §16.1 G3 | D | TK-189 |
| `apps/web/src/features/daily-focus/ui/views/daily-focus-view.tsx:245` | `rejectedCandidateIdsByDay` | Store — useCreateStore(initialValue, actions) + useSelector | D | TK-190 |
| `apps/web/src/features/data-export/hooks/use-export-flow.ts:23` | `pending` | Query — preview/produce `useMutation` `isPending` | O | TK-092 |
| `apps/web/src/features/data-export/hooks/use-export-flow.ts:24` | `refusal` | Query — mutation `error` → `exportRefusalMessage` (hedefte `isDefinedError`) | D | TK-092 |
| `apps/web/src/features/data-export/hooks/use-export-flow.ts:25` | `reviewing` | Query — preview mutation `data` + `variables` (request) | D | TK-092 |
| `apps/web/src/features/data-export/hooks/use-export-flow.ts:29` | `produced` | Query — produce mutation `data` | D | TK-092 |
| `apps/web/src/features/data-export/ui/components/export-preview-panel.tsx:60` | `open` | Base UI — Collapsible Root/Trigger/Panel (kapalı Panel varsayılan olarak unmount); liste için useVirtualizer (S8-1) | D | TK-366 |
| `apps/web/src/features/data-export/ui/components/export-surface.tsx:19` | `handoff` | Store — `data-export/store` altında createStore; liste ekranı yazar, Export yüzeyi `useSelector` ile okuyup unmount'ta temizler | D | TK-367 |
| `apps/web/src/features/data-export/ui/forms/export-form.tsx:134` | `refusal` | Form — `setErrorMap({ onSubmit })` / `validators.onSubmit` (exportRequestSchema) | D | TK-368 |
| `apps/web/src/features/data-import/ui/components/import-apply-panel.tsx:41` | `state` | Query — applyImport `useMutation`: `isPending`, `data.status === 'finalizing'`, `data.receipt`, `error` | D | TK-094 |
| `apps/web/src/features/data-import/ui/components/import-apply-panel.tsx:42` | `key` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-370 |
| `apps/web/src/features/data-import/ui/components/import-receipt-reopen.tsx:20` | `key` | Türetilen — Apply mutation `variables.idempotencyKey` prop olarak; yoksa `lastApplyKey()` bir kez useRef | D | TK-371 |
| `apps/web/src/features/data-import/ui/components/import-receipt-reopen.tsx:21` | `state` | Query — `useQuery(orpc.reopenImportReceipt.queryOptions({ input: { idempotencyKey } }), enabled:false)` + `refetch()` veya useMutation: `isPending`/`data`/`error` | D | TK-094 |
| `apps/web/src/features/data-import/ui/forms/import-file-form.tsx:44` | `error` | Form — `setErrorMap({ onSubmit })` + files alanı `validators.onSubmit` | D | TK-372 |
| `apps/web/src/features/data-import/ui/views/import-view.tsx:36` | `shown` | Query — preview `useQuery(orpc.previewImport.queryOptions({ input }))` (son anahtar kazanır) veya mutation `data`/`variables`; `excludedRows` Form array alanı | O | TK-094 |
| `apps/web/src/features/data-import/ui/views/import-view.tsx:41` | `actionError` | Query — preview/cancel mutation `error` | D | TK-094 |
| `apps/web/src/features/data-import/ui/views/import-view.tsx:42` | `appliedCount` | Türetilen — Remount sayacı yerine apply mutation `variables.idempotencyKey` ImportReceiptReopen'a prop | D | TK-371 |
| `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:30` | `selection` | Store — Bileşen kapsamlı useCreateStore + useSelector. | D | TK-232 |
| `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:31` | `prepared` | Query — `useMutation(orpc.previewDecisionSupersession.mutationOptions())` → `data`; iptal `reset()`; idempotency anahtarı `useRef` | D | TK-233 |
| `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:35` | `pending` | Query — commit için `useMutation(orpc.commitDecisionSupersession.mutationOptions())` → `isPending` | D | TK-233 |
| `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:36` | `error` | Query — oRPC + Query: `useMutation(orpc.x.mutationOptions())` sonucu `error` (beklenen hata için `isDefinedError`) | D | TK-233 |
| `apps/web/src/features/decisions/ui/components/decision-supersession-controls.tsx:37` | `conflict` | Türetilen — `commit.error` üzerinden CONFLICT kodundan türetilir | D | TK-234 |
| `apps/web/src/features/decisions/ui/components/project-decisions-panel.tsx:53` | `editing` | Karar #553 — Store: mode ve hedef recordId; editör kimliği ikisini içerir. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-235 |
| `apps/web/src/features/decisions/ui/components/project-decisions-surface.tsx:39` | `savedMessage` | Query — save/withdraw `useMutation` → `isSuccess` + `variables` (operation) ile durum metni | D | TK-233 |
| `apps/web/src/features/decisions/ui/forms/decision-editor-form.tsx:39` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-236 |
| `apps/web/src/features/decisions/ui/forms/decision-editor-form.tsx:40` | `conflict` | Form — `setErrorMap({ onSubmit: { conflict: true, ... } })` ile form hata değerinden okunur | D | TK-236 |
| `apps/web/src/features/decisions/ui/forms/decision-editor-form.tsx:41` | `baseRecord` | Form — Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı | D | TK-236 |
| `apps/web/src/features/decisions/ui/forms/supersession-selection-form.tsx:24` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-236 |
| `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:102` | `comparison` | Query — `compare.data` (zaten `useMutation`); temizleme `compare.reset()` | D | TK-210 |
| `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:103` | `error` | Query — `compare.error ?? resolve.error` | D | TK-210 |
| `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx:104` | `independentSeed` | Base UI — Base UI Dialog `createHandle<{ initial; result }>()` + `handle.openWithPayload(...)`; başarıda `actionsRef.current?.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/components/document-evidence-controls.tsx:100` | `dialog` | Base UI — Base UI Dialog `createHandle<{ mode; rebind; range }>()`; satırdan/butondan `Trigger handle payload` | D | TK-211 |
| `apps/web/src/features/documents/ui/components/document-evidence-controls.tsx:104` | `rebindRange` | Base UI — Açılış anındaki seçim aralığı aynı handle payload içinde taşınır | D | TK-211 |
| `apps/web/src/features/documents/ui/components/document-organization-controls.tsx:17` | `action` | Base UI — Base UI Dialog `createHandle<"hierarchy" \| "archive">()` + Trigger payload; başarıda `actionsRef.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/components/document-organization-controls.tsx:18` | `openCount` | Base UI — Remount sayacı gereksiz: kapanınca popup unmount olur / `onOpenChangeComplete` içinde `form.reset()` | D | TK-211 |
| `apps/web/src/features/documents/ui/components/document-preview.tsx:296` | `rendered` | Karar #553 — Mermaid render Store; kaynak başına istek kimliği. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-212 |
| `apps/web/src/features/documents/ui/components/document-preview.tsx:297` | `error` | Karar #553 — Aynı Mermaid render Store. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-212 |
| `apps/web/src/features/documents/ui/components/document-preview.tsx:344` | `error` | Türetilen — `katex.renderToString` try/catch ile render sırasında (`useMemo`) türetilir; effect + setState gerekmez | D | TK-213 |
| `apps/web/src/features/documents/ui/components/project-documents-surface.tsx:36` | `archived` | Router — `validateSearch` Zod `archived: z.boolean().catch(false)` + `Route.useSearch()` / `navigate({ search: prev => ... })` | D | TK-046 |
| `apps/web/src/features/documents/ui/components/project-documents-surface.tsx:49` | `selectedId` | Router — Seçili Document zaten route hash (`selectedDocumentId`) kaynaklı; useEffect ile yerel kopyaya aynalanıyor. Seçim `navigate({ hash: documentRecordHash(id) })` ile yazılmalı | O | TK-046 |
| `apps/web/src/features/documents/ui/components/project-documents-surface.tsx:52` | `createOpen` | Base UI — Kontrolsüz `DialogTrigger` + başarıda `actionsRef.current?.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-create-form.tsx:52` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:103` | `editSession` | Store — `useCreateStore` / `createStoreContext` ile editör oturumu; okuma `useSelector(store, selector)` (şu an `useSyncExternalStore(editSession.subscribe, editSession.get)`) | O | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:111` | `revision` | Türetilen — Edit session store `baseRevision` alanından `useSelector` ile; useEffect aynalaması kalkar | D | TK-213 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:112` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error`; save/restore `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:113` | `view` | Store — Editör oturum store alanı `view` (toolbar, efektler ve Tabs paylaşıyor); alternatif Router search sekmesi | D | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:116` | `conversionWarning` | Store — Editör oturum store alanı | D | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:117` | `selectedVersion` | Store — Editör oturum store alanı (`DocumentVersionHistory` ile paylaşılıyor) | D | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:138` | `previewBody` | Store — Editör oturum store alanı; preview sorgularının girdisi | D | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:139` | `savedBody` | Türetilen — Edit session store `saved` buffer’ından türetilir (store zaten tutuyor) | D | TK-213 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:140` | `selectedDiagramId` | Form — Ekleme araç çubuğu seçimleri `useForm` alanı (`lib/document-insert-form.ts` şeması) | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:141` | `sectionDocumentId` | Form — Ekleme araç çubuğu formu alanı | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:142` | `sectionId` | Form — Ekleme araç çubuğu formu alanı | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:143` | `recordReferenceChoice` | Form — Ekleme araç çubuğu formu alanı | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:144` | `selectedTextRange` | Store — Editör seçimi; evidence controls ve üç diyalog paylaşıyor → oturum store alanı | D | TK-047 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:148` | `pinEvidenceOpen` | Base UI — Base UI Dialog kontrolsüz Trigger + `actionsRef.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:149` | `bulkConversionOpen` | Base UI — Base UI Dialog kontrolsüz Trigger + `actionsRef.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:150` | `recordConversionOpen` | Base UI — Base UI Dialog kontrolsüz Trigger + `actionsRef.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:151` | `conversionSelection` | Base UI — Base UI Dialog `createHandle<{ start; end }>()` (open = seçim var) | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:155` | `conversionTitle` | Form — Zaten `DocumentDiagramConversionForm` `useForm` alanı; preview girdisi `useSelector(form.store)` + Pacer ile okunur, listener ile aynalanmaz | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:156` | `originalBlockOutcome` | Form — Aynı conversion formunun `originalBlock` alanı | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:164` | `convertedDiagram` | Query — `convertDiagram.data` | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-editor-form.tsx:173` | `workAction` | Base UI — Base UI Dialog `createHandle<{ id; kind; requestId }>()` (DocumentWorkActionDialog) | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-evidence-form.tsx:55` | `plan` | Query — Salt okunur önizleme için query(); hazırlık kaydı yazılıyorsa mutation. Bağlam değişince sonucu sıfırla. | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-evidence-form.tsx:56` | `pending` | Query — preview/confirm mutation `isPending` (form gönderimi için `isSubmitting`) | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-evidence-form.tsx:57` | `error` | Query — oRPC + Query: `useMutation(orpc.x.mutationOptions())` sonucu `error` (beklenen hata için `isDefinedError`) | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-evidence-role-form.tsx:32` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-formula-form.tsx:23` | `open` | Base UI — Popover kontrolsüz + başarıda `actionsRef.current?.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-formula-form.tsx:24` | `error` | Form — Alan seviyesi `validators.onSubmit` (Zod) veya `setErrorMap`; `field.state.meta.errors` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-link-form.tsx:24` | `open` | Base UI — Popover kontrolsüz + başarıda `actionsRef.current?.close()` | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-link-form.tsx:26` | `error` | Form — Alan seviyesi `validators.onSubmit` (Zod) / `field.state.meta.errors` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-organization-form.tsx:73` | `preview` | Query — `inspect.data`; `invalidatePreview` → `inspect.reset()` | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-organization-form.tsx:74` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:139` | `selection` | Karar #553 — Şablon seçicinin yerel Store; açılış payload’ı ayrı. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-215 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:144` | `mode` | Base UI — Base UI Dialog `createHandle<{ mode; template }>()` + Trigger payload | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:145` | `templateAtOpen` | Base UI — Aynı handle payload (`template`) | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:146` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:147` | `templateSaved` | Query — `save.isSuccess` (+ `variables`), seçim değişince `save.reset()` | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-templates-form.tsx:148` | `preview` | Query — `conversion.data` | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-transfer-form.tsx:45` | `action` | Base UI — Base UI Dialog `createHandle<TransferAction>()` + Trigger payload | D | TK-211 |
| `apps/web/src/features/documents/ui/forms/document-transfer-form.tsx:46` | `preview` | Query — `inspect` mutationFn sonucu döndürür → `inspect.data`; `resetPreview` → `inspect.reset()` | D | TK-210 |
| `apps/web/src/features/documents/ui/forms/document-transfer-form.tsx:47` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-214 |
| `apps/web/src/features/documents/ui/forms/document-transfer-form.tsx:48` | `exportPreview` | Query — `inspect.data` (export dalı) | D | TK-210 |
| `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:18` | `expanded` | Base UI — Collapsible.Root / Trigger / Panel | D | TK-258 |
| `apps/web/src/features/evidence/ui/components/evidence-flow-panel.tsx:52` | `sourceType` | Router — validateSearch / useSearch / navigate({ search }) | D | TK-259 |
| `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:210` | `expanded` | Base UI — Collapsible.Root defaultOpen; açık içerikte alt sorgu bileşenini mount et | D | TK-177 |
| `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:211` | `formError` | Form — StartHandoffForm form.setErrorMap({ onSubmit }) ve form.Subscribe | D | TK-178 |
| `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:212` | `writeError` | Query — start.error/reset ve form seviyesinde gösterim | D | TK-179 |
| `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:213` | `copiedHandoffId` | Karar #553 — Clipboard sonucu Store; history kayıt sonucu Query. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-180 |
| `apps/web/src/features/external-handoffs/ui/components/external-execution-handoff.tsx:214` | `copyError` | Karar #553 — Aynı Clipboard Store. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-180 |
| `apps/web/src/features/external-handoffs/ui/forms/cancel-handoff-form.tsx:22` | `error` | Form — form.setErrorMap({ onSubmit }) + form.Subscribe | D | TK-178 |
| `apps/web/src/features/external-handoffs/ui/forms/handoff-reconcile-form.tsx:55` | `preview` | Query — previewReconcile.data/reset; previewId doğrulama girdisi | D | TK-179 |
| `apps/web/src/features/external-handoffs/ui/forms/handoff-reconcile-form.tsx:56` | `error` | Form — form.setErrorMap({ onSubmit }) + form.Subscribe | D | TK-178 |
| `apps/web/src/features/external-handoffs/ui/forms/handoff-return-form.tsx:31` | `error` | Form — form.setErrorMap({ onSubmit }) + form.Subscribe | D | TK-178 |
| `apps/web/src/features/external-surface-management/ui/components/remove-surface-control.tsx:18` | `confirming` | Base UI — AlertDialog + başarıda `actionsRef.current?.close()`; hata olursa açık kalır | D | TK-360 |
| `apps/web/src/features/external-surface-management/ui/components/remove-surface-control.tsx:19` | `failed` | Query — removeExternalSurface mutation `error` | D | TK-361 |
| `apps/web/src/features/feedback/ui/components/convert-to-work-dialog.tsx:80` | `plan` | Query — previewFeedbackWork.queryOptions / skipToken / data | D | TK-263 |
| `apps/web/src/features/feedback/ui/components/convert-to-work-dialog.tsx:81` | `error` | Query — preview query.error / convert mutation.error | D | TK-263 |
| `apps/web/src/features/feedback/ui/components/convert-to-work-dialog.tsx:82` | `pending` | Query — query.isFetching / mutation.isPending | D | TK-263 |
| `apps/web/src/features/feedback/ui/components/feed-surface.tsx:9` | `query` | Router — Zod validateSearch / useSearch / navigate({ search }) | D | TK-264 |
| `apps/web/src/features/feedback/ui/components/research-binding-feedback.tsx:25` | `open` | Base UI — Dialog.Root / Dialog.Trigger / Dialog.Popup | D | TK-265 |
| `apps/web/src/features/feedback/ui/forms/create-feedback-form.tsx:46` | `error` | Form — formApi.setErrorMap / form.Subscribe selector errorMap.onSubmit | D | TK-266 |
| `apps/web/src/features/feedback/ui/forms/evidence-quality-form.tsx:53` | `status` | Form — formApi.setErrorMap / form.Subscribe isSubmitSuccessful | D | TK-266 |
| `apps/web/src/features/feedback/ui/views/feedback-view.tsx:62` | `error` | Query — setFeedbackIdentity / setFeedbackStatus mutation.error | D | TK-263 |
| `apps/web/src/features/feedback/ui/views/feedback-view.tsx:63` | `converting` | Base UI — Dialog.Trigger / Dialog.Close / actionsRef.close() | D | TK-265 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:312` | `surfaceSize` | Karar #553 — ResizeObserver -> yüzey Store. Reset, yönlendirme ve güncel durum: §16.1 G5 | D | TK-143 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:313` | `media` | Karar #553 — Element ve yükleme/ölçüm aboneliği aynı efekt içinde; ayrı render state yok. Reset, yönlendirme ve güncel durum: §16.1 G5 | D | TK-143 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:316` | `mediaSize` | Karar #553 — Media ölçüm Store. Reset, yönlendirme ve güncel durum: §16.1 G5 | D | TK-143 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:320` | `draft` | Karar #553 — Çizim hareketinin yerel Store’u. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-143 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:578` | `tool` | Store — useCreateStore (bileşen ömrü) veya createStoreContext: araç çubuğu, MarkupSurface ve PDF sayfaları (render prop) aynı değeri paylaşıyor | D | TK-144 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:579` | `markingError` | Query — createMarkingMutation.error / undoMarkingMutation.error (file-attachment-preview.tsx) — reset() ile temizleme | D | TK-145 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:580` | `locationOpen` | Store — Binder paneli + yüzey seçim modu paylaşıyor: tool ile aynı useCreateStore; panel tek başına olsaydı Base UI Collapsible | D | TK-144 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:581` | `locationKind` | Form — file-attachment-location-form useForm alanı (point/region); yüzey seçimi form.setFieldValue ile yazar | D | TK-146 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-markup.tsx:583` | `location` | Form — Bind as origin konumu gönderilen formun değeri: location form'un x/y/width/height/page alanları tek kaynak; şu an useState + useEffect setFieldValue ile çift kaynak | D | TK-146 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-pdf.tsx:52` | `loadedPages` | Karar #553 — PDF adapter Store: numPages; Document suspense=false. Reset, yönlendirme ve güncel durum: §16.1 G10 | D | TK-147 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-pdf.tsx:53` | `renderedPages` | Karar #553 — PDF adapter Store: render nesline göre sayfa kimlikleri kümesi. Reset, yönlendirme ve güncel durum: §16.1 G10 | D | TK-147 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-pdf.tsx:54` | `failed` | Karar #553 — PDF adapter toplu hata Store; tek alert ve Retry korunur; Page onLoadError dahil. Reset, yönlendirme ve güncel durum: §16.1 G10 | D | TK-147 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:394` | `loop` | Karar #553 — Media yerel Store; deklaratif loop prop ve kontrollü Checkbox. Reset, yönlendirme ve güncel durum: §16.1 G8 | D | TK-148 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:395` | `speed` | Store — Video.js React 10.5 player store'u (PlaybackRate / PlaybackRateRadioGroup UI) — TanStack Store değil, stack'teki Video.js sahibi | D | TK-144 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:514` | `state` | Query — useQuery({queryKey,queryFn:({signal})=>fetchFileAttachmentAsset(path,signal)}) — bkz. spec-2-2 | D | TK-145 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:577` | `assetRetryToken` | Query — query.refetch() — bkz. spec-2-2 | D | TK-145 |
| `apps/web/src/features/file-attachments/ui/components/file-attachment-preview.tsx:735` | `open` | Base UI — Base UI Collapsible (kontrolsüz defaultOpen, Collapsible.Trigger); panel açıklığı paylaşılacaksa Router search | D | TK-149 |
| `apps/web/src/features/file-attachments/ui/forms/file-attachment-location-form.tsx:105` | `preview` | Query — previewLocationMutation.data (file-attachment-preview.tsx:648) — onPreview mutateAsync sonucu kopyalanıyor | D | TK-145 |
| `apps/web/src/features/file-attachments/ui/forms/file-attachment-location-form.tsx:106` | `error` | Form — formApi.setErrorMap({ onSubmit }) + form.Subscribe errorMap.onSubmit; sunucu hatası mutation.error | D | TK-146 |
| `apps/web/src/features/file-attachments/ui/forms/file-attachment-upload-form.tsx:56` | `error` | Query — uploadMutation.error (abort hariç türetme) + uploadMutation.reset() dosya değişiminde | D | TK-145 |
| `apps/web/src/features/file-attachments/ui/forms/file-attachment-upload-form.tsx:57` | `phase` | Query — staging/idle → uploadMutation.isPending; 'finalizing' alt aşaması onFinalizeStart geri çağrısından geliyor, sahibi yok (Uppy sonrası finalize) | D | TK-145 |
| `apps/web/src/features/focus-period/ui/forms/focus-period-follow-up-form.tsx:41` | `clientIdempotencyKey` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-205 |
| `apps/web/src/features/focus-period/ui/forms/focus-period-follow-up-form.tsx:44` | `showPreview` | Form — form.Subscribe ve onSubmitMeta ile preview/confirm evresi | D | TK-206 |
| `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:32` | `error` | Query — Mutation error/reset ve form doğrulaması için form.setErrorMap({ onSubmit }) | D | TK-207 |
| `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:33` | `selectedId` | Router — /focus-periods validateSearch, Route.useSearch ve navigate({ search }) | D | TK-208 |
| `apps/web/src/features/focus-period/ui/views/focus-periods-view.tsx:231` | `showCloseReview` | Base UI — Collapsible.Root + Trigger + Panel | D | TK-209 |
| `apps/web/src/features/github-integration/ui/components/github-work-links-panel.tsx:97` | `notice` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-329 |
| `apps/web/src/features/github-integration/ui/forms/create-work-form.tsx:43` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-330 |
| `apps/web/src/features/github-integration/ui/forms/create-work-form.tsx:168` | `preview` | Query — oRPC previewGitHubCreateWork.queryOptions ve Query data / select; adımı seçili Issue ile bağla | D | TK-329 |
| `apps/web/src/features/github-integration/ui/forms/create-work-form.tsx:169` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-330 |
| `apps/web/src/features/github-integration/ui/forms/link-repository-form.tsx:42` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-330 |
| `apps/web/src/features/github-integration/ui/forms/link-repository-form.tsx:43` | `saved` | Form — TanStack Form form.Subscribe ile isSubmitSuccessful | D | TK-330 |
| `apps/web/src/features/github-integration/ui/forms/link-work-form.tsx:46` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-330 |
| `apps/web/src/features/github-integration/ui/forms/link-work-form.tsx:47` | `saved` | Form — TanStack Form form.Subscribe ile isSubmitSuccessful | D | TK-330 |
| `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:103` | `open` | Base UI — Base UI Collapsible.Root / Trigger / Panel | D | TK-331 |
| `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:192` | `pending` | Base UI — Base UI Dialog.createHandle<Action>(), Trigger payload ve actionsRef.close(); önizleme oRPC queryOptions | D | TK-331 |
| `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:323` | `search` | Form — TanStack Form ile gönderilmiş değer; oRPC searchGitHubRecords.queryOptions + skipToken veya olay içi queryClient.query | D | TK-330 |
| `apps/web/src/features/github-integration/ui/views/github-integration-view.tsx:383` | `notice` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-329 |
| `apps/web/src/features/kanban/ui/components/kanban-board.tsx:57` | `collapsedStatuses` | Base UI — Her kolon için kontrolsüz Collapsible.Root/Trigger/Panel | D | TK-182 |
| `apps/web/src/features/kanban/ui/components/project-work-kanban.tsx:54` | `today` | Karar #553 — Saat Store’undan Hesap saat dilimine göre tarih türetimi. Reset, yönlendirme ve güncel durum: §16.1 G3 | D | TK-183 |
| `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:28` | `selectedKey` | Router — /_auth/projects/$projectId `validateSearch` (Zod `.catch`) + `useSearch` + `navigate({ search })` | D | TK-353 |
| `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:34` | `issued` | Karar #553 — Share surface özel bellek Store; token cache/persist/debug/log dışında. Reset, yönlendirme ve güncel durum: §16.1 G11 | D | TK-354 |
| `apps/web/src/features/link-sharing/ui/components/link-sharing-surface.tsx:35` | `notice` | Query — revoke mutation `isSuccess` | D | TK-089 |
| `apps/web/src/features/link-sharing/ui/components/share-access-panel.tsx:31` | `status` | Query — rotate mutation `isSuccess`; kopyalama sonucu için `useMutation({ mutationFn: writeTextToClipboard })` ya da sahipsiz | D | TK-089 |
| `apps/web/src/features/link-sharing/ui/components/share-access-panel.tsx:32` | `failed` | Query — rotate/copy mutation `error` | D | TK-089 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:45` | `confirming` | Base UI — AlertDialog `createHandle<'reopen' \| 'revoke'>()` payload + başarıda `actionsRef.close()` | D | TK-355 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:46` | `status` | Query — setExpiry/reopen/reshare/revoke mutation `isSuccess` + `variables` | D | TK-089 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:47` | `failed` | Query — ilgili mutation `error` | D | TK-089 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:158` | `pendingExpiry` | Form — ShareExpiryForm `expiry` alan değeri; reopen onayı `onSubmitMeta` ile aynı form gönderiminden | D | TK-356 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:208` | `acknowledged` | Form — TanStack Form boolean alanı + `form.Subscribe` ile disabled | D | TK-356 |
| `apps/web/src/features/link-sharing/ui/components/share-lifecycle-panel.tsx:209` | `pending` | Query — onaylanan mutation `isPending` | O | TK-089 |
| `apps/web/src/features/link-sharing/ui/forms/share-expiry-form.tsx:39` | `error` | Form — `setErrorMap({ onSubmit })`; Zod `validators.onSubmit` | D | TK-356 |
| `apps/web/src/features/link-sharing/ui/forms/share-password-form.tsx:23` | `error` | Form — `setErrorMap({ onSubmit })`; remove yolu için setLinkPassword mutation `error` | D | TK-356 |
| `apps/web/src/features/link-sharing/ui/forms/share-password-form.tsx:24` | `saved` | Form — `isSubmitSuccessful`; remove yolu mutation `isSuccess` | D | TK-356 |
| `apps/web/src/features/link-sharing/ui/forms/share-scope-form.tsx:58` | `error` | Form — `validators.onSubmit` (shareScopeFormSchema + groupsNeedingChoice) + `setErrorMap` | D | TK-356 |
| `apps/web/src/features/moodboards/ui/components/moodboard-board.tsx:32` | `size` | Karar #553 — ResizeObserver -> board Store. Reset, yönlendirme ve güncel durum: §16.1 G5 | D | TK-282 |
| `apps/web/src/features/moodboards/ui/components/moodboard-board.tsx:62` | `moved` | Karar #553 — Moodboard viewport oturum Store. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-282 |
| `apps/web/src/features/moodboards/ui/components/moodboard-outline.tsx:283` | `inspectedId` | Store — useCreateStore / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/components/moodboard-view-tools.tsx:104` | `cropOpen` | Base UI — Collapsible.Root / Trigger / Panel | D | TK-284 |
| `apps/web/src/features/moodboards/ui/components/moodboard-view-tools.tsx:255` | `index` | Karar #553 — Sunum oturumu Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-285 |
| `apps/web/src/features/moodboards/ui/components/moodboard-workspace.tsx:32` | `viewport` | Store — createStoreContext / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/components/moodboard-workspace.tsx:35` | `collapsedChoice` | Store — createStoreContext / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/components/moodboard-workspace.tsx:36` | `selectedId` | Store — createStoreContext / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/components/project-moodboards-surface.tsx:182` | `sampleTarget` | Store — useCreateStore / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/components/project-moodboards-surface.tsx:185` | `presenting` | Store — useCreateStore / useSelector | D | TK-283 |
| `apps/web/src/features/moodboards/ui/forms/add-color-swatch-form.tsx:37` | `formError` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/moodboards/ui/forms/add-palette-group-form.tsx:25` | `formError` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/moodboards/ui/forms/add-visual-form.tsx:37` | `formError` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/moodboards/ui/forms/create-moodboard-form.tsx:23` | `formError` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/moodboards/ui/forms/moodboard-snapshot-form.tsx:42` | `preview` | Query — snapshotPreview mutation.data / reset | D | TK-287 |
| `apps/web/src/features/moodboards/ui/forms/visual-caption-form.tsx:29` | `formError` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/moodboards/ui/forms/visual-crop-form.tsx:30` | `invalid` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-286 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-action.ts:13` | `pending` | Query — `useQuery`/Query observer `isFetching` ve `useMutation(...).isPending`; popup kolunda Account Access’e kapsamlı Store `useSelector`. | O | TK-098 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-action.ts:14` | `refusal` | Query — Query/Mutation `error` değerinden görünür metni türet; mutation `reset()` ve yeni preview gözlemcisi/temizliği. Popup hatası Account Access akışında kalır. | D | TK-098 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-erase-flow.ts:28` | `preview` | Query — `orpc.previewPersonalDataErase.queryOptions({ input })` ve koşullu `useQuery`, `data`. | O | TK-098 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-erase-flow.ts:29` | `grant` | Store — Kısa ömürlü Account Access işlem akışı `useCreateStore`/`createStore` ve `useSelector`; formda yalnız `hasGrant` türet. | O | TK-099 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-erase-flow.ts:30` | `result` | Query — `useMutation(orpc.erasePersonalData.mutationOptions()).data` ve `reset()`. | D | TK-098 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-flow.ts:27` | `preview` | Query — `orpc.previewPersonalDataExport.queryOptions({ input })` ve koşullu `useQuery`, `data`. | O | TK-098 |
| `apps/web/src/features/personal-data-rights/hooks/use-personal-data-flow.ts:28` | `produced` | Query — `useMutation(orpc.exportPersonalData.mutationOptions({ gcTime: 0 })).data/reset()`; download artifact’ını aktif incelemeyle sınırla. | O | TK-098 |
| `apps/web/src/features/personal-data-rights/ui/forms/personal-data-contact-form.tsx:28` | `refusal` | Form — TanStack Form 1.33.5 `form.setErrorMap({ onSubmit })` ve `form.Subscribe`; iki preview için uygun `onSubmitMeta`. | D | TK-373 |
| `apps/web/src/features/personal-shell/ui/components/personal-shell.tsx:35` | `open` | Base UI — Sheet(Dialog) kontrolsüz + `actionsRef.current?.close()` (renderSurface/Open full page kapatması) | D | TK-350 |
| `apps/web/src/features/personal-shell/ui/components/personal-shell.tsx:36` | `surface` | Karar #553 — Shell bileşeni/oturumu Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-351 |
| `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:36` | `targetType` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:43` | `targetId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:44` | `sectionId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/planned-test-relations-field.tsx:45` | `message` | Karar #553 — Başarı duyurusu Store; already related doğrulaması Form. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-302 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:42` | `kind` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:49` | `targetId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:50` | `sectionId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:51` | `wireframeVersion` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-context-field.tsx:52` | `message` | Karar #553 — Duyuru Store; eksik Wireframe/already added doğrulaması Form. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-303 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:42` | `message` | Karar #553 — Paket satırı kopyalama Store. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-304 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:127` | `preview` | Query — Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset() | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:128` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:129` | `message` | Query — produce mutation isSuccess + data.packageVersion | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/components/test-handoff-package-panel.tsx:130` | `pending` | Query — useMutation(...).isPending | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/forms/case-form.tsx:63` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/forms/session-test-form.tsx:75` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/forms/session-test-form.tsx:228` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/forms/test-handoff-form.tsx:275` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/forms/test-handoff-form.tsx:494` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-301 |
| `apps/web/src/features/planned-tests/ui/views/planned-tests-view.tsx:74` | `editing` | Base UI — Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan | D | TK-306 |
| `apps/web/src/features/planned-tests/ui/views/planned-tests-view.tsx:75` | `saved` | Query — createVersion mutation isSuccess + variables (form unmount olduğu için form state yetmez) | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/views/test-handoffs-view.tsx:51` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/views/test-handoffs-view.tsx:52` | `pending` | Query — useMutation(...).isPending | D | TK-305 |
| `apps/web/src/features/planned-tests/ui/views/test-handoffs-view.tsx:130` | `editing` | Base UI — Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan | D | TK-306 |
| `apps/web/src/features/prioritization-sessions/ui/forms/prioritization-session-create-form.tsx:26` | `formError` | Form — formApi.setErrorMap({ onSubmit }) / form.Subscribe | D | TK-161 |
| `apps/web/src/features/priority-metrics/ui/components/priority-map.tsx:47` | `horizontalMetricId` | Store — Spec 20: eksen seçimi geçici görünüm durumu, kaydedilmez → 6.5 'geçici ve paylaşılmayan → Store' (useCreateStore); paylaşılabilir görünüm istenirse Router search | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-map.tsx:50` | `verticalMetricId` | Store — horizontalMetricId ile aynı store | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-map.tsx:51` | `showEvidenceSignals` | Store — Geçici görünüm anahtarı (Show evidence signals başta kapalı); aynı store | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:152` | `formError` | Form — PriorityMetricCreateForm içinde setErrorMap({ onSubmit }) — prop ile yukarı taşınıyor | D | TK-163 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:153` | `actionError` | Query — update/trash/restore/deletePermanently .error (ve doğrulama için edit form setErrorMap) | D | TK-164 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:154` | `editingId` | Store — Satır içi düzenleme hedefi; satırlar arasında paylaşılıyor → useCreateStore | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:155` | `trashTarget` | Store — Satır içi Move to Trash önizleme hedefi (PriorityMetricTrash'e prop) → useCreateStore; dialog'a dönerse Base UI createHandle<PriorityMetric>() | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:156` | `deleteTarget` | Store — trashTarget ile aynı; dialog olursa createHandle | D | TK-162 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:157` | `deleteGrant` | Query — requestGitHubIdentityGrant'ı useMutation ile sar → grantMutation.data | D | TK-164 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-editor.tsx:158` | `confirmationPending` | Query — grantMutation.isPending | D | TK-164 |
| `apps/web/src/features/priority-metrics/ui/components/priority-metric-values-form.tsx:36` | `error` | Query — setValue.error / clearValue.error | D | TK-164 |
| `apps/web/src/features/priority-metrics/ui/forms/priority-metric-edit-form.tsx:39` | `validationError` | Form — formApi.setErrorMap({ onSubmit }) (PR #540 formu; yalnız state kuralı) | D | TK-163 |
| `apps/web/src/features/product-gaps/ui/components/dogfooding-summary.tsx:154` | `opened` | Base UI — Base UI Collapsible; escapes useQuery'si yalnız açıkken mount olan Panel içindeki bileşene taşınırsa enabled bayrağına gerek kalmaz | D | TK-317 |
| `apps/web/src/features/product-gaps/ui/components/product-gap-links-field.tsx:46` | `targetType` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/components/product-gap-links-field.tsx:49` | `targetId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/components/product-gap-links-field.tsx:50` | `message` | Karar #553 — Duyuru Store; already related doğrulaması Form. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-319 |
| `apps/web/src/features/product-gaps/ui/components/product-gaps-board.tsx:55` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-320 |
| `apps/web/src/features/product-gaps/ui/components/product-gaps-board.tsx:56` | `message` | Query — setStatus mutation isSuccess + variables.status | D | TK-320 |
| `apps/web/src/features/product-gaps/ui/components/tool-escape-fields.tsx:45` | `sourceType` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/forms/product-gap-follow-up-form.tsx:75` | `plan` | Query — Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset() | D | TK-320 |
| `apps/web/src/features/product-gaps/ui/forms/product-gap-follow-up-form.tsx:76` | `error` | Query — preview/confirm mutation error; doğrulama metni form errorMap | D | TK-320 |
| `apps/web/src/features/product-gaps/ui/forms/product-gap-follow-up-form.tsx:77` | `message` | Query — useMutation(...).isSuccess / data (veya variables) | D | TK-320 |
| `apps/web/src/features/product-gaps/ui/forms/record-product-gap-form.tsx:44` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/forms/tool-escape-close-form.tsx:62` | `open` | Base UI — Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan | D | TK-317 |
| `apps/web/src/features/product-gaps/ui/forms/tool-escape-close-form.tsx:63` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/forms/tool-escape-close-form.tsx:64` | `message` | Form — isSubmitSuccessful (form.Subscribe) | D | TK-318 |
| `apps/web/src/features/product-gaps/ui/views/product-gaps-view.tsx:58` | `filter` | Router — /_auth/product-gaps route'una validateSearch: Zod şeması (.catch('')), Route.useSearch(), navigate({ search: prev => ({...prev, ...patch}) }), varsayılanlar için stripSearchParams | D | TK-321 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-detail.tsx:64` | `editing` | Base UI — Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() | D | TK-336 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:44` | `open` | Base UI — Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() ve onOpenChange eventDetails.cancel() | D | TK-336 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:45` | `values` | Form — TanStack Form Field ve form.state.values; aynı değerleri preview Query input olarak kullan | D | TK-337 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:49` | `preview` | Query — oRPC previewProductionIncidentFollowUp.queryOptions + Query data / reset veya queryClient.query | O | TK-081 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:50` | `confirming` | Query — oRPC createProductionIncidentFollowUp.mutationOptions + useMutation.isPending | D | TK-081 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-follow-up-dialog.tsx:51` | `error` | Query — useMutation.error / reset; beklenen stale sonucu oRPC tanımlı hata olarak ele al | D | TK-081 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:31` | `savedMessage` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-081 |
| `apps/web/src/features/production-incidents/ui/components/production-incident-surface.tsx:32` | `errorMessage` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-081 |
| `apps/web/src/features/production-incidents/ui/components/production-incidents-surface.tsx:36` | `creating` | Base UI — Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() | D | TK-336 |
| `apps/web/src/features/production-incidents/ui/forms/production-incident-follow-up-form.tsx:31` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-337 |
| `apps/web/src/features/production-incidents/ui/forms/production-incident-form.tsx:40` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-337 |
| `apps/web/src/features/production-incidents/ui/forms/production-incident-link-form.tsx:32` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-337 |
| `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:64` | `stage` | Store — TanStack Store useCreateStore + useSelector ile yalnız seç/generate geçişi; Query data ve Form values ayrı | D | TK-343 |
| `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:69` | `failed` | Query — Her komut için Query error + reset; form doğrulaması için setErrorMap | D | TK-344 |
| `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:70` | `pending` | Form — TanStack Form onSubmit içinden Promise await ve form.Subscribe isSubmitting; Query isFetching/isPending alt işlemler için | D | TK-345 |
| `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:71` | `generation` | Türetilen — Editör key değerini mevcut taslak saveKey üzerinden türet; form.reset() ile seçimi ve editör değerlerini sıfırla | D | TK-346 |
| `apps/web/src/features/project-closure-summary/ui/views/closure-summary-view.tsx:73` | `comparison` | Query — oRPC projectClosureSummaryDateComparison.queryOptions; key girdisinde seçili Work kaynakları, yaşam döngüsünde mevcut taslak kimliği | D | TK-344 |
| `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:48` | `pending` | Query — `useMutation(orpc.setProjectGoalRelation.mutationOptions())` → `isPending` | D | TK-229 |
| `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:49` | `error` | Query — oRPC + Query: `useMutation(orpc.x.mutationOptions())` sonucu `error` (beklenen hata için `isDefinedError`) | D | TK-229 |
| `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:50` | `message` | Query — `isSuccess` + `variables.attached` | D | TK-229 |
| `apps/web/src/features/project-goals/ui/components/project-goal-membership-panel.tsx:51` | `settledChanges` | Form — Sayaç + useEffect yerine çocuk formda `await mutateAsync()` sonrası `formApi.reset()` | D | TK-230 |
| `apps/web/src/features/project-goals/ui/components/project-goals-surface.tsx:29` | `savedMessage` | Query — save `useMutation` → `isSuccess` | D | TK-229 |
| `apps/web/src/features/project-goals/ui/components/project-goals-view.tsx:38` | `editing` | Karar #553 — Yerel edit Store. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-231 |
| `apps/web/src/features/project-goals/ui/forms/project-goal-form.tsx:71` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-230 |
| `apps/web/src/features/project-goals/ui/forms/project-goal-form.tsx:72` | `baseGoal` | Form — Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı | D | TK-230 |
| `apps/web/src/features/project-goals/ui/forms/project-goal-form.tsx:73` | `conflict` | Form — `setErrorMap({ onSubmit: conflictError })`; current value hata değerinden gösterilir | D | TK-230 |
| `apps/web/src/features/project-history/ui/components/project-activity-surface.tsx:60` | `filters` | Router — TanStack Router validateSearch (Zod), Route.useSearch ve navigate({ search }) | D | TK-339 |
| `apps/web/src/features/project-history/ui/views/project-activity-view.tsx:109` | `open` | Base UI — Base UI Collapsible.Root / Trigger / Panel | D | TK-340 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-planning-detail.tsx:262` | `editing` | Base UI — Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() | D | TK-332 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:27` | `savedMessage` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-333 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-planning-surface.tsx:28` | `errorMessage` | Query — TanStack Query useMutation / useMutationState ile error, isSuccess, variables ve data | D | TK-333 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-status-control.tsx:46` | `confirming` | Base UI — Base UI AlertDialog.createHandle<TerminalStatus>(), Trigger payload ve Root actionsRef.close() | D | TK-332 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-status-control.tsx:47` | `saving` | Query — oRPC transitionProjectSourceRecord.mutationOptions + useMutation.isPending | D | TK-333 |
| `apps/web/src/features/project-release-planning/ui/components/project-release-status-control.tsx:48` | `error` | Query — useMutation.error / reset | D | TK-333 |
| `apps/web/src/features/project-release-planning/ui/components/project-releases-surface.tsx:36` | `creating` | Base UI — Base UI Dialog.Trigger / Close ve Dialog.Root actionsRef.current?.close() | D | TK-332 |
| `apps/web/src/features/project-release-planning/ui/forms/project-release-audience-form.tsx:24` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-334 |
| `apps/web/src/features/project-release-planning/ui/forms/project-release-create-form.tsx:27` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-334 |
| `apps/web/src/features/project-release-planning/ui/forms/project-release-hypothesis-form.tsx:25` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-334 |
| `apps/web/src/features/project-release-planning/ui/forms/project-release-link-form.tsx:45` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-334 |
| `apps/web/src/features/project-release-planning/ui/forms/project-release-scope-form.tsx:21` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-334 |
| `apps/web/src/features/project-retirement/ui/components/archive-surface.tsx:23` | `deleting` | Store — `useCreateStore` + `useSelector` ile yalnız `projectId`; geçerli Archive satırı ve Delete Project preview ayrı Query `data` değerlerinden türetilir. | D | TK-374 |
| `apps/web/src/features/project-retirement/ui/components/project-archive-control.tsx:27` | `previewing` | Base UI — Base UI 1.9 `Collapsible.Root` + `Trigger` + `Panel`; iptal/başarı ile dışarıdan kapama gerekiyorsa `open`/`onOpenChange` kaynağı bileşen kapsamlı Store. | D | TK-375 |
| `apps/web/src/features/project-shell/hooks/use-project-area-enable.ts:10` | `error` | Query — mutation.error üzerinden sabit kullanıcı metnini türet, gerektiğinde mutation.reset. | D | TK-122 |
| `apps/web/src/features/project-shell/hooks/use-project-configuration.ts:13` | `error` | Query — mutation.error üzerinden geçerli hatayı türet; mutation başladığında önceki sonuç doğal olarak değişir. | D | TK-122 |
| `apps/web/src/features/project-shell/hooks/use-project-short-code.ts:13` | `error` | Query — updateShortCode.error içindeki yapılandırılmış etiketi oku ve düzenleme açılışında mutation.reset. | D | TK-122 |
| `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:556` | `showExplanation` | Store — useCreateStore/useSelector ve Project kimliğiyle kalıcı kapatma tercihine bağla; yerel depolama burada sekme sonrası tercihin kalıcılık sınırı. | D | TK-123 |
| `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:560` | `configurationHost` | Store — useCreateStore/useSelector ve Configuration Mode başına başlangıç Project areas; alt masaüstü/mobil seçiciler ve içerik bu geçici seçimi paylaşır. Modun hash sözleşmesini koru. | D | TK-123 |
| `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:931` | `selectedWorkView` | Router — Project route validateSearch ve Zod Board/List enum, Route.useSearch + navigate({ search }); geri/reload sonrası aynı görünüm. | D | TK-124 |
| `apps/web/src/features/project-shell/ui/components/project-shell-surface.tsx:935` | `statusActionRequest` | Store — Project Work oturumu Store'u; useCreateStore/useSelector ile Kanban'dan Work kaydına tek tüketimli kapanış isteği. Kaydın kimliği URL hash'inde kalır. | D | TK-123 |
| `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:92` | `restorePreviewOpen` | Base UI — Inline Navigation preview için kontrolsüz Collapsible veya doğrulama diyalogu açılırsa Dialog Trigger/actionsRef.close; yazma başarısına bağlı kapanış. | D | TK-125 |
| `apps/web/src/features/project-shell/ui/forms/project-configuration-form.tsx:588` | `pendingStageRemovalId` | Store — Project aşama düzenleme yüzeyi Store'u; useCreateStore/useSelector ile aynı anda tek satırın inline silme onayı. Diyalog olursa Base UI createHandle<stageId> uygun. | D | TK-123 |
| `apps/web/src/features/project-shell/ui/forms/project-create-form.tsx:88` | `formError` | Form — formApi.setErrorMap ve form.Subscribe; sunucu hatasını mutation.error, dosya hatasını logo alanı hata haritası üzerinden dağıt. | D | TK-126 |
| `apps/web/src/features/project-shell/ui/forms/project-create-form.tsx:89` | `isLogoReading` | Form — FileReader taşıması korunur. Dosya işini Form alanının async doğrulama akışına al ve field meta.isValidating veya form.Subscribe ile düğme durumunu türet. | D | TK-126 |
| `apps/web/src/features/project-shell/ui/forms/project-short-code-form.tsx:19` | `isEditing` | Base UI — Inline editör açılımını Collapsible veya uygun Dialog primitive'ine ver; başarılı Short code kaydı ve Cancel ile kapat. | D | TK-125 |
| `apps/web/src/features/project-shell/ui/forms/project-short-code-form.tsx:20` | `validationError` | Form — shortCode alan doğrulaması veya formApi.setErrorMap({ onSubmit }); form.Field ve form.Subscribe hatayı gösterir. | D | TK-126 |
| `apps/web/src/features/project-updates/ui/forms/project-update-form.tsx:45` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-341 |
| `apps/web/src/features/project-updates/ui/forms/project-update-reminder-form.tsx:47` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit; Skip hatası için skip mutation.error | D | TK-341 |
| `apps/web/src/features/project-updates/ui/forms/project-update-reminder-form.tsx:48` | `busy` | Query — form.Subscribe isSubmitting ve useMutation.isPending (Skip); gerekiyorsa mutation scope.id ile seri çalıştır | D | TK-342 |
| `apps/web/src/features/project-wall/hooks/use-personal-project-wall-view.ts:53` | `saveError` | Türetilen — save.isError (useMutation sonucu); yeni mutate durumu zaten sıfırlar | D | TK-289 |
| `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:173` | `preview` | Karar #553 — Auto-layout komut Store. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-290 |
| `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:175` | `optimistic` | Query — Taşıma mutation'ı: onMutate'te orpc.projectWall queryKey setQueryData snapshot, onError geri alma, onSettled invalidate (6.2 / 6.10) | D | TK-291 |
| `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:178` | `applied` | Karar #553 — Auto-layout geri alma Store. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-290 |
| `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:179` | `status` | Türetilen — preview?.moves.length === 0 iken metin hesaplanır | D | TK-289 |
| `apps/web/src/features/project-wall/ui/components/project-wall-canvas.tsx:359` | `nodes` | Karar #553 — React Flow controlled akış; useNodesState ve model uzlaştırma. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-290 |
| `apps/web/src/features/project-wall/ui/components/project-wall-outline.tsx:458` | `inspectedId` | Karar #553 — Outline yerel Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-292 |
| `apps/web/src/features/project-wall/ui/components/project-wall-presentation.tsx:43` | `index` | Karar #553 — Sunum oturumu Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-293 |
| `apps/web/src/features/project-wall/ui/components/project-wall-scene.tsx:52` | `selection` | Store — Canvas ve Outline arasında paylaşılan oturumluk seçim: createStoreContext / useCreateStore + useSelector | D | TK-294 |
| `apps/web/src/features/project-wall/ui/components/project-wall-surface.tsx:41` | `chosenId` | Router — Seçili Proje Duvarı: proje kabuğu route search'üne wallId (validateSearch Zod .catch(undefined)), navigate({ search }) | D | TK-295 |
| `apps/web/src/features/project-wall/ui/components/project-wall-surface.tsx:42` | `error` | Query — write() yardımcısı yerine useMutation(orpc.x.mutationOptions()).error; sayfa düzeyi için useMutationState | D | TK-291 |
| `apps/web/src/features/project-wall/ui/components/project-wall-surface.tsx:92` | `chosenCollapse` | Query — Kişisel görünüm sorgusunun cache'i: schedule anında queryClient.setQueryData(orpc.projectWallViewport.queryKey(...)) ile iyimser collapse | D | TK-291 |
| `apps/web/src/features/project-wall/ui/forms/project-wall-snapshot-form.tsx:47` | `preview` | Query — Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset() | D | TK-291 |
| `apps/web/src/features/project-wall/ui/forms/relation-link-form.tsx:77` | `preview` | Query — Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset() | D | TK-291 |
| `apps/web/src/features/project-wall/ui/views/project-wall-view.tsx:112` | `presenting` | Karar #553 — Duvar görünüm Store: presentingWallId. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-296 |
| `apps/web/src/features/project-wall/ui/views/project-wall-view.tsx:114` | `opened` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-294 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:41` | `active` | Base UI — Dialog.createHandle<Payload>(), openWithPayload ve popup eylem kapsamı | D | TK-165 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:42` | `runVersion` | Store — Aynı payload ile yeni çalıştırma gerekiyorsa kapsamlı useCreateStore veya Dialog oturum kimliği | D | TK-166 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:70` | `preview` | Query — previewMutation.data/reset | O | TK-028 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:72` | `applyCommand` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-167 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:73` | `applyResult` | Query — applyMutation.data | D | TK-028 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:76` | `undoCommand` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-167 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:79` | `isPreparingUndo` | Query — Birleşik Undo useMutation.isPending | O | TK-028 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:80` | `undoReceipt` | Query — undoMutation.data/reset | D | TK-028 |
| `apps/web/src/features/record-actions/hooks/use-record-action-runner.ts:83` | `error` | Query — previewMutation.error, applyMutation.error, undoMutation.error/reset | D | TK-028 |
| `apps/web/src/features/record-discovery/ui/components/context-record-preview.tsx:152` | `record` | Base UI — Base UI Dialog(Sheet) `createHandle<SourceRecordPreviewTarget>()`; tüketiciler `handle.openWithPayload(target)` / `Trigger handle payload` | D | TK-217 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:257` | `status` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:458` | `view` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:459` | `query` | Store — DiscoverySurface ömürlü useCreateStore + useSelector; yalnız sorgu girdisini Pacer ile geciktir. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:460` | `scope` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:461` | `archived` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:463` | `tableRecordType` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:464` | `tableProjectId` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:602` | `type` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:603` | `folder` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/document-discovery.tsx:733` | `open` | Base UI — Kontrolsüz Dialog (`DialogTrigger` zaten var) + kaynak açılınca `actionsRef.current?.close()` | D | TK-217 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:509` | `value` | Form — Hücre başına `useForm` (onBlur gönderim) + Zod `parseRecordTableFieldValue` | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:510` | `error` | Query — Hücre yazma `useMutation(orpc.updateTableCell.mutationOptions())` → `error` | O | TK-051 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:622` | `filter` | Store — TanStack Table v9 iç durumu: `initialState: { globalFilter: "" }` (paylaşılırsa `atoms`); dışarıdan `state` + `useState` verilmez | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:623` | `sorting` | Store — TanStack Table v9 iç durumu: `initialState: { sorting: [] }` | D | TK-218 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:789` | `pasteFormKey` | Form — Remount anahtarı yerine `formApi.reset()` | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:790` | `headers` | Form — Paste review formu: `mode="array"` alanları (`pushValue`/`removeValue`) | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:791` | `columnIds` | Form — Paste review formu array alanı | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:792` | `rawRows` | Form — Paste review formu array alanı | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:793` | `rowIds` | Form — Paste review formu array alanı | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:794` | `mappings` | Form — Column mapping array alanı | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:795` | `createRecordIds` | Form — Paste review formu array alanı | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:796` | `corrections` | Form — Satır düzeltmeleri form array alanı (`Correct row`) | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:797` | `excludedRows` | Form — Satır başına `included` alanı (`Exclude row`) | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:798` | `pasteError` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-219 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:799` | `pasteMessage` | Query — apply mutation `isSuccess` (`Changes applied.`) | D | TK-051 |
| `apps/web/src/features/record-discovery/ui/components/record-table.tsx:800` | `pastePending` | Query — `useMutation(orpc.applyTablePaste.mutationOptions())` → `isPending` | D | TK-051 |
| `apps/web/src/features/relations/ui/components/work-relations.tsx:46` | `preview` | Query — previewMutation.data (reset() ile temizleme) | D | TK-137 |
| `apps/web/src/features/relations/ui/components/work-relations.tsx:47` | `createIdempotencyKey` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-138 |
| `apps/web/src/features/relations/ui/components/work-relations.tsx:51` | `removedRelation` | Query — removeMutation.data + variables (Undo makbuzu); undo sonrası removeMutation.reset() | D | TK-137 |
| `apps/web/src/features/relations/ui/components/work-relations.tsx:52` | `error` | Query — previewMutation/createMutation/removeMutation/resolveMutation/reactivateMutation/undoMutation .error | D | TK-137 |
| `apps/web/src/features/relations/ui/components/work-relations.tsx:686` | `isResolving` | Base UI — Base UI Collapsible (Mark blocker resolved satır içi formu); başarıda kapanma kontrollü open gerektirir | D | TK-139 |
| `apps/web/src/features/release-evidence/ui/forms/add-checklist-item-form.tsx:19` | `error` | Form — TanStack Form formApi.setErrorMap({ onSubmit }) ve form.Subscribe ile errorMap.onSubmit | D | TK-335 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:51` | `editing` | Store — useCreateStore / useSelector | D | TK-249 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:55` | `saved` | Query — saveResearchSessionNote mutation.isSuccess / reset | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:56` | `bindingDraft` | Store — useCreateStore / useSelector ve targets query.data | D | TK-249 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:65` | `bindingPending` | Query — researchSessionBindingTargets query.isFetching | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:66` | `bindingError` | Query — researchSessionBindingTargets query.error | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/components/research-session-notes.tsx:67` | `bound` | Query — confirmResearchSessionBinding mutation.isSuccess / reset | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:62` | `preview` | Query — previewResearchSessionBinding mutation.data / reset | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:63` | `confirmationKey` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-251 |
| `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:64` | `confirming` | Query — confirmResearchSessionBinding mutation.isPending | D | TK-250 |
| `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:65` | `error` | Form — setErrorMap / form.Subscribe ve aşamaya göre mutation.error | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-note-binding-form.tsx:66` | `conflict` | Türetilen — confirm mutation.error üstünden CONFLICT veya typed reason hesapla | D | TK-253 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-form.tsx:51` | `baseRecord` | Form — form defaultValues / formApi.state.values | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-form.tsx:52` | `entryTimeZone` | Form — form defaultValues içindeki entryTimeZone | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-form.tsx:53` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-form.tsx:54` | `conflict` | Türetilen — save mutation.error üstünden CONFLICT hesapla | D | TK-253 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-note-form.tsx:50` | `noteId` | Form — form defaultValues içindeki noteId | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-note-form.tsx:51` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-252 |
| `apps/web/src/features/research-sessions/ui/forms/research-session-note-form.tsx:52` | `conflict` | Türetilen — note mutation.error üstünden CONFLICT hesapla | D | TK-253 |
| `apps/web/src/features/research-sessions/ui/views/research-sessions-view.tsx:33` | `editing` | Store — useCreateStore / useSelector | D | TK-249 |
| `apps/web/src/features/research-sessions/ui/views/research-sessions-view.tsx:36` | `saved` | Query — saveResearchSession mutation.isSuccess / reset | D | TK-250 |
| `apps/web/src/features/return-to-work/ui/components/return-to-work.tsx:24` | `visitError` | Query — `useMutation(orpc.markReturnContextViewed.mutationOptions())` → `isError` | D | TK-225 |
| `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:47` | `view` | Store — Roadmap session store’dan bir kez okunan görünüm; reaktif değilse `useRef(session?.state.view)` veya store snapshot | D | TK-226 |
| `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:48` | `state` | Store — Tour driver durumunu `createStore` ile yayınlar, `useSelector(tour.store)`; elle `setState({ ...tour.state })` aynalaması kalkar | D | TK-226 |
| `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:109` | `activeChanges` | Base UI — Base UI Dialog `createHandle<SinceLastLooked>()` payload | D | TK-227 |
| `apps/web/src/features/return-to-work/ui/components/visual-changes-tour.tsx:112` | `open` | Base UI — Base UI Dialog kontrolsüz + `actionsRef.close()`; async kapanış `onOpenChangeComplete` | D | TK-227 |
| `apps/web/src/features/return-to-work/ui/forms/next-concrete-step-form.tsx:32` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-228 |
| `apps/web/src/features/return-to-work/ui/forms/next-concrete-step-form.tsx:33` | `saved` | Form — `isSubmitSuccessful` (`form.Subscribe`) veya mutation `isSuccess` | D | TK-228 |
| `apps/web/src/features/risks/ui/components/project-risks-surface.tsx:25` | `savedMessage` | Query — save/transition `useMutation` → `isSuccess` + `variables` | D | TK-237 |
| `apps/web/src/features/risks/ui/components/project-risks-view.tsx:36` | `editingMode` | Karar #553 — Yerel edit Store. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-238 |
| `apps/web/src/features/risks/ui/forms/risk-form.tsx:45` | `baseRecord` | Form — Tek seferlik anlık görüntü: `useForm({ defaultValues })` ilk değeri zaten sabitler; base kayıt/revizyon render etkilemediği için `useRef` veya form defaultValues alanı | D | TK-239 |
| `apps/web/src/features/risks/ui/forms/risk-form.tsx:46` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-239 |
| `apps/web/src/features/risks/ui/forms/risk-form.tsx:47` | `conflict` | Form — `setErrorMap` hata değerinden türetilir | D | TK-239 |
| `apps/web/src/features/roadmap-horizon/store/roadmap-session.tsx:18` | `session` | Store — useCreateStore(initialValue, actions) ve createStoreContext().StoreProvider | D | TK-198 |
| `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:50` | `editing` | Base UI — Collapsible.Root veya Dialog.Root, başarı için actionsRef.close() | D | TK-199 |
| `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:51` | `preview` | Query — previewRelation.data/reset | D | TK-200 |
| `apps/web/src/features/roadmap-horizon/ui/components/project-milestones.tsx:52` | `relationIdempotencyKey` | Render dışı useRef — useRef. Yalnız olay/komut kimliğini tut; JSX veya abonelikte okuma. | D | TK-201 |
| `apps/web/src/features/roadmap-horizon/ui/components/project-roadmap.tsx:183` | `selection` | Router — Project route validateSearch + navigate({ search }), view kaydı Query’de | D | TK-202 |
| `apps/web/src/features/roadmap-horizon/ui/components/project-roadmap.tsx:184` | `presentationMode` | Store — Project kapsamlı roadmap-session useSelector veya kapsamlı useCreateStore | D | TK-198 |
| `apps/web/src/features/roadmap-horizon/ui/components/roadmap-canvas.tsx:66` | `flow` | Karar #553 — ReactFlowProvider ve useReactFlow; ilk viewport yerleştirmesi sonrası ready. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-203 |
| `apps/web/src/features/roadmap-horizon/ui/components/roadmap-canvas.tsx:67` | `highlight` | Store — Project roadmap-session üzerinden useSelector ve oturum eylemi | D | TK-198 |
| `apps/web/src/features/roadmap-horizon/ui/components/roadmap-placement.tsx:25` | `previewChoice` | Form — form.Subscribe/submit meta veya form-owned preview değeri | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/components/roadmap-results.tsx:210` | `editing` | Base UI — Collapsible.Root/Trigger veya kontrolsüz Dialog ve başarıda close | D | TK-199 |
| `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:327` | `mode` | Store — Kapsamlı useCreateStore ve useSelector; preview evresi form ile eşgüdümlü | D | TK-198 |
| `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:330` | `draft` | Form — Tek useForm örneği, form.Subscribe ve setFieldValue | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:336` | `preview` | Form — Form onSubmit aşamasında ayrıştırılmış komut snapshot’ı ve form.Subscribe | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:337` | `error` | Form — Form setErrorMap({ onSubmit }) ve iki mutation.error/reset | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx:562` | `open` | Base UI — Dialog.Root / Trigger, ayrı mount için createHandle veya Dialog popup içeriği | D | TK-199 |
| `apps/web/src/features/roadmap-horizon/ui/forms/milestone-form.tsx:50` | `invalid` | Form — form.setErrorMap({ onSubmit }) ve form.Subscribe | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/forms/research-direction-form.tsx:15` | `invalid` | Form — form.setErrorMap({ onSubmit }) ve form.Subscribe | D | TK-204 |
| `apps/web/src/features/roadmap-horizon/ui/forms/roadmap-view-form.tsx:74` | `draftId` | Form — Form varsayılan değeri/submit command kimliği; başarılı kayıttan sonra form reset | D | TK-204 |
| `apps/web/src/features/schema-artifacts/ui/components/change-draft.tsx:102` | `confirmError` | Türetilen — confirm.error (useMutation sonucu) | D | TK-325 |
| `apps/web/src/features/schema-artifacts/ui/components/change-draft.tsx:135` | `edited` | Form — UpEditForm'un gönderilmiş Up SQL değeri; form ChangeDraft'a taşınıp schemaChangePreview girdisi useSelector(form.store, s => submitted value) ile okunur | D | TK-326 |
| `apps/web/src/features/schema-artifacts/ui/components/sql-output.tsx:22` | `message` | Karar #553 — SQL çıktı kopyalama Store. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-327 |
| `apps/web/src/features/schema-artifacts/ui/views/schema-artifacts-view.tsx:20` | `versionId` | Router — Route zaten diagramId search'ü taşıyor; versionId/sourceId/targetId aynı validateSearch'e (Zod .catch(undefined)) | D | TK-328 |
| `apps/web/src/features/schema-artifacts/ui/views/schema-artifacts-view.tsx:21` | `sourceId` | Router — Route zaten diagramId search'ü taşıyor; versionId/sourceId/targetId aynı validateSearch'e (Zod .catch(undefined)) | D | TK-328 |
| `apps/web/src/features/schema-artifacts/ui/views/schema-artifacts-view.tsx:22` | `targetId` | Router — Route zaten diagramId search'ü taşıyor; versionId/sourceId/targetId aynı validateSearch'e (Zod .catch(undefined)) | D | TK-328 |
| `apps/web/src/features/screens/ui/components/canvas-text-overlay.tsx:21` | `draft` | Karar #553 — Kontrolsüz textarea; defaultValue ve olaydan commit; render’da ref okuma yok. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-267 |
| `apps/web/src/features/screens/ui/components/linked-block-controls.tsx:76` | `preview` | Query — previewLinkedBlockChange.queryOptions / data veya mutation.data | D | TK-268 |
| `apps/web/src/features/screens/ui/components/linked-block-controls.tsx:78` | `error` | Query — applyLinkedBlockChange mutation.error / detach için engine sonucu | D | TK-268 |
| `apps/web/src/features/screens/ui/components/presentation-mode.tsx:30` | `state` | Karar #553 — Wireframe sunum oturum Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-269 |
| `apps/web/src/features/screens/ui/components/screens-output-surface.tsx:70` | `busy` | Query — useMutation, isPending ve variables (çoklu sürüm okuma + çıktı) | D | TK-268 |
| `apps/web/src/features/screens/ui/components/screens-output-surface.tsx:71` | `error` | Query — useMutation.error / reset | D | TK-268 |
| `apps/web/src/features/screens/ui/components/screens-output-surface.tsx:72` | `presenting` | Query — sürüm hazırlama mutation.data / variables / reset | D | TK-268 |
| `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:69` | `size` | Karar #553 — Pane ölçüm Store. Reset, yönlendirme ve güncel durum: §16.1 G5 | D | TK-270 |
| `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:70` | `measured` | Türetilen — null ölçümden hasMeasured türet | D | TK-271 |
| `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:125` | `session` | Store — useCreateStore ile atomik oturum verisi, ya da bir kez oluşturulan engine Store’unu scope’a bağla | D | TK-272 |
| `apps/web/src/features/screens/ui/components/wireframe-pane.tsx:216` | `editing` | Store — Wireframe editor.store / useSelector | D | TK-272 |
| `apps/web/src/features/screens/ui/components/wireframe-surface.tsx:64` | `editor` | Store — useCreateStore(initialValue, actions) / useSelector veya mount-scope engine Store | D | TK-272 |
| `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:47` | `open` | Base UI — Dialog.Trigger / actionsRef.close() | D | TK-273 |
| `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:48` | `plan` | Query — flush + preview useMutation.data / reset | D | TK-268 |
| `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:49` | `created` | Query — confirmConvertAndBind mutation.data / reset | D | TK-268 |
| `apps/web/src/features/screens/ui/forms/convert-and-bind-form.tsx:50` | `error` | Form — setErrorMap / form.Subscribe ve confirm mutation.error | D | TK-274 |
| `apps/web/src/features/screens/ui/forms/create-screen-form.tsx:11` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-274 |
| `apps/web/src/features/screens/ui/forms/create-screen-from-template-form.tsx:19` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-274 |
| `apps/web/src/features/screens/ui/forms/save-as-template-form.tsx:23` | `message` | Query — saveScreenTemplate mutation.data ve isSuccess | D | TK-268 |
| `apps/web/src/features/screens/ui/forms/save-as-template-form.tsx:24` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-274 |
| `apps/web/src/features/screens/ui/views/screens-view.tsx:48` | `error` | Query — setScreenLifecycle mutation.error / reset | D | TK-268 |
| `apps/web/src/features/screens/ui/views/screens-view.tsx:49` | `wireframeOpen` | Base UI — Collapsible.Root / Trigger / Panel | D | TK-273 |
| `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:56` | `review` | Query — preview mutation `data`, confirmIdentity mutation `data` (grant) + `isPending` (identityPending); sensitiveValue RedactForm alanında kalır | D | TK-364 |
| `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:62` | `result` | Query — apply mutation `data` | D | TK-364 |
| `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:65` | `busy` | Query — preview/apply `isPending` | D | TK-364 |
| `apps/web/src/features/security-redaction/hooks/use-security-redaction-flow.ts:66` | `error` | Query — mutation `error` + `isDefinedError` (S8-6) | D | TK-364 |
| `apps/web/src/features/security-redaction/ui/components/security-redaction-panel.tsx:32` | `open` | Base UI — Collapsible (kontrolsüz, iptal için kontrollü gerekir) veya AlertDialog + `actionsRef.close()` | D | TK-365 |
| `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:453` | `activePanel` | Base UI — Base UI Tabs/ToggleGroup `defaultValue`; programatik geçiş (`showAllRecords`) gerekiyorsa kontrollü kaynak Store | D | TK-221 |
| `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:456` | `selectedSlices` | Router — Insight dilim filtresi search param (view id ile anahtarlı) | D | TK-222 |
| `apps/web/src/features/smart-collections/ui/components/project-smart-collections-surface.tsx:564` | `membershipPreview` | Karar #553 — Aktif drag useDragOperation; drop sonrası önizleme Store. Reset, yönlendirme ve güncel durum: §16.1 G9 | D | TK-223 |
| `apps/web/src/features/smart-collections/ui/forms/smart-collection-create-form.tsx:89` | `error` | Form — TanStack Form: `formApi.setErrorMap({ onSubmit })` + `form.Subscribe selector={s => s.errorMap.onSubmit}`; sunucu hatası `mutation.error` | D | TK-224 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:92` | `open` | Base UI — Collapsible.Root / Trigger / Panel | D | TK-255 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:93` | `editor` | Store — useCreateStore / useSelector | D | TK-256 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:96` | `pending` | Query — bindSourceEvidence / reviewSourceEvidence mutation.isPending | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:97` | `error` | Query — bindSourceEvidence / reviewSourceEvidence mutation.error | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-evidence-controls.tsx:98` | `message` | Query — mutation.isSuccess / variables | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-recheck-controls.tsx:21` | `open` | Base UI — Collapsible.Root / Trigger / Panel | D | TK-255 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-recheck-controls.tsx:22` | `pending` | Query — recheckSource / decideSourceCheck mutation.isPending | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/components/source-recheck-controls.tsx:23` | `error` | Query — recheckSource / decideSourceCheck mutation.error | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/smart-link-form.tsx:33` | `preview` | Query — smartLinkPreview.queryOptions / skipToken / data | O | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/smart-link-form.tsx:34` | `loading` | Query — smartLinkPreview query.isFetching | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/smart-link-form.tsx:35` | `saving` | Query — createSource mutation.isPending | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/smart-link-form.tsx:36` | `message` | Query — smartLinkPreview query.error; createSource mutation.error/isSuccess | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:43` | `range` | Form — form.Field / setFieldValue | D | TK-257 |
| `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:51` | `plan` | Query — previewSourceEvidence.queryOptions / data / variables | D | TK-059 |
| `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:52` | `previewing` | Form — form.Subscribe isSubmitting | D | TK-257 |
| `apps/web/src/features/sources-and-freshness/ui/forms/source-evidence-selection-form.tsx:53` | `error` | Form — formApi.setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-257 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-candidates.tsx:50` | `followUpOpen` | Base UI — Dialog.Trigger ile kontrolsüz Dialog veya createHandle<Candidate>(); başarıda actionsRef.current?.close() | D | TK-297 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:116` | `workType` | Form — Dialog içi useForm field; önizleme sorgusu useSelector(form.store, s => s.values.workType) ile anahtarlanır | D | TK-298 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:118` | `preview` | Query — useQuery(orpc.previewSpecChangeReviewFollowUp.queryOptions({ input: { candidate, reviewId, workType } })) — useEffect+setState okuma (S6-4) | O | TK-070 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:119` | `error` | Query — preview query error + confirm mutation error | D | TK-070 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-follow-up-dialog.tsx:120` | `pending` | Query — preview.isPending \|\| confirm.isPending | D | TK-070 |
| `apps/web/src/features/spec-change-review/ui/components/spec-change-review-surface.tsx:29` | `selectedId` | Router — Seçili inceleme reviewId search'te | D | TK-299 |
| `apps/web/src/features/spec-change-review/ui/views/spec-change-review-view.tsx:89` | `current` | Karar #553 — Diff görünümü Store. Reset, yönlendirme ve güncel durum: §16.1 G7 | D | TK-300 |
| `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:78` | `filterTagId` | Router — validateSearch (Zod tagId .catch) + Route.useSearch() + navigate({ search: prev => ({ ...prev, tagId }) }) — spec 13 etiket filtresi | D | TK-140 |
| `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:79` | `formError` | Form — CreateTagForm setErrorMap + create.error | D | TK-141 |
| `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:80` | `actionError` | Query — apply.error / remove.error | D | TK-142 |
| `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:81` | `renameError` | Query — rename.error / undoRename.error | D | TK-142 |
| `apps/web/src/features/tags/ui/components/project-tags-surface.tsx:82` | `renameUndo` | Query — rename.data (receiptId, tag.revision); undo sonrası rename.reset() | D | TK-142 |
| `apps/web/src/features/technical-diagrams/hooks/use-personal-technical-diagram-view.ts:31` | `saveError` | Türetilen — save.isError | D | TK-322 |
| `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:45` | `error` | Query — saveStructure/saveLayout/DiagramViewForm create mutation error (useMutationState ile toplanabilir) | O | TK-073 |
| `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:58` | `versionError` | Türetilen — createVersion.error ?? restoreVersion.error | D | TK-322 |
| `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:103` | `plan` | Query — previewConvert.data; iptal için previewConvert.reset() | D | TK-073 |
| `apps/web/src/features/technical-diagrams/ui/components/project-technical-diagrams-surface.tsx:104` | `compositionError` | Türetilen — placeCard/moveCard/removeCard/previewConvert/confirmConvert error'larından hesaplanır | D | TK-322 |
| `apps/web/src/features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:78` | `opening` | Karar #553 — Mount’a bağlı salt okunur snapshot; render’da ref okunmaz. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-323 |
| `apps/web/src/features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:130` | `collapsed` | Store — Bileşen kapsamlı TanStack useCreateStore ve useSelector. | D | TK-324 |
| `apps/web/src/features/technical-diagrams/ui/components/technical-diagram-editor.tsx:93` | `tableId` | Store — AddColumnForm ve AddIndexForm arasında paylaşılan geçici tablo seçimi: useCreateStore + useSelector | D | TK-324 |
| `apps/web/src/features/technical-diagrams/ui/forms/diagram-authority-conversion-form.tsx:46` | `preview` | Query — previewMutation.data; eskimiş yanıt kontrolü previewMutation.variables ile form değerleri karşılaştırılarak; listeners.onChange → previewMutation.reset() | D | TK-073 |
| `apps/web/src/features/technical-diagrams/ui/forms/diagram-authority-conversion-form.tsx:49` | `error` | Türetilen — previewMutation.error ?? confirmMutation.error | D | TK-322 |
| `apps/web/src/features/technical-diagrams/ui/forms/new-technical-diagram-form.tsx:51` | `error` | Türetilen — create.error | D | TK-322 |
| `apps/web/src/features/test-assessments/ui/forms/record-test-assessment-form.tsx:42` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-312 |
| `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:45` | `targetType` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-308 |
| `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:52` | `targetId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-308 |
| `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:53` | `sectionId` | Form — Seçici taslak alanı: ayrı bir useForm (alt form) veya üst formun field'ı; Ekle eylemi pushValue (mode="array") | D | TK-308 |
| `apps/web/src/features/test-gaps/ui/components/test-gap-relations-field.tsx:54` | `message` | Karar #553 — Duyuru Store; already related doğrulaması Form. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-309 |
| `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:87` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-308 |
| `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:202` | `message` | Query — Plan/unplan eylemleri için mutation isSuccess + variables | D | TK-310 |
| `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:203` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-310 |
| `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:430` | `open` | Base UI — Base UI Collapsible (defaultOpen/kontrolsüz, Collapsible.Trigger/Panel); başarıda kapanma gerekiyorsa kontrollü open Store/Router'dan; decisions useQuery Panel içine taşınınca enabled gerekmez | D | TK-311 |
| `apps/web/src/features/test-gaps/ui/forms/test-gap-form.tsx:431` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-308 |
| `apps/web/src/features/test-report/ui/forms/test-session-import-form.tsx:23` | `error` | Form — Dosya seçimi doğrulaması field validator (onChange), ayrıştırma/sunucu hatası setErrorMap({ onSubmit }) | D | TK-307 |
| `apps/web/src/features/test-report/ui/forms/test-session-record-form.tsx:39` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-307 |
| `apps/web/src/features/test-review/ui/components/test-review-signals.tsx:41` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-313 |
| `apps/web/src/features/test-review/ui/components/test-review-signals.tsx:42` | `pending` | Query — useMutation(...).isPending | D | TK-313 |
| `apps/web/src/features/test-review/ui/forms/test-review-follow-up-form.tsx:67` | `preview` | Query — Önizleme okuması: useMutation(orpc.preview*.mutationOptions()).data (olay tetikli) veya useQuery(queryOptions, enabled); form listeners.onChange → mutation.reset() | D | TK-313 |
| `apps/web/src/features/test-review/ui/forms/test-review-follow-up-form.tsx:68` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-313 |
| `apps/web/src/features/test-review/ui/forms/test-review-follow-up-form.tsx:69` | `notice` | Query — useMutation(...).isSuccess / data (veya variables) | D | TK-313 |
| `apps/web/src/features/test-review/ui/forms/test-review-follow-up-form.tsx:70` | `pending` | Query — preview/commit mutation isPending (veya form isSubmitting) | D | TK-313 |
| `apps/web/src/features/test-review/ui/forms/test-review-supersedes-form.tsx:31` | `error` | Form — useForm onSubmit içinde formApi.setErrorMap({ onSubmit }) + form.Subscribe selector={s => s.errorMap.onSubmit}; sunucu hatası mutateAsync reddinden | D | TK-314 |
| `apps/web/src/features/test-review/ui/forms/test-review-supersedes-form.tsx:32` | `notice` | Form — isSubmitSuccessful (form.reset() sonrası korunup korunmadığı doğrulanmalı; değilse mutation isSuccess) | D | TK-314 |
| `apps/web/src/features/test-review/ui/views/test-review-view.tsx:380` | `selected` | Form — Toplu inceleme için seçili Session Test'ler: useForm array field (mode="array"), previewBulk onSubmit | D | TK-314 |
| `apps/web/src/features/test-review/ui/views/test-review-view.tsx:381` | `panel` | Router — Açık panel türü ve hedef kimlikleri search'te; panel önizleme verisi query/mutation data'dan | D | TK-315 |
| `apps/web/src/features/test-review/ui/views/test-review-view.tsx:382` | `error` | Query — useMutation(orpc.x.mutationOptions()).error / isError | D | TK-313 |
| `apps/web/src/features/test-review/ui/views/test-review-view.tsx:383` | `notice` | Query — useMutation(...).isSuccess / data (veya variables) | D | TK-313 |
| `apps/web/src/features/test-review/ui/views/test-review-view.tsx:384` | `pending` | Query — Mutation isPending; başka bileşende useMutationState | D | TK-313 |
| `apps/web/src/features/test-review/ui/views/test-summary-view.tsx:132` | `open` | Base UI — Base UI Collapsible kontrolsüz (defaultOpen=false) | D | TK-316 |
| `apps/web/src/features/trash/hooks/use-move-to-trash-flow.ts:22` | `pending` | Query — preview/move mutation `isPending` + `variables` (aday anahtarı) | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-move-to-trash-flow.ts:23` | `failed` | Query — mutation `error` + `variables` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-move-to-trash-flow.ts:24` | `reviewing` | Query — preview mutation `data` + `variables.candidate` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-permanent-delete-flow.ts:17` | `deleting` | Query — preview mutation `data`, confirmIdentity mutation `data` (grant) / `isPending`; başarısız silmede `confirmIdentity.reset()` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-permanent-delete-flow.ts:23` | `busy` | Query — permanentlyDelete mutation `isPending` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-permanent-delete-flow.ts:24` | `error` | Query — mutation `error` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-restore-flow.ts:20` | `conflicts` | Query — restore preview mutation `data` (`restorable === false`) | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-restore-flow.ts:24` | `restoring` | Query — restore mutation `isPending` + `variables.id` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-restore-flow.ts:25` | `failedId` | Query — restore mutation `error` + `variables.id` | D | TK-362 |
| `apps/web/src/features/trash/hooks/use-restore-flow.ts:26` | `restoredLabel` | Query — restore mutation `isSuccess` + `variables.recordLabel` | D | TK-362 |
| `apps/web/src/features/trash/ui/forms/permanently-delete-form.tsx:63` | `invalid` | Form — `validators.onSubmit` (permanentlyDeleteFromTrashInputSchema) + `setErrorMap` | D | TK-363 |
| `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:37` | `editing` | Store — useCreateStore / useSelector | D | TK-240 |
| `apps/web/src/features/uncertainty-records/ui/components/open-questions-surface.tsx:40` | `saved` | Query — createProjectSourceRecord / transitionProjectSourceRecord mutation.isSuccess / reset | D | TK-241 |
| `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-panel.tsx:90` | `editing` | Store — useCreateStore / useSelector | D | TK-240 |
| `apps/web/src/features/uncertainty-records/ui/components/project-assumptions-surface.tsx:31` | `savedMessage` | Query — create/update/transition mutation.isSuccess / reset | D | TK-241 |
| `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:54` | `baseRecord` | Form — form defaultValues baz id/revision | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:55` | `error` | Form — formApi.setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:56` | `conflict` | Türetilen — mutation.error üstünden CONFLICT hesapla | D | TK-243 |
| `apps/web/src/features/uncertainty-records/ui/forms/assumption-editor-form.tsx:59` | `evidenceDocuments` | Form — form defaultValues edit oturumu exact Document teklifleri | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/forms/open-question-editor-form.tsx:49` | `baseRecord` | Form — form defaultValues baz id/revision | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/forms/open-question-editor-form.tsx:50` | `error` | Form — formApi.setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/forms/open-question-editor-form.tsx:51` | `conflict` | Türetilen — mutation.error üstünden CONFLICT hesapla | D | TK-243 |
| `apps/web/src/features/uncertainty-records/ui/forms/open-question-editor-form.tsx:53` | `evidenceDocuments` | Form — form defaultValues edit oturumu exact Document teklifleri | D | TK-242 |
| `apps/web/src/features/uncertainty-records/ui/views/open-question-view.tsx:21` | `pending` | Query — transitionProjectSourceRecord mutation.isPending | D | TK-241 |
| `apps/web/src/features/uncertainty-records/ui/views/open-question-view.tsx:22` | `error` | Query — transitionProjectSourceRecord mutation.error | D | TK-241 |
| `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:249` | `datePickerOpen` | Base UI — Kontrolsüz Popover + actionsRef.current?.close() | D | TK-192 |
| `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:732` | `draggedDate` | Karar #553 — Aktif drag dnd-kit source; Date Picker/onay için ayrı taslak Store. Reset, yönlendirme ve güncel durum: §16.1 G9 | D | TK-193 |
| `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:733` | `previewDate` | Karar #553 — Aktif drag dnd-kit target; onay için aynı taslak Store. Reset, yönlendirme ve güncel durum: §16.1 G9 | D | TK-193 |
| `apps/web/src/features/unified-calendar/ui/components/unified-calendar.tsx:735` | `previewRequiresConfirmation` | Türetilen — Önizlemenin türünden hesapla; Date Picker taslağı onay ister, drag hover istemez | D | TK-194 |
| `apps/web/src/features/unified-calendar/ui/views/unified-calendar-view.tsx:113` | `dateChangeUndo` | Query — updateCalendarDate.data ve undoCalendarDate durumundan türet; reset ile kapsamı temizle | D | TK-195 |
| `apps/web/src/features/unified-calendar/ui/views/unified-calendar-view.tsx:117` | `dateChangeError` | Query — updateCalendarDate.error ve undoCalendarDate.error/reset | D | TK-195 |
| `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:60` | `plan` | Query — previewUserFlowRebind.queryOptions / useQuery.data | D | TK-275 |
| `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:61` | `error` | Query — preview query.error / rebind mutation.error | D | TK-275 |
| `apps/web/src/features/user-flow/ui/components/rebind-dialog.tsx:62` | `pending` | Query — rebindUserFlowBind mutation.isPending | D | TK-275 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:225` | `collapsed` | Store — useCreateStore / useSelector | D | TK-276 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:263` | `editor` | Store — useCreateStore / useSelector | D | TK-276 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:266` | `snap` | Store — useCreateStore / useSelector | D | TK-276 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:267` | `error` | Query — saveUserFlowVersion mutation.error / reset | D | TK-275 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:268` | `saving` | Query — saveUserFlowVersion mutation.isPending | D | TK-275 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:269` | `textDraft` | Karar #553 — Kontrolsüz Textarea; node/metin kimliği; blur olayından commit. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-277 |
| `apps/web/src/features/user-flow/ui/components/user-flow-canvas.tsx:351` | `canvasNodes` | Karar #553 — React Flow controlled akış; useNodesState ve model uzlaştırma. Reset, yönlendirme ve güncel durum: §16.1 G6 | D | TK-277 |
| `apps/web/src/features/user-flow/ui/components/user-flow-outline.tsx:282` | `inspectedId` | Store — useCreateStore / useSelector | D | TK-276 |
| `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:23` | `selectedId` | Router — validateSearch / useSearch / navigate({ search }) | D | TK-278 |
| `apps/web/src/features/user-flow/ui/components/user-flow-surface.tsx:24` | `dirty` | Store — User Flow editor Store selector | D | TK-276 |
| `apps/web/src/features/user-flow/ui/forms/convert-and-bind-form.tsx:110` | `plan` | Query — previewUserFlowConvert.queryOptions / data | D | TK-275 |
| `apps/web/src/features/user-flow/ui/forms/convert-and-bind-form.tsx:111` | `error` | Form — setErrorMap / form.Subscribe ve confirm mutation.error | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/convert-and-bind-form.tsx:112` | `pending` | Query — preview query.isFetching / convertUserFlowNode mutation.isPending | D | TK-275 |
| `apps/web/src/features/user-flow/ui/forms/create-from-template-form.tsx:25` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/create-user-flow-form.tsx:16` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/place-card-form.tsx:26` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/place-node-form.tsx:28` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/promote-to-screen-form.tsx:38` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/forms/save-template-form.tsx:22` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-279 |
| `apps/web/src/features/user-flow/ui/views/user-flow-view.tsx:141` | `converting` | Base UI — Dialog.createHandle<Payload> / Trigger handle payload | D | TK-280 |
| `apps/web/src/features/user-flow/ui/views/user-flow-view.tsx:142` | `rebinding` | Base UI — Dialog.createHandle<Payload> / Trigger handle payload | D | TK-280 |
| `apps/web/src/features/validation-records/ui/forms/validation-record-editor-form.tsx:35` | `baseRecord` | Form — form defaultValues baz id/revision | D | TK-244 |
| `apps/web/src/features/validation-records/ui/forms/validation-record-editor-form.tsx:36` | `error` | Form — setErrorMap / form.Subscribe errorMap.onSubmit | D | TK-244 |
| `apps/web/src/features/validation-records/ui/forms/validation-record-editor-form.tsx:37` | `conflict` | Türetilen — save mutation.error üstünden CONFLICT hesapla | D | TK-245 |
| `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:40` | `editing` | Store — useCreateStore / useSelector | D | TK-246 |
| `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:43` | `status` | Router — Zod validateSearch / useSearch / navigate({ search }) | D | TK-247 |
| `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:46` | `error` | Query — transitionProjectSourceRecord mutation.error | D | TK-248 |
| `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:47` | `busy` | Query — transitionProjectSourceRecord mutation.isPending | D | TK-248 |
| `apps/web/src/features/validation-records/ui/views/validation-records-view.tsx:48` | `message` | Query — save/transition mutation.isSuccess / reset | D | TK-248 |
| `apps/web/src/features/value-chain/ui/views/value-chain-view.tsx:77` | `open` | Base UI — Base UI Collapsible.Root / Trigger / Panel | D | TK-338 |
| `apps/web/src/features/wiki-publishing/ui/forms/wiki-publication-form.tsx:50` | `unpublishOpen` | Base UI — Dialog kontrolsüz: `DialogTrigger` + `DialogClose` | D | TK-357 |
| `apps/web/src/features/wiki-publishing/ui/forms/wiki-publication-form.tsx:51` | `indexingOpen` | Base UI — Dialog kontrolsüz + onSetIndexing başarısında `actionsRef.current?.close()` | D | TK-357 |
| `apps/web/src/features/work-checklists/ui/components/work-checklist-editor.tsx:25` | `error` | Query — mutation/previewConversionMutation/conversionMutation .error | D | TK-159 |
| `apps/web/src/features/work-checklists/ui/forms/work-checklist-form.tsx:53` | `conversionItemId` | Query — previewConversionMutation.variables (6.2 variables) | D | TK-159 |
| `apps/web/src/features/work-checklists/ui/forms/work-checklist-form.tsx:54` | `conversionPending` | Query — previewConversionMutation.isPending \|\| conversionMutation.isPending (üst bileşende zaten var) | D | TK-159 |
| `apps/web/src/features/work-checklists/ui/forms/work-checklist-form.tsx:56` | `conversionPreview` | Query — previewConversionMutation.data | D | TK-159 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:39` | `workType` | Form — Layout editör formunun workType alanı — bkz. spec-2-12 | D | TK-152 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:40` | `draft` | Form — useForm layout alanı, sectionOrder mode="array" moveValue — bkz. spec-2-12 | D | TK-152 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:43` | `currentRevision` | Query — oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables. | D | TK-026 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:44` | `receiptId` | Query — applyMutation.data.receiptId; undo/değişiklikte applyMutation.reset() | D | TK-026 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:45` | `preview` | Query — previewMutation.data | O | TK-026 |
| `apps/web/src/features/work-context/ui/components/work-context-card-layout-editor.tsx:48` | `localError` | Query — preview/apply/undo .error; custom section doğrulaması için form setErrorMap | D | TK-026 |
| `apps/web/src/features/work-context/ui/components/work-context-card.tsx:84` | `contextState` | Karar #553 — Kart yerel Store; work.id ve work.type sınırı. Reset, yönlendirme ve güncel durum: §16.1 G1 | D | TK-153 |
| `apps/web/src/features/work-context/ui/components/work-context-card.tsx:169` | `copyState` | Karar #553 — Clipboard Store; deneme kimliğiyle geç sonuç koruması. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-153 |
| `apps/web/src/features/work-context/ui/components/work-context-card.tsx:172` | `copyError` | Karar #553 — Aynı Clipboard Store. Reset, yönlendirme ve güncel durum: §16.1 G4 | D | TK-153 |
| `apps/web/src/features/work-context/ui/components/work-context-card.tsx:636` | `openCountId` | Base UI — Base UI Accordion (tek açık öğe, kontrolsüz defaultValue) — Priority Foundations sayım listeleri | D | TK-154 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:171` | `open` | Base UI — Popover kontrolsüz + seçimde Popover.Close / actionsRef.current?.close() | D | TK-135 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:233` | `text` | Form — Ham sayı metni form alanı (customFieldValues yanında raw text alanı); render sırasında setState senkronu kaldırılır | D | TK-136 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:546` | `activeDraftId` | Form — Taslak kimliği gizli form alanı (draftIdRef ile çift kaynak); render yalnız truthy kontrolü | D | TK-136 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:549` | `actionMessage` | Query — saveDraft/deleteDraft mutation isSuccess + variables | D | TK-018 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:550` | `createdWorkKey` | Query — finalizeMutation.data?.key | D | TK-018 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:551` | `formError` | Query — saveDraft/finalize/delete .error; doğrulama için setErrorMap | D | TK-018 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:552` | `isCreating` | Query — finalizeMutation.isPending | O | TK-018 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:553` | `isSaving` | Query — saveDraftMutation.isPending | O | TK-018 |
| `apps/web/src/features/work-drafts/ui/forms/work-draft-form.tsx:556` | `targetProjectId` | Form — Spec 11: hedef Proje form üzerinde seçilir → form alanı; prop senkronu useEffect yerine form.reset | D | TK-136 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:97` | `showArchived` | Router — Project route validateSearch ile archived filtresi, useSearch ve navigate({ search }); hash ile açılan kayıt için arşiv durumu bir kez normalize edilir. | D | TK-128 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:99` | `isBulkEditOpen` | Base UI — BulkEditDialog içinde kontrolsüz Dialog, gerektiğinde harici trigger için Dialog.createHandle; seçili Work kimlikleri zaten Store'da kalır. | D | TK-129 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:101` | `lastMergeResult` | Query — Merge mutation.data veya üstte useMutationState ile son başarı makbuzu; çalıştırılan Undo'nun kimliği variables, makbuzun tüketimi reset. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:102` | `mergeUndoError` | Query — undoMerge.error ve reset; değişen merge kimliği eski hatayı taşımaz. | O | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:558` | `error` | Query — Archive/unarchive mutation.error içinden kullanıcıya dönük mesajı türet. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:639` | `selectedType` | Form — TanStack Form form.Field ve form.Subscribe; gerekirse setErrorMap. | D | TK-130 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:640` | `preview` | Query — previewTypeChange.data; requiresImpactPreview, geçerli seçim ve başarılı update koşuluna göre göster, iptal veya apply'da reset. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/components/project-work-list.tsx:641` | `error` | Query — previewTypeChange.error ve updateType.error içinden aktif adım hatasını oku. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:63` | `open` | Base UI — Merge inline paneli için kontrolsüz Collapsible veya Dialog trigger/actionsRef.close; başarılı apply sonrasında kapat, iptalde formu sıfırla. | D | TK-129 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:64` | `preview` | Query — Önizleme useMutation.data veya olay içi query sonucu; yeni hedef/iptalde reset. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-merge-form.tsx:65` | `error` | Form — Alan çözümlemesi ve payload hatası formApi.setErrorMap, ulaşım hatası preview/apply mutation.error. | D | TK-130 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:60` | `open` | Base UI — Recreate inline paneli için kontrolsüz Collapsible veya Dialog trigger ve Close; adım değişiminde form ve preview reset sürdürülür. | D | TK-129 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:61` | `preview` | Query — Önizleme useMutation.data, onSuccess ile varsayılan portability alanlarını forma yaz; hedef değişince reset. | D | TK-015 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:62` | `error` | Form — Zod hatası formApi.setErrorMap, preview/apply hataları ilgili mutation.error. | D | TK-130 |
| `apps/web/src/features/work-lifecycle/ui/forms/work-recreate-form.tsx:63` | `recreatedKey` | Query — recreate mutation.data.key üzerinden başarı makbuzu; yeni deneme veya kapatmada reset. | D | TK-015 |
| `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:22` | `open` | Base UI — Base UI Collapsible/Popover kontrolsüz (defaultOpen) + başarıda actionsRef.close(); 6.6 ihlal örneği doğrulandı | D | TK-155 |
| `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:23` | `createdWorkKey` | Query — duplicate.data?.key | D | TK-156 |
| `apps/web/src/features/work-templates/ui/components/work-duplicate-action.tsx:24` | `error` | Query — duplicate.error; doğrulama için WorkDuplicateForm setErrorMap (setError prop'u kaldırılır) | D | TK-156 |
| `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:48` | `editing` | Form — Düzenlenen şablon WorkTemplateForm defaultValues'ı; form.reset(draftFromTemplate(t)) ile değiştirilir | D | TK-157 |
| `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:49` | `instantiating` | Store — Satır içi 'Create from template' hedefi → useCreateStore; dialog'a dönerse createHandle<WorkTemplate>() | D | TK-158 |
| `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:50` | `createdWorkKey` | Query — instantiate.data?.key | D | TK-156 |
| `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:51` | `error` | Query — create/update/instantiate .error | D | TK-156 |
| `apps/web/src/features/work-templates/ui/components/work-template-editor.tsx:68` | `formVersion` | Form — key ile yeniden mount hilesi → form.reset() | D | TK-157 |
| `apps/web/src/features/workspace-overview/ui/components/saved-project-lists.tsx:299` | `editing` | Router — Panel açıklığı/seçili kayıt: mevcut selectedListId search'ünün yanına edit=list-id\|new (validateSearch + navigate) | D | TK-150 |
| `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:338` | `selectedSources` | Query — oRPC queryOptions / mutationOptions; uygun Query data veya mutation result/variables. | O | TK-023 |
| `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:478` | `layout` | Query — workspaceOverview sorgu verisi + saveWorkspaceOverview onMutate/onError (iyimser) | O | TK-023 |
| `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:481` | `liveBlockSources` | Query — aynı | O | TK-023 |
| `apps/web/src/features/workspace-overview/ui/components/workspace-overview.tsx:484` | `savedLists` | Query — aynı (şu an elle geri alma var) | O | TK-023 |
| `apps/web/src/features/workspace-overview/ui/forms/saved-list-editor-form.tsx:103` | `formError` | Form — formApi.setErrorMap({ onSubmit }) + form.Subscribe | D | TK-151 |
| `packages/ui/src/components/carousel.tsx:67` | `canScrollPrev` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/carousel.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |
| `packages/ui/src/components/carousel.tsx:68` | `canScrollNext` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/carousel.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |
| `packages/ui/src/components/sidebar.tsx:75` | `openMobile` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/sidebar.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |
| `packages/ui/src/components/sidebar.tsx:79` | `_open` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/sidebar.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |
| `packages/ui/src/components/sidebar.tsx:625` | `width` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/sidebar.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |
| `packages/ui/src/hooks/use-mobile.ts:6` | `isMobile` | shadcn istisnası — shadcn base-lyra kaydından üretildi (#3 bd0aeb02, components.json style base-lyra); sonraki değişiklikler yalnız Ultracite lint (09dda870) ve Biome 2.6 format (98151a85). State satırı https://ui.shadcn.com/r/styles/base-lyra/use-mobile.json güncel içeriğiyle birebir (normalize diff yalnız import/sıralama/interface/lint). | — | — |

**Sayım:** 715 ihlal yeri. shadcn istisnası: 6.

| Hedef | İhlal yeri |
| --- | ---: |
| Query | 237 |
| Form | 186 |
| Store | 89 |
| Base UI | 81 |
| Sahibi kararlaştırıldı (önceden sahipsiz; #553, §16.1) | 56 |
| Türetilen | 31 |
| Router | 27 |
| Render dışı useRef | 8 |

| Feature veya ortak kod | İhlal yeri |
| --- | ---: |
| documents | 55 |
| record-discovery | 27 |
| planned-tests | 24 |
| user-flow | 24 |
| capture-triage | 23 |
| screens | 22 |
| file-attachments | 21 |
| research-sessions | 20 |
| ortak | 18 |
| roadmap-horizon | 18 |
| moodboards | 17 |
| project-wall | 16 |
| sources-and-freshness | 16 |
| link-sharing | 15 |
| product-gaps | 15 |
| work-lifecycle | 15 |
| test-review | 14 |
| uncertainty-records | 14 |
| project-shell | 13 |
| github-integration | 12 |
| priority-metrics | 12 |
| production-incidents | 12 |
| project-release-planning | 12 |
| decisions | 11 |
| technical-diagrams | 11 |
| trash | 11 |
| work-context | 10 |
| external-handoffs | 9 |
| feedback | 9 |
| project-goals | 9 |
| record-actions | 9 |
| test-gaps | 9 |
| work-drafts | 9 |
| data-import | 8 |
| personal-data-rights | 8 |
| validation-records | 8 |
| work-templates | 8 |
| bulk-editing | 7 |
| command-palette | 7 |
| data-export | 7 |
| return-to-work | 7 |
| spec-change-review | 7 |
| attention-signals | 6 |
| backlog | 6 |
| completion-effects | 6 |
| schema-artifacts | 6 |
| unified-calendar | 6 |
| workspace-overview | 6 |
| contacts | 5 |
| focus-period | 5 |
| project-closure-summary | 5 |
| relations | 5 |
| risks | 5 |
| security-redaction | 5 |
| tags | 5 |
| custom-fields | 4 |
| smart-collections | 4 |
| work-checklists | 4 |
| account-access | 3 |
| account-preferences | 3 |
| project-updates | 3 |
| build-in-public | 2 |
| daily-focus | 2 |
| evidence | 2 |
| external-surface-management | 2 |
| kanban | 2 |
| personal-shell | 2 |
| project-history | 2 |
| project-retirement | 2 |
| test-report | 2 |
| wiki-publishing | 2 |
| prioritization-sessions | 1 |
| release-evidence | 1 |
| test-assessments | 1 |
| value-chain | 1 |

## 14. Deprecated kullanımlar ve yeni API’ler

| Durum | Kanıt ve öneri |
| --- | --- |
| Query 5.108.0, önceki aşamada giderilmiş | PR #542, eski `fetchQuery` ve `ensureQueryData` çağrılarını `query` ile değiştirdi. Denetim kapsamındaki üretim kaynaklarında eski QueryClient yöntemlerine çağrı çıkmadı. 12 tazelik ayarının tekrarı ayrı sözleşme bulgusu. |
| Store 0.11.2, önceki aşamada giderilmiş | Eski `useStore` alias’ı kurulu tipte deprecated. Üretim kodunda Form ve React Store kaynaklı alias tüketicisi kalmadı. `useSelector` ve Form `form.Subscribe` uygun yollar. |
| Table 9.3.1 | `record-table.tsx` ve `saved-project-lists.tsx` geçerli `useTable` API’sinde. Taslaktaki v8 row-model adlarını yeni kodda kullanma. Table state ile Wireframe editörünün `.getState()` metodu farklı API’lerdir. |
| SDK 1.32.2 gelişmiş kullanım | `apps/server/src/features/test-report/server/test-report-mcp.ts:125` düşük seviye `Server`, kurulu SDK tarafından standart yol için deprecated olarak işaretli. Kod iki protokol handler’ını bilinçli şekilde kayıt ediyor ve üretim transport mount’u görünmüyor. `McpServer` + tek `registerTool`, spec’in açık protokol/veri biçimini koruyabiliyorsa bağlantı çalışmasında değerlendir. [SDK kaynak ve API](https://github.com/modelcontextprotocol/typescript-sdk). |
| Bun vs Undici tip uyarısı | Bun Request üzerinde `formData()` kullanan `file-attachment-http.ts:64` ve `link-sharing-http.ts:148` TypeScript’te `undici-types` uyarısına denk geliyor. Üretim server body limiti ve ziyaretçi form limiti var. Undici’nin kendi API uyarısı Bun için kaldırılma kanıtı değil. |

## 15. Kullanılmayan bağımlılıklar

Mekanik envanter **188 manifest bildirimi** saydı. Burada yalnız çıkarma önerisi veren kanıtlar ve importu sıfır olan önemli inceleme adayları var. Config, CLI, tip, framework ve test tüketicileri ayrıca kontrol edildi.

| Paket | Manifest | Kanıt | Öneri |
| --- | --- | --- | --- |
| `lucide-react` | `apps/fumadocs/package.json:18` | TK-380. lucide-react için yerel kaynak/test/config importu sıfır. MDX ve Next app dosyalarında import yok. Fumadocs UI 16.19.4, lucide-react paketini kendi dependencies alanında bildiriyor. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `zod` | `package.json:54` | TK-381. zod için yerel kaynak/test/config importu sıfır. Kök kod, config ve scriptlerde Zod importu yok. Tarayıcı, API ve diğer gerçek tüketiciler kendi manifestlerinde bağımlılığı bildiriyor. Root catalog girdisi ayrı tutulabilir. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `@orpc/client` | `packages/api/package.json:23` | TK-382. @orpc/client için yerel kaynak/test/config importu sıfır. API sözleşmesi RouterClient tipini @orpc/server üzerinden alıyor (packages/api/src/routers/index.ts). Uygulamadaki gerçek istemcinin manifesti apps/web/package.json. API kaynak/test/declaration dosyalarında doğrudan istemci referansı yok. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `@orpc/openapi` | `packages/api/package.json:24` | TK-383. @orpc/openapi için yerel kaynak/test/config importu sıfır. OpenAPI sunucu adaptörü apps/server/src/app.ts:138–139 içinde ve apps/server kendi manifestinde ilan ediyor. API kontratı üretimde, testte ve mevcut declaration çıktısında bu pakete başvurmuyor. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `@orpc/zod` | `packages/api/package.json:26` | TK-384. @orpc/zod için yerel kaynak/test/config importu sıfır. ZodToJsonSchemaConverter apps/server/src/app.ts:143 tarafında ve apps/server kendi manifestini kullanıyor. API kontratı Zod şemalarını doğrudan zod üzerinden kuruyor. API içinde kaynak ve declaration referansı yok. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `zod` | `packages/auth/package.json:21` | TK-385. zod için yerel kaynak/test/config importu sıfır. Auth kaynakları Zod import etmiyor. Better Auth 1.7.25 kendi bağımlılığında Zod bildiriyor. Auth manifestindeki declaration/build veya script bu paketi istemiyor. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `date-fns` | `packages/ui/package.json:22` | TK-386. date-fns için yerel kaynak/test/config importu sıfır. UI kaynak ve config dosyalarında import yok. Takvim bileşeni react-day-picker import ediyor; react-day-picker 10.0.2 date-fns paketini kendi dependencies alanında bildiriyor. | Kaldır ve ilgili workspace doğrulamasını çalıştır. |
| `react-dom` | `packages/ui/package.json:28`, `apps/fumadocs/package.json:21` | Doğrudan import sıfır. Base UI, Next ve farklı React adaptörlerinin peer çalışma zamanı. | İncele. Peer grafiğini ve framework build gereksinimini koru. |
| `postcss`, `@tailwindcss/postcss` | `apps/fumadocs/package.json:25,30`, `packages/ui/package.json:36` | PostCSS yapılandırması string plugin anahtarını yüklüyor. | İncele ve yapılandırma tüketicisini koru. |
| `@wxt-dev/module-react`, `web-ext` | `apps/extension/package.json:31,34` | WXT config modülü ve WXT’nin tarayıcı runner’ı dinamik yüklüyor. | Koru. |
| `@t3-oss/env-core`, `pdfjs-dist` | `apps/web/package.json:30,64` | İlki üretilmiş `src/env.ts:1` importu, ikincisi `file-attachment-pdf.tsx:15` worker asset çözümlemesi. | Koru. |
| `@cantiara/config`, `@types/*`, `@tauri-apps/cli`, `happy-dom` | İlgili workspace manifestleri | tsconfig extends, TypeScript tip çözümleme, tauri paket scriptleri ve Vitest ortam pragma’ları. | Koru. Kaldırma kararı doğrudan import sayısından çıkarılamaz. |

## 16. Sahipsiz ve belirsiz işler

Kullanıcı 2026-11-19 tarihinde bu bölümün state, rate limit ve analytics başlıkları için karar paketini onayladı ([#553 karar yorumu](https://github.com/UnderprotectionDev/cantiara/issues/553#issuecomment-7013251362)). #553 yalnız karar ve yönlendirme kaydıdır; düzeltmelerin uygulanmış olduğunu kendisi göstermez. Uygulama durumu 16.1’deki güncel durum sütunundadır. Aşağıda karar verilmedi diye işaretlenen başlıklar açık kalır.

| İş | Karar durumu | Sahip, erteleme, sözleşme veya açık seçenek |
| --- | --- | --- |
| Uygulama içi rate limit | Ertelendi (#553) | Genel uygulama limiter’ı somut bir owning spec ihtiyacına kadar eklenmez; yeni issue yok. Account Access, Link Sharing, GitHub, Smart Link egress ve Cloudflare WAF korumaları kendi sınırlarında kalır. Kayıt: 3. bölüm ve `docs/tech-stack.md` Cloudflare WAF / Rate Limiting satırı. |
| Ürün analytics | Mevcut erteleme sözleşmesine bağlandı (#553) | Sahip: `docs/tech-stack.md` “Daha sonra eklenecekler” altındaki ürün analitiği sağlayıcısı notu ve [PRD 18](../prd/18-future-directions.md) “Sağlayıcısız ürün analitiği yön notu”; kapsam dışı sınırı [PRD 19](../prd/19-out-of-scope.md). Ayrı stack kararı verilmeden analytics sağlayıcısı seçilmez veya stack’e eklenmez. Evlog ve Better Stack operasyon gözlemidir; ürün analytics sahibine dönüştürülmez. Yeni issue yok. |
| Bileşen içi etkileşimler | Karar verildi (#553) | 56 sahipsiz state kullanımının sahibi, reset sınırı ve yönlendirmesi 16.1’dedir. Önce mevcut kütüphanenin state/abonelik API’si, kalan geçici render state için bileşen ömürlü TanStack Store. |
| Her seçimi URL’ye taşıma | Mevcut sözleşme korundu (#553) | Bu 56 kullanım için yeni Router search alanı yok. Yalnız spec’in paylaşılabilir veya geri düğmesiyle yürüyen konumları Router’a aittir. Personal Shell ve Project Wall geri yüklememe sınırları korunur. |
| Satır içi onay veya edit alanı | Karar verildi (#553) | Reopen onayı satır içi kalır; uygun ARIA, odak ve Escape/Cancel sağlanır, modal dönüşüm yapılmaz (#546 bunu değiştirmez). Satır içi edit modları bileşen ömürlü Store’dadır (16.1 G1, G2). |
| T3 Env ile DB yerel bağlanma adaptörü | Karar verilmedi; açık | TK-399 state envanterinin parçası değildir; #553 bunun için sahiplik veya uygulama onayı üretmez. Seçenek: `packages/db/src/env.ts` validasyon girişi, `packages/db/src/local-postgres.ts` ise `NEON_LOCAL` bağlantı sınırı; yerel CLI ve uygulama girişlerinin paylaştığı doğrulanmış env yüzeyi belirlenebilir. Neden: sunucu ortamı kuralının DB paketi ve yerel CLI üzerindeki kapsamı belgede açık değil. Statik incelemede bir değer sızıntısı görülmedi. |
| Better Auth GitHub taşıması | Karar verilmedi; açık | Seçenek: Better Auth hook/callback sözleşmesi korunarak harici GitHub HTTP erişimini tek bir sahipte toplama; zaman aşımı ve güvenli hata dönüşü bu sınırın parçası olsun. Neden: uygulama RPC’si ile dış OAuth HTTP isteği farklı sınırlar. Bun yerleşik taşıma, Undici paketi ve GitHub App’in Octokit portunun rolü ayrı belgelenmeli. |
| API referansı erişim politikası ve platform taşıması | Karar verilmedi; açık | Seçenek: `apps/server/src/app.ts` içindeki API referansı ve extension origin politikasının hedef kitlesini ve dağıtımdaki sınırlarını netleştir. Neden: teknoloji sahibi Scalar. Üretimde erişim ve origin politikasının özellik sahibi açık değil. Yetkisiz erişim sonucu doğrulanmadı. |
| Hassas işlem parametreleri | Karar verilmedi; açık | Seçenek: redaksiyon, grant ve export gibi akışlarda önce hangi değerlerin Query key, cache ve global hata işleyicisinde kalabileceğini belirle. Neden: Form/Query sahipliği, hassas verinin gereksiz yere cache’e taşınmasına izin vermez. #553 yalnız issued Share token’ı için #555/#544 kısıtını kaydeder; bu başlığın geri kalanına karar atamaz. |

### 16.1 Önceden sahipsiz state kullanımlarının sahiplik kararları (#553)

Ortak sözleşme:

- Önce mevcut kütüphanenin state/abonelik API’si kullanılır. Kalan geçici render state bileşen ömürlü TanStack Store’a gider; singleton, persist veya storage eklenmez. Stack kaydı: `docs/tech-stack.md` TanStack Store satırı (#547).
- Yazılabilir Store için değer overload’u, salt okunur snapshot için getter kullanılır; getter yazılabilir lazy initializer sayılmaz. Prop veya kimlik değişimi kendiliğinden reset sağlamaz; tablodaki reset açıkça uygulanır. Tüm abonelik, timer ve async sonuçlar unmount’ta temizlenir veya geçersiz kılınır.
- Aynı sorumluluğun alanları tek Store’da gruplanır; her satır için ayrı Store açılmaz.
- Bu 56 kullanım için yeni Router search alanı yok. Personal Shell ve Project Wall geri yüklememe sınırları korunur.
- Reopen onayı satır içi kalır; uygun ARIA, odak ve Escape/Cancel sağlanır. Modal dönüşüm yapılmaz.
- Command Palette rAF davranışı korunur; `useDeferredValue` doğrudan eşdeğer kabul edilmez. Saatler için global singleton zorunlu değildir; mevcut yerel kapsam yeterlidir.
- Query ve Form, UI duyurusunun yerine konmaz: gerçek doğrulama Form’da, sunucu işlemi sonucu Query’de, yerel Clipboard sonucu Store’da kalır.

Yönlendirme: #547 geçici state sahipliği ve reset, Store stack genişlemesi, controlled canvas, Decision hedef kimliği ve Project Wall Sunum Kipi reset’i; #545 seçici Form doğrulaması, duyuru ayrımı ve history Query hata türetimi; #549 TK-193 Calendar aktif drag ve onay taslağı; #555 S-Secret, TK-354 issued Share token’ı (#544 Query/MutationCache dışlama kısıtıyla); #556 S-PDF, TK-147 React-PDF 11 yerel hata/Retry. #547 aynı PDF dosyasında ikinci paralel uygulama yapmaz.

Güncel durum, `main` `eac1a1eb` üzerinde 2026-11-23 tarihinde statik kod okumasıyla kaydedildi: **52 kullanımda onaylanan sahip uygulanmış, 4 kullanım bekliyor** (TK-147 üç state #556, TK-354 bir state #555). #547, #549, #545, #544 ve #546 kapalı; #555 ve #556 açık. “Sahip uygulandı” yalnız kodda görülen sahibi bildirir; reset, odak ve geç async davranışı bu kayıtta çalıştırılarak doğrulanmadı. Bu davranışların testi owning spec’in Testing Decisions seam’ine ve ilgili uygulama issue’suna aittir. Denetim konumu kaynak `a548a2c8` satırıdır; taşınan dosyalar güncel durum sütununda yeni yollarıyla gösterilir.

Uygulama kabul sınırları: her düzeltme owning spec’in Testing Decisions seam’ine bağlanır. Aynı bileşende kimlik değişimi, Cancel/Escape, başarısız yazmada taslağın korunması, unmount ve geç veya sırası değişmiş async callback test edilir. Decision düzenlemesi mode ve recordId’ye bağlıdır; eski taslak yeni seçilen kayda yazılamaz. Project Wall sunumu duvar değişince kapanır veya sıfırlanır. React Flow controlled model uzlaştırması canlı drag, selection ve measured alanlarını korur; Roadmap adaptörü ilk viewport yerleştirmesinden önce ready olmaz. Decision hedef kaydı ve Project Wall sunum reset riskleri kod incelemesi bulgularıdır; çalıştırılarak yeniden üretilmiş bug iddiası değildir.

| Grup | Denetim konumu | Değişken | TK | Onaylanan sahip | Reset/yaşam sınırı | Yönlendirme | Güncel durum (`apps/web/src/`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 Satır içi edit modu ve yerel seçim | `components/custom-field-editor-form.tsx:123` | `editingId` | TK-389 | Yerel edit Store | Cancel, başarılı kayıt, Project/alan değişimi veya kaldırılması | #547 | Sahip uygulandı: `features/custom-fields/ui/forms/custom-field-editor-form.tsx:140` `editingIdStore` (dosya #544’te taşındı) |
| G1 Satır içi edit modu ve yerel seçim | `components/date-picker.tsx:170` | `draftTime` | TK-391 | Kontrol Store: draftTime ve son yayılan değer | Clear, dış Form reset veya farklı kayıt; bileşenin kendi value yayımı ayırt edilir | #547 | Sahip uygulandı: `components/date-picker.tsx:176` `control` Store. Aynı değeri yeniden yayımlayan dış reset bu Store’dan ayırt edilemez; açık saat taslağı varken tüketici bileşeni form oturumuyla key’ler (`:161` JSDoc) |
| G1 Satır içi edit modu ve yerel seçim | `features/decisions/ui/components/project-decisions-panel.tsx:53` | `editing` | TK-235 | Store: mode ve hedef recordId; editör kimliği ikisini içerir | Cancel, başarılı save/withdraw, selectedId/Project veya readOnly değişimi | #547 | Sahip uygulandı: `features/decisions/ui/components/project-decisions-panel.tsx:65` `session` (identity, mode, recordId) |
| G1 Satır içi edit modu ve yerel seçim | `features/documents/ui/forms/document-templates-form.tsx:139` | `selection` | TK-215 | Şablon seçicinin yerel Store; açılış payload’ı ayrı | Project değişimi, şablonun kaldırılması, unmount; popup kapanışı zorunlu reset değil | #547 | Sahip uygulandı: `features/documents/ui/forms/document-templates-form.tsx:149` `selectionStore` |
| G1 Satır içi edit modu ve yerel seçim | `features/project-goals/ui/components/project-goals-view.tsx:38` | `editing` | TK-231 | Yerel edit Store | Cancel, başarılı kayıt, Goal/Project değişimi veya canEdit false | #547 | Sahip uygulandı: `features/project-goals/ui/components/project-goals-view.tsx:55` `editSession` |
| G1 Satır içi edit modu ve yerel seçim | `features/risks/ui/components/project-risks-view.tsx:36` | `editingMode` | TK-238 | Yerel edit Store | Cancel, başarılı kayıt, Risk/Project değişimi veya readOnly | #547 | Sahip uygulandı: `features/risks/ui/components/project-risks-view.tsx:52` `session` |
| G1 Satır içi edit modu ve yerel seçim | `features/work-context/ui/components/work-context-card.tsx:84` | `contextState` | TK-153 | Kart yerel Store; work.id ve work.type sınırı | Work kimliği/türü değişimi veya kart kapanışı | #547 | Sahip uygulandı: `features/work-context/ui/components/work-context-card.tsx:93` `context` |
| G2 Satır içi onay | `components/work-status-form.tsx:93` | `reopenTarget` | TK-396 | Satır içi onay Store; uygun ARIA, odak ve Escape | Cancel/Escape, başarılı reopen, Work/revizyon değişimi; hata taslağı silmez | #547 | Sahip uygulandı: `components/work-status-form.tsx:145` `reopenConfirmation`; satır içi `role="dialog"` ve Escape (`:125`) |
| G3 Görünüm saati | `features/backlog/ui/components/project-backlog.tsx:272` | `now` | TK-187 | Görünüm ömürlü saat Store; tarih Hesap saat diliminden türetilir | Mount/tick/sekme dönüşü yenile; timezone değişimini hesapla; unmount timer temizliği | #547 | Sahip uygulandı: `features/backlog/ui/components/project-backlog.tsx:356` `useViewClock` (`lib/use-view-clock.ts`) |
| G3 Görünüm saati | `features/daily-focus/ui/views/daily-focus-view.tsx:35` | `now` | TK-189 | Görünüm ömürlü saat Store | Tick/sekme dönüşü ve timezone değişimi; açık URL day korunur; unmount temizliği | #547 | Sahip uygulandı: `features/daily-focus/ui/views/daily-focus-view.tsx:40` `useViewClock` |
| G3 Görünüm saati | `features/kanban/ui/components/project-work-kanban.tsx:54` | `today` | TK-183 | Saat Store’undan Hesap saat dilimine göre tarih türetimi | Gün/timezone değişimi; unmount abonelik temizliği | #547 | Sahip uygulandı: `features/kanban/ui/components/project-work-kanban.tsx:56` `useViewClock(30_000)` |
| G4 Clipboard sonucu ve duyuru | `features/external-handoffs/ui/components/external-execution-handoff.tsx:213` | `copiedHandoffId` | TK-180 | Clipboard sonucu Store; history kayıt sonucu Query | Yeni kopyalama veya Work/Handoff değişimi; history yazma hatası clipboard başarısını silmez | #547; Query kısmı #545 | Sahip uygulandı: `features/external-handoffs/ui/components/external-execution-handoff.tsx:258` `useClipboardFeedback` (`lib/use-clipboard-feedback.ts`); history hatası `recordPackageExport` mutation’ından (`:416`) |
| G4 Clipboard sonucu ve duyuru | `features/external-handoffs/ui/components/external-execution-handoff.tsx:214` | `copyError` | TK-180 | Aynı Clipboard Store | Yeni kopyalama veya Work/Handoff değişimi; geç sonuç koruması | #547 | Sahip uygulandı: `features/external-handoffs/ui/components/external-execution-handoff.tsx:258` aynı `useClipboardFeedback` |
| G4 Clipboard sonucu ve duyuru | `features/planned-tests/ui/components/planned-test-relations-field.tsx:45` | `message` | TK-302 | Başarı duyurusu Store; already related doğrulaması Form | Yeni eylem/hedef türü, Form reset veya kayıt değişimi | #545 + #547 | Sahip uygulandı: `features/planned-tests/ui/forms/planned-test-relations-field-form.tsx:44` `announcement` (dosya #545’te taşındı) |
| G4 Clipboard sonucu ve duyuru | `features/planned-tests/ui/components/test-handoff-context-field.tsx:52` | `message` | TK-303 | Duyuru Store; eksik Wireframe/already added doğrulaması Form | Yeni eylem/hedef, Form reset veya Handoff değişimi | #545 + #547 | Sahip uygulandı: `features/planned-tests/ui/forms/test-handoff-context-field-form.tsx:51` `announcement` (dosya #545’te taşındı) |
| G4 Clipboard sonucu ve duyuru | `features/planned-tests/ui/components/test-handoff-package-panel.tsx:42` | `message` | TK-304 | Paket satırı kopyalama Store | Yeni kopyalama, paket sürümü/Handoff değişimi, unmount | #547 | Sahip uygulandı: `features/planned-tests/ui/components/test-handoff-package-panel.tsx:47` `useClipboardFeedback` |
| G4 Clipboard sonucu ve duyuru | `features/product-gaps/ui/components/product-gap-links-field.tsx:50` | `message` | TK-319 | Duyuru Store; already related doğrulaması Form | Yeni eylem/hedef türü, Form reset veya Product Gap değişimi | #545 + #547 | Sahip uygulandı: `features/product-gaps/ui/forms/product-gap-links-field-form.tsx:51` `announcement` (dosya #545’te taşındı) |
| G4 Clipboard sonucu ve duyuru | `features/schema-artifacts/ui/components/sql-output.tsx:22` | `message` | TK-327 | SQL çıktı kopyalama Store | Yeni kopyalama, çıktı değişimi, unmount | #547 | Sahip uygulandı: `features/schema-artifacts/ui/components/sql-output.tsx:27` `useClipboardFeedback` |
| G4 Clipboard sonucu ve duyuru | `features/test-gaps/ui/components/test-gap-relations-field.tsx:54` | `message` | TK-309 | Duyuru Store; already related doğrulaması Form | Yeni eylem/hedef türü, Form reset veya Test Gap değişimi | #545 + #547 | Sahip uygulandı: `features/test-gaps/ui/forms/test-gap-relations-field-form.tsx:53` `announcement` (dosya #545’te taşındı) |
| G4 Clipboard sonucu ve duyuru | `features/work-context/ui/components/work-context-card.tsx:169` | `copyState` | TK-153 | Clipboard Store; deneme kimliğiyle geç sonuç koruması | Yeni kopyalama, Work/bağlam değişimi, unmount | #547 | Sahip uygulandı: `features/work-context/ui/components/work-context-card.tsx:174` `useClipboardFeedback` |
| G4 Clipboard sonucu ve duyuru | `features/work-context/ui/components/work-context-card.tsx:172` | `copyError` | TK-153 | Aynı Clipboard Store | Yeni kopyalama, Work/bağlam değişimi, unmount | #547 | Sahip uygulandı: `features/work-context/ui/components/work-context-card.tsx:174` aynı `useClipboardFeedback` |
| G5 DOM ölçümü | `features/file-attachments/ui/components/file-attachment-markup.tsx:312` | `surfaceSize` | TK-143 | ResizeObserver -> yüzey Store | DOM yüzeyi değişiminde yeniden ölç; unmount temizliği | #547 | Sahip uygulandı: `features/file-attachments/ui/components/file-attachment-markup.tsx:327` `measurements`; ResizeObserver `:375` |
| G5 DOM ölçümü | `features/file-attachments/ui/components/file-attachment-markup.tsx:313` | `media` | TK-143 | Element ve yükleme/ölçüm aboneliği aynı efekt içinde; ayrı render state yok | Element değişimi ve efekt temizliği; gerekirse DOM değişimini gözlemle | #547 | Sahip uygulandı: `features/file-attachments/ui/components/file-attachment-markup.tsx:377` efekt içi yerel değişken; render state yok |
| G5 DOM ölçümü | `features/file-attachments/ui/components/file-attachment-markup.tsx:316` | `mediaSize` | TK-143 | Media ölçüm Store | Dosya sürümü, PDF sayfası veya media elementi değişimi | #547 | Sahip uygulandı: `features/file-attachments/ui/components/file-attachment-markup.tsx:327` aynı `measurements`; ResizeObserver `:391` |
| G5 DOM ölçümü | `features/moodboards/ui/components/moodboard-board.tsx:32` | `size` | TK-282 | ResizeObserver -> board Store | DOM değişiminde yeniden ölç; unmount temizliği | #547 | Sahip uygulandı: `features/moodboards/ui/components/moodboard-board.tsx:35` `measurements` |
| G5 DOM ölçümü | `features/screens/ui/components/wireframe-pane.tsx:69` | `size` | TK-270 | Pane ölçüm Store | DOM değişiminde yeniden ölç; unmount observer temizliği | #547 | Sahip uygulandı: `features/screens/ui/components/wireframe-pane.tsx:71` `pane`; ResizeObserver `:97` |
| G6 Canvas ve renderer oturumu | `features/file-attachments/ui/components/file-attachment-markup.tsx:320` | `draft` | TK-143 | Çizim hareketinin yerel Store’u | Pointer tamamlanması/iptali, tool/page/version veya disabled değişimi | #547 | Sahip uygulandı: `features/file-attachments/ui/components/file-attachment-markup.tsx:338` `drawing` |
| G6 Canvas ve renderer oturumu | `features/moodboards/ui/components/moodboard-board.tsx:62` | `moved` | TK-282 | Moodboard viewport oturum Store | Moodboard id değişimi/unmount; Fit View null; refetch kullanıcı hareketini ezmez | #547 | Sahip uygulandı: `features/moodboards/ui/components/moodboard-board.tsx:83` `viewportSession` |
| G6 Canvas ve renderer oturumu | `features/project-wall/ui/components/project-wall-canvas.tsx:173` | `preview` | TK-290 | Auto-layout komut Store | Cancel, başarılı Apply, yeni hesaplama veya dayanak duvar değişimi | #547 | Sahip uygulandı: `features/project-wall/ui/components/project-wall-canvas.tsx:175` `layout` Store |
| G6 Canvas ve renderer oturumu | `features/project-wall/ui/components/project-wall-canvas.tsx:178` | `applied` | TK-290 | Auto-layout geri alma Store | Başarılı Undo, geçersizleştiren düzenleme veya duvar değişimi; başarısız Undo’da korunur | #547 | Sahip uygulandı: `features/project-wall/ui/components/project-wall-canvas.tsx:175` aynı `layout` Store |
| G6 Canvas ve renderer oturumu | `features/project-wall/ui/components/project-wall-canvas.tsx:359` | `nodes` | TK-290 | React Flow controlled akış; useNodesState ve model uzlaştırma | Duvar oturumu değişimi; model güncellemesi drag/selection/measured bilgisini ezmez | #547 | Sahip uygulandı: `features/project-wall/ui/components/project-wall-canvas.tsx:347` `useReconcileFlowNodes` (`lib/use-reconcile-flow-nodes.ts`, `useNodesState`) |
| G6 Canvas ve renderer oturumu | `features/roadmap-horizon/ui/components/roadmap-canvas.tsx:66` | `flow` | TK-203 | ReactFlowProvider ve useReactFlow; ilk viewport yerleştirmesi sonrası ready | Proje/provider değişimi veya unmount; Return to Work adapter temizliği | #547 | Sahip uygulandı: `features/roadmap-horizon/ui/components/roadmap-canvas.tsx:62` `ReactFlowProvider`, `:78` `useReactFlow` |
| G6 Canvas ve renderer oturumu | `features/screens/ui/components/canvas-text-overlay.tsx:21` | `draft` | TK-267 | Kontrolsüz textarea; defaultValue ve olaydan commit; render’da ref okuma yok | Enter/blur tek commit; Escape cancel; yeni hedefte yeni overlay | #547 | Sahip uygulandı: `features/screens/ui/components/canvas-text-overlay.tsx:37` `defaultValue`; state yok |
| G6 Canvas ve renderer oturumu | `features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:78` | `opening` | TK-323 | Mount’a bağlı salt okunur snapshot; render’da ref okunmaz | Diagram/view kimliği değişince yeni oturum; refetch yeniden merkezlemez | #547 | Sahip uygulandı: `features/technical-diagrams/ui/components/technical-diagram-canvas.tsx:79` getter ile `openingSnapshot` |
| G6 Canvas ve renderer oturumu | `features/user-flow/ui/components/user-flow-canvas.tsx:269` | `textDraft` | TK-277 | Kontrolsüz Textarea; node/metin kimliği; blur olayından commit | Seçim veya dış metin değişimi; iptal/commit mevcut davranışı korunur | #547 | Sahip uygulandı: `features/user-flow/ui/components/user-flow-canvas.tsx:798` kontrolsüz `Textarea` `defaultValue` |
| G6 Canvas ve renderer oturumu | `features/user-flow/ui/components/user-flow-canvas.tsx:351` | `canvasNodes` | TK-277 | React Flow controlled akış; useNodesState ve model uzlaştırma | Flow oturumu değişimi; model güncellemesi canlı drag/selection/measured bilgisini ezmez | #547 | Sahip uygulandı: `features/user-flow/ui/components/user-flow-canvas.tsx:385` `useReconcileFlowNodes` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/moodboards/ui/components/moodboard-view-tools.tsx:255` | `index` | TK-285 | Sunum oturumu Store | Çıkış/Moodboard değişimi; sıra değişiminde geçerli aralığa getir | #547 | Sahip uygulandı: `features/moodboards/ui/components/moodboard-view-tools.tsx:268` `presentation` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/personal-shell/ui/components/personal-shell.tsx:36` | `surface` | TK-351 | Shell bileşeni/oturumu Store | Shell/Hesap oturumu sonu; aynı oturum kapat-açta korunur | #547 | Sahip uygulandı: `features/personal-shell/ui/components/personal-shell.tsx:37` `navigation` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/project-wall/ui/components/project-wall-outline.tsx:458` | `inspectedId` | TK-292 | Outline yerel Store | İncelemeyi kapatma, kart kaldırılması, duvar değişimi/unmount | #547 | Sahip uygulandı: `features/project-wall/ui/components/project-wall-outline.tsx:467` `inspectedIdStore` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/project-wall/ui/components/project-wall-presentation.tsx:43` | `index` | TK-293 | Sunum oturumu Store | Çıkış/duvar değişimi; sıra değişince geçerli aralığa getir | #547 | Sahip uygulandı: `features/project-wall/ui/components/project-wall-presentation.tsx:45` `presentation` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/project-wall/ui/views/project-wall-view.tsx:112` | `presenting` | TK-296 | Duvar görünüm Store: presentingWallId | Exit/Escape, seçili duvar değişimi, unmount | #547 | Sahip uygulandı: `features/project-wall/ui/views/project-wall-view.tsx:114` `navigation.presentingWallId` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/screens/ui/components/presentation-mode.tsx:30` | `state` | TK-269 | Wireframe sunum oturum Store | Çıkış/unmount veya yeni snapshot/başlangıç oturumu | #547 | Sahip uygulandı: `features/screens/ui/components/presentation-mode.tsx:41` `presentation` |
| G7 Sunum Kipi, gezinme ve inceleme oturumu | `features/spec-change-review/ui/views/spec-change-review-view.tsx:89` | `current` | TK-300 | Diff görünümü Store | Review/revizyon çifti değişimi veya unmount | #547 | Sahip uygulandı: `features/spec-change-review/ui/views/spec-change-review-view.tsx:90` `currentStore` |
| G8 Yerel async adapter ve efekt | `components/youtube-preview-player.tsx:81` | `status` | TK-398 | YouTube adapter yerel Store | Video/origin değişimi, Retry, unmount; player/listener/timeout temizliği | #547 | Sahip uygulandı: `components/youtube-preview-player.tsx:93` `playerSession` |
| G8 Yerel async adapter ve efekt | `features/command-palette/ui/components/command-palette.tsx:103` | `recordsReady` | TK-115 | Palette oturumu Store; mevcut rAF zamanlaması korunur | Palette kapanınca; bekleyen rAF iptal | #547 | Sahip uygulandı: `features/command-palette/ui/components/command-palette.tsx:97` `palette` Store; rAF `:186` |
| G8 Yerel async adapter ve efekt | `features/completion-effects/ui/forms/completion-effects-form.tsx:89` | `previewing` | TK-174 | Önizleme Store; timer ref içinde | Süre sonu, stop, tema/palet veya reduced-motion değişimi, unmount | #547 | Sahip uygulandı: `features/completion-effects/ui/forms/completion-effects-form.tsx:109` `animation`; timer ref `:114` |
| G8 Yerel async adapter ve efekt | `features/documents/ui/components/document-preview.tsx:296` | `rendered` | TK-212 | Mermaid render Store; kaynak başına istek kimliği | Kaynak değişimi veya unmount; eski sonuç kabul edilmez | #547 | Sahip uygulandı: `features/documents/ui/components/document-preview.tsx:297` `diagram` Store |
| G8 Yerel async adapter ve efekt | `features/documents/ui/components/document-preview.tsx:297` | `error` | TK-212 | Aynı Mermaid render Store | Yeni kaynak/render denemesi veya unmount | #547 | Sahip uygulandı: `features/documents/ui/components/document-preview.tsx:297` aynı `diagram` Store |
| G8 Yerel async adapter ve efekt | `features/file-attachments/ui/components/file-attachment-preview.tsx:394` | `loop` | TK-148 | Media yerel Store; deklaratif loop prop ve kontrollü Checkbox | Yeni src/media oturumu; başlangıç false | #547 | Sahip uygulandı: `features/file-attachments/ui/components/file-attachment-preview.tsx:421` `playbackSession` |
| G9 Sürükleme ve onay taslağı | `features/smart-collections/ui/components/project-smart-collections-surface.tsx:564` | `membershipPreview` | TK-223 | Aktif drag useDragOperation; drop sonrası önizleme Store | Cancel, yeni drag, önizleme kapanışı veya Project/View değişimi | #547; zaten yeni dnd-kit API’sinde | Sahip uygulandı: `features/smart-collections/ui/components/project-smart-collections-surface.tsx:508` `useDragOperation`, `:625` `membership` |
| G9 Sürükleme ve onay taslağı | `features/unified-calendar/ui/components/unified-calendar.tsx:732` | `draggedDate` | TK-193 | Aktif drag dnd-kit source; Date Picker/onay için ayrı taslak Store | Cancel veya başarılı uygulama, Work/alan/revizyon değişimi; hata taslağı silmez | #549 (uygulama); #547 (yalnız ortak sözleşme) | Sahip uygulandı: `features/unified-calendar/ui/components/unified-calendar.tsx:566` `useDragOperation().source`, `:625` `draftStore` (#549) |
| G9 Sürükleme ve onay taslağı | `features/unified-calendar/ui/components/unified-calendar.tsx:733` | `previewDate` | TK-193 | Aktif drag dnd-kit target; onay için aynı taslak Store | Drag cancel, onay iptali/başarısı veya taslak kimliği değişimi | #549 (uygulama); #547 (yalnız ortak sözleşme) | Sahip uygulandı: `features/unified-calendar/ui/components/unified-calendar.tsx:566` `useDragOperation().target`, `:625` `draftStore` (#549) |
| G10 PDF adapter (S-PDF) | `features/file-attachments/ui/components/file-attachment-pdf.tsx:52` | `loadedPages` | TK-147 | PDF adapter Store: numPages; Document suspense=false | Asset/sürüm/pageCount/retry oturumu değişimi | #547 + #556 (S-PDF) | Bekliyor (#556): `features/file-attachments/ui/components/file-attachment-pdf.tsx:52` hâlâ `useState` |
| G10 PDF adapter (S-PDF) | `features/file-attachments/ui/components/file-attachment-pdf.tsx:53` | `renderedPages` | TK-147 | PDF adapter Store: render nesline göre sayfa kimlikleri kümesi | Asset/render nesli değişimi; aynı sayfa callback’i iki kez sayılmaz | #547 + #556 (S-PDF) | Bekliyor (#556): `features/file-attachments/ui/components/file-attachment-pdf.tsx:53` hâlâ `useState` sayacı |
| G10 PDF adapter (S-PDF) | `features/file-attachments/ui/components/file-attachment-pdf.tsx:54` | `failed` | TK-147 | PDF adapter toplu hata Store; tek alert ve Retry korunur; Page onLoadError dahil | Asset/sürüm veya Retry; Document suspense=false | #547 + #556 (S-PDF) | Bekliyor (#556): `features/file-attachments/ui/components/file-attachment-pdf.tsx:54` hâlâ `useState` |
| G11 Secret (S-Secret) | `features/link-sharing/ui/components/link-sharing-surface.tsx:34` | `issued` | TK-354 | Share surface özel bellek Store; token cache/persist/debug/log dışında | Root/Project/Hesap değişimi, revoke, rotate/reshare, kapanış/unmount; geç/eski sonuç atılır | #555 (S-Secret); #544 güvenlik kısıtı | Bekliyor (#555): `features/link-sharing/ui/components/link-sharing-surface.tsx:39` hâlâ `useState` |

## 17. check:conventions için mekanik kural adayları

| Kural | Tarif | Yanlış pozitif riski ve istisnalar |
| --- | --- | --- |
| React state | Üretim TypeScript/TSX’te React importu, alias ve namespace üzerinden `useState`/`useReducer` çağrılarını AST ile denetle. | Düşük. shadcn üretimi dosyalar için kaynakla doğrulanmış dar liste. Test ve üretilmiş dosyalar dışarıda. Addan bağımsız özel state, context ve ref yaşam döngüsü için elle inceleme gerekir. |
| Query kullanımdan kalkan yöntemler | Sembolü QueryClient’a çözerek `fetchQuery`, `ensureQueryData`, `prefetchQuery` ve infinite eşlerini sürüm tabanlı denetle. | Düşük. Aynı adlı başka sınıf/yardımcı ve farklı Query sürümü istisna. |
| Store okuyucu alias’ı | `@tanstack/react-store` ve `@tanstack/react-form` kaynaklı deprecated `useStore` import ve re-export'unu yakala. | Düşük. Başka kütüphanenin aynı adlı API’si ayrı. |
| Legacy sürükleme | Üretim ürün kodunda `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` source importlarını yasakla; aynı dosyadaki native sürükleme olaylarını inceleme notu yap. | API importunda düşük, native olayda yüksek. React Flow, Konva, dosya bırakma ve OS/web yerleşik adaptörleri ayrı değerlendirilir. |
| Ortak taze okuma | `queryClient.query` seçeneklerinde doğrudan `staleTime: 0` veya `gcTime: 0` gördüğünde tanımlı ortak yardımcının dışında inceleme notu üret. | Orta. Tazelik ve cache ömrü farklı. Meşru kısa ömürlü hassas önizleme için kayıtlı seçenek. |
| Cache kapsamı | Argümansız `invalidateQueries()` ve elle dizi Query key’e inceleme notu ver. | Orta. Oturum geçişi veya bütün workspace’i etkileyen mutasyonlar; oRPC anahtarına Account scope ekleyen bilinçli adaptör ve RPC dışı kaynaklar. |
| Zamanlayıcıyla yoğun iş | Aynı closure içinde zamanlayıcıyı sıfırlayıp tekrar kuran adayları inceleme notu yap. | Yüksek. Gerçek zaman aşımı, saat, odak/çizim ve platform retry zamanlaması meşru; Pacer gereksinimi davranışla doğrulanır. |
| Manifest kullanımı | AST import sayılarını workspace başına üret, CLI/script, config, generated asset, framework/peer, tip ve yalnız test tüketicisini ayrı say. Sıfırı inceleme notu yap. | Orta/yüksek. String config, CSS import, worker asset, tool binary ve transitive tipler otomatik “kaldır” kararı verdirmez. |
| Var olan sınır kuralları | Mevcut ham fetch, Clipboard API, process.env ve Form denetimlerinde sözleşme kapsamı ile AST kapsamının ayrışmasını gözden geçir. | Web RPCLink, Hono platform yolları, env girişi ve DB yerel bağlantı kararı açık istisnaya bağlı. |

## 18. Düzeltmeler için önerilen issue grupları

Büyüklük **S/M/L**, planlama için tahmindir. Yüksek bulgular varsa ilk sıradadır.

| Grup | Kapsam ve etkilenen dosyalar | Bağımlılık | Boyut |
| --- | --- | --- | --- |
| Tipli iş hatası ve güvenli RPC yanıtı | apps/server/src/app.ts, packages/api/src/routers/index.ts, ilgili domain error ve istemci hata yardımcıları. TK-002, TK-105, TK-254 | oRPC 1.16.3 .errors(), isDefinedError, güvenli support envelope ve 03/30/43/78/81 seam’leri | L |
| Ortak yazma, idempotency ve cache sözleşmesi | apps/web/src/utils/orpc.ts, Client Shell MutationCache, doğrudan React RPC yazmaları, Work Template çağrıları ve bütün cache’i yenileyen yazmalar. TK-103, TK-376, TK-104, TK-107 | Online-only, Update required, ADR-0004, mutationOptions, Query variables ve prosedür key’leri | L |
| Ortak taze okuma ve form hata iletimi | apps/web/src/lib/fetch-current-work.ts, mutation-messages.ts, Planned Test ve Test Gap yardımcıları, taze önizleme çağrıları. TK-377 | Query 5.108 query(), TanStack Form setErrorMap, Zod ve kısa ömürlü cache sözleşmesi | M |
| Base UI popup sahipliği | packages/ui dialog/alert-dialog/sheet export’ları ve 13. bölüm Base UI satırları. Önce eylem popup’ları ve başarısız yazma durumunda açık kalması gereken formlar. | Base UI actionsRef ve createHandle, payload ve focus yönetimi | M |
| Router ve state eşlemesi | Dosya ve değişkenler 13. bölüm Router, Store ve Türetilen gruplarında. Project Documents, Record Discovery, Daily Focus, Calendar ve paylaşılan filtreler öncelikli. | Spec’in URL kalıcılığı ve gizlilik kuralları, Router validateSearch, Store | L |
| Arama, yoğun etkileşim ve sıralama | Kayıt Keşfi, Mermaid dönüşümü, eklenti araması, Wireframe/Moodboard resize ve eski sürükleme kullanan Backlog/Calendar/Moodboard. TK-003, TK-048, TK-044, TK-188, TK-196, TK-069 | Pacer Lite, Query iptali; dnd-kit sensörler ve yazma geri alma sözleşmesi | L |
| Büyüyen liste ve veri tabloları | Bildirim Merkezi, Export önizlemesi, Work, Project ve Archive listeleri; 12. bölümün ilgili spec’leri. | Table v9 özellikleri, Virtual öğe kimliği ve değişken ölçüm, klavye erişimi | L |
| Sahipsiz state, rate limit ve analytics kararları (#553) | 13. bölümün 56 Sahipsiz satırı ve 16. bölüm başlıkları. Karar kaydıdır; düzeltmeler 16.1’de #547, #545, #549, #555 ve #556’ya yönlendirildi. Rate limit ve analytics için yeni issue yok. | Kullanıcı onayı 2026-11-19; owning spec Testing Decisions seam’leri | S |
| Bağımlılık temizliği | 15. bölümdeki kaldırma adaylarının ayrı manifestleri. | Workspace build ve tip kontrolü, peer ve tool zinciri | S |

## 19. Kapsam, örneklem ve doğrulanamayanlar

- Denetim statik. Backend, Neon, tarayıcı, Tauri ve eklenti runtime’ı, yayınlama ve migration çalıştırılmadı.
- Spec/katman incelemesi: dokuz spec grubu ve üç ortak/sunucu/platform grubu. GPT-6.2 Sol medium ve Claude Opus 5.5 medium altışar grup. Bağımsız gözden geçirme: GPT-6.2 Sol high.
- Güncelleme ajanının bire bir son listesi verilmedi. PR #542 öncesi kaldırılan `docs/dependency-upgrade-validation.md` ve `docs/dependency-upgrade-research.md` Git geçmişinden okundu; upgrade diff, kurulu tipler ve yayımlanan belgelerle kalan üretim çağrıları yeniden arandı.
- PR #540: düzeltilen validasyon/form dönüşümleri yeniden taranmadı. Açık tazelik bulgusu ve kopya helper bakım notu teyit edildi. Planned Test ve Test Gap FormParse tipleri iki ayrı dosyada var; doğrulanmış teknoloji ihlali toplamına alınmadı. Wiki, Build in Public ve Release Note yayın uçlarının üretim web çağıranı doğrulanmadı; bağlanmamış ürün akışları toplam dışında. Önce uyumlu sayılan hata ve logo state’i 13. bölümde.
- 66–85 aralığındaki spec’lerin bir kısmı yalnız port, adaptör veya sözleşme içeriyor. İlgili spec satırları beklenen teknolojiyi gösteriyor. Henüz kurulmayan ürün davranışı ihlal sayılmadı.
- Sunucu grubu mekanik adayları tek tek sınıflandırdı. İlişkili 67 şema dosyası ve aday üretmeyen server feature yolları örneklemle incelendi. Erişim kontrolü bulgularında statik olarak izlenebilen veri ve yetki sınırı kaydedildi.
- macOS release iş akışında iki doğrulayıcı import yolu eski konumu işaret ediyor (`.github/workflows/macos-release.yml:363,904`). Bu kullanım denetiminin dışında bir workflow bağlantısı adayı olarak kaydedildi.
- Çapraz kontrol örneklemi. Başlangıç değeri `a548a2c8`, yöntem Sort all full paths in specs.json by ascending raw SHA-256 digest of UTF-8(seed + NUL + full path), then take the first 10. No candidate data in selection.. Spec’ler: 38-decisions, 54-test-report-acceptance, 13-tags, 33-record-discovery, 66-production-incidents, 02-account-preferences, 24-external-handoffs, 09-work-lifecycle, 79-data-export, 32-personal-wiki.
  - {"spec": "38-decisions", "note": "Project Decisions ve Decision chain, Project source-record oRPC/Drizzle sınırını ve mevcut Zod/Form editörlerini kullanıyor. Project listesinin bütün kayıtları ve zincir panelinin bütün nesilleri DOM’a taşıması REV-1."}
  - {"spec": "54-test-report-acceptance", "note": "Üç ingress aynı sunucu/Zod kabul modelini kullanıyor; manuel Form dizisi mode=\"array\" ile bağlı. Test Sessions görünümünün birikimli oturumlar ve büyük Session Test gruplarını mount etmesi REV-2."}
  - {"spec": "13-tags", "note": "Workspace sözlüğü ve atomik rename, Documents token sınırını koruyor. Sunucuya giden gerçek kayıt filtresinin Table modeli dışında olması REV-3. Undo’nun her yürütmede yeni kimlik üretmesi REV-4."}
  - {"spec": "33-record-discovery", "note": "Yetkilendirilmiş Search ve hazır dizinler ortak sonuç renderer’ını paylaşıyor. Table v9 satır modeli mevcut; hem Search/indeks hem Table için bütün kayıtların mount edilmesi REV-5 ve REV-6. Search seçimleri geçici."}
  - {"spec": "66-production-incidents", "note": "Liste ve Follow-up preview bulguları mevcut adaylara karşılık geliyor. Incident edit/link Form, ayrı source-record mutasyon sınırı ve previewFingerprint onayı incelendi. Status gruplaması kullanıcı tarafından değiştirilen bir satır filtresi değil."}
  - {"spec": "02-account-preferences", "note": "Form + Zod kaydı, hesap kapsamlı Query, ortak appearance Store ve date-fns/Intl biçimlendirme incelendi. Native Intl’in locale/timeZone/numara ve tarayıcı önerisi işleri için yeni stack bulgusu yok."}
  - {"spec": "24-external-handoffs", "note": "Work-owned Handoff/History ve uzlaştırma formu için mevcut bulgular geçerli. Proje yetkisini yeniden doğrulayıp sadece okuyan Preview changes çağrısı MutationCache’e gittiği için REV-7."}
  - {"spec": "09-work-lifecycle", "note": "Project Work, Scope Tree, Create, Merge/Undo, Recreate ve Close yolları incelendi. Yazma kimliği ve liste/önizleme sorunları mevcut bulgu gruplarında; ayrı yeni kök bulunmadı."}
  - {"spec": "79-data-export", "note": "Closed-world preview ve confirm/produce ayrımı, Papa Parse CSV ve JSON serializer’ı incelendi. Mevcut 10.000 satırlık Virtual grubu dışında salt okunur preview’nun Query sahibi olmaması REV-8."}
  - {"spec": "32-personal-wiki", "note": "/personal-wiki, hash seçimini alıp projectId:null ile aynı DocumentsSurface’i kullanıyor. Ayrı veri/yazma yolu yok. Paylaşılan Documents navigation listesi Wiki içinde de bütün kayıtları mount ediyor; REV-9 Documents sahibiyle ele alınmalı."}
- Bağımsız aday kararları: gerçek 298, yanlış pozitif 12, önem farklı 94. Ana ajan ayrı sözleşme veya kod yorumu olanları yeniden okudu.
- Uzlaştırma: 12 aday çıkarıldı. Önerilen önem farklarının 45 tanesi kabul edildi; 49 tanesinde kodda doğrulanan etkiyle ilk derece korundu. 8 yeni kök eklendi, Tag Undo yeni konumu mevcut retry köküne bağlandı. Bağımsız state hedefi önerilerinden tam görünüm Presentation Mode, satır içi Decision seçimi ve doğrudan Work Status eylemi gerçek UI sınırına göre ayrıca değerlendirildi.
- Bağımsız inceleme sınırları: Kaynak HEAD a548a2c810b0f51e4cdee7024fe6764161a80841. 12 batch, 404 benzersiz aday, 281 React state grubu ve 715 satır. Atlanan aday: 0. Salt okunur statik inceleme. Backend, veritabanı, test, aktivite tekrar üretimi veya dağıtım denetimi çalıştırılmadı. Buradaki önem kaynakta gösterilen etkiye dayanır; canlı boyut ya da gecikme ölçümü yapılmadı. State grupları özellik ve hedef düzeyinde değerlendirildi. JSX, hook dönüşü, olay girdisi veya render koşulu için sembol konumları doğrulandı. Modül latch’i AuthRouteErrorView canRetry render yolunda teyit edildi. packages/ui shadcn carousel, sidebar ve sidebar use-mobile helper’ı kapsamdaki adaylar arasında değil. Üretilmiş route tree, migration ve shadcn istisnaları envantere eklenmedi. S6-1 ve spec-2-8, her çağrının aynı düzeltmeyi alacağı anlamına gelmez. Salt okumalar ve online/update-required/idempotency ya da birden çok adım sağlayan sarmalayıcılar için öneri ve konumlar ayrıştırılmalıdır. Kullanılmayan bağımlılık kararları kaynak/config/test metni, mevcut declaration çıktısı ve paket bağımlılık kenarlarına dayanır. Kaldırma sonrası kurulum/build bu salt okunur denetimde çalıştırılmadı. Örnekleme yalnız 10 seçilmiş spec için ek keşif sağlar; bulunamayan sorunların olmadığına dair tüm-repo garantisi vermez. REV-4 mevcut retry köküne ek konum, REV-9 paylaşılan Documents köküdür. Deprecated sınıfında karşılaştırılacak aday yok. Seçilen üretim UI yollarında araştırılan useStore, fetchQuery, ensureQueryData ve prefetchQuery çağrısı bulunmadı; başka API’ler için kapsamlı deprecation taraması yapılmadı.

| Mekanik aday | Çağrı veya kullanım |
| --- | ---: |
| `useState` | 720 |
| `useReducer` | 0 |
| `fetch` | 5 |
| `setTimeout` | 16 |
| `clearTimeout` | 20 |
| `setInterval` | 5 |
| `table-markup` | 8 |
| `sort` | 1 |
| `filter` | 8 |
| `draggable` | 6 |
| `onDragStart` | 3 |
| `onDrop` | 0 |
| `legacy-dnd` | 8 |
| `useMutation-inline` | 182 |
| `mutationOptions` | 3 |
| `queryKey-array` | 15 |
| `invalidateQueries-array` | 0 |
| `fetchQuery-stale0` | 0 |
| `query-stale0` | 12 |
| `new ORPCError` | 670 |
| `errors` | 0 |
| `navigator.clipboard` | 2 |
| `process.env` | 5 |

### Bulgulara dönüştürülmeyen karar noktaları

- Davranış düzeyinde ayrı not. Form alanının sahibi zaten Form; seçim güncelleme politikasını doğrulamak spec davranışı incelemesi. Aynı arama yolunun teknoloji bulgusu desktop-extension-1.
- PR #540 açık notu doğrulandı. Çağıranı bağlı olmayan yayın akışı henüz uygulanmamış özellik, teknoloji ihlali değil.
- GitHub callback dış parametre isimlerini ve kimlik dönüşümünü yöneten şekil; validateSearch fonksiyon API olup, Zod 4 Standard Schema desteği fonksiyon kullanımını deprecated kılmaz. Dış callback olduğu için ayrı adaptasyon meşru.
- Tema Store kalıcı hesabı Query yerine verinin sahibi yapmıyor; mevcut PreferenceProvider çıktısından document temasını ve oturum öncesi tercihleri eşitleyen adaptasyon. Gerçek çift sahipliği ve dal uyuşmazlığı daha güçlü kanıt gerektiriyor.
- Aday kaynaklar için üretimdeki fiilî render sınırı ve etki kanıtı grup sonucunda düşük güven. Bölüm 19 adayı.
- Last saved kapsamı ürün eksikliği; MutationCache mevcut, runOnlineOnlyWrite ve runWrite’ın ayrı sorumlulukları var. Her RPC başarısı aynı kayıt olayını temsil etmiyor.
- Provider varsayılanı yanlış locale/zaman dilimi gösterebilir; sorun tercih değerinin bağlanmaması, seçilmiş kütüphane sınırının atlanması değil.
- Sonner zaten bildirimin sahibi; görünür kapatma eksikliği ürün davranışıdır.
- İstemci önce tipli reasonCode okuyor. Sorun yalnız zarf bulunmadığında çalışan sınıflandırma fallback’inin doğruluğu; öngörülen hata sahibi zaten kullanılmış.
- Başlıktaki değişiklik gereksiz projection tetikliyor. Sonuç görünümünün ilgilendiği alanları seçmek doğru Form/türetim sınırı; her başlık girişini geciktirme ihtiyacı kanıtlanmamış.
- Aktif oturum listesi mevcut tarayıcı/cihaz oturumları ve expiry ile daralıyor; büyüyen kalıcı kayıt davranışı veya ekran ölçeği gösterilmedi.
- Query MutationScope zaten serileştirme sahibi; paralel Promise kuyruğu kaldırılabilir tekrar, seçilmiş sahibi atlamıyor.
- Anahtarlar oRPC anahtarından türetiliyor ve oRPC öneki korunuyor; accountId eklemek gerçek önbellek ayrımıdır. Tekrarlanan genişletme yardımcıya taşınabilir.
- Her iki form da Zod parse kullanıyor; yinelenen FormParse tipi ve ilk issue seçimi §7 bakım notu, Form/Zod bypass kanıtı değil.
- queryOptions().queryKey oRPC tarafından üretilmiş geçerli prosedür anahtarıdır; yan etki veya el yapımı anahtar yok.
- FormParse ve ilk Zod issue/varsayılan metin tekrarı bakım notu; basit fallback’ler tek başına iş hata sözleşmesi bypass’ı göstermiyor. Tipli hata kökü SERVER-2 kapsamında.
- İsteğe bağlı servis guard’ları yetki veya sahiplik middleware’i değil; §6.1 bunları middleware’e taşımayı şart koşmuyor. 500/501 tutarsızlığı bakım konusu.

### Örneklem ve ortam sınırları

- **spec-1:** 05: useFounderCommandPaletteSource varsayılan olarak boş; 15.000 kayıt yalnız referans modunda. Üretime bağlı içerik araması olmadığı için tuş başına kaynak taraması/Pacer ihlali yazılmadı. Render sınırı grup başına en çok 50, iki grup beraber en çok 100; Virtual ihlali yok.
- **spec-1:** 06: Sequential triage oturum başlangıcındaki listenin referansını tuttuğu için çözülen kaydı geri gezmede de gösterebiliyor. Yalnız kimliklere geçiş bu davranışı karşılamıyorsa tutulacak sınırlı snapshot kapsamı ürün kararıdır.
- **spec-1:** 05: İlk paint sonrası sonuç montajını geciktiren recordsReady için stack sahibi kararlaştırılmamış. requestAnimationFrame üzerindeki odak çağrısı kabul edilen bir platform işidir.
- **spec-1:** 01: Uygulama içi OAuth hız sınırının sağlayıcı/sahip seçimi merkezde; Account Access server kapsamındaki bulgular burada tekrarlanmadı. Üretim dağıtımı veya kural konfigürasyonu sınanmadı.
- **spec-1:** 7. bölüm: Mevcut grupta ilk Zod hata mesajı ve yedek metin tekrarı Capture Inbox satır 134/173 ile Project Create satır 122’de doğrulandı. Short code satır 34 null’a düşüyor. Ortak helper tek başına bağlayıcı 6. bölüm API şartı olmadığı için ayrı ihlal sayılmadı. FormParse iki tanımı test-gaps ve planned-tests sahiplerinde. Yayın prosedürlerinin tüketicileri kendi gruplarında.
- **spec-1:** Auth transport: login ve Confirm GitHub Identity native Tauri handoff fetch’leri Hono /api/auth code-exchange sözleşmesinde, Better Auth bootstrap taşımaları olarak değerlendirildi. Ürün verisinin oRPC sınırını atladığına dair kanıt yok. GitHub kimlik popup yoklaması yalnız Window.closed değerini okuyor; canlı sunucu sorgusu değil.
- **spec-1:** 07: Board/List bir route görünümü olduğu için Router search hedeflendi. Configuration Mode içinde Project areas açılış varsayılanı spec’te sabit ve host seçiminin URL’de saklanması istenmiyor; Store hedeflendi.
- **spec-1:** 09: Work merge/recreate açık/kapalı state’i inline panelde. Base UI hedefi için inline Collapsible seçeneği ile gerçek Dialog’a geçmenin UX kararı ayrıdır; hata durumunda form mevcut konumda kalır.
- **spec-2:** file-attachment-location-form.tsx:108 submitAction useRef ile Preview/Bind ayrımı 6.3 'onSubmitMeta' kalıbına uymuyor; ancak dosya PR #540'ta değiştirilmiş (M) olduğundan Form uyumu yeniden taranmadı → bulgu yazılmadı, kullanıcı/ana ajan kararı.
- **spec-2:** Video.js React 10.5: hız (playbackRate) player store'unda PlaybackRate UI'ı ile sahiplenebilir; loop için Video.js özelliği bulunamadı. speed/loop'un Video.js'e taşınması mı yoksa native prop olarak sahipsiz mi kalacağı kullanıcı kararı.
- **spec-2:** work-context-card.tsx copyState/copyError: istemci içi async işlem için TanStack Query useMutation kullanımı stack'te 'sunucu verisi' sahibine uymuyor; sahipsiz kaydedildi.
- **spec-2:** Satır içi (dialog olmayan) onay/düzenleme hedefleri (priority-metric-editor trashTarget/deleteTarget/editingId, work-template-editor instantiating) için Store mu (useCreateStore) Router search mu gerektiği tanımsız; Store önerildi.
- **spec-2:** priority-map.tsx useQueries ile 'Show evidence signals' açıkken her Work için ayrı workContext isteği (N istek); stack sahibi doğru (Query), toplu okuma endpoint'i ürün/sunucu kararı.
- **spec-2:** tagRecords ve projectBacklogOrder sunucu uçlarının limit/sayfalama davranışı bu grupta doğrulanmadı (server grubu); Virtual bulgularının güveni bu yüzden orta.
- **spec-2:** spec-2-9 idempotency: sunucu tarafında aynı payload için yeni anahtarla çift oluşturmanın gerçekten mümkün olduğu (fingerprint dedupe yokluğu) statik olarak server grubunda teyit edilmeli.
- **spec-2:** runOnlineOnlyWrite ile MutationCache.onMutate offline kapısı çakışıyor; mutationOptions'a geçişte runOnlineOnlyWrite'ın yeri ortak karar (spec-2-8).
- **spec-3:** 6.8 sınırı: Calendar Agenda’nın scope/kind/date filtresi Calendar projection’a ortak, Agenda sırası da sabit kronolojik. Kullanıcı tarafından değiştirilen ayrı kayıt tablosu olup olmadığı net değil. Virtual bulgusu görünür Work büyüklüğünden bağımsız doğrulandı.
- **spec-3:** Roadmap named-view membership ve Research/Feature rolü packages/api/src/roadmap-horizon.ts ürün projeksiyonundan geliyor. Kullanıcının filtreleri için iç Table row modeline ihtiyaç kararı, ürün filtresi ve canvas/list ortaklığı ayrıştırılarak verilmeli; ayrı bulgu sayılmadı.
- **spec-3:** Project Roadmap selection’ın URL’ye alınması için §6.5 kullanıldı. docs/tech-stack.md Project viewport store’unun cross-session restore yapmaması şartı korunmalı; sunucuda named view kayıtları zaten Query’de.
- **spec-3:** Pacer-lite asenkron kuyruk garantisi taşımaz. Bulk Edit’in dört işçi, commit/cancel ve tarayıcıya yield akışı özel bileşik işlem. Kapasite ölçümü ya da kalıcı job gereksinimi doğrulanmadığı için pg-boss/Pacer ihlali sayılmadı.
- **spec-3:** 41 inline mutation kaydının 39’u tek prosedür standardizasyonunda bulunuyor. Calendar Undo (güncel read + write) ve Roadmap placement (alternatif prosedürler, ortak retry) meşru bileşim olarak incelendi. Online-only wrapper gerekiyorsa orpc.x.mutationOptions() çıktısındaki üretilmiş mutationFn’i sarmak mutationKey ve operation context’i koruyan yol.
- **spec-3:** Sahipsiz: render eden saat tick’leri, Completion Effects örnek animasyon evresi, Clipboard sonuçları, React Flow instance readiness, Calendar Date Picker onay taslağı için stack’te zorunlu render sahibi yok. İki komut anahtarı render dışı useRef ile tutulabilir.
- **spec-3:** PR #540 first-issue/fallback ortak köküne ait bu grupta 5 doğrulanmış konum: start-handoff-form.tsx:80, handoff-return-form.tsx:52, cancel-handoff-form.tsx:43, not-now-entry-form.tsx:79, roadmap-view-form.tsx:109. Grup dışında kullanılan ortak birleştirme için referans. FormParse ve sayılan yayın uçları grupta yok.
- **spec-3:** Kurulu sürüm doğrulaması bun.lock ve ilgili paket tiplerine dayanır. Güncelleme ajanının ayrı deprecated API listesi sağlanmadı; dış kaynak karşılaştırması yapılmadı. Bu kapsam içinde fetchQuery/ensureQueryData veya Store useStore çağrısı bulunmadı.
- **spec-4:** runOnlineOnlyWrite ile sarılan veya birden çok çağrı birleştiren satır içi `useMutation({ mutationFn })` (document-create-form:82, document-editor-form:226/294/306/425/461/574, document-conflict-drafts:127/184, document-transfer-form:174/213, smart-collections surface:333 ve create-form:138) 6.1 “gerekçeli durum” sayılır mı; ortak `onlineOnlyMutationOptions` yardımcısı stack kararı.
- **spec-4:** Kayıt Keşfi Search diyaloğu global (route’a bağlı değil); filtre/sorgu/görünüm state’inin Router search mı Store mu olacağı kullanıcı kararı (document-discovery 257/458-464/602-603).
- **spec-4:** Satır içi editör modları (project-decisions-panel:53, project-goals-view:38, project-risks-view:36, decision-supersession-controls:30) popup değil; Router search veya Base UI Collapsible seçeneği — sahipsiz işaretlendi.
- **spec-4:** Mermaid async render (document-preview:296-297) yerel hesaplama; Query yalnız sunucu verisi tanımlı, sahipsiz işaretlendi.
- **spec-4:** Spec 33 #268 metni preview hedefinin “component state” ile tutulduğunu söylüyor; createHandle düzeltmesi spec metnini de değiştirir.
- **spec-4:** record-table tableRecords sorgusunda sunucu limiti bulunamadı (packages/api/src/record-discovery.ts, server record-discovery); Table satırları sınırsız büyüyebilirse TanStack Virtual gerekir — kanıt eksik, bulgu yazılmadı.
- **spec-4:** use-record-table-writes.ts:22/30 yazmaları `runOnlineOnlyWrite` olmadan çağırıyor (diğer feature yazmaları Client Shell kapısından geçiyor); stack satırı değil Client Shell sözleşmesi — sunucu/desktop grubu veya kullanıcı değerlendirmesi.
- **spec-4:** CONFLICT tespiti `"code" in error && error.code === "CONFLICT"` ile yapılıyor (decision-editor-form:64, decision-supersession-controls:84, risk-form:75, project-risks-surface:66, project-goals-surface:74); `.errors()` + `isDefinedError` sunucu tarafında hiç tanımlı değil → sunucu grubunun `.errors()` bulgusuna bağlı.
- **spec-4:** visual-changes-tour:48 imperatif viewport turu; Store hedefi önerildi, brief’e göre sahipsiz sayılması da savunulabilir.
- **spec-5:** Sahipsiz render state: Canvas resize ölçümü, Moodboard canlı kamera hareketi, Screen/Moodboard Presentation Mode gezinmesi, Wireframe DOM text overlay ve React Flow canlı node adapter state. Bunlar React state kuralında kalıyor; canlı renderer yerel durumunun sahibi için stack kararı gerekir. DOM overlay ayrı bir açık izin.
- **spec-5:** TanStack Store 0.11.2 useCreateStore callback overload’u salt okunur derived store; Wireframe editor/session factory için doğrudan initializer olarak önerilmedi. Scope içinde bağımsız store kimliği ve mevcut engine command sözleşmesi korunmalı.
- **spec-5:** Feedback ilişkili kayıt ve Research Evidence Flow cache’i için ayrı anahtar ile fresher iç okuma arasında fark var. Yetkisiz veri erişimi veya dışa aktarım gösterilmedi.
- **spec-5:** Kapsam içindeki formlarda PR #540 ilk Zod hatası/yedek metin tekrarı devam ediyor. Repo genelindeki tek helper kararı parent ile gruplanmalı. İki FormParse tanımı planned-tests ve test-gaps sahibi, üç publish consumer kontrolü bu grup dışında.
- **spec-5:** Evidence role UI, belge pin editörü ve genel Table/Search yüzeyi komşu feature sahiplerinde. Egress ağ dağıtımı, gerçek YouTube bağlantısı, Consent/Contact authorization ve snapshot server doğruluğu bu grubun statik web incelemesinden teyit edilemez.
- **spec-5:** Cross-feature import sınırı: evidence-flow-panel kullanımı Assumption, Decision ve Work’te, research-binding-feedback Research Sessions notlarında. structure.md Evidence ve Feedback UI deviasyonlarını zaten kaydediyor. Parent ortak taşıma durumunda tek sahip kaydı tutmalı.
- **spec-6:** spec-change-review-surface.tsx:38 (markSpecChangeReviewCandidate) ve :74 (createSpecChangeReviewFollowUp) ile kişisel viewport kayıtları runOnlineOnlyWrite kullanmıyor; recordSuccessfulSave çağrılmadığı için spec 03 'son başarılı kayıt zamanı' güncellenmeyebilir. runOnlineOnlyWrite stack sahipliği değil client-shell sözleşmesi; bulgu değil, ortak/web-macos-client grubu ve kullanıcı kararı.
- **spec-6:** runOnlineOnlyWrite'ı mutationFn içinde sarmalayan inline useMutation'lar (technical-diagrams surface 60/83/118/139/147/155/171/189/205, diagram-authority-conversion-form:115, diagram-view-form:31, new-technical-diagram-form:53, change-draft:103) 6.1'deki 'gerekçeli mutationFn' kapsamında mı: mutationOptions + mutationFn override mı tercih edilmeli, kullanıcı/stack kararı.
- **spec-6:** project-wall-outline.tsx:458 inspectedId ve project-wall-scene.tsx:52 selection: denetim tablosu 'seçili kayıt' için Router search diyor, spec 51 ise seçim ve incelenen kartın asla kalıcılaştırılmayıp geri yüklenmeyeceğini söylüyor; selection Store, inspectedId sahipsiz yazıldı.
- **spec-6:** routes/_auth/projects/$projectId/schema-artifacts.tsx validateSearch elle typeof kontrolü yapıyor (6.5 Zod .catch kuralı); dosya bu grubun .files listesinde değil, sahibi olan gruba atıf.
- **spec-6:** Tests alanı listeleri (oturumlar, açıklar, değerlendirmeler, handoff'lar) sınırsız büyüyebilir mi: spec rapor limit kapakları tanımlıyor ama Proje başına toplam üst sınır yok; sanallaştırma eksikliği kanıtlanmadı, bulgu açılmadı.
- **spec-6:** test-review-supersedes-form.tsx:32 notice için form.reset() sonrası isSubmitSuccessful'ın korunup korunmadığı TanStack Form 1.33.5'te çalıştırılarak doğrulanmadı.
- **spec-7:** Project Activity tüm yüklü sayfaları render ediyor; mevcut veritabanı bağdaştırıcısı kaynak başına PROJECT_ACTIVITY_SOURCE_WINDOW=2000, Story Timeline kaynak sorguları MAX_EVENTS_PER_KIND=500 ile sınırlı. Yüksek sabit tavanların §6.9 içinde sayılacağına dair eşik yok. useWindowVirtualizer pratik iyileştirme adayı; bu iki yüzey için ayrı kesin Virtual bulgusu sayılmadı.
- **spec-7:** Closure Summary aday listesi altı türde tür başına 500 ile sınırlı (selection katmanının ayrı sınırı var). GitHub Record Search en çok 200 sonuç; Production Incident aday seçimleri tür başına 500. Release Evidence Pack kontrol listesi de en çok 200 öğe. Büyük sabit liste ve native select sanallaştırma sınırı için ürün/performans kanıtı ayrıca gerekli.
- **spec-7:** Release Communication ziyaretçi changelog/yayımlama ve Work Automation web kapsamı mevcut sunucu yüzeyiyle karşılaştırıldı. PR #540 kapsamındaki yayın çağıranı yokluğu açık kalıyor; erişilebilir üretim UI akışı olmadan spece dayalı teknoloji bulgusu sayılmadı.
- **spec-7:** Production Incident datetime-local dönüşümü feature lib içinde Intl tabanlı ofset hesabı kullanıyor. date-fns doğrulaması mevcut; DST boşluğu/tekrarında kabul ve ayrıştırma davranışı spec içinde tanımlanmamış. @date-fns/tz lockfile’da transitif; doğrudan app bağımlılığı veya kanonik IANA duvar saati dönüşümü kararı yok. Bu sınır ayrı teknoloji bulgusu olarak sayılmadı.
- **spec-7:** GitHub reconnect/disconnect önizlemesi satır içi açılır panel. Modal AlertDialog/Dialog handle yaklaşımı alternatif; satır içi görünümü koruma kararı verilirse Base UI Collapsible uygun. Her iki yol için satır seçim payload ve kaydetme sonrası odak korunmalı.
- **spec-8:** runOnlineOnlyWrite sarmalı inline `mutationFn` (spec-8'de notification-center 4 + public-roadmap-review 1 useMutation-inline adayı; repo genelinde 90 dosya): 6.1 `mutationFn` içinde client çağrısını yalnız gerekçeli durumda kabul ediyor. Çevrimdışı guard gerekçe sayılır mı, yoksa mutationOptions + MutationCache onMutate guard'ı yeterli mi — ortak/desktop (web-macos-client) grubu kararı; bu grupta bulgu yazılmadı.
- **spec-8:** Satır içi onay/inceleme panelleri (move-to-trash-form, permanently-delete-form, redact-form, export-preview-panel, share-lifecycle ConfirmGroup, remove-surface-control, build-in-public unpublish) başlığa odak + Escape ile diyalog davranışını elle taklit ediyor. Base UI AlertDialog'a geçmek mi, satır içi kalıp açık/kapalıyı sahipsiz saymak mı: kullanıcı kararı. State satırlarında base-ui önerildi.
- **spec-8:** Secret taşıyan state'ler Query'ye taşınırken: link token (`issued`) ve redaksiyon `sensitiveValue`. Global MutationCache onError retry'ı `mutation.state.variables`'ı tutuyor (web-macos-client/lib/client-shell.ts:43-60); varsayılan mutation gcTime 5 dk. Hedef: token için mutation `gcTime: 0`, hassas değer için form alanı (queryKey/variables'a girmemeli). Önizleme okumasının queryOptions'a çevrilmesi hassas değeri queryKey'e koyar — bu yüzden redaksiyon önizlemesi query değil mutation olmalı.
- **spec-8:** personal-shell `surface`: sahipsiz mi `useCreateStore` mu (Router search spec 72 tarafından dışlanıyor).
- **spec-8:** Kapalı dünya önizleme listeleri (share-scope-form, publish-wiki-form, build-in-public-preview-form) Akıllı Koleksiyon/Duvar paylaşımında büyüyebilir; sunucu üst sınırı doğrulanmadığı için Virtual bulgusu yazılmadı.
- **spec-8:** Shares and Publications dizini: iptal edilen yüzeyler kalıcı (URL tekrar kullanılmaz) → satırlar birikir; Virtual eşiği ve sunucu sayfalaması doğrulanmadı.
- **spec-8:** Export handoff sessionStorage ile taşınıyor (data-export/lib/export-handoff.ts:30); spec 79/lib yorumu 'bir gezinme için bellekte' diyor. Store vs Router history state vs sessionStorage sahibi stack'te tanımlı değil.
- **spec-8:** publish-wiki-form.tsx:121 ve build-in-public-preview-form.tsx:133 preview fingerprint değişiminde useEffect ile form sıfırlıyor; `key={preview.fingerprint}` remount alternatifi var, stack kuralı yok.
- **spec-8:** Ürün sapması (teknoloji bulgusu değil): spec 76 ayrı `Revoke`/`Unpublish`/`Change expiry`/`Reactivate`/`Move to Trash` etiketleri istiyor, dizin birleşik `Revoke / Unpublish` ve link aksiyonları gösteriyor; security-redaction-panel.tsx:62 hesap tercihli formatAccountDateTime yerine `toLocaleString()` kullanıyor.
- **spec-9:** 81 Contact seçicisi sınırı olmayan veri kümesindeki her Contact’ı `NativeSelectOption` olarak üretir. §6.9’un native tek-seçim seçeneklerine uygulanması ve erişilebilir sanallaştırılmış combobox’ın ürün sözleşmesi ayrı karar gerektirir. Mevcut kanıtla doğrulanmış bulguya eklenmedi.
- **spec-9:** 81 `PERSONAL_DATA_ERROR_MESSAGES` sunucunun `new ORPCError(REFUSAL_STATUS[error.code], { data: { code } })` eşlemesine bağlı. §6.1 `.errors()` kararı projede sunucu grubuna ait. Başka bulgu ID’si mevcut olunca bu spec’le ilişkilendirilebilir.
- **spec-9:** 81 restore replay kapsamı ve uzun özgün mesajlar için docs/source-ownership.md:328’de belirtilen mevcut sınırlar sunucu grubuna ait. Web sonucu `notRedacted` sayısını gösterir. Burada sunucu güvenlik bulgusu çıkarılmadı.
- **spec-9:** 85 `apps/server/scripts/verify-eu-deployment.ts` sunucu `start` girişinde kullanılıyor ve dosya envanterinde görünmüyor. 14 ve 21. satırda `process.env`, 16 ve 25. satırda `console.error` CLI ön kontrolünde kullanılıyor. Bu belgelenmiş dağıtım scripti için T3 Env/Evlog sunucu runtime kuralı yorumunu merkez inceleme yapmalı. Üretim sağlayıcı ayarları doğrulanmadı.
- **shared:** Satır içi useMutation({ mutationFn: () => runOnlineOnlyWrite(() => client.x()) }) kalıbı (favorite-control, personal-reminder-control, work-status-form, use-custom-fields): 6.1 mutationOptions'ı önerir; runOnlineOnlyWrite sarmalayıcısının {...orpc.x.mutationOptions(), mutationFn} ile mi yoksa MutationCache/ClientShell düzeyinde mi uygulanacağı merkezi karar (16). Bulgu sayılmadı.
- **shared:** mode-toggle.tsx:46 saveAccountAppearance runOnlineOnlyWrite kullanmıyor; diğer paylaşılan yazmalar kullanıyor. Client Shell çevrimdışı sözleşmesinin Account Appearance'ı kapsayıp kapsamadığı spec 03/02'den doğrulanmadı.
- **shared:** use-custom-fields.ts clientIdempotencyKey'i her mutationFn çağrısında yeniden üretiyor; personal-reminder-form, work-status-form ve mode-toggle aynı parmak izi için anahtarı koruyor. ADR-0004 tekrar kimliği ürün davranışı; teknoloji bulgusu değil, spec 10/04 incelemesine not.
- **shared:** work-status-form.tsx:93 reopenTarget satır içi role="dialog" paneli: açılır pencere değil; Base UI AlertDialog + createHandle'a taşımak UX değişikliği, sahipsiz bırakıldı.
- **shared:** custom-field-editor-form.tsx:123 editingId ve date-picker.tsx:170 draftTime için tanımlı hedef yok (sahipsiz); seçenekler state satırlarında.
- **shared:** @cantiara/ui dialog.tsx/popover.tsx createHandle dışa aktarmıyor; personal-reminder-control payload'lı diyaloğu için gerekli. createHandle dışa aktarımı yalnız bu çağrı yeri (ve spec gruplarının benzer bulguları) destekliyorsa issue'ya girmeli.
- **shared:** 6.6 Base UI 1.8.0 yazıyor; kurulu @base-ui/react 1.9.0. PopoverRoot/DialogRoot actionsRef ve handle, dialog/popover createHandle tiplerde doğrulandı.
- **shared:** apps/fumadocs/src/lib/shared.ts şablon yer tutucuları (appName "My App", gitConfig fuma-nama/fumadocs) içerik sorunu, teknoloji bulgusu değil.
- **server:** Sunucu dış HTTP istemcisi tutarsız (16. bölüm, sahip belirsiz): docs/tech-stack.md 'undici | Sunucu tarafı HTTP istemcisi' diyor. smart-link-preview-gateway.ts:7 ve smart-link-egress-worker.ts:5 `undici/index.js` (uyumlu); github-identity-confirmation-oauth.ts:2 bare `import { fetch } from "undici"` kullanıyor ki Bun'da tech-stack'in de belirttiği yerleşik undici shim'ine çözülür (fiilen global fetch); packages/auth/src/index.ts:75 ve :138 aynı GitHub OAuth uçlarına global fetch ile gidiyor. Neon REST için global fetch tech-stack'te açıkça izinli. Seçenekler: (a) sabit host'lu çağrılarda global fetch'i stack'e yaz, bare 'undici' import'unu kaldır; (b) tüm dış çağrıları `undici/index.js` request'e topla; (c) yalnız güvenilmeyen URL'ler için undici zorunlu de. Öneri (a)+(c); karar kullanıcıda.
- **server:** packages/auth/src/index.ts:75 ve :138 GitHub fetch'lerinde AbortSignal/zaman aşımı yok; GitHub askıda kalırsa OAuth callback'i Bun varsayılan süresine kadar bekler. Etki çalışma zamanı ile doğrulanmadı.
- **server:** CORS (app.ts:341-348, 400-416): resolveCorsOrigin herhangi bir chrome-extension:// veya moz-extension:// origin'ini `credentials: true` ile yansıtıyor ve tüm /* yollarına uygulanıyor. Statik iz: çerezli POST'ları CSRF middleware'i (csrf-protection.ts, güvenilen origin listesi eklenti origin'ini içermiyor) ve Better Auth `sameSite: "lax"` çerezi sınırlıyor; geniş izin yalnız token kimlikli Web Capture route'ları için gerekli görünüyor. Savunma önerisi: eklenti origin'ini yalnız /api/web-capture/* için ve credentials olmadan izinle, mümkünse kayıtlı eklenti kimliğine daralt. Yeniden üretim yapılmadı; doğrulanmış bulgu sayılmadı.
- **server:** OpenAPIHandler + OpenAPIReferencePlugin (app.ts:627-640) üretimde /api-reference altında tüm router'ı ikinci bir transport ve şema/doküman sayfası olarak açıyor; nodeEnv koşulu yok, tech-stack/spec/ADR'de sahibi yok (Sahipsiz). Bu yol isClientShellPath dışında kaldığı için onError düz 'Internal Server Error' döner. Seçenekler: üretimde kapat, operatör kimliğine bağla veya stack'e kaydet.
- **server:** privateData prosedürü (routers/index.ts:8829) iskelet kalıntısı: web'de çağıranı yok, oturum kullanıcısını döner. Veri sınırı ihlali değil (yalnız kendi verisi); kaldırma önerisi kullanıcı onayına bırakıldı.
- **server:** Status-only NOT_FOUND (156 yer, access null döndüğünde): sahiplik accountId kapsamlı veri katmanı sorgusunda uygulanıyor. 6.1'in 'sahiplik için typed-input middleware' satırı ile veri katmanı kapsamı arasında hangisinin tercih edildiği yazılı değil; ihlal sayılmadı, 6.1'e 'tek sorguda hesap kapsamlı okuma eşdeğerdir' notu önerilir.
- **server:** experimental_RethrowHandlerPlugin (app.ts:142) v1'de experimental önekli, deprecated değil; v2'de RethrowHandlerPlugin adını alıyor (2. bölümde kayıtlı). Deprecated bulgusu üretilmedi.
- **server:** PR #540 açık maddesi güncel kodda doğrulandı: build-in-public (11), wiki-publishing (5) ve release-communication (4) yayın prosedürlerinin apps/web/src veya apps/extension içinde `orpc.<proc>`/`client.<proc>` çağıranı yok; publish-wiki-form.tsx ve release-communication/ui/forms yalnız tanımlı, mount edilmiyor. Bu uygulama boşluğu (spec 65/74/75 grupları), teknoloji bulgusu değil.
- **desktop-extension:** Masaüstü dağıtımı çapraz referansı: .github/workflows/macos-release.yml:363 ve :904, HEAD’de bulunmayan web-macos-client/views/macos-package-contract.ts yolunu dinamik yükler. Gerçek doğrulayıcı apps/web/src/features/web-macos-client/lib/macos-package-contract.ts. Statik olarak iki doğrulama adımında modül çözümlenemez. Workflow bu grubun birincil dosya kapsamı dışında olduğu için ana ajana tekilleştirme amacıyla aktarıldı. İlgili ADR 0007.
- **desktop-extension:** Ekran görüntüsünde readActiveTab ile captureActiveTabScreenshot ayrı aktif sekme gözlemleri. captureVisibleTab bir pencere kimliği alıyor. Sekme değişirse kaynak metadatasıyla görüntü ayrışabilir. Popup ömrü ve tarayıcıların activeTab izni ile gerçek ulaşılabilirlik çalıştırılmadığından bulgu sayılmadı. İstemci düzeltmesinde sekme kimliğini doğrulama hassasiyetini değerlendirmek için kaynak https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab.
- **desktop-extension:** NativeSelect seçenekleri Proje sayısıyla büyüyebilir. Sunucu hattında sabit üst sınır görülmedi. Tarayıcının çizdiği yerel seçim açılır listesi için sanallaştırma sözleşmesinin uygulanabilirliği ve ürün ölçeği doğrulanmadı. Ekranda çizilen özel kayıt listesi veya satır seçimi yok, Table bulgusu sayılmadı.
- **desktop-extension:** Deprecated API aday listesi için yükseltme diff envanterinde bu gruba ait eşleşme görülmedi. Sürüm karşılaştırması kurulu tipler ve resmî kaynaklarla desteklendi. Yapay olmayan paket çalıştırması, extension tarayıcı matrisi, notarization, signature ve API penceresi üzerinden canlı doğrulama yapılmadı.

**check:conventions:** Geçti. check:conventions: 0 new violation(s), 0 review note(s) in changes since origin/main (a548a2c8).
