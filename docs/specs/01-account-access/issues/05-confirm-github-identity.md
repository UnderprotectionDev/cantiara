# 05 — Confirm GitHub Identity yetkisi

**What to build:** Yüksek riskli işlem, `Confirm GitHub Identity` ile yeni bir GitHub OAuth authorization-code turunu PKCE ve `prompt=select_account` kullanarak açar. Callback'teki değişmez GitHub kullanıcı kimliği mevcut Hesapla eşleşirse yalnız istenen işlem için tek kullanımlık, en fazla 10 dakika geçerli sunucu yetkisi üretilir. Farklı kimlik, süresi dolmuş tur, state/PKCE hatası veya tekrar kullanım hiçbir yüksek riskli yazma yapmadan reddedilir. Eylem parola, MFA veya genel oturum yenileme olarak sunulmaz. Kapatma, redaksiyon, erken kalıcı silme ve kişisel veri silme bu yetkiyi tüketir; ayrı teyit kartı açmaz. Hedef adı yazma onayı tüketen feature'da kalır.

**Blocked by:** 01 — GitHub ile giriş, Hesap ve tek Çalışma Alanı; 04 — GitHub kesintisi ve login yetkisinin App'ten ayrı kalması

**Status:** ready-for-agent

- [ ] `Confirm GitHub Identity` yeni OAuth authorization-code + PKCE turunu `prompt=select_account` ile başlatır; mevcut oturum veya başka sağlayıcı yetmez.
- [ ] Callback değişmez GitHub kullanıcı kimliğini mevcut Hesapla eşler; eşleşince istenen işlem kimliğine bağlı, tek kullanımlık, en fazla 10 dakikalık sunucu yetkisi üretir.
- [ ] Farklı kimlik, süre aşımı, state/PKCE hatası ve yetki tekrarı yüksek riskli yazma yapmadan reddedilir.
- [ ] UI bu eylemi parola, MFA veya GitHub'ın yeni credential zorladığı yeniden doğrulama olarak göstermez; kopya `Confirm GitHub Identity` kalır.
- [ ] Tüketim arayüzü tüketen feature'ların işlem kimliğiyle yetkiyi bir kez harcamasına izin verir; ürün içi sahte yüksek risk eylemi açılmaz. İsim yazarak onay bu ticket'ta yoktur.
- [ ] GitHub teyidi tamamlanamazsa yüksek risk fail-closed kalır (04'teki kesinti davranışı bozulmaz).
- [ ] Kabul kanıtı Account Access seam'inde: eşleşen kimlik, hesap değişimi, replay, süre aşımı, PKCE/state hatası ve grant tüketimi. Bu kanıt [Hesap ve kişisel veri](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun teyit paketidir; kapatma/export UI'si sonraki feature'lardadır.
