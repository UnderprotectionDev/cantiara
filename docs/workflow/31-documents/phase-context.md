# Belge Yazarlığı ve Sürümleri

Kurucu veritabanındaki Markdown Belgeleri uygulama içinde yazar, canlı bağlamla birleştirir, sürümler ve çatışmaları tarihsel bütünlüğü bozmadan çözer. Belgeler klasörler ve sınırlı ebeveyn–çocuk ilişkisiyle aynı sahiplik kapsamında düzenlenir.

Belge başka kaydın metin alanı veya dış dosyayla canlı eşitlenen kopya değildir. Şablon ve Persona yeni belgeyi bağımsız kimlikle başlatır. Proje kabuğunun seçtiği `Persona`, `Retrospective` ve `Launch Plan` iskeletleri bu feature'da boş başlık yapılı Belge olarak yaşar. Canlı bloklar kaynak kimliğini korur; dışa aktarma onları tarihli snapshota çevirir. Hiyerarşi sahipliği veya yaşam döngüsünü değiştirmez; yalnızca düzenler. Markdown gövdesindeki `#etiket` tokenı Çalışma Alanı etiket kimliğini hedefler.

Yeniden bağlanınca son taban revizyonuyla kayıt denenir; gerekirse Çakışma Taslağı oluşur. Çakışma taslağı çözülmeden ana gerçeğe karışmaz. Online-only kuyruk yasağı çevrimiçi web ve macOS istemcisindedir.

Bu feature belge yazarlığını, sürümünü, hiyerarşisini, belge iskeletini ve Belge içi etiketi tamamlar. Kayıt keşfi, Kişisel Wiki kapsamı, etiket sözlüğü ve Wiki yayını ayrıdır.

## Alt Fazlar

### Belge yazarlığı

Belge yazarlığı Markdown, canlı kayıt blokları ve desteklenen zengin içeriği tek gövdede düzenler. Gövde veritabanındaki belgedir.

Canlı blok kaynak kaydı kopyalamaz. Kurucu bloktan kaynağa döner.

Yazarlık dış editör senkronu veya Wiki motoru değildir. Ürün içi belgedir.

### Sürüm ve çatışma

Belge sürümleri karşılaştırılır. Çatışma taslağı çözülmeden ana gerçeğe karışmaz.

Kurucu önceki ve sonraki gövdeyi görür ve birleştirir. Otomatik kazanan seçilmez. Yeniden bağlanma sessiz basım yapmaz.

Sürüm, Git commit veya dış dosya revizyonu değildir. Belge kaydının ürün sürümüdür.

### Belge şablonları ve Persona

Yeni Belge kullanıcı şablonundan veya Persona sözleşmesinden bağımsız kimlikle oluşur. Şablon canlı bağlı kalmaz.

Persona, belgenin başlangıç yapısını verir; yazarın yerine içerik yazmaz.

Bu alt faz İş şablonu değildir. Proje kabuğunun seçtiği boş Başlangıç iskeleti ayrı alt fazdadır.

### Belge başlangıç iskeletleri

`Persona`, `Retrospective` ve `Launch Plan` iskeletleri yalnız boş bölüm başlığı kurar. Oluştuktan sonra normal Belge olarak yaşar.

İskelet ana kayıt örneği, bulgu, görev veya karar üretmez. İçerik kurucunun yazacağı yerdir. Katalog seçimi proje kabuğundadır; yaşayan örnek burada oluşur.

Bu alt faz kapanış özeti taslağı, duvar iskeleti veya şablon pazarı değildir.

### Belge içi etiketler

Belge gövdesindeki desteklenen `#etiket` tokenı aynı Çalışma Alanı etiket kimliğini hedefler. Yazım ile kayıt sınıfı ayrılmaz.

Token görünümü Markdown düzenlemesinin parçasıdır; ayrı bir etiket veritabanı oluşturmaz. Geçersiz token sessizce yeni etiket uydurmaz. Etiket sözlüğü etiket feature'ındadır.

Bu alt faz Wiki yayını veya dış Markdown hashtag senkronu değildir.

### Belge arşivi

Belge arşivi kimlik, sürüm, ilişki ve çocuk bağlarını koruyarak güncel çalışmadan ayırır. Belge silinmiş sayılmaz.

Arşivli Belge normal yazarlık yüzeyinden çıkar. Geri alma kimliği korur.

Bu alt faz Proje arşivi, Çöp Kutusu veya Wiki yayını durdurma değildir.

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

## Tamamlanma Ölçütleri

- Markdown, canlı kayıt blokları ve desteklenen zengin içerik tek Belge gerçeğinde düzenlenir.
- Sürümler karşılaştırılır; çatışma taslağı çözülmeden ana gerçeğe karışmaz.
- Yeni Belge kullanıcı şablonundan veya Persona sözleşmesinden bağımsız kimlikle oluşur.
- Seçilen `Persona`, `Retrospective` ve `Launch Plan` iskeletleri boş başlık yapılı Belge olarak yaşar.
- Markdown içindeki desteklenen etiket tokenı aynı Çalışma Alanı etiket kimliğini hedefler.
- Arşiv, kapsam taşıma/kopyalama ve tek Belge dışa aktarma kimlik etkilerini ayırır.
- Belgeler klasör ve sınırlı ebeveyn–çocuk ilişkisiyle aynı sahiplik kapsamında düzenlenir.
- Hiyerarşi taşıması kapsamı, kimliği veya yaşam döngüsünü değiştirmez.

## Kapsam Sınırları

- Belgeyi Dosya Eki, harici Markdown dosyası veya kayıt açıklaması sayma.
- Çatışmayı sessizce birleştirip geçmişi ezme.
- Taşıma ile kopyanın kimlik ve Dosya Eki etkilerini karıştırma.
- Klasörü sahiplik kapsamı veya Akıllı Koleksiyon sayma.
- Hiyerarşi taşımasıyla Belge kapsamını değiştirme.
- Sınırsız derin ağaç veya çapraz kapsam ebeveyn.
- Belge taramasını bu feature'ın keşif yüzeyi sayma; evrensel arama ayrıdır.
- Dosya eklerini belgeden bağımsız global dosya havuzu yapmak.
- Belge içi tokenı serbest metin hashtag olarak bırakıp kimlikten koparma.
- Belge iskeletini duvar iskeleti veya içerikli şablon sayma.
