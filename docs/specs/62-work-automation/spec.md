# Hafif İş Otomasyonları

Kaynak: [`docs/workflow/62-work-automation/phase-context.md`](../../workflow/62-work-automation/phase-context.md)

## Problem Statement

Kurucu tekrarlayan Proje işini kapalı tetikleyici, koşul ve eylem kurallarıyla unutmamak ister. Bugün kural yok; GitHub bağlantısı sessiz kapanış gibi durur; çakışmada son yazan kazanır; otomasyon bitiriş efekti veya yayın kapısı üretir. Toplu düzenleme, kayıt eylem kataloğu, GitHub check ve bitiriş efekti (23) bu kartın işi değildir. Hazır PR-merge kuralı 61'in `Required for completion` rolünü tüketir; bağlantı tek başına İşi kapatmaz.

## Solution

Kurucu kapalı katalogdan Proje otomasyon kuralı oluşturur; yalnız açıkça etkin kurallar çalışır. Aynı özgün olayın önerileri yazmadan toplanır; aynı hedef alanda çatışma hiçbir yazma yapmadan durur ve kuralları gösterir; çatışmayan öneriler bütün atıfları taşıyan tek atomik ve idempotent mutasyonda uygulanır. Bir kuralın yazması başka kuralı tetiklemez. Hazır kural `When required PRs merge, mark Work Completed` etkinse en az bir gerekli PR vardır ve hepsi merge ise kapanış `Completed` olur; bağlamsal merge veya kural kapalıyken yalnız öneri vardır. Check başarısızlığı kapatmayı geciktirmez ve tamamlanan İşi yeniden açmaz. Otomasyon kapanışı Bitiriş efekti üretmez (23 / ADR-0017).

## User Stories

1. As a founder, I want to create a Proje rule from a closed catalog of triggers, optional conditions, and actions, so that there is no free-form script or webhook marketplace.
2. As a founder, I want only explicitly enabled rules to run, so that a saved draft cannot mutate records.
3. As a founder, I want repeating-work creation as a prepared type that mints a new independent İş each time, so that the same İş is never reopened by advancing its date.
4. As a founder, I do not want general GitHub or other external events as builder triggers, except the prepared PR-merge automation defined here, so that 61 remains a read-only fact source.
5. As a founder, I want all matching rules for one original event collected before any write, so that conflict can be detected on target+field.
6. As a founder, I want conflicting proposed values on the same target field to write nothing and show the rules, values, and resolution path, so that last-write-wins and rule order never apply.
7. As a founder, I want non-conflicting proposals applied in one atomic idempotent mutation attributed to every participating rule, so that retry does not double-apply (ADR-0004 / PRD 02).
8. As a founder, I want a rule's write not to trigger another rule, so that there is no automation cascade.
9. As a founder, I want optional dry run to show matching records and proposed changes without writing, so that enablement is not a mandatory approval gate on every run.
10. As a founder, I want each saved rule-definition change versioned, and restoring a definition to affect only future runs, so that past automation effects are not rewritten.
11. As a founder, I want a failed automation to emit an Action-needed signal naming the rule, original trigger, failed step, and actionable reason, so that a generic "failed" is not the UX.
12. As a founder with the UI open, I want one result toast and a 10-second undo for safe changes, with later undo from each record's history, stopping if a newer value on the same field would be clobbered.
13. As a founder, I want every automation change explained on the record's normal history with rule, definition version, trigger, conditions, and action, so that there is no separate run log or bulk-run undo (19).
14. As a founder, I want to enable `When required PRs merge, mark Work Completed` explicitly, so that GitHub link alone never completes Work.
15. As a founder, I want that rule to set kapanış `Completed` only when the İş has at least one `Required for completion` PR and every such PR is merged.
16. As a founder, I want a merge of only one required PR, or of only Contextual PRs, or of an İş with zero required PRs, not to complete Work.
17. As a founder with the rule off, I want the same condition to surface a `Mark as Completed` suggestion only, so that I still decide.
18. As a founder, I do not want PR opened, review requested, changes requested, or check results to become general status automations.
19. As a founder, I want a failing or later-failing check not to delay close and not to reopen a completed İş; those stay 61/64 attention signals.
20. As a founder, I want automation completion not to play a Bitiriş efekti, so that only user-initiated Work success does (23).
21. As a founder, I do not want this feature to be a release gate or test runner, or to call GitHub write APIs.
22. As a founder, I do not want the product to watch my repeating actions and suggest automations, or for a rule to infer relations, change-impact, or decisions.
23. As a founder, I want English UI for the prepared rule name, conflict, dry run, and `Mark as Completed`.
24. As a founder, I want configuration-trash of a rule to stop it from running while in Trash.

## Implementation Decisions

- **Owning documents.** [Hafif uygulama içi otomasyon kuralları](../../prd/06-work-management-and-planning.md#hafif-uygulama-içi-otomasyon-kuralları). PR roles from PRD 12; this spec does not redefine them. Bitiriş exclusion: [Bitiriş efektleri](../../prd/06-work-management-and-planning.md#bitiris-efektleri) and [ADR-0017](../../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md). Conflict: glossary Otomasyon çatışması. Idempotency: ADR-0004, PRD 02 (automation origin class). Yapılandırma çöpü: PRD 13. No new ADR.
- **Glossary.** Otomasyon çatışması, Tamamlanma için gerekli, Kullanıcı başlatmalı İş başarısı, Bitiriş efekti. Avoid: last-write-wins, run log, GitHub as silent close, completion effect from automation, open-ended script.
- **One seam.** Work Automation — rule CRUD/enable, proposal collection, conflict stop, atomic apply, prepared PR-merge rule, dry run, failure signal, toast undo. Record Actions (21) are user-initiated. Bulk edit (22) is separate. GitHub Integration (61) supplies merge facts and roles; this seam writes Work closure only via the prepared rule.
- **Closed catalog.** Builder cannot add JS, HTTP, or arbitrary GitHub events. Prepared types include repeating independent İş creation and the PR-merge rule. Project-structure copy does not copy automation definitions (PRD 04). Conflict, failure, and user control (enable/disable, dry run, trash, undo) stay visible; a failed rule is never silently swallowed. The product does not watch repeating user motions to suggest rules, and a rule does not infer relations, change-impact, or decisions. Automation is not a release gate or test runner.
- **Prepared rule string.** Store and show `When required PRs merge, mark Work Completed` as the English UI for `Bağlı gerekli PR'lar merge edildiğinde işi Tamamlandı say`.
- **No completion effect.** When this seam sets `Completed`, it must not invoke the Bitiriş efekti trigger; 23 counterpart tests that automation origin is excluded. User-initiated success notification (`Work completed` + 10s) is 23's user path, not this toast.

## Testing Decisions

- **What a good test is.** Work Automation with in-process events and a GitHub-merge fact double: enable/disable, conflict writes nothing, non-conflict one mutation, no cascade, failed rule emits `automation-failed` (not swallowed), PR-merge matrix (zero required / partial / all / contextual / rule off), check failure does not reopen, no Bitiriş call, no GitHub write.
- **Seam (one).** Work Automation. Journey **Otomasyon** (real project).
- **Required counterparts.** Silent close from 61 link absent; last-write-wins absent; completion effect absent; run log absent; failed rule not silently swallowed; habit-watching suggestions absent; not a release gate or test runner.

## Out of Scope

- Kullanıcı başlatmalı kayıt eylemleri — 21.
- Toplu düzenleme — 22.
- Bitiriş efekti tema/palet ve kullanıcı tetikleyicisi — 23.
- GitHub App/webhook — 61 (fact source only).
- Açık uçlu betik, ajan orkestrasyonu, run günlüğü — 19.
- Başarısız kuralı sessizce yutma.
- Yayın kapısı veya test koşturucu.

## Further Notes

- **Orient.** Glossary: Otomasyon çatışması, Tamamlanma için gerekli, Bitiriş efekti. Owning PRD: 06 `#hafif-uygulama-içi-otomasyon-kuralları`. ADRs: 0004, 0017. Related: PRD 12 roles, PRD 16 Otomasyon, PRD 19.
- **Acceptance.** [Otomasyon](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): only enabled prepared PR rule can complete Work; conflicts stop writes; non-conflicts one idempotent mutation; rule version and actor history.
- **Upstream.** 61 must expose required-PR merge facts; tests may double them.
