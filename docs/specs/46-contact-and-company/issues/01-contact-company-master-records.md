# 01 — Contact ve Company ana kayıtları

**What to build:** Kurucu Çalışma Alanı kapsamında Contact ve isteğe bağlı Company tutar. Contact kararlı iç kimlik taşır; görünen ad ve e-posta isteğe bağlıdır; normalize e-posta takma değerdir. Company adıyla hafif kuruluş bağlamıdır, zorunlu değildir. Contact profili ilişkili Geri Bildirim, Company ve Persona belgesi bağlarını `Open Source Record` ile kaynağında açar. CRM alanları yoktur. Kişisel veri silme UI'si yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Contact Workspace kapsamlı ana kayıttır; görünen ad ve e-posta isteğe bağlıdır; kimlik e-posta değildir.
- [ ] Company isteğe bağlıdır; `Belongs to Company` Contact başına en fazla bir güncel bağdır; geçmiş değişiklikte korunur.
- [ ] Persona ayrı ana kayıt değildir; yalnız Belge ilişkisi tutulur ve otomatik atama yoktur.
- [ ] Plan, abonelik, ARR/MRR, gelir, sözleşme, satış aşaması, coğrafi segment ve ticari skor alanları yoktur.
- [ ] Geri Bildirim kaydı, feed ve Kanıt Akışı bu ticket'ta yoktur; profil yalnız `Open Source Record` ile kaynağı açar.
- [ ] İngilizce UI `Contact`, `Company`, `Belongs to Company`, `Open Source Record` kullanır; eksik etiketler PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Contact and Company seam'inde: oluşturma, isteğe bağlı Company, CRM alan yokluğu, Persona otomatik atama yokluğu. Kanıt [Kanıt akışı](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kimlik bağlamına ve [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kimlik defterine bağlanır; silme/export 81'dedir.
