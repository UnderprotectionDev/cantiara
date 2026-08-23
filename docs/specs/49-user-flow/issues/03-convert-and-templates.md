# 03 — Kayda dönüştür, şablon canlı bağ kurmaz

**What to build:** `Convert and Bind` düğümden tam olarak bir İş, Karar, Risk veya Açık Soru taslağını Origin Location (Kullanıcı Akışı kimliği, düğüm kimliği, kesin akış sürümü) ile önizler; onaydan önce kayıt oluşmaz; düğüm yerinde kalır. `Convert and Bind` Ekran üretmez; düşük detaylı adımı Ekrana yükseltmek ayrı eylemdir ve canlı referanstır, kopya Ekran değildir. Yeni akış sürümü bağı sessizce taşımaz. Şablon yapı ve yer tutucu taşır; kaynak projenin İş/Karar/ilişki/yayın/geçmişini taşımaz; örneklem hedef projede yeni akış üretir ve kaynak projeye canlı bağ kurmaz.

**Blocked by:** 01 — Canlı Ekran referansları ve kırık hedefler; 02 — Kapalı semantik küme ve editör ortakları

**Status:** ready-for-agent

- [ ] Önizlemesiz dönüşüm kayıt üretmez; Origin Location değişmezdir.
- [ ] `Convert and Bind` Ekran üretmez; hedef küme yalnız İş, Karar, Risk veya Açık Soru'dur. Ekran yükseltmesi ayrı eylemdir ve kopya değil canlı referanstır.
- [ ] Yeni sürüm eski kökeni okunur bırakır; yeniden bağlama önizlemelidir.
- [ ] Adımı Ekrana yükseltmek kopya Ekran üretmez.
- [ ] Şablon kaynak projeye canlı bağlanmaz; üretilen akış bağımsız kimlik alır.
- [ ] Tuvaldeki canlı İş kartını taşımak kaynağı yazmaz.
- [ ] Kabul kanıtı aynı seam'de: dönüşüm E2E, Convert Ekran üretmez, şablon canlı bağ karşıtı, Ekran kopyası karşıtı. [Kullanıcı Akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kayda dönüştürme paketidir.
