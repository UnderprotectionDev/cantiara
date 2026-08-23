# Kanban

Kaynak: [`docs/workflow/25-kanban/phase-context.md`](../../workflow/25-kanban/phase-context.md)

## Problem Statement

Kurucu aynı İş gerçeğini durum sütunlarında taramak ve kartı taşıyınca İş akışı durumunun yazılmasını ister. Bugün planlama yüzeyleri ile durum karışır; Backlog, Günlük Odak veya Takvim üyeliği durum yazıyor gibi durur, `Closed` kapanış adımını atlatır, soft WIP hareketi keser veya tahta ikinci bir İş listesi ile bağımsız sıra üretir. Liste görünümü ayrı kayıt sistemi değildir; Backlog manuel sırası, Tablo Görünümü ve kapanış sonucu bu sorunun parçası değildir.

## Solution

Kanban İşleri korunan `Not Started`, `In Progress`, `Blocked` ve terminal `Closed` sütunlarında gösterir. Sütunlar arası kart hareketi ana İşin İş akışı durumuna yansır. `Closed` sütununa almak kapanış adımını atlatmaz: `Completed` veya `Abandoned` açık seçilir, iptal durum yazmaz. Soft WIP ve kişisel odak eşiği nötr işaret verir; hareketi engellemez. Liste görünümü aynı İş taramasının yoğun düz sunumudur. Tahta bağımsız kalıcı manuel kart sırası tutmaz; kayıtlı görünümün açık sıralamasını kullanır. Üyelik Backlog, Günlük Odak, Takvim, Roadmap, Favori veya Odak Dönemi durumu yazmaz.

## User Stories

1. As a founder, I want Work cards in columns for `Not Started`, `In Progress`, `Blocked`, and `Closed`, so that the board is the workflow-status surface rather than a second Work list.
2. As a founder dragging a card from `Not Started` to `In Progress` or `Blocked`, I want the Work workflow status to become that column, so that the only status writers are an explicit status action and this column move.
3. As a founder dragging a card onto `Closed`, I want the closure step to ask for `Completed` or `Abandoned` (and an optional reason) before the move applies, so that Closed never skips the closure step.
4. As a founder canceling that closure step, I want the Work to stay in its previous status, so that an abandoned drop is not a silent close.
5. As a founder looking at closed Work, I want `Completed` and `Abandoned` to remain distinct on the card even in the same terminal workflow status, so that giving up is not visually the same as finishing.
6. As a founder reopening from `Closed`, I want an explicit reopen to `Not Started`, `In Progress`, or `Blocked` that clears the active closure outcome while keeping the previous outcome in history, so that reopen is not a column trick.
7. As a founder, I want in-progress Work count and time-in-current-status on active cards to be visible, so that I can see load without a health score.
8. As a founder who set an optional personal focus threshold on the Project or Smart Collection, I want a visual warning when it is exceeded, so that I notice overload without being blocked.
9. As a founder who set a per-status soft WIP limit in Configuration mode, I want the column to show current count versus limit with a non-color-only accessible mark when exceeded, so that WIP is a signal, not a gate.
10. As a founder over a soft WIP or focus threshold, I want to still move cards, so that the board never refuses a status write for a count.
11. As a founder, I want that WIP overflow not to mint a notification, health verdict, or automatic Work change, so that a soft limit stays soft.
12. As a founder scanning a card, I want the saved view’s visible fields—defaults: Work key and type, status and closure outcome if any, priority, planned start/target/reappear dates if any, blocker or risk, and checklist progress if any—so that the card is a scannable summary of the source Work.
13. As a founder, I want to open the card as the source Work, so that the board does not keep a copied record.
14. As a founder collapsing a status column, I want the column name, card count, and important signals such as an open blocker to remain visible, so that collapse is layout compression, not a filter.
15. As a founder, I want collapsing a column not to hide Work from membership or change status, so that compress is not archive.
16. As a founder, I want the board to use the saved view’s explicit sort rather than an independent Kanban rank, so that dragging for status does not invent a second order.
17. As a founder, I want Backlog’s single persistent manual order and a Prioritization session’s view-local rank to stay their own exceptions, so that this board does not write those ranks.
18. As a founder using `List`, I want the same filtered Work—including unplanned Work—in a dense scannable row layout, so that list is the same scan, not a second system.
19. As a founder sorting or scanning list fields, I want opening a row to open the source Work, so that a list row is not its own record.
20. As a founder using list, I want it not to write workflow status or closure, so that only a column move or an explicit status action writes status.
21. As a founder, I do not want list to be Table View, a Smart Collection, or Backlog manual order, so that those surfaces keep their own jobs.
22. As a founder with a future reappear date, I want the card able to sit in the background of the default set until that date without changing status, so that snooze is not a column.
23. As a founder, I want archived Work off this board, so that archive remains a visibility state owned by Work lifecycle, not a Kanban column.
24. As a founder moving a card, I want that drag not to write GitHub status or fire silent automation, so that the board is a status surface, not a runner.
25. As a founder adding Work to Backlog, Daily Focus, Calendar, Roadmap, Favorites, or a Focus Period, I want those memberships not to change workflow status, so that planning-surface–status separation holds.
26. As a founder, I want English UI copy for `Board`, `Kanban`, `List`, `Closed`, `Completed`, and `Abandoned`, so that the product language stays English.
27. As a founder using only a keyboard or a screen reader, I want to move Work between non-terminal columns, complete the closure step, reopen, collapse a column, and use `List`, so that Günlük planlama is possible without pointer-only drag.
28. As a founder, I do not want this board to be a sprint, a release commitment, or a closure-outcome column, so that Kanban stays workflow status.
29. As a founder, I do not want bulk field edits, Scope Tree parent-child, or Table cell editing to be this feature, so that those remain their own cards.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Kanban](../../prd/06-work-management-and-planning.md#kanban), [Liste görünümü](../../prd/06-work-management-and-planning.md#liste-görünümü), and [planlama yüzeyi–durum ayrımı](../../prd/06-work-management-and-planning.md#planlama-yüzeyidurum-ayrımı). Closure step semantics are the Work lifecycle rules in [İş öğeleri](../../prd/06-work-management-and-planning.md#iş-öğeleri); this feature is the board/list surface that must call that step rather than invent a fifth status. Protected status values are [korunan ürün semantiği](../../prd/02-domain-model-and-lifecycle.md#korunan-ürün-semantiği). No new ADR: column-move-writes-status and no independent Kanban rank are already in the PRD.
- **Glossary.** Use Kanban, Liste görünümü (`List`), İş, İş akışı durumu, Kapanış sonucu, Backlog (must not be this order), Günlük Odak, Birleşik Takvim, Roadmap, Favori, Odak Dönemi, Tablo Görünümü (must not be List). Do not introduce sprint board, closure column, independent manual rank, or a second Work list. Nav label `Board` is already in the starter-configuration table.
- **Status write path.** Workflow status changes only via an explicit status action or a Kanban column move. Membership in Backlog, Smart Collection, Daily Focus, Focus Period, Favorites, Calendar, or Roadmap does not write status. Removing Work from a planning view does not mean stopped, completed, or abandoned.
- **Columns.** Columns are the four protected workflow statuses. User-facing names may be renamed in Configuration mode (project-shell / Work lifecycle); this feature must not add a fifth semantic, delete one, or treat a column as archive or closure outcome. `Closed` is terminal workflow status, not the outcome.
- **Closure step.** Dropping onto `Closed` (or any equivalent status action from the board) shows the same closure step: choose `Completed` or `Abandoned`, optional reason. Cancel applies no status change. Closed cards distinguish the two outcomes. Reopen is explicit confirmation plus a non-terminal target. This feature does not own Kapanış kontrolü / Kalıcı bağlamı koru / Bitiriş efekti beyond not skipping the closure step; those stay on Work lifecycle and completion-effects.
- **Soft WIP and focus.** Optional per-status soft WIP (default off, Configuration mode) and optional personal focus threshold (Project or related Smart Collection) are separate settings. Overflow is a neutral, not-color-only mark plus counts. Moves are not blocked. No notification, health, or performance verdict. No automatic Work mutation.
- **Card and collapse.** Cards use the saved view’s visible-fields setting with the PRD default summary. Collapse is layout-only: name, count, and important signals such as open blocker remain; membership and status are unchanged.
- **Order.** Kanban and ordinary Smart Collection views do not keep an independent manual card rank. They use the saved view’s explicit sort. Backlog’s one persistent manual order and a Prioritization session’s view-local rank are the two non-interchangeable exceptions, owned by those features. Named Roadmap group/column presentation order is not card priority and is not stored here.
- **List.** `List` is the same Work scan in a dense field layout, including unplanned Work. A row is not a second record. List does not write status or closure. It is not Table View (Record Discovery), not a Smart Collection, and not Backlog manual order.
- **Drag stack.** Column moves use the stack drag library; the product meaning is status write, not GitHub status and not silent automation. Reappear-date backgrounding follows [yeniden görünme tarihi](../../prd/06-work-management-and-planning.md#yeniden-görünme-tarihi) without this feature owning the date field.
- **English UI labels.** First user-visible copy uses: `Board`, `Kanban`, `List`, `Not Started`, `In Progress`, `Blocked`, `Closed`, `Completed`, `Abandoned`, `Open source record`. Missing labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Open source record.** Opening a card or row uses the shared `Open source record` action. In-context preview panel behavior is Record Discovery; this feature only needs the same action label and source Work.

## Testing Decisions

- **What a good test is.** Tests observe Kanban through its public interface: column move, closure-step on `Closed`, reopen, soft WIP/focus overflow still movable, list scan of the same Work, collapse, and saved-view sort with no independent rank. They do not assert CSS grid internals or Prisma column maps. Expected values are product rules (status written only by column move or explicit action; Closed does not skip closure; WIP does not block).
- **Seam (one).** Kanban — the planning surface that presents Work by workflow status (board columns and the same-scan `List`). Work lifecycle is the status/closure counterpart behind that interface; Backlog, Daily Focus, Calendar, Table View, and Smart Collection are not this module.
- **Modules under test.** Kanban only. Work create/identity, Backlog rank, Daily Focus membership, Unified Calendar, Table View, bulk edit, and GitHub are out except as counterparts (“status did not change”, “rank did not write”, “list row is the same Work”).
- **Prior art.** Contract tests at this seam with a Work-status test double. Evidence environment for [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project; change history must show column moves as status actions. Cloud tests must not use production content.
- **Required counterparts.** Backlog/Daily Focus/Calendar/Roadmap membership does not write status; Closed drop without outcome does not apply; soft WIP overflow still moves; list is not a second record and not Table View; no independent Kanban rank; collapse does not filter; archived Work is absent from the default board; drag does not write GitHub.

## Out of Scope

- Sprint, velocity, yayın taahhüdü veya kapanış sonucunu sütun sayma.
- Liste görünümünü Tablo Görünümü, Akıllı Koleksiyon veya ikinci kayıt sistemi yapmak.
- Kanban’da bağımsız kalıcı manuel kart sırası; Backlog sırası ve Önceliklendirme oturumu rank’i burada yazılmaz.
- Backlog, Günlük Odak, Takvim, Roadmap, Favori veya Odak Dönemi üyeliğiyle durum yazma.
- İş kimliği, kapanış kontrolü, Bitiriş efekti, toplu düzenleme, Kapsam Ağacı sürüklemesi.
- GitHub durumu, otomasyon kuralı veya bildirim merkezi.

## Further Notes

- **Orient.** Glossary: Kanban, Liste görünümü, İş akışı durumu, Kapanış sonucu. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Kanban, Liste görünümü, planlama yüzeyi–durum ayrımı). ADRs in play: none. Related but not owning: PRD 02 (korunan durum semantiği), PRD 08 (Tablo Görünümü ve önizleme), PRD 04 (Yapılandırma modu, `Board` nav), workflow 09 (kapanış adımı), 26–30 (diğer planlama yüzeyleri), PRD 16 (Günlük planlama), PRD 19 (sprint/Event yok).
- **Acceptance.** Bind this feature to [Günlük planlama](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: column move writes status; Closed cannot skip closure; other planning memberships do not write status; change history). Pair with [İş yaşam döngüsü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) for Completed/Abandoned. Negative bounds (no independent rank, list is not Table View, WIP does not block) are 19-class counterparts on that journey.
- **Consumers.** Workflow `09-work-lifecycle` owns the closure step this board must invoke. Workflow `26-backlog` owns the one manual order. Workflow `33-record-discovery` owns Table View and the preview panel `Open source record` opens by default. Workflow `22-bulk-editing` may run on the board selection; it is not this feature.
