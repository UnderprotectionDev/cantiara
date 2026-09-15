# Kullanıcı Akışı

Kurucu Kullanıcı Akışını canlı Ekran kayıtlarına bağlanan düşük detaylı etkileşim yolu olarak yönetir. Düğüm kopya Ekran üretmez; hedef çözülemezse içerik sızdırmadan kırık gösterilir.

Kişisel viewport merkezi, zoom ve yalnız görünüm-yerel daraltma oturumlar arasında bu yüzeyde kalır; içerik semantiği, paylaşım veya başka kullanıcının görünümü değildir. `Görünümü sığdır` nötr görünüme döner; silinen veya anlamsız kalan konum görünür içeriğe sığar.

Akış teknik sıra veya durum makinesi değildir. `Kayda dönüştür ve bağla` yalnız önizleme ve onayla ana kayıt oluşturur. Şablon kaynak projeyle canlı bağ kurmaz.

Bu feature Kullanıcı Akışını tamamlar. Ekran/Wireframe, Moodboard ve Teknik Sıra ayrıdır.

## Tamamlanma Ölçütleri

- Akış düğümleri canlı Ekran kayıtlarına bağlanır ve kırık hedefi güvenle gösterir.
- Sabit semantik öğe kümesi dışına çıkılmaz.
- Kayda dönüştürme önizlemeli tek ana kayıt üretir; köken konumu korunur.
- Kişisel viewport, zoom ve görünüm-yerel daraltma oturumlar arasında korunur; içerik semantiği değişmez.

## Kapsam Sınırları

- Viewport, zoom veya daraltmayı kayıt ilişkisi, paylaşım veya başka kullanıcı görünümü sayma.
- Akışı teknik sıra diyagramı veya Wireframe belgesi sayma.
- Düğümden sessiz Ekran kopyası üretme.
- Moodboard veya Proje Duvarını akış sayma.
