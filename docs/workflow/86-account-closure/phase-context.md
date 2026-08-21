# Hesap Kapatma

Kurucu yüksek riskli işlemi aynı GitHub kimliğiyle yeniden teyit eder, Çalışma Alanı çıkış paketini alır ve Hesabı geri dönüş penceresi sonunda kalıcı olarak kapatır.

Ayrılık geri dönülmez olmadan önce durur. Pencere yazmayı ve dış erişimi kapatır; süre sonunda güvenlik redaksiyonu ve silme sözleşmesi uygulanır.

Bu feature hesap kapatmayı tamamlar. Proje silme grubu, oturum iptali ve operasyonel yedek hesap silme değildir.

## Alt Fazlar

### GitHub kimliğini yeniden teyit etme

GitHub kimliğini yeniden teyit etme, aynı değişmez kimliğe kısa ömürlü yüksek risk yetkisi verir. Başka sağlayıcı veya eski oturum yetmez.

Kurucu kapatma ve benzeri tehlikeli işlemi bu yetkiyle başlatır. Yetki süre sonunda düşer.

Teyit repository App yetkisi veya ziyaretçi parolası değildir. Hesap kimliğinin yeniden kanıtıdır.

### Hesap kapatma penceresi

Hesap kapatma penceresi yazmaları ve dış erişimi kapatır. Kullanıcı tanımlı süre içinde işlemi iptal edebilir.

Kurucu çıkış paketini bu pencerede alır. Paket restore vaadi taşımaz ama elde kalır.

Pencere Proje arşivi değildir. Bütün Hesap ve Çalışma Alanı sınırıdır.

### Kalıcı silme

Kalıcı silme süre sonunda Hesap verisini güvenlik redaksiyonu ve silme sözleşmesiyle kaldırır. Geri dönüş yoktur.

Dış yüzeyler ve oturumlar kapanmış kalır. Yedekte kalan kopyalar güvenlik replay kurallarına bağlıdır.

Bu alt faz tek Proje silme grubu değildir. Hesap sonudur.

## Tamamlanma Ölçütleri

- Aynı değişmez GitHub kimliği kısa ömürlü yüksek risk yetkisi verir.
- Kapatma penceresinde yazmalar ve dış erişim kapanır; kullanıcı tanımlı süre içinde iptal edilebilir.
- Süre sonunda Hesap verisi güvenlik redaksiyonu ve silme sözleşmesiyle kaldırılır.

## Kapsam Sınırları

- Kapatmayı Proje silme veya oturum iptali sayma.
- Çıkış paketi olmadan kalıcı silmeye izin verme.
- Pencere bitmeden veriyi geri dönülmez silme.
