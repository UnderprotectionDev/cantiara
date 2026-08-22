# Çalışmaya Dön

Kurucu ara verdiği Proje veya İşe güncel kaynaklardan seçilen geri dönüş kartları ve açıkça kaydettiği sıradaki somut adımla bağlamını kaybetmeden döner.

Kaldığı yer kaybolmaz. Kartlar güncel kayıtlardan seçilir; hatırlatma veya bildirim yığını değildir. Özet son açık kayıt, sekme, filtre, sıralama, scroll veya yan paneli geri yüklemez. Büyük canvas viewport'u ilgili tuval feature'ındadır.

Bu feature çalışmaya dönüşü tamamlar. Kişisel hatırlatma, Günlük Odak ve aktif çalışma seti ayrı kalır.

## Alt Fazlar

### Geri dönüş kartları ve sıradaki adım

Özet; son düzenlenen, son görüntülenen, yaklaşan tarihli, açık risk taşıyan veya bekleyen GitHub geliştirme sinyali bulunan kayıtlar arasından az sayıda anlamlı geri dönüş kartı seçer. Her kart neden gösterildiğini açıklar ve kullanıcıyı ana kaynak kayda götürür.

Kullanıcı proje veya İş bağlamından ayrılmadan önce isteğe bağlı tek bir `Sıradaki somut adım` metni kaydedebilir. Değer ayrı bir kayıt, İş, kontrol listesi maddesi, Günlük Odak üyeliği, hatırlatma veya ikinci çalışma listesi değildir; ilgili ana kaydın isteğe bağlı alanıdır. `Çalışmaya Dön` etkin adımı kaynak kaydı, son güncelleme zamanı ve `Kaynak kaydı aç` ile gösterir. Alan durum, öncelik, tarih veya planlama üyeliği değişince kendiliğinden güncellenmez; sistem olaylardan yeni adım tahmin etmez.

Özet ayrı bir yönlendirilmiş seans, zorunlu gündem veya kayıtların durumunu değiştiren ilerleme akışı oluşturmaz.

### Son baktığından beri

Özet, ilgili proje veya iş bağlamına son ziyaretten sonra gerçekleşen tanımlı olayları `Son baktığından beri` bölümünde iş, karar, risk, belge, GitHub ve yayın gibi anlaşılır konu gruplarında gösterir.

İşaret Hesaba aittir ve sunucuda yalnız Proje ile desteklenen İş bağlamı başına en son başarılı görünür açılış zamanını tutar; görüntüleme geçmişi, süre, analytics veya denetim olayı üretmez. Kayıt silinince işaret silinir ve dış yüzeye açılmaz. Her öğe olay zamanını ve ana kaynak kaydı görünür kılar. Gruplama yalnız tanımlı olay türlerine dayanır; AI özeti veya yeni bir özet kaydı üretmez.

### Değişiklikleri görsel olarak gez

Proje Duvarı, Kullanıcı Akışı, Ekranın Wireframe yüzeyi, Moodboard veya Roadmap hedefi bulunan desteklenen olaylarda kullanıcı `Değişiklikleri görsel olarak gez` eylemini açıkça başlatabilir. Tur yalnız aynı `Son baktığından beri` kümesindeki tanımlı olayları sırayla kullanır; ilgili kaynak kartı veya desteklenen kesin görsel hedefi vurgular, görünümü konumuna taşır ve olay zamanı ile gösterilme nedenini açıklar.

Roadmap turu yeni bir roadmap geçmişi, audit kaydı, snapshot veya önem skoru üretmez; mevcut olayın kesin İş veya Kilometre Taşı hedefini güncel görünümde çözümler. Silinmiş, erişilemeyen veya artık konumlandırılamayan hedef atlanırken nedeni gösterilir; başka nesneye sessizce yönelinmez.

Tur her an kapatılabilir. Başlangıç viewport'u güvenle çözümleniyorsa kapanışta geri yüklenir; içerik değişikliği eski konumu anlamsız kılmışsa görünür içeriğe sığan fallback kullanılır. Çok büyük olay kümelerinde açıklanabilir bir üst sınır ve kalan olayları normal listede açma eylemi bulunur. Tur AI yorumu, ayrı kayıt, kalıcı rota veya ikinci çalışma listesi oluşturmaz.

### Uzun süredir aynı durumda

Kullanıcı proje bazında bir durum yaşı eşiği belirlemişse eşiği aşan aktif işler `Uzun süredir aynı durumda` gerekçesiyle nötr geri dönüş adayı olur ve hazır Akıllı Koleksiyonda gösterilir.

Bu aday varsayılan bildirim, `takıldı` hükmü, sağlık veya performans puanı üretmez. Aday olmak İş durumunu veya planlama üyeliğini değiştirmez.

## Tamamlanma Ölçütleri

- Ara verilen Proje veya İşe güncel kaynak kartları ve kaydedilen sıradaki adımla dönülür.
- `Son baktığından beri` tanımlı olayları konu gruplarında gösterir; analytics üretmez.
- Görsel tur yalnız aynı olay kümesini kullanır; kayıp hedefi sessizce başka nesneye kaydırmaz.
- Durum yaşı adayı bildirim veya sağlık hükmü üretmez.
- Dönüş bağlamı kaybetmez ve ikinci bir planlama gerçeği üretmez.

## Kapsam Sınırları

- Dönüş kartını bildirim, hatırlatma veya Backlog sırası sayma.
- Sıradaki adımı otomasyonla kapanış sonucu yapmak.
- Eski snapshot'ı güncel kayıt yerine gösterme.
- Son açık sekme, filtre, sıralama, scroll veya paneli geri yükleme.
- Canvas viewport sahipliğini bu karta taşıma.
