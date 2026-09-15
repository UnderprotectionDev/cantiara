# Etiketler

Kurucu içerikleri tek Çalışma Alanı etiket ad alanıyla sınıflandırır. Filtreler, arama, yeniden adlandırma ve taşınabilirlik aynı kimliği kullanır.

Bir etiketi yeniden adlandırmak veya birleştirmek bütün kullanımları atomik günceller. Etiket kimliği sınıflandırmayı taşır; içeriği taşımaz. Belge gövdesindeki `#etiket` tokenı belge feature'ındadır; ikinci bir etiket sözlüğü açmaz.

Bu feature etiket ad alanını tamamlar. Akıllı Koleksiyon, klasör hiyerarşisi, Belge içi token ve Kanıt bağı etiket değildir.

## Tamamlanma Ölçütleri

- Etiket oluşturma, yeniden adlandırma ve birleştirme bütün kullanımları atomik günceller.
- Etiket Çalışma Alanı ad alanında yaşar; Projeye özel ikinci sözlük oluşmaz.

## Kapsam Sınırları

- Projeye özel etiket sözlüğü veya ikinci Belge etiket sistemi.
- Etiketi klasör, Akıllı Koleksiyon veya ilişki türü sayma.
- Belge içi tokenı bu kartın feature'ı sayma.
