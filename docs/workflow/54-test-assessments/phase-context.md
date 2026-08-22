# Test Değerlendirmesi

Kurucu seçili Özellik, Handoff veya Proje Sürümü bağlamı için tarihli kabul edilebilir, takip gerekli veya karar verilmedi snapshot'ı kaydeder. Yeni bağlam eski hükmü güncel gerçek gibi göstermez.

Değerlendirme yayın kapısı, kalite skoru veya Test Oturumu sonucu değildir. Kullanıcı değerlendirme olmadan Sürüm yayımlayabilir. Eski snapshot yeni sürüme otomatik taşınmaz.

Bu feature Test değerlendirmesini tamamlar. Test Açığı, inceleme ve Sürüm Kanıt Paketi ayrıdır.

## Tamamlanma Ölçütleri

- Seçili test bağlamı için tarihli snapshot kaydedilir.
- Yeni bağlam eski hükmü sessizce güncellemez; kaynaklar görünür kalır.
- Değerlendirme coverage, skor veya otomatik kapı üretmez.

## Kapsam Sınırları

- Değerlendirmeyi yayın kapısı veya kalite skoru sayma.
- Eski snapshot'ı yeni sürüme otomatik taşıma.
- Değerlendirmeyi Test Oturumu sonucu sayma.
