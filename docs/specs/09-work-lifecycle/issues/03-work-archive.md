# 03 — İş arşivi

**What to build:** Kurucu İşi durum ve kapanış sonucundan bağımsız arşivler. Kayıt silinmez; kimlik, anahtar, geçmiş ve ilişkiler kalır. Varsayılan planlama yüzeylerinden düşer; açık arşiv filtresiyle bulunur; arşiv geri alınır. Proje arşivi veya Çöp Kutusu değildir.

**Blocked by:** 01 — İş oluşturma, tür ve değişmez anahtar

**Status:** ready-for-agent

- [ ] Arşiv kapanış sonucu yazmaz; kapanmış İş otomatik arşivlenmez.
- [ ] Arşivlenen İş varsayılan listeden çıkar, arşiv filtresiyle bulunur, kimliği değişmeden döner.
- [ ] Trash veya Proje arşivi semantiği kullanılmaz.
- [ ] İngilizce `Archive` gerekirse terim tablosuna eklenir.
- [ ] Kabul kanıtı Work Lifecycle seam'inde arşiv/geri al ve kapanıştan bağımsızlık. İş yaşam döngüsü arşiv paketi.
