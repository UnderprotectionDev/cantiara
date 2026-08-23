# Test Değerlendirmesi

Kaynak: [`docs/workflow/56-test-assessments/phase-context.md`](../../workflow/56-test-assessments/phase-context.md)

## Problem Statement

Kurucu seçili Özellik, Handoff veya Proje Sürümü bağlamındaki test kayıtlarını belirli bir anda nasıl yorumladığını tarihli tutmak ister. Bugün değerlendirme yayın kapısı, kalite skoru veya Test Oturumu sonucu sanılabilir; yeni sonuç eski snapshot'ı sessizce güncelleyebilir veya yeni sürüme taşıyabilir. Test Açığı 55, inceleme 57, Sürüm Kanıt Paketi 64'tedir. Kullanıcı değerlendirme olmadan Sürüm yayımlayabilir.

## Solution

Kurucu Test değerlendirmesini isteğe bağlı tarihsel snapshot olarak kaydeder: incelenen kesin Test Oturumları, açık Test Açıkları, takip işleri, bilinen sınırlamalar, değerlendiren, zaman, ve `Acceptable` / `Follow-up needed` / `Undecided`. Snapshot yeniden yazılmaz. Sonraki yeni veya düzeltilmiş sonuç, yeni açık veya bağlam değişince ürün `New test context after this assessment` dikkatini ve kesin kaynakları gösterir; eski hükmü güncel gerçek gibi sunmaz ve yeni sürüme otomatik taşımaz. Coverage, skor veya otomatik kapı üretmez.

## User Stories

1. As a founder, I want an optional Test Assessment snapshot for a chosen Feature, Handoff, or Project Release context, so that my reading of the tests at a moment is dated.
2. As a founder, I want the snapshot to carry the exact Test Sessions reviewed, open Test Gaps, follow-up Work, known limits, assessor, time, and `Acceptable` / `Follow-up needed` / `Undecided`.
3. As a founder, I want an Assessment never to be a quality score, automatic readiness ruling, test exception, or release gate.
4. As a founder, I want to publish a Project Release without creating an Assessment, so that the snapshot cannot become a hidden required step.
5. As a founder, after I save an Assessment, I want later new or corrected results, new Gaps, or related context changes not to rewrite the snapshot.
6. As a founder in that situation, I want a visible `New test context after this assessment` notice with exact sources, so that old judgment is not shown as current truth.
7. As a founder, I want an old snapshot never silently moved onto a new Feature, Handoff, or Project Release version.
8. As a founder, I want an Assessment not to be a Test Session result and not to rewrite session or item review states.
9. As a founder, I want an Assessment not to mint missing evidence or convert a reported session into Ürün kabul kanıtı (ADR-0007).
10. As a founder, I want English UI `Test Assessment`, `Acceptable`, `Follow-up needed`, `Undecided`.
11. As a founder using only a keyboard or a screen reader, I want to record a snapshot and still read the “new context” notice later.
12. As a founder, I do not want this feature to close Test Gaps, accept reports, or run the Version Evidence Pack.
13. As a founder, I want the Tests area to list recent Assessments as the same records, not as a live scoreboard or phase.
14. As a founder opening an old Assessment after a new `Failed` result, I want the snapshot still `Acceptable` if that is what I saved, plus the new-context notice — never a rewritten decision or a blocked Release.
15. As a founder, I want Feature and Project Release test summaries to show the last Assessment as a live record with its date and decision, not as a current quality score.
16. As a founder, I want Assessments to join Universal Search, Table, and Smart Collections, with the historical decision uneditable from Table cells.
17. As a founder archiving an Assessment, I want the snapshot bytes and cited session/Gap ids kept; archive must not rewrite those sessions.
18. As a founder, I want share or public publish never to include an Assessment through a relation; the snapshot, notes, and cited evidence are closed-world items (73/75).
19. As a founder, I want GitHub checks to stay a separate external fact in summaries, never auto-copied into this snapshot.
20. As a founder, I do not want time passing or unrelated new commits, by themselves, to mark an Assessment stale; only recorded new test context (new/corrected session, new Gap, or related bound context change) shows the notice.
21. As a founder, I want the Tests area `Recent Test Assessments` section to list the same snapshot records, not a live scoreboard.

## Implementation Decisions

- **Owning documents.** [Test değerlendirmesi](../../prd/10-testing-and-validation.md#test-değerlendirmesi). Reported session is not release proof [ADR-0007](../../adr/0007-surum-kaniti-guven-modeli.md). Sürüm Kanıt Paketi is PRD 12 / workflow 64. Review states are 57. No new ADR. If a dedicated attention signal id is later registered in PRD 04 for post-assessment context, emit only that registered id; until then the notice is on the Assessment record itself and must not invent an unregistered Notification Center signal (PRD 04: unregistered signals cannot be produced).
- **Glossary.** Use Test değerlendirmesi, Test Oturumu, Test Açığı, Proje Sürümü, Ürün kabul kanıtı (must not be this). Do not introduce readiness score, coverage %, or auto-carried snapshot.
- **Dated snapshot.** Optional. Context is one Feature, one Handoff, or one Project Release. Stores exact session ids, open Gaps, follow-up Work, limits, assessor, time, decision enum. Immutable after save (no silent rewrite).
- **New context.** New/corrected results, new Gaps, or related context change leave the snapshot bytes alone and show `New test context after this assessment` with exact sources on that Assessment. Do not auto-copy the snapshot onto a new release/feature/handoff version.
- **Not a gate.** Founder may publish without an Assessment. Assessment does not write Test Session results or review states, does not close Gaps, does not compute coverage, does not become Ürün kabul kanıtı. Feature/Release summaries may show the last snapshot with its date; they must not present it as current score or GitHub-check rollup.
- **Findability.** Assessments join search, Table (decision not inline-editable as a live field), Smart Collections, and the Tests-area recent list. Archive keeps cited ids. Sharing is closed-world per snapshot (not this feature’s share UI).
- **Staleness.** Only recorded new test context (new/corrected session, new Gap, or related bound context change) raises the notice. Clock time and unrelated repository commits do not.
- **English UI.** Labels in stories; missing terms join the table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Test Assessments through the public interface: save snapshot with exact ids and decision, later Failed result does not rewrite decision, new-context notice lists those sources, new Project Release does not inherit the old snapshot, publish without Assessment remains allowed, no score field. Not Prisma shapes.
- **Seam (one).** Test Assessments — the product-facing snapshot write/read and new-context notice interface.
- **Modules under test.** Test Assessments only. Report accept, review, gaps, Version Evidence Pack, release publish are counterparts.
- **Prior art.** Bind to [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (assessment does not silently update old judgment). Grill scenario 14 in PRD 10 is a required counterpart.
- **Required counterparts.** Auto-carry to new release absent; score/gate absent; Gap auto-close absent; reported session not converted to Ürün kabul kanıtı; GitHub checks not copied into the snapshot.

## Out of Scope

- Test Açığı kapanışı, rapor kabulü, inceleme yaşamı.
- Sürüm Kanıt Paketi ve yayın kapısı.
- GitHub check rollup'ını snapshot'a kopyalama (61).
- Coverage, kalite skoru, otomatik readiness.

## Further Notes

- **Orient.** Glossary: Test değerlendirmesi, Test Oturumu, Ürün kabul kanıtı. Owning PRD: `docs/prd/10-testing-and-validation.md` (`#test-değerlendirmesi`). ADRs: 0007. Related: PRD 16 Test geçmişi, PRD 12 Version Evidence Pack (64).
- **Acceptance.** [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): dated snapshot, no silent move, no gate.
- **Consumers.** `64-release-evidence` may show an Assessment as context without treating it as a gate; `57` must not rewrite snapshots; `63-release-planning` must allow publish without one.
