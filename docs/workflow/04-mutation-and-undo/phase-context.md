# Yazma Sözleşmesi ve Güvenli Geri Alma

Kurucunun başlattığı her durum değiştiren komut taban revizyonu ve istemci idempotency anahtarıyla kesinleşir. Çok adımlı yazma ya tam commit ya tam rollback makbuzu üretir. Güvenli geri alma ilgisiz sonraki değişikliği silmez.

Yazma kaybolmaz ve sessizce ezilmez. Aynı anahtar aynı sonucu döndürür; farklı payload çatışmadır. Webhook, import ve otomasyon insan istemcisi gibi sahte taban uydurmaz.

Bu feature yazma sözleşmesini ve güvenli geri almayı tamamlar. Çöp Kutusu, güvenlik redaksiyonu ve hesap kapatma ayrıdır.

## Alt Fazlar

### İstemci yazma sözleşmesi

Kullanıcının başlattığı komut hedefin taban revizyonunu ve istemci idempotency anahtarını taşır. Güncel olmayan taban sessizce son yazan kazanır davranışıyla üzerine yazmaz.

Kurucu çatışmayı görür. Kayıt türünün uzlaştırma akışı yoksa yazma reddedilir ve güncel değer gösterilir.

Bu alt faz otomasyon kuralı veya GitHub webhook'u değildir. İnsan komutunun sözleşmesidir.

### Atomik kesinleştirme

Çok adımlı yazma hazırlama alanından tek commit bariyerinde kesinleşir. Sonuç yalnız tam commit veya tam rollback makbuzudur.

Retry aynı işlem sonucunu bulur. Değişmiş payload açık çatışmadır. Bariyerden sonra sahte İptal yerine Sonlandırılıyor görünür.

Bu alt faz kısmi kayıt bırakma veya arka planda sessiz yazma değildir.

### Güvenli geri alma

Güvenli geri alma yalnız tersi deterministik hesaplanan alan, ilişki, görünüm üstverisi ve atomik dönüşümlerde çalışır. İlgisiz sonraki değişikliği geri sarmaz; aynı alandaki daha yeni değerle çatışınca durur.

Kalıcı silme, güvenlik redaksiyonu, dış sistem mutasyonu ve yayınlanmış statik export güvenli otomatik geri alma değildir.

Birleştirmeyi geri alma özgün kimliği ayırır; birleştirmeden sonraki ilgisiz yazmaları silmez.

## Tamamlanma Ölçütleri

- İnsan komutları taban revizyonu ve idempotency anahtarıyla tekrar ve kayıp yazmayı önler.
- Çok adımlı yazma tam commit veya tam rollback makbuzu üretir.
- Güvenli geri alma ilgisiz sonraki değişikliği silmez; çatışmayı açıklar.

## Kapsam Sınırları

- Sessiz son yazan kazanır yazması.
- Kısmi kayıt veya belirsiz commit durumu bırakma.
- Güvenlik redaksiyonunu veya dış sistemi otomatik geri alma.
- Genel undo yığınını her eyleme yayma.
