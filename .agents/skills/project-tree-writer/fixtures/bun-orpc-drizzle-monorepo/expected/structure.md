# structure.md

```text
.
├── apps/
│   ├── backend/
│   │   ├── drizzle/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── index.ts
│   │   │   │   └── schema.ts
│   │   │   ├── features/
│   │   │   │   └── invoices/
│   │   │   │       └── server/
│   │   │   │           └── procedures.ts
│   │   │   ├── routes/
│   │   │   │   └── rpc.ts
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
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
