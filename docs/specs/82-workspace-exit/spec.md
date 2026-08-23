# Çalışma Alanı Çıkış Paketi

Kaynak: [`docs/workflow/82-workspace-exit/phase-context.md`](../../workflow/82-workspace-exit/phase-context.md)

## Problem Statement

Kurucu bütün Çalışma Alanını, uygulamaya kilitlenmeden ve yedek ürünü olmadan, elinde kalacak biçimde almak ister. Bugün seçili CSV/JSON, operatör yedeği veya şifresiz arşiv bu vaadi taklit edebilir. Unutulan parola okunamaz kalmalıdır. Hesap kalıcı silmek en az bir başarılı paketi bekler (84); paket restore vaadi taşımaz ve AB yerleşimini taşımaz.

## Solution

Kurucu yaşayan Hesaptan, ve kapanışta zorunlu olarak, parola ile şifrelenmiş, manifestli tam Çalışma Alanı çıkış paketi üretir. İçerik, ek sürümleri, kimlikler, ilişkiler, geçmiş ve yapılandırma okunabilir Markdown/JSON ve özgün binary'lerle gider. Oturum, secret, dış erişim anahtarı, operasyon logu, türetilmiş cache ve Yakalama staging eki girmez. Parola sunucuda saklanmaz; kurtarma kodu veya şifresiz kopya yoktur. İndirme şifreli, süreli ve iptal edilebilir. Ürün içi restore yoktur. ADR-0023.

## User Stories

1. As a founder on a living Account, I want to produce a full Workspace Exit Package from the security/portability surface, so that I can leave with my archive without closing yet.
2. As a founder in Account closure freeze (84), I want that same package produced as a required step, so that permanent delete cannot happen with empty hands.
3. As a founder, I want the package to include user content, attachment versions, identities, relations, history, and configuration as readable Markdown/JSON plus original binaries and one manifest, so that the archive is complete without being a backup product.
4. As a founder, I want sessions, secrets, external access keys, operation logs, derived caches, and Capture staging attachments excluded, so that the archive cannot leak Secret class data.
5. As a founder, I want the archive encrypted with a password I type, not stored on the server, so that the operator cannot open my copy.
6. As a founder who forgets that password, I want the package unreadable, with no recovery code and no plaintext copy, so that the product tells the truth at closure.
7. As a founder (and as an independent verifier), I want a published application-free envelope definition, so that I can check the archive without Cantiara restore.
8. As a founder, I want the download to be encrypted, time-bounded, and revocable, so that a stale link dies.
9. As a founder on a living Account, I want no restore-point library created from these packages, so that Exit Package is not operator backup.
10. As Account Closure (84), I want freeze to require at least one successful package production and to keep it downloadable for 30 days, so that permanent delete is gated.
11. As a founder, I want selected Markdown/JSON/CSV (79) to remain a different action — and during freeze those selected links may exist, but they are not this package.
12. As a founder, I want the package not to move live EU residency; production data stays until 84's permanent delete, so that download is not a region transfer.
13. As a founder, I want in-product restore/import of this package absent (future direction), so that ADR-0023 holds.
14. As a founder, I want English UI `Workspace Exit Package` (already in the term table), so that the product language stays English.
15. As a founder using only a keyboard or a screen reader, I want to complete password, production, and download, so that Hesap kapatma ve export / Taşınabilirlik include this surface.
16. As the operator, I want this not to satisfy RPO/RTO, so that 85 remains the backup product.

## Implementation Decisions

- **Owning documents.** [Çalışma Alanı çıkış paketi](../../prd/13-data-security-and-portability.md#calisma-alani-cikis-paketi), [ADR-0023](../../adr/0023-sifreli-calisma-alani-cikis-paketini-restore-olmadan-sun.md). Closure gate: [Hesap kapatma](../../prd/03-account-platform-operations.md#hesap-kapatma) consumes success. EU: [ADR-0009](../../adr/0009-ab-veri-siniri.md). Staging uses export key scope (PRD 13). No new ADR. In-product restore is [gelecek yönü](../../prd/18-future-directions.md#tam-ürün-paketi-ve-geri-yükleme-doğrulaması) / 19.
- **Glossary.** Çalışma Alanı çıkış paketi (`Workspace Exit Package`). Avoid: tam yedek, restore paketi, şifresiz arşiv, Operasyonel yedek.
- **Workspace Exit Package module.** One interface: start (password supplied by founder, not persisted), produce encrypted archive + manifest, time-bounded download, revoke download. Living-account optional; closure-required is 84's rule calling this success flag. Do not implement restore.
- **Contents.** User content, attachment versions, identities, relations, history, configuration. Readable Markdown/JSON + original binaries. Exclude sessions, secrets, access keys, op logs, derived caches, Capture staging. Envelope published without requiring the app to decrypt.
- **Password.** Never stored. Forgotten → unreadable. No recovery code, no plaintext twin. Closure UI (84) restates this limit; this feature enforces it.
- **Download.** Encrypted object, expiring, revocable. Living Account does not keep a restore-point library of past packages (a download window is not a library of restore points).
- **Residency.** Package production does not change region. Live data remains in EU until permanent delete.
- **English UI.** `Workspace Exit Package` already in the term table. Additional `Download Workspace Exit Package` / password field labels added when first shown.
- **Grant.** Package production does not consume `Confirm GitHub Identity`. Closure start/cancel does (84).

## Testing Decisions

- **What a good test is.** Tests observe package production: required content present, excluded classes absent, ciphertext without password unreadable, password not in DB/logs, manifest complete, download expiry/revoke, success flag visible to 84's double, restore endpoint absent. Envelope definition can decrypt with the password in a test harness that is not product restore.
- **Seam (one).** Workspace Exit Package. 79 selected export and 85 backup are counterparts.
- **Modules under test.** Workspace Exit Package only. Account Closure freeze UI is 84; this suite exposes the success flag and download object.
- **Prior art.** Export staging key scope from PRD 13 / tech stack. Synthetic fixture for [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) and [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
- **Required counterparts.** No in-product restore; no plaintext copy; secrets absent; not Selected Export; success required before 84 permanent delete (tested here as a flag, enforced in 84).

## Out of Scope

- Seçili kayıt export — 79.
- Operatör yedek/restore — 85.
- Hesap kapatma penceresi — 84 (çağırır).
- Ürün içi restore/import — 18/19.
- Zamanlanmış otomatik çıkış.

## Further Notes

- **Orient.** Glossary: Çalışma Alanı çıkış paketi. Owning PRD: 13 `#calisma-alani-cikis-paketi`. ADR: 0023. Journeys: Taşınabilirlik + Hesap ve kişisel veri.
- **Acceptance.** [Taşınabilirlik](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) encrypted envelope, no restore; [Hesap ve kişisel veri](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) closure requires successful production, forgotten password unreadable.
- **Consumers.** 84 requires ≥1 success and 30-day download during freeze.
- **Grant rule.** Does not own Confirm GitHub Identity.
