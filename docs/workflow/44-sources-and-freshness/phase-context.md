# Kaynaklar ve Kanıt Tazeliği

Kurucu dış Kaynağın kökenini ve tarihli sürümlerini korur. Açık yeniden kontrol yeni sürümü karşılaştırır ve hiçbir kullanımı sessizce yeniden bağlamaz.

Dış bilgi canlı sayfa değildir. Akıllı önizleme yalıtılmış üstveridir; yeniden kontrol her kullanımı ayrı karar olarak bırakır.

Bu feature kaynaklar ve kanıt tazeliğini tamamlar. Kanıt ilişkisi, Dosya Eki ve akıllı bağlantının ikinci doğruluk kaynağı olması burada yoktur. Uzun gövdeli Geri Bildirim ve Kaynak Feed'i Geri Bildirim feature'ındadır.

## Alt Fazlar

### Kaynak kayıtları

Kaynak kaydı dış bilginin kimliğini, kökenini ve tarihli sürümlerini saklar. Canlı sayfa eşitlenmez.

Kurucu hangi sürümü gördüğünü bilir. Yeni fetch eski sürümü silmez.

Kaynak Dosya Eki veya Belge değildir. Dış kökenli tarihli kayıttır.

### Akıllı bağlantı önizlemesi

Akıllı bağlantı önizlemesi güvenli URL yalıtımıyla desteklenen üstveriyi gösterir. Dış HTML ikinci doğruluk kaynağı olmaz.

Kurucu başlık ve özeti görür; sayfayı ürün içine gömmez. Canlı oynatıcı yalnız YouTube içindir; kart tıklanınca yüklenir, autoplay yoktur ve üçüncü taraf uyarısı görünür kalır. Vimeo ve diğer sağlayıcılar oynatıcıya dönmez.

Önizleme Kaynak kaydının kendisi değildir. Üstveri yardımıdır. YouTube kartı tarihsel kanıt değildir.

### Kaynağı yeniden kontrol etme

Yeniden kontrol yeni sürümü eskisiyle karşılaştırır. Hiçbir Kanıt bağı veya kullanım sessizce yeni sürüme geçmez.

Kurucu her kullanım için ayrı bağlama kararı verir. Toplu "hepsini güncelle" örtük çalışmaz.

Bu alt faz tarayıcı yenileme veya webhook senkronu değildir. Açık tazelik turudur.

## Tamamlanma Ölçütleri

- Dış kaynağın kimliği, kökeni ve tarihli sürümleri güvenle saklanır.
- Akıllı bağlantı önizlemesi yalıtılmış üstveri gösterir; dış içerik ikinci doğruluk kaynağı olmaz.
- YouTube kartı tıklanınca yüklenir; başka sağlayıcı oynatıcıya dönüşmez.
- Yeni sürüm karşılaştırılır; her kullanımın yeniden bağlanma kararı ayrı kalır.

## Kapsam Sınırları

- Uzun gövde feed'ini bu kartın feature'ı sayma.
- Kaynağı bookmark, canlı web aynası veya akıllı önizleme sayma.
- YouTube dışındaki sağlayıcıyı canlı oynatıcı veya çalıştırılabilir embed sayma.
- Yeniden kontrolde bütün kullanımları sessizce yeni sürüme taşıma.
- Kaynağın varlığını otomatik Kanıt bağı sayma.
