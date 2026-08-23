# 04 — Not now karar izi

**What to build:** Açık İş veya Özellik için isteğe bağlı `Not now` kısa gerekçe, isteğe bağlı yeniden değerlendirme koşulu ve dayanak ilişkileri taşır. Ayrı durum, kapanış sonucu, Backlog, planlama üyeliği, öncelik değeri veya Karar kaydı oluşmaz. Uygulamadan önce gerekçe önizlenir; durum, sıra, ufuk ve tarihler kendiliğinden değişmez. `Reconsidering` izi kapatır; yeni `Not now` değiştirir; geçmiş korunur. `Review later` sessiz silinmez. İş kapanışı izi otomatik kapatmaz. Serbest metin koşul izlenmez.

**Blocked by:** 01 — Ufuk yerleşimi durum ve sıra yazmaz

**Status:** ready-for-agent

- [ ] `Not now` İşte sahipli izdir; Parked sütunu veya Karar ana kaydı oluşmaz.
- [ ] Uygulama durum, öncelik, Backlog sırası ve ufku yazmaz.
- [ ] `Reconsidering` veya yeni iz geçmişi korur; bağlı hatırlatmayı sessiz silmez.
- [ ] İş kapatma, arşiv veya durum değişimi `Not now` izini kendiliğinden kapatmaz.
- [ ] Koşul metni arka plan izleme veya otomatik yeniden etkinleştirme yapmaz.
- [ ] Kabul kanıtı seam’de iz yazmama, kapanışın izi bitirmemesi ve koşul karşıtı. Kanıt [Roadmap](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
