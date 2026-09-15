# 03 — Temel başarı geri bildirimi, Reduce Motion ve bütçe

**What to build:** Her kullanıcı başlatmalı İş başarısı `Work completed` bildirimini 10 saniye gösterir; `Reopen` normal yeniden açma onayını başlatır. Efekt kapalı veya bastırılmış olsa da bu geri bildirim kalır ve Bildirim Merkezi kaydı üretmez. Reduce Motion efekti ve hareketli önizlemeyi koşulsuz bastırır; durağan son kare ve nazik ekran okuyucu duyurusu kalır. Katman en fazla 1,2 saniye, odak/girdi çalmaz; çizim bütçesi tutulamazsa dekorasyon düşer, bildirim aynı hızda kalır.

**Blocked by:** 01 — Hesap tema ve palet seçimi; 02 — Kullanıcı başlatmalı Tamamlandı tetikleyicisi

**Status:** ready-for-agent

- [ ] `Work completed` 10 sn görünür; `Reopen` sessiz geri alma değil açık yeniden açma onayıdır.
- [ ] Efekt kapalı/bastırılmış bildirimini kaldırmaz; Birleşik Bildirim Merkezi'ne sinyal yazmaz.
- [ ] OS/tarayıcı Reduce Motion uygulama tercihini ezer; hareketli önizleme durağan son kare + kısa açıklama olur.
- [ ] Ses, haptik, strobe ve flaş eşiğini aşan yanıp sönme yoktur.
- [ ] Katman ≤ 1,2 sn; odak değiştirmez, girdiyi yakalamaz, kaydırma/navigasyonu engellemez; yüzey değişince temizlenir. Web ve Tauri aynı görünür sonuçtur.
- [ ] Tek kayıt mutasyonu, görünür durum ve sonraki girdi gecikmez; bütçe tutulamazsa yalnız dekorasyon düşer ([performans bütçesi](../../../prd/15-product-quality.md#performans-butcesi)).
- [ ] Açık/koyu ve yüzde 200 ölçekte bildirim efekt katmanından bağımsız okunur.
- [ ] Ayrı durdurma kontrolü yoktur; kurucu Hesap ayarından kapatır.
- [ ] Kabul kanıtı Completion Effects seam'inde: 1,2/10 sn zamanlama, Reduce Motion, flaş/odak/girdi, düşük performans fallback, görünüm/ölçek. Kanıt [Bitiriş efekti](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) kalite paketidir.
