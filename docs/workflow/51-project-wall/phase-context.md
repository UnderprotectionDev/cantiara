# Proje Duvarı

Kurucu Proje anlatısını canlı kayıt kartları ve uzamsal yerleşimle kurar. Görsel çizgi, konum ve kilit kaynak kaydın ilişkisini veya durumunu örtük değiştirmez.

Kişisel viewport merkezi, zoom ve yalnız görünüm-yerel daraltma oturumlar arasında bu yüzeyde kalır; içerik semantiği, paylaşım veya başka kullanıcının görünümü değildir. `Görünümü sığdır` nötr görünüme döner; silinen veya anlamsız kalan konum görünür içeriğe sığar.

Anlatı, kayıtları kopyalamadan gösterir. Sunum ve bölge snapshotı tarihli salt okunur çıktıdır; duvar çalışma gerçeğinin yerine geçmez. Proje kabuğunun seçtiği `Sitemap` ve `Customer Journey` iskeletleri bu feature'da boş başlık yapılı duvar olarak yaşar.

Bu feature proje duvarını tamamlar. Wireframe, Moodboard, Belge kompozisyonu ve belge iskeleti kendi yüzeylerindedir.

## Alt Fazlar

### Duvar düzenleme

Duvar düzenleme canlı kartları ve yerel görsel öğeleri kaynak kimliğini koruyarak yerleştirir. Çizgi ve kilit anlatı içindir.

Kurucu kartı kaydırınca kaynak İş veya Belge değişmez. Yerleşim kişisel veya proje duvar durumudur.

Yerel görsel öğe Dosya Eki veya Moodboard referansı değildir. Duvara özgü anlatı işaretidir.

### Duvar başlangıç iskeletleri

`Sitemap` ve `Customer Journey` iskeletleri yalnız boş grup veya bölüm başlığı kurar. Oluştuktan sonra normal Proje Duvarı olarak yaşar.

İskelet ana kayıt örneği, kart, görev veya karar üretmez. İçerik kurucunun yerleştireceği yerdir. Katalog seçimi proje kabuğundadır; yaşayan örnek burada oluşur.

Bu alt faz belge iskeleti, Moodboard şablonu veya şablon pazarı değildir.

### Sunum ve bölge snapshotı

Sunum ve bölge snapshotı seçilen anlatı sırasını tarihli salt okunur çıktıya çevirir. Kaynak kartlar canlı kalır.

Kurucu hangi bölgenin donacağını seçer. Snapshot duvarı kilitleyip çalışmayı durdurmaz.

Bu alt faz Dış yüzey yayını veya Build in Public değildir. İç sunum çıktısıdır; dışarı açmak ayrı onay ister.

## Tamamlanma Ölçütleri

- Canlı kartlar ve yerel görsel öğeler kaynak kimliğini koruyarak yerleştirilir.
- Seçilen `Sitemap` ve `Customer Journey` iskeletleri boş başlık yapılı duvar olarak yaşar.
- Seçilen anlatı sırası ve bölge tarihli, salt okunur çıktı olarak sunulur.
- Kişisel viewport, zoom ve görünüm-yerel daraltma oturumlar arasında korunur; içerik semantiği değişmez.

## Kapsam Sınırları

- Viewport, zoom veya daraltmayı kayıt ilişkisi, paylaşım veya başka kullanıcı görünümü sayma.
- Duvar konumunu ilişki, durum veya öncelik sayma.
- Kartı kopya kayıt yapmak.
- Duvarı Wireframe, Moodboard veya Wiki sayfası sayma.
- Duvar iskeletini belge iskeleti veya içerikli şablon sayma.
