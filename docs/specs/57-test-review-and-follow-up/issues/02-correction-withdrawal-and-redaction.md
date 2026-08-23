# 02 — Düzeltme, geri çekme ve güvenlik redaksiyonu

**What to build:** Ham rapor ve bildirilen sonuç geriye dönük düzenlenmez. Kurucu önceki kayda bağlı, gerekçeli `Correction` veya `Withdrawal` olayı ekler; güncel görünüm düzeltmeyi öne çıkarır, özgün bildirim ve zincir denetim geçmişinde kalır. Güvenlik redaksiyonu hassas değeri içeriksiz işaret, zaman, gerekçe ve aktörle değiştirir; redakte kanıt güncel değerlendirme veya dışa aktarmada kullanılamaz. Bu, kayıt Çöp Kutusu veya hesap kapatma redaksiyonu UI'si değildir. Sonradan gelen düzeltme, geri çekme, redaksiyon veya yeni ilişki mevcut inceleme durumunu sessizce geri almaz; `New context after close` sinyali üretir.

**Blocked by:** 01 — Oturum ve madde incelemesinin bağımsız yaşamı

**Status:** ready-for-agent

- [ ] `Correction` ve `Withdrawal` özgün kayda bağlı yeni olaydır; ham sonucu yerinde silmez veya yeniden yazmaz.
- [ ] Güncel görünüm düzeltmeyi öne çıkarır; kurucu nedenin ve zincirin okunabilir kaydını görür.
- [ ] Güvenlik redaksiyonu içerik yerine işaret, zaman, gerekçe ve aktör gösterir; redakte kanıt export/değerlendirme için kullanılamaz.
- [ ] Redaksiyon Çöp Kutusu, hesap kapatma teyit kartı veya in-place rewrite değildir; teyit grant'i 01/78 tüketicisindedir, bu ticket yalnız test tarihçesi sunumunu bağlar. Tek hatalı Oturum Testi Çöp'e alınmaz; `Correction` veya `Withdrawal` kullanılır.
- [ ] Yeni olay mevcut inceleme durumunu sessizce geri almaz; kapanmış oturumda `New context after close` görünür.
- [ ] Kabul kanıtı aynı Test Review seam'inde: düzeltme zinciri, geri çekme, redaksiyon işareti, inceleme durumunun korunması. [Test geçmişi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) tarihsel bütünlük paketidir.
