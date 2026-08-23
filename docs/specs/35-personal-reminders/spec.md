# Kişisel Hatırlatmalar ve Yeniden Bak

Kaynak: [`docs/workflow/35-personal-reminders/phase-context.md`](../../workflow/35-personal-reminders/phase-context.md)

## Problem Statement

Kurucu desteklenen bir kayda veya Belge bölümüne belirli bir zamanda dönmek ister. Bugün bu niyet İş durumuna, `Target date`’e, Yeniden görünme tarihine veya Günlük Odak üyeliğine yazılmadan duramaz; tetiklenince kaynak kapanmış veya planlama sırası değişmiş gibi davranma riski vardır. Dikkat sinyali merkezi, takvim Event’i ve kişisel kabuk bu sorunun parçası değildir; zamanı gelen `Review Later` öğesini kabuk açar, üyeliği yönetmez.

## Solution

Kurucu Hesap kapsamındaki Hatırlatma kaydıyla desteklenen kaynağa kişisel zaman bağlar. Yaşam `Planned`, `Triggered` ve `Cancelled` kalır; kaynak yaşamı ve planlama üyeliği yazılmaz. `Review Later` aynı mekanizmadır: Belgede kararlı bölüm kimliğini izler, silinmiş başlığa sessizce kaymaz, `In any case` / `Only if still open` koşulunu zamanı gelince değerlendirir. Tetik, Birleşik Bildirim Merkezinin sunduğu tek `personal-reminder` veya `review-later` sinyalini üretir; merkezi burası inşa etmez. İş `Target date` bu kayıt değildir ve `due-date` üretmez.

## User Stories

1. As a founder, I want to put a personal reminder on supported Work so that I return to it at a chosen time without changing its workflow status.
2. As a founder, I want the same reminder on Project, Document, Decision, Risk, Design, Source, Milestone, Project Release, Production Incident, and Test Gap, so that later attention is not limited to Work.
3. As a founder, I want a reminder to live as Hatırlatma in Hesap scope with the source as origin reference, so that the Project does not own my personal timing.
4. As a founder, I want reminder life to be `Planned`, `Triggered`, or `Cancelled`, so that timing state is not confused with the source record’s life.
5. As a founder, I want `Planned` and `Triggered` to leave source status, priority, stage, relations, Backlog, Kanban, Daily Focus, Focus Period, and other planning membership untouched, so that a nudge cannot masquerade as a plan change.
6. As a founder, I want a reminder to be distinct from Work `Target date`, so that a delivery date on Work is not a personal nudge and this feature does not write `Target date`.
7. As a founder, I want a reminder to be distinct from Yeniden görünme tarihi, so that deferring Work in Backlog is not Review Later.
8. As a founder, I want `Review Later` on those same supported records, so that “come back to this source” is one product action.
9. As a founder reviewing a Document, I want `Review Later` to optionally target a Markdown heading with a stable section id, so that I return to a section rather than an arbitrary paragraph.
10. As a founder, I want that bind to follow the section id when the heading is renamed or moved inside the Document, so that a title edit does not drop the reminder.
11. As a founder, I want a deleted or unresolvable section to open the Document, show the missing section target, and refuse silent retargeting to another heading, so that I am not sent to the wrong place.
12. As a founder, I want `In any case` versus `Only if still open` when the source has a product-defined open/resolved life, so that a resolved record can skip the nudge.
13. As a founder, I want the default to be `In any case`, so that existing unconditional semantics stay unless I opt into the open check.
14. As a founder, I want `Only if still open` to evaluate only that source’s open/resolved life at fire time, so that I am not given a general condition builder.
15. As a founder, I want exactly one attention signal when time arrives and the chosen condition holds, so that the source opens rather than a copy queue: `Remind me` fires `personal-reminder`, `Review Later` (including `Reassess impact`) fires `review-later`, never both for one fire.
16. As a founder, I want no signal when `Only if still open` fails because the source is no longer open, and I want reminder history to show the source life and why it was suppressed, so that silence is explained.
17. As a founder, I want an unresolvable source life to produce a source-linked signal that the condition could not be evaluated, so that the product never silently swallows the reminder.
18. As a founder, I want to dismiss or pick a new time on the fired signal without creating Work or a content copy, so that snoozing is still a reminder, not a task.
19. As a founder using skippable `Reassess impact` after a Project Release publish, I want that action to create this same `Review Later` on the source Project Release when I pick a date, so that release follow-up does not invent a second reminder type.
20. As a founder, I want `Reassess impact` with no date to create nothing, so that the default stays “no reminder”.
21. As a founder of an archived Project, I want reminders toward that Project’s records to stop firing, so that archive’s frozen boundary includes personal nudges.
22. As a founder, I want a deleted source to show a safe tombstone on the reminder rather than resurrecting content, so that origin reference follows broken-reference rules.
23. As a founder, I want English UI `Review Later`, `Remind me`, `Planned`, `Triggered`, `Cancelled`, `In any case`, and `Only if still open`, so that copy stays English.
24. As a founder using only a keyboard or a screen reader, I want to set, fire, open, dismiss, and reschedule a reminder, so that later attention is not mouse-only.
25. As a founder, I do not want a standalone reminder or dateless Save for Later queue, so that temporary capture stays Inbox and lasting attention stays source-linked.
26. As a founder, I do not want this feature to own the Work `Target date` field, Yeniden görünme tarihi, Daily Focus, Unified Calendar Event, or the notification center, so that those journeys stay their own features while consuming these signal ids.
27. As a founder, I want a due Work `Target date` neither to create a Hatırlatma nor to emit `due-date` from this feature, so that approaching delivery dates stay a Work field I can optionally remind myself about with `Remind me` or `Review Later`.
28. As a consuming feature (personal shell), I want time-due `Review Later` items to open at the source, so that the shell does not own reminder membership.
29. As a consuming feature (attention signals), I want `personal-reminder` and `review-later` production rules to stay here, so that the center does not redefine those types or treat this feature as `due-date` production.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Kişisel hatırlatmalar](../../prd/06-work-management-and-planning.md#kişisel-hatırlatmalar). Hatırlatma as Hesap-scoped ana kayıt is [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Archive stops reminders per [ortak yaşam döngüsü](../../prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü). Signal ids `personal-reminder` and `review-later` are registered in [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari); presentation is the attention-signals feature. Work `Target date` (`hedef tarihi`) remains a Work field owned by work/calendar; this feature does not write it, does not mint a Hatırlatma from it, and does not emit `due-date`. The PRD 04 registry currently lists `due-date` under this section; the owning PRD 06 body never defines production from `Target date` (it lets the founder create a Hatırlatma *for* an approaching date). Follow the section body. Yeniden görünme tarihi is the neighboring section (`reappear-date` stays there). No new ADR: timing versus source life is already decided.
- **Glossary.** Use Hatırlatma, `Review Later` (`Yeniden bak`), Dikkat sinyali, İş, `Target date` (do not write), Yeniden görünme tarihi (out), Günlük Odak (out), Birleşik Bildirim Merkezi (consumer), Kişisel erişim kabuğu (opens items, does not own membership). Do not introduce standalone reminder, Save for Later queue, calendar Event, snooze date as a Work field, or notification-as-Work.
- **Hatırlatma module.** One Hesap-scoped Hatırlatma record: fire time, source id, optional Document section id, condition `In any case` | `Only if still open`, life `Planned` | `Triggered` | `Cancelled`, and which action created it (`Remind me` or `Review Later`). Source is origin reference, not ownership. Supported sources are exactly the PRD list: Project, Document, Work, Decision, Risk, Design, Source, Milestone, Project Release, Production Incident, Test Gap. No other type.
- **Non-writing invariant.** Create, fire, dismiss, reschedule, and cancel never write source workflow status, closure result, priority, stage, relations, Backlog order, Kanban column, Daily Focus, Focus Period, Roadmap horizon, or `Target date` / Yeniden görünme tarihi.
- **Review Later.** Same Hatırlatma row, same life. Document optional target is a stable Markdown heading section id, not a paragraph or sliding text range. Rename/move follows id. Missing section opens the Document, explains the missing target, and does not retarget. `Only if still open` is not a general query; it reads the source’s product-defined open/resolved life at fire time. Default `In any case`.
- **Fire.** Durable schedule uses pg-boss (tech stack). At fire time the product evaluates the condition once, writes `Triggered` or records suppression in reminder history, and emits exactly one Hatırlatma signal: `Remind me` → `personal-reminder`; `Review Later` (including `Reassess impact`) → `review-later`. Never both for one fire. Unresolvable source life emits a source-linked “condition could not be evaluated” signal rather than dropping the row. Dismiss and reschedule stay on this record; they do not create Work. A due Work `Target date` is not a fire of this module.
- **Release consumer.** Skippable `Reassess impact` after Project Release publish may call this module to create `Review Later` on that Project Release when the founder picks a date. This feature does not own the release observation UI, missing-observation signal, or Access/Outcome fields.
- **Archive and delete.** Archived Project stops reminder fire toward its records. Deleted source uses common broken-reference presentation; reminder history keeps time and reason without resurrecting content.
- **English UI labels.** First user-visible copy: `Review Later`, `Remind me`, `Planned`, `Triggered`, `Cancelled`, `In any case`, `Only if still open`. Add missing labels to the PRD term table in the same change that first shows them. No Turkish UI. `Target date` is the Work field label (calendar/work); this surface does not show a second date name.
- **Consumers.** Workflows `71-attention-signals` present `personal-reminder` and `review-later`. `72-personal-shell` opens due Review Later items. `28-unified-calendar` does not own reminder semantics. `12-github-and-project-releases` / release-communication may call Review Later for `Reassess impact`.

## Testing Decisions

- **What a good test is.** Tests observe Personal Reminders through its public interface: create/cancel/reschedule, fire, condition evaluation, Document section bind, which signal id fired, and whether the source record’s life or planning membership changed. They do not assert pg-boss internals, Prisma row shapes, or the notification center’s grouping UI. Expected values are product rules (Hesap scope, three lives, section id, suppress-with-reason, no source write, one id per fire, no `due-date` from this module).
- **Seam (one).** Personal Reminders — the product-facing reminder interface used by record actions, the shell’s due Review Later list, and later `Reassess impact`. Scheduler and signal append are adapters behind that interface. Playwright for keyboard set/open/dismiss is the same seam through the UI.
- **Modules under test.** Personal Reminders only. Notification center, Daily Focus, Unified Calendar, `Target date` field, Yeniden görünme tarihi, and Work lifecycle are counterparts: “this write did not happen” / “this Hatırlatma signal id was emitted, the center is not built here” / “a due `Target date` did not mint a Hatırlatma or `due-date` here”.
- **Prior art.** No Vitest/Playwright suite yet. First contract tests live at this seam with a clock/scheduler test double. Bind evidence to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Negative bounds (no standalone reminder, no Save for Later, no source-life write) are 19-class counterparts on that journey. Signal presentation belongs to dikkat sinyalleri when that feature exists.
- **Required counterparts.** Planned/Triggered do not write source status or planning membership; `Target date` and Yeniden görünme tarihi unchanged; missing section does not retarget; `Only if still open` on a resolved source emits no signal and history explains; unresolvable life is not silent; archived Project does not fire; no dateless queue; `Remind me` does not emit `review-later`; a due `Target date` does not create a Hatırlatma and this module does not emit `due-date`.

## Out of Scope

- `Target date` alanı, ondan `due-date` üretimi, Yeniden görünme tarihi, Günlük Odak üyeliği, Birleşik Takvim Event’i, odak zamanlayıcısı.
- Birleşik Bildirim Merkezi sunumu, sinyal gruplama ve okundu/kapatıldı UI’si (71).
- Kişisel kabuğun panel yerleşimi ve Aktif Çalışma Seti (72).
- Kaynaksız standalone reminder, tarihsiz Save for Later kuyruğu, hatırlatmadan örtük İş.
- Proje Sürümü Erişim/Sonuç gözlemi ve `release-observation-missing` üretimi.
- Dış takvim senkronu, e-posta/push ürünü.

## Further Notes

- **Orient.** Glossary: Hatırlatma, `Review Later`, Dikkat sinyali. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Kişisel hatırlatmalar). ADRs in play: none owning. Related: PRD 02 (Hesap scope, archive stops reminders), PRD 04 (signal registry and shell), PRD 16 (kişisel bağlam), PRD 19 (standalone reminder / Save for Later / recent-context).
- **Acceptance.** Bind to [kişisel bağlam](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Reminders must not become planning membership; Favorites/shell remain their own cards. Signal ids `personal-reminder` and `review-later` produced here are consumed on [dikkat sinyalleri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) without redefining production (`Sıradan hatırlatma eksik gözlem sinyali başlatmaz`). PRD 16 kişisel bağlam sources list shell/Favorites/session set, not this section; that is the closest personal journey, not a second feature’s PRD.
- **PRD conflict.** [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari) lists `due-date` as owned by [Kişisel hatırlatmalar](../../prd/06-work-management-and-planning.md#kişisel-hatırlatmalar), but that section never defines Target-date production. This spec does not implement `due-date`. A PRD fix should move the registry owner to the Work/`Target date` section or define production there.
- **Consumers.** `71-attention-signals`, `72-personal-shell`, release `Reassess impact`. They do not copy reminder life onto Work.
