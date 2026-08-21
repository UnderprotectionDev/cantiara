# GitHub Bağlantısı ve Geliştirme Gerçeği

Kurucu Projeyi GitHub App üzerinden seçili Repositorylerle bağlar. Issue, pull request, commit ve check gerçeğini salt okunur ve uzlaştırılabilir biçimde İşlerle ilişkilendirir.

Geliştirme gerçeği Cantiara'ya akar ama İş yaşamını örtük yazmaz. Webhook, durable inbox ve periyodik uzlaştırma aynı dış gerçeği çoğaltmaz.

Bu feature GitHub bağlantısı ve geliştirme gerçeğini tamamlar. PR Bağlam Kartı, otomasyon ve sürüm kanıtı ayrıdır.

## Alt Fazlar

### Repository bağlantısı

Repository bağlantısı kararlı GitHub kimliği ve girişten ayrı App yetkisiyle Projeye bağlanır. Proje repository'den geniştir.

Kurucu hangi depoların bağlı olduğunu görür. Bağ, Çalışma Alanı veya Hesap kapsamı değildir.

Bağlantı issue'ları İşe çevirmez. Yalnız dış gerçeğin kapısını açar.

### Webhook ve uzlaştırma

Webhook, durable inbox ve periyodik uzlaştırma aynı issue, PR, commit ve check gerçeğini çoğaltmadan günceller.

Kurucu gecikmeyi ve son uzlaştırmayı görür. Kayıp olay sessizce düşmez; inbox dayanıklıdır.

Senkron yazma API'si veya iki yönlü issue klonu değildir. Salt okunur uzlaştırmadır.

### İş ve GitHub bağlantıları

İş ve GitHub bağlantıları açık seçim veya anahtar eşlemesiyle kurulur. Bağ, İş durumunu, kapanışını veya blokajını değiştirmez.

Kurucu hangi PR veya issue'nun bağlı olduğunu görür. Anahtar çakışması gizli ikinci İş üretmez.

Bağ, Kanıt bağı veya kullanım gömüsü değildir. Geliştirme referansıdır.

### PR check özeti

PR check özeti pull request head SHA'sındaki check gerçeğini Test Oturumuna dönüşmeden gösterir.

Kurucu dış kontrolün ne dediğini okur. Check kabul, inceleme veya senaryo sonucu değildir.

Özet CI orkestrasyonu veya MCP rapor kabulü değildir. Salt okunur dış gerçektir.

## Tamamlanma Ölçütleri

- Seçilen Repository kararlı GitHub kimliği ve ayrı App yetkisiyle Projeye bağlanır.
- Webhook, durable inbox ve periyodik uzlaştırma aynı dış gerçeği çoğaltmadan günceller.
- Açık veya anahtar tabanlı bağlantı kaynak kaydın yaşam durumunu değiştirmez; check Test Oturumuna dönüşmez.

## Kapsam Sınırları

- GitHub'ı ikinci İş sistemi veya durum makinesi sayma.
- Giriş oturumundaki kimliği App yetkisi sayma.
- Check özetini Test Oturumu veya yayın kapısı yapmak.
