# Bitiriş Efektleri

Kurucu Hesap düzeyinde kapalı başlayan özgün tema ve paleti seçer. Efekt yalnız görünür istemcide başlatılan ve sunucuda kalıcı Tamamlandı sonucuyla kabul edilen İş kapanışında oynar.

Bitiriş, işin bittiğine dair görünür bir kutlama verir. Otomasyon, dış olay veya Vazgeçildi sonucu efekt üretmez; hareket güvenliği kutlamayı düşürür ama başarıyı gizlemez.

Bu feature bitiriş efektlerini tamamlar. Hesap görünüm tercihi, bildirim ve kapanış sonucu semantiği ayrı kalır.

## Alt Fazlar

### Tema ve palet seçimi

Tema ve palet Hesap düzeyinde kapalı katalogdan seçilir. Örnekler durağandır; gezinti hareket başlatmaz.

Kurucu açık Önizle eylemiyle hareketi görür. Seçim Proje veya İş bazında çoğalmaz.

Tercih ürün teması, tasarım tokenı veya Moodboard paleti değildir.

### Tamamlanma tetikleyicisi

Efekt, görünür istemcide başlatılan ve sunucunun kalıcı Tamamlandı kabul ettiği tek kapanışta oynar. Çift tetik olmaz.

Yeniden açılıp tekrar tamamlanan İş yeni bir olaydır. Geçmiş kapanışlar tekrar oynamaz.

Tetikleyici dış araç, test sonucu veya otomasyon kapanışı değildir.

### Hareket güvenliği

Azaltılmış hareket ve çizim bütçesi dekorasyonu sadeleştirir. Kurucu işin tamamlandığını yine görür.

Yedek, sessiz başarısızlık veya efekti atlanmış kapanış gizlemez. Başarı geri bildirimi kalır.

Bu alt faz erişilebilirlik tercihini Hesap locale'ine bağlama veya animasyon motoru seçimi değildir.

## Tamamlanma Ölçütleri

- Kapalı katalog durağan örneklerle seçilir; hareket yalnız açık Önizle eyleminde başlar.
- Yalnız kullanıcı başlatmalı ve kalıcı Tamamlandı sonucu tek efekt olayı üretir.
- Azaltılmış hareket ve çizim bütçesi dekorasyonu düşürür; başarı geri bildirimini düşürmez.

## Kapsam Sınırları

- Vazgeçildi, otomasyon veya GitHub olayıyla efekt tetikleme.
- Açık uçlu tema pazarı veya sürekli arka plan animasyonu.
- Hareketi kapatınca kapanış geribildirimini de kaldırma.
