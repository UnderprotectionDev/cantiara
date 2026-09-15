# 02 — Public wiki sayfası, noindex ve fail-closed kaldırma

**What to build:** Yayımlanan Wiki sayfası URL'yi bilen herkese salt okunur açılır. Varsayılan `noindex`'tir, sitemap'e girmez; indeksleme ayrı açık eylemdir ve üçüncü taraf kopyanın tam geri alınamayacağı uyarılır. Ziyaretçi yorum, oy, geri bildirim, abonelik veya ortak düzenleme yapamaz. YouTube tıklayınca yüklenir. Her HTML ve asset isteği güncel yüzey durumunu cache'den önce doğrular; iptal yeni erişimi fail-closed reddeder. Erişim adaptörü 73 ile aynıdır; kart ayrı policy açmaz.

**Blocked by:** 01 — Tek Wiki Belgesi kapalı dünya önizlemesi ve yayın

**Status:** ready-for-agent

- [ ] Public GET onaylı snapshot'ı gösterir; Workspace yazması, palet ve arama yoktur.
- [ ] Varsayılan `noindex` ve sitemap dışı; indeksleme açık eylem ve uyarı ister; indeksleme üstverinin varlığıyla kendiliğinden açılmaz.
- [ ] Wiki yayın başlığı/özeti/slug Proje Build in Public üstverisinden miras almaz; slug değişimi özel içeriğe redirect üretmez.
- [ ] Unpublish/iptal HTML ve asset/range isteklerini cache'den önce gövdesiz `410 Gone` + `noindex` ile reddeder; ham R2 URL açıklanmaz; URL yeniden kullanılmaz.
- [ ] YouTube sayfa açılışında üçüncü taraf isteği atmaz; tıklayınca `Live external source` ile yüklenir.
- [ ] Ziyaretçi yorum/oy/abonelik yüzeyleri yoktur.
- [ ] Kabul kanıtı Wiki Publishing seam'inde (paylaşılan erişim adaptörüyle): noindex, kaldırma, range, YouTube. Erişilebilirlik **yayın önizleme ve iptal**.
