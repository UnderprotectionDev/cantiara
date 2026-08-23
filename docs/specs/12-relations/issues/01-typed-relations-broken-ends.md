# 01 — Türlenmiş ilişkiler ve kırık uç

**What to build:** Ana kayıtlar kapalı katalogdaki türle, yön ve izinli uçlarla bağlanır. Kullanıcı yeni tür icat etmez. İlişki karşı ucu otomatik kapatmaz; durum yazmaz (uzman kural başka feature’da). Çözülemeyen uç ortak kırık referans sunumunu kullanır; gövde ve yetkisiz başlık sızmaz. En az `Related` ve `Origin`/`Derived` genel UI’si bu ticket’tadır; Kanıt rolü ve GitHub PR UI’si yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Katalog dışı tür reddedilir; iki uç, yön ve anlam saklanır.
- [ ] `Related` köken veya kanıt yerine geçmez; önizlemesiz yazılmaz.
- [ ] Kırık uç nedeni kapalı kümedendir; içerik/önizleme yok; yetkisiz adda sızıntı yok; `Open source record` yalnız Arşiv/Trash hedeflerinde durur, kalıcı silinen/redakte/erişimsizde gizlenir.
- [ ] Kırık hedefin içeriği arama, Akıllı Koleksiyon, hesaplanmış sayı veya export’a girmez; dikkat sinyali veya takip İşi üretmez.
- [ ] Sahipli bileşen kökeni bağımsız uç değildir; hedef `Köken konumu` taşır, benzer öğeye sessiz kaymaz.
- [ ] İngilizce `Related`, `Origin`, `Derived` ve kırık-neden etiketleri terim tablosuna aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Relations seam'inde katalog, sızıntı karşıtı, otomatik kapanmama. [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
