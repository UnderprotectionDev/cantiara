# Dosya Ekleri ve Görsel Kanıt

Kurucu dosyaları doğrulanmış tür, kota ve atomik finalize sınırıyla kayıtlara ekler. Güvenli önizleme, işaretleme ve konuma bağlı İş bağlamı kaynağı değiştirmez.

Dosya, tam olarak bir Proje veya Kişisel Wiki kapsamında ana kayıt olarak yaşar. İşaretleme ve önizleme kaynak dosya sürümünden ayrı kalır; orijinal bozulmaz.

Bu feature Dosya Eki ve görsel kanıtı tamamlar. Belge gövdesi, Kaynak kaydı ve dış nesne CDN'i ikinci içerik kaynağı değildir.

## Alt Fazlar

### Dosya kabulü

Dosya kabulü tür, boyut ve kapsam kotasını doğrular. Geçmeyen girdi kesinleşmez ve kısmi kayıt bırakmaz.

Finalize atomiktir. Kurucu ya bağlanmış bir Dosya Eki görür ya da yüklemenin tamamlanmadığını görür.

Bu alt faz dış depolama gezgini veya Belge içe aktarma değildir. Kabul, kapsam içi ana kaydı doğurur.

### Güvenli önizleme

Desteklenen medya güvenli bir önizlemede görülür. İşleme başarısız olsa bile kaynak dosya ve kaydı bozulmaz.

Önizleme canlı web aynası veya dış görüntüleyici oturumu değildir. İçerik yalıtılmış sunulur.

Güvenli önizleme, paylaşım snapshot'ındaki asset kapısından ayrıdır. Burada kurucu kendi kaydını görür.

### Görsel işaretleme

Görsel işaretleme kaynak dosya sürümünden ayrı saklanır. Çizim, pin veya bölge orijinali değiştirmez.

Konuma bağlı İş bağlamı işaretlenen noktayı İşe bağlar; dosya sahipliğini veya sürümünü değiştirmez.

İşaretleme üretim tasarım aracı veya Wireframe belgesi değildir. Kanıt ve bağlam notudur.

## Tamamlanma Ölçütleri

- Dosya türü, boyutu ve kapsam kotası doğrulandıktan sonra atomik kesinleşir.
- Desteklenen medya güvenli görüntülenir; başarısız işleme kaynak dosyayı bozmaz.
- İşaretleme ve konum bağlamı kaynak dosya sürümünden ayrı korunur.

## Kapsam Sınırları

- Dosya Ekini Belge, ilişki eki veya paylaşılan global dosya sayma.
- İşaretlemeyi kaynak dosyanın üzerine yazma.
- Kotasız veya türü doğrulanmamış yüklemeyi kesinleştirme.
