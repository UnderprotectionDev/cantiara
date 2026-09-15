# 03 — Proje ile Wiki arasında taşıma ve kopya

**What to build:** Proje bağlamından kalıcı bilgi `Move` ile Wiki’ye alınabilir; kimlik ve 31’in taşıma önizlemesi geçerlidir. İki bağımsız yaşam gerekiyorsa `Copy` yeni kimlik üretir. Wiki içeriği kendiliğinden yapılandırılmış kayda dönüşmez. Yayın, ekip izni ve ikinci editör yoktur.

**Blocked by:** 01 — Wiki sahiplik sınırı ve kabuk

**Status:** ready-for-agent

- [ ] `Move` hedefi Wiki olduğunda kimlik korunur; seçilmeyen grafik sürüklenmez.
- [ ] `Copy` yeni kimlik ve köken üretir; iki gövde eşzamanlanmaz.
- [ ] Dönüşüm İş/şablon otomatik tetiklenmez.
- [ ] Kabul kanıtı seam’de taşıma/kopya. Bu [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) wiki paketidir.
