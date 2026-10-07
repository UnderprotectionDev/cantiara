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
│   │   │   │   ├── daily-focus/
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
│   │   │   │   ├── project-goals/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-source-records/
│   │   │   │   │   └── server/
│   │   │   │   ├── priority-metrics/
│   │   │   │   ├── prioritization-sessions/
│   │   │   │   │   └── server/
│   │   │   │   ├── personal-reminders/
│   │   │   │   │   └── server/
│   │   │   │   │       ├── personal-reminder-worker.ts
│   │   │   │   │       ├── personal-reminders-database.test.ts
│   │   │   │   │       └── personal-reminders-database.ts
│   │   │   │   ├── return-to-work/
│   │   │   │   │   └── server/
│   │   │   │   ├── roadmap-horizon/
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
│       │   ├── project-goals.e2e.ts
│       │   ├── project-shell.e2e.ts
│       │   ├── return-to-work.e2e.ts
│       │   ├── record-actions.e2e.ts
│       │   ├── web-capture-extension.e2e.ts
│       │   ├── work-blockers.e2e.ts
│       │   ├── work-drafts.e2e.ts
│       │   ├── work-lifecycle.e2e.ts
│       │   ├── work-templates.e2e.ts
│       │   └── unified-calendar.e2e.ts
│       ├── src/
│       │   ├── components/
│       │   │   ├── header.tsx
│       │   │   ├── loader.tsx
│       │   │   ├── mode-toggle.tsx
│       │   │   ├── theme-provider.test.ts
│       │   │   ├── theme-provider.tsx
│       │   │   └── user-menu.tsx
│       │   ├── features/
│       │   │   ├── return-to-work/
│       │   │   │   └── ui/
│       │   │   ├── daily-focus/
│       │   │   │   └── ui/
│       │   │   │       ├── daily-focus-view.test.tsx
│       │   │   │       └── daily-focus-view.tsx
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
│       │   │   ├── roadmap-horizon/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── project-roadmap.tsx
│       │   │   │           ├── project-milestones.test.tsx
│       │   │   │           ├── project-milestones.tsx
│       │   │   │           ├── research-direction.tsx
│       │   │   │           └── roadmap-view-editor.tsx
│       │   │   ├── relations/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── work-relations.test.tsx
│       │   │   │           └── work-relations.tsx
│       │   │   ├── project-goals/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   ├── project-overview/
│       │   │   │   ├── lib/
│       │   │   │   │   └── project-overview.ts
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── project-overview-sections.tsx
│       │   │   │           ├── project-overview.test.tsx
│       │   │   │           ├── project-overview-surface.tsx
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
│       │   │   ├── project-source-records/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── project-source-record-view.test.tsx
│       │   │   │           └── project-source-record-view.tsx
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
│       │   │   ├── unified-calendar/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           ├── unified-calendar.test.tsx
│       │   │   │           └── unified-calendar.tsx
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
│       │   │   │   ├── calendar.tsx
│       │   │   │   ├── daily-focus.tsx
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
│   │   │   ├── daily-focus.test.ts
│   │   │   ├── daily-focus.ts
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
│   │   │   ├── personal-reminders.ts
│   │   │   ├── roadmap-horizon.test.ts
│   │   │   ├── return-to-work.ts
│   │   │   ├── roadmap-horizon.ts
│   │   │   ├── desktop-api-window.test.ts
│   │   │   ├── desktop-api-window.ts
│   │   │   ├── external-handoffs.test.ts
│   │   │   ├── external-handoffs.ts
│   │   │   ├── index.ts
│   │   │   ├── mutation-and-undo.ts
│   │   │   ├── project-overview.ts
│   │   │   ├── project-shell.ts
│   │   │   ├── project-source-records.test.ts
│   │   │   ├── project-source-records.ts
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
│   │   │   ├── check-migrations.test.ts
│   │   │   ├── check-migrations.ts
│   │   │   ├── development-lease.ts
│   │   │   ├── doctor.test.ts
│   │   │   ├── doctor.ts
│   │   │   ├── migrate.ts
│   │   │   ├── migration-connection.test.ts
│   │   │   ├── migration-connection.ts
│   │   │   ├── migration-history.test.ts
│   │   │   ├── migration-history.ts
│   │   │   ├── migration-repository.test.ts
│   │   │   ├── migration-repository.ts
│   │   │   ├── migration-selection.test.ts
│   │   │   ├── migration-selection.ts
│   │   │   ├── migration-target.ts
│   │   │   ├── migrations.integration.test.ts
│   │   │   ├── prepare.integration.test.ts
│   │   │   ├── prepare.test.ts
│   │   │   ├── prepare.ts
│   │   │   ├── push-local.ts
│   │   │   ├── schema-inspection.test.ts
│   │   │   └── schema-inspection.ts
│   │   ├── src/
│   │   │   ├── migrations/
│   │   │   │   └── security-events/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── capture-triage.ts
│   │   │   │   ├── completion-effects.ts
│   │   │   │   ├── custom-fields.ts
│   │   │   │   ├── daily-focus.ts
│   │   │   │   ├── decision.ts
│   │   │   │   ├── file-attachments.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── mutation.ts
│   │   │   │   ├── project.ts
│   │   │   │   ├── project-milestone.ts
│   │   │   │   ├── backlog.ts
│   │   │   │   ├── priority-metrics.ts
│   │   │   │   ├── personal-reminders.ts
│   │   │   │   ├── prioritization-session.ts
│   │   │   │   ├── production-incident.ts
│   │   │   │   ├── project-release.ts
│   │   │   │   ├── roadmap-horizon.ts
│   │   │   │   ├── record-action.ts
│   │   │   │   ├── relation.ts
│   │   │   │   ├── return-to-work.ts
│   │   │   │   ├── security-event.ts
│   │   │   │   ├── work-external-handoff.ts
│   │   │   │   ├── work-draft.ts
│   │   │   │   ├── work-template.ts
│   │   │   │   └── work.ts
│   │   │   ├── config.ts
│   │   │   ├── env.ts
│   │   │   ├── index.ts
│   │   │   ├── local-postgres.ts
│   │   │   ├── security-event-database-url.test.ts
│   │   │   ├── security-event-database-url.ts
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
│   ├── dev-database-mode.test.ts
│   ├── dev-database-mode.ts
│   ├── dev-server.ts
│   ├── development-session.test.ts
│   ├── development-session.ts
│   ├── install-hooks.ts
│   ├── local-dev-command.test.ts
│   ├── local-dev-command.ts
│   ├── local-dev.test.ts
│   ├── local-dev.ts
│   ├── neon-local-proxy.ts
│   └── tsconfig.json
├── biome.base.json
├── biome.json
├── bun.lock
├── lefthook.yml
├── package.json
├── tsconfig.json
└── turbo.json
```

Tags source ownership is split across the API contract (`packages/api/src/tags.ts`), the PostgreSQL schema (`packages/db/src/schema/tags.ts`), the server boundary (`apps/server/src/features/tags/server/`), and the web surface (`apps/web/src/features/tags/`).

Documents source ownership is split across the API contracts (`packages/api/src/documents.ts`, `packages/api/src/document-templates.ts`, `packages/api/src/document-transfers.ts`), the empty-heading starter skeleton catalog shared with Project Shell (`packages/api/src/document-skeletons.ts`), the PostgreSQL schemas and versioned migrations (`packages/db/src/schema/document.ts`, `packages/db/src/schema/document-template.ts`, `packages/db/src/migrations/`), the server boundary (`apps/server/src/features/documents/server/`), and the Project Documents surface (`apps/web/src/features/documents/`). Document Templates use the Documents mutation boundary, not Work Templates or a template marketplace. Project/Wiki transfers reuse that boundary in `document-transfer-database.ts`, the shared row converter `document-row.ts`, and the shared `document-transfer-controls.tsx`; they do not introduce another Document store.

Documents owns the dictionary-rename counterpart in `apps/server/src/features/documents/server/document-tag-rename-database.ts`; Tags calls it in the same transaction without owning Markdown parsing. Folder/parent navigation and previewed organization/Archive controls live in `document-navigation.tsx` and `document-organization-controls.tsx` beside the Project Documents surface.

Migration infrastructure is owned by `packages/db/scripts/`: `migration-repository.ts` validates canonical metadata, `check-migrations.ts` compares configured source schemas, `migration-target.ts` resolves and connects the application-aligned target, `migration-history.ts` verifies applied history, `schema-inspection.ts` reads physical catalog shape, `doctor.ts` exposes strict read-only readiness and explicit development compatibility, `development-lease.ts` holds and monitors shared runtime migration locks, and `migrate.ts` is the controlled write boundary. `prepare.ts` orchestrates issue database readiness through source checks, deep checks of both targets, and sequential canonical migrations; `prepare.test.ts` owns its orchestration and CLI seam. `packages/db/schema-files.ts` is the schema-file manifest shared by both Drizzle configs and source checks. Script type checking lives in `packages/db/tsconfig.scripts.json`; command integration tests use disposable databases in `packages/db/scripts/migrations.integration.test.ts` and `packages/db/scripts/prepare.integration.test.ts`. `scripts/local-dev.ts` owns Conductor/root task startup and the optional local PostgreSQL proxy; `scripts/local-dev-command.ts` owns task/help forwarding. The direct server `dev` command uses `scripts/dev-server.ts` to acquire the lease and `scripts/development-session.ts` to supervise and stop the API when verification fails. The contract and testing decisions live in `docs/tech-stack.md`, not a product feature spec.

Personal Wiki owns the authenticated ownership shell under `apps/web/src/features/personal-wiki/` and `apps/web/src/routes/_auth/personal-wiki.tsx`. It consumes the same Documents surface, contract, schema, server access, and mutations; Wiki Documents have Workspace ownership and no Project. Publishing remains a separate feature.

Personal Wiki's scope-selection and badge counterpart lives in `apps/web/src/features/personal-wiki/document-scope.ts` and `ui/components/document-scope-badge.tsx`. Documents navigation consumes it to keep mixed results in separate ownership groups before Folder/hierarchy navigation; scope filters never create a new home. Record Discovery consumes it through `apps/web/src/features/record-discovery/ui/components/` for the founder chrome's `Search` and `All Documents` views. `packages/api/src/record-discovery.ts` owns the Document discovery and Universal Search contracts plus match context; `apps/server/src/features/record-discovery/server/document-discovery-database.ts` queries authorized canonical Documents through the Documents access counterpart, while `universal-search-database.ts` queries the canonical Work, Project source record, Technical Diagram, Document, and File Attachment tables under Account ownership. `universal-search-results.tsx` renders the mixed-record Search results, and `context-record-preview.tsx` owns the shared `Open source record` action and session-only preview panel consumed by the current Kanban, Unified Calendar, Roadmap, Scope Tree, and Smart Collection surfaces. Discovery is not a Wiki-owned index or a new storage home.

The Documents in-memory edit session lives in `apps/web/src/features/documents/store/`; its Conflict Draft comparison and resolution surface lives in `apps/web/src/features/documents/ui/components/document-conflict-drafts.tsx`. The session consumes Client Shell connection state without creating persistent storage or a write queue. Client Shell's server support-response boundary preserves the validated Documents conflict payload while retaining its no-retry policy.

Smart Collections source ownership is split across the API contract (`packages/api/src/smart-collections.ts`), the PostgreSQL schema and versioned migration (`packages/db/src/schema/smart-collection.ts`, `packages/db/src/migrations/`), the server boundary (`apps/server/src/features/smart-collections/server/`), and the Project Smart Collections surface (`apps/web/src/features/smart-collections/`).

Technical Diagrams source ownership is split across the API contract (`packages/api/src/technical-diagrams.ts`), the PostgreSQL schema and versioned migration (`packages/db/src/schema/technical-diagram.ts`, `packages/db/src/migrations/`), the server boundary (`apps/server/src/features/technical-diagrams/server/`), and the Project Technical Diagrams surface (`apps/web/src/features/technical-diagrams/`).

File Attachments source ownership is split across the API contract (`packages/api/src/file-attachments.ts`), the PostgreSQL schema (`packages/db/src/schema/file-attachments.ts`), the server boundary (`apps/server/src/features/file-attachments/server/`), and the authenticated multipart/RPC routes (`apps/server/src/app.ts`, `packages/api/src/routers/index.ts`).

Document-owned File Attachments reuse `ownerDocumentId` in that schema and reader; the existing Project/Wiki command contract is `packages/api/src/document-transfers.ts`, backed by `document-transfer-database.ts`. Both transfer command shapes are validated and dispatched by the same authenticated RPC in `packages/api/src/routers/index.ts`. The shared live-section cycle guard lives in `document-live-section-database.ts` and is called by normal Document writes and Copy. `packages/db/src/schema/external-surface.ts` and its canonical applied `0090` migration represent publication ownership used to block Move while a surface is active; publishing UI remains outside this module.

Document scope transfer, attachment ownership selection, independent copies and single-Document snapshots are owned by `packages/api/src/document-transfer.ts`, `apps/server/src/features/documents/server/document-transfers-database.ts` and `apps/web/src/features/documents/ui/components/document-transfer-controls.tsx`. Isolated HTML-to-PDF rendering lives in `apps/server/src/features/documents/server/document-pdf.ts`. The narrow External Surface/history counterpart lives in `packages/db/src/schema/external-surface.ts`; its irreversible cancellation journal adapter is `document-surface-cancellations.ts` under the Documents server boundary and is included in startup security replay. Publishing UI, URLs and tokens remain outside this module.

Priority metrics source ownership is split across the API contract (`packages/api/src/priority-metrics.ts`), the PostgreSQL schema (`packages/db/src/schema/priority-metrics.ts`), the server boundary (`apps/server/src/features/priority-metrics/server/`), and the web surface (`apps/web/src/features/priority-metrics/`).

Personal Reminder source ownership is split across the API contract (`packages/api/src/personal-reminders.ts`), the Account-scoped schema and versioned migrations (`packages/db/src/schema/personal-reminders.ts`, `packages/db/src/migrations/`), the server boundary (`apps/server/src/features/personal-reminders/server/`), and the shared record control (`apps/web/src/features/personal-reminders/ui/components/personal-reminder-control.tsx`). The control is consumed by Project, Document, Work, and Project source-record surfaces. Roadmap Horizon calls the Work `Review Later` adapter in the same database transaction as replacing or reconsidering a `Not now` trail.

The Work-specific `Review Later` adapter lives at `apps/web/src/features/personal-reminders/ui/components/work-review-later-control.tsx`; it is consumed on Work detail/List, Backlog, Roadmap, Priority Map, and Prioritization Sessions.

External Execution Handoff source ownership is split across the API contract (`packages/api/src/external-handoffs.ts`), the PostgreSQL schema and versioned migrations (`packages/db/src/schema/work-external-handoff.ts`, `packages/db/src/migrations/`), the Work-owned server boundary (`apps/server/src/features/external-handoffs/server/`), and the Work-list surface (`apps/web/src/features/external-handoffs/`).

Backlog's prepared collection, manual order, and saved alternative presentation are separate Project-scoped sources of truth. Its API contract lives in `packages/api/src/backlog.ts`, its order and presentation schemas live in `packages/db/src/schema/backlog.ts`, its server access and mutations live under `apps/server/src/features/backlog/server/`, and its Project surface lives in `apps/web/src/features/backlog/`. Work archive and Trash timestamps are owned by `packages/db/src/schema/work.ts` and the versioned SQL in `packages/db/src/migrations/`. Prioritization Sessions remain a separate source of truth with their API contract in `packages/api/src/prioritization-sessions.ts`, schema in `packages/db/src/schema/prioritization-session.ts`, server access under `apps/server/src/features/prioritization-sessions/server/`, and comparison surface and session controls in `apps/web/src/features/prioritization-sessions/`.

Roadmap Horizon named views, Work placement, and Project Milestones are owned by `packages/api/src/roadmap-horizon.ts`, `packages/db/src/schema/roadmap-horizon.ts`, `packages/db/src/schema/project-milestone.ts`, `apps/server/src/features/roadmap-horizon/server/`, and `apps/web/src/features/roadmap-horizon/ui/components/`.
The Work-owned `Not now` decision trail contract and persistence are owned by `packages/api/src/work-not-now.ts`, `packages/db/src/schema/work-not-now.ts`, and `apps/server/src/features/roadmap-horizon/server/not-now-database.ts`; its shared control is `apps/web/src/features/roadmap-horizon/ui/components/work-not-now-control.tsx`, consumed by Work detail/List, Backlog, Roadmap, Priority Map, and Prioritization Sessions.


Record Actions source ownership is split across the API contract (`packages/api/src/record-actions.ts`), the PostgreSQL schema (`packages/db/src/schema/record-action.ts`), the server boundary (`apps/server/src/features/record-actions/server/`), and the Project Configuration Mode editor and run surface (`apps/web/src/features/record-actions/`).

Bulk Editing owns explicit Work selection, status preview/apply UI, and in-memory operation progress under `apps/web/src/features/bulk-editing/`; it uses the Work Lifecycle API for status changes and safe Undo receipts.

Daily Focus membership uses the PostgreSQL schema (`packages/db/src/schema/daily-focus.ts`), the API contract (`packages/api/src/daily-focus.ts`), the server access layer (`apps/server/src/features/daily-focus/server/`), and the personal day view (`apps/web/src/features/daily-focus/`). The authenticated route is `apps/web/src/routes/_auth/daily-focus.tsx`; Record Actions consumes the same membership through its atomic write boundary.

Focus Period owns its workspace-scoped working window, historical membership, and lifecycle in `packages/db/src/schema/focus-period.ts`, `packages/api/src/focus-period.ts`, and `apps/server/src/features/focus-period/server/`. The founder surface is `apps/web/src/features/focus-period/` at `apps/web/src/routes/_auth/focus-periods.tsx`.

Decision, Risk, Assumption, Open Question, Milestone, Project Release, and Production Incident source records are owned by `packages/api/src/project-source-records.ts`, their PostgreSQL schemas in `packages/db/src/schema/`, versioned migrations in `packages/db/src/migrations/`, and the Account-scoped lifecycle access layer under `apps/server/src/features/project-source-records/server/`. The read-only detail surface lives under `apps/web/src/features/project-source-records/`; Documents references and conversion use the same stable source identity, while `apps/server/src/features/daily-focus/server/` derives timeline events from its supported source records and mutation history.

Completion Effects preferences are an Account-scoped catalog owned by `packages/api/src/completion-effects.ts`, persisted in `packages/db/src/schema/completion-effects.ts`, served from `apps/server/src/features/completion-effects/server/`, and configured through `apps/web/src/features/completion-effects/`.
