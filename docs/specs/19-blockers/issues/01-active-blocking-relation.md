# 01 — Aktif engelleme ilişkisi

**What to build:** Kurucu bir İşi başka bir İş, Karar veya Açık Soru ile `Active` engelleme ilişkisine bağlar. Aktif ilişki engellenen İşi planlama tüketicilerinin ayırt edebileceği biçimde işaretler. İlişki eklemek İş akışı durumunu `Blocked` yazmaz. Yanlış bağ `Remove relation` ile silinir; bu silme çözüm geçmişi değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `Engeller` / `Engellenir` İş←İş, Karar→İş veya Açık Soru→İş uçlarında `Active` kurulur; serbest ilişki türü yoktur.
- [ ] Aktif ilişki engellenen İşte okunabilir blokaj gerçeğidir; Kanban sütun rengi, etiket veya öncelik puanı değildir.
- [ ] İş akışı durumu otomatik `Blocked` olmaz.
- [ ] Aynı uç çifti için tekrar submit ikinci Active ilişki üretmez (idempotency).
- [ ] `Remove relation` yanlış bağı siler; çözüm tarihi/notu yazmaz.
- [ ] İngilizce UI `Active` ve `Remove relation` kullanır.
- [ ] Kabul kanıtı Work Blockers seam'inde: kurulum, durum yazmama, tekrar submit. Kanıt [Blokaj](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
