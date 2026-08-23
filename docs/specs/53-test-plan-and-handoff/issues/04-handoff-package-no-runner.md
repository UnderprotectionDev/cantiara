# 04 — Markdown/JSON paket sözleşmesi, ürün testi koşturmaz

**What to build:** Handoff'tan üretilen Markdown ve JSON aynı kayıttan aynı paket sürümüyle kapalı sözleşmeyi taşır: `handoff_id`, artan `handoff_package_version`, proje, başlık/amaç, `created_at`, doldurulmuş `product_build_context`, id+sürümle `scenarios[]`, yazılmış `ad_hoc_scope[]`, seçilmiş iş/belge/tasarım kesin referansları, ortam önkoşulu metni, `return_instructions` (`test-report/1`). Paket snapshot'tır, kendini yenilemez. Secret, token, erişilemeyen veya seçilmeyen kayıt girmez. Paket üretmek aracı başlatmaz ve yazma yetkisi vermez. Ürün testi başlatmaz, izlemez veya uzaktan koşturmaz.

**Blocked by:** 03 — Test Handoff yaşam döngüsü

**Status:** ready-for-agent

- [ ] Markdown ve JSON aynı kapsamı taşır; birinde fazla senaryo yoktur.
- [ ] `en güncel sürüm` işareti yoktur; secret pakete girmez.
- [ ] Üretim veya dışarı verme runner/polling/yazma yetkisi açmaz.
- [ ] Ürün içi test başlatma API'si yoktur.
- [ ] Kabul kanıtı aynı seam'de: kapalı tablo golden'ı, secret yokluğu, runner yokluğu. [Test kabulü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paket sözleşmesidir; dönüş kabulü 54'tedir.
