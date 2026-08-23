# 03 — Kanıt niteliği özgün mesajdan ayrı

**What to build:** İş–Geri Bildirim bağında isteğe bağlı Kanıt niteliği alanları (bildirilen problem, önerilen çözüm, workaround, etki, sıklık, bağımsızlık, hedef profil uyumu) birbirinden ayrı ve boş/`Unknown` kalabilir. Kaynakta olmayan şiddet/sıklık yorum olarak yazar ve zamanla etiketlenir; sistem mesajdan çıkarım yapmaz. Kanıt Rolü bu bağda ayrı alandır; niteliğinden türetilmez ve birleşik puan oluşturmaz. İsteğe bağlı `Follow up` / `Followed up` / `Outcome verified` yalnız bu bağdaki takip niyetidir; Geri Bildirim veya İş yaşamını değiştirmez. Aynı Geri Bildirimin farklı İşlerdeki niteliği sessizce kopyalanmaz.

**Blocked by:** 02 — İsteğe bağlı kimlik ve İşe dönüşüm

**Status:** ready-for-agent

- [ ] Nitelik alanları ayrıdır; eksik değer ilişkiyi engellemez; özgün mesaj ayrı metin olarak kalır.
- [ ] Kaynakta söylenmeyen değer yorum etiketi, yazar ve zaman taşır; otomatik çıkarım yoktur.
- [ ] Kanıt Rolü niteliğinden türetilmez; birleşik puan yoktur; bir İşteki yorum diğerine kopyalanmaz.
- [ ] `Follow up` durumları Geri Bildirim/İş yaşamını veya e-posta senkronunu açmaz.
- [ ] Kanıt Akışı yüzeyi bu ticket'ta yoktur; rol alanı bağda durur, akış 45'tedir.
- [ ] Kabul kanıtı aynı seam'de: mesaj/nitelik ayrımı, çıkarım karşıtı, rol türetilmezliği, çapraz İş kopyası karşıtı.
