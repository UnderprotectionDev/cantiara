# 05 — Kişisel viewport, outline ve performans sahnesi

**What to build:** Bu Ekranın Wireframe tuvalinde son kişisel viewport merkezi, zoom ve yalnız görünüm-yerel daraltma oturumlar arasında korunur. Değerler içerik, arama, paylaşım snapshot'ı, export veya başka kullanıcının görünümü değildir. `Fit View` nötr görünüme döner; anlamsız konum görünür içeriğe sığar. Seçim, inspector, düzenleme kipi ve kaydedilmemiş işlem geri yüklenmez. Yapılandırılmış outline oluşturma, seçme, sıralama, gruplama, bağlama, bağlantı kaldırma, inceleme ve kaynak açmayı işaretçi olmadan sunar. Sert sahne 500 görünür öğe / 750 görsel bağlantıdır.

**Blocked by:** 02 — WireframeDocument motoru ve semantik düzenleme

**Status:** ready-for-agent

- [ ] Viewport bu tuvale özgüdür; paylaşım snapshot'ına veya ilişkiye yazılmaz.
- [ ] `Fit View` nötrler; boş bölgeye açılmaz.
- [ ] Outline işlevsel eşdeğerdir, salt okunur yedek değildir; klavye pan/zoom/seçim/taşıma/hizalama vardır.
- [ ] 500/750 sahnesi kare bütçesini tutar; 2,000/3,000 çökmez veya bozmaz.
- [ ] İngilizce UI `Fit View` kullanır.
- [ ] Kabul kanıtı aynı seam'de: viewport geri yükleme, paylaşım karşıtı, outline görevleri, performans sahnesi. Kapalı yolculuk **canvas yapılandırılmış outline**.
