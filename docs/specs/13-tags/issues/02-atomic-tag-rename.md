# 02 — Atomik etiket yeniden adlandırma

**What to build:** Kurucu bir etiketi yeniden adlandırınca bütün yapılandırılmış alan kullanımları ve aynı kimliğe bağlı inline kullanımlar tek atomik işlemde güncellenir. Etkilenen Belgelerde sürümlü değişiklik ve güvenli geri alma vardır. Başarısızlık eski/yeni adı karışık bırakmaz. Kimlik korunur; bu ticket iki etiket kimliğini birleştirmez.

**Blocked by:** 01 — Çalışma Alanı etiket ad alanı, uygulama ve kaldırma

**Status:** ready-for-agent

- [ ] `Rename Tag` bütün yapılandırılmış kullanımları tek commit'te yeni görünen ada çeker; kimlik değişmez.
- [ ] Aynı kimliğe çözülmüş inline kullanımlar aynı atomik sınırda güncellenir; etkilenen Belgeler sürümlenir ve güvenli geri alma düzeni döndürür.
- [ ] İşlem başarısızsa hiçbir kayıt veya Belge gövdesi kısmen güncellenmez.
- [ ] Markdown export sözleşmesi inline `#etiket` metnini korur ve manifest kimlik eşlemesini taşır; export UI'si bu ticket'ta yoktur.
- [ ] İki etiket kimliğini birleştirme, arşivleme ve kullanım önerisi yoktur ([gelişmiş etiket bakımı](../../../prd/18-future-directions.md#gelismis-etiket-bakimi)).
- [ ] Belge editörü `#etiket` ayrıştırması, kod çiti istisnası ve satır bağlamı UI'si 31'dedir; bu ticket ikinci sözlük açmaz.
- [ ] Kabul kanıtı aynı Tags seam'inde: çok kayıtlı rename, Belge gövdesi ile alanın birlikte ilerlemesi, hata enjeksiyonunda karışık ad yokluğu, birleştirme UI'sinin yokluğu.
