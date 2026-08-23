# 01 — Desteklenen kaydı Çöp Kutusuna alma ve 30 günlük kimlik

**What to build:** Kurucu desteklenen ana kaydı `Move to Trash` ile `Trash`'e alır. Kayıt iç kimliğini ve sahiplik kapsamını korur; aktif otomasyon, Akıllı Koleksiyon veya adlandırılmış görünüm üyeliği üretmez. Süre 30 gündür. `Trash` listesi bu kayıtları gösterir. Süre sonu kalıcı silme 03'te, Dış yüzey önizlemesi 02'de, erken teyit 05'tedir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Desteklenen ana kayıt `Move to Trash` ile `Trash`'e girer; iç kimlik ve sahiplik kapsamı değişmez. Sahipli bileşenler kaynakla birlikte girer; ilişkili bağımsız kayıt onaysız silinmez.
- [ ] Test Oturumu ve Oturum Testi çocukları tek tarihsel bütün olarak taşınır; çocuk tek başına Çöp'e alınamaz. Bağımsız Dosya Eki veya takip İşi otomatik silinmez.
- [ ] Çöpteki kayıt aktif kural, Akıllı Koleksiyon veya adlandırılmış görünüm üyeliği üretmez; yaşayan arama/sayı/export onu `Trash` yüzeyi dışında yaşayan kayıt saymaz.
- [ ] Geri alınabilir süre 30 gündür; süre birimi Hesap/işletim takvimi değil ürün saatidir.
- [ ] İngilizce UI `Trash` ve `Move to Trash` kullanır; eksik etiketler PRD terim sözlüğüne aynı değişiklikle eklenir. Locale/tercih yüzeyi açılmaz.
- [ ] Yazma taban revizyonu ve idempotency anahtarıyla kesinleşir; aynı anahtar aynı sonucu döndürür (04 sözleşmesi, burada yeniden tanımlanmaz).
- [ ] Kabul kanıtı Trash seam'inde: taşıma, kimlik korunumu, üyelik yokluğu, 30 gün saati. Kanıt [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun kayıt-Trash dilimidir. Arşiv komutu bu ticket'ta yoktur.
