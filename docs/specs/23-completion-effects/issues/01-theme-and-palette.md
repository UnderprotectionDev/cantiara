# 01 — Hesap tema ve palet seçimi

**What to build:** Bitiriş efekti varsayılan kapalıdır. Kurucu Hesap düzeyinde etkinleştirir; `Calm`, `Weave`, `Arc`, `Nova` içinden bir tema ve o temanın tam dört paletinden birini seçer. Örnekler durağandır; hareket yalnız `Preview` ile başlar. Rastgele seçim, Proje override, olay düzeyi seçim ve serbest parametre editörü yoktur. Katalog adı olmayan değer kullanılamaz. Tercih ürün teması, tasarım tokenı veya Moodboard paleti değildir; 02'nin locale/görünüm yüzeyi katalog sahibi değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Varsayılan kapalıdır; etkinleştirme, tema ve palet Hesap kapsamındadır ve bütün Projelerde aynıdır.
- [ ] Dört tema kapalı katalogdur; her temada tam dört palet vardır. PRD bölümünde adı olmayan palet saklanamaz ve oynatılamaz.
- [ ] Örnekler durağandır; gezinti hareket başlatmaz. `Preview` İş durumu, `Work completed` bildirimi veya 30 sn beklemeyi etkilemez.
- [ ] Lisanslı karakter, evren taklidi ve kullanıcı yüklemeli görsel/animasyon/ses yoktur ([ADR-0017](../../../adr/0017-bitiris-efektlerini-ozgun-birinci-taraf-katalogla-sinirla.md)).
- [ ] Locale, saat dilimi ve açık/koyu bu ticket'ta yönetilmez; katalog sahibi bu feature'dır.
- [ ] Seçim ürün teması, tasarım tokenı veya Moodboard paleti değildir; kapalı birinci taraf efekt kataloğudur.
- [ ] Açık uçlu tema pazarı ve sürekli arka plan animasyonu yoktur.
- [ ] İngilizce UI `Calm`, `Weave`, `Arc`, `Nova`, `Preview` kullanır.
- [ ] Kabul kanıtı Completion Effects seam'inde: ayar, durağan örnek, Preview, allow-list karşıtı. Kanıt [Bitiriş efekti](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ayar/önizleme E2E'sidir (web–Tauri tercih parity).
