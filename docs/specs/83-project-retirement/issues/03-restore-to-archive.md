# 03 — Geri yükleme Arşive; yeniden yayın yok

**What to build:** Proje silme grubunu geri yüklemek aynı kimlikleri Arşiv durumuna getirir, güvenli hedef işaretlerini yeniden bağlar, iptal edilmiş yüzeyi yeniden etkinleştirmez. Eski public URL/token sessizce dirilmez. GitHub bağlantısı örtük açılmaz. Yeniden yayın yeni Dış yüzey, URL/token ve açık onay ister. Geri yükleme başka hedefe taşıma veya kimlik yenileme değildir. Erken kalıcı silme 77-05'tedir.

**Blocked by:** 02 — Arşivden Proje silme grubu; Keep approved surface yasak

**Status:** ready-for-agent

- [ ] Restore aynı kimlikleri `Archive` durumuna getirir; `Active` çalışma yüzeyine fırlatmaz ve yayınlamaz.
- [ ] İptal Dış yüzey `Aktif` olmaz; yeni URL/token üretilmez; ziyaretçi eski bağlantıyla içerik alamaz.
- [ ] GitHub bağlantısı örtük `Bağlı` olmaz; kullanıcı 61 sözleşmesine yönlendirilir.
- [ ] Yaşayan kapsamlardaki silinmiş hedef işaretleri aynı kimlikle yeniden çözülür; başka kayda kaymaz.
- [ ] Kabul kanıtı restore-to-Archive, republish karşıtı, token/asset/range karşıtı. [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) restore dilimi.
