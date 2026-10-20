# structure.md

> This tree records source-backed ownership boundaries. Future feature names remain in specs until source exists, and generated files are omitted.

```text
.
├── .github/
│   └── workflows/
│       ├── integration-tests.yml
│       ├── code-quality.yml
│       ├── macos-client-compile.yml
│       ├── macos-release.yml
│       ├── pre-merge-validation.yml
│       └── react-doctor.yml
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
│   │   │   │   ├── favorites/
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
│       │   ├── open-questions.e2e.ts
│       │   ├── validation-records.e2e.ts
│       │   ├── uncertainty-records.e2e.ts
│       │   ├── favorites.e2e.ts
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
│       │   │   ├── favorites/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   │           └── favorite-control.tsx
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
│       │   │   ├── validation-records/
│       │   │   │   └── ui/
│       │   │   │       ├── validation-records-surface.tsx
│       │   │   │       ├── validation-records-view.tsx
│       │   │   │       └── validation-records-view.test.tsx
│       │   │   ├── uncertainty-records/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       │   ├── project-assumptions-surface.tsx
│       │   │   │       │   ├── project-assumptions-view.tsx
│       │   │   │       │   └── project-assumptions-view.test.tsx
│       │   │   │       ├── open-question-view.tsx
│       │   │   │       ├── open-question-view.test.tsx
│       │   │   │       └── open-questions-surface.tsx
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
│       │   │   │           ├── project-goals-surface.tsx
│       │   │   │           ├── project-goals-view.test.tsx
│       │   │   │           └── project-goals-view.tsx
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
│   │   │   ├── favorites.ts
│   │   │   ├── favorites.test.ts
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
│   │   │   ├── validation-records.test.ts
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
│   │   │   │   ├── favorites.ts
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
│   ├── ci-workflow.test.ts
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

Moodboards source ownership: API contract and pure rules in `packages/api/src/moodboards.ts`, `moodboard-color.ts` (Color Swatch parsing), `moodboard-view.ts` (Crop, Rotate 90°, Focus order), `moodboard-snapshot.ts` (Snapshot plan and Preview), `moodboard-viewport.ts` (personal viewport, `Fit View`) and `moodboard-outline.ts` (structured Outline); PostgreSQL schema and versioned migrations in `packages/db/src/schema/moodboard.ts` (`moodboard`, `moodboard_item` with one detail table per item kind, `moodboard_palette_group`, `moodboard_visual_view`, `moodboard_focus_step`, `moodboard_personal_view`); server boundary in `apps/server/src/features/moodboards/server/` (`moodboards-database.ts` reads, `moodboards-mutation-database.ts` applies every ADR-0004 mutation target, `moodboard-snapshots-database.ts` and `moodboard-snapshot-render.ts` build Snapshots with Sharp and Playwright following the Documents PDF boundary, `moodboard-personal-views-database.ts` stores the per-Account viewport); seam tests `moodboards-rpc.test.ts` (DB-free) and `moodboards-database.test.ts` (disposable PostgreSQL); web surface in `apps/web/src/features/moodboards/` (`lib/color-sampling.ts` Eyedrop adapter, board, Outline, view tools, personal view hook). Behavior rules live in `docs/specs/50-moodboards/spec.md`.

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

Source identity and dated capture versions are owned separately by `packages/api/src/sources-and-freshness.ts`, `packages/db/src/schema/source.ts`, versioned migrations in `packages/db/src/migrations/`, and `apps/server/src/features/sources-and-freshness/server/`. The Sources and Freshness seam uses authenticated Source create/save/read/list RPCs and the shared atomic mutation contract. The Source foundation has no browser surface; Feed, preview/recheck and evidence bind consumers keep their own ownership.

Completion Effects preferences are an Account-scoped catalog owned by `packages/api/src/completion-effects.ts`, persisted in `packages/db/src/schema/completion-effects.ts`, served from `apps/server/src/features/completion-effects/server/`, and configured through `apps/web/src/features/completion-effects/`.

Project Goals membership is owned by `packages/api/src/project-goals.ts`, `packages/db/src/schema/project-goal-relation.ts`, and versioned migrations. Its Project ownership helper and typed relation adapter live in `apps/server/src/features/project-goals/server/project-goal-access.ts` and `project-goal-membership-database.ts`; `project-goal-membership-database.test.ts` verifies the same Project Goals seam. Goal detail consumes `apps/web/src/features/project-goals/ui/components/project-goal-membership.tsx` and `project-goal-membership-view.tsx`. The browser journey is `apps/web/e2e/project-goal-membership.e2e.ts`. The adapter reuses the closed Relations catalog; endpoint deletion preserves its historical pair, while the Project remains the cleanup owner.

Favorites membership, list, and source opening are owned by `packages/api/src/favorites.ts`, `packages/db/src/schema/favorites.ts`, and `apps/server/src/features/favorites/server/`. Source screens consume the shared control in `apps/web/src/features/favorites/ui/components/`; the personal shell does not own a membership store. `favorites-sources-database.ts` resolves current source summaries in batches without persisted copies. The header hosts `apps/web/src/features/favorites/ui/components/favorites-panel.tsx` and `favorites-list.tsx`; `lib/favorite-preview-target.ts` delegates to the shared Record Discovery preview. `apps/server/e2e/favorites-fixture.ts` prepares the Favorites browser journey only in the isolated E2E server.

Decision lifecycle editing is owned by `apps/web/src/features/decisions/ui/components/`: `project-decisions-surface.tsx` consumes the existing Project source-record owner through `projectDecisions`, create/update and transition RPCs; `project-decisions-view.tsx` owns TanStack Form editing and explicit withdrawal. Project Shell opens the Project area and existing Decision source hashes; preview consumers retain the shared read-only source-record detail. The Decisions seam browser journey is `apps/web/e2e/decisions.e2e.ts`. Withdrawal metadata is part of `packages/db/src/schema/decision.ts` and the versioned migration; supersession is owned by the adjacent `decision-supersession-controls.tsx` and `decision-supersession-view.tsx`, the `packages/api/src/decision-supersession.ts` contract, and the `decision-supersession-database.ts` adapter under the same server owner. `decision_supersession` in the Decision schema represents the single-successor graph. Its browser journey is `apps/web/e2e/decision-supersession.e2e.ts`; `decision-chain-view.tsx` renders historical generations and final current navigation using `packages/api/src/decision-chain.ts`; that contract also exposes detached Decision snapshot candidates for sharing/public counterparts. Record Discovery owns Search/All Decisions status selection in `document-discovery.tsx` and `universal-search-database.ts`. The combined chain/default browser journey is `apps/web/e2e/decision-chain.e2e.ts`.

Return to Work derives Since you last looked at the same summary boundary. `apps/server/src/features/return-to-work/server/return-events-database.ts` owns the existing source/history read adapter; `apps/web/src/features/return-to-work/ui/since-last-looked.tsx` owns grouped event presentation and its adjacent presentation test.

Return to Work's optional exact visual-target contract lives in `packages/api/src/return-to-work.ts`. Its transient visual tour driver and canvas viewport adapter contract live in `packages/api/src/return-visual-tour.ts`; `return-visual-tour.test.ts` observes the same Return to Work seam through a canvas viewport double. Actual canvas target resolution, highlight/pan, meaningful viewport restore and session persistence remain with the owning surface features. Browser controls live in `apps/web/src/features/return-to-work/ui/visual-changes-tour.tsx` and `visual-tour-panel.tsx`; the existing list owns remainder focus. The existing Work event adapter emits exact Roadmap Work targets. Roadmap owns the React Flow renderer under `ui/components/roadmap-canvas.tsx`, live queries under `live-roadmap-canvas.tsx`, shared list/canvas membership under `lib/roadmap-projection.ts`, public viewport resolution under `lib/roadmap-viewport.ts`, and Project-scoped transient state under `store/roadmap-session.tsx`.

Return to Work status-age thresholds use the existing Project configuration in `packages/api/src/project-shell.ts` and its `Saved views` configuration form. `packages/api/src/return-to-work.ts` owns the shared neutral candidate predicate. `apps/server/src/features/smart-collections/server/smart-collections-database.ts` evaluates the prepared view through its existing Work membership reader. No persisted membership or new schema is introduced.

Uncertainty Records uses the existing Project source-record mutation owner: `packages/api/src/project-source-records.ts` carries Assumption commands, `packages/api/src/uncertainty-records.ts` carries its evidence context, and `apps/server/src/features/project-source-records/server/uncertainty-records-database.ts` reads canonical Assumptions and existing pinned Document/Work evidence. `apps/web/src/features/uncertainty-records/ui/components/` owns the TanStack Form editor and Query surface consumed by Project Discovery and Assumption source hashes. The Assumption schema remains in `packages/db/src/schema/assumption.ts`; no new storage or lifecycle owner is introduced. The Uncertainty Records seam journey is `apps/web/e2e/uncertainty-records.e2e.ts`.

Uncertainty Records also uses `apps/server/src/features/relations/server/usage-links-database.ts` for atomic exact Document pin validation. `readUncertaintyDocumentPins` in the Project source-record read adapter resolves current and legacy version ownership for both types. Open Question presentation remains in `apps/web/src/features/uncertainty-records/ui/open-question-view.tsx` and `open-questions-surface.tsx`; its browser journey is `apps/web/e2e/open-questions.e2e.ts`.

Risk editing is owned by `apps/web/src/features/risks/ui/components/`, using the Project source-record API and PostgreSQL owner above. `project-risks-surface.tsx` binds Account-scoped `projectRisks`, create/update and explicit transitions; `project-risks-view.tsx` owns TanStack Form drafts and the five-status UI. Project Overview opens `#risks` and existing `#source-risk-` identities; preview consumers retain the read-only source view. The Risks seam browser journey is `apps/web/e2e/risks.e2e.ts`. No schema change or score store is introduced.

Risk context relations and `open-risk` event production are owned by `packages/api/src/risk-signals.ts`, the `riskContextRelation` and `riskAttentionSignal` tables in `packages/db/src/schema/risk.ts`, and `apps/server/src/features/project-source-records/server/risk-signals-database.ts`. Project source-record mutations emit entered-Open events in their existing atomic commit. The Account-scoped `relateRiskContext` and `projectRiskSignals` RPCs expose the Risks record and signal-production seam; the Attention Signals center remains a separate consumer.

Validation Records uses the shared Project source record API and mutation owner (`packages/api/src/project-source-records.ts`, `apps/server/src/features/project-source-records/server/project-source-records-database.ts`). The schema is `packages/db/src/schema/validation-record.ts`; seam tests are `packages/api/src/validation-records.test.ts`, `apps/server/src/features/project-source-records/server/validation-records-database.test.ts`, and `apps/web/e2e/validation-records.e2e.ts`.

Research Sessions Consent Context Gates is owned by `packages/api/src/research-sessions.ts`, `packages/db/src/schema/research-session.ts`, versioned migrations, and `apps/server/src/features/research-sessions/server/research-sessions-database.ts`. The atomic Project-owned session row carries server-recorded Consent and immutable capture/link permission provenance. Project Discovery consumes `apps/web/src/features/research-sessions/ui/`, with account-zone time entry in `apps/web/src/features/research-sessions/lib/research-session-time.ts`; its browser journey is `apps/web/e2e/research-sessions.e2e.ts`. Contact identity is an explicit collaborator; unavailable identities fail closed. Snapshot and convert preview helpers are consent counterparts for their later owning surfaces.

Smart Link Preview is owned by `packages/api/src/smart-link-preview.ts`, `apps/server/src/features/sources-and-freshness/server/` (gateway, isolated worker and public-network policy), and `apps/web/src/features/sources-and-freshness/ui/components/` (Project Discovery composer and saved Source snapshots). The standalone `apps/server/src/smart-link-egress.ts` entrypoint is deployed separately from the product API; it must not import product services, auth, environment or database modules. Its build emits the worker as a separate entrypoint.

The Sources and Freshness server owner also provides `youtube-player-page.ts`, a static public Hono player document for the local macOS WebView. `app.ts` registers it before account/context middleware because it has no account access. Its adjacent route/provider-browser test and the composer/saved-snapshot UI tests observe spec 44’s Sources and Freshness seam.

Research Sessions owns the typed note contract in `packages/api/src/research-sessions.ts`, the Project-owned atomic PostgreSQL adapter in `apps/server/src/features/research-sessions/server/`, and the account-zone form and note surface in `apps/web/src/features/research-sessions/`. `ui/research-session-notes.tsx` owns explicit note-kind authoring and display; `research-sessions-surface.tsx` binds it to the authenticated RPC. Notes use the existing `packages/db/src/schema/research-session.ts` JSON content and Mutation Contract, with no separate Feedback or Test Session record.

Source Check history and explicit candidate approval are Source-owned helpers in `packages/api/src/source-recheck.ts`, `packages/db/src/schema/source.ts` (`source_check`), and `apps/server/src/features/sources-and-freshness/server/source-recheck-database.ts`. Project Discovery consumes `source-recheck-controls.tsx` and `source-check-compare.tsx` under the same Sources and Freshness UI owner. Evidence pin/rebind stays with spec 45; this helper does not create or relocate evidence links.

Research conversion preview/commit is owned by `packages/api/src/research-session-bindings.ts`, `apps/server/src/features/research-sessions/server/research-binding-commit.ts` and `research-binding-targets.ts`, and `apps/web/src/features/research-sessions/ui/research-note-binding.tsx`. Preparation rows share `packages/db/src/schema/research-session.ts`. The reusable pin contract lives in `packages/api/src/evidence.ts`; semantic Evidence/Origin persistence is owned by `packages/db/src/schema/evidence.ts` and `apps/server/src/features/evidence/server/evidence-database.ts`. Minimal Feedback existing-source intake and owner-scoped original-message reading are owned by `packages/db/src/schema/feedback.ts` and `apps/server/src/features/feedback/server/feedback-database.ts`. Expired Research conversion plans are swept by `research-sessions-database.ts` via `services.ts` and the server startup/maintenance interval; mutation receipts remain durable. Historical target reads in `research-binding-targets.ts` are separate from write eligibility. The minimal Feedback read-only dialog lives in `apps/web/src/features/feedback/ui/research-binding-feedback.tsx`, opened by the Research Sessions Evidence consumer through its authenticated binding reader. These collaborators are tested through the consuming Research Sessions seam; they do not deliver the full Evidence Flow or Feedback Feed.

Source evidence preview, per-use decisions and grouped freshness signal reads are owned by `packages/api/src/source-evidence.ts`, `apps/server/src/features/sources-and-freshness/server/source-evidence-database.ts` and its adjacent Sources and Freshness seam tests. Project Discovery consumes `source-evidence-controls.tsx`. Exact pin replacement and target ownership stay in the Evidence server owner (`evidence-database.ts`, `evidence-targets.ts`); Evidence revision/review fields stay in `packages/db/src/schema/evidence.ts`. Source approval never relocates a pin.

Document-sourced Evidence (`Bind as evidence to existing record`, `Convert to new record and bind`, rebind and the `Newer version exists` read) is owned by `packages/api/src/document-evidence.ts` and `apps/server/src/features/evidence/server/document-evidence-database.ts`; the single new record of a convert is written by `evidence-record-creation.ts`. It is stateless — the confirmation re-derives and compares the exact previewed plan — and stores through `evidence_binding`/`record_origin` without a schema change. The Documents surface mounts `apps/web/src/features/documents/ui/components/document-evidence-controls.tsx`. The older `usage_link` Document pin (`pinDocumentEvidence`, `documentEvidence` on create commands) stays with Documents and Uncertainty Records until a separate migration; the Evidence seam is tested in `document-evidence-database.test.ts`. Evidence Role and `Founder interpretation` live on `evidence_binding` with change history in `evidence_binding_history` (`packages/db/src/schema/evidence.ts`); `setDocumentEvidenceRole`/`documentEvidenceHistory` use `updateEvidenceRole` in `evidence-database.ts`, the role editor sits in `document-evidence-controls.tsx`, and the grouped target surface is `apps/web/src/features/evidence/ui/components/evidence-role-groups.tsx` (not yet mounted on target detail pages). The Evidence Flow read is `apps/server/src/features/evidence/server/evidence-flow-database.ts`, which owns `liveSource` (moved from `document-evidence-database.ts`) and the Research Session and Source live readers; `apps/web/src/features/evidence/ui/components/evidence-flow.tsx` renders the list and `evidence-flow-panel.tsx` mounts it as a collapsed disclosure on Work, Decision and Assumption detail. Diagram/File Attachment pins, Feedback/Validation/Session Test rows, redaction and target-side mounting of the grouped surface belong to the remaining spec 45 tickets.

Contact and Company is owned by `packages/api/src/contacts.ts`, `packages/db/src/schema/contact.ts`, versioned migrations, and `apps/server/src/features/contacts/server/` (`contacts.ts` access, `contacts-database.ts` PostgreSQL adapter). The Workspace-scoped identity book keeps normalized email aliases, a single current `Belongs to Company` affiliation with closed past rows, and explicit Contact–Persona Document links; it has no CRM fields and never assigns a Persona. The web surface is `apps/web/src/features/contacts/ui/contacts-view.tsx` at `/contacts`. Its seam tests are `contacts.test.ts`, `contacts-database.test.ts`, and `contacts-view.test.tsx`; `Duplicate candidates` are a read-only `listDuplicateCandidates` suggestion list (strong: same normalized email; weak: similar name or shared current Company) and never merge on their own. `previewMerge` is read-only and `mergeContacts` consolidates one copy onto the chosen survivor atomically: aliases, Persona links, Feedback links (`workspace_contact_feedback`) and affiliation history move over, the copy becomes a contentless `workspace_contact_retired_identity` redirect resolved by `resolveContact`, and a `workspace_contact_audit_event` row keeps opaque ids, an actor alias (the `accountActorAlias` digest) and time without any email. `resolveContact` opens a retired id as its survivor with `redirectedFrom`, and the contacts route accepts `?contact=<id>` to show that origin as `Redirected from`. The merge UI is `merge-preview-panel.tsx`. `mergeContacts` also writes a `workspace_contact_merge` ledger (retired name, creation time and per-value `workspace_contact_merge_link` rows marking what only the merge added) so `previewMergeUndo` and `undoMerge` can restore the original retired id as a Contact and split back only merge-attributed values and links: later unrelated edits stay, a merged value edited afterwards needs a `Keep current value` or `Restore previous value` decision, and Feedback, Persona or Company links whose content no longer exists are reported as `Cannot be restored` instead of a full undo. The undo UI is `merge-undo-panel.tsx`, started by `Undo Merge` on a `Redirected from` Contact.

Feedback is owned by `packages/api/src/feedback.ts` (strict contract and `FeedbackStore`/`FeedbackAccess`), `packages/db/src/schema/feedback.ts` (`project_feedback` with optional `url`, and `project_feedback_attachment` references to File Attachments) and `apps/server/src/features/feedback/server/` (`feedback.ts` access, `feedback-database.ts` PostgreSQL adapter plus the Research Sessions intake `createFeedbackFromResearch`). The Project-scoped `Create Feedback` form and status list are `apps/web/src/features/feedback/ui/feedback-view.tsx` and `feedback-surface.tsx`, mounted in the Discovery area of `project-shell-surface.tsx`; `research-binding-feedback.tsx` stays the read-only dialog. The status command writes only Feedback, never Work. Seam tests are `feedback.test.ts`, `feedback-database.test.ts` and `feedback-view.test.tsx`. Optional Contact/Company (`workspace_contact_feedback`, `workspace_company_feedback`) and `Convert to Work` (`project_feedback_work_origin`, migration `0118`; Work inserted through `insertWorkWithKeyAllocation` in `apps/server/src/features/evidence/server/evidence-record-creation.ts`) are owned by the same files; the conversion dialog and preview are `apps/web/src/features/feedback/ui/convert-to-work-dialog.tsx`. The read-only `Feed` is owned by `packages/api/src/feedback-feed.ts` (strict row contract, `FeedbackFeedStore`, `selectFeedRows`), `apps/server/src/features/feedback/server/feedback-feed.ts` (access) and `feedback-feed-database.ts` (read-only PostgreSQL adapter plus `createDatabaseFeedbackWithFeed`, which `services.ts` exposes as `feedback`), and `apps/web/src/features/feedback/ui/feed-view.tsx` and `feed-surface.tsx` (mounted after Feedback in the Discovery area). Feed tests are `feedback-feed.test.ts`, `feedback-feed-database.test.ts` (PostgreSQL seam) and `feed-view.test.tsx`; `Open Source Record` focuses the `feedback-record-<id>` or `source-record-<id>` element of the same master record. Kanıt niteliği, Kanıt Rolü and follow-up of a Work–Feedback `Origin` link (#362) are stored in `project_feedback_work_evidence` and `project_feedback_work_evidence_history` (migration `0119`, `packages/db/src/schema/feedback.ts`), written by `setEvidence` in `feedback-database.ts` through `mergeLinkEvidence` in `packages/api/src/feedback.ts`, and edited in `apps/web/src/features/feedback/ui/evidence-quality-panel.tsx`; the same Feedback keeps separate rows per Work, and Kanıt Akışı stays with spec 45.

Screens and Wireframes (spec 48) own the Screen master record through `packages/api/src/screens.ts` (strict title-only create, the `archive`/`unarchive`/`trash`/`restore` lifecycle command and its `planScreenLifecycle` rule, `resolveScreenTarget`, `ScreenStore`/`ScreensAccess`, the Wireframe read/save inputs and the linked-block preview/apply contract), `packages/db/src/schema/screen.ts` (`project_screen` with `archived_at`/`trashed_at`; `project_screen_wireframe_version`, which has no Project scope or lifecycle of its own and carries the canonical `document` jsonb; `project_screen_linked_block`, the Project-scoped shared source definition; migrations `0128` and `0129_wireframe_document`) and `apps/server/src/features/screens/server/` (`screens.ts` access and errors, `screens-database.ts` PostgreSQL adapter, `screens-memory-store.ts` in-memory test store). The durable Wireframe truth is the versioned, Zod-validated `WireframeDocument` in `packages/api/src/wireframe-document.ts` (schema, `parseWireframeDocument`/`createWireframeMigrator`, Konva Stage JSON rejection, closed block kinds, closed animation set, `blockBounds`/`resolveBlock` canonical geometry, `createWireframeBlock`/`seedFromId`); `packages/api/src/wireframe-commands.ts` holds the command/transaction model (`applyWireframeTransaction`), linked-block `previewLinkedSourceChange`, `Detach Link` (`detachLink`) and live Markdown text (`resolveLiveText`, `freezeLiveText`). Konva and Rough.js are adapters only: `apps/web/src/features/screens/engine/` has the session (`editor.ts`), RBush hit-test/selection/snap on canonical geometry (`geometry.ts`) and the pure paint plan with seeded Rough.js outlines and Shantell Sans canvas typography (`paint.ts`); `ui/wireframe-pane.tsx` is the full-width Wireframe pane, `wireframe-stage.tsx` the Konva adapter, `canvas-text-overlay.tsx` the transient DOM text overlay, `linked-block-controls.tsx` the linked-block and `Detach Link` controls and `wireframe-surface.tsx` the data layer (geometry writes go through `saveScreenWireframe` into the Wireframe cache without invalidating the Screen list). The Project-scoped `Create Screen` form and `Active`/`Archived`/`In Trash` lists are `ui/screens-view.tsx` and `screens-surface.tsx`, mounted by `project-shell-surface.tsx` at the `#design` hash, with `Open Wireframe` per Screen. Exact Wireframe versions are attached with `attachWireframeVersion` (a document is optional; `saveScreenWireframeVersion` is the `Save Version` RPC) and stay on their Screen through archive, trash and restore; `saveScreenWireframe` updates the working (latest) version in place. A Screen in Trash or an unknown id resolves as a broken target (`In Trash` / `No access`) through `resolveScreen`, never to another Screen. Seam tests are `screens.test.ts`, `wireframes.test.ts`, `screens-database.test.ts` (PostgreSQL seam), `screens-view.test.tsx`, `engine/wireframe-engine.test.ts` and `ui/wireframe-pane.test.tsx`; Presentation Mode and export live in `apps/web/src/features/screens/output/` as renderers separate from Konva: `snapshot.ts` pins an explicit Wireframe version number, parses its stored document through `parseWireframeDocument` (Konva JSON refused), records `sealed` (a newer version exists; geometry saves rewrite only the latest working version in place) and a deterministic content digest; `svg.ts` is the SVG export renderer over the shared paint plan (PNG rasterises that SVG in `download.ts`), `html.ts` the self-contained interactive HTML (inline styles/font/script, `default-src 'none'` CSP, no URL or write path), `print.ts` the print document the browser turns into PDF (the repo has no server-side Playwright PDF pipeline yet), `manifest.ts` the deterministic human-readable manifest of Screen and Wireframe versions, `links.ts` supported `screen-transition` links (a target outside the chosen versions stays `Unresolved`, never retargeted) and `presentation.ts` the pure read-only Presentation Mode state. UI is `ui/presentation-mode.tsx`, `ui/screens-output-panel.tsx` and `ui/screens-output-surface.tsx` (read-only `screenWireframe` queries with an explicit version; no write call), tested by `output/screens-output.test.ts` and `ui/presentation-mode.test.tsx`. The personal viewport, outline and performance scene (spec 48 #370): `packages/api/src/screen-viewport.ts` holds the strict `wireframeViewportSchema` (centre, zoom, view-local collapsed groups only; selection, inspector, edit mode and unsaved operations are refused), `neutralViewport` (`Fit View`), `fitContentViewport`, `restoreViewport` (a meaningless, NaN or empty-region position fits the content) and the pan/zoom helpers; `packages/db/src/schema/screen.ts` adds `account_screen_viewport` (primary key account + Screen, cascade from the Screen, never keyed by Wireframe version; migration `0131_screen_viewport`); `ScreenStore.findViewport`/`saveViewport` and the `screenViewport`/`saveScreenViewport` RPCs are separate from the Wireframe read/save, so a viewport write cannot touch a Wireframe version, a share snapshot, an export input or the Screen list and a geometry write cannot refetch the viewport. In the web feature `engine/viewport-session.ts` is the viewport store (never an editor command or undo step), `engine/scene.ts` the RBush culling index over blocks and derived visual links plus the deterministic 500/750 and 2,000/3,000 scene builder, `engine/outline.ts` the pure outline grouping/inspect/source-record helpers, `ui/wireframe-outline.tsx` the keyboard-complete structured outline (select, `Move up`/`Move down`, collapse groups, align, `Remove Block`, inspect, `Open Source Record`; `Convert and Bind` and `Detach Link` mount on the selected row only), and `wireframe-stage.tsx` draws only culled blocks and one batched link path with the viewport as Stage scale/position (never a CSS transform). The editor gained `reorderBlock`/`alignBlocks` commands (`wireframe-commands.ts`) and keyboard helpers; `wireframe-surface.tsx` debounces the viewport write on its own query key. Seam tests: `engine/viewport-outline-scene.test.ts`, `ui/wireframe-pane.test.tsx`, `apps/server/src/features/screens/server/viewport.test.ts`, the viewport case in `screens-database.test.ts` (PostgreSQL seam) and the Playwright journey `apps/web/e2e/screens-canvas-outline.e2e.ts` (canvas yapılandırılmış outline). Convert and Bind is described next.

Convert and Bind, Origin Location, live cards and Wireframe templates (spec 48 #369) are owned by `packages/api/src/screen-origins.ts` (strict preview/confirm/rebind contracts, the closed target set Work, Decision, Risk and Open Question with no Screen, `buildConvertAndBindPlan`/`isSameConvertAndBindPlan`, `resolveOriginLocation`, `SOURCE_ITEM_GONE_LABEL`) and `packages/api/src/screen-templates.ts` (`sanitizeTemplateDocument` drops live record cards, live Document references and Screen transitions; `instantiateTemplateDocument` remaps linked-block definitions), `packages/db/src/schema/screen.ts` (`project_screen_block_origin`, the `Kökeni` + Origin Location row with a composite foreign key to the exact `project_screen_wireframe_version`; `workspace_screen_wireframe_template`; migration `0130_screen_block_origin`) and `apps/server/src/features/screens/server/screens-origins-database.ts` (the PostgreSQL half; it creates the single record through `createConvertedRecord` in `apps/server/src/features/evidence/server/evidence-record-creation.ts`, shared with Evidence conversions). A version named by an origin is sealed without a flag: `saveWireframe` opens a new working version instead of mutating it, so Origin Location stays exact, and `Kaynak öğe artık yok` is read from the Screen's working Wireframe by block id only, never retargeted. The `Live Card` block (`createLiveCardBlock`) is a read-only view whose move command only changes placement; `liveCards` on `ScreenWireframe` is read live. `ui/screen-templates.tsx` hosts `Save as Template` (chosen saved version) and `Create Screen from Template` in `screens-view.tsx`, and `ui/live-card-picker.tsx` the toolbar `Place live card` (record type and id; the editor's `placeLiveCard` stores only the reference). Saving a Wireframe on an Archived Screen is allowed (Archive is visibility; Trash and an archived Project are the write boundaries). The inspector control is `apps/web/src/features/screens/ui/convert-and-bind-panel.tsx`, mounted by `wireframe-pane.tsx` for the selected block only. Seam tests are `convert-and-bind.test.ts`, `screens-origins-database.test.ts` (PostgreSQL seam), `convert-and-bind-panel.test.tsx`, `screen-templates.test.tsx`, `live-card-picker.test.tsx` and `engine/live-card-paint.test.ts`.

User Flow (spec 49) is owned by `packages/api/src/user-flow.ts` (strict node/document contract with the closed `Screen`, `Action`, `Decision`, `State/Outcome`, `Section` set, `UserFlowStore`/`UserFlowAccess`, the common broken-reference resolver `resolveScreenReference`, and the broken-target-excluding projections `userFlowSearchableText`, `userFlowCounts`, `userFlowExportContent`), `packages/db/src/schema/user-flow.ts` (`user_flow` master record, `user_flow_version` versioned JSONB document, and the superseded stand-in `screen` table, now unused because User Flow reads and writes spec 48's `project_screen`, to be dropped by a later contract migration; migration `0124`) and `apps/server/src/features/user-flow/server/` (`user-flow.ts` access, `user-flow-database.ts` PostgreSQL adapter exposed as `userFlow` in `services.ts`). A Screen node stores only the live Screen id and node-local text; the router exposes `userFlows`, `userFlow`, `userFlowScreens`, `createUserFlow`, `saveUserFlowVersion` and `placeUserFlowNode`. The web surface is `apps/web/src/features/user-flow/ui/` (`user-flow-view.tsx` outline, `Place node` form and `ScreenReference` presentation; `user-flow-canvas.tsx` React Flow adapter; `user-flow-surface.tsx` data wiring), mounted from `project-shell-surface.tsx` at the `project-area-design` and `user-flows` hashes. Spec 49 #372 closes the semantic set at three layers: the strict `userFlowNodeKindSchema` in the API contract, the server seam, and the generated `user_flow_version.closed_set` verdict with `user_flow_version_closed_set_check` (migration `0125`, a new generated column so the guard stays expand-only). A node also carries a `style` from the fixed `USER_FLOW_NODE_TONES` palette; the tone is decoration only and never changes `kind`, search, counts or export. The editor essentials are pure operations on the versioned document in `apps/web/src/features/user-flow/lib/`: `flow-editor.ts` (`createEditor`, `select`, `moveSelection`, `setNodePositions`, `alignSelection`, `reorderSelection`, `copySelection`/`paste` with fresh ids and live `screenId`, `deleteSelection`, `undo`/`redo`, `markSaved`), `flow-keyboard.ts` (`commandForKey`, the keyboard alternative of every canvas gesture) and `flow-style.ts` (tone palette, contrast check, per-kind shape). `user-flow-canvas.tsx` is only the React Flow adapter (pan, zoom, `Fit View`, fit selection, drag) and saves through `saveUserFlowVersion`. Undo is local to unsaved operations; a saved version is a boundary and is not reverted through the Mutation Contract (`mutation-and-undo`), because a version is append-only. Seam tests are `user-flow.test.ts`, `user-flow-view.test.tsx` and `lib/flow-editor.test.ts`, plus `user-flow-convert.test.ts` and `user-flow-database.test.ts` (#373).

Spec 49 #373 adds `Convert and Bind`, `Promote to Screen`, read-only live cards and custom templates to the same seam, with migration `0126` (three new tables, expand-only): `user_flow_record_bind` (one bind per node-to-record conversion with the immutable Origin Location `user_flow_id`, `node_id`, `origin_version` and the movable `bound_version`), `user_flow_record_bind_rebind` (rebind history) and `user_flow_template` (Workspace-scoped stamp). `packages/api/src/user-flow.ts` owns the closed `USER_FLOW_CONVERT_TARGETS` (`Work`, `Decision`, `Risk`, `Open Question`; a Screen is never a target), `buildUserFlowConvertPlan`/`isSameUserFlowPlan` (preview and exact-plan confirmation), `buildUserFlowRebindPlan`, `buildUserFlowBindView`, `resolveRecordReference` (card and bind broken-target presentation), `buildUserFlowTemplateStructure`/`instantiateUserFlowTemplate` (structure and placeholders only, fresh ids, Screen nodes become unlinked placeholders) and the optional `cards` of `UserFlowDocument`. The server seam (`user-flow.ts`) exposes `previewConvert`, `convertNode`, `binds`, `previewRebind`, `rebind`, `promoteToScreen`, `placeCard`, `cardRecords`, `saveTemplate`, `templates` and `createFromTemplate`; `user-flow-database.ts` confirms a conversion through the Mutation Contract and `insertConvertedRecord` in `features/evidence/server/evidence-record-creation.ts`, the same insert `createEvidenceRecord` uses for Document conversions (a Work gets `originOwnerRecordId` = User Flow id, `originComponentId` = node id, `originSourceVersion` = flow version). The router adds `previewUserFlowConvert`, `convertUserFlowNode`, `userFlowBinds`, `previewUserFlowRebind`, `rebindUserFlowBind`, `promoteUserFlowNode`, `placeUserFlowCard`, `userFlowCardRecords`, `userFlowTemplates`, `saveUserFlowTemplate` and `createUserFlowFromTemplate`. Web: `convert-and-bind-dialog.tsx` (`Convert and Bind` preview dialog), `rebind-dialog.tsx` (`Rebind`, preview first), `user-flow-records.tsx` (`RecordReference`, `LiveCardList`, `PlaceCardForm`, `BindList`), `user-flow-promote-templates.tsx` (`PromoteToScreenForm`, `SaveTemplateForm`, `CreateFromTemplateForm`); `flow-editor.ts` carries `cards` through every operation and adds `setCardPositions` and `removeCard`. The in-memory seam store for tests is `user-flow-test-support.ts`; `user-flow-database.test.ts` runs only when `ACCOUNT_ACCESS_DATABASE_URL` is set.

Spec 49 #374 adds the personal viewport, the pointer-free `Outline` and the 500 visible / 750 link hard scene to the same seam, with migration `0127` (one new table, expand-only): `user_flow_viewport` holds one row per `(account_id, user_flow_id)` with the viewport center, zoom and view-local Section collapse. It is deliberately outside `user_flow_version`, so it is never part of the versioned document, a bind, a template, search, counts or export, and never another account's view; selection, inspector, edit mode and unsaved operations have no field in it. `packages/api/src/user-flow.ts` owns `userFlowViewportSchema`, `resolveUserFlowViewport` (restore only when the saved rectangle still shows a visible item, otherwise fit visible content; items hidden by a collapsed Section do not count), `liveCollapsedSections`, the optional node `sectionId` (a non-Section node grouped under a Section node) and `USER_FLOW_VISIBLE_ITEM_LIMIT` (nodes plus live cards share the 500; links stay at 750), enforced by the document schema and by `UserFlowSceneLimitError` on `placeNode`, `placeCard` and `promoteToScreen`. The server seam adds `viewport` and `saveViewport` (no version is written); the router adds `userFlowViewport` and `saveUserFlowViewport`. Web: `lib/flow-outline.ts` (`buildOutline`, `hiddenNodeIds`, `toggleCollapsed`) and the outline operations of `flow-editor.ts` (`addNode`, `moveInOutline`, `groupSelection`, `assignSelectionToSection`, `connectNodes`, `disconnectLink`) feed `ui/user-flow-outline.tsx`, which edits the same unsaved editor state as the canvas; `user-flow-canvas.tsx` restores or fits on init, remembers the viewport (debounced) through `onViewportChange`, sets `onlyRenderVisibleElements`, and `Fit View` expands every Section. `user-flow-surface.tsx` loads the viewport query before it mounts the canvas. Seam tests: `user-flow-viewport.test.ts`, `user-flow-viewport-resolve.test.ts`, `lib/flow-outline.test.ts`, `lib/flow-scene-performance.test.ts` (editor-model frame budget; not a browser paint measurement) and `ui/user-flow-outline.test.tsx` (the `canvas yapılandırılmış outline` journey).

Planned Tests and Handoff (spec 53) case half (#392) is owned by `packages/api/src/planned-tests.ts` (strict `createPlannedTestCaseInputSchema`/`createPlannedTestCaseVersionInputSchema` with the closed `PLANNED_TEST_RELATION_TARGET_TYPES` set Work, Feature, Document, Decision, Risk, Project Goal, Milestone, Source and Screen, `plannedTestCaseVersionInputSchema` whose required `version` is the exact pin later Session Test binds, Handoff selections and package exports extend, `isSamePlannedTestContent`, and the `PlannedTestsAccess`/`PlannedTestStore`/`PlannedTestTransaction`/`PlannedTestTargetResolver` contracts), `packages/db/src/schema/planned-test.ts` (`project_planned_test_case` identity and head pointer, immutable `project_planned_test_case_version` rows, and `project_planned_test_case_relation` rows owned by a version; no result, status, step or runner column; migration `0132_planned_test_case_versions`) and `apps/server/src/features/planned-tests/server/` (`planned-tests.ts` access and errors, `planned-tests-database.ts` PostgreSQL store plus the live owner resolvers, `planned-tests-memory-store.ts` in-memory harness with a fake owner catalog). The access has exactly `list`, `create`, `createVersion`, `version` and `relationTargets`: a save appends a full version (`Meaningful change` or `Editorial change`, never an in-place edit), a Document relation pins the current revision and an optional stable section, a relation to a record that is missing, from another Project, archived or in Trash is refused, and a relation that later goes away reads as broken (`Archived`, `In Trash`, `Permanently deleted`) and is carried forward untouched so it cannot block editing. Tickets 02 to 04 add Session Test pinning, the Test Handoff lifecycle and the package export as further operations on this module and further tables keyed by `(case_id, version)`; they must not add a "latest" lookup. The router exposes `projectPlannedTestCases`, `createPlannedTestCase`, `createPlannedTestCaseVersion`, `plannedTestCaseVersion` and `plannedTestRelationTargets`. The web surface is `apps/web/src/features/planned-tests/` (`lib/planned-test-form.ts` form values and relation drafts, `ui/planned-tests-view.tsx` list, `Create Planned Test Case` and `New version` forms with focus handling, `ui/planned-test-relations-field.tsx` native labelled relation picker, `ui/planned-tests-surface.tsx` data wiring), mounted by `project-shell-surface.tsx` at the `tests` and `project-area-tests` hashes. Seam tests are `planned-tests.test.ts`, `planned-tests-rpc.test.ts`, `planned-tests-database.test.ts` (PostgreSQL seam) and `ui/planned-tests-view.test.tsx`. Behavior rules live in `docs/specs/53-test-plan-and-handoff/spec.md`.

Spec 53 #393 adds the Session Test (Oturum Testi) bind to the same module, with migration `0133_session_test_exact_version_bind` (one new table, expand-only): `project_session_test` in `packages/db/src/schema/planned-test.ts` holds a Project-scoped Session Test with a composite foreign key `(scenario_id, scenario_version)` to `project_planned_test_case_version`, `bind_origin` (`Bound when recorded` or `Linked later`) and `linked_at`; an ad hoc or late-linked test keeps its own `purpose`/`expected_behavior`, a test bound when recorded keeps both null. It has no parent Test Session, result, review or evidence column (specs 54 and 57 add those). `packages/api/src/planned-tests.ts` owns `recordSessionTestInputSchema` (ad hoc needs purpose and expected behavior, a bound test must not carry them), `linkSessionTestInputSchema`, `SessionTestStoredRecord`, `describeSessionTestBind`/`toSessionTestRecord` (the explicit `summary` such as `Bound to v1, current v3`, `changesSinceBound`, `executedVersion` which stays `null` for a late link, and `validatesCurrentVersion`) and the `recordSessionTest`, `linkSessionTest` and `sessionTests` members of `PlannedTestsAccess`. There is no rebind operation: `linkSessionTest` only sets a bind on a test that has none, and the store refuses it with `SessionTestAlreadyBoundError` otherwise. The server access adds `recordSessionTest`, `linkSessionTest` and `sessionTests` (`session-tests.test.ts` is the in-memory seam test; the PostgreSQL seam test lives in `planned-tests-database.test.ts`); the router adds `projectSessionTests`, `recordSessionTest` and `linkSessionTest`. Web: `ui/session-tests-view.tsx` (`Session Tests` list, `Record Session Test` form, `Link to Planned Test Case version`) mounted below the case list by `planned-tests-surface.tsx`, tested by `ui/session-tests-view.test.tsx`.
