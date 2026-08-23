# Planlı Test ve Handoff

Kaynak: [`docs/workflow/53-test-plan-and-handoff/phase-context.md`](../../workflow/53-test-plan-and-handoff/phase-context.md)

## Problem Statement

Kurucu yeniden kullanılabilir test niyetini sürümlü tutmak ve dış yürütücüye donmuş bir paket vermek ister. Bugün senaryo Test Oturumu veya Handoff paketi sanılabilir; senaryo düzenlemek geçmiş oturumu yeniden yazabilir; Handoff CI orkestratörü veya test runner olabilir; paket İşteki dış yürütme devriyle karışabilir. Ürün testi başlatmaz. Rapor kabulü 54, inceleme 57, açık 55, değerlendirme 56'dadır. Dış yürütme devri 24'tedir.

## Solution

Kurucu Planlı Test Senaryosunu başlık, amaç, kapsam, önkoşul, beklenen davranış, isteğe bağlı not ve ilişkilerle sürümler. Bağlanan Test Oturumu tam olarak seçilen senaryo sürümünü tarihsel korur; sonraki editoryal değişiklik geçmiş sonucu yeni tanıma taşımaz. Test Handoff'u amaç, seçilmiş kesin senaryo sürümleri, isteğe bağlı hedef tarih ve yürütücü, teknik bağlam ve paket sürümünü ayrı süreç yaşamında tutar. Markdown ve JSON aynı Handoff kaydından aynı paket sürümüyle üretilir. Ürün testi başlatmaz, izlemez veya uzaktan koşturmaz.

## User Stories

1. As a founder, I want a versioned Planned Test Case with title, purpose, scope, preconditions, expected behavior, optional notes, and relations, so that intent is reusable without running tests.
2. As a founder, I want a case never to be a live step runner, never to carry results, and never to mark a Feature or Release validated by existing.
3. As a founder changing a case meaningfully, I want a new version, so that history stays explainable.
4. As a founder, I want a Session Test that is bound, if at all, to an exact case version, so that later title/scope/expected edits cannot show old results as proving the new definition.
5. As a founder making a merely editorial change, I still want the bind not to move silently; the version difference stays visible.
6. As a founder recording an ad hoc Session Test, I want it allowed without a Planned Test Case, with then-current purpose and expected behavior stored on the Session Test.
7. As a founder later linking that ad hoc test to a Planned Test Case, I want past content not rewritten and the new case version not treated as already executed.
8. As a founder, I want a Test Handoff as a light historical Project record of requested external test work and returning sessions, not as a Test Session and not as a runner.
9. As a founder, I want a Handoff to carry purpose/scope, selected exact Planned Test Case versions, optional due date, target executor, technical context, produced package version, and arriving Test Sessions.
10. As a founder, I want executor to be me, Codex, Claude Code, Conductor, or a freely named external tool, so that the product does not ship a closed vendor list as a runtime.
11. As a founder, I want Handoff states `Draft`, `Ready to share`, `Shared`, `Result received`, `Closed`, `Canceled` to describe the handoff process, not the test result.
12. As a founder, I want the product to be allowed to suggest `Result received` when a bound report arrives, and never to auto-close the Handoff.
13. As a founder producing the Markdown/JSON package, I want only the closed package contract: `handoff_id` with incrementing `handoff_package_version`, project, title/purpose, `created_at`, filled `product_build_context` fields only, `scenarios[]` with id+version and copied intent fields, `ad_hoc_scope[]` as my text, selected work/document/design refs as exact versions, `environment_preconditions` as my text, and `return_instructions` naming `test-report/1`.
14. As a founder, I want Markdown and JSON to be two renderings of the same Handoff record and package version, with no extra scenario or relation in one side.
15. As a founder, I want a produced package to stay a snapshot: later case/spec/Screen edits do not update the copy outside; I make a new package version or a new Handoff.
16. As a founder, I want the package to contain no secrets, tokens, credentials, records I cannot access, unselected relations, redacted values, or unapproved attachments, using closed-world preview/confirm.
17. As a founder, I want producing or giving the package never to start, poll, cancel, or authorize an external tool, and never to grant write-back; knowing the id is not delivery permission.
18. As a founder, I want this package to stay a different contract from Work's external execution handoff (24), so that coding context cannot define formal test scope or mint a Test Session.
19. As a founder, I want the product never to start, schedule, query, or control tests, CI, browsers, devices, or scanners.
20. As a founder needing a reminder, I want ordinary source-linked reminder behavior, not a runner SLA.
21. As a founder using separate Handoffs when the same cases go to different executors, I want process and context not to mix.
22. As a founder, I want English UI `Planned Test Case`, `Test Handoff`, `Tests`, `Draft`, `Ready to share`, `Shared`, `Result received`, `Closed`, `Canceled`.
23. As a founder, I want the Tests area to show these records among others without becoming a phase or a test-runner product.
24. As a founder using only a keyboard or a screen reader, I want to version a case, open a Handoff, and produce the package.
25. As a founder, I do not want a case to be a Work checklist, Test Session, or Handoff package.
26. As a founder, I do not want this feature to accept reports (54), review them (57), open Test Gaps (55), or score releases (56).

## Implementation Decisions

- **Owning documents.** [Planlı Test Senaryosu](../../prd/10-testing-and-validation.md#planlı-test-senaryosu-ve-sürümleri), [Test Handoff'u](../../prd/10-testing-and-validation.md#test-handoffu), [Test Handoff paketi sözleşmesi](../../prd/10-testing-and-validation.md#test-handoff-paketi). Product-does-not-run-tests is [ürün sınırı](../../prd/10-testing-and-validation.md#ürün-sınırı-ve-yönetim-amacı) and [PRD 19](../../prd/19-out-of-scope.md). External execution handoff is ADR-0015 / workflow 24. Return envelope `test-report/1` is owned by 54; this feature only names it in `return_instructions`. No new ADR.
- **Glossary.** Use Planlı Test Senaryosu, Test Handoff'u, Test Oturumu (arrives later), Oturum Testi, Dış yürütme devri (forbidden substitute). Do not introduce test runner, CI orchestrator, release artifact, or Work checklist-as-case.
- **Planned Test Case.** Project master record, versioned on meaningful change. Editorial change still must not silently move historical binds. Does not run, does not hold results, does not validate a Feature/Release. Ad hoc Session Tests may exist without a case (write path is 54's manual form); this feature's rule is that a later bind must not rewrite past content or treat the new version as already run.
- **Handoff lifecycle.** Separate from Test Session. States describe process. Suggest `Result received` on bound report; never auto-close. One Handoff per executor context when the same cases are split.
- **Package contract.** Closed table in PRD 10. No extra record types. Exact versions only — never `latest`. `product_build_context` is founder-typed; the product does not read GitHub/CI to fill it. `ad_hoc_scope[]` does not mint case ids. `design_references[]` are exact Screen/Wireframe/Technical Diagram versions if the founder added them. `return_instructions` require `schema_version`, `project_id`, `external_session_id`, `executor`, `reported_at`, this `handoff_id`, per-result `external_test_id` and `scenario_id`/`scenario_version` when applied, optional context/summary/raw_report/notes/evidence/relations, and `test-report/1` as the only structured return.
- **Does not run tests.** No start, schedule, poll, remote cancel, or command. Package identity is not a write grant. Secrets never enter the package.
- **Tests area.** Optional Project area lists these records with sessions/gaps/assessments as a management view, not a phase and not a second truth. This feature does not build the full area chrome owned by 57's summary, but must not invent a runner dashboard.
- **English UI.** Labels in stories; missing terms join the table in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Planned Tests and Handoff through the public interface: case versioning, session bind pinned to selected version (historical bind not moved), Handoff states, Markdown/JSON equality for one package version, closed package membership, no runner API, package vs Work external-handoff contract difference. Expected values are the PRD table, not regenerated fixtures from code.
- **Seam (one).** Planned Tests and Handoff — the product-facing case, Handoff, and package-export interface.
- **Modules under test.** Planned Tests and Handoff only. Report accept, review, gaps, assessments, Work external handoff, CI are counterparts.
- **Prior art.** Bind to [Test kabulü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) package-contract half (`handoff_id` requires `handoff_package_version` on return — enforced in 54, produced here).
- **Required counterparts.** Editing a case does not rewrite past sessions; a Planned Test Case is not a Test Session or Handoff package; Handoff is not a Test Session; package is not a coding handoff; product does not start tests; secrets absent from package.

## Out of Scope

- Test raporu kabulü, inceleme, Test Açığı, Test değerlendirmesi.
- Dış yürütme devri (24), CI/CD, tarayıcı otomasyonu, test runner.
- Senaryoyu İş kontrol listesi yapmak; paketi yayın artefaktı saymak.

## Further Notes

- **Orient.** Glossary: Planlı Test Senaryosu, Test Handoff'u, Dış yürütme devri (avoid). Owning PRD: `docs/prd/10-testing-and-validation.md`. ADRs: 0015 (not this package). Related: PRD 16 Test kabulü package fields, PRD 19 no in-app runner.
- **Acceptance.** [Test kabulü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): package contract produced here; atomic return is 54.
- **Consumers.** `54-test-report-acceptance` consumes `handoff_id` + `handoff_package_version`; `24-external-handoffs` must stay a different package; `57-test-review-and-follow-up` reviews arriving sessions.
