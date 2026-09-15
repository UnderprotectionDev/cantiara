# 02 — Erişim ve sonuç gözlemleri ayrı tarihli turlar

**What to build:** Yayımdan sonra atlanabilir `Reassess impact` bağlı Proje Hedefini, Sürüm hipotezini, kapsamdaki Özellik/İş `Beklenen sonuç` ile `Gözlenen sonuç/öğrenim` içeriğini ve önceki tarihli gözlemleri kaynaklarına açarak yan yana gösterir. Erişim gözlemi ile Sonuç gözlemini aynı hükme indirmeden tarihli turda korur. Her tur sıfır veya bir erişim ve sıfır veya bir sonuç gözlemi taşır; alanlar farklı zamanlarda doldurulabilir. Yeni tur eskisini silmez. Kanıt yalnız o gözleme aittir. `Could not learn` tamamlanmış sayılır. Tur açıkken bir alan eksikse Action-needed doğar; ikisi de değerlendirilince veya `Close assessment` ile kapanır. Skor, sağlık, sabit kadans veya otomatik takip İşi yoktur. `Look again` yalnız hatırlatmadır.

**Blocked by:** 01 — Kapsama bağlı sürüm notu ve changelog

**Status:** ready-for-agent

- [ ] `Reassess impact` Hedef, hipotez, Özellik/İş beklenen–gözlenen ve önceki tarihli gözlemleri yan yana açar; gözlem alanlarının yerine geçmez.
- [ ] Erişim ve sonuç ayrı sahipli bileşenlerdir; birleşik başarı hükmü yoktur.
- [ ] En az iki tarihli tur (çelişen ve çelişmeyen) eski turu güncel göstermez.
- [ ] Tek alanlı ara durum ve `Could not learn` E2E'si vardır.
- [ ] Gözlem 66 Üretim Olayı veya 69 Proje Güncellemesi değildir.
- [ ] Yeniden değerlendirme atlanabilir; Özellik veya Proje Sürümü kapanışını engellemez. Atlanmış tur E2E'si vardır.
- [ ] `Look again` yalnız hatırlatmadır; yeni tur veya eksik-gözlem sinyali başlatmaz.
- [ ] Kabul kanıtı aynı seam'de: iki tur, sinyal kapanış matrisi, atlanmış değerlendirme. [Sürüm erişimi ve sonucu](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
