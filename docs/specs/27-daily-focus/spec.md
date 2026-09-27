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
- **Candidates.** For the selected day, show up to five unselected, open Work items whose `Target date` is that day through the next seven calendar days or whose `Reappear date` is on or before that day. Keep the existing Project/Work order. Each reason displays the exact date with `Target date is near` or `Reappear date has arrived`; a Work item matching both dates shows both reasons. Candidate ≠ membership. `Accept` adds to that day’s focus through the existing membership write. `Reject` hides that candidate for the selected day in the current view only; it does not store a rejection, and a reload may show it again. Neither action writes status, priority, or project stage.
- **What happened today?** Read-only derivation from source records/events on the selected profile-time-zone calendar day: Work completed/abandoned/reopened, Decisions recorded, Milestones reached, published Project Releases, and resolved Production Incidents. Decision, Milestone, Project Release, and Production Incident are read from their owning source records and lifecycle history; Daily Focus does not create a second history. Each row shows event time and Project scope and opens the typed source record with `Open source record`. No Daily Note or copied body. Time-zone change recomputes bounds only. Source event times come from source creation or lifecycle mutation history, not the browser clock.
- **Source record access.** Decision, Milestone, Project Release, and Production Incident reads and writes are Account-scoped and revision/idempotency-aware. `Open source record` resolves the source type and ID inside the current Project Shell; the detail is read-only in this surface.
- **Close focus.** Optional calm view for the selected day. Its read query derives end-of-day Work from the selected profile-time-zone day’s membership and Work mutation history, then groups completed, abandoned, reappear-deferred, and still-open Work using the existing source records. The selected day stays in route state so the user can return to that same day’s focus. The query does not write Work, membership, or event history, and does not create a summary, snapshot, or session. It does not complete, unfocus, reschedule, or demand zero Work. No streak, score, verdict, or mandatory ritual. Does not trigger Bitiriş efekti.
- **English UI labels.** First user-visible copy uses: `Daily Focus`, `Candidates`, `What happened today?`, `Close focus`, `Open source record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Membership UI labels.** Issue #202 shows `Selected day`, `No Work in Daily Focus for this day.`, `Work`, `Select Work`, `Add to Daily Focus`, and `Remove from Daily Focus`. The membership controls do not expose candidate, day-read, or close behavior.
- **Candidate UI labels.** Use `Work appears here when Target date is this day through the next 7 days, or Reappear date is on or before this day.`, `Accept`, `Reject`, `No Candidates for this day.`, `Target date is near`, and `Reappear date has arrived` from the PRD term table.
- **Shell.** Personal-access shell may open this view; it does not own membership. Favorites and Active Work Set stay their features.

## Testing Decisions

- **What a good test is.** Tests observe Daily Focus through its public interface: add/remove membership, day-scoped no rollover, candidate reason and accept/reject, read-only `What happened today?`, and `Close focus` as a non-mutating view. Day-read tests use the profile time zone and assert source-derived Decision, Milestone, Project Release, Production Incident, and Work events, including a next-local-day boundary and typed source navigation. They do not assert calendar-widget internals. Expected values are product rules (membership does not write status; no rollover; candidate is not membership; close does not close Work; the event list does not write source records).
- **Seam (one).** Daily Focus — the personal day-scoped membership, candidate, day-read, and calm-close interface. Focus Period, Unified Calendar, Backlog, Kanban, and personal shell are counterparts, not this module.
- **Modules under test.** Daily Focus owns day derivation and source navigation. Source create/transition contracts are tested at their respective Decision, Milestone, Project Release, and Production Incident seams (specs 38, 29, 63, and 66). Focus Period windows, Calendar events, Work status, and Daily Note storage are out except as counterparts.
- **Prior art.** Contract tests at this seam with a clock/time-zone test double. Evidence environment for [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project. Cloud tests must not use production content.
- **Required counterparts.** Add/remove does not write status/priority/stage/Backlog order; next day has empty membership unless chosen; candidate without accept is not a member; `What happened today?` includes only the supported source lifecycle events in the selected profile day, cannot be edited, creates no Document or second history, and opens each source by type and ID; `Close focus` groups Work from source membership and mutation history using the Account time zone, excludes status events outside the selected day, leaves open Work and membership unchanged, returns to the same day, and creates no ritual, streak, score, or Bitiriş efekti.
- **Issue #202 evidence.** At the Daily Focus seam, select Work from two Projects for one profile date; read the next date as empty, deny a second Account access, remove one member, and compare Work, Project, and Backlog records before and after. This covers the membership part of [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Issue #205 evidence.** At the Daily Focus seam, verify the selected-day and seven-day `Target date` boundary, arrived `Reappear date`, visible reason labels and dates, five-item cap, and that a candidate stays outside membership until `Accept`. Compare Work, Project, priority, and Backlog data before and after acceptance. `Reject` hides the candidate only in the current view; it writes no source field or membership and may be followed by the same candidate after reload.

## Out of Scope

- Günlük Odağı Odak Dönemi, sprint, Takvim olayı veya Aktif Çalışma Seti sayma.
- Adayı otomatik üyelik yapmak.
- Kapanışı zorunlu ritüel, puan, seri veya durum yazımı sayma.
- Daily Note, düzenlenebilir günlük veya ikinci olay geçmişi.
- Kanban sütunu, Backlog sırası, Favori üyeliği, kişisel kabuk iskeleti.

## Further Notes

- **Orient.** Glossary: Günlük Odak; source records use Karar, Kilometre Taşı, Proje Sürümü, and Üretim Olayı. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Günlük Odak, planlama yüzeyi–durum ayrımı); source lifecycle owners: specs 38, 29, 63, and 66. ADRs in play: 0004 (idempotent source mutations) and 0002 (Account-scoped founder access); none for profile-day reads or source hash navigation. Related but not owning: PRD 02 (source records and membership), PRD 03 (time zone), PRD 04 (personal shell, Active Work Set), workflows 26, 28, 30, 35, 72, PRD 16 (Günlük planlama), PRD 19 (Daily Notes/Event ban).
- **Acceptance.** Bind this feature to [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: non-Kanban view changes do not write status). Day-scoped no rollover, explainable candidates, read-only day read, and calm close are the same journey’s Daily Focus package.
- **Consumers.** Workflow `72-personal-shell` opens this view without owning membership. Workflow `30-focus-period` is a different window. Workflow `23-completion-effects` must not treat `Close focus` as User-initiated Work Success.
