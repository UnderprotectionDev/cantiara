# Bağımlılık yükseltme doğrulaması

Tarih: 18 Kasım 2026. Kapsam yalnız sürümler ve zorunlu uyumluluk düzeltmeleridir. Şema/migration, TypeScript, oRPC v2, `packages/ui` içindeki `cn`, Better Auth pini, Bun ve Rust değiştirilmedi.

Kullanıcı kararları: mevcut Smart Collection `Test Gap` constraint hatasını raporlayarak devam et; Tauri npm paketlerini Rust kararıyla 12. gruba bırak; 16.19.4 sonrası yama veya bir hafta koşulu sağlanmadığından 8. grubu beklet.

## Doğrulama ortamı ve bilinen hata

DB testleri yapılandırılmış paylaşımlı geliştirme hedeflerinde değil, ayrı atılabilir yerel PostgreSQL veritabanlarında çalıştırıldı. Mevcut kanonik migration'lar uygulandı; repository şeması ve SQL'i değiştirilmedi. Browser ve sunucu testleri ayrı DB kullandı. Tam e2e, CI sözleşmesindeki tek worker ile çalıştırıldı. Test atlama veya hook bypass yapılmadı; burada canlı ortam hazır iddiası yoktur.

Sunucu tam paket komutu:

```sh
source /tmp/cantiara-dependency-server-test-env.sh
bun run --cwd apps/server test -- --no-file-parallelism --fsModuleCache
```

Başarısız test: `smart-collections-database.integration.test.ts > recomputes Test Gap membership when its state changes`.

```text
new row for relation "smart_collection" violates check constraint "smart_collection_source_type_check"
code: 23514
```

Mevcut schema ve 0091 migration'ı `Test Gap` türünü kabul etmiyor. Kullanıcı kararıyla bu mevcut hata korunup raporlandı. Test silinmedi, atlanmadı; bütün sunucu koşularında etkin.

## 1. Güvenlik

| Paket | Yeni sürüm |
| --- | --- |
| @orpc/server, @orpc/client, @orpc/openapi, @orpc/zod, @orpc/tanstack-query | 1.16.3 |
| happy-dom | 21.0.4 |
| undici | 7.30.2 |

Üretim kodu uyarlaması yok. Gerçek RPCLink üzerinden credentials/include, manual redirect ve geçerli RPC payload'ı taşıyan 301/302/303/307/308 yanıtlarının reddini test eden altı durum eklendi.

Sonuç: check-types/check/conventions geçti; web 1354, API 584 test geçti. Sunucu 3213 geçti, yukarıdaki mevcut 1 hata kaldı. İlk tam e2e 133 geçti, eksik Firefox binary'si nedeniyle 1 başarısız oldu; eşleşen Firefox kurulduktan sonra extension testi Chromium ve Firefox ile geçti. Source ve built-worker gerçek smoke geçti.

Başlangıçtaki kök Vitest alias, eksik VITE_SERVER_URL, eksik WebKit/Firefox, eşzamanlı fixture hesap silme ve eksik DB fixture değişkeni sorunları paket bazında, tam ortam değişkenleriyle ve CI worker sözleşmesiyle yeniden çalıştırılarak giderildi. Son tam sunucu koşusunda test atlama yoktu.

Kaynaklar: [oRPC 1.15.2](https://github.com/middleapi/orpc/releases/tag/v1.15.2), [1.16.0](https://github.com/middleapi/orpc/releases/tag/v1.16.0), [1.16.1](https://github.com/middleapi/orpc/releases/tag/v1.16.1), [1.16.2](https://github.com/middleapi/orpc/releases/tag/v1.16.2), [1.16.3](https://github.com/middleapi/orpc/releases/tag/v1.16.3), [Happy DOM 21](https://github.com/capricorn86/happy-dom/releases/tag/v21.0.0), [21.0.4](https://github.com/capricorn86/happy-dom/releases/tag/v21.0.4), [Undici 7.30.2](https://github.com/nodejs/undici/releases/tag/v7.30.2).

## 2. Yama ve minorlar

Tauri dışındaki istenen hedefler uygulandı:

| Paket | Yeni sürüm |
| --- | --- |
| [react](https://registry.npmjs.org/react/19.3.1) | 19.3.1 |
| [react-dom](https://registry.npmjs.org/react-dom/19.3.1) | 19.3.1 |
| [@tanstack/react-query](https://registry.npmjs.org/@tanstack/react-query/5.108.0) | 5.108.0 |
| [@tanstack/react-query-devtools](https://registry.npmjs.org/@tanstack/react-query-devtools/5.108.0) | 5.108.0 |
| [@tanstack/react-router](https://registry.npmjs.org/@tanstack/react-router/1.170.46) | 1.170.46 |
| [@tanstack/router-plugin](https://registry.npmjs.org/@tanstack/router-plugin/1.169.0) | 1.169.0 |
| [@tanstack/react-router-devtools](https://registry.npmjs.org/@tanstack/react-router-devtools/1.167.3) | 1.167.3 |
| [@tanstack/react-virtual](https://registry.npmjs.org/@tanstack/react-virtual/3.14.26) | 3.14.26 |
| [@tanstack/react-store](https://registry.npmjs.org/@tanstack/react-store/0.11.2) | 0.11.2 |
| [@base-ui/react](https://registry.npmjs.org/@base-ui/react/1.9.0) | 1.9.0 |
| [shadcn](https://registry.npmjs.org/shadcn/4.23.0) | 4.23.0 |
| [react-day-picker](https://registry.npmjs.org/react-day-picker/10.0.2) | 10.0.2 |
| [react-resizable-panels](https://registry.npmjs.org/react-resizable-panels/4.24.0) | 4.24.0 |
| [lucide-react](https://registry.npmjs.org/lucide-react/1.75.0) | 1.75.0 |
| [@dnd-kit/react](https://registry.npmjs.org/@dnd-kit/react/0.5.3) | 0.5.3 |
| [@tiptap/react](https://registry.npmjs.org/@tiptap/react/3.34.0) | 3.34.0 |
| [@tiptap/starter-kit](https://registry.npmjs.org/@tiptap/starter-kit/3.34.0) | 3.34.0 |
| [@tiptap/markdown](https://registry.npmjs.org/@tiptap/markdown/3.34.0) | 3.34.0 |
| [@tiptap/extension-table](https://registry.npmjs.org/@tiptap/extension-table/3.34.0) | 3.34.0 |
| [@tiptap/extension-mathematics](https://registry.npmjs.org/@tiptap/extension-mathematics/3.34.0) | 3.34.0 |
| [@tiptap/extension-code-block-lowlight](https://registry.npmjs.org/@tiptap/extension-code-block-lowlight/3.34.0) | 3.34.0 |
| [react-pdf](https://registry.npmjs.org/react-pdf/11.1.0) | 11.1.0 |
| [pdfjs-dist](https://registry.npmjs.org/pdfjs-dist/6.5.438) | 6.5.438 |
| [mermaid](https://registry.npmjs.org/mermaid/12.3.0) | 12.3.0 |
| [katex](https://registry.npmjs.org/katex/0.18.11) | 0.18.11 |
| [konva](https://registry.npmjs.org/konva/10.9.1) | 10.9.1 |
| [react-konva](https://registry.npmjs.org/react-konva/19.3.2) | 19.3.2 |
| [@uppy/core](https://registry.npmjs.org/@uppy/core/6.3.1) | 6.3.1 |
| [hono](https://registry.npmjs.org/hono/4.13.19) | 4.13.19 |
| [drizzle-orm](https://registry.npmjs.org/drizzle-orm/0.45.4) | 0.45.4 |
| [drizzle-kit](https://registry.npmjs.org/drizzle-kit/0.31.11) | 0.31.11 |
| [@neondatabase/serverless](https://registry.npmjs.org/@neondatabase/serverless/1.2.1) | 1.2.1 |
| [pg-boss](https://registry.npmjs.org/pg-boss/12.38.2) | 12.38.2 |
| [evlog](https://registry.npmjs.org/evlog/2.35.1) | 2.35.1 |
| [@modelcontextprotocol/sdk](https://registry.npmjs.org/@modelcontextprotocol/sdk/1.32.2) | 1.32.2 |
| [zod](https://registry.npmjs.org/zod/4.6.7) | 4.6.7 |
| [vite](https://registry.npmjs.org/vite/8.3.8) | 8.3.8 |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs/plugin-react/6.3.0) | 6.3.0 |
| [vitest](https://registry.npmjs.org/vitest/5.1.1) | 5.1.1 |
| [turbo](https://registry.npmjs.org/turbo/2.11.12) | 2.11.12 |
| [tsdown](https://registry.npmjs.org/tsdown/0.23.7) | 0.23.7 |
| [tailwindcss](https://registry.npmjs.org/tailwindcss/4.3.5) | 4.3.5 |
| [@tailwindcss/vite](https://registry.npmjs.org/@tailwindcss/vite/4.3.5) | 4.3.5 |
| [@tailwindcss/postcss](https://registry.npmjs.org/@tailwindcss/postcss/4.3.5) | 4.3.5 |
| [postcss](https://registry.npmjs.org/postcss/8.5.33) | 8.5.33 |
| [wxt](https://registry.npmjs.org/wxt/0.21.5) | 0.21.5 |
| [web-ext](https://registry.npmjs.org/web-ext/10.8.0) | 10.8.0 |
| [@axe-core/playwright](https://registry.npmjs.org/@axe-core/playwright/4.14.0) | 4.14.0 |
| [@types/bun](https://registry.npmjs.org/@types/bun/1.4.4) | 1.4.4 |
| [@types/node](https://registry.npmjs.org/@types/node/26.6.6) | 26.6.6 |

Zorunlu uyumluluk düzeltmeleri:

- Bun lockfile çözümlemesindeki eski query-core kopyası yeni QueryClient ile özel alan kimliği çakışması doğuruyordu. 146 tüketiciyi değiştirmek yerine paket yöneticisinin ürettiği çözümleme 5.108.0 ile hizalandı; yeni doğrudan bağımlılık eklenmedi.
- Smart Link form testindeki iframe DOM'u için yalnız test ortamında iframe oluşturma açıldı, child-frame navigation kapalı tutuldu.
- axe 4.14'ün etkinleştirdiği label-content-name-mismatch kuralı DatePicker erişilebilir adındaki mevcut eksikliği yakaladı. Ad artık görünen tarihi içeriyor; ilgili birim testi ve paylaşılan e2e date locator güncellendi. State ve görünen UI metni aynı.

Sonuç: check-types/check geçti; web 1354, API 584, extension 2, root script 35 test geçti. Sunucu 3213 geçti ve bilinen 1 hata. `bun run db:check` 192 ana/4 güvenlik migration kaynağını doğruladı. `bun run db:test` tam, yeni üç DB fixture'ı ile 127 testi geçti; ilk eksik `_fresh` fixture/timeout koşusu 8 hatayla başarısız olmuştu. Tam e2e 134 geçti (10,9 dakika). Wireframe/işaretleme/PDF görüntüleme ilgili testleri tam web ve e2e paketlerinde çalıştı. Server build ve source/built-worker smoke geçti.

Query 5.108.0 kurulu tip dosyası incelendi: `queryClient.query()` var; `fetchQuery` ve `ensureQueryData` `@deprecated`. Kullanım çağrıları değiştirilmedi.

Kaynaklar: [Query 5.108.0](https://github.com/TanStack/query/releases/tag/@tanstack%2Freact-query@5.108.0), [Bun update](https://bun.com/docs/pm/cli/update), [React 19.3](https://github.com/react/react/releases/tag/v19.3.0), [19.3.1](https://github.com/react/react/releases/tag/v19.3.1), [act](https://react.dev/reference/react/act), [Vitest 5.1.1](https://github.com/vitest-dev/vitest/releases/tag/v5.1.1), [React-PDF 11.1](https://github.com/wojtekmaj/react-pdf/releases/tag/v11.1.0), [Konva 10.9.1](https://github.com/konvajs/konva/releases/tag/10.9.1), [Drizzle 0.45.4](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.4), [axe 4.14](https://github.com/dequelabs/axe-core/releases/tag/v4.14.0), [erişilebilir ad kuralı](https://dequeuniversity.com/rules/axe/4.14/label-content-name-mismatch).

## 3. Küçük majorlar

[Lefthook 2.2.2](https://registry.npmjs.org/lefthook/2.2.2), [pacer-lite 0.3.0](https://registry.npmjs.org/@tanstack/pacer-lite/0.3.0), [file-type 22.3.0](https://registry.npmjs.org/file-type/22.3.0), [ipaddr.js 2.5.0](https://registry.npmjs.org/ipaddr.js/2.5.0), [PapaParse 5.7.1](https://registry.npmjs.org/papaparse/5.7.1)/[types 5.5.2](https://registry.npmjs.org/@types/papaparse/5.5.2), [Sharp 0.35.5](https://registry.npmjs.org/sharp/0.35.5), [Vidstack 1.15.7](https://registry.npmjs.org/@vidstack/react/1.15.7) uygulandı. Üretim uyarlaması yok.

Pacer için eski sürümde önce geçen altı karakterizasyon durumu iki yeni test dosyasında eklendi. Yedi tüketicide moodboard ve technical-diagram hook'ları, Work Draft autosave/offline/reconnect e2e'si, project-wall view ve canvas, user-flow canvas, wireframe pane testleri gecikme/coalescing/çıkış flush davranışlarını doğruluyor. ipaddr client-ip ve Smart Link testleri, tip uyumu geçti.

Sonuç: check-types/check, web 1360, root 35, ilgili e2e 3, source/built-worker smoke ve server build geçti. Sunucu 3213 geçti, bilinen 1 hata.

Kaynaklar: [file-type 22.3](https://github.com/sindresorhus/file-type/releases/tag/v22.3.0), [Sharp 0.35.5](https://github.com/lovell/sharp/releases/tag/v0.35.5), [Lefthook 2.2.2](https://github.com/evilmartians/lefthook/releases/tag/v2.2.2), [Pacer yayımlanmış tip/kaynak](https://registry.npmjs.org/@tanstack/pacer-lite/0.3.0), [ipaddr metadata](https://registry.npmjs.org/ipaddr.js/2.5.0). ipaddr v2.5.0 GitHub release sayfası 404; yayımlanmış kaynak ve metadata doğrulandı.

## 4. Markdown ve Highlight

`@tanstack/markdown` 1.2.0 ve `@tanstack/highlight` 1.2.12 birlikte uygulandı. document-preview alt yol import'ları çözümleniyor; üretim uyarlaması yok. Gerçek PDF metninde ham HTML'in literal kaldığı ve public Wiki HTTP çıktısında strong/script/iframe/image HTML'inin kaçırıldığı iki güvenlik testi eklendi. `allowHtml: false` çağrıları aynı.

Sonuç: önce/sonra 30 ilgili güvenlik testi; web 1360; e2e 18; check-types/check geçti. Sunucu 3215 geçti, bilinen 1 hata. Yeni PDF testine yanlışlıkla eklenen `isEvalSupported` seçeneği TS2353 verdi; kurulu PDF.js API'sinde bulunmadığı doğrulanıp yalnız o yeni test seçeneği çıkarıldı.

Kaynaklar: [Markdown 1.2](https://github.com/TanStack/markdown/releases/tag/v1.2.0), [Highlight 1.2.12](https://github.com/TanStack/highlight/releases/tag/v1.2.12), [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [PDF.js 6.5.438](https://github.com/mozilla/pdf.js/releases/tag/v6.5.438).

## 5. TanStack Table 9

`@tanstack/react-table` 9.3.1 uygulandı. Yalnız record-table ve saved-project-lists adapter'ları useTable/tableFeatures/row-model slotları/ColumnDef feature parametresine uyarlandı. Mevcut kontrollü state API'si rehberde destekleniyor; `useState` satırları aynen korundu. Eski getState çağrısı yoktu. İlk test/tip kontrolünde eksik getVisibleCells API'si, iki adapter'da columnVisibilityFeature kaydıyla çözüldü.

Sonuç: iki adapter'ın 5 testi, tam web 1360 testi, ilgili e2e 9 testi, check-types/check geçti. Bu grupta sunucu bağımlılığı değişmedi.

Kaynaklar: [Resmî React v9 migration](https://tanstack.com/table/latest/docs/framework/react/guide/migrating), [9.3.1](https://github.com/TanStack/table/releases/tag/@tanstack%2Freact-table@9.3.1).

## 6. htmlparser2 12

10.1.0 → 12.0.0. Önce eski sürümde iframe/noframes/textarea içeren karakterizasyon testi geçti. Yükseltme ardından aynı komut 1 testte başarısız oldu:

```text
Expected: Before Fallback text <b>Draft text</b> After
Received: Before <b>Fallback text</b> <b>Draft text</b> After
```

Resmî 11/12 sürüm notları ve Parser/Tokenizer API'si incelendi; ayrı v12 migration rehberi bulunamadı. Tek üretim dosyasında noframes ham içeriği mevcut metadata ayrıştırmasıyla bir kez daha işleniyor; nested parse sınırlı. İframe/script dışarıda kalıyor, textarea mevcut literal davranışını koruyor. Ek regresyon testi fallback içindeki ignored içerik ve baş/son boşluklarını doğruluyor. Bu test ilk düzeltmede `BeforeFallback` farkını yakaladı; ham iç metin dış normalizasyona verilerek giderildi.

Sonuç: check-types/check geçti; sunucu 3217 geçti ve bilinen 1 hata, 0 atlama. Son daraltılmış 12 preview testi geçti; ilgili e2e 3, server build ve gerçek source/built-worker smoke geçti. Şema değişmedi.

Kaynaklar: [v11 sürüm notları](https://github.com/fb55/htmlparser2/releases/tag/v11.0.0), [v12 sürüm notları](https://github.com/fb55/htmlparser2/releases/tag/v12.0.0), [resmî kullanım](https://github.com/fb55/htmlparser2), [v12 tokenizer kaynağı](https://github.com/fb55/htmlparser2/blob/v12.0.0/src/Tokenizer.ts).

## 7. Playwright

`playwright` ve `@playwright/test` **1.65.1**, aynı exact sürüme yükseltildi. Chromium 1255, Firefox ve WebKit 2388 yeniden kuruldu. CI betiği `bunx playwright install --with-deps` ile kurulu sürümün tarayıcısını aldığı için değişiklik gerekmiyor.

İlk `bun run check-types` başarısız çıktı:

```text
TS2322: playwright-core@1.65.1 Page is not assignable to playwright-core@1.63.0 Page
```

Lockfile doğruydu; Axe paketinin eski kurulum peer symlink'i kalmıştı. `bun install --frozen-lockfile --force` kurulum bağlantısını düzeltti; yeni bağımlılık veya kod düzeltmesi yok. Son tip kontrolü geçti.

`devices["Desktop Chrome"]` screen iletimi ve dar viewport kullanan karar/favorites/visual-tour testleri incelendi. Ürün/test kaynaklarında window.screen veya device-width media-query tüketimi bulunmadı; viewport duyarlı testler tam pakette geçti. Ekran davranışı körlemesine override edilmedi.

Sonuç: check-types/check geçti, web 1360 geçti, sunucu 3217 geçti + bilinen 1 hata. Ayrıca açık PDF/moodboard render komutu **3 dosya / 9 test** geçti. Tam `bun run test:e2e` **134 geçti (11,5 dakika)**, test atlama yok. Chromium/Firefox extension akışı tam pakette geçti.

Kaynaklar: [1.64 sürüm notları / screen](https://playwright.dev/docs/release-notes#version-164), [1.65 sürüm notları](https://playwright.dev/docs/release-notes#version-165), [1.65.1](https://github.com/microsoft/playwright/releases/tag/v1.65.1), [Bun install](https://bun.com/docs/pm/cli/install).

Konsoldaki useInsertionEffect ve duplicate-key uyarıları 1. grup koşusunda da mevcut; bu görevde uyarı temizliği yapılmadı. Bunlar test başarısızlığı olarak gizlenmedi; tam çıktı `/tmp/cantiara-group7-e2e.log` dosyasında.

## 8. Next ve Fumadocs — kullanıcı kararıyla bekliyor

Kullanıcı koşulu 16.19.4 **sonrası** yeni bir yama veya 16.19.4 yayımından bir hafta. 16.19.4 17 Kasım'da yayımlandı; 16.19.5 yok. 18 Kasım'da koşul sağlanmadı ve kullanıcı açıkça beklet dedi. Next/Fumadocs ve apps/fumadocs `cn` aynı kaldı. Bu gruba ait next build / llms.txt / .md route kabulü uygulanmadı; grup yükseltilmedi.

## 9. Biome ve Ultracite — kapsam kararı bekliyor

Ana depoda uygulanmadı. [Salt kontrol önizlemesi](dependency-upgrade-lint-preview.md) 1.244 dosyalık etki gösterdi; yaklaşık 10 dosya sınırı nedeniyle kullanıcıya soruldu. 8.3.0 aynı gün yayımlandığından aday 8.2.1; Biome adayı 2.6.8. Ana depoda otomatik biçim değişikliği veya init yapılmadı. Kullanıcı geniş lint uyarlamasının araştırılmasını seçti; [kontrollü ek ölçümler](dependency-upgrade-lint-preview.md#ek-inceleme--kullanıcının-araştırma-kararı-sonrası) ve [kural bazında bulgular](dependency-upgrade-lint-rules.md) hazır. Geçici kopyadaki safe-fix deneyi uygulama onayı veya kabul kanıtı değildir.

## 10–12. Araştırma ve onay sınırı

[Ayrıntılı araştırma](dependency-upgrade-research.md) mevcut kullanımları, etkilenen dosya sayılarını, resmî migration/changelog kaynaklarını ve geç/bekle önerilerini içerir. Kararlar kullanıcıya soruldu; onay alınmadan yükseltme yapılmayacak. Tauri npm hedefleri 12. grubun Rust kararıyla birlikte bekliyor.

## Son inceleme ve sınırlar

Üretim uyum düzeltmeleri dört dosyada: DatePicker erişilebilir adı, iki Table 9 adapter'ı ve htmlparser2 fallback ayrıştırması. Genel refactor ve state temizliği yok. `docs/tech-stack.md` amaçları ve routeTree generated çıktısı değişmedi. Yeni doğrudan bağımlılık yok. `git diff --check` geçti. 71 hedef paket 10 manifestte doğrulandı; oRPC ve Tiptap lockfile ailelerinde karışık sürüm yok. Korunan sürüm ve dosyalar ayrıca HEAD ile karşılaştırıldı.

Test çıktıları `/tmp/cantiara-groupN-*.log` dosyalarındadır. Başarısızlık çıktılarının ana kayıtları: group1-server-complete, group1-e2e-serial; group2-types, group2-web, group2-dbtest; group4-types; group5-adapter; group6-after ve group6-whitespace-red; group7-types. Nihai başarı kayıtları ilgili `*-close.log` ve bu rapordaki toplamlarla ayrılmıştır. Önceki çevresel veya red-test başarısızlıkları nihai başarı gibi sunulmadı.
