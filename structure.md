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
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── account-closure/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── account-preferences/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── attention-signals/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── backlog/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── blockers/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── build-in-public/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── bulk-editing/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── capture-triage/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── command-palette/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   ├── completion-effects/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── contact-and-company/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── custom-fields/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── daily-focus/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── data-export/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── data-import/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── decisions/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── documents/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── evidence/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── external-handoffs/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── external-surface-management/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── favorites/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── feedback/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── file-attachments/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── focus-period/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── github-integration/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── goals/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── kanban/
│       │   │   │   ├── hooks/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── link-sharing/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── moodboards/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── mutation-and-undo/
│       │   │   │   ├── hooks/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-data/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-reminders/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── personal-shell/
│       │   │   │   ├── hooks/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       └── components/
│       │   │   ├── personal-wiki/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── priority/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── product-gaps/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── production-incidents/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-closure-summary/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-history/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-overview/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-retirement/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-shell/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── project-updates/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── project-wall/
│       │   │   │   ├── hooks/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── record-actions/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── record-discovery/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── relations/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── release-communication/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── release-evidence/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── release-planning/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── research-sessions/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── return-to-work/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── risks/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── roadmap-horizon/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── schema-artifacts/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── screens-and-wireframes/
│       │   │   │   ├── hooks/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── security-redaction/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── smart-collections/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── sources-and-freshness/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── spec-change-review/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── tags/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── technical-diagrams/
│       │   │   │   ├── hooks/
│       │   │   │   ├── lib/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-assessments/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-gaps/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-plan-and-handoff/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── test-report-acceptance/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── test-review-and-follow-up/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── trash/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── uncertainty-records/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── unified-calendar/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── user-flow/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── validation-records/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── value-chain/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── web-macos-client/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── wiki-publishing/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-automation/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-checklists/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-context/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── work-drafts/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── work-lifecycle/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── work-templates/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── workspace-exit/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   └── workspace-overview/
│       │   │       ├── hooks/
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
