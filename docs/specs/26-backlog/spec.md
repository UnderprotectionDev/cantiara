# Backlog

Kaynak: [`docs/workflow/26-backlog/phase-context.md`](../../workflow/26-backlog/phase-context.md)

## Problem Statement

Kurucu henüz planlanmamış İşler dahil değerlendirilecek aktif, arşiv ve çöp dışı İşleri durumdan bağımsız görmek ve hangisini önce ele alacağını kalıcılaştırmak ister. Bugün Backlog klasör, etiket, sprint veya ikinci İş listesi gibi durur; üyelik veya ele alma durum yazıyor sanılır; alternatif sıralama manuel sırayı yok eder; gelecek yeniden görünme tarihi otomatik durum geçişi veya varsayılan bildirim olur. Kanban sırası, Günlük Odak, önceliklendirme oturumu rank’i ve Akıllı Koleksiyon bu sorunun parçası değildir.

## Solution

Backlog hazır, dinamik bir Akıllı Koleksiyondur. Üyelik, ele alma veya başka planlama görünümüne almak İş akışı durumunu değiştirmez. Projede tek kalıcı manuel sıra vardır; alternatif öncelik, tarih veya alan sıralaması geçici veya kayıtlı sunumdur ve `Manual order` seçilince eski sıra geri gelir. Gelecek `Reappear date` varsayılan görünümde `Deferred` bölümündedir; tarih durum yazmaz. Bildirim varsayılan kapalıdır ve yalnız Proje bazında açık opt-in ile `reappear-date` üretir.

## User Stories

1. As a founder, I want a prepared Backlog of every active, non-archive, non-trash Work that still needs considering, including unplanned Work, so that I am not looking at a folder or a static list.
2. As a founder viewing Backlog, I want membership not to write workflow status, so that seeing Work here is not starting or closing it.
3. As a founder picking Work up from Backlog or moving it onto another planning surface, I want status to stay unchanged, so that only a Kanban move or an explicit status action writes status.
4. As a founder, I want one persistent manual order for the Project, so that “what will I take first?” survives leaving the view.
5. As a founder dragging cards in `Manual order`, I want that rank to persist, so that the order is a decision, not a session sort.
6. As a founder switching to a priority, date, or field sort—temporary or saved—I want the manual order kept in the background, so that `Manual order` can restore it.
7. As a founder returning to `Manual order`, I want the previous rank back, so that an alternate presentation is not a destructive rewrite.
8. As a founder, I want that Backlog rank not to become a Kanban position or an ordinary Smart Collection rank, so that those views keep using their own sort.
9. As a founder, I want a Prioritization session’s view-local rank not to write Backlog order, so that a named ranking session stays local.
10. As a founder, I do not want Backlog order to be a priority score, a closure, or a sprint, so that rank is only take-up order.
11. As a founder setting a future `Reappear date`, I want that Work in the default Backlog’s `Deferred` section, so that I am not staring at it until the date.
12. As a founder, I want that date not to change workflow status, priority, or project stage, so that snooze is not a state machine.
13. As a founder when the date arrives, I want the Work back at its saved manual-order position, so that deferral is temporary placement, not a lost rank.
14. As a founder when the date arrives, I want the Work able to appear as a Daily Focus candidate, so that today-planning can notice it without Backlog membership becoming Daily Focus membership.
15. As a founder, I want reappear notification default off, so that a date is not an inbox by default.
16. As a founder who opts a Project in, I want one `reappear-date` `Action needed` signal when the date arrives, so that opt-in is per Project, not global spam.
17. As a founder, I want that signal not to write status, so that a reminder is not a workflow transition.
18. As a founder archiving or trashing Work, I want it out of this prepared collection, so that Backlog is not the archive or Trash.
19. As a founder, I want English UI copy for `Backlog`, `Manual order`, `Deferred`, and `Reappear date`, so that the product language stays English.
20. As a founder using only a keyboard or a screen reader, I want to reorder Backlog, switch sort presentations, and inspect `Deferred`, so that Günlük planlama is possible without pointer-only drag.
21. As a founder, I do not want Backlog to be a tag, a folder, a second Work identity, or Kanban, so that this collection stays the prepared considering set.
22. As a founder, I do not want this feature to host Daily Focus membership, Calendar drag, or priority-criterion editing, so that those remain their own features.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Backlog](../../prd/06-work-management-and-planning.md#backlog), [yeniden görünme tarihi](../../prd/06-work-management-and-planning.md#yeniden-görünme-tarihi), and [planlama yüzeyi–durum ayrımı](../../prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı). The auxiliary `Backlog manuel sırası` row is in [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). Signal identity `reappear-date` is listed in [dikkat sinyali kayıtları](../../prd/04-workspace-and-projects.md#dikkat-sinyali-kayitlari); this feature owns production when the Project has opted in. No new ADR.
- **Glossary.** Use Backlog, Akıllı Koleksiyon (Backlog is a prepared one), Backlog manuel sırası, Yeniden görünme tarihi (`Reappear date`), Deferred, Günlük Odak (candidate, not membership), Kanban (must not receive this rank), Önceliklendirme oturumu (must not write this rank). Do not introduce folder, tag, static list, sprint, or Kanban order.
- **Prepared collection.** Backlog membership is derived: active Work that is not archived and not in Trash, including unplanned Work. It is not a stored membership list. Seeing, picking up, or moving Work onto another planning surface does not write workflow status.
- **One manual order.** The Project holds exactly one persistent manual Work order. Drag in `Manual order` writes that auxiliary order, not a Work field, not priority criteria, and not closure. Alternate sorts (priority, date, field)—whether temporary or saved presentation—must not destroy that order. Selecting `Manual order` again restores it.
- **Rank isolation.** This order does not create independent manual positions on Kanban or ordinary Smart Collections. A Prioritization session’s separate rank does not write Backlog order, and Backlog order does not write the session rank.
- **Deferred.** Future `Reappear date` splits default Backlog into a `Deferred` section. The date does not write status, priority, or project stage. When the date arrives, Work returns to its saved manual position and may appear as a Daily Focus candidate; candidate appearance is not Backlog membership change and not Daily Focus membership. Until the date, Work may sit in the background of default Kanban/Daily Focus sets (those surfaces honor the date; this feature owns the date’s Backlog split and the opt-in signal).
- **Notification opt-in.** `reappear-date` is off by default. Only an explicit per-Project opt-in produces the signal when the date arrives. The notification center displays it; this feature does not build the center. Personal `Review later` reminders are the personal-reminders feature and are not this date.
- **English UI labels.** First user-visible copy uses: `Backlog`, `Manual order`, `Deferred`, `Reappear date`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Backlog through its public interface: prepared membership, status-unchanged on view/pick-up, persist/restore of manual order across alternate sorts, `Deferred` split, date arrival restoring rank, and Project opt-in producing `reappear-date`. They do not assert sort-index internals. Expected values are product rules (membership does not write status; one persistent order; future date is Deferred, not a status).
- **Seam (one).** Backlog — the prepared considering collection and its single persistent manual order. Kanban, Daily Focus, Prioritization sessions, and the notification center are counterparts, not this module.
- **Modules under test.** Backlog only. Kanban rank, Daily Focus membership, priority criteria, and reminder UI are out except as “status/rank/membership did not write” counterparts.
- **Prior art.** Contract tests at this seam with a clock test double for date arrival. Evidence environment for [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project plus change history. Cloud tests must not use production content.
- **Required counterparts.** Membership/pick-up does not write status; alternate sort does not destroy manual order; Kanban/ordinary collection get no Backlog rank; prioritization session rank does not write Backlog; future date does not write status; notification absent until Project opt-in; archive/Trash Work absent.

## Out of Scope

- Backlog’u klasör, etiket, sprint veya ikinci İş listesi sayma.
- Manuel sırayı Kanban konumu, öncelik puanı veya kapanış yapmak.
- Yeniden görünme tarihini otomatik durum geçişi sayma.
- Günlük Odak üyeliği, Kanban sütunu, Takvim kaydırması, öncelik ölçütü düzenleme.
- Bildirim Merkezi kabuğu; kişisel `Review later` hatırlatması.

## Further Notes

- **Orient.** Glossary: Backlog, Yeniden görünme tarihi. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Backlog, yeniden görünme tarihi, planlama yüzeyi–durum ayrımı). ADRs in play: none. Related but not owning: PRD 02 (manuel sıra yardımcı varlığı), PRD 04 (`reappear-date` kaydı), PRD 08 (Akıllı Koleksiyon genel modeli), workflow 20 (önceliklendirme oturumu), 25, 27, 35, 71, PRD 16 (Günlük planlama), PRD 19.
- **Acceptance.** Bind this feature to [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: view change other than Kanban does not write status; future `Reappear date` is `Deferred` on default Backlog; notification default off and per-Project opt-in; change history).
- **Consumers.** Workflow `27-daily-focus` may show a candidate when the date arrives; it does not own the date. Workflow `71-attention-signals` displays `reappear-date`. Workflow `20-priority` must not write this order.
