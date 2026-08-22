# Çöp Kutusu

Kurucu desteklenen kayıtları Çöp Kutusuna alır, süre içinde geri yükler veya yüksek risk teyidiyle kalıcı siler. Çöp Kutusu Arşiv veya gizleme filtresi değildir. Kimliği korur; aktif kural ve görünüm üyeliği üretmez.

Güvenlik redaksiyonu ayrı feature'dır. Proje arşivi, hesap kapatma ve operasyonel yedek Çöp Kutusu değildir.

Bu feature Çöp Kutusu, yapılandırma çöpü ve erken kalıcı silmeyi tamamlar.

## Alt Fazlar

### Çöp Kutusu ve geri yükleme

Desteklenen kayıtlar Çöp Kutusunda kimliğini korur. Süre otuz gündür; süre sonunda kalıcı silinir. Sahipli bileşenler ve dış erişim etkileri birlikte yönetilir. Proje silme grubu otuz günlük süreyi tek birim izler; çocuk kayıt ayrı sürede kalıcı silinemez.

Çöp Kutusuna alma önizlemesi bağlı Dış yüzeyleri listeler ve varsayılan olarak iptal eder. Yalnız yaşayan Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynakta kurucu açıkça onaylı yüzeyi koruyabilir; korunan yüzey son onaylı revizyonda donar ve kaynak geri yüklenince otomatik bağlanmaz.

Geri yükleme kimliği ve kapsamı korur. Kısmi çocuk silme veya başka hedefe otomatik taşıma oluşmaz. Çöp Kutusu restore-point değildir.

### Yapılandırma çöpü

Proje bazlı özel alan, öncelik ölçütü, Akıllı Koleksiyon, adlandırılmış görünüm, önceliklendirme oturumu, otomasyon kuralı, kayıt eylemi ve şablon aynı saklama kurallarıyla yapılandırma Çöp Kutusuna alınır.

Çöpteki tanım etkin çalışmaz. Silme önizlemesi etkilenecek değerleri ve bağımlı görünüm veya kuralı gösterir.

Geri yükleme aynı iç kimliği ve çözülebilen bağımlılıkları getirir. Anlamı değişen bağımlılık sessizce yeni kimlik üretmez.

### Erken kalıcı silme

Kullanıcı otuz günden önce kalıcı silme başlatabilir. Etki önizlemesi, GitHub kimliğini yeniden teyit etme ve etkilenen Hesap veya Proje adının yazılması gerekir. Bu teyit ayrı bir teslim kartı değildir.

Kalıcı silme, kaydı kullanan etkin Dış yüzey iptal edilip hassas içerik kaldırılmadan engellenir. Denetim kaydında yalnız takma kimlik, olay türü, zaman ve aktör kalır.

Bu alt faz hesap kapatma, Proje silme grubu veya güvenlik redaksiyonu değildir.

## Tamamlanma Ölçütleri

- Çöp Kutusu kayıtları kimliğini korur; otuz gün sonra veya teyitli erken eylemle kalıcı silinir. Proje silme grubu aynı süreyi tek birim izler.
- Çöp Kutusuna alma bağlı Dış yüzeyleri listeler ve varsayılan iptal eder; korunan yüzey geri yüklemede otomatik bağlanmaz.
- Yapılandırma çöpündeki tanım etkin çalışmaz; geri yükleme sessizce yeni kimlik üretmez.

## Kapsam Sınırları

- Çöp Kutusunu Arşiv, gizleme filtresi veya restore-point sayma.
- Çöp Kutusu ile Proje arşivini veya kalıcı hesap silmeyi aynı işlem sayma.
- Güvenlik redaksiyonunu bu kartın feature'ı sayma.
- Operasyonel yedeği Çöp Kutusu geçmişi sayma.
- GitHub teyidini ayrı teslim kartı yapmak.
