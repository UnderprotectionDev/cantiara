# 01 — Locale, saat dilimi, tarih biçimi ve haftanın ilk günü

**What to build:** Kurucu Hesap tercihinde locale, saat dilimi, tarih biçimi ve haftanın ilk gününü kaydeder. Kayıt yokken varsayılanlar `en-GB`, `Europe/Istanbul` ve `Monday`dır. İlk girişte tarayıcı önerisi gösterilir; yalnız açık `Save` uygulanır. Locale tarih/saat/sayı biçimini değiştirir; arayüz ve kullanıcı içeriği İngilizce/yazıldığı gibi kalır. Saat dilimi değişimi saklanmış kesin zaman damgasını yeniden yazmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Hesap kaydı locale, saat dilimi, tarih biçimi ve haftanın ilk gününü bütün Projelerde ortak uygular; Proje override yoktur.
- [ ] Kayıt yokken locale `en-GB`, saat dilimi `Europe/Istanbul`, haftanın ilk günü `Monday`dır.
- [ ] İlk girişte tarayıcı önerisi görünür; kaydetmeden kapanınca varsayılanlar kalır; `Save` öneriyi Hesaba yazar.
- [ ] Locale ve tarih biçimi bilinen bir zaman damgası ile sayıyı biçimler; haftanın ilk günü hafta ızgarasını kaydırır.
- [ ] Saat dilimi değişimi gelecek giriş, takvim gün sınırı ve tarihsel gösterimi değiştirir; saklanmış kesin zaman damgası aynı kalır.
- [ ] Dil tercihi kontrolü yoktur; locale `tr-TR` olsa bile chrome ve kullanıcı içeriği çevrilmez. İngilizce etiketler `Preferences`, `Locale`, `Time zone`, `Date format`, `First day of week`, `Save`, `Use suggested locale and time zone` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Locale, saat dilimi, tarih biçimi ve haftanın ilk günü saklanmış anahtarı, durumu, alan değerini veya kayıt anlamını yeniden yazmaz; yalnız gösterimi kişiselleştirir.
- [ ] `Confirm GitHub Identity`, giriş ve oturum iptali bu yüzeyde yoktur; kimlik kanıtı workflow 01’e aittir.
- [ ] Kabul kanıtı Account Preferences seam'inde: varsayılanlar, öneri-uygulanmama, kayıt, biçim, hafta sınırı, zaman damgası karşıtı, dil tercihi yokluğu. Sentetik fixture [İngilizce ürün dili](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
