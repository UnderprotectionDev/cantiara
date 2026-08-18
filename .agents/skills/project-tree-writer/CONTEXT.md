# Project Tree Writer Bakım Sözlüğü

Bu dosya skill paketini geliştirenler içindir; runtime girdisi değildir. Runtime
adımları `SKILL.md`, normatif kararlar ilgili referans dosyalarındadır. Runtime'daki
“CONTEXT.md oku” ifadesi yalnız hedef projede keşfedilen `CONTEXT.md` dosyasını anlatır.
Buradaki terimler bakım dilidir; bir karar kuralıyla çelişirse normatif referans kazanır.

## Dil

**Greenfield Structure Extraction**
Yeni veya boş/kısmi scaffold full-stack hedef için kaynaklardan nihai klasör ağacı çıkarma. Migration, refactor veya scaffold execution değildir.

**Primary JS/TS Scope**
Next.js, TanStack Start/Router, Vite, React Router Framework Mode, Hono, Bun, oRPC, Prisma, Drizzle ve bunların normal repo, package-manager workspace, Turborepo veya Nx biçimleri. Bu scope features-first ownership kullanır.

**Convention-Preserving Fallback**
Rails, Laravel ve SvelteKit gibi birincil kapsam dışı frameworklerde yerel/framework convention'ını koruyan, daha düşük iddialı branch.

**Decision Authority**
Bir kaynağın yalnız sahip olduğu karar ekseninde otorite olması: PRD scope'u, CONTEXT domain dilini, tech-stack runtime'ı, ADR architecture'ı, workspace manifesti topology'yi belirler.

**Evidence-Weighted Topology**
Workspace ve project manifestlerinden normal repo/monorepo çıkarımı; klasör adını tek başına kanıt saymama.

**Features-First Ownership**
Primary JS/TS greenfield projede route entry'den ayrı app-local product behavior sınırı.

**Thin Route Entry**
Metadata, param parsing, guard, loading/error wrapper ve composition taşıyan framework route girişi.

**Thin Transport Adapter**
Request parsing, auth/session lookup ve response mapping yapıp feature server behavior'ını çağıran HTTP/API girişi.

**Direct Feature Shape**
Kaynak aksi bir framework-neutral internal convention seçmedikçe `components`, `views`, `forms`, `hooks`, `server`, `store` gibi gerekli sınırların doğrudan feature altında bulunması. `ui/` wrapper default değildir.

**Feature-Specific Minimal Shape**
Her feature'da yalnız gerçek ownership'i gösteren alt sınırların bulunması; aynı şablonu her feature'a basmama.

**Owned Core Feature**
Birden fazla feature'ın tükettiği lifecycle, validation, permission, search veya persistence behavior'ına sahip `*-core` sınırı. Pasif umbrella değildir.

**Supporting State**
Ayrı kullanıcı yönetim yüzeyi/lifecycle taşımayan route restore, session restore, son seçim veya feature UI state'i. Önce sahibi olan feature'a yerleşir.

**Deployable App**
Bağımsız çalıştırılan veya deploy edilen web, mobile, desktop, API, worker ya da provider backend. Monorepo'da `apps/*` altında yaşar.

**App-Local Feature**
Tek deployable'ın platform UI, state veya server behavior ownership'i. Aynı domain farklı app'lerde ayrı ownership parçaları taşıyabilir.

**Cross-App Package**
En az iki gerçek consumer veya açık mimari kararla paylaşılan domain, contract, client, UI veya tooling leaf package'ı.

**Package Group**
`packages/` altında içeriğe göre açılan ve kendi manifesti olmayan organizasyon klasörü. Gerçek package, manifest ve `src/` taşıyan leaf'tir.

**App-Scoped Nx Library**
Nx project graph'ında tek app'e ait olabilen fakat app klasörü dışında ayrı project olarak duran feature library. Cross-app olmak zorunda değildir.

**Capability Checklist**
Final tree yazılmadan önce scope, route, ownership, provider, persistence ve root sinyallerini içerden doğrulayan kontrol. Output'a yazılmaz.

**Directory Fixture**
`sources/`, `expected/` ve `case.json` taşıyan gerçekçi regression senaryosu.

**Behavior Eval**
Gerçek bir model/yüzey çıktısını aynı fixture'ın activation, mode ve semantic tree beklentilerine karşı değerlendiren provider-bağımsız kontrol.

## İlişkiler

- Decision Authority aynı konuda çelişki kalırsa soru protokolünü tetikler.
- Evidence-Weighted Topology normal-repo veya monorepo referans branch'ini seçer.
- Primary JS/TS Scope, Features-First Ownership ve Direct Feature Shape'i kullanır.
- Convention-Preserving Fallback kendi framework yerleşimini kazanır.
- Thin Route Entry ve Thin Transport Adapter, App-Local Feature behavior'ını compose eder.
- Supporting State önce App-Local Feature'a, gerçekten cross-feature ise açık app helper boundary'sine gider.
- Deployable App import edilecek shared source değildir; ortak import yüzeyi gerekiyorsa Cross-App Package açılır.
- Package Group yalnız leaf package'ları düzenler; kendisi dependency boundary değildir.
- Directory Fixture offline checker ve Behavior Eval tarafından aynı semantic sözleşmeyle kullanılır.
