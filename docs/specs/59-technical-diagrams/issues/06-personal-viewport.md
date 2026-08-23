# 06 — Kişisel viewport, zoom ve sığdır

**What to build:** Teknik Diyagram yüzeyinde son kişisel viewport merkezi, zoom ve yalnız görünüm-yerel daraltma oturumlar arasında korunur. Bu değerler içerik semantiği, arama alanı, paylaşım snapshot'ı, export veya başka kullanıcının görünümü değildir. `Fit view` tek adımda nötr görünüme döner. Silinen veya anlamsız kalan konum görünür içeriğe sığar; boş bölgeye açılmaz.

**Blocked by:** 02 — Üç tür ve kanonik yapısal model

**Status:** ready-for-agent

- [ ] Viewport/zoom/collapse Hesap kişisel üstverisidir; yapısal model hash'ine ve paylaşım snapshot'ına girmez.
- [ ] `Fit view` nötr görünüme döner; kayıp konum güvenli sığar.
- [ ] Daraltma kayıt ilişkisi veya başka kullanıcı görünümü yazmaz.
- [ ] Kabul kanıtı aynı seam'de: oturumlar arası geri yükleme, Fit view, paylaşımda viewport yokluğu.
