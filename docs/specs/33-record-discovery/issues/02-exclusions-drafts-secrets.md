# 02 — Taslak, yakalama, dış yüzey ve secret dizinlenmez

**What to build:** Yakalama Gelen Kutusu öğesi, Taslak, Dış yüzey ve GitHub dış kaydı arama sonucu olmaz. Secret, paylaşım token’ı, bağlantı parolası ve üretilmiş SQL gövdesi dizinlenmez. Çöp ve erişilemeyen kayıt hiçbir sıralamada görünmez. Arşiv yalnız açık arşiv filtresiyle katılır.

**Blocked by:** 01 — Deterministik evrensel arama

**Status:** ready-for-agent

- [ ] Yasak türler sorguya girmez; kendi yüzeylerinde kalır.
- [ ] Secret ve token snippet veya sırada belirmez.
- [ ] Üretilmiş SQL gövdesi varsayılan genel metin indeksine girmez; Migration Artefaktı kullanıcıya dönük adları sahibinin Teknik Diyagramı üzerinden bulunur.
- [ ] Arşiv varsayılan sonuçta yoktur, filtreyle bulunur; silinmiş sayılmaz.
- [ ] Kabul kanıtı seam’de dışlama matrisi. Bu [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) negatif paketidir.
