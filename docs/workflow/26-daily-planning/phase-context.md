# Günlük Planlama

Kurucu aynı İş gerçeğini Kanban, Backlog, Günlük Odak ve Birleşik Takvimde yaşam döngüsünü örtük değiştirmeden planlar. Liste görünümü taranabilir düzendir; Kapsam Ağacı Özellik–İş üyesini salt okunur açar.

Yüzeyler yayın taahhüdü, sprint veya ikinci kayıt üretmez. Kanban dışında görünüm değişikliği İş durumunu yazmaz.

Bu feature günlük planlamayı tamamlar. Yol haritası ufku, Odak Dönemi ve öncelik oturumu ayrıdır.

## Alt Fazlar

### Kanban

Kanban İş durumunu açık sürükleme veya eylemle değiştirir. Sütun, kapanış sonucu veya arşiv değildir. Yeniden görünme tarihi gelene kadar kart varsayılan kümede geri planda durabilir; durum değişmez.

Kurucu kartı kaynak İş olarak açar. Sürükleme sessiz otomasyon veya GitHub durumu yazmaz.

Tahta ikinci İş listesi üretmez. Üyelik Projedeki İş gerçeğidir.

### Backlog

Backlog manuel sıra ve yeniden görünme tarihini durumdan bağımsız yönetir. Sıra, öncelik puanı veya kapanış değildir.

Kurucu neyin ne zaman tekrar görüneceğini kaydeder. Gelecek yeniden görünme tarihi varsayılan görünümde Deferred bölümündedir. Bildirim varsayılan kapalı ve Proje bazında opt-in'dir.

Backlog klasör, etiket veya statik liste kaydı değildir. Aynı İş gerçeğinin sıra yüzeyidir.

### Günlük Odak

Günlük Odak kişisel günlük kapsamı seçer. Gün kapanınca tarihsel sonuç korunur; ertesi güne otomatik üyelik taşımaz.

Seçim İşin Proje kapsamını veya durumunu değiştirmez. Kişisel bir çalışma kararıdır.

Günlük Odak Odak Dönemi, sprint veya Takvim olayı değildir.

### Birleşik Takvim

Birleşik Takvim tarih alanlarını hangi semantiği değiştirdiği açıkça göstererek düzenler. Teslim, anımsatıcı ve pencere tarihleri karışmaz.

Kurucu bir tarihi kaydırınca etkilenen alanı görür. Takvim yeni İş türü veya durum üretmez.

Bu yüzey kişisel hatırlatma veya dış takvim senkronu değildir.

### Liste görünümü

Liste görünümü planlanmamış İşler dahil filtrelenen kapsam alanlarıyla yoğun ve taranabilir düzen sunar. Satır, karttan ayrı kayıt değildir.

Kurucu alanları tarar, sıralar ve kaynağı açar. Liste durumu veya kapanışı örtük yazmaz.

Bu görünüm Tablo Görünümü veya Akıllı Koleksiyon değildir. Planlama kapsamındaki İş listesidir.

### Kapsam Ağacı

Kapsam Ağacı Özellik ve kapsadığı İşleri aynı kanonik ilişki üzerinden salt okunur açar. İç içe epic veya subtask hiyerarşisi kurulmaz.

Kurucu kapsamı ağaçta görür ve kaynağı açar. Ağaç içinde sürükleme kapsamı değiştirmez.

Ağaç Proje yapısı, klasör veya Kilometre Taşı kırılımı değildir.

## Tamamlanma Ölçütleri

- Aynı İş Kanban, Backlog, Günlük Odak ve Takvimde yaşam döngüsü örtük değişmeden görünür ve düzenlenir.
- Kanban dışında görünüm değişikliği İş durumunu yazmaz.
- Günlük Odak kapanışta tarihsel sonuç bırakır; ertesi güne otomatik üyelik taşımaz.
- Kapsam Ağacı aynı kanonik ilişkiyi salt okunur sunar.

## Kapsam Sınırları

- Yüzeyi sprint, yayın taahhüdü veya İş akışı durumu sayma.
- Liste görünümünü ayrı bir kayıt sistemi yapmak.
- Kapsam Ağacında sürükleyerek parent–child üretme.
- Odak Dönemi, Kilometre Taşı veya Roadmap'i bu karta yığma.
