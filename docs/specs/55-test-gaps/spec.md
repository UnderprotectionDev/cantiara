# Test Açığı

Kaynak: [`docs/workflow/55-test-gaps/phase-context.md`](../../workflow/55-test-gaps/phase-context.md)

## Problem Statement

Kurucu henüz denenmediğini veya yetersiz doğrulandığını düşündüğü alanı başlık, gerekçe ve dayanaklarla kaydetmek ister. Bugün başarısız test, eksik senaryo, spec değişikliği veya benzerlik otomatik açık üretebilir; açık Bug, Risk veya Ürün Boşluğu sanılabilir; kapanış coverage yüzdesine indirgenebilir; Tests alanı bir faz veya test ürünü olabilir. Rapor kabulü 54, inceleme 57, değerlendirme 56'dadır.

## Solution

Kurucu Test Açığını Özellik/İş/spec bölümü/Risk/Proje Sürümü gibi dayanak ilişkileriyle hafif Proje ana kaydı olarak tutar. Sistem otomatik açık üretmez. Durumlar `Open`, `Planned`, `Met by result`, `Not needed`'dir. Bir senaryo veya Handoff'a bağlanmak açığı en fazla `Planned` yapar; yeni sonuç kendiliğinden kapatmaz. `Met by result` seçilen kesin Oturum Testlerini ve isteğe bağlı gerekçeyi ister. Kapanış kaydı silmez. Tests alanı bu kaydı gösterir; sahip faz veya ayrı test ürünü değildir.

## User Stories

1. As a founder, I want a Test Gap with title, rationale, and support relations (Feature, Work, spec section, Risk, Project Release), so that an untested area is an explicit record rather than a vibe.
2. As a founder, I want the product never to auto-create a Gap from a missing case relation, failed test, executor note, spec change, GitHub check, or semantic similarity.
3. As a founder, I want Gap statuses `Open`, `Planned`, `Met by result`, and `Not needed`.
4. As a founder linking a Gap to a Planned Test Case or Handoff, I want status at most `Planned`, so that planning is not completion.
5. As a founder when a new result arrives, I want the Gap to stay open until I close it, so that a report cannot quietly tick coverage.
6. As a founder choosing `Met by result`, I want to select the exact Session Tests that meet it, plus optional rationale, so that closure is a cited set rather than a percentage.
7. As a founder choosing `Not needed`, I want rationale and an optional related Decision kept, so that declining a gap is explained.
8. As a founder, I want closure not to delete the Gap; exact relations and my decision stay in history.
9. As a founder, I want a Gap never to be a failed test, Bug, Work, mandatory scope, or a blocker of a Ürün sürüm adayı by itself.
10. As a founder, I want a Gap never reduced to a coverage percentage or quality score.
11. As a founder, I want the Tests area to list Gaps among other test records as a management view, not as a phase, product, or second truth.
12. As a founder, I want English UI `Test Gap`, `Open`, `Planned`, `Met by result`, `Not needed`.
13. As a founder using only a keyboard or a screen reader, I want to file a Gap and close it by selecting Session Tests.
14. As a founder, I do not want this feature to accept reports, review sessions, or write Test Assessments.
15. As a founder, I do not want a Gap to be a Product Gap, Risk, or Bug record type.
16. As an external report claiming it addresses a Gap via allow-listed relation, I want that relation not to set `Met by result` (54 already forbids it); only my selected Session Tests close it here.
17. As a founder, I want the Tests area `Open and planned Test Gaps` count to open the exact Gap set that produced the number, so that a count is not a coverage ratio.
18. As a founder, I want Gaps to participate in Universal Search, Table, and Smart Collections like other Project masters, so that an untested area is findable without a second index.
19. As a founder archiving a Gap, I want identity, versions, relations, and history kept, and other records’ results untouched.
20. As a founder, I want share or public publish never to reveal a Gap through a relation; each Gap is closed-world previewed on its own (73/75).
21. As a founder, I want a Gap bind to Feature, Work, spec section, Risk, or Project Release not to write that target’s status, priority, or publish fitness.
22. As a founder looking at a Feature or Project Release test summary, I want open Gaps listed as live records with sources, not as a missing-coverage score.
23. As a founder, I do not want spec-change review (52) or a failed Session Test (54/57) to file a Gap for me.

## Implementation Decisions

- **Owning documents.** [Test Açığı](../../prd/10-testing-and-validation.md#test-açığı). Tests area listing [Proje Testleri alanı](../../prd/10-testing-and-validation.md#proje-testleri-alanı). Auto-create prohibition also in [takip işi](../../prd/10-testing-and-validation.md#takip-işi-ve-ilişkili-kayıtlar) and grill scenario 8. Product Gap is a different Workspace record (PRD 08 / glossary). No new ADR.
- **Glossary.** Use Test Açığı, Oturum Testi, Ürün Boşluğu (forbidden substitute), Bug (forbidden substitute), Risk (forbidden substitute). Do not introduce coverage score, auto-gap, or Tests-as-phase.
- **Record.** Project master record. Title, rationale, support relations. Not created by the system from failure, missing bind, spec change, check, or similarity.
- **States.** `Open` / `Planned` / `Met by result` / `Not needed`. Case or Handoff bind → at most `Planned`. Incoming session → no auto-close. `Met by result` requires selected exact Session Tests (+ optional rationale). `Not needed` keeps rationale and optional Decision. Close does not delete.
- **Not a gate.** Gap does not block Project Release or Ürün sürüm adayı. It is not coverage %. Default Tests-area section `Open and planned Test Gaps` is derived from the same records; the count opens that exact set.
- **Tests area.** Optional Project area lists these records with sessions/gaps/assessments as a management view, not a phase and not a second truth. This feature does not own Tests-area lifecycle; it must not invent a runner dashboard.
- **Findability.** Gaps join Universal Search, type Table, and Smart Collections. Archive keeps identity and relations; it does not rewrite other sessions’ results. Sharing/publishing is closed-world per record (not this feature’s share UI).
- **Relations.** Support binds to Feature, Work, spec section, Risk, or Project Release do not write those targets. A Handoff or Planned Test Case bind is planning, not `Met by result`.
- **English UI.** Labels in stories; missing terms join the table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Test Gaps through the public interface: create with relations, no auto-create from failed Session Test fixture, bind to Handoff sets Planned not Met, incoming report leaves Open, Met by result requires selected Session Tests, Not needed keeps rationale, not a coverage field. Not Prisma shapes.
- **Seam (one).** Test Gaps — the product-facing Gap record and manual close interface.
- **Modules under test.** Test Gaps only. Report accept, review, assessments, Product Gap, Bug are counterparts.
- **Prior art.** Bind to [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (Gap does not auto-spawn from failure; close via selected Session Tests).
- **Required counterparts.** Auto-create from failure absent; untested/under-validated area is an explicit Gap record; report relation does not close; Tests area is not owner/phase; Gap is not Product Gap/Bug/Risk; count is not coverage %; spec-change queue does not file Gaps.

## Out of Scope

- Rapor kabulü, inceleme, Test değerlendirmesi.
- Ürün Boşluğu, Bug, Risk kayıt türleri.
- Coverage motoru, otomatik açık, yayın kapısı.

## Further Notes

- **Orient.** Glossary: Test Açığı, Oturum Testi, Ürün Boşluğu (avoid). Owning PRD: `docs/prd/10-testing-and-validation.md` (`#test-açığı`). ADRs: none. Related: PRD 16 Test geçmişi, PRD 19 Tests area is not a runner.
- **Acceptance.** [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): open/close matrix, no auto-create.
- **Consumers.** `54` may allow-list a Gap relation without closing it; `53` Handoff bind can set Planned; `57` review must not auto-file Gaps; `56` may list open Gaps as snapshot inputs without closing them.
