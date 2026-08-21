# Operasyonel Yedek ve Güvenli Kurtarma

Sistem tanımlı veri kaybı ve kurtarma bütçesi içinde yedekten döner. Güvenlik olayları ayrı güven alanından replay edilmeden dış erişim açılmaz.

Felakette veri bütçe içinde döner. Eski yedek iptal ve redaksiyonu geri getirmez; dış kapı fail-closed kalır.

Bu feature operasyonel yedek ve güvenli kurtarmayı tamamlar. Çalışma alanı çıkış paketi, hesap kapatma ve AB yerleşimi ayrı vaatlerdir.

## Alt Fazlar

### Yedek ve kurtarma

Yedek ve kurtarma veri ile nesne bütünlüğünü tanımlı RPO ve RTO kabul sınırında geri kazanır. Bölge sözleşmesi korunur.

Kurtarma uygulama içi tıklama değildir. Operasyonel prosedürdür; kullanıcıya self-serve vaat yoktur.

Bu alt faz seçili dışa aktarma veya hesap kapatma penceresi değildir.

### Güvenlik olayı replay'i

Güvenlik olayı replay'i iptal, redaksiyon ve anahtar olaylarını ayrı güven alanından uygular. Eski yedek kapanmış paylaşımı diriltmez.

Dış erişim replay tamamlanmadan açılmaz. Fail-closed kapı korunur.

Replay, değişiklik geçmişi geri alma veya test düzeltme olayı değildir. Güvenlik zaman çizgisidir.

## Tamamlanma Ölçütleri

- Veri ve nesne bütünlüğü tanımlı kayıp ve kurtarma bütçesinde geri kazanılır.
- İptal, redaksiyon ve anahtar olayları eski yedeğin erişimi diriltmesini engeller.

## Kapsam Sınırları

- Kullanıcıya self-serve restore vaadi.
- Yedeği çıkış paketi veya içe aktarma sayma.
- Güvenlik olaylarını replay etmeden dış erişimi açma.
