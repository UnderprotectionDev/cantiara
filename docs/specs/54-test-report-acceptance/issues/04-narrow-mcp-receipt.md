# 04 — Dar MCP ve teslim makbuzu

**What to build:** Yetkili istemci yalnız `test_report.submit` ile `test-report/1` teslim eder. Genel kayıt yazımı, ajan araç pazarı, senaryo/spec/belge okuma, mevcut kaydı değiştirme, başka tür oluşturma, ürün içi komut veya binary Dosya Eki yoktur. Raporlayan payload'dan seçilmez. Başarılı cevap yalnız makbuzdur: iç oturum kimliği, dış oturum kimliği, kabul zamanı, parmak izi, `created`/`duplicate`; oturumun özel içeriği dönmez. İptal Handoff'a doğru kimlikle gelen rapor tarihsel bağlanır, Handoff yeniden açılmaz, `handoff-result-after-cancel` üretilir.

**Blocked by:** 02 — Atomik, idempotent kabul ve kanonik kimlik

**Status:** ready-for-agent

- [ ] MCP yalnız `test_report.submit` ile `test-report/1` yazar; genel veritabanı yazma kanalı, ajan araç pazarı, kayıt okuma API'si veya salt okunur bağlam köprüsü değildir.
- [ ] Binary/base64 kanıt `attachment_rejected` ile reddedilir.
- [ ] Başarılı cevap özel oturum gövdesi içermez.
- [ ] Sahte `Raporlayan` alanı reddedilir; iptal Handoff yeniden açılmaz.
- [ ] Limit aşımları sessiz kırpılmaz (`payload_too_large` / `invalid_field`).
- [ ] Kabul kanıtı aynı seam'de: grill 15, 19, 21; dar MCP karşıtları. [Test kabulü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) MCP yarısıdır.
