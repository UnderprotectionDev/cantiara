# 02 — Open ve Planned; sonuç otomatik kapatmaz

**What to build:** Test Açığı `Open`, `Planned`, `Met by result`, `Not needed` durumunu taşır. Planlı senaryo veya Handoff'a bağlanmak açığı en fazla `Planned` yapar. Yeni sonucun gelmesi veya rapor `relations` içinde açığı göstermesi durumu `Met by result` yapmaz. Yayın kapısı veya zorunlu kapsam değildir.

**Blocked by:** 01 — Test Açığı kaydı, otomatik üretim yok

**Status:** ready-for-agent

- [ ] Senaryo/Handoff bağı en fazla `Planned` yapar.
- [ ] Gelen rapor veya başarısızlık otomatik kapatmaz.
- [ ] Açık Ürün sürüm adayını veya Proje Sürümünü kendiliğinden bloklamaz.
- [ ] İngilizce UI `Open`, `Planned` kullanır.
- [ ] Kabul kanıtı aynı seam'de: Planned tavanı, rapor ilişkisi kapatmama (54 allow-list ile uyum).
