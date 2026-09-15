# 05 — Salt okunur PR Bağlam Kartı

**What to build:** Bağlı PR detayında PR Context Card problem kaynağı, beklenen sonuç, Karar, açık Risk, geri bildirim, hedef Sürüm, gerekli/bağlamsal rol, güncel head SHA check özeti ve reviewer kompakt özetini ana kayıtlardan türeterek gösterir. Her madde kaynağa açılır. Kart ikinci açıklama, Work Context Card, bağlam içi önizleme veya GitHub review/merge aracı değildir. Diff/approve/merge GitHub'da kalır. Eksik bağ otomatik tamamlanıp PR hazır ilan edilmez.

**Blocked by:** 03 — İş–GitHub bağlantıları ve PR rolleri; 04 — PR check özeti (Test Oturumu değil)

**Status:** ready-for-agent

- [ ] Kart salt okunur türetilmiş görünümüdür; yazma komutu (review, merge, İş kapat) yoktur.
- [ ] Satırlar 57 test özeti, 64 kanıt paketi veya 16 İş Bağlam Kartı yerine geçmez.
- [ ] Reviewer `Pending` / `Approved` / `Changes requested` / `Commented` yalnız GitHub veri verirse gösterilir; ayrı dikkat sinyali üretmez.
- [ ] Kabul kanıtı aynı seam'de: drill-down, merge/review yokluğu, hazır-ilan karşıtı.
