# Wireframe motorunu kendimiz yaz

Ekranların düşük detaylı Wireframe yüzeyi hazır bir diyagram veya whiteboard kütüphanesi yerine ürüne özgü bir editör motoruyla yazılır. Hazır kütüphaneler kendi belge modelini, kendi öğe dilini ve kendi serileştirmesini getirir; bu ürünün ihtiyacı ise öğelerin ürün semantiği taşıması, kesin Wireframe sürümlerinin değişmez olması, bağlı block'ların tek kaynak tanımından beslenmesi ve aynı yüzeyin klavye ile ekran okuyucuya açık yapılandırılmış bir eşdeğerini sunmasıdır. Bunlar sunum katmanı değil domain gereksinimi olduğu için dış belge modeline uydurulamaz.

Alternatifler; genel amaçlı bir canvas kütüphanesini genişletmek, dış bir tasarım aracına gömülü olarak bağlanmak veya Wireframe'i tamamen kapsam dışına almaktı. Reddedildiler çünkü ilk ikisi öğe semantiğini ve sürüm değişmezliğini kütüphanenin modeline devrederdi, üçüncüsü ise tasarım bağlamını proje bağlamından koparırdı.

Bedeli açıktır: seçim, komut modeli, undo, hizalama, çoklu seçim, pan/zoom, erişilebilir yapılandırılmış outline, PNG/SVG/PDF ve tek dosyalı interaktif HTML çıktısı dahil bir editör altyapısının bakımını üstlenmek. Bu yükü sınırlamak için kapsam bilinçli olarak dar tutulur: yüksek detaylı görsel tasarım, production component ve token sistemi, serbest çizim, gerçek servise bağlı prototip ve düzenlenebilir tasarım aracı aktarımı ilk üründe bulunmaz.
