# 03 — Proje ve türe göre düzen yapılandırması

**What to build:** Kurucu Yapılandırma modunda Proje ve İş türü başına bölümleri gösterir, gizler ve sıralar. Desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolü ile adlandırılmış özel bölüm kurulabilir; serbest sorgu çalışmaz. Uygulamadan önce türler ve bölüm farkı görünür. Onay sürümlü yapılandırma geçmişine yazılır; geri alma yalnız düzeni döndürür. İş alanları değişmez.

**Blocked by:** 01 — Beş türün hazır düzeni; 02 — Canlı bağlam ve neden zinciri

**Status:** ready-for-agent

- [ ] Yapılandırma modu Proje + İş türü kapsamındadır; günlük içerik düzenlemesinden ayrı görünür sunumdur.
- [ ] Özel bölüm yalnız desteklenen kayıt türü, doğrudan ilişki veya Kanıt Rolü ve durum koşullarıyla kurulur; Proje/Çalışma Alanı serbest sorgusu, formül, grafik veya keyfî kaynak yoktur.
- [ ] Bölüm yalnız açık İşten bu ilişkilerle erişilen kayıtları getirir.
- [ ] Onay öncesi etki önizlemesi vardır; onaylanan değişiklik sürümlü geçmiştedir; geri alma İş verisini değiştirmez.
- [ ] Eşleşen mevcut ve yeni İşler aynı canlı sunumu kullanır; kayıt başına şema veya eski düzen kopyası yoktur.
- [ ] Proje yapısı kopyalamada düzen hedefte bağımsız sürümlü yapılandırma olur; kaynak İş/kart sonucu taşınmaz. Kopyalama UI'si bu ticket'ın tüketici sözleşmesidir, tam kopyalama feature'ı değildir.
- [ ] Kart görünürlüğü paylaşım/Build in Public kapsamı açmaz.
- [ ] Klavye ve ekran okuyucu ile bölüm ekleme/gizleme/sıralama [erişilebilirlik](../../../prd/15-product-quality.md#erisilebilirlik) kuralını karşılar.
- [ ] Kabul kanıtı Work Context Card seam'inde: önizleme, uygula, geri al, serbest sorgu karşıtı, paylaşım kapsamı karşıtı.
