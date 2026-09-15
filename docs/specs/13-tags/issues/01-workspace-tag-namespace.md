# 01 — Çalışma Alanı etiket ad alanı, uygulama ve kaldırma

**What to build:** Kurucu tek Çalışma Alanı etiket ad alanında düz etiket oluşturur, erişilebilir kayıtlara uygular ve kayıttan kaldırır. Aynı görünen ad ikinci Çalışma Alanı kimliği veya Proje-yerel sözlük üretmez. Proje seçicisi o projede sık kullanılanları önce önerebilir; öneri kapsamı değiştirmez. `/` hiyerarşi, kalıtım veya iç içe sözlük açmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Tek Çalışma Alanı ad alanı vardır; aynı görünen ad ikinci kimlik veya Proje-yerel etiket üretmez.
- [ ] Oluşturma, kayda uygulama ve kayıttan kaldırma çalışır; kaldırma kimliği silmez.
- [ ] Kurucu erişilebilir bir kayıt listesini etiket kimliğiyle süzer; uygula/kaldır üyelik sonucunu aynı listede günceller (schema + API + liste UI). Arama, Akıllı Koleksiyon ve import yüzeyleri burada inşa edilmez.
- [ ] Proje seçicisi sık kullanılanları önce önerebilir; bu sıralama kapsamı değiştirmez.
- [ ] `/` düz metindir; parent/child, kapsam veya kalıtım oluşmaz.
- [ ] Etiket uygulamak ilişki türü, klasör, Akıllı Koleksiyon üyeliği, Favori veya Kanıt bağı üretmez.
- [ ] İngilizce UI `Tags` kullanır; eksik etiket PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Tags seam'inde: oluşturma, uygulama, kaldırma, ad çakışması, öneri sıralaması, `/` karşıtı. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
