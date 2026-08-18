# Regression Coverage Index

Bu dosya regression beklentilerinin tek uzun-form listesi değildir. Her kritik davranışın hangi test yüzeyinde korunduğunu gösterir.

## İçindekiler

- Invocation/soru, normal repo/framework ve feature ownership
- Monorepo ownership, output/anti-bloat ve paket bakımı
- Behavior eval protokolü ve yeni regresyon ekleme

Test türleri:

- **offline fixture**: `fixtures/<id>/case.json` ve beklenen output semantic checker tarafından doğrulanır;
- **behavior eval**: gerçek runner/captured output aynı fixture metadata'sına karşı puanlanır;
- **unit**: checker veya runner CLI davranışı `tests/test_structure_tools.py` ile doğrulanır;
- **manual-only**: gerçek Codex dosya/konuşma side effect'i gerektiği için otomatik package testine alınmaz.

## Invocation ve Soru Akışı

| Davranış | Coverage |
|---|---|
| Frontmatter ve `agents/openai.yaml` açık-çağrı ayarları tutarlıdır | unit |
| Yalnız bağımsız tam `$project-tree-writer` çağrısı aktive olur; fixture invocation metadata'sı tersini ifade edemez | `implicit-no-activation` — offline + behavior eval; unit |
| Product scope yoksa tek soru | `missing-product-scope-question` — offline + behavior eval |
| Birden fazla app planında monorepo önererek sorar | `multi-app-repo-model-question` — offline + behavior eval |
| Existing `structure.md` overwrite sorusu | `overwrite-question` — offline + behavior eval; gerçek write engeli manual-only |
| Açık local target path CWD'den üstündür ve çıktı doğrudan onun altında yazılır | `explicit-target-root` — offline + behavior eval; forward-test |
| Soru yalnız doğru metadata karar ekseni ile 2–3 seçenek taşır ve tek `(önerim)`lidir | question fixture'ları + unit |
| Birden fazla belirsizliği bağımlılık sırasıyla tur tur sorar | manual-only behavior conversation |

## Normal Repo ve Framework

| Davranış | Coverage |
|---|---|
| Next.js list/detail `src/app` routes + direct `src/features` | `next-normal-features` — offline + behavior eval + forward-test |
| Güncel Next request proxy `proxy.ts` | `next-proxy` — offline + behavior eval |
| Legacy `modules` primary greenfield hedefte `features` olur | `legacy-modules-converted` — offline + behavior eval |
| TanStack file routes/generated tree + features | `tanstack-start-normal` — offline + behavior eval |
| Same-deployable TanStack + Hono adapter ayrımı | `tanstack-hono-normal` — offline + behavior eval |
| Bun workspace + TanStack/Vite + Hono/oRPC + Prisma | `bun-orpc-prisma-monorepo` — offline + behavior eval |
| Bun workspace + TanStack/Vite + Hono/oRPC + Drizzle | `bun-orpc-drizzle-monorepo` — offline + behavior eval |
| React Router Framework Mode `routes.ts` | `react-router-framework` — offline + behavior eval |
| Rails convention-preserving fallback | `rails-fallback` — offline + behavior eval |
| SvelteKit ve Laravel fallback convention'ları | manual-only; yeni fixture ilgili framework kategorisine eklenmeli |

## Feature Ownership

| Davranış | Coverage |
|---|---|
| Distinct product varyantları core altında gizlenmez | `product-variants-and-core` — offline + behavior eval |
| `*-core` yalnız behavior owner ise görünür | `product-variants-and-core` — offline + behavior eval |
| Supporting state owner feature/app helper altında kalır | `supporting-state-owned` — offline + behavior eval |
| Explicit FSD seçimi korunur | `explicit-fsd` — offline + behavior eval |
| Route ile feature farklı ad/nesting taşıyabilir | explicit `route_feature_map` fixture'ları + unit |
| Route-local `_components/actions` primary targetta reddedilir | unit |
| Concrete server filename kaynak yokken uydurulmaz | normal fixture seti; behavior eval |

## Monorepo Ownership

| Davranış | Coverage |
|---|---|
| Backend deployable app ve persistence owner'dır | `turbo-multi-app-backend` — offline + behavior eval |
| Aynı feature backend/web/mobile'da farklı ownership taşır | `turbo-multi-app-backend` — offline + behavior eval |
| Ortak provider backend `apps/backend` altında kalır | `provider-backend-app` — offline + behavior eval |
| Cross-app contract grouped leaf package olur | `turbo-multi-app-backend` — offline + behavior eval |
| `packages/backend`, `packages/db`, `packages/features` default değildir | `turbo-multi-app-backend`, `provider-backend-app` |
| Nx app-scoped feature library cross-app sayılmaz | `nx-app-scoped-feature` — offline + behavior eval |
| Feature root veya package altına kaçamaz | unit |
| Leaf package content group, manifest ve `src/` taşır | `turbo-multi-app-backend` + unit |
| Leaf public export metadata'sı kaynak manifestteki en az bir görünür source target'ına çözülür; conditional build target'ı tree'ye zorlanmaz | Bun/oRPC fixture'ları, `turbo-multi-app-backend` + unit |
| oRPC contract gerçek backend/web consumer'larıyla grouped leaf package olur | `bun-orpc-prisma-monorepo`, `bun-orpc-drizzle-monorepo` — offline + behavior eval |
| Prisma ve Drizzle backend-owned alternatifler olarak ayrı kalır | `bun-orpc-prisma-monorepo`, `bun-orpc-drizzle-monorepo` — offline + behavior eval |

## Output ve Anti-Bloat

| Davranış | Coverage |
|---|---|
| Yalnız heading + tek text tree | bütün structure fixture'ları + unit parser |
| Connector/girinti ve sibling marker doğru | unit |
| Klasörler dosyalardan önce | unit |
| Generic klasör yalnız allowlist/source evidence ile | unit |
| Input PRD/CONTEXT/tech-stack otomatik tree'ye girmez | fixture expected outputs + behavior eval |
| Test/deploy/config artifact source-backed olur | behavior eval; artifact-specific fixture gerektiğinde eklenir |
| Başarılı write sonrası kısa cevap ve tree tekrar yok | manual-only |
| Runtime web araması yapmaz | manual-only/tool trace |

## Paket Bakımı

| Davranış | Coverage |
|---|---|
| Paket `CONTEXT.md` bakım sözlüğüdür, runtime girdisi değildir ve `SKILL.md` bakım branch'inden erişilir | unit |
| Package-local Markdown pointer'ları var olan ve paket içinde kalan hedeflere çözülür | unit |

## Behavior Eval Protokolü

- `scripts/run_behavior_evals.py <fixtures> --validate-only`: dataset ve expected output'ları doğrular.
- `scripts/run_behavior_evals.py <fixtures> results.json`: captured sonuçları puanlar.
- `scripts/run_behavior_evals.py <fixtures> --runner <executable>`: her case'i JSON stdin ile provider-bağımsız runner'a gönderir.
- Runner payload: `id`, `invocation`, `user_input`, `target_root`, `sources`.
- Runner result: `activated`, `output`; structure modunda target root'a göre
  `output_path`, question/none modunda yazma yolu yoktur.

## Yeni Regresyon Ekleme

1. Davranış mevcut public checker/runner seam'inde gözlenebiliyorsa önce kırmızı unit test yaz.
2. Gerçek source extraction davranışıysa ilgili kategori altında yeni directory fixture ekle.
3. `case.json` required/forbidden path ve route mapping'i semantic olarak tanımlar; substring golden üretme.
4. Framework/provider'a özel generic klasör gerekiyorsa exact `generic_path_evidence` ile var olan kaynak dosyasını bağla.
5. Bu indexte ilgili kategoriye fixture id ve test türünü ekle.
6. Yalnız gerçek Codex side effect'iyle doğrulanabiliyorsa `manual-only` gerekçesini yaz.
