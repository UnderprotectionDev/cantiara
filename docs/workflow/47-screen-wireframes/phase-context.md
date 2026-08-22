# Ekranlar, Wireframe ve Kullanıcı Akışı

Kurucu bağımsız Ekran kayıtlarının sürümlü Wireframe yüzeylerini ve bunlara canlı bağlanan Kullanıcı Akışını düşük detaylı etkileşim tasarımı olarak yönetir.

Ekran ana kayıttır; Wireframe onun sürümlü yüzeyidir. Kesin sürüm araçsız sunulur ve desteklenen biçimlerde dışa aktarılır. Akış kırık hedefi gizlemez; öğeden kayıt dönüşümü köken konumunu korur.

Bu feature ekran, wireframe ve kullanıcı akışını tamamlar. Moodboard, teknik diyagram ve üretim tasarım sistemi burada yoktur.

## Alt Fazlar

### Ekran yaşam döngüsü

Ekran bağımsız ana kayıt kimliğiyle yaşar. Wireframe bu kaydın sürümlü yüzeyidir; dosya Ekranın yerine geçmez.

Kurucu Ekranı ilişkilendirir, arar ve yaşam döngüsünde tutar. Silinen Ekran akışta kırık hedef olur.

Ekran Belge veya Moodboard çerçevesi değildir. Etkileşim birimidir.

### Kullanıcı Akışı

Kullanıcı Akışı düğümleri canlı Ekran kayıtlarına bağlanır. Hedef çözülemezse içerik sızdırmadan kırık gösterilir.

Kurucu akışı düşük detaylı etkileşim olarak okur. Akış teknik sıra veya durum makinesi değildir.

Düğüm kopya Ekran üretmez. Canlı bağdır.

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
- Kullanıcı Akışı düğümleri canlı Ekran kayıtlarına bağlanır ve kırık hedefi güvenle gösterir.
- Kesin Wireframe sürümü araçsız sunulur ve desteklenen biçimlerde üretilir.
- Öğe önizlemeyle tek ana kayda dönüşür ve köken konumunu korur.

## Kapsam Sınırları

- Wireframe'i üretim UI kiti veya Figma senkronu sayma.
- Ekranı Wireframe dosyasının kendisi sayma.
- Akışı teknik sıra diyagramı veya Moodboard yapmak.
