# 02 — Ziyaretçi bearer oturumu, parola ve YouTube tıklayınca yükleme

**What to build:** Ziyaretçi token'lı URL'yi ve varsa parolayı doğrular; backend yalnız bu Dış yüzeye bağlı `HttpOnly`/`Secure` Paylaşım erişim oturumu verir ve token'sız temiz URL'ye yönlendirir. Oturum tarayıcı kapanışında veya oluşturulduktan 12 saat sonra biter; etkinlik uzatmaz. Bu oturum Hesap oturumu değildir: Workspace yazması, Komut Paleti ve Evrensel Arama kapalıdır. Yanlış parola yüzey varlığını açıklamayan genel hata döner. Denemeler hız sınırlıdır. YouTube kartı sayfa açılışında üçüncü tarafa istek göndermez; `Live external source` uyarısından sonra tıklanınca yüklenir. Ziyaretçi yorum/reaksiyon/çizim yapamaz.

**Blocked by:** 01 — Kapalı dünya önizlemesi, yer tutucu ve onaylı snapshot

**Status:** ready-for-agent

- [ ] Token (+ parola) doğrulaması yüzey-bağlı ziyaretçi oturumu ve temiz URL üretir; token URL'de kalmaz; oturum 12 saat veya tarayıcı kapanışı ile biter ve uzamaz.
- [ ] Paylaşım erişim oturumu kurucu Better Auth oturumu sayılmaz; palet, arama ve Workspace yazması reddedilir.
- [ ] Yanlış parola ve eksik yüzey aynı genel hatayı verir; hız sınırı ham kalıcı IP profili tutmaz.
- [ ] İsteğe bağlı parola eklenir/değişir/kalkar; parola Secret'tır, geri okunabilir saklanmaz, loga girmez.
- [ ] YouTube tıklayınca yüklenir; açılışta üçüncü taraf isteği yoktur; autoplay yoktur; tıklama kaydı Public yapmaz. Aynı kural kurucu önizlemesinde de geçerlidir.
- [ ] Ziyaretçi salt okunur onaylı kapsamdadır; yorum, oy, ortak düzenleme ve palet yoktur.
- [ ] Kabul kanıtı aynı seam'de: oturum değişimi, kurucu-oturum karşıtı, parola kapısı, YouTube ağ yokluğu. Erişilebilirlik yolculuğu **Dış yüzeyde parola, erişim, gezinme**.
