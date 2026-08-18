# Full-Stack Framework Hints

Bu dosya framework/provider convention ipuçlarını taşır. Product ownership için
Architecture Decision Rules, app/package sınırı için ilgili topology referansı
kazanır.

## İçindekiler

- Next.js, TanStack Router/Start, Vite, React Router
- Hono, Bun ve oRPC
- Prisma, Drizzle, Convex, Supabase ve Firebase
- SvelteKit, Rails ve Laravel fallback'leri

## Next.js App Router

Yapısal entry'ler:

- `src/app` veya kaynakta seçilmiş root `app`;
- `page`, `layout`, `loading`, `error`, `not-found` ve `route` special files;
- route groups `(group)` ve dynamic segments `[id]`;
- request proxy seçildiyse `src/proxy.ts` veya app ile aynı seviyedeki root `proxy.ts`.

Greenfield sürümü belirtilmemişse güncel stable convention kullan. Kaynak açıkça eski sürüm ve `middleware.ts` seçiyorsa o source convention'ını koru.

Next.js project organization tek başına product ownership seçmez.

## TanStack Router

File-based routing seçildiyse yapısal entry'ler:

- `src/routes`;
- `src/routeTree.gen.ts`;
- `src/router.tsx`;
- `src/routes/__root.tsx` veya kaynakta seçilmiş eşdeğer root route;
- capability için `index.tsx`, flat veya directory route files.

File-based routing hedefinde root route entry görünür olmalıdır; kaynak başka root route
adı seçmedikçe `__root.tsx` kullan. Code-based veya virtual routing seçildiyse file tree
uydurma; gerçek config'i göster. Generated route tree runtime/source boundary olarak
kullanılıyorsa hedef tree'de bulunabilir.

## Vite

Vite config deployable web app'in project root'unda kalır; monorepo root'una yalnız gerçekten root'tan çalışan ortak Vite config kararı varsa taşınır. TanStack Router Vite plugin'i seçilmişse app-local `vite.config.ts`, `src/routes` ve `src/routeTree.gen.ts` aynı web project sınırında gösterilebilir.

Vite'ın monorepo dışı source importlarını desteklemesi tek başına package boundary kanıtı değildir. Workspace package dependency/exports sinyalini ayrıca ara.

## TanStack Start

TanStack Router convention'larına ek olarak server functions/routes bulunabilir. `src/start.ts` genel zorunlu dosya değildir; request middleware, auth middleware, CSRF/custom middleware veya server bootstrap gerçekten seçildiyse gösterilir.

Server route entry ownership'ini Architecture Decision Rules belirler.

## Hono

Hono aynı deployable içindeyse app-wide server composition `src/server` altında bulunabilir:

```text
src/
  server/
    routes/
    index.ts
```

Ayrı deploy edilen Hono API monorepo'da `apps/backend` veya concrete app adı altında bulunur. Hono RPC client/types, tRPC veya oRPC kaynakta seçilmediyse uydurulmaz.

## Bun

Bun package manager workspace'i root `package.json#workspaces` ve `bun.lock` ile temsil edilir. Hono Bun app entry'si varsayılan olarak app-local `src/index.ts` olabilir; farklı runtime adapter veya entry kaynakta seçilmişse onu koru.

Root workspace manifestini backend runtime entry'si gibi gösterme. Her deployable kendi manifest/config/source sınırını taşır.

## oRPC

Monorepo'da oRPC modelini kaynak sinyalinden seç:

- contract-first: shared contract leaf package, backend implementation ve consumer-local client adapter;
- service-first: dedicated service package yalnız app'lerin bu server component'i workspace dependency olarak tükettiği açıkça seçilmişse;
- hybrid: contract ve service package'larını ayrı consumer/dependency kanıtlarıyla göster.

Contract-first ve iki consumer varsa mevcut grouped convention `packages/contracts/<capability>-api` leaf package'ını kullanır. Hono handler ince transport adapter, procedure/use-case behavior backend feature owner'ında kalır. Web oRPC client setup'ı web app'e aittir.

TypeScript project reference, `composite` ve workspace protocol config'lerini yalnız manifest/architecture kaynağı seçmişse göster; type paylaşımı için backend source'una belirsiz deep import hedefleme.

## React Router Framework Mode

Greenfield Framework Mode route config'i `app/routes.ts`, root document `app/root.tsx` convention'ını kullanır. Primary `src/` default'uyla bunlar `src/app` altında gösterilebilir.

File route convention açıkça seçildiyse `@react-router/fs-routes` ile `app/routes/` source boundary gösterilebilir. Remix v2 kaynağı bu branch'i güçlendirir; bunu her React Router projesinin default'u sayma.

## Prisma ve Drizzle

- Prisma schema/migrations, onu kullanan project/app'in `prisma/` alanında; `prisma.config.ts` seçilmişse aynı project root'unda kalır.
- Drizzle schema/client kaynakta seçilmiş `src/db` veya eşdeğer owner altında; `drizzle.config.ts` project root'unda, SQL migration output'u kaynakta seçilmişse app-local `drizzle/` altında kalır.
- Monorepo'da yalnız backend DB kullanıyorsa persistence `apps/backend` tarafından sahiplenilir.
- `packages/db` ancak gerçek import/package kararı varsa düşünülür; default değildir.
- Prisma ve Drizzle aynı persistence rolünün alternatifleridir; birlikte kullanım kararı yoksa tek tree'de birleştirilmez.

## Convex, Supabase ve Firebase

Provider schema/function source'u deploy edilen backend owner'ında kalır. Normal repo'da provider convention root'u; monorepo'da ortak backend seçilmişse `apps/backend` kullanılır.

Frontend product UI kendi app feature'ında kalır. Generated client/contract için ayrı package ancak gerçek cross-app import sınırı varsa açılır.

## SvelteKit Fallback

`src/routes` ve `src/lib` convention'ını koru. Product ownership için repo açık signal vermiyorsa JS primary structure'ını dayatma; soru sor.

## Rails Fallback

Yaygın framework sınırları:

```text
app/
  controllers/
  models/
  views/
config/
  routes.rb
```

Repo kullanıyorsa policies, jobs, services veya domain-specific areas eklenebilir. `src/features` üretme.

## Laravel Fallback

Yaygın framework sınırları:

```text
app/
  Http/
    Controllers/
  Models/
routes/
  web.php
resources/
  views/
```

Repo/source convention'ı olmadan JS-style route veya feature klasörü dayatma.
