# İş Yaşam Döngüsü

Kaynak: [`docs/workflow/09-work-lifecycle/phase-context.md`](../../workflow/09-work-lifecycle/phase-context.md)

## Problem Statement

Kurucu Özellik, Bug, Görev, Araştırma ve İyileştirmeyi değişmez Proje anahtarı, açık durum ve kapanış sonucu ile yönetmek ister. Bugün iskelette İş ana kaydı yoktur; durum ile kapanış sonucu karışabilir, planlama yüzeyi yaşamı örtük kapatabilir, yanlış Proje “taşıma” ile düzeltilmeye çalışılabilir. Planlama yüzeyleri, İş Bağlam Kartı düzeni ve Taslak bu sorunun parçası değildir — Taslak kesinleşmesi ve yakalama dönüşümü bu seam’e İş bırakabilir.

## Solution

İş başlıkla oluşur; değişmez Proje kapsamında iç kimlik ve `PROJE-123` anahtarı kazanır. Türler `Feature`, `Bug`, `Task`, `Research`, `Improvement`’tır. Durum `Not Started`, `In Progress`, `Blocked`, `Closed` korunan semantiğidir; `Closed` her geçişte `Completed` veya `Abandoned` ister. Arşiv planlama yüzeylerinden çeker, kapanış üretmez. Kopya birleştirme ve `Recreate in another Project` kimlik etkisini önizler. Özellik bir seviye altında başka tam İşleri kapsar; Kapsam Ağacı aynı ilişkiyi salt okunur açar.

## User Stories

1. As a founder, I want to create Work with only a title in a Project, so that capture of intent is cheap.
2. As a founder, I want a user-facing key from the Project short code plus a per-Project incrementing number, so that I can say `PAY-1` without using the internal id.
3. As a founder, I do not want a skipped, merged, or failed number reused, so that gaps are not errors.
4. As a founder, I want the Project chosen at create to stay the Work’s scope forever, so that Work is not portable.
5. As a founder, I want types `Feature`, `Bug`, `Task`, `Research`, and `Improvement`, so that kind is explicit without an epic tree.
6. As a founder, I want type changes among non-Feature types to be free, so that I can refile a Task as a Bug.
7. As a founder changing to or from Feature, I want an impact preview, so that included Work and primary spec are not silently reinterpreted.
8. As a founder, I do not want nested epics or subtask records, so that every Work stays a main record.
9. As a founder, I want create to accept a finalized Draft or a capture convert, so that those features can land a real Work here.
10. As a founder, I want workflow status separate from closure result, so that `Closed` is not a synonym for `Completed`.
11. As a founder moving among `Not Started`, `In Progress`, and `Blocked`, I want free transitions and no custom graph, so that status is not a gate.
12. As a founder moving to `Closed`, I want a close step that requires `Completed` or `Abandoned`, so that a Kanban drag cannot skip the result.
13. As a founder cancelling that close step, I want status unchanged, so that abort is not a close.
14. As a founder reopening, I want explicit confirm and a non-terminal target status, so that the previous result stays in history.
15. As a founder closing with incomplete checklist items or active blockers, I want a non-blocking `Closure check` with `Return to work` and `Close anyway`, so that I am warned not trapped.
16. As a founder closing with notes, I want optional `Keep lasting context` that previews a Decision or a new Personal Wiki document, so that learning is not auto-extracted.
17. As a founder, I do not want close to archive, change Project stage, or auto-abandon, so that those mechanics stay distinct.
18. As a founder, I want to archive Work independently of status and result, so that I can clear planning surfaces without deleting.
19. As a founder, I want archived Work findable with an explicit archive filter, so that archive is not Trash.
20. As a founder, I want to unarchive without changing identity, so that the key stays.
21. As a founder merging duplicates, I want a preview of surviving record, field conflicts, and relations, so that merge is not silent.
22. As a founder, I do not want merge to run from title similarity alone, so that related Work stays `Related` instead of collapsed.
23. As a founder recreating in another Project, I want a new identity and key in the target, so that this is not a move.
24. As a founder, I want to pick portable content and portable relations one by one, so that ownership and lifecycle links do not travel.
25. As a founder, I want the source Work to remain unchanged with a visible origin, so that the mistake is not erased.
26. As a founder, I do not want recreate to alias the old key onto the new Work, so that history does not lie.
27. As a founder, I want a Feature optionally to include other full Work one level down, so that progress can nest without subtasks.
28. As a founder, I want a Work to have at most one primary Feature for inclusion, so that progress is not double-counted.
29. As a founder, I want included Work to keep its own type, status, planning, relations, and history, so that inclusion is not ownership.
30. As a founder, I want derived Feature progress not to change Feature status automatically, so that a rollup is not a workflow.
31. As a founder, I want optional Feature health `On Track`, `At Risk`, `Off Track` on the Feature only, so that it does not replace Manual Project Update.
32. As a founder, I want Scope Tree as a read-only `Project → Feature → included Work` view, so that I can see inclusion without dragging a parent.
33. As a founder, I do not want drag in the tree to change inclusion, so that Scope Tree is not an editor.
34. As a founder, I want `Open source record` from the tree, so that the tree is not a second record.
35. As a founder using only a keyboard or a screen reader, I want to create, transition, close, archive, merge, recreate, and walk the tree, so that İş yaşam döngüsü is possible.
36. As a founder, I do not want planning membership to set status, so that this seam can refuse a later Kanban skip of the close step.
37. As a founder, I want English UI for types, statuses, results, and the recreate/merge/archive actions, so that product language stays English.
38. As a founder, I do not want an automation or GitHub event to write `Completed` or `Abandoned` in silence, so that only this close step — or a later feature’s visible rule that calls it — can set the result.
39. As a founder leaving Feature, I want exit blocked while included Work, health history, or Primary spec remain until I detach them, so that type change cannot silently rewrite inclusion.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [İş öğeleri](../../prd/06-work-management-and-planning.md#iş-öğeleri), [İş öğesi arşivi](../../prd/06-work-management-and-planning.md#iş-öğesi-arşivi), [işin değişmeyen Proje kapsamı](../../prd/06-work-management-and-planning.md#işin-değişmeyen-proje-kapsamı), [kalıcı iş birleştirme](../../prd/06-work-management-and-planning.md#kalıcı-iş-birleştirme), [Kapsam Ağacı](../../prd/06-work-management-and-planning.md#kapsam-ağacı), plus lifecycle in [ortak yaşam döngüsü](../../prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü) and merge/undo in [değişiklik geçmişi](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Writes use Mutation Contract. `Includes` / `Included in` (one primary Feature) persist on the Work Lifecycle seam in this feature. Workflow 12 later hosts the generic relation catalog; this feature does not wait on that package. No new ADR.
- **Glossary.** Use İş, Özellik, İş akışı durumu, Kapanış sonucu, Başka Projede yeniden oluşturma, Taşınabilir İş ilişkisi, Kapsam Ağacı, Kayıt birleştirme. Never task/ticket as the record, sprint, or move-Work. UI type `Task` is the İş türü Görev, not a subtask.
- **Work Lifecycle module.** Create, key allocate, type, status, close step, reopen, archive, merge, recreate, Feature inclusion, Scope Tree. Planning surfaces (Kanban, Backlog) are later consumers that must call this close step; this module rejects `Closed` without a result.
- **Keys.** Internal immutable id plus user-facing `{shortCode}-{n}`. Counter is unique under concurrency; gaps allowed. Title/Project-name change does not change the key. Recreate allocates a new key. Merged Work’s key is a retired-identity redirect, not a living alias.
- **Close step.** `Closed` always shows result `Completed` (`Tamamlandı`) or `Abandoned` (`Vazgeçildi`). Optional reason. Cancel applies nothing. Reopen needs confirm + `Not Started`/`In Progress`/`Blocked`. Closure check is non-blocking. Keep lasting context is optional preview into Decision or Personal Wiki create (those features own the records). A planning surface (including Kanban column move) cannot apply `Closed` without this close step and result. Automation or GitHub must not write the result in silence; a later visible rule (for example an enabled PR-merge rule) calls this same close step.
- **Archive vs close vs Trash.** Archive removes from default planning surfaces, keeps identity, is filterable, is reversible. Not Trash (77), not Project archive (83).
- **Recreate.** Preview target Project, portable fields, and each relation. Copy only founder-selected portable relations. Ownership/lifecycle links stay. Source unchanged; visible origin on the new Work.
- **Feature inclusion.** At most one primary Feature via `Includes`/`Included in`. Other Features may be `Related` without counting as inclusion. Scope Tree read-only; no drag-to-reparent; a Work appears under its primary Feature only. Changing to or from Feature requires impact preview. Exit from Feature is blocked while included Work, Feature health history, or Primary spec remain, until the founder explicitly detaches them; silent reinterpretation is refused.
- **English UI labels.** First user-visible copy uses: `Work`, `Feature`, `Bug`, `Task`, `Research`, `Improvement`, `Not Started`, `In Progress`, `Blocked`, `Closed`, `Completed`, `Abandoned`, `Archive`, `Merge as duplicate`, `Recreate in another Project`, `Scope Tree`, `Closure check`, `Return to work`, `Close anyway`, `Keep lasting context`, `On Track`, `At Risk`, `Off Track`. Add missing labels to the PRD term table in the same change that first shows them. `Work`, `Feature`, `Completed`/`Abandoned` as lifecycle already exist in the table.
- **Stack.** oRPC, Prisma, TanStack Form. Keys freeze Project Shell short code.

## Testing Decisions

- **What a good test is.** Tests observe Work Lifecycle through its public interface: create+key, no reuse, type matrix, status/result matrix, close cancel, Kanban cannot skip close step, reopen, archive filter, merge preview, recreate new identity, inclusion cardinality, Feature exit blocked while included Work/health/Primary spec remain, tree drag refused. They do not assert Kanban CSS or Prisma. Expected values are product rules (status ≠ result, no move, one primary Feature).
- **Seam (one).** Work Lifecycle — the product-facing Work interface. Draft finalize, capture convert, Relations, Decision/Wiki creates are adapters. Playwright for İş yaşam döngüsü is this seam through the UI.
- **Modules under test.** Work Lifecycle only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence: [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: identity allocation, no reuse, status/result matrix).
- **Required counterparts.** Planning membership must not write status here; Kanban cannot skip the close step; close without result rejected; recreate is not a move; tree drag does not write `Includes`; Ticket/sprint vocabulary absent from UI; automation or GitHub event cannot silently write `Completed`/`Abandoned` on this seam.

## Out of Scope

- Kanban, Backlog, Günlük Odak, Roadmap, Odak Dönemi (sonraki workflow’lar).
- İş Bağlam Kartı düzeni (16), şablon (17), kontrol listesi ayrı feature (18) — kapanış kontrolü checklist’i varsa tüketir.
- Taslak yüzeyi (11), Yakalama (06) — yalnız kesinleşmiş İş.
- Çöp Kutusu, Proje arşivi.
- İç içe epic/subtask, Hill Chart.

## Further Notes

- **Orient.** Glossary: İş, Özellik, İş akışı durumu, Kapanış sonucu, Başka Projede yeniden oluşturma, Kapsam Ağacı. Owning PRD: `docs/prd/06-work-management-and-planning.md` plus PRD 02 lifecycle/merge. ADRs in play: none (0004 consumed via Mutation Contract). Related: PRD 16 (İş yaşam döngüsü), PRD 19 (no nested work, no planning-implied status).
- **Acceptance.** Bind to [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Closed accessibility **kayıt oluşturma, düzenleme, çatışma, geri alma** uses this seam for Work. Negative bounds (no ticket-as-Work, no move, no tree drag) are 19-class counterparts.
- **Consumers.** 07 short code freezes on first Work. 06/11 land creates here. 12 later catalogs generic relations; inclusion cardinality is already true on this seam. 25 Kanban must call the close step. 23 Bitiriş efekti triggers only on user-initiated `Completed` accepted by this seam — not implemented here.
