# 07 — Belge içi etiket, hiyerarşi, arşiv

**What to build:** Gövdedeki desteklenen `#tag` aynı Çalışma Alanı etiket kimliğini hedefler; kod, URL ve kaçışlı metin token değildir; geçersiz token sessiz yeni etiket uydurmaz. Sözlük yeniden adlandırma etiket feature’ındadır. Belgeler klasör ve en fazla bir üst belge ile aynı sahiplik kapsamında, en fazla üç seviyede düzenlenir; daha derin taşıma düzleştirilmez. Hiyerarşi taşıması kapsamı, kimliği veya yaşam döngüsünü değiştirmez; çapraz kapsam ebeveyn yoktur. Arşiv kimlik, sürüm, ilişki ve çocuk bağlarını korur; silinmiş sayılmaz.

**Blocked by:** 01 — Veritabanında Markdown yazarlığı

**Status:** ready-for-agent

- [ ] `#tag` Workspace etiket kimliğine bağlanır; serbest metin hashtag veya ikinci sözlük yoktur.
- [ ] Üç seviye aşımı önizlemede engellenir; klasör Akıllı Koleksiyon veya sahiplik kapsamı değildir.
- [ ] Hiyerarşi taşıması kapsamı, kimliği veya yaşam döngüsünü değiştirmez; çapraz kapsam ebeveyn yoktur.
- [ ] Arşiv varsayılan gezinmeden düşer, arşiv filtresiyle döner; Proje arşivi, Çöp Kutusu veya Wiki yayını durdurma değildir.
- [ ] Belge taraması ve `All Documents` bu feature’ın keşif yüzeyi değildir; Evrensel Arama ayrıdır.
- [ ] Kabul kanıtı seam’de token kimliği, derinlik karşıtı ve arşiv. Hiyerarşi [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) taşıma/silme paketini tamamlar.
