# Online Ürün Runtime'ı ve Uygulama Kabukları

Web ve macOS uygulaması aynı yönetilen backend, veri doğruluk kaynağı ve ürün sözleşmesiyle yalnız çevrimiçi çalışır. Kurucu hangi kabuğu açarsa açsın Çalışma Alanı gerçeği tek yerde kalır.

Bağlantı kaybı ve istemci sürüm uyumsuzluğu sessiz veri bozulması üretmez. Kurucu son başarılı kayıt zamanını görür; yazılmamış değişiklik riski görünür kalır ve güvenli olmayan yazma durur.

Bu feature uygulama kabuklarının ortak runtime sözleşmesini tamamlar. Yerel veritabanı, offline kuyruk, ikinci backend veya kabuğa özel ürün semantiği burada kurulmaz.

## Alt Fazlar

### Web ve macOS kabukları

Web ve macOS, aynı Hesap ve Çalışma Alanı gerçeğine bağlanan iki kabuktur. Ana akışlar ve güvenlik sınırları kabuğa göre çoğalmaz.

Kurucu oturum açar, kayıtları okur ve yazar; kabuk yalnızca sunumu taşır. Yerel dosya, ayrı cache sözleşmesi veya ikinci API gerçeği oluşmaz.

Gözlenen sonuç, iki istemcinin aynı ürün davranışını sunmasıdır. Bir kabukta tamamlanan yazma diğerinde ayrı bir doğruluk kaynağına düşmez.

### Bağlantı kaybı

Bağlantı kesildiğinde ürün yazmayı kuyruğa almaz. Kurucu, son başarılı kayıt zamanını ve ekrandaki yazılmamış değişiklik riskini görür.

Yeniden bağlanma mevcut oturumu gizlice tamamlamaz. Kullanıcı hangi kaydın sunucuda kesinleştiğini ve hangisinin henüz yazılmadığını ayırt eder.

Bu alt faz çevrimdışı çalışma, senkron çakışması veya yerel taslak veritabanı kurmaz. Güvenli sonuç beklemek ve riski göstermektir.

### Masaüstü güncelleme ve uyumluluk

Masaüstü istemcisi imzalı güncellemeyi güvenle alır ve uygular. Desteklenen sürüm sözleşmesi görünür kalır.

Destek süresi dolan veya sunucuyla uyumsuz istemci, güvenli olmayan yazmayı başlatmadan durur. Kullanıcı neden durduğunu görür.

Güncelleme, veri göçü veya ikinci bir masaüstü ürün hattı değildir. Uyumluluk kapısı yazmayı korur; içeriği dönüştürmez.

## Tamamlanma Ölçütleri

- Web ve macOS aynı ana akışları ve güvenlik sınırlarını ikinci veri kaynağı oluşturmadan sunar.
- Bağlantı kesildiğinde offline kuyruk oluşmaz; kullanıcı son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.
- İmzalı masaüstü güncellemesi uygulanır; destek süresi dolan istemci güvenli olmayan yazmadan önce durur.

## Kapsam Sınırları

- İstemci kabuğunu yerel-first veya offline-first ürüne dönüştürme.
- macOS için ayrı hesap, veri modeli veya güvenlik sözleşmesi kurma.
- Sürüm uyumsuzluğunu sessizce yutma veya eski istemcide yazmaya izin verme.
