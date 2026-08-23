# 03 — Kapanış snapshot’ı ve rollover yok

**What to build:** Kapanışta başlangıç kapsamı ile kapanış kapsamı ayrı, değişmez tarihsel snapshot olarak kalır; güncel İş kayıtlarının yerine geçmez. Açık İşler toplu karar ekranında sonraki döneme, Backlog’a veya başka döneme gönderilebilir ya da açık kapatma ile vazgeçilebilir. Önceden açılmış kural bütün açık İşleri sonraki döneme taşımaz. Atlanabilir dönem değerlendirmesi öğrenim metni tutar; takip İş yalnız önizleme ve onayla oluşur.

**Blocked by:** 01 — 1–8 haftalık pencere, üyelik durum yazmaz; 02 — Aynı anda tek etkin dönem

**Status:** ready-for-agent

- [ ] Kapanış snapshot’ı canlı İş alanlarını ezmez; karşılaştırma tarafsızdır ve skor üretmez.
- [ ] Toplu karar ekranı seçili açık İşleri sonraki döneme, Backlog’a veya başka döneme gönderir ya da açık kapatma eylemiyle vazgeçirir; vazgeçme İş kapanış adımıdır.
- [ ] Toplu karar olmadan açık İş sonraki döneme geçmez; Backlog’a göndermek açık üyeliktir, saklı manuel sırayı sessizce yeniden yazmaz.
- [ ] Değerlendirmeden otomatik action item oluşmaz; takip İş önizlemelidir.
- [ ] İsteğe bağlı tarih karşılaştırması yeni `gerçekleşen tarih` alanı açmaz.
- [ ] Kabul kanıtı seam’de snapshot ayrı duruşu, rollover karşıtı ve toplu karar. Bu [Odak Dönemi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kapanış paketidir.
