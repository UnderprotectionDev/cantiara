# JS/TS Structure Examples

Bu dosya normatif değildir. Ağaçlar, Architecture Decision Rules, ilgili topology
referansı, Full-Stack Framework Hints ve Output Format kararlarının örnek
bileşimleridir; çelişkide normatif referanslar kazanır. Final output yalnız kullanıcı
kaynaklarından çıkan concrete app, feature, route ve package adlarını kullanır.

## İçindekiler

- Next.js ve TanStack/Hono normal repo
- Pnpm/Turborepo ve Bun/oRPC monorepo
- Nx app-scoped feature ve explicit FSD

## Next.js Normal Repo

```text
.
├── src/
│   ├── app/
│   │   └── orders/
│   │       └── page.tsx
│   ├── features/
│   │   └── orders/
│   │       ├── components/
│   │       ├── forms/
│   │       ├── server/
│   │       ├── views/
│   │       └── schemas.ts
│   ├── lib/
│   │   └── auth.ts
│   └── proxy.ts
├── package.json
└── tsconfig.json
```

Yalnız kaynakta auth proxy ve app-wide auth client varsa `proxy.ts` ile `lib/auth.ts` gösterilir. `index.ts` veya concrete server filename otomatik değildir.

## TanStack Router + Hono Normal Repo

```text
.
├── src/
│   ├── features/
│   │   └── invoices/
│   │       ├── server/
│   │       ├── views/
│   │       └── schemas.ts
│   ├── routes/
│   │   ├── invoices/
│   │   │   └── index.tsx
│   │   └── __root.tsx
│   ├── server/
│   │   ├── routes/
│   │   │   └── invoices.ts
│   │   └── index.ts
│   ├── routeTree.gen.ts
│   └── router.tsx
├── package.json
└── vite.config.ts
```

Bu shape yalnız frontend ve Hono aynı deployable olduğunda kullanılır.

## Pnpm/Turborepo Multi-App

```text
.
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   └── orders/
│   │   │   │       └── server/
│   │   │   └── routes/
│   │   └── package.json
│   ├── mobile/
│   │   ├── src/
│   │   │   └── features/
│   │   │       └── orders/
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   └── features/
│       │       └── orders/
│       └── package.json
├── packages/
│   └── contracts/
│       └── orders-api/
│           ├── src/
│           └── package.json
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

`contracts/orders-api` yalnız iki gerçek client aynı contract'ı tüketiyorsa bulunur. `packages/backend`, `packages/db` veya `packages/features` default değildir.

## Bun + TanStack Router + Hono + oRPC Monorepo

Contract-first ve Prisma seçilmiş örnek:

```text
.
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   └── invoices/
│   │   │   │       └── server/
│   │   │   │           └── procedures.ts
│   │   │   ├── routes/
│   │   │   │   └── rpc.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── prisma.config.ts
│   └── web/
│       ├── src/
│       │   ├── features/
│       │   │   └── invoices/
│       │   │       └── views/
│       │   ├── routes/
│       │   │   ├── invoices/
│       │   │   │   └── index.tsx
│       │   │   └── __root.tsx
│       │   ├── orpc.ts
│       │   ├── routeTree.gen.ts
│       │   └── router.tsx
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── contracts/
│       └── invoices-api/
│           ├── src/
│           │   └── contract.ts
│           └── package.json
├── bun.lock
└── package.json
```

Yalnız backend persistence kullandığı için Prisma app-local kalır. Drizzle seçilmiş varyantta backend persistence kısmı şöyledir:

```text
apps/
  backend/
    drizzle/
    src/
      db/
        index.ts
        schema.ts
    drizzle.config.ts
```

Prisma ve Drizzle aynı tree'de birlikte gösterilmez. Contract package yalnız backend implementation ile web client'ın ortak tüketimi kaynakta kanıtlandığı için açılır.

## Nx App-Scoped Feature

```text
.
├── apps/
│   └── web/
│       ├── src/
│       └── project.json
├── libs/
│   └── web/
│       └── feature-orders/
│           ├── src/
│           └── project.json
├── nx.json
└── package.json
```

Bu feature library app-specific olabilir; `libs/` altında olması cross-app olduğu anlamına gelmez.

## Explicit FSD

```text
.
└── src/
    ├── app/
    ├── entities/
    ├── features/
    ├── pages/
    └── shared/
```

Yalnız açık FSD kararı varsa kullanılır. Lightweight primary feature shape ile FSD segmentlerini karıştırma.
