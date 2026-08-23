# İş Bağlam Kartı

Kaynak: [`docs/workflow/16-work-context/phase-context.md`](../../workflow/16-work-context/phase-context.md)

## Problem Statement

Kurucu bir İşin nedenini, beklenen sonucunu, kanıtını ve ilişkili proje gerçeğini tek yerde, aşamalı ve yapılandırılabilir biçimde görmek ister. Bugün Karar, Risk, Varsayım, Açık Soru ve araştırma ayrı İş yüzeyleri gibi durabilir; kart kopya, serbest sorgu veya durum kapısı olabilir; Başlangıç yapılandırması aynı İş türüne farklı anlam verebilir. Paylaşım kapsamı bölüm sırasından türemez. Öncelik dayanakları skor üretmemelidir.

## Solution

İş Bağlam Kartı beş İş türünün kapalı hazır bölüm setini bütün Projelerde aynı başlangıç anlamıyla sunar. Bölümler `Add Context` ile aşamalı açılır ve kapı değildir. Kart bağlamı kaynaklarında canlı gösterir. Yapılandırma modu düzeni Proje ve İş türü başına değiştirir; uygulanmadan önce fark görünür, geri alma yalnız düzeni döndürür. `Copy Context as Markdown` kalıcı snapshot üretmez. `Priority Foundations` taranabilir kaynak özetidir; skor veya sıra hükmü yoktur. Kart özel iç çalışma düzenidir.

## User Stories

1. As a founder opening Feature Work, I want `Problem/Opportunity`, `Expected Outcome`, `Evidence & Decisions`, `Risks & Open Questions`, `Included Work`, `GitHub & Tests`, and `Target Release` as the prepared sections, so that Feature meaning is stable.
2. As a founder opening Bug Work, I want `Observed/Expected Behavior`, `Affected Releases`, `Evidence`, and `GitHub & Tests`, so that a Bug is not a Feature layout.
3. As a founder opening Task Work, I want `Description`, `Dependencies`, `GitHub & Tests`, and `Target Release`, so that a Task stays the smallest prepared set.
4. As a founder opening Research Work, I want `Research Question`, `Sources & Evidence`, `Decisions`, and `Related Work`, so that Research is not a Feature commitment.
5. As a founder opening Improvement Work, I want `Current Situation`, `Expected Outcome`, `Evidence`, and `GitHub & Tests`, so that Improvement has its own prepared set.
6. As a founder using `Blank Project`, `Solo SaaS`, `Open Source Library`, or `Mobile Application`, I want the same type layout in every Project, so that Starter Configuration never splits Work meaning.
7. As a founder creating Work, I want title, type, status, and daily planning fields visible first, so that I am not forced to fill context sections to save.
8. As a founder, I want hidden sections to open with `Add Context`, so that context arrives progressively.
9. As a founder, I want no section to gate creation or a status transition, so that empty context cannot block work.
10. As a founder, I want the card to show problem, expected outcome, Project Goal, origin Research, primary Feature, Primary spec, and supported direct Decision, Risk, Assumption, Open Question, evidence, and GitHub/Release records from their sources, so that the card is not a copy.
11. As a founder, I want `Why am I doing this work?` to chain the nearest meaningful sources by their visible names, so that I see the reason path without a new record or relation.
12. As a founder, I want an unresolvable or inaccessible step explained without leaking content, so that a broken link cannot become a second truth.
13. As a founder looking at an empty visible section, I want a neutral empty state and a supported add-or-link action, so that absence is honest.
14. As a founder, I want that emptiness not to change status, priority, close, or Release scope, so that missing context is not a score or gate.
15. As a founder who hid a section in the layout, I want that hidden section not counted as missing, so that configuration is not a completeness audit.
16. As a founder in Configuration mode, I want to show, hide, and reorder sections per Project and Work type, so that layout is a presentation configuration.
17. As a founder, I want to add a named custom section only from a supported record type, direct relation, or Evidence Role plus status conditions, so that the card cannot run a free query, formula, chart, or arbitrary source.
18. As a founder, I want a section to fetch only records reachable from the open Work through those supported relations, so that the card is not a Workspace search.
19. As a founder applying a layout change, I want the affected types and section diff visible before confirm, so that I am not surprised.
20. As a founder, I want the confirmed change stored in versioned configuration history, with undo restoring only the layout, so that Work fields and relations stay untouched.
21. As a founder, I want matching existing and new Work to use the same live presentation configuration, so that there is no per-record card schema or old-layout copy.
22. As a founder copying Project structure, I want context-card layouts to become independent versioned configuration in the target Project without copying Work or card results, so that structure copy is not content fork.
23. As a founder, I want `Copy Context as Markdown` (and the same Command Palette command) to put Work key, title, type, status, description, checklist, why-chain, Primary spec, related uncertainty, active blockers, and allowed GitHub/external links on the clipboard as readable Markdown, so that I can paste elsewhere without a snapshot record.
24. As a founder, I want that Markdown to include production time, readable source ids/links, and `Primary source is in the app`, so that the paste is dated and honest.
25. As a founder, I want secrets, inaccessible fields, and private attachment bytes excluded, so that copy cannot widen my access.
26. As a founder, I want visible card sections not to become link-sharing or Build in Public scope, so that this inner layout is not a share template.
27. As a founder, I want `Priority Foundations` to gather goal, date, blocker, risk, milestone, feedback, decision, source, effort, and criterion values bound to their records, so that I can scan support for a priority decision I still make.
28. As a founder, I want clickable counts for supported context types to open the exact filtered set, so that a number is not popularity.
29. As a founder, I want Feedback counts split as Feedback records, unique Contacts, and unique Companies when used, so that five Feedbacks from one Contact stay five and one.
30. As a founder, I want Archive records included with Archive visible, and Trash or permanently deleted records excluded, so that counts match durable truth.
31. As a founder, I do not want Priority Foundations to emit a numeric score, automatic rank, or WSJF, so that Prioritization sessions and Backlog order stay other features.
32. As a founder, I do not want Decision, Risk, Assumption, Open Question, or research to open a second Work surface, so that those records stay sources on this card.
33. As a founder using only a keyboard or a screen reader, I want to add, hide, and reorder sections and to hear empty-state reasons, so that PRD 15's Work Context Card a11y rule holds.
34. As a founder, I want English UI for `Add Context`, `Why am I doing this work?`, `Copy Context as Markdown`, `Priority Foundations`, and the prepared section names, so that the product language stays English.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [İş Bağlam Kartı](../../prd/06-work-management-and-planning.md#iş-bağlam-kartı). Configuration mode is [Yapılandırma modu](../../prd/04-workspace-and-projects.md#yapılandırma-modu). Starter layouts do not vary by [görüşlü başlangıç yapılandırmaları](../../prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları). Structure copy is [Proje yapısını kopyalama](../../prd/04-workspace-and-projects.md#proje-yapısını-kopyalama). A11y: [erişilebilirlik](../../prd/15-product-quality.md#erisilebilirlik). Sharing is [kapalı dünya](../../prd/14-sharing-and-public-publishing.md#ortak-snapshot-ve-dis-gorunurluk-guvenligi). No new ADR.
- **Glossary.** Use İş, Özellik, İş Bağlam Kartı, Başlangıç yapılandırması, Kanıt bağı, Kökeni, Proje Hedefi. Avoid: dashboard, second Work summary, free query, health/readiness score, share scope from layout, Starter-split Work meaning.
- **Five prepared layouts.** Layout is by Work type only and has the same starting meaning in every Project. Use the PRD closed section table for Feature, Bug, Task, Research, and Improvement. Sections are optional, progressive via `Add Context`, and never a create or status gate. Title, type, status, and daily planning fields stay initially visible.
- **Live sources.** The card shows the Work's own fields plus Project Goal, origin Research, primary Feature, Primary spec, and records reached by supported direct relations (Decision, Risk, Assumption, Open Question, Feedback, Source, Research Session, Experiment, Test Gap, Session Test, GitHub PR/check, target Project Release) from their sources. Each item opens status and exact source. The card does not mint a Context record, copy body, or relation.
- **Why chain.** `Why am I doing this work?` is a compact clickable chain of the nearest meaningful sources by visible names. It does not create records, relations, summary prose, or a second truth. Unresolvable/inaccessible steps explain without leaking content.
- **Empty versus hidden.** A configured-visible empty section uses a neutral empty state and a supported add/link action. Emptiness does not change status, priority, close, or Release scope and is not a completeness, health, or process gate. A user-hidden section is not treated as missing.
- **Configuration.** In Configuration mode, per Project + Work type, founder shows, hides, and reorders prepared modules and may add named custom sections only from supported record type, direct relation, or Evidence Role with status conditions. A section fetches only records reachable from the open Work through those relations. No independent Project/Workspace query, free operator, formula, chart, metric, or arbitrary source. Preview affected types and section diff; confirm writes versioned configuration history; safe undo restores only layout. Work fields, relations, statuses, and evidence do not change. No per-record card schema or frozen old-layout copy. All matching Work share the live presentation.
- **Not a share scope.** Visible records, fields, sections, or order do not create link-limited or Build in Public scope, permission, or external snapshot template.
- **Copy Markdown.** `Copy Context as Markdown` and the same Command Palette command copy Work key, title, type, status, description, checklist, why chain, Primary spec, related Decision/Risk/Open Question, active blockers, and allowed GitHub/external links as readable Markdown. Output includes production time, readable source ids/links, and `Primary source is in the app`. No new record or durable snapshot. Secrets, inaccessible fields, and private attachment content are excluded; the action does not widen access.
- **Priority Foundations.** Gathers goal, date, blocker, risk, milestone, Feedback, Decision, Source, effort, and optional priority-criterion values bound to records and scannable. No configurable numeric score, automatic ranking, or objective priority claim. Clickable counts open the exact set. Feedback splits into Feedback records, unique Contact, and unique Company when used. Archive (not Trash, not permanently deleted) is included with Archive visible. Counts are not demand, votes, popularity, or automatic priority input. This is not a Prioritization session or Backlog order.
- **Included Work / Feature extras.** Primary-Feature inclusion, Feature health notes, and Primary spec association remain owned by work-lifecycle/Feature rules; this card only presents them live when in the Feature prepared set. Do not invent subtask hierarchy here.
- **English UI labels.** Prepared section names stay the English PRD strings. Also `Add Context`, `Why am I doing this work?`, `Copy Context as Markdown`, `Priority Foundations`, `Primary source is in the app`. Add missing labels to the term table in the same change.
- **Stack.** Existing web/query/form stack. No dashboard builder dependency.

## Testing Decisions

- **What a good test is.** Tests observe Work Context Card through its public interface: five layouts × four Starter Configurations, progressive sections, live source rendering, configuration preview/apply/undo, Markdown copy, and Priority Foundations counts. They assert no gates, no copies, no scores, no share-scope — not DOM structure of cards.
- **Seam (one).** Work Context Card — the product-facing Work-detail context interface. Configuration mode is the same seam's admin presentation, not a second module. Playwright a11y is this seam through the UI.
- **Modules under test.** Work Context Card only. Planning surfaces, sharing, Prioritization, Command Palette host, and Project Overview are counterparts.
- **Prior art.** Contract tests at this seam. Evidence: [İş bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Gerçek proje`; five types × four starters). Keyboard/screen-reader per PRD 15.
- **Required counterparts.** Starter Configuration does not change type layout; empty visible section is not a gate; undo does not mutate Work fields; Markdown copy creates no record and omits secrets; Priority Foundations has no score; card order does not change share preview scope.

## Out of Scope

- Kartı dashboard, ikinci İş özeti veya serbest sorgu sonucu sayma.
- Başlangıç yapılandırmasına göre farklı İş anlamı üretme.
- Kartı planlama yüzeyi, sağlık skoru veya yayın kapısı yapmak.
- Düzeni kayıt başına ayrı şema veya içerik kopyası sayma.
- Paylaşım kapsamını karttaki bölüm sırasından türetme.
- Öncelik dayanaklarını Önceliklendirme oturumuna veya otomatik puana taşıma.
- Karar/Risk/araştırma için ikinci İş yüzeyi; Komut Paleti host'u; Feature kapsama yazımı (yalnız sunum).

## Further Notes

- **Orient.** Glossary: İş, Özellik, İş Bağlam Kartı, Başlangıç yapılandırması. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#iş-bağlam-kartı`) plus PRD 04 Configuration mode and structure copy. ADRs: none owning. Related: PRD 15 a11y, PRD 14 closed world, PRD 16 İş bağlamı, PRD 19 (no free query/dashboard builder, no status gates).
- **Acceptance.** Bind to [İş bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Closed a11y: card editing is named in PRD 15 (not a separate 16 journey name).
- **Priority.** Foundations here ≠ scoring. Sessions/map are workflow 20.
