# 05 — Kişisel viewport, outline ve 500/750 sahnesi

**What to build:** Bu Proje Duvarı tuvalinde viewport merkezi, zoom ve görünüm-yerel daraltma oturumlar arasında korunur; içerik, ilişki, paylaşım veya başka kullanıcı görünümü değildir. `Fit View` nötrler; anlamsız konum görünür içeriğe sığar. Yapılandırılmış outline oluşturma, seçme, sıralama, gruplama, bağlama, bağlantı kaldırma, inceleme ve kaynak açmayı işaretçi olmadan sunar. Sert sahne 500 görünür öğe ve 750 görsel bağlantıdır; 2,000/3,000 çökmez veya veriyi bozmaz.

**Blocked by:** 01 — Canlı kartlar, yerleşim kaynağı yazmaz; 02 — Görsel çizgi ve kilit ilişki yazmaz

**Status:** ready-for-agent

- [ ] Viewport bu tuvale özgüdür; ilişki veya paylaşım snapshot'ına yazılmaz.
- [ ] Outline işlevsel eşdeğerdir; klavye pan/zoom/seçim/taşıma/hizalama vardır.
- [ ] Sert sahne 500 görünür öğe / 750 görsel bağlantı: pan/zoom p95 kare ≤ 16 ms ve azami kare ≤ 33 ms ise geçer. 2,000 öğe / 3,000 bağlantı: çökme, bozulma veya veri kaybı yoksa geçer (uyarı, sanallaştırma veya azaltılmış ayrıntı serbest; 500 oluşturma tavanı değildir).
- [ ] Kabul kanıtı aynı seam'de: viewport, outline, performans. Kapalı yolculuk **canvas yapılandırılmış outline**.
