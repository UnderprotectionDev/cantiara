# 03 — Elektronik tablo güvenli CSV

**What to build:** CSV güncel görünümün düz ve kayıplı kolaylık çıktısıdır. Kolonlar, kapsam, filtre, sıralama ve kaybolacak ilişki/tür/kimlik/yapı önceden raporlanır. `=`, `+`, `-`, `@`, tab veya satır başı ile başlayan hücreler güvenli veri olarak kaçışlanır ve dönüşüm raporlanır. JSON ham değeri 02'de kayıpsız kalır. XLS, Atom ve Word yoktur. Yeniden içe aktarmada yalnız ürün export kökeniyle kanıtlanmış kaçışın kaldırılması 80'e aittir; bu ticket kaçışlı CSV üretir.

**Blocked by:** 01 — Kapalı dünya önizlemesi, limit ve kaynak manifesti; 02 — Kayıpsız JSON seçili kayıt dışa aktarma

**Status:** ready-for-agent

- [ ] CSV önizlemesi kayıplı alanları (ilişki, tür, kimlik, yapı) raporlar; sessiz kayıpsız iddiası yoktur.
- [ ] Desteklenen İş listesi, Akıllı Koleksiyon ve çapraz proje listesi kesin görünümü CSV veya okunabilir PDF snapshot olarak çıkarır; adlandırılmış görünüm, rapor kaydı veya canlı abonelik oluşmaz. PDF etiketli-PDF/WCAG vaadi taşımaz; önizleme Markdown alternatifini açıklar.
- [ ] Formül gibi görünen hücreler veri olarak kaçışlanır ve dönüşüm rapora girer; aynı değer JSON'da ham kalır.
- [ ] XLS, Atom ve Word yolları yoktur.
- [ ] Secret/token/parola CSV'de yoktur; kapalı dünya 01'i bozulmaz.
- [ ] Kabul kanıtı Selected Export seam'inde kaçış golden'ları, kayıp raporu, JSON farkı, yasak biçim karşıtı. Papa Parse adaptördür, ürün kuralı test beklenenidir.
