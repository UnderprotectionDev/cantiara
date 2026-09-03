# Dev database seed

Synthetic demo data for manual testing and Cloud Agent sessions. The seed resets **workspace content only** (Projects, Work, Documents, Tags, and related records). It preserves the founder account, sessions, and GitHub linkage.

## When to use

- You want Projects, Work, Roadmap, Calendar, and Tags populated without clicking through create flows.
- You reset a hosted Neon dev database to a known demo state.
- You re-run seed after schema changes to refresh the fixture set.

## Prerequisites

- Migrations applied: `bun run db:migrate:deploy` (hosted) or `bun run db:migrate` (local).
- **Hosted Neon:** sign in once with GitHub so a Workspace exists, unless you set `SEED_USER_EMAIL`.
- **Local Postgres:** seed auto-provisions `seed-founder@dev.cantiara.test` when no Workspace exists.

## Commands

### Local Postgres

```bash
bun run db:seed
```

Dry run (no writes):

```bash
bun run db:seed -- --dry-run
```

### Hosted Neon

Hosted databases require an explicit confirmation:

```bash
SEED_CONFIRM=hosted scripts/cloud-agent/seed-product-database.sh bun run db:seed
```

Target a specific founder account:

```bash
SEED_USER_EMAIL=you@example.com SEED_CONFIRM=hosted scripts/cloud-agent/seed-product-database.sh bun run db:seed
```

## What gets created

| Project | Starter Configuration | Short code |
| --- | --- | --- |
| Cantiara | Solo SaaS | CNT |
| Open Docs SDK | Open Source Library | ODS |
| Mobile Beta | Mobile Application | MOB |
| Scratch | Blank Project | SCR |

The **Cantiara** project is the rich fixture: mixed Work types and statuses, Feature inclusion, horizon placement, a Milestone, a blocker relation, tags, planning dates, checklist items, and two Documents.

## Reset behavior

Each seed run clears workspace-scoped content, then reloads the demo set. User, session, and account preference rows are kept.

To wipe demo data without reloading, stop after the clear step by running with `--dry-run` after a manual clear, or use Prisma Studio.

## Implementation

- Entry: [`scripts/seed/run.ts`](../../scripts/seed/run.ts)
- Prisma wiring: [`packages/db/prisma.config.ts`](../../packages/db/prisma.config.ts)
- Domain writes use server feature seams (`createProject`, `createWork`, etc.), not raw inserts.

## Notes

- `bun run db:push` is local throwaway only; do not push against hosted `DATABASE_URL`.
- Migrate against Neon uses the direct (non-pooler) endpoint; the app runtime may use the pooled URL.
- Seed does not run in CI or on `db:migrate:deploy`.
