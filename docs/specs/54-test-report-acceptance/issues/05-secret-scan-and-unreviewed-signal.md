# 05 — Secret taraması fail-closed ve incelenmemiş sinyal

**What to build:** Kesin veya yüksek güvenli sağlayıcı token kalıbı bütün raporu `sensitive_data_detected` ile reddeder; yalnız maskelenmiş alan yolu döner; ürün kanıtı sessizce düzenlemez. Gözetimsiz MCP'de belirsiz bulgu da reddedilir; dosya/manuel giriş maskeli inceleme isteyebilir. Dosya veya MCP ile oluşan her yeni Test Oturumu Birleşik Bildirim Merkezinde tek `unreviewed-test-report` üretir; alt maddeler ayrı sinyal değildir; idempotent tekrar yeni sinyal açmaz. Elle oluşturulan oturum ek bildirim üretmeden Tests alanında `Unreviewed` görünür. İnceleme UI'si 57'dedir.

**Blocked by:** 02 — Atomik, idempotent kabul ve kanonik kimlik; 04 — Dar MCP ve teslim makbuzu

**Status:** ready-for-agent

- [ ] Bilinen token sessiz kısmi kabul veya kanıt düzenlemesi üretmez (ADR-0007).
- [ ] MCP belirsiz bulgusu da reddedilir.
- [ ] Yeni dosya/MCP oturumu tek sinyal üretir; tekrar teslim üretmez; manuel oturum sinyal açmaz.
- [ ] Kayıtsız başka bildirim kimliği üretilmez.
- [ ] Kabul kanıtı aynı seam'de: grill 11 secret fail-closed, sinyal tekilleştirme. İnceleme yolculuğu 57'dedir.
