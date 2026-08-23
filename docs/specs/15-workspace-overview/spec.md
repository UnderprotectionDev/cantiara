# Çalışma Alanı Genel Bakışı

Kaynak: [`docs/workflow/15-workspace-overview/phase-context.md`](../../workflow/15-workspace-overview/phase-context.md)

## Problem Statement

Kurucu tek Çalışma Alanındaki Projeleri ve kişisel dikkati dağılmış listeler yerine kaynak kayıtlardan türetilen bir ufukta görmek ve adlandırılmış çapraz Proje listelerini kaydetmek ister. Bugün Workspace dağılabilir: sayılar ikinci bir dashboard gerçeği, çapraz liste Portfolio veya statik üyelik, Kişisel Wiki bir Proje özeti gibi durabilir. Proje Genel Bakışı, kişisel kabuk ve Akıllı Koleksiyon bu ufkun yerine geçmez.

## Solution

Çalışma Alanı genel bakışı `Active Projects`, `Attention Required`, `Upcoming` ve `Recent Work` hazır modülleriyle açılır. Sayılar ve başlıklar kesin kaynak kümelerini açar; modül sağlık hükmü üretmez. Kurucu dört modülü gösterebilir, gizleyebilir ve sıralayabilir; sınırlı sayıda Belge veya adlandırılmış Akıllı Koleksiyon görünümünü kişisel canlı blok olarak ekleyebilir. Adlandırılmış çapraz Proje listeleri yaşam durumu, aşama, tarih, arşiv ve desteklenen görünür koşullardan canlı türetilir; manuel üyelik veya Portfolio kaydı doğmaz.

## User Stories

1. As a founder, I want Workspace overview summaries to derive from source Project lifecycle records and personal-context records (dates, reminders, open risks, blockers, recent Work), so that the horizon is not a dashboard copy of those records.
2. As a founder, I want the surface to open with `Active Projects`, `Attention Required`, `Upcoming`, and `Recent Work`, so that the first-project journey has a stable Workspace horizon.
3. As a founder, I want `Active Projects` to list currently Active Projects and open each source Project, so that a count is not a health score.
4. As a founder, I want `Attention Required` to gather source-backed blockers, open risks, and other Workspace-visible attention already recorded elsewhere, so that this module does not invent a second notification center.
5. As a founder, I want `Upcoming` to show approaching goal dates, reminders, and similar dated source items, so that I can drill into the exact record.
6. As a founder, I want `Recent Work` to show recently touched Work from source activity, so that recency is not a saved working set or Favorites list.
7. As a founder clicking a module count or title, I want the exact filtered source set to open, so that a number is always drillable.
8. As a founder, I want to show, hide, and reorder the four prepared modules, so that the horizon is personal without becoming a widget builder.
9. As a founder, I want to add a limited number of existing Documents or named Smart Collection views as personal live blocks, so that I can pin a source I already have.
10. As a founder, I want those blocks to be references that copy neither the Document nor the collection membership rule, so that editing the source updates the block.
11. As a founder, I want each block to use the common `Open source record` action, so that a block is not a new query language.
12. As a founder, I do not want user-defined general widgets or a free dashboard builder, so that the overview cannot become a second Workspace truth.
13. As a founder, I want named cross-Project lists that filter Projects by lifecycle, stage, date, archive, supported Project areas, and other already-visible conditions, so that I can save a live slice of the Workspace.
14. As a founder, I want list membership to derive from those conditions, so that dragging a Project in cannot mint membership.
15. As a founder, I want the list to store supported columns, sort, and grouping, so that the saved list is a view, not a Program record.
16. As a founder showing last Manual Project Update health, I want it labeled `Last reported health` with its date, so that it never becomes a current Project health field or dateless badge.
17. As a founder, I want a cross-Project list not to be a Portfolio, folder, static membership, or parent Project, so that changing a condition changes membership.
18. As a founder, I want Personal Wiki to stay out of Project summary modules, so that Wiki is not presented as a Project.
19. As a founder, I do not want this overview to replace Project Overview, so that a single Project's purpose, stages, and local work stay workflow 08.
20. As a founder, I do not want this overview to be the personal access shell, so that Daily Focus, Favorites, and the notification center stay workflow 72.
21. As a founder, I do not want a cross-Project list to be a Smart Collection, so that Project-internal or record-type collections stay workflow 34.
22. As a founder, I do not want Mission Control that rolls up last health marks across Active Projects, so that 19 stays closed.
23. As a founder, I do not want a Lineup of Project start/end bars or a Gantt, so that this horizon is not a schedule product.
24. As a founder using only a keyboard or a screen reader, I want to open modules, drill to source records, and manage saved lists, so that the İlk Proje journey is possible without a pointer.
25. As a founder, I want English UI for `Active Projects`, `Attention Required`, `Upcoming`, `Recent Work`, `Last reported health`, and `Open source record`, so that the product language stays English.
26. As a founder, I want hiding a module not to delete source records, so that personal layout is presentation only.
27. As a founder with no Active Projects, I want `Active Projects` to show a neutral empty state that is not a health failure, so that an empty Workspace is honest.
28. As a founder, I want `Recent Work` not to restore scroll, tabs, or panel positions, so that 19's recent-context ban holds.
29. As a founder, I want a saved cross-Project list not to become a parent Project or Initiative roll-up, so that corporate planning stays out.
30. As a founder exporting later, I want the named list identity stable enough for an exact-view snapshot, so that portability can target it without this feature owning export.
31. As a founder, I do not want user-defined Project health formulas on this overview, so that Manual Project Update remains the only dated health mark.
32. As a founder, I want reordering modules not to write Project lifecycle, so that layout is not a planning membership.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Çalışma alanı genel bakışı](../../prd/04-workspace-and-projects.md#çalışma-alanı-genel-bakışı) and [Kaydedilmiş çapraz proje listeleri](../../prd/04-workspace-and-projects.md#kaydedilmiş-çapraz-proje-listeleri). Project Overview is [Proje genel bakışı](../../prd/04-workspace-and-projects.md#proje-genel-bakışı). Personal shell is [kişisel erişim kabuğu](../../prd/04-workspace-and-projects.md#bağlamı-koruyan-kişisel-erişim-kabuğu). Smart Collections are [Akıllı Koleksiyonlar](../../prd/08-search-relations-and-evidence.md#akıllı-koleksiyonlar). İlk Proje acceptance names these four modules. No new ADR.
- **Glossary.** Use Çalışma Alanı, Proje, Proje genel bakışı, Kişisel erişim kabuğu, Akıllı Koleksiyon, Kişisel Wiki, Favori, Aktif Çalışma Seti. Avoid: Workspace dashboard, Portfolio, Program, Home board, Mission Control, second Workspace.
- **Four modules.** The surface opens with `Active Projects`, `Attention Required`, `Upcoming`, and `Recent Work`. Summaries derive from source records. Counts and headings open the exact set. Modules do not emit an independent health judgment. `Active Projects` lists currently Active Projects. Pending, Completed, and Abandoned Projects remain source records this overview can open (named lists and drill-down); they are not a fifth prepared module or a dashboard copy. `Attention Required` displays source-backed attention already defined elsewhere (blockers, open risks, dated reminders); it does not own the Unified Notification Center or mint unregistered signal ids.
- **Personal layout.** Founder may show, hide, and reorder the four modules. They may add a limited number of existing Documents or named Smart Collection views as personal live blocks. Blocks are references, not copies, queries, membership rules, record sets, widgets, or analytics truth. Source changes appear in the block. `Open source record` opens the source. No user-defined general widget or free dashboard builder.
- **Not other overviews.** This is the Workspace horizon. It does not replace Project Overview (08), the personal shell (72), or Smart Collections (34). Personal Wiki is not shown as a Project summary. Favorites and session Active Work Set are not this Recent Work module.
- **Cross-Project lists.** Named lists filter Projects by lifecycle status, stage, date, archive, supported Project areas, and other already-visible conditions. Membership is live from conditions. No manual drag-on membership, Program/Portfolio record, Project score, or report truth. View may store supported columns, sort, and grouping. If last Manual Project Update health is used, show `Last reported health` with its date; do not invent a current Project health field, automatic health verdict, or dateless status badge.
- **Export consumer.** Exact-view CSV/PDF snapshot of a supported cross-Project list is owned by portability (PRD 13); this feature only needs a stable named view identity those exports can target later. Do not implement export here.
- **English UI labels.** `Active Projects`, `Attention Required`, `Upcoming`, `Recent Work`, `Last reported health`, `Open source record`. Add missing labels to the term table in the same change. No Turkish UI.
- **Stack.** TanStack Router for the Workspace route, TanStack Query for derived summaries, TanStack Table for saved lists. No new dashboard framework.

## Testing Decisions

- **What a good test is.** Tests observe Workspace Overview through its public interface: four modules, drill-down to exact sets, layout show/hide/reorder, live blocks, and named cross-Project lists. They assert derivation from source records and the absence of Portfolio membership, health scores, and Wiki-as-Project — not widget tree snapshots.
- **Seam (one).** Workspace Overview — the product-facing Workspace horizon and saved cross-Project list interface. Playwright for the İlk Proje module clause is this seam through the UI.
- **Modules under test.** Workspace Overview only. Project Overview, personal shell, Smart Collection authoring, and notification center are counterparts (“not this surface / this block is a reference”).
- **Prior art.** Contract tests at this seam with fixture Projects in Active/Pending/Completed/Abandoned. Evidence: [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Gerçek proje` for the four-module opening; synthetic is allowed for list-condition counterparts).
- **Required counterparts.** Counts open exact sets; hidden module does not delete Projects; live block does not copy Document body; drag does not mint list membership; Wiki absent from Project modules; no Mission Control health rollup.

## Out of Scope

- Genel bakışı ikinci Workspace veya dashboard gerçeği sayma.
- Çapraz listeyi Portfolio, klasör, statik üyelik, Program veya üst Proje yapmak.
- Kişisel Wiki'yi Proje özeti gibi gösterme.
- Proje Genel Bakışı (08), kişisel kabuk (72), Akıllı Koleksiyon yazımı (34).
- Mission Control sağlık toplaması, Lineup, Gantt, Home board, serbest widget builder.
- Bildirim merkezini veya Manuel Proje Güncellemesi yazımını burada inşa etme.

## Further Notes

- **Orient.** Glossary: Çalışma Alanı, Proje, Proje genel bakışı, Kişisel erişim kabuğu, Akıllı Koleksiyon, Kişisel Wiki. Owning PRD: `docs/prd/04-workspace-and-projects.md` (`#çalışma-alanı-genel-bakışı`, `#kaydedilmiş-çapraz-proje-listeleri`). ADRs: none owning. Related: PRD 16 İlk Proje, PRD 19 (Mission Control, Lineup, Home board).
- **Acceptance.** Bind to [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (“Çalışma Alanı özeti Active Projects, Attention Required, Upcoming ve Recent Work modülleriyle açılır”). Cross-Project lists are the same Workspace package, not Smart Collection.
- **Attention Required.** Reads registered attention; does not own signal emission (71) or blocker relations (19).
