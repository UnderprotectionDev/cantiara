# Birleşik Takvim

Kaynak: [`docs/workflow/28-unified-calendar/phase-context.md`](../../workflow/28-unified-calendar/phase-context.md)

## Problem Statement

Kurucu desteklenen tarihli kayıtları gün, hafta, ay ve Agenda’da, hangi semantiği değiştirdiğini görerek düzenlemek ister. Bugün teslim, anımsatıcı ve pencere tarihleri karışır; kaydırma diğer tarih alanlarını veya İş durumunu örtük yazar; Agenda bağımsız Event kaydı veya ikinci takvim gerçeği olur; planlanan başlangıç işi gizler veya otomatik başlatır. Kişisel hatırlatma ve dış takvim senkronu bu sorunun parçası değildir.

## Solution

Birleşik Takvim planlanan başlangıç, hedef ve yeniden görünme tarihlerini türleri karışmadan gün, hafta, ay ve `Agenda`da gösterir. Başlangıç ile hedef birlikteyse hafta/ayda aralık, günde yalnız o günün konumlarıdır. `Agenda` aynı kayıtların kronolojik yoğun listesidir; Event kaydı veya yeni tarih alanı üretmez. Bir tarih işaretini kaydırmak yalnız temsil ettiği kaynak alanını günceller; tür ve eski/yeni değer bırakmadan önce görünürdür; durum ve diğer tarih alanları yazılmaz; değişiklik güvenli geri alınabilir.

## User Stories

1. As a founder, I want a `Calendar` of supported dated records in day, week, month, and `Agenda`, so that dates live on one surface without becoming a status board.
2. As a founder, I want planned start, target, and reappear dates kept as separate kinds with separate meanings, so that delivery, snooze, and window dates do not mix.
3. As a founder scoping the calendar, I want to inspect all Projects or one selected Project, so that the same kinds stay comparable.
4. As a founder with both planned start and target on a Work, I want week and month to show that span as a range, so that duration is visible without a new field.
5. As a founder in day view, I want only that day’s positions, so that a range does not paint the whole week onto one day.
6. As a founder, I want planned start to mean when work is thought to begin—not to hide Work, auto-start it, or write workflow status, so that a start date is not a Kanban move.
7. As a founder using `Agenda`, I want the same records in a chronological dense list that keeps the selected scope and date-kind filters, so that Agenda is a presentation, not a second calendar.
8. As a founder reading an Agenda row, I want the represented date kind to be explicit and `Open source record` to open the source, so that I know which field I am looking at.
9. As a founder, I do not want Agenda membership, an independent Event record, a new date field, or a second calendar source of truth, so that PRD 19’s Event ban holds.
10. As a founder dragging a date mark to another day, I want only the represented source date field to update, so that a target drag cannot rewrite planned start or reappear.
11. As a founder before drop, I want date kind plus old and new values visible, so that I am not guessing the write.
12. As a founder after a date drag, I want workflow status and the other date fields unchanged, so that the calendar is not a status or a multi-field editor.
13. As a founder, I want that date change to be safely undoable, so that a mis-drop is not a permanent plan rewrite.
14. As a founder, I do not want this surface to sync an external calendar or export calendar files, so that Cantiara stays the date owner.
15. As a founder, I do not want personal reminders or `Review later` to appear as calendar Events, so that those stay the reminders feature.
16. As a founder, I want English UI copy for `Calendar`, `Day`, `Week`, `Month`, `Agenda`, `Planned start`, `Target date`, and `Reappear date`, so that the product language stays English.
17. As a founder using only a keyboard or a screen reader, I want to change views, filter date kinds, inspect Agenda, and update a represented date with the same preview, so that Günlük planlama is possible without pointer-only drag.
18. As a founder, I do not want this calendar to be a sprint, a Kanban column, Daily Focus membership, or Roadmap horizon, so that those surfaces keep their jobs.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Birleşik Takvim](../../prd/06-work-management-and-planning.md#birleşik-takvim) and [planlama yüzeyi–durum ayrımı](../../prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı). Planned-start meaning is in that same separation section. Event and external-calendar bans are [PRD 19](../../prd/19-out-of-scope.md). Safe undo uses the existing mutation/undo contract; this feature does not own the undo module. Date-kind presentation uses profile locale/time zone from account preferences without owning that UI. No new ADR.
- **Glossary.** Use Birleşik Takvim (`Calendar`), Agenda, planlanan başlangıç (`Planned start`), hedef tarihi (`Target date`), Yeniden görünme tarihi (`Reappear date`), Event kaydı (forbidden), kişisel hatırlatma (not this surface), Kanban. Do not introduce timed Event, calendar file, or auto-start.
- **Kinds do not mix.** Each mark is one represented field. Filters can hide kinds; they cannot merge meanings. Supported dated records on this surface are the Work date fields named in the PRD (planned start, target, reappear). Personal reminder times are out.
- **Day / week / month.** Range rendering: start+target together → range in week/month; day view shows only positions on the selected day. Planned start does not hide, auto-start, or write status.
- **Agenda.** Same record set, same scope and kind filters, chronological dense list. Row shows kind + `Open source record`. No Agenda membership entity, no Event, no new date field, no second truth.
- **Drag.** Updates only the represented source field. Preview kind and old/new before commit. Other date fields and workflow status unchanged. Undoable via the shared safe-undo contract. Stack drag library is the interaction tool, not a second model.
- **Scope.** All Projects or one selected Project. Not a status board, sprint, Daily Focus, or Roadmap.
- **English UI labels.** First user-visible copy uses: `Calendar`, `Day`, `Week`, `Month`, `Agenda`, `Planned start`, `Target date`, `Reappear date`, `Open source record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Unified Calendar through its public interface: kind-separated day/week/month/Agenda, range vs day positions, drag of one represented field with preview, status unchanged, no Event record. They do not assert calendar-grid internals. Expected values are product rules (kinds do not mix; drag writes one field; Agenda is not an Event).
- **Seam (one).** Unified Calendar — the dated-record presentation and single-field date update interface. Kanban, Backlog, Daily Focus, personal reminders, and external sync are counterparts, not this module.
- **Modules under test.** Unified Calendar only. Reminder records, Event entities, Work status, and export/sync adapters are out except as counterparts.
- **Prior art.** Contract tests at this seam with a date-field fixture. Evidence environment for [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project plus change history for date drags. Cloud tests must not use production content.
- **Required counterparts.** Target drag does not write planned start or reappear; drag does not write status; Agenda creates no Event; planned start does not hide or auto-start Work; no external calendar payload.

## Out of Scope

- Takvimi durum tahtası, sprint veya dış takvim senkronu sayma.
- Agenda’yı bağımsız Event kaydı veya yeni tarih alanı yapmak.
- Bir tarih kaydırmasıyla diğer tarih alanlarını veya İş durumunu örtük yazma.
- Kişisel hatırlatma, `Review later`, Günlük Odak üyeliği, Roadmap ufku.
- ICS dışa aktarma veya harici takvim entegrasyonu.

## Further Notes

- **Orient.** Glossary: Birleşik Takvim. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Birleşik Takvim, planlama yüzeyi–durum ayrımı). ADRs in play: none. Related but not owning: PRD 03 (saat dilimi), workflow 04 (güvenli geri alma), 25–27, 35, PRD 16 (Günlük planlama), PRD 19 (Event/dış senkron yok).
- **Acceptance.** Bind this feature to [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: non-Kanban view changes do not write status; date drag is a field change in history). Kind separation, Agenda-not-Event, and single-field drag are the same journey’s calendar package.
- **Consumers.** Workflow `35-personal-reminders` stays off this grid. Workflow `33-record-discovery` supplies the default preview for `Open source record`.
