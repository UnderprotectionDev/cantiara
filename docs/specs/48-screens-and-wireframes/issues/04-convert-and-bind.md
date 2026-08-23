# 04 — Kayda dönüştür ve bağla, Origin Location

**What to build:** Kesin Wireframe sürümündeki block üzerinde `Convert and Bind` tam olarak bir İş, Karar, Risk veya Açık Soru taslağını; hedef tür/proje, başlık/gövde eşlemesi, `Kökeni` ve değişmez Origin Location (Ekran kimliği, block kimliği, kesin Wireframe sürümü) ile önizler. `Convert and Bind` Ekran üretmez; Ekran oluşturma başlıkla (01) veya Kullanıcı Akışı düğüm yükseltmesi (49) kalır. Onaydan önce ana kayıt oluşmaz; kaynak öğe yerinde kalır, ilişki ucu olmaz, görünümü değişmez — tuval boşalmaz. Öğeyi silmek oluşan kaydı silmez; Origin Location `Kaynak öğe artık yok` olur. Yeni sürüm bağı sessizce taşımaz. Salt okunur canlı İş/Karar/Risk kartı taşımak kaynak kaydı yazmaz. Şablon kaynak projenin İş/Karar geçmişini taşımaz ve üretilen Ekran kaynak projeye canlı bağlanmaz.

**Blocked by:** 02 — WireframeDocument motoru ve semantik düzenleme

**Status:** ready-for-agent

- [ ] Önizlemesiz dönüşüm ana kayıt üretmez; onay tam olarak bir İş, Karar, Risk veya Açık Soru açar.
- [ ] `Convert and Bind` Ekran üretmez; hedef kümede Ekran yoktur. Ekran oluşturma başlıkla veya Kullanıcı Akışı yükseltmesi (49) kalır.
- [ ] Onay tuvali boşaltmaz; kaynak öğe yerinde kalır, ilişki ucu olmaz, görünümü değişmez.
- [ ] Origin Location sahip Ekran, block ve kesin sürümü taşır; `Kökeni` + Origin Location'dır, yeni kullanım bağı türü değildir.
- [ ] Öğeyi silmek oluşan kaydı silmez; sahip Ekranla `Kökeni` yaşar; Origin Location `Kaynak öğe artık yok` olur ve başka maddeye kaymaz.
- [ ] Yeni Wireframe sürümü eski kökeni okunur bırakır; yeniden bağlama açık önizlemedir.
- [ ] Tuvaldeki canlı kartı taşımak kaynak alanları, durumu veya ilişkileri değiştirmez.
- [ ] Şablon yeni Ekran üretir; kaynak projeye canlı bağ yoktur.
- [ ] Kabul kanıtı aynı seam'de: önizleme, Ekran üretilmez, Origin Location, tuval boşalmama, öğe silince kayıt yaşar, sessiz taşıma karşıtı, kartın kaynağı yazmaması.
