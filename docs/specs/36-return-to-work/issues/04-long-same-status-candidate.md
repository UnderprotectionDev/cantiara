# 04 — Uzun süredir aynı durumda adayı

**What to build:** Kurucu Proje bazında durum yaşı eşiği vermişse eşiği aşan aktif İşler `Long in the same status` gerekçeli nötr geri dönüş adayı olur ve hazır Akıllı Koleksiyonda görünür. Aday varsayılan bildirim, takıldı hükmü veya sağlık puanı değildir; İş durumu veya planlama üyeliği yazılmaz.

**Blocked by:** 01 — Geri dönüş kartları ve sıradaki somut adım

**Status:** ready-for-agent

- [ ] Eşik isteğe bağlı Proje yapılandırmasıdır; yoksa bu gerekçe üretilmez.
- [ ] Eşiği aşan aktif İş Return to Work kartı nedeni ve hazır Akıllı Koleksiyon üyeliği olur. Koleksiyon motoru 34’tedir; bu ticket nedeni ve eşiği sahiplenir.
- [ ] Aday varsayılan Dikkat sinyali, `stuck` hükmü, sağlık veya performans puanı üretmez.
- [ ] Aday olmak İş akışı durumunu, kapanış sonucunu veya planlama üyeliğini değiştirmez.
- [ ] Kabul kanıtı aynı seam’de: eşik yokluğu, aday nedeni, yazmama, varsayılan sinyal yokluğu.
