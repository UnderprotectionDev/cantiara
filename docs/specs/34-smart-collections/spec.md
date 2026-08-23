# Akıllı Koleksiyonlar

Kaynak: [`docs/workflow/34-smart-collections/phase-context.md`](../../workflow/34-smart-collections/phase-context.md)

## Problem Statement

Kurucu desteklenen koşullardan canlı üyelik, görünüm ve açıklanabilir özetler oluşturmak ister. Bugün koleksiyon statik liste, klasör, etiket veya ikinci kayıt olur; görünüm değiştirmek durum veya sıra yazar; abonelik spam basar; içgörü skor veya yayın kapısı olur. Hazır tür dizinleri, Bildirim Merkezi kabuğu ve özel alan şeması bu sorunun parçası değildir.

## Solution

Akıllı Koleksiyon üyeliği yalnız kayıt koşullarından canlı türetilir; manuel pin yoktur. Aynı üyelik `List`, `Table` ve izinli türlerde `Gallery` olarak sunulur; sunum durum, sıra veya kapsam yazmaz. İş koleksiyonları birden fazla adlandırılmış görünüm taşıyabilir. Abonelik, kaydın koşula ilk girişinde (ve seçilirse çıkışında) üyelik dönemi başına tek `smart-collection-entry` dikkat sinyali üretir; 71 gösterir. Hafif İçgörüler sayı ve dağılımı kaynağına inilebilir özetler; skor yoktur.

## User Stories

1. As a founder, I want a named `Smart Collection` whose membership is live from explicit filters, so that I am not maintaining a static list or folder.
2. As a founder, I want conditions built visually and summarized in readable form, with each member explainable by which conditions matched, so that membership is inspectable.
3. As a founder, I do not want manual membership, pins, or out-of-filter exceptions, so that the query is the only truth.
4. As a founder dragging a record onto a collection, I want a preview of the field change that would make it match—if a direct field equality exists—so that drag is not a hidden pin.
5. As a founder, I want collections to work inside one Project or across Projects, so that a Workspace-wide condition is still a collection, not a second list product.
6. As a founder, I want the closed type matrix to decide which types can be collection sources, so that Screens, diagrams, and File Attachments are not membership sources, while Documents can be members on structured metadata only.
7. As a founder viewing the same membership as `List`, `Table`, or `Gallery`, I want switching presentation not to write record status, order, or scope, so that a view is not a workflow action.
8. As a founder, I want `Gallery` only for the PRD’s allowed types, with preview derived in the contracted order and no separate cover record, so that Gallery is not a File library or Moodboard.
9. As a founder on a Work collection, I want multiple named views that store Kanban, list, roadmap, or Gallery presentation plus grouping, sort, and visible fields, so that one membership can be used in several routines.
10. As a founder, I want an optional one-sentence `Purpose` on a named view, so that the chooser explains the routine without changing the query.
11. As a founder changing filters on a saved view, I want those changes temporary until I save, save-as, or revert, so that I cannot silently overwrite a named view.
12. As a founder, I want `New work` on a Work collection to prefill simple single-field equalities, and to warn if I change a value that would miss the collection, so that create is honest. Complex conditions are not auto-applied.
13. As a founder, I want to subscribe to first entry into the collection (and optionally exit), so that I can watch a condition without polling.
14. As a founder, I want at most one attention signal per membership period, so that flapping does not spam.
15. As a founder, I want that signal to open the source record and not to make the record a child of the collection, so that subscribe is not parenting.
16. As a founder, I want production to use the registered `smart-collection-entry` `Information flow` identity—including an explainable leave reason when exit is opted in—so that 71 can display it and no unregistered kind is minted.
17. As a founder on a Work collection, I want an Insights tab of count, status, effort, age, and time-in-status from the current filter, so that I can see shape without a warehouse.
18. As a founder clicking a slice, I want the collection filtered to those exact records, so that insights drill to records, not to a score.
19. As a founder, I do not want person comparison, capacity, cycle-time performance management, a free dashboard builder, coverage, quality score, or a release gate, so that insights stay light.
20. As a founder, I want English UI copy for `Smart Collection`, `Gallery`, `Insights`, `Subscribe`, and `Purpose`, so that the product language stays English.
21. As a founder using only a keyboard or a screen reader, I want to build conditions, switch presentations, save a view, subscribe, and drill an insight, so that Arama ve ilişki is possible without a pointer-only gallery.
22. As a founder, I do not want this feature to be the prepared type indexes, the notification-center shell, or the custom-field schema editor.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Akıllı Koleksiyonlar](../../prd/08-search-relations-and-evidence.md#akıllı-koleksiyonlar), [Akıllı Koleksiyon abonelikleri](../../prd/08-search-relations-and-evidence.md#akıllı-koleksiyon-abonelikleri), and [Hafif İçgörüler](../../prd/08-search-relations-and-evidence.md#hafif-içgörüler). Source-type matrix is [tür-kapsamlı Table](../../prd/08-search-relations-and-evidence.md#tür-kapsamlı-table-görünümü). Signal `smart-collection-entry` is in [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari); 71 displays. Periodic email digest ban is [PRD 19](../../prd/19-out-of-scope.md). Backlog is a prepared collection whose extra manual order is workflow 26, not a second membership model here. No new ADR.
- **Glossary.** Use Akıllı Koleksiyon (`Smart Collection`), Dikkat sinyali, Gallery, Hafif İçgörüler (`Insights`). Do not introduce static list, folder, tag-as-collection, dashboard, or score. Cross-project *lists* that are not this query are out; this query may span Projects.
- **Live membership.** Conditions only. Visual builder; readable summary; per-record because. Limited Search operators may accelerate the builder; no free advanced language. Drag-on preview of a direct field write; no pin.
- **Presentations.** Same membership in List / Table / Gallery (Gallery type-limited). Switching presentation does not write status, rank, or scope. Work collections: multiple named views including Kanban/list/roadmap/Gallery settings. Roadmap-named view may store time scale, density, two visual axes, and view-local group/column presentation order—not card priority, not Backlog order. Unsaved presentation stays dirty until save / save-as / revert.
- **Source types (PRD 08 matrix).** Full Smart Collection source: Work, Project Goal, Milestone, Project Release, Feedback, Contact, Company, User Research Session, Decision, Risk, Assumption, Open Question, Product Gap, Source, Planned Test Case, Test Handoff, Test Session, Test Gap, Test assessment, Production Incident. Document and Wiki Document may be members on structured metadata, tags, and scope only. Not sources: Screen, User Flow, Project Wall, Moodboard, Technical Diagram, File Attachment, Capture Inbox item, Draft, External Surface, GitHub external record. `Save as Smart Collection` from Search is this feature’s create command; 33 does not store membership.
- **Gallery types.** Gallery is selectable only for Document, Project Wall, User Flow, Screen, Moodboard, Technical Diagram, File Attachment, Source, and Feedback. Preview order: Screen from the currently selected Wireframe version; Technical Diagram from the selected Diagram View; otherwise exact File Attachment version visual, first accessible Document visual, safe link preview, or short text fallback — in that order. Gallery is a named-view presentation, not a second source-type = yes.
- **New work.** Prefill only conditions that are direct single-field equalities. Warn if a changed value would miss. Date range, negation, and complex relations are not auto-applied.
- **Subscriptions.** Opt-in first entry; optional exit. One signal per membership period (enter, and separately per leave period if opted). Uses registered `smart-collection-entry` with an explainable enter/leave reason. Does not create records or write source fields. 71 renders; this feature does not build the center. No email digest.
- **Insights.** Work collections only. Count, status distribution, effort distribution, age, time-in-status from the current filter. Slice click filters to those records and recomputes. No score, coverage, quality, capacity, or release gate.
- **English UI labels.** `Smart Collection`, `List`, `Table`, `Gallery`, `Insights`, `Subscribe`, `Purpose`, `New work`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Smart Collections through its public interface: live membership from conditions, presentation switch without status write, named-view unsaved dirty state, period-deduped `smart-collection-entry`, insights drill-to-records. They do not assert SQL of the query planner. Expected values are product rules (no manual members; one signal per period; insights are counts, not scores).
- **Seam (one).** Smart Collections — live membership, named presentations, subscription production, and light insights. Record Discovery indexes, notification-center shell, Backlog manual order, and custom-field schema are counterparts, not this module.
- **Modules under test.** Smart Collections only. Palette, prepared indexes, Moodboard, and 71’s grouping UI are out except as counterparts.
- **Prior art.** Contract tests at this seam with a condition fixture and a signal-sink double. Evidence environment for [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is both real project and synthetic authorization (counts only from accessible records). Cloud tests must not use production content.
- **Required counterparts.** Manual pin rejected; view switch does not write status; flapping membership emits one signal per period; insights click opens records not a score; Documents are metadata-only members; Gallery disallowed types cannot choose Gallery; no email digest; Backlog order not written by a normal collection view.

## Out of Scope

- Koleksiyonu statik liste, klasör veya etiket sayma.
- Görünümü kayıt durumu veya öncelik gerçeği yapmak.
- İçgörüyü coverage, kalite puanı veya yayın kapısı sayma.
- Hazır tür dizinleri, Bildirim Merkezi kabuğu, özel alan şema editörü, Moodboard, Dosya Eki kütüphanesi.
- Periyodik e-posta özeti.

## Further Notes

- **Orient.** Glossary: Akıllı Koleksiyon, Dikkat sinyali. Owning PRD: `docs/prd/08-search-relations-and-evidence.md` (Akıllı Koleksiyonlar, abonelikler, Hafif İçgörüler). ADRs in play: none. Related but not owning: PRD 04 (`smart-collection-entry`, 71 display), PRD 06 (Backlog as prepared collection), workflow 10, 13, 25 (Kanban presentation of a view), 26, 33, PRD 16 (Arama ve ilişki), PRD 19.
- **Acceptance.** Bind to [Arama ve ilişki](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (both: membership counts only from accessible exact sources). Subscription production is the same journey’s collection package; display is [Dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) via 71.
- **Consumers.** Workflow `71-attention-signals` displays `smart-collection-entry`. Workflow `25-kanban` may render a Work collection’s Kanban presentation without owning membership. Workflow `26-backlog` is the prepared collection with the one manual order exception. Workflow `31-documents` may embed a named view as a live block.
