# 03 — Görünüm kırpma, sunum ve snapshot

**What to build:** Bu görünüme ait kırpma ve 90° döndürme geri alınabilir üstveridir; kesin Dosya Eki sürümüne bağlıdır; özgün dosyayı, sürüm zincirini veya aynı eki kullanan diğer görünümleri değiştirmez. PNG/PDF düzenlenmiş sunumu kullanır, özgün indirilebilir kalır. Presentation Mode araçları gizler; odak sırası ikinci belge veya içerik kopyası değildir. Grup/bölge snapshot'ı tarihli PNG/PDF'dir, canlı bağlantı taşımaz, kaynak görselleri değiştirmez; herkese açık yayın veya onaylı Dış yüzey değildir.

**Blocked by:** 01 — Görsel referanslar ve köken

**Status:** ready-for-agent

- [ ] Kırpma/döndürme özgün baytları ve diğer görünümleri değiştirmez.
- [ ] Snapshot kaynak görselleri mutasyona uğratmaz; önizleme canlı bağ olmadığını söyler.
- [ ] Presentation Mode ikinci içerik kopyası üretmez.
- [ ] Sunum veya snapshot canlı eşitlenen marka kılavuzu değildir.
- [ ] Paylaşım bağlantısı ve Build in Public bu ticket'ta yoktur.
- [ ] İngilizce UI `Presentation Mode` kullanır.
- [ ] Kabul kanıtı aynı seam'de: bayt değişmeme, snapshot–kaynak farkı. [Tasarım bağlamı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) snapshot karşılaştırmasıdır.
