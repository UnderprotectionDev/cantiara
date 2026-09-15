# 02 — Yalıtılmış akıllı bağlantı önizlemesi

**What to build:** Herkese açık HTTP(S) yapıştırınca yalıtılmış egress başlık, alan adı ve güvenli görsel gösterir; önizleme tek başına Kaynak değildir. Dış HTML ikinci doğruluk kaynağı olmaz. YouTube kartı tıklanınca yüklenir, autoplay yoktur, üçüncü taraf uyarısı kalır. Vimeo ve diğerleri oynatıcıya dönmez. ADR-0008 her DNS ve yönlendirmede özel hedefleri reddeder.

**Blocked by:** 01 — Kaynak kaydı ve tarihli sürümler

**Status:** ready-for-agent

- [ ] Egress ayrı yetkisiz yoldur; loopback/özel/link-local/ayrılmış, credential, aşırı boyut, çalıştırılabilir içerik reddedilir. Belirsizde düz bağlantı kalır.
- [ ] `Save as Source` canlı önizlemeyi tarihsel snapshot’tan görsel ayırır; dış değişiklik saklanmış snapshot’ı sessiz güncellemez.
- [ ] YouTube `Live external source`, click-to-load, autoplay yok, özgün URL görünür. Kısıtlı video güvenli fallback + hata; boş embed yok. YouTube kartı tarihsel kanıt değildir.
- [ ] Vimeo/diğer sağlayıcı ve yapıştırılan iframe oynatıcı olmaz.
- [ ] Kabul kanıtı aynı seam’de preview double ile: özel IP, redirect-to-private, YouTube-only, önizleme≠Kaynak.
