# 03 — Yeni bağlam eski snapshot'ı taşımaz

**What to build:** Kayıttan sonra gelen yeni veya düzeltilmiş sonuç, yeni Test Açığı veya ilgili bağlam değişikliği snapshot'ı yeniden yazmaz. Ürün Assessment üzerinde `New test context after this assessment` dikkatini ve kesin kaynakları gösterir. Eski snapshot yeni Özellik, Handoff veya Proje Sürümü sürümüne otomatik taşınmaz. Kayıtsız Bildirim Merkezi sinyali üretilmez.

**Blocked by:** 01 — Tarihli değerlendirme snapshot'ı

**Status:** ready-for-agent

- [ ] Sonraki `Failed` sonuç kaydedilmiş `Acceptable` kararını değiştirmez.
- [ ] Yeni bağlam bildirimi kesin kaynakları listeler.
- [ ] Yeni Proje Sürümü eski snapshot'ı miras almaz.
- [ ] Kayıtsız Notification Center kimliği yoktur.
- [ ] Kabul kanıtı aynı seam'de: sessiz güncelleme karşıtı, taşımama. [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve grill 14.
