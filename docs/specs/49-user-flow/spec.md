# Kullanıcı Akışı

Kaynak: [`docs/workflow/49-user-flow/phase-context.md`](../../workflow/49-user-flow/phase-context.md)

## Problem Statement

Kurucu kuşbakışı deneyim adımlarını canlı Ekran kayıtlarına bağlanan düşük detaylı yol olarak tutmak ister. Bugün düğüm kopya Ekran üretebilir, kırık hedef sessizce başka Ekrana kayabilir, semantik öğe kümesi şekle yüklenebilir, şablon kaynak projeye canlı bağlanabilir. Teknik Sıra 59'dadır. Wireframe belgesi 48'dedir. Moodboard ve Proje Duvarı akış değildir.

## Solution

Kurucu Kullanıcı Akışını Proje kapsamlı tasarım ana kaydı olarak yönetir. Düğüm aynı Ekran kimliğine canlı kullanım bağı verir; kopya Ekran üretmez ve `Kökeni` değildir. Arşivli Ekran `Archived` ile açılır; Çöp Kutusu, kalıcı silme veya erişilemezlikte kırık hedef içerik sızdırmadan gösterilir ve başka Ekrana bağlanmaz. Semantik küme `Screen`, `Action`, `Decision`, `State/Outcome`, `Section` ile kapalıdır. `Convert and Bind` yalnız önizleme ve onayla bir İş, Karar, Risk veya Açık Soru açar; Ekran üretmez. Düşük detaylı adımı Ekrana yükseltmek ayrı eylemdir ve canlı referans verir. Şablon kaynak projeyle canlı bağ kurmaz. Bu tuvaldeki kişisel viewport oturumlar arasında kalır; içerik semantiği, paylaşım veya kayıt ilişkisi değildir.

## User Stories

1. As a founder, I want a User Flow as a Project design master record (Tasarım type `User Flow`), so that the path is not a Wireframe document or a Technical Sequence.
2. As a founder placing a node that represents a Screen, I want a live reference to that Screen, so that the node is not an independent Screen copy.
3. As a founder, I want the node to show a small preview of the chosen current Wireframe version when one exists, and one action to open that Screen's Wireframe editor, so that flow and layout stay linked without merging editors.
4. As a founder, I want flow-specific description, transition, condition, and decision text to stay on the node, so that path logic is not written onto the Screen record.
5. As a founder when the source Screen is archived, I want the node to keep showing `Archived` and still open the source, so that archive is not a silent unlink.
6. As a founder when the Screen is in trash, permanently deleted, or inaccessible, I want a broken/unresolved target with no content leak, so that the node does not empty or retarget.
7. As a founder, I want only the closed semantic set `Screen`, `Action`, `Decision`, `State/Outcome`, and `Section`, so that arbitrary shapes cannot become product meaning.
8. As a founder, I want text and limited accessible visual style, not product semantics loaded onto color or custom shape.
9. As a founder, I want multi-select, pan, zoom, fit view/selection, align, z-order, grid, copy/paste, keyboard alternatives, and safe undo as this expert editor's shared acceptance behavior.
10. As a founder turning a low-detail step into a more detailed Screen, I want a live Screen reference rather than a copied Screen, so that promotion is not duplication.
11. As a founder using `Convert and Bind` on a node, I want a preview of exactly one Work, Decision, Risk, or Open Question, target Project, title/body map, `Kökeni`, and Origin Location (owning User Flow id, node id, exact flow version), so that a record is not born until I confirm.
12. As a founder after convert, I want the node to remain, not become a relation endpoint, and not change semantics, so that converting is not deleting the path.
13. As a founder, I want a later flow version not to silently move that bind; rebind needs preview.
14. As a founder saving a User Flow structure as a custom template usable across Projects, I want structure and placeholders without the source Project's Work, Decision, Risk, relations, publish state, or working history, so that a template is a stamp.
15. As a founder instantiating that template, I want the new flow in the target Project with no live bind to the source Project.
16. As a founder placing a read-only live Work/Decision/Risk card on the flow, I want moving or removing it not to write the source record.
17. As a founder, I want Decision, Risk, and Open Question binds to an exact node version to stay on that version when a new flow version is saved, with an explicit rebind preview.
18. As a founder, I want personal viewport center, zoom, and view-local collapse restored on this canvas, not as content, share, export, or another user's view.
19. As a founder, I want `Fit View` to neutral, and a meaningless saved position to fit visible content.
20. As a founder, I do not want selection, inspector, edit mode, or unsaved ops restored.
21. As a founder, I want a structured outline that can create, select, reorder, group, bind, unbind, inspect, and open source records without a pointer.
22. As a founder, I want the 500 visible / 750 link hard performance scene, so that a real path stays interactive.
23. As a founder, I want broken targets excluded from search hits, Smart Collection membership, computed counts, and export content, so that a missing Screen cannot leak.
24. As a founder, I want English UI `User Flow`, `Screen`, `Action`, `Decision`, `State/Outcome`, `Section`, `Convert and Bind`, `Fit View`, `Open Source Record`, `Archived`.
25. As a founder using only a keyboard or a screen reader, I want to complete the closed journey **canvas yapılandırılmış outline** on this surface.
26. As a founder, I do not want this feature to be a Technical Sequence, state machine, Wireframe document, Moodboard, or Project Wall.
27. As a founder, I do not want sharing links or External Surfaces built here (73/75).
28. As a founder, I do not want AI-generated flows in the first product.
29. As a founder using `Convert and Bind` on a flow node, I do not want that action to mint a Screen, so that creating or linking a Screen stays a separate promotion with a live reference.

## Implementation Decisions

- **Owning documents.** Same [wireframes section](../../prd/09-discovery-decisions-and-design.md#wireframeler) as Screens; this feature owns the User Flow editor half. Tasarım type is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Live Screen ref is a [kullanım bağı](../../prd/02-domain-model-and-lifecycle.md#kullanim-baglari) (flow node → Screen). Broken-target rules are [kırık referans sunumu](../../prd/02-domain-model-and-lifecycle.md#kirik-referans-sunumu). Viewport [PRD 04](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu). Outline/perf [PRD 15](../../prd/15-product-quality.md). Technical Sequence is PRD 11 / workflow 59. React Flow (xyflow) is the flow canvas runtime (tech stack); it must not become a second document model or a WireframeDocument. No new ADR.
- **Glossary.** Use Kullanıcı Akışı, Ekran, Wireframe yüzeyi (open, do not own), Köken konumu, Teknik Sıra Diyagramı (forbidden substitute). Do not introduce flowchart-as-product, state machine, Screen copy-per-node, or live template bind.
- **Live Screen refs.** A node that represents a Screen points at the Screen id. Optional preview of a chosen current Wireframe version. One action opens that Screen's Wireframe editor (48). Node-local path text stays on the node. Archived Screen: show `Archived`, still open. Trash / permanent delete / inaccessible: common broken-target presentation, no body leak, no silent bind to another Screen. Restoring the Screen resolves the same id.
- **Closed semantic set.** `Screen`, `Action`, `Decision`, `State/Outcome`, `Section` only. Text and limited accessible style. Color/shape are not a second type system.
- **Editor commons.** Multi-select, pan/zoom, fit view/selection, align, z-order, grid, copy/paste, keyboard, safe undo. React Flow is the adapter; durable model is the Tasarım record's versioned flow document in the database, not xyflow JSON as a public contract.
- **Convert and Bind.** Preview exactly one Work, Decision, Risk, or Open Question; Origin Location = owning User Flow id, node id, exact flow version. Confirm creates one record; node stays. No AI, no multi-create. New version does not silently move the bind. Promoting a low-detail step to a Screen creates or links a Screen master and live-refs it; it does not copy a Screen.
- **Templates.** Save selected User Flow structure as a custom cross-Project template: structure and placeholders only. Instantiation creates a new User Flow in the target Project with no live bind to the source Project, its Work, or its Screens unless the founder explicitly re-links Screens in the target.
- **Live cards.** Read-only Work/Decision/Risk cards; move/remove does not write source. Binds to exact node version stay on that version.
- **Personal viewport, a11y, perf.** Same PRD 04 / 15 contract as other canvases, scoped to this User Flow surface. English labels as in stories; add missing terms in the same change. Tech stack: React Flow, not the Wireframe engine and not a universal whiteboard.

## Testing Decisions

- **What a good test is.** Tests observe User Flow through the public interface: node live-refs Screen id, archive/broken/trash counterparts, closed semantic set rejection, convert preview + Origin Location, template has no live source-Project bind, viewport restore, outline tasks, 500/750 scene. Not xyflow internals.
- **Seam (one).** User Flow — the product-facing flow record and node-to-Screen interface. React Flow is an adapter.
- **Modules under test.** User Flow only. Screen/Wireframe editor, Technical Sequence, Moodboard, Project Wall, sharing are counterparts.
- **Prior art.** Bind to [Kullanıcı Akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and **canvas yapılandırılmış outline**.
- **Required counterparts.** Node does not create a Screen copy; node→Screen is a kullanım bağı not `Kökeni`; broken target does not retarget and leaks no body; extra semantic types rejected; `Convert and Bind` does not mint a Screen (promotion is a separate live-ref action); template live-bind absent; Technical Sequence types absent; Moodboard or Project Wall is not this surface.

## Out of Scope

- Ekran Wireframe motoru, Moodboard, Proje Duvarı, Teknik Sıra Diyagramı.
- `Convert and Bind` ile Ekran üretme; Ekran yükseltmesi ayrı canlı referans eylemidir.
- Durum makinesi, BPMN, serbest flowchart semantiği.
- Şablonun kaynak projeye canlı bağlanması; AI akış üretimi.
- Paylaşım ve Dış yüzey (73/75).

## Further Notes

- **Orient.** Glossary: Kullanıcı Akışı, Ekran, Köken konumu, Teknik Sıra Diyagramı (avoid). Owning PRD: `docs/prd/09-discovery-decisions-and-design.md` (`#wireframeler`, User Flow editor). ADRs: none new (0016 is Screen/Wireframe; this feature consumes Screen ids). Related: PRD 04 viewport, PRD 15, PRD 16 Kullanıcı Akışı, PRD 11/19 Technical Sequence out.
- **Acceptance.** [Kullanıcı Akışı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): live refs, broken/archive matrix, convert preview E2E, outline, canvas perf.
- **Consumers.** `48-screens-and-wireframes` owns Screen/Wireframe; `59-technical-diagrams` must not be this editor; `51-project-wall` is spatial narrative, not a path.
