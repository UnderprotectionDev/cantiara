# Test Raporu Kabulü

Kaynak: [`docs/workflow/54-test-report-acceptance/phase-context.md`](../../workflow/54-test-report-acceptance/phase-context.md)

## Problem Statement

Kurucu manuel form, yapılandırılmış dosya veya dar MCP ile gelen dış test sonucunu aynı tarihsel modele güvenle almak ister. Bugün üç yol ayrı kayıt türü açabilir; bozuk zarf kısmen yazılabilir; ham sonuç normalize dile ezilebilir; MCP genel yazma kanalı olabilir; secret sessizce maskelenip kabul edilebilir; bildirilen `Passed` sürüm kanıtı sanılabilir. İnceleme 57'dedir. Ürün testi koşturmaz. Handoff paketi 53'tedir.

## Solution

Kurucu üç girişten aynı Test Oturumu ve Oturum Testi modeline atomik ve idempotent yazar. Bildirilen sonuç doğrulanmış ürün kabulü değildir. Yürüten, raporlayan ve giriş yolu ayrı tutulur; giriş yolu güven veya önem puanı üretmez. Kabul inceleme veya yayın kapısı değildir. Oturum ve madde iki katmandır; ham sonuç normalize `Passed`/`Failed`/`Blocked`/`Skipped`/`Inconclusive`/`Not reported` değerinden ayrı korunur. Zarf `test-report/1`'dir; desteklenmeyen sürüm sessizce yükseltilmez. Dar MCP yalnız bu sözleşmeyi teslim eder. Secret taraması fail-closed reddeder. Yeni dosya/MCP oturumu tek `unreviewed-test-report` sinyali üretir; elle oluşturulan oturum ek bildirim üretmeden Tests alanında `Unreviewed` görünür.

## User Stories

1. As a founder, I want manual form, structured Markdown/JSON file, and narrow MCP to create the same Test Session and Session Test model, so that ingress is not a parallel record type or queue.
2. As a founder, I want reported results never treated as verified product acceptance or a release gate, so that a forged `Passed` cannot close a release (ADR-0007).
3. As a founder, I want executor type, executor name/version, reporter, and ingress path kept distinct, so that “Codex ran it, I imported the JSON” stays readable and none of those fields is a trust score.
4. As a founder, I want session result and Session Test result as separate layers, with raw result stored unrewritten beside normalized `Passed`/`Failed`/`Blocked`/`Skipped`/`Inconclusive`/`Not reported`.
5. As a founder, I want a free-text note never to become a Test Session.
6. As a founder, I want a new session to start `Unreviewed`; review must not rewrite the reported result (review UI is 57; this feature only sets the initial state).
7. As a founder, I want a malformed envelope to leave zero records, indexes, notifications, or attachment links (ADR-0004).
8. As a founder retrying the same valid report, I want idempotency on ingress + verified integration identity + `external_session_id`, returning the prior receipt, not a second session or signal.
9. As a founder, I want `executor` to be display attribution only, never part of the idempotency key.
10. As a founder sending the same external id with different canonical content, I want `identity_conflict` and no silent update or duplicate session.
11. As a founder, I want file and MCP to validate the versioned envelope as a whole; no partial row import.
12. As a founder sending an unsupported `schema_version`, I want `schema_unsupported` and no silent upgrade. First contract is `test-report/1`.
13. As a founder, I want Markdown YAML frontmatter to parse as one YAML 1.2 document into the same Zod `test-report/1` schema; aliases, merge keys, custom tags, multiple docs, duplicate keys, or over-limit structure fail closed.
14. As a founder, I want required envelope fields as in PRD 10: `schema_version`, `project_id` (exact, no name guess), `external_session_id`, `executor`, `reported_at` with offset; `handoff_id` optional but if present `handoff_package_version` is required and must match or the whole report is rejected.
15. As a founder, I want at least one Session Test candidate; an empty `tests` array creates no session.
16. As a founder, I want `scenario_id` and `scenario_version` together or not at all; title match is invalid. If both Handoff and scenario are present, the exact case version must be in that Handoff package or the report is `reference_scope_mismatch`.
17. As a founder sending a report to a `Canceled` Handoff with a correct id, I want it bound as history, Handoff left canceled, and `handoff-result-after-cancel` signaled — not rejected and not reopened.
18. As a founder, I want `relations` limited to the allow-list (Planned Test Case, Test Handoff, Work, Feature, Test Gap, Project Release) with full internal ids; invalid relations fail the whole report.
19. As a founder, I want a successful MCP response to be only a receipt (internal session id, external session id, accepted-at, fingerprint, `created`/`duplicate`) with no private Test Session body.
20. As a founder, I want narrow MCP to submit only `test-report/1`: no general record write, no case/spec/document read, no mutate of existing records, no other record types, no in-product commands. Context for the tool comes only from a founder-made Handoff package (53).
21. As a founder, I want MCP unable to upload binary or mint a new File Attachment; base64/blob evidence is `attachment_rejected`.
22. As a founder, I want known/high-confidence provider token patterns to reject the whole report as `sensitive_data_detected` with only a masked field path, never silent redaction of evidence.
23. As a founder on unsupervised MCP, I want ambiguous secret findings rejected too; file/manual ingress may ask for a masked review instead.
24. As a founder, I want each new file/MCP session to create one Unified Notification Center `unreviewed-test-report` signal; Session Tests do not each notify; idempotent retry does not notify again; manual in-app sessions appear `Unreviewed` in Tests without that signal.
25. As a founder, I want canonicalization (tech-stack `canonicalize`) so field order and meaningless JSON whitespace are not new content.
26. As a founder, I want first `test-report/1` limits enforced (5 MiB envelope, 1 MiB raw_report, 1,000 tests on MCP/file, 200 on manual, relation/evidence caps) with `payload_too_large` / `invalid_field` and no silent trim.
27. As a founder, I want catalog-outside raw result to become `not_reported`; raw vs `normalized_result` conflict to be `result_conflict`; no session-level pass/fail computed from mixed children.
28. As a founder, I want English UI `Test Session`, `Session Test`, `Unreviewed`, `Passed`, `Failed`, `Blocked`, `Skipped`, `Inconclusive`, `Not reported`.
29. As a founder (and as an attacker), I want failed accept to echo no secret and no private payload, only a stable error code, safe field path, and fixable explanation.
30. As a founder, I do not want this feature to host review, correction, Test Gap create, or Test Assessment (57/55/56).

## Implementation Decisions

- **Owning documents.** [Rapor ekleme yolları](../../prd/10-testing-and-validation.md#rapor-ekleme-yolları), [güvenli atomik idempotent kabul](../../prd/10-testing-and-validation.md#güvenli-atomik-ve-idempotent-kabul), [sürümlü rapor zarfı](../../prd/10-testing-and-validation.md#sürümlü-rapor-zarfı), [ilişki allow-list](../../prd/10-testing-and-validation.md#rapor-iliski-allow-listesi), [sonuç normalizasyonu](../../prd/10-testing-and-validation.md#sonuç-normalizasyon-sözleşmesi), [kanonik kimlik](../../prd/10-testing-and-validation.md#kanonik-kimlik-parmak-izi-ve-cevap-sözleşmesi). Atomic commit [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md). Reported ≠ release proof [ADR-0007](../../adr/0007-surum-kaniti-guven-modeli.md). MCP SDK v1 and `canonicalize` from tech stack. Signal id `unreviewed-test-report` is registered in PRD 04; this feature is the owner that emits it. Review lifecycle is 57. No new ADR.
- **Glossary.** Use Test Oturumu, Oturum Testi, Bildirilen Test Oturumu, Ürün kabul kanıtı (must not be this), Test Handoff'u. Do not introduce a second report record type, MCP-as-database, or silent schema upgrade.
- **One model, three ingresses.** Manual form, file, MCP → same session/item records. Manual form writes current `test-report/1` internally on save; no session until Save. Unsaved manual form is not the general Draft system and not a runner.
- **Atomic / idempotent.** Prepare isolated from masters; commit is all-or-nothing (ADR-0004). Idempotency key: ingress + verified integration identity + `external_session_id`. Same content → prior receipt (`duplicate`). Same id, different canonical content → `identity_conflict`. Fingerprint includes test content, external ids, time/context, relations, attachment content hashes; not transport headers or token. `canonicalize` ignores key order and meaningless whitespace.
- **Envelope.** `test-report/1` only. Unsupported version → `schema_unsupported`, no partial apply. JSON is the envelope; Markdown is YAML 1.2 frontmatter + optional body as `raw_report`. Zod validates; parser coercion cannot widen types. Field table and error codes are the PRD 10 closed set.
- **Two-layer results.** Raw kept. Normalized from closed alias catalog; unknown raw → `not_reported`; conflict → `result_conflict`. No rollup pass/fail. Manual: founder picks the English label; product stores the wire value.
- **Narrow MCP.** `test_report.submit` on an authorized Project only. Reporter is the verified integration/user context, not a payload actor field. No read API, no mutate, no other types, no commands, no binary attachments. Success is a receipt only. This is not the future read-first programmatic bridge (PRD 18).
- **Secrets.** Known/high-confidence token → whole-report `sensitive_data_detected`, masked path only, no silent edit (ADR-0007). Ambiguous: masked review on file/manual; reject on MCP. Evidence never becomes release proof by existing.
- **Notifications.** One `unreviewed-test-report` per new file/MCP session; none on manual create; none on idempotent retry. Tests area listing for manual Unreviewed is not a second notification product.
- **English UI.** Labels in stories; user-visible result labels are English (`Passed`, …) mapping PRD terms Geçti/…; add missing term-table rows in the same change.

## Testing Decisions

- **What a good test is.** Tests observe Test Report Acceptance through the public accept interface: three ingresses one model, atomic reject of malformed/partial/unsupported, idempotent receipt, identity_conflict, handoff version mismatch, allow-list, secret fail-closed, MCP receipt-only, alias catalog, limit caps. Expected error codes are the PRD literals. Not Prisma rows, not MCP SDK internals.
- **Seam (one).** Test Report Acceptance — the product-facing accept/receipt interface used by the web form, file import, and MCP adapter.
- **Modules under test.** Test Report Acceptance only. Review, gaps, assessments, Handoff package authoring, GitHub checks are counterparts.
- **Prior art.** Bind to [Test kabulü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Her ikisi`, contract pack). Grill scenarios 1–3, 4, 15, 17–19, 21 in PRD 10 are required counterparts. Cloud tests must not use production reports, tokens, or private logs.
- **Required counterparts.** Partial write absent; silent schema upgrade absent; executor not in idempotency key; ingress path is not a trust score; MCP read/write beyond submit absent; MCP is not a general database write channel or agent marketplace; reported Passed is not Ürün kabul kanıtı; accept is not review or publish gate; secret not silently redacted.

## Out of Scope

- Bildirilen sonucu doğrulanmış ürün kabulü veya yayın kapısı sayma.
- Serbest notu Test Oturumu sayma.
- İnceleme, düzeltme, yerine geçme, Test Açığı, Test değerlendirmesi (57/55/56).
- Test runner, CI orkestrasyon, GitHub check'i Test Oturumuna çevirme.
- Genel MCP/API, salt okunur bağlam köprüsü (18).
- Üç yolu ayrı kuyruk veya kayıt türü sayma.

## Further Notes

- **Orient.** Glossary: Test Oturumu, Oturum Testi, Bildirilen Test Oturumu, Ürün kabul kanıtı. Owning PRD: `docs/prd/10-testing-and-validation.md`. ADRs: 0004, 0007. Related: PRD 04 signal `unreviewed-test-report`, PRD 16 Test kabulü, PRD 19 narrow MCP exception.
- **Acceptance.** [Test kabulü](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) contract pack. Accessibility journey **test raporu inceleme** is 57; this feature's duty is accept + Unreviewed listing.
- **Consumers.** `53-test-plan-and-handoff` produces packages this accept validates; `57-test-review-and-follow-up` reviews sessions; `71-attention-signals` presents the registered signal.
