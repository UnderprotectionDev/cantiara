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
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── account-closure/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── account-preferences/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── attention-signals/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── backlog/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── blockers/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── build-in-public/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── bulk-editing/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── capture-triage/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── command-palette/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   ├── completion-effects/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── contact-and-company/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── custom-fields/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── daily-focus/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── data-export/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── data-import/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── decisions/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── documents/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── evidence/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── external-handoffs/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── external-surface-management/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── favorites/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── feedback/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── file-attachments/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── focus-period/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── github-integration/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── goals/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── kanban/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── link-sharing/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── moodboards/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── mutation-and-undo/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-data/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-reminders/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-shell/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   ├── personal-wiki/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── priority/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── product-gaps/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── production-incidents/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-closure-summary/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-history/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-overview/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-retirement/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-shell/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-updates/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-wall/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── record-actions/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── record-discovery/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── relations/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── release-communication/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── release-evidence/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── release-planning/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── research-sessions/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── return-to-work/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── risks/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── roadmap-horizon/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── schema-artifacts/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── screens-and-wireframes/
│       │   │   │   ├── forms/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── security-redaction/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── smart-collections/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── sources-and-freshness/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── spec-change-review/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── tags/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── technical-diagrams/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-assessments/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-gaps/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-plan-and-handoff/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-report-acceptance/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-review-and-follow-up/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── trash/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── uncertainty-records/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── unified-calendar/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── user-flow/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── validation-records/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── value-chain/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── web-macos-client/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── wiki-publishing/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-automation/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-checklists/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-context/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-drafts/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-lifecycle/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-templates/
│       │   │   │   ├── forms/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── workspace-exit/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   └── workspace-overview/
│       │   │       └── ui/
│       │   │           ├── components/
│       │   │           └── views/
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
