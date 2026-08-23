# 01 — Seçili başlık ve bağlantılardan geçici taslak

**What to build:** Kurucu tamamlanan veya vazgeçilen Projede Karar, Risk, Proje Sürümü, Belge, Üretim Olayı ve tamamlanmış İş kayıtlarını seçer. Ürün yalnız bölüm başlıkları ve okunabilir kaynak bağlantıları içeren düzenlenebilir `Closure Summary Draft` üretir. Önizleme hangi kaynağın hangi başlığa gireceğini gösterir. Sistem yorum, sonuç, başarı hükmü, gerekçe veya özet metni yazmaz. Taslak kaydedilmeden kalıcı Belge, arama sonucu veya export öğesi değildir. Başlangıç iskeleti değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Kaynak seçimi ve başlık/bağlantı önizlemesi çalışır; üretilen gövde yalnız başlık ve okunabilir kaynak bağlantısı taşır.
- [ ] Üretilen metinde yorum, sonuç, başarı hükmü, gerekçe veya özet cümlesi yoktur.
- [ ] Editör kaydedilmeden kapanınca ana kayıt oluşmaz; taslak arama, paylaşım ve export dışında kalır.
- [ ] Taslak `Persona` / `Retrospective` / `Launch Plan` Başlangıç iskeleti değildir ve Proje oluşturmada doğmaz.
- [ ] İngilizce UI `Closure Summary Draft` kullanır; eksik etiket terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Project Closure Summary seam'inde: seçim, önizleme, boş-anlatı, persist-yokluğu. Kanıt [Dogfooding](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuklarına bağlanır.
