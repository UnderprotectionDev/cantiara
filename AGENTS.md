# Cantiara

Personal project operating system for a solo product builder. This file is the always-loaded agent contract: the _process_ every run, not a second PRD.

## Process

1. **Orient.** Name the owning glossary term, the owning numbered PRD file, and every ADR that already decided a boundary this change touches. Done when each is a path or an explicit "none" — not when the area feels familiar.
2. **Name.** Every domain name in the change is a [`CONTEXT.md`](CONTEXT.md) term, or the glossary gains that term in the same change. The `_Avoid_` list is binding.
3. **Change.** Product behavior comes from the owning PRD file. Tools and runtimes come from [`docs/tech-stack.md`](docs/tech-stack.md). Dosya sahipliği [`structure.md`](structure.md) kaynaklıdır. Architecture that would surprise a later reader is an ADR, written only when [`docs/adr/README.md`](docs/adr/README.md) would accept one.
4. **Close.** Done when every Orient path still holds, every Name is a glossary term, and every in-file rule holds. A new or changed normative PRD section is bound to an acceptance journey in [`docs/prd/16-product-acceptance.md`](docs/prd/16-product-acceptance.md).

## Glossary

**Glossary** — [`CONTEXT.md`](CONTEXT.md). Read before naming a domain concept, writing a test, or editing product copy.

A term in the glossary is not delivery scope. Scope lives in the PRD.

## Scope

**Scope** — [`docs/product-prd.md`](docs/product-prd.md) (Kapsamı okuma kuralı). Read before changing product behavior, treating a numbered PRD as delivery scope, or picking up a future direction.

First product is `01`–`15`. `16` is how to prove it. `17`–`18` stay out of delivery until their own activation rules fire. `19` is the negative boundary. The owning numbered file in [`docs/prd/`](docs/prd/) is the source of truth for that area.

**Labels** — [`docs/prd/02-domain-model-and-lifecycle.md#terim-sözlüğü`](docs/prd/02-domain-model-and-lifecycle.md#terim-sözlüğü). Read before writing UI copy or a source identifier. The English UI label is the name in code and in the interface.

## Decisions

**Decisions** — [`docs/adr/README.md`](docs/adr/README.md). Read before writing or changing an ADR, and before changing a boundary an ADR already decided.

## Stack

**Stack** — [`docs/tech-stack.md`](docs/tech-stack.md). Read before adding a dependency, changing a runtime, introducing a framework to `apps/web` or `apps/server`, or editing Wireframe code.

## Layout

**Layout** — [`structure.md`](structure.md). Feature, route, package, app veya provider dosyası yerleştirmeden önce oku. `features/`, `views/`, `routes/` gibi sahiplik sınırlarını eşle; klasör ve dosya adlarını bu ürünün terimlerine göre ver.

## Domain documents

Write [`CONTEXT.md`](CONTEXT.md), [`docs/prd/`](docs/prd/), and [`docs/adr/`](docs/adr/) in Turkish.

## Git branches

Name git branches in English.

## Skills

Installed skills live in `.agents/skills`.

**Flow** — `/ask-matt`. Read before choosing an engineering skill.

**Terms** — `/domain-modeling`. Use when a glossary term is fuzzy, overloaded, or new, or when an ADR is in play.

**Seams** — `/tdd`. Use when implementing behavior. Tests live at confirmed seams.

## Agent skills

### Issue tracker

Issues are created on GitHub; Cursor sessions may fetch the synced copy via Linear MCP. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names match GitHub labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Workspace

Schema changes go through `bun run db:migrate`. `bun run db:push` is local throwaway. TanStack Router regenerates `apps/web/src/routeTree.gen.ts`. Prisma regenerates `packages/db/prisma/generated/`.

**Local Postgres** — [`docs/tech-stack.md`](docs/tech-stack.md) (yerel geliştirme sınırı) and `scripts/neon-local-proxy.ts` when `NEON_LOCAL=true`.
