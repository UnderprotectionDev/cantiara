# 05 — Erken kalıcı silme (Account Access grant + yazılan ad)

**What to build:** Kurucu 30 günden önce `Permanently Delete` başlatır. Etki önizlemesi, Hesap Erişimi feature'ının `Confirm GitHub Identity` grant'inin bu işlem kimliğiyle tüketilmesi ve etkilenen Hesap veya Proje adının yazılması gerekir. İkinci kimlik teyit kartı yoktur; OAuth/PKCE/`prompt=select_account` burada yeniden belirtilmez. Grant yoksa, süresi dolmuşsa, işlem kimliği uymazsa veya yazılan ad eşleşmezse yazma olmaz. Proje silme grubunda erken silme bütün gruba uygulanır. Bu ticket Hesap kapatma, güvenlik redaksiyonu UI'si veya Proje arşivi değildir.

**Blocked by:** 03 — Geri yükleme, Proje silme grubu tek süre ve süre sonu

**Status:** ready-for-agent

- [ ] Erken kalıcı silme etki önizlemesi gösterir; Account Access grant'ini işlem kimliğiyle bir kez tüketir; etkilenen Hesap veya Proje adı yazılmadan uygulanmaz.
- [ ] İkinci `Confirm GitHub Identity` kartı, OAuth turu veya PKCE uygulaması bu ticket'ta yoktur; grant consume arayüzü 01'indir.
- [ ] Grant yokluğu, süre aşımı, yanlış işlem kimliği, replay veya yazılan ad uyuşmazlığı yüksek riskli yazma yapmadan reddedilir.
- [ ] UI eylemi parola, MFA veya oturum yenileme olarak göstermez; kopya `Permanently Delete` + tüketilen `Confirm GitHub Identity` kalır.
- [ ] Proje silme grubunda erken silme tek birimdir; `Keep approved surface` bu yolda sunulmaz. Etkin Dış yüzey veya kaldırılmamış hassas içerik varken silme engellenir.
- [ ] Kabul kanıtı Trash seam'inde grant double ile: eşleşen tüketim, eksik grant, replay, ad uyuşmazlığı, grup atomikliği. Bu kanıt [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) ve [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuklarının erken-silme karşıtıdır; kapatma/redaksiyon UI'si sonraki feature'lardadır.
