# İş Bağımlılıkları ve Blokajlar

Kurucu İşler arasındaki etkin veya çözülmüş engeli açık ilişki ve geçmişle yönetir. Kaynak İşin kapanması engeli sessizce çözmez. Karar veya Açık Soru kaynağı aynı ilişki sözleşmesini kullanır; İşten İşe engel bu feature'ı tamamlamak için yeterlidir.

Blokaj görünür kalır. Kurucu neyin kimi beklettiğini ve çözümün ne zaman geldiğini kaydın geçmişinden okur; sütun rengi veya otomatik kapanış bu gerçeğin yerine geçmez.

`Blokaj` dikkat sinyali yalnız iki olayda üretilir: engellenen İşe yeni `Aktif` ilişki kurulması ve çözülmüş ilişkinin yeniden `Aktif` yapılması. Sinyal Birleşik Bildirim Merkezinde gösterilir; merkez bu kartın feature'ı değildir. Özellik ve Odak Dönemi detayındaki isteğe bağlı salt-okunur `Bağımlılıklar` görünümü bu ilişkilerden türetilir; görünüm yeni ilişki üretmez.

Bu feature iş bağımlılığı ve blokajı tamamlar. Öncelik, otomasyon ve GitHub bağlantısı engeli örtük kapatmaz.

## Tamamlanma Ölçütleri

- Etkin ve çözülmüş engeller açık ilişki ve geçmişle yönetilir.
- Kaynak İşin kapanması engeli sessizce çözmez; çözüm ayrı ve görünürdür.
- Yeni veya yeniden etkin `Aktif` engel, engellenen İş için `Blokaj` dikkat sinyali üretir; süre, kaynak durumu, döngü veya `Çözüldü` geçişi ayrı sinyal basmaz.

## Kapsam Sınırları

- Blokajı Kanban sütunu, etiket veya öncelik puanı sayma.
- Üst İş kapanınca alt engelleri otomatik çözme.
- GitHub PR birleşmesini sessiz blokaj çözümü yapmak.
- Dikkat merkezini veya `Bağımlılıklar` görünümünü bu kartın feature'ı sayma.
