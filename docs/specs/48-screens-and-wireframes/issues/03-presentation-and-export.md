# 03 — Presentation Mode ve dışa aktarma

**What to build:** Presentation Mode editör araçlarını gizler ve seçilen başlangıç Ekranından bağlantıları salt okunur prototip olarak izler. PNG/SVG seçili öğe veya Ekranı; PDF ve tek dosyalı interaktif HTML seçilen Ekranları ve desteklenen bağlantıları kesin Wireframe sürümlerinden üretir. HTML kendi kendine yeterlidir: ağ yok, ürün URL'si yok, analytics yok, yazma yolu yok; çözülemeyen hedef çözülemedi kalır. Çıktı canlı belgeyi ezmez ve yeni doğruluk kaynağı değildir. Masaüstü/mobil varyant yönetimi yoktur.

**Blocked by:** 02 — WireframeDocument motoru ve semantik düzenleme

**Status:** ready-for-agent

- [ ] Presentation Mode düzenleme açmaz; kırık hedef başka Ekrana yönlenmez.
- [ ] PNG/SVG/PDF/HTML kesin sürümlerden üretilir; Konva JSON export sözleşmesi değildir.
- [ ] Tek dosyalı HTML çevrimdışı, gömülü varlıklı ve deterministik manifestlidir; ürüne yazmaz.
- [ ] Export canlı `WireframeDocument`'i üzerine yazmaz.
- [ ] İngilizce UI `Presentation Mode` kullanır.
- [ ] Kabul kanıtı aynı seam'de: sunum salt okunur, kırık hedef, HTML yalıtımı, sürüm bağının korunması. Bu kanıt [Tasarım bağlamı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) snapshot karşılaştırmasıdır.
