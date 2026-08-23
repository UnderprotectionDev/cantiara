# Hesap Kapatma

Kaynak: [`docs/workflow/84-account-closure/phase-context.md`](../../workflow/84-account-closure/phase-context.md)

## Problem Statement

Kurucu Hesabı ve tek Çalışma Alanını, geri dönüş penceresi içinde durdurulabilir, sonunda geri döndürülemez biçimde kapatmak ister. Bugün Proje silme, oturum iptali, kişi paketi veya çıkış paketini atlamak bu işi taklit edebilir. Başlatma ayrı bir GitHub teyit kartı açmamalıdır. `Kapanış tamamlanıyor` fail-closed biter; 30 günlük dondurma sabit güvenlik olay sınırıdır. Kalıcı silme 78 sözleşmesini kullanır, 82'den en az bir başarılı paketi bekler. Çıkış paketi AB yerleşimini taşımaz; canlı üretim ve özel içerik kalıcı silmeye kadar AB bölgesinde kalır.

## Solution

`Close Account` Account Access grant'ini tüketir ve hedefi yazdırır, sonra görünür `Closing` (`Kapanış tamamlanıyor`) geçişini başlatır: yeni normal mutasyon reddi, dış erişim fail-closed, entegrasyon kapanışı, oturum sonu. Bariyer öncesi işler makbuzla iptal; bariyer sonrası ve başlamış irreversible güvenlik işi tam commit veya rollback. Bitince 30 günlük Hesap kapanma dondurması ve export açılır. İptal yine grant ister. Dondurmada 82 paketi üretilir ve 30 gün indirilir; kalıcı silme başarıdan önce olmaz. Süre sonunda 78 + silme. Aynı GitHub kimliği sonra yeni, farklı kimlikli Hesap açabilir.

## User Stories

1. As a founder, I want `Close Account` to close the Account and its single Workspace together, so that there is no separate "close Workspace" action.
2. As a founder starting close, I want to consume the Account Access `Confirm GitHub Identity` grant bound to this operation and type the affected Account name, so that GitHub proof and name-typing stay distinct.
3. As a consuming feature, I want to call that grant instead of opening a second identity-proof card, so that OAuth/PKCE stay owned by Account Access.
4. As a founder, I want a visible `Closing` transition first: new normal mutations rejected, sharing/publish fail-closed immediately, integrations closed, normal sessions ended, so that freeze does not start on a moving dataset.
5. As a founder, I want pre-barrier import/upload/automation/sync cancelled with a receipt, so that in-flight work does not leak into freeze.
6. As a founder, I want post-barrier work and already-started irreversible redaction/delete to reach a full commit or full rollback receipt before freeze/export open, so that `Closing` is fail-closed (PRD 02 serial barrier).
7. As a founder, I want the 30-day Hesap kapanma dondurması to hold a fixed security-event-bounded dataset, with only cancel-close and export of that frozen set allowed as founder writes, so that freeze is not a moving delete snapshot.
8. As a founder during freeze, I want new user-initiated redaction to require cancel first, so that I cannot redact a closing Account without reopening.
9. As a founder during freeze, I want access-reducing security application and restore-replay obligations to continue, so that freeze is not a holiday for revoke/replay.
10. As a founder, I want to cancel close by consuming the grant again, so that cancel is as serious as start.
11. As a founder during freeze, I want the Workspace Exit Package (82) produced (required) and kept downloadable 30 days, plus selected 79 links, so that I leave with an archive that is not a restore promise.
12. As a founder, I want permanent delete blocked until at least one successful 82 package, so that I cannot vanish empty-handed.
13. As a founder, I want forgotten-password unreadability restated at closure, so that 82's limit is honest here too.
14. As a founder at window end, I want Account and Workspace permanently removed via 78's redaction-and-delete contract, with no return, so that one removal engine exists.
15. As a founder, I want External Surfaces and sessions to stay closed, and backup copies to follow restore-replay rules (85), so that an old DB cannot resurrect the Account's access.
16. As a founder, I want EU production and private content to remain in the EU region until permanent delete; the exit package does not move residency.
17. As a founder, I want the same stable GitHub user id to be able to create a later NEW Account and Workspace with a different product identity, so that close is not a lifetime ban on that GitHub user and is not a merge/rebind of the old Account.
18. As a founder, I want extension connections revoked on close (PRD 05), so that a browser clipper cannot keep writing.
19. As a founder, I want this not to be Project delete group (83) or session revoke (01).
20. As a founder, I want English UI `Close Account` and `Closing`, so that the product language stays English.
21. As a founder using only a keyboard or a screen reader, I want to complete close, package, cancel, so that the closed journey **Hesap kapatma ve export** is possible.
22. As a founder during GitHub outage, I want start/cancel fail-closed until the grant can be consumed, while access-reducing revoke stays available (01 owns outage).

## Implementation Decisions

- **Owning documents.** [Hesap kapatma](../../prd/03-account-platform-operations.md#hesap-kapatma), serial barrier in [ortak yaşam döngüsü](../../prd/02-domain-model-and-lifecycle.md#ortak-yaşam-döngüsü). Grant via Account Access. Package via 82 / ADR-0023. Permanent delete via 78 / ADR-0003. EU via ADR-0009 until delete. Login vs App: both revoked on close ([Hesap ve Çalışma Alanı](../../prd/03-account-platform-operations.md#hesap-ve-calisma-alani)). No new ADR.
- **Glossary.** Hesap kapatma, Hesap kapanma dondurması, Kapanış tamamlanıyor (`Closing`), Çalışma Alanı çıkış paketi, Güvenlik redaksiyonu, GitHub kimliğini yeniden teyit etme. Avoid: close-workspace-only, sign-out-as-close, person package as exit archive, Project delete.
- **Account Closure module.** States: living → `Closing` (fail-closed drain) → 30-day freeze → permanent delete (78). Commands: start (grant + typed Account name), cancel (grant), produce/download 82, selected 79 during freeze. Permanent delete job at window end checks 82 success flag.
- **Freeze duration and freeze exports (PRD wins).** Hesap kapanma dondurması is a product-fixed 30 days from [Hesap kapatma](../../prd/03-account-platform-operations.md#hesap-kapatma), not a user-chosen window from phase-context 84. There is no early Account permanent-delete path. During freeze, PRD 03 opens export: 82 is required and 79 selected Markdown/JSON/CSV links remain available on the frozen set. PRD 13's sentence that selected Markdown/JSON/CSV export stops during freeze does not apply. New user-initiated redaction requires cancel first; access-reducing security application and restore-replay obligations continue.
- **Typed name.** Stays here: the affected Account name. Grant consume operation ids distinct for start vs cancel.
- **New GitHub sign-in after delete.** First successful callback with that GitHub user id creates a new Hesap + Workspace pair (01's first-sign-in path) with new product ids — not a resurrection of the deleted pair.
- **English UI.** `Close Account`, `Closing`, `Cancel closing`. Term table when first shown. `Workspace Exit Package` already exists.
- **Grant rule.** No second card. Do not copy OAuth/PKCE. Do not copy 78. Do not copy 82.

## Testing Decisions

- **What a good test is.** Tests observe Account Closure: start without grant/typed name writes nothing; `Closing` rejects normal writes and external access; freeze opens export and 82; cancel with grant returns living; permanent delete without 82 success refused; after delete, same GitHub id creates a different Hesap id; EU region flag unchanged by package download; 78 apply used for terminal removal.
- **Seam (one).** Account Closure. 01 grant, 82 package, 78 redaction, 77 trash, 14 surfaces are adapters.
- **Modules under test.** Account Closure only. Package bytes are 82's; this suite asserts the freeze gate and success requirement.
- **Prior art.** Grant consume double from Account Access. 78 apply double. Synthetic [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Playwright **Hesap kapatma ve export**.
- **Required counterparts.** Not Project delete; not session revoke; not 81 person package; no second GitHub card; package does not move residency; freeze duration is not user-chosen; 79 selected export remains available during freeze.

## Out of Scope

- Confirm GitHub Identity implementation — 01.
- Oturum iptali — 01; kapatma oturum listesinden çıkış değildir.
- Redaction engine — 78.
- Exit package encryption — 82.
- Operator backup — 85.
- Region picker.
- Project archive — 83.

## Further Notes

- **Orient.** Glossary: Hesap kapatma, Kapanış tamamlanıyor, Hesap kapanma dondurması. Owning PRD: 03 `#hesap-kapatma`. Journey: Hesap ve kişisel veri. A11y: Hesap kapatma ve export. ADRs: 0023, 0003, 0009.
- **Acceptance.** [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): grant tour counterparts (via 01 double), freeze package requirement, password-loss limit, delete timeline. Freeze duration is PRD 03's fixed 30 days (not phase-context user-defined). Freeze exports follow PRD 03 (79 remains available).
- **Consumers.** 85 replays account-delete tombstone. 01 later sign-in creates a new identity.
- **Grant rule.** Typed Account name stays here. Call Account Access for start and cancel. Permanent delete uses 78.
