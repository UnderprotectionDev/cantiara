# Test İnceleme ve Takip

Kurucu Test Oturumu ile tekil testlerin inceleme durumunu bağımsız yönetir. Düzeltme, geri çekme, çelişki ve bağlam değişikliği geçmiş gerçeği yeniden yazmaz. Test edilmemiş veya yetersiz doğrulanmış alan açıkça kaydedilir; seçili test bağlamı için tarihli değerlendirme snapshot'ı durur. İlişkili senaryo, Handoff, sonuç, açık ve değerlendirme ana kaynaklarına açılan nötr özet okunur. Senaryo, Handoff, Test Oturumu, Oturum Testi, Test Açığı ve değerlendirme aynı yönetim bağlamında canlı bölümlerde görünür.

İnceleme, bildirilen sonucun üzerine yeni olay ekler. Hata açıklaması veya güvenlik redaksiyonu eski satırı silmez; çelişki kullanıcı değerlendirmesine düşer. Sistem başarısızlıktan otomatik açık üretmez. Yeni bağlam eski hükmü güncel gerçek gibi göstermez. Özet coverage, kalite puanı veya yayın kapısı üretmez. Proje Testleri alanı yeni test gerçeği üretmez; mevcut kayıtları yönetir.

Bu yolculuk test incelemesini, açığı, değerlendirmeyi, özeti ve test yönetim yüzeyini tamamlar. Rapor kabulü ayrı kalır.

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

Kurucu hangi oturumların çeliştiğini görür ve takip notunu yazar. Değerlendirme aynı yolculukta tarihli snapshot olabilir.

Çelişki otomatik Test Açığı üretmez. Açık kayıt kullanıcı işidir.

### Test açıkları

Test edilmemiş veya yetersiz doğrulanmış alan açıkça kaydedilir. Kapanış seçili Oturum Testleriyle manuel olur; başarısızlıktan otomatik açık doğmaz.

Açığı Risk, Bug veya Ürün Boşluğu sayma. Açığı coverage yüzdesine indirme.

Boşluk görünür kalır. Başarısız test, açık uydurmaz.

### Test değerlendirmeleri

Seçili test bağlamı için tarihli kabul edilebilir, takip gerekli veya karar verilmedi snapshotı kaydedilir. Yeni bağlam eski hükmü güncel gerçek gibi göstermez.

Değerlendirme yayın kapısı veya kalite skoru değildir. Eski snapshot yeni sürüme otomatik taşınmaz.

Değerlendirme Test Oturumu sonucu sayılmaz.

### Özellik ve Proje Sürümü test özeti

Senaryo, Handoff, sonuç, açık ve değerlendirme kaynaklarına açılan nötr özet oluşur. Özet coverage, kalite puanı veya yayın kapısı üretmez.

Özellik veya Proje Sürümü bağlamında test manzarası tek yerden okunur. Sayılar kayda açılır; hükmü sistem vermez.

Özet, Sürüm Kanıt Paketinin yerine geçmez. Kaynaksız sayı gösterilmez.

### Proje Testleri alanı

Senaryo, Handoff, oturum, madde, açık ve değerlendirme aynı yönetim bağlamında canlı bölümlerde görünür. Sayılar kesin kayıt kümelerine açılır; ikinci test gerçeği oluşmaz.

Alan ayrı test ürünü veya CI panosu değildir. Sayılar kaynaksız skor olmaz.

Alan, Test Özeti hükmü sayılmaz. Tür dizini genel gezintidir; bu alan test yönetim bağlamıdır.

## Tamamlanma Ölçütleri

- Oturum ve tekil test incelemesi birbirinden bağımsız tamamlanır.
- Yeni olay geçmiş sonucu silmeden düzeltmeyi veya güvenlik redaksiyonunu açıklar.
- Çelişen veya bağlamı değişen sonuç kullanıcı değerlendirmesine taşınır.
- Test edilmemiş veya yetersiz doğrulanmış alan açıkça kaydedilir.
- Kapanış seçili Oturum Testleriyle manuel olur; başarısızlıktan otomatik açık doğmaz.
- Seçili test bağlamı için tarihli kabul edilebilir, takip gerekli veya karar verilmedi snapshotı kaydedilir.
- Yeni bağlam eski hükmü güncel gerçek gibi göstermez.
- Senaryo, Handoff, sonuç, açık ve değerlendirme kaynaklarına açılan nötr özet oluşur.
- Özet coverage, kalite puanı veya yayın kapısı üretmez.
- Senaryo, Handoff, oturum, madde, açık ve değerlendirme aynı yönetim bağlamında canlı bölümlerde görünür.
- Sayılar kesin kayıt kümelerine açılır; ikinci test gerçeği oluşmaz.

## Kapsam Sınırları

- İncelemeyi raporu silip yeniden yazma sayma.
- Oturum incelemesini bütün maddelere otomatik yayma.
- Çelişkiyi sessizce son yazan kazanır kuralıyla kapatma.
- Başarısız testten otomatik açık üretme.
- Açığı Risk, Bug veya Ürün Boşluğu sayma.
- Açığı coverage yüzdesine indirgeme.
- Değerlendirmeyi yayın kapısı veya kalite skoru sayma.
- Eski snapshot'ı yeni sürüme otomatik taşıma.
- Değerlendirmeyi Test Oturumu sonucu sayma.
- Özeti coverage, skor veya otomatik kapı sayma.
- Özeti Sürüm Kanıt Paketinin yerine koyma.
- Kaynaksız sayı gösterip kayda inilemez kılma.
- Alanı ayrı test ürünü veya CI panosu sayma.
- Sayıları kaynaksız skor yapmak.
- Alanı Test Özeti hükmü sayma.
