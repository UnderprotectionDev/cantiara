# 02 — Kullanım bağları

**What to build:** Kullanım bağı semantik ilişki değildir. Kapalı liste: satır içi kayıt referansı, kararlı bölüm referansı, canlı içerik bloğu, konuma sabitlenmiş Dosya Eki/Wireframe bağı, akış düğümünün Ekran referansı. Gömü kaynak kimliğini korur; kopya ve durum yazmaz. Kullanım bağını kaldırmak gömüyü kaldırır, kaynak kaydı silmez. Kanıt Rolü veya kardinalite dayatmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Kullanım bağı standart ilişki tablosuna girmez ve `Related` olarak adlandırılmaz.
- [ ] Yeni kullanım türü listeye eklenmeden yazılamaz.
- [ ] Unlink gömüyü kaldırır; kaynak ana kayıt yaşar.
- [ ] Kabul kanıtı Relations seam'inde kullanım ≠ ilişki, unlink, durum-yazmama. Arama ve ilişki kullanım paketi.
