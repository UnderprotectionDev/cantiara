# 02 — Tek kalıcı manuel sıra

**What to build:** Backlog kendine ait tek kalıcı manuel sırayı tutar. Kurucu `Manual order` görünümünde kartları sürükleyerek hangisini önce ele alacağını kalıcılaştırır. Alternatif öncelik, tarih veya alan sıralaması geçici ya da kayıtlı sunum olarak seçilince manuel sıra arka planda korunur ve `Manual order` yeniden seçilince geri gelir. Bu sıra öncelik puanı veya kapanış değildir.

**Blocked by:** 01 — Hazır üyelik durum yazmaz

**Status:** ready-for-agent

- [ ] Projede tek kalıcı manuel İş sırası vardır; `Manual order` sürüklemesi onu yazar.
- [ ] Alternatif sıralama seçilince saklı sıra silinmez; `Manual order` dönüşünde aynı sıra görünür.
- [ ] Sıra Kanban konumuna, normal Akıllı Koleksiyon rank’ine veya Önceliklendirme oturumu rank’ine yazılmaz; oturum rank’i Backlog sırasını yazmaz.
- [ ] Kabul kanıtı seam’de sürükleme kalıcılığı, alternatif sunumdan dönüş ve çapraz yüzey sıra karşıtı. Bu [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) değişiklik geçmişi paketidir.
