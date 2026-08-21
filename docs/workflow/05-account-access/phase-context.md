# Hesap Erişimi ve Oturum Güvenliği

Kurucu GitHub kimliğiyle tek Çalışma Alanına güvenli biçimde girer. Web ve macOS oturumları aynı ürün güven sınırını korur.

Giriş, Hesabı GitHub kimliğine bağlar; repository yetkisi ayrı kalır. Kurucu oturumlarını listeler ve iptal eder.

Bu feature hesap erişimi ve oturum güvenliğini tamamlar. GitHub repository bağlantısı, paylaşım ziyaretçisi ve hesap kapatma ayrı feature'lardır.

## Alt Fazlar

### GitHub ile giriş

Kurucu GitHub kimliğiyle giriş yapar ve bu kimlik Hesaba bağlanır. Çalışma Alanı bu Hesabın tek çalışma sınırıdır.

Repository seçme, App yükleme veya issue yazma bu girişin parçası değildir. Kimlik doğrulama ile geliştirme bağlantısı ayrı kalır.

Başarılı giriş, kurucuyu yetkili Çalışma Alanına alır. Başka kimlik sağlayıcı veya ekip daveti oluşmaz.

### Oturum yaşam döngüsü

Web ve Tauri oturumları aynı güvenlik sınırıyla oluşur. Kurucu aktif oturumları görür ve istediğini iptal eder.

İptal edilen oturum yazmaya devam etmez. Kabuk farkı ayrı oturum politikası üretmez.

Oturum yaşamı ziyaretçi bağlantısı, yüksek risk teyidi veya hesap kapatma penceresi değildir.

## Tamamlanma Ölçütleri

- GitHub kimliği Hesaba bağlanır; repository yetkisi girişten ayrı kalır.
- Web ve masaüstü oturumları güvenle oluşturulur, listelenir ve iptal edilir.

## Kapsam Sınırları

- E-posta/şifre, sihirli bağlantı veya çoklu Hesap birleştirme.
- Girişle birlikte repository yazma yetkisi veya GitHub App kurma.
- Ziyaretçi paylaşım oturumunu kurucu oturumu sayma.
