# Kullanıcı Başlatmalı Kayıt Eylemleri

Kaynak: [`docs/workflow/21-record-actions/phase-context.md`](../../workflow/21-record-actions/phase-context.md)

## Problem Statement

Kurucu bir kayıt üzerinde tekrarladığı birkaç alanı tek adlandırılmış eylemle değiştirmek ister; tehlikeli veya çok adımlı yazmanın gizli kısmi başarı bırakmasını istemez. Açık uçlu makro, betik pazarı, arka planda sessiz uygulama, toplu alan düzenleme ve içe aktarma bu ihtiyacın yerine geçmez. Eylem IDE, GitHub veya ajan başlatmamalıdır.

## Solution

Kurucu kapalı adım kataloğundan tek hedef kayıt üzerinde çalışan adlandırılmış birleşik kayıt eylemleri tanımlar. Örnek: `Start Work` açık İşin durumunu `In Progress` yapıp onu Günlük Odak'a ekler. Eylem yalnız açık başlatmada çalışır, kesin alan farkını önizler ve tek atomik sonuç uygular. Çalışma anı girdileri yalnız önceden tanımlı `Date`, `Number`, `Select`, veya mevcut ana kayıtla `Relation` olabilir. Geri alınabilir değişiklikler ortak undo sözleşmesini kullanır.

## User Stories

1. As a founder, I want to define a named record action from a closed catalog of field-level steps, so that I can repeat a combination without a script market.
2. As a founder, I want an example `Start Work` that sets status to `In Progress` and adds the Work to Daily Focus, so that a first useful action exists.
3. As a founder, I want the action to run only when I explicitly start it, so that nothing fires from a background rule here.
4. As a founder, I want to preview the exact fields that will change on the target record, so that preview and apply cannot diverge.
5. As a founder confirming, I want one atomic result: all catalog steps commit or none do, so that partial success cannot hide.
6. As a founder, I want reversible field changes to use the common safe undo contract, so that I can roll back the whole action when undo applies.
7. As a founder designing an action, I want optional runtime inputs limited to `Date`, `Number`, `Select`, or `Relation` to an existing main record, so that the action cannot grow a form builder.
8. As a founder running it, I want to preview the values I picked together with the resulting record diff, so that inputs are not invisible.
9. As a founder, I want the action limited to real in-app record fields, so that it cannot mint a new record, call an external API, or start an IDE/CLI/GitHub/agent.
10. As a founder, I want a user-defined combined action to target exactly one record, so that multi-record writes stay Bulk Editing.
11. As a founder, I do not want reusable multi-record combined-action buttons, so that 19 stays closed.
12. As a founder, I do not want JavaScript, free script, or outbound HTTP in an action, so that the catalog stays closed.
13. As a founder, I do not want this catalog to be import finalize or capture promotion, so that those atomics stay their features.
14. As a founder, I do not want the product to suggest actions by watching my behavior, so that 19 stays closed.
15. As a founder, I want a failed apply to explain whether anything was written, so that I can retry safely with the same idempotency key.
16. As a founder, I want retrying the same key and payload to return the prior result, so that double click cannot fork state ([ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik)).
17. As a founder, I want English UI for `Start Work`, `Record Action`, and preview/apply copy, so that the product language stays English.
18. As a founder using only a keyboard, I want to start, preview, and apply an action, so that Mutasyon sözleşmesi includes this path.
19. As a founder, I want trashed action definitions to be ineffective, so that configuration trash is honored.
20. As a founder, I want Daily Focus membership to be a closed catalog step that writes the existing membership model, so that this feature does not own the Daily Focus surface.
21. As a founder, I do not want an action to change GitHub, publish, or close via PR-merge rules, so that those automations stay their features.
22. As a founder, I want the actor of the write to remain `User`, so that a record action is not silently labeled automation.
23. As a founder, I want a stale base revision at apply to reject the whole action, so that preview-then-apply cannot last-write-win.
24. As a founder, I do not want an action to add a tag, File Attachment, or import row as a side path, so that the catalog cannot impersonate those features.
25. As a founder, I want disabling an action definition to keep history of past runs on the records, so that configuration change is not rewrite of Work history.
26. As a founder, I do not want MCP, CLI, or webhook to start a Record Action in the first product, so that 19's programmatic-access ban holds.
27. As a founder, I want Command Palette to be able to invoke the same named action later, so that keyboard start is the same command — the palette host stays 05.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [Kullanıcı başlatmalı kayıt eylemleri](../../prd/06-work-management-and-planning.md#kullanıcı-başlatmalı-kayıt-eylemleri). Atomic apply is [ADR-0004](../../adr/0004-atomik-idempotent-kesinlestirme.md) and [ortak kimlik](../../prd/02-domain-model-and-lifecycle.md#ortak-kimlik). Undo is [geri alma](../../prd/02-domain-model-and-lifecycle.md#değişiklik-geçmişi-aktör-ve-geri-alma). Bulk field edit is [Toplu düzenleme](../../prd/06-work-management-and-planning.md#toplu-düzenleme) (22). Automation rules are a different section. 19 forbids multi-record combined buttons, free script, and behavior-based suggestion. No new ADR.
- **Glossary.** Use İş, Günlük Odak. Avoid: macro marketplace, partial background apply, bulk edit, import, automation rule, agent launch.
- **Closed catalog.** Primitive steps are a closed catalog of in-app field and supported membership writes (status, Daily Focus add/remove, other already-existing fields the action designer selects). Founder names a combination as a Record Action. The catalog is not open-ended macros, scripts, or new record creation. First shipped example: `Start Work` = status `In Progress` + add to Daily Focus. Daily Focus UI is workflow 27; this step writes membership if that model exists or is stubbed at the seam.
- **Single target.** One main record per run. Multi-record field updates of existing fields stay Bulk Editing (22). No reusable multi-record action buttons.
- **Preview then apply.** Explicit start → exact diff (and any runtime inputs) → one atomic commit. Previewed diff equals applied result. No silent partial success. After the commit barrier, UI is `Finalizing` rather than a fake cancel that still writes.
- **Runtime inputs.** Optional `Date`, `Number`, `Select`, or `Relation` to an existing main record, declared at design time. Values and resulting changes are previewed together before run.
- **Idempotency.** User command carries base revision and client idempotency key. Same key + payload returns prior receipt; different payload conflicts. Actor remains `User`.
- **Undo.** Reversible field changes use the common safe undo contract as one action when the product can invert the whole combination; if a step is not safely invertible, undo is refused with explanation rather than a partial rewind.
- **Not other writers.** No GitHub mutation, publish, PR-merge close, import, capture, or automation-trigger chain. An action must not trigger automation rules as a synthetic event beyond the original user command (PRD automation: actions from automation do not chain; here the actor is the user).
- **Trash.** Action definitions follow configuration trash (PRD 13).
- **English UI labels.** `Record Action`, `Start Work`, preview/apply/`Finalizing`. Add missing labels to the term table in the same change.
- **Stack.** Existing API. No workflow-engine product, no JS sandbox.

## Testing Decisions

- **What a good test is.** Tests observe Record Actions through its public interface: define from catalog, preview diff, atomic apply, idempotent retry, runtime inputs, and negatives (no script, no multi-record, preview=apply). They do not inspect job payloads.
- **Seam (one).** Record Actions — the product-facing named-action preview/apply interface. Bulk Editing and import are counterparts. Playwright for Mutasyon sözleşmesi human-command class is this seam through the UI.
- **Modules under test.** Record Actions only.
- **Prior art.** Contract tests at this seam with four origin classes already required by Mutasyon sözleşmesi (human command is this feature's class). Evidence: [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (`Sentetik fixture`).
- **Required counterparts.** Partial apply impossible; second record not written; script step absent; bulk-edit UI absent; preview mismatch cannot apply; GitHub not called.

## Out of Scope

- Açık uçlu makro veya betik pazarı; JS/HTTP; ajan/IDE/GitHub başlatma.
- Eylemi arka planda kısmi uygulayıp sessiz bırakma.
- Toplu alan düzenleme (22) ve içe aktarma (80).
- Çok kayıtlı birleşik eylem düğmeleri; davranıştan eylem önerme.
- Otomasyon kuralı motoru (PR-merge close).

## Further Notes

- **Orient.** Glossary: İş, Günlük Odak. Owning PRD: `docs/prd/06-work-management-and-planning.md` (`#kullanıcı-başlatmalı-kayıt-eylemleri`). ADRs: 0004. Related: PRD 02 identity, PRD 16 Mutasyon sözleşmesi, PRD 19 macros/scripts/multi-record buttons.
- **Acceptance.** Bind to [Mutasyon sözleşmesi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (human command: base revision + idempotency; no lost/partial write).
- **Closed catalog vs user-defined.** PRD allows named combinations; phase-context requires a closed catalog. Decision: primitives are closed; names/combinations are founder-defined on one record.
