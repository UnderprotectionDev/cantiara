# Cloud Agent environment source

Cursor resolves environment configuration by first match:

1. [`.cursor/environment.json`](../../.cursor/environment.json) in this repository
2. A personal saved environment
3. A team saved environment

The committed file is the source. A Personal environment from SETUP_FLOW / Update with Agent is a leftover override: agents then boot from that snapshot instead of the file, so `install.sh` changes on `main` do not drive new agents, and warm-fork git reuse asks to fast-forward an old checkout.

Do not propose or Save a competing dashboard `environment.json`. Change [`.cursor/environment.json`](../../.cursor/environment.json) and [`scripts/cloud-agent/`](../../scripts/cloud-agent/) on a branch; start an agent on that branch to test.

Secrets, Neon vs local Postgres, and `terminals[].command` expansion: [`cloud-agent-secrets.md`](cloud-agent-secrets.md).

**Ports** — [`.cursor/environment.json`](../../.cursor/environment.json) `ports` is the durable forward list: API `3000`, web `3001`, Fumadocs `4000`, Postgres `5432`, Neon proxy `5433`. Do not delete that array. Cursor still only shows a plug-menu row while a process listens; `terminals` `dev` must keep `run-dev.sh` running so those sockets stay bound.

## Lifecycle

| Phase | Command | When |
| --- | --- | --- |
| Build | `install` → `bash scripts/cloud-agent/install.sh` | Recurring / config-change Builds clone the default branch and run this. Warm-fork agent boots skip it. |
| Boot | `start` → `bash scripts/cloud-agent/start.sh` | Every agent start: Postgres, env hygiene, deps and Prisma generate for overlayed checkouts. |
| Boot | `terminals` `dev` and `neon-proxy` | tmux after `start`. Brace-wait until the scripts exist; do not use `$(seq)` in the JSON. |

## Dashboard — make the repo file win

Open the environment: [cantiara Cloud Agent environment](https://cursor.com/dashboard/cloud-agents/environments/e/a0bcff61-a640-11f1-a7d1-d6b4613131ce).

1. Confirm the page lists **`.cursor/environment.json`**, not a Personal snapshot as the configuration source.
2. If a Personal saved environment still exists for this repo, stop using it (disable or delete). With no Personal override, the committed file is first match.
3. [Cloud Agents settings](https://cursor.com/docs/cloud-agent/settings): **Base branch** empty or `main`.
4. Builds tab: **Update stale builds** on. Do not pin an old feature-branch Build. If the active Build is from SETUP_FLOW or a feature branch, **Trigger build** so the next snapshot is `main`.

A later agent is aligned when `environment-info` reports `environmentJsonPath` as `.cursor/environment.json` (not `null`) and opening a new agent does not ask to fast-forward a stale branch.
