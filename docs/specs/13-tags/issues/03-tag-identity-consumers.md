# 03 — Etiket kimliğiyle süzme (yeniden adlandırma sonrası)

**What to build:** Kurucu erişilebilir kayıt listesini etiket kimliğiyle süzer. Filtre, 01’deki uygula/kaldır ve 02’deki atomik rename ile aynı kimliği kullanır; donmuş görünen ada kilitlenmez. Bu ticket Evrensel Arama, Akıllı Koleksiyon veya import UI’si inşa etmez; o yüzeyler aynı kimlik sözleşmesini tüketir (karşıt double yeter).

**Blocked by:** 01 — Çalışma Alanı etiket ad alanı, uygulama ve kaldırma; 02 — Atomik etiket yeniden adlandırma

**Status:** ready-for-agent

- [ ] Kurucu süzülebilir bir kayıt listesinde etiket seçer; üyelik kimliğe göredir, görünen ada değil.
- [ ] 02 rename’inden sonra aynı filtre hâlâ doğru kümeyi döndürür; eski görünen ad ikinci kimlik gibi davranmaz.
- [ ] Arama / Akıllı Koleksiyon / import UI’si yoktur; kimliği tüketecek sözleşme (koşul görünen ada kilitlenmez, import sessiz kopya kimlik üretmez) Tags seam’inde karşıt olarak kanıtlanır.
- [ ] Belge satır bağlamı UI’si 31’dedir; bu ticket yalnız kimliğin yeterli bağ olduğunu kanıtlar.
- [ ] Kabul kanıtı Tags seam’inde uçtan uca: uygula → süz → rename → aynı süzme. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) paketinin etiket kimliği dilimidir.
