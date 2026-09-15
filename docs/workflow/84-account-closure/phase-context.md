# Hesap Kapatma

Kurucu GitHub kimliğini yeniden teyit etmeyi Hesap Erişimi feature'ından kullanır, Çalışma Alanı çıkış paketini alır ve Hesabı geri dönüş penceresi sonunda kalıcı olarak kapatır. Kalıcı silmeye kadar üretim ve özel içerik Avrupa Birliği veri bölgesi sözleşmesinde kalır; çıkış paketi yerleşimi taşımaz.

Ayrılık geri dönülmez olmadan önce durur. Pencere yazmayı ve dış erişimi kapatır; süre sonunda güvenlik redaksiyonu feature'ının sözleşmesi ve silme uygulanır. Kalıcı silme en az bir başarılı çıkış paketinden önce olmaz.

Bu feature hesap kapatmayı tamamlar. Proje silme grubu, oturum iptali, GitHub kimliğini yeniden teyit etme ve operasyonel yedek hesap silme değildir.

## Alt Fazlar

### Hesap kapatma penceresi

Hesap kapatma penceresi yazmaları ve dış erişimi kapatır. Kullanıcı tanımlı süre içinde işlemi iptal edebilir. Başlatma ve iptal, Hesap Erişimi feature'ının GitHub kimliğini yeniden teyit etme sonucunu kullanır.

Kurucu çıkış paketini bu pencerede alır. Paket restore vaadi taşımaz ama elde kalır. Kalıcı silme başarılı paket olmadan ilerlemez.

Pencere Proje arşivi değildir. Bütün Hesap ve Çalışma Alanı sınırıdır.

### Kalıcı silme

Kalıcı silme süre sonunda Hesap verisini güvenlik redaksiyonu ve silme sözleşmesiyle kaldırır. Geri dönüş yoktur.

Dış yüzeyler ve oturumlar kapanmış kalır. Yedekte kalan kopyalar güvenlik replay kurallarına bağlıdır.

Bu alt faz tek Proje silme grubu değildir. Hesap sonudur.

## Tamamlanma Ölçütleri

- Kapatma penceresi Hesap Erişimi teyidini kullanır; yazmalar ve dış erişim kapanır; kullanıcı tanımlı süre içinde iptal edilebilir.
- Süre sonunda Hesap verisi güvenlik redaksiyonu ve silme sözleşmesiyle kaldırılır.
- Kalıcı silme en az bir başarılı çıkış paketinden önce olmaz.
- Kalıcı silmeye kadar üretim ve özel içerik AB veri bölgesi sözleşmesinde kalır; çıkış paketi yerleşimi taşımaz.

## Kapsam Sınırları

- Kapatmayı Proje silme veya oturum iptali sayma.
- Çıkış paketi olmadan kalıcı silmeye izin verme.
- Pencere bitmeden veriyi geri dönülmez silme.
- GitHub teyidini bu kartın feature'ı sayma.
