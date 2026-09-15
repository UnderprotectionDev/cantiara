# Güvenlik olay günlüğünü ve üst anahtarı ayrı güven alanında tut

## Bağlam

[Operasyonel yedek ve kurtarma](../prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma) ile [ADR-0003](0003-restore-guvenlik-olay-gunlugu.md), geri döndürülemez güvenlik olaylarının normal veritabanı ve nesne restore alanının dışında korunmasını ve restore sonrasında yeniden uygulanmasını zorunlu kılar. [Teknoloji yığını](../tech-stack.md) bu ayrılığın yeni bir veri teknolojisi seçmeden korunmasını ister fakat günlüğün hangi çalışma biriminde yaşadığını söylemez. Aynı biçimde dinamik entegrasyon token'larının envelope encryption üst anahtarının Railway sealed runtime secret'tan geldiği yazılıdır, sürüm şeması ve rotasyon yolu yazılı değildir.

Bu iki boşluk [ürün kapsamı belgesinin](../prd/01-product-vision-and-scope.md#kapsam-dili) "güvenlik, veri bütünlüğü, kimlik, kapsam, yaşam döngüsü veya ürün kabulünü etkileyen açık karar ilk ürün belgelerinde bırakılmaz" hükmüne girer ve restore kanıtı üretilmeden önce kapatılmalıdır.

## Karar

Güvenlik olay günlüğü, birincil ürün verisinden ayrı bir yönetilen PostgreSQL projesinde, kendi kimlik bilgileriyle erişilen append-only tabloda yaşar. Ayrılık yapılandırma bayrağına değil hesap ve kimlik bilgisi sınırına dayanır; birincil veritabanının restore edilmesi bu birimi geri almaz. Yeni bir veri teknolojisi eklenmez ve günlük [ADR-0009](0009-ab-veri-siniri.md) gereği aynı Avrupa Birliği bölgesinde kalır.

Envelope encryption üst anahtarı tek yönlü artan sürüm numarası taşır. Her ciphertext kendi anahtar sürümünü yanında saklar; rotasyon yeni sürüm ekler, eski sürümü çözme yeteneğini geriye dönük olarak kaldırmaz ve mevcut ciphertext'leri yerinde yeniden yazmaya zorlamaz. Üretim, entegrasyon, yedek ve export alanlarının ayrı veri anahtarları bu sürüm şemasını paylaşır.

## Sonuçlar

- Restore replay yükümlülüğü tek bir yapılandırma hatasına değil, ayrı bir erişim sınırına dayanır.
- İkinci veritabanı projesi ek işletim, izleme ve maliyet yükü getirir.
- Anahtar sürümünün ciphertext ile taşınması kayıt boyutunu bir miktar büyütür ve rotasyonu kesintisiz kılar.
- Sürüm şeması yazılı olduğu için rotasyon, ayrı bir ürün karar kapısı açmadan normal işletim adımı olur.

## İlgili belgeler

- [Operasyonel yedek ve kurtarma](../prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma)
- [Restore güvenlik olay günlüğü](0003-restore-guvenlik-olay-gunlugu.md)
- [AB veri sınırı](0009-ab-veri-siniri.md)
- [Teknoloji yığını](../tech-stack.md)
