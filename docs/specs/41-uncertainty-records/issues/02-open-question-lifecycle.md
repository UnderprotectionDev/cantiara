# 02 — Açık Soru yaşamı ve yanıtsız otomatik dönüşüm

**What to build:** Kurucu yanıt bekleyen belirsizliği Açık Soru olarak tutar. Yaşam `Open`, `Answered`, `No longer applicable`. `Answered` isteğe bağlı kanıt veya gerekçe kabul eder. Yanıt veya `No longer applicable` soruyu, yanıtı ve kanıt bağlamını silmez. Yanıt otomatik Karar, Risk veya İş üretmez. Varsayım ile tek türe birleştirilmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Açık Soru ayrı ana kayıttır. İngilizce `Open Question`, `Open`, `Answered`, `No longer applicable`.
- [ ] `Answered` geçişinde isteğe bağlı kesin kanıt veya gerekçe kabul edilir; eksik kanıt görünürdür ve geçişi kilitlemez. `Answered` soruyu silmez; yanıt ve kanıt tarihsel bağlamda kalır.
- [ ] `No longer applicable` yeni kanıt gerektirmez; soru metni, varsa yanıt ve mevcut kanıt bağlamı silinmez.
- [ ] Yanıt veya geçersiz kılma otomatik Karar, Risk veya İş oluşturmaz; ilişkili kayıtların yaşamını yazmaz.
- [ ] Soru Geri Bildirim özgün mesajı veya araştırma notu değildir.
- [ ] Kabul kanıtı aynı seam’de: iki tür ayrı kalır, yanıt ve `No longer applicable` silmez, isteğe bağlı kanıt, otomatik dönüşüm yokluğu. [Karar ve belirsizlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
