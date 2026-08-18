# structure.md

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
