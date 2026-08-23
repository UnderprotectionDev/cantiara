# 04 — Kopya birleştirme

**What to build:** Kurucu gerçek kopya iki İşi `Merge as duplicate` ile birleştirir. Hayatta kalan, alan çatışmaları ve yeniden yazılacak ilişkiler önizlenir. Başlık benzerliği kendiliğinden birleştirmez. Emekli kimlik yönlendirmesi eski anahtarı görünür kökenle çözer. Birleştirmeyi geri alma Mutation Contract güvenli geri almasını kullanır ve sonraki ilgisiz yazmaları silmez.

**Blocked by:** 01 — İş oluşturma, tür ve değişmez anahtar; 02 — Durum ve kapanış sonucu

**Status:** ready-for-agent

- [ ] Önizlemesiz birleştirme uygulanmaz; gizli alan birleşimi yoktur.
- [ ] Tek kanonik kayıt kalır; diğeri güvenli kapanır ve emekli kimlik yönlenir.
- [ ] Bu, başka Projede yeniden oluşturma değildir.
- [ ] Kabul kanıtı Work Lifecycle seam'inde önizleme, emekli anahtar, benzerlik-otomatik karşıtı. İş yaşam döngüsü birleştirme paketi; geri alma 04 sözleşmesini tüketir.
