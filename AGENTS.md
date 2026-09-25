# Cantiara

Personal project operating system for a solo product builder. This file is the always-loaded agent process.

## Process

1. **Orient.** Before changing behavior, name the owning [`CONTEXT.md`](CONTEXT.md) term, owning [`docs/specs/`](docs/specs/) `spec.md`, and every [`docs/adr/`](docs/adr/) decision whose boundary the change touches. Each must resolve to a path or explicit `none`.
2. **Name.** Use glossary terms for domain names and the owning spec's exact English UI labels in code, tests, and product copy. The glossary `_Avoid_` lists are binding; add a genuinely new term in the same change.
3. **Stack.** Before implementation, map every technical responsibility to [`docs/tech-stack.md`](docs/tech-stack.md) and inspect the nearest repository example. Name the selected entry and example path or `none`; bring missing, ambiguous, or inadequate choices to the user before changing code or dependencies.
4. **Change.** Take product behavior and test seams from the owning spec, and file ownership from [`structure.md`](structure.md). Implement behavior test-first at the spec's Testing Decisions seam. Record only surprising, costly architectural boundaries that [`docs/adr/README.md`](docs/adr/README.md) accepts.
5. **Close.** Recheck every Orient path, glossary name, Stack mapping, test seam, generated-file rule, and in-file instruction. Bind every new or changed spec section to Testing Decisions in that spec.

## Conditional references

- **Domain documents:** Before editing the glossary or an ADR, read [`docs/agents/domain.md`](docs/agents/domain.md). Write `CONTEXT.md` and ADRs in Turkish.
- **Authentication:** Treat GitHub login, sessions, and cookies as security-sensitive. Verify the installed Better Auth version's current API and security guidance, then test required failure paths at the Account Access seam.
- **Issues:** At task start, check Conductor's inherited issue context and canonical `.context/attachments/[GITHUB]-*.md` attachments. If an issue was selected, resolve and read it before implementation using [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md). Read that guide before other tracker access too. GitHub Issues is canonical; role labels follow [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).
- **Implement close-out:** After implementation, tests, and review, follow [`docs/agents/implement-close-out.md`](docs/agents/implement-close-out.md).

## Repository guardrails

- Write Git branch names in English.
- Apply schema changes with `bun run db:migrate`; reserve `bun run db:push` for disposable local databases. Drizzle Kit generates versioned SQL in `packages/db/src/migrations/` from `packages/db/src/schema/`.
- **Schema migrations:** When a task changes the database schema, generate and verify its versioned migration in the same task or selected issue. Before applying it to a shared database, follow "Paralel geliştirmede paylaşılan veritabanı" in [`docs/tech-stack.md`](docs/tech-stack.md); stop if histories diverge.
- Treat `apps/web/src/routeTree.gen.ts` as TanStack Router generated output.
- When `NEON_LOCAL=true`, use the local PostgreSQL boundary in [`docs/tech-stack.md`](docs/tech-stack.md) and `scripts/neon-local-proxy.ts`.
