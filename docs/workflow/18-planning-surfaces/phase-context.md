# İş Planlama Yüzeyleri

Kurucu aynı İş gerçeğini Kanban, Liste görünümü, Backlog, Günlük Odak, Odak Dönemi, Birleşik Takvim, Kilometre Taşı, Roadmap, Şimdi değil karar izi ve Kapsam Ağacında yaşam döngüsünü örtük değiştirmeden planlar.

Her yüzey aynı İşe farklı soru sorar: durum, tarama, sıra, bugün, pencere, tarih, ara sonuç, ufuk, erteleme gerekçesi veya kapsam. Yüzeyler yayın taahhüdü, sprint veya ikinci kayıt üretmez.

Bu feature iş planlama yüzeylerini tamamlar. Öncelik oturumu, bağımlılık ve Proje Sürümü kendi sınırlarında kalır.

## Alt Fazlar

### Kanban

Kanban İş durumunu açık sürükleme veya eylemle değiştirir. Sütun, kapanış sonucu veya arşiv değildir.

Kurucu kartı kaynak İş olarak açar. Sürükleme sessiz otomasyon veya GitHub durumu yazmaz.

Tahta ikinci İş listesi üretmez. Üyelik Projedeki İş gerçeğidir.

### Liste görünümü

Liste görünümü planlanmamış İşler dahil filtrelenen kapsam alanlarıyla yoğun ve taranabilir düzen sunar. Satır, karttan ayrı kayıt değildir.

Kurucu alanları tarar, sıralar ve kaynağı açar. Liste durumu veya kapanışı örtük yazmaz.

Bu görünüm Tablo Görünümü veya Akıllı Koleksiyon değildir. Planlama kapsamındaki İş listesidir.

### Backlog

Backlog manuel sıra ve yeniden görünme tarihini durumdan bağımsız yönetir. Sıra, öncelik puanı veya kapanış değildir.

Kurucu neyin ne zaman tekrar görüneceğini kaydeder. Tarih İş durumunu değiştirmez.

Backlog klasör, etiket veya statik liste kaydı değildir. Aynı İş gerçeğinin sıra yüzeyidir.

### Günlük Odak

Günlük Odak kişisel günlük kapsamı seçer. Gün kapanınca tarihsel sonuç korunur; ertesi güne otomatik üyelik taşımaz.

Seçim İşin Proje kapsamını veya durumunu değiştirmez. Kişisel bir çalışma kararıdır.

Günlük Odak Odak Dönemi, sprint veya Takvim olayı değildir.

### Odak Dönemi

Odak Dönemi seçili İşlerle çalışmak için geçici pencere açar. Kapanışta kapsam snapshotı ve değerlendirme bırakır.

Pencere kalıcı kapsam grubu, Kilometre Taşı veya Proje Sürümü değildir. Bitince yeni gerçek dayatmaz.

Değerlendirme otomatik sağlık hükmü veya yayın kapısı üretmez.

### Birleşik Takvim

Birleşik Takvim tarih alanlarını hangi semantiği değiştirdiği açıkça göstererek düzenler. Teslim, anımsatıcı ve pencere tarihleri karışmaz.

Kurucu bir tarihi kaydırınca etkilenen alanı görür. Takvim yeni İş türü veya durum üretmez.

Bu yüzey kişisel hatırlatma veya dış takvim senkronu değildir.

### Kilometre Taşları

Kilometre Taşı önemli ara sonucu izler. Bağlı İşler otomatik kapanmaz; Taş yayın kapsamı da değildir.

Kurucu ara sonucu tarih ve üyelikle görür. Üyelik Hedefe katkı veya Sürüm içeriği anlamına gelmez.

Kilometre Taşı sprint, Odak Dönemi veya Proje aşaması değildir.

### Roadmap

Roadmap ufuk ve görünüm gruplarını yayın taahhüdü veya durum üretmeden sunar. Gruplama anlatıdır.

Kurucu neyin hangi ufukta anlatıldığını görür. Roadmap üyeliği İş durumunu veya Sürüm kapsamını yazmaz.

Build in Public, bu yüzeyin onaylı snapshot'ını kullanabilir; canlı Roadmap herkese açık kopya değildir.

### Şimdi değil karar izi

Şimdi değil karar izi erteleme gerekçesini İşte korur. Gerekçe durum, Backlog sırası veya Roadmap üyeliğini örtük değiştirmez.

Kurucu neden beklettiğini sonra okur. İz, kapanış sonucu veya arşiv değildir.

Bu alt faz öncelik puanı veya otomasyon kuralı değildir. Karar izidir.

### Kapsam Ağacı

Kapsam Ağacı Özellik ve kapsadığı İşleri aynı kanonik ilişki üzerinden okur. İç içe epic veya subtask hiyerarşisi kurulmaz.

Kurucu kapsamı ağaçta görür ve kaynağı açar. Ağaç sürüklemesi ilişkiyi açık kurala göre günceller; gizli ebeveyn uydurmaz.

Ağaç Proje yapısı, klasör veya Kilometre Taşı kırılımı değildir.

## Tamamlanma Ölçütleri

- Aynı İş Kanban, Liste görünümü, Backlog, Günlük Odak, Odak Dönemi, Takvim, Kilometre Taşı, Roadmap, Şimdi değil izi ve Kapsam Ağacında yaşam döngüsü örtük değişmeden görünür ve düzenlenir.
- Günlük Odak ve Odak Dönemi kapanışta tarihsel sonuç veya kapsam snapshotı bırakır.
- Şimdi değil gerekçesi durum, Backlog sırası veya Roadmap üyeliğini örtük değiştirmez.

## Kapsam Sınırları

- Yüzeyi sprint, yayın taahhüdü veya İş akışı durumu sayma.
- Liste görünümünü ayrı bir kayıt sistemi yapmak.
- Kilometre Taşı, Odak Dönemi ve Proje Sürümünü birbirinin yerine kullanma.
