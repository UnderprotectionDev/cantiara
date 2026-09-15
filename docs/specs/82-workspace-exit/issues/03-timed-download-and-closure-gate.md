# 03 — Süreli indirme, restore yok, kapanış başarı kapısı

**What to build:** İndirme şifreli, süreli ve iptal edilebilir. Yaşayan Hesapta restore-point kütüphanesi oluşmaz. Üretim başarı kaydı, Hesap kapatmanın kalıcı silmeden önce en az bir başarılı paketi araması için görünürdür (84 enforce eder). Kapanış dondurmasında paket 30 gün indirilebilir tutulur — o süreyi 84 açar; bu ticket başarı ve indirme nesnesini sağlar. Zamanlanmış otomatik çıkış yoktur.

**Blocked by:** 02 — Parola zarfı, saklanmama ve unutulunca okunamazlık

**Status:** ready-for-agent

- [ ] İndirme bağlantısı şifreli nesneye gider, süre dolunca ve iptalde kapanır; ham secret'siz nesne URL'si ürün sözleşmesini delmez.
- [ ] Yaşayan Hesap paket üretiminden restore-point listesi/kütüphanesi oluşturmaz.
- [ ] En az bir başarılı üretim, 84'ün kalıcı silme önkoşulu olarak sorgulanabilir; ürün içi import/restore komutu yoktur.
- [ ] Zamanlanmış otomatik çıkış işi yoktur.
- [ ] Kabul kanıtı indirme süresi/iptal, kütüphane yokluğu, başarı bayrağı, restore endpoint yokluğu. 84 kapanış UI'si bu ticket'ta yoktur.
