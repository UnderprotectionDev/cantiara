# 01 — Canlı üyelik, manuel pin yok

**What to build:** Akıllı Koleksiyon üyeliği yalnız görsel koşul oluşturucunun kayıt filtrelerinden canlı türetilir. Manuel üyelik, pin veya filtre dışı istisna yoktur. Her üye neden girdiğini açıklar. Sürükleme mümkünse kaydı koşula uyduracak alan değişikliğini önizler; pin yazmaz. Matris dışı türler kaynak olmaz; Belge yalnız yapılandırılmış üstveri, etiket ve kapsamla üye olabilir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Koşul değişince üyelik yeniden türetilir; saklı üye listesi yoktur.
- [ ] Pin veya istisna reddedilir; sürükleme önizlemesi alan yazımıdır, ebeveynlik değildir.
- [ ] Tek Proje veya Projeler arası koşul hâlâ canlı üyeliktir; çapraz Proje statik liste, klasör veya etiket ürünü açılmaz.
- [ ] Belge yalnız yapılandırılmış üstveri, etiket ve kapsamla üye olur; Ekran, diyagram ve Dosya Eki kaynak olmaz.
- [ ] İngilizce UI `Smart Collection` kullanır; serbest sorgu dili yoktur.
- [ ] Kabul kanıtı Smart Collections seam’inde canlı üyelik ve pin karşıtı. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
