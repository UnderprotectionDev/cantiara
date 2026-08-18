# Architecture Decision Rules

Bu dosya normal repo ve monorepo için ortak product ownership kurallarının tek otoriter kaynağıdır.

## İçindekiler

- Primary JS/TS, route/transport ve feature boundary
- Direct feature shape, naming, core ve supporting state
- Provider/persistence, cross-cutting capability, FSD ve fallback ownership

## Primary JS/TS Features-First

Next.js, TanStack Start/Router, React Router Framework Mode ve Hono kullanan greenfield hedeflerde product behavior app-local `features/<feature>` sınırında bulunur.

Route klasörlerinde `_components`, colocated action veya product implementation hedefi üretme. Route entry yalnız framework glue, transport parsing ve feature composition taşır.

Legacy `modules/` sinyali primary greenfield hedefi değiştirmez; nihai tree `features/` kullanır. Bu bir migration planı değildir ve final output mevcut/yeni ayrımı göstermez.

## Route ve Transport Ownership

Route entry şunları taşıyabilir:

- metadata ve layout composition;
- route/search param parsing;
- auth guard veya optimistic request check;
- loading/error boundary;
- framework loader/action/handler girişi;
- feature view composition.

HTTP/API entry şunları taşıyabilir:

- request parsing;
- auth/session lookup;
- response/status mapping;
- provider/framework integration;
- feature server behavior çağrısı.

Product lifecycle, validation, permission, persistence operation ve use-case behavior route/handler dosyasının sahibi değildir. Bunlar ilgili feature'ın `server/` sınırında kalır. Kaynak concrete `commands.ts`, `actions.ts`, `procedures.ts`, `service.ts` veya başka dosya adı vermiyorsa yalnız `server/` klasörünü göster; `procedures.ts` uydurma.

## Feature Boundary Çıkarma

Feature açma sinyalleri:

- aynı kullanıcı capability'sini destekleyen cohesive akış;
- birlikte değişen UI, server behavior, schema, type ve state;
- kendine ait form, liste/detail yüzeyi veya navigation anlamı;
- ayrı lifecycle, validation, permission veya metadata kuralı;
- cross-route fakat tek product capability olan behavior.

Feature açmak için tek başına yeterli olmayanlar:

- raw entity veya tablo listesi;
- route listesi;
- CRUD fiilleri;
- provider SDK/config;
- webhook veya cron entry;
- ORM schema/migration;
- future capability;
- küçük toggle/action.

Her gerçek product feature görünür klasör alır. Çok feature olduğunda bloat, feature silerek veya generic umbrella altında saklayarak değil, leaf dosyaları seçici göstererek azaltılır.

## Direct Feature Shape

Primary JS/TS default'u direct shape'tir. Yalnız feature'ın gerçek ownership'ini gösteren sınırları seç:

- `components/`: reusable feature UI;
- `views/`: route-level feature composition;
- `forms/`: ayrı form ownership'i;
- `hooks/`: feature hook'ları;
- `server/`: transport-independent server behavior;
- `store/`: feature-owned state;
- `data/` veya `lib/`: gerçek feature-local data/helper boundary;
- `params.ts`: URL/search contract;
- `schemas.ts`: input/form/domain validation;
- `types.ts`: feature-owned types;
- `index.ts`: yalnız gerçek kontrollü public boundary gerekiyorsa.

Her feature'a aynı şablonu basma. Server-only feature'a UI, UI-only feature'a server klasörü ekleme. `ui/views`, `ui/components` veya `ui/forms` wrapper'ı primary default değildir.

## Naming

- Collection/product surface: çoğul isim (`orders`, `invoices`).
- Process/lifecycle: doğal process adı (`checkout`, `onboarding`).
- CRUD fiilleri feature adı değildir.
- User-facing surface doğal adı alır; ortak core gerekiyorsa `orders-core` gibi açık behavior adı kullanır.
- Greenfield klasörler İngilizce `kebab-case` kullanır; domain anlamı korunur.

## Core ve Shared Behavior

`*-core` ancak birden fazla gerçek feature'ın tükettiği lifecycle, validation, permission/scope, search contract veya persistence-facing behavior taşıyorsa açılır. Tek feature kullanıyorsa behavior o feature içinde kalır.

`core`, `domain`, `management`, `resources`, `workspace`, `metadata` gibi isimler pasif umbrella olamaz. Gerçek product surface'leri gizleyen generic boundary üretme.

## Supporting State

Son filtre, seçili kayıt, route/session restore, onboarding progress veya workspace context bağımsız kullanıcı yönetim yüzeyi ve lifecycle taşımıyorsa product feature değildir.

Yerleşim sırası:

1. Sahibi olan feature'ın `store/`, `params.ts` veya `lib/` sınırı.
2. Birden fazla feature gerçekten tüketiyorsa açık isimli app-level helper/state boundary.
3. Server-only restore behavior ise app server helper boundary.

Generic global `state`, `store`, `workspace-context` feature'ı otomatik açma.

## Provider ve Persistence

Provider/library convention'ı product feature içine taşınmaz:

- auth UI feature olabilir; SDK client, proxy/callback ve bootstrap provider/framework alanında kalır;
- billing UI/lifecycle feature olabilir; payment SDK config ve webhook entry adapter'dır;
- ORM/provider schema kendi convention'ında kalır;
- background job entry provider boundary'de, product behavior feature server boundary'sinde kalır;
- env/config yalnız kaynakta gerçek contract/artifact varsa gösterilir.

Feature `schemas.ts`, database schema değildir. Input, form, domain veya server validation contract'ıdır.

## Cross-Cutting Capability

Auth, search, settings, notifications, reporting, jobs, public pages, i18n veya theme yalnız user-facing behavior, lifecycle veya management surface taşıyorsa feature olur. Teknik SDK/helper/config tek başına feature değildir.

## FSD Branch

Tam Feature-Sliced Design yalnız kaynaklarda açık FSD kararı, layer/segment dili veya import/public-API kuralları varsa kullanılır. `features/` klasörü tek başına FSD sinyali değildir.

FSD seçildiyse `app/pages/widgets/features/entities/shared` ve `ui/api/model/lib/config` gibi seçilmiş proje convention'ını koru. Primary lightweight direct-shape kurallarını FSD tree'sine karıştırma.

## Fallback Framework Ownership

Fallback frameworklerde product ownership yerel kaynaklardan açık değilse primary
JS/TS ownership modelini uygulama; Source Extraction Rules'a göre soru sor. Concrete
framework yerleşimini Full-Stack Framework Hints belirler.
