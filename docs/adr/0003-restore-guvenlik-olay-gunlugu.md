# Restore sonrasında geri döndürülemez güvenlik olaylarını yeniden uygula

## Bağlam

Eski bir veritabanı ve nesne manifestini geri yüklemek, yedekten sonra yapılmış silme, redaksiyon, erişim iptali veya secret rotasyonunu geri alabilir. Başarılı görünen restore böylece eski erişimi yeniden açabilir.

## Karar

Veritabanı ile kesin nesne manifesti tek mantıksal geri yükleme birimidir. Kalıcı silme, redaksiyon, yüzey/token/parola değişikliği, oturum iptali ve entegrasyon/anahtar rotasyonu normal restore alanının dışında korunan append-only sürümlü güvenlik olay günlüğünden güncel sınıra kadar yeniden uygulanır; yeni bir geri döndürülemez eylem restore kuralı ve testi olmadan yayımlanamaz. Günlük secret veya kullanıcı içeriği taşımaz. Hesap silme tombstone'u geri döndürülemez takma kimlikle en uzun backup/restore penceresi artı 30 gün tutulur, ardından fiziksel silinir.

## Sonuçlar

- Bütünlük ve replay tamamlanana kadar dış erişim kapalı kalır.
- Güvenlik olay günlüğü normal veritabanı yedeğinden bağımsız korunur.
- Yeni güvenlik eylemleri restore tasarımına ek bakım yükü getirir.

## İlgili belgeler

- [Operasyonel yedek ve kurtarma](../prd/03-account-platform-operations.md#operasyonel-yedek-ve-kurtarma)
