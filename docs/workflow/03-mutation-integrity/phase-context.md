# Kayıt Bütünlüğü ve Ortak Yaşam Döngüsü

Ana kayıtlar kapsam, kimlik, revizyon, idempotency, değişiklik geçmişi, arşiv, Çöp Kutusu ve kırık referans kurallarını bütün feature'larda aynı gözlenebilir sözleşmeyle korur.

Kurucu bir kaydı yazdığında kayıp yazma, çift kayıt veya başka kapsamın verisine sızma görmez. Silinen hedef içerik sızdırmaz; geçmiş aktörü ve önceki–sonraki değeri taşır. Bağlantı kesildiğinde ürün yazmayı kuyruğa almaz; kurucu son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.

Bu feature ortak kayıt bütünlüğünü tamamlar. Türe özgü yaşam döngüsü, paylaşım ve kalıcı hesap silme kendi feature'larında kalır; burası genel bir CRUD katmanı değildir.

## Alt Fazlar

### Revizyon ve idempotency

Yazmalar revizyon ve idempotency anahtarıyla korunur. Eski bir görünümden gelen yazma, güncel kaydı sessizce ezmez.

Aynı isteğin tekrarı ikinci kayıt üretmez. Kullanıcı çatışmayı görür ve güncel gerçeği korur.

Bu alt faz birleştirme editörü veya otomatik kazanan seçimi değildir. Amaç kayıp yazmayı ve çoğalmayı önlemektir.

### Sahiplik kapsamı yalıtımı

Her kayıt tam olarak bir sahiplik kapsamında yaşar. Hesap, Çalışma Alanı, Proje ve Kişisel Wiki birbirinin içeriğini örtük açmaz.

İlişkiler karşı ucu çözmeden önce kapsamı doğrular. Yetkisiz bağlamda kayıt varmış gibi davranış oluşmaz.

Kapsam yalıtımı paylaşım izni veya Dış yüzey değildir. Dışarı açılan içerik ayrı feature'da, onaylı snapshot ile gider.

### Arşiv, Çöp Kutusu ve geri yükleme

Desteklenen kayıtlar arşiv, Çöp Kutusu ve geri yükleme adımlarında kimliğini korur. Sahipli bileşenler ve dış erişim etkileri birlikte yönetilir.

Arşiv salt okunur ara durumdur; Çöp Kutusu geri yüklenebilir silme sınırıdır. İkisi kalıcı silme veya gizleme filtresi değildir. Çöp Kutusuna alma, bağlı Dış yüzeyleri listeler ve varsayılan olarak iptal eder. Yalnız yaşayan Çalışma Alanı, Proje veya Kişisel Wiki içindeki tekil kaynakta kurucu açıkça onaylı yüzeyi koruyabilir; korunan yüzey son onaylı revizyonda donar ve kaynak geri yüklenince otomatik bağlanmaz.

Geri yükleme kimliği ve kapsamı korur. Kısmi çocuk silme veya başka hedefe otomatik taşıma oluşmaz. Çöp Kutusu kayıtları süre sonunda kalıcı silinir; erken kalıcı silme yüksek risk teyidi ve etki önizlemesi ister.

### Değişiklik geçmişi ve geri alma

Değişiklik geçmişi aktörü, kökeni ve önceki–sonraki değeri görünür tutar. Kurucu neyin ne zaman değiştiğini kaydın kendisinden okur.

Yalnız güvenli değişiklikler yeni bir olayla geri alınır. Geçmiş satırları silinmez veya olağan düzenlemeyle yeniden yazılmaz. Güvenlik redaksiyonu hassas değeri geçmişten de kaldırır; içeriksiz işaret olay türünü, zamanı ve aktörü korur.

Bu alt faz sürüm karşılaştırması veya Git geçmişi değildir. Kayıt olayıdır; repository gerçeğinin yerine geçmez.

### Güvenlik redaksiyonu

Güvenlik redaksiyonu hassas değeri güncel içerikten, kayıt geçmişinden, Dış yüzey snapshot'ından, arama indeksinden, dışa aktarma hazırlığından ve cache'den geri döndürülemez kaldırır. Olağan geri yükleme redakte edilmiş içeriği diriltmez.

Kurucu etkiyi önizler. Yüksek risk teyidi olmadan redaksiyon başlamaz. İçeriksiz işaret kalabilir; ad, e-posta, özgün mesaj veya secret yazılmaz.

Bu alt faz Çöp Kutusu, hesap kapatma veya istemci gizleme değildir. Değerin silinmesidir; kaydın kimliği durabilir.

### Kırık referans güvenliği

Silinen veya erişilemeyen hedef, içerik sızdırmadan güvenli işaretle gösterilir. Kullanıcı bağın koptuğunu görür; silinmiş başlığı veya gövdeyi görmez.

Sistem yetim kaydı kopyalamaz ve başka hedefe yönlendirmez. İlişkinin sahibi yaşamaya devam eder.

Kırık referans, Dış yüzey redaksiyonu veya paylaşım iptali değildir. Yalnız kayıt grafiğindeki güvenli sunumdur.

### Bağlantı kaybı

Bağlantı kesildiğinde ürün yazmayı kuyruğa almaz. Kurucu, son başarılı kayıt zamanını ve ekrandaki yazılmamış değişiklik riskini görür.

Yeniden bağlanma mevcut oturumu gizlice tamamlamaz. Kullanıcı hangi kaydın sunucuda kesinleştiğini ve hangisinin henüz yazılmadığını ayırt eder.

Bu alt faz çevrimdışı çalışma, senkron çakışması veya yerel taslak veritabanı kurmaz. Güvenli sonuç beklemek ve riski göstermektir.

## Tamamlanma Ölçütleri

- Güncel olmayan veya tekrarlanan yazmalar kayıp yazma ve kayıt çoğalması üretmez.
- Kayıt ve ilişkiler yalnız yetkili Hesap, Çalışma Alanı, Proje veya Kişisel Wiki bağlamında çözülür.
- Arşiv, Çöp Kutusu, geri yükleme, değişiklik geçmişi ve kırık referans aynı sözleşmeyle işler.
- Güvenlik redaksiyonu hassas değeri güncel içerik, geçmiş, dış yüzey, arama ve dışa aktarmadan geri döndürülemez kaldırır; olağan geri yükleme onu diriltmez.
- Bağlantı kesildiğinde offline kuyruk oluşmaz; kullanıcı son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.

## Kapsam Sınırları

- Türe özgü iş kurallarını bu ortak sözleşmenin yerine koyma.
- Çöp Kutusu ile Proje arşivini veya kalıcı hesap silmeyi aynı işlem sayma.
- Redaksiyonu istemci gizleme, Çöp Kutusu veya geçmiş satırını olağan düzenlemeyle silme sayma.
- Kırık referansta silinmiş başlığı, yetim kopyayı veya otomatik yönlendirmeyi gösterme.
- İstemci kabuğunu yerel-first veya offline-first ürüne dönüştürme.
