# Belge Yazarlığı ve Sürümleri

Kurucu veritabanındaki Markdown Belgeleri uygulama içinde yazar, canlı bağlamla birleştirir, sürümler ve çatışmaları tarihsel bütünlüğü bozmadan çözer. Belgeler klasörler ve sınırlı ebeveyn–çocuk ilişkisiyle aynı sahiplik kapsamında düzenlenir. Belge ve Dosya Ekleri kapsam, tür, klasör ve desteklenen üstverilerle taranır.

Belge başka kaydın metin alanı veya dış dosyayla canlı eşitlenen kopya değildir. Şablon ve Persona yeni belgeyi bağımsız kimlikle başlatır. Canlı bloklar kaynak kimliğini korur; dışa aktarma onları tarihli snapshota çevirir. Hiyerarşi sahipliği veya yaşam döngüsünü değiştirmez; yalnızca düzenler. Keşif görünümü ikinci içerik veya sahiplik kaynağı oluşturmaz.

Yazarken bağlantı kesildiğinde ürün yazmayı kuyruğa almaz. Kurucu son başarılı kayıt zamanını ve henüz gönderilmemiş içerik riskini görür. Yeniden bağlanınca son taban revizyonuyla kayıt denenir; gerekirse Çakışma Taslağı oluşur. Yerel çalışma kuyruğu veya çevrimdışı veritabanı kurulmaz.

Bu yolculuk belge yazarlığını, hiyerarşisini ve keşfini tamamlar. Kişisel Wiki kapsamı ve Wiki yayını ayrıdır.

## Alt Fazlar

### Belge yazarlığı

Belge yazarlığı Markdown, canlı kayıt blokları ve desteklenen zengin içeriği tek gövdede düzenler. Gövde veritabanındaki belgedir.

Canlı blok kaynak kaydı kopyalamaz. Kurucu bloktan kaynağa döner.

Yazarlık dış editör senkronu veya Wiki motoru değildir. Ürün içi belgedir.

### Bağlantı kaybı

Bağlantı kesildiğinde editör mevcut bellek tamponundan sonra yeni düzenleme kabul etmeyi durdurur. Son başarılı kayıt ve henüz gönderilmemiş içerik riski görünür; `Kopyala` ve `İndir` kurtarma eylemleri sunulur.

Yeniden bağlanma mevcut oturumu gizlice tamamlamaz. Son taban revizyonuyla kayıt denenir; gerekirse Çakışma Taslağı oluşur.

Bu alt faz çevrimdışı çalışma veya yerel taslak veritabanı kurmaz. Uygulama ya da cihaz kaybında sunucuya gönderilmemiş tamponun korunacağı vaat edilmez.

### Sürüm ve çatışma

Belge sürümleri karşılaştırılır. Çatışma taslağı çözülmeden ana gerçeğe karışmaz.

Kurucu önceki ve sonraki gövdeyi görür ve birleştirir. Otomatik kazanan seçilmez.

Sürüm, Git commit veya dış dosya revizyonu değildir. Belge kaydının ürün sürümüdür.

### Belge şablonları ve Persona

Yeni Belge kullanıcı şablonundan veya Persona sözleşmesinden bağımsız kimlikle oluşur. Şablon canlı bağlı kalmaz.

Persona, belgenin başlangıç yapısını verir; yazarın yerine içerik yazmaz.

Bu alt faz İş şablonu veya Başlangıç iskeleti değildir.

### Belge arşivi

Belge arşivi kimlik, sürüm, ilişki ve çocuk bağlarını koruyarak güncel çalışmadan ayırır. Belge silinmiş sayılmaz.

Arşivli Belge normal yazarlık yüzeyinden çıkar. Geri alma kimliği korur.

Bu alt faz Proje arşivi veya Wiki yayını durdurma değildir.

### Belge kapsamını taşıma ve kopyalama

Kapsam taşıma, açıkça seçilen çocuklar ve aynı kaynağın Dosya Ekleriyle kimliği koruyarak başka kapsama alır. Kopya yeni kimlik üretir.

Kurucu taşıma ile kopyanın çocuk ve ek etkisini önizler. Bütün ilişki grafiği taşınmaz.

İş kapsamı bu işlemle değişmez. Belge taşımak İşi taşımak değildir.

### Tek Belge dışa aktarma

Tek Belge dışa aktarma canlı blokları tarihli snapshota çevirir ve Markdown veya PDF üretir. Dış dosya canlı eşitlenen kopya olmaz.

Kurucu neyin donduğunu görür. Canlı kayıt sonraki değişince eski dışa aktarma güncellenmez.

Bu alt faz Çalışma Alanı çıkış paketi veya Wiki yayını değildir.

### Belge hiyerarşisi

Belgeler klasör ve sınırlı ebeveyn–çocuk ilişkisiyle aynı sahiplik kapsamında düzenlenir. Hiyerarşi taşıması kapsamı, kimliği veya yaşam döngüsünü değiştirmez.

Klasör sahiplik kapsamı veya Akıllı Koleksiyon değildir. Sınırsız derin ağaç veya çapraz kapsam ebeveyn yoktur.

Bilgi bulunur. Hiyerarşi yalnızca düzenler.

### Belge ve dosya keşfi

Belge ve Dosya Ekleri kapsam, tür, klasör ve desteklenen üstverilerle taranır. Keşif görünümü ikinci içerik veya sahiplik kaynağı oluşturmaz.

Filtreler sorgu sonucu kaydı üretmez; mevcut ana kayıtları listeler. Dosya ekleri belgeden bağımsız global dosya havuzu olmaz.

Bu alt faz evrensel aramanın yerine geçmez.

## Tamamlanma Ölçütleri

- Markdown, canlı kayıt blokları ve desteklenen zengin içerik tek Belge gerçeğinde düzenlenir.
- Bağlantı kesildiğinde offline kuyruk oluşmaz; kullanıcı son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür. Yeniden bağlanınca sessiz basım olmaz; gerekirse Çakışma Taslağı oluşur.
- Sürümler karşılaştırılır; çatışma taslağı çözülmeden ana gerçeğe karışmaz.
- Yeni Belge kullanıcı şablonundan veya Persona sözleşmesinden bağımsız kimlikle oluşur.
- Arşiv, kapsam taşıma/kopyalama ve tek Belge dışa aktarma kimlik etkilerini ayırır.
- Belgeler klasör ve sınırlı ebeveyn–çocuk ilişkisiyle aynı sahiplik kapsamında düzenlenir.
- Hiyerarşi taşıması kapsamı, kimliği veya yaşam döngüsünü değiştirmez.
- Belge ve Dosya Ekleri kapsam, tür, klasör ve desteklenen üstverilerle taranır.
- Keşif görünümü ikinci içerik veya sahiplik kaynağı oluşturmaz.

## Kapsam Sınırları

- Belgeyi Dosya Eki, harici Markdown dosyası veya kayıt açıklaması sayma.
- Çatışmayı sessizce birleştirip geçmişi ezme.
- Taşıma ile kopyanın kimlik ve Dosya Eki etkilerini karıştırma.
- Klasörü sahiplik kapsamı veya Akıllı Koleksiyon sayma.
- Hiyerarşi taşımasıyla Belge kapsamını değiştirme.
- Sınırsız derin ağaç veya çapraz kapsam ebeveyn.
- Keşif listesini yeni kayıt sistemi veya paylaşılan kütüphane sayma.
- Dosya eklerini belgeden bağımsız global dosya havuzu yapmak.
- Görünümü evrensel aramanın yerine koyma.
- İstemci kabuğunu yerel-first veya offline-first ürüne dönüştürme.
