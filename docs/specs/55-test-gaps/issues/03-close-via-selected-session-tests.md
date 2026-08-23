# 03 — Kapanış seçili Oturum Testleriyle

**What to build:** `Met by result` kullanıcının seçtiği kesin Oturum Testlerini ve isteğe bağlı gerekçeyi ister. `Not needed` gerekçeyi ve varsa ilgili Kararı korur. Kapanış kaydı silmez; kesin ilişkiler ve karar geçmişte kalır. Seçimsiz kapanış yoktur.

**Blocked by:** 02 — Open ve Planned; sonuç otomatik kapatmaz

**Status:** ready-for-agent

- [ ] `Met by result` seçili kesin Oturum Testleri olmadan uygulanmaz.
- [ ] `Not needed` gerekçe taşır; kayıt silinmez.
- [ ] Coverage yüzdesine indirgeme yoktur.
- [ ] İngilizce UI `Met by result`, `Not needed` kullanır.
- [ ] Kabul kanıtı aynı seam'de: seçili maddelerle kapanış, silmeme. [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) açık kapanış paketidir.
