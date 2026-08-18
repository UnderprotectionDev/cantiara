# Referanslı Promptlarda Semantik Çıkarma Kullan

Durum: Kabul edildi.

Bu ADR geliştirme gerekçesini kaydeder; runtime davranışını tanımlamaz. Bağlayıcı davranış
[ana skill](../../SKILL.md) ile onun koşullu olarak bağladığı
[runtime referanslarında](../../references) yaşar.

Deep Prompt Builder görev kaynakları ile downstream runtime sözleşmelerini kapsama kümesi
sayacak, yalnız kullanıcı deltasını koruyacak ve ancak yeni, maddi ve çözüm dayatmayan yön
ekleyecek. Bu karar koşulsuz prompt genişletmenin yerini alır: downstream skill'leri opak
tutmak tekrarı doğrulamayı engelliyordu, sözleşmelerini kopyalamak ise referansları tek
doğruluk kaynağı olmaktan çıkarıyordu; yalnız kapsama çıkarmak için inceleme, referans
workflow'unu yinelemeden veya çalıştırmadan pasifliği korur.

Maddi yönler sabit alan merceklerinden değil hedef kararın açık kalan uzayından üretilir.
Kaynak sessizliği yenilik kanıtı değildir; geniş downstream yetkisi de yalnız tesadüfen
bulabileceği yönleri kapsamış sayılmaz. Aday, farklı cevabının hedef sonucu değiştirdiği
karşı-olgusal test ile doğrulanır ve prompta yalnız göreve özgü karar ayrımı olarak taşınır.
Keşif ve zenginleştirme niyeti bu aramayı genişletebilir, fakat belge türü veya skill adı
tetik değildir ve alan kategorileri runtime kontrol listesine dönüşmez.
