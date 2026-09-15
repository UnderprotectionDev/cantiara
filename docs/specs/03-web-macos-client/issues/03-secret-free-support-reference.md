# 03 — Secret’siz destek referansı

**What to build:** Başarısız ana akışta kullanıcı anlaşılır hata nedenini, güvenli yeniden deneme sınırını, verinin yazılıp yazılmadığını ve secret/özel içerik taşımayan bir `Support reference` görür. Bu pager, müşteri kuyruğu veya S1 alarm konsolu değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Başarısız ana akış neden, yeniden deneme sınırı, yazıldı/yazılmadı ve sunucu takip kimliğinden türetilen destek referansı gösterir.
- [ ] Referans token, oturum, e-posta secret’ı veya Workspace gövdesi içermez; log yutucusuna özel içerik yazılmaz.
- [ ] UI bu yüzeyi pager veya 7/24 nöbet gibi sunmaz; operatör alarmı ayrı feature’dadır.
- [ ] İngilizce `Support reference` ve `Retry` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Client Shell seam'inde başarısız akış, secret sızıntısı karşıtı, yazıldı/yazılmadı doğruluğu. [Gözlemlenebilirlik](../../../prd/15-product-quality.md#gozlemlenebilirlik) ve platform kabulünün hata paketi.
