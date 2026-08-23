# 04 — Geri Bildirim ve Kaynak Feed'i

**What to build:** Feed, Geri Bildirim ve uzun gövdeli Kaynak ana kayıtlarını kimlik veya kanal, zaman, ekler, proje ve ilişkili İş/Karar ile yoğun okuma görünümünde gösterir. Satır ayrı kayıt, sosyal gönderi, yorum dizisi, oy veya ikinci yaşam döngüsü değildir. Sıralama kaynak durumunu veya önceliği yazmaz. Ayrıntı `Open Source Record` ile aynı ana kayıttadır. Feed Bildirim Merkezi, evrensel arama, inbox veya destek aracı değildir; Kaynak sürüm sözleşmesini yeniden tanımlamaz. Beğeni ve yorum dizisi yoktur.

**Blocked by:** 01 — Geri Bildirim ana kaydı

**Status:** ready-for-agent

- [ ] Feed aynı ana kayıt kimliklerini gösterir; ikinci kayıt türü üretmez.
- [ ] Sıralama/filtre Kaynak veya Geri Bildirim durumunu ve önceliğini değiştirmez.
- [ ] Satır `Open Source Record` ile ana kaydı açar; beğeni, yorum dizisi ve oy yoktur.
- [ ] Birleşik Bildirim Merkezi sinyali üretilmez; Feed evrensel arama, inbox veya destek aracı değildir; Kaynak yeniden kontrol API'si burada yoktur.
- [ ] İngilizce UI `Feed` ve `Open Source Record` kullanır.
- [ ] Kabul kanıtı aynı seam'de: aynı id'ler, durum yazmama karşıtı, sosyal eylem yokluğu, bildirim sinyali yokluğu. Bu kanıt [Kanıt akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) okuma yüzeyidir.
