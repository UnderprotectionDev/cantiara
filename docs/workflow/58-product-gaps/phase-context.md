# Ürün Boşlukları ve Dış Araca Kaçışlar

Kurucu karşılanmayan ihtiyacı ve açıkça başlattığı dış araç kaçışını tarihli kanıtla kaydeder. Tekrar sayısı karar veya öncelik üretmeden kesin olay kümesini açar.

Ürünün durduğu yer görünür kalır. Kaçış telemetry değildir; kurucunun bilinçli kaydıdır. Yüksek etkili kaçış, paralel dış doğruluk kaynağı kapanmadan kapanmış sayılmaz.

Bu feature ürün boşlukları ve dış araca kaçışları tamamlar. Dış yürütme devri, GitHub entegrasyonu ve özellik isteği kuyruğu burada yoktur.

## Alt Fazlar

### Ürün Boşluğu yaşam döngüsü

Ürün Boşluğu kurucunun karşılanmayan ihtiyacını Çalışma Alanı kaydında taşır. Durum Açık, Değerlendiriliyor, Karşılandı veya Bilinçli sınırdır.

Kurucu boşluğu kendisi kapatır. Tekrar sayısı durumu değiştirmez.

Boşluk İş değildir. İsterse açık önizlemeyle İşe dönüşebilir; kendiliğinden dönüşmez.

### Dış Araca Kaçış olayı

Dış Araca Kaçış, Cantiara içinde görülen gerçek bir işi başka araçta bitirme olayını kaydeder. Amaç, araç, neden, etki ve kaynak bağlamı tarihli kalır.

Olay dış içeriği kopyalamaz ve dış oturumu izlemez. Yalnız kurucunun açık kaydıdır.

Kaçış GitHub bağlantısı, Test Handoff'ı veya dış yürütme paketi değildir.

### Kaçış kapanış kanıtı

Yüksek etkili kaçış, ürün akışı tamamlanıp paralel dış doğruluk kaynağı kapanmadan kapanmış sayılmaz. Kapanış kanıtı görünürdür.

Kurucu hangi ürün akışının yerine geçtiğini ve dış kaynağın durduğunu kaydeder. Sayısal eşik otomatik kapatmaz.

Bu alt faz hesap kapatma veya Dış yüzey iptali değildir. Kaçış olayının kapanışıdır.

## Tamamlanma Ölçütleri

- Ürün Boşluğu Açık, Değerlendiriliyor, Karşılandı veya Bilinçli sınır sonucuyla yönetilir.
- Dış Araca Kaçış amacı, aracı, nedeni, etkisi ve kaynak bağlamını tarihli olayda korur.
- Yüksek etkili kaçış ancak ürün akışı tamamlanıp paralel dış doğruluk kaynağı kapandığında kapanır.

## Kapsam Sınırları

- Boşluğu özellik isteği, otomatik öncelik veya ticket sayma.
- Kaçışı entegrasyon kullanımı veya otomatik telemetry sayma.
- Tekrar sayısını karar veya sıralama gerçeği yapmak.
