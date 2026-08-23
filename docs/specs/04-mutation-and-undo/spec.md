# Yazma Sözleşmesi ve Güvenli Geri Alma

Kaynak: [`docs/workflow/04-mutation-and-undo/phase-context.md`](../../workflow/04-mutation-and-undo/phase-context.md)

## Problem Statement

Kurucunun başlattığı her durum değiştiren komutun kaybolmadan, sessizce ezilmeden ve kısmi kayıt bırakmadan kesinleşmesini ister. Bugün iskelet isteğe taban revizyonu veya istemci idempotency anahtarı koymaz; çok adımlı yazma atomik bariyer taşımaz; güvenli geri alma ilgisiz sonraki değişikliği sarmadan duracağını kanıtlamaz. Çöp Kutusu, güvenlik redaksiyonu ve Hesap kapatma bu sorunun parçası değildir.

## Solution

İnsan komutları hedefin taban revizyonunu ve istemci idempotency anahtarını taşır. Aynı anahtar aynı sonucu döndürür; farklı payload çatışmadır; güncel olmayan taban sessiz son-yazan-kazanır uygulamaz. GitHub webhook, yetkili entegrasyon, sistem otomasyonu, import finalize ve restore replay insan gibi sahte taban uydurmaz; doğrulanmış kaynak kimliği kullanır. Çok adımlı yazma hazırlama alanından tek commit bariyerinde tam commit veya tam rollback makbuzu üretir. Güvenli geri alma yalnız tersi deterministik hesaplanan işlerde çalışır ve ilgisiz sonraki değişikliği silmez.

## User Stories

1. As a founder issuing a state-changing command, I want it to carry the target’s base revision and a client idempotency key, so that retry and lost writes cannot silently fork the record.
2. As a founder retrying the same command with the same key and payload, I want the previous result, so that a double submit is not a second write.
3. As a founder retrying the same key with a different payload, I want a visible conflict, so that idempotency cannot launder a different edit.
4. As a founder whose base revision is stale, I want the write refused (or the record type’s reconciliation flow) and the current value shown, so that last-write-wins never overwrites me in silence.
5. As a founder, I do not want last-write-wins on a stale base, so that two overlapping edits cannot drop one without a conflict.
6. As a non-human origin (GitHub webhook, authorized integration delivery, system automation, import finalize, restore replay), I want a verified source id, a stable event/delivery id in source scope, a payload fingerprint, and the target revision condition at commit, so that I do not mint a fake human base revision.
7. As that non-human origin, I want the same source id and payload to return the previous receipt, so that redelivery is safe.
8. As that origin with the same source id and a different payload, I want conflict or a security error, so that a replay cannot swap meaning.
9. As a founder starting a multi-step write, I want work held in a staging area isolated from live records until one commit barrier, so that a crash cannot leave a visible half-record.
10. As a founder, I want the only outcomes at that barrier to be a full commit receipt or a full rollback receipt, so that there is no ambiguous committed state.
11. As a founder retrying a multi-step write, I want the same operation result, so that retry is not a second partial apply.
12. As a founder changing the payload of a retried multi-step write, I want an explicit conflict, so that fingerprint mismatch is not ignored.
13. As a founder watching a write that has passed the commit barrier, I want `Finalizing` rather than a fake `Cancel`, so that I cannot pretend an already-committed apply is still abortable.
14. As a founder, I do not want a partial record, dangling relation, counter, or index entry after a failed atomic operation, so that integrity stays closed.
15. As a founder undoing a change whose reverse is deterministic, I want safe undo on that field, relation, view metadata, or atomic transform, so that I can reverse a mistake without a general undo stack.
16. As a founder who edited something else later, I want safe undo not to wrap that unrelated later edit, so that undo is not a time machine.
17. As a founder whose later edit touched the same field, I want undo to stop and explain the conflict, so that a newer value is not deleted.
18. As a founder, I do not want safe undo of permanent deletion, security redaction, an external-system mutation, or a published static export, so that irreversible work stays irreversible.
19. As a founder undoing a merge on a type that supports it, I want the retired identity restored as a main record and only merge-attributed values/relations split, so that later unrelated writes survive.
20. As a founder, I want actors recorded as `User`, `System automation`, `GitHub`, or `Authorized integration`, so that history tells the truth about who wrote.
21. As a founder, I want each change to carry target, actor, time, origin, and previous/next values on supported fields, so that undo and history have something honest to read.
22. As a founder using only a keyboard or a screen reader, I want to complete an edit, see a conflict, and run safe undo, so that the closed accessibility journey “kayıt oluşturma, düzenleme, çatışma, geri alma” is possible.
23. As a founder, I want English UI for conflict, retry, `Finalizing`, and `Undo`, so that product language stays English.
24. As a founder, I do not want a general undo stack on every click, so that undo stays the safe, deterministic contract.
25. As a founder, I do not want this feature to implement Trash, redaction, or account close, so that those irreversible paths stay their own features while still using this barrier.
26. As a consuming feature, I want to send human commands through this contract rather than inventing a second write protocol, so that one Mutation Contract covers the product.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik) and [değişiklik geçmişi, aktör ve geri alma](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Multi-step writes also follow [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md). Integrity counterparts live in [güvenlik ve veri bütünlüğü](../../prd/15-product-quality.md#guvenlik-ve-veri-butunlugu). No new ADR.
- **Glossary.** Use Güvenli geri alma, Kayıt geçmişi, Kayıt birleştirme, Birleştirmeyi geri alma, Emekli kayıt kimliği, Denetim kaydı (not a substitute for record history). Do not introduce a general undo stack, restore-point, Trash-as-undo, or last-write-wins. Human vs non-human origins are actor types on the same contract, not a second product.
- **Mutation Contract module.** One product-facing write interface: human commands require base revision + client idempotency key; non-human origins require verified source id + stable delivery id + payload fingerprint + target revision condition at commit. Same key + same payload returns the prior result; same key + different payload is conflict. Stale base never silent-overwrites; if the record type has no reconciliation flow, reject and show the current value.
- **Atomic finalize.** Multi-step writes stage off the live record set, then pass one commit barrier that re-checks base revision, idempotency key, payload fingerprint, current authorization, target scope, and quota. Outcomes: full commit receipt or full rollback receipt. After the barrier, UI shows `Finalizing` instead of a fake cancel. Timed cleanup of staging and durable receipts are part of this module; import/capture/file features consume it later rather than copying it.
- **Safe undo.** Allowed only where the reverse is deterministically computable (field, relation, view metadata, atomic transform). Does not rewind unrelated later edits. Same-field newer value: stop and explain. Not safe: permanent delete, security redaction, external-system mutation, published static export. Merge undo restores the original retired identity and splits only merge-attributed values/relations.
- **History.** Every change stores target, actor (`User`, `System automation`, `GitHub`, `Authorized integration`), time, origin, and previous/next on supported fields. AI agents or external tools, when they write through an authorized integration, show the integration identity and the authorizing user separately — this feature only preserves the actor slots; it does not build those integrations.
- **English UI labels.** First user-visible copy uses: `Undo`, `Conflict`, `Current value`, `Retry`, `Finalizing`. `Cancel` remains for pre-barrier abort only. Add missing labels to the PRD term table in the same change that first shows them.
- **Performance.** A single-record mutation’s server acknowledgement stays inside the [p95 800 ms / p99 1500 ms](../../prd/15-product-quality.md#performans-butcesi) budget. This feature does not loosen that budget.
- **Stack.** oRPC commands, Zod payloads, Prisma/PostgreSQL transactions, pg-boss where a durable job must outlive the request. Do not add a second write bus or CRDT.

## Testing Decisions

- **What a good test is.** Tests observe Mutation Contract through its public interface: human retry, payload mismatch, stale base, non-human redelivery, multi-step commit vs rollback, post-barrier cancel refused, safe undo, unrelated later edit preserved, same-field conflict on undo, forbidden undo classes rejected. They do not assert transaction isolation levels or Prisma internals. Expected values are product rules (same key same result, no silent overwrite, no wrapping later edits).
- **Seam (one).** Mutation Contract — the product-facing write/undo interface every later feature must call. GitHub, import, and automation adapters sit behind it (real vs test double). Playwright for the closed accessibility journey “kayıt oluşturma, düzenleme, çatışma, geri alma” is the same seam through the UI, not a second module. A later feature’s own record type may supply a reconciliation flow; this suite tests the default reject-and-show-current path plus one representative atomic transform.
- **Modules under test.** Mutation Contract only. Trash, redaction, account close, GitHub App, and capture are counterparts except where this suite must show they cannot bypass the barrier.
- **Prior art.** Almost no Vitest/Playwright yet. First contract tests live at this seam. Synthetic fixture for [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): four origin classes, retry, reorder, concurrent write.
- **Required counterparts.** Stale base does not silent-overwrite; same idempotency key cannot apply a different payload; failed atomic write leaves no partial record; undo does not delete an unrelated later edit; redaction/external/publish/permanent-delete cannot be auto-undone.

## Out of Scope

- Sessiz son yazan kazanır.
- Kısmi kayıt veya belirsiz commit durumu.
- Genel undo yığını, yayın geri alma, güvenlik redaksiyonunu geri alma.
- Çöp Kutusu, hesap kapatma, güvenlik redaksiyonu UI’si.
- GitHub webhook işleyicisi, import sihirbazı, otomasyon kural motoru — bunlar bu sözleşmeyi tüketir, burada inşa edilmez.
- Belge Çakışma Taslağı uzlaştırma UI’si (Belge feature’ı).

## Further Notes

- **Orient.** Glossary: Güvenli geri alma, Kayıt geçmişi, Kayıt birleştirme, Birleştirmeyi geri alma. Owning PRD: `docs/prd/02-domain-model-and-lifecycle.md` (ortak kimlik; değişiklik geçmişi). ADRs in play: 0004. Related but not owning: PRD 13 (Trash/redaction consume the barrier), PRD 15 (integrity + mutation latency), PRD 16 (Mutasyon sözleşmesi), PRD 05/12 (capture and GitHub as non-human origins later).
- **Acceptance.** Bind to [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (synthetic fixture: human base+idempotency; webhook/import/automation verified source id; retry, reorder, concurrent write) and to the closed accessibility journey **kayıt oluşturma, düzenleme, çatışma, geri alma**. Integrity counterparts in PRD 15 (no partial record, no wrapping undo, no silent stale overwrite) are the same journey’s security package. Negative bounds (no last-write-wins, no general undo stack) are 19-class counterparts.
- **Consumers.** Workflows 06 (capture finalize), 09 (Work writes), 10 (field values), 11 (draft finalize), 12 (relations), 14 (file finalize), 80 (import) must call this contract. They do not mint a parallel write protocol. Trash/redaction/close use the barrier but stay out of this feature’s UI.
- **Scaffold debt.** Unprotected iskelet POSTs without base revision/idempotency are not product behavior; replacing them is this feature.
