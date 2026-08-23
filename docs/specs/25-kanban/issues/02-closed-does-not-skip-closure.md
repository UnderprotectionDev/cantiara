# 02 — Closed kapanış adımı ve sonuç ayrımı

**What to build:** Kartı `Closed` sütununa almak kapanış adımını atlatmaz. Kullanıcı `Completed` veya `Abandoned` seçer; isteğe bağlı gerekçe aynı adımdadır. İptal durum değişikliğini uygulamaz. Aynı terminal durumda bile kart üzerinde iki sonuç ayırt edilir. Yeniden açma açık onay ve terminal olmayan hedef ister; önceki sonuç geçmişte kalır.

**Blocked by:** 01 — Durum sütunları ve kart hareketi

**Status:** ready-for-agent

- [ ] `Closed` bırakması kapanış adımını gösterir; sonuç seçilmeden durum yazılmaz.
- [ ] İptal önceki durumda bırakır; `Completed` ve `Abandoned` kartta ayırt edilir.
- [ ] Yeniden açma `Not Started`, `In Progress` veya `Blocked` hedeflerinden birini ister; etkin kapanış sonucu kalkar, geçmiş korunur.
- [ ] Kapanış kontrolü, kalıcı bağlamı koru ve Bitiriş efekti bu ticket’ta yoktur; invariant yalnız adımın atlanmamasıdır.
- [ ] Kabul kanıtı seam’de Closed bırakma, iptal karşıtı, iki sonuç ve yeniden açma. Bu [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ile [İş yaşam döngüsü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kapanış paketidir.
