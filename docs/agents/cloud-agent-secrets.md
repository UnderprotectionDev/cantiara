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

Scope: this repository. Do not add `NEON_LOCAL`.

Runtime Secret keeps the value in the process env and redacts it from the agent transcript, tool output, and commits. Environment Variable is for public URLs and flags the agent may see.

Prisma migrate/push against Neon should use the non-pooler host. The app runtime URL may be pooled.

## How a New Agent gets them

1. Cursor injects My Secrets into the VM at start.
2. `turbo.json` `globalPassThroughEnv` forwards those names into `web#dev` and `server#dev`. Without that list Turbo strips them and the API falls back to local Postgres in `.env`.
3. `scripts/cloud-agent/install.sh` and `start.sh` write localhost fallbacks into `.env` when a key is missing, and drop `NEON_LOCAL` when `DATABASE_URL` is hosted so a snapshot leftover cannot tunnel Neon through the local proxy.

`db push` during install/start always targets local Postgres, not hosted Neon. `start.sh` then runs `prisma migrate deploy` against hosted Neon (non-pooler host) so Account Access tables exist before GitHub sign-in. If that database already has tables without migration history, deploy is skipped.

Cloud Agent `dev` sets `CANTIARA_LISTEN_HOST=0.0.0.0` so Vite accepts IPv4 port forwards (`127.0.0.1:3001`). GitHub OAuth secrets stay in process env; they are not copied into `apps/server/.env`.
