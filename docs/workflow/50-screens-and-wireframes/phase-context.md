# Ekranlar ve Wireframe

Kurucu bağımsız Ekran kayıtlarının sürümlü Wireframe yüzeylerini düşük detaylı etkileşim tasarımı olarak yönetir. Ekran ana kayıttır; Wireframe onun sürümlü yüzeyidir.

Kişisel viewport merkezi, zoom ve yalnız görünüm-yerel daraltma oturumlar arasında bu yüzeyde kalır; içerik semantiği, paylaşım veya başka kullanıcının görünümü değildir. `Görünümü sığdır` nötr görünüme döner; silinen veya anlamsız kalan konum görünür içeriğe sığar.

Kesin sürüm araçsız sunulur ve desteklenen biçimlerde dışa aktarılır. Öğeden kayıt dönüşümü köken konumunu korur. Kullanıcı Akışı ayrıdır.

Bu feature Ekran ve Wireframe'i tamamlar. Moodboard, teknik diyagram ve Kullanıcı Akışı burada yoktur.

## Alt Fazlar

### Ekran yaşam döngüsü

Ekran bağımsız ana kayıt kimliğiyle yaşar. Wireframe bu kaydın sürümlü yüzeyidir; dosya Ekranın yerine geçmez.

Kurucu Ekranı ilişkilendirir, arar ve yaşam döngüsünde tutar. Silinen Ekran başka yüzeyde kırık hedef olur.

Ekran Belge veya Moodboard çerçevesi değildir. Etkileşim birimidir.

### Wireframe düzenleme

Wireframe düzenleme semantik öğeleri canonical WireframeDocument üzerinde taşır ve sürümler. Tuval görüntü export'u kanonik model değildir.

Kurucu öğeleri yerleştirir. Öğenin anlamı çizgiden ayrı korunur.

Tuval Proje Duvarı veya Moodboard değildir. Ekrana bağlı sürümlü yüzeydir.

### Sunum ve dışa aktarma

Kesin Wireframe sürümü araçsız sunulur ve desteklenen biçimlerde üretilir. Çıktı canlı belgeyi ezmez.

Kurucu hangi sürümü sunduğunu seçer. Sunum düzenlemeyi açmaz.

Dışa aktarma Dış yüzey yayını veya onaylı snapshot değildir. Tasarım çıktısıdır.

### Kayda dönüştür ve bağla

Seçilen öğe önizlemeyle tam olarak bir ana kayda dönüşür ve köken konumunu korur. Dönüşüm tuvali boşaltmaz.

Kurucu İş veya Ekran üretebilir. Çoklu gizli kayıt oluşmaz.

Köken bağı kullanım bağıdır. Öğeyi silmek oluşan kaydı silmez.

## Tamamlanma Ölçütleri

- Ekran ana kayıt kimliğiyle yaşar; Wireframe onun sürümlü yüzeyi olarak kalır.
- Kesin Wireframe sürümü araçsız sunulur ve desteklenen biçimlerde üretilir.
- Öğe önizlemeyle tek ana kayda dönüşür ve köken konumunu korur.
- Kişisel viewport, zoom ve görünüm-yerel daraltma oturumlar arasında korunur; içerik semantiği değişmez.

## Kapsam Sınırları

- Viewport, zoom veya daraltmayı kayıt ilişkisi, paylaşım veya başka kullanıcı görünümü sayma.
- Wireframe'i üretim UI kiti veya Figma senkronu sayma.
- Ekranı Wireframe dosyasının kendisi sayma.
- Kullanıcı Akışını bu karta yığma.
