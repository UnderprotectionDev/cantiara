# 01 — Varsayım yaşamı ve kanıt bağlamı

**What to build:** Kurucu doğrulanmamış önermeyi Varsayım olarak tutar. Yaşam `Open`, `Confirmed`, `Refuted`, `No longer applicable`. `Confirmed`/`Refuted` geçişinde isteğe bağlı kesin kanıt veya gerekçe; eksik kanıt görünür kalır, geçişi kilitlemez. `No longer applicable` yeni kanıt gerektirmez; mevcut kanıt bağlamı silinmez. Çürütme bağlı Kararları kapatmaz. `Refuted Assumption Review` ve `Based on` yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Varsayım Açık Sorudan ayrı Proje ana kaydıdır. İngilizce `Assumption`, `Open`, `Confirmed`, `Refuted`, `No longer applicable`.
- [ ] `Confirmed` ve `Refuted` isteğe bağlı kesin kanıt veya gerekçe kabul eder; eksik kanıt görünürdür ve geçişi kilitlemez. `No longer applicable` yeni kanıt gerektirmez; mevcut kanıt bağlamı silinmez.
- [ ] Çürütme Karar, Risk veya İş yaşamını yazmaz; otomatik tür dönüşümü yoktur.
- [ ] `Based on` / `Basis for` ilişkisi ve `Refuted Assumption Review` yüzeyi/rotası ilk üründe yoktur (ADR-0013).
- [ ] Kayıt Deney/Doğrulama veya araştırma oturumu değildir.
- [ ] Kabul kanıtı Uncertainty Records seam’inde: geçiş matrisi, kanıt bağlamı, yazmama, kuyruk yokluğu. [Karar ve belirsizlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
