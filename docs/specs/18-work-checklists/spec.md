# Hafif İş Kontrol Listeleri

Kaynak: [`docs/workflow/18-work-checklists/phase-context.md`](../../workflow/18-work-checklists/phase-context.md)

## Problem Statement

Kurucu bir İşe ait küçük adımları ana kayıt kalabalığı üretmeden yönetmek ve gerektiğinde bir maddeyi kökeni korunan tam İşe dönüştürmek ister. Maddenin gizlice İş olması, alt görev hiyerarşisi, epic ağacı veya test senaryosu bu ihtiyacın yerine geçmez. Bütün maddelerin tamamlanması ana İşi otomatik kapatmamalıdır.

## Solution

İş, yalnız metin ve tamamlanma işareti taşıyan hafif kontrol listeleri içerebilir. Maddeler bağımsız kimlik yaşamı, İş durumu, kapanış sonucu, tarih, öncelik, ilişki veya planlama üyeliği kazanmaz. `Convert to independent Work` açık önizlemeyle aynı Projede tam İş oluşturur; eski madde yeni İşe giden bağlantıyla değişir; `Köken konumu` ve köken ilişkisi korunur. Bu ilişki üst/alt iş hiyerarşisi değildir.

## User Stories

1. As a founder, I want a light checklist on Work for steps that do not deserve their own records, so that I can track small progress without crowding the Project.
2. As a founder, I want each item to be text plus a done mark only, so that an item cannot grow silent workflow fields.
3. As a founder, I want completing every item not to close the parent Work, so that a checklist cannot impersonate a close action.
4. As a founder, I want adding, editing, reordering, and checking items to stay on the Work, so that the list is a owned component rather than a second Work list.
5. As a founder, I want an item not to appear in search, Backlog, or Kanban as Work, so that components stay invisible as main records.
6. As a founder whose item has grown, I want `Convert to independent Work` with a preview of title, Project, and start status, so that conversion is never silent.
7. As a founder confirming conversion, I want a full Work in the same Project, so that the new record is real Work.
8. As a founder, I want the old item replaced by a link to the new Work, so that I do not track the same progress twice.
9. As a founder, I want origin kept: a `Kökeni` relation to the source Work plus immutable `Origin Location` pointing at the checklist item, so that provenance is exact.
10. As a founder, I want that origin not to mean parent/child hierarchy, so that the new Work is not a subtask of the old.
11. As a founder, I want conversion to stay optional, so that finishing a checkbox never auto-opens Work.
12. As a founder, I do not want nested Work hierarchy, epic trees, or independent status/date/priority/planning on checklist items, so that 19 stays closed.
13. As a founder, I do not want the checklist to become a Test Scenario or Handoff package, so that testing stays its own area.
14. As a founder closing Work, I want unfinished checklist items to appear in the non-blocking close check owned by lifecycle, so that this feature supplies item state without owning close UI.
15. As a founder, I want English UI for the checklist and `Convert to independent Work`, so that the product language stays English.
16. As a founder using only a keyboard or a screen reader, I want to add, check, and convert an item, so that İş yaşam döngüsü includes this component.
17. As a founder, I want conversion to be an atomic command: either the new Work and the replaced item exist together or neither change lands, so that a failed convert cannot orphan a half Work.
18. As a founder, I do not want Feature included-Work to be modeled as checklist items, so that optional Feature inclusion stays full Work records elsewhere.
19. As a founder converting an item, I want the new Work to use Project default start status, so that a checklist cannot mint `Closed` Work.
20. As a founder, I want item order to be presentation on the parent Work, so that order is not Backlog rank.
21. As a founder, I do not want assignees, due dates, or priority ranks on items, so that a light list cannot become a second Work schema.
22. As a founder, I want Markdown copy of Work context (16) to be able to include the checklist text and done marks, so that this component is readable without becoming a snapshot record here.
23. As a founder, I do not want converting an item to archive or close the parent Work, so that growing a step cannot destroy the container.
24. As a founder, I want an empty checklist to be valid, so that a list is never a create gate.
25. As a founder, I do not want checklist items to appear as Universal Search hits, so that owned components stay out of record discovery.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Hafif iş kontrol listeleri](../../prd/06-work-management-and-planning.md#hafif-iş-kontrol-listeleri). Origin for owned components is [Köken konumu](../../prd/02-domain-model-and-lifecycle.md#koken-konumu). Nested work beyond Feature-includes-full-Work and this checklist is [19](../../prd/19-out-of-scope.md). Close check listing remaining items is in the Work close step (lifecycle feature); this feature only exposes item completion state. No new ADR.
- **Glossary.** Use İş, Köken konumu, Kökeni. Avoid: subtask, epic, checklist-as-Work, Test Scenario, Handoff.
- **Component shape.** Checklist items are owned components of Work: text and completion mark. They do not gain independent identity as main records, Work status, close outcome, date, priority, relation, or planning membership. Completing all items does not auto-close Work.
- **Convert.** `Convert to independent Work` previews title, Project, and start status. On confirm, a full Work is created in the same Project. The old item is replaced by a link to the new Work so progress is not doubled. Origin relation to the source Work is kept; `Origin Location` stores owning Work id, component id, and exact source version. The relation is not parent/child hierarchy. Conversion is optional and never implied by checking a box.
- **Atomicity.** Convert is one user command with idempotency: new Work + item replacement commit together or roll back ([ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) spirit for multi-step writes; [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik)).
- **Consumers.** Work Context copy-Markdown may include the checklist (16). Close check may list remaining items (09). Neither is built here.
- **English UI labels.** `Convert to independent Work` and ordinary checklist copy in English. Add missing labels to the term table in the same change.
- **Stack.** Existing form/API stack. No nested-tree widget as a hierarchy product.

## Testing Decisions

- **What a good test is.** Tests observe Work Checklists through its public interface: item CRUD, check marks, convert preview/confirm, origin fields, and negatives (no auto-close, no auto-convert, item not a main record). They do not assert component table shapes.
- **Seam (one).** Work Checklists — the product-facing checklist and convert interface on Work. Playwright for İş yaşam döngüsü is this seam through the UI.
- **Modules under test.** Work Checklists only. Feature inclusion, test scenarios, and close UI are counterparts.
- **Prior art.** Contract tests at this seam. Evidence binds to [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Completing all items does not close Work; checking does not convert; converted Work is not a subtask; item is absent from Work search as a main record.

## Out of Scope

- Kontrol listesini subtask hiyerarşisi veya bağımsız İş listesi sayma.
- Madde tamamlanınca otomatik İş açma; bütün maddeler bitince ana İşi kapatma.
- Listeyi Test Senaryosu veya Handoff paketi yapmak.
- Feature kapsanan İş modelini checklist sayma.
- Kapanış kontrolü UI'sini burada inşa etme.

## Further Notes

- **Orient.** Glossary: İş, Köken konumu. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#hafif-iş-kontrol-listeleri`). ADRs: none owning; 0004 for convert atomicity. Related: PRD 02 Origin Location, PRD 16 İş yaşam döngüsü, PRD 19 nested work.
- **Acceptance.** Bind to [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Origin Location counterparts belong on that journey when convert is used.
