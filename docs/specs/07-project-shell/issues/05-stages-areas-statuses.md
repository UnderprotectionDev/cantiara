# 05 — Aşamalar, alanlar ve durum semantiği

**What to build:** Kurucu aşamaları ekler, yeniden adlandırır, sıralar, kaldırır; her aşama `Not Planned` / `Ready` / `Active` / `Completed` / `Abandoned` taşır ve birden fazla aşama aynı anda `Active` olabilir. Kapalı Proje alanı kataloğu etkinleştirilir veya gizlenir; gizlemek içerik silmez. `Overview` ve `All Tools` alan değildir ve kapanmaz. `Pin to navigation` yalnız navigasyon üstverisidir. İş durumu görünen adı değişebilir; dört korunan semantik silinemez ve yeni durum değeri eklenmez. Yapı değişikliği geçmiş kayıtları sessizce yeniden yazmaz. Overview modülleri bu kabukta çizilmez.

**Blocked by:** 04 — Yapılandırma modu; 02 — Başlangıç yapılandırmaları

**Status:** ready-for-agent

- [ ] Aşamalar sıralı state machine değildir; her aşama `Not Planned` / `Ready` / `Active` / `Completed` / `Abandoned` taşır; birden fazla `Active` olabilir; kaldırma ana kayıt silmez ve İş durumu yazmaz.
- [ ] Alan gizleme/gösterme kayıt taşımaz, kopyalamaz, silmez; Overview ve All Tools kapanmaz; Overview modülleri bu kabukta çizilmez (08).
- [ ] `Pin to navigation` ve `Restore default navigation` yalnız pin/sıra üstverisini değiştirir.
- [ ] `Not Started` / `In Progress` / `Blocked` / `Closed` semantiği korunur; yeni durum değeri eklenmez.
- [ ] Yapı değişikliği geçmiş kayıt değerlerini sessizce yeniden yazmaz.
- [ ] `Tests` kapalı Proje alanı kataloğundadır; etkinleştirmek test ürünü veya Planlı Test Senaryosu üretmez.
- [ ] Lookup veya Formula alanı bu kabukta oluşmaz.
- [ ] Kabul kanıtı Project Shell seam'inde gizleme, pin, semantik karşıtları. İlk Proje gezinme paketi.
