# Etiketler

Kurucu içerikleri tek Çalışma Alanı etiket ad alanıyla sınıflandırır. Belge içi etiketler, filtreler, arama, yeniden adlandırma ve taşınabilirlik aynı kimliği kullanır.

Bir etiketi yeniden adlandırmak veya birleştirmek bütün kullanımları atomik günceller. Kurucu aynı sınıfı Belge gövdesinde ve kayıtlarda ayrı sözlükler olarak yönetmez.

Bu feature etiket ad alanını tamamlar. Akıllı Koleksiyon, klasör hiyerarşisi ve Kanıt bağı etiket değildir.

## Alt Fazlar

### Etiket yaşam döngüsü

Etiket Çalışma Alanı ad alanında yaşar. Oluşturma, yeniden adlandırma ve birleştirme bütün bağlı kullanımları tek sonuç olarak günceller.

Kurucu eski adı ve yeni adı ayrı gerçekler olarak görmez. Birleştirme kopya etiket bırakmaz.

Yaşam döngüsü kayıt silme veya kapsam taşıma değildir. Etiket kimliği sınıflandırmayı taşır; içeriği taşımaz.

### Belge içi etiketler

Belge gövdesindeki desteklenen etiket tokenı aynı Çalışma Alanı etiket kimliğini hedefler. Yazım ile kayıt sınıfı ayrılmaz.

Token görünümü Markdown düzenlemesinin parçasıdır; ayrı bir etiket veritabanı oluşturmaz. Geçersiz token sessizce yeni etiket uydurmaz.

Bu alt faz Wiki yayını veya dış Markdown hashtag senkronu değildir.

## Tamamlanma Ölçütleri

- Etiket oluşturma, yeniden adlandırma ve birleştirme bütün kullanımları atomik günceller.
- Markdown içindeki desteklenen etiket tokenı aynı Çalışma Alanı etiket kimliğini hedefler.

## Kapsam Sınırları

- Projeye özel etiket sözlüğü veya ikinci Belge etiket sistemi.
- Etiketi klasör, Akıllı Koleksiyon veya ilişki türü sayma.
- Belge içi tokenı serbest metin hashtag olarak bırakıp kimlikten koparma.
