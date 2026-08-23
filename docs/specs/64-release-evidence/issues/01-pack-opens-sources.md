# 01 — Kaynaklarına açılan kanıt paketi (skor/kapı yok)

**What to build:** Proje Sürümü detayında Sürüm Kanıt Paketi kapsam, beklenen sonuç, Karar/Risk, gerekli ve bağlamsal PR, check, test kayıtları, açık Test Açığı, son Test değerlendirmesi ve yayın farkını kaynaklarından türetilmiş tek yüzeyde gösterir. Her satır gösterilme nedenini ve `Open source record` eylemini taşır. Eksik gerekli kaynak sessizce düşmez. Sistem readiness skoru, genel Hazır/Hazır değil veya zorunlu yayın kapısı üretmez; yayın komutu yoktur ve paket “yayınla” demez. Check Test Oturumu olmaz. Salt zaman testi eskitmez. Test özeti, PR kartı, sürüm planlama, sürüm notu ve kapanış özeti kendi kayıtlarını taşır.

**Blocked by:** None — can start immediately. 63 Proje Sürümü ve 61/57 kayıtları fixture olarak okunur.

**Status:** ready-for-agent

- [ ] Paket türetilmiş görünümüdür; İş/test/PR/Risk/Karar/Sürüm durumu yazmaz.
- [ ] Sayı ve eksik bağlam kayıtsız skor değildir; drill-down zorunludur.
- [ ] Gerekli kaynak (kapsam, PR/check, beklenen sonuç, test, açık Risk/Test Açığı, yayın farkı) yoksa satır görünür dikkat olarak durur; sessizce düşmez.
- [ ] ADR-0007: oturum `Passed` ürün kabul kanıtı ilan edilmez.
- [ ] 57 nötr özet, 61 PR Bağlam Kartı, 63 planlama, 65 not ve kapanış özeti bu paket değildir; paket “yayınla” demez.
- [ ] Kabul kanıtı Release Evidence Pack seam'inde: drill-down, kapı yokluğu. [Sürüm Kanıt Paketi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
