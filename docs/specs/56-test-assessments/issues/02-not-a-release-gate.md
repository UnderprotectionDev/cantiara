# 02 — Karar yayın kapısı veya skor değildir

**What to build:** Karar `Acceptable`, `Follow-up needed` veya `Undecided`'dir. Değerlendirme kalite skoru, otomatik readiness, test istisnası veya yayın kapısı değildir. Kullanıcı değerlendirme oluşturmadan Proje Sürümü yayımlayabilir. Snapshot Ürün kabul kanıtı üretmez ve bildirilen oturumu geriye dönük doğrulanmış kanıta çevirmez. GitHub check sonucu snapshot'a kopyalanmaz.

**Blocked by:** 01 — Tarihli değerlendirme snapshot'ı

**Status:** ready-for-agent

- [ ] Üç karar enum'u vardır; coverage veya skor alanı yoktur.
- [ ] Değerlendirmeden bağımsız yayın denemesi engellenmez (bu ticket yayın UI'si açmaz, kapı yokluğunu doğrular).
- [ ] Bildirilen oturum Ürün kabul kanıtı olmaz (ADR-0007).
- [ ] GitHub check sonucu snapshot'a otomatik kopyalanmaz.
- [ ] İngilizce UI `Acceptable`, `Follow-up needed`, `Undecided` kullanır.
- [ ] Kabul kanıtı aynı seam'de: kapı yokluğu, skor yokluğu, grill 14'ün kapı yarısı.
