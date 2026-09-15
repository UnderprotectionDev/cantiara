# 01 — Kapsama bağlı sürüm notu ve changelog

**What to build:** Kurucu Proje Sürümü kapsamındaki İşlerden sürüm notu ve changelog girdisi hazırlar. Anlatı kaynak kapsam ve gerekçeye bağlanır; not 64 paketinin yerine geçmez. İsteğe bağlı `Why was this done?` yalnız tek tek seçilen kayıt ve ayrıca onaylanan alan snapshot'larını taşır. Taslak yayına kadar özeldir. Yayın kapanış önizlemesi 14 sözleşmesini kullanır; onaylanmayan öneriler değişmez; yayın iç durumları ve 63 terminal sonucu kendiliğinden yazmaz. GitHub Release metni ikinci doğruluk kaynağı değildir.

**Blocked by:** None — can start immediately. 63 Proje Sürümü fixture'si gerekir.

**Status:** ready-for-agent

- [ ] Not kapsamsız pazarlama paragrafı olarak yayınlanamaz; kapsam bağları görünür.
- [ ] Changelog ikinci etiket sistemi açmaz; mevcut etiketleri kullanır. `Why was this done?` izi olmadan yalnız metin yayımlanabilir; kayıt seçmek ilişkili özel alanı yayımlamaz.
- [ ] Yayın eylemi İş tamamlamaz ve Proje Sürümü `Published` yazmaz (63 açık eylemi ayrıdır; buradan çağrılmaz).
- [ ] Bu anlatı Build in Public akışı veya Wiki yayını değildir (75/74).
- [ ] GitHub Release body senkronu yoktur; Release metni ikinci doğruluk kaynağı değildir.
- [ ] Kabul kanıtı Release Communication seam'inde: bağ, önizleme, durum yazmama. Erişilebilirlik **yayın önizleme ve iptal**.
