# 01 — Test Açığı kaydı, otomatik üretim yok

**What to build:** Kurucu Test Açığını başlık, gerekçe ve Özellik/İş/spec bölümü/Risk/Proje Sürümü dayanaklarıyla Proje ana kaydı olarak tutar. Sistem eksik senaryo, başarısız test, yürütücü notu, spec değişikliği, GitHub check veya benzerlikten açık üretmez. Açık Risk, Bug, İş veya Ürün Boşluğu değildir; coverage yüzdesi değildir. Tests alanı bu kaydı gösterir, sahip faz veya test ürünü değildir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Açık elle oluşturulur; test edilmemiş veya yetersiz doğrulanmış alan başlık, gerekçe ve dayanak ilişkileriyle açıkça kaydedilir; başarısız Oturum Testi fixtur'ı otomatik açık açmaz.
- [ ] Bug/Risk/Ürün Boşluğu türü veya coverage alanı yoktur.
- [ ] Tests alanı bu kaydı listeler; kayıt sahibi, yaşam döngüsü, ana faz veya runner ürünü değildir.
- [ ] İngilizce UI `Test Gap` kullanır; eksik etiket PRD sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Test Gaps seam'inde: oluşturma, otomatik üretim karşıtı. Kanıt [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
