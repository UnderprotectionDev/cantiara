# 02 — Değerler, arama ve filtre

**What to build:** Alan yalnız seçilen türlerin oluşturma, düzenleme, arama ve filtreleme yüzeylerinde görünür. Değer yazımı Mutation Contract kullanır. Boş, Boolean false ve seçim değeri ayırt edilir. Yapı kopyalama bağımsız tanım kopyası üretir; çalışma alanı ortak kimliği yoktur.

**Blocked by:** 01 — Proje-yerel alan tanımları

**Status:** ready-for-agent

- [ ] Bağlı İş (ve ikinci bir desteklenen tür) oluşturma/düzenlemede alanı gösterir; bağlı olmayan tür göstermez.
- [ ] Arama/filtre API’si alanı sunar; tam Evrensel Arama sıralaması bu ticket’ta yoktur.
- [ ] İki Projedeki aynı ad birleşmez; kopyalanan tanım yeni kimliklidir.
- [ ] Markdown gövde ve ham ek form alanı olmaz.
- [ ] Boş/ayarlanmamış, Boolean false ve seçim değeri ayırt edilir; “değerlendirilmedi” görünür kalır.
- [ ] Kabul kanıtı aynı seam'de değer round-trip, bağ karşıtı, ortak-şema karşıtı. Arama ve ilişki alan paketi.
