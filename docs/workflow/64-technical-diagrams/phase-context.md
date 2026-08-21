# Teknik Diyagramlar

Kurucu Teknik Mimari, Veri Modeli ve Teknik Sıra Diyagramlarını değişmez otorite kipi, canonical yapısal model, görünüm ve kesin sürümlerle yönetir.

Diyagramın kanonik içeriği kimlik boyunca aynı kipte kalır. Görünüm değişebilir; checkpoint kanıta bağlanabilir ve belgede canlı kart olarak kopyalanmadan kullanılır.

Bu feature teknik diyagramları tamamlar. Mermaid dönüşümü, şema artefaktı ve Wireframe ayrıdır.

## Alt Fazlar

### Diyagram otoritesi

Diyagram otoritesi kanonik içeriğin ürün, import veya dış bağlantı kökenini kimlik boyunca kilitler. Kip sonradan başka köken gibi davranmaz.

Kurucu bu diyagramın nerede doğru olduğunu okur. Görünüm kipi değiştirmek otoriteyi değiştirmez.

Otorite, paylaşım izni veya snapshot onayı değildir. İçerik kökeni sınıflamasıdır.

### Teknik Mimari

Teknik Mimari sistem bileşenleri ve ilişkilerini türlenmiş modelle anlatır. Kutu-çizgi resmi kanonik modelin kendisi değildir.

Kurucu bileşeni ve bağın anlamını düzenler. Model repository dosyasına gizlice yazılmaz; kip neyse odur.

Bu alt faz Kullanıcı Akışı veya altyapı izleme haritası değildir.

### Veri Modeli Diyagramı

Veri Modeli Diyagramı PostgreSQL varlık, alan, anahtar ve ilişkilerini canonical yapısal modelde düzenler.

Kurucu fiziksel semantiği ürün içinde görür. Diyagram canlı veritabanına bağlanmaz.

Model, ORM şeması veya Prisma dosyası senkronu değildir. Ürün içi yapısal kayıttır; DDL ayrı feature'da doğar.

### Teknik Sıra

Teknik Sıra sistemler arası sıralı etkileşimi yapısal olarak modeller. Adımlar ve katılımcılar kanoniktir.

Kurucu sırayı sürümler. Bu, Kullanıcı Akışı veya İş durumu geçişi değildir.

Sıra, log izleme veya runtime trace değildir. Tasarım modelidir.

### Görünüm ve Diyagram Sürümü

Sunum görünümü değişebilir; kesin Diyagram Sürümü checkpoint olarak değişmez ve kanıta bağlanabilir kalır.

Kurucu çalışırken görünümü kaydırır. Kanıt ve paylaşım kesin sürüme gider.

Sürüm Git tag veya görüntü export'u değildir. Diyagram kaydının ürün checkpoint'idir.

### Canlı kart ve kompozisyon

Canlı kart, diyagramı Belge ve Proje Duvarında kayıt bağlamını kopyalamadan gösterir. Kart ikinci diyagram değildir.

Kurucu karttan kaynağa döner. Gömü otorite kipini değiştirmez.

Kompozisyon Mermaid gömüsü veya dış görüntü değildir. Kullanım bağıdır.

## Tamamlanma Ölçütleri

- Kanonik içeriğin ürün, import veya dış bağlantı kökeni kimlik boyunca değişmez.
- Mimari, veri modeli ve teknik sıra türlenmiş yapısal modelde yaşar.
- Görünüm değişebilir; kesin checkpoint değişmez ve canlı kart kaynağı kopyalamaz.

## Kapsam Sınırları

- Otorite kipini diyagram türü, dosya biçimi veya paylaşım kipi sayma.
- Görünüm düzenini kanonik modelin yerine koyma.
- Diyagramı Wireframe, Moodboard veya Mermaid bloğu sayma.
