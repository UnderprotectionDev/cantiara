# Kişisel Veri Dışa Aktarma ve Silme

Kurucu bir Contact için kişisel veriyi okunabilir pakette toplar ve geri döndürülemez silmeyi yüksek risk teyidiyle redakte eder. Paket Çalışma Alanı çıkış paketi değildir.

`Kişisel veriyi sil` etkiyi önizler. Geri döndürülemez redaksiyon GitHub kimliğini yeniden teyit etme kuralını ve Hesap adını yazan onayı kullanır; ayrı bir teyit feature'ı açılmaz. Ad, e-posta ve özgün mesaj kalkar; içeriksiz tombstone kalabilir. Aktif paylaşım veya yayındaki değer aynı işlemde kaldırılır.

Bu feature tek kişinin kişisel veri hakkıdır. Geri Bildirim, Contact kimliği, hesap kapatma ve seçili kayıt dışa aktarma ayrıdır.

## Tamamlanma Ölçütleri

- Contact kişisel verisi okunabilir pakette dışa aktarılır.
- Silme yüksek risk teyidiyle redakte eder ve paylaşım değerini kaldırır.
- Paket çıkış paketi veya ürün içi restore değildir.

## Kapsam Sınırları

- Kişisel veri silmeyi hesap kapatma veya Çöp Kutusu sayma.
- GitHub teyidini ayrı teslim kartı yapmak.
- Çalışma Alanı çıkış paketini kişi paketi sayma.
