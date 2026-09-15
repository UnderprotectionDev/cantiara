# İlişkiler ve Geri Bağlantılar

Ana kayıtlar kapalı tür kataloğuyla açıkça bağlanır. Standart ilişkiler, kullanım bağları ve geri bağlantılar birbirinin anlamını üstlenmez.

Kurucu bir kaydın neden bağlı olduğunu ve nerede kullanıldığını kaydın kendisinden okur. Belirsiz "ilgili" yığını veya otomatik grafik çıkarımı oluşmaz.

Bu feature ilişki ve geri bağlantı sözleşmesini tamamlar. Kanıt bağı, GitHub bağlantısı ve kapsam taşıma kendi feature'larındadır.

## Alt Fazlar

### Türlenmiş ilişkiler

Türlenmiş ilişki iki ucu, yönü ve kapalı anlamı ile saklanır. Kullanıcı hangi kaydın hangisine neden bağlandığını görür.

İlişki karşı ucun yaşamını otomatik kapatmaz. Kapsam yalıtımı çözülemeyen ucu kırık referans olarak bırakır.

Bu alt faz Kanıtı, blokör veya GitHub bağlantısı değildir. Yalnız katalogdaki standart bağdır.

### Kullanım bağları

Kullanım bağı, bir kaydın başka bir kayıt içinde canlı gömülmesini izler. Bu, standart ilişkiden ayrı bir izdir.

Gömülü canlı kart veya blok kaynak kimliğini korur. Kullanım, hedef kaydı kopyalamaz ve durumunu değiştirmez.

Kullanım bağını silmek gömüyü kaldırır; kaynak kaydı silmez. Belge gövdesi ile ilişki grafiği karışmaz.

### Geri bağlantılar

Geri bağlantılar kaydın nerede kullanıldığını ve ilişkilendirildiğini kaynağına açar. Kurucu etkiyi kaydın sayfasından görür.

Liste ikinci bir doğruluk kaynağı değildir. Her satır mevcut ilişki veya kullanım bağından türetilir.

Geri bağlantı otomatik öneri, analitik veya paylaşım grafiği değildir.

## Tamamlanma Ölçütleri

- İlişkinin iki ucu, yönü ve anlamı kapalı katalogla korunur.
- Gömülü canlı kullanımlar standart ilişkilerden ayrı izlenir.
- Kayıt, kullanıldığı ve ilişkilendirildiği bağlamları kaynağına açar.

## Kapsam Sınırları

- Serbest etiket grafiği veya belirsiz "ilgili" yığını.
- Kullanım bağını standart ilişki veya Kanıt bağı sayma.
- Geri bağlantıyı kopya içerik veya ikinci sahiplik kaynağı yapmak.
