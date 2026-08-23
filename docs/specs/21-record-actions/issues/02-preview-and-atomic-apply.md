# 02 — Önizleme ve tek atomik uygulama

**What to build:** Eylem yalnız açık başlatmada çalışır. Kurucu hedef kayıtta oluşacak kesin alan farkını görür; onay tek atomik sonuçtur. Kısmi başarı bırakılmaz. Aynı idempotency anahtarı ve payload önceki makbuzu döner; farklı payload çatışmadır. Geri alınabilir kombinasyon ortak undo sözleşmesini kullanır.

**Blocked by:** 01 — Kapalı katalog ve adlandırılmış eylem tanımı

**Status:** ready-for-agent

- [ ] Açık başlatma olmadan eylem çalışmaz.
- [ ] Önizlenen fark ile uygulanan sonuç aynıdır; commit bariyeri tam commit veya tam rollback'tir ([ADR-0004](../../../adr/0004-atomik-idempotent-kesinlestirme.md)).
- [ ] Taban revizyonu ve istemci idempotency anahtarı taşınır; tekrar aynı sonucu verir.
- [ ] Bariyerden sonra sahte iptal yerine `Finalizing` gösterilir.
- [ ] Güvenli geri alma bütün kombinasyonu tersine çevirir veya açıklayarak reddeder; kısmi rewind yoktur.
- [ ] Kabul kanıtı Record Actions seam'inde: önizleme=uygula, hata enjeksiyonunda kısmi yokluk, retry, undo. Kanıt [Mutasyon sözleşmesi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) insan komutu dilimidir.
