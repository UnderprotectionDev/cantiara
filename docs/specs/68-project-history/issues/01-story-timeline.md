# 01 — Gerçekleşen olaylar zaman çizelgesi

**What to build:** Kurucu bir Projede veya Özellik türündeki İşte önemli gerçekleşmiş olayları kronolojik hikâye olarak okur. Karar, Belge, tasarım, İş, ulaşılan Kilometre Taşı, yaşam döngüsü değişikliği, kod değişikliği, Üretim Olayı, deney/doğrulama sonucu ve Proje Sürümü görünür. Vazgeçme gerekçesi ilgili olayda durur. Her alan değişikliği hikâyede yoktur. Olay kaynak ana kaydı açar. Hikâye kapanış özeti, herkese açık gelişim akışı veya otomatik başarı anlatısı değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Proje bağlamında `Story Timeline` önemli gerçekleşmiş olayları kronolojik gösterir; alan düzeyi düzenlemeler bu listede yoktur.
- [ ] Özellik türündeki İş bağlamı aynı hikâyeyi o İş kapsamına indirger; bütün Projeyi varsayılan olarak dökmez.
- [ ] Vazgeçme gerekçesi ilgili olayda görünür; kaynak `Open source record` ile açılır.
- [ ] Hikâye kapanış Belgesi, sürüm notu veya herkese açık gelişim akışı üretmez ve AI başarı cümlesi yazmaz.
- [ ] İngilizce UI `Project History` ve `Story Timeline` kullanır; eksik etiketler PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Project History seam'inde hikâye listesi, Özellik kapsamı, alan-edit karşıtı ve kaynak açma. Kanıt [kişisel bağlam](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuklarına bağlanır.
