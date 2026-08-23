# 02 — Düzeltme yalnız kaynak kayıtta

**What to build:** Kurucu pakette bir alanı, ilişkiyi, test incelemesini, Risk yanıtını, kontrol listesi maddesini veya yayın metnini düzeltmek istediğinde özgün kayıt yüzeyine gider. Paket karma form, düzeltme kopyası, kabul istisnası veya ikinci yayın checklist'i değildir. İsteğe bağlı Sürüm kontrol listesi pakette yönetilir ama yine kapı değildir. Yayımlanmış Sürümde açık İş kaldıysa tekilleştirilmiş kapatılabilir bildirim yayımlamayı engellemez.

**Blocked by:** 01 — Kaynaklarına açılan kanıt paketi (skor/kapı yok)

**Status:** ready-for-agent

- [ ] Paket üzerinden domain alanı yazma komutu yoktur; navigasyon kaynağa gider.
- [ ] Kontrol listesi durumu Sürümün yayınını otomatikleştirmez.
- [ ] Yayın farkı satırı 14 sözleşmesini açar; burada snapshot üretmez.
- [ ] Açık İş sinyali durum yazmaz ve yayımlamayı geri almaz.
- [ ] Kabul kanıtı aynı seam'de: kaynakta düzeltme, pakette yazma reddi, sinyalin kapı olmaması.
