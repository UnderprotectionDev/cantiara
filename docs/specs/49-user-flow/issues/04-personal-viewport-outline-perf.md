# 04 — Kişisel viewport, outline ve performans

**What to build:** Bu Kullanıcı Akışı tuvalinde viewport merkezi, zoom ve görünüm-yerel daraltma oturumlar arasında korunur; içerik, paylaşım, export veya başka kullanıcı görünümü değildir. `Fit View` nötrler; anlamsız konum görünür içeriğe sığar. Yapılandırılmış outline işaretçi olmadan oluşturma, seçme, sıralama, gruplama, bağlama, bağlantı kaldırma, inceleme ve kaynak açmayı sunar. Sert sahne 500 görünür öğe / 750 görsel bağlantıdır.

**Blocked by:** 02 — Kapalı semantik küme ve editör ortakları

**Status:** ready-for-agent

- [ ] Viewport bu tuvale özgüdür; ilişki veya paylaşım snapshot'ına yazılmaz.
- [ ] `Fit View` boş bölgeye açılmaz.
- [ ] Outline işlevsel eşdeğerdir; klavye pan/zoom/seçim/taşıma vardır.
- [ ] 500/750 kare bütçesini tutar.
- [ ] Kabul kanıtı aynı seam'de: viewport, outline işlev testi, canvas performans ölçümü. Kapalı yolculuk **canvas yapılandırılmış outline**.
