# 03 — Test Handoff yaşam döngüsü

**What to build:** Test Handoff'u dış test çalışmasının hazırlığı ve dönüşünü yöneten ayrı tarihsel kayıttır. Amaç, seçilmiş kesin senaryo sürümleri, isteğe bağlı hedef tarih ve yürütücü, teknik bağlam, paket sürümü ve bağlı Test Oturumlarını taşır. Durumlar `Draft`, `Ready to share`, `Shared`, `Result received`, `Closed`, `Canceled` süreçtir, test sonucu değildir. Bağlı rapor `Result received` önerebilir; Handoff otomatik kapanmaz. Handoff Test Oturumu, CI orkestratörü veya runner değildir. Aynı senaryolar farklı yürütücülere ayrı Handoff'lardır.

**Blocked by:** 01 — Planlı Test Senaryosu sürümleri

**Status:** ready-for-agent

- [ ] Handoff süreç durumlarını taşır; sonuç semantiği değildir.
- [ ] Otomatik kapanış yoktur; runner/polling/iptal yetkisi yoktur.
- [ ] Dış yürütme devri paketiyle karışmaz; Test Oturumu değildir.
- [ ] İngilizce UI `Test Handoff` ve durum etiketlerini kullanır.
- [ ] Kabul kanıtı aynı seam'de: durumlar, otomatik kapanış karşıtı, 24 paketi ayrımı.
