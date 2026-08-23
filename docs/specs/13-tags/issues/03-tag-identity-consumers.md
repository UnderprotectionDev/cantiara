# 03 — Etiket kimliğini süzme ve tüketici sözleşmesi

**What to build:** Filtre, arama ve Akıllı Koleksiyon koşulları etiket kimliğini tüketir; donmuş görünen ada kilitlenmez. Yeniden adlandırılmış etiket kayıtlı koşulu bölmez. Import önizlemesi tanınan inline etiketleri mevcut kimliğe eşler veya yeni düz aday gösterir; sessiz kopya kimlik üretmez. Bu ticket Arama, Akıllı Koleksiyon veya içe aktarma yüzeyini inşa etmez.

**Blocked by:** 01 — Çalışma Alanı etiket ad alanı, uygulama ve kaldırma; 02 — Atomik etiket yeniden adlandırma

**Status:** ready-for-agent

- [ ] Tags seam'i kimliği filtre/arama/Akıllı Koleksiyon koşulunun tüketeceği biçimde sunar; koşul görünen ada kilitlenmez.
- [ ] Rename sonrası aynı kimliği kullanan kayıtlı koşul üyeliği bölünmez (tüketici yüzeyleri yoksa contract double yeter).
- [ ] Import eşleme sözleşmesi tanınan inline etiketleri mevcut kimliğe veya yeni düz adaya açık önizlemede bağlar; sessiz kopya kimlik yoktur. Import UI'si 80'dedir.
- [ ] Belge etiket filtresinin satır bağlamı 31'dedir; bu ticket yalnız kimliğin yeterli bağ olduğunu kanıtlar.
- [ ] Kabul kanıtı Tags seam'inde: kimlikle eşleme, rename sonrası koşul bütünlüğü, import sessiz kopya karşıtı. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paketinin etiket kimliği dilimidir.
