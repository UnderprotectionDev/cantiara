# Toplu Düzenleme

Kaynak: [`docs/workflow/22-bulk-editing/phase-context.md`](../../workflow/22-bulk-editing/phase-context.md)

## Problem Statement

Kurucu liste, Kanban, Akıllı Koleksiyon ve benzeri çok kayıtlı yüzeylerde seçtiği İşlerin mevcut alanlarını güvenle güncellemek ister. Seçimsiz “bütün kayıtlar” yazması, sessiz kısmi başarı, şema göçü ve içe aktarma bu ihtiyacın yerine geçmez. Kullanıcı başlatmalı çok adımlı katalog eylemleri (21) toplu alan yazması değildir.

## Solution

Kurucu açıkça seçtiği İşlerde mevcut alanları fark önizlemesi, ilerleme ve kayıt bazlı sonuçla günceller. Seçilmeyen kayıt dokunulmaz. UI donmadan ilk ilerleme bütçe içinde görünür. Her İş için başarı veya başarısızlık görünür; gizli kısmi başarı yoktur. Geri alınabilir alan değişiklikleri ortak undo sözleşmesini kullanır. İlk ürün tekrar kullanılabilir çok kayıtlı eylem düğmeleri sunmaz.

## User Stories

1. As a founder on a multi-record surface, I want to select specific Work and bulk-update existing fields, so that I am not forced to open each record.
2. As a founder, I want to see the field diff before apply, so that I know what will change.
3. As a founder, I want unselected Work left untouched, so that a filter result is not an implicit selection.
4. As a founder, I do not want a “select all in the Workspace” write without explicit selection, so that there is no silent mass mutation.
5. As a founder, I want progress that does not freeze the UI, with first progress inside the quality budget, so that a large selection stays honest.
6. As a founder, I want per-record success and failure, so that one conflict cannot hide the rest.
7. As a founder, I want no silent partial success: every selected Work has a visible result, so that I can retry failures.
8. As a founder, I want reversible field changes to use the common safe undo contract, so that bulk undo cannot rewind unrelated later edits.
9. As a founder, I want each record's command to honor base revision and idempotency, so that a stale selection cannot last-write-win.
10. As a founder, I want cancel before the commit barrier per the async rule, and `Finalizing` after, so that cancel cannot land late writes.
11. As a founder, I do not want bulk edit to create fields, migrate schema, or import records, so that this is not portability or custom-field authoring.
12. As a founder, I do not want this surface to be a named multi-step Record Action catalog, so that 21 stays single-target combinations.
13. As a founder, I do not want reusable multi-record combined-action buttons, so that 19 stays closed.
14. As a founder, I want English UI for `Bulk Edit` and per-record results, so that the product language stays English.
15. As a founder using only a keyboard, I want to select, preview, and apply, so that Mutasyon sözleşmesi / günlük planlama can include this path.
16. As a founder, I want Archive/Trash Work excluded unless I explicitly selected those records in a surface that shows them, so that a default list cannot mutate hidden life-cycle.
17. As a founder, I want the actor to remain `User`, so that bulk edit is not labeled automation.
18. As a founder, I want Kanban bulk status changes to still use the close-result step when moving to `Closed`, so that bulk cannot skip lifecycle rules owned elsewhere — this feature must call that rule, not replace it.
19. As a founder, I want bulk not to write planning membership as a hidden extra when I only change a field, so that a status edit is not a silent Daily Focus add.
20. As a founder, I do not want bulk to merge records, convert checklist items, or run Record Actions, so that each of those stays its own preview.
21. As a founder, I want failures to include a secret-free support reference, so that a conflict is supportable.
22. As a founder selecting across Projects on a Workspace list, I want each Work to keep its own Project fields, so that bulk cannot copy a custom field definition across Projects.
23. As a founder, I do not want bulk to change GitHub links or publish snapshots, so that development and sharing stay out.
24. As a founder, I want progress to remain truthful if I navigate away and return, so that a job cannot look finished while records are still `Finalizing`.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Toplu düzenleme](../../prd/06-work-management-and-planning.md#toplu-düzenleme). Identity/idempotency: [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik). Undo: [geri alma](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Async progress: [PRD 16 ortak yöntemler](../../prd/16-product-acceptance.md#ortak-test-yontemleri) and [performans bütçesi](../../prd/15-product-quality.md#performans-butcesi) (first progress p95 1s / p99 2s). Record Actions are 21. Import is 80. 19 forbids reusable multi-record combined buttons. No new ADR. ADR-0004 applies to each record's apply barrier; bulk may report per-record receipts rather than one all-or-nothing Workspace commit — product rule is no *silent* partial success, not “all selected records must succeed together.”
- **Glossary.** Use İş, Liste görünümü, Kanban, Akıllı Koleksiyon. Avoid: select-all-unspecified, schema migration, import, record-action catalog, silent partial.
- **Selection.** Only explicitly selected Work on list, Kanban, Smart Collection, import-result, and similar multi-record surfaces. No selection-less “all records” write. Unselected rows are untouched.
- **Existing fields.** Bulk updates existing fields only. No new field definitions, schema migration, or record creation.
- **Preview, progress, results.** Show the field change preview, then progress without freezing UI, then per-record success/failure. Every selected Work has a visible result. First progress indicator meets the bulk budget. Cancel is allowed only before the defined commit barrier; after barrier show `Finalizing`.
- **Per-record atomicity.** Each Work apply is an idempotent command with base revision. A conflict on one record fails that record visibly and does not last-write-win. Other selected records may still succeed; that is not silent because results are listed. Undo for reversible field changes uses the common contract and must not rewind unrelated later edits.
- **Lifecycle hooks.** Status-to-`Closed` must still collect close result (`Completed`/`Abandoned`) via the lifecycle close step; bulk cannot skip it. This feature invokes that rule rather than owning close UX long-term.
- **Not 21 / 80.** Named multi-step catalog stays Record Actions. Import stays 80. No reusable multi-record action buttons.
- **English UI labels.** `Bulk Edit` plus progress/result copy in English. Add missing labels to the term table in the same change.
- **Stack.** TanStack Table/virtual for large selections. pg-boss if a large job must progress asynchronously; first progress still meets budget. No new spreadsheet product.

## Testing Decisions

- **What a good test is.** Tests observe Bulk Editing through its public interface: selection, preview, progress, per-record results, unselected untouched, conflict on one record, cancel-before-barrier. They do not assert job table internals.
- **Seam (one).** Bulk Editing — the product-facing selected-Work field update interface. Record Actions and import are counterparts. Playwright for Mutasyon sözleşmesi / list surfaces is this seam through the UI.
- **Modules under test.** Bulk Editing only.
- **Prior art.** Contract tests at this seam. Evidence: [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (concurrent/stale writes) and [günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) when Kanban selection is used. Reference Workspace size for progress budget.
- **Required counterparts.** Unselected untouched; no silent failures; stale revision fails that row; schema/import UI absent; Record Action catalog absent.

## Out of Scope

- Seçimsiz “bütün kayıtlar” yazması.
- Kısmi başarıyı sessiz bırakma.
- Toplu düzenlemeyi şema göçü veya içe aktarma sayma.
- Çok adımlı kayıt eylem kataloğu (21); çok kayıtlı birleşik düğmeler.
- Global trash, custom-field authoring.

## Further Notes

- **Orient.** Glossary: İş, Kanban, Liste görünümü, Akıllı Koleksiyon. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#toplu-düzenleme`). ADRs: none owning; 0004 per-record barrier. Related: PRD 02 identity/undo, PRD 15/16 progress, PRD 19 multi-record buttons, workflows 21 and 80.
- **Acceptance.** Bind to [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as relevant. Async first-progress is a 16 common method, not a separate journey.
- **Partial success.** Visible per-record results are required; all-or-nothing across the whole selection is not required by PRD (unlike import/file finalize). Do not import file-finalize “no partial rows” as a bulk default.
