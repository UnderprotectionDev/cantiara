# Dev database seed

Synthetic demo data for manual testing. The seed resets **workspace content only** (Projects, Work, Documents, Tags, and related records). It preserves the founder account, sessions, and GitHub linkage.

## When to use

- You want Projects, Work, Roadmap, Calendar, and Tags populated without clicking through create flows.
- You reset a hosted Neon dev database to a known demo state.
- You re-run seed after schema changes to refresh the fixture set.

## Prerequisites

- Migrations applied: `bun run db:migrate:deploy` (hosted) or `bun run db:migrate` (local).
- **Sign in once with GitHub** so your account has a Workspace. Seed attaches to that account — no separate seed user is created.
- **Neon `DATABASE_URL`** in `apps/server/.env` (copy from Neon dashboard) or exported in the shell.

## Commands

### Local Postgres

```bash
bun run seed
```

### Hosted Neon

Seed **clears workspace content** first. Confirm explicitly:

```bash
SEED_CONFIRM=hosted bun run seed
```

Do not run seed from a Cloud Agent against the shared product Neon unless the founder asked to reset demo data.

Reads `DATABASE_URL` from the environment first, then fills missing keys from `.env` or `apps/server/.env`.

Example with an inline Neon URL:

```bash
SEED_CONFIRM=hosted DATABASE_URL='postgresql://user:pass@ep-....neon.tech/neondb?sslmode=require' bun run seed
```

Dry run (no writes):

```bash
bun run seed -- --dry-run
```

### Production-like hosted runs

Same confirmation:

```bash
SEED_CONFIRM=hosted bun run seed
```

Target a specific founder account:

```bash
SEED_USER_EMAIL=you@example.com bun run seed
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

To wipe demo data without reloading, run with `--dry-run` after a manual clear, or use Prisma Studio.

## Implementation

- Entry: [`scripts/seed/run.ts`](../../scripts/seed/run.ts)
- Env loading: [`scripts/seed/env.ts`](../../scripts/seed/env.ts)
- Domain writes use server feature seams (`createProject`, `createWork`, etc.), not raw inserts.

## Notes

- `bun run db:push` is local throwaway only; do not push against hosted `DATABASE_URL`.
- Migrate against Neon uses the direct (non-pooler) endpoint; the app runtime may use the pooled URL.
- Seed does not run in CI or on `db:migrate:deploy`.
