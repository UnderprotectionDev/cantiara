# structure.md

```text
.
├── apps/
│   ├── extension/
│   │   ├── entrypoints/
│   │   │   ├── popup/
│   │   │   │   ├── App.tsx
│   │   │   │   └── main.tsx
│   │   │   ├── background.ts
│   │   │   └── content.ts
│   │   ├── src/
│   │   │   └── features/
│   │   │       └── web-capture/
│   │   │           ├── components/
│   │   │           └── views/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wxt.config.ts
│   ├── fumadocs/
│   │   ├── content/
│   │   │   └── docs/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (home)/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── api/
│   │   │   │   │   └── search/
│   │   │   │   │       └── route.ts
│   │   │   │   ├── docs/
│   │   │   │   │   ├── [[...slug]]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── lib/
│   │   │       └── source.ts
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   ├── proxy.ts
│   │   └── tsconfig.json
│   ├── server/
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
│   │   │   │   ├── mutation-core/
│   │   │   │   │   └── server/
│   │   │   │   ├── operator-backup/
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
│   │   │   ├── jobs/
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── features/
│       │   │   ├── account-access/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── account-closure/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── account-preferences/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── attention-signals/
│       │   │   │   └── views/
│       │   │   ├── backlog/
│       │   │   │   └── views/
│       │   │   ├── blockers/
│       │   │   │   └── views/
│       │   │   ├── build-in-public/
│       │   │   │   └── views/
│       │   │   ├── bulk-editing/
│       │   │   │   └── views/
│       │   │   ├── capture-triage/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── command-palette/
│       │   │   │   └── components/
│       │   │   ├── completion-effects/
│       │   │   │   ├── components/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── contact-and-company/
│       │   │   │   └── views/
│       │   │   ├── custom-fields/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── daily-focus/
│       │   │   │   └── views/
│       │   │   ├── data-export/
│       │   │   │   └── views/
│       │   │   ├── data-import/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── decisions/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── documents/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── evidence/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── external-handoffs/
│       │   │   │   └── views/
│       │   │   ├── external-surface-management/
│       │   │   │   └── views/
│       │   │   ├── favorites/
│       │   │   │   └── views/
│       │   │   ├── feedback/
│       │   │   │   └── views/
│       │   │   ├── file-attachments/
│       │   │   │   ├── components/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── focus-period/
│       │   │   │   └── views/
│       │   │   ├── github-integration/
│       │   │   │   └── views/
│       │   │   ├── goals/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── kanban/
│       │   │   │   ├── store/
│       │   │   │   └── views/
│       │   │   ├── link-sharing/
│       │   │   │   └── views/
│       │   │   ├── moodboards/
│       │   │   │   ├── components/
│       │   │   │   └── views/
│       │   │   ├── personal-data/
│       │   │   │   └── views/
│       │   │   ├── personal-reminders/
│       │   │   │   └── views/
│       │   │   ├── personal-shell/
│       │   │   │   ├── components/
│       │   │   │   └── store/
│       │   │   ├── personal-wiki/
│       │   │   │   └── views/
│       │   │   ├── priority/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── product-gaps/
│       │   │   │   └── views/
│       │   │   ├── production-incidents/
│       │   │   │   └── views/
│       │   │   ├── project-closure-summary/
│       │   │   │   └── views/
│       │   │   ├── project-history/
│       │   │   │   └── views/
│       │   │   ├── project-overview/
│       │   │   │   └── views/
│       │   │   ├── project-retirement/
│       │   │   │   └── views/
│       │   │   ├── project-shell/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── project-updates/
│       │   │   │   └── views/
│       │   │   ├── project-wall/
│       │   │   │   ├── store/
│       │   │   │   └── views/
│       │   │   ├── record-actions/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── record-discovery/
│       │   │   │   └── views/
│       │   │   ├── relations/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── release-communication/
│       │   │   │   └── views/
│       │   │   ├── release-evidence/
│       │   │   │   └── views/
│       │   │   ├── release-planning/
│       │   │   │   └── views/
│       │   │   ├── research-sessions/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── return-to-work/
│       │   │   │   └── views/
│       │   │   ├── risks/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── roadmap-horizon/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── schema-artifacts/
│       │   │   │   └── views/
│       │   │   ├── screens-and-wireframes/
│       │   │   │   ├── components/
│       │   │   │   ├── lib/
│       │   │   │   └── views/
│       │   │   ├── security-redaction/
│       │   │   │   └── views/
│       │   │   ├── smart-collections/
│       │   │   │   └── views/
│       │   │   ├── sources-and-freshness/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── spec-change-review/
│       │   │   │   └── views/
│       │   │   ├── tags/
│       │   │   │   └── views/
│       │   │   ├── technical-diagrams/
│       │   │   │   ├── components/
│       │   │   │   ├── lib/
│       │   │   │   └── views/
│       │   │   ├── test-assessments/
│       │   │   │   └── views/
│       │   │   ├── test-gaps/
│       │   │   │   └── views/
│       │   │   ├── test-plan-and-handoff/
│       │   │   │   └── views/
│       │   │   ├── test-report-acceptance/
│       │   │   │   └── views/
│       │   │   ├── test-review-and-follow-up/
│       │   │   │   └── views/
│       │   │   ├── trash/
│       │   │   │   └── views/
│       │   │   ├── uncertainty-records/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── unified-calendar/
│       │   │   │   └── views/
│       │   │   ├── user-flow/
│       │   │   │   ├── components/
│       │   │   │   └── views/
│       │   │   ├── validation-records/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── value-chain/
│       │   │   │   └── views/
│       │   │   ├── web-macos-client/
│       │   │   │   └── views/
│       │   │   ├── wiki-publishing/
│       │   │   │   └── views/
│       │   │   ├── work-automation/
│       │   │   │   └── views/
│       │   │   ├── work-checklists/
│       │   │   │   └── views/
│       │   │   ├── work-context/
│       │   │   │   └── views/
│       │   │   ├── work-drafts/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── work-lifecycle/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── work-templates/
│       │   │   │   ├── forms/
│       │   │   │   └── views/
│       │   │   ├── workspace-exit/
│       │   │   │   └── views/
│       │   │   └── workspace-overview/
│       │   │       └── views/
│       │   ├── lib/
│       │   │   ├── auth-client.ts
│       │   │   └── mutation.ts
│       │   ├── routes/
│       │   │   ├── _auth/
│       │   │   │   ├── account/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── capture/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── daily-focus/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── focus-periods/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── drafts/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── favorites/
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
│       │   │   │   │   ├── new.tsx
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── search/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── trash/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── wiki/
│       │   │   │   │   └── index.tsx
│       │   │   │   ├── index.tsx
│       │   │   │   └── route.tsx
│       │   │   ├── _founder.tsx
│       │   │   ├── __root.tsx
│       │   │   └── login.tsx
│       │   ├── utils/
│       │   │   └── orpc.ts
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── routeTree.gen.ts
│       ├── src-tauri/
│       │   ├── capabilities/
│       │   ├── src/
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── components.json
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── context.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── auth/
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── config/
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema/
│   │   │       ├── auth.prisma
│   │   │       └── schema.prisma
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── prisma.config.ts
│   ├── env/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── web.ts
│   │   └── package.json
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   └── styles/
│       │       └── globals.css
│       └── package.json
├── scripts/
│   ├── check-dev-ports.sh
│   └── neon-local-proxy.ts
├── biome.json
├── bun.lock
├── lefthook.yml
├── package.json
├── tsconfig.json
└── turbo.json
```
