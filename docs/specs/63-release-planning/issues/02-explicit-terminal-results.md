# 02 — Terminal sonuç yalnız açık eylem

**What to build:** `Published` ve `Cancelled` yalnız kurucunun açık eylemiyle yazılır. `Draft` ↔ `Preparing` serbesttir. GitHub Release upsert, changelog yayını veya Dış yüzey onayı terminal durumu örtük değiştirmez; en fazla öneri üretir. Cantiara kapanış sonucu dış etiketle yazılmaz.

**Blocked by:** 01 — Yayımlanacak kapsam olarak Proje Sürümü

**Status:** ready-for-agent

- [ ] Terminal geçiş komutu kullanıcı eylemidir; 61/14/65 olayları bu komutu çağırmaz.
- [ ] GitHub Release double ile durumun değişmediği karşıt test zorunludur.
- [ ] Terminal sonrası sessiz geri alma yoktur; yeniden açma ayrı açık eylemse PRD ortak yeniden açmayı izler, yoksa terminal kalır.
- [ ] Kabul kanıtı aynı seam'de: durum matrisi, örtük kapanış yokluğu. [Sürüm erişimi ve sonucu](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) planlama paketidir.
