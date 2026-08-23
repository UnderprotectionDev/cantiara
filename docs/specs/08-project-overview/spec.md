# Proje Genel Bakışı

Kaynak: [`docs/workflow/08-project-overview/phase-context.md`](../../workflow/08-project-overview/phase-context.md)

## Problem Statement

Kurucu tek Projenin amacını, yaşamını, işini, bilgisini, belirsizliğini, testini ve olaylarını nötr bir kaynak özetiyle görmek ister. Bugün iskelette Proje açılınca dashboard benzeri bir boş kabuk vardır; sayılar ikinci bir doğruluk kaynağına veya sağlık skoruna kayabilir. Çalışma Alanı genel bakışı, Değer Zinciri ve Manuel Proje Güncellemesi bu sorunun parçası değildir.

## Solution

Proje genel bakışı mevcut kesin kayıtlardan türetilen nötr modüller sunar: amaç ve yaşam durumu, Proje Hedefi girişi, aynı anda aktif olabilen aşamalar, kilometre taşları, güncel iş, belgeler, kararlar, riskler, aktif Test Handoff’ları, son Test Oturumları, açık Test Açıkları, önemli üretim olayları, blokajlar, yaklaşan veya geçen hedef tarihler, son değişiklikler. Sayılar ve başlıklar kesin kaynak kümelerini `Open source record` ile açar. Özet başarı anlatısı veya otomatik sağlık hükmü üretmez. Etkin Proje alanları adları ve görünür girişleriyle durur; alanı etkinleştirmek içerik üretmez. Açık Soru görünürlüğü İş Bağlam Kartındadır; Overview nitel belirsizlik modülü veya sağlık skoru üretmez.

## User Stories

1. As a founder, I want one Project Overview that summarizes this Project’s purpose and lifecycle, so that I know which Project I am in without a score.
2. As a founder, I want concurrent active stages shown from the Project Shell configuration, so that parallel stages are visible not sequenced as a pipeline.
3. As a founder, I want milestones, current Work, documents, decisions, and risks summarized from their source records, so that the overview is not a second copy.
4. As a founder, I want Proje Hedefi records reachable from Overview by name and a visible entry, so that Goals are not a hideable Project area.
5. As a founder, I want active Test Handoffs, recent Test Sessions, and open Test Gaps from test records, so that test attention is a source list not a quality score.
6. As a founder, I want important production incidents, blockers, approaching or past target dates, and recent changes from their sources, so that events stay dated facts.
7. As a founder, I want each count and heading to open the exact filtered source set, so that I can verify the number.
8. As a founder, I do not want the overview to compute a health score, traffic-light, or success narrative, so that I am not managed by a dashboard.
9. As a founder, I do not want Manual Project Update mixed into the automatic summary, so that a subjective `On Track` note stays workflow 69.
10. As a founder, I do not want this surface to be Workspace overview, so that Active Projects / Attention Required / Upcoming / Recent Work stay workflow 15.
11. As a founder, I do not want this surface to be the Value Chain, so that goal-to-outcome tracing stays workflow 67.
12. As a founder, I want enabled Project areas listed by name with a visible entry, so that overview reflects the shell without owning enablement.
13. As a founder, I do not want enabling an area from here to create sample content, so that overview is not a template button.
14. As a founder, I want missing kinds of records to show an honest empty state, so that the module does not invent rows.
15. As a founder, I do not want the overview to create records, relations, or scores when I click a module, so that drill-down is read-only besides navigation.
16. As a founder using only a keyboard or a screen reader, I want to move between modules and open a source record, so that İlk Proje’s overview half is possible.
17. As a founder, I want English UI for Overview module names, so that product language stays English.
18. As a founder, I want dates on the overview formatted with Hesap locale and time zone, so that “upcoming” uses my week without this feature owning preferences.
19. As a founder, I do not want Feature-level `On Track` health here as a Project score, so that optional Feature health stays on the Work record.
20. As a founder, I do not want this Overview to be the `Tests` Proje alanı product, so that test planning, handoff, and session surfaces stay the testing feature.
21. As a founder, I do not want an Açık Soru uncertainty module or qualitative uncertainty status on Overview, so that Açık Soru visibility stays on İş Bağlam Kartı.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Proje genel bakışı](../../prd/04-workspace-and-projects.md#proje-genel-bakışı). Enabled-area presentation on this surface is the last bullet of [proje alanlarını etkinleştirme](../../prd/04-workspace-and-projects.md#proje-alanlarını-etkinleştirme). Interaction consistency (`Open source record`, counts open exact sets) is [etkileşim tutarlılığı](../../prd/15-product-quality.md#etkilesim-tutarliligi). No ADR.
- **Glossary.** Use Proje genel bakışı, Proje Hedefi. Avoid dashboard score, Workspace overview, Manual Project Update, Value Chain as this surface. Değer Zinciri, Manuel Proje Güncellemesi, Çalışma alanı genel bakışı are neighboring terms this feature must not implement. Açık Soru is not an Overview module.
- **Project Overview module.** Read-only derived modules over existing records. Catalog is the [Proje genel bakışı](../../prd/04-workspace-and-projects.md#proje-genel-bakışı) list plus Proje Hedefi reachability from [proje alanlarını etkinleştirme](../../prd/04-workspace-and-projects.md#proje-alanlarını-etkinleştirme) (Goals are not a Project area). No new main record, relation, or health field. Counts are live queries with a drill-down to the exact set. Empty modules stay empty.
- **Sources.** When a source type does not exist yet, the module renders empty and still must not fake numbers. Tests may use record doubles at the Overview seam without shipping those domains.
- **Not mixed.** Manual Project Update snapshots, Workspace overview modules, and Value Chain are excluded. Feature optional health (`On Track` / `At Risk` / `Off Track`) is not rolled up into a Project score. Phase-context lists açık sorular / belirsizlik as overview modules; PRD 04’s overview catalog does not, and says Açık Soru visibility on Project surfaces is [İş Bağlam Kartı](../../prd/06-work-management-and-planning.md#iş-bağlam-kartı). PRD wins: no Overview uncertainty module or qualitative uncertainty status. Decisions and Risks stay (they are in the PRD catalog). This surface is not the `Tests` Proje alanı product.
- **English UI labels.** First user-visible copy uses: `Overview`, `Open source record`, `Purpose`, `Lifecycle`, `Goals`, `Stages`, `Milestones`, `Work`, `Documents`, `Decisions`, `Risks`, `Tests`, `Production`, `Blockers`, `Dates`, `Recent changes`. Add missing labels to the PRD term table in the same change that first shows them. `Open source record` is the English for the common `Kaynak kaydı aç` action if not already tabulated. `Goals` is the Overview entry for Proje Hedefi, not a hideable area.
- **Stack.** React, TanStack Query, oRPC reads. No analytics product, no widget builder.

## Testing Decisions

- **What a good test is.** Tests observe Project Overview through its public interface: modules reflect seeded source records; a count opens that exact set; empty stays empty; no health score field; Workspace-overview module names absent; Value Chain absent; Manual Project Update not merged; Proje Hedefi reachable and not a Project area; Açık Soru uncertainty module absent; hiding an area in Project Shell changes the enabled-area list without deleting records. They do not assert CSS grid or Prisma. Expected values are source equality, not a computed grade.
- **Seam (one).** Project Overview — the product-facing derived summary. Source domains are adapters (real or test doubles). Playwright for İlk Proje’s overview modules is this seam through the UI.
- **Modules under test.** Project Overview only.
- **Prior art.** Almost no Vitest/Playwright yet. First tests live at this seam. Evidence rides [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (overview as the Project’s always-on surface) with synthetic source doubles until those domains exist.
- **Required counterparts.** No health score; no Workspace overview modules; no Value Chain; no Manual Project Update blend; click does not create records; Tests area product (planning/handoff/session surfaces) absent; no Açık Soru uncertainty module; Proje Hedefi reachable and not a Project area.

## Out of Scope

- Çalışma Alanı genel bakışı (15), Değer Zinciri (67), Manuel Proje Güncellemesi (69).
- Proje kabuğu oluşturma/alan etkinleştirme yazması (07 yalnız okunur tüketilir).
- Testler alanı ürünü, Kanban, Roadmap.
- Dashboard builder, otomatik sağlık, başarı anlatısı.
- Açık Soru nitel belirsizlik modülü (İş Bağlam Kartı / workflow 16).

## Further Notes

- **Orient.** Glossary: Proje genel bakışı, Proje Hedefi. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Proje genel bakışı). ADRs in play: none. Related: PRD 06 (how Risk/Open Question appear on Work, not a second uncertainty status here), PRD 16 (İlk Proje), PRD 19 (no Mission Control health rollup, no dashboard builder).
- **Acceptance.** Bind overview modules to [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (Overview always reachable; modules are source summaries). Negative bounds (no dashboard score, no Tests-area product) are 19-class counterparts.
- **Conflict note.** Phase-context intro and Tamamlanma list açık sorular / belirsizlik as Overview modules. PRD 04’s overview catalog does not include Açık Soru and forbids a separate qualitative uncertainty status; Açık Soru visibility is [İş Bağlam Kartı](../../prd/06-work-management-and-planning.md#iş-bağlam-kartı). PRD also requires Proje Hedefi (and Kilometre Taşı) to be reachable from Overview without becoming a Project area. PRD wins.
- **Consumers.** 07 supplies profile, stages, enabled areas. Later work/docs/test/incident features fill modules. 15/67/69 must not be implemented here.
