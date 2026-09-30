# Odak Dönemi

Kaynak: [`docs/workflow/30-focus-period/phase-context.md`](../../workflow/30-focus-period/phase-context.md)

## Problem Statement

Kurucu seçili İşlerle çalışmak için 1–8 haftalık geçici bir pencere açmak ister. Bugün bu pencere sprint, Kilometre Taşı, Proje Sürümü veya Günlük Odak sanılır; üyelik durum yazar; bir İş iki etkin dönemde durur; kapanış güncel İşlerin yerine geçer; açık İşler kurala bağlanıp sonraki döneme sessizce yuvarlanır. Kullanım zorunlu değildir.

## Solution

Odak Dönemi farklı Projelerden İşleri isteğe bağlı 1–8 haftalık ortak kapsamda toplar. Amaç ve başlangıç/bitiş tarihi vardır. Bir İş aynı anda en fazla bir etkin dönemdedir; başka etkin döneme alma açık taşımadır. Üyelik durum veya proje aşaması yazmaz. Başlangıç ve kapanış kapsamı ayrı tarihsel snapshot’tır; güncel İşlerin yerine geçmez. Kapanışta açık İşler toplu kararla sonraki döneme, Backlog’a, başka döneme veya açık vazgeçmeye gider; otomatik rollover yoktur. İsteğe bağlı salt-okunur `Dependencies` mevcut blokaj ilişkilerini okur; yeni ilişki veya kritik yol üretmez.

## User Stories

1. As a founder, I want an optional `Focus Period` of 1–8 weeks with a purpose and start/end dates, so that a working window exists without being a sprint cadence.
2. As a founder, I want to add Work from different Projects into that window, so that the period is a chosen set, not a Project stage.
3. As a founder adding or removing membership, I want workflow status and project stage unchanged, so that a period is not a Kanban move.
4. As a founder, I want use to be optional, with no mandatory cadence, velocity, or capacity score, so that I can skip periods entirely.
5. As a founder, I want a Work item to be in at most one active period at a time, so that two live windows cannot claim the same Work.
6. As a founder moving Work into another active period, I want that to be an explicit move that keeps past memberships and snapshots, so that history is not overwritten.
7. As a founder, I want start-scope and close-scope kept as separate immutable historical snapshots, so that today’s Work records are not replaced by the period.
8. As a founder closing a period, I want a neutral comparison of Work that was in the start snapshot, added later, removed, completed, and still open, so that close is an account, not a grade.
9. As a founder, I want that comparison not to mint a performance note, success score, or velocity, so that the product does not judge the window.
10. As a founder, I want an optional date comparison of start-snapshot target dates against change history, completion events, and close time, so that moved-early, moved-later, completed-on-target, completed-after, and still-open are visible without a new “actual date” field.
11. As a founder with still-open Work at close, I want a bulk decision screen to send selected Work to the next period, Backlog, or another period, or to abandon via the explicit close action, so that leftovers are a choice.
12. As a founder, I do not want a pre-set rule to auto-move all open Work into the next period, so that there is no silent rollover.
13. As a founder, I want a skippable short period evaluation at close to record what to keep, change, or try next, so that learning is optional prose, not generated action items.
14. As a founder creating follow-up Work from a learning, I want an explicit action plus a preview of the Work and relation, with the new Work linked to the source period, so that the system does not mint action items by itself.
15. As a founder on a period detail, I want an optional read-only `Dependencies` view derived from existing active and resolved blocker relations in that period’s scope, so that I can see waits without a second graph.
16. As a founder, I want those nodes to open source records, and active/resolved, direction, and safely detected cycles to be explainable and not color-only, so that the view is honest.
17. As a founder, I do not want `Dependencies` to create relations, a Mermaid source, manual node layout, a second planning fact, or a critical path, so that blockers stay workflow 19’s relations.
18. As a founder, I do not want a Focus Period to be a Milestone, Project Release, Daily Focus, or sprint, so that the nouns stay distinct.
19. As a founder, I want English UI copy for `Focus Period`, `Dependencies`, `Planned`, `Active`, `Closed`, and `Canceled`, so that the product language stays English.
20. As a founder using only a keyboard or a screen reader, I want to open a period, move Work, close with snapshots, run the bulk leftover decision, and inspect `Dependencies`, so that the Odak Dönemi journey is possible without a pointer-only board.
21. As a founder, I do not want this feature to write Backlog manual order except when I explicitly send leftover Work to Backlog membership, so that close is not a silent rank rewrite.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Odak Dönemleri](../../prd/06-work-management-and-planning.md#odak-dönemleri). Period and snapshots are the auxiliary row in [ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler). `Dependencies` derivation is specified under [İş bağımlılıkları ve blokajlar](../../prd/06-work-management-and-planning.md#iş-bağımlılıkları-ve-blokajlar) as an optional read-only view on Feature and Focus Period detail; this feature hosts the period instance, workflow 19 owns the relations. Nouns: [terim sözlüğü](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü). No new ADR.
- **Glossary.** Use Odak Dönemi (`Focus Period`), Kilometre Taşı (not this), Proje Sürümü (not this), Günlük Odak (not this), Backlog, Kanban. Do not introduce sprint, velocity, critical path, or auto rollover. Lifecycle English UI: `Planned`, `Active`, `Closed`, `Canceled`.
- **Window.** Length 1–8 weeks. Purpose + start/end. Optional. Membership does not write status or project stage. Workspace-scoped auxiliary (period can span Projects).
- **One active.** At most one active period per Work. Adding Work already in another active period is rejected; `Move` explicitly ends the source membership and adds the target membership atomically. Past memberships and snapshots remain.
- **Snapshots.** Start scope locks when the period becomes `Active` (start instant reached). Close scope locks on `Closed`. They do not replace live Work. Close compares start/in/out/completed/still-open neutrally; historical titles and statuses remain visible independently of later live Work edits and leftover decisions. Work added after the start and removed before close is preserved in the closing comparison without becoming part of the close scope or the leftover set. Source links open the current Work, not a replacement record. Optional target-date comparison uses existing history and close instant; no new actual-date field, health, or score. `Canceled` does not write close-scope snapshot or leftover bulk decision; start snapshot if present stays historical; Work is no longer in an active period.
- **Lifecycle.** `Planned` → `Active` at start instant. Membership never writes Work status or Project stage. `Closed` is the account path. `Canceled` from `Planned` or `Active` ends the window without close account.
- **Leftovers.** Bulk decision screen only. Destinations: `Next period`, `Backlog`, `Another period`, or explicit `Abandon` (Work closure step, not a period side effect). `Send` writes the explicit decision for the selected Work. A send to a period validates and applies the entire selected set atomically; an unavailable destination or conflicting Work leaves every selected membership and decision unchanged. Work not selected stays undecided. `Backlog` records the explicit choice without rewriting its existing manual order or changing Work status. `Abandon` uses the Work lifecycle closure checks and explicit confirmation before recording each successful closure; an interrupted batch remains retryable without closing successful Work again. No rule-based auto rollover.
- **Evaluation.** Skippable. Learnings are user text. Follow-up Work only with preview and confirm; link to source period. No generated action items.
- **Dependencies.** Optional read-only, initially collapsed and expandable with a keyboard. Reads only existing, non-deleted `Active` and `Resolved` blocker relations whose endpoints are both in the current period scope (workflow 19); unrelated relations and waits across the scope boundary are excluded. Nodes open sources with `Open source record`. Direction, relation status, and cycles detected within that scope are explained in text, not just color; a cycle may contain resolved relations and does not imply that every wait is active. Empty scope shows `No dependencies in this Focus Period.`. No new relation, Mermaid source, manual layout, second planning fact, or critical path. Opening or closing this view does not persist a presentation setting or mutate its source records. Verified at the Focus Period seam in Testing Decisions.
- **English UI labels.** `Focus Period`, `Move`, `Dependencies`, `Open source record`, `Part of a dependency cycle`, `No dependencies in this Focus Period.`, `Planned`, `Active`, `Resolved`, `Closed`, `Canceled`, `No Work in this Focus Period.`, `Work is already in another Focus Period.`, `Work is already in an active Focus Period. Use Move.`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI. Dependencies labels are verified by the read-only view tests at the Focus Period seam.

## Testing Decisions

- **What a good test is.** Tests observe Focus Period through its public interface: 1–8 week create, membership without status write, one-active-period rule, explicit `Move` with the source period's removed Work visible in close comparison, closed membership followed by new active membership, close snapshots vs live Work, leftover bulk decision, rollover counterpart, read-only Dependencies, and empty membership copy `No Work in this Focus Period.`. They do not assert snapshot-table internals. Expected values are product rules (one active period; historical memberships and snapshots remain; no auto rollover).
- **Seam (one).** Focus Period — the optional working-window, snapshot, leftover-decision, and read-only dependency-view interface. Daily Focus, Milestone, Project Release, and blocker-relation writes are counterparts, not this module.
- **Modules under test.** Focus Period only. Daily Focus membership, Milestone reach, Project Release scope, and blocker create/resolve are out except as counterparts.
- **Prior art.** Contract tests at this seam with a clock test double. Evidence environment for [Odak Dönemi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project. Cloud tests must not use production content.
- **Required counterparts.** Membership does not write status/stage; implicit second active membership rejects; explicit move preserves source membership history and snapshots; a Closed period does not block new Active membership; close snapshot does not mutate live Work fields; no auto rollover; Dependencies create no relation; period is not Milestone or Project Release.
- **Closing package.** Observe historical snapshot titles/statuses and comparison groups through Focus Period reads after live Work edits and leftover decisions, including Work added and removed between the start and close while remaining outside the close scope. Observe selected-set sends, all-or-nothing membership/decision writes on a conflicting or unavailable target, untouched unselected Work, duplicate-decision rejection, and unchanged Backlog manual order through public interfaces. Browser coverage checks one selected-set `Send` request, explicit Work closure checks for `Abandon` and recovery after a committed decision loses its response, skippable evaluation, and follow-up `Preview`/`Confirm` with preview cancellation and without automatic Work creation. These checks bind the Snapshots, Leftovers, Evaluation, and closing UI decisions above to this seam.
- **Dependencies evidence.** Public Focus Period reads derive both statuses, direction, scoped nodes and cycles from existing relations; deleted, non-blocking, outside-scope, and crossing-scope relations are excluded. Repeated reads leave existing relations and live Work unchanged. The read-only view exposes source links but no mutation controls, starts collapsed, handles empty and acyclic scopes, and leaves its projection unchanged. Playwright exercises keyboard expansion and collapse on the Focus Period detail; Vitest rendering exercises labels and source destinations.

## Out of Scope

- Odak Dönemini sprint, velocity veya zorunlu kadans sayma.
- Kilometre Taşı veya Proje Sürümü yerine kullanma.
- Açık İşleri kurala bağlayıp sonraki döneme sessizce taşıma.
- `Dependencies` görünümünü ayrı planlama gerçeği veya kritik yol sayma.
- Günlük Odak üyeliği, önceliklendirme oturumu, Bitiriş efekti.

## Further Notes

- **Orient.** Glossary: Odak Dönemi. Owning PRD: `docs/prd/06-work-management-and-planning.md` (Odak Dönemleri; Dependencies cümlesi blokaj bölümünde). ADRs in play: none. Related but not owning: PRD 02 (dönem/snapshot yardımcı varlığı), workflow 19 (blokaj ilişkisi), 26 (Backlog hedefi), 27, 29, 63, PRD 16 (Odak Dönemi), PRD 19 (kritik yol/sprint yok).
- **Acceptance.** Bind this feature to [Odak Dönemi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (real project: 1–8 week window; at most one active period per Work; close snapshot does not replace live Work; no auto rollover).
- **Consumers.** Workflow `19-blockers` owns relation writes that `Dependencies` reads. Workflow `26-backlog` receives explicit leftover sends. Workflow `09-work-lifecycle` owns abandon from the leftover screen.
