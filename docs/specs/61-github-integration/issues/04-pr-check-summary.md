# 04 — PR check özeti (Test Oturumu değil)

**What to build:** Bağlı PR'ın check gerçeği yalnız güncel head SHA, sağlayıcı ve kararlı check kimliğiyle salt okunur gösterilir. Ürün check çalıştırmaz veya yeniden başlatmaz; tam log yönetmez; sonucu Test Oturumuna veya Oturum Testine dönüştürmez. GitHub requiredness vermezse `Unknown`; isimden çıkarım yoktur. Superseded sonuç güncel sunulmaz. Özet rollup kaynak check'leri açar. Başarısız check `Action needed` sinyali üretir; kapatma/açma etkisi 62 kuralına bırakılır. CI orkestrasyonu veya MCP rapor kabulü değildir.

**Blocked by:** 02 — Webhook, durable inbox ve salt okunur uzlaştırma

**Status:** ready-for-agent

- [ ] Check özeti Test Oturumu, senaryo sonucu veya yayın kapısı değildir.
- [ ] Head SHA kuralı ve `Required`/`Unknown` karşıt testle kilitlenir.
- [ ] 54/57 seam'lerine check'ten kayıt yazılmaz.
- [ ] Kabul kanıtı GitHub Integration seam'inde check double ile: head SHA, superseded, Test Oturumu yokluğu.
