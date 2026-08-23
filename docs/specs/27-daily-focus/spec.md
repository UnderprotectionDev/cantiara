# Günlük Odak

Kaynak: [`docs/workflow/27-daily-focus/phase-context.md`](../../workflow/27-daily-focus/phase-context.md)

## Problem Statement

Kurucu farklı Projelerden bugün ele almak istediği İşleri kişisel bir günde toplamak ister. Bugün bu seçim Odak Dönemi, sprint, Takvim olayı veya Aktif Çalışma Seti ile karışır; üyelik durum veya Backlog sırası yazar; adaylar otomatik üye olur; `What happened today?` Daily Note üretir; `Close focus` zorunlu ritüel, puan veya kapanış yazımı olur. Seçili günün üyeliği ertesi güne yuvarlanmamalıdır.

## Solution

Günlük Odak kişisel, gün-kapsamlı bir çalışma görünümüdür. Göstermek veya çıkarmak durum, öncelik, proje aşaması veya Backlog sırasını değiştirmez. Üyelik o takvim gününe aittir ve ertesi güne otomatik taşınmaz. Adaylar tarih nedenini açıklar; kabul edilmeden üye olmaz. `What happened today?` salt okunur kaynak olaylarıdır. `Close focus` sakin bir kapanış görünümüdür; açık İşleri kapatmaz, çıkarmaz veya başka güne taşımaz; seri, puan veya zorunlu ritüel üretmez.

## User Stories

1. As a founder, I want a personal `Daily Focus` that can hold Work from different Projects for one selected day, so that today is a working choice rather than a Project-wide period.
2. As a founder adding or removing Work there, I want workflow status, priority, project stage, and Backlog order unchanged, so that today-planning is not a status board.
3. As a founder, I want that membership to belong to the selected calendar day in my profile time zone, so that “today” is not a floating bag.
4. As a founder at the next calendar day, I want yesterday’s membership not to roll over automatically, so that I choose again.
5. As a founder, I want Daily Focus to be a personal Workspace view record that is not shared, so that a visitor or another Account cannot inherit my today set.
6. As a founder, I do not want Daily Focus to be a Focus Period, sprint, Calendar event, or Active Work Set, so that those names stay their own features.
7. As a founder, I want a `Candidates` section for a small number of Work whose target date is near or whose reappear date has arrived, so that the surface can suggest without grabbing.
8. As a founder looking at a candidate, I want it to explain which date field caused the suggestion, so that the reason is inspectable.
9. As a founder, I want candidate status not to mean Daily Focus membership, so that a suggestion is not a silent add.
10. As a founder accepting a candidate, I want it to join that day’s focus without writing status, priority, or project stage, so that accept is membership only.
11. As a founder rejecting a candidate, I want the same non-write, so that dismiss is not abandon Work.
12. As a founder, I want `What happened today?` to list supported notable events that actually happened on the selected calendar day in my profile time zone, so that I can reread the day from sources.
13. As a founder, I want those rows to include completed, abandoned, or reopened Work; recorded Decisions; reached Milestones; published Project Release entries; and resolved Production Incidents, derived from their source records, so that the section is not a second timeline store.
14. As a founder, I want each row to show event time, Project scope, and `Open source record`, so that I can jump without a copy.
15. As a founder, I do not want `What happened today?` to be an editable Daily Note, a copied body, or a second event history, so that PRD 19’s Daily Notes ban holds.
16. As a founder changing profile time zone, I want the view to recompute day bounds without rewriting source timestamps, so that locale display is not mutation.
17. As a founder, I want optional `Close focus` for the selected day to open a calm close view, so that I can look at the day without a ritual.
18. As a founder in that view, I want completed, abandoned, reappear-deferred, and still-open Daily Focus Work grouped from source records and events, each opening its source, so that close is a read of what already happened.
19. As a founder using `Close focus`, I want it not to complete open Work, not to remove Daily Focus membership, not to move Work to another day, and not to impose a zero-Work target, so that close is not a shutdown command.
20. As a founder after closing, I want to return to the same day’s Daily Focus, so that close is reversible viewing.
21. As a founder, I want no streak, score, performance verdict, or mandatory daily ritual from this behavior, so that calm close stays calm.
22. As a founder, I want English UI copy for `Daily Focus`, `Candidates`, `What happened today?`, and `Close focus`, so that the product language stays English.
23. As a founder using only a keyboard or a screen reader, I want to add and remove membership, accept or reject a candidate, read `What happened today?`, and open `Close focus`, so that Günlük planlama is possible without a pointer-only board.
24. As a founder, I do not want this feature to write Kanban columns, Backlog rank, or Focus Period membership, so that those surfaces remain themselves.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Günlük Odak](../../prd/06-work-management-and-planning.md#günlük-odak) and [planlama yüzeyi–durum ayrımı](../../prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı). The auxiliary membership row is in [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Day bounds follow [Hesap profil tercihleri](../../prd/03-account-platform-operations.md#hesap-profil-tercihleri) time zone without this feature owning the preferences UI. Daily Notes ban is [PRD 19](../../prd/19-out-of-scope.md). No new ADR.
- **Glossary.** Use Günlük Odak (`Daily Focus`), Adaylar (`Candidates`), Odak Dönemi (must not be this), Aktif Çalışma Seti (must not be this), Birleşik Takvim (must not be an Event), Backlog, Kanban. Do not introduce sprint, Daily Note, streak, or shared today-set. `What happened today?` and `Close focus` are the English UI for `Bugün ne oldu?` and `Odağı kapat`.
- **Membership.** A Workspace-scoped personal view record holds the founder’s chosen Work for one selected calendar day. Add/remove does not write status, priority, project stage, or Backlog order. Membership is not shared. It does not roll over to the next day. Future reappear dates may background default-set cards without this feature owning the date field.
- **Candidates.** A small set whose target date is near or whose reappear date has arrived may appear under `Candidates` with an explicit date-field reason. Candidate ≠ membership. Accept adds to that day’s focus; reject does not. Neither writes status, priority, or project stage.
- **What happened today?** Read-only derivation from source records/events on the selected profile-time-zone calendar day: Work completed/abandoned/reopened, Decisions recorded, Milestones reached, published Project Release/changelog entries, resolved Production Incidents, and other explicitly supported lifecycle events already on the realized-events timeline. Each row: event time, Project scope, `Open source record`. No Daily Note, no copied body, no second history. Time-zone change recomputes bounds only.
- **Close focus.** Optional calm view for the selected day. Groups completed, abandoned, reappear-deferred, and still-open Daily Focus Work from sources. Does not complete, unfocus, reschedule, or demand zero Work. User can return to the same day’s focus. No streak, score, verdict, or mandatory ritual. Does not trigger Bitiriş efekti.
- **English UI labels.** First user-visible copy uses: `Daily Focus`, `Candidates`, `What happened today?`, `Close focus`, `Open source record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Shell.** Personal-access shell may open this view; it does not own membership. Favorites and Active Work Set stay their features.

## Testing Decisions

- **What a good test is.** Tests observe Daily Focus through its public interface: add/remove membership, day-scoped no rollover, candidate reason and accept/reject, read-only `What happened today?`, and `Close focus` as a non-mutating view. They do not assert calendar-widget internals. Expected values are product rules (membership does not write status; no rollover; candidate is not membership; close does not close Work).
- **Seam (one).** Daily Focus — the personal day-scoped membership, candidate, day-read, and calm-close interface. Focus Period, Unified Calendar, Backlog, Kanban, and personal shell are counterparts, not this module.
- **Modules under test.** Daily Focus only. Focus Period windows, Calendar events, Work status, and Daily Note storage are out except as counterparts.
- **Prior art.** Contract tests at this seam with a clock/time-zone test double. Evidence environment for [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project. Cloud tests must not use production content.
- **Required counterparts.** Add/remove does not write status/priority/stage/Backlog order; next day has empty membership unless chosen; candidate without accept is not a member; `What happened today?` cannot be edited and creates no Document; `Close focus` leaves open Work open and still in that day’s focus; no streak/score.

## Out of Scope

- Günlük Odağı Odak Dönemi, sprint, Takvim olayı veya Aktif Çalışma Seti sayma.
- Adayı otomatik üyelik yapmak.
- Kapanışı zorunlu ritüel, puan, seri veya durum yazımı sayma.
- Daily Note, düzenlenebilir günlük veya ikinci olay geçmişi.
- Kanban sütunu, Backlog sırası, Favori üyeliği, kişisel kabuk iskeleti.

## Further Notes

- **Orient.** Glossary: Günlük Odak. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Günlük Odak, planlama yüzeyi–durum ayrımı). ADRs in play: none. Related but not owning: PRD 02 (üyelik yardımcı varlığı), PRD 03 (saat dilimi), PRD 04 (kişisel kabuk, Aktif Çalışma Seti), workflow 26, 28, 30, 35, 72, PRD 16 (Günlük planlama), PRD 19 (Daily Notes/Event yok).
- **Acceptance.** Bind this feature to [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: non-Kanban view changes do not write status). Day-scoped no rollover, explainable candidates, read-only day read, and calm close are the same journey’s Daily Focus package.
- **Consumers.** Workflow `72-personal-shell` opens this view without owning membership. Workflow `30-focus-period` is a different window. Workflow `23-completion-effects` must not treat `Close focus` as User-initiated Work Success.
