# 02 — İlerleme ve kayıt bazlı sonuç

**What to build:** Toplu uygulama arayüzü dondurmadan ilerleme gösterir; ilk ilerleme bütçe içindedir. Her seçilen İş için başarı veya başarısızlık görünür. Gizli kısmi başarı yoktur. Taban revizyonu çatışan kayıt görünür biçimde başarısız olur ve last-write-win yapmaz. Bariyerden önce iptal desteklenir; sonra `Finalizing`. Geri alınabilir alanlar ortak undo sözleşmesini kullanır.

**Blocked by:** 01 — Seçim ve alan farkı önizlemesi

**Status:** ready-for-agent

- [ ] İlk ilerleme göstergesi [büyük toplu işlem bütçesini](../../../prd/15-product-quality.md#performans-butcesi) karşılar; UI donmaz.
- [ ] Her seçilen İşin sonucu görünür; sessiz başarısızlık yoktur. Bir kaydın çatışması diğerinin görünür başarısını gizlemez.
- [ ] Her İş komutu taban revizyonu ve idempotency anahtarı taşır; güncel olmayan taban o satırı reddeder.
- [ ] İptal yalnız commit bariyerinden önce; sonrasında `Finalizing`.
- [ ] Güvenli undo ilgisiz sonraki değişikliği silmez.
- [ ] Aktör `User`'dır. Çok kayıtlı birleşik eylem düğmesi ve 21 kataloğu yoktur.
- [ ] Kabul kanıtı Bulk Editing seam'inde: progress, per-record results, stale row, cancel-before-barrier. Kanıt [Mutasyon sözleşmesi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) / günlük planlama dilimidir.
