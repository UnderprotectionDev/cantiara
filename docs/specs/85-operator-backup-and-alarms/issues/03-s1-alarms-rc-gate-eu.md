# 03 — S1 alarm ≤5 dk, son RC kapısı, AB dağıtım doğrulaması

**What to build:** Sağlık, hata oranı, kuyruk gecikmesi ve yedek başarısızlığı için yapılandırılmış metrik ve alarm (Better Stack) bulunur. S1, otomatik tespitten en fazla 5 dakikada üretilir; güvenliyse fail-closed sınırlama insan beklemeden başlar. 7/24 insan nöbeti, pager ürünü ve Üretim Olayı öğrenimi yoktur. S2 bir iş günü içinde triage edilir. Bu paket ürün özelliklerinden sonra gelen son sürüm-adayı kapısıdır; doğrulanmış kurtarma kanıtı olmadan aday kabul edilmez. Avrupa bölgesi kullanıcı yüzeyi/bölge seçici açmaz; production onaylı bölge (Neon Frankfurt, Railway Amsterdam, R2 `eu`, Better Stack Almanya) dışında tamamlanamaz. Destek referansı UX 03 istemcidedir.

**Blocked by:** 02 — Restore, güvenlik günlüğü replay, RTO, erişim kapısı

**Status:** ready-for-agent

- [ ] Enjekte tespit S1 alarmını ≤5 dakikada üretir; güvenli fail-closed sınırlama insan onayı beklemeden başlar. Aşım operasyonel hata olarak kaydedilir.
- [ ] 7/24 nöbet, müşteri destek kuyruğu ve 66 Üretim Olayı kaydı bu alarmdan üretilmez. S2 bir iş günü triage saati taşır.
- [ ] Ürün sürüm adayı kanıt paketinde operasyonel kurtarma sonucu (madde 12) yoksa aday bloklanır; özellik aşaması bu kapıyı ertelemez.
- [ ] Production deploy, onaylı AB sağlayıcı bölgesi dışında fail-closed reddeder; üründe bölge seçici yoktur. Herkese açık onaylı statik içerik özel bağımlılık açmadan mevcut teslim noktasında kalabilir.
- [ ] Secret'siz destek referansı UI'si bu ticket'ta yoktur (03). Kullanıcı restore-point'i 01/02'de zaten yasaklandı.
- [ ] Kabul kanıtı S1 süresi, RC kapısı, production bölge doğrulaması. [Operasyonel kurtarma](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) son dilim.
