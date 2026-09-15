# 02 — Atomik ve idempotent Apply Import

**What to build:** Kullanıcı kesin farkı gördükten sonra ayrı `Apply Import` onayı verir. Seçilen nihai küme atomiktir: bütün kayıt ve ilişkiler bir kez yazılır veya hiçbiri yazılmaz. İşlem idempotency anahtarı, payload parmak izi ve taban/kaynak koşullarıyla yürür; sonuç kalıcı makbuzdur. İptal yalnız commit bariyerinden önce. Bariyerden sonra `Finalizing` ve tam commit veya tam rollback. Bilinmeyen gelecek JSON şema sürümü yazmadan reddedilir.

**Blocked by:** 01 — Eşleme ve fark önizlemesi (yazmasız)

**Status:** ready-for-agent

- [ ] `Apply Import` önizlenen nihai kümeyi atomik yazar; kayıt bazlı kısmi başarı yoktur. Geçersiz satır düzeltilmeden veya kapsamdan çıkarılmadan Apply reddedilir.
- [ ] Aynı idempotency anahtarı + aynı payload önceki makbuzu döndürür; farklı payload çatışmadır. Import sahte insan taban revizyonu uydurmaz.
- [ ] Bariyer öncesi iptal staging'i bırakır ve birincil yazmaz; bariyer sonrası `Finalizing` sahte Cancel'a dönüşmez.
- [ ] Bilinmeyen JSON şema sürümü ve ADR-0005 kayıpları onay öncesi/Apply'da yazmadan reddedilir veya alan bazında önceden açıklanır.
- [ ] Kabul kanıtı Standard Import seam'inde atomiklik, retry, çatışan payload, `Finalizing`. Kanıt [Taşınabilirlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve Mutasyon sözleşmesinin import kökeni dilimidir.
