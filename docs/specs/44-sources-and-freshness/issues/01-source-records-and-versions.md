# 01 — Kaynak kaydı ve tarihli sürümler

**What to build:** Dış bilginin kimliği, kökeni ve tarihli sürümleri Kaynak ana kaydında durur. Yeni fetch eski sürümü silmez. Kayıt Dosya Eki, Belge, canlı web aynası veya bookmark değildir. Kaynağın varlığı otomatik Kanıt bağı değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Kaynak Proje kapsamındadır; URL/başlık, erişim zamanı, yakalanan içerik ve sürümler tarihsel kalır. İngilizce `Source`.
- [ ] İsteğe bağlı sağlayıcı/dış tür/dış id yalnız deterministik URL veya açık girişle yazılır; credential, senkron veya İşe dönüş yoktur.
- [ ] Yeni yakalama eski sürümü silmez. Varlık `Kanıtı` ilişkisi üretmez.
- [ ] Uzun gövde Feed UI’si 47’dedir; bu ticket feed açmaz.
- [ ] Kabul kanıtı Sources and Freshness seam’inde: sürüm korunumu, otomatik kanıt yokluğu. [Kanıt tazeliği](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) hazırlığı.
