# 03 — Yeniden kontrol, karşılaştırma ve kullanıma göre bağ

**What to build:** `Recheck source` tarihli Kaynak Kontrolü ve aday snapshot üretir; onaylı sürümü kendiliğinden değiştirmez. Karşılaştırma pin eşleşmeyen aralığı `No match in candidate version` gösterir, sessiz semantik rebind yoktur. Her kullanım `Keep current version` veya `Rebind to new version` kararını ayrı verir. `source-version-in-use` eski bağlar varken üretilir; toplu güncelleme örtük çalışmaz.

**Blocked by:** 02 — Yalıtılmış akıllı bağlantı önizlemesi

**Status:** ready-for-agent

- [ ] Kontrol kullanıcı başlatmalıdır; periyodik tarama ve salt zaman yoktur. Başarısızlık eski içeriği güncel göstermez.
- [ ] `Save as new Source version` eski sürümü ve pinlerini bırakır; yeni sürüm bağ miras etmez, İş/Karar/Risk üretmez.
- [ ] Kullanım yeri kesin sürüm, erişim tarihi ve aralığı gösterir; `Newer Source version exists` karşılaştırma açar, eskiyi sessizce yanlış etiketlemez.
- [ ] `Reviewed; keep current version` ve `Rebind to new version` yalnız o bağı etkiler. Evidence seam rebind’i çağrılır; 45’in pin kuralı bozulmaz.
- [ ] `source-version-in-use` yalnız aktif kanıt bağları için; `İlgili` veya görüntüleme sinyal değildir. Bütün kullanımlar incelenince kapanır. Merkez UI 71’dedir.
- [ ] İncelenmemiş yeni sürüm İş/Karar/Risk/test/sürüm durumu yazmaz. [Kanıt tazeliği](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari): bir Kaynak, üç hedef, iki sürüm, kısmi inceleme.
