# Test İnceleme ve Tarihsel Bütünlük

Kurucu Test Oturumu ile tekil testlerin inceleme durumunu bağımsız yönetir. Düzeltme, geri çekme, çelişki ve bağlam değişikliği geçmiş gerçeği yeniden yazmaz.

İnceleme, bildirilen sonucun üzerine yeni olay ekler. Hata açıklaması veya güvenlik redaksiyonu eski satırı silmez; çelişki kullanıcı değerlendirmesine düşer.

Bu feature test inceleme ve tarihsel bütünlüğü tamamlar. Rapor kabulü, test açığı ve değerlendirme ayrı kalır.

## Alt Fazlar

### İnceleme yaşam döngüsü

Oturum incelemesi ile tekil test incelemesi bağımsız tamamlanır. Biri diğerini örtük bitirmez.

Kurucu maddeyi kabul veya reddeder. Bu, yeni test koşusu değildir; tarihsel sonuç üzerindeki hükümdür.

İnceleme yayın kapısı veya Proje Sürümü sonucu değildir.

### Düzeltme ve geri çekme

Düzeltme ve geri çekme yeni olay ekler. Geçmiş sonuç silinmez; hata veya güvenlik redaksiyonu açıklanır.

Kurucu neden düzeltildiğini okur. Redaksiyon içerik sızdırmaz ama iz bırakır.

Bu alt faz kayıt Çöp Kutusu veya hesap kapatma redaksiyonu değildir. Test tarihçesidir.

### Çelişki ve takip

Çelişen veya bağlamı değişen test sonucu kullanıcı değerlendirmesine taşınır. Sistem kazanan seçmez.

Kurucu hangi oturumların çeliştiğini görür ve takip notunu yazar. Değerlendirme ayrı feature'da snapshot olabilir.

Çelişki otomatik Test Açığı üretmez. Açık kayıt kullanıcı işidir.

## Tamamlanma Ölçütleri

- Oturum ve tekil test incelemesi birbirinden bağımsız tamamlanır.
- Yeni olay geçmiş sonucu silmeden düzeltmeyi veya güvenlik redaksiyonunu açıklar.
- Çelişen veya bağlamı değişen sonuç kullanıcı değerlendirmesine taşınır.

## Kapsam Sınırları

- İncelemeyi raporu silip yeniden yazma sayma.
- Oturum incelemesini bütün maddelere otomatik yayma.
- Çelişkiyi sessizce son yazan kazanır kuralıyla kapatma.
