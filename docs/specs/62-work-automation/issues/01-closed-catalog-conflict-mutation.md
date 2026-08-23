# 01 — Kapalı kural kataloğu, çatışma ve tek mutasyon

**What to build:** Kurucu kapalı tetikleyici, isteğe bağlı koşul ve eylemlerden Proje kuralı oluşturur. Yalnız etkin kurallar çalışır. Aynı özgün olayın önerileri yazmadan toplanır; aynı hedef alanda çatışma hiçbir otomasyon yazması yapmadan kuralları ve çözüm yolunu gösterir. Çatışmayan öneriler bütün kural atıflarını taşıyan tek atomik ve idempotent mutasyonda uygulanır. Bir yazma başka kuralı tetiklemez. Dry run yazmaz. Başarısızlık Action-needed sinyalidir. Geçmiş kural sürümü gelecek tanımı değiştirir, geçmiş etkileri yeniden yazmaz. Çöpteki kural çalışmaz. Tekrarlayan iş her seferinde yeni İş üretir; aynı İşi tarih ileri alıp açmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Katalog dışına script/HTTP/genel GitHub tetikleyicisi eklenemez. Ürün tekrarlayan hareket izleyerek kural önermez; kural ilişki, etki veya karar çıkarmaz.
- [ ] Otomasyon çatışması last-write-wins veya kural sırası uygulamaz; hedef alan yazılmaz.
- [ ] Çatışmayan küme tek mutasyon ve retry-idempotent'tir (ADR-0004).
- [ ] Cascade yoktur; ayrı run günlüğü yoktur.
- [ ] Başarısız kural `automation-failed` Action-needed sinyali üretir (kural, özgün tetikleyici, başarısız adım, uygulanabilir neden); sessizce yutulmaz.
- [ ] Yalnız açıkça etkin kurallar çalışır; dry run yazmaz; çöpteki kural çalışmaz.
- [ ] UI açıkken güvenli yazmada 10 sn geri al; alan çatışmasında sessiz üzerine yazma yoktur.
- [ ] Kabul kanıtı Work Automation seam'inde: çatışma, tek mutasyon, cascade karşıtı. [Otomasyon](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) çatışma paketidir.
