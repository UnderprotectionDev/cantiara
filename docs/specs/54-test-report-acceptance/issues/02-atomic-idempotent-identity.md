# 02 — Atomik, idempotent kabul ve kanonik kimlik

**What to build:** Bozuk, kısmi veya allow-list dışı zarf hiçbir ana kayıt, bildirim, sayaç, indeks veya Dosya Eki ilişkisi bırakmaz. Idempotency giriş yolu + doğrulanmış entegrasyon kimliği + `external_session_id`'dir; `executor` anahtara girmez. Aynı içerik önceki makbuzu döner; aynı dış kimlik farklı kanonik içerikle `identity_conflict` üretir. `handoff_id` varsa `handoff_package_version` zorunludur ve eşleşmezse bütün rapor reddedilir. Alan sırası ve anlamsız whitespace yeni içerik değildir. Kararlı hata kodları PRD 10 kapalı kümesidir.

**Blocked by:** 01 — test-report/1 ve üç giriş tek model

**Status:** ready-for-agent

- [ ] Kısmi satır ithali yoktur; başarısız kabul sıfır kalıntı bırakır.
- [ ] Idempotent tekrar yeni oturum açmaz; `executor` anahtar değildir.
- [ ] Kimlik–içerik çatışması sessiz güncelleme veya kopya üretmez.
- [ ] Handoff sürüm uyuşmazlığı `reference_scope_mismatch` ile atomik reddedilir.
- [ ] Kabul kanıtı aynı seam'de: grill 1–3, 17–18; ADR-0004 commit bariyeri. [Test kabulü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) atomiklik paketidir.
