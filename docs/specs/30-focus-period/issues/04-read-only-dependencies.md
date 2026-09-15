# 04 — Salt okunur Dependencies

**What to build:** Dönem detayında isteğe bağlı salt-okunur `Dependencies`, yalnız o kapsamdaki mevcut aktif ve çözülmüş blokaj ilişkilerinden türetilir. Düğümler ana kayıtları açar; aktif/çözülmüş, yön ve güvenle saptanabilen döngü açıklanır ve yalnız renge dayanmaz. Görünüm yeni ilişki, Mermaid kaynağı, manuel düğüm konumu, ikinci planlama verisi veya kritik yol üretmez. İlişki yazma blokaj feature’ındadır.

**Blocked by:** 01 — 1–8 haftalık pencere, üyelik durum yazmaz

**Status:** ready-for-agent

- [ ] `Dependencies` mevcut ilişkileri okur; oluşturma/çözme eylemi sunmaz.
- [ ] Düğüm `Open source record` ile kaynağı açar; yeni planlama gerçeği saklanmaz.
- [ ] Kritik yol, otomatik yeniden zamanlama ve ayrı grafik kaydı yoktur.
- [ ] Kabul kanıtı seam’de türetim ve yazmama karşıtı.
