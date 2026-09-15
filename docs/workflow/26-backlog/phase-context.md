# Backlog

Kurucu henüz planlanmamış İşler dahil değerlendirilmesi gereken aktif, arşiv ve çöp dışı İşleri durumdan bağımsız görür ve tek kalıcı manuel sırayı kaydeder. Backlog üyeliği, ele alma veya başka planlama görünümüne almak İş durumunu değiştirmez. Durum yalnız Kanban hareketi veya açık durum eylemiyle değişir.

Backlog hazır, dinamik bir Akıllı Koleksiyondur. Klasör, etiket veya statik liste kaydı değildir. Gelecek yeniden görünme tarihi varsayılan görünümde Deferred bölümündedir; tarih gelince İş kaydedilmiş manuel sırasındaki konumuna döner.

Bu feature Backlog'u tamamlar. Kanban, Günlük Odak, Birleşik Takvim, Önceliklendirme oturumu ve Odak Dönemi ayrıdır.

## Alt Fazlar

### Manuel sıra

Backlog kendine ait tek kalıcı manuel sıra tutar. Kurucu kartları sürükleyerek hangisini önce ele alacağını kalıcılaştırır.

Alternatif öncelik, tarih veya alan sıralaması geçici ya da kayıtlı sunum olarak seçildiğinde manuel sıra arka planda korunur; `Manuel sıra` görünümü seçilince geri gelir. Bu sıra Kanban veya normal Akıllı Koleksiyonlarda bağımsız manuel konum üretmez; açık Önceliklendirme oturumunun ayrı rank'i Backlog sırasına yazılmaz.

Sıra, öncelik puanı veya kapanış değildir.

### Yeniden görünme ve Deferred

Kurucu neyin ne zaman tekrar görüneceğini kaydeder. Gelecek yeniden görünme tarihi varsayılan Backlog görünümünde Deferred bölümündedir.

Tarih İş durumunu değiştirmez. Bildirim varsayılan kapalıdır ve yalnız Proje bazında açık opt-in ile üretilir. Tarih gelince İş Günlük Odak adayında görünebilir; aday olmak Backlog üyeliği veya Odak üyeliği değildir.

## Tamamlanma Ölçütleri

- Backlog üyeliği ve ele alma İş durumunu değiştirmez.
- Tek kalıcı manuel sıra alternatif sunum seçilince arka planda korunur.
- Gelecek yeniden görünme tarihi Deferred bölümüne ayırır; tarih durum yazmaz.

## Kapsam Sınırları

- Backlog'u klasör, etiket, sprint veya ikinci İş listesi sayma.
- Manuel sırayı Kanban konumu veya öncelik puanı yapmak.
- Yeniden görünme tarihini otomatik durum geçişi sayma.
