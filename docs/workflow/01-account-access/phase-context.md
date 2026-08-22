# Hesap Erişimi ve Oturum Güvenliği

Kurucu GitHub kimliğiyle tek Çalışma Alanına güvenli biçimde girer. Web ve macOS oturumları aynı ürün güven sınırını korur.

Giriş, Hesabı GitHub kimliğine bağlar; repository yetkisi ayrı kalır. Kurucu oturumlarını listeler ve iptal eder.

Bu feature hesap erişimi, oturum güvenliği ve GitHub kimliğini yeniden teyit etmeyi tamamlar. GitHub repository bağlantısı, paylaşım ziyaretçisi ve hesap kapatma ayrı feature'lardır. Kapatma, güvenlik redaksiyonu, erken kalıcı silme ve kişisel veri silme teyidi buradan kullanır.

## Alt Fazlar

### GitHub ile giriş

Kurucu GitHub kimliğiyle giriş yapar ve bu kimlik Hesaba bağlanır. Çalışma Alanı bu Hesabın tek çalışma sınırıdır.

Repository seçme, App yükleme veya issue yazma bu girişin parçası değildir. Kimlik doğrulama ile geliştirme bağlantısı ayrı kalır.

Başarılı giriş, kurucuyu yetkili Çalışma Alanına alır. Başka kimlik sağlayıcı veya ekip daveti oluşmaz.

### Oturum yaşam döngüsü

Web ve Tauri oturumları aynı güvenlik sınırıyla oluşur. Kurucu aktif oturumları görür ve istediğini iptal eder.

İptal edilen oturum yazmaya devam etmez. Kabuk farkı ayrı oturum politikası üretmez. GitHub kesintisinde mevcut ve geçerli ürün oturumu olağan süresi dolana kadar özel veride okuma ve yazmaya devam eder; yeni giriş ve yüksek risk teyidi bekler.

Oturum yaşamı ziyaretçi bağlantısı, yüksek risk teyidi veya hesap kapatma penceresi değildir.

### GitHub kimliğini yeniden teyit etme

GitHub kimliğini yeniden teyit etme, aynı değişmez kimliğe kısa ömürlü yüksek risk yetkisi verir. Başka sağlayıcı veya eski oturum yetmez.

Kurucu kapatma, güvenlik redaksiyonu, erken kalıcı silme ve kişisel veri silme gibi tehlikeli işlemi bu yetkiyle başlatır. Yetki süre sonunda düşer.

Teyit repository App yetkisi veya ziyaretçi parolası değildir. Hesap kimliğinin yeniden kanıtıdır. Tüketen feature'lar ayrı bir teyit kartı açmaz.

## Tamamlanma Ölçütleri

- GitHub kimliği Hesaba bağlanır; repository yetkisi girişten ayrı kalır.
- Web ve masaüstü oturumları güvenle oluşturulur, listelenir ve iptal edilir.
- GitHub kesintisi mevcut geçerli oturumu sessizce düşürmez; yeni giriş ve yüksek risk teyidi bekler.
- Aynı değişmez GitHub kimliği kısa ömürlü yüksek risk yetkisi verir.

## Kapsam Sınırları

- E-posta/şifre, sihirli bağlantı veya çoklu Hesap birleştirme.
- Girişle birlikte repository yazma yetkisi veya GitHub App kurma.
- Ziyaretçi paylaşım oturumunu kurucu oturumu sayma.
- Teyidi parola, MFA, genel oturum yenileme veya hesap kapatma penceresi sayma.
