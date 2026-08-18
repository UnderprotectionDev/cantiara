# Felaket veri kaybı bütçesini beş dakika hedefle

## Bağlam

Yalnız günlük yedek bir sağlayıcı felaketinde bir iş gününe kadar tek doğruluk kaynağı verisini kaybettirebilir. Daha sık değişiklik yakalama ise maliyet, saklama ve kurtarma tatbikatı yükünü artırır.

## Karar

İlk sürüm operasyonel kurtarma hedefi `RPO ≤ 5 dakika` ve `RTO ≤ 8 saat`tir. Veritabanı ile nesne manifesti aynı mantıksal kurtarma noktasında doğrulanır; sağlayıcı, saklama topolojisi ve tatbikat ayrıntıları normal mühendislik uygulaması içinde kesinleşir. Bu ayrıntılar ayrı bir ürün karar kapısı oluşturmaz, ancak doğrulanmış restore kanıtı ürünün tamamlanma koşuludur.

## Sonuçlar

- Günlük yedekle sınırlı 24 saatlik veri kaybı kabul edilmez.
- Sürekli veya sık değişiklik yakalama ve düzenli restore kanıtı gerekir.
- Altyapı maliyeti kesin sağlayıcı kararı verilene kadar açık kalır, fakat kurtarma zorunluluğu kapsamdan çıkmaz.

## İlgili belgeler

- [Operasyonel yedek ve kurtarma](../prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma)
