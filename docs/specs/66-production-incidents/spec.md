# Üretim Olayı Öğrenimi

## Problem Statement

Kurucu yayımlanmış üründeki önemli operasyonel olayı Bug'dan ayrı, zaman çizgisi ve öğrenimle kaydetmek ve Bug, PR, Sürüm, Risk ve Karara bağlamak ister. Bugün bu ya pager/S1 işletim zinciri (85) ya da otomatik Bug/Risk olur. Takip İşi önizlemesiz doğar. Canlı incident müdahalesi bu sorunun parçası değildir.

## Solution

Kurucu Proje ana kaydı Üretim Olayını `Open`, `Watching`, veya `Resolved` ile yönetir. Kayıt zaman, etki, nasıl fark edildiği, nasıl çözüldüğü, kök neden ve öğrenim bağlamını tutabilir; ilgili Bug, GitHub PR, Proje Sürümü, Risk ve Karara bağlanır. Sistem pager, Slack koordinasyonu, nöbet, downtime takibi, TTD/TTI/TTR veya güvenilirlik dashboard'u açmaz. Sentry'den otomatik olay yoktur. Takip İşi yalnız açık eylem ve oluşacak kaynak ilişkilerinin önizlemesiyle oluşur. 85 hizmet S1 alarmı ayrıdır.

## User Stories

1. As a founder, I want a Proje-scoped Üretim Olayı distinct from a Bug İş, so that post-incident learning is not another ticket type.
2. As a founder, I want fields for when, user/system impact, how it was detected, how it was resolved, root cause, and learning, so that the timeline is a record, not a chat.
3. As a founder, I want status `Open`, `Watching`, `Resolved` without those statuses paging anyone.
4. As a founder, I want to relate the event to Bug, GitHub PR, Proje Sürümü, Risk, and Karar, so that learning is source-linked.
5. As a founder, I do not want the product to become a pager, on-call, status page, or incident-command platform.
6. As a founder, I do not want 85 operator S1 alarms (5-minute detection, fail-closed) to write this record, so that service ops and product learning stay separate.
7. As a founder, I do not want Sentry or error events to auto-create Üretim Olayı (19).
8. As a founder, I do not want the event to auto-create a Bug or Risk.
9. As a founder, I want `Create follow-up work` only with a preview of the Work that will be created and the relations that will be set, so that origin is explicit.
10. As a founder, I want English UI `Production Incident`, `Open`, `Watching`, `Resolved`, `Create follow-up work`.
11. As a founder, I do not want TTD/TTI/TTR or reliability trend charts on this record.
12. As a founder, I want the 18 Üretim Olayı Önleme Zinciri not to be implemented here.

## Implementation Decisions

- **Owning documents.** [Üretim Olayları](../../prd/12-github-and-project-releases.md#uretim-olaylari). Lifecycle: PRD 02 table. 85 is operator backup/alarms — not this record. 19 bans Sentry auto-create. No new ADR.
- **Glossary.** Üretim Olayı (record). Avoid: Üretim Olayı Önleme Zinciri (18), pager, S1 as this card, Destek oyun kitabı (18).
- **One seam.** Production Incidents — CRUD event, relations, previewed follow-up Work. Does not subscribe to Better Stack/S1. Does not call 23 completion effects just because a Bug is filed.
- **English UI.** `Production Incident`, `Open`, `Watching`, `Resolved`. Add missing labels with first display. PRD 02 Turkish statuses `Açık`, `İzleniyor`, `Çözüldü` map to those English labels.

## Testing Decisions

- **What a good test is.** Tests observe Production Incidents through create, bind Bug/PR/Release/Risk/Karar, and previewed follow-up Work. They go red if an S1 alarm double or Sentry event mints the record, if follow-up Work is created without preview, or if the type is a Bug. They do not assert pager adapters.
- **Seam (one).** Production Incidents — CRUD event, relations, previewed follow-up Work.
- **Modules under test.** Production Incidents only.
- **Prior art.** First contract tests at this seam. Synthetic [Üretim olayı öğrenimi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** Not pager/S1; not Sentry; follow-up without preview rejected; not auto Bug/Risk.
- **Incident record and link evidence (#459).** `apps/server/src/features/production-incidents/server/tests/` holds the seam: `production-incidents.test.ts` (a Bug is only a Work of type `Bug`, a GitHub PR is only a pull request, the stable link id, and no alarm, Sentry or pager input in the feature or any server module that handles one), `production-incidents-rpc.test.ts` (exactly `productionIncidents`, `productionIncidentDetail` and `setProductionIncidentLink`; strict human commands) and `production-incidents-database.integration.test.ts` (bind Bug, GitHub PR, Project Release, Risk and Karar, cross-Project and cross-Account rejection, linked records and incident status unchanged; creating an incident without a Bug, Risk or Work is the new case in `project-source-records-database.integration.test.ts`). The contract test `packages/api/src/production-incidents.test.ts` keeps the record a separate type with no paging, timing or score column.
- **Follow-up Work evidence (#460).** The same seam files cover it: `production-incidents.test.ts` (the preview names the one Work and the `Origin` relation, a Bug only when chosen, the fingerprint changes with the choice, incident revision or status), `production-incidents-rpc.test.ts` (commit schema rejects a missing or empty `previewFingerprint`; a stale preview is a `PREVIEW_STALE` conflict) and `production-incidents-database.integration.test.ts` (the preview writes nothing, a commit without the matching preview is rejected, an approved commit creates exactly one Work with the incident as Origin and leaves the incident row and status unchanged, a changed incident makes the commit stale). The web dialog and preview are covered under `apps/web/src/features/production-incidents/ui/`.
- **Daily Focus source-record evidence.** `server/tests/project-source-records-database.integration.test.ts` checks `Open` → `Watching` → `Resolved` mutation history and Account-scoped reads; the source module does not subscribe to pager or Sentry inputs.

## Out of Scope

- Operatör yedek, RPO/RTO, S1 alarm, Better Stack — 85.
- İşletim S1 zincirini bu kayıtla karıştırma: 85 alarmı bu kaydı yazmaz; bu kayıt pager veya on-call olmaz.
- Risk kaydı semantiği — 40.
- Bug İş türü yaşamı — 09.
- GitHub PR yazma — 61/19.
- Üretim Olayı Önleme Zinciri — 18.
- Status page, Slack incident channel, on-call rota.

## Further Notes

- **Orient.** Glossary: Üretim Olayı. Owning PRD: 12 `#uretim-olaylari`. ADR: none. Journey: **Üretim olayı öğrenimi** (synthetic). Related: PRD 16, PRD 19 Sentry, workflow 85.
- **Acceptance.** [Üretim olayı öğrenimi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): distinct from Bug, relations kept, follow-up only with preview, no live incident platform.
