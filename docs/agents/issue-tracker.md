# Issue tracker: GitHub publish, Linear fetch

Canonical **write** is GitHub Issues in `underprotectiondev/cantiara`. Use the `gh` CLI for create, comment, label, assign, close, and blocking edges.

Canonical **read in a Cursor session** may be the Linear copy of that GitHub issue, fetched with Linear MCP after GitHub → Linear sync. Linear is a mirror, not a second tracker. If Linear MCP is missing or the issue has not synced yet, fetch with `gh`.

Do not create tickets with Linear `save_issue`. Do not close, relabel, or comment only in Linear. Do not write new implementation issues under `docs/specs/` or `.scratch/`.

Existing `docs/specs/<feature>/issues/*.md` files are the migration source. Once the same work exists as a GitHub issue, that GitHub issue is the ticket. Commit messages reference the GitHub number (`#123`), never a Linear identifier.

## Conventions

Infer the repo from `git remote` — `gh` does this automatically inside a clone.

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels. When the user named a Linear issue, Linear MCP `get_issue` first, then follow its GitHub link and run `gh issue view <number> --comments` for labels and comments.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters. Linear MCP `list_issues` is a convenience view of the synced queue; filter agent-ready work by the GitHub `ready-for-agent` label, not by Linear workflow state.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

A bare `#42` may be an issue or a PR. Resolve with `gh pr view 42` and fall back to `gh issue view 42`.

### Labels

Triage roles are GitHub labels mapped in `docs/agents/triage-labels.md`. This repo already has GitHub's default `wontfix`. Before the first publish, create any missing role labels once:

```
gh label create needs-triage --description "Maintainer needs to evaluate this issue"
gh label create needs-info --description "Waiting on reporter for more information"
gh label create ready-for-agent --description "Fully specified, ready for an AFK agent"
gh label create ready-for-human --description "Requires human implementation"
```

Tickets produced by `/to-tickets`, and markdown tickets migrated from `docs/specs/`, get **only** `ready-for-agent`. Do not also apply `needs-triage`. Incoming raw bugs and requests start unlabeled or `needs-triage`.

When publishing a migrated markdown ticket, copy the file body (including `Blocked by` and acceptance criteria) and link the feature spec `docs/specs/<feature>/spec.md`. Recreate `Blocked by` as GitHub native issue dependencies when possible.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue with `gh issue create`. Apply the mapped triage label. Do not also create a Linear issue.

## When a skill says "fetch the relevant ticket"

If the user named a Linear identifier or URL, Linear MCP `get_issue`, then `gh issue view` on the linked GitHub number. Otherwise `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single GitHub issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/underprotectiondev/cantiara/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/underprotectiondev/cantiara/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
