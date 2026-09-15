# 04 — Özellik ve Proje Sürümü nötr test özeti

**What to build:** Özellik test özeti açık ilişkilerle bağlı senaryo, Handoff, Test Oturumu/Oturum Testi, açık Test Açığı, takip işi ve son Test değerlendirmesini canlı bir araya getirir. Proje Sürümü özeti aynı kayıtları kapsam İlişkileri ve doğrudan Sürüm bağlarından gösterir. Her sayı onu üreten kesin küme ve filtreleri açar. GitHub check'leri ayrı dış gerçek kalır; Test Oturumuna dönüşmez. Özet coverage, kalite puanı, genel geçti/kaldı veya yayın kapısı üretmez ve Sürüm Kanıt Paketinin yerine geçmez. Testler alanı PRD 10 türetilmiş bölümleriyle mevcut kayıtları yönetir; faz veya CI panosu değildir ve yeni test gerçeği yazmaz.

**Blocked by:** 01 — Oturum ve madde incelemesinin bağımsız yaşamı; 03 — Yerine geçme, çelişki, bağlam değişikliği ve takip işi

**Status:** ready-for-agent

- [ ] Özellik ve Proje Sürümü özeti türetilmiş canlı görünümüdür; ikinci test kaydı veya skor alanı yazmaz.
- [ ] Senaryo, Handoff, sonuç, açık ve değerlendirme satırları kendi ana kaydına açılır; sayı kayıtsız gösterilmez.
- [ ] GitHub check özeti bu yüzeyde Test Oturumu olmaz; check ayrı dış gerçektir (61).
- [ ] Çelişki, bağlam değişikliği, incelenmemiş rapor, açık Test Açığı ve `Failed` / `Blocked` / `Inconclusive` / `Skipped` kaynaklı nötr bilgidir; kapı veya coverage değildir.
- [ ] Özet 64 Sürüm Kanıt Paketi değildir.
- [ ] Testler alanı canlı türetilmiş bölümler sunar: incelenmemiş raporlar, takip gereken sonuçlar, açık/planlanmış Test Açığı, çelişen veya yerine-geçme bekleyen sonuçlar, bağlamı değişmiş sonuçlar, aktif Handoff'lar, son Test Oturumları, son Test değerlendirmeleri. Her sayı kesin kümeyi açar; alan faz, CI panosu veya yeni test gerçeği değildir.
- [ ] Test değerlendirmesi burada yeniden yazılmaz; son snapshot açılır. Test Açığı burada üretilmez.
- [ ] Kabul kanıtı Test Review seam'inde: drill-down, skor/kapı yokluğu, check dönüşmeme karşıtı. Aynı kanıt [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) özet paketidir.
