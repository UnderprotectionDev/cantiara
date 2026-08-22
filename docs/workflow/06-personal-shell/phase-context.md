# Kişisel Erişim Kabuğu

Kurucu Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve Yeniden bak bağlamlarına kaynaklarını kaybetmeden erişir. Oturumluk çalışma seti kişisel kalır.

Kişisel kabuk, Çalışma Alanındaki kayıtlara hızlı dönüş sağlar. Yüzeyler varsayılan olarak geçici panelde açılır; gerektiğinde `Tam sayfa aç` vardır. Bu yüzey planlama gerçeği, bildirim kaydı veya ikinci bir kayıt listesi üretmez. Favoriler listesini açar; favori üyeliğini yönetmez. Açık panel, panel içi gezinme, scroll ve kaynak görünüm konumu oturumlar arasında recent-context olarak geri yüklenmez.

Bu feature kişisel erişim kabuğunu tamamlar. Favoriler, Günlük Odak, Birleşik Bildirim Merkezi ve Komut Paleti kendi sınırlarında kalır. Büyük canvas'ların kişisel viewport, zoom ve daraltma durumu ilgili tuval feature'ındadır.

## Alt Fazlar

### Kişisel bağlam paneli

Kişisel bağlam paneli Günlük Odak, Favoriler, Birleşik Bildirim Merkezi ve Yeniden bak öğelerini kaynaklarında açar. Öğeler kopya kayıt değildir.

Kurucu bir öğeyi seçince kaynak kaydın kendi bağlamına döner. Panel sıralaması planlama sırası üretmez. Favoriye ekleme ve çıkarma Favoriler feature'ındadır.

Bu alt faz Akıllı Koleksiyon, çapraz Proje listesi veya bildirim kutusu değildir.

### Aktif çalışma seti

Aktif çalışma seti oturumluk bir seçimdir. Kurucu o anda üzerinde durduğu İş ve Belgeleri kaynak görünümündeki bağlamını kaybetmeden bir arada tutar ve tek eylemle yeniden açar.

Oturum bitince set kalıcı planlama üyeliği, Backlog sırası, Favori veya Odak Dönemi olmaz. Kaynak kayıtlar değişmeden kalır. Set kaydedilmemiş düzenlemeler için ayrı dayanıklılık mekanizması değildir.

Çalışma seti paylaşılmaz ve Dış yüzey üretmez. Yalnız kişisel oturum bağlamıdır.

## Tamamlanma Ölçütleri

- Günlük Odak, Favoriler, Bildirim Merkezi ve Yeniden bak öğeleri kaynak bağlamını kaybetmeden açılır.
- Oturumluk çalışma seti kalıcı planlama gerçeğine veya Favoriye dönüşmez.
- Panel konumu oturumlar arasında recent-context olarak geri yüklenmez.

## Kapsam Sınırları

- Kişisel paneli workspace, dashboard veya ikinci Backlog sayma.
- Aktif çalışma setini Günlük Odak, Favori veya Odak Dönemi kapsamı yapmak.
- Canvas viewport, zoom veya daraltmayı bu kabuğun feature'ı sayma.
- Favori üyeliğini kabuğun feature'ı sayma.
