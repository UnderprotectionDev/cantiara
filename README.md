# Cantiara

Cantiara is a personal project operating system for a solo product builder. Product behavior is defined in [`docs/specs/`](docs/specs/), domain language in [`CONTEXT.md`](CONTEXT.md), technical responsibility ownership in [`docs/tech-stack.md`](docs/tech-stack.md), and target file ownership in [`structure.md`](structure.md).

The repository was scaffolded with Better-T-Stack. [`bts.jsonc`](bts.jsonc) retains the generator version and reproducible command as provenance; it is not the product definition.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Biome** - Linting and formatting
- **Tauri** - Build native desktop applications
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Set up a primary PostgreSQL database and a separate PostgreSQL project for the append-only security-event log. The two connection strings must not share a restore unit or credentials.
2. Copy `apps/server/.env.example` to `apps/server/.env.local`, replace `BETTER_AUTH_SECRET` with at least 32 random characters, then add both PostgreSQL connection strings.

3. Generate a versioned migration from the Drizzle schema:

```bash
bun run db:generate
bun run db:security:generate
```

4. Review the generated SQL in `packages/db/src/migrations/` and `packages/db/src/migrations/security-events/`, then apply each migration to its owning database:

```bash
bun run db:migrate
bun run db:security:migrate
```

`bun run db:push` is only for a disposable local database. Product schema changes use reviewed, versioned migrations.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
bunx --bun shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@cantiara/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns a committed T3 Env schema in `src/env.ts`. Keep secrets in ignored `.env.local` files or the deployment platform, and access validated values through the exported `env` object.

The web schema exposes only `VITE_` variables from `import.meta.env`. The server schema validates `process.env`; shared database and auth packages continue to receive configuration or initialized clients from their owning application.

## Formatting

- Run repository checks: `bun run check`
- Run staged-file checks: `bun run check:ultracite -- <staged_files>`
- Pre-commit checks: Lefthook runs the staged-file command with the Ultracite preset and stages safe fixes.

## Project Structure

```
cantiara/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   ├── server/      # Backend API (Hono, ORPC)
│   ├── extension/   # Browser extension scaffold (WXT)
│   └── fumadocs/    # Documentation application (Next.js + Fumadocs)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:types`: Watch API and dependency declarations when running an app individually. The root `dev` command already starts this watcher; installation and builds generate declarations automatically.
- `bun run db:generate`: Generate a versioned SQL migration from the Drizzle schema
- `bun run db:security:generate`: Generate a versioned SQL migration for the separate security-event database
- `bun run db:migrate`: Apply reviewed versioned migrations
- `bun run db:security:migrate`: Apply reviewed security-event migrations outside the primary restore unit
- `bun run db:push`: Push schema changes only to a disposable local database
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Biome formatting and linting
- `bun run test:e2e`: Run the Account Access Playwright journey against the configured temporary PostgreSQL boundaries
- `cd apps/web && bun run desktop:dev`: Start Tauri desktop app in development
- `cd apps/web && bun run desktop:build`: Build Tauri desktop app

### macOS package release

The `.github/workflows/macos-release.yml` workflow builds only signed and notarized macOS `app` and `dmg` artifacts. It runs for `cantiara-v*` tags and keeps the GitHub Release as a draft until the macOS 26, macOS 15, and macOS 14 clean-install matrix is accepted for both package targets. Successful runs upload immutable evidence manifests containing the exact source/workflow identity, macOS version, device architecture, package digest, signing checks, and the combined acceptance-candidate result; the candidate manifest, its checksum, and a raw signing/install evidence archive are also attached to the draft release. Each temporary Actions evidence reference records its authenticated GitHub artifact URL/ID/digest and uses the 90-day Actions retention limit; the signed release assets and acceptance evidence archive remain on the GitHub draft release. Release assets are immutable, so rerunning a tag requires a new release tag rather than overwriting evidence.

Configure the `CANTIARA_API_URL` GitHub repository variable and these GitHub Actions secrets before creating a release tag:

- `APPLE_CERTIFICATE`: Base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: Password for the `.p12`
- `APPLE_SIGNING_IDENTITY`: Exact `Developer ID Application: ...` keychain identity
- `APPLE_API_KEY`: App Store Connect API key ID
- `APPLE_API_ISSUER`: App Store Connect issuer ID
- `APPLE_API_PRIVATE_KEY`: Contents of the matching `.p8` private key
