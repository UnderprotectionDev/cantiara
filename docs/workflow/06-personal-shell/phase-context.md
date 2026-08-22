# Kişisel Erişim Kabuğu

Kurucu odak, favori ve yeniden bak bağlamlarına kaynaklarını kaybetmeden erişir. Oturumluk çalışma seti ve canvas konumu kişisel kalır.

Kişisel kabuk, Çalışma Alanındaki kayıtlara hızlı dönüş sağlar. Bu yüzey planlama gerçeği, bildirim veya ikinci bir kayıt listesi üretmez. Favoriler listesini açar; favori üyeliğini yönetmez.

Bu feature kişisel erişim kabuğunu tamamlar. Favoriler, Günlük Odak, Bildirim Merkezi ve Komut Paleti kendi sınırlarında kalır.

## Alt Fazlar

### Kişisel bağlam paneli

Kişisel bağlam paneli Odak, Favoriler ve Yeniden bak öğelerini kaynaklarında açar. Öğeler kopya kayıt değildir.

Kurucu bir öğeyi seçince kaynak kaydın kendi bağlamına döner. Panel sıralaması planlama sırası üretmez. Favoriye ekleme ve çıkarma Favoriler feature'ındadır.

Bu alt faz Akıllı Koleksiyon, çapraz Proje listesi veya bildirim kutusu değildir.

### Aktif çalışma seti

Aktif çalışma seti oturumluk bir seçimdir. Kurucu o anda üzerinde durduğu kayıtları bir arada tutar.

Oturum bitince set kalıcı planlama üyeliği, Backlog sırası, Favori veya Odak Dönemi olmaz. Kaynak kayıtlar değişmeden kalır.

Çalışma seti paylaşılmaz ve Dış yüzey üretmez. Yalnız kişisel oturum bağlamıdır.

### Canvas çalışma konumu

Canvas çalışma konumu kişisel viewport ve katlama durumunu korur. Yerleşim, içeriğin anlamını veya ilişkisini değiştirmez.

Kurucu aynı yüzeye döndüğünde baktığı yeri bulur. Konum başka kullanıcıya, paylaşıma veya sürüme yazılmaz.

Bu alt faz Proje Duvarı semantiği veya Wireframe belgesi değildir. Kişisel görünüm durumudur.

## Tamamlanma Ölçütleri

- Odak, Favoriler ve Yeniden bak öğeleri kaynak bağlamında açılır.
- Oturumluk çalışma seti kalıcı planlama gerçeğine veya Favoriye dönüşmez.
- Kişisel viewport ve katlama durumu içerik semantiğini değiştirmeden korunur.

## Kapsam Sınırları

- Kişisel paneli workspace, dashboard veya ikinci Backlog sayma.
- Aktif çalışma setini Günlük Odak, Favori veya Odak Dönemi kapsamı yapmak.
- Canvas konumunu kayıt ilişkisi veya durum olarak saklama.
- Favori üyeliğini kabuğun feature'ı sayma.
