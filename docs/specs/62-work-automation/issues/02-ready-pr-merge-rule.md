# 02 — Hazır PR-merge kuralı (bağlantı tek başına kapatmaz)

**What to build:** Kurucu `When required PRs merge, mark Work Completed` kuralını açıkça etkinleştirir. İşte en az bir `Required for completion` PR varken ve bu roldeki bütün PR'lar merge iken kapanış `Completed` olur. Hiç gerekli PR'ı olmayan İş, kısmi gerekli merge veya yalnız `Contextual` merge kurala uymaz. Kural kapalıysa aynı koşul yalnız `Mark as Completed` önerisidir. Check başarısızlığı kapatmayı geciktirmez ve tamamlanan İşi yeniden açmaz. Bu kural PR açma/review/check olaylarını genel otomasyona açmaz. Otomasyon kapanışı Bitiriş efekti çağırmaz (23).

**Blocked by:** 01 — Kapalı kural kataloğu, çatışma ve tek mutasyon

**Status:** ready-for-agent

- [ ] 61'in gerekli/bağlamsal rolleri gerçektir; bu ticket rolü yeniden tanımlamaz, yalnız tüketir (GitHub double yeterli).
- [ ] Etkin kural matrisi: sıfır gerekli / kısmi / hepsi merge / yalnız bağlamsal / kural off.
- [ ] GitHub bağlantısı sessiz kapanış değildir; 61 seam'i kapanış yazmaz.
- [ ] Check fail reopen/delay yok; dikkat 61/64'te kalır.
- [ ] Completed yazımı Bitiriş efekti tetiklemez; kullanıcı başlatmalı başarı 23'te kalır.
- [ ] Otomasyon yayın kapısı veya test koşturucu değildir; GitHub yazma API'si çağrılmaz.
- [ ] Kabul kanıtı aynı seam'de: kural matrisi, efekt yokluğu. [Otomasyon](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) PR kuralı paketidir.
