# Cloud Agent secrets

Cursor injects Secrets as environment variables. The app reads `process.env`; `dotenv` does not override those values. Do not copy secrets into `apps/server/.env` or `.cursor/environment.json`.

Add these once under **Personal** scope at [Cloud Agents](https://cursor.com/dashboard/cloud-agents):

- `DATABASE_URL` — hosted Neon connection string (`sslmode=require`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `BETTER_AUTH_SECRET` — at least 32 characters

Leave `NEON_LOCAL` unset. `scripts/cloud-agent/install.sh` writes a local Postgres `.env` only when `DATABASE_URL` is not already injected, and it drops `NEON_LOCAL` when a hosted `DATABASE_URL` is present.

`db push` during Cloud Agent install/start always targets local Postgres, not hosted Neon.
