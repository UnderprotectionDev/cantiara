# Proje Arşivi ve Güvenli Silme

Kurucu Projeyi önce salt okunur arşive, sonra tek geri yüklenebilir silme grubuna alır. Dış yüzeyler ve entegrasyonlar güvenli kapanır, geri yükleme örtük yeniden yayınlamaz.

Proje kaybolmaz veya parçalanmaz. Arşivde yalnız erişimi azaltan güvenlik eylemleri kalır; geri yükleme kimlikleri korur ve yayınları açıkça ister.

Bu feature proje arşivi ve güvenli silmeyi tamamlar. Kayıt Çöp Kutusu, hesap kapatma ve çalışma alanı çıkışı ayrıdır.

## Alt Fazlar

### Proje arşivi

Proje arşivi kaydı salt okunur ve hareketsiz yapar. Normal yazma ve devam eden iş durur; yalnız erişimi azaltan güvenlik eylemleri kalır.

Kurucu arşivi etkin listeden ayırır. Arşiv silme değildir; silme yalnız buradan başlar.

Arşiv yeni yayın veya erişim genişletme açmaz.

### Proje silme grubu

Proje silme grubu Projeye kanonik ait ana kayıt, sahipli bileşen ve Dış yüzeyleri tek geri yükleme veya tek kalıcı silme sınırında tutar.

Kurucu parçayı ayrı silmez. Kısmi çocuk silme yoktur.

Bu alt faz kayıt Çöp Kutusu veya hesap kalıcı silme değildir. Proje sınırıdır.

### Proje geri yükleme

Proje geri yükleme kimlikleri korur. Erişim, GitHub bağlantısı ve yayınlar örtük açılmaz; açıkça yeniden etkinleştirilir.

Kurucu neyin kapalı kaldığını görür. Eski public URL sessizce dirilmez.

Geri yükleme başka hedefe taşıma veya kimlik yenileme değildir.

## Tamamlanma Ölçütleri

- Arşivde normal yazmalar ve devam eden işlemler durur; yalnız erişimi azaltan güvenlik eylemleri kalır.
- Projeye ait kayıtlar ve dış yüzeyler tek geri yükleme veya kalıcı silme sınırında yönetilir.
- Geri yükleme kimlikleri korur; erişim, GitHub bağlantısı ve yayınlar açıkça yeniden etkinleştirilir.

## Kapsam Sınırları

- Arşivi Çöp Kutusu, gizleme filtresi veya kalıcı silme sayma.
- Proje kabuğunu silip çocukları bağımsız bırakma.
- Geri yüklemeyle yayınları ve GitHub bağını örtük açma.
