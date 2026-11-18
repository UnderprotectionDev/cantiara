# Teknoloji yığını kullanım denetimi

Durum: **1. aşama (araştırma) ve 2. aşama (kullanıcı kararları) tamamlandı.** 2026-11-18'de K1–K10 önerildiği gibi onaylandı: oRPC 1.16.3'e yamalanacak, v2'ye şimdilik geçilmeyecek. Bu belge kod, bağımlılık veya `docs/tech-stack.md` değişikliği içermez.

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

## 3. Rate limit (Sahipsiz)

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
