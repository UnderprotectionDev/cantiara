# Birleşik Takvim

Kurucu desteklenen tarihli kayıtları gün, hafta, ay ve Agenda görünümünde, hangi semantiği değiştirdiğini açıkça göstererek düzenler. Teslim, anımsatıcı ve pencere tarihleri karışmaz. Planlanan başlangıç tarihi işi gizlemez, otomatik başlatmaz ve durumunu değiştirmez.

Takvim yeni İş türü veya durum üretmez. Planlanan başlangıç, hedef ve yeniden görünme tarihleri ayrı tür ve anlamlarıyla durur; bütün Projeler veya seçilen Proje kapsamında incelenebilir. Durum yalnız Kanban hareketi veya açık durum eylemiyle değişir.

Bu feature Birleşik Takvimi tamamlar. Kanban, Backlog, Günlük Odak, kişisel hatırlatma ve dış takvim senkronu ayrıdır.

## Alt Fazlar

### Gün, hafta ve ay

Başlangıç ile hedef tarihi birlikte bulunan İşler hafta ve ay görünümlerinde tarih aralığı olarak gösterilir. Gün görünümü yalnız seçili gündeki konumlarını gösterir.

Kurucu bir tarihi kaydırınca etkilenen alanı görür. Takvim yayın taahhüdü veya durum sütunu değildir.

### Agenda

Agenda aynı kayıtları seçilen kapsam ve tarih türü filtrelerini koruyarak kronolojik, yoğun bir listede sunar. Her satır temsil ettiği tarih türünü açıkça gösterir ve ortak `Kaynak kaydı aç` eylemini kullanır.

Agenda üyeliği, bağımsız Event kaydı, yeni tarih alanı veya ikinci takvim doğruluk kaynağı oluşturmaz.

### Tarih kaydırma

Kullanıcı bir tarih işaretini başka güne sürükleyerek yalnız temsil ettiği kaynak tarih alanını güncelleyebilir. Tarih türü ve eski/yeni değer bırakmadan önce görünür olur.

Değişiklik iş durumunu veya diğer tarih alanlarını etkilemez ve güvenli biçimde geri alınabilir. Bu yüzey kişisel hatırlatma veya dış takvim senkronu değildir.

## Tamamlanma Ölçütleri

- Desteklenen tarih alanları türleri karışmadan gün, hafta, ay ve Agenda'da görünür.
- Agenda ikinci Event kaydı veya yeni tarih alanı üretmez.
- Kaydırma yalnız temsil ettiği tarih alanını günceller; durum yazmaz.

## Kapsam Sınırları

- Takvimi durum tahtası, sprint veya dış takvim senkronu sayma.
- Agenda'yı bağımsız Event kaydı yapmak.
- Bir tarih kaydırmasıyla diğer tarih alanlarını veya İş durumunu örtük yazma.
