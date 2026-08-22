# GitHub Bağlantısı ve Geliştirme Gerçeği

Kurucu Projeyi GitHub App üzerinden seçili Repositorylerle bağlar. Issue, pull request, commit ve check gerçeğini salt okunur ve uzlaştırılabilir biçimde İşlerle ilişkilendirir. Bir pull request için ilişkili İş, Karar, Risk, test ve Sürüm bağlamı ana kayıtlarına açılan salt okunur kartta durur.

Geliştirme gerçeği Cantiara'ya akar ama İş yaşamını örtük yazmaz. Webhook, durable inbox ve periyodik uzlaştırma aynı dış gerçeği çoğaltmaz. İnceleme ve merge GitHub'da kalır. Kart Cantiara'da inceleme veya birleştirme yapmaz; kaynağa götürür.

Bu yolculuk GitHub bağlantısını, geliştirme gerçeğini ve PR bağlam kartını tamamlar. Otomasyon ve sürüm kanıtı ayrıdır.

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

### PR bağlam kartı

İlişkili İş, Karar, Risk, test ve Sürüm bağlamı salt okunur kartta ana kayıtlarına açılır. İnceleme ve merge GitHub'da kalır; kart yazma yüzeyi olmaz.

Kart GitHub review veya merge aracı değildir. İş Bağlam Kartı veya bağlam içi önizleme sayılmaz.

Eksik bağ otomatik tamamlanıp PR hazır ilan edilmez. GitHub senkronu, test özeti ve sürüm kanıt paketi kartın yerine geçmez.

## Tamamlanma Ölçütleri

- Seçilen Repository kararlı GitHub kimliği ve ayrı App yetkisiyle Projeye bağlanır.
- Webhook, durable inbox ve periyodik uzlaştırma aynı dış gerçeği çoğaltmadan günceller.
- Açık veya anahtar tabanlı bağlantı kaynak kaydın yaşam durumunu değiştirmez; check Test Oturumuna dönüşmez.
- İlişkili İş, Karar, Risk, test ve Sürüm bağlamı salt okunur kartta ana kayıtlarına açılır.
- İnceleme ve merge GitHub'da kalır; kart yazma yüzeyi olmaz.

## Kapsam Sınırları

- GitHub'ı ikinci İş sistemi veya durum makinesi sayma.
- Giriş oturumundaki kimliği App yetkisi sayma.
- Check özetini Test Oturumu veya yayın kapısı yapmak.
- Kartı GitHub review veya merge aracı sayma.
- Kartı İş Bağlam Kartı veya bağlam içi önizleme sayma.
- Eksik bağı otomatik tamamlayıp PR'yi hazır ilan etme.
