# Proje Hikâyesi ve Etkinlik Geçmişi

Kurucu önemli ürün olaylarını kronolojik hikâye, atomik alan değişikliklerini ise filtrelenebilir etkinlik görünümü olarak ayrı amaçlarla inceler.

Hikâye ile denetim izi karışmaz. Karar ve sürüm anlatısı, alan diff'inden ayrı okunur.

Bu feature proje hikâyesi ve etkinlik geçmişini tamamlar. Kayıt değişiklik geçmişi ortak bütünlükte, sürüm iletişimi ayrı feature'dadır.

## Alt Fazlar

### Gerçekleşen olaylar zaman çizelgesi

Gerçekleşen olaylar zaman çizelgesi karar, tasarım, İş, sürüm ve öğrenim gibi önemli olayları ürün hikâyesi olarak dizer.

Kurucu neden-sonuç anlatısını okur. Çizelge her alan değişikliğini göstermez.

Hikâye kapanış özeti veya herkese açık gelişim akışı değildir. İç ürün anlatısıdır.

### Proje Etkinliği

Proje Etkinliği alan, durum, ilişki, otomasyon ve GitHub değişikliklerini kaynak ve önceki–sonraki değerle listeler.

Kurucu kim, ne, eski değer, yeni değer okur. Filtre denetim izini hikâyeye çevirmez.

Etkinlik Bildirim Merkezi değildir. Kayıt olayıdır; dikkat sinyali üretmek ayrı registry'ye aittir.

## Tamamlanma Ölçütleri

- Karar, tasarım, İş, sürüm ve öğrenim gibi önemli olaylar ürün hikâyesi olarak görünür.
- Alan, durum, ilişki, otomasyon ve GitHub değişiklikleri kaynak ve önceki–sonraki değerle incelenir.

## Kapsam Sınırları

- Hikâye ile atomik etkinliği tek feed sayma.
- Etkinliği GitHub Activity veya e-posta günlüğü yapmak.
- Hikâyeyi otomatik başarı anlatısı veya sürüm notu sayma.
