# Kişisel Veri Dışa Aktarma ve Silme

Kaynak: [`docs/workflow/81-personal-data/phase-context.md`](../../workflow/81-personal-data/phase-context.md)

## Problem Statement

Kurucu bir Contact için kişisel veriyi okunabilir pakette toplamak ve geri döndürülemez silmek ister. Bugün Çalışma Alanı çıkış paketi, Hesap kapatma, Çöp Kutusu veya seçili kayıt export'u bu hakkı taklit edebilir. Silme ayrı bir GitHub teyit kartı veya ikinci redaksiyon motoru açmamalıdır; 78'in sözleşmesi ve 01'in grant'i kullanılır.

## Solution

Kurucu Contact, e-posta takma değerleri, Geri Bildirim, Araştırma ve ilişkili kanıtı okunabilir bir kişi paketinde dışa aktarır. `Erase Personal Data` etkiyi önizler; Account Access grant'ini tüketir; hedef Hesap adını yazar; 78'in güvenlik redaksiyonu sözleşmesini çağırır. Ad, e-posta ve özgün mesaj kalkar; içeriksiz tombstone kalabilir. Aktif paylaşım veya yayındaki değer aynı işlemde kaldırılır. Paket çıkış paketi veya ürün içi restore değildir. Hesap kapatma 84'tedir.

## User Stories

1. As a founder, I want `Export Personal Data` for one Contact to collect that person's Contact record, email aliases, Feedback, Research, and related evidence into a readable package, so that I can answer a data request without dumping the Workspace.
2. As a founder, I want that package to exclude secrets, other Contacts, and unrelated Workspace history, so that a person package is not an Exit Package.
3. As a founder, I want a preview of sources that `Erase Personal Data` will touch, so that erasure is not a blind click.
4. As a founder starting erase, I want to consume the Account Access `Confirm GitHub Identity` grant bound to this operation and type the target Account name, so that GitHub proof and name-typing stay distinct.
5. As a consuming feature, I want to call that grant instead of opening a second identity-proof card, so that OAuth/PKCE stay owned by Account Access.
6. As a founder, I want erase to call Security Redaction (78) rather than a copied spread engine, so that current/history/surfaces/search/export/cache removal stays one contract.
7. As a founder, I want names, emails, and original messages removed, with a content-free tombstone left if historical integrity requires it, so that the person is gone from content without fake history deletion.
8. As a founder, I want active sharing or published values of that person removed in the same operation and queued for cache cleanup, so that a public page cannot keep the email.
9. As a founder, I want restore (Trash or backup row replay) not to resurrect those personal values, because 78 already forbids it.
10. As a founder, I want this not to close the Account or empty the Workspace, so that personal-data rights are not Account closure.
11. As a founder, I want this not to move a record through Trash as the erasure mechanism, so that redaction is not recoverable delete.
12. As a founder, I am responsible for only adding third-party data I collected lawfully; the product warns that special-category data is not a first-product type, so that health/biometric/id/card/child data is not invited.
13. As a founder, I want Denetim kaydı of export and erase without putting the personal values into the log, so that accountability is not a leak.
14. As a founder, I want English UI `Export Personal Data` and `Erase Personal Data`, so that the product language stays English.
15. As a founder using only a keyboard or a screen reader, I want to complete the package download and the erase path (grant + typed Account name), so that Hesap ve kişisel veri includes this surface.
16. As a founder, I want the `Kişisel veri` acceptance dataset (aliases, research consent, shared values, redaction chain) to exercise this seam, so that cache cleanup and tombstone are proven.
17. As Account Closure (84), I want whole-Account removal to call 78, not to reuse this person package as the closure archive.

## Implementation Decisions

- **Owning documents.** Behavior is owned by [database-first güvenlik tabanı](../../prd/13-data-security-and-portability.md#database-first-guvenlik-tabani) personal-data actions. Grant: [GitHub kimliğini yeniden teyit etme](../../prd/03-account-platform-operations.md#github-kimliğini-yeniden-teyit-etme) via Account Access consume. Removal spread: Security Redaction (78), not copied. Contact model: [Contact ve Company](../../prd/08-search-relations-and-evidence.md#contact-ve-company-kimliği). Dataset: [Kişisel veri](../../prd/16-product-acceptance.md#test-veri-setleri). No new ADR.
- **Glossary.** Use Contact, Geri Bildirim, Güvenlik redaksiyonu, GitHub kimliğini yeniden teyit etme, Çalışma Alanı çıkış paketi (must not be this), Hesap kapatma (must not be this). Do not introduce GDPR-export-as-workspace, CRM, User Account-as-Contact, or a second confirmation card.
- **Personal Data Rights module.** Two commands on a Contact: readable export package; erase via 78 + grant + typed Account name. Not Selected Export (79) and not Exit Package (82), though 79's secret-exclusion and closed-world preview style apply to the person package.
- **Package contents.** Contact, email aliases, Feedback, Research, related evidence — readable (JSON/Markdown). No sessions, tokens, other people, operator logs. Not a restore format.
- **Erase.** Preview affected sources. Consume Account Access grant (operation id = this erase). Type Account name (PRD: hedef Hesap adı). Call 78 apply on the personal value locator set including published/shared copies. Tombstone content-free. Cache cleanup follows 14's async purge; fail-closed access is immediate via surface/content removal.
- **English UI labels.** `Export Personal Data`, `Erase Personal Data`. Added to the term table when first shown. Grant label unchanged. No Turkish UI.
- **Grant rule.** No second card. Do not re-specify OAuth/PKCE. Do not copy 78.

## Testing Decisions

- **What a good test is.** Tests observe Personal Data Rights: package contains the Contact's listed sources and not secrets/other Contacts; erase without grant or typed name writes nothing; erase calls 78 (spy/double) rather than a local spread; published value gone; tombstone content-free; Trash restore does not resurrect (78 counterpart).
- **Seam (one).** Personal Data Rights. 78, 01 grant, and 14 surface revoke are adapters. Playwright on Hesap ve kişisel veri.
- **Modules under test.** Personal Data Rights only. 78 apply and Account Access consume are doubles. Contact create UI is 46.
- **Prior art.** Grant consume double from Account Access. Redaction spread tests live on 78; this suite asserts the call and the person-package contents. Dataset `Kişisel veri` from PRD 16.
- **Required counterparts.** Package ≠ Exit Package; erase ≠ Account closure; erase ≠ Trash; no second GitHub card; 78 not forked.

## Out of Scope

- Çalışma Alanı çıkış paketi — 82.
- Hesap kapatma — 84.
- Seçili kayıt CSV/JSON genel katalog — 79 (Contact may be exported there as records, not as a rights package).
- Redaksiyon motoru ve OAuth turu — 78 ve 01.
- Geri Bildirim oluşturma UI — 47. Contact birleştirme — domain 02 / ilgili feature.

## Further Notes

- **Orient.** Glossary: Contact, Güvenlik redaksiyonu. Owning PRD: 13 `#database-first-guvenlik-tabani`. Grant: PRD 03 via 01. ADR: 0003 via 78. Journey: Hesap ve kişisel veri. Dataset: Kişisel veri.
- **Acceptance.** [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): readable package, same confirm rule, cache/tombstone counterparts.
- **Consumers.** None as a library except 84 must not confuse this package with Exit Package.
- **Grant rule.** Typed Account name stays here. Call Account Access grant. Call 78 for removal.
