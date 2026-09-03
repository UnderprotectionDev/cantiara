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
- **One active.** At most one active period per Work. Move to another active period is explicit; past memberships and snapshots remain.
- **Snapshots.** Start scope locks when the period becomes `Active` (start instant reached). Close scope locks on `Closed`. They do not replace live Work. Close compares start/in/out/completed/still-open neutrally. Optional target-date comparison uses existing history and close instant; no new actual-date field, health, or score. `Canceled` does not write close-scope snapshot or leftover bulk decision; start snapshot if present stays historical; Work is no longer in an active period.
- **Lifecycle.** `Planned` → `Active` at start instant. Membership never writes Work status or Project stage. `Closed` is the account path. `Canceled` from `Planned` or `Active` ends the window without close account.
- **Leftovers.** Bulk decision screen only. Destinations: next period, Backlog, another period, or explicit abandon (Work closure step, not a period side effect). No rule-based auto rollover.
- **Evaluation.** Skippable. Learnings are user text. Follow-up Work only with preview and confirm; link to source period. No generated action items.
- **Dependencies.** Optional read-only. Reads existing blocker relations in period scope (workflow 19). Nodes open sources. No new relation, Mermaid source, manual layout, second planning fact, or critical path.
- **English UI labels.** `Focus Period`, `Dependencies`, `Planned`, `Active`, `Closed`, `Canceled`, `No Work in this Focus Period.`. Missing labels join the PRD term table in the same change that first shows them. No Turkish UI.

## Testing Decisions

- **What a good test is.** Tests observe Focus Period through its public interface: 1–8 week create, membership without status write, one-active-period rule, close snapshots vs live Work, leftover bulk decision, rollover counterpart, read-only Dependencies. They do not assert snapshot-table internals. Expected values are product rules (one active period; snapshots are historical; no auto rollover).
- **Seam (one).** Focus Period — the optional working-window, snapshot, leftover-decision, and read-only dependency-view interface. Daily Focus, Milestone, Project Release, and blocker-relation writes are counterparts, not this module.
- **Modules under test.** Focus Period only. Daily Focus membership, Milestone reach, Project Release scope, and blocker create/resolve are out except as counterparts.
- **Prior art.** Contract tests at this seam with a clock test double. Evidence environment for [Odak Dönemi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) is the founder’s real project. Cloud tests must not use production content.
- **Required counterparts.** Membership does not write status/stage; second active period rejected or requires explicit move; close snapshot does not mutate live Work fields; no auto rollover; Dependencies create no relation; period is not Milestone or Project Release.

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
