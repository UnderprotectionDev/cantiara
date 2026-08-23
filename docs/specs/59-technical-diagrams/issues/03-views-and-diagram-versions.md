# 03 — Diyagram Görünümü ve Diyagram Sürümü

**What to build:** Adlandırılmış Diyagram Görünümü seçilmiş öğeleri ve yerleşimi kopyasız saklar. Kullanıcı Karar, İş, Proje Sürümü, kanıt, paylaşım veya export için adlandırılmış değişmez Diyagram Sürümü oluşturur; hedefler canlı kayıt yerine veya yanında bu sürüme sabitlenebilir. Eski sürümü geri yüklemek checkpoint'i yazmaz, canlı diyagramda yeni revizyon üretir. Görünüm kanonik modelin yerine geçmez. Veri Modeli için Şema Görünümü aynı kuralı izler; ayrı fiziksel mağaza ayrı diyagramdır.

**Blocked by:** 02 — Üç tür ve kanonik yapısal model

**Status:** ready-for-agent

- [ ] Görünüm kaynak öğe kopyalamaz; bağımsız erişim veya içerik kaynağı değildir.
- [ ] Diyagram Sürümü değişmez checkpoint'tir; Git tag veya görüntü export'u değildir.
- [ ] Restore yeni canlı revizyon yazar; sürüm satırını geriye dönük değiştirmez.
- [ ] Exact ilişki/kanıt pin'i sürüm kimliğine gider; canlı kayda sessiz taşıma yoktur.
- [ ] Kabul kanıtı aynı seam'de: görünüm/sürüm ayrımı, restore, exact pin. Erişilebilirlik **Diyagram Görünümü ve Diyagram Sürümü**.
