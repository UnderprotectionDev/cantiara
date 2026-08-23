# Teknik Diyagramlar

Kaynak: [`docs/workflow/59-technical-diagrams/phase-context.md`](../../workflow/59-technical-diagrams/phase-context.md)

## Problem Statement

Kurucu Teknik Mimari, Veri Modeli ve Teknik Sıra Diyagramlarını proje kayıtlarıyla aynı doğruluk kaynağında, değişmez otorite kipi ve kesin sürümlerle yönetmek ister. Bugün diyagram ya Belge içi Mermaid bloğu olarak kimliksiz yaşar ya da dış dosyayla ikinci canlı kaynak olur. Görünüm kanonik model sanılır; Mermaid dönüşümü bloğu siler veya round-trip kurar; viewport paylaşım veya içerik sayılır. Şema SQL'i ve Wireframe bu sorunun parçası değildir.

## Solution

Kurucu Proje ana kaydı Teknik Diyagramı üç türde oluşturur. Her kimlik tam olarak bir Diyagram otorite kipi taşır ve kip kimlik boyunca değişmez: `Product-authored Model`, `Imported Independent Copy`, `External Source Link`; `Repository-derived View` ilk üründe oluşturulamaz. Kanonik içerik veritabanındaki türlenmiş yapısal modeldir (ADR-0021, ADR-0020). Diyagram Görünümü kopyasız sunumdur; Diyagram Sürümü değişmez checkpoint'tir. Canlı kart Belge ve Proje Duvarında kaynağı kopyalamadan gösterir. Kesin Mermaid bloğu kayıp ve otorite etkisi önizlendikten sonra atomik olarak yeni `Imported Independent Copy` Teknik Diyagrama dönüşür; kaynak blok silinmez ve round-trip yoktur. Kişisel viewport, zoom ve görünüm-yerel daraltma oturumlar arasında bu yüzeyde kalır; `Fit view` nötr görünüme döner.

## User Stories

1. As a founder, I want to create a Proje-scoped Teknik Diyagram of type `Technical Architecture`, `Data Model`, or `Technical Sequence`, so that generic flowcharts stay in-document Mermaid.
2. As a founder, I want each diagram identity to carry exactly one `Diagram Authority Mode` that cannot change in place, so that origin is a classification, not a file format or share mode.
3. As a founder, I want first-product creatable modes to be `Product-authored Model`, `Imported Independent Copy` (via explicit convert), and `External Source Link`, so that `Repository-derived View` cannot be minted here.
4. As a founder switching authority, I want a new identity plus two-way origin after preview of source mode, target mode, loss, and history effect, so that the same row is never reclassified.
5. As a founder, I want snapshot, export, and Diyagram Sürümü not to mint a new authority mode, so that a PNG is not a new origin.
6. As a founder on a product-authored or imported diagram, I want typed nodes, fields, links, and semantic constraints in the database to be the only canonical content, so that Mermaid/SQL/DBML cannot be a second live source.
7. As a founder on `External Source Link`, I want an exact HTTPS URL, optional known external revision/`updated-at`, source tool, last check time, and Proje relations, so that the product does not iframe, cache, or grant edit on the external tool.
8. As a founder drawing Technical Architecture, I want the closed catalog of `Component`, `Service`, `Datastore`, `Queue/Event Bus`, `External System`, and `Boundary` with typed links, so that arbitrary shapes do not carry product semantics.
9. As a founder drawing a Data Model Diagram, I want PostgreSQL entities, fields, keys, and relations as a designed schema inside the product, so that the canvas is not bound to a live database and is not an ORM/Prisma sync.
10. As a founder, I want modeling to stay on this Data Model Diagram, so that Schema Artifacts (60) only generate SQL from a pinned Diyagram Sürümü.
11. As a founder drawing Technical Sequence, I want canonical steps and participants (lifelines, sync/async/event/return messages, and limited control groups) in the structural model, so that the sequence is a design model — not a User Flow, Work-status transition, log, runtime trace, or Üretim Olayı timeline.
12. As a founder, I want a Sequence lifeline to optionally reference an exact Architecture node and Diyagram Sürümü without silently retargeting when the source moves, so that the bind stays exact.
13. As a founder, I want named Diyagram Görünümü records that select elements and layout without copying source elements, so that a view is not a sub-diagram or permission.
14. As a founder, I want a named immutable Diyagram Sürümü checkpoint I can bind to Karar, İş, Proje Sürümü, evidence, share, or export, so that live editing is not the evidence pin.
15. As a founder restoring an old version, I want restore to create a new live revision rather than rewrite the checkpoint, so that history stays append-only.
16. As a founder, I want a live read-only card of a diagram or selected view on a Belge and Proje Duvarı, so that the card is a use-bind, not a second diagram or Mermaid embed.
17. As a founder, I want that card to open the source and not change authority mode, so that composition is not ownership.
18. As a founder needing a historical narrative, I want the card to pin an exact Diyagram Sürümü with a visible live-versus-exact label, so that the two presentations are never named the same.
19. As a founder with a fenced Mermaid block in a Belge, I want `Convert to Technical Diagram` to preview source Belge/version, block location, target type, unparsable or lost lines, origin relation, and whether the original block stays independent content, so that I see loss and authority effect before commit.
20. As a founder confirming convert, I want one atomic mutation that creates a new `Imported Independent Copy`, origin links, and the chosen block outcome, so that failure leaves no partial record and a safe retry does not mint a second diagram.
21. As a founder, I want the source block to remain independent content unless I explicitly chose in that preview to replace it with a live Technical Diagram reference, and never to become a live round-trip source, so that Belge and diagram stay separate authorities.
22. As a founder, I want my last personal viewport center, zoom, and view-local collapsed groups restored across sessions on this surface, so that those values are not content, search fields, share snapshots, or another user's view.
23. As a founder, I want `Fit view` to return a neutral view, and a deleted or meaningless location to fit visible content, so that I never land in an empty region.
24. As a founder, I want to place existing İş, Karar, Risk, or Açık Soru as read-only live cards on the canvas without moving them changing the source, and to convert a local node via previewed `Convert to record and link`.
25. As a founder using only a keyboard or a screen reader, I want structured outline, view, version, and Mermaid convert, so that the closed journeys “Mermaid'den Teknik Diyagram dönüşümü” and “Teknik Diyagram yapılandırılmış outline'ı, Diyagram Görünümü ve Diyagram Sürümü” are possible.
26. As a founder, I want English UI labels for types, authority modes, `Convert to Technical Diagram`, `Diagram Version`, `Fit view`, so that product language stays English.
27. As a founder, I do not want BPMN, org chart, mind map, Gantt, git graph, infographic, or a universal whiteboard, so that the catalog stays three specialist types.
28. As a founder, I do not want this feature to emit PostgreSQL DDL or a Migration Artifact, so that Schema SQL stays 60.

## Implementation Decisions

- **Owning documents.** [Teknik Diyagramlar](../../prd/11-technical-diagrams-and-schema-artifacts.md#teknik-diyagramlar), [Teknik mimari ve Teknik Sıra](../../prd/11-technical-diagrams-and-schema-artifacts.md#teknik-mimari-ve-sira), Mermaid convert in [Belge içi Mermaid sahipliği](../../prd/07-documents-and-knowledge.md#uygulama-içi-markdown-belge-yönetimi), personal viewport in [PRD 04](../../prd/04-workspace-and-projects.md). Identity/modes: [PRD 02 terim sözlüğü](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) and [ADR-0020](../../adr/0020-semayi-urun-icinde-tasarlayip-dogrulanmis-ddl-uret.md), [ADR-0021](../../adr/0021-icerigi-yalniz-veritabaninda-tut.md). External URL preview isolation: ADR-0008. No new ADR.
- **Glossary.** Teknik Diyagram, Diyagram otorite kipi, Üründe yazılmış model, Repository’den türetilmiş görünüm, İçe aktarılmış bağımsız kopya, Dış kaynak bağlantısı, Teknik Mimari Diyagramı, Veri Modeli Diyagramı, Tasarlanan şema, Teknik Sıra Diyagramı, Diyagram Görünümü, Şema Görünümü, Teknik Diyagram yapısal modeli, Diyagram Sürümü, Belge içi Mermaid diyagramı. Avoid: Mermaid as the record, general canvas, live round-trip, view as canonical model, Schema SQL as this feature.
- **One seam.** Technical Diagrams — create/edit three types, authority (including refused Repository-derived mint), views vs versions, live cards, Mermaid convert, personal viewport. Schema Artifacts (60) consume a pinned Data Model Diyagram Sürümü; they do not model here. Wireframe/User Flow/Moodboard/Project Wall share canvas mechanics but keep their own object languages.
- **Four modes, immutable per identity.** Closed catalog: `Product-authored Model`, `Repository-derived View`, `Imported Independent Copy`, `External Source Link`. First product cannot create `Repository-derived View` (18 Repository schema). In-place reclassify is forbidden; open convert mints a new Teknik Diyagram plus `Originates from` / `Derived from`. Snapshot/export/version do not change mode.
- **Canonical model.** Product-authored and imported: typed structural model in PostgreSQL only (React Flow is view). Coordinates/collapse/focus live on Diyagram Görünümü metadata. Data Model is designed schema: tables, columns, PostgreSQL types, keys, nullability, unique, default, index, cardinality, referential actions — not live DB, not Prisma file sync. Architecture uses the PRD 11 closed object catalog (`Component`, `Service`, `Datastore`, `Queue/Event Bus`, `External System`, `Boundary` and typed links). Architecture nodes are not a shared service catalog or CMDB master record. Technical Sequence stores steps and participants as that canonical model (lifelines, sync/async/event/return messages, limited control groups); it is one of the three specialist types, not a User Flow, Work-status transition, log, runtime trace, or Üretim Olayı timeline.
- **Mermaid convert.** Uses Tiptap/Mermaid.js as parse input only. Atomic commit (ADR-0004): new Imported Independent Copy + origin + chosen block outcome, or full rollback. Preview includes whether the original block stays independent Mermaid or becomes a live Technical Diagram reference (the 04 card). Independent leftover Mermaid is not a live sync. Live reference is composition, not a second canonical source.
- **Personal viewport.** Account-scoped last center/zoom/view-local collapse on this surface; not content, share, or another user. `Fit view` is the escape hatch.
- **English UI.** `Technical Diagram`, `Technical Architecture`, `Data Model`, `Technical Sequence`, `Diagram Authority Mode`, `Product-authored Model`, `Repository-derived View`, `Imported Independent Copy`, `External Source Link`, `Diagram View`, `Diagram Version`, `Convert to Technical Diagram`, `Fit view`, `Convert to record and link`. Add missing labels with first display.
- **Stack.** React Flow (xyflow) for the canvas; Mermaid.js for in-document render and convert parse; content stored only in the database. No diagram-as-code folder.

## Testing Decisions

- **What a good test is.** Public Technical Diagrams commands: create three types, refuse Repository-derived mint, refuse in-place mode change, view vs version pin, restore writes a new live revision, live card does not copy, Mermaid convert atomicity/retry, viewport restore and Fit view. Golden structural models, not screenshot pixels.
- **Seam (one).** Technical Diagrams. Playwright journeys: Mermaid convert; structured outline / view / version.
- **Required counterparts.** Round-trip sync absent; SQL not emitted; Wireframe object language not reused as architecture semantics; four-mode matrix including invalid first-product create; Sequence is not User Flow, Work-status, log/trace, or incident timeline.

## Out of Scope

- PostgreSQL DDL, disposable Neon apply, Migration Artefaktı — 60.
- Wireframe, Kullanıcı Akışı, Moodboard, genel whiteboard.
- Teknik Sırayı İş durumu geçişi, log izleme, runtime trace veya Üretim Olayı zaman çizelgesi sayma.
- Repository şeması / `Repository-derived View` üretimi — 18.
- DDL/DBML import, Draw.io/Visio native import, AI rekonstrüksiyon — 19.
- Diagram-as-code klasörü, VS Code senkronu — ADR-0021.
- Paylaşım snapshot güvenlik motoru — 14; bu feature yalnız exact sürüm/görünüm/köken pin'ini sağlar.

## Further Notes

- **Orient.** Glossary: Teknik Diyagram, dört otorite kipi, Diyagram Görünümü, Diyagram Sürümü. Owning PRD: `docs/prd/11-technical-diagrams-and-schema-artifacts.md` `#teknik-diyagramlar` + mimari/sıra; Mermaid convert PRD 07. ADRs: 0020, 0021, 0004 (atomik dönüşüm), 0008 (dış URL). Related: PRD 16 journey **Teknik Diyagram ve şema** (diagram half), PRD 19 (katalog ve round-trip yasağı).
- **Acceptance.** Bind to [Teknik Diyagram ve şema](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) diagram half and accessibility journeys **Mermaid'den Teknik Diyagram dönüşümü** and **Teknik Diyagram yapılandırılmış outline'ı, Diyagram Görünümü ve Diyagram Sürümü**. DDL/migration half is 60.
- **Consumers.** 60 reads pinned Data Model Diyagram Sürümü. 51/31 embed live cards. 14 shares exact version/view or external-origin snapshot.
