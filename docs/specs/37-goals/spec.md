# Proje Hedefleri

Kaynak: [`docs/workflow/37-goals/phase-context.md`](../../workflow/37-goals/phase-context.md)

## Problem Statement

Kurucu Projenin ulaşmak istediği sonucu ve isteğe bağlı gözlenen öğrenimi kaybetmeden tutmak ister. Bugün bu niyet Kilometre Taşı, Proje Sürümü veya Key Result ile karışır; bağlı İşlerden yüzde veya sağlık hükmü üretilirse değerlendirme kullanıcıdan kaçar. Değer Zinciri görünümü zinciri okur, hedef kaydını burada sahiplenmez. Karar, kanıt veya test `İlgili` ile Hedefe bağlanıp katkı sayılmamalıdır.

## Solution

Proje Hedefi başlık, açıklama, isteğe bağlı `Intended outcome` ve kullanıcı girişi `Observed outcome / learning` taşıyan hafif Proje ana kaydıdır. Sistem ölçümü izlemez, gerçekleşeni doldurmaz, hedefleri hiyerarşide birleştirmez, bağlı kayıtlardan ilerleme yüzdesi üretmez. `Contributes to Goal` yalnız İş, Kilometre Taşı veya Proje Sürümüdür. Detaydaki canlı özet durum dağılımı ve açık Risk/Açık Soru kaynağını nötr gösterir, başarı ilan etmez.

## User Stories

1. As a founder, I want a Project Goal with title and description, so that the aimed-for result lives as its own record inside the Project.
2. As a founder, I want optional `Intended outcome` and later `Observed outcome / learning` fields that I type, so that evaluation stays mine.
3. As a founder, I want the product not to watch a metric, auto-fill actuals, roll goals up, or compute progress percent from linked Work, so that a Goal is not a dashboard.
4. As a founder, I want no Boolean/number/percent Key Result type and no structured target/actual maintenance life, so that first product stays a light record.
5. As a founder, I want `Contributes to Goal` only from Work, Milestone, or Project Release, so that membership is typed.
6. As a founder, I want Research and Feature Work to contribute as Work types, so that discovery and delivery work can serve a Goal without becoming Key Results.
7. As a founder, I want adding or removing `Contributes to Goal` to leave the member’s status, progress, and planning untouched, so that membership is not a gate.
8. As a founder, I want Decision, evidence, and test not to use `Contributes to Goal`, so that those records reach a Goal only through Work or Release in the Value Chain.
9. As a founder, I want `İlgili` not to count as contribution, so that a loose link cannot fake membership.
10. As a founder, I want Goal detail to show a live, source-linked status mix of contributing Research, Feature, and Milestone records plus related open Risks and Open Questions, so that I can scan without a health score.
11. As a founder, I want that summary not to emit progress percent, Goal health, success verdict, or completion status.
12. As a founder, I want Goal not to be a Milestone, Project Release, or Focus Period, so that aimed-for result stays distinct from intermediate result, ship scope, and time window.
13. As a founder, I want Goals reachable from Overview and planning views without a separate Project area, so that they do not invent a navigation type.
14. As a founder creating a Project, I want Goals to be optional after İlk Proje, so that a Blank Project is not blocked on a Goal.
15. As a founder, I want English UI `Project Goal`, `Intended outcome`, `Observed outcome / learning`, and `Contributes to Goal`.
16. As a founder using only a keyboard or a screen reader, I want to create a Goal, set contribution, and read the live summary.
17. As a founder, I do not want this feature to build the derived Value Chain view, auto-complete missing links, or hide unlinked work.
18. As a consuming feature (Value Chain), I want to select this Goal as chain anchor and read `Contributes to Goal` plus other explicit relations; I do not want Goals implemented inside the chain card.

## Implementation Decisions

- **Owning documents.** Record and fields: [Proje hedefleri](../../prd/04-workspace-and-projects.md#proje-hedefleri). Membership: [Hedefe katkı](../../prd/02-domain-model-and-lifecycle.md#standart-ilişki-türleri) / term [Hedefe katkı](../../prd/02-domain-model-and-lifecycle.md#terim-sözlüğü) `Contributes to Goal`. Goal is Proje-scoped ana kayıt with no open/closed life; results live in user fields ([ana kayıt türleri](../../prd/02-domain-model-and-lifecycle.md#ana-kayıt-türleri-ve-asgari-sözleşmeler)). Value Chain view is [Değer Zinciri](../../prd/04-workspace-and-projects.md#değer-zinciri) and workflow 67. No new ADR.
- **Glossary.** Use Proje Hedefi, Hedefe katkı (`Contributes to Goal`), İş, Kilometre Taşı, Proje Sürümü, Değer Zinciri (out of this feature). Avoid Key Result, Milestone-as-Goal, Release-as-Goal, Goal evidence, automatic goal progress, İlgili-as-contribution.
- **Goal module.** Title + description required for a useful record; intended and observed outcome optional free text. No metric watcher, no auto actuals, no goal tree rollup, no progress percent from members. No Key Result subtype.
- **Contributes to Goal.** Allowed ends: Work (any Work type, including Research and Feature), Milestone, Project Release → Project Goal. Many-to-many. Delete of an end leaves a historical bind. Does not write life or closure on either end. Decision, Kanıt bağı, test, Validation Record, Research Session cannot be this relation; they may be `İlgili` or sit on contributing Work/Release for the chain in 67.
- **Live summary.** Optional Goal detail: current status mix of contributing Research, Feature, Milestone; related open Risk and Open Question via their source links (not contribution). Neutral. No percent, health, success, or completion.
- **Navigation.** No Project area named Goals; Overview and planning views. Starter configurations must not seed fake Goals.
- **English UI labels.** `Project Goal`, `Intended outcome`, `Observed outcome / learning`, `Contributes to Goal` (already in the term table). Add the field labels when first shown.
- **Record delivery (#297).** `project_goal` owns title, required description, optional free-text outcomes, identity, revision, and timestamps. Create/edit use Mutation Contract (ADR-0004); content stays in PostgreSQL (ADR-0021). `Goals` opens from Overview at `/projects/$projectId#goals`; records open at `#project-goal-$goalId`. This is an Overview entry, never a configurable Project area. Record controls use `New Project Goal`, `Edit Project Goal`, `Title`, `Description`, `Save`, `Cancel`, and `Retry`. Archived Project records remain readable and reject writes. Testing Decisions below own all these boundaries. Contribution and live summary are subsequent issue slices.
- **Membership delivery (#298).** Project Goals owns `project_goal_relation`; its relation adapter uses the existing closed Relations catalog. `Contributes to Goal` and explicit `Related` binds use stable pair identities, revisions, and Mutation Contract receipts. Endpoint IDs have no cascading foreign keys; the Project owns cleanup, while individual endpoint deletion leaves historical membership. Only currently authorized sources in the Goal's Project can attach. Archived Projects remain readable and reject membership writes. The detail API returns current source links, distinct-member Research/Feature/Milestone status counts, and related nonterminal Risks / open Open Questions directly on the Goal or through contributing Work's explicit `Related` links. Removed, unavailable, archived, and trashed contributors do not contribute to live status counts; unavailable endpoints show `Unavailable source record` without a cached title. These boundaries are verified at the membership journey below.
- **Membership controls (#298).** Goal detail shows `Contributes to Goal`, `Related`, `Relation`, `Record`, `Select record`, `Add contribution`, `Remove contribution`, `Add relation`, `Remove relation`, `Live summary`, `Status distribution`, and `Open Risks and Open Questions`. Records are source links. Selection survives a failed save; a retry keeps the same idempotency key until the command succeeds or the payload changes. Read-only detail hides write controls. Testing Decisions below owns these labels and interaction paths.
- **Consumers.** 67 Value Chain selects a Goal as anchor. 16 Work Context may show the nearest Goal through existing relations without copying.

## Testing Decisions

- **What a good test is.** Tests observe Project Goals through create/edit of the record, `Contributes to Goal` attach/detach, live summary, and the absence of progress percent. They do not render the Value Chain graph.
- **Seam (one).** Project Goals — record and membership interface. Relation catalog is the domain relation adapter, not a second module.
- **Modules under test.** Project Goals only. Value Chain, Milestone life, Release life, Decision, evidence are counterparts (wrong relation rejected; chain not built).
- **Prior art.** Record contract: `packages/api/src/project-goals.test.ts`; authenticated RPC: `apps/server/src/features/project-goals/server/project-goals-rpc.test.ts`; PostgreSQL persistence: `apps/server/src/features/project-goals/server/project-goals-database.test.ts`; visible record/editor: `apps/web/src/features/project-goals/ui/components/project-goals-view.test.tsx`; browser journey: `apps/web/e2e/project-goals.e2e.ts`. Bind Goal records to [Değer Zinciri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as the anchor the chain will later read, and to [İlk Proje](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) as optional Project content that must not block Blank Project. 67 still owns the derived view’s E2E.
- **Record journey (#297).** At the Project Goals seam, verify optional empty Goals after Project creation, founder-written outcomes across create/edit/read, required title/description, rejected metric/Key Result/lifecycle/hierarchy fields, authenticated ownership, Project scope, stale revision rejection, idempotent create retry, archived Project writes rejected with readable records, and no derived percent/health. The browser journey verifies Overview navigation, stable record links, keyboard save, optional outcomes, persistence, cancel, failure text retention/retry, and accessible detail. Two-window editing holds the editor’s opening revision even after query refresh; a stale save displays `Conflict` and `Current value` without replacing the draft, and requires reopening before another save. Starter configurations keep no Goal seeding. Membership and live summary counterparts remain owned by later slices of this same seam.
- **Editor session identity (#297).** A retry within the same create editor retains the Goal identity, including after an unknown response. Cancel followed by `New Project Goal` begins a separate record identity; the browser journey verifies both records remain independently readable after a lost create response.
- **Membership journey (#298).** At the same Project Goals seam, API contract tests reject forbidden contribution endpoints and lifecycle fields; RPC tests verify authenticated attach/detail and anonymous rejection. `project-goal-membership-database.test.ts` verifies typed membership, many-to-many pairs, idempotent replay, stale revision rejection, unchanged member/Goal state, current status distribution, Related exclusion, source-linked open uncertainty, same-Project ownership, archived writes, and historical binding after endpoint deletion. `project-goals-view.test.tsx` verifies neutral source-linked detail, unavailable-source presentation, and the absence of derived percent/health/success. `project-goal-membership.e2e.ts` verifies keyboard attach, refresh persistence, failed-save selection retention/retry, Related exclusion, detach persistence, source navigation, and accessibility. No Value Chain graph is built.
- **Required counterparts.** No auto progress; Decision/evidence/test cannot `Contributes to Goal`; İlgili does not count; Key Result absent; member status unchanged.

## Out of Scope

- Değer Zinciri türetilmiş görünümü, hedefsiz parça bölümü, boşluk doldurma (67).
- Kilometre Taşı, Proje Sürümü, Odak Dönemi, Key Result veya otomatik ilerleme çubuğu.
- Karar/kanıt/testi Hedefe `Contributes to Goal` ile bağlama.
- Hedef sağlık puanı, başarı hükmü, üst-alt hedef birleştirme.

## Further Notes

- **Orient.** Glossary: Proje Hedefi, Hedefe katkı. Owning PRD: `docs/prd/04-workspace-and-projects.md` (Proje hedefleri) plus PRD 02 Hedefe katkı. ADRs in play: none owning. Related: PRD 16 Değer Zinciri / İlk Proje, workflow 67.
- **Acceptance.** Goal as selectable anchor and typed membership bind to Değer Zinciri; the chain’s missing-link and unlinked-work E2E stay on 67. İlk Proje must still open without a Goal.
- **Consumers.** 67 reads these records. Do not implement the chain here.
