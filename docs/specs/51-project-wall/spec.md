# Proje Duvarı

Kaynak: [`docs/workflow/51-project-wall/phase-context.md`](../../workflow/51-project-wall/phase-context.md)

## Problem Statement

Kurucu Proje anlatısını canlı kayıt kartları ve uzamsal yerleşimle kurmak ister. Bugün duvar konumu ilişki, durum veya öncelik sanılabilir; kart kopya kayıt üretebilir; görsel çizgi sessizce bağ yazabilir; Sitemap/Customer Journey iskeleti örnek içerik doldurabilir; sunum snapshot'ı paylaşım kapsamını genişletebilir. Wireframe, Moodboard, Belge ve Wiki kendi yüzeylerindedir. Dışarı açmak 73/75'tedir.

## Solution

Kurucu birden fazla düz, adlandırılmış Proje Duvarı tutar. Kalıcı öğeler mevcut ana kayıtların canlı kartlarıdır; yerleşim kaynak kaydı yazmaz. Görsel çizgi ve `Lock Position` anlatı içindir; kalıcı ilişki yalnız önizlemeli `Create Persistent Relation` ile doğar. Kabuğun seçtiği `Sitemap` ve `Customer Journey` iskeletleri boş başlık yapılı duvar olarak burada yaşar. Sunum ve bölge snapshot'ı tarihli salt okunur iç çıktıdır; duvar gerçeğinin yerine geçmez ve paylaşım kapsamını genişletmez. Bu tuvaldeki kişisel viewport, yapılandırılmış outline ve 500/750 sahne bu feature'ın kabulüdür.

## User Stories

1. As a founder, I want multiple flat, named Project Walls per Project, so that I can keep distinct narratives without nesting walls.
2. As a founder, I want walls to be Project-scoped only, so that there is no Workspace- or Wiki-level visual wall.
3. As a founder, I want the same master record referenced on different walls without content copies, so that a card is not a duplicate record.
4. As a founder, I want persistent items to be live cards of existing master records, so that the wall cannot grow wall-only notes, tasks, or files.
5. As a founder moving or restyling a card, I want the source record unchanged; content edits go through `Open Source Record`.
6. As a founder placing a Technical Diagram card, I want a read-only live preview of the selected Diagram View; editing nodes on the wall is impossible; historical narrative pins an exact Diagram Version with live/exact labeled.
7. As a founder adding a named Smart Collection as a read-only live summary block, I want a limited result set and `Open all in source`, not a second query or membership.
8. As a founder when the same record appears as a card and inside that summary, I want the shared source called out, so that I do not think there are two records.
9. As a founder, I want `Compact`, `Preview`, and `Detailed` densities using product-chosen fields per type, plus a limited accessible highlight palette, so that I cannot invent per-card CSS, fonts, or field builders.
10. As a founder, I want single-level, non-nested groups that are not permanent classification.
11. As a founder drawing directed labeled visual links, I want those lines not to count as record relations until I run previewed `Create Persistent Relation`.
12. As a founder opening a named group, I want in-wall navigation; a deleted or inaccessible target is explained without redirecting to another group, with a safe return to the full wall.
13. As a founder, I want multi-select, pan/zoom, fit, keyboard move, align/distribute, z-order, and group collapse.
14. As a founder, I want previewable reversible auto-layout on selected cards or groups; `Lock Position` keeps the item fixed in manual and auto layout without restricting source-record edit or lifecycle.
15. As a founder, I want spatial proximity, group membership, and visual line never to be a recorded relation by themselves.
16. As a founder, I do not want freehand sketch or Sketch cards on the wall; rough drawing stays on the Wireframe surface and can be added back as a Screen/source card.
17. As a founder, I want Presentation Mode to hide tools; optional focus order is view metadata, not a second file or content copy.
18. As a founder taking a selected group or region snapshot, I want dated PNG/PDF per the shared visual-region contract, with preview that the output is a frozen copy and does not widen share scope.
19. As a founder, I want that internal snapshot not to lock the wall or stop work, and not to be External Surface publish or Build in Public.
20. As a founder whose Project shell selected `Sitemap` or `Customer Journey`, I want those skeletons to live here as empty heading structure (`Primary Navigation` / `Secondary Navigation` / `Utility` / `External`; `Awareness` / `Consideration` / `Onboarding` / `Core Use` / `Retention`) and then behave as a normal Project Wall.
21. As a founder, I want those skeletons to create no sample records, cards, tasks, or decisions; catalog selection stays in the Project shell (07); the living empty wall is this feature.
22. As a founder, I want personal viewport center, zoom, and view-local collapse restored on this canvas; not content, share, export, or another user's view.
23. As a founder, I want `Fit View` to neutral; a meaningless saved position fits visible content; selection/inspector/unsaved ops are not restored.
24. As a founder, I want a structured outline that can create, select, reorder, group, bind, unbind, inspect, and open source records without a pointer.
25. As a founder, I want the hard scene of 500 visible items and 750 visual links to meet frame budget; 2,000 / 3,000 must not crash or corrupt.
26. As a founder, I want English UI `Project Wall`, `Compact`, `Preview`, `Detailed`, `Create Persistent Relation`, `Lock Position`, `Presentation Mode`, `Fit View`, `Open Source Record`, `Sitemap`, `Customer Journey`.
27. As a founder using only a keyboard or a screen reader, I want to complete **canvas yapılandırılmış outline** on this surface.
28. As a founder, I do not want wall position to be relation, status, or priority.
29. As a founder, I do not want the wall to be a Wireframe, Moodboard, or Wiki page.
30. As a founder, I do not want link-sharing or Build in Public implemented here (73/75), even though those features later snapshot this wall.

## Implementation Decisions

- **Owning documents.** [Proje Duvarı](../../prd/04-workspace-and-projects.md#proje-duvarı). Skeletons listed in [görüşlü başlangıç yapılandırmaları](../../prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları); 07 selects, this feature materializes empty walls. Viewport [kişisel çalışma konumu](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu). Snapshot [PRD 13](../../prd/13-data-security-and-portability.md#standart-biçimlerde-seçili-kayıt-dışa-aktarma) and closed-world rules [PRD 14](../../prd/14-sharing-and-public-publishing.md) for later sharing — this feature produces internal dated output only. Outline/perf [PRD 15](../../prd/15-product-quality.md). Tasarım type `Proje Duvarı` in PRD 02. React Flow is the relationship/flow canvas runtime; durable layout is the Tasarım record, not a public xyflow JSON contract. No new ADR.
- **Glossary.** Use Proje Duvarı, Başlangıç iskeleti, Akıllı Koleksiyon (read-only block), Teknik Diyagram (card preview only), Köken konumu (not written by moving a card). Do not introduce wall-only note, Sketch card, nested wall, or visual-line-as-relation.
- **Live cards.** Permanent items are live cards of existing masters. Same record may appear on many walls by reference. Layout, density, highlight, group, and lock are wall/view state. Source fields, planning, status, and relations change only through `Open Source Record` or explicit relation preview. Local visual marks are wall narrative marks, not File Attachments or Moodboard references.
- **Lines and lock.** Directed labeled visual links are not relations. `Create Persistent Relation` previews the catalog relation then writes it. `Lock Position` is view-local; it does not freeze the source record's lifecycle. Proximity and group membership are not relations.
- **Densities and groups.** Product-chosen fields per type at Compact/Preview/Detailed. Limited accessible highlight palette. Single-level groups, not taxonomy. Named groups navigate in-wall; missing targets explain and offer safe return.
- **Skeletons.** When the shell selected Sitemap or Customer Journey, this feature creates a normal Project Wall whose empty groups use exactly those English headings and no sample content. After creation it is an ordinary wall. Not a document skeleton, Moodboard template, or template marketplace. Persona/Retrospective/Launch Plan documents are not this feature.
- **Presentation and snapshot.** Presentation Mode hides tools; focus order is view metadata. Group/region snapshot: dated PNG/PDF, frozen copy, does not lock the wall, does not widen share scope, is not External Surface or Build in Public. Preview must name it a frozen copy.
- **Personal viewport, a11y, perf.** Viewport is this canvas only. Outline is a functional equivalent. Hard scene 500 visible items / 750 visual links: pass if pan/zoom p95 frame ≤ 16 ms and max frame ≤ 33 ms. 2,000 items / 3,000 links: pass if no crash, corruption, or data loss (warn/virtualize/reduce detail allowed). 500 is not a create cap. English labels as in stories; missing terms join the table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Project Wall through the public interface: live card identity equals source id, move does not write source, visual line does not create a relation, explicit relation preview does, skeletons are empty English headings, snapshot is frozen and not a share grant, viewport restore, outline tasks, 500/750. Not xyflow internals.
- **Seam (one).** Project Wall — the product-facing wall, card, line, skeleton, and internal snapshot interface.
- **Modules under test.** Project Wall only. Wireframe sketch, Moodboard, Wiki, link-sharing, Build in Public, Project shell catalog selection are counterparts.
- **Prior art.** Bind to [Proje Duvarı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and **canvas yapılandırılmış outline**; skeleton golden headings also support [Başlangıç iskeletleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) wall half.
- **Required counterparts.** Position is not relation/status/priority; card is not a copy record; snapshot does not grant share scope; freehand on wall absent; nested walls absent.

## Out of Scope

- Wireframe serbest çizim, Moodboard, Wiki sayfası, Belge iskeleti.
- Kabuktaki iskelet kataloğu seçimi (07); Persona/Retrospective/Launch Plan Belgeleri.
- Bağlantıyla paylaşım ve Build in Public (73/75).
- İç içe duvar, çalışma alanı duvarı, Sketch card, per-card CSS.

## Further Notes

- **Orient.** Glossary: Proje Duvarı, Başlangıç iskeleti. Owning PRD: `docs/prd/04-workspace-and-projects.md` (`#proje-duvarı`). ADRs: none. Related: PRD 04 viewport + skeleton table, PRD 13 snapshot, PRD 14 closed world for later share, PRD 15 outline/500/750, PRD 16 Proje Duvarı, PRD 19 no universal whiteboard.
- **Acceptance.** [Proje Duvarı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): live cards, relation counterpart, snapshot-vs-live, outline, closed-world share test is 73/75 using this wall's snapshot rules. Skeleton headings: [Başlangıç iskeletleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Consumers.** `07-project-shell` selects skeletons; `73-link-sharing` and `75-build-in-public` snapshot this wall later; `59-technical-diagrams` provides the read-only diagram card.
