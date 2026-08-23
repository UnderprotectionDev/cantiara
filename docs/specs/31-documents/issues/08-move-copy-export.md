# 08 — Kapsam taşıma, kopya ve tek Belge export

**What to build:** `Move` etkin Projede kök Belgeyi, açıkça seçilen çocukları ve bu kaynakların sahip olduğu Dosya Eklerini kimlik koruyarak hedef kapsama alır; seçilmeyen grafik sürüklenmez. Etkin Dış yüzey önce iptal edilir. `Copy` yeni kimlik üretir, köken tutar, geçmiş/ilişki/yayın kopyalamaz. Tek Belge Markdown veya PDF dışa aktarımı canlı blokları tarihli etiketli snapshota çevirir; dış dosya canlı eşitlenen kopya olmaz. Dosya Ekleri belgeden bağımsız global havuz olmaz. Çalışma Alanı çıkış paketi ve Wiki yayını yoktur.

**Blocked by:** 01 — Veritabanında Markdown yazarlığı; 07 — Belge içi etiket, hiyerarşi, arşiv

**Status:** ready-for-agent

- [ ] Taşıma önizlemesi hedef, seçim, kırılacak referans ve yayın etkisini gösterir; kimlik korunur.
- [ ] Etkin Dış yüzeyi olan Belge taşınmadan önce yüzey iptal edilir; eski yüzey kaynak kapsamda tarihsel kalır.
- [ ] Taşınan Dosya Ekleri yalnız seçilen kaynakların sahip olduklarıdır; belgeden bağımsız global havuz oluşmaz.
- [ ] Kopya yeni kimliktir; sonraki düzenleme kaynağı güncellemez.
- [ ] Markdown/PDF canlı bloğu dondurur; Word yoktur.
- [ ] İş kapsamı bu işlemle değişmez.
- [ ] Kabul kanıtı seam’de taşıma kimliği, kopya ayrımı ve export snapshot. Bu [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) taşıma paketidir; taşınabilirlik yolculuğundaki tek-Belge export satırıyla uyumludur.
