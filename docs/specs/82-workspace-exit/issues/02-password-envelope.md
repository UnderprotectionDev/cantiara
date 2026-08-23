# 02 — Parola zarfı, saklanmama ve unutulunca okunamazlık

**What to build:** Paket kullanıcı parolasıyla zorunlu şifrelenir. Parola sunucuda, logda veya veritabanında saklanmaz. Unutulan parola paketi okunamaz kılar; kurtarma kodu veya şifresiz kopya yoktur. Uygulamasız doğrulanabilir envelope tanımı yayımlanır. Bu ticket ürün içi restore açmaz.

**Blocked by:** 01 — Tam arşiv içeriği ve manifest (secret'siz)

**Status:** ready-for-agent

- [ ] Üretim parolayı ciphertext üretmek için bellekte kullanır ve persist etmez; log/DB'de parola yoktur.
- [ ] Yanlış veya boş parola ile paket açılamaz; doğru parola envelope tanımına göre içeriği doğrular (ürün restore endpoint'i yoktur).
- [ ] Kurtarma kodu, şifresiz ikiz ve "parolayı e-posta ile gönder" yolu yoktur.
- [ ] Kabul kanıtı Workspace Exit Package seam'inde ciphertext, persist-etmeme, unutulan parola, restore yokluğu. [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) parola-kaybı sınırı.
