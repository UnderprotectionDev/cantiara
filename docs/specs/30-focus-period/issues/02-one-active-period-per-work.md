# 02 — Aynı anda tek etkin dönem

**What to build:** Bir İş aynı anda en fazla bir etkin Odak Döneminde bulunur. Başka etkin döneme alma açık bir taşıma eylemidir; geçmiş dönem üyelikleri ve snapshot’lar korunur. Sessiz ikinci üyelik reddedilir.

**Blocked by:** 01 — 1–8 haftalık pencere, üyelik durum yazmaz

**Status:** ready-for-agent

- [ ] İkinci etkin döneme örtük ekleme uygulanmaz.
- [ ] Açık taşıma geçmiş üyeliği ve snapshot’ı silmez.
- [ ] Kapalı dönem üyeliği yeni etkin üyeliği engellemez.
- [ ] Kabul kanıtı seam’de bir-aktif kuralı ve taşıma geçmişi. Bu [Odak Dönemi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun taşıma paketidir.
