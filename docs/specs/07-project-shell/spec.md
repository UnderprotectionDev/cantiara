# Proje Kabuğu

Kaynak: [`docs/workflow/07-project-shell/phase-context.md`](../../workflow/07-project-shell/phase-context.md)

## Problem Statement

Kurucu bir Projeyi ad ve Başlangıç yapılandırmasıyla açıp kısa kod, alanlar, hazır görünümler ve boş iskelet kataloğunu aynı yapı kararından doğurmak ister. Bugün iskelette Proje kaydı, kısa kod sözleşmesi, dört yapılandırma tablosu, Yapılandırma modu ve yapıyı kopyalama yoktur. Proje genel bakışı, özel alan şeması, İş yaşam döngüsü ve yaşayan Belge/Duvar örnekleri bu sorunun parçası değildir.

## Solution

Yeni Proje yalnız `Project Name` ve kapalı katalogdan bir Başlangıç yapılandırması ile `Active` açılır. Sistem kısa kod önerir; ilk İşten sonra kod değişmez ve Çalışma Alanında yeniden kullanılmaz. `Blank Project`, `Solo SaaS`, `Open Source Library` ve `Mobile Application` alanları, aşamaları, görünümleri ve navigasyonu bir kez kurar; örnek içerik üretmez. Kabuk kaynakta tanımlı beş boş iskelet kataloğunu seçer; yaşayan Belge ve Proje Duvarı örnekleri kendi feature’larında oluşur. Yapılandırma modu yapıyı günlük düzenlemeden ayırır. `Overview` ve `All Tools` kapanmaz. Yapıyı kopyalama içeriksiz yeni Projeye yapı taşır.

## User Stories

1. As a founder, I want to create a Project with only `Project Name` and a Starter Configuration, so that I can start without filling purpose, problem, or dates.
2. As a founder, I want a new Project to open `Active`, so that lifecycle is not confused with a setup wizard.
3. As a founder, I want a unique short code in the Workspace, suggested from the name, so that Work keys like `PAY-1` have a prefix.
4. As a founder, I want to change the short code until the first Work exists, so that I can fix an ugly suggestion.
5. As a founder, I do not want the short code to change after the first Work, so that keys stay stable.
6. As a founder, I do not want a retired or reassigned short code reused on another Project in the same Workspace, even after permanent delete, so that keys never collide.
7. As a founder, I do not want the Project to be a repository, a Workspace, or a mutable slug identity, so that Proje stays the ownership boundary.
8. As a founder, I do not want GitHub connection required at create, so that identity of the Project is not a repo.
9. As a founder, I want optional purpose, problem, scope, target date, and logo, so that profile can stay thin.
10. As a founder, I do not want Project color, CSS, font, or white-label, so that branding stays a logo or the default accessible title.
11. As a founder choosing `Blank Project`, I want the smallest setup: no stages, no starter skeletons, `Work` and `Documents` enabled, `Backlog` and `Board` views, so that blank means unconfigured, not missing capabilities.
12. As a founder choosing `Solo SaaS`, `Open Source Library`, or `Mobile Application`, I want that row’s stages, enabled areas, pinned areas, and Work views applied once, so that a opinionated start is real.
13. As a founder, I want every configuration to install `Not Started`, `In Progress`, `Blocked`, and `Closed` Work statuses and to keep `Overview`, `Work`, `Documents`, and `All Tools` reachable, so that protected semantics and always-on surfaces hold.
14. As a founder, I do not want a starter configuration to create sample Work, fake Documents, Decisions, Risks, or history, so that it is not a content template.
15. As a founder, I do not want the configuration choice to become a workflow gate or a later re-apply, so that I can change structure piece by piece afterwards.
16. As a founder, I want an optional dismissible first-open explanation of why those defaults landed, so that I am not forced through a tour.
17. As a founder, I want the configuration to select the closed skeleton catalog (`Persona`, `Retrospective`, `Launch Plan` documents; `Sitemap`, `Customer Journey` walls) without instantiating living records, so that Documents (31) and Project Wall (51) can create empty heading structures.
18. As a founder on `Blank Project`, I do not want that catalog applied, so that blank stays the smallest start.
19. As a founder, I want `Configuration Mode` to be a visible presentation state, not a role, so that I can edit stages, statuses, areas, and views away from daily editing.
20. As a founder, I want to leave Configuration Mode in one action, so that I cannot get stuck in settings.
21. As a founder, I want daily create, edit, status, and planning to stay available outside the mode, so that configuration is not a permission wall.
22. As a founder, I do not want entering the mode to change records, view membership, or Project lifecycle, so that it is truly presentational.
23. As a founder, I want Configuration Mode to open the custom-field editor and the Work Context Card layout entry points without this feature owning those schemas, so that 10 and 16 can attach later.
24. As a founder, I want stages to be addable, renameable, reorderable, and removable, each carrying one of `Not Planned`, `Ready`, `Active`, `Completed`, or `Abandoned`, and several may be `Active` at once, so that stages are not a state machine and do not write Work status.
25. As a founder, I want to enable or hide closed Project areas without deleting their records, so that hiding is navigation not destruction.
26. As a founder, I do not want `Overview` or `All Tools` to be hideable Project areas, so that I cannot brick discovery.
27. As a founder, I want `Pin to navigation` and `Restore default navigation` to change only presentation metadata, so that pin is not enablement.
28. As a founder, I want user-facing Work status names to be renameable in Configuration Mode without deleting `Not Started` / `In Progress` / `Blocked` / `Closed` semantics, so that protected values survive.
29. As a founder, I do not want to add a new workflow-status value, so that the four protected statuses stay closed.
30. As a founder, I want to copy stages, enabled areas, statuses, views, context-card layouts, custom-field *definitions*, priority-metric definitions, and empty wall skeletons into a new Project without records, history, or relations, so that structure reuse is not a Project duplicate.
31. As a founder copying structure, I want a preview of what will transfer, so that I do not silently copy content.
32. As a founder, I do not want Work templates, planned test cases, or automation rules copied with structure, so that those stay explicit in their features.
33. As a founder, I do not want a contentful `Duplicate project` or fork, so that PRD 19 stays intact.
34. As a founder using only a keyboard or a screen reader, I want to create a Project, pick a configuration, toggle Configuration Mode, hide an area, and copy structure, so that **Proje gezinme** and İlk Proje are possible.
35. As a founder, I want English UI for configurations, areas, and Configuration Mode, so that product language stays English.
36. As a founder, I do not want this feature to render Project Overview modules or to define custom-field types, so that 08 and 10 stay owners.
37. As a founder who enables `Tests`, I want a Proje alanı in the closed catalog, so that this shell does not ship a test product or treat Tests as a phase of this feature.
38. As a founder, I want skeleton catalog selection to record the PRD empty-heading lists as selection metadata without creating living Document or Wall records, so that Documents (31) and Project Wall (51) instantiate the same golden structures.
39. As a founder, I do not want starter configurations to fork Work Context Card layouts by configuration, so that type layouts stay the single PRD 06 contract.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Proje profili](../../prd/04-workspace-and-projects.md#proje-profili), [görüşlü başlangıç yapılandırmaları](../../prd/04-workspace-and-projects.md#görüşlü-başlangıç-yapılandırmaları), [yapılandırma modu](../../prd/04-workspace-and-projects.md#yapılandırma-modu), [proje alanlarını etkinleştirme](../../prd/04-workspace-and-projects.md#proje-alanlarını-etkinleştirme), [yapılandırılabilir aşamalar](../../prd/04-workspace-and-projects.md#yapılandırılabilir-ve-paralel-proje-aşamaları), [proje yapısını kopyalama](../../prd/04-workspace-and-projects.md#proje-yapısını-kopyalama). Short code uniqueness is in the profile section. Protected status semantics: [korunan ürün semantiği](../../prd/02-domain-model-and-lifecycle.md#korunan-urun-semantigi). Stage states: [proje aşaması sözleşmesi](../../prd/02-domain-model-and-lifecycle.md#proje-aşaması-sözleşmesi). No ADR.
- **Glossary.** Use Proje, Proje kısa kodu, Başlangıç yapılandırması, Blank Project, Başlangıç iskeleti, Proje alanı, Yapılandırma modu, Proje aşaması. Do not introduce sprint, dashboard, User Workspace, organization, template marketplace, or Lookup/Formula. Overview is a surface, not a Project area.
- **Project Shell module.** Create Project, short-code suggest/reserve, apply starter configuration once, select skeleton catalog, Configuration Mode, area enable/hide/pin, stage/status presentation, copy structure. Writes use Mutation Contract.
- **Starter configuration table (normative, from PRD).** Apply exactly once at create:

| Starter Configuration | Prepared stages | Enabled areas | Extra pinned areas | Prepared Work views |
| --- | --- | --- | --- | --- |
| `Blank Project` | none | `Work`, `Documents` | none | `Backlog`, `Board` |
| `Solo SaaS` | `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate` | all Project areas | `Discovery`, `Decisions`, `Design`, `Tests`, `Releases` | `Backlog`, `Board`, `Roadmap` |
| `Open Source Library` | `Scope`, `Build`, `Validate`, `Release`, `Maintain` | `Work`, `Documents`, `Decisions`, `Technical Diagrams`, `Tests`, `Releases`, `GitHub` | `GitHub`, `Tests`, `Releases` | `Backlog`, `Board`, `Roadmap` |
| `Mobile Application` | `Discovery`, `Design`, `Build`, `Validate`, `Release`, `Operate` | all Project areas | `Discovery`, `Design`, `Tests`, `Releases`, `Production` | `Backlog`, `Board`, `Roadmap` |

All four install the four protected Work statuses and keep `Overview`, `Work`, `Documents`, and `All Tools` reachable. Blank does not disable other areas; they remain in `All Tools`. Starter configuration does not fork Work Context Card layouts; type layouts follow [İş Bağlam Kartı](../../prd/06-work-management-and-planning.md#iş-bağlam-kartı) and are not a per-configuration variant. The choice is not a workflow or publish gate and is not re-applied later. First open may show an optional dismissible explanation; it is not a forced tour and creates no sample content.
- **Skeleton catalog.** Closed five: `Sitemap` (`Primary Navigation`, `Secondary Navigation`, `Utility`, `External`) and `Customer Journey` (`Awareness`, `Consideration`, `Onboarding`, `Core Use`, `Retention`) as Project Wall heading lists; `Persona` (`Context`, `Goals`, `Behaviors`, `Pain Points`, `Constraints`, `Evidence`, `Open Questions`), `Retrospective` (`Period`, `What worked?`, `What did not?`, `What did we learn?`, `Decisions`, `Next changes`, `Related records`), `Launch Plan` (`Release`, `Audience`, `Scope`, `Readiness`, `Communication`, `Launch steps`, `Risks`, `Observation plan`, `Related records`) as Document heading lists. This feature records which catalog the configuration selected, including those empty-heading lists as selection metadata. It does not create living Document or Wall records. Blank selects none.
- **Conflict note.** PRD 16’s Başlangıç iskeletleri journey describes producing Document/Wall records. Phase-context and this workflow cut keep instantiation in 31 and 51. PRD still wins on *what* the empty headings are; *when* they materialize is the later features. Do not implement living instances here.
- **Always-on.** `Overview` and `All Tools` are not Project areas and cannot be turned off. Enabling/hiding an area does not move, copy, or delete records. Pin is navigation metadata only. `Tests` is one closed-catalog Proje alanı; enabling it does not create Planlı Test Senaryosu, Test Handoff, or any other test record, and this feature does not become the testing product. This feature does not render Overview modules (workflow 08).
- **Stages.** Each stage carries one of `Not Planned`, `Ready`, `Active`, `Completed`, or `Abandoned` ([proje aşaması sözleşmesi](../../prd/02-domain-model-and-lifecycle.md#proje-aşaması-sözleşmesi): Planlanmadı, Hazır, Aktif, Tamamlandı, Vazgeçildi). Several may be `Active` at once. Stage state does not write Work status, content access, or another stage. Removing a stage previews presentation/filters and does not delete main records.
- **Copy structure.** Copies stages, enabled areas, statuses, prepared views, Work Context Card layouts, custom-field definitions as independent copies (no Workspace-wide field id), priority-metric definitions, empty wall skeleton *definitions*. Does not copy records, history, relations, cards, templates, planned tests, or automation. Preview required. Source Project unchanged. Confirmation requires a new `Project Name` (founder-entered; source name is not copied) and a `Short code` (suggested from the new name, editable until first Work, Workspace-unique). Starter Configuration is not offered and is not re-applied; the copied structure is the structure.
- **English UI labels.** First user-visible copy uses: `Project Name`, `Starter Configuration`, `Blank Project`, `Solo SaaS`, `Open Source Library`, `Mobile Application`, `Configuration Mode`, `Overview`, `All Tools`, `Pin to navigation`, `Restore default navigation`, `Copy project structure`, `Short code`, `Not Planned`, `Ready`, `Custom field`, `Work Context Card layout`, `Priority metrics`, `Stages`, `Work statuses`, `Project areas`, `Saved views`, `Create`, `Edit`, `Status`, `Planning`. Add missing labels to the PRD term table in the same change that first shows them. `Starter Configuration` and lifecycle `Active` are already in the table. Stage `Active` / `Completed` / `Abandoned` reuse existing lifecycle labels and are not a second Work-status catalog.
- **Configuration Mode.** Visible presentation state on the Project Shell, not a permission and not a Mutation Contract write. One control opens and closes it. Entering does not change records, view membership, or Project lifecycle. Daily `Create`, `Edit`, `Status`, and `Planning` stay available outside the mode. The mode hosts stages, Work statuses, Project areas, Custom field, Priority metrics, Saved views, and Work Context Card layout. Saved views is not the daily Planning action. Custom field and Work Context Card layout editors open as hosts; schema and layout engines stay 10 and 16.
- **Stack.** React, TanStack Router/Form, Zod, oRPC, Prisma. No new framework.

## Testing Decisions

- **What a good test is.** Tests observe Project Shell through its public interface: create with name+configuration; short-code reserve and immutability after first Work (Work create may be a test double that only “exists”); four-configuration matrix; no sample content; Configuration Mode on/off without mutating records, lifecycle, enabled areas, or view membership; daily Create/Edit/Status/Planning remaining available with the mode off; Custom field and Work Context Card layout editors opening as hosts without schema or layout writes; hide area without deleting; Overview/All Tools still reachable; Overview modules absent; stage five-state catalog; copy structure without records; skeleton catalog metadata without living Document/Wall. They do not assert Prisma shapes or CSS. Expected values are the PRD table and the closed catalogs.
- **Seam (one).** Project Shell — the product-facing Project create/configure/copy interface. Document/Wall instantiation, custom-field value types, Overview modules, and Work keys are adapters or later features. Playwright for İlk Proje is this seam through the UI.
- **Modules under test.** Project Shell only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence: [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: four-configuration E2E, default lifecycle, navigation, no re-apply). [Başlangıç iskeletleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) catalog selection is this feature; golden living structures wait on 31 and 51.
- **Required counterparts.** Second Workspace not created; GitHub not required; short code not reused; sample content absent; Overview/All Tools cannot hide; Overview modules absent here; Lookup/Formula absent; contentful duplicate absent; enabling `Tests` does not create test records or a separate test product; living Document/Wall instances absent; configuration is not a workflow/publish gate.

## Out of Scope

- Örnek Proje, içerikli şablon, zorunlu workflow, şablon pazarı.
- Yaşayan Belge veya Proje Duvarı iskelet örneği (31, 51).
- Proje genel bakışı modülleri (08).
- Özel alan tür şeması ve değer yazma (10).
- İş Bağlam Kartı düzen motoru (16), İş anahtarı (09).
- Proje arşivi/silme (83), GitHub bağlantısı (61).
- Lookup/Formula.
- Testler alanını ayrı test ürünü veya bu kabuğun ana fazı sayma (53–57).

## Further Notes

- **Orient.** Glossary: Proje, Proje kısa kodu, Başlangıç yapılandırması, Blank Project, Başlangıç iskeleti, Proje alanı, Yapılandırma modu, Proje aşaması. Owning PRD: `docs/prd/04-workspace-and-projects.md` (profil, yapılandırmalar, mod, alanlar, kopyalama). ADRs in play: none. Related: PRD 02 (protected semantics, stages), PRD 16 (İlk Proje, Başlangıç iskeletleri), PRD 19 (no contentful templates, no duplicate-project).
- **Consumers.** 08 reads enabled areas and profile. 09 consumes short code at first Work and freezes it. 10 owns field schema opened from Configuration Mode. 31/51 consume skeleton catalog selection and materialize living empty-heading structures.
