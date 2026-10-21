# structure.md

> This tree records source-backed ownership boundaries. Future feature names remain in specs until source exists, and generated files are omitted.

## Web feature layout

Each `apps/web/src/features/<feature>/` keeps a form in `ui/forms/<name>-form.tsx`, shared UI parts in `ui/components/`, and pure helpers and Zod schemas in `lib/`. The first example is `apps/web/src/features/account-preferences/ui/forms/account-preferences-form.tsx`; form technology follows the TanStack Form entry in [`docs/tech-stack.md`](docs/tech-stack.md).

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

Technical Diagram authority modes: `packages/api/src/technical-diagram-authority.ts` owns the closed `Diagram Authority Mode` catalog, the creatable subset (no `Repository-derived View`), the create command, the exact-HTTPS `External Source Link` input (URL, known revision, source tool, last check; no iframe, cache or edit), and the pure authority-conversion preview and preview-token guard. There is no in-place mode change; `convertAuthority` in `technical-diagrams-database.ts` mints a new identity and stores the two-way `Originates from` / `Derived` origin in `diagram_authority_origin` (`packages/db/src/schema/technical-diagram.ts`). Seam tests: `technical-diagram-authority.test.ts` (pure rules) and `technical-diagrams-authority-rpc.test.ts` (DB-free RPC); web controls in `diagram-authority-controls.tsx` and `new-technical-diagram-form.tsx`.

Technical Diagram structural model (spec 59 #421): `packages/api/src/technical-diagram-structure.ts` owns the typed canonical model of the three types (strict zod schemas per type: closed Architecture catalog with typed links, designed PostgreSQL Data Model, Sequence participants/messages/limited control groups with an optional exact Architecture node bind whose nullable `versionId` pins a Diagram Version), `resolveStructuralModel`, `diagramGraph` (read-only element projection for views, cards and the canvas), and the deterministic `canonicalStructuralModel`. Types live in `packages/db/src/schema/technical-diagram.ts`; the model stays in `technical_diagram.model` jsonb, validated per type at every write, and coordinates live only in `diagram_view.layout` (migration `0152`, expand-only). `saveTechnicalDiagramStructure` and `saveDiagramLayout` are the only edit commands; no DSL, Mermaid, SQL or DBML is a second source and no SQL is emitted (60). Web: `technical-diagram-outline.tsx` (structured outline), `technical-diagram-editor.tsx` with `lib/technical-diagram-edit.ts`, and `technical-diagram-canvas.tsx` (React Flow view).

Technical Diagram Views and Versions (spec 59 #422, migration `0153`, expand-only): `packages/api/src/technical-diagram-version.ts` owns `DIAGRAM_VERSION_LABELS`, the strict create (name plus confirmation key, no model or mode) and restore (shown `expectedRevision`) inputs, `createCheckpoint`, `restoreFromCheckpoint`, `diagramVersionReference` (the exact reference other specs pin) and `assertVersionBind`. `diagram_version` (`packages/db/src/schema/technical-diagram.ts`) is append-only with a copied model and no update path; `technical_diagram.revision` is the live revision that model saves and restores advance; `diagram_view` keeps ids and layout only, re-derived per edit through `pruneDiagramViewSelection`: the built-in `Default` view always selects the whole live element set (so a `Live` card that names no view keeps following added nodes) while a named view keeps its author's selection and only prunes deleted elements. `technical-diagrams-database.ts` adds `createVersion`, `listVersions`, `getVersion` and `restoreVersion`; every confirming command finds its prior result by the confirmation key on a lost concurrent insert instead of erroring (ADR-0004). the router exposes `createDiagramVersion`, `technicalDiagramVersions`, `technicalDiagramVersion` and `restoreDiagramVersion`, and a lifeline bind with `versionId` is checked against that checkpoint. Web: `diagram-version-panel.tsx` and the version choice in `technical-diagram-editor.tsx`; Playwright journey `apps/web/e2e/technical-diagrams.e2e.ts`.

Technical Diagram live cards and composition (spec 59 #423, migration `0154`, expand-only): `packages/api/src/technical-diagram-card.ts` owns `DIAGRAM_CARD_LABELS` (`Live`, `Exact`, `Convert to record and link`), `pinDiagramToVersion` and `diagramCardProjection` (the one read-only projection a Document or Project Wall card draws, so a card holds a source identity and never copies elements), the record-card inputs (identity plus position only, closed to `Work`, `Decision`, `Risk`, `Open Question`) and the previewed `Convert to record and link` plan (`buildConvertToRecordPlan`, `isSameConvertToRecordPlan`: target type, fields, exact `Diagram Version` and origin; the diagram and its authority mode are never written). `TechnicalDiagramSource.exactVersion` is set only when a card reads a checkpoint. Documents pin with an optional `versionId` on `:::live-diagram{...}` (`documents.ts`, usage-link location in `documents-database.ts`; router `liveDocumentBlockSource` and the Markdown export read the checkpoint). The Project Wall pins through `project_wall_item.diagram_version_id` (`setCardPin`, `ProjectWallDiagrams.getVersion`; null is `Live`). `diagram_record_card` and `diagram_record_link` (`packages/db/src/schema/technical-diagram.ts`) hold canvas record cards and the record opened from a node of one exact version; `technicalDiagramRecordCards`, `placeDiagramRecordCard`, `moveDiagramRecordCard`, `removeDiagramRecordCard`, `previewDiagramNodeConversion` and `convertDiagramNodeToRecord` live on `TechnicalDiagramsAccess`; the one record is born through `insertConvertedRecord` and `readRecordRows` is reused from the User Flow store. Web: `diagram-composition-panel.tsx`, record cards in `technical-diagram-canvas.tsx`, the pin control in `project-wall-card.tsx` and the `Diagram Version` choice in the Documents insert panel. Surfaces 51 and 31 call these commands and open no second model.

Technical Diagram Mermaid conversion (spec 59 #424, no migration): `packages/api/src/technical-diagram-mermaid.ts` owns `MERMAID_CONVERT_LABELS`, the exact fenced-block reader, the pure block outcome (`Keep independent` leaves the body untouched; `Replace with live reference` swaps only the chosen block for `:::live-diagram{...}`) and `describeMermaidConversion` (source Document and version, block line, `Originates from` relation, block effect, Document revision after, every lost line, `roundTripSync: false`). `previewConversion` and `convert` in `technical-diagrams-database.ts` apply it in one transaction (new `Imported Independent Copy`, `diagram_document_origin`, default view, optional replacement with the Document revision increment and the `Live block` usage link); the diagram id is the confirmation key, so a retry returns the same diagram. Web: the `Convert to Technical Diagram` dialog in `project-documents-surface.tsx`; Playwright journey `apps/web/e2e/technical-diagrams.e2e.ts`.

Technical Diagram personal viewport (spec 59 #425, migrations `0155` + `0156`, expand-only): `technical_diagram_viewport` (`packages/db/src/schema/technical-diagram.ts`; one row per `(account_id, diagram_id, view_id)`, `view_id` empty for the default view, cascade from the diagram, indexed by `diagram_id` for the delete cascade) holds the viewport center, zoom and view-local collapse as jsonb. It is deliberately outside `technical_diagram.model`, its hash, `diagram_view`, versions, cards, share Snapshots and exports, and never another Account's view. `packages/api/src/technical-diagram-viewport.ts` owns the schema, `diagramGroups` (an Architecture `Boundary` and what it transitively contains), `hiddenDiagramNodeIds`, `resolveTechnicalDiagramViewport` (restore only when the saved rectangle still shows a visible node, otherwise fit; a deleted group id is dropped) and `neutralDiagramView` (`Fit view`: fit and expand every group). The access adds `viewport` and `saveViewport` (writes no diagram, view, version or card; stale group ids are dropped) and the router `technicalDiagramViewport` and `saveTechnicalDiagramViewport`. Web: `hooks/use-personal-technical-diagram-view.ts` (TanStack Pacer `LiteDebouncer` save, flushed on leaving or switching) and the personal view, `Collapse group`/`Expand group` and `Fit view` in `technical-diagram-canvas.tsx`. Seam tests: `technical-diagram-viewport.test.ts`, the `Personal viewport (#425)` cases in `technical-diagrams-authority-rpc.test.ts` and `technical-diagram-canvas.test.tsx`.

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

Project Wall (spec 51) #384 is owned by `packages/api/src/project-wall.ts` (strict inputs that take no parent wall, Workspace, title, note, task, file or CSS; the closed `PROJECT_WALL_SOURCE_TYPES` `Work`, `Decision`, `Risk`, `PROJECT_WALL_DENSITIES` `Compact`/`Preview`/`Detailed`, the limited `PROJECT_WALL_HIGHLIGHTS` palette, the product-chosen `PROJECT_WALL_DENSITY_FIELDS`, `buildProjectWallView` and the `ProjectWallStore`/`ProjectWallAccess` seams), `packages/db/src/schema/project-wall.ts` (`project_wall`: flat, named, Project-scoped; `project_wall_item`: a live card holding only `source_type`, `source_id` and wall view state `position_x`/`position_y`/`density`/`highlight`, unique per wall and source, no foreign key to the polymorphic source; migration `0139`, expand-only) and `apps/server/src/features/project-wall/server/` (`project-wall.ts` access, `project-wall-database.ts` PostgreSQL adapter exposed as `projectWall` in `services.ts`, `project-wall-test-support.ts` in-memory store). The store has no method that writes a source record; the source is read live and a deleted, trashed, archived or foreign source resolves through the common broken-reference presentation (`resolveRecordReference`). The router exposes `projectWalls`, `projectWall`, `projectWallSourceOptions`, `createProjectWall`, `renameProjectWall`, `deleteProjectWall`, `addProjectWallCard`, `moveProjectWallCards`, `setProjectWallCardDensity`, `setProjectWallCardHighlight` and `removeProjectWallCard`. The web surface is `apps/web/src/features/project-wall/ui/` (`project-wall-card.tsx` live card with density, highlight and `Open Source Record`; `project-wall-view.tsx` wall list and `Place live card` form; `project-wall-canvas.tsx` React Flow adapter, drag persists only wall positions; `project-wall-surface.tsx` data wiring), mounted from `project-shell-surface.tsx` under the Screens surface at the `design` and `project-area-design` hashes. Seam tests: `project-wall.test.ts` (live identity, layout never writes a source, no wall-only content, no nested or Workspace wall), `project-wall-database.test.ts` (runs only when `ACCOUNT_ACCESS_DATABASE_URL` is set) and `ui/project-wall.test.tsx`. Spec 51 #385 adds, next to those two: `project_wall_group` (named, single-level, no parent; its `collapsed` column is a compatibility remainder since collapse moved to the personal viewport), `project_wall_link` (a directed labeled `Visual link` between two items of one wall, no relation reference) and the `locked` and `group_id` columns of `project_wall_item` (migration `0140`, expand-only). The seam gains `drawLink`/`unbindLink`, `previewPersistentRelation`/`createPersistentRelation` (the wall recomputes the preview through the injected relations seam, `createDatabaseProjectWall(db, relations)`, and calls `relations.create` only for the matching `previewId`; drawing a line, grouping, proximity and locking write no relation), `setCardLock` (`moveCards` skips locked cards in the seam and in the SQL `where`; a lock never touches the source record or its lifecycle), and `createGroup`/`deleteGroup`/`setCardGroup` (the older `setGroupCollapsed` was retired: collapse is the account's personal viewport state). There is no freehand or Sketch card type: `PROJECT_WALL_SOURCE_TYPES` holds only master-record references (`Work`, `Decision`, `Risk`, plus the read-only `Technical Diagram` and `Smart Collection` of spec 51 #387). The router adds `drawProjectWallLink`, `unbindProjectWallLink`, `previewProjectWallPersistentRelation`, `createProjectWallPersistentRelation`, `setProjectWallCardLock`, `createProjectWallGroup`, `deleteProjectWallGroup` and `setProjectWallCardGroup`. The web panel `ui/project-wall-narrative.tsx` holds the `Visual link` form and list, the previewed `Create Persistent Relation` flow and groups; `project-wall-canvas.tsx` draws lines as labeled edges and disables dragging of locked cards. Seam tests: `project-wall-links.test.ts`.

Spec 51 #387 adds `Presentation Mode`, the internal `Frozen copy` snapshot and two read-only card previews, with migration `0141` (expand-only): `project_wall_focus_step` (the optional `Focus order`, `(wall_id, item_id)` primary key and unique `position`, cascade from wall and item; view metadata that lists existing cards and owns no content), `project_wall_item.diagram_view_id` (the selected Diagram View of a `Technical Diagram` card) and a widened `project_wall_item_source_type_check` (`Technical Diagram`, `Smart Collection`). `packages/api/src/project-wall-presentation.ts` owns the labels (`PROJECT_WALL_PRESENTATION_LABELS`, `PROJECT_WALL_SNAPSHOT_LABELS`), `setProjectWallFocusOrderInputSchema`, `projectWallPresentationSequence` (reuses `presentationSequence` of the Moodboard), the exactly-one-scope snapshot inputs (a group or a region of cards, `snapshotFormatSchema` shared with the Moodboard), and `buildProjectWallSnapshotData`/`buildProjectWallSnapshotPreview`, which freeze the selected cards into plain text and positions with no id, path or link. `packages/api/src/project-wall.ts` adds `ProjectWallDiagrams` and `ProjectWallCollections` (read-only slices of `TechnicalDiagramsAccess` and `SmartCollectionsAccess`), `ProjectWallCardPreview` (`Live`/`Exact` diagram preview; limited Smart Collection summary of `PROJECT_WALL_COLLECTION_SUMMARY_LIMIT` records with `Open all in source`), `sharedSource` and `sharedWithCard` for the `Shared source` callout. The server seam (`createProjectWall(store, { diagrams, collections, renderer })`) reads a diagram through `diagrams.get` and a collection through `collections.getView(..., { readOnly: true })`, so the wall owns no diagram model, query or membership; a Smart Collection block is not a relation endpoint. It adds `setFocusOrder`, `previewSnapshot` and `exportSnapshot`; a snapshot reads the live wall once, writes nothing, takes no share dependency and does not lock the wall. `project-wall-snapshot-render.ts` renders the frozen data as one static page through `withSnapshotHtmlPage` (extracted from `moodboard-snapshot-render.ts`, same script-less, network-less Chromium boundary). The router adds `setProjectWallFocusOrder`, `previewProjectWallSnapshot` and `exportProjectWallSnapshot`. Web: `ui/project-wall-presentation.tsx` (`ProjectWallPresentationView` without any card action, `ProjectWallFocusOrderEditor`, `ProjectWallSnapshotPanel` whose `Preview` names the `Frozen copy`); the card previews live in `project-wall-card.tsx`; `Presentation Mode` is local UI state in `ProjectWallLayout`, so exit returns to the same wall. Seam tests: `project-wall-presentation.test.ts`, `project-wall-snapshot-render.test.ts` and the PostgreSQL case in `project-wall-database.test.ts`. Exact pinning of a Technical Diagram card landed with spec 59 #423 (see the Technical Diagram live cards paragraph).

Spec 51 #386 adds no schema or migration: the Sitemap and Customer Journey skeletons reuse `project_wall` and `project_wall_group`. `packages/api/src/project-wall.ts` owns `PROJECT_WALL_SKELETONS` and `projectWallSkeletonHeadings`, which read the exact ordered headings from the Project shell `STARTER_SKELETON_CATALOG` instead of copying them; the store gains `createWallWithGroups` (one transaction, explicit increasing group timestamps so heading order survives) and `selectedSkeletons` (reads the shell `configuration` selection, never writes it); the seam gains `skeletons` and `createFromSkeleton`, which rejects a skeleton the shell did not select with `ProjectWallSkeletonNotSelectedError` and writes only the wall and its empty groups, so afterwards it is an ordinary wall. The Project shell still records catalog selection metadata only and creates no wall row. The router adds `projectWallSkeletons` and `createProjectWallFromSkeleton`; `project-wall-view.tsx` shows `Create from Sitemap` and `Create from Customer Journey` only for selected skeletons. Seam tests: `project-wall-skeletons.test.ts` (golden headings, no sample content, ordinary wall, shell selection creates no wall) plus one case in `project-wall-database.test.ts`. The personal viewport, `Outline` and auto-layout arrive with #388 below.

Spec 51 #388 adds the personal viewport, the pointer-free `Outline` and the 500 / 750 hard scene to the same seam, with migration `0142` (expand-only): `project_wall_viewport` (one row per `(account_id, wall_id)` with the viewport center, zoom and view-local group collapse as jsonb, cascade from the wall; deliberately outside `project_wall`, the cards, links, relations, `Snapshot` input and export, never another account's view, no field for selection, inspector or unsaved operations) and `project_wall_item.z_order` (the card order that is both the `Outline` order and the z-order; the read orders by `z_order`, then placement, so existing walls keep their order and a new card lands on top). `packages/api/src/project-wall-viewport.ts` owns the viewport schema, `liveCollapsedGroups`, `resolveProjectWallViewport` (restore only when the saved rectangle still shows a visible card, otherwise fit visible content; cards hidden by a collapsed group do not count), `projectWallSceneStatus` and the scene numbers `PROJECT_WALL_SCENE_ITEM_LIMIT` 500 / `PROJECT_WALL_SCENE_LINK_LIMIT` 750, which are a performance target and not a create cap: past them the canvas warns and reduces detail and the wall keeps every card and link. The seam adds `viewport`, `saveViewport` (no wall, card or source is written; archived Projects can still keep a personal position) and `reorderCards` (every card exactly once; positions and `Lock Position` are untouched); the store adds `findViewport`, `saveViewport` and `setCardOrder` (one SQL statement); the router adds `projectWallViewport`, `saveProjectWallViewport` and `reorderProjectWallCards`. Web: `hooks/use-personal-project-wall-view.ts` (debounced save, flushed on leaving or switching a wall), `lib/project-wall-layout.ts` (nudge, `Align`, distribute, z-order and previewable reversible auto-layout; a `Lock Position` card is never in a returned move), `lib/project-wall-outline.ts` (`buildOutline`, `moveInOutline`, `hiddenCardIds`), `lib/project-wall-keyboard.ts`, `lib/project-wall-scene.ts` (transform math, cards and links in view), `ui/project-wall-outline.tsx` (select, `Move up`/`Move down`, `Group`, `Group selection`, `Bind`, `Unbind`, `Inspect` with `Open Source Record`; TanStack Virtual above 150 rows), `ui/project-wall-scene.tsx` (canvas and `Outline` share one session-only selection) and the rewritten `ui/project-wall-canvas.tsx` (restore or fit on init, `onlyRenderVisibleElements`, keyboard commands on the canvas, `Fit View` expands every group, auto-layout preview/apply/undo, reduced detail beyond the scene). `ui/project-wall-surface.tsx` loads the viewport before it mounts the scene and applies the account's own collapse over the groups, so `Collapse group` is personal; the retired `setGroupCollapsed` contract is gone and `project_wall_group.collapsed` stays only as a physical remainder no seam reads or writes. Seam tests: `project-wall-viewport.test.ts`, the PostgreSQL case in `project-wall-database.test.ts`, `packages/api/src/project-wall-viewport.test.ts`, `lib/project-wall-layout.test.ts`, `lib/project-wall-scene-performance.test.ts` (editor-model frame budget p95 <= 16 ms, max <= 33 ms; not a browser paint measurement), `ui/project-wall-outline.test.tsx` (the `canvas yapılandırılmış outline` journey) and `ui/project-wall-canvas.test.tsx`.

Planned Tests and Handoff (spec 53) case half (#392) is owned by `packages/api/src/planned-tests.ts` (strict `createPlannedTestCaseInputSchema`/`createPlannedTestCaseVersionInputSchema` with the closed `PLANNED_TEST_RELATION_TARGET_TYPES` set Work, Feature, Document, Decision, Risk, Project Goal, Milestone, Source and Screen, `plannedTestCaseVersionInputSchema` whose required `version` is the exact pin later Session Test binds, Handoff selections and package exports extend, `isSamePlannedTestContent`, and the `PlannedTestsAccess`/`PlannedTestStore`/`PlannedTestTransaction`/`PlannedTestTargetResolver` contracts), `packages/db/src/schema/planned-test.ts` (`project_planned_test_case` identity and head pointer, immutable `project_planned_test_case_version` rows, and `project_planned_test_case_relation` rows owned by a version; no result, status, step or runner column; migration `0135_planned_test_case_versions`) and `apps/server/src/features/planned-tests/server/` (`planned-tests.ts` access and errors, `planned-tests-database.ts` PostgreSQL store plus the live owner resolvers, `planned-tests-memory-store.ts` in-memory harness with a fake owner catalog). The access has exactly `list`, `create`, `createVersion`, `version` and `relationTargets`: a save appends a full version (`Meaningful change` or `Editorial change`, never an in-place edit), a Document relation pins the current revision and an optional stable section, a relation to a record that is missing, from another Project, archived or in Trash is refused, and a relation that later goes away reads as broken (`Archived`, `In Trash`, `Permanently deleted`) and is carried forward untouched so it cannot block editing. Tickets 02 to 04 add Session Test pinning, the Test Handoff lifecycle and the package export as further operations on this module and further tables keyed by `(case_id, version)`; they must not add a "latest" lookup. The router exposes `projectPlannedTestCases`, `createPlannedTestCase`, `createPlannedTestCaseVersion`, `plannedTestCaseVersion` and `plannedTestRelationTargets`. The web surface is `apps/web/src/features/planned-tests/` (`lib/planned-test-form.ts` form values and relation drafts, `ui/planned-tests-view.tsx` list, `Create Planned Test Case` and `New version` forms with focus handling, `ui/planned-test-relations-field.tsx` native labelled relation picker, `ui/planned-tests-surface.tsx` data wiring), mounted by `project-shell-surface.tsx` at the `tests` and `project-area-tests` hashes. Seam tests are `planned-tests.test.ts`, `planned-tests-rpc.test.ts`, `planned-tests-database.test.ts` (PostgreSQL seam) and `ui/planned-tests-view.test.tsx`. Behavior rules live in `docs/specs/53-test-plan-and-handoff/spec.md`.

Spec 53 #393 adds the Session Test (Oturum Testi) bind to the same module, with migration `0136_session_test_exact_version_bind` (one new table, expand-only): `project_session_test` in `packages/db/src/schema/planned-test.ts` holds a Project-scoped Session Test with a composite foreign key `(scenario_id, scenario_version)` to `project_planned_test_case_version`, `bind_origin` (`Bound when recorded` or `Linked later`) and `linked_at`; an ad hoc or late-linked test keeps its own `purpose`/`expected_behavior`, a test bound when recorded keeps both null. It has no parent Test Session, result, review or evidence column (specs 54 and 57 add those). `packages/api/src/planned-tests.ts` owns `recordSessionTestInputSchema` (ad hoc needs purpose and expected behavior, a bound test must not carry them), `linkSessionTestInputSchema`, `SessionTestStoredRecord`, `describeSessionTestBind`/`toSessionTestRecord` (the explicit `summary` such as `Bound to v1, current v3`, `changesSinceBound`, `executedVersion` which stays `null` for a late link, and `validatesCurrentVersion`) and the `recordSessionTest`, `linkSessionTest` and `sessionTests` members of `PlannedTestsAccess`. There is no rebind operation: `linkSessionTest` only sets a bind on a test that has none, and the store refuses it with `SessionTestAlreadyBoundError` otherwise. The server access adds `recordSessionTest`, `linkSessionTest` and `sessionTests` (`session-tests.test.ts` is the in-memory seam test; the PostgreSQL seam test lives in `planned-tests-database.test.ts`); the router adds `projectSessionTests`, `recordSessionTest` and `linkSessionTest`. Web: `ui/session-tests-view.tsx` (`Session Tests` list, `Record Session Test` form, `Link to Planned Test Case version`) mounted below the case list by `planned-tests-surface.tsx`, tested by `ui/session-tests-view.test.tsx`.

Spec 53 #394 adds the Test Handoff lifecycle to the same module, with migration `0137_test_handoff_lifecycle` (three new tables, expand-only). `packages/db/src/schema/planned-test.ts` owns `project_test_handoff` (title, purpose, optional `due_date`, free-text `target_executor`, founder-typed `build_*` columns that are `product_build_context`, `state` check-limited to `Draft`, `Ready to share`, `Shared`, `Result received`, `Closed`, `Canceled`, `state_changed_at`, and the `package_version` counter, `0` until the package export #395 produces one and the only value it increments), `project_test_handoff_scenario` (composite foreign key `(case_id, version)` to one immutable case version, one version per case per Handoff, ordered by `position`) and `project_test_handoff_session_test` (primary key `session_test_id`, so a Session Test arrives on one Handoff). There is no result, outcome, Work, return or reconcile column and no table shared with Work's external execution handoff (ADR-0015, `work-external-handoff.ts`). `packages/api/src/planned-tests.ts` owns `TEST_HANDOFF_STATES`, the `TEST_HANDOFF_TRANSITIONS` table (`Draft` to `Ready to share`/`Canceled`; `Ready to share` to `Draft`/`Shared`/`Canceled`; `Shared` to `Result received`/`Closed`/`Canceled`; `Result received` to `Shared`/`Closed`; `Closed` and `Canceled` final), `TEST_HANDOFF_EDITABLE_STATES` (content is editable only in `Draft` and `Ready to share`), the strict create/update/transition/link input schemas, `testHandoffBuildContextSchema` (http(s) URLs without credentials, query or fragment), `TestHandoffStoredRecord`/`TestHandoffRecord` and `toTestHandoffRecord`, which derives the only `suggestion` (`Result received`, shown for a `Shared` Handoff with a linked Session Test) and `resultAfterCancel`. The access adds `createHandoff`, `updateHandoff`, `transitionHandoff` (needs the `expectedState` the founder saw), `linkHandoffSessionTest` (a bound Session Test must be bound to a selected exact version; linking never changes state) and `handoffs`; every selected version goes through `requireExactVersion`, so unknown or other-Project versions are refused and there is no "latest". The router adds `projectTestHandoffs`, `createTestHandoff`, `updateTestHandoff`, `transitionTestHandoff` and `linkTestHandoffSessionTest`; there is no start, run, poll, schedule, cancel-remote or deliver procedure. Server: `test-handoffs.test.ts` (in-memory seam test), `planned-tests-rpc.test.ts` and the PostgreSQL cases in `planned-tests-database.test.ts`. Web: `lib/test-handoff-form.ts` and `ui/test-handoffs-view.tsx` (`Create Test Handoff`, `Mark as …` state moves, the `Result received` suggestion, `Link arriving Session Test`) mounted by `planned-tests-surface.tsx`, tested by `ui/test-handoffs-view.test.tsx`. Package export #395 must read `project_test_handoff` (+ scenario rows) and increment `package_version` in the same transaction; the due-date reminder is not wired because the source-linked reminder source types in `packages/api/src/personal-reminders.ts` do not include a Test Handoff.

Spec 53 #395 adds the Test Handoff package (Markdown and JSON of one package version) to the same module, with migration `0138_test_handoff_package_export` (three new tables and one nullable column, expand-only). `packages/api/src/test-handoff-package.ts` is the pure package contract: `TEST_HANDOFF_PACKAGE_KEYS` (the closed PRD 10 table), `buildTestHandoffPackage` (copies named fields only, never spreads a record, so nothing outside the table is representable), `renderTestHandoffPackageJson`, `renderTestHandoffPackageMarkdown` (reads only the JSON object, so it cannot carry a scenario or reference the JSON lacks) and the defensive secret scan (`findSecretKinds`, `scanTestHandoffPackageForSecrets`; it names the kind and path, never the value). `project_test_handoff` gains `environment_preconditions`; `project_test_handoff_ad_hoc_scope` holds founder-written `ad_hoc_scope[]` text (no case id, version or link); `project_test_handoff_context_ref` holds founder-selected Work, Feature, Document (exact revision and optional section) and Wireframe (exact version) refs with no foreign key on `target_id` (Technical Diagrams have no versions, so they are not selectable); `project_test_handoff_package` holds each produced package as inserted text (`json`, `markdown`) keyed by `(handoff_id, package_version)` with no update path. `packages/api/src/planned-tests.ts` adds the `adHocScope`, `contextRefs` and `environmentPreconditions` Handoff fields (Handoff text is rejected on save when the scan finds a secret), `PlannedTestTargetResolver.bindContext`/`readContext`/`contextCandidates`, the `TestHandoffPackagePreview`/`TestHandoffPackageRecord` types, `TEST_HANDOFF_PACKAGE_STATES` (only `Ready to share` and `Shared` produce a package) and the access members `contextTargets`, `previewPackage`, `producePackage` and `packages`. `previewPackage` writes nothing and withholds the rendering when a blocker (state, unavailable selected record, secret) exists; `producePackage` re-collects the package, compares the previewed fingerprint and `expectedPackageVersion`, then bumps `project_test_handoff.package_version` (compare-and-set) and inserts the package in the same transaction, without touching state or content. Scenario content is read from the exact `(case_id, version)` row, never the head. The router adds `previewTestHandoffPackage`, `produceTestHandoffPackage`, `projectTestHandoffPackages` and `testHandoffContextTargets`; there is still no start, run, poll, schedule, cancel-remote or deliver procedure. Server tests: `test-handoff-package.test.ts` (PRD-table golden, snapshot, state matrix, secret and closed-world cases, runner absence, difference from Work's external handoff), `planned-tests-rpc.test.ts` and the PostgreSQL cases in `planned-tests-database.test.ts`. Web: `ui/test-handoff-context-field.tsx` (native labelled `Package context` picker), `ui/test-handoff-package-panel.tsx` (`Preview package`, `Produce package version …`, copy and download of the `Markdown package` and `JSON package`) and the `Ad hoc scope`/`Environment preconditions` fields in `ui/test-handoffs-view.tsx`, tested by `ui/test-handoffs-view.test.tsx`. Report acceptance (spec 54) consumes `handoff_id` and `handoff_package_version`; this module does not accept reports.

Test Assessments (spec 56, #407 to #409) are owned by `packages/api/src/test-assessments.ts` (the strict `recordTestAssessmentInputSchema` with exactly one context of kind Feature, Handoff or Project Release plus cited Test Session, Test Gap and follow-up Work ids, known limits and the closed `Acceptable`/`Follow-up needed`/`Undecided` decision; `toTestAssessmentRecord`, which derives the `newContext` notice sources from recorded context events after `assessedAt`; and the `TestAssessmentsAccess`/`TestAssessmentStore`/`TestAssessmentTransaction` contracts), `packages/db/src/schema/test-assessment.ts` (insert-only `project_test_assessment` and `project_test_assessment_source`, migration `0143_wonderful_katie_power`; no score, coverage, gate, exception, acceptance-evidence or GitHub-check column, and no foreign key on `context_id` or the cited ids so archiving or removing a cited record cannot rewrite a snapshot) and `apps/server/src/features/test-assessments/server/` (`test-assessments.ts` access and errors, `test-assessments-database.ts` PostgreSQL store, `test-assessments-memory-store.ts` in-memory harness whose `addContextEvent` stands in for the owners of recorded test context). The access has exactly `list`, `record` and `contextTargets`: there is no update, reopen, carry-forward, gate or score operation, a new Project Release never inherits an earlier snapshot, and recording writes nothing to Test Sessions, Test Gaps, Work or Project Releases. Test Session and Test Gap ids stay opaque until their owners (specs 54 and 55) exist; follow-up Work ids and the context record are checked against the Project, and trashed or archived (`trashedAt`, `archivedAt`, `status === "Archived"`) Works are unavailable like the sibling target resolvers (`evidence-targets.ts`), so a cited or chosen Work in Trash refuses to record and an already-saved snapshot keeps its bytes with the live Feature label dropping to `null`. The router procedures declare output schemas (`testAssessmentRecordSchema`, the list and context-target outputs) alongside their inputs; no update, reopen, carry-forward, gate or score procedure exists. The Record form shows a visible alert with `Retry` when the context-target list fails to load. `contextEvents` returns nothing in the PostgreSQL store until those owners report recorded new or corrected results, new Gaps and bound context changes through it; no Notification Center signal id is emitted (PRD 04). Web: `apps/web/src/features/test-assessments/` (`lib/test-assessment-form.ts`, `ui/test-assessments-view.tsx` with the `Recent Test Assessments` list, `Record Test Assessment` form and `New test context after this assessment` notice, `ui/test-assessments-surface.tsx` data wiring) mounted below the Planned Tests surface by `project-shell-surface.tsx`. Seam tests are `test-assessments.test.ts`, `test-assessments-rpc.test.ts`, `test-assessments-database.test.ts` (PostgreSQL seam) and `ui/test-assessments-view.test.tsx`. Behavior rules live in `docs/specs/56-test-assessments/spec.md`.

Test Report Acceptance (spec 54) #399 is a separate module, not part of the Planned Tests access, with migration `0144_test_report_acceptance` (one new table and nullable columns, expand-only). `packages/api/src/test-report.ts` owns the `test-report/1` envelope (`testReportV1Schema(ingress)`, strict, `SUPPORTED_TEST_REPORT_VERSIONS`, `parseTestReport`), the closed PRD 10 `TEST_REPORT_ERROR_CODES`, `TestReportRejectedError` (code, safe `fieldPath`, fixed explanation; never a payload value), `TEST_REPORT_LIMITS`, the allow-listed relation and evidence types, the `acceptTestReportInputSchema` ingress discriminator (`Application` manual form, `File import`, `MCP`; the web router accepts only the first two via `applicationTestReportInputSchema`), `TestSessionStoredRecord`/`TestSessionRecord` with `SessionTestReportStoredRecord`, and the `TestReportAcceptanceAccess`/`TestReportStore`/`TestReportTransaction` contracts. `apps/server/src/features/test-report/server/test-report-import.ts` is server-only (it imports `yaml`, a dependency of `apps/server`; so are `test-report-identity.ts` and `canonicalize`, so neither reaches the web bundle): JSON parse and Markdown YAML 1.2 frontmatter with fail-closed alias, anchor, merge key, explicit tag, multi-document and duplicate key handling; it only produces plain data that the Zod schema judges. `packages/db/src/schema/planned-test.ts` adds `project_test_session` (executor, reporter and ingress as separate columns, `reported_at` UTC beside `reported_at_text` with the original offset, `review_state` default `Unreviewed`, no score or release column) and nullable report columns on `project_session_test` (`session_id`, `external_test_id`, `position`, `raw_result`, `normalized_result`, `notes`, `evidence`, `relations`); a reported ad hoc test stores its title as `purpose` and an empty `expected_behavior` so the older content check still holds, and `listSessionTests` of the Planned Tests store lists only standalone tests (`session_id is null`). Server: `apps/server/src/features/test-report/server/` (`test-report.ts` access with exactly `accept` and `sessions`, `test-report-database.ts` PostgreSQL store, `test-report-memory-store.ts` harness). `accept` validates the whole envelope inside one unit of work and either stores a Test Session with all Session Tests or throws; it opens no review, release gate or notification. The reporter is the verified `TestReportCaller`, never a payload field (a `reporter` field is `unsupported_field`). The router adds `acceptTestReport` and `projectTestSessions`. Spec 54 #400 adds migration `0145_test_report_identity` (one new table, two nullable columns, expand-only): `project_test_session_identity` has the primary key project + ingress + verified reporter id + external session id (a separate table because the shared-database rules refuse a new unique key on an existing one) and `project_test_session` gains `fingerprint` and `handoff_state_at_accept`. `apps/server/src/features/test-report/server/test-report-identity.ts` computes the fingerprint with `canonicalize` over the validated report minus the executor, with times as instants and the current content hash of every referenced File Attachment (`file_attachment_version.content_hash` of the current version). `accept` now returns `{outcome: "created" | "duplicate", session}`: the same identity and fingerprint is the prior receipt, a different fingerprint is `identity_conflict` and never an update, and a lost insert race (`insertSession` resolving `false`) is answered from the winner. Every `attachment_ref` evidence value must be an Active or Archive File Attachment of the same Project (`resolveAttachment`: missing or Trashed is `reference_not_found`, another Project or scope is `reference_scope_mismatch`, both at `tests[n].evidence[m].value`); the report never uploads one. Parser and serializer errors are never chained as `cause`, because they quote payload text. The transaction contract adds `findSessionByIdentity`, `findHandoff` (`null` is `reference_not_found` and `other_project` is `reference_scope_mismatch` for `handoff_id`, matching the relation path) and `resolveReference` (`found`/`missing`/`other_project`; Test Gap is always `missing` until spec 56); `handoff_package_version` must equal the Handoff's produced `package_version` (`reference_scope_mismatch`), a Session Test scenario must be in the Handoff package when both are given, and relations map to the PRD code table. A report bound to a `Canceled` Handoff is accepted as history and records `handoff_state_at_accept`; no signal sink exists yet, so `handoff-result-after-cancel` is for #403 to emit from that column. The memory harness rolls back a failing unit of work and has a `faults.failAfterSessionInsert` switch for the no-residue test (`test-report-identity.test.ts`). Spec 54 #401 adds no schema change: `packages/api/src/test-report-result.ts` owns the closed `TEST_REPORT_V1_RESULT_ALIASES` catalog of `test-report/1` (case and outer-whitespace insensitive, exact match only) and `normalizeReportedResult`, which `accept` applies to every Session Test: an explicit `normalized_result` is kept unless the raw statement names another value (`result_conflict` at `tests[n].normalized_result`), otherwise the catalog decides and anything outside it, or no result, is `not_reported`. `raw_result` is stored as sent; no field or code derives a session verdict. The seam test is `test-report-result.test.ts`. Spec 54 #402 adds the narrow MCP adapter, with no schema change: `apps/server/src/features/test-report/server/test-report-mcp.ts` builds the low-level MCP SDK v1 `Server` (`createTestReportMcpServer`) that declares only the `tools` capability and lists exactly one tool, `test_report.submit`, whose arguments are the `test-report/1` envelope; `submitTestReport` is the transport-agnostic handler. It resolves the caller through an injected `ResolveIntegration` returning a `VerifiedIntegration` (account, integration id, allowed Project ids) and makes that integration the reporter (`kind: "integration"`), so a payload `reporter` is `unsupported_field` and a Project outside the scope, or no verified integration, is `project_not_authorized`. The reply is `toTestReportMcpReceipt` (`session_id`, `external_session_id`, `accepted_at`, `fingerprint`, `result` of `created` or `duplicate`) and never a Test Session body; a refusal is `{code, field_path, explanation}`. The repo has no integration identity store or token issuance, so the server is not mounted on Hono: whoever adds real authentication mounts a transport and supplies the resolver. `parseTestReport` also rejects binary or base64 evidence (`data:` URI, embedded content keys, long base64 blobs) as `attachment_rejected` for every ingress. The seam test for the adapter is `test-report-mcp.test.ts`. Spec 54 #403 adds migration `0146_test_report_attention_signal` (one new table, expand-only). `packages/api/src/test-report-secrets.ts` reuses `findSecretKinds` from the Handoff package and sorts findings into known (private key, GitHub, API key, AWS, Slack, JWT, bearer token, URL with credentials: whole report `sensitive_data_detected`, masked path only) and ambiguous (credential assignment only); the scan walks every string of the validated report and never edits or echoes a value. An ambiguous finding is `sensitive_data_detected` on MCP and, on file and manual ingress, `accept` returns `{outcome: "masked_review", findings: [{fieldPath}]}` having stored nothing (the access type narrows to a plain receipt for the `MCP` input). `project_test_report_attention_signal` holds the two registered ids only (`unreviewed-test-report`, `Action Required`, one per new File import or MCP session; `handoff-result-after-cancel`, `Information Feed`, when `handoff_state_at_accept` is `Canceled`), keyed `<type>:<session id>`; `produceSignal` on the transaction writes them through `TestReportAttentionSignalSink` (default: insert in the session's transaction, following the external-handoffs sink pattern), so a Manual session, a duplicate retry, a refused report and Session Tests never produce one. The web surface turns a masked review into a message with paths only (`maskedReviewMessage`). Seam test: `test-report-secrets.test.ts`. Tests: `test-report.test.ts` (in-memory seam), `test-report-rpc.test.ts`, `test-report-database.test.ts` (PostgreSQL seam, skipped without `ACCOUNT_ACCESS_DATABASE_URL`). Web: `apps/web/src/features/test-report/` (`lib/test-report-form.ts`, `lib/refusal-text.ts`, `ui/test-sessions-view.tsx` with `Record Test Session`, `Import Test Session file` and the `Unreviewed` list, `ui/test-sessions-surface.tsx`) mounted below the Planned Tests surface by `project-shell-surface.tsx`, tested by `ui/test-sessions-view.test.tsx`.

Spec 55 #404 (Test Gaps, Test Açığı) is owned by `packages/api/src/test-gaps.ts` (strict `createTestGapInputSchema` with title, rationale and support relations from the closed `TEST_GAP_RELATION_TARGET_TYPES` set Feature, Work, Document (exact revision and optional stable section), Risk and Project Release, `duplicateTestGapRelation`, and the `TestGapsAccess`/`TestGapStore`/`TestGapTransaction`/`TestGapTargetResolver` contracts), `packages/db/src/schema/test-gap.ts` (`project_test_gap` and `project_test_gap_relation`; no coverage, score, severity or result column; migration `0147_test_gap_record`, expand-only) and `apps/server/src/features/test-gaps/server/` (`test-gaps.ts` access and errors, `test-gaps-database.ts` PostgreSQL store whose resolver reuses `createResolver` from the Planned Tests store for Work, Feature, Document and Risk and reads `project_release` itself, `test-gaps-memory-store.ts` in-memory harness that shares the Planned Tests harness so tests can stage Session Tests, cases and Handoffs). The #404 access has `create`, `list` and `relationTargets` (#405 and #406 below add manual planning and closure only): a Gap exists only because the founder called `create`, and the module reads no Session Test, report, spec change, check or similarity, so nothing can file one. A relation to a record that is missing, from another Project, archived or in Trash is refused; one that later goes away reads as broken and the Gap stays. Binding a relation never writes the target. The #404 router exposes `projectTestGaps`, `createTestGap` and `testGapRelationTargets`. The web surface is `apps/web/src/features/test-gaps/` (`lib/test-gap-form.ts`, `ui/test-gaps-view.tsx` `File Test Gap` form and list, `ui/test-gap-relations-field.tsx` native labelled support-relation picker, `ui/test-gaps-surface.tsx` data wiring), mounted by `project-shell-surface.tsx` below the Planned Tests surface at the `tests` and `project-area-tests` hashes; the Tests area lists Gaps as a management view and owns no Gap lifecycle. Seam tests are `test-gaps.test.ts`, `test-gaps-rpc.test.ts`, `test-gaps-database.test.ts` (PostgreSQL seam) and `ui/test-gaps-view.test.tsx`. Behavior rules live in `docs/specs/55-test-gaps/spec.md`.

Spec 55 #405 adds Gap states to the same module, with migration `0148_test_gap_planned_state` (two new tables and two new columns, expand-only). `project_test_gap` gains `state` (check-limited to `Open`, `Planned`, `Met by result`, `Not needed`, default `Open`) and `state_changed_at`; `project_test_gap_case_bind` holds exact Planned Test Case versions through a composite foreign key `(case_id, version)` to `project_planned_test_case_version`, and `project_test_gap_handoff_bind` holds Test Handoffs. `packages/api/src/test-gaps.ts` owns `TEST_GAP_STATES`, `stateAfterBind` (`Open` becomes `Planned`; every other state is unchanged, so a bind never exceeds `Planned`) and `stateAfterUnbind` (the last bind of a `Planned` Gap returns it to `Open`), and the access adds `bindCase`, `unbindCase`, `bindHandoff` and `unbindHandoff`, each a compare-and-set on the state it read. Nothing reads a Session Test, a Handoff state move or an incoming report to change a Gap: the `Planned Tests` module never calls this one. The Handoff state a Gap shows is read live and never moves the Gap. A bind to a version or Handoff of another Project, or one that does not exist, is refused. The router adds `bindTestGapCase`, `unbindTestGapCase`, `bindTestGapHandoff` and `unbindTestGapHandoff`. Web: `ui/test-gaps-view.tsx` shows `Open` or `Planned` and the `Link Planned Test Case version` and `Link Test Handoff` controls; closing (`Met by result`, `Not needed`) belongs to #406. Server tests: `test-gap-states.test.ts`, `test-gaps-rpc.test.ts` and the PostgreSQL cases in `test-gaps-database.test.ts`; web: `ui/test-gaps-view.test.tsx`.

Spec 55 #406 adds manual closure to the same module, with migration `0149_test_gap_closure` (one new table and three nullable columns, expand-only). `project_test_gap` gains `closed_at`, `closure_rationale` and `closure_decision_id` (a polymorphic Decision reference with no foreign key, read live so a gone Decision reads as broken); `project_test_gap_met_session_test` holds the Session Tests the founder selected, with foreign keys to the Gap and to `project_session_test`, and only `closeGap` writes it. `packages/api/src/test-gaps.ts` owns `closeTestGapInputSchema`, a strict union on `outcome`: `Met by result` requires one or more distinct `sessionTestIds` and takes an optional rationale, `Not needed` requires a rationale and takes an optional `decisionId`; both carry the `expectedState` (`Open` or `Planned`) the founder saw. The access adds `close` (a compare-and-set that writes the state, the closure and the selected Session Tests in one unit of work) and `decisionTargets`. A closed Gap is history: `close`, `bindCase`, `unbindCase`, `bindHandoff` and `unbindHandoff` refuse it with `TestGapClosedError`, and there is no delete, reopen, auto-close or coverage operation. The router adds `closeTestGap` and `testGapDecisionTargets`. Web: `ui/test-gaps-view.tsx` adds the `Close Test Gap` form (`Mark as Met by result` with the `Session Tests that meet this Test Gap` checkboxes, `Mark as Not needed` with a rationale and an optional Decision) and the closure history. Server tests: `test-gap-closure.test.ts`, `test-gaps-rpc.test.ts` and the PostgreSQL cases in `test-gaps-database.test.ts`; web: `ui/test-gaps-view.test.tsx`.

Spec 55 fix round (code review of #404–#406) delivers the remaining findability and review-fix items. Migration `0150_test_gap_met_position` adds a nullable `position` column to `project_test_gap_met_session_test` (expand-only, plus a backfill that restores historical pick order from `created_at`), so `closeGap` writes the founder's selection order there and reads it back `position`-first; `created_at` stays a plain creation timestamp. The `findSessionTests` read locks the Session Test rows `FOR UPDATE`, so a concurrent delete waits for the closure and the citation insert cannot hit a foreign key error from a delete that committed mid-unit-of-work. `ui/test-gaps-view.tsx` adds the Tests area's derived `Open and planned Test Gaps` count (spec story 17): the count reads only the same `Open`/`Planned` records the list shows, and opening it reveals exactly that set of titles with their states. Findability (spec story 18): `Test Gap` joins Universal Search (`searchTestGapRecords` family in `universal-search-database.ts`, `universalSearchRecordTypes`, closure state in `isClosed`), with the `Open source record` href routed through `testGapRecordHash` (`source-test-gap-`, handled by `projectTestsSurface`, which also opens the Tests area on that hash) and the Gap anchored in the list by its id; and `Test Gap` joins Smart Collections as a first-class source type (`SMART_COLLECTION_SOURCE_TYPES`, state filter via `SMART_COLLECTION_STATUS_OPTIONS`, `getTestGapMembershipRecords`, a separate `gaps` bucket on `SmartCollectionViewSource`, subscription members and `source-test-gap-` paths in `smartCollectionSourcePath`, plus the closed-world Test Gap record preview of `context-record-preview-content.tsx`). The record Table side of the closed type × surface matrix (spec 33) remains deferred: `Test Gap` waits for the Tests-family record-table delivery, whose `Table` + inline edit must write through the Mutation Contract (ADR 0004) like every other row source; Universal Search and Smart Collections are delivered here.

Product Gaps (spec 58 #417, Ürün Boşluğu) are the first Workspace-scoped record module after Contacts, owned by `packages/api/src/product-gaps.ts` (strict `recordProductGapInputSchema` with title, unmet need, optional scope and related Project, Work, Feature and Decision links; the closed `PRODUCT_GAP_STATUSES` catalog `Open`, `Evaluating`, `Met`, `Conscious boundary` mapped to the PRD values by `PRODUCT_GAP_STATUS_PRD_VALUES`; the follow-up plan and confirm schemas; and the `ProductGapsAccess`/`ProductGapStore`/`ProductGapTransaction`/`ProductGapTargetResolver` contracts), `packages/db/src/schema/product-gap.ts` (`workspace_product_gap` and `workspace_product_gap_link`, migration `0151_product_gap_lifecycle`, expand-only; no repeat count, priority, score, severity or Work column, and no foreign key on the polymorphic `target_id` so a gone record reads as broken) and `apps/server/src/features/product-gaps/server/` (`product-gaps.ts` access and errors, `product-gaps-database.ts` PostgreSQL store, `product-gaps-memory-store.ts` in-memory harness whose `writes` log proves a status change or a similar title touches no other record). The workspace is resolved from the account like `contacts-database.ts` (`workspace.ownerAccountId`); the resolver joins `project.workspaceId` so a record of another Workspace is never bound. The access has exactly `record`, `list`, `setStatus`, `linkTargets`, `previewFollowUp` and `confirmFollowUp`: a Gap exists only because the founder called `record`, similar titles are never merged, the status is a compare-and-set on the status the founder saw and writes the Gap row alone, and there is no count, ranking, notification, auto-convert or telemetry operation. The follow-up reuses the shared preview-before-write pattern of Feedback `Convert to Work` (ADR 0004): `previewFollowUp` is read-only; `confirmFollowUp` re-derives the plan under locks and writes one Work plus a `Follow-up` link (or only the link for an existing Feature) through the Mutation Contract, so a retry returns the same result and a changed plan is `PRODUCT_GAP_FOLLOW_UP_STALE`. The router adds `productGaps`, `recordProductGap`, `setProductGapStatus`, `productGapLinkTargets`, `previewProductGapFollowUp` and `confirmProductGapFollowUp`. Web: `apps/web/src/features/product-gaps/` (`lib/product-gap-form.ts`, `ui/product-gaps-view.tsx` with the `Record Product Gap` form, status control and follow-up preview, `ui/product-gap-links-field.tsx`, `ui/product-gaps-surface.tsx` data wiring) mounted by `apps/web/src/routes/_auth/product-gaps.tsx` and a `Product Gaps` header link. Seam tests are `product-gaps.test.ts`, `product-gaps-rpc.test.ts`, `product-gaps-database.test.ts` (PostgreSQL seam, skipped without `ACCOUNT_ACCESS_DATABASE_URL`) and `ui/product-gaps-view.test.tsx`. Deferred to later tickets or fix rounds of spec 58: Universal Search and Smart Collections membership, history entries for status changes, import/export and the closed-world sharing preview (the Gap is not in any sharing or export scope until then, so nothing can leak). Behavior rules live in `docs/specs/58-product-gaps/spec.md`.

Tool Escapes (spec 58 #418, Dış Araca Kaçış) extend the same files: `packages/api/src/product-gaps.ts` adds the closed `TOOL_ESCAPE_REASONS` catalog mapped to the PRD values by `TOOL_ESCAPE_REASON_PRD_VALUES`, the strict `toolEscapeInputSchema` (occurred-at, a `source` Project/Work/Feature/Decision bound live to the Workspace, intended job, external tool, one or more reasons, optional note; no content, session, severity or `High-impact` field), `recordToolEscapeInputSchema` (a `New` Gap or an `Existing` Gap id, never a title), the filter schemas and the stored/view event types, and `ProductGapRecord.escapeCount`, which is derived and never stored. `packages/db/src/schema/product-gap.ts` adds append-only `workspace_tool_escape` (migration `0152_tool_escape_event`, expand-only; `reasons text[]` with a closed check, foreign key to the Gap, polymorphic `source_id` with no foreign key, `project_id` of the source when recorded, and no severity, priority, score, content or count column). The access adds `recordToolEscape` (new or existing Gap plus the event in one unit of work; a similar title never selects or merges anything) and `listEscapes` (the exact event set behind a count, under the same filter), and `list` takes the dogfooding filters tool (case-insensitive), reason, Project and status; filters select only, escape lists read in the order of occurrence (newest first), and `tools` lists the distinct tools for the filter. The transaction has `insertEscape` and `listEscapes` and no update or delete, so a status change cannot rewrite an event, and the module imports no GitHub, Test Handoff or External Execution seam. The router adds `recordToolEscape` and `productGapEscapes`, and `productGaps` takes an optional filter. Web: `lib/product-gap-form.ts` holds the escape form values, `ui/record-product-gap-form.tsx` is `Record Product Gap` with the new-or-existing choice, `ui/tool-escape-fields.tsx` the event fields, `ui/dogfooding-summary.tsx` the filter bar and the panel that opens the exact events, wired by `product-gaps-surface.tsx`. Seam tests are `tool-escapes.test.ts`, the extended `product-gaps-rpc.test.ts`, `product-gaps-database.test.ts` and `ui/product-gaps-view.test.tsx`.

High-impact Tool Escape close (spec 58 #419, Dış Araca Kaçış kapanışı) extends the same files. `packages/api/src/product-gaps.ts` adds the strict `closeToolEscapeInputSchema` (escape id, the `TOOL_ESCAPE_IMPACTS` judgement made at close, and the optional proof fields `candidate.build`, `workflow.runRef`, `restore` with `TOOL_ESCAPE_RESTORE_METHODS` and the exact records, and `externalCopy`; a missing field on a high-impact close is an unmet condition, not a malformed request, and no note, screenshot, count, duration or severity field exists), the stored/view close types, `ToolEscapeRecord.close` (the visible evidence, `null` while open), `TOOL_ESCAPE_CLOSE_CONDITIONS` and the `ToolEscapeCloseProof` verifier port. There is no model of the Ürün sürüm adayı among the product records (PRD 16 defines it as the exact build with its evidence package), so the port stands in: `currentCandidate()` returns the build of the current candidate and `workflowRun(runRef)` returns a recorded run with its build, success and the product records it exercised; tests inject fixtures and `createDatabaseProductGaps(database, proof?)` without a verifier refuses every high-impact close (fail-closed) until a real source is wired, while a `Never held parallel truth` close needs no verifier. `packages/db/src/schema/product-gap.ts` adds append-only `workspace_tool_escape_close` (migrations `0153_high_impact_escape_close` and `0154_tool_escape_close_never_held`; unique `escape_id` so a second close is refused by the database too, a closed impact catalog that includes `Never held parallel truth`, nullable proof columns because that judgement stores the impact alone, and PostgreSQL checks pass the NULL row while still requiring non-empty evidence text on a high-impact close) and `workspace_tool_escape_close_record` (the exact bound records, polymorphic `target_id` with no foreign key); neither has a severity, `High-impact`, threshold, duration or count column, and the event row is never updated. The access adds `closeToolEscape`: it locks the escape row and refuses a repeated close (`TOOL_ESCAPE_ALREADY_CLOSED`); a judgement of `Never held parallel truth` writes the one close row with no proof and no bound records straight away, and a high-impact judgement evaluates the four conditions together and refuses fail-closed with the unmet conditions named (`TOOL_ESCAPE_CLOSE_REFUSED`): the same workflow run succeeded on the current candidate build, the restored records resolve live in this Workspace, the external copy is `Closed`, and the run's exercised records cover every restored record. In both paths the Gap status, including `Conscious boundary`, is never read, and the close writes the close rows alone. The transaction adds `findEscape`, `insertEscapeClose` and `listEscapeCloses` and still has no update or delete. The router adds `closeToolEscape` (`PRECONDITION_FAILED` carries `data.conditions`). Web: `ui/tool-escape-close.tsx` (`ToolEscapeCloseForm` with labelled native controls and `ToolEscapeCloseEvidence`, which renders the proof only for a high-impact close), rendered inside `ToolEscapesPanel`, with `CloseFormValues` and `toCloseToolEscapeInput` in `lib/product-gap-form.ts`, wired by `product-gaps-surface.tsx`; date display goes through the account `Locale`/`Date format` (`formatAccountDateTime`). Seam tests are `escape-close.test.ts`, the extended `product-gaps-rpc.test.ts`, `product-gaps-database.test.ts` (PostgreSQL seam, skipped without `ACCOUNT_ACCESS_DATABASE_URL`) and `ui/product-gaps-view.test.tsx`.
Test Review (spec 57 #413, independent lifecycle of session and item review) is a separate module at the single Test Review seam, not part of Test Report Acceptance. `packages/api/src/test-review.ts` owns the closed four-state catalog (`Unreviewed`, `Reviewed`, `Follow-up needed`, `Closed`; a founder can set the last three), the strict inputs (`setSessionReviewStateInputSchema`, `setItemReviewStateInputSchema` with an optional `reason`, `previewSessionCloseInputSchema`, `previewBulkReviewInputSchema`, `commitBulkReviewInputSchema` carrying the server `previewFingerprint` of the previewed changes), `remainingOpenItems` and the `TestReviewAccess`/`TestReviewStore`/`TestReviewTransaction` contracts. The access has exactly `list`, `setSessionReviewState`, `setItemReviewState`, `previewSessionClose`, `previewBulkReview` and `commitBulkReview`: there is no archive, Trash, delete, gate, Project Release, Handoff or Test Gap operation, and the transaction can write only a session review state, item review states and history entries, never a reported raw or normalized result. `packages/db/src/schema/test-review.ts` adds, with migration `0155_test_review_lifecycle` (two new tables, expand-only), `project_session_test_review` (one row per explicitly reviewed Session Test, no row means `Unreviewed`, so the Session Test table is not widened) and `project_test_review_event` (insert-only Kayıt geçmişi, not Denetim kaydı, with `remaining` keeping the exact open items a close left behind, an optional reason and a `batch_id` tying one bulk commit together). The Test Session's own `review_state` column (spec 54) is the session state. `apps/server/src/features/test-review/server/` holds `test-review.ts` (access and errors; closing is never gated, a repeated state writes nothing, the bulk commit re-derives the changes, refuses a preview whose server fingerprint differs and is a no-op once everything is `Reviewed`), `test-review-database.ts` (PostgreSQL store) and `test-review-memory-store.ts` (harness that seeds accepted sessions, logs every write kind and rolls back a failing unit of work). The router adds `projectTestReview`, `setReviewSessionState`, `setReviewItemState`, `previewReviewClose`, `previewReviewBulk` and `commitReviewBulk` (names avoid `testsession` so the spec 54 procedure guard still holds) with output schemas. Web: `apps/web/src/features/test-review/` (`ui/test-review-view.tsx` with the `Test Review` section, per-session and per-item state buttons, the close preview with remaining records and optional reason, the `Mark session and selected results as reviewed` preview with `Apply review`, and `Review history`; `ui/test-review-surface.tsx` data wiring) mounted below `Test Sessions` by `project-shell-surface.tsx`. Seam tests: `test-review.test.ts` (state matrix, no cascade, result untouched, bulk preview and idempotency, atomic rollback, no gate), `test-review-rpc.test.ts`, `test-review-database.test.ts` (PostgreSQL seam, skipped without `ACCOUNT_ACCESS_DATABASE_URL`) and `ui/test-review-view.test.tsx`.

Correction, Withdrawal and security redaction (spec 57 #414) extend the same seam: `packages/api/src/test-review.ts` adds `recordCorrectionInputSchema`, `recordWithdrawalInputSchema`, `recordRedactionInputSchema` (reason required), the `testResultEventSchema` chain, the per-item `current` result (`Reported`, `Correction` or `Withdrawal`, with `usable`), `rawResultRedacted`, `summaryRedacted`, `withdrawn`, `newContextAfterClose` (`New context after close`), the pure `viewSession`/`viewResultEvents` and the `recordCorrection`/`recordWithdrawal`/`recordRedaction` access members plus `appendResultEvents`, `listResultEvents` and `eraseResultEventContent` on the transaction. `packages/db/src/schema/test-review.ts` adds `project_test_result_event` with migration `0156_test_result_events` (one new table, expand-only): insert-only Kayıt geçmişi bound to the Test Session and Session Test, with `previous_event_id` linking the chain; the only update it ever receives clears the content of the event a redaction replaced. The reported raw and normalized result columns are never written; redaction hides the reported value at this seam (physical purge of the stored report and cache/search propagation stay with PRD 13 and spec 78), is not Trash and is not a Denetim kaydı (no audit mark is emitted yet). The router adds `recordReviewCorrection`, `recordReviewWithdrawal` and `recordReviewRedaction`. Web: `ui/test-review-view.tsx` shows the current result, the `Correction history` chain, `Correction`, `Withdrawal` and `Redact value` panels (reason required, focus moved to the panel heading) and the `New context after close` badge; a later event never changes the review state. Shared `ui/test-review-panel.ts` holds `errorText` and `usePanelFocus`. Seam tests: `test-review-corrections.test.ts`.

Superseding, conflict and context signals and follow-up work (spec 57 #415) extend the same seam. `packages/api/src/test-review-signals.ts` holds the pure rules and schemas: `supersedeClosesCycle` (directed, acyclic), `viewSupersessions` (both historical results plus the technical-context difference, nothing rewritten), `deriveConflicts` (`test-result-conflict`, `Action Required`, only from one exact scenario id and version with differing normalized results; an item another member supersedes is settled, a withdrawn or redacted result leaves the comparison, a founder binding closes the signal while later differing members reopen it, no title similarity, no last-write-wins), `deriveContextChanges` (`Context changed`, only a bound Primary spec revision that moved or a recorded branch/commit/build that differs from the bound Handoff's build context; no clock, a missing value is `unknown`) and the follow-up plan/receipt schemas (`Create follow-up work`, `Originates from`, `Origin Location`). `packages/api/src/test-review.ts` adds the `supersede`, `bindValidResult`, `previewFollowUp` and `commitFollowUp` access members and the `createFollowUpWork`, `findFollowUpWork`, `append*`/`list*` transaction members; the list output gains `supersessions`, `conflicts`, `contextChanges`, `bindings` and `followUps`. Migration `0157_test_supersession_follow_up` (three new tables, expand-only) adds `project_session_test_supersession` (insert-only directed edge between two Session Tests, unique per pair; this seam owns the Session Test endpoint of the standard `Supersedes` relation because the shared `work_relation` rows are Work-sourced), `project_test_result_binding` (the founder's judgment with the exact judged Session Tests) and `project_test_follow_up_link` (Session Test to Work, `Created` or `Attached`, unique per pair; the immutable origin lives in the Work's own `origin_*` columns written through `insertWorkWithKeyAllocation` in the same transaction). `Create follow-up work` is preview-then-commit with a fingerprint (stale previews are refused, a retry with the same Work id creates nothing new); a new Work takes exactly one result, an existing Work takes several, and the only Work write is that one insert. The router adds `supersedeReviewResult`, `bindReviewResult`, `previewReviewFollowUp` and `commitReviewFollowUp`. Web: `ui/test-review-signals.tsx` (conflict list with `Bind valid result`, `Context changed` reasons, `Supersedes` form with the relation shown before saving and the chain summary, `Create follow-up work` preview panel with focus moved to its heading); `ui/test-review-view.tsx` shows `Technical context: unknown` when no branch/commit/build was recorded. Seam tests: `test-review-supersession.test.ts` (no Test Gap, Handoff, assessment or report writer exists on the harness; failures create no Work) and `ui/test-review-signals.test.tsx`. Not delivered here: registering a `Session Test` resolver in the shared relation service (so `Supersedes` between Session Tests also lists in generic relation views).

The neutral Test Summary (spec 57 #416) extends the same seam without a migration: it is a live derived view and stores no second record. `packages/api/src/test-review-summary.ts` holds the strict schemas and the pure `deriveTestSummary` (scope `Project`, `Feature` or `Project Release`; every section and attention item is `{key, label, records, filters}`, a count is only `records.length`, and no score, coverage, verdict, waiver or gate field exists; Session Test rows keep raw and normalized result, current result, source session, executor, reporter, time and technical context). Feature and Project Release scopes yield `sections` (Planned Test Cases, Test Handoffs, Test Sessions, Session Tests, open Test Gaps, follow-up work, latest Test Assessment) plus neutral source-linked `attention` (no related test records, Planned Test Cases without a reported result, `Context changed`, `test-result-conflict`, `Failed`/`Blocked`/`Inconclusive`/`Skipped` results, unreviewed reports, open Test Gaps and `New test context after this assessment`); the Project scope yields the Tests area sections `Unreviewed reports`, `Follow-up needed results`, `Open and planned Test Gaps`, `Conflicting or awaiting-supersede results`, `Context-changed results`, `Active Handoffs`, `Recent sessions` and `Recent assessments` under `Tests overview`. `TestReviewAccess` gains the read-only `summary` member and `TestReviewTransaction` the read-only `readSummaryFacts`; the router adds `projectTestSummary`. `apps/server/src/features/test-review/server/test-review-summary-database.ts` reads the facts of other features (Planned Test Cases and Handoffs through Feature/İş relations and the Feature's `Includes`, Test Gaps through relations, case and Handoff binds, Test Assessments by context) and writes nothing; a Project Release contributes its direct Test Gap and Test Assessment links only, because release scope membership belongs to Release Planning (spec 63) and has no record yet. GitHub checks are never read here and never become Test Sessions. `TestReviewStoredSession` gains an optional `reporter`. Web: `apps/web/src/features/test-review/ui/test-summary-view.tsx` (each count is a native button with `aria-expanded` that opens the exact records and filters; rows open the owner record) and `ui/test-summary-surface.tsx` (data wiring), mounted as `Tests overview` at the top of the Tests area by `project-shell-surface.tsx`, as `Test Summary` on a Feature by `project-work-list.tsx` and on a Project Release by `project-source-record-view.tsx`; `project-shell-navigation.ts` gains `testsAreaRecordHash` so Planned Test Case, Test Handoff, Test Session and Test Assessment rows open the Tests area. Seam tests: `test-review-summary.test.ts` (drill-down sets, provenance, no score/gate key, no write, GitHub check not converted, Release scope, Tests area sections) and `ui/test-summary-view.test.tsx`. Behavior rules live in `docs/specs/57-test-review-and-follow-up/spec.md`.

Test Review review-fix round (code review of #413–#416) tightens the same seam without a migration. `listEvents` in `test-review-database.ts` reads the whole review history (the former 500-row cap is gone): `closedAt` derives `New context after close` from the full history, so a busy project can no longer silently push a close event out of the window the derivation sees, and `Review history` is never silently truncated. `findFollowUpWork` resolves the target İş by its visible key (`CAN-12`) as well as its id, and `ui/test-review-signals.tsx` labels the field `Existing İş id or key`; the links still carry the resolved Work id. A session-level Correction is promoted as `currentSummary` on `TestReviewSession` (`viewSession` in `packages/api/src/test-review.ts`; the original `summary` stays beside it, a redaction of the Correction note drops the promotion) — the session heading, `sessionLabel` (bulk preview and follow-up origin) and the Test Summary's `Test Sessions` records show the promoted summary. The one new follow-up Work id is `followUpWorkId(preview.fingerprint)` (`ui/test-review-panel.ts`, used by `ui/test-review-surface.tsx`), so a retried commit reuses the server idempotency key instead of minting a second Work. A Feature or Project Release scope that is not in the Project raises `TEST_REVIEW_SUMMARY_SCOPE_NOT_FOUND` ("The Test Summary scope is unavailable.") instead of the record-not-found copy. The Project Release summary still contributes its direct links only: release scope membership belongs to Release Planning (spec 63) and has no record yet, so story 26's in-scope Feature/İş part stays deferred. Seam tests: the PostgreSQL test seeds more than 500 review events after a close and attaches the target İş by key (skipped without `ACCOUNT_ACCESS_DATABASE_URL`), plus new harness and UI tests for the promotion, key resolution, scope error and stable Work id.

Spec Change Review (spec 52 #389) is owned by `packages/api/src/spec-change-review.ts` (the `SpecChangeReviewAccess` interface `list`/`get`, the persisted-record and summary types, `diffSpecVersions`, which compares two exact Document version bodies with jsdiff per stable section id and never reads Git or a working tree, and `featuresBoundToPrimarySpec`, the only trigger rule: a Feature whose `primarySpecId` is the saved Document), `packages/db/src/schema/spec-change-review.ts` (`spec_change_review`: one row per Feature, Document and next revision, holding only the version-pair identity and no body copy; migration `0132_spec_change_review`, expand-only, so later candidate and review-metadata tables key by its `id`) and `apps/server/src/features/spec-change-review/server/` (`spec-change-review.ts` access and errors, `spec-change-review-database.ts` PostgreSQL store plus `openSpecChangeReviews`, called by `updateDocumentTarget` in `features/documents/server/documents-database.ts` inside the Document version save transaction, and `spec-change-review-memory-store.ts`, the in-memory test seam). The router exposes `projectSpecChangeReviews` and `specChangeReview`. The web surface is `apps/web/src/features/spec-change-review/` (`ui/spec-change-review-view.tsx` queue and keyboard/screen-reader diff walk, `ui/spec-change-review-surface.tsx` data wiring, `lib/diff-walk.ts`), mounted by `project-shell-surface.tsx` at the `spec-change-reviews` hash. Seam tests: `spec-change-review.test.ts`, `spec-change-review-database.test.ts` (PostgreSQL seam), `lib/diff-walk.test.ts` and `ui/spec-change-review-view.test.tsx`.

Spec Change Review candidates and review metadata (spec 52 #390) are owned by `packages/api/src/spec-change-review-candidates.ts` (`deriveSpecCandidates`, the recorded-link closure of one version pair with no similarity or AI input; `composeSpecCandidates`/`candidateRecordView`, the shared broken-reference presentation; the closed `Waiting`/`Reviewed`/`Not affected` catalog; the single-candidate `markSpecChangeReviewCandidateInputSchema` with no bulk shape; `specCandidateKey` and `specChangeReviewMarkId`, the candidate identity a follow-up Work binds to), `packages/db/src/schema/spec-change-review.ts` (`spec_change_review_mark`, migration `0133_spec_change_review_mark`, expand-only: a row exists only after an explicit mark, keyed by review id, record type, record id and section id, so `Waiting` is the implicit default and a new version pair never reuses a note) and `apps/server/src/features/spec-change-review/server/` (`spec-change-review-links-database.ts` reads Primary spec bind, `work_relation`, `usage_link` and `evidence_binding` rows in the account's Workspace, `spec-change-review-candidates-database.ts` resolves records fail-closed and reads marks, `spec-change-review-mark-database.ts` is the mutation-contract adapter that writes only the mark row). The router exposes `markSpecChangeReviewCandidate`; `specChangeReview` now returns `candidates`. The web list is `ui/spec-change-review-candidates.tsx`. Seam tests: `spec-change-review-candidates.test.ts` and `spec-change-review-candidates-database.test.ts` (PostgreSQL seam).

Spec Change Review follow-up Work (spec 52 #391) is owned by `packages/api/src/spec-change-review-follow-up.ts` (`buildSpecFollowUpPlan`, the pure one-Work plan of a candidate; `specFollowUpPreview`, the plan fingerprint a confirm must present; `specFollowUpOrigin`, the Origin Location columns `Create Follow-up Work` writes on the new Work: spec Document id, review id, `previous → next` revision; the single-candidate confirm input with no bulk shape; `specChangeReviewFollowUpId`), `packages/db/src/schema/spec-change-review.ts` (`spec_change_review_follow_up`, migration `0134_spec_change_review_follow_up`, expand-only: one link row per candidate and version pair, no foreign key to the Work, never a mark row) and `apps/server/src/features/spec-change-review/server/` (`spec-change-review.ts` `previewFollowUp`, `spec-change-review-follow-up-database.ts`, the mutation-contract adapter that creates the Work through `insertConvertedRecord` and the link row atomically). The router exposes `previewSpecChangeReviewFollowUp` and `createSpecChangeReviewFollowUp` (replay first, then the fingerprint check). The web dialog is `ui/spec-change-review-follow-up-dialog.tsx`. Seam tests: `spec-change-review-follow-up.test.ts`, `spec-change-review-follow-up-database.test.ts` (PostgreSQL seam) and `ui/spec-change-review-follow-up.test.tsx`.

Spec 52 review fixes: the `Spec Change Review` queue gains its in-app entry point and completes its candidate resolvers. `apps/web/src/features/project-shell/lib/project-shell-navigation.ts` owns `SPEC_CHANGE_REVIEW_HASH`; `project-shell-surface.tsx` routes the shared hash, and the Work Context Card (`work-context-card.tsx` `SpecChangeReviewLink`) offers `Spec Change Review` in its header for a Feature whose `primarySpecId` is set — a Feature without a Primary spec offers no link (spec 52 #21). `spec-change-review-candidates-database.ts` resolves every landed titled store (`Feedback`, `Milestone`, `Production Incident`, `Project Release` by its `name`, `Validation Record` plus the prior Assumption/Decision/Open Question/Risk/Technical Diagram set), so an owned candidate of these types never reads as the shared `No access` tombstone and its `Create Follow-up Work` stays offered; types without a landed readable store still fail closed. Seam tests: `spec-change-review-candidates-database.test.ts` (PostgreSQL seam) and `ui/work-context-card.test.tsx` (entry point).
