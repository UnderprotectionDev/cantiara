# Proje Kabuğu

Kurucu bir Projeyi ad ve Başlangıç yapılandırmasıyla açar. Kısa kod, alanlar, hazır görünümler ve boş başlangıç iskeleti kataloğu aynı yapı kararından doğar. Yeni Proje örnek içerik, zorunlu workflow veya ürün türü dayatmadan çalışmaya hazır yapı kazanır. Blank Project en küçük kurulumu verir; diğer hazır alanları kapatmaz, yalnız kurmaz. Yaşayan Belge ve Proje Duvarı iskelet örnekleri ilgili feature'larda oluşur.

Aynı kabukta kurucu Projenin aşamalarını, alanlarını, durumlarını ve görünümlerini sabit bir süreç kapısına dönüşmeden yapılandırır. Yapılandırma modu özel alan editörünü açar; alan şeması Proje bazlı özel alan feature'ında yaşar. Yapıyı kopyalama, alan ve görünüm kararlarını içeriksiz yeni Projeye taşır. Kayıtlar, geçmiş ve ilişkiler gelmez.

Bu feature projenin açılmasını ve yapısını tamamlar. Proje genel bakışı, özel alan şeması, İş Bağlam Kartı düzeni, İş yaşam döngüsü ve kapanış özeti ayrıdır.

## Alt Fazlar

### Proje profili

Proje profili adı ve değişmez kısa kod sözleşmesiyle oluşur. Kısa kod, ilk İşten sonra kullanıcıya dönük İş anahtarı önekidir.

Profil repository, çalışma alanı veya değiştirilebilir slug değildir. Kimlik Proje boyunca kalır.

Oluşturma, GitHub bağlantısını zorunlu kılmaz. Repository bağı ayrı feature'da açıkça kurulur.

### Başlangıç yapılandırması

Başlangıç yapılandırması alanları, aşamaları, görünümleri ve navigasyonu bir kez uygular. Örnek kayıt veya içerik üretmez.

Seçim çalışma sırası veya durum geçişi kapısı oluşturmaz. Kurucu kurulumu sonra aynı kabukta değiştirebilir.

Blank Project en küçük seçenektir. Diğer yapılandırmalar özellikleri kapatmaz; yalnız varsayılanları kurar.

### Başlangıç iskeletleri

Başlangıç yapılandırması kaynakta tanımlı boş iskelet kataloğunu seçer. Katalog `Persona`, `Retrospective` ve `Launch Plan` belgelerini; `Sitemap` ve `Customer Journey` duvarlarını adlandırır.

Seçim yaşayan Belge veya Proje Duvarı örneği üretmez. Belge iskeletleri belge feature'ında, duvar iskeletleri proje duvarı feature'ında boş başlık yapısı olarak oluşur.

Bu alt faz kapanış özeti taslağı, şablon pazarı veya içerikli örnek kayıt değildir.

### Yapılandırma modu

Yapılandırma modu aşamaları, iş durumlarını, etkin alanları, özel alanları ve kayıtlı görünümleri günlük içerik düzenlemesinden ayırır. İş Bağlam Kartı düzeni ve özel alan editörü bu modda açılır fakat kendi feature'larında yaşar. Mod izin veya ayrı yönetici rolü değildir; görünür bir sunum durumudur.

Kurucu modu açıkça görür ve tek eylemle kapatır. Mode girmek ana kaydı, görünüm üyeliğini veya proje yaşamını değiştirmez. Günlük oluşturma, düzenleme, durum ve planlama mod dışında erişilebilir kalır.

### Proje yapısı

Proje yapısı aşamaları, alanları ve durumları korunan semantik içinde değiştirir. Aşamalar sıralı state machine değildir; birden fazla aşama aynı anda Aktif olabilir. Hazır Proje alanları kapalı katalogdandır; gizlenen alan içerik kaybetmez ve kayıt yaşamını değiştirmez.

`Overview` ve `All Tools` Proje alanı değildir ve daima erişilebilir kalır. Alanı etkinleştirmek veya gizlemek kayıtları taşımaz, kopyalamaz ya da silmez; sabitleme yalnız navigasyon üstverisidir. Etkin alanların genel bakışta adı ve girişi Proje genel bakışı feature'ındadır.

Kurucu görünür alanları ve akış durumlarını Projeye uyarlar. Özel alan tanımı bu kabukta şema üretmez; Proje bazlı özel alan feature'ına aittir.

Yapı değişikliği geçmiş kayıtları sessizce yeniden yazmaz.

### Yapıyı kopyalama

Yapıyı kopyalama, alan ve görünüm kararlarını içeriksiz yeni Projeye taşır. Kayıtlar, geçmiş ve ilişkiler gelmez.

Kurucu kopyanın neyi aldığını önizler. Kaynak Proje değişmez.

Bu alt faz Proje kopyası, şablon pazarı veya kapsam taşıma değildir.

## Tamamlanma Ölçütleri

- Aktif Proje, değişmez kısa kod sözleşmesiyle oluşturulur.
- Seçilen Başlangıç yapılandırması alanları, aşamaları, görünümleri ve navigasyonu bir kez kurar.
- Başlangıç yapılandırması kaynakta tanımlı iskelet kataloğunu seçer; yaşayan Belge ve Duvar örnekleri kendi feature'larında oluşur.
- Yapılandırma modu yapı değişikliğini günlük düzenlemeden ayırır; kayıt yaşamını değiştirmez.
- Aşamalar, alanlar ve durumlar korunan ürün semantiği içinde değişir.
- Alanı gizlemek içerik silmez; `Overview` ve `All Tools` kapanmaz.
- İçerik ve geçmiş taşınmadan yeni Projeye yapı kopyalanır.

## Kapsam Sınırları

- Örnek Proje, içerikli şablon veya zorunlu workflow dayatma.
- Yapılandırmayı zorunlu workflow veya yayın kapısı yapmak.
- Özel alan şemasını bu kabuğun feature'ı sayma.
- Lookup veya Formula alanıyla türetilmiş doğruluk kaynağı kurma.
- Testler alanını ayrı test ürünü veya ana faz sayma.
- Proje genel bakışını bu kabuğun feature'ı sayma.
- Yaşayan Belge veya Proje Duvarı iskelet örneğini bu kabuğun feature'ı sayma.
