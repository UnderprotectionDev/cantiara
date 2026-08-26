# Cloud Agent secrets

Cursor injects [My Secrets](https://cursor.com/dashboard/cloud-agents) as process environment variables when a Cloud Agent starts. `dotenv` does not override those values. Never copy secret values into `apps/server/.env` or `.cursor/environment.json`.

A value pasted in chat does not survive the next **New Agent**.

## My Secrets — what to add

Use Cursor's types from [Secrets & Network](https://cursor.com/docs/cloud-agent/security-network):

| Name | Type | Value |
| --- | --- | --- |
| `DATABASE_URL` | Runtime Secret | Hosted Neon pooled URL (`sslmode=require`) |
| `BETTER_AUTH_SECRET` | Runtime Secret | `openssl rand -base64 32` (stable across agents) |
| `GITHUB_CLIENT_SECRET` | Runtime Secret | GitHub OAuth app client secret |
| `GITHUB_CLIENT_ID` | Runtime Secret or Environment Variable | GitHub OAuth app client id |
| `BETTER_AUTH_URL` | Environment Variable | `http://localhost:3000` |
| `CORS_ORIGIN` | Environment Variable | `http://localhost:3001` |
| `VITE_SERVER_URL` | Environment Variable | `http://localhost:3000` |
| `NODE_ENV` | Environment Variable | `development` |
| `SECURITY_EVENT_LOG_DATABASE_URL` | Runtime Secret | Separate Postgres URL for the irreversible security-event log (not `DATABASE_URL`). Local default: `postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara_security_events` |

Scope: this repository. Do not add `NEON_LOCAL`.

When `DATABASE_URL` is a hosted Neon URL, every app process (the `dev` terminal, a restarted API, `bun run --hot`) must use that value. Do not export `NEON_LOCAL=true` and do not replace `DATABASE_URL` with `127.0.0.1` Postgres. Local schema `db push` stays on the throwaway cluster; that is not the app's runtime target. Start the API with `scripts/cloud-agent/use-product-database.sh` so a leftover `NEON_LOCAL` cannot tunnel hosted Neon through the local proxy.

Runtime Secret keeps the value in the process env and redacts it from the agent transcript, tool output, and commits. Environment Variable is for public URLs and flags the agent may see.

Prisma migrate/push against Neon should use the non-pooler host. The app runtime URL may be pooled.

## How a New Agent gets them

1. Cursor injects My Secrets into the VM at start.
2. `turbo.json` `globalPassThroughEnv` forwards those names into `web#dev` and `server#dev`. Without that list Turbo strips them and the API falls back to local Postgres in `.env`.
3. `scripts/cloud-agent/install.sh` and `start.sh` write localhost fallbacks into `.env` when a key is missing, and drop `NEON_LOCAL` when `DATABASE_URL` is hosted so a snapshot leftover cannot tunnel Neon through the local proxy.

`db push` during install/start always targets local Postgres, not hosted Neon. Schema changes go through `bun run db:migrate`. `bun run db:push` is local throwaway — do not push against hosted `DATABASE_URL`. After adding a Prisma model, apply that schema to the hosted product database with `bun run db:migrate` before the API is used. A bun `--hot` process started before generate still holds a Prisma client without the new delegate; restart that API process after generate.

## Terminal commands

Cursor expands `$HOME`, `${VAR:-default}`, and `$(...)` in `.cursor/environment.json` `terminals[].command`, then types the result into an interactive bash. A substitution that emits a newline — `$(seq 1 90)` — splits the command, so `dev` and `neon-proxy` die before they bind 3000/3001/4000/5433.

Keep the warm-fork wait in the JSON command (the script may not exist yet). Use brace expansion (`for _ in {1..90}; do ...; done`), not `$(seq)`. Put URL fallbacks in `run-dev.sh`.
