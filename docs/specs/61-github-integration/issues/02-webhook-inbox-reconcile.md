# 02 — Webhook, durable inbox ve salt okunur uzlaştırma

**What to build:** İmzalı webhook doğrulanır, teslim durable inbox'a tekil yazılır, GitHub'a 10 saniyeden kısa başarı döner; alan senkronu HTTP içinde bitmez. Worker retry aşılan teslimi kaybetmez; dead-letter görünür operasyonel alarm üretir. Aynı teslim tekrarında önceki sonuç döner. Olaylar `updated_at` ile uygulanır; eski olay yeni durumu geriye sarmaz. Aktif bağlantıda ≤15 dk artımlı read-only uzlaştırma ve `Sync now` vardır; ilk bağ eşitlemesi 30 dakikayı aşmaz. Rate-limit'te `Retry-After` uyulur, yazma API'si yoktur. 30 dk sonra `Out of date`. Webhook secret 90 günde ve şüphede döner. Arşiv bağlantıyı duraklatır; Trash yazmayı durdurur; kalıcı silme tombstone ile otomatik diriltmeyi engeller. Bağlantı yaşamı `Connected` / `Paused` / `Disconnected`'tır.

**Blocked by:** 01 — GitHub App ile Repository bağlantısı

**Status:** ready-for-agent

- [ ] İmza yoksa inbox yazılmaz; ACK <10s; senkron worker'dadır (pg-boss).
- [ ] Idempotent teslim; sırasız olay geriye sarmaz; çelişkide uzlaştırma snapshot'ı üstün.
- [ ] İki yönlü issue klonu ve yazma API'si yoktur.
- [ ] Archive/Trash/restore/tombstone PRD 12 yaşamını izler; açık uzlaştırma olmadan kaçan gerçek sessiz uygulanmaz.
- [ ] İlk bağın eşitlemesi 30 dakika, kaçan olay uzlaştırması 15 dakika içinde biter; aşım sessiz “çalışıyor” değildir.
- [ ] Webhook secret en geç 90 günde ve şüpheli erişimde hemen döner; eski+yeni en fazla 15 dakika birlikte doğrulanır, sonra eski reddedilir.
- [ ] Başarılı şifreli ham payload ≤24 saat, başarısız ≤7 gün, teslim id/hash/sonuç 30 gün; süre sonunda fiziksel silinir.
- [ ] Bağlantı yaşamı `Connected` / `Paused` / `Disconnected`'tır (`Bağlı` / `Duraklatıldı` / `Bağlantı kesildi`). Yetki yok, kaynak bulunamadı veya App kaldırma senkronu durdurur ve nedeni gösterir; dördüncü yaşam durumu veya oturum öldürme değildir.
- [ ] Kabul kanıtı aynı seam'de: imza, duplicate, out-of-order, stale, tombstone. [GitHub](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) inbox paketidir.
