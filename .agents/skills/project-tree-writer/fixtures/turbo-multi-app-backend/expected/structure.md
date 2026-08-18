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
│   │   │   │   └── orders/
│   │   │   │       ├── server/
│   │   │   │       └── schemas.ts
│   │   │   └── routes/
│   │   │       └── orders.ts
│   │   └── package.json
│   ├── mobile/
│   │   ├── src/
│   │   │   └── features/
│   │   │       └── orders/
│   │   │           ├── components/
│   │   │           └── views/
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   └── orders/
│       │   │       └── page.tsx
│       │   └── features/
│       │       └── orders/
│       │           ├── components/
│       │           └── views/
│       └── package.json
├── packages/
│   └── contracts/
│       └── orders-api/
│           ├── src/
│           │   └── schemas.ts
│           └── package.json
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```
