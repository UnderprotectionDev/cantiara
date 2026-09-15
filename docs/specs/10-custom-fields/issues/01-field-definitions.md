# 01 — Proje-yerel alan tanımları

**What to build:** Kurucu Yapılandırma modunda Metin, Sayı, Boolean, Tarih, tek seçim ve çoklu seçim tanımlar ve bunları desteklenen kayıt türlerine bağlar. Lookup/Formula reddedilir. Tanım yalnız kendi Projesinde yaşar; aynı ad başka Projede bağımsızdır. Oturum Testi ve Test değerlendirmesi tanım kabul etmez. Markdown gövdesi forma dönüşmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Altı tür oluşur; Lookup/Formula komutu yoktur.
- [ ] Bağlı tür listesi kapalıdır: `Work`, `Feedback`, `User Research Session`, `Risk`, `Assumption`, `Decision`, `Test Handoff`, `Test Session`, `Planned Test Scenario`, `Test Gap`, `Production Incident`, `Milestone`, `Project Release`. `Session Test` ve `Test assessment` tanım kabul etmez.
- [ ] Kabuk (07) editor’ü açar ama şema bu seam’dedir.
- [ ] Etiket hiyerarşisi, atomik etiket yeniden adlandırma ve iki-etiket birleştirme bu seam’de yoktur; Etiketler workflow 13’tedir (ilk üründe rename, birleştirme değil).
- [ ] İngilizce `Custom field` ve tür adları terim tablosuna aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Project Custom Fields seam'inde tür matrisi ve yasak türler. [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
