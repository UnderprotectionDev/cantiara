# Operasyonel Yedek, Kurtarma ve Alarm

Kaynak: [`docs/workflow/85-operator-backup-and-alarms/phase-context.md`](../../workflow/85-operator-backup-and-alarms/phase-context.md)

## Problem Statement

Kurucu aynı zamanda hizmet operatörüdür. Hizmetin `RPO ≤ 5 dakika` ve `RTO ≤ 8 saat` ile kurtarılması, restore sonrası irreversible güvenlik olaylarının yeniden uygulanması ve S1 alarmının tespitten en fazla beş dakikada üretilmesi Ürün sürüm adayının son kapısıdır. Bugün Çöp Kutusu, çıkış paketi veya kullanıcı restore-point'i bu kapıyı taklit edemez. Avrupa Birliği veri bölgesi kullanıcı yüzeyi veya bölge seçici değildir. Destek referansı 03 istemcisindedir. Üretim Olayı öğrenimi 66'dadır.

## Solution

Operasyonel yedek veritabanı ile özgün nesnelerin kesin manifestini tek mantıksal birim sayar. Restore sonrası, birincil restore biriminin dışında korunan Geri döndürülemez güvenlik olay günlüğündeki kalıcı silme, redaksiyon, yüzey/token/parola, oturum iptali ve anahtar/entegrasyon rotasyonu güncel sınıra kadar replay edilir; replay ve bütünlük bitene kadar dış erişim fail-closed kalır. S1 alarmı otomatik tespitten ≤5 dakikada üretilir; güvenliyse fail-closed sınırlama insan beklemeden başlar. 7/24 insan nöbeti vadedilmez. Bu paket ürün özelliklerinden sonra gelen son sürüm-adayı kapısıdır. Kullanıcıya yedek takvimi veya restore-point sunulmaz.

## User Stories

1. As the operator, I want operational backup with `RPO ≤ 5 minutes`, so that a provider disaster cannot lose a day's product truth (ADR-0010).
2. As the operator, I want `RTO ≤ 8 hours` for a verified restore of the logical unit, so that recovery time is a product gate not a hope.
3. As the operator, I want the restore unit to be the database plus the exact original-object manifest as one logical unit, so that orphan DB rows or orphan R2 objects are not a "successful" restore.
4. As the operator, I want irreversible security events replayed from the separate append-only log after restore, before any External Surface or visitor access opens, so that an old backup cannot resurrect revoked access, redacted secrets, or deleted accounts (ADR-0003, ADR-0019).
5. As the operator, I want that log to live in a separate managed PostgreSQL project with separate credentials in the same EU region, so that restoring primary Neon cannot roll back the log (ADR-0019, tech stack).
6. As the operator, I want the log secret-free and identity-aliased, so that the replay store is not a second content leak.
7. As the operator, I want Account-delete tombstones kept for the longest backup/restore window plus 30 days, then physically deleted, so that replay can still close resurrected rows without keeping personal content forever.
8. As the operator, I want a new irreversible security action unable to ship without a matching restore rule and test, so that session revoke, redaction, surface revoke, and account delete cannot drift from replay.
9. As the operator, I want configured metrics and alarms for health, error rate, queue latency, and backup failure (Better Stack), so that S1/S2 are not tribal knowledge.
10. As the operator, I want an S1 alarm produced within 5 minutes of automatic detection, with fail-closed containment starting without waiting for a human when safe, so that "derhâl" is an automatic chain not a pager theatre.
11. As the operator, I want first product not to promise 24/7 human on-call; I intervene in the next waking work period, so that S1 timing is not a staffing lie.
12. As the operator, I want S2 triaged within one business day, so that non-immediate issues still have a clock.
13. As the operator, I want this backup/replay/alarm packet to be the last release-candidate gate: no Product sürüm adayı accepted without verified recovery evidence, so that features are not staged around this gate — they all exist, then this gate fires.
14. As a founder using the product, I want no backup calendar, restore-point picker, or in-product restore, so that 19 and ADR-0023 stay honest.
15. As a founder, I want no EU region picker; production deployment must fail if Neon/Railway/R2/Better Stack are outside the approved EU region, so that ADR-0009 is a deploy constraint (PRD 03: this clause opens no user surface).
16. As a founder seeing an error, I want the secret-free support reference to remain the web/macOS client feature (03), so that this operator packet does not build a second error UX.
17. As a founder, I want Production Incident learning records (66) not to be this alarm pipe, so that operator paging is not a Project Üretim Olayı.
18. As the operator, I want provider, retention topology, cost, and drill frequency chosen as normal engineering inside these targets, not as a separate product decision gate (ADR-0010).
19. As the operator, I want envelope-encryption root keys versioned per ADR-0019 (production/integration/backup/export key scopes) so that restore does not require rewriting ciphertext in place.
20. As the operator, I want public previously approved static content able to keep serving from its existing delivery point without opening private dependencies, so that EU fail-closed downtime is not confused with Build in Public static.

## Implementation Decisions

- **Owning documents.** [Operasyonel yedek ve kurtarma](../../prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma), [Hizmet işletimi](../../prd/03-account-platform-operations.md#hizmet-isletimi), [Avrupa Birliği veri bölgesi](../../prd/03-account-platform-operations.md#ab-veri-bolgesi). ADRs: [0003](../../adr/0003-restore-guvenlik-olay-gunlugu.md), [0009](../../adr/0009-ab-veri-siniri.md), [0010](../../adr/0010-felaket-veri-kaybi-butcesi.md), [0019](../../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md). Tech stack: Railway, Neon, R2 (not the backup architecture chooser), Better Stack (metrics/alarms), pg-boss, separate PostgreSQL project for the log, envelope keys in Railway Sealed Variables. Last RC item: [Ürün sürüm adayı kanıtı madde 12](../../prd/16-product-acceptance.md#urun-surum-adayi-kaniti). No new ADR. Provider topology is engineering, not an ADR.
- **Glossary.** Operasyonel yedek, Geri döndürülemez güvenlik olay günlüğü, Avrupa Birliği veri bölgesi, Ürün sürüm adayı. Avoid: Çıkış paketi, ürün içi restore, Çöp Kutusu geçmişi, region picker, 24/7 on-call, Üretim Olayı as pager.
- **Operator Backup and Alarms module.** Interfaces: (1) backup of primary DB + object manifest as one unit meeting RPO; (2) restore drill that applies replay to log frontier then opens access; (3) S1/S2 alarm pipeline; (4) production region assertion at deploy. No founder-facing restore UI. Event types are produced by 01 (session revoke), 77 (permanent delete), 78 (redaction), 14/76 (surface/token), 84 (account delete), integrations (key rotation) — this feature owns the store, replay runner, "cannot ship without replay test" gate, and access-closed-until-replay.
- **Envelope keys.** Backup uses the backup data-key scope, separate from production, integration, and export (PRD 13; [ADR-0019](../../adr/0019-guvenlik-olay-gunlugunu-ve-ust-anahtari-ayri-guven-alaninda-tut.md)). Envelope root keys are monotonically versioned in Railway Sealed Variables; each ciphertext stores its key version. Rotation adds a version and does not force in-place rewrite of existing ciphertext. Restore decrypts with the version on the ciphertext.
- **EU.** Neon Frankfurt, Railway Amsterdam, R2 `eu`, Better Stack Germany — assert at production deploy. Fail-closed on EU outage; no automatic extra-EU failover. Help text may list active regions; changing region is a separate migration decision, not a picker in this feature (PRD: this article opens no user surface or separate delivery job).
- **Support reference.** Error id without secrets is 03 client. This feature may emit the id server-side; it does not build the toast/dialog.
- **English UI.** None for restore-points. Operator runbooks may be English docs, not product navigation. No Turkish product UI.
- **Grant.** This feature does not consume `Confirm GitHub Identity`.

## Testing Decisions

- **What a good test is.** Tests observe Operator Backup and Alarms: a fixture backup older than a revoke/redact/delete event; restore of primary; access still closed; replay; access still denied for the revoked/redacted/deleted; object manifest matches DB; RPO/RTO measured on the drill; S1 emitted within 5 minutes of a injected detection; deploy assertion fails on a non-EU config. They do not require production user content. Replay tests for individual event types live with the producing feature; this suite proves the runner and the gate that new events must register.
- **Seam (one).** Operator Backup and Alarms. Security-event log is the adapter owned here in production (01/78 may use a dedicated test DB in CI). Better Stack is the alarm adapter.
- **Modules under test.** Operator Backup and Alarms only. Event producers (01/77/78/14/84) are registered types, not re-tested here except that an unregistered type fails the ship gate.
- **Prior art.** Session-revoke replay style from Account Access; redaction replay from 78. Synthetic [Operasyonel kurtarma](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari). Cloud tests must not use production sessions or private content.
- **Required counterparts.** No user restore-point API; no region picker; 82 package is not this restore; 77 Trash is not this; S1 is not 66 Üretim Olayı; support-reference UI not built here; backup key scope is not the production or export key.

## Out of Scope

- Kullanıcı yedek takvimi, restore-point kütüphanesi, ürün içi restore — 19 / 82 gelecek yönü.
- Çalışma Alanı çıkış paketi — 82.
- Çöp Kutusu — 77.
- Üretim Olayı kaydı — 66.
- Destek referansı UX — 03.
- Bölge seçici, self-host operatör paneli — 19.
- 7/24 insan nöbeti, müşteri destek kuyruğu, pager ürünü.

## Further Notes

- **Orient.** Glossary: Operasyonel yedek, Geri döndürülemez güvenlik olay günlüğü, Avrupa Birliği veri bölgesi. Owning PRD: 03 `#operasyonel-yedek-ve-kurtarma`, `#hizmet-isletimi`, `#ab-veri-bolgesi`. ADRs: 0003, 0009, 0010, 0019. Journey: Operasyonel kurtarma. Last RC gate.
- **Acceptance.** [Operasyonel kurtarma](../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): restore drill, replay integrity, S1 timing, production region verification. Kanıt ortamı sentetik fixture. Manifest item 12 cannot be skipped.
- **Producers.** 01, 77, 78, 14, 84, key rotation must register replay rules here.
- **Grant rule.** Does not consume Confirm GitHub Identity. Does not build a second confirmation card.
