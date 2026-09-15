# 03 — Yüksek etkili kaçış kapanış kanıtı

**What to build:** Yüksek etkili Dış Araca Kaçış, PRD 01 tanımıyla (kanonik gerçeğin dışarı taşınması veya kalıcı paralel doğruluk kaynağı) kapanırken ürün akışı mevcut Ürün sürüm adayında tamamlanıp etkilenen güncel gerçek kullanılabilir ürün kayıtlarına (manuel yeniden oluşturma veya desteklenen import) dönmeden, dış kopya paralel doğruluk kaynağı olmaktan çıkmadan ve kanıt bu kesin kayıtlara bağlanmadan kapanmış sayılmaz. Kapanış kanıtı görünürdür. Sayısal eşik veya bekleme süresi otomatik kapatmaz. Yüksek etki ayrı şiddet bayrağı değildir; boşluk durumu `Conscious boundary` kapanış kanıtını düşürmez. Bu, hesap kapatma veya Dış yüzey iptali değildir.

**Blocked by:** 02 — Dış Araca Kaçış olayı

**Status:** ready-for-agent

- [ ] Yüksek etkili kapanış, PRD 01 tanımına (kanonik gerçeğin dışarı taşınması veya kalıcı paralel doğruluk kaynağı) uyan kaçışta dört koşulu birlikte ister: aday üzerinde başarılı aynı akış, gerçeğin ürün kayıtlarına dönüşü, paralel dış kaynağın kapanması, kanıtın o kayıtlara bağlanması.
- [ ] Koşullardan biri eksikse kapanış fail-closed reddedilir; "hata düzeldi" notu veya dış ekran görüntüsü yetmez.
- [ ] Eşik/süre otomatik kapatmaz; kapanış kanıtı okunur.
- [ ] Yüksek etki kurucunun koyduğu şiddet bayrağı veya boşluk durumu `Conscious boundary` kısayolu değildir; o durum dört koşulu yüksek etkili kaçışta düşürmez. Paralel doğruluk hiç taşımamış kaçış bu dört koşulu kullanmaz. Bu kapanış hesap kapatma veya Dış yüzey iptali değildir.
- [ ] Kabul kanıtı aynı seam'de: reddedilen eksik kapanış, kabul edilen bağlı kanıt. [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kapanmış kaçış paketidir.
