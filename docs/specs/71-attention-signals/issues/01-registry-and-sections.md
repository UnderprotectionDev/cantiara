# 01 — Kapalı registry ve Action Required / Information Flow

**What to build:** Birleşik Bildirim Merkezi yalnız registrydeki sinyal kimliklerini kabul eder. Her sinyal kesin kaynak olay kimliği ve hedef kimliğiyle doğar; ikisi olmadan yazılmaz. Sinyaller `Action Required` ve `Information Flow` bölümlerinde durur; varsayılan `Action Required` açılır; her sinyal tek bölümdedir. Aynı ana kaynağın sinyalleri bölüm içinde tek kaynak grubunda durur; aynı Kaynak sürümü değişikliğinin birden fazla kullanım yeri tek Kaynak grubunda ayrı inceleme kararlarını korur. Neden, kaynak olayı, zaman ve okunma/kapatılma ayrı kalır. Kayıtsız kimlik reddedilir; aynı kesin olay+hedef kimliği çoğalmaz. Merkez Geri Bildirim feed'i, Proje Etkinliği veya e-posta ürünü değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Emit yalnız bu kapalı mint kimliklerini kabul eder; her sinyal kesin kaynak olay kimliği ve hedef kimliğiyle doğar; ikisi olmadan yazılmaz; kayıtsız kimlik yazmadan fail-closed reddedilir.

| Mint id | Section |
| --- | --- |
| `due-date` | `Action Required` |
| `reappear-date` | `Action Required` |
| `personal-reminder` | `Action Required` |
| `review-later` | `Action Required` |
| `open-risk` | `Action Required` |
| `work-blocked` | `Action Required` |
| `source-version-in-use` | `Action Required` |
| `external-run-returned` | `Action Required` |
| `release-observation-missing` | `Action Required` |
| `github-check-failed` | `Action Required` |
| `work-pr-status-conflict` | `Action Required` |
| `unlinked-open-pr` | `Action Required` |
| `published-release-open-scope` | `Action Required` |
| `automation-failed` | `Action Required` |
| `public-roadmap-review-due` | `Action Required` |
| `unreviewed-test-report` | `Action Required` |
| `test-result-conflict` | `Action Required` |
| `handoff-result-after-cancel` | `Information Flow` |
| `smart-collection-entry` | `Information Flow` |
| `github-activity` | `Information Flow` |
- [ ] Sunum sınıfı tablodaki `Action Required` / `Information Flow` değeridir; üretici sınıfı değiştiremez; varsayılan açık bölüm `Action Required`'dır.
- [ ] Aynı ana kaynak kendi bölümünde gruplanır; her sinyalin nedeni, olayı, zamanı ve okunma/kapatılma durumu ayrıdır.
- [ ] Aynı kesin Kaynak sürümü değişikliğinin birden fazla kullanım yeri tek Kaynak grubundadır; her kullanımın inceleme kararı ayrı kalır ve tek bildirime indirgenmez.
- [ ] Aynı olay+hedef kimliği ikinci sinyal üretmez.
- [ ] İngilizce UI `Notification Center`, `Action Required`, `Information Flow` kullanır; wire kimlikleri PRD tablosundaki değerlerdir.
- [ ] Kabul kanıtı Attention Signals seam'inde üretici test double ile: kayıtlı emit, kayıtsız red, dedupe, bölüm ayrımı. Kanıt [Dikkat sinyalleri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun merkez/registry paketidir.
