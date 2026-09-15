# 03 — Süre dolumu, terminal iptal ve cache fail-closed

**What to build:** İsteğe bağlı süre dolumu yeni ve mevcut ziyaretçi erişimini durdurur; snapshot, parola ve Build in Public yüzeyi değişmez. Dolduktan sonra varsayılan `Reshare with a new link` yeni Dış yüzey üretir; `Reopen the same link` eski sahiplerin döneceğini uyarır ve ayrı onay ister. `Revoke` geri döndürülemezdir; URL/token yeniden kullanılmaz. Her HTML, Dosya Eki ve range isteği cache tesliminden önce güncel Dış yüzey, ziyaretçi oturumu ve kesin dosya sürümünü doğrular; ham R2/CDN nesne URL'si açıklanmaz. İptal ve redaksiyon cache'den önce gelir; kaldırılan URL gövdesiz `410 Gone` + `noindex` döner ve yeni yüzeye yönlenmez. İptal, Geri döndürülemez güvenlik olay günlüğüne secret'siz yazılır; replay restore edilmiş canlı satırı yetkisiz bırakır.

**Blocked by:** 02 — Ziyaretçi bearer oturumu, parola ve YouTube tıklayınca yükleme

**Status:** ready-for-agent

- [ ] Süre dolumu erişimi durdurur; içerik silinmez; varsayılan otomatik süre yoktur; dolmadan uzatma çalışır.
- [ ] `Reshare with a new link` ile `Reopen the same link` ayrı eylemlerdir; reopen ekstra onay ve uyarı ister.
- [ ] `Revoke` terminaldir; aynı URL/token başka yüzeyde veya reopen'da yaşamaz; parola değişimi/iptal mevcut oturumları hemen düşürür.
- [ ] İptal veya yayından kaldırma HTML/asset/range için gövdesiz `410 Gone` + `noindex` döner; yeni yüzeye veya özel içeriğe redirect yoktur; URL yeniden kullanılmaz.
- [ ] Paylaşımı açmak, süreyi değiştirmek veya yeniden etkinleştirmek kaynak durumunu, Herkese açık durum etiketini veya Build in Public snapshot'ını yazmaz.
- [ ] Asset/range ürün kontrollü URL'den geçer; iptal veya süre dolumu CDN durumundan bağımsız reddeder; stale/offline pencere yoktur.
- [ ] Yanıtlar `Referrer-Policy: no-referrer`, kısıtlayıcı CSP ve dış linklerde `rel="noreferrer"` taşır.
- [ ] İptal/token/parola değişimi append/replay arayüzüne secret'siz yazar; replay testi restore edilmiş hâlâ canlı satırın yetkisiz kaldığını gösterir. Operatör RPO/RTO bu ticket'ta yoktur.
- [ ] Kabul kanıtı aynı seam'de: expiry, revoke, range, cache enjeksiyonu, replay. Erişilebilirlik **süre dolumu, iptal ve hata**; yolculuk [Bağlantıyla paylaşım](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
