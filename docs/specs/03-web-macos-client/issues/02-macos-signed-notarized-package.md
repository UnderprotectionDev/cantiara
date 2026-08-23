# 02 — İmzalı noterli macOS paketi

**What to build:** macOS paketi platform sertifikasıyla imzalanır ve notarization’dan geçer. Web ile aynı backend ve ürün sözleşmesini kullanır; Tauri veri katmanını Rust’a taşımaz. Kabul tarihindeki güncel macOS ana sürümü ile önceki iki ana sürümde temiz kurulur. Windows, self-host ve PWA yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Üretilen masaüstü çıktısı imzalı ve noterli kabul adayına bağlanır; imzasız iskelet paketi ürün davranışı sayılmaz.
- [ ] Paket aynı Hono/Bun backend’ine konuşur; yerel Postgres/dosya doğruluk kaynağı yoktur.
- [ ] Güncel macOS ana sürümü ve önceki iki ana sürümde temiz kurulum Ürün destek matrisine yazılır.
- [ ] Windows/Linux paketi, PWA kurulumu ve self-host installer yok.
- [ ] Avrupa Birliği veri bölgesi seçici/taşıma UI’si ve operasyonel yedek RPO/RTO bu kartın işi değildir.
- [ ] Kabul kanıtı Client Shell seam'inde imza/notarization kanıtı ve kurulum matrisi; [platform kabulü](../../../prd/16-product-acceptance.md#platform-kabulu) macOS madde.
