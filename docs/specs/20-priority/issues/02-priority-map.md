# 02 — Öncelik Haritası

**What to build:** Kurucu aynı Projede iki sıralı ölçütü eksen seçip İşleri Öncelik Haritasında karşılaştırır. Eksen değeri olmayanlar `Unevaluated` bölümündedir. Harita skor, otomatik sıra, çeyrek etiketi veya Backlog/durum yazmaz. Haritadaki değer düzenlemesi açık kullanıcı eylemidir ve aynı ölçüt alanını günceller. Haritayı kaydetmek ikinci sıra gerçeği doğurmaz.

**Blocked by:** 01 — Proje öncelik ölçütleri

**Status:** ready-for-agent

- [ ] İki ölçüt yatay/dikey eksendir; eksik değer `Unevaluated` içinde kalır.
- [ ] İsteğe bağlı kanıt sinyali Geri Bildirim ve benzersiz Contact/Company sayılarını yalnız bağlam olarak gösterir.
- [ ] Konum Backlog sırası, Kanban durumu veya yayın skoru yazmaz; çeyrek karar etiketi dayatılmaz.
- [ ] Eksen değeri değişimi açık alandır; sürükleme gizlice sıra gerçeği üretmez.
- [ ] Harita analitik dashboard değildir.
- [ ] Harita görünümünü kaydetmek ikinci bir sıralama gerçeği doğurmaz.
- [ ] Kabul kanıtı Prioritization seam'inde: yerleşme, Unevaluated, yazmama karşıtları. Kanıt [günlük planlama](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun görünüm-durum ayrımıdır (Kanban hariç görünüm değişikliği durum yazmaz; harita da yazmaz ve Backlog sırası üretmez).
