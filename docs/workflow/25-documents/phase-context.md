# Belge Yazarlığı ve Sürümleri

Kurucu veritabanındaki Markdown Belgeleri uygulama içinde yazar, canlı bağlamla birleştirir, sürümler ve çatışmaları tarihsel bütünlüğü bozmadan çözer.

Belge başka kaydın metin alanı veya dış dosyayla canlı eşitlenen kopya değildir. Şablon ve Persona yeni belgeyi bağımsız kimlikle başlatır. Canlı bloklar kaynak kimliğini korur; dışa aktarma onları tarihli snapshota çevirir.

Bu feature belge yazarlığı ve sürümlerini tamamlar. Kişisel Wiki kapsamı, hiyerarşi gezgini ve Wiki yayını ayrı feature'lardır.

## Alt Fazlar

### Belge yazarlığı

Belge yazarlığı Markdown, canlı kayıt blokları ve desteklenen zengin içeriği tek gövdede düzenler. Gövde veritabanındaki belgedir.

Canlı blok kaynak kaydı kopyalamaz. Kurucu bloktan kaynağa döner.

Yazarlık dış editör senkronu veya Wiki motoru değildir. Ürün içi belgedir.

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

## Tamamlanma Ölçütleri

- Markdown, canlı kayıt blokları ve desteklenen zengin içerik tek Belge gerçeğinde düzenlenir.
- Sürümler karşılaştırılır; çatışma taslağı çözülmeden ana gerçeğe karışmaz.
- Yeni Belge kullanıcı şablonundan veya Persona sözleşmesinden bağımsız kimlikle oluşur.
- Arşiv, kapsam taşıma/kopyalama ve tek Belge dışa aktarma kimlik etkilerini ayırır.

## Kapsam Sınırları

- Belgeyi Dosya Eki, harici Markdown dosyası veya kayıt açıklaması sayma.
- Çatışmayı sessizce birleştirip geçmişi ezme.
- Taşıma ile kopyanın kimlik ve Dosya Eki etkilerini karıştırma.
