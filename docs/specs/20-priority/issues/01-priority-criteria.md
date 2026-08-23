# 01 — Proje öncelik ölçütleri

**What to build:** Kurucu Projede isteğe bağlı öncelik ölçütleri tanımlar: ad, kısa açıklama ve beş sabit kademe. Boş/değerlendirilmemiş beş kademenin dışındadır. Aynı adlı ölçütler Projeler arasında ortak kimlik değildir. Sistem kademeleri toplamaz, ağırlıklandırmaz, forma veya tek skora çevirmez. `Evidence strength` hazır tanımı varsayılan kapalıdır; kurucu etkinleştirir ve kademeyi kendisi seçer.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Ölçüt Proje kapsamındadır; beş kademe `Very low` … `Very high` kapalı sözleşmedir; serbest sayısal formül yoktur.
- [ ] Boş durum kademe değildir. İş kaydında skaler `priority` alanı yoktur.
- [ ] Tek skor, WSJF otomasyonu ve Çalışma Alanı genelinde evrensel öncelik alanı yoktur.
- [ ] Ölçüt İş alanı veya özel alan değildir; yalnız değerlendirme eksenidir.
- [ ] `Evidence strength` varsayılan kapalıdır; Geri Bildirim/Contact/Kaynak değeri otomatik yazmaz.
- [ ] Yapılandırma çöpünde tanım etkin çalışmaz; trash UI'si burada yoktur.
- [ ] Kabul kanıtı Prioritization seam'inde: CRUD, boş kademe, skor/WSJF yokluğu, auto-fill karşıtı. Kanıt [İş yaşam döngüsü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paketindeki isteğe bağlı ölçüt değerleridir; skaler öncelik alanı veya otomatik sıra hükmü yoktur.
