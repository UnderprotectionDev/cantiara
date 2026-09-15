# 01 — Geri Bildirim ana kaydı

**What to build:** Kurucu Geri Bildirimi Proje kapsamında ayrı uzman ana kayıt olarak tutar. Özgün mesaj, kanal, zaman, isteğe bağlı bağlantı ve ekler korunur. Kayıt Kaynak alt türü, özellik isteği, İş veya sosyal gönderi değildir; URL yeniden kontrol, aday snapshot veya Kaynak sürüm yaşamını miras almaz. Durumlar `New`, `Reviewed`, `Archived`'dir; ilişkili İş durumunu değiştirmez. İlk üründe kayıt uygulama içi Hızlı Yakalama ve mevcut kaynaklardan oluşur; herkese açık form yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Geri Bildirim özgün mesaj, kanal ve zamanı ayrı ana kayıtta tutar; özet aslının yerine geçmez.
- [ ] Kaynak alt türü, özellik isteği, İş kaydı veya sosyal gönderi değildir; URL yeniden kontrol ve snapshot yaşamı miras alınmaz.
- [ ] `New` / `Reviewed` / `Archived` bağlı İşin durumunu, önceliğini veya planlama üyeliğini yazmaz.
- [ ] Herkese açık form, yorum, oy ve çift yönlü requester konuşması yoktur.
- [ ] Contact birleştirme ve kişisel veri silme bu ticket'ta yoktur.
- [ ] İngilizce UI `Feedback`, `New`, `Reviewed`, `Archived` kullanır; eksik etiketler PRD sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Feedback seam'inde: oluşturma, Kaynak-alt-tür karşıtı, durumun İşi yazmaması. Kanıt [Kanıt akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
