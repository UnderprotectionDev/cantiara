# Güvenlik Redaksiyonu

Kurucu hassas değeri güncel içerikten, kayıt geçmişinden, Dış yüzey snapshot'ından, arama indeksinden, dışa aktarma hazırlığından ve cache'den geri döndürülemez kaldırır. Olağan geri yükleme redakte edilmiş içeriği diriltmez.

Redaksiyon kaydın kimliğini durdurmak zorunda değildir; değeri siler. İçeriksiz işaret özgün olay türü, zaman ve aktörü koruyabilir; ad, e-posta, özgün mesaj veya secret yazılmaz. Dış yüzey redaksiyonu yayın erişimini yeniden açamaz.

Kurucu etkiyi önizler. Hesap Erişimi feature'ının GitHub kimliğini yeniden teyit etme sonucu ve hedef adı yazılmadan redaksiyon başlamaz. Aynı kural kişisel veri silme ve erken kalıcı silmede de kullanılır; ayrı bir teyit feature'ı açılmaz.

Bu feature güvenlik redaksiyonunu tamamlar. Çöp Kutusu, hesap kapatma, kişisel veri hakkı ve istemci gizleme ayrıdır.

## Tamamlanma Ölçütleri

- Hassas değer güncel içerik, geçmiş, dış yüzey, arama ve dışa aktarmadan geri döndürülemez kalkar.
- Olağan geri yükleme redakte edilmiş içeriği diriltmez.
- İşlem GitHub kimliği yeniden teyidi ve hedef adı yazılmadan başlamaz.

## Kapsam Sınırları

- Redaksiyonu istemci gizleme veya geçmiş satırını olağan düzenlemeyle silme sayma.
- Redaksiyonu Çöp Kutusu, Arşiv veya kayıt kimliğini durdurma sayma.
- GitHub teyidini ayrı teslim kartı yapmak.
- Teyit ve redaksiyon sözleşmesini kişisel veri veya hesap kapatma kartlarına kopyalama.
