# Yol Haritası Ufku

Kaynak: [`docs/workflow/29-roadmap-horizon/phase-context.md`](../../workflow/29-roadmap-horizon/phase-context.md)

## Problem Statement

Kurucu aynı İş gerçeğini Roadmap, Kilometre Taşı ve `Not now` karar izinde anlatmak ister; yayın taahhüdü veya durum üretmeden. Bugün ufuk yerleşimi durum, öncelik veya Backlog sırası yazar; Kilometre Taşı Odak Dönemi veya Proje Sürümü yerine geçer; `Not now` kapanış sonucu olur; Sunum Kipi ikinci kopya üretir; herkese açık snapshot iç Roadmap’i canlı kopya sanılır. Kanban, Backlog ve Build in Public bu sorunun parçası değildir.

## Solution

Roadmap ufuk ve görünüm gruplarını anlatı olarak sunar. `Now`, `Next` veya `Later` yerleşimi ve filtreler İş durumunu, öncelik ölçütü değerlerini veya Backlog sırasını değiştirmez. Kilometre Taşı ara sonuçtur; bağlı İşleri otomatik kapatmaz ve yayın kapsamı değildir. `Not now` gerekçeyi İşte tutar; durum veya sıra yazmaz. `Presentation Mode` mevcut adlandırılmış görünümü salt okunur açar; ikinci kopya yoktur. Herkese açık snapshot 75’in onaylı revizyonudur; bu feature canlı public kopya tutmaz.

## User Stories

1. As a founder, I want a `Roadmap` of the same Work across optional `Now`, `Next`, and `Later` horizons, so that I can tell the future without inventing a second membership.
2. As a founder placing Work on a horizon or changing a named-view filter, I want workflow status, priority-criterion values, and Backlog order unchanged, so that storytelling is not a status write.
3. As a founder, I want horizon not to start Work, mint a target date, or mean a release commitment, so that `Now` is not a promise.
4. As a founder, I want the default product-direction view to show Research problem/opportunity and intended outcome as primary, with origin-linked solution/Feature Work as secondary, so that the map is not an Initiative lifecycle.
5. As a founder, I want configurable views that can show all Work types as primary without creating Idea or Initiative records, so that presentation is not a new entity.
6. As a founder, I want Work with planned start and target as a planned interval, and target-only Work as a point, so that Roadmap does not replace the daily calendar or workflow status.
7. As a founder, I want an active blocker as a compact badge that opens the blocked record and the exact blocker source, so that I can jump without a standing dependency network.
8. As a founder, I do not want that badge to auto-reschedule or compute a critical path, so that blockers stay the blockers feature’s relations.
9. As a founder, I want a default-collapsed `Unplanned candidates` area of Work matching the view filters but lacking start/target and a `Now`/`Next`/`Later` horizon, so that I can see what is not yet placed.
10. As a founder putting a candidate on the plan, I want a preview of the date field or horizon that will change, and an explicit confirm, so that view membership does not silently write status.
11. As a founder, I do not want `Unplanned candidates` to be a Parked status, a second Roadmap membership, or an independent manual order, so that candidates stay a live filter.
12. As a founder, I want a named Roadmap view to use an existing field as group/lane and a second ordered or select field as color/text mark from the product palette, so that mapping is view metadata, not a Theme record.
13. As a founder, I want `Presentation Mode` to hide editing and configuration, use the current named view, open item details read-only, and return to the same view and position, so that presenting is not a second document.
14. As a founder, I do not want slides, a presentation record, a content copy, narration, a presentation order, or A/V recording, so that Presentation Mode is a mode.
15. As a founder, I want inner Roadmap scope derived from filters, saved views, and optional horizons—not a second `Show on Roadmap` membership—so that public curation cannot be confused with inner membership.
16. As a founder, I want Build in Public to be able to use an approved snapshot of this surface later, so that the live Roadmap is not itself a public copy.
17. As a founder, I want a `Milestone` with title, description, optional target date, and `Planned` / `Reached` / `Abandoned`, so that an intermediate result has its own record.
18. As a founder linking Work with `Contributes to milestone`, I want reaching the Milestone not to close those Work items, and closing all linked Work not to auto-reach the Milestone, so that status stays an explicit action.
19. As a founder, I do not want a Milestone to be a Focus Period, Project Release, sprint, project stage, or Hedefe katkı by itself, so that the three planning nouns stay distinct and Goal membership stays 37.
20. As a founder on open Work or a Feature, I want an optional `Not now` decision with a short reason, optional re-evaluation condition, and links to Decision, Risk, Feedback, Source, or Document, so that deferral has a trail on the Work.
21. As a founder, I want `Not Now` not to create a status, closure outcome, Backlog membership, planning membership, priority value, or Decision record, so that it is a trail, not a park column.
22. As a founder applying `Not Now`, I want a preview of reason, condition, and grounds, and I want status, priority, Backlog order, horizon, dates, and planning membership unchanged, so that the action is not a silent plan rewrite.
23. As a founder, I want the active `Not Now` as a compact inspectable mark on Work detail, Backlog, List, Roadmap, and prioritization surfaces, so that the reason is findable without a hidden filter.
24. As a founder, I do not want the product to watch free-text conditions like “three users asked” and reactivate Work, so that the condition stays my words.
25. As a founder, I want `Reconsidering` to close the active trail, or a new `Not Now` to replace it, with previous reason/condition/grounds kept in ordinary history, so that change is visible.
26. As a founder closing or replacing `Not Now`, I want any already-created `Review later` reminder not to be silently deleted, so that reminder side-effects are previewed.
27. As a founder closing, archiving, or changing Work status, I want `Not Now` not to auto-close, so that a trail outlives a column move.
28. As a founder, I want English UI copy for `Roadmap`, `Now`, `Next`, `Later`, `Milestone`, `Not now`, `Unplanned candidates`, and `Presentation Mode`, so that the product language stays English.
29. As a founder using only a keyboard or a screen reader, I want to place a horizon, inspect a blocker badge, open unplanned candidates, enter Presentation Mode, reach a Milestone, and record `Not now`, so that the Roadmap journey is possible without a pointer-only canvas.
30. As a founder, I do not want this feature to export Roadmap as PNG/PDF/Gantt or to host the public snapshot UI, so that those bans and 75 stay outside.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Roadmap](../../prd/06-work-management-and-planning.md#roadmap), [Kilometre taşları](../../prd/06-work-management-and-planning.md#kilometre-taşları), and [`Şimdi değil` karar izi](../../prd/06-work-management-and-planning.md#şimdi-değil-karar-izi), plus [planlama yüzeyi–durum ayrımı](../../prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı). Milestone vs Focus Period vs Project Release is [terim sözlüğü](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü). Public snapshot is [Build in Public](../../prd/14-sharing-and-public-publishing.md#build-in-public). PNG/PDF/Gantt export ban and no second manual Roadmap membership are [PRD 19](../../prd/19-out-of-scope.md). No new ADR.
- **Glossary.** Use Roadmap, Kilometre Taşı (`Milestone`), Odak Dönemi (not this), Proje Sürümü (not this), `Şimdi değil` (`Not now`), Herkese açık durum etiketi (75, not this), Kanban. Do not introduce Parked, Initiative, Idea lifecycle, sprint, or `Show on Roadmap` membership.
- **Horizon.** Optional `Now` / `Next` / `Later` on Work. Placement and filters do not write status, priority-criterion values, or Backlog order. Horizon is not start, target date, or commitment. Inner scope is derived from filters, saved views, and this optional field—no second membership flag.
- **Named views.** Group/lane from an existing field; color/text mark from a second ordered/select field using the product palette. Metadata only. Time scale and limited visual density may be stored on the view. Group/column presentation order on a named Roadmap view is not card priority and is not Backlog order.
- **Blocker badge and candidates.** Badge highlights blocked record + exact source; both openable. No standing network, auto-reschedule, or critical path. `Unplanned candidates` is a live filter area, default collapsed. Placing on the plan previews the date or horizon write and requires confirm; it does not write status.
- **Presentation Mode.** Full-screen hide of edit/config; current named view; read-only details; exit restores view+position. No second copy or slide record.
- **Public.** This feature does not ship the public snapshot, public status labels, or visitor HTML. 75 may later snapshot an approved inner view; live Roadmap is not public.
- **Milestone.** Project main record: title, description, optional target date, `Planned` / `Reached` / `Abandoned`. Work links via `Contributes to milestone`. Reach does not close Work; all Work closed does not auto-reach. Status only by explicit action. Not Focus Period, not Project Release, not sprint, not project stage, not Hedefe katkı by itself.
- **Not now.** Owned-component trail on Work. Preview reason/condition/grounds. Does not write status, priority, Backlog order, horizon, dates, or planning membership. Compact mark on Work detail, Backlog, List, Roadmap, prioritization. Free-text condition is not watched. `Reconsidering` closes; new `Not now` replaces; history kept. Does not silently delete `Review later`; preview keep/remove. Work close/archive/status does not auto-close the trail. Not a Decision record and not Parked.
- **English UI labels.** `Roadmap`, `Now`, `Next`, `Later`, `Milestone`, `Planned`, `Reached`, `Abandoned`, `Not now`, `Reconsidering`, `Unplanned candidates`, `Presentation Mode`, `Open source record`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Roadmap Horizon through its public interface: horizon/filter writes that must not touch status/priority/Backlog order, Milestone reach/abandon without closing Work, `Not now` trail without status write, blocker badge opening sources, unplanned-candidate confirm, Presentation Mode without a second copy. They do not assert canvas internals. Expected values are product rules (placement is not status; Milestone ≠ Focus Period ≠ Project Release; Presentation Mode is a mode).
- **Seam (one).** Roadmap Horizon — the inner roadmap, milestone, and `Not now` trail interface. Kanban, Backlog, Focus Period, Project Release, and Build in Public are counterparts, not this module.
- **Modules under test.** Roadmap Horizon only. Public snapshot HTML, PNG export, Focus Period windows, and priority-criterion editing are out except as counterparts.
- **Prior art.** Contract tests at this seam. Evidence environment for [Roadmap](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project. Cloud tests must not use production content.
- **Required counterparts.** Horizon/filter does not write status, priority values, or Backlog order; Milestone reach does not close Work; `Not now` is not Parked/Closed; Presentation Mode creates no copy; no `Show on Roadmap` flag; no public snapshot write; no PNG/Gantt export.

## Out of Scope

- Roadmap’i yayın taahhüdü, Kanban veya ikinci `Show on Roadmap` üyeliği sayma.
- Kilometre Taşı, Odak Dönemi ve Proje Sürümünü birbirinin yerine kullanma.
- `Not now` izini kapanış sonucu veya Parked durumu yapmak.
- Herkese açık snapshot, public durum etiketi, ziyaretçi HTML (75).
- Roadmap PNG/PDF/Gantt dışa aktarma.
- Kritik yol, otomatik yeniden zamanlama, slayt kaydı.

## Further Notes

- **Orient.** Glossary: Roadmap, Kilometre Taşı, `Şimdi değil` karar izi. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Roadmap, Kilometre taşları, Şimdi değil). ADRs in play: none. Related but not owning: PRD 02 (terimler), PRD 14/workflow 75 (public snapshot), workflow 19 (blokaj ilişkisi), 20 (öncelik değerleri), 26 (Backlog sırası), 30, 63, PRD 16 (Roadmap), PRD 19.
- **Acceptance.** Bind this feature to [Roadmap](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: horizon/filters do not write status, priority values, or Backlog order; blocker badge and unplanned candidates open sources; Presentation Mode is not a second copy).
- **Consumers.** Workflow `75-build-in-public` may snapshot an approved view; it does not write inner membership. Workflow `30-focus-period` and `63-release-planning` stay distinct nouns. Workflow `19-blockers` owns the relation the badge reads.
