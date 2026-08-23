# 01 — Dört otorite kipi ve değişmez kimlik

**What to build:** Her Teknik Diyagram tam olarak bir `Diagram Authority Mode` taşır ve kip kayıt kimliği boyunca değişmez. İlk üründe oluşturulabilir kipler `Product-authored Model`, `Imported Independent Copy` ve `External Source Link`'tir; `Repository-derived View` mint edilmez. Aynı satırı başka köken gibi yeniden sınıflandırmak yoktur; açık dönüşüm yeni kimlik, iki yönlü köken, kayıp ve tarihçe önizlemesi ister. Snapshot, export ve Diyagram Sürümü yeni kip üretmez. Dış bağlantı kesin HTTPS URL, bilinen revision, araç ve son kontrol zamanı taşır; iframe/edit/cache yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dört kip kapalı katalogdur; kimlik boyunca tek kip; in-place reclassify reddedilir.
- [ ] `Repository-derived View` ilk üründe oluşturulamaz; diğer üç kip yaratılabilir (import kopyası 05 dönüşümünden de gelir).
- [ ] Otorite dönüşümü yeni Teknik Diyagram + `Originates from` üretir; önizlemesiz yazılmaz.
- [ ] `External Source Link` ADR-0008 yalıtımını izler; ürün içeriği dışarıdan çekip kanonik yapmaz.
- [ ] Kabul kanıtı Technical Diagrams seam'inde: kip matrisi, geçersiz mint, yeni kimlikli dönüşüm. [Teknik Diyagram ve şema](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) otorite paketidir.
