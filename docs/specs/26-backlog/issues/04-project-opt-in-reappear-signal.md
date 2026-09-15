# 04 — Proje bazında yeniden görünme bildirimi

**What to build:** Yeniden görünme bildirimi varsayılan kapalıdır. Yalnız Proje bazında açık opt-in ile tarih gelince `reappear-date` `Action needed` sinyali üretilir. Sinyal durum yazmaz. Bildirim Merkezi kabuğu ve kişisel `Review later` bu ticket’ta yoktur.

**Blocked by:** 03 — Deferred yeniden görünme tarihi

**Status:** ready-for-agent

- [ ] Opt-in yokken tarih gelişi `reappear-date` basmaz.
- [ ] Proje opt-in iken tarih gelişi tam olarak bir `reappear-date` üretir; kaynak İş açılır.
- [ ] Sinyal İş durumu, öncelik veya Backlog sırasını değiştirmez.
- [ ] Kabul kanıtı seam’de varsayılan kapalı ve Proje opt-in matrisi. Bu [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) bildirim paketidir.
