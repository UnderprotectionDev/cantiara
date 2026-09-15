# Kanban

Kurucu aynı İş gerçeğini durum sütunlarında görür. Sütunlar arasındaki kart hareketi İş akışı durumuna yansır. İş durumu yalnız açık bir durum eylemiyle veya bu sütun hareketiyle değişir; Backlog, Günlük Odak, Takvim, Roadmap, Favori veya Odak Dönemi üyeliği durum yazmaz.

Kapanmış İşlerde Tamamlandı veya Vazgeçildi sonucu aynı terminal durumda bile kart üzerinde ayırt edilir. `Closed` sütununa almak kapanış adımını atlatmaz; sonuç yalnız açık kapatma veya yeniden açma ile değişir. Kart, kayıtlı görünümün görünür alanlarıyla taranabilir özet sunar. Liste görünümü aynı İş taramasının yoğun sunumudur; ayrı kayıt sistemi değildir.

Bu feature Kanban'ı tamamlar. Backlog, Günlük Odak, Birleşik Takvim, Kapsam Ağacı ve Yol haritası ufku ayrıdır. Kanban yayın taahhüdü, sprint veya ikinci kayıt üretmez.

## Alt Fazlar

### Durum sütunları

Kanban İş durumunu açık sürükleme veya eylemle değiştirir. Sütun, kapanış sonucu veya arşiv değildir. Yeniden görünme tarihi gelene kadar kart varsayılan kümede geri planda durabilir; durum değişmez.

Kurucu kartı kaynak İş olarak açar. Sürükleme sessiz otomasyon veya GitHub durumu yazmaz. Tahta ikinci İş listesi üretmez. Üyelik Projedeki İş gerçeğidir.

Devam eden İş sayısı ve aktif kartların mevcut durumda geçirdiği süre görünür. İsteğe bağlı kişisel odak eşiği ve durum bazlı soft WIP sınırı aşıldığında nötr işaret durur; kart hareketi engellenmez, bildirim veya sağlık hükmü üretmez.

Kullanıcı durum sütunlarını yalnız görünümü sıkıştırmak için daraltabilir. Daraltılmış sütun adını, kart sayısını ve açık blokaj gibi önemli sinyalleri göstermeye devam eder; daraltma işleri filtrelemez veya durumlarını değiştirmez. Kanban bağımsız manuel kart sırası tutmaz; kayıtlı görünümün açık sıralama ayarını kullanır.

### Liste görünümü

Liste görünümü planlanmamış İşler dahil filtrelenen kapsam alanlarıyla yoğun ve taranabilir düzen sunar. Satır, karttan ayrı kayıt değildir.

Kurucu alanları tarar, sıralar ve kaynağı açar. Liste durumu veya kapanışı örtük yazmaz.

Bu görünüm Tablo Görünümü, Akıllı Koleksiyon veya Backlog manuel sırası değildir. Aynı İş taramasının düz sunumudur.

## Tamamlanma Ölçütleri

- Sütunlar arası kart hareketi İş akışı durumuna yansır; `Closed` kapanış adımını atlatmaz.
- Soft WIP ve odak eşiği hareketi engellemez.
- Liste görünümü aynı İş gerçeğini taranabilir düzende sunar; ayrı kayıt üretmez.

## Kapsam Sınırları

- Yüzeyi sprint, yayın taahhüdü veya kapanış sonucu sayma.
- Liste görünümünü ayrı bir kayıt sistemi yapmak.
- Kanban'da bağımsız kalıcı manuel sıra tutma.
- Backlog, Günlük Odak veya Takvim kaydırmasıyla durum yazma.
