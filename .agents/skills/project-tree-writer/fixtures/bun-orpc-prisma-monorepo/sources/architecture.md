# Architecture

The Bun workspace has two separately run deployables: `apps/web` and `apps/backend`.

The web app uses Vite and TanStack Router file-based routing. Its invoice route is `src/routes/invoices/index.tsx`, generated route tree is `src/routeTree.gen.ts`, router setup is `src/router.tsx`, and consumer-local oRPC client setup is `src/orpc.ts`.

The backend runs Hono on Bun from `src/index.ts`. It exposes a thin oRPC transport adapter at `src/routes/rpc.ts`; invoice procedure implementation remains in `src/features/invoices/server/procedures.ts`.

The API is contract-first. Both backend and web import the `@workspace/invoices-api` workspace package, which exports `./contract` from `src/contract.ts`.

Only the backend accesses Postgres. It owns Prisma schema and migrations under `prisma/` and config at `prisma.config.ts`. Drizzle is not used.
