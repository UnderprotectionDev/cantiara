# Kararlar

Kaynak: [`docs/workflow/38-decisions/phase-context.md`](../../workflow/38-decisions/phase-context.md)

## Problem Statement

Kurucu alınmış ürün, tasarım ve geliştirme seçimini gerekçesi ve ilişkileriyle kaybetmeden tutmak ister. Bugün güncel hüküm ile yerine geçmiş gerekçe aramada ve dış görünürlükte karışır; çoklu halef veya döngü zinciri okunamaz kılar; İş kapanması Kararı sessizce geri çekmiş gibi durabilir. Spec inceleme kuyruğu, Risk ve Varsayım bu zinciri örtük yazmamalıdır.

## Solution

Karar Proje ana kaydıdır; yaşam `Valid`, `Superseded`, `Withdrawn`. `Supersede another decision` yeni geçerli Kararı eski kaydın doğrudan ve tek halefi yapar; işlem atomiktir, döngü ve çelişkili fork reddedilir. Arama, `All Decisions` ve dış görünürlük varsayılanı güncel `Valid` karardır; yerine geçmiş kayıt silinmez, tarihsel kalır. Yayımlanmış Karar yeni geçişle sessizce güncellenmez.

## User Stories

1. As a founder, I want a Decision with title, decision text, and rationale, so that an important choice is a record, not a meeting note.
2. As a founder, I want to describe alternatives inside rationale and use standard relations to existing records, so that I do not need a scored option set.
3. As a founder, I want life `Valid`, `Superseded`, or `Withdrawn`, so that current versus historical is explicit.
4. As a founder, I want imported or missing status to read as `Valid`, so that old rows are not silently withdrawn.
5. As a founder, I want `Withdrawn` to mean I no longer keep the choice in force, with optional dated rationale, without requiring a successor.
6. As a founder, I want `Superseded` only through the explicit supersession relation, so that I cannot mark a Decision superseded with no successor.
7. As a founder, I want `Supersede another decision` to preview new and old rationale/evidence, lives that will change, and optional transition rationale before an atomic commit, so that I never see two current Decisions for that replacement.
8. As a founder, I want each old Decision to have at most one direct successor, while one new Decision may fully replace several compatible old ones in that same commit.
9. As a founder, I want self-links, cycles, and contradictory forks rejected before apply, so that the graph stays a readable chain.
10. As a founder changing only part of a Decision, I want to write a new Decision and `İlgili` rather than full supersession, so that partial change is not fake replacement.
11. As a founder, I want Decision detail to show the chronological chain from the oldest record to the current `Valid` Decision, so that I can see why it changed.
12. As a founder opening a `Superseded` Decision, I want the current direct/final Decision, transition time, rationale, and `Open current decision` in the header, with old content, evidence roles, comments, relations, and history still readable.
13. As a founder, I want Search and `All Decisions` to put `Valid` Decisions first, with old and withdrawn findable via status filter, so that historical rationale is not presented as current.
14. As a founder, I want supersession not to copy or move the old Decision’s Work, Feature, Risk, Assumption, Open Question, test, Project Release, Document, GitHub, or other relations onto the new Decision.
15. As a founder, I want those related records’ status, priority, content, planning, automation, and notifications unchanged by supersession.
16. As a founder, I want a `Contradicting` evidence role not to start supersession or suggest a new Decision.
17. As a founder removing the supersession relation, I want a preview of the chain and lives, and the old Decision to become `Valid` only if it has no other direct successor, with explicit confirm; the new Decision is not deleted.
18. As a founder, I want create, supersede, withdraw, and remove-relation events in change history with actor, time, rationale, and before/after.
19. As a founder, I want Work closing not to withdraw a Decision, so that a shipping event is not a silent governance change.
20. As a founder sharing or publishing, I want old Decision, current Decision, and the supersession relation previewed separately in closed world; a previously published Decision must not silently update or redirect when superseded — a new snapshot needs explicit diff and approve.
21. As a founder, I want supported JSON import/export to keep identities, lives, acyclic chain, and transition events, without this feature shipping the export UI.
22. As a founder, I want English UI `Decision`, `Valid`, `Superseded`, `Withdrawn`, `Supersede another decision`, `Open current decision`, `All Decisions`.
23. As a founder using only a keyboard or a screen reader, I want to create, withdraw, supersede, and walk the chain.
24. As a founder, I do not want a structured alternative set, voting, scoring, or automatic winner.
25. As a founder, I do not want this feature to open Spec change review (52), write Risk or Assumption life, or treat a Decision as a Document paragraph.
26. As a consuming public surface, I want the default shown Decision to be the current `Valid` one unless the snapshot explicitly included a historical record.

## Implementation Decisions

- **Owning documents.** [Karar kayıtları](../../prd/09-discovery-decisions-and-design.md#karar-kayıtları). Lives and relation `Yerine geçer` / `Yerine geçildi` in [PRD 02](../../prd/02-domain-model-and-lifecycle.md). Atomic commit: [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) and [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik) (base revision + idempotency). Published snapshot must not silently move: [ADR-0001](../../adr/0001-dis-yuzey-ve-snapshot-kimligi.md). Visitor access is not this record: [ADR-0002](../../adr/0002-dis-erisim-guvenlik-siniri.md). Spec review is 52. No new ADR.
- **Glossary.** Use Karar, `Valid` / `Superseded` / `Withdrawn`, `Yerine geçer`. Avoid meeting note, Document paragraph, vote, automatic winner, MFA-style confirmation, spec-review-as-supersession.
- **Decision module.** Project-scoped ana kayıt: title, decision, rationale. Lives: `Valid`, `Superseded`, `Withdrawn`. `Superseded` only via the relation. `Withdrawn` is user choice without successor. Missing status → `Valid`.
- **Supersession.** Preview then one atomic commit: directed relation, old rows `Superseded`, at most one direct successor per old Decision; one new Decision may replace many compatible old ones. Reject self, cycle, conflicting fork. Partial change uses `İlgili`, not this relation. Idempotent retry returns the same receipt. Decision date and transition event time stay distinct.
- **Non-cascade.** No copy/move of related records. No status write on Work/Release/Risk/Assumption. `Contradicting` Kanıt Rolü does not start this flow. Work close does not withdraw.
- **Chain and defaults.** Detail shows oldest → current Valid. Superseded header: current Decision, transition, `Open current decision`. Search and `All Decisions` default Valid; filters find others. Public/share preview treats old, current, and relation as separate closed-world items; existing approved snapshot does not retarget on supersession.
- **English UI labels.** `Decision`, `Valid`, `Superseded`, `Withdrawn`, `Supersede another decision`, `Open current decision`, `All Decisions`. Add to the term table when first shown.
- **Consumers.** Sharing/public (73/75) preview separately. 52 does not listen to supersession. 40/41 do not write this chain.

## Testing Decisions

- **What a good test is.** Tests observe Decisions through create, withdraw, supersede preview/commit, cycle/fork reject, search default, and “related Work status unchanged”. They do not assert spec-review queue rows or Risk auto-close.
- **Seam (one).** Decisions — product-facing Decision interface including supersession. Relation store is behind that interface.
- **Modules under test.** Decisions only. Spec review, Risk, Assumption, sharing snapshot apply are counterparts.
- **Prior art.** No suite yet. Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): acyclic replacement; related records’ status does not change implicitly. Negative: no voting/scoring (19).
- **Required counterparts.** Two current Decisions after replace impossible; cycle rejected; Work close does not withdraw; published snapshot not silently updated; Search default is Valid.

## Out of Scope

- Yapılandırılmış alternatif seti, oylama, puanlama, otomatik kazanan (19).
- Spec değişikliği inceleme kuyruğu (52).
- Risk, Varsayım veya İş yaşamını Karar geçişiyle yazma.
- Paylaşım/yayın UI’si; bu feature yalnız varsayılan güncel Karar invariant’ını sağlar.
- Kararı toplantı notu veya Belge paragrafı sayma.

## Further Notes

- **Orient.** Glossary: Karar. Owning PRD: `docs/prd/09-discovery-decisions-and-design.md` (Karar kayıtları). ADRs in play: 0004 (atomic supersession), 0001 (snapshot does not silently retarget), 0002 (visitor is not founder write). Related: PRD 16 Karar ve belirsizlik, PRD 02 lives/relations, workflow 52.
- **Acceptance.** Bind to [Karar ve belirsizlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Consumers.** Public/share features must default current Valid Decision in new snapshots; they apply ADR-0001 for already-approved ones.
