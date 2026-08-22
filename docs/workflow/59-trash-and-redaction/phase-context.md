# Çöp Kutusu ve Güvenlik Redaksiyonu

Kurucu desteklenen kayıtları Çöp Kutusuna alır, süre içinde geri yükler veya yüksek risk teyidiyle kalıcı siler. Güvenlik redaksiyonu hassas değeri güncel içerikten ve bütün geçmiş kopyalarından geri döndürülemez kaldırır.

Çöp Kutusu Arşiv veya gizleme filtresi değildir. Redaksiyon kaydın kimliğini durdurmak zorunda değildir; değeri siler. Bu feature Çöp Kutusu ve güvenlik redaksiyonunu tamamlar. Proje arşivi, hesap kapatma ve operasyonel yedek ayrıdır.

## Alt Fazlar

### Çöp Kutusu ve geri yükleme

Desteklenen kayıtlar Çöp Kutusunda kimliğini korur. Süre otuz gündür; süre sonunda kalıcı silinir. Sahipli bileşenler ve dış erişim etkileri birlikte yönetilir.

Çöp Kutusuna alma önizlemesi bağlı Dış yüzeyleri listeler ve varsayılan olarak iptal eder. Yalnız yaşayan Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynakta kurucu açıkça onaylı yüzeyi koruyabilir; korunan yüzey son onaylı revizyonda donar ve kaynak geri yüklenince otomatik bağlanmaz.

Geri yükleme kimliği ve kapsamı korur. Kısmi çocuk silme veya başka hedefe otomatik taşıma oluşmaz. Çöp Kutusu restore-point değildir.

### Yapılandırma çöpü

Proje bazlı özel alan, öncelik ölçütü, Akıllı Koleksiyon, adlandırılmış görünüm, önceliklendirme oturumu, otomasyon kuralı, kayıt eylemi ve şablon aynı saklama kurallarıyla yapılandırma Çöp Kutusuna alınır.

Çöpteki tanım etkin çalışmaz. Silme önizlemesi etkilenecek değerleri ve bağımlı görünüm veya kuralı gösterir.

Geri yükleme aynı iç kimliği ve çözülebilen bağımlılıkları getirir. Anlamı değişen bağımlılık sessizce yeni kimlik üretmez.

### Güvenlik redaksiyonu

Güvenlik redaksiyonu hassas değeri güncel içerikten, kayıt geçmişinden, Dış yüzey snapshot'ından, arama indeksinden, dışa aktarma hazırlığından ve cache'den geri döndürülemez kaldırır. Olağan geri yükleme redakte edilmiş içeriği diriltmez.

Kurucu etkiyi önizler. GitHub kimliğini yeniden teyit etme ve hedef adı yazılmadan redaksiyon başlamaz. İçeriksiz işaret kalabilir; ad, e-posta, özgün mesaj veya secret yazılmaz.

Bu alt faz Çöp Kutusu, hesap kapatma veya istemci gizleme değildir.

### Erken kalıcı silme

Kullanıcı otuz günden önce kalıcı silme başlatabilir. Etki önizlemesi, GitHub kimliğini yeniden teyit etme ve etkilenen Hesap veya Proje adının yazılması gerekir.

Kalıcı silme, kaydı kullanan etkin Dış yüzey iptal edilip hassas içerik kaldırılmadan engellenir. Denetim kaydında yalnız takma kimlik, olay türü, zaman ve aktör kalır.

Bu alt faz hesap kapatma veya Proje silme grubu değildir.

## Tamamlanma Ölçütleri

- Çöp Kutusu kayıtları kimliğini korur; otuz gün sonra veya teyitli erken eylemle kalıcı silinir.
- Çöp Kutusuna alma bağlı Dış yüzeyleri listeler ve varsayılan iptal eder; korunan yüzey geri yüklemede otomatik bağlanmaz.
- Yapılandırma çöpündeki tanım etkin çalışmaz; geri yükleme sessizce yeni kimlik üretmez.
- Güvenlik redaksiyonu hassas değeri güncel içerik, geçmiş, dış yüzey, arama ve dışa aktarmadan kaldırır; olağan geri yükleme onu diriltmez.

## Kapsam Sınırları

- Çöp Kutusunu Arşiv, gizleme filtresi veya restore-point sayma.
- Çöp Kutusu ile Proje arşivini veya kalıcı hesap silmeyi aynı işlem sayma.
- Redaksiyonu istemci gizleme veya geçmiş satırını olağan düzenlemeyle silme sayma.
- Operasyonel yedeği Çöp Kutusu geçmişi sayma.
