# structure.md

```text
.
├── .github/
│   └── workflows/
│       ├── account-access-integration.yml
│       └── macos-release.yml
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
│   │   │   │   ├── account-access/
│   │   │   │   │   └── server/
│   │   │   │   ├── account-closure/
│   │   │   │   │   └── server/
│   │   │   │   ├── account-preferences/
│   │   │   │   │   └── server/
│   │   │   │   ├── attention-signals/
│   │   │   │   │   └── server/
│   │   │   │   ├── backlog/
│   │   │   │   │   └── server/
│   │   │   │   ├── blockers/
│   │   │   │   │   └── server/
│   │   │   │   ├── build-in-public/
│   │   │   │   │   └── server/
│   │   │   │   ├── bulk-editing/
│   │   │   │   │   └── server/
│   │   │   │   ├── capture-triage/
│   │   │   │   │   └── server/
│   │   │   │   ├── completion-effects/
│   │   │   │   │   └── server/
│   │   │   │   ├── contact-and-company/
│   │   │   │   │   └── server/
│   │   │   │   ├── custom-fields/
│   │   │   │   │   └── server/
│   │   │   │   ├── daily-focus/
│   │   │   │   │   └── server/
│   │   │   │   ├── data-export/
│   │   │   │   │   └── server/
│   │   │   │   ├── data-import/
│   │   │   │   │   └── server/
│   │   │   │   ├── decisions/
│   │   │   │   │   └── server/
│   │   │   │   ├── documents/
│   │   │   │   │   └── server/
│   │   │   │   ├── evidence/
│   │   │   │   │   └── server/
│   │   │   │   ├── external-handoffs/
│   │   │   │   │   └── server/
│   │   │   │   ├── external-surface-management/
│   │   │   │   │   └── server/
│   │   │   │   ├── favorites/
│   │   │   │   │   └── server/
│   │   │   │   ├── feedback/
│   │   │   │   │   └── server/
│   │   │   │   ├── file-attachments/
│   │   │   │   │   └── server/
│   │   │   │   ├── focus-period/
│   │   │   │   │   └── server/
│   │   │   │   ├── github-integration/
│   │   │   │   │   └── server/
│   │   │   │   ├── goals/
│   │   │   │   │   └── server/
│   │   │   │   ├── kanban/
│   │   │   │   │   └── server/
│   │   │   │   ├── link-sharing/
│   │   │   │   │   └── server/
│   │   │   │   ├── moodboards/
│   │   │   │   │   └── server/
│   │   │   │   ├── mutation-and-undo/
│   │   │   │   │   └── server/
│   │   │   │   ├── operator-backup-and-alarms/
│   │   │   │   │   └── server/
│   │   │   │   ├── personal-data/
│   │   │   │   │   └── server/
│   │   │   │   ├── personal-reminders/
│   │   │   │   │   └── server/
│   │   │   │   ├── personal-wiki/
│   │   │   │   │   └── server/
│   │   │   │   ├── priority/
│   │   │   │   │   └── server/
│   │   │   │   ├── product-gaps/
│   │   │   │   │   └── server/
│   │   │   │   ├── production-incidents/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-closure-summary/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-history/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-overview/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-retirement/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-shell/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-updates/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-wall/
│   │   │   │   │   └── server/
│   │   │   │   ├── record-actions/
│   │   │   │   │   └── server/
│   │   │   │   ├── record-discovery/
│   │   │   │   │   └── server/
│   │   │   │   ├── relations/
│   │   │   │   │   └── server/
│   │   │   │   ├── release-communication/
│   │   │   │   │   └── server/
│   │   │   │   ├── release-evidence/
│   │   │   │   │   └── server/
│   │   │   │   ├── release-planning/
│   │   │   │   │   └── server/
│   │   │   │   ├── research-sessions/
│   │   │   │   │   └── server/
│   │   │   │   ├── return-to-work/
│   │   │   │   │   └── server/
│   │   │   │   ├── risks/
│   │   │   │   │   └── server/
│   │   │   │   ├── roadmap-horizon/
│   │   │   │   │   └── server/
│   │   │   │   ├── schema-artifacts/
│   │   │   │   │   └── server/
│   │   │   │   ├── screens-and-wireframes/
│   │   │   │   │   └── server/
│   │   │   │   ├── security-redaction/
│   │   │   │   │   └── server/
│   │   │   │   ├── smart-collections/
│   │   │   │   │   └── server/
│   │   │   │   ├── sources-and-freshness/
│   │   │   │   │   └── server/
│   │   │   │   ├── spec-change-review/
│   │   │   │   │   └── server/
│   │   │   │   ├── tags/
│   │   │   │   │   └── server/
│   │   │   │   ├── technical-diagrams/
│   │   │   │   │   └── server/
│   │   │   │   ├── test-assessments/
│   │   │   │   │   └── server/
│   │   │   │   ├── test-gaps/
│   │   │   │   │   └── server/
│   │   │   │   ├── test-plan-and-handoff/
│   │   │   │   │   └── server/
│   │   │   │   ├── test-report-acceptance/
│   │   │   │   │   └── server/
│   │   │   │   ├── test-review-and-follow-up/
│   │   │   │   │   └── server/
│   │   │   │   ├── trash/
│   │   │   │   │   └── server/
│   │   │   │   ├── uncertainty-records/
│   │   │   │   │   └── server/
│   │   │   │   ├── unified-calendar/
│   │   │   │   │   └── server/
│   │   │   │   ├── user-flow/
│   │   │   │   │   └── server/
│   │   │   │   ├── validation-records/
│   │   │   │   │   └── server/
│   │   │   │   ├── value-chain/
│   │   │   │   │   └── server/
│   │   │   │   ├── web-macos-client/
│   │   │   │   │   └── server/
│   │   │   │   ├── wiki-publishing/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-automation/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-checklists/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-context/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-drafts/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-lifecycle/
│   │   │   │   │   └── server/
│   │   │   │   ├── work-templates/
│   │   │   │   │   └── server/
│   │   │   │   ├── workspace-exit/
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
│       │   ├── account-preferences.e2e.ts
│       │   ├── account-sessions.e2e.ts
│       │   ├── capture-inbox.e2e.ts
│       │   ├── client-shell.e2e.ts
│       │   ├── command-palette.e2e.ts
│       │   ├── project-shell.e2e.ts
│       │   └── web-capture-extension.e2e.ts
│       ├── src/
│       │   ├── components/
│       │   │   ├── header.tsx
│       │   │   ├── loader.tsx
│       │   │   ├── mode-toggle.tsx
│       │   │   ├── theme-provider.tsx
│       │   │   └── user-menu.tsx
│       │   ├── features/
│       │   │   ├── account-access/
│       │   │   │   └── views/
│       │   │   │       ├── login/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       ├── sessions/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       └── confirm-github-identity/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── account-closure/
│       │   │   │   └── views/
│       │   │   │       └── account-closure/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── account-preferences/
│       │   │   │   └── views/
│       │   │   │       └── preferences/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── attention-signals/
│       │   │   │   └── views/
│       │   │   │       └── attention-signals/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── backlog/
│       │   │   │   └── views/
│       │   │   │       └── backlog/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── blockers/
│       │   │   │   └── views/
│       │   │   │       └── blockers/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── build-in-public/
│       │   │   │   └── views/
│       │   │   │       └── build-in-public/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── bulk-editing/
│       │   │   │   └── views/
│       │   │   │       └── bulk-editing/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── capture-triage/
│       │   │   │   └── views/
│       │   │   │       └── capture-inbox/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── command-palette/
│       │   │   │   └── components/
│       │   │   ├── completion-effects/
│       │   │   │   └── views/
│       │   │   │       └── completion-effects/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── contact-and-company/
│       │   │   │   └── views/
│       │   │   │       └── contact-and-company/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── custom-fields/
│       │   │   │   └── views/
│       │   │   │       └── custom-fields/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── daily-focus/
│       │   │   │   └── views/
│       │   │   │       └── daily-focus/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── data-export/
│       │   │   │   └── views/
│       │   │   │       └── data-export/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── data-import/
│       │   │   │   └── views/
│       │   │   │       └── data-import/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── decisions/
│       │   │   │   └── views/
│       │   │   │       └── decisions/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── documents/
│       │   │   │   └── views/
│       │   │   │       └── documents/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── evidence/
│       │   │   │   └── views/
│       │   │   │       └── evidence/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── external-handoffs/
│       │   │   │   └── views/
│       │   │   │       └── external-handoffs/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── external-surface-management/
│       │   │   │   └── views/
│       │   │   │       └── external-surface-management/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── favorites/
│       │   │   │   └── views/
│       │   │   │       └── favorites/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── feedback/
│       │   │   │   └── views/
│       │   │   │       └── feedback/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── file-attachments/
│       │   │   │   └── views/
│       │   │   │       └── file-attachments/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── focus-period/
│       │   │   │   └── views/
│       │   │   │       └── focus-period/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── github-integration/
│       │   │   │   └── views/
│       │   │   │       └── github-integration/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── goals/
│       │   │   │   └── views/
│       │   │   │       └── goals/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── kanban/
│       │   │   │   ├── store/
│       │   │   │   └── views/
│       │   │   │       └── kanban/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── link-sharing/
│       │   │   │   └── views/
│       │   │   │       └── link-sharing/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── moodboards/
│       │   │   │   └── views/
│       │   │   │       └── moodboards/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── mutation-and-undo/
│       │   │   │   ├── lib/
│       │   │   │   └── views/
│       │   │   │       └── mutation-and-undo/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── personal-data/
│       │   │   │   └── views/
│       │   │   │       └── personal-data/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── personal-reminders/
│       │   │   │   └── views/
│       │   │   │       └── personal-reminders/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── personal-shell/
│       │   │   │   ├── components/
│       │   │   │   └── store/
│       │   │   ├── personal-wiki/
│       │   │   │   └── views/
│       │   │   │       └── personal-wiki/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── priority/
│       │   │   │   └── views/
│       │   │   │       └── priority/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── product-gaps/
│       │   │   │   └── views/
│       │   │   │       └── product-gaps/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── production-incidents/
│       │   │   │   └── views/
│       │   │   │       └── production-incidents/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-closure-summary/
│       │   │   │   └── views/
│       │   │   │       └── project-closure-summary/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-history/
│       │   │   │   └── views/
│       │   │   │       └── project-history/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-overview/
│       │   │   │   └── views/
│       │   │   │       └── project-overview/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-retirement/
│       │   │   │   └── views/
│       │   │   │       └── project-retirement/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-shell/
│       │   │   │   └── views/
│       │   │   │       ├── project-create/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       ├── project-shell/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       └── projects/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-updates/
│       │   │   │   └── views/
│       │   │   │       └── project-updates/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── project-wall/
│       │   │   │   ├── store/
│       │   │   │   └── views/
│       │   │   │       └── project-wall/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── record-actions/
│       │   │   │   └── views/
│       │   │   │       └── record-actions/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── record-discovery/
│       │   │   │   └── views/
│       │   │   │       └── record-discovery/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── relations/
│       │   │   │   └── views/
│       │   │   │       └── relations/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── release-communication/
│       │   │   │   └── views/
│       │   │   │       └── release-communication/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── release-evidence/
│       │   │   │   └── views/
│       │   │   │       └── release-evidence/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── release-planning/
│       │   │   │   └── views/
│       │   │   │       └── release-planning/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── research-sessions/
│       │   │   │   └── views/
│       │   │   │       └── research-sessions/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── return-to-work/
│       │   │   │   └── views/
│       │   │   │       └── return-to-work/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── risks/
│       │   │   │   └── views/
│       │   │   │       └── risks/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── roadmap-horizon/
│       │   │   │   └── views/
│       │   │   │       └── roadmap-horizon/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── schema-artifacts/
│       │   │   │   └── views/
│       │   │   │       └── schema-artifacts/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── screens-and-wireframes/
│       │   │   │   ├── lib/
│       │   │   │   └── views/
│       │   │   │       └── screens-and-wireframes/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── security-redaction/
│       │   │   │   └── views/
│       │   │   │       └── security-redaction/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── smart-collections/
│       │   │   │   └── views/
│       │   │   │       └── smart-collections/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── sources-and-freshness/
│       │   │   │   └── views/
│       │   │   │       └── sources-and-freshness/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── spec-change-review/
│       │   │   │   └── views/
│       │   │   │       └── spec-change-review/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── tags/
│       │   │   │   └── views/
│       │   │   │       └── tags/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── technical-diagrams/
│       │   │   │   ├── lib/
│       │   │   │   └── views/
│       │   │   │       └── technical-diagrams/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── test-assessments/
│       │   │   │   └── views/
│       │   │   │       └── test-assessments/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── test-gaps/
│       │   │   │   └── views/
│       │   │   │       └── test-gaps/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── test-plan-and-handoff/
│       │   │   │   └── views/
│       │   │   │       └── test-plan-and-handoff/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── test-report-acceptance/
│       │   │   │   └── views/
│       │   │   │       └── test-report-acceptance/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── test-review-and-follow-up/
│       │   │   │   └── views/
│       │   │   │       └── test-review-and-follow-up/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── trash/
│       │   │   │   └── views/
│       │   │   │       └── trash/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── uncertainty-records/
│       │   │   │   └── views/
│       │   │   │       └── uncertainty-records/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── unified-calendar/
│       │   │   │   └── views/
│       │   │   │       └── unified-calendar/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── user-flow/
│       │   │   │   └── views/
│       │   │   │       └── user-flow/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── validation-records/
│       │   │   │   └── views/
│       │   │   │       └── validation-records/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── value-chain/
│       │   │   │   └── views/
│       │   │   │       └── value-chain/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── web-macos-client/
│       │   │   │   └── views/
│       │   │   │       ├── client-shell/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       ├── macos-package-contract/
│       │   │   │       │   ├── components/
│       │   │   │       │   ├── forms/
│       │   │   │       │   └── hooks/
│       │   │   │       └── support-reference/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── wiki-publishing/
│       │   │   │   └── views/
│       │   │   │       └── wiki-publishing/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-automation/
│       │   │   │   └── views/
│       │   │   │       └── work-automation/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-checklists/
│       │   │   │   └── views/
│       │   │   │       └── work-checklists/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-context/
│       │   │   │   └── views/
│       │   │   │       └── work-context/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-drafts/
│       │   │   │   └── views/
│       │   │   │       └── work-drafts/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-lifecycle/
│       │   │   │   └── views/
│       │   │   │       └── work-lifecycle/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── work-templates/
│       │   │   │   └── views/
│       │   │   │       └── work-templates/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   ├── workspace-exit/
│       │   │   │   └── views/
│       │   │   │       └── workspace-exit/
│       │   │   │           ├── components/
│       │   │   │           ├── forms/
│       │   │   │           └── hooks/
│       │   │   └── workspace-overview/
│       │   │       └── views/
│       │   │           └── workspace-overview/
│       │   │               ├── components/
│       │   │               ├── forms/
│       │   │               └── hooks/
│       │   ├── lib/
│       │   │   └── auth-client.ts
│       │   ├── routes/
│       │   │   ├── _auth/
│       │   │   │   ├── account/
│       │   │   │   │   ├── index.tsx
│       │   │   │   │   └── preferences.tsx
│       │   │   │   ├── capture/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── daily-focus/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── drafts/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── favorites/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── focus-periods/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── notifications/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── projects/
│       │   │   │   │   ├── $projectId/
│       │   │   │   │   │   ├── all-tools/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── decisions/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── design/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── discovery/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── documents/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── github/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── production/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── releases/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── technical-diagrams/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── tests/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── work/
│       │   │   │   │   │   │   └── index.tsx
│       │   │   │   │   │   ├── index.tsx
│       │   │   │   │   │   └── route.tsx
│       │   │   │   │   ├── index.tsx
│       │   │   │   │   └── new.tsx
│       │   │   │   ├── search/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── trash/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── wiki/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── index.tsx
│       │   │   │   └── route.tsx
│       │   │   ├── __root.tsx
│       │   │   ├── _founder.tsx
│       │   │   └── login.tsx
│       │   ├── utils/
│       │   │   └── orpc.ts
│       │   ├── env.ts
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── routeTree.gen.ts
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
│   │   │   ├── capture-triage.ts
│   │   │   ├── context.ts
│   │   │   ├── desktop-api-window.ts
│   │   │   ├── index.ts
│   │   │   ├── mutation-and-undo.ts
│   │   │   ├── project-overview.ts
│   │   │   ├── project-shell.ts
│   │   │   ├── support-reference.ts
│   │   │   └── web-capture.ts
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
│   │   │   └── migrate.ts
│   │   ├── src/
│   │   │   ├── migrations/
│   │   │   │   └── security-events/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── capture-triage.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── mutation.ts
│   │   │   │   ├── project.ts
│   │   │   │   └── security-event.ts
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
├── biome.json
├── biome.ultracite.json
├── bun.lock
├── lefthook.yml
├── package.json
├── tsconfig.json
└── turbo.json
```
