# Ekranlar ve Wireframe Yüzeyi

Kaynak: [`docs/workflow/48-screens-and-wireframes/phase-context.md`](../../workflow/48-screens-and-wireframes/phase-context.md)

## Problem Statement

Kurucu bir ürün ekranını akışlar, arama ve yaşam döngüsünde görsel tasarımından bağımsız tutmak ve o ekranın düşük sadakatli düzenini sürümlü yüzey olarak çizmek ister. Bugün Ekran ile Wireframe aynı kayda sıkışır veya Wireframe bağımsız yaşam kazanır; tuval çıktısı kanonik belge sanılır; öğeden kayıt dönüşümü kökeni kaybettirir; viewport paylaşım veya ilişki sanılır. Kullanıcı Akışı 49'dadır. Moodboard ve Teknik Diyagram burada yoktur. Figma senkronu ve production UI kiti ilk ürünün parçası değildir.

## Solution

Kurucu Ekranı Proje kapsamında bağımsız ana kayıt olarak tutar; yalnız başlıkla, henüz görsel tasarım olmadan oluşturabilir. Wireframe o kaydın düşük sadakatli sürümlü yüzeyidir; bağımsız ana kayıt veya ayrı arşiv/silme yaşamı kazanmaz. Canonical `WireframeDocument` ürün motorunda yaşar; Konva JSON'u kalıcı format değildir. Kesin sürüm araçsız Presentation Mode'da sunulur ve PNG/SVG/PDF/tek dosyalı HTML olarak üretilir. `Convert and Bind` önizlemeyle tam olarak bir İş, Karar, Risk veya Açık Soru açar; Ekran üretmez. Köken `Kökeni` + değişmez Origin Location'dır, yeni kullanım bağı türü değildir. Bu tuvaldeki kişisel viewport oturumlar arasında kalır; içerik semantiği, paylaşım veya kayıt ilişkisi değildir.

## User Stories

1. As a founder, I want a Screen as a Project-scoped master record with its own identity, history, relations, and lifecycle, so that a product screen exists before any drawing.
2. As a founder, I want to create a Screen with only a title and no visual design, so that I can name destinations from a User Flow before laying them out.
3. As a founder, I want Wireframe to be that Screen's low-fidelity versioned surface, so that I do not get a second master record or a second archive/trash life.
4. As a founder archiving, trashing, or restoring a Screen, I want exact Wireframe versions to stay historically attached, so that design history does not fork off the Screen.
5. As a founder, I want the durable truth to be a versioned `WireframeDocument`, so that renderer JSON cannot become the document.
6. As a founder placing semantic components (Button, Input, Card, Table, Navigation, Chart), I want meaning kept apart from the hand-drawn stroke, so that hit-testing and export stay on canonical geometry.
7. As a founder using project-scoped linked blocks for repeating header or navigation, I want affected Screens previewed before a source-block change applies, so that I see blast radius.
8. As a founder, I want `Detach Link` to freeze that instance into an independent block at the current content, so that one Screen can leave the shared definition.
9. As a founder, I want a text block to hold placeholder copy or a live Markdown section reference, so that copy has one source when I choose a live bind.
10. As a founder, I want a broken live text reference to show as broken rather than empty, so that a deleted section cannot silently vanish.
11. As a founder saving a design version, I want the then-visible text kept as readable historical context plus a path to the current live source, so that a version is not a live alias.
12. As a founder prototyping show/hide, timed two-state transition, hover/press, sequential steps, and Screen-to-Screen transition from a closed duration set, I want clickable in-app preview, so that low-fi behavior is testable without a timeline editor.
13. As a founder, I do not want keyframe, custom easing, physics, scroll-linked, multi-layer choreography, or video/GIF export, so that the engine stays a low-fi surface.
14. As a founder, I want Presentation Mode to hide editor tools and follow links from a chosen start Screen as a full-screen read-only prototype, so that presenting is not editing.
15. As a founder exporting PNG/SVG of a selection or Screen, and PDF or single-file interactive HTML of chosen Screens and supported links, I want output from exact Wireframe versions, so that export is not a new source of truth.
16. As a founder opening that HTML file, I want all styles, fonts, and assets inlined, no network, no product URL, no analytics, and unresolved targets shown as unresolved, so that the file is offline and honest.
17. As a founder, I want Presentation Mode and export never to retarget a broken link to another Screen, so that a missing destination stays missing.
18. As a founder, I want `Convert and Bind` from a block on an exact Wireframe version to preview exactly one Work, Decision, Risk, or Open Question plus `Kökeni` and immutable `Origin Location`, so that a record is not born until I confirm.
19. As a founder after convert, I want the source block to stay put, not become a relation endpoint, and not change appearance, so that converting is not emptying the canvas.
20. As a founder who deletes or redacts that source block, I want the created record to remain, `Kökeni` to the owning Screen to survive, and Origin Location to read `Kaynak öğe artık yok` without retargeting, so that deleting a rectangle cannot destroy Work.
21. As a founder, I want a later Wireframe version not to silently move that bind; old origin stays readable and rebind needs preview, so that provenance is version-exact.
22. As a founder, I want my last personal viewport center, zoom, and view-local collapsed groups on this canvas restored across sessions, so that I return to my working position.
23. As a founder, I want those viewport values not to be content, search, share snapshot, export input, or another person's view, so that navigation is not a relation.
24. As a founder, I want `Fit View` to return to a neutral view, and a meaningless saved position to fit visible content, so that I never land in an empty hole.
25. As a founder, I do not want selection, open inspector, edit mode, hover, or unsaved ops restored, so that viewport restore stays the narrow PRD 04 contract.
26. As a founder, I want a structured outline that can create, select, reorder, group, bind, unbind, inspect, and open source records without a pointer gesture, so that the closed a11y journey `canvas yapılandırılmış outline` works on this surface.
27. As a founder, I want the hard performance scene of 500 visible items and 750 visual links to hold frame budget, so that the engine is a product surface rather than a demo.
28. As a founder saving a custom template of an exact Wireframe version, I want structure and linked-block definitions without the source Project's Work, Decision, or history, and the produced Screen not live-bound to the source Project, so that a template is a stamp.
29. As a founder placing a read-only live Work/Decision/Risk card on the Wireframe, I want moving it not to write the source record, so that the canvas is not a planning board.
30. As a founder, I want English UI `Screen`, `Wireframe`, `Presentation Mode`, `Convert and Bind`, `Detach Link`, `Fit View`, and `Open Source Record`.
31. As a founder, I do not want this feature to host User Flow, Moodboard, Technical Sequence, Figma sync, production components, or design tokens.
32. As a founder using `Convert and Bind` on a Wireframe block, I do not want that action to mint a Screen, so that Screen identity stays title-only create or User Flow node promotion rather than a converted rectangle.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Ekranlar ve Wireframe yüzeyi](../../prd/09-discovery-decisions-and-design.md#wireframeler). Screen vs Wireframe split is [ADR-0016](../../adr/0016-ekrani-ana-kayit-wireframei-surumlu-yuzey-olarak-tut.md). Engine is [ADR-0022](../../adr/0022-wireframe-motorunu-kendimiz-yaz.md) and [tech-stack Wireframe boundary](../../tech-stack.md). Viewport is [kişisel çalışma konumu](../../prd/04-workspace-and-projects.md#büyük-canvaslarda-kişisel-çalışma-konumu). Origin Location is [Köken konumu](../../prd/02-domain-model-and-lifecycle.md#koken-konumu). Outline and 500/750 scene are [PRD 15](../../prd/15-product-quality.md). Sharing visitor access is 73, not this feature. No new ADR.
- **Glossary.** Use Ekran, Wireframe yüzeyi, Köken konumu, Kullanıcı Akışı (out of this feature), Tasarım (Wall/User Flow/Moodboard — not this Screen). Do not introduce Wireframe master record, Screen component as a record, flow node as a Screen copy, Figma document, or production design token.
- **Screen master.** Screen is Project-scoped. Title-only create is allowed. Archive/trash/restore follow common master-record rules. Exact Wireframe versions remain attached. A deleted Screen is a broken target on other surfaces (49), not a silent retarget. This feature does not host the User Flow editor.
- **Engine.** Persistent truth is versioned, migration-capable `WireframeDocument` validated with Zod. `Konva.Stage.toJSON()` is not a durable format. React hosts chrome, toolbar, inspector, layers, and the accessible outline. Pointer-move / drag / frame loop must not bind to canonical React state; completed gestures become engine commands/transactions. Canvas text uses a transient DOM overlay then a command; Tiptap is not a second text model. Semantic components live in the engine (project-scoped master definition, live instance, affected-screen preview, explicit detach). Rough.js draws only; hit-test, selection, snap, resize, constraints use stable canonical geometry and a fixed seed per item. Shantell Sans is canvas/export typography, not product UI. Lucide is the semantic-component icon source. Do not add Excalidraw, tldraw, Fabric, or Pixi.
- **Linked blocks.** Project-scoped low-fi linked blocks share one source definition. Applying a source change previews affected Screens. `Detach Link` copies current content into an independent block. This is not a production component, token, or cross-project live library.
- **Live text.** Placeholder or live Markdown section reference. Broken source shows broken. Saved version keeps then-visible text plus a path to current live source.
- **Closed animation set.** Show/hide, fixed-duration two-state, hover/press, sequential steps, Screen-to-Screen. Duration from a closed product set. No timeline, keyframe, custom easing, physics, scroll-linked, multi-layer, or video/GIF.
- **Presentation and export.** Presentation Mode is full-screen read-only prototype navigation from a start Screen; it is not an export format. PNG/SVG for selection or Screen; PDF and single-file interactive HTML for chosen Screens and supported links, all from exact versions. HTML is self-contained, offline, no product URLs, no analytics, no write-back; missing targets stay unresolved; a human-readable manifest lists Screen and Wireframe versions and is deterministic. Export does not overwrite the live document. No desktop/mobile variant management.
- **Convert and Bind.** Common action from a block on an exact Wireframe version. Preview: target type (Work, Decision, Risk, Open Question — not a Screen; Screen create stays title-only or 49 promotion), Project, title/body map, `Kökeni`, immutable Origin Location (owning Screen id, block id, exact Wireframe version). Confirm creates exactly one record; the source block stays put, does not become a relation endpoint, and does not change appearance — converting does not empty the canvas. No AI; no multi-create. Deleting, redacting, or unresolving the source block does not delete the created record: `Kökeni` to the owning Screen survives, Origin Location reads `Kaynak öğe artık yok`, and the product does not retarget another block. This is `Kökeni` + Origin Location from PRD 02, not a new kullanım bağı type (12 owns that closed list; flow-node → Screen is 49). New Wireframe version does not silently move the bind. Read-only live Work/Decision/Risk cards may sit on the canvas; moving them does not write source fields. This action does not add Project Wall sticky notes.
- **Templates.** Exact Wireframe version may be stored as a custom template usable across Projects: structure, placeholders, linked-block definitions. No source Project Work/Decision/Risk/relations/publish/history. Instantiating creates a new Screen in the target Project with no live bind to the source Project.
- **Personal viewport.** Persist center, zoom, view-local collapse on this Screen's Wireframe canvas. Not content, search, share, export, or another user's view. `Fit View` neutrals. Meaningless position fits visible content. Do not restore selection, inspector, edit mode, multi-select, hover, or unsaved ops.
- **A11y and perf.** Structured outline is a functional equivalent, not a read-only backup. Keyboard pan/zoom/select/move/align. Hard scene 500 visible / 750 links; 2,000 / 3,000 must not crash or corrupt. English UI as in stories; missing labels join the term table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Screens and Wireframes through the public interface: title-only Screen create, versioned document round-trip (not Konva JSON), archive keeping versions, Presentation Mode/export from exact version, convert preview + Origin Location, convert does not mint a Screen, convert does not empty the canvas, deleting the source block does not delete the created record, viewport restore, outline tasks, broken live text. Expected values are product rules (Screen identity ≠ file, export not a new source, bind does not empty canvas).
- **Seam (one).** Screens and Wireframes — the product-facing Screen + versioned WireframeDocument interface. Konva/Rough.js are adapters behind it.
- **Modules under test.** Screens and Wireframes only. User Flow, Moodboard, Project Wall, Figma, sharing links are counterparts.
- **Prior art.** Single-seam contracts plus Playwright canvas outline. Bind to [Tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and closed a11y journey **canvas yapılandırılmış outline**. Cloud tests must not use production design files.
- **Required counterparts.** Konva JSON rejected as persist format; User Flow editor absent here; convert without preview creates nothing; convert does not mint a Screen (target set is Work, Decision, Risk, Open Question only; Screen create stays title-only or 49 promotion); convert does not empty the canvas; deleting the source block does not delete the created record; viewport not written into share snapshot; silent retarget of broken links absent.

## Out of Scope

- Kullanıcı Akışı editörü, Moodboard, Teknik Sıra, Proje Duvarı whiteboard.
- `Convert and Bind` ile Ekran üretme; Ekran oluşturma başlıkla veya Kullanıcı Akışı yükseltmesi (49) kalır.
- Figma veya yüksek detaylı aktarım; production component/token; pixel-perfect UI.
- Desktop/mobile varyant yönetimi; AI Wireframe üretimi; gerçek servise bağlı prototip.
- Paylaşım bağlantısı ve Dış yüzey (73/75); ziyaretçi oturumu.
- Tiptap'i Wireframe metin modeli yapmak; Excalidraw/tldraw.

## Further Notes

- **Orient.** Glossary: Ekran, Wireframe yüzeyi, Köken konumu. Owning PRD: `docs/prd/09-discovery-decisions-and-design.md` (`#wireframeler`). ADRs: 0016, 0022. Related: PRD 04 viewport, PRD 02 Origin Location, PRD 15 outline/perf, PRD 16 Tasarım bağlamı, PRD 19 no Figma/universal canvas.
- **Acceptance.** [Tasarım bağlamı](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): Screen stays independent; canvas presentation does not write source records; exact Wireframe version binds hold. Outline + 500/750 on this canvas. Sharing journeys stay 73/75.
- **Consumers.** `49-user-flow` live-refs Screens; `50-moodboards` is a different canvas; `51-project-wall` may show Screen cards; `73-link-sharing` may share a Screen snapshot later.
