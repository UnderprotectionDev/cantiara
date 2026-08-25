# Cloud Agent secrets

Cursor injects Secrets as environment variables. The app reads `process.env`; `dotenv` does not override those values. Do not copy secrets into `apps/server/.env` or `.cursor/environment.json`.

A URL pasted in chat does not survive the next **New Agent**. Hosted Neon is used only when `DATABASE_URL` is a **Personal** Cloud Agent secret.

Add these once under **Personal** scope at [Cloud Agents](https://cursor.com/dashboard/cloud-agents):

- `DATABASE_URL` — hosted Neon connection string (`sslmode=require`). The pooled hostname is the runtime value; Prisma migrate/push should use the non-pooler host.
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `BETTER_AUTH_SECRET` — at least 32 characters

Leave `NEON_LOCAL` unset. `scripts/cloud-agent/install.sh` writes a local Postgres `.env` only when `DATABASE_URL` is not already injected. `install.sh` and `start.sh` drop `NEON_LOCAL` when a hosted `DATABASE_URL` is present so a snapshot leftover cannot tunnel Neon through the local proxy.

`turbo.json` `globalPassThroughEnv` forwards those secrets into `server#dev`. Without that list, Turbo strips `DATABASE_URL` and the API falls back to the local `.env` Postgres URL.

`turbo.json` `globalPassThroughEnv` forwards those secrets into `server#dev`. Without that list, Turbo strips `DATABASE_URL` and the API falls back to the local `.env` Postgres URL.

`db push` during Cloud Agent install/start always targets local Postgres, not hosted Neon.
