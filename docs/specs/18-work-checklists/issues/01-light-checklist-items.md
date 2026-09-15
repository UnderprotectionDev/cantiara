# 01 — Hafif kontrol listesi maddeleri

**What to build:** İş, yalnız metin ve tamamlanma işareti taşıyan hafif kontrol listesi bulundurabilir. Maddeler ana kayıt, durum, kapanış, tarih, öncelik, ilişki veya planlama üyeliği kazanmaz. Bütün maddelerin tamamlanması ana İşi kapatmaz. Madde arama/Backlog/Kanban'da İş olarak görünmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] İş üzerinde madde ekleme, düzenleme, sıralama ve tamamlanma işareti çalışır.
- [ ] Madde bağımsız İş yaşamı taşımaz; arama ve planlama yüzeylerinde ana kayıt değildir.
- [ ] Tüm maddeleri tamamlamak ana İşi otomatik kapatmaz ve durum yazmaz.
- [ ] Feature kapsanan İş bu liste modeli değildir.
- [ ] Liste Test Senaryosu veya Handoff paketi değildir.
- [ ] Kabul kanıtı Work Checklists seam'inde: CRUD, otomatik kapanış karşıtı, ana kayıt yokluğu. Kanıt [İş yaşam döngüsü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) dilimidir.
