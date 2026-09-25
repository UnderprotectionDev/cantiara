# structure.md

> This tree records source-backed ownership boundaries. Future feature names remain in specs until source exists, and generated files are omitted.

```text
.
├── .github/
│   └── workflows/
│       ├── integration-tests.yml
│       ├── code-quality.yml
│       ├── macos-release.yml
│       └── pre-merge-validation.yml
├── apps/
│   ├── extension/
│   │   ├── entrypoints/
│   │   │   ├── popup/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── index.html
│   │   │   │   └── main.tsx
│   │   │   └── background.ts
│   │   ├── src/
│   │   │   └── features/
│   │   │       └── capture-triage/
│   │   │           └── web-capture.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── web-ext.config.ts
│   │   └── wxt.config.ts
│   ├── fumadocs/
│   │   ├── content/
│   │   │   └── docs/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (home)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── api/
│   │   │   │   │   └── search/
│   │   │   │   │       └── route.ts
│   │   │   │   ├── docs/
│   │   │   │   │   ├── [[...slug]]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── llms-full.txt/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── llms.mdx/
│   │   │   │   │   └── docs/
│   │   │   │   │       └── [[...slug]]/
│   │   │   │   │           └── route.ts
│   │   │   │   ├── llms.txt/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── og/
│   │   │   │   │   └── docs/
│   │   │   │   │       └── [...slug]/
│   │   │   │   │           └── route.tsx
│   │   │   │   ├── global.css
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   └── mdx.tsx
│   │   │   └── lib/
│   │   │       ├── cn.ts
│   │   │       ├── layout.shared.tsx
│   │   │       ├── shared.ts
│   │   │       └── source.ts
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   ├── proxy.ts
│   │   └── tsconfig.json
│   ├── server/
│   │   ├── e2e/
│   │   │   └── account-access-server.ts
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── backlog/
│   │   │   │   │   └── server/
│   │   │   │   ├── account-access/
│   │   │   │   │   └── server/
│   │   │   │   ├── account-preferences/
│   │   │   │   │   └── server/
│   │   │   │   ├── completion-effects/
│   │   │   │   │   └── server/
│   │   │   │   ├── capture-triage/
│   │   │   │   │   └── server/
│   │   │   │   ├── file-attachments/
│   │   │   │   │   └── server/
│   │   │   │   ├── external-handoffs/
│   │   │   │   │   └── server/
│   │   │   │   ├── custom-fields/
│   │   │   │   │   └── server/
│   │   │   │   ├── mutation-and-undo/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-shell/
│   │   │   │   │   └── server/
│   │   │   │   ├── priority-metrics/
│   │   │   │   ├── prioritization-sessions/
│   │   │   │   │   └── server/
│   │   │   │   ├── record-actions/
│   │   │   │   │   └── server/
│   │   │   │   ├── relations/
│   │   │   │   │   └── server/
│   │   │   │   ├── web-macos-client/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-drafts/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-lifecycle/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-templates/
│   │   │   │   │   └── server/
│   │   │   │   └── workspace-overview/
│   │   │   │       └── server/
│   │   │   ├── app.test.ts
│   │   │   ├── app.ts
│   │   │   ├── context.ts
│   │   │   ├── env.test.ts
│   │   │   ├── env.ts
│   │   │   ├── index.ts
│   │   │   └── services.ts
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsdown.config.ts
│   └── web/
│       ├── e2e/
│       │   ├── bulk-editing.e2e.ts
│       │   ├── account-preferences.e2e.ts
│       │   ├── completion-effects.e2e.ts
│       │   ├── prioritization-sessions.e2e.ts
│       │   ├── account-sessions.e2e.ts
│       │   ├── capture-inbox.e2e.ts
│       │   ├── client-shell.e2e.ts
│       │   ├── command-palette.e2e.ts
│       │   ├── custom-fields.e2e.ts
│       │   ├── kanban.e2e.ts
│       │   ├── project-shell.e2e.ts
│       │   ├── record-actions.e2e.ts
│       │   ├── web-capture-extension.e2e.ts
│       │   ├── work-blockers.e2e.ts
│       │   ├── work-drafts.e2e.ts
│       │   ├── work-lifecycle.e2e.ts
│       │   └── work-templates.e2e.ts
│       ├── src/
│       │   ├── components/
│       │   │   ├── header.tsx
│       │   │   ├── loader.tsx
│       │   │   ├── mode-toggle.tsx
│       │   │   ├── theme-provider.test.ts
│       │   │   ├── theme-provider.tsx
│       │   │   └── user-menu.tsx
│       │   ├── features/
│       │   │   ├── backlog/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           └── project-backlog.tsx
│       │   │   ├── bulk-editing/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           └── bulk-edit-dialog.tsx
│       │   │   ├── account-access/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-account-sessions.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── github-identity-confirmation.test.ts
│       │   │   │   │   ├── github-identity-confirmation.ts
│       │   │   │   │   ├── github-identity-grant-events.ts
│       │   │   │   │   ├── github-sign-in-url.test.ts
│       │   │   │   │   ├── github-sign-in-url.ts
│       │   │   │   │   ├── tauri-session.test.ts
│       │   │   │   │   └── tauri-session.ts
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       │   ├── github-waiting-status.test.tsx
│       │   │   │       │   ├── github-waiting-status.tsx
│       │   │   │       │   ├── revoke-confirmation.tsx
│       │   │   │       │   ├── sessions-section.tsx
│       │   │   │       │   └── sessions-skeleton.tsx
│       │   │   │       ├── forms/
│       │   │   │       │   └── github-sign-in.tsx
│       │   │   │       └── views/
│       │   │   │           ├── account-view.test.tsx
│       │   │   │           └── account-view.tsx
│       │   │   ├── account-preferences/
│       │   │   │   ├── lib/
│       │   │   │   │   ├── account-preferences-format.test.ts
│       │   │   │   │   ├── account-preferences-format.ts
│       │   │   │   │   ├── account-preferences-mutation-error.test.ts
│       │   │   │   │   ├── account-preferences-mutation-error.ts
│       │   │   │   │   ├── browser-preference-suggestion.test.ts
│       │   │   │   │   └── browser-preference-suggestion.ts
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       │   └── account-preferences-form.tsx
│       │   │   │       └── views/
│       │   │   │           ├── preferences-view.test.tsx
│       │   │   │           └── preferences-view.tsx
│       │   │   ├── completion-effects/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-user-initiated-work-success.ts
│       │   │   │   ├── lib/
│       │   │   │   │   └── completion-effects-presentation.ts
│       │   │   │   ├── store/
│       │   │   │   │   └── user-initiated-work-success.ts
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       │   ├── completion-effect-specimen.css
│       │   │   │       │   └── completion-effect-specimen.tsx
│       │   │   │       │   ├── work-completion-feedback.css
│       │   │   │       │   └── work-completion-feedback.tsx
│       │   │   │       ├── forms/
│       │   │   │       │   └── completion-effects-form.tsx
│       │   │   │       └── views/
│       │   │   │           └── completion-effects-view.tsx
│       │   │   ├── capture-triage/
│       │   │   │   ├── hooks/
│       │   │   │   │   ├── use-capture-inbox.ts
│       │   │   │   │   └── use-extension-links.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── capture-inbox.ts
│       │   │   │   │   └── sequential-triage.ts
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       │   ├── bulk-sense-making.tsx
│       │   │   │       │   ├── capture-inbox-item-actions.tsx
│       │   │   │       │   ├── capture-inbox-surface.tsx
│       │   │   │       │   └── extension-links-section.tsx
│       │   │   │       ├── forms/
│       │   │   │       │   ├── capture-inbox-form.test.ts
│       │   │   │       │   └── capture-inbox-form.tsx
│       │   │   │       └── views/
│       │   │   │           ├── capture-inbox-view.test.tsx
│       │   │   │           └── capture-inbox-view.tsx
│       │   │   ├── command-palette/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-command-palette-source.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── command-palette-commands.ts
│       │   │   │   │   ├── command-palette-source.test.ts
│       │   │   │   │   └── command-palette-source.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── command-palette.test.tsx
│       │   │   │           └── command-palette.tsx
│       │   │   ├── custom-fields/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-custom-fields.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── custom-field-editor.test.tsx
│       │   │   │           └── custom-field-editor.tsx
│       │   │   │           ├── custom-field-values-form.test.tsx
│       │   │   │           └── custom-field-values-form.tsx
│       │   │   ├── external-handoffs/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-external-handoffs.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── external-execution-handoff.test.tsx
│       │   │   │           └── external-execution-handoff.tsx
│       │   │   ├── priority-metrics/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-priority-metrics.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── priority-metric-editor.test.tsx
│       │   │   │           ├── priority-metric-editor.tsx
│       │   │   │           └── priority-metric-values-form.tsx
│       │   │   ├── prioritization-sessions/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-prioritization-sessions.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── session-order.test.ts
│       │   │   │   │   └── session-order.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           └── prioritization-surface.tsx
│       │   │   ├── relations/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── work-relations.test.tsx
│       │   │   │           └── work-relations.tsx
│       │   │   ├── project-overview/
│       │   │   │   ├── lib/
│       │   │   │   │   └── project-overview.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── project-overview-sections.tsx
│       │   │   │           ├── project-overview.test.tsx
│       │   │   │           └── project-overview.tsx
│       │   │   ├── project-shell/
│       │   │   │   ├── hooks/
│       │   │   │   │   ├── use-project-area-enable.ts
│       │   │   │   │   ├── use-project-configuration.ts
│       │   │   │   │   ├── use-project-shell-data.ts
│       │   │   │   │   └── use-project-short-code.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── project-area-navigation.ts
│       │   │   │   │   ├── project-list.ts
│       │   │   │   │   ├── project-shell-explanation.ts
│       │   │   │   │   ├── project-shell-navigation.test.ts
│       │   │   │   │   └── project-shell-navigation.ts
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       │   ├── project-area-availability.tsx
│       │   │   │       │   ├── project-area-catalog.tsx
│       │   │   │       │   ├── project-row.tsx
│       │   │   │       │   ├── project-shell-surface.tsx
│       │   │   │       │   └── projects-list-states.tsx
│       │   │   │       ├── forms/
│       │   │   │       │   ├── project-configuration-form.tsx
│       │   │   │       │   ├── project-create-form.tsx
│       │   │   │       │   └── project-short-code-form.tsx
│       │   │   │       └── views/
│       │   │   │           ├── project-create-view.tsx
│       │   │   │           ├── project-shell-view.tsx
│       │   │   │           └── projects-view.tsx
│       │   │   ├── web-macos-client/
│       │   │   │   ├── hooks/
│       │   │   │   │   ├── use-health-check.ts
│       │   │   │   │   └── use-client-shell.ts
│       │   │   │   ├── lib/
│       │   │   │   │   ├── client-shell-format.ts
│       │   │   │   │   ├── client-shell.test.ts
│       │   │   │   │   ├── client-shell.ts
│       │   │   │   │   ├── macos-package-contract.test.ts
│       │   │   │   │   ├── macos-package-contract.ts
│       │   │   │   │   ├── support-reference.ts
│       │   │   │   │   ├── updater.test.ts
│       │   │   │   │   └── updater.ts
│       │   │   │   ├── store/
│       │   │   │   │   └── client-shell.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── client-shell.test.tsx
│       │   │   │           ├── client-shell.tsx
│       │   │   │           ├── support-reference.test.tsx
│       │   │   │           └── support-reference.tsx
│       │   │   ├── record-actions/
│       │   │   │   ├── hooks/
│       │   │   │   │   ├── use-record-action-runner.ts
│       │   │   │   │   └── use-record-actions.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── record-action-editor.test.tsx
│       │   │   │           ├── record-action-editor.tsx
│       │   │   │           └── record-action-runner.tsx
│       │   │   ├── work-context/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── work-context-card-layout-editor.test.tsx
│       │   │   │           ├── work-context-card-layout-editor.tsx
│       │   │   │           ├── work-context-card.test.tsx
│       │   │   │           ├── work-context-card.tsx
│       │   │   │           ├── work-context-markdown.test.ts
│       │   │   │           └── work-context-markdown.ts
│       │   │   ├── work-checklists/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── work-checklist-editor.tsx
│       │   │   │           ├── work-checklist-items.test.ts
│       │   │   │           ├── work-checklist-items.ts
│       │   │   │           ├── work-checklist.test.tsx
│       │   │   │           └── work-checklist.tsx
│       │   │   ├── work-drafts/
│       │   │   │   └── ui/
│       │   │   │       └── forms/
│       │   │   │           ├── draft-custom-fields.test.ts
│       │   │   │           ├── draft-custom-fields.ts
│       │   │   │           └── work-draft-form.tsx
│       │   │   ├── kanban/
│       │   │   │   ├── lib/
│       │   │   │   │   ├── kanban-card-summary.test.ts
│       │   │   │   │   ├── kanban-card-summary.ts
│       │   │   │   │   ├── kanban-status.test.ts
│       │   │   │   │   ├── kanban-status.ts
│       │   │   │   │   ├── kanban-view.test.ts
│       │   │   │   │   └── kanban-view.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── kanban-board.test.tsx
│       │   │   │           ├── kanban-board.tsx
│       │   │   │           ├── kanban-list.test.tsx
│       │   │   │           ├── kanban-list.tsx
│       │   │   │           ├── kanban-work-summary.tsx
│       │   │   │           └── project-work-kanban.tsx
│       │   │   ├── work-lifecycle/
│       │   │       └── ui/
│       │   │           ├── components/
│       │   │           │   ├── project-work-list.tsx
│       │   │           │   ├── scope-tree.test.tsx
│       │   │           │   └── scope-tree.tsx
│       │   │           └── forms/
│       │   │               ├── work-create-form.tsx
│       │   │               ├── work-merge-form.tsx
│       │   │               ├── work-recreate-form.tsx
│       │   │               ├── work-status-form.test.ts
│       │   │               └── work-status-form.tsx
│       │   │   ├── work-templates/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-work-templates.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── work-duplicate-form.test.tsx
│       │   │   │           ├── work-duplicate-form.tsx
│       │   │   │           ├── work-template-editor.test.tsx
│       │   │   │           └── work-template-editor.tsx
│       │   │   └── workspace-overview/
│       │   │       └── ui/
│       │   │           └── components/
│       │   │               ├── workspace-overview.test.tsx
│       │   │               ├── saved-project-lists.tsx
│       │   │               └── workspace-overview.tsx
│       │   ├── lib/
│       │   │   ├── auth-client.ts
│       │   │   ├── clipboard.ts
│       │   │   └── mutation-messages.ts
│       │   ├── routes/
│       │   │   ├── _auth/
│       │   │   │   ├── account/
│       │   │   │   │   ├── index.tsx
│       │   │   │   │   ├── completion-effects.tsx
│       │   │   │   │   └── preferences.tsx
│       │   │   │   ├── capture/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── projects/
│       │   │   │   │   ├── $projectId/
│       │   │   │   │   │   └── index.tsx
│       │   │   │   │   ├── index.tsx
│       │   │   │   │   └── new.tsx
│       │   │   │   ├── dashboard.tsx
│       │   │   │   └── route.tsx
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx
│       │   │   └── login.tsx
│       │   ├── utils/
│       │   │   ├── orpc.test.ts
│       │   │   └── orpc.ts
│       │   ├── env.ts
│       │   ├── index.css
│       │   └── main.tsx
│       ├── src-tauri/
│       │   ├── capabilities/
│       │   │   └── default.json
│       │   ├── src/
│       │   │   ├── lib.rs
│       │   │   └── main.rs
│       │   ├── build.rs
│       │   ├── Cargo.lock
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── .env.example
│       ├── components.json
│       ├── index.html
│       ├── package.json
│       ├── playwright.config.ts
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   │   └── index.ts
│   │   │   ├── account-preferences.ts
│   │   │   ├── completion-effects.test.ts
│   │   │   ├── completion-effects.ts
│   │   │   ├── capture-triage.ts
│   │   │   ├── context.ts
│   │   │   ├── file-attachments.test.ts
│   │   │   ├── file-attachments.ts
│   │   │   ├── custom-fields.test.ts
│   │   │   ├── custom-fields.ts
│   │   │   ├── priority-metrics.test.ts
│   │   │   ├── priority-metrics.ts
│   │   │   ├── backlog.test.ts
│   │   │   ├── backlog.ts
│   │   │   ├── prioritization-sessions.test.ts
│   │   │   ├── prioritization-sessions.ts
│   │   │   ├── desktop-api-window.test.ts
│   │   │   ├── desktop-api-window.ts
│   │   │   ├── external-handoffs.test.ts
│   │   │   ├── external-handoffs.ts
│   │   │   ├── index.ts
│   │   │   ├── mutation-and-undo.ts
│   │   │   ├── project-overview.ts
│   │   │   ├── project-shell.ts
│   │   │   ├── record-actions.test.ts
│   │   │   ├── record-actions.ts
│   │   │   ├── relations.ts
│   │   │   ├── support-reference.ts
│   │   │   ├── web-capture.ts
│   │   │   ├── work-context.test.ts
│   │   │   ├── work-context.ts
│   │   │   ├── work-drafts.test.ts
│   │   │   ├── work-drafts.ts
│   │   │   ├── work-lifecycle.ts
│   │   │   ├── work-templates.test.ts
│   │   │   ├── work-templates.ts
│   │   │   ├── workspace-overview.test.ts
│   │   │   └── workspace-overview.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── auth/
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config/
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   ├── db/
│   │   ├── scripts/
│   │   │   ├── migration-selection.test.ts
│   │   │   ├── migration-selection.ts
│   │   │   └── migrate.ts
│   │   ├── src/
│   │   │   ├── migrations/
│   │   │   │   └── security-events/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── capture-triage.ts
│   │   │   │   ├── completion-effects.ts
│   │   │   │   ├── custom-fields.ts
│   │   │   │   ├── daily-focus.ts
│   │   │   │   ├── file-attachments.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── mutation.ts
│   │   │   │   ├── project.ts
│   │   │   │   ├── backlog.ts
│   │   │   │   ├── priority-metrics.ts
│   │   │   │   ├── prioritization-session.ts
│   │   │   │   ├── record-action.ts
│   │   │   │   ├── relation.ts
│   │   │   │   ├── security-event.ts
│   │   │   │   ├── work-external-handoff.ts
│   │   │   │   ├── work-draft.ts
│   │   │   │   ├── work-template.ts
│   │   │   │   └── work.ts
│   │   │   ├── config.ts
│   │   │   ├── env.ts
│   │   │   ├── index.ts
│   │   │   ├── local-postgres.ts
│   │   │   └── security-events.ts
│   │   ├── drizzle.config.ts
│   │   ├── drizzle.security.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── styles/
│       │       └── globals.css
│       ├── components.json
│       ├── package.json
│       ├── postcss.config.mjs
│       └── tsconfig.json
├── scripts/
│   ├── install-hooks.ts
│   └── neon-local-proxy.ts
├── biome.base.json
├── biome.json
├── bun.lock
├── lefthook.yml
├── package.json
├── tsconfig.json
└── turbo.json
```

Tags source ownership is split across the API contract (`packages/api/src/tags.ts`), the PostgreSQL schema (`packages/db/src/schema/tags.ts`), the server boundary (`apps/server/src/features/tags/server/`), and the web surface (`apps/web/src/features/tags/`).

File Attachments source ownership is split across the API contract (`packages/api/src/file-attachments.ts`), the PostgreSQL schema (`packages/db/src/schema/file-attachments.ts`), the server boundary (`apps/server/src/features/file-attachments/server/`), and the authenticated multipart/RPC routes (`apps/server/src/app.ts`, `packages/api/src/routers/index.ts`).

Priority metrics source ownership is split across the API contract (`packages/api/src/priority-metrics.ts`), the PostgreSQL schema (`packages/db/src/schema/priority-metrics.ts`), the server boundary (`apps/server/src/features/priority-metrics/server/`), and the web surface (`apps/web/src/features/priority-metrics/`).

External Execution Handoff source ownership is split across the API contract (`packages/api/src/external-handoffs.ts`), the PostgreSQL schema and versioned migrations (`packages/db/src/schema/work-external-handoff.ts`, `packages/db/src/migrations/`), the Work-owned server boundary (`apps/server/src/features/external-handoffs/server/`), and the Work-list surface (`apps/web/src/features/external-handoffs/`).

Backlog's prepared collection and manual order are separate Project-scoped sources of truth. Its API contract lives in `packages/api/src/backlog.ts`, its order schema lives in `packages/db/src/schema/backlog.ts`, its server access and mutations live under `apps/server/src/features/backlog/server/`, and its Project surface lives in `apps/web/src/features/backlog/`. Work archive and Trash timestamps are owned by `packages/db/src/schema/work.ts` and the versioned SQL in `packages/db/src/migrations/`. Prioritization Sessions remain a separate source of truth with their API contract in `packages/api/src/prioritization-sessions.ts`, schema in `packages/db/src/schema/prioritization-session.ts`, server access under `apps/server/src/features/prioritization-sessions/server/`, and comparison surface and session controls in `apps/web/src/features/prioritization-sessions/`.


Record Actions source ownership is split across the API contract (`packages/api/src/record-actions.ts`), the PostgreSQL schema (`packages/db/src/schema/record-action.ts`), the server boundary (`apps/server/src/features/record-actions/server/`), and the Project Configuration Mode editor and run surface (`apps/web/src/features/record-actions/`).

Bulk Editing owns explicit Work selection, status preview/apply UI, and in-memory operation progress under `apps/web/src/features/bulk-editing/`; it uses the Work Lifecycle API for status changes and safe Undo receipts.

Daily Focus membership persistence is owned by the PostgreSQL schema (`packages/db/src/schema/daily-focus.ts`); Record Actions consumes that membership through its atomic write boundary.

Completion Effects preferences are an Account-scoped catalog owned by `packages/api/src/completion-effects.ts`, persisted in `packages/db/src/schema/completion-effects.ts`, served from `apps/server/src/features/completion-effects/server/`, and configured through `apps/web/src/features/completion-effects/`.
