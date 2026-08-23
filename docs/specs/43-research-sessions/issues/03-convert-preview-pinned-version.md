# 03 — Önizlemeli dönüşüm ve sürüme sabit kanıt

**What to build:** Seçilen not veya ifade mevcut sürüme sabit kanıt mekanizmasıyla Geri Bildirim, Varsayım, Açık Soru, İş/Özellik veya Karara bağlanır; pin kesin oturum sürümü ve aralıktadır. `Convert to new record and bind` hedef tür/proje, alan eşlemesi ve kökeni onaydan önce gösterir. Dönüşüm notu silmez, türü otomatik seçmez, eski pin’i yeni nota sessiz taşımaz.

**Blocked by:** 02 — Türlenmiş araştırma notları

**Status:** ready-for-agent

- [ ] Kanıt bağı oturum sürümü + metin aralığını sabitler; sonraki not düzenlemesi eski bağı kaydırmaz.
- [ ] Dönüşüm önizlemesi onay olmadan kayıt üretmez. Tek eylemde birden fazla kayıt ve AI yoktur.
- [ ] Köken `Kökeni` ile oturuma bağlanır; Evidence seam pin’i sağlar. İzin kapısı 01 bozulmaz.
- [ ] Ses kaydı, davet, transkript yoktur. Dış dosya yalnız normal Dosya Eki olur; varlık transkript/kanıt değildir.
- [ ] Kabul kanıtı aynı seam’de: önizleme, pin sürümü, sessiz rebind yokluğu, notun kalması. Pin/dönüşüm [Kanıt akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna karşıt kanıttır; oturum yazarlığı [tasarım bağlamı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) değildir.
