# Test İnceleme ve Takip

Kurucu Test Oturumu ile tekil testlerin inceleme durumunu bağımsız yönetir. Düzeltme, geri çekme, çelişki ve bağlam değişikliği geçmiş gerçeği yeniden yazmaz. İlişkili senaryo, Handoff, sonuç, açık ve değerlendirme ana kaynaklarına açılan nötr özet okunur.

İnceleme, bildirilen sonucun üzerine yeni olay ekler. Sistem başarısızlıktan otomatik açık üretmez. Özet coverage, kalite puanı veya yayın kapısı üretmez. Testler alanı yeni test gerçeği üretmez; mevcut kayıtları yönetir ve faz değildir.

Bu feature test incelemesini ve özeti tamamlar. Test Açığı, Test değerlendirmesi ve rapor kabulü ayrıdır.

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

Kurucu hangi oturumların çeliştiğini görür ve takip notunu yazar.

Çelişki otomatik Test Açığı üretmez. Açık kayıt kullanıcı işidir.

### Özellik ve Proje Sürümü test özeti

Senaryo, Handoff, sonuç, açık ve değerlendirme kaynaklarına açılan nötr özet oluşur. Özet coverage, kalite puanı veya yayın kapısı üretmez.

Özellik veya Proje Sürümü bağlamında test manzarası tek yerden okunur. Sayılar kayda açılır; hükmü sistem vermez.

Özet, Sürüm Kanıt Paketinin yerine geçmez. Kaynaksız sayı gösterilmez.

## Tamamlanma Ölçütleri

- Oturum ve tekil test incelemesi birbirinden bağımsız tamamlanır.
- Yeni olay geçmiş sonucu silmeden düzeltmeyi veya güvenlik redaksiyonunu açıklar.
- Çelişen veya bağlamı değişen sonuç kullanıcı değerlendirmesine taşınır.
- Senaryo, Handoff, sonuç, açık ve değerlendirme kaynaklarına açılan nötr özet oluşur.

## Kapsam Sınırları

- İncelemeyi raporu silip yeniden yazma sayma.
- Çelişkiyi sessizce son yazan kazanır kuralıyla kapatma.
- Test Açığını veya Test değerlendirmesini bu kartın alt işi sayma.
- Testler alanını ana faz veya CI panosu yapmak.
- Özeti Sürüm Kanıt Paketinin yerine koyma.
