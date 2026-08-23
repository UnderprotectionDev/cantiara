# Güvenlik Redaksiyonu

Kaynak: [`docs/workflow/78-security-redaction/phase-context.md`](../../workflow/78-security-redaction/phase-context.md)

## Problem Statement

Kurucu hassas bir değeri güncel içerikten ve onu taşıyan her kopyadan geri döndürülemez kaldırmak ister. Bugün olağan düzenleme, Çöp Kutusu, istemci gizleme veya geçmiş satırını silmek bu işi taklit edebilir; restore ve Dış yüzey snapshot'ı değeri diriltebilir. Redaksiyon kaydın kimliğini durdurmak zorunda değildir. Kişisel veri silme ve Hesap kapatma bu sözleşmeyi bekler; ayrı bir GitHub teyit kartı veya ikinci redaksiyon motoru açmamalıdır.

## Solution

Kurucu etkiyi önizler, Hesap Erişimi feature'ının `Confirm GitHub Identity` grant'ini tüketir ve hedef adı yazar. Güvenlik redaksiyonu hassas değeri güncel içerikten, bütün kayıt geçmişi revizyonlarından, Dış yüzey snapshot revizyonlarından, arama indekslerinden, dışa aktarma hazırlıklarından ve cache'lerden geri döndürülemez kaldırır. İçeriksiz işaret özgün olay türü, zaman ve aktörü korur; ad, e-posta, özgün mesaj veya secret yazılmaz. Olağan geri yükleme redakte edilmiş içeriği diriltmez. Dış yüzey redaksiyonu yayın erişimini yeniden açamaz. Test geçmişi ham sonucu geriye yazmaz; redakte edilmiş kanıt güncel değerlendirme veya export için kullanılamaz. Grant uygulaması kopyalanmaz.

## User Stories

1. As a founder, I want to preview every current field, history revision, External Surface snapshot, search hit, export staging copy, and cache that still holds a sensitive value, so that redaction is not a blind click.
2. As a founder starting redaction, I want to consume the Account Access `Confirm GitHub Identity` grant bound to this operation and type the affected Account or Project name (not the record title), so that GitHub proof and name-typing stay distinct steps owned here versus Account Access.
3. As a consuming feature, I want to call that grant instead of opening a second identity-proof card, so that OAuth/PKCE/`prompt=select_account` stay owned by Account Access.
4. As a founder, I want that GitHub step not copy-written as password, MFA, or session refresh, so that the UI tells the truth.
5. As a founder, I want the sensitive value removed from current content, so that the live record no longer stores it.
6. As a founder, I want the same value removed from every record-history revision, so that scrolling history cannot reveal it.
7. As a founder, I want the same value removed from External Surface Approved Snapshot Revisions, so that a visitor or an old snapshot view cannot reveal it.
8. As a founder, I want search indexes, export staging, and caches cleared of that value, so that secondary copies cannot resurrect it.
9. As a founder, I want a content-free redaction mark that keeps original event type, time, and actor, so that history stays auditable without storing the secret.
10. As a founder, I want names, emails, original messages, and secrets never written into that mark, log, or tombstone, so that the audit trail is not a second leak.
11. As a founder, I want ordinary restore (Trash restore, backup restore replay of living rows, merge undo) not to bring the redacted value back, so that redaction outranks restore.
12. As a founder, I want External Surface redaction not to reopen publish access, so that cleaning a snapshot is not undelete-of-sharing.
13. As a founder, I want the record's identity to remain unless I separately permanently delete it, so that redaction is not Trash and not Account closure.
14. As a founder looking at a broken reference to redacted content, I want only the redaction mark, time, reason, and actor — never the last known body — so that the broken-reference contract holds.
15. As a founder (and as the operator restoring from backup), I want redaction appended as a secret-free irreversible security event, so that replaying the log after restore re-applies removal before access opens.
16. As a founder on a Test Oturumu, I want redaction to be a distinct event from Correction or Withdrawal, so that reported results are not silently rewritten.
17. As a founder, I want redacted test evidence unusable for current Test değerlendirmesi or export, so that a cleaned secret cannot be recycled as acceptance proof.
18. As Personal Data Rights (81) and Account Closure (84), I want to call this redaction contract instead of copying it, so that there is one removal engine.
19. As a founder, I want English UI copy `Redact` and consumption of `Confirm GitHub Identity`, so that the product language stays English.
20. As a founder using only a keyboard or a screen reader, I want to complete preview, grant consume, typed name, and result, so that high-risk redaction is in the Hesap ve kişisel veri accessibility path.
21. As a founder, I do not want client-side hiding, ordinary edit, Trash, or Archive to count as redaction, so that reversible actions cannot fake destruction.
22. As a founder during a GitHub outage, I want redaction to stay fail-closed until the grant can be consumed, so that destruction cannot skip GitHub proof (Account Access owns outage wait).
23. As a founder, I want Denetim kaydı of the redaction without secrets, so that the action can be explained later.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [database-first güvenlik tabanı](../../prd/13-data-security-and-portability.md#database-first-guvenlik-tabani) (redaction spread). Test-history event shape is [düzeltme, geri çekme ve güvenlik redaksiyonu](../../prd/10-testing-and-validation.md#düzeltme-geri-çekme-ve-güvenlik-redaksiyonu); this feature owns the removal engine those events call, not Test Oturumu review UI. Restore replay is [ADR-0003](../../adr/0003-restore-guvenlik-olay-gunlugu.md) and [ADR-0019](../../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md): this feature ships the redaction event type, append/replay contract, and a test that restore of still-present content plus replay leaves the value gone. The production log store and RPO/RTO stay in 85. Surface access cutoff on revoke is 14; this feature owns snapshot/index/cache content removal and must not reopen publish. No new ADR.
- **Glossary.** Use Güvenlik redaksiyonu, Güvenlik nedeniyle redakte edilmiş kanıt, Geri döndürülemez güvenlik olay günlüğü, Denetim kaydı, GitHub kimliğini yeniden teyit etme (`Confirm GitHub Identity`). Do not introduce hide-in-UI, delete-history-row, recycle, or a second confirmation card. Çöp Kutusu is 77. Hesap kapatma is 84. Kişisel veri silme is 81 and calls this contract.
- **Redaction module.** One product-facing Security Redaction interface: preview, consume grant, typed Account or Project name, apply. Spread targets are closed: current content, all history revisions, External Surface snapshot revisions, search indexes, export staging, caches. Callers (81 erase, 84 Account permanent delete) pass an operation identifier and the value/locator set; they do not reimplement spread. 77 does not call apply: permanent delete is refused until sensitive content is already gone. Apply is not Trash, Archive, client-side hide, or deleting a history row with ordinary edit.
- **Grant consumption.** Account Access owns start, callback, mint, single-use consume. This feature passes an operation identifier, consumes once, and keeps typed-name confirmation — the affected Hesap or Proje name from [GitHub kimliğini yeniden teyit etme](../../prd/03-account-platform-operations.md#github-kimliğini-yeniden-teyit-etme), not the record title. It must not ship a second identity-proof card and must not copy OAuth/PKCE/`prompt=select_account`. If the grant cannot be consumed, redaction is not applied.
- **Tombstone.** After apply, displays and logs show a content-free mark: original event type, time, actor, reason. No name, email, original message, secret, or deleted field value. Broken references use `Redacted for security` without last-known body.
- **Restore must not resurrect.** Trash restore, merge undo, and operator DB restore of still-living rows must not rehydrate the value. Replay of the redaction event is the proof: a restored row that still contains the value becomes unauthorized-as-content after replay, before External Surfaces open (85 opens access only after replay; this feature provides the event and a unit/integration replay test with a log double).
- **Surfaces.** Redacting a snapshot removes the value from stored revisions and does not transition an External Surface back to `Aktif` or mint a new URL/token. Sharing management shows the revision as redacted without leaking content (14 displays; this engine supplies the state).
- **Test-history counterpart.** Correction and Withdrawal remain PRD 10 events. Redaction is a third event. Redacted evidence is not usable as current Test değerlendirmesi input or as export. This suite includes that counterpart; it does not build the test-review UI (57).
- **English UI labels.** First user-visible copy: `Redact`, `Redacted for security`. Grant label stays `Confirm GitHub Identity`. New labels are added to the PRD term table in the same change that first shows them. No Turkish UI.
- **Classification.** Contact email, research participant data, and private feedback are kişisel veri; sharing passwords, session, sharing, and integration keys are Secret. Secret never enters search, export, sharing, or publish — redaction of a leaked Secret still spreads to history/snapshots/indexes. The product does not claim to detect secrets in free Markdown; preview says that limit (already PRD 13). Health/biometric/government-id/payment-card/child data is not stored as a first-product type; this feature does not add a scanner.

## Testing Decisions

- **What a good test is.** Tests observe Security Redaction through its public interface: preview locator set, grant consume, typed-name gate, apply, then whether current/history/snapshot/search/export-staging/cache still yield the value. They assert restore-without-replay still cannot serve the value on the product read path after apply, and that replaying the event after a restored still-present row keeps the value gone. They do not assert Prisma shapes or re-test OAuth.
- **Seam (one).** Security Redaction — the product-facing irreversible content-removal interface used by the redaction UI and by 81/84. Account Access grant, External Surface snapshot store, search index, export staging, and the security-event log are adapters (real versus test double). Playwright for the Hesap ve kişisel veri high-risk slice is the same seam through the UI.
- **Modules under test.** Security Redaction only. Trash, Account closure UI, personal-data package UI, and operator RPO/RTO are counterparts: those commands call this interface or are unauthorized without it. Test-history counterpart: redacted evidence rejected by evaluation/export helpers.
- **Prior art.** Account Access grant consume — reuse the consume double, do not copy the OAuth tour. ADR-0003 replay style matches session-revoke tests on Account Access. Synthetic fixture: [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) redaction counterparts. Cloud tests must not use production content or secrets.
- **Required counterparts.** Ordinary edit is not redaction; client hide is not redaction; Trash restore after redaction does not resurrect; grant reuse/mismatch cannot apply; typed name is Account or Project name not record title; snapshot redaction does not reactivate an External Surface; test Correction is not redaction; 81/84 must not duplicate the engine (their specs call this seam).

## Out of Scope

- Çöp Kutusu, Arşiv, kayıt kimliğini durdurma, Hesap kapatma penceresi.
- `Confirm GitHub Identity` OAuth/PKCE uygulaması — 01.
- Kişisel veri okunabilir paketi ve silme UI'si — 81; onlar bu sözleşmeyi çağırır.
- Operatör restore RPO/RTO ve erişimi açma kapısı — 85; bu feature olay tipini ve replay sözleşmesini verir.
- Dış yüzey oluşturma, iptal token semantiği, CDN purge motoru — 14/76.
- Test raporu zarfı, düzeltme/geri çekme UI — 54/57; yalnız redakte kanıt karşıtı burada.
- İstemci gizleme, alan maskeleme tercihi, içerik tarayıcısı, kullanıcı hassaslık etiketi (gelecek).

## Further Notes

- **Orient.** Glossary: Güvenlik redaksiyonu, Geri döndürülemez güvenlik olay günlüğü. Owning PRD: `docs/prd/13-data-security-and-portability.md` (`#database-first-guvenlik-tabani`). Related: PRD 10 (`#düzeltme-geri-çekme-ve-güvenlik-redaksiyonu`). ADRs: 0003, 0019 (event + separate log; 85 owns topology/RPO). Related: PRD 02 (broken refs, undo is not redaction), PRD 03 (grant), PRD 14 (surfaces consume spread), PRD 16 (journeys), PRD 19 (no MFA; redaction is not Trash).
- **Acceptance.** Bind to [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (synthetic: grant consume, typed name, spread, restore-does-not-resurrect) and to [Test geçmişi](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) (redaction distinct from correction; redacted evidence unusable). Negative: no second GitHub card, no client-hide-as-redaction, no snapshot undelete.
- **Consumers.** `81-personal-data` erase and `84-account-closure` permanent delete call this contract. `77-trash` refuses permanent delete until sensitive content is gone. `85-operator-backup-and-alarms` replays the event before opening access.
- **Grant rule.** Typed Account or Project name stays in this feature. Do not re-specify OAuth/PKCE. Call the Account Access grant. Do not copy this contract into 81 or 84.
