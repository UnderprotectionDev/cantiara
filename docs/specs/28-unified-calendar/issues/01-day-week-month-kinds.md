# 01 — Gün, hafta, ay; türler karışmaz

**What to build:** Birleşik Takvim desteklenen tarihli kayıtları `Day`, `Week` ve `Month` görünümünde gösterir. `Planned start`, `Target date` ve `Reappear date` ayrı tür ve anlamlarıyla durur. Bütün Projeler veya seçilen Proje kapsamında incelenebilir. Başlangıç ile hedef birlikteyse hafta ve ayda aralık; gün görünümü yalnız seçili gündeki konumları gösterir. Planlanan başlangıç işi gizlemez, otomatik başlatmaz ve durum yazmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Üç görünüm aynı kayıt kümesini türleri karıştırmadan sunar; Event kaydı oluşmaz.
- [ ] Hafta/ay aralığı yalnız başlangıç+hedef çiftinde vardır; gün görünümü aralığı tek güne yaymaz.
- [ ] Planlanan başlangıç İş akışı durumunu değiştirmez, kaydı gizlemez ve işi otomatik başlatmaz.
- [ ] Takvim durum tahtası, sprint veya yayın taahhüdü değildir.
- [ ] İngilizce UI `Calendar`, `Day`, `Week`, `Month`, `Planned start`, `Target date`, `Reappear date` kullanır.
- [ ] Kabul kanıtı Unified Calendar seam’inde tür ayrımı ve aralık/gün farkı. Kanıt [Günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
