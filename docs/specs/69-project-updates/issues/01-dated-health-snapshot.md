# 01 — Tarihli öznel sağlık ve kaynak snapshot'ı

**What to build:** Kurucu `On Track`, `At Risk` veya `Off Track` işareti, kısa anlatı ve isteğe bağlı kaynak bağlarıyla bir Manuel Proje Güncellemesi kaydeder. Kayıt anındaki canlı Proje özet blokları zaman damgalı salt okunur snapshot olur; bağlı ana kayıtlar canlı kalır ve açılır. Yeni kayıt eskisini silmez; kaydedilmiş giriş yerinde yeniden yazılmaz. Ürün “proje sağlıklıdır” diye konuşmaz; kayıt canlı skor, durum kapısı veya Proje genel bakışı değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Kurucu üç kapalı işaretten biriyle kısa anlatı kaydeder; kayıt Risk, Karar, Kilometre Taşı veya diğer ana kayıtlara bağlanabilir.
- [ ] Kayıt anındaki canlı özet blokları tarihli salt okunur snapshot olur; bağlı kayıtlar canlı `Open source record` ile açılır ve yeni doğruluk kaynağı olmaz.
- [ ] Sonraki kayıt önceki girişi silmez; kronoloji korunur.
- [ ] Kaydedilmiş işaret, anlatı ve özet snapshot yerinde yeniden yazılmaz; sonraki hüküm yeni tarihli giriştir.
- [ ] Ürün güncel sağlık hükmü, skor veya Mission Control özeti üretmez; Proje genel bakışı bu kayıtla değişmez.
- [ ] İngilizce UI `Project Update`, `On Track`, `At Risk`, `Off Track` kullanır; eksik etiketler terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Manual Project Updates seam'inde: kayıt, snapshot donması, ekleme, skor yokluğu. Kanıt [İlk Proje](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [kişisel bağlam](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuklarına bağlanır.
