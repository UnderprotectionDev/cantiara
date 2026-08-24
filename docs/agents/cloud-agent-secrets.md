# Cloud Agent secrets

Cursor Secrets are how a new Cloud Agent gets hosted Neon and GitHub OAuth without pasting values into chat. They are injected as environment variables. `scripts/cloud-agent/install.sh` copies them into gitignored `apps/server/.env`.

Add these once under **Personal** scope at [Cloud Agents](https://cursor.com/dashboard/cloud-agents):

- `DATABASE_URL` — hosted Neon connection string (`sslmode=require`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `BETTER_AUTH_SECRET` — at least 32 characters; omit only if a generated local secret is enough

Do not put these values in `.cursor/environment.json`, Dockerfiles, or the repository. Hosted `DATABASE_URL` leaves `NEON_LOCAL` unset. Missing secrets fall back to local Postgres plus `NEON_LOCAL=true`.

`bun run db:push` during Cloud Agent install/start always targets local Postgres, not hosted Neon.
