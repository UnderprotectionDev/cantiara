# 03 — Güvenli önizleme ve türetilmiş thumbnail

**What to build:** Desteklenen medya yalıtılmış ürün içi önizlemede görülür. Oynatma yalnız kullanıcı eylemiyle başlar. İşleme başarısız olsa bile kaynak dosya ve kayıt bozulmaz; `Unavailable` fallback gösterilir. Görsel türevleri özgün parmak izine bağlı cache'tir, ayrı Dosya Eki değildir. ZIP önizlenmez; taranmamış ZIP dış yüzeye seçilemez. Bu önizleme paylaşım snapshot asset kapısı veya canlı web aynası değildir.

**Blocked by:** 01 — Dosya kabulü, kota ve atomik finalize

**Status:** ready-for-agent

- [ ] JPEG/PNG/WebP/GIF görsel önizleme; PDF sayfalı önizleme; CSV sınırlı satır; metin güvenli düz metin; ses/video kullanıcı başlatmalı oynatma (autoplay yok, hız/tam ekran/isteğe bağlı döngü) çalışır.
- [ ] ZIP yalnız indirme/export; içerik çalıştırılmaz ve ürün içi açma önizlemesi yoktur.
- [ ] Özgün görsel değişmez; küçük/orta Gallery thumbnail'ları immutable türev anahtarında, parmak izi anahtarıyla idempotent üretilir. EXIF konum/cihaz türeve girmez. Türev ayrı sürüm değildir ve kaynak sürümle birlikte temizlenir.
- [ ] Boyut/kare/decode/CPU sınırını aşan fakat tür/byte'ı geçerli dosya indirilebilir kalır, bozuk sayılmaz ve `Unavailable` gösterir; sınırlı retry ve gözlemlenebilir hata vardır.
- [ ] Gallery referans veri setinde tam boyutlu özgünleri liste thumbnail'ı olarak indirmez.
- [ ] Önizleme yalıtılmıştır; ham nesne URL'si, dış görüntüleyici oturumu ve paylaşım asset kapısı değildir. Taranmamış ZIP bağlantıyla sınırlı veya herkese açık Dış yüzeye seçilemez (fail-closed).
- [ ] Kabul kanıtı File Attachments seam'inde: tür matrisi önizleme, thumbnail idempotency, decode sınırı fallback, ZIP dış yüzey karşıtı, URL sızıntısı karşıtı. Fixture `Dosya sınırları`.
