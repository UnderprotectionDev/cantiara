# 01 — Risk kaydı, etki ve durum

**What to build:** Kurucu başlık, açıklama, etki, olasılık, yanıt/azaltma ve `Open` / `Mitigating` / `Occurred` / `Resolved` / `Accepted` ile Risk izler. Durum yalnız açık eylemdir. `Accepted` ortadan kalkma değil bilinçli kabuldür. Kayıt Bug, Test Açığı veya Üretim Olayı değildir; olasılıktan öncelik puanı üretilmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Risk Proje ana kaydıdır. İngilizce UI `Risk`, `Open`, `Mitigating`, `Occurred`, `Resolved`, `Accepted`.
- [ ] Durum örtük olayla değişmez. `Accepted` riskin yok olduğunu iddia etmez.
- [ ] Bug, Test Açığı, Üretim Olayı türüne dönüş veya onlarla tek kayıt birleşimi yoktur. Olasılık/etki otomatik öncelik puanı değildir.
- [ ] Kabul kanıtı Risks seam’inde: oluşturma, durum matrisi, tür karışmama, puan yokluğu. [Karar ve belirsizlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
