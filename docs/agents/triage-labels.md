# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the GitHub label strings. Linear may mirror the same names after GitHub sync; GitHub is the source of truth. Do not treat a Linear workflow state (`Todo`, `In Progress`, `Done`) as a substitute for these labels.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

`wontfix` already exists as a GitHub default label. The other four must be created before first publish (see `docs/agents/issue-tracker.md`).

Migrated `/to-tickets` files from `docs/specs/` go to GitHub with **only** `ready-for-agent`.
